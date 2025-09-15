"""
Transport-agnostic logging contracts and interfaces.

This module defines the core protocols and types for deterministic,
ordered event emission with strict I/O separation guarantees.
"""

import json
import time
import threading
import atexit
import re
import logging
from typing import Protocol, Literal, Any, Dict, Optional
from datetime import datetime, timezone


Level = Literal["debug", "info", "warn", "error"]


class TokenBucketRateLimiter:
    """
    Token bucket rate limiter for controlling event emission rate.

    Allows bursts up to bucket_size, then sustained rate of refill_rate per second.
    Critical errors are never throttled to ensure important messages get through.
    """

    def __init__(self, bucket_size: int = 100, refill_rate: float = 10.0):
        self.bucket_size = bucket_size
        self.refill_rate = refill_rate
        self.tokens = float(bucket_size)
        self.last_refill = time.time()
        self.suppressed_count = 0
        self.lock = threading.Lock()

    def should_emit(self, level: Level) -> bool:
        """
        Check if an event should be emitted based on rate limits.

        Critical errors are never throttled.
        Returns True if event should be emitted, False if throttled.
        """
        # Never throttle errors - they're too important
        if level == "error":
            return True

        with self.lock:
            now = time.time()

            # Refill tokens based on elapsed time
            elapsed = now - self.last_refill
            self.tokens = min(
                self.bucket_size,
                self.tokens + elapsed * self.refill_rate
            )
            self.last_refill = now

            # Check if we have tokens available
            if self.tokens >= 1.0:
                self.tokens -= 1.0
                return True
            else:
                self.suppressed_count += 1
                return False

    def get_suppressed_count(self) -> int:
        """Get count of suppressed events and reset counter."""
        with self.lock:
            count = self.suppressed_count
            self.suppressed_count = 0
            return count


class PIIRedactor:
    """
    Redacts personally identifiable information and sensitive data from log messages.

    Applies deterministic redaction to ensure consistent output across runs.
    """

    def __init__(self):
        self.patterns = [
            # URLs with authentication (user:pass@host) - must come before email
            (re.compile(r'https?://[^:/\s]+:[^@/\s]+@[^\s]+'), '[AUTH_URL]'),

            # Email addresses
            (re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'), '[EMAIL]'),

            # URL query parameters with sensitive data
            (re.compile(r'([?&])(token|key|secret|auth)=[^&\s]+'), r'\1\2=[REDACTED]'),

            # API keys and tokens (common patterns)
            (re.compile(r'\b(sk-[a-zA-Z0-9]{10,}|pk_[a-zA-Z0-9_]{10,})\b'), '[API_KEY]'),

            # Common secret patterns - any long alphanumeric string
            (re.compile(r'\b[A-Za-z0-9]{32,}\b'), '[TOKEN]'),
        ]

    def redact(self, text: str) -> str:
        """Apply redaction patterns to text."""
        for pattern, replacement in self.patterns:
            if callable(replacement):
                text = pattern.sub(replacement, text)
            else:
                text = pattern.sub(replacement, text)
        return text

    def redact_dict(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Recursively redact dictionary values."""
        redacted = {}
        for key, value in data.items():
            if isinstance(value, str):
                redacted[key] = self.redact(value)
            elif isinstance(value, dict):
                redacted[key] = self.redact_dict(value)
            elif isinstance(value, list):
                redacted[key] = [
                    self.redact(item) if isinstance(item, str) else item
                    for item in value
                ]
            else:
                redacted[key] = value
        return redacted


class Sink(Protocol):
    """Protocol for event output destinations."""

    def write(self, s: str) -> None:
        """Write a string to the sink."""
        ...

    def flush(self) -> None:
        """Flush any buffered output."""
        ...


class EventSchema:
    """Schema definitions for structured events."""

    VERSION = "v1"

    # Level ordering for filtering
    LEVELS = {
        "debug": 10,
        "info": 20,
        "warn": 30,
        "error": 40
    }

    @classmethod
    def validate_level(cls, level: Level) -> bool:
        """Validate that level is supported."""
        return level in cls.LEVELS

    @classmethod
    def should_emit(cls, event_level: Level, min_level: Level) -> bool:
        """Check if event should be emitted based on minimum level."""
        return cls.LEVELS[event_level] >= cls.LEVELS[min_level]


class Event:
    """Represents a single structured log event."""

    def __init__(
        self,
        *,
        level: Level,
        component: str,
        message: str,
        event_id: int,
        timestamp: str,
        schema: str = EventSchema.VERSION,
        ctx: Optional[Dict[str, Any]] = None
    ):
        self.level = level
        self.component = component
        self.message = message
        self.event_id = event_id
        self.timestamp = timestamp
        self.schema = schema
        self.ctx = ctx or {}

    def to_json_line(self, redactor: Optional['PIIRedactor'] = None) -> str:
        """Convert event to JSON line format with optional PII redaction."""
        data = {
            "schema": self.schema,
            "ts": self.timestamp,
            "event_id": self.event_id,
            "level": self.level,
            "component": self.component,
            "message": self.message
        }

        # Add context if present
        if self.ctx:
            data["ctx"] = self.ctx

        # Apply PII redaction if configured
        if redactor:
            data["message"] = redactor.redact(data["message"])
            if "ctx" in data:
                data["ctx"] = redactor.redact_dict(data["ctx"])

        # Use repr as default to handle non-serializable objects
        return json.dumps(data, default=repr, separators=(',', ':'))


class EventEmitter:
    """Thread-safe event emission with ordering guarantees and rate limiting."""

    def __init__(
        self,
        sink: Sink,
        min_level: Level = "info",
        rate_limiter: Optional[TokenBucketRateLimiter] = None,
        redactor: Optional[PIIRedactor] = None
    ):
        self.sink = sink
        self.min_level = min_level
        self.rate_limiter = rate_limiter
        self.redactor = redactor
        self._event_counter = 0
        self._lock = threading.Lock()
        self._start_time = time.time()
        self._last_suppression_report = time.time()
        self._shutdown_registered = False

    def _next_event_id(self) -> int:
        """Get next monotonic event ID."""
        with self._lock:
            self._event_counter += 1
            return self._event_counter

    def _current_timestamp(self) -> str:
        """Get current timestamp in ISO8601 UTC format."""
        return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')

    def _create_suppression_event(self, suppressed_count: int) -> Event:
        """Create an event reporting suppressed message count."""
        return Event(
            level="warn",
            component="rate_limiter",
            message=f"Rate limit exceeded, suppressed {suppressed_count} events",
            event_id=self._next_event_id(),
            timestamp=self._current_timestamp(),
            ctx={"type": "suppression", "count": suppressed_count}
        )

    def _safe_write(self, line: str) -> bool:
        """Safely write line to sink with error recovery."""
        try:
            self.sink.write(line)
            return True
        except Exception:
            # If primary sink fails, try stderr as fallback
            try:
                import sys
                sys.stderr.write(f"LOG_SINK_ERROR: {line}")
                sys.stderr.flush()
            except Exception:
                # Complete failure - drop the event
                pass
            return False

    def emit(self, event: Event) -> None:
        """Emit an event if it meets level and rate limit thresholds."""
        if not EventSchema.should_emit(event.level, self.min_level):
            return

        # Check rate limiting
        if self.rate_limiter and not self.rate_limiter.should_emit(event.level):
            # Event was suppressed - maybe emit suppression report
            now = time.time()
            if now - self._last_suppression_report >= 10.0:  # Report every 10 seconds
                suppressed = self.rate_limiter.get_suppressed_count()
                if suppressed > 0:
                    suppression_event = self._create_suppression_event(suppressed)
                    self._emit_internal(suppression_event)
                    self._last_suppression_report = now
            return

        self._emit_internal(event)

    def _emit_internal(self, event: Event) -> None:
        """Internal emission with atomic write."""
        # Atomic write with lock to ensure line integrity
        with self._lock:
            line = event.to_json_line(self.redactor) + "\n"
            self._safe_write(line)

    def flush(self, timeout_ms: Optional[int] = None) -> None:
        """Flush the sink with optional timeout."""
        with self._lock:
            if timeout_ms is not None:
                # For timeout support, we'd need async I/O or threading
                # For now, just perform regular flush and ignore timeout
                # Future enhancement: implement actual timeout handling
                pass
            self.sink.flush()

    def register_shutdown(self) -> None:
        """Register graceful shutdown handler."""
        if not self._shutdown_registered:
            atexit.register(self._shutdown)
            self._shutdown_registered = True

    def _shutdown(self) -> None:
        """Graceful shutdown - flush and emit final suppression report."""
        try:
            # Emit final suppression report if needed
            if self.rate_limiter:
                suppressed = self.rate_limiter.get_suppressed_count()
                if suppressed > 0:
                    final_event = self._create_suppression_event(suppressed)
                    self._emit_internal(final_event)

            # Final flush
            self.flush()
        except Exception:
            # Don't let shutdown handlers fail
            pass


class Logger:
    """
    Transport-agnostic logger with deterministic event emission.

    Guarantees:
    - Events are emitted in chronological order
    - Each event has a monotonic ID
    - Writes are atomic per line
    - No stdout contamination
    - Immutable configuration after init
    - Rate limiting with suppression reporting
    - PII redaction at the edge
    - Graceful shutdown with final flush
    """

    def __init__(
        self,
        *,
        sink: Sink,
        component: str,
        level: Level = "info",
        schema: str = EventSchema.VERSION,
        rate_limiter: Optional[TokenBucketRateLimiter] = None,
        redactor: Optional[PIIRedactor] = None,
        auto_shutdown: bool = True
    ):
        if not EventSchema.validate_level(level):
            raise ValueError(f"Invalid level: {level}")

        self.component = component
        self.schema = schema
        self._emitter = EventEmitter(sink, level, rate_limiter, redactor)

        # Register graceful shutdown by default
        if auto_shutdown:
            self._emitter.register_shutdown()

    def _log(self, level: Level, message: str, **ctx: Any) -> None:
        """Internal logging method."""
        event = Event(
            level=level,
            component=self.component,
            message=message,
            event_id=self._emitter._next_event_id(),
            timestamp=self._emitter._current_timestamp(),
            schema=self.schema,
            ctx=ctx if ctx else None
        )
        self._emitter.emit(event)

    def debug(self, message: str, **ctx: Any) -> None:
        """Emit debug level event."""
        self._log("debug", message, **ctx)

    def info(self, message: str, **ctx: Any) -> None:
        """Emit info level event."""
        self._log("info", message, **ctx)

    def warn(self, message: str, **ctx: Any) -> None:
        """Emit warning level event."""
        self._log("warn", message, **ctx)

    def error(self, message: str, **ctx: Any) -> None:
        """Emit error level event."""
        self._log("error", message, **ctx)

    def progress(self, stage: str, progress: float, message: str, **extra_ctx: Any) -> None:
        """
        Emit a progress event.

        Progress events are regular log events with ctx.type="progress".
        This allows upstream to filter them deterministically.
        """
        ctx = {
            "type": "progress",
            "stage": stage,
            "progress": progress,
            **extra_ctx
        }
        self.info(message, **ctx)

    def flush(self, timeout_ms: Optional[int] = None) -> None:
        """Flush all pending events."""
        self._emitter.flush(timeout_ms)


class MemorySink:
    """In-memory sink for testing."""

    def __init__(self):
        self.lines: list[str] = []
        self.flushed = False

    def write(self, s: str) -> None:
        self.lines.append(s)

    def flush(self) -> None:
        self.flushed = True

    def get_events(self) -> list[Dict[str, Any]]:
        """Parse all written lines as JSON events."""
        events = []
        for line in self.lines:
            if line.strip():
                events.append(json.loads(line.strip()))
        return events


class FileSink:
    """File-based sink."""

    def __init__(self, file_path: str):
        self.file_path = file_path
        self._file = open(file_path, 'w')

    def write(self, s: str) -> None:
        self._file.write(s)

    def flush(self) -> None:
        self._file.flush()

    def close(self) -> None:
        self._file.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()


class StreamSink:
    """Wrapper for file-like objects (sys.stderr, etc)."""

    def __init__(self, stream):
        self.stream = stream

    def write(self, s: str) -> None:
        self.stream.write(s)

    def flush(self) -> None:
        if hasattr(self.stream, 'flush'):
            self.stream.flush()


class StdlibLogCapture:
    """
    Captures and normalizes standard library logging into structured events.

    This allows library modules to continue using standard logging.getLogger()
    while ensuring all output follows the structured event format.
    """

    def __init__(self, target_logger: Logger):
        self.target_logger = target_logger
        self.original_handlers = {}
        self.captured_loggers = set()

    def capture_logger(self, logger_name: str) -> None:
        """Capture a specific logger and redirect to structured logging."""
        logger = logging.getLogger(logger_name)

        # Store original handlers for restoration
        if logger_name not in self.original_handlers:
            self.original_handlers[logger_name] = logger.handlers[:]

        # Clear existing handlers and add our capture handler
        logger.handlers.clear()
        logger.addHandler(self._create_capture_handler())
        logger.propagate = False  # Prevent duplicate messages

        # Ensure logger level allows INFO and above
        if logger.level == logging.NOTSET or logger.level > logging.INFO:
            logger.setLevel(logging.INFO)

        self.captured_loggers.add(logger_name)

    def capture_all_library_loggers(self) -> None:
        """Capture common noisy library loggers."""
        noisy_loggers = [
            'urllib3',
            'httpx',
            'selenium',
            'undetected_chromedriver',
            'requests',
            'firecrawl',
            'openai'
        ]

        for logger_name in noisy_loggers:
            self.capture_logger(logger_name)

    def capture_specscraper_loggers(self) -> None:
        """Capture all specscraper library loggers."""
        specscraper_loggers = [
            'StealthScraper',
            'lib.core.scraping',
            'lib.core.llm',
            'lib.core.html_processor',
            'lib.utils.openai_rate_limiter'
        ]

        for logger_name in specscraper_loggers:
            self.capture_logger(logger_name)

    def _create_capture_handler(self) -> logging.Handler:
        """Create a handler that converts stdlib logs to structured events."""

        class StructuredCaptureHandler(logging.Handler):
            def __init__(self, target_logger: Logger):
                super().__init__()
                self.target_logger = target_logger

            def emit(self, record: logging.LogRecord) -> None:
                try:
                    # Convert stdlib log levels to our levels
                    level_mapping = {
                        logging.DEBUG: "debug",
                        logging.INFO: "info",
                        logging.WARNING: "warn",
                        logging.ERROR: "error",
                        logging.CRITICAL: "error"
                    }

                    level = level_mapping.get(record.levelno, "info")
                    message = record.getMessage()

                    # Extract useful context from log record
                    ctx = {
                        "stdlib_logger": record.name,
                        "module": record.module,
                        "function": record.funcName,
                        "line": record.lineno
                    }

                    # Add exception info if present
                    if record.exc_info:
                        ctx["exception"] = self.format(record)

                    # Emit through our structured logger
                    self.target_logger._log(level, message, **ctx)

                except Exception:
                    # Don't let logging failures break the application
                    pass

        return StructuredCaptureHandler(self.target_logger)

    def restore_all(self) -> None:
        """Restore all captured loggers to their original state."""
        for logger_name in self.captured_loggers:
            logger = logging.getLogger(logger_name)
            logger.handlers.clear()

            # Restore original handlers
            if logger_name in self.original_handlers:
                logger.handlers.extend(self.original_handlers[logger_name])

            logger.propagate = True

        self.captured_loggers.clear()
        self.original_handlers.clear()


def create_bridge_logger(
    sink: Sink,
    component: str = "bridge",
    level: Level = "info",
    enable_rate_limiting: bool = True,
    enable_pii_redaction: bool = True,
    capture_stdlib_logs: bool = True
) -> tuple[Logger, Optional[StdlibLogCapture]]:
    """
    Create a logger configured for bridge usage with all enhancements.

    Returns:
        tuple: (logger, stdlib_capture) - stdlib_capture is None if not enabled
    """
    # Create rate limiter if enabled
    rate_limiter = None
    if enable_rate_limiting:
        rate_limiter = TokenBucketRateLimiter(bucket_size=50, refill_rate=10.0)

    # Create PII redactor if enabled
    redactor = None
    if enable_pii_redaction:
        redactor = PIIRedactor()

    # Create the main logger
    logger = Logger(
        sink=sink,
        component=component,
        level=level,
        rate_limiter=rate_limiter,
        redactor=redactor,
        auto_shutdown=True
    )

    # Set up stdlib log capture if enabled
    stdlib_capture = None
    if capture_stdlib_logs:
        stdlib_capture = StdlibLogCapture(logger)
        stdlib_capture.capture_all_library_loggers()
        stdlib_capture.capture_specscraper_loggers()

    return logger, stdlib_capture
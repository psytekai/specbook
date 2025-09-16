#!/usr/bin/env python3
"""
Electron Bridge for Specscraper - Phase 3 Implementation
Provides CLI interface for Electron app using principle-first logging architecture.

Key guarantees:
- EXACTLY one compact JSON object is emitted to STDOUT on success.
- All diagnostics/logs go to STDERR.
- Process exit code: 0 on success, 1 on any failure.
"""

from __future__ import annotations

import os
import sys
import json
import time
import threading
import queue
from typing import Dict, Any, Optional

# Principle-first logging system
from lib.utils.logging_contracts import StreamSink, create_bridge_logger

# Core modules (use standard logging.getLogger() internally)
from lib.core.scraping import StealthScraper
from lib.core.html_processor import HTMLProcessor
from lib.core.llm import PromptTemplator, LLMInvocator


# ---------------------------
# Bridge implementation
# ---------------------------

class ElectronBridge:
    """Bridge between Electron app and specscraper library using principle-first logging."""

    def __init__(self) -> None:
        # Create stderr sink for structured logging
        stderr_sink = StreamSink(sys.stderr)

        # Create logger with all enhancements
        self.logger, self.stdlib_capture = create_bridge_logger(
            sink=stderr_sink,
            component="bridge",
            level="info",
            enable_rate_limiting=True,
            enable_pii_redaction=True,
            capture_stdlib_logs=True,
        )

        # Lazy init components
        self.scraper: Optional[StealthScraper] = None
        self.processor: Optional[HTMLProcessor] = None
        self.templator: Optional[PromptTemplator] = None
        self.llm: Optional[LLMInvocator] = None
        self._initialized = False

    def initialize(self) -> None:
        """Lazy initialization of components"""
        if self._initialized:
            return

        try:
            self.logger.progress("init", 0.0, "Initializing components...")

            self.scraper = StealthScraper()
            self.processor = HTMLProcessor()
            self.templator = PromptTemplator()
            self.llm = LLMInvocator()

            self.logger.progress("init", 1.0, "Components initialized successfully")
            self._initialized = True

        except Exception as e:
            self.logger.error("Failed to initialize components", error=str(e))
            raise RuntimeError(f"Failed to initialize components: {str(e)}") from e

    def scrape_product(self, url: str, options: Dict[str, Any]) -> Dict[str, Any]:
        """Complete end-to-end product scraping pipeline"""
        start_time = time.time()

        try:
            if not self._initialized:
                self.initialize()

            # Step 1: Scrape URL
            self.logger.progress("scraping", 0.15, f"Starting scrape of {url}")
            self.logger.info("Scraping URL", url=url, method=options.get("method", "auto"))

            method = options.get("method", "auto")
            scrape_result = self.scraper.scrape_url(url, method=method)  # type: ignore[union-attr]

            if not scrape_result.success:
                self.logger.error(
                    "Scraping failed",
                    url=url,
                    method=scrape_result.final_method.value if scrape_result.final_method else "unknown",
                    error=scrape_result.error_reason,
                )
                return {
                    "success": False,
                    "data": None,
                    "metadata": {
                        "scrape_method": scrape_result.final_method.value if scrape_result.final_method else "unknown",
                        "status_code": scrape_result.status_code,
                        "execution_time": time.time() - start_time,
                    },
                    "error": f"Scraping failed: {scrape_result.error_reason}",
                }

            self.logger.progress("scraping", 0.5, "Page loaded successfully")
            self.logger.info(
                "Page scraped successfully",
                method=scrape_result.final_method.value,
                status_code=scrape_result.status_code,
                content_length=len(scrape_result.content) if scrape_result.content else 0,
            )

            # Step 2: Process HTML
            self.logger.progress("processing", 0.6, "Cleaning and structuring HTML...")

            processed = self.processor.clean_html(scrape_result.content)  # type: ignore[union-attr]
            processed_json = processed.model_dump_json()

            word_count = len(processed.text.split()) if processed.text else 0
            image_count = len(processed.images) if processed.images else 0

            self.logger.progress("processing", 0.7, f"HTML processed: {word_count} words, {image_count} images")
            self.logger.info(
                "HTML processing complete",
                word_count=word_count,
                image_count=image_count,
                processed_length=len(processed_json),
            )

            # Step 3: Generate prompt and extract data
            self.logger.progress("extraction", 0.8, "Preparing LLM prompt...")

            prompt = self.templator.product_extraction(url, processed_json)  # type: ignore[union-attr]
            prompt_tokens = len(prompt) // 4  # rough estimate

            self.logger.progress("extraction", 0.85, f"Calling LLM ({options.get('llm_model', 'gpt-4o-mini')})...")
            self.logger.info(
                "Invoking LLM",
                model=options.get("llm_model", "gpt-4o-mini"),
                estimated_tokens=prompt_tokens,
            )

            llm_response = self.llm.invoke_llm(  # type: ignore[union-attr]
                model_provider="openai",
                llm_model_name=options.get("llm_model", "gpt-4o-mini"),
                prompt=prompt,
                temperature=options.get("temperature", 0.7),
                max_tokens=options.get("max_tokens", 1000),
            )

            self.logger.progress("extraction", 0.95, "Parsing LLM response...")

            extracted = PromptTemplator.ProductExtractionOutput.model_validate_json(llm_response)

            self.logger.progress("complete", 1.0, "Extraction complete")
            self.logger.info(
                "Product extraction successful",
                extracted_type=extracted.type,
                has_image=bool(extracted.image_url),
                has_model_no=bool(extracted.model_no),
            )

            execution_time = time.time() - start_time

            return {
                "success": True,
                "data": extracted.model_dump(),
                "metadata": {
                    "scrape_method": scrape_result.final_method.value,  # type: ignore[union-attr]
                    "processing_time": execution_time,
                    "scrape_time": scrape_result.scrape_time,
                    "llm_model": options.get("llm_model", "gpt-4o-mini"),
                    "status_code": scrape_result.status_code,
                    "html_length": len(scrape_result.content) if scrape_result.content else 0,
                    "processed_length": len(processed_json),
                    "prompt_tokens": prompt_tokens,
                },
                "error": None,
            }

        except json.JSONDecodeError as e:
            self.logger.error("Failed to parse LLM response", error=str(e))
            return {
                "success": False,
                "data": None,
                "metadata": {"execution_time": time.time() - start_time},
                "error": f"Failed to parse LLM response: {str(e)}",
            }
        except Exception as e:
            self.logger.error("Scraping pipeline failed", error=str(e), error_type=type(e).__name__)
            return {
                "success": False,
                "data": None,
                "metadata": {"execution_time": time.time() - start_time},
                "error": f"{type(e).__name__}: {str(e)}",
            }


# ---------------------------
# Cross-platform input handling
# ---------------------------

def _readline_with_timeout(timeout_seconds: float) -> str:
    """
    Read a SINGLE newline-terminated line from stdin with a timeout.
    Works on Windows and POSIX without using select(); no EOF required.
    """
    if sys.stdin is None:
        raise RuntimeError("stdin is not available; run with stdio pipes")

    q: "queue.Queue[object]" = queue.Queue(maxsize=1)

    def reader() -> None:
        try:
            line = sys.stdin.readline()  # returns on newline or EOF
            q.put(line)
        except Exception as e:
            q.put(e)

    t = threading.Thread(target=reader, daemon=True)
    t.start()

    try:
        item = q.get(timeout=timeout_seconds)
    except queue.Empty:
        raise TimeoutError(f"No input received within {timeout_seconds} seconds")

    if isinstance(item, Exception):
        raise item

    line = str(item)
    if not line:
        # EOF without any data
        raise TimeoutError("No input received (empty stdin / EOF)")
    return line


def _load_payload_from_env_or_file() -> Optional[str]:
    """
    Optional escape hatches for diagnostics/packaging:
      - ENV: SPEC_BRIDGE_PAYLOAD contains JSON directly
      - ARG: argv[1] is a path to a file containing JSON
    Returns the raw JSON string if provided; otherwise None.
    """
    env_payload = os.environ.get("SPEC_BRIDGE_PAYLOAD")
    if env_payload:
        return env_payload

    if len(sys.argv) > 1 and sys.argv[1]:
        file_path = sys.argv[1]
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                return f.read()
        except Exception:
            # Fall back to stdin if reading fails
            pass

    return None


def _read_payload(timeout_seconds: float = 5.0) -> str:
    """
    Unified payload reader:
    1) ENV or file (debug/diagnostics)
    2) Single-line JSON via stdin (newline-terminated)
    """
    payload = _load_payload_from_env_or_file()
    if payload is not None:
        return payload

    # Read one line from stdin with timeout.
    return _readline_with_timeout(timeout_seconds)


# ---------------------------
# Entrypoint
# ---------------------------

def main() -> None:
    try:
        # Read input from env/file/stdin with timeout
        try:
            input_raw = _read_payload(timeout_seconds=5.0)
        except TimeoutError as e:
            stderr_sink = StreamSink(sys.stderr)
            logger, _ = create_bridge_logger(stderr_sink, capture_stdlib_logs=False)
            logger.error(
                "Input timeout",
                error=str(e),
                help="Send a single newline-terminated JSON line or set SPEC_BRIDGE_PAYLOAD or pass a JSON file path.",
            )
            logger.flush()
            sys.stderr.flush()
            sys.exit(1)

        if not input_raw.strip():
            raise ValueError("No input provided")

        input_data = json.loads(input_raw)

        # Validate input
        url = input_data.get("url")
        if not url:
            raise ValueError("Missing required field: url")
        if not isinstance(url, str) or not url.startswith(("http://", "https://")):
            raise ValueError("Invalid URL format")

        # Create bridge and scrape
        bridge = ElectronBridge()

        # Log the start of processing
        bridge.logger.info("Processing scrape request", url=url, options=input_data.get("options", {}))

        result = bridge.scrape_product(url=url, options=input_data.get("options", {}))

        # Contract compliance: stdout only on success, stderr for all failures
        if result.get("success"):
            # Success: exactly one JSON result to stdout (compact)
            print(json.dumps(result, separators=(",", ":")))
            bridge.logger.info(
                "Request completed successfully",
                processing_time=result.get("metadata", {}).get("processing_time"),
            )

            # Flush guarantees
            sys.stdout.flush()
            bridge.logger.flush()
            sys.stderr.flush()
            sys.exit(0)

        # Failure: no stdout output, error info to stderr only
        bridge.logger.error("Request failed", error=result.get("error"), metadata=result.get("metadata", {}))
        bridge.logger.flush()
        sys.stderr.flush()
        sys.exit(1)

    except json.JSONDecodeError as e:
        # Contract: no stdout on failure, error to stderr only
        stderr_sink = StreamSink(sys.stderr)
        logger, _ = create_bridge_logger(stderr_sink, capture_stdlib_logs=False)
        preview = (locals().get("input_raw") or "unknown")[:100]
        logger.error("Invalid JSON input", error=str(e), input_preview=preview)
        logger.flush()
        sys.stderr.flush()
        sys.exit(1)

    except Exception as e:
        # Contract: no stdout on failure, error to stderr only
        try:
            if "bridge" in locals() and getattr(locals()["bridge"], "logger", None):
                locals()["bridge"].logger.error("Unhandled exception", error=str(e), error_type=type(e).__name__)
                locals()["bridge"].logger.flush()
            else:
                stderr_sink = StreamSink(sys.stderr)
                logger, _ = create_bridge_logger(stderr_sink, capture_stdlib_logs=False)
                logger.error("Bridge initialization or execution failed", error=str(e), error_type=type(e).__name__)
                logger.flush()

            sys.stderr.flush()
            sys.exit(1)
        except Exception:
            try:
                sys.stderr.write(f"FATAL_ERROR: {str(e)}\n")
                sys.stderr.flush()
            except Exception:
                pass
            sys.exit(1)


if __name__ == "__main__":
    main()

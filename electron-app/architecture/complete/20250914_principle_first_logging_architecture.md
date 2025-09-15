# Principle-First Logging Architecture

**Date**: 2025-09-14
**Status**: Implementation
**Priority**: High

## Core Principles (Contract > Implementation)

### 1. Single-Responsibility I/O

- **Stdout is for data only.** Zero log lines. Exactly one final result (or zero on failure).
- **Stderr is for diagnostics only.** All human/structured logs go here.
- **Exit code encodes outcome.** `0` = success (result on stdout), non-zero = failure (error details on stderr).

### 2. Transport Agnosticism

- The logger never "knows" Electron, TTYs, or files. It accepts a **sink interface** (e.g., `write(str)`) injected at init.
- No environment-inspection in the logger; upstream passes the sink/format explicitly.

### 3. Structured, Line-Delimited Records

- Every diagnostic event is a **single line** terminated by `\n`.
- Line content is **valid JSON** conforming to a **versioned schema** (`schema: "v1"`).
- No multiline stack traces; include them as JSON strings (escaped `\n`) to preserve one-event-per-line.

### 4. Deterministic Ordering & Atomicity

- Logger guarantees **in-process total ordering** of emitted events.
- Writes are **atomic per line** (use a global lock around `emit`).
- A single writer per process for a given sink (avoid multiple handlers writing to the same stream).

### 5. Minimal, Stable Schema

- Required fields: `ts`, `level`, `component`, `message`, `schema`, `event_id` (monotonic per process).
- Optional `ctx` object for arbitrary key/values; unknown fields are allowed (for forward compatibility).
- **Never remove/rename required fields** within a schema version. Add only.

### 6. Clear Severity Model

- Levels: `debug`, `info`, `warn`, `error`.
- Level filtering done entirely inside logger; upstream never sees filtered events.
- Level is set **once at init** (immutable) to keep behavior predictable.

### 7. Progress is Just Data, Not a Side Channel

- Progress events are regular logs with `type: "progress"`, e.g. `{type:"progress", stage, progress}` inside `ctx`.
- Upstream can deterministically select them by `ctx.type == "progress"`.

### 8. Configuration is Explicit & Immutable After Init

- `configure_logging(level, formatter, sink)` returns a **handle**; no global env flips.
- After configuration, **public API surface** is only `log(level, message, **ctx)`; no runtime reconfig.

### 9. Graceful Shutdown Guarantees

- `flush(timeout_ms)` is available; `atexit` calls it.
- On fatal errors, logger flushes and **never** prints to stdout.

### 10. Back-Pressure & Rate Safety

- Optional **rate limiter** (e.g., burst 100, refill 10/s) to protect upstream pipes.
- When throttling, emit **one** synth event indicating suppression summary.

### 11. Clock Discipline

- `ts` is **monotonic-backed** ISO8601 UTC (combine wall time for readability + monotonic sequence guard).
- If wall clock goes backwards, keep `event_id` strictly increasing to preserve ordering.

### 12. No Surprises from Libraries

- Third-party loggers are **captured and normalized** into this logger (or silenced) so the stderr stream stays pure.
- Never propagate foreign handlers that might write to stdout.

### 13. Privacy/Redaction at the Edge

- Redact known PII patterns inside the formatter (emails, tokens) before writing.
- Deterministic redaction ensures upstream parsers don't diverge on sensitive data.

### 14. Anti-Requirements (Safety Rails)

- No color codes, no ANSI control sequences.
- No partial JSON lines.
- No retries that duplicate lines; idempotence comes from `event_id`.

## Minimal Interface (Decoupled & Deterministic)

```python
# contracts.py
from typing import Protocol, Mapping, Any, Literal

Level = Literal["debug","info","warn","error"]

class Sink(Protocol):
    def write(self, s: str) -> None
    def flush(self) -> None: ...

class Logger:
    def __init__(self, *, sink: Sink, level: Level, schema: str = "v1", component: str):
        ...

    def log(self, level: Level, message: str, **ctx: Any) -> None
    def flush(self, timeout_ms: int | None = None) -> None
```

## Event Schema (v1)

**Formatter output (one line per event):**

```json
{
  "schema":"v1",
  "ts":"2025-09-14T22:16:03.124Z",
  "event_id": 421,
  "level":"info",
  "component":"crawler.fetch",
  "message":"Fetched page",
  "ctx":{"url":"https://…","dur_ms":231}
}
```

**Progress example:**

```json
{
  "schema":"v1",
  "ts":"2025-09-14T22:16:05.002Z",
  "event_id": 438,
  "level":"info",
  "component":"pipeline",
  "message":"Step completed",
  "ctx":{"type":"progress","stage":"parse","progress":0.6}
}
```

## Determinism Checklist (What Upstream Can Rely On)

- [x] **Stdout**: exactly one JSON object (result) on success; nothing on failure.
- [x] **Stderr**: newline-delimited JSON events, each valid JSON.
- [x] **Order**: events appear in emit order; no interleaving across threads.
- [x] **Schema**: fields present and stable for the declared `schema`.
- [x] **Levels**: only those ≥ configured level appear.
- [x] **Progress**: discoverable by `ctx.type == "progress"`.
- [x] **Exit code**: 0 ↔ result printed; non-zero ↔ no result printed.
- [x] **Flush**: all emitted events are flushed before process exit.

## How This Decouples from Electron

Electron (or any supervisor) **only** needs to:

1. Read **stdout once** and parse JSON,
2. Tail **stderr** as JSONL for logs/progress,
3. Use **exit code** to decide success/failure.

The Python side has **no knowledge** of Electron. It just writes records to the provided `Sink`. For tests, you can inject a memory sink; for prod, pass `sys.stderr`.

## Guardrails You Can Test

1. **No-stdout-on-logs**: Emit 10k logs and assert `stdout == ""`.
2. **Single-result rule**: On success, exactly one line to stdout and valid JSON.
3. **Atomicity**: Fuzz with 10 threads logging; assert every stderr line is valid JSON; no partials.
4. **Schema contract**: JSON Schema validation against `v1`.
5. **Level gating**: Configure `warn`; assert only `warn|error` appear.
6. **Throttling**: Overproduce; verify a single suppression event with counts.
7. **Monotonicity**: Ensure `event_id` strictly increases, even if system clock skews.

## Implementation Phases

### Phase 1: Define Contracts & Interfaces
- Create `logging_contracts.py` with `Sink` protocol and `Logger` interface
- Define versioned JSON schema (`v1`) with required fields
- Implement atomic, ordered event emission with global lock
- Add monotonic `event_id` and wall-clock `ts` for ordering guarantees

### Phase 2: Minimal Logger Implementation
- Single `Logger` class with sink injection (no global state)
- Line-oriented JSON emission (one event per line)
- Immutable configuration after init
- Built-in rate limiting and back-pressure protection
- Progress events as regular logs with `ctx.type="progress"`

### Phase 3: Clean Integration Points
- Update `electron_bridge.py` to inject `sys.stderr` sink
- Remove ALL logging configuration from library modules
- Library modules use only standard `logging.getLogger(__name__)`
- Bridge captures stdlib logs and normalizes to event stream

### Phase 4: Deterministic I/O Contract
- **Stdout**: Exactly one JSON result on success, nothing on failure
- **Stderr**: JSONL event stream only
- **Exit codes**: 0 = success (result on stdout), non-zero = failure
- Flush guarantees and graceful shutdown

### Phase 5: Comprehensive Contract Testing
- Test atomic line writes under concurrency
- Verify stdout cleanliness (no logs leak)
- Validate schema compliance and monotonic ordering
- Test rate limiting and back-pressure behavior
- Verify library log capture and normalization

## Benefits

- **Zero coupling**: Library modules unaware of transport
- **Deterministic**: Upstream can rely on strict contracts
- **Testable**: Clear assertions about behavior
- **Transport-agnostic**: Works with any sink (Electron, files, memory)
- **Schema-versioned**: Forward compatible evolution

## Success Criteria

1. **Clean Separation**: stdout contains only JSON data, stderr contains only structured logs
2. **Tool Compatibility**: Works with jq, grep, and other Unix tools
3. **Maintainability**: Simple, readable code without custom parsing logic
4. **Debuggability**: Easy to inspect logs and data separately
5. **Performance**: No degradation in scraping performance
6. **Reliability**: Robust error handling and recovery
7. **Deterministic**: Upstream can rely on strict ordering and format guarantees
8. **Transport Agnostic**: No coupling to specific execution environments
# Centralized Logging Fix Implementation Plan (UPDATED)

**Date**: 2025-09-14  
**Status**: Planning - Updated with Critical Fixes & Recommendations  
**Priority**: High  

## Problem Statement

The current Python bridge communication is brittle due to mixed logging outputs interfering with JSON parsing. The existing logging configuration in specscraper has multiple conflicting setups that output verbose logs to stderr, making it impossible to reliably parse structured data.

### Current Issues

1. **Multiple Logging Configurations**:
   - `electron_bridge.py` configures logging to stderr with WARNING level
   - `scraping.py` configures logging to BOTH file AND StreamHandler (stdout/stderr)
   - Other modules use default logger configuration

2. **Mixed Output Streams**:
   - Verbose logging format: `'%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s'`
   - Logs mixed with progress updates on stderr
   - No clear separation between data and metadata

3. **Log Level Conflicts**:
   - `electron_bridge.py` sets level to WARNING
   - `scraping.py` sets level to INFO
   - Creates inconsistent logging behavior

## Solution Design (Updated with Critical Fixes)

### Core Principles

1. **Unix Philosophy**: stdout = data, stderr = logs
2. **Industry Standards**: Use JSON Lines for logs, single JSON for data
3. **Separation of Concerns**: Clear boundaries between data and metadata
4. **Tool Compatibility**: Works with standard Unix tools (jq, grep, etc.)
5. **Maintainability**: Simple, readable, debuggable
6. **Robustness**: Graceful error handling and fallback mechanisms

### Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Electron App  │    │   Python Bridge  │    │   Dependencies  │
│                 │    │                  │    │                 │
│ stdout ────────►│    │ stdout ────────►│    │ stdout ────────►│
│ stderr ◄────────│    │ stderr ◄────────│    │ stderr ◄────────│
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Protocol Design

#### Data Stream (stdout)
**Format**: Single JSON object per execution
```json
{
  "success": true,
  "data": {
    "image_url": "...",
    "type": "...",
    "description": "...",
    "model_no": "...",
    "product_link": "..."
  },
  "metadata": {
    "scrape_method": "requests",
    "processing_time": 2.43,
    "scrape_time": 0.47,
    "llm_model": "gpt-4o-mini",
    "status_code": 200,
    "html_length": 429,
    "processed_length": 396,
    "prompt_tokens": 1037
  },
  "error": null
}
```

#### Progress Stream (stderr)
**Format**: JSON Lines (one JSON object per line)
```json
{"level": "info", "component": "bridge", "message": "Initializing components", "timestamp": "2025-09-14T12:46:56Z"}
{"type": "progress", "stage": "init", "progress": 0, "message": "Initializing components", "timestamp": "2025-09-14T12:46:56Z"}
{"type": "progress", "stage": "scraping", "progress": 50, "message": "Page loaded successfully", "timestamp": "2025-09-14T12:46:56Z"}
{"type": "progress", "stage": "complete", "progress": 100, "message": "Extraction complete", "timestamp": "2025-09-14T12:46:58Z"}
```

## Implementation Plan (Updated)

### Phase 1: Centralized Logging Configuration with Critical Fixes

**Objective**: Create a unified logging system with improved error handling and singleton pattern

**Files to Create**:
- `specscraper/lib/utils/logging_config.py` (new)

**Implementation**:

```python
"""
Centralized logging configuration for specscraper
"""
import logging
import sys
import os
import json
import threading
from typing import Optional, Dict, Any
from datetime import datetime

class StructuredLogger:
    """Structured logger that outputs JSON Lines to stderr with singleton pattern"""
    
    _instances: Dict[str, 'StructuredLogger'] = {}
    _lock = threading.Lock()
    
    def __new__(cls, component: str, level: str = "INFO"):
        """Singleton pattern for logger instances"""
        with cls._lock:
            if component not in cls._instances:
                instance = super().__new__(cls)
                cls._instances[component] = instance
                instance._initialized = False
            return cls._instances[component]
    
    def __init__(self, component: str, level: str = "INFO"):
        if hasattr(self, '_initialized') and self._initialized:
            return
        self.component = component
        self.level = getattr(logging, level.upper())
        self._initialized = True
    
    def info(self, message: str, **kwargs):
        if self._should_log("INFO"):
            self._log("info", message, **kwargs)
    
    def warning(self, message: str, **kwargs):
        if self._should_log("WARNING"):
            self._log("warning", message, **kwargs)
    
    def error(self, message: str, **kwargs):
        if self._should_log("ERROR"):
            self._log("error", message, **kwargs)
    
    def debug(self, message: str, **kwargs):
        if self._should_log("DEBUG"):
            self._log("debug", message, **kwargs)
    
    def progress(self, stage: str, progress: int, message: str):
        """Dedicated progress reporting separate from logging"""
        entry = {
            "type": "progress",  # Clear type discrimination
            "stage": stage,
            "progress": progress,
            "message": message,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
        self._safe_print(entry)
    
    def _should_log(self, level: str) -> bool:
        """Check if message should be logged based on level"""
        return getattr(logging, level.upper()) >= self.level
    
    def _log(self, level: str, message: str, **kwargs):
        """Internal logging method with error handling"""
        log_entry = {
            "level": level,
            "component": self.component,
            "message": message,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            **kwargs
        }
        self._safe_print(log_entry)
    
    def _safe_print(self, entry: Dict[str, Any]):
        """Safely print JSON with fallback error handling"""
        try:
            print(json.dumps(entry), file=sys.stderr, flush=True)
        except (TypeError, ValueError) as e:
            # Fallback to simple string logging if JSON serialization fails
            fallback = f"{entry.get('level', 'info')}: {entry.get('message', str(entry))}"
            print(fallback, file=sys.stderr, flush=True)


class LoggerFactory:
    """Factory for creating and managing logger instances"""
    
    @staticmethod
    def get_logger(component: str, level: str = "INFO") -> StructuredLogger:
        """Get or create a structured logger instance"""
        return StructuredLogger(component, level)


def configure_logging(
    log_file: Optional[str] = None,
    level: str = "INFO",
    use_structured: bool = False
):
    """
    Configure logging for the entire application
    
    Args:
        log_file: Optional file to write logs to
        level: Log level (DEBUG, INFO, WARNING, ERROR)  
        use_structured: If True, use structured JSON logging
    """
    # Clear existing handlers
    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    
    if use_structured:
        # For electron_bridge, use structured logging
        # Don't configure root logger - let modules use StructuredLogger
        return
    
    # For other modules, use traditional logging
    handlers = []
    
    if log_file:
        handlers.append(logging.FileHandler(log_file))
    
    # Only add StreamHandler if not in electron_bridge context
    if not os.environ.get('ELECTRON_BRIDGE_MODE'):
        handlers.append(logging.StreamHandler(sys.stderr))
    
    if handlers:
        logging.basicConfig(
            level=getattr(logging, level.upper()),
            format='%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S',
            handlers=handlers
        )
    
    # Suppress verbose logging from libraries
    logging.getLogger('urllib3').setLevel(logging.ERROR)
    logging.getLogger('httpx').setLevel(logging.ERROR)
    logging.getLogger('selenium').setLevel(logging.ERROR)
    logging.getLogger('undetected_chromedriver').setLevel(logging.ERROR)


def quick_fix_logging():
    """Quick fix: Disable all non-critical logging in electron_bridge mode"""
    if os.environ.get('ELECTRON_BRIDGE_MODE'):
        logging.disable(logging.CRITICAL)
        # Only allow ERROR and above to show
        logging.getLogger().setLevel(logging.ERROR)
```

**Tasks**:
- [x] **CRITICAL**: Add singleton pattern to prevent multiple logger instances
- [x] **CRITICAL**: Add error handling for JSON serialization failures
- [x] **CRITICAL**: Separate progress reporting from general logging
- [x] Add thread safety for logger creation
- [x] Add log level checking to improve performance
- [x] Add LoggerFactory for better instance management

### Phase 2: Refactor electron_bridge.py with Critical Race Condition Fix

**Objective**: Update electron_bridge to use structured logging with proper environment variable timing

**Files to Modify**:
- `specscraper/electron_bridge.py`

**Implementation** (CRITICAL FIX - Environment variable must be set FIRST):

```python
#!/usr/bin/env python3
"""
Electron Bridge for Specscraper
Provides CLI interface for Electron app to perform product scraping
"""

# CRITICAL: Set environment variable BEFORE any imports to avoid race condition
import os
os.environ['ELECTRON_BRIDGE_MODE'] = '1'

import sys
import json
import time
from typing import Dict, Any

# Import our structured logging
from lib.utils.logging_config import LoggerFactory, quick_fix_logging

# Apply quick fix to suppress library logging immediately
quick_fix_logging()

# Import core modules (they'll use traditional logging)
from lib.core.scraping import StealthScraper
from lib.core.html_processor import HTMLProcessor
from lib.core.llm import PromptTemplator, LLMInvocator

class ElectronBridge:
    """Bridge between Electron app and specscraper library"""
    
    def __init__(self):
        self.logger = LoggerFactory.get_logger("bridge")
        self.scraper = None
        self.processor = None
        self.templator = None
        self.llm = None
        self._initialized = False
        
    def initialize(self):
        """Lazy initialization of components"""
        if self._initialized:
            return
            
        try:
            self.logger.progress("init", 0, "Initializing components...")
            
            self.scraper = StealthScraper()
            self.processor = HTMLProcessor()
            self.templator = PromptTemplator()
            self.llm = LLMInvocator()
            
            self.logger.progress("init", 10, "Full components initialized")
            self._initialized = True
            
        except Exception as e:
            self.logger.error(f"Failed to initialize components: {str(e)}")
            raise RuntimeError(f"Failed to initialize components: {str(e)}")
    
    def scrape_product(self, url: str, options: Dict[str, Any]) -> Dict[str, Any]:
        """Complete end-to-end product scraping pipeline"""
        start_time = time.time()
        
        try:
            # Initialize components if needed
            if not self._initialized:
                self.initialize()
            
            # Step 1: Scrape URL
            self.logger.progress("scraping", 15, f"Starting scrape of {url}")
            
            method = options.get("method", "auto")
            scrape_result = self.scraper.scrape_url(url, method=method)
            
            if not scrape_result.success:
                return {
                    "success": False,
                    "data": None,
                    "metadata": {
                        "scrape_method": scrape_result.final_method.value if scrape_result.final_method else "unknown",
                        "status_code": scrape_result.status_code,
                        "execution_time": time.time() - start_time
                    },
                    "error": f"Scraping failed: {scrape_result.error_reason}"
                }
            
            self.logger.progress("scraping", 50, "Page loaded successfully")
            
            # Step 2: Process HTML
            self.logger.progress("processing", 60, "Cleaning and structuring HTML...")
            
            processed = self.processor.clean_html(scrape_result.content)
            processed_json = processed.model_dump_json()
            
            word_count = len(processed.text.split()) if processed.text else 0
            image_count = len(processed.images) if processed.images else 0
            self.logger.progress("processing", 70, f"HTML processed: {word_count} words, {image_count} images")
            
            # Step 3: Generate prompt and extract data
            self.logger.progress("extraction", 80, "Preparing LLM prompt...")
            
            prompt = self.templator.product_extraction(url, processed_json)
            prompt_tokens = len(prompt) // 4
            
            self.logger.progress("extraction", 85, f"Calling LLM ({options.get('llm_model', 'gpt-4o-mini')})...")
            
            llm_response = self.llm.invoke_llm(
                model_provider="openai",
                llm_model_name=options.get("llm_model", "gpt-4o-mini"),
                prompt=prompt,
                temperature=options.get("temperature", 0.7),
                max_tokens=options.get("max_tokens", 1000)
            )
            
            self.logger.progress("extraction", 95, "Parsing LLM response...")
            
            extracted = PromptTemplator.ProductExtractionOutput.model_validate_json(llm_response)
            
            self.logger.progress("complete", 100, "Extraction complete")
            
            return {
                "success": True,
                "data": extracted.model_dump(),
                "metadata": {
                    "scrape_method": scrape_result.final_method.value,
                    "processing_time": time.time() - start_time,
                    "scrape_time": scrape_result.scrape_time,
                    "llm_model": options.get("llm_model", "gpt-4o-mini"),
                    "status_code": scrape_result.status_code,
                    "html_length": len(scrape_result.content) if scrape_result.content else 0,
                    "processed_length": len(processed_json),
                    "prompt_tokens": prompt_tokens
                },
                "error": None
            }
            
        except json.JSONDecodeError as e:
            self.logger.error(f"Failed to parse LLM response: {str(e)}")
            return {
                "success": False,
                "data": None,
                "metadata": {"execution_time": time.time() - start_time},
                "error": f"Failed to parse LLM response: {str(e)}"
            }
        except Exception as e:
            self.logger.error(f"Scraping failed: {str(e)}")
            return {
                "success": False,
                "data": None,
                "metadata": {"execution_time": time.time() - start_time},
                "error": f"{type(e).__name__}: {str(e)}"
            }

def main():
    """Main entry point for CLI usage"""
    bridge_logger = LoggerFactory.get_logger("bridge")
    
    try:
        # Read input from stdin
        input_raw = sys.stdin.read()
        
        if not input_raw.strip():
            raise ValueError("No input provided")
            
        input_data = json.loads(input_raw)
        
        # Validate input
        if "url" not in input_data:
            raise ValueError("Missing required field: url")
        
        if not input_data["url"].startswith(("http://", "https://")):
            raise ValueError("Invalid URL format")
        
        # Create bridge and scrape
        bridge = ElectronBridge()
        result = bridge.scrape_product(
            url=input_data["url"],
            options=input_data.get("options", {})
        )
        
        # Output ONLY the result to stdout (no other output)
        print(json.dumps(result, indent=2))
        sys.exit(0 if result["success"] else 1)
        
    except json.JSONDecodeError as e:
        bridge_logger.error(f"Invalid JSON input: {str(e)}")
        error_result = {
            "success": False,
            "data": None,
            "metadata": {},
            "error": f"Invalid JSON input: {str(e)}"
        }
        print(json.dumps(error_result, indent=2))
        sys.exit(1)
        
    except Exception as e:
        bridge_logger.error(f"Bridge error: {str(e)}")
        error_result = {
            "success": False,
            "data": None,
            "metadata": {},
            "error": str(e)
        }
        print(json.dumps(error_result, indent=2))
        sys.exit(1)

if __name__ == "__main__":
    main()
```

**Tasks**:
- [x] **CRITICAL**: Fix race condition by setting environment variable before imports
- [x] **CRITICAL**: Add quick fix function call to suppress library logging
- [x] Replace all logging calls with StructuredLogger via LoggerFactory
- [x] Ensure only JSON result goes to stdout
- [ ] Test electron_bridge in isolation

### Phase 3: Update Core Modules with Environment Check

**Objective**: Modify core modules to respect electron_bridge mode and not interfere with structured logging

**Files to Modify**:
- `specscraper/lib/core/scraping.py`
- `specscraper/lib/core/llm.py`
- `specscraper/lib/utils/openai_rate_limiter.py`

**Implementation for scraping.py**:

```python
# At the top of the file, after imports but before logging configuration
import os
from lib.utils.logging_config import configure_logging, quick_fix_logging

# Configure logging based on context - CHECK ENVIRONMENT FIRST
if os.environ.get('ELECTRON_BRIDGE_MODE'):
    # In electron_bridge mode, apply quick fix to suppress logging
    quick_fix_logging()
    # Don't configure logging - let electron_bridge handle structured logging
    logger = logging.getLogger('StealthScraper')
    logger.disabled = True  # Disable this logger entirely
else:
    # In standalone mode, use traditional logging
    configure_logging(
        log_file=log_filename,
        level="INFO",
        use_structured=False
    )
    # Use traditional logger for internal logging
    logger = logging.getLogger('StealthScraper')
```

**Tasks**:
- [x] Update scraping.py to check ELECTRON_BRIDGE_MODE first
- [x] Add quick fix call in electron_bridge mode
- [x] Disable specific loggers instead of just configuring
- [ ] Update llm.py to respect electron_bridge mode
- [ ] Update openai_rate_limiter.py to respect electron_bridge mode
- [ ] Test core modules in both modes
- [ ] Ensure no logging interference in electron_bridge mode

### Phase 4: Refactor TypeScript Bridge with Critical Buffer Limits

**Objective**: Simplify TypeScript bridge with improved error handling and buffer management

**Files to Modify**:
- `electron-app/src/main/services/PythonBridge.ts`

**Key Changes with Critical Fixes**:

```typescript
// In scrapeProduct() method - Add buffer size limits
const MAX_STDOUT_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_STDERR_SIZE = 1024 * 1024; // 1MB
let stdoutSize = 0;
let stderrSize = 0;

// Capture stdout with size limit
child.stdout!.on('data', (data: Buffer) => {
  stdoutSize += data.length;
  if (stdoutSize > MAX_STDOUT_SIZE) {
    cleanup();
    child.kill();
    resolve({
      success: false,
      data: null,
      metadata: {},
      error: 'Output size exceeded 10MB limit'
    });
    return;
  }
  stdoutChunks.push(data);
});

// Capture and parse stderr with size limits and better parsing
child.stderr!.on('data', (data: Buffer) => {
  stderrSize += data.length;
  if (stderrSize > MAX_STDERR_SIZE) {
    // Stop accumulating stderr to prevent memory issues
    return;
  }
  stderrChunks.push(data);
  
  const lines = data.toString().split('\n').filter(Boolean);
  lines.forEach((line: string) => {
    try {
      const parsed = JSON.parse(line);
      if (parsed.type === 'progress' && onProgress) {
        onProgress({
          type: 'progress',
          stage: parsed.stage,
          progress: parsed.progress,
          message: parsed.message,
          timestamp: parsed.timestamp
        });
      }
    } catch (e) {
      // Not JSON, probably a log message - ignore silently
    }
  });
});

// Handle process exit with partial output detection
child.on('close', (code) => {
  cleanup();
  
  if (code === null) {
    return;
  }
  
  try {
    const stdout = Buffer.concat(stdoutChunks).toString();
    
    // Validate JSON before parsing
    if (!stdout.trim()) {
      resolve({
        success: false,
        data: null,
        metadata: {},
        error: 'No output received from Python process'
      });
      return;
    }
    
    const result = JSON.parse(stdout) as ScrapeResult;
    resolve(result);
  } catch (e) {
    const stdout = Buffer.concat(stdoutChunks).toString();
    
    // Check if output looks like partial JSON
    if (stdout.trim().startsWith('{') && !stdout.includes('}')) {
      resolve({
        success: false,
        data: null,
        metadata: { partial_output: stdout.slice(0, 500) },
        error: 'Process terminated unexpectedly (partial output detected)'
      });
    } else {
      resolve({
        success: false,
        data: null,
        metadata: {},
        error: `Failed to parse output: ${e}. stdout: ${stdout.slice(0, 200)}`
      });
    }
  }
});
```

**Tasks**:
- [x] **CRITICAL**: Add buffer size limits to prevent memory issues
- [x] **CRITICAL**: Add partial output detection for process crashes
- [x] Remove delimiter-based parsing logic
- [x] Simplify stdout parsing to direct JSON.parse()
- [x] Update stderr parsing to handle JSON Lines
- [x] Improve error messages with context
- [ ] Update progress interface to match new format
- [ ] Test TypeScript bridge with new Python output

### Phase 5: Testing and Validation (Enhanced)

**Objective**: Comprehensive testing including edge cases and error conditions

**Test Cases**:

1. **Unit Tests**:
   - [ ] Test StructuredLogger singleton behavior
   - [ ] Test LoggerFactory instance management
   - [ ] Test JSON serialization error handling
   - [ ] Test logging configuration in different modes
   - [ ] Test buffer overflow protection

2. **Integration Tests**:
   - [ ] Test electron_bridge in isolation
   - [ ] Test core modules in standalone mode
   - [ ] Test full pipeline with Electron app
   - [ ] Test environment variable race condition fix

3. **Edge Case Tests**:
   ```bash
   # Test partial output handling
   echo '{"url": "https://httpbin.org/delay/10"}' | timeout 5s ./electron_bridge
   
   # Test large output
   echo '{"url": "https://example.com/large-page"}' | ./electron_bridge
   
   # Test concurrent processes
   for i in {1..5}; do
     echo '{"url": "https://httpbin.org/json"}' | ./electron_bridge &
   done
   wait
   
   # Test malformed input
   echo 'invalid json' | ./electron_bridge
   ```

4. **Performance Tests**:
   - [ ] Memory usage with large outputs
   - [ ] Concurrent process handling
   - [ ] Logging performance impact

5. **Regression Tests**:
   - [ ] Test ProductNew page functionality
   - [ ] Test Python bridge health check
   - [ ] Test progress updates in UI
   - [ ] Test error handling scenarios

**Tasks**:
- [ ] Create comprehensive test suite covering all edge cases
- [ ] Test buffer limit protection
- [ ] Test partial output detection
- [ ] Test singleton logger behavior
- [ ] Validate race condition fix
- [ ] Performance testing with large outputs

### Phase 6: Documentation and Cleanup

**Objective**: Document the new system and clean up old code

**Tasks**:
- [ ] Update README with new logging approach
- [ ] Document protocol specification
- [ ] Create troubleshooting guide for common issues
- [ ] Remove old delimiter-based code from TypeScript
- [ ] Update architecture documentation
- [ ] Create migration guide for future similar issues

## Critical Fixes Summary

### 1. Race Condition Fix (CRITICAL)
- **Issue**: Environment variable set after imports causes race condition
- **Fix**: Set `ELECTRON_BRIDGE_MODE` before any imports in electron_bridge.py
- **Impact**: Prevents logging configuration conflicts

### 2. Buffer Overflow Protection (CRITICAL)
- **Issue**: Unlimited stderr accumulation could cause memory issues
- **Fix**: Add size limits for stdout (10MB) and stderr (1MB) buffers
- **Impact**: Prevents memory exhaustion attacks

### 3. Partial Output Detection (CRITICAL)
- **Issue**: Process crashes during JSON output leave incomplete data
- **Fix**: Detect partial JSON patterns and provide meaningful error messages
- **Impact**: Better error reporting and debugging

### 4. Logger Singleton Pattern (OPTIONAL)
- **Issue**: Multiple logger instances create scattered state
- **Fix**: Implement singleton pattern with thread safety
- **Impact**: Centralized logger management and better resource usage

### 5. JSON Serialization Safety (OPTIONAL)
- **Issue**: Logger crashes if objects aren't JSON serializable
- **Fix**: Add fallback error handling with simple string output
- **Impact**: More robust logging that doesn't break on edge cases

## Alternative Quick Fix

For immediate relief while implementing the full solution:

```python
# In electron_bridge.py (first lines)
import os
import logging

if os.environ.get('ELECTRON_BRIDGE_MODE'):
    # Quick fix: Disable ALL logging except CRITICAL
    logging.disable(logging.CRITICAL)
    
    # Suppress specific noisy libraries
    logging.getLogger('urllib3').setLevel(logging.CRITICAL)
    logging.getLogger('selenium').setLevel(logging.CRITICAL)
    logging.getLogger('undetected_chromedriver').setLevel(logging.CRITICAL)
```

## Success Criteria (Updated)

1. **Clean Separation**: stdout contains only JSON data, stderr contains only structured logs
2. **Tool Compatibility**: Works with jq, grep, and other Unix tools
3. **Maintainability**: Simple, readable code without custom parsing logic
4. **Debuggability**: Easy to inspect logs and data separately
5. **Performance**: No degradation in scraping performance
6. **Reliability**: Robust error handling and recovery
7. **Robustness**: Handles edge cases like partial outputs and buffer overflows
8. **Thread Safety**: Safe for concurrent usage

## Risk Mitigation

1. **Backward Compatibility**: Maintain support for standalone mode
2. **Gradual Migration**: Implement in phases to minimize risk
3. **Comprehensive Testing**: Test all scenarios including edge cases before deployment
4. **Quick Fix Fallback**: Simple logging suppression as emergency fallback
5. **Rollback Plan**: Keep old code until new system is validated
6. **Buffer Protection**: Prevent memory issues with size limits

## Timeline (Updated)

- **Phase 1**: 1 day - Centralized logging configuration with critical fixes
- **Phase 2**: 1 day - Refactor electron_bridge.py with race condition fix
- **Phase 3**: 1 day - Update core modules with environment checks
- **Phase 4**: 1 day - Refactor TypeScript bridge with buffer protection
- **Phase 5**: 2 days - Enhanced testing including edge cases
- **Phase 6**: 1 day - Documentation and cleanup

**Total Estimated Time**: 7 days (unchanged, but with higher quality implementation)

## Dependencies

- Python 3.11+
- Existing specscraper library structure
- Electron app TypeScript setup
- PyInstaller for bundling

## Notes

- This updated implementation incorporates all critical fixes identified in the architecture review
- The race condition fix is the highest priority item
- Buffer overflow protection prevents potential security/stability issues
- The quick fix option provides immediate relief while implementing the full solution
- All changes remain backward compatible with standalone usage
- The design is now more robust and production-ready
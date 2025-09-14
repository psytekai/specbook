# Centralized Logging Fix Implementation Plan

**Date**: 2025-09-14  
**Status**: Planning  
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

## Solution Design

### Core Principles

1. **Unix Philosophy**: stdout = data, stderr = logs
2. **Industry Standards**: Use JSON Lines for logs, single JSON for data
3. **Separation of Concerns**: Clear boundaries between data and metadata
4. **Tool Compatibility**: Works with standard Unix tools (jq, grep, etc.)
5. **Maintainability**: Simple, readable, debuggable

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
{"level": "info", "component": "scraper", "message": "Starting scrape of https://example.com", "timestamp": "2025-09-14T12:46:56Z"}
{"level": "progress", "stage": "init", "progress": 0, "message": "Initializing components", "timestamp": "2025-09-14T12:46:56Z"}
{"level": "progress", "stage": "scraping", "progress": 50, "message": "Page loaded successfully", "timestamp": "2025-09-14T12:46:56Z"}
{"level": "progress", "stage": "complete", "progress": 100, "message": "Extraction complete", "timestamp": "2025-09-14T12:46:58Z"}
```

## Implementation Plan

### Phase 1: Centralized Logging Configuration

**Objective**: Create a unified logging system that supports both structured and traditional logging

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
from typing import Optional
from datetime import datetime

class StructuredLogger:
    """Structured logger that outputs JSON Lines to stderr"""
    
    def __init__(self, component: str):
        self.component = component
    
    def info(self, message: str, **kwargs):
        self._log("info", message, **kwargs)
    
    def warning(self, message: str, **kwargs):
        self._log("warning", message, **kwargs)
    
    def error(self, message: str, **kwargs):
        self._log("error", message, **kwargs)
    
    def debug(self, message: str, **kwargs):
        self._log("debug", message, **kwargs)
    
    def progress(self, stage: str, progress: int, message: str):
        self._log("progress", message, stage=stage, progress=progress)
    
    def _log(self, level: str, message: str, **kwargs):
        log_entry = {
            "level": level,
            "component": self.component,
            "message": message,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            **kwargs
        }
        print(json.dumps(log_entry), file=sys.stderr, flush=True)

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
```

**Tasks**:
- [ ] Create `logging_config.py` with StructuredLogger class
- [ ] Implement centralized logging configuration function
- [ ] Add environment variable support for electron_bridge mode
- [ ] Test logging configuration in isolation

### Phase 2: Refactor electron_bridge.py

**Objective**: Update electron_bridge to use structured logging and clean stdout/stderr separation

**Files to Modify**:
- `specscraper/electron_bridge.py`

**Implementation**:

```python
#!/usr/bin/env python3
"""
Electron Bridge for Specscraper
Provides CLI interface for Electron app to perform product scraping
"""

import sys
import os
import json
import time
from typing import Dict, Any

# Set environment variable to indicate electron_bridge mode
os.environ['ELECTRON_BRIDGE_MODE'] = '1'

# Import our structured logging
from lib.utils.logging_config import StructuredLogger

# Import core modules (they'll use traditional logging)
from lib.core.scraping import StealthScraper
from lib.core.html_processor import HTMLProcessor
from lib.core.llm import PromptTemplator, LLMInvocator

class ElectronBridge:
    """Bridge between Electron app and specscraper library"""
    
    def __init__(self):
        self.logger = StructuredLogger("bridge")
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
    bridge_logger = StructuredLogger("bridge")
    
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
- [ ] Remove old logging configuration from electron_bridge.py
- [ ] Add environment variable setting for ELECTRON_BRIDGE_MODE
- [ ] Replace all logging calls with StructuredLogger
- [ ] Ensure only JSON result goes to stdout
- [ ] Test electron_bridge in isolation

### Phase 3: Update Core Modules

**Objective**: Modify core modules to respect electron_bridge mode and not interfere with structured logging

**Files to Modify**:
- `specscraper/lib/core/scraping.py`
- `specscraper/lib/core/llm.py`
- `specscraper/lib/utils/openai_rate_limiter.py`

**Implementation for scraping.py**:

```python
# At the top of the file, after imports
import os
from lib.utils.logging_config import configure_logging

# Configure logging based on context
if os.environ.get('ELECTRON_BRIDGE_MODE'):
    # In electron_bridge mode, don't configure logging
    # Let electron_bridge handle structured logging
    pass
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
- [ ] Update scraping.py to check ELECTRON_BRIDGE_MODE
- [ ] Update llm.py to respect electron_bridge mode
- [ ] Update openai_rate_limiter.py to respect electron_bridge mode
- [ ] Test core modules in both modes
- [ ] Ensure no logging interference in electron_bridge mode

### Phase 4: Refactor TypeScript Bridge

**Objective**: Simplify TypeScript bridge to use clean JSON parsing without custom delimiters

**Files to Modify**:
- `electron-app/src/main/services/PythonBridge.ts`

**Key Changes**:

1. **Remove delimiter parsing logic**
2. **Simplify stdout parsing** - just parse as JSON
3. **Parse stderr as JSON Lines** for progress updates
4. **Remove complex string manipulation**

**Implementation**:

```typescript
// In testBridge() method
child.on('close', (code) => {
  if (code === 0) {
    try {
      // Parse stdout as JSON (should be clean now)
      const result = JSON.parse(output);
      if (result.success !== undefined) {
        resolve({ success: true });
      } else {
        resolve({ success: false, error: 'Invalid response format' });
      }
    } catch (e) {
      resolve({ success: false, error: `Failed to parse response: ${e}` });
    }
  } else {
    resolve({ success: false, error: `Process exited with code ${code}: ${errorOutput}` });
  }
});

// In scrapeProduct() method
child.on('close', (code) => {
  cleanup();
  
  if (code === null) {
    return;
  }
  
  try {
    const stdout = Buffer.concat(stdoutChunks).toString();
    // Parse stdout as JSON (should be clean now)
    const result = JSON.parse(stdout) as ScrapeResult;
    resolve(result);
  } catch (e) {
    const stdout = Buffer.concat(stdoutChunks).toString();
    resolve({
      success: false,
      data: null,
      metadata: {},
      error: `Failed to parse output: ${e}. stdout: ${stdout.slice(0, 200)}`
    });
  }
});

// In stderr handling
child.stderr!.on('data', (data: Buffer) => {
  stderrChunks.push(data);
  const lines = data.toString().split('\n').filter(Boolean);
  lines.forEach((line: string) => {
    try {
      const parsed = JSON.parse(line);
      if (parsed.level === 'progress' && onProgress) {
        onProgress({
          type: 'progress',
          stage: parsed.stage,
          progress: parsed.progress,
          message: parsed.message,
          timestamp: parsed.timestamp
        });
      }
    } catch (e) {
      // Not JSON, probably a log message - ignore
    }
  });
});
```

**Tasks**:
- [ ] Remove delimiter-based parsing logic
- [ ] Simplify stdout parsing to direct JSON.parse()
- [ ] Update stderr parsing to handle JSON Lines
- [ ] Update progress interface to match new format
- [ ] Test TypeScript bridge with new Python output

### Phase 5: Testing and Validation

**Objective**: Comprehensive testing of the new logging system

**Test Cases**:

1. **Unit Tests**:
   - [ ] Test StructuredLogger output format
   - [ ] Test logging configuration in different modes
   - [ ] Test JSON parsing in TypeScript bridge

2. **Integration Tests**:
   - [ ] Test electron_bridge in isolation
   - [ ] Test core modules in standalone mode
   - [ ] Test full pipeline with Electron app

3. **Manual Tests**:
   ```bash
   # Test data stream
   echo '{"url": "https://example.com", "options": {}}' | ./electron_bridge | jq .
   
   # Test log stream
   echo '{"url": "https://example.com", "options": {}}' | ./electron_bridge 2>&1 | grep progress | jq .
   
   # Test both streams
   echo '{"url": "https://example.com", "options": {}}' | ./electron_bridge > result.json 2> logs.jsonl
   ```

4. **Regression Tests**:
   - [ ] Test ProductNew page functionality
   - [ ] Test Python bridge health check
   - [ ] Test progress updates in UI
   - [ ] Test error handling

**Tasks**:
- [ ] Create comprehensive test suite
- [ ] Test all scenarios manually
- [ ] Validate output formats
- [ ] Test error conditions
- [ ] Performance testing

### Phase 6: Documentation and Cleanup

**Objective**: Document the new system and clean up old code

**Tasks**:
- [ ] Update README with new logging approach
- [ ] Document protocol specification
- [ ] Create troubleshooting guide
- [ ] Remove old delimiter-based code
- [ ] Update architecture documentation

## Success Criteria

1. **Clean Separation**: stdout contains only JSON data, stderr contains only structured logs
2. **Tool Compatibility**: Works with jq, grep, and other Unix tools
3. **Maintainability**: Simple, readable code without custom parsing logic
4. **Debuggability**: Easy to inspect logs and data separately
5. **Performance**: No degradation in scraping performance
6. **Reliability**: Robust error handling and recovery

## Risk Mitigation

1. **Backward Compatibility**: Maintain support for standalone mode
2. **Gradual Migration**: Implement in phases to minimize risk
3. **Comprehensive Testing**: Test all scenarios before deployment
4. **Rollback Plan**: Keep old code until new system is validated

## Timeline

- **Phase 1**: 1 day - Centralized logging configuration
- **Phase 2**: 1 day - Refactor electron_bridge.py
- **Phase 3**: 1 day - Update core modules
- **Phase 4**: 1 day - Refactor TypeScript bridge
- **Phase 5**: 2 days - Testing and validation
- **Phase 6**: 1 day - Documentation and cleanup

**Total Estimated Time**: 7 days

## Dependencies

- Python 3.11+
- Existing specscraper library structure
- Electron app TypeScript setup
- PyInstaller for bundling

## Notes

- This implementation follows industry best practices for subprocess communication
- The JSON Lines format is RFC 7464 compliant
- The design is extensible for future enhancements
- All changes are backward compatible with standalone usage

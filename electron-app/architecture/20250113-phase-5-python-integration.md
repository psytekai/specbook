# Phase 5: Python Integration Implementation Guide

## Overview
This document provides step-by-step instructions for integrating the Python specscraper backend with the Electron desktop application using **PyInstaller bundling strategy**. The integration uses a CLI-based approach with PyInstaller to create a standalone executable for cross-platform compatibility.

## Architecture Summary
- **Communication**: JSON via stdin/stdout
- **Progress Updates**: JSON via stderr  
- **Error Handling**: Structured JSON responses
- **Process Model**: Spawn per request (stateless)
- **Bundle Strategy**: PyInstaller standalone executable (~40-60MB total)
- **Scraping Flow**: requests → Firecrawl API fallback
- **Dependencies**: Minimal core packages only (no Selenium/Chrome)

## Bundle Architecture

```
electron-app/
├── app.asar
├── resources/
│   └── python/
│       └── electron_bridge/       # PyInstaller bundle directory
│           ├── electron_bridge    # Standalone executable (macOS/Linux)
│           ├── electron_bridge.exe # Standalone executable (Windows)
│           └── _internal/         # PyInstaller dependencies
│               ├── python311.dll
│               ├── base_library.zip
│               ├── openai/
│               ├── requests/
│               ├── beautifulsoup4/
│               ├── pydantic/
│               ├── firecrawl/
│               └── python_dotenv/
```

## PyInstaller Integration

### Why PyInstaller?
- ✅ **Standalone executable**: No Python installation required on target machines
- ✅ **Automatic dependency resolution**: Finds all imports automatically
- ✅ **Cross-platform**: Works on Windows, macOS, Linux
- ✅ **Smaller bundle**: Only includes required packages (~40-60MB vs 100MB+)
- ✅ **Simpler integration**: Single executable vs complex Python environment
- ✅ **Better reliability**: No venv configuration issues

### Bundle Script (scripts/bundle-python.sh)
```bash
#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SPEC_DIR="$PROJECT_DIR/../specscraper"
OUT_DIR="$SPEC_DIR/dist/electron_bridge"
BUNDLE_DIR="$PROJECT_DIR/resources/python/electron_bridge"

echo "Creating PyInstaller bundle..."

case "$(uname -s | tr '[:upper:]' '[:lower:]')" in
  darwin)
    cd "$SPEC_DIR"
    python3 -m venv .venv
    source .venv/bin/activate
    python -m pip install --upgrade pip wheel
    [ -f requirements-minimal.txt ] && python -m pip install -r requirements-minimal.txt
    python -m pip install pyinstaller
    pyinstaller --noconfirm --clean --onedir --noconsole --name electron_bridge electron_bridge.py
    deactivate

    rm -rf "$BUNDLE_DIR"
    mkdir -p "$(dirname "$BUNDLE_DIR")"
    cp -R "$OUT_DIR" "$BUNDLE_DIR"
    echo "✅ Python bundle created at: $BUNDLE_DIR"
    echo "Bundle size: $(du -sh "$BUNDLE_DIR" | cut -f1)"
    ;;
  *)
    echo "Build this on the target OS (use CI runners)."
    exit 1
    ;;
esac
```

### Electron Integration
```typescript
import path from "path";
import { app } from "electron";
import { spawn } from "child_process";

/**
 * Get the path to the PyInstaller-bundled Python bridge executable
 */
function bridgePath(): string {
  const base = app.isPackaged ? process.resourcesPath : path.join(process.cwd(), "dist");
  const exe = process.platform === "win32" ? "electron_bridge.exe" : "electron_bridge";
  return path.join(base, "python", "electron_bridge", exe);
}

/**
 * Run the Python bridge with optional arguments and options
 */
export function runBridge(args: string[] = [], opts: any = {}) {
  const bridgeExecutable = bridgePath();
  
  // Optional: Check if executable exists in dev mode
  if (!app.isPackaged && !require('fs').existsSync(bridgeExecutable)) {
    console.warn(`Bridge executable not found at ${bridgeExecutable}. Run 'npm run bundle-python' first.`);
  }
  
  return spawn(bridgeExecutable, args, { 
    stdio: ["ignore","pipe","pipe"], 
    windowsHide: true, 
    ...opts 
  });
}
```

### Usage Examples

```typescript
// Basic usage
const bridge = runBridge();
bridge.stdin.write('{"url": "https://example.com"}');
bridge.stdin.end();

// With error handling
const bridge = runBridge();
bridge.on('error', (error) => {
  console.error('Bridge failed:', error);
});

bridge.on('exit', (code) => {
  console.log(`Bridge exited with code ${code}`);
});

// With data handling
let output = '';
bridge.stdout.on('data', (data) => {
  output += data.toString();
});

bridge.on('close', () => {
  const result = JSON.parse(output);
  console.log('Bridge result:', result);
});
```

### Package.json Configuration

```json
{
  "scripts": {
    "bundle-python": "bash scripts/bundle-python.sh",
    "dist": "npm run bundle-python && npm run build && electron-builder",
    "dist:mac": "npm run bundle-python && npm run build && electron-builder --mac"
  },
  "build": {
    "extraResources": [
      {
        "from": "resources/python/electron_bridge",
        "to": "python/electron_bridge",
        "filter": ["**/*"]
      }
    ]
  }
}
```

## Dependencies

### Minimal Requirements (requirements-minimal.txt)
- `openai>=1.0.0` - LLM integration
- `beautifulsoup4>=4.12.0` - HTML parsing  
- `pydantic>=2.0.0` - Data validation
- `requests>=2.28.0` - HTTP client
- `firecrawl-py>=2.0.0` - Cloud scraping fallback
- `python-dotenv>=1.0.0` - Environment management

### Removed Dependencies
- ❌ `selenium` - No browser automation needed
- ❌ `undetected-chromedriver` - No Chrome drivers
- ❌ `pandas`, `numpy` - Not used in core scraping
- ❌ `matplotlib`, `seaborn` - Development/analysis only

---

## Step 1: Clean Up Dependencies & Create Python Bridge Script ✅ **Completed** 
**Goal**: Remove unused dependencies and create the bridge script for minimal bundling

### 1.1 Clean up specscraper dependencies
**Status**: ✅ **Completed** - Selenium imports removed, method validation updated

### 1.2 Create the bridge script
**File**: `specscraper/electron_bridge.py`

```python
#!/usr/bin/env python3
"""
Electron Bridge for Specscraper
Provides CLI interface for Electron app to perform product scraping
"""

import sys
import os
import json
import logging
import time
from typing import Dict, Any

# PyInstaller handles all path setup automatically - no manual configuration needed

from lib.core.scraping import StealthScraper
from lib.core.html_processor import HTMLProcessor
from lib.core.llm import PromptTemplator, LLMInvocator

# Configure logging to stderr so it doesn't interfere with JSON output
# Only configure if no other logging has been set up
if not logging.getLogger().handlers:
    logging.basicConfig(
        level=logging.WARNING,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        stream=sys.stderr
    )

# Suppress verbose logging from libraries
logging.getLogger('urllib3').setLevel(logging.ERROR)


class ElectronBridge:
    """Bridge between Electron app and specscraper library"""
    
    def __init__(self):
        """Initialize the bridge with all required components"""
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
            self.report_progress("init", 0, "Initializing components...")
            self.scraper = StealthScraper()
            self.processor = HTMLProcessor()
            self.templator = PromptTemplator()
            self.llm = LLMInvocator()
            self._initialized = True
            self.report_progress("init", 10, "Full components initialized")
        except Exception as e:
            raise RuntimeError(f"Failed to initialize components: {str(e)}")
        
    def report_progress(self, stage: str, progress: int, message: str):
        """
        Send progress update to stderr for Electron to capture
        
        Args:
            stage: Current stage (init, scraping, processing, extraction, complete)
            progress: Progress percentage (0-100)
            message: Human-readable status message
        """
        progress_data = {
            "type": "progress",
            "stage": stage,
            "progress": progress,
            "message": message,
            "timestamp": time.time()
        }
        print(json.dumps(progress_data), file=sys.stderr, flush=True)
    
    def scrape_product(self, url: str, options: Dict[str, Any]) -> Dict[str, Any]:
        """
        Complete end-to-end product scraping pipeline
        
        Args:
            url: Product URL to scrape
            options: Scraping and LLM options
                - method: "auto" | "requests" | "firecrawl"
                - llm_model: Model name (default: "gpt-4o-mini")
                - temperature: LLM temperature (default: 0.7)
                - max_tokens: Max response tokens (default: 1000)
            
        Returns:
            Dictionary with success status, extracted data, and metadata
        """
        start_time = time.time()
        
        try:
            # Initialize components if needed
            if not self._initialized:
                self.initialize()
            
            # Step 1: Scrape URL
            self.report_progress("scraping", 15, f"Starting scrape of {url}")
            
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
            
            self.report_progress("scraping", 50, "Page loaded successfully")
            
            # Step 2: Process HTML
            self.report_progress("processing", 60, "Cleaning and structuring HTML...")
            
            processed = self.processor.clean_html(scrape_result.content)
            processed_json = processed.model_dump_json()
            
            self.report_progress("processing", 70, f"HTML processed: {processed.word_count} words, {processed.image_count} images")
            
            # Step 3: Generate prompt and extract data
            self.report_progress("extraction", 80, "Preparing LLM prompt...")
            
            prompt = self.templator.product_extraction(url, processed_json)
            prompt_tokens = len(prompt) // 4  # Rough estimate
            
            self.report_progress("extraction", 85, f"Calling LLM ({options.get('llm_model', 'gpt-4o-mini')})...")
            
            llm_response = self.llm.invoke_llm(
                model_provider="openai",
                llm_model_name=options.get("llm_model", "gpt-4o-mini"),
                prompt=prompt,
                temperature=options.get("temperature", 0.7),
                max_tokens=options.get("max_tokens", 1000)
            )
            
            self.report_progress("extraction", 95, "Parsing LLM response...")
            
            # Parse and validate response
            extracted = PromptTemplator.ProductExtractionOutput.model_validate_json(llm_response)
            
            self.report_progress("complete", 100, "Extraction complete")
            
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
            return {
                "success": False,
                "data": None,
                "metadata": {"execution_time": time.time() - start_time},
                "error": f"Failed to parse LLM response: {str(e)}"
            }
        except Exception as e:
            return {
                "success": False,
                "data": None,
                "metadata": {"execution_time": time.time() - start_time},
                "error": f"{type(e).__name__}: {str(e)}"
            }


def main():
    """Main entry point for CLI usage"""
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
        
        # Output result as JSON to stdout
        print(json.dumps(result, indent=2))
        sys.exit(0 if result["success"] else 1)
        
    except json.JSONDecodeError as e:
        error_result = {
            "success": False,
            "data": None,
            "metadata": {},
            "error": f"Invalid JSON input: {str(e)}"
        }
        print(json.dumps(error_result, indent=2))
        sys.exit(1)
        
    except Exception as e:
        # Return error in structured format
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

### 1.2 Make the script executable
```bash
chmod +x specscraper/electron_bridge.py
```

### 1.3 Test the script standalone
```bash
# From the specscraper directory
echo '{"url": "https://example.com/product"}' | python electron_bridge.py
```

**Validation**:
- [x] Script creates without errors
- [x] Script is executable  
- [x] Returns JSON output to stdout
- [x] Progress updates appear on stderr
- [x] Error cases return structured JSON

---

## Step 2: Create Python Bundling Scripts  ✅ **Completed** 
**Goal**: Create build scripts to bundle Python runtime with minimal packages

### 2.1 Create Python bundle creation script
**File**: `electron-app/scripts/bundle-python.sh`

```bash
# scripts/bundle-python-mac.sh
#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SPEC_DIR="$APP_DIR/../specscraper"
OUT_DIR="$SPEC_DIR/dist/electron_bridge"
BUNDLE_DIR="$APP_DIR/resources/python/electron_bridge"

cd "$SPEC_DIR"
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -U pip wheel
[ -f requirements-minimal.txt ] && python -m pip install -r requirements-minimal.txt
python -m pip install pyinstaller
pyinstaller --noconfirm --clean --onedir --noconsole --name electron_bridge electron_bridge.py
deactivate

rm -rf "$BUNDLE_DIR"; mkdir -p "$BUNDLE_DIR"
cp -R "$OUT_DIR"/. "$BUNDLE_DIR"/
echo "✅ mac bundle staged at: $BUNDLE_DIR"
```

### 2.2 PyInstaller Path Handling
**Status**: ✅ **Completed** - PyInstaller automatically handles all path setup. The `electron_bridge.py` script includes the comment `# PyInstaller handles all path setup automatically - no manual configuration needed` and works correctly in bundled mode.

### 2.3 Update package.json build configuration
**File**: `electron-app/package.json` (build configuration)

```json
{
  "scripts": {
    "bundle-python": "bash scripts/bundle-python.sh",
    "bundle-python:windows": "echo 'Windows Python builds handled by CI/CD. Download from GitHub Actions artifacts.'",
    "dist:mac": "npm run bundle-python && npm run build && electron-builder --mac",
    "dist:win": "npm run build && electron-builder --win",
    "dist:linux": "npm run build && electron-builder --linux"
  },
  "build": {
    "extraResources": [
      {
        "from": "resources/python/electron_bridge",
        "to": "python/electron_bridge",
        "filter": ["**/*"]
      }
    ]
  }
}
```

**Validation**:
- [x] Bundle script creates PyInstaller executable
- [x] Minimal packages install correctly (requirements-minimal.txt)
- [x] Bundle size is reasonable (~40-60MB PyInstaller bundle)
- [x] electron_bridge executable works in bundled mode
- [x] Bundle copied to resources/python/electron_bridge/

### 2.4 Implementation Summary
**What was implemented:**
- ✅ PyInstaller-based bundling approach (simpler than planned virtual environment approach)
- ✅ macOS-focused script with cross-platform CI/CD considerations
- ✅ Minimal dependencies from `requirements-minimal.txt`
- ✅ Bundle automatically copied to `resources/python/electron_bridge/`
- ✅ Package.json scripts configured for `dist:mac` build process

**Key differences from original plan:**
- Used PyInstaller instead of virtual environment bundling (more reliable)
- Simplified to macOS-only script with CI/CD for other platforms
- Removed complex cross-platform path handling (PyInstaller handles this)
- Bundle structure: `electron_bridge` executable + `_internal/` dependencies

---

## Step 3: Create Node.js Python Bridge Service ✅ **Completed**
**Goal**: Create TypeScript service in Electron app to interface with Python

### 3.1 Create PythonBridge service ✅ **Completed**
**File**: `electron-app/src/main/services/PythonBridge.ts`

**Status**: ✅ **Completed** - Full implementation with advanced features

**Key Features Implemented**:
- ✅ **Process Management**: Concurrent process limiting (max 3 processes)
- ✅ **Security Validation**: URL validation, options sanitization
- ✅ **Caching**: Availability check caching (1 hour)
- ✅ **Resource Management**: Output size limits (10MB), proper cleanup
- ✅ **Error Handling**: Comprehensive error handling and timeout management
- ✅ **Graceful Shutdown**: Process cleanup on app exit

**Implementation Highlights**:

```typescript
export class PythonBridge {
  private activeProcesses = new Set<ChildProcess>();
  private readonly MAX_CONCURRENT_PROCESSES = 3;
  private queue: Array<() => void> = [];
  private availabilityCache: { 
    checked: number; 
    available: boolean; 
  error: string | null;
  } | null = null;
  private readonly CACHE_DURATION = 3.6e+6; // 1 hour
  
  /**
   * Security validation for URLs
   */
  private validateUrl(url: string): { valid: boolean; error?: string } {
    // Blocks local networks, validates protocol
  }
  
  /**
   * Sanitizes options to prevent injection
   */
  private sanitizeOptions(options: any): ScrapeOptions {
    // Whitelist approach with bounds checking
  }
  
  /**
   * Process slot management for concurrency control
   */
  private async waitForSlot(): Promise<void> {
    // Queue management for process limits
  }
  
  /**
   * Graceful shutdown with SIGTERM/SIGKILL
   */
  async shutdown(): Promise<void> {
    // Clean process termination
  }
}
```

**Key Differences from Original Plan**:
- ✅ **Enhanced Security**: URL validation, options sanitization
- ✅ **Process Management**: Concurrent process limiting and queuing
- ✅ **Resource Protection**: Output size limits, memory management
- ✅ **Caching**: Availability check caching for performance
- ✅ **Robust Cleanup**: Proper process cleanup and error handling
- ✅ **Production Ready**: Comprehensive error handling and logging

## Step 4: Create IPC Handlers for Renderer Communication ✅ **Completed**
**Goal**: Set up IPC handlers so the renderer can call Python scraping

### 4.1 Create IPC handlers ✅ **Completed**
**File**: `electron-app/src/main/ipc/pythonHandlers.ts`

**Status**: ✅ **Completed** - Full IPC implementation with comprehensive handlers

**Implementation Highlights**:

```typescript
export function setupPythonIPC(mainWindow?: BrowserWindow): void {
  /**
   * Check Python bridge availability
   */
  ipcMain.handle('python:check-availability', async () => {
    // Returns availability status with caching
  });

  /**
   * Scrape product using Python bridge
   */
  ipcMain.handle('python:scrape-product', async (_event, url: string, options?: ScrapeOptions) => {
    // Progress updates sent to renderer via mainWindow.webContents.send
  });

  /**
   * Get Python bridge status
   */
  ipcMain.handle('python:get-status', async () => {
    // Returns current bridge status
  });
}
```

**Key Features Implemented**:
- ✅ **Three IPC Handlers**: `check-availability`, `scrape-product`, `get-status`
- ✅ **Progress Updates**: Real-time progress sent to renderer via `mainWindow.webContents.send`
- ✅ **Comprehensive Logging**: Detailed console logging for debugging
- ✅ **Error Handling**: Structured error responses
- ✅ **Window Integration**: Progress updates require mainWindow reference

### 4.2 Update preload script ✅ **Completed**
**File**: `electron-app/src/main/preload.ts`

**Status**: ✅ **Completed** - Python API exposed to renderer

**Implementation Highlights**:

```typescript
contextBridge.exposeInMainWorld('electronAPI', {
  // ... existing API ...

  // Python bridge operations
  checkPythonAvailability: () => ipcRenderer.invoke('python:check-availability'),
  scrapeProduct: (url: string, options?: any) => 
    ipcRenderer.invoke('python:scrape-product', url, options),
  getPythonStatus: () => ipcRenderer.invoke('python:get-status'),
  
  onScrapeProgress: (callback: (progress: any) => void) => {
    const handler = (_event: any, progress: any) => callback(progress);
    ipcRenderer.on('python:scrape-progress', handler);
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener('python:scrape-progress', handler);
    };
  }
});
```

**Key Features Implemented**:
- ✅ **Three Python APIs**: `checkPythonAvailability`, `scrapeProduct`, `getPythonStatus`
- ✅ **Progress Listener**: `onScrapeProgress` with cleanup function
- ✅ **Proper Cleanup**: Returns cleanup function to prevent memory leaks
- ✅ **Type Safety**: Proper TypeScript integration

### 4.3 Register handlers in main process ✅ **Completed**
**File**: `electron-app/src/main/index.ts`

**Status**: ✅ **Completed** - Python IPC handlers registered with graceful shutdown

**Implementation Highlights**:

```typescript
import { setupPythonIPC } from './ipc/pythonHandlers';
import { pythonBridge } from './services/PythonBridge';

app.whenReady().then(() => {
  // ... existing setup ...
  
  // Create window first to pass to Python IPC
  const mainWindow = createWindow();
  
  // Set up Python IPC with window reference for progress updates
  setupPythonIPC(mainWindow);
  
  // ... rest of setup ...
});

// Graceful shutdown - cleanup Python processes
app.on('before-quit', async (event) => {
  event.preventDefault();
  
  try {
    console.log('🐍 Shutting down Python bridge processes...');
    await pythonBridge.shutdown();
    console.log('✅ Python bridge shutdown complete');
  } catch (error) {
    console.error('❌ Error during Python bridge shutdown:', error);
  }
  
  // Allow app to quit after cleanup
  setImmediate(() => app.quit());
});
```

**Key Features Implemented**:
- ✅ **Proper Initialization Order**: Window created before Python IPC setup
- ✅ **Graceful Shutdown**: Python processes cleaned up on app exit
- ✅ **Error Handling**: Comprehensive error handling during shutdown
- ✅ **Process Management**: Proper cleanup prevents zombie processes

**Validation**:
- [x] IPC handlers compile without errors
- [x] Handlers are registered in main process
- [x] Preload script exposes Python API to renderer
- [x] Type definitions are correct
- [x] Graceful shutdown implemented
- [x] Window reference passed for progress updates

---

## Step 5: Create Renderer Hook for Python Scraping ⏳ **Pending**
**Goal**: Create React hook for easy Python scraping from components

### 5.1 Create the hook ⏳ **Pending**
**File**: `electron-app/src/renderer/hooks/usePythonScraper.ts`

**Status**: ⏳ **Pending** - Not yet implemented

**Required Implementation**:

```typescript
import { useState, useEffect, useCallback } from 'react';

export interface ScrapeProgress {
  stage: 'init' | 'scraping' | 'processing' | 'extraction' | 'complete';
  progress: number;
  message: string;
}

export interface ScrapeResult {
  success: boolean;
  data: {
    image_url: string;
    type: string;
    description: string;
    model_no: string;
    product_link: string;
  } | null;
  metadata: Record<string, any>;
  error: string | null;
}

export interface PythonStatus {
  available: boolean;
  error: string | null;
  bridgePath: string;
}

export function usePythonScraper() {
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [pythonStatus, setPythonStatus] = useState<PythonStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<ScrapeProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Check Python availability on mount
  useEffect(() => {
    checkAvailability();
    
    // Set up progress listener with cleanup
    const cleanup = window.electronAPI.onScrapeProgress((progress: ScrapeProgress) => {
      setProgress(progress);
    });
    
    return cleanup; // Cleanup function returned from preload
  }, []);
  
  const checkAvailability = async () => {
    try {
      const status = await window.electronAPI.checkPythonAvailability();
      setPythonStatus(status);
      setIsAvailable(status.available);
    } catch (err) {
      setIsAvailable(false);
      setError('Failed to check Python availability');
    }
  };
  
  const scrapeProduct = useCallback(async (
    url: string,
    options?: any
  ): Promise<ScrapeResult | null> => {
    if (!isAvailable) {
      setError('Python scraper not available');
      return null;
    }
    
    setIsLoading(true);
    setError(null);
    setProgress(null);
    
    try {
      const result = await window.electronAPI.scrapeProduct(url, options);
      
      if (!result.success) {
        setError(result.error || 'Scraping failed');
      }
      
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      return null;
    } finally {
      setIsLoading(false);
      setProgress(null);
    }
  }, [isAvailable]);
  
  return {
    isAvailable,
    pythonStatus,
    isLoading,
    progress,
    error,
    scrapeProduct,
    checkAvailability
  };
}
```

**Key Features to Implement**:
- ✅ **Availability Checking**: Check Python bridge on mount
- ✅ **Progress Tracking**: Real-time progress updates from Python
- ✅ **Error Handling**: Comprehensive error state management
- ✅ **Cleanup**: Proper cleanup of progress listeners
- ✅ **Type Safety**: Full TypeScript integration

**Note**: The `batchScrape` function was removed from the plan as it's not implemented in the current IPC handlers.

---

## Implementation Plan Updates Required

Based on the latest code changes in commit `095977e0`, the following areas of the implementation plan need updates:

### ✅ **Completed Beyond Original Plan**

1. **Enhanced Security Features**:
   - URL validation (blocks local networks)
   - Options sanitization with bounds checking
   - Output size limits (10MB protection)

2. **Advanced Process Management**:
   - Concurrent process limiting (max 3 processes)
   - Process queuing system
   - Graceful shutdown with SIGTERM/SIGKILL

3. **Performance Optimizations**:
   - Availability check caching (1 hour)
   - Resource management improvements
   - Memory leak prevention

4. **Production-Ready Features**:
   - Comprehensive error handling
   - Detailed logging for debugging
   - Proper cleanup functions

### ⚠️ **Areas Requiring Implementation Plan Updates**

1. **Missing Renderer Hook** (Step 5):
   - The `usePythonScraper` hook is not yet implemented
   - This is required for React components to use Python scraping
   - **Priority**: High - needed for UI integration

2. **API Integration**:
   - The `apiIPC.ts` file was modified but the integration isn't documented
   - Need to understand how Python scraping integrates with existing API services
   - **Priority**: Medium - affects overall architecture

3. **Testing Strategy**:
   - No testing approach documented for the Python bridge
   - Need unit tests for PythonBridge service
   - Need integration tests for IPC handlers
   - **Priority**: Medium - affects reliability

4. **Error Handling Documentation**:
   - The implementation has comprehensive error handling
   - Need to document error scenarios and recovery strategies
   - **Priority**: Low - documentation only

5. **Performance Monitoring**:
   - The implementation includes process management
   - Need to document monitoring and metrics collection
   - **Priority**: Low - operational concern

### 🔄 **Next Steps**

1. **Immediate**: Implement the `usePythonScraper` hook (Step 5)
2. **Short-term**: Document API integration patterns
3. **Medium-term**: Add comprehensive testing strategy
4. **Long-term**: Add monitoring and performance documentation

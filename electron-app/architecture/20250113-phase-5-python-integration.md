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

## Step 3: Create Node.js Python Bridge Service
**Goal**: Create TypeScript service in Electron app to interface with Python

### 3.1 Create PythonBridge service
**File**: `electron-app/src/main/services/PythonBridge.ts`

```typescript
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import { app } from 'electron';

export interface ScrapeOptions {
  method?: 'auto' | 'requests' | 'firecrawl';
  llm_model?: string;
  temperature?: number;
  max_tokens?: number;
}

export interface ScrapeProgress {
  type: 'progress';
  stage: 'init' | 'scraping' | 'processing' | 'extraction' | 'complete';
  progress: number;
  message: string;
  timestamp: number;
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
  metadata: {
    scrape_method?: string;
    processing_time?: number;
    scrape_time?: number;
    llm_model?: string;
    status_code?: number;
    html_length?: number;
    processed_length?: number;
    prompt_tokens?: number;
    execution_time?: number;
  };
  error: string | null;
}

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

export class PythonBridge {
  private isAvailable: boolean = false;
  private lastError: string | null = null;
  
  /**
   * Check if the PyInstaller bridge executable is available
   */
  async checkAvailability(): Promise<boolean> {
    try {
      const executablePath = bridgePath();
      
      // Check if executable exists
      await fs.access(executablePath, fs.constants.R_OK);
      
      // Test if executable runs (basic health check)
      const testResult = await this.testBridge();
      if (!testResult.success) {
        this.lastError = `Bridge executable failed health check: ${testResult.error}`;
        this.isAvailable = false;
        return false;
      }
      
      this.isAvailable = true;
      this.lastError = null;
      return true;
    } catch (error) {
      this.lastError = `Bridge not available: ${error}`;
      this.isAvailable = false;
      return false;
    }
  }
  
  /**
   * Test if the bridge executable works (basic health check)
   */
  private async testBridge(): Promise<{success: boolean, error?: string}> {
    return new Promise((resolve) => {
      const child = runBridge();
      let output = '';
      let errorOutput = '';
      
      // Send a simple test request
      const testInput = JSON.stringify({
        url: "https://httpbin.org/json",
        options: { method: "requests" }
      });
      
      child.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      child.on('close', (code) => {
        if (code === 0) {
          try {
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
      
      child.on('error', (error) => {
        resolve({ success: false, error: `Process error: ${error.message}` });
      });
      
      // Send test input
      child.stdin.write(testInput);
      child.stdin.end();
    });
  }
  
  /**
   * Scrape a product URL using the PyInstaller bridge
   */
  async scrapeProduct(
    url: string,
    options: ScrapeOptions = {},
    onProgress?: (progress: ScrapeProgress) => void
  ): Promise<ScrapeResult> {
    if (!this.isAvailable) {
      await this.checkAvailability();
      if (!this.isAvailable) {
        return {
          success: false,
          data: null,
          metadata: {},
          error: this.lastError || 'Python bridge not available'
        };
      }
    }
    
    return new Promise((resolve, reject) => {
      const child = runBridge();
      
      let stdout = '';
      let stderr = '';
      let timeout: NodeJS.Timeout;
      
      // Set timeout (2 minutes)
      timeout = setTimeout(() => {
        child.kill();
        resolve({
          success: false,
          data: null,
          metadata: {},
          error: 'Scraping timeout (120 seconds)'
        });
      }, 120000);
      
      // Send input
      const input = JSON.stringify({ url, options });
      child.stdin.write(input);
      child.stdin.end();
      
      // Capture stdout
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      // Capture and parse stderr for progress updates
      child.stderr.on('data', (data) => {
        const lines = data.toString().split('\n').filter(Boolean);
        lines.forEach(line => {
          stderr += line + '\n';
          try {
            const parsed = JSON.parse(line);
            if (parsed.type === 'progress' && onProgress) {
              onProgress(parsed as ScrapeProgress);
            }
          } catch (e) {
            // Not JSON, probably a log message
          }
        });
      });
      
      // Handle process exit
      child.on('close', (code) => {
        clearTimeout(timeout);
        
        if (code === null) {
          // Process was killed (timeout)
          return;
        }
        
        try {
          const result = JSON.parse(stdout) as ScrapeResult;
          resolve(result);
        } catch (e) {
          // Failed to parse output
          resolve({
            success: false,
            data: null,
            metadata: {},
            error: `Failed to parse output: ${e}. stdout: ${stdout.slice(0, 200)}`
          });
        }
      });
      
      // Handle process errors
      child.on('error', (error) => {
        clearTimeout(timeout);
        resolve({
          success: false,
          data: null,
          metadata: {},
          error: `Process error: ${error.message}`
        });
      });
    });
  }
  
  /**
   * Get availability status
   */
  getStatus(): { available: boolean; error: string | null; pythonPath: string; scriptPath: string } {
    return {
      available: this.isAvailable,
      error: this.lastError,
      pythonPath: this.pythonPath,
      scriptPath: this.scriptPath
    };
  }
}

// Export singleton instance
export const pythonBridge = new PythonBridge();
```

## Step 4: Create IPC Handlers for Renderer Communication
**Goal**: Set up IPC handlers so the renderer can call Python scraping

### 4.1 Create IPC handlers
**File**: `electron-app/src/main/handlers/pythonHandlers.ts`

```typescript
import { ipcMain, BrowserWindow } from 'electron';
import { pythonBridge, ScrapeOptions, ScrapeProgress } from '../services/PythonBridge';

export function setupPythonHandlers(mainWindow: BrowserWindow) {
  // Scrape product
  ipcMain.handle('python:scrape-product', async (event, url: string, options?: ScrapeOptions) => {
    try {
      const result = await pythonBridge.scrapeProduct(
        url,
        options || {},
        (progress: ScrapeProgress) => {
          // Send progress updates to renderer
          mainWindow.webContents.send('python:scrape-progress', progress);
        }
      );
      
      return result;
    } catch (error) {
      return {
        success: false,
        data: null,
        metadata: {},
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });
}
```

### 4.2 Update preload script
**File**: `electron-app/src/main/preload.ts` (add to existing)

```typescript
// Add to existing electronAPI exposure
contextBridge.exposeInMainWorld('electronAPI', {
  // ... existing API ...

  scrapeProduct: (url: string, options?: any) => 
    ipcRenderer.invoke('python:scrape-product', url, options),
  
  onScrapeProgress: (callback: (progress: any) => void) => {
    ipcRenderer.on('python:scrape-progress', (event, progress) => callback(progress));
  },
  
  removeScrapeProgressListener: () => {
    ipcRenderer.removeAllListeners('python:scrape-progress');
  },
  
});
```

### 4.3 Register handlers in main process
**File**: `electron-app/src/main/index.ts` (modify existing)

```typescript
import { setupPythonHandlers } from './handlers/pythonHandlers';

// In the app.whenReady() block, after creating mainWindow:
setupPythonHandlers(mainWindow);
```

**Validation**:
- [ ] IPC handlers compile without errors
- [ ] Handlers are registered in main process
- [ ] Preload script exposes Python API to renderer
- [ ] Type definitions are correct

---

## Step 5: Create Renderer Hook for Python Scraping
**Goal**: Create React hook for easy Python scraping from components

### 5.1 Create the hook
**File**: `electron-app/src/renderer/hooks/usePythonScraper.ts`

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
  pythonPath: string;
  scriptPath: string;
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
    
    // Set up progress listener
    const handleProgress = (progress: ScrapeProgress) => {
      setProgress(progress);
    };
    
    window.electronAPI.onScrapeProgress(handleProgress);
    
    return () => {
      window.electronAPI.removeScrapeProgressListener();
    };
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
  
  const batchScrape = useCallback(async (
    urls: string[],
    options?: any
  ): Promise<ScrapeResult[]> => {
    if (!isAvailable) {
      setError('Python scraper not available');
      return [];
    }
    
    setIsLoading(true);
    setError(null);
    setProgress(null);
    
    try {
      const results = await window.electronAPI.batchScrapeProducts(urls, options);
      return results;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      return [];
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
    batchScrape,
    checkAvailability
  };
}
```

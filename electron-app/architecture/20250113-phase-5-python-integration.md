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
**Status**: ✅ **Already completed** - Selenium imports removed, method validation updated

### 1.2 Create the bridge script
**File**: `specscraper/electron_bridge.py`

```python
#!/usr/bin/env python3
"""
Electron Bridge for Specscraper
Provides CLI interface for Electron app to perform product scraping
"""

import sys
import json
import logging
import time
import traceback
from typing import Dict, Any, Optional

# Configure logging to stderr so it doesn't interfere with JSON output
logging.basicConfig(
    level=logging.WARNING,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stderr
)

# Suppress verbose logging from libraries
logging.getLogger('urllib3').setLevel(logging.ERROR)
# Note: No selenium logging suppression needed - selenium removed

try:
    from lib.core.scraping import StealthScraper
    from lib.core.html_processor import HTMLProcessor  
    from lib.core.llm import PromptTemplator, LLMInvocator
except ImportError as e:
    error_result = {
        "success": False,
        "data": None,
        "metadata": {},
        "error": f"Import error: {str(e)}. Make sure you're running from the specscraper directory."
    }
    print(json.dumps(error_result))
    sys.exit(1)


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
            self.report_progress("init", 10, "Components initialized")
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
                    "scrape_time": scrape_result.execution_time,
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
- [ ] Script creates without errors
- [ ] Script is executable
- [ ] Returns JSON output to stdout
- [ ] Progress updates appear on stderr
- [ ] Error cases return structured JSON

---

## Step 2: Create Python Bundling Scripts
**Goal**: Create build scripts to bundle Python runtime with minimal packages

### 2.1 Create Python bundle creation script
**File**: `electron-app/scripts/bundle-python.sh`

```bash
#!/bin/bash
# Creates portable Python bundle with minimal packages for each platform

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BUNDLE_DIR="$PROJECT_DIR/resources/python"
PLATFORM=$(uname -s | tr '[:upper:]' '[:lower:]')

echo "Creating Python bundle for platform: $PLATFORM"

# Create bundle directory
mkdir -p "$BUNDLE_DIR"

case "$PLATFORM" in
  "darwin")
    # macOS: Download Python 3.11 framework
    PYTHON_VERSION="3.11.8"
    PYTHON_URL="https://www.python.org/ftp/python/$PYTHON_VERSION/python-$PYTHON_VERSION-macos11.pkg"
    echo "Bundling Python for macOS..."
    
    # Use system Python to create portable environment
    python3 -m venv "$BUNDLE_DIR" --copies
    ;;
  "linux")
    # Linux: Use Python embeddable build or system Python
    echo "Bundling Python for Linux..."
    python3 -m venv "$BUNDLE_DIR" --copies
    ;;
  "mingw"* | "cygwin"* | "msys"*)
    # Windows: Download Python embeddable
    PYTHON_VERSION="3.11.8"
    PYTHON_URL="https://www.python.org/ftp/python/$PYTHON_VERSION/python-$PYTHON_VERSION-embed-amd64.zip"
    echo "Bundling Python for Windows..."
    
    # Download and extract Python embeddable
    curl -L -o python-embed.zip "$PYTHON_URL"
    unzip python-embed.zip -d "$BUNDLE_DIR"
    rm python-embed.zip
    ;;
  *)
    echo "Unsupported platform: $PLATFORM"
    exit 1
    ;;
esac

# Install minimal packages
echo "Installing minimal packages..."
"$BUNDLE_DIR/bin/python" -m pip install --upgrade pip
"$BUNDLE_DIR/bin/python" -m pip install -r "$PROJECT_DIR/../specscraper/requirements-minimal.txt"

# Strip debug info and docs to reduce size
echo "Optimizing bundle size..."
find "$BUNDLE_DIR" -name "*.pyc" -delete
find "$BUNDLE_DIR" -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
find "$BUNDLE_DIR" -name "*.pyo" -delete
find "$BUNDLE_DIR" -path "*/test*" -type d -exec rm -rf {} + 2>/dev/null || true
find "$BUNDLE_DIR" -name "*.dist-info" -type d -exec rm -rf {} + 2>/dev/null || true

echo "Python bundle created at: $BUNDLE_DIR"
echo "Bundle size: $(du -sh "$BUNDLE_DIR" | cut -f1)"
```

### 2.2 Update electron_bridge.py for bundled execution
**File**: `specscraper/electron_bridge.py` (add at top after imports)

```python
import sys
import os

# Handle bundled Python environment
def setup_bundled_environment():
    """Set up paths for bundled Python execution"""
    if getattr(sys, 'frozen', False) or hasattr(sys, '_MEIPASS'):
        # Running in bundled mode
        if sys.platform == 'win32':
            bundle_dir = os.path.dirname(sys.executable)
        else:
            bundle_dir = os.path.dirname(os.path.dirname(sys.executable))
        
        # Add lib directory to Python path
        lib_dir = os.path.join(bundle_dir, 'lib', 'python3.11', 'site-packages')
        if os.path.exists(lib_dir) and lib_dir not in sys.path:
            sys.path.insert(0, lib_dir)
    
    # Also check if we're running from Electron resources
    exe_dir = os.path.dirname(os.path.abspath(sys.argv[0]))
    if 'resources' in exe_dir and 'python' in exe_dir:
        site_packages = os.path.join(exe_dir, 'site-packages')
        if os.path.exists(site_packages) and site_packages not in sys.path:
            sys.path.insert(0, site_packages)

# Set up environment before imports
setup_bundled_environment()
```

### 2.3 Update package.json build configuration
**File**: `electron-app/package.json` (modify build section)

```json
{
  "scripts": {
    "bundle-python": "bash scripts/bundle-python.sh",
    "prebuild": "npm run bundle-python",
    "build": "npm run build:main && npm run build:renderer",
    "dist": "npm run build && electron-builder"
  },
  "build": {
    "extraResources": [
      {
        "from": "resources/python",
        "to": "python",
        "filter": ["**/*"]
      },
      {
        "from": "../specscraper/electron_bridge.py",
        "to": "specscraper/electron_bridge.py"
      },
      {
        "from": "../specscraper/lib",
        "to": "specscraper/lib"
      }
    ]
  }
}
```

**Validation**:
- [ ] Bundle script creates Python environment
- [ ] Minimal packages install correctly
- [ ] Bundle size is reasonable (~65-80MB)
- [ ] electron_bridge.py works in bundled mode

---

## Step 3: Create Test Script for Development
**Goal**: Create a test script to validate the bridge works correctly

### 2.1 Create test script
**File**: `specscraper/test_electron_bridge.py`

```python
#!/usr/bin/env python3
"""Test script for electron_bridge.py"""

import subprocess
import json
import sys
import threading
import time


def test_scrape(url, options=None):
    """Test the electron bridge with a given URL"""
    
    input_data = {
        "url": url,
        "options": options or {}
    }
    
    print(f"Testing with URL: {url}")
    print(f"Options: {json.dumps(options or {}, indent=2)}")
    print("-" * 50)
    
    # Run the electron_bridge script
    process = subprocess.Popen(
        [sys.executable, "electron_bridge.py"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    
    # Track stderr output in a separate thread
    stderr_lines = []
    def read_stderr():
        for line in process.stderr:
            stderr_lines.append(line.strip())
            try:
                progress = json.loads(line.strip())
                if progress.get("type") == "progress":
                    print(f"[{progress['stage']}] {progress['progress']}% - {progress['message']}")
            except json.JSONDecodeError:
                if line.strip():
                    print(f"[LOG] {line.strip()}")
    
    stderr_thread = threading.Thread(target=read_stderr)
    stderr_thread.start()
    
    # Send input and get output
    stdout, _ = process.communicate(json.dumps(input_data))
    stderr_thread.join()
    
    # Parse and display result
    try:
        result = json.loads(stdout)
        print("\nResult:")
        print(f"Success: {result['success']}")
        if result['success']:
            print(f"Data: {json.dumps(result['data'], indent=2)}")
            print(f"Metadata: {json.dumps(result['metadata'], indent=2)}")
        else:
            print(f"Error: {result['error']}")
        return result
    except json.JSONDecodeError as e:
        print(f"Failed to parse output: {e}")
        print(f"Raw output: {stdout}")
        return None


if __name__ == "__main__":
    # Test cases
    test_cases = [
        # Test 1: Valid product URL
        {
            "url": "https://www.example.com/product/123",
            "options": {"method": "requests"}
        },
        # Test 2: Invalid URL
        {
            "url": "not-a-url",
            "options": {}
        },
        # Test 3: With specific LLM model
        {
            "url": "https://www.example.com/product/456",
            "options": {
                "method": "auto",
                "llm_model": "gpt-4o-mini",
                "temperature": 0.5
            }
        }
    ]
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n{'='*60}")
        print(f"TEST CASE {i}")
        print(f"{'='*60}")
        result = test_scrape(test_case["url"], test_case["options"])
        time.sleep(1)  # Brief pause between tests
```

### 2.2 Run the test
```bash
cd specscraper
python test_electron_bridge.py
```

**Validation**:
- [ ] Test script runs without errors
- [ ] Progress updates display correctly
- [ ] Success and error cases handled properly
- [ ] JSON parsing works correctly

---

## Step 4: Create Node.js Python Bridge Service
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

### 3.2 Test the PythonBridge service
**File**: `electron-app/src/main/services/__tests__/PythonBridge.test.ts`

```typescript
import { PythonBridge } from '../PythonBridge';
import * as path from 'path';

describe('PythonBridge', () => {
  let bridge: PythonBridge;
  
  beforeEach(() => {
    bridge = new PythonBridge();
  });
  
  describe('checkAvailability', () => {
    it('should check if Python is available', async () => {
      const available = await bridge.checkAvailability();
      expect(typeof available).toBe('boolean');
      
      const status = bridge.getStatus();
      expect(status).toHaveProperty('available');
      expect(status).toHaveProperty('pythonPath');
      expect(status).toHaveProperty('scriptPath');
    });
  });
  
  describe('scrapeProduct', () => {
    it('should handle invalid URL', async () => {
      const result = await bridge.scrapeProduct('not-a-url');
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
    
    it('should handle valid URL with progress', async () => {
      const progressUpdates: any[] = [];
      
      const result = await bridge.scrapeProduct(
        'https://example.com/product',
        { method: 'requests' },
        (progress) => {
          progressUpdates.push(progress);
        }
      );
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('metadata');
      expect(result).toHaveProperty('error');
      
      // Should have received some progress updates
      if (result.success) {
        expect(progressUpdates.length).toBeGreaterThan(0);
      }
    }, 30000); // 30 second timeout for this test
  });
});
```

**Validation**:
- [ ] PythonBridge service compiles without errors
- [ ] checkAvailability correctly detects Python
- [ ] scrapeProduct handles both success and error cases
- [ ] Progress callbacks work correctly
- [ ] Timeout handling works

---

## Step 4: Create IPC Handlers for Renderer Communication
**Goal**: Set up IPC handlers so the renderer can call Python scraping

### 4.1 Create IPC handlers
**File**: `electron-app/src/main/handlers/pythonHandlers.ts`

```typescript
import { ipcMain, BrowserWindow } from 'electron';
import { pythonBridge, ScrapeOptions, ScrapeProgress } from '../services/PythonBridge';

export function setupPythonHandlers(mainWindow: BrowserWindow) {
  // Check Python availability
  ipcMain.handle('python:check-availability', async () => {
    const available = await pythonBridge.checkAvailability();
    return pythonBridge.getStatus();
  });
  
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
  
  // Batch scrape products
  ipcMain.handle('python:batch-scrape', async (event, urls: string[], options?: ScrapeOptions) => {
    const results = [];
    
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      
      // Send batch progress
      mainWindow.webContents.send('python:batch-progress', {
        current: i + 1,
        total: urls.length,
        url: url
      });
      
      const result = await pythonBridge.scrapeProduct(
        url,
        options || {},
        (progress: ScrapeProgress) => {
          // Send individual scrape progress
          mainWindow.webContents.send('python:scrape-progress', {
            ...progress,
            batchIndex: i,
            batchTotal: urls.length
          });
        }
      );
      
      results.push(result);
    }
    
    return results;
  });
}
```

### 4.2 Update preload script
**File**: `electron-app/src/main/preload.ts` (add to existing)

```typescript
// Add to existing electronAPI exposure
contextBridge.exposeInMainWorld('electronAPI', {
  // ... existing API ...
  
  // Python bridge
  checkPythonAvailability: () => ipcRenderer.invoke('python:check-availability'),
  
  scrapeProduct: (url: string, options?: any) => 
    ipcRenderer.invoke('python:scrape-product', url, options),
  
  batchScrapeProducts: (urls: string[], options?: any) =>
    ipcRenderer.invoke('python:batch-scrape', urls, options),
  
  onScrapeProgress: (callback: (progress: any) => void) => {
    ipcRenderer.on('python:scrape-progress', (event, progress) => callback(progress));
  },
  
  onBatchProgress: (callback: (progress: any) => void) => {
    ipcRenderer.on('python:batch-progress', (event, progress) => callback(progress));
  },
  
  removeScrapeProgressListener: () => {
    ipcRenderer.removeAllListeners('python:scrape-progress');
  },
  
  removeBatchProgressListener: () => {
    ipcRenderer.removeAllListeners('python:batch-progress');
  }
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

### 5.2 Create example component using the hook
**File**: `electron-app/src/renderer/components/ScrapeProductForm.tsx`

```typescript
import React, { useState } from 'react';
import { usePythonScraper } from '../hooks/usePythonScraper';

export function ScrapeProductForm() {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<any>(null);
  const {
    isAvailable,
    pythonStatus,
    isLoading,
    progress,
    error,
    scrapeProduct
  } = usePythonScraper();
  
  const handleScrape = async () => {
    if (!url) return;
    
    const result = await scrapeProduct(url, {
      method: 'auto',
      llm_model: 'gpt-4o-mini'
    });
    
    setResult(result);
  };
  
  if (isAvailable === false) {
    return (
      <div className="error-message">
        <h3>Python Scraper Not Available</h3>
        <p>{pythonStatus?.error || 'Python or required packages not installed'}</p>
        <details>
          <summary>Details</summary>
          <pre>{JSON.stringify(pythonStatus, null, 2)}</pre>
        </details>
      </div>
    );
  }
  
  return (
    <div className="scrape-form">
      <h3>Scrape Product</h3>
      
      <div className="form-group">
        <label>Product URL:</label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/product"
          disabled={isLoading}
        />
      </div>
      
      <button 
        onClick={handleScrape}
        disabled={!url || isLoading || !isAvailable}
      >
        {isLoading ? 'Scraping...' : 'Scrape Product'}
      </button>
      
      {progress && (
        <div className="progress">
          <div className="progress-bar" style={{ width: `${progress.progress}%` }} />
          <p>{progress.stage}: {progress.message}</p>
        </div>
      )}
      
      {error && (
        <div className="error">
          Error: {error}
        </div>
      )}
      
      {result && (
        <div className="result">
          <h4>Result:</h4>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
```

**Validation**:
- [ ] Hook compiles without TypeScript errors
- [ ] Hook correctly manages state
- [ ] Progress updates work
- [ ] Error handling works
- [ ] Component renders correctly

---

## Step 6: Environment Setup & Validation
**Goal**: Ensure Python environment is properly configured

### 6.1 Create setup validation script
**File**: `specscraper/validate_setup.py`

```python
#!/usr/bin/env python3
"""Validate that all required packages are installed for electron_bridge"""

import sys
import subprocess

def check_package(package_name):
    """Check if a package is installed"""
    try:
        __import__(package_name.replace('-', '_'))
        return True, None
    except ImportError as e:
        return False, str(e)

def check_environment():
    """Check all required environment variables"""
    import os
    
    checks = []
    
    # Check OpenAI API key
    if os.getenv('OPENAI_API_KEY'):
        checks.append(('OPENAI_API_KEY', True, 'Set'))
    else:
        checks.append(('OPENAI_API_KEY', False, 'Not set'))
    
    # Check Firecrawl API key (optional)
    if os.getenv('FIRECRAWL_API_KEY'):
        checks.append(('FIRECRAWL_API_KEY', True, 'Set (optional)'))
    else:
        checks.append(('FIRECRAWL_API_KEY', True, 'Not set (optional)'))
    
    return checks

def main():
    print("Python Bridge Setup Validation")
    print("=" * 50)
    
    # Check Python version
    print(f"Python Version: {sys.version}")
    print()
    
    # Required packages (minimal set)
    required_packages = [
        'pydantic',
        'beautifulsoup4', 
        'openai',
        'requests',
        'firecrawl_py',
        'python-dotenv'
    ]
    
    print("Required Packages:")
    all_installed = True
    for package in required_packages:
        installed, error = check_package(package)
        status = "✓" if installed else "✗"
        print(f"  {status} {package}")
        if not installed:
            all_installed = False
            print(f"    Error: {error}")
    
    print()
    print("Environment Variables:")
    env_checks = check_environment()
    all_env_ok = True
    for name, ok, status in env_checks:
        symbol = "✓" if ok else "✗"
        print(f"  {symbol} {name}: {status}")
        if not ok and 'optional' not in status.lower():
            all_env_ok = False
    
    print()
    print("Validation Result:")
    if all_installed and all_env_ok:
        print("✓ All requirements met")
        sys.exit(0)
    else:
        if not all_installed:
            print("✗ Missing required packages")
            print("  Run: pip install -r requirements-minimal.txt")
        if not all_env_ok:
            print("✗ Missing required environment variables")
            print("  Set OPENAI_API_KEY in your .env file")
        sys.exit(1)

if __name__ == "__main__":
    main()
```

### 6.2 Run validation
```bash
cd specscraper
python validate_setup.py
```

**Validation**:
- [ ] All required packages installed
- [ ] OPENAI_API_KEY is set
- [ ] Python version is 3.8+

---

## Step 7: Integration Testing
**Goal**: Test the complete end-to-end integration

### 7.1 Create integration test
**File**: `electron-app/src/main/__tests__/integration/python-integration.test.ts`

```typescript
import { PythonBridge } from '../../services/PythonBridge';

describe('Python Integration', () => {
  let bridge: PythonBridge;
  
  beforeAll(async () => {
    bridge = new PythonBridge();
    const available = await bridge.checkAvailability();
    
    if (!available) {
      console.warn('Python not available, skipping integration tests');
    }
  });
  
  test('End-to-end scraping', async () => {
    const status = bridge.getStatus();
    
    if (!status.available) {
      console.log('Skipping: Python not available');
      return;
    }
    
    const testUrl = 'https://www.example.com/test-product';
    const progressUpdates: any[] = [];
    
    const result = await bridge.scrapeProduct(
      testUrl,
      { method: 'requests' },
      (progress) => {
        progressUpdates.push(progress);
        console.log(`Progress: ${progress.stage} - ${progress.progress}%`);
      }
    );
    
    expect(result).toBeDefined();
    expect(result.success).toBeDefined();
    
    if (result.success) {
      expect(result.data).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(progressUpdates.length).toBeGreaterThan(0);
    } else {
      expect(result.error).toBeDefined();
    }
  }, 60000); // 60 second timeout
});
```

### 7.2 Run integration test
```bash
cd electron-app
npm test -- python-integration
```

**Validation**:
- [ ] Integration test passes
- [ ] Progress updates received
- [ ] Data structure matches expected format

---

## Step 8: Production Considerations
**Goal**: Prepare for production deployment

### 8.1 Bundle size comparison
**Before cleanup (with unused dependencies):**
- Python runtime: ~30MB
- Unused packages (selenium, pandas, numpy, etc.): ~85MB
- Minimal packages: ~15MB
- **Total**: ~130MB

**After cleanup (Option 3):**
- Python runtime: ~30MB
- Minimal packages only: ~15MB
- Scripts and libs: ~5MB
- **Total**: ~50MB (62% reduction)

### 8.2 Production bundle validation
**File**: `electron-app/scripts/validate-bundle.py`

```python
#!/usr/bin/env python3
"""Validate bundled Python environment"""

import sys
import os
import subprocess

def validate_bundle():
    """Test bundled Python environment"""
    
    # Check if we can import all required packages
    required = ['openai', 'requests', 'beautifulsoup4', 'pydantic', 'firecrawl_py', 'python_dotenv']
    
    print("Validating bundled Python environment...")
    print(f"Python executable: {sys.executable}")
    print(f"Python version: {sys.version}")
    
    all_ok = True
    for package in required:
        try:
            __import__(package.replace('-', '_'))
            print(f"✓ {package}")
        except ImportError as e:
            print(f"✗ {package}: {e}")
            all_ok = False
    
    if all_ok:
        print("
✓ All packages available")
        return True
    else:
        print("
✗ Some packages missing")
        return False

if __name__ == "__main__":
    success = validate_bundle()
    sys.exit(0 if success else 1)
```

### 8.2 Add Python detection UI
**File**: `electron-app/src/renderer/components/PythonStatus.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { usePythonScraper } from '../hooks/usePythonScraper';

export function PythonStatus() {
  const { isAvailable, pythonStatus, checkAvailability } = usePythonScraper();
  
  if (isAvailable === null) {
    return <div>Checking Python availability...</div>;
  }
  
  if (!isAvailable) {
    return (
      <div className="python-status error">
        <h3>⚠️ Python Not Available</h3>
        <p>The Python scraping engine is not available.</p>
        <details>
          <summary>Bundle Information</summary>
          <ol>
            <li>Python runtime should be bundled with the application</li>
            <li>If you see this error, the bundle may be corrupted</li>
            <li>Try reinstalling the application</li>
            <li>For development: Run `npm run bundle-python`</li>
          </ol>
        </details>
        <button onClick={checkAvailability}>Check Again</button>
      </div>
    );
  }
  
  return (
    <div className="python-status success">
      ✓ Python scraper ready
    </div>
  );
}
```

**Validation**:
- [ ] Python script bundles with app
- [ ] Status component shows correct state
- [ ] Setup instructions are clear

---

## Testing Checklist

### Unit Tests
- [ ] Python bridge script works standalone
- [ ] Node.js PythonBridge service tests pass
- [ ] React hook tests pass

### Integration Tests
- [ ] Python script callable from Electron
- [ ] Progress updates transmit correctly
- [ ] Error handling works end-to-end
- [ ] Timeout handling works

### Manual Tests
- [ ] Scrape a real product URL
- [ ] Test with invalid URL
- [ ] Test with Python not installed
- [ ] Test with missing packages
- [ ] Test timeout scenario
- [ ] Test batch scraping

### Performance Tests
- [ ] Single scrape < 30 seconds
- [ ] Memory usage reasonable
- [ ] No process leaks

---

## Troubleshooting Guide

### Common Issues

1. **Python not found**
   - Ensure Python 3.8+ is installed
   - Check PATH environment variable
   - Set PYTHON_PATH environment variable if needed

2. **Import errors**
   - Run: `pip install -r requirements.txt` in specscraper directory
   - Ensure running from correct directory

3. **OPENAI_API_KEY not set**
   - Create `.env` file in specscraper directory
   - Add: `OPENAI_API_KEY=your-key-here`

4. **Timeout errors**
   - Check network connectivity
   - Verify target website is accessible
   - Increase timeout in PythonBridge.ts

5. **JSON parsing errors**
   - Check Python script output format
   - Ensure no print statements pollute stdout
   - Verify LLM response format

---

## Next Steps

After completing this implementation:

1. **Optimize Performance**
   - Implement caching for repeated URLs
   - Add request queuing for batch operations
   - Optimize HTML processing

2. **Enhance Error Handling**
   - Add retry logic for transient failures
   - Improve error messages for users
   - Add telemetry for debugging

3. **Add Features**
   - Support for multiple LLM providers
   - Custom extraction templates
   - Export functionality

4. **Security**
   - Validate URLs before scraping
   - Implement rate limiting
   - Sanitize LLM responses

---

## Conclusion

This **Option 3: Minimal Core + Cloud Fallback** implementation provides a lightweight, cross-platform integration between the Electron desktop app and the Python specscraper backend. Key benefits:

### ✅ Advantages Achieved:
- **Lightweight bundle**: ~50MB vs ~130MB (62% reduction)
- **No browser dependencies**: Eliminated Chrome/Selenium complexity
- **Cross-platform compatibility**: Works on Windows, macOS, Linux
- **Self-contained**: No Python installation required
- **Robust fallback**: requests → Firecrawl API for difficult sites
- **Fast startup**: No browser initialization overhead
- **Easy deployment**: Single installer includes everything

### 🔄 Trade-offs:
- **API costs**: Firecrawl usage when requests fails (typically 10-20% of requests)
- **JavaScript limitations**: Cannot handle heavy JS-rendered content (falls back to Firecrawl)
- **Bundle size**: Still ~50MB for Python runtime (but much smaller than alternatives)

### 🎯 Perfect For:
- **Most e-commerce sites**: Work great with requests-based scraping
- **Desktop application distribution**: No complex setup required
- **Corporate environments**: No Chrome installation/permissions issues
- **End users**: Just works out of the box

This approach successfully balances functionality, performance, and user experience while eliminating the complexity of browser automation.
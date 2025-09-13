# Phase 5: Python Integration Implementation Guide

## Overview
This document provides step-by-step instructions for integrating the Python specscraper backend with the Electron desktop application. The integration uses a CLI-based approach where the Electron app spawns Python processes to perform scraping tasks.

## Architecture Summary
- **Communication**: JSON via stdin/stdout
- **Progress Updates**: JSON via stderr  
- **Error Handling**: Structured JSON responses
- **Process Model**: Spawn per request (stateless)

---

## Step 1: Create Python Bridge Script
**Goal**: Create the main Python script that serves as the bridge between Electron and specscraper

### 1.1 Create the bridge script
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
logging.getLogger('selenium').setLevel(logging.ERROR)

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
                - method: "auto" | "requests" | "selenium" | "firecrawl"
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

## Step 2: Create Test Script for Development
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
  method?: 'auto' | 'requests' | 'selenium' | 'firecrawl';
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

export class PythonBridge {
  private pythonPath: string;
  private scriptPath: string;
  private isAvailable: boolean = false;
  private lastError: string | null = null;
  
  constructor() {
    // Default to python3, can be overridden
    this.pythonPath = process.env.PYTHON_PATH || 'python3';
    
    // Determine script path based on environment
    const isDev = !app.isPackaged;
    if (isDev) {
      // Development: script is in sibling directory
      this.scriptPath = path.join(__dirname, '../../../../specscraper/electron_bridge.py');
    } else {
      // Production: script bundled with app
      this.scriptPath = path.join(process.resourcesPath, 'specscraper', 'electron_bridge.py');
    }
  }
  
  /**
   * Check if Python and the bridge script are available
   */
  async checkAvailability(): Promise<boolean> {
    try {
      // Check if Python is installed
      const pythonVersion = await this.getPythonVersion();
      if (!pythonVersion) {
        this.lastError = 'Python not found';
        this.isAvailable = false;
        return false;
      }
      
      // Check if script exists
      await fs.access(this.scriptPath, fs.constants.R_OK);
      
      // Check if required packages are installed
      const packagesOk = await this.checkRequiredPackages();
      if (!packagesOk) {
        this.lastError = 'Required Python packages not installed';
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
   * Get Python version
   */
  private async getPythonVersion(): Promise<string | null> {
    return new Promise((resolve) => {
      const child = spawn(this.pythonPath, ['--version']);
      let output = '';
      
      child.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        output += data.toString();
      });
      
      child.on('close', (code) => {
        if (code === 0 && output.includes('Python')) {
          resolve(output.trim());
        } else {
          resolve(null);
        }
      });
      
      child.on('error', () => {
        resolve(null);
      });
    });
  }
  
  /**
   * Check if required Python packages are installed
   */
  private async checkRequiredPackages(): Promise<boolean> {
    const requiredPackages = ['openai', 'beautifulsoup4', 'pydantic', 'requests'];
    
    return new Promise((resolve) => {
      const checkScript = `
import sys
try:
    ${requiredPackages.map(pkg => `    import ${pkg.replace('-', '_').split('[')[0]}`).join('\n')}
    print("OK")
except ImportError as e:
    print(f"Missing: {e}", file=sys.stderr)
    sys.exit(1)
`;
      
      const child = spawn(this.pythonPath, ['-c', checkScript]);
      
      child.on('close', (code) => {
        resolve(code === 0);
      });
      
      child.on('error', () => {
        resolve(false);
      });
    });
  }
  
  /**
   * Scrape a product URL using the Python bridge
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
      const child = spawn(this.pythonPath, [this.scriptPath], {
        cwd: path.dirname(this.scriptPath)
      });
      
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
    
    # Required packages
    required_packages = [
        'pydantic',
        'beautifulsoup4',
        'openai',
        'requests',
        'selenium',
        'undetected-chromedriver',
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
            print("  Run: pip install -r requirements.txt")
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

### 8.1 Bundle Python script with Electron app
**File**: `electron-app/package.json` (modify)

```json
{
  "build": {
    "extraResources": [
      {
        "from": "../specscraper",
        "to": "specscraper",
        "filter": [
          "electron_bridge.py",
          "lib/**/*.py",
          "requirements.txt"
        ]
      }
    ]
  }
}
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
          <summary>Setup Instructions</summary>
          <ol>
            <li>Install Python 3.8 or later</li>
            <li>Navigate to the specscraper directory</li>
            <li>Run: pip install -r requirements.txt</li>
            <li>Set OPENAI_API_KEY environment variable</li>
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

This implementation provides a robust, testable integration between the Electron desktop app and the Python specscraper backend. Each step can be independently verified, and the system is designed to handle errors gracefully while providing clear feedback to users.
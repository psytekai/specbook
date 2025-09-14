import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
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
export function runBridge(args: string[] = [], opts: any = {}): ChildProcess {
  const bridgeExecutable = bridgePath();
  
  // Optional: Check if executable exists in dev mode
  if (!app.isPackaged && !fsSync.existsSync(bridgeExecutable)) {
    console.warn(`Bridge executable not found at ${bridgeExecutable}. Run 'npm run bundle-python' first.`);
  }
  
  return spawn(bridgeExecutable, args, { 
    stdio: ["pipe", "pipe", "pipe"], 
    windowsHide: true, 
    ...opts 
  });
}

export class PythonBridge {
  private isAvailable: boolean = false;
  private lastError: string | null = null;
  private activeProcesses = new Set<ChildProcess>();
  private readonly MAX_CONCURRENT_PROCESSES = 3;
  private queue: Array<() => void> = [];
  private availabilityCache: { 
    checked: number; 
    available: boolean; 
    error: string | null;
  } | null = null;
  private readonly CACHE_DURATION = 3.6e+6; // 1 hours
  
  /**
   * Wait for an available process slot
   */
  private async waitForSlot(): Promise<void> {
    if (this.activeProcesses.size < this.MAX_CONCURRENT_PROCESSES) {
      return;
    }
    
    return new Promise(resolve => {
      this.queue.push(resolve);
    });
  }
  
  /**
   * Release a process slot and process queue
   */
  private releaseSlot(process: ChildProcess): void {
    this.activeProcesses.delete(process);
    const next = this.queue.shift();
    if (next) next();
  }
  
  /**
   * Validate URL for security
   */
  private validateUrl(url: string): { valid: boolean; error?: string } {
    try {
      const parsed = new URL(url);
      
      // Only allow http/https
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return { valid: false, error: 'Only HTTP/HTTPS URLs allowed' };
      }
      
      // Block local/private networks
      const hostname = parsed.hostname.toLowerCase();
      if (hostname === 'localhost' || 
          hostname === '127.0.0.1' ||
          hostname.startsWith('192.168.') ||
          hostname.startsWith('10.') ||
          hostname.match(/^172\.(1[6-9]|2[0-9]|3[01])\./)) {
        return { valid: false, error: 'Local network URLs not allowed' };
      }
      
      return { valid: true };
    } catch {
      return { valid: false, error: 'Invalid URL format' };
    }
  }
  
  /**
   * Sanitize options object
   */
  private sanitizeOptions(options: any): ScrapeOptions {
    const sanitized: ScrapeOptions = {};
    
    // Whitelist allowed options
    if (options?.method && ['auto', 'requests', 'firecrawl'].includes(options.method)) {
      sanitized.method = options.method;
    }
    
    if (options?.llm_model && typeof options.llm_model === 'string') {
      sanitized.llm_model = options.llm_model.substring(0, 100); // Limit length
    }
    
    if (options?.temperature && typeof options.temperature === 'number') {
      sanitized.temperature = Math.max(0, Math.min(2, options.temperature));
    }
    
    if (options?.max_tokens && typeof options.max_tokens === 'number') {
      sanitized.max_tokens = Math.max(1, Math.min(4000, options.max_tokens));
    }
    
    return sanitized;
  }
  
  /**
   * Check if the PyInstaller bridge executable is available
   */
  async checkAvailability(): Promise<boolean> {
    const now = Date.now();
    
    // Use cached result if fresh
    if (this.availabilityCache && 
        (now - this.availabilityCache.checked) < this.CACHE_DURATION) {
      this.isAvailable = this.availabilityCache.available;
      this.lastError = this.availabilityCache.error;
      return this.availabilityCache.available;
    }
    
    try {
      const executablePath = bridgePath();
      
      // Check if executable exists
      await fs.access(executablePath, fs.constants.R_OK);
      
      // Test if executable runs (basic health check)
      const testResult = await this.testBridge();
      if (!testResult.success) {
        this.lastError = `Bridge executable failed health check: ${testResult.error}`;
        this.isAvailable = false;
      } else {
        this.isAvailable = true;
        this.lastError = null;
      }
    } catch (error) {
      this.lastError = `Bridge not available at ${bridgePath()}: ${error}`;
      this.isAvailable = false;
    }
    
    // Update cache
    this.availabilityCache = {
      checked: now,
      available: this.isAvailable,
      error: this.lastError
    };
    
    return this.isAvailable;
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
      
      child.stdout!.on('data', (data) => {
        output += data.toString();
      });
      
      child.stderr!.on('data', (data) => {
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
      child.stdin!.write(testInput);
      child.stdin!.end();
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
    // Validate URL first
    const urlValidation = this.validateUrl(url);
    if (!urlValidation.valid) {
      return {
        success: false,
        data: null,
        metadata: {},
        error: `Invalid URL: ${urlValidation.error}`
      };
    }
    
    // Sanitize options
    const sanitizedOptions = this.sanitizeOptions(options);
    
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
    
    return new Promise(async (resolve) => {
      // Wait for available process slot
      await this.waitForSlot();
      
      const child = runBridge();
      this.activeProcesses.add(child);
      
      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      let timeout: NodeJS.Timeout;
      let outputSize = 0;
      const MAX_OUTPUT_SIZE = 10 * 1024 * 1024; // 10MB
      
      // Cleanup function
      const cleanup = () => {
        child.stdout?.removeAllListeners();
        child.stderr?.removeAllListeners();
        child.removeAllListeners();
        clearTimeout(timeout);
        this.releaseSlot(child);
      };
      
      // Set timeout (2 minutes) with proper cleanup
      timeout = setTimeout(() => {
        cleanup();
        if (!child.killed) {
          child.kill('SIGTERM');
          // Force kill after grace period
          setTimeout(() => {
            if (!child.killed) {
              child.kill('SIGKILL');
            }
          }, 5000);
        }
        resolve({
          success: false,
          data: null,
          metadata: {},
          error: 'Scraping timeout (120 seconds)'
        });
      }, 120000);
      
      // Send input with error handling
      const input = JSON.stringify({ url, options: sanitizedOptions });
      
      if (!child.stdin) {
        cleanup();
        resolve({
          success: false,
          data: null,
          metadata: {},
          error: 'Process stdin not available'
        });
        return;
      }
      
      try {
        child.stdin.write(input);
        child.stdin.end();
      } catch (error) {
        cleanup();
        resolve({
          success: false,
          data: null,
          metadata: {},
          error: `Failed to write to process: ${error}`
        });
        return;
      }
      
      // Capture stdout with size limit
      child.stdout!.on('data', (data: Buffer) => {
        outputSize += data.length;
        if (outputSize > MAX_OUTPUT_SIZE) {
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
      
      // Capture and parse stderr for progress updates
      child.stderr!.on('data', (data: Buffer) => {
        stderrChunks.push(data);
        const lines = data.toString().split('\n').filter(Boolean);
        lines.forEach((line: string) => {
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
        cleanup();
        
        if (code === null) {
          // Process was killed (timeout already handled)
          return;
        }
        
        try {
          const stdout = Buffer.concat(stdoutChunks).toString();
          const result = JSON.parse(stdout) as ScrapeResult;
          resolve(result);
        } catch (e) {
          // Failed to parse output
          const stdout = Buffer.concat(stdoutChunks).toString();
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
        cleanup();
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
  getStatus(): { available: boolean; error: string | null; bridgePath: string } {
    return {
      available: this.isAvailable,
      error: this.lastError,
      bridgePath: bridgePath()
    };
  }
  
  /**
   * Graceful shutdown - kill all active processes
   */
  async shutdown(): Promise<void> {
    // Clear the queue
    this.queue = [];
    
    // Kill all active processes
    const killPromises = Array.from(this.activeProcesses).map(process => 
      new Promise<void>(resolve => {
        if (process.killed) {
          resolve();
          return;
        }
        
        process.once('exit', () => resolve());
        process.kill('SIGTERM');
        
        // Force kill after grace period
        setTimeout(() => {
          if (!process.killed) {
            process.kill('SIGKILL');
          }
        }, 5000);
      })
    );
    
    // Wait for all processes to exit
    await Promise.all(killPromises);
    
    this.activeProcesses.clear();
  }
}

// Export singleton instance
export const pythonBridge = new PythonBridge();
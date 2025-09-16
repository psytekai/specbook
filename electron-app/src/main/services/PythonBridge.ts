// PythonBridge.ts
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

export interface StructuredLogEvent {
  schema: string;
  ts: string;
  event_id: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  component: string;
  message: string;
  ctx?: Record<string, any>;
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
    partial_output?: string;
    [key: string]: any;
  };
  error: string | null;
  diagnostics?: StructuredLogEvent[];
}

/* -----------------------------
   Executable path resolution
------------------------------ */
function bridgePath(): string {
  const base = app.isPackaged ? process.resourcesPath : path.join(process.cwd(), 'dist');
  const exe = process.platform === 'win32' ? 'electron_bridge.exe' : 'electron_bridge';

  // Try common packaged layouts
  const candidates = [
    path.join(base, 'python', 'electron_bridge', exe), // resources/python/electron_bridge/...
    path.join(base, 'dist', 'electron_bridge', exe),   // resources/dist/electron_bridge/...
    path.join(base, 'electron_bridge', exe),           // resources/electron_bridge/...
  ];

  const chosen = candidates.find(p => fsSync.existsSync(p)) ?? candidates[0];
  // Log once for diagnostics
  try { console.log('[Bridge] executable:', chosen); } catch {}

  return chosen;
}

/* -----------------------------
   Spawning helper
------------------------------ */
export function runBridge(args: string[] = [], opts: any = {}): ChildProcess {
  const bridgeExecutable = bridgePath();

  if (!app.isPackaged && !fsSync.existsSync(bridgeExecutable)) {
    console.warn(`Bridge executable not found at ${bridgeExecutable}. Run 'npm run bundle-python' first.`);
  }

  return spawn(bridgeExecutable, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
    shell: false,
    env: { ...process.env },
    ...opts,
  });
}

/* -----------------------------
   Utilities
------------------------------ */
function writeJsonLine(child: ChildProcess, obj: unknown) {
  const line = JSON.stringify(obj) + '\n'; // newline-framed
  if (!child.stdin) throw new Error('Process stdin not available');
  child.stdin.write(line);
  child.stdin.end(); // harmless even with readline-based bridge
}

function parseStructuredLine(line: string): StructuredLogEvent | null {
  try {
    return JSON.parse(line.replace(/\r$/, '')) as StructuredLogEvent; // strip CR if present
  } catch {
    return null;
  }
}

/* -----------------------------
   Python Bridge class
------------------------------ */
export class PythonBridge {
  private isAvailable = false;
  private lastError: string | null = null;
  private activeProcesses = new Set<ChildProcess>();
  private readonly MAX_CONCURRENT_PROCESSES = 3;
  private queue: Array<() => void> = [];
  private availabilityCache:
    | { checked: number; available: boolean; error: string | null }
    | null = null;
  private readonly CACHE_DURATION = 30000; // 30s

  /* -----------------------------
     Slots
  ------------------------------ */
  private async waitForSlot(): Promise<void> {
    if (this.activeProcesses.size < this.MAX_CONCURRENT_PROCESSES) return;
    return new Promise(resolve => this.queue.push(resolve));
  }

  private releaseSlot(proc: ChildProcess): void {
    this.activeProcesses.delete(proc);
    const next = this.queue.shift();
    if (next) next();
  }

  /* -----------------------------
     URL + options hygiene
  ------------------------------ */
  private validateUrl(url: string): { valid: boolean; error?: string } {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return { valid: false, error: 'Only HTTP/HTTPS URLs allowed' };
      }
      const hostname = parsed.hostname.toLowerCase();
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.match(/^172\.(1[6-9]|2[0-9]|3[01])\./)
      ) {
        return { valid: false, error: 'Local network URLs not allowed' };
      }
      return { valid: true };
    } catch {
      return { valid: false, error: 'Invalid URL format' };
    }
  }

  private sanitizeOptions(options: any): ScrapeOptions {
    const sanitized: ScrapeOptions = {};
    if (options?.method && ['auto', 'requests', 'firecrawl'].includes(options.method)) {
      sanitized.method = options.method;
    }
    if (options?.llm_model && typeof options.llm_model === 'string') {
      sanitized.llm_model = options.llm_model.substring(0, 100);
    }
    if (typeof options?.temperature === 'number') {
      sanitized.temperature = Math.max(0, Math.min(2, options.temperature));
    }
    if (typeof options?.max_tokens === 'number') {
      sanitized.max_tokens = Math.max(1, Math.min(4000, options.max_tokens));
    }
    return sanitized;
  }

  /* -----------------------------
     Availability / Health
  ------------------------------ */
  async checkAvailability(): Promise<boolean> {
    const now = Date.now();
    if (this.availabilityCache && now - this.availabilityCache.checked < this.CACHE_DURATION) {
      this.isAvailable = this.availabilityCache.available;
      this.lastError = this.availabilityCache.error;
      return this.availabilityCache.available;
    }

    try {
      const executablePath = bridgePath();
      await fs.access(executablePath, fs.constants.R_OK);

      const testResult = await this.testBridge();
      this.isAvailable = testResult.success;
      this.lastError = testResult.error ?? null;
    } catch (error) {
      this.isAvailable = false;
      this.lastError = `Bridge not available at ${bridgePath()}: ${error}`;
    }

    this.availabilityCache = {
      checked: now,
      available: this.isAvailable,
      error: this.lastError,
    };
    return this.isAvailable;
  }

  /**
   * Network-independent health check.
   * We only verify that:
   *  - the process starts,
   *  - it can read a newline-framed payload,
   *  - it emits any structured stderr log line OR valid stdout JSON,
   *  - and then exits (code may be 0 or 1).
   */
  private async testBridge(): Promise<{ success: boolean; error?: string }> {
    return new Promise(resolve => {
      const child = runBridge();
      let out = '';
      let stderrSize = 0;
      const MAX_STDERR_SIZE = 256 * 1024;
      let stderrBuf = '';
      let sawStructuredLog = false;

      // Minimal payload (URL value is irrelevant; we just exercise I/O path)
      // Newline-framed so bridge readline() returns even if stdin isn't explicitly ended elsewhere.
      const payload = { url: 'https://example.com', options: { method: 'requests' } };

      child.stdout?.on('data', c => (out += c.toString('utf8')));

      child.stderr?.on('data', (data: Buffer) => {
        stderrSize += data.length;
        if (stderrSize > MAX_STDERR_SIZE) return;

        stderrBuf += data.toString('utf8');
        let idx: number;
        while ((idx = stderrBuf.indexOf('\n')) >= 0) {
          const line = stderrBuf.slice(0, idx).replace(/\r$/, '');
          stderrBuf = stderrBuf.slice(idx + 1);
          if (!line) continue;
          const evt = parseStructuredLine(line);
          if (evt) sawStructuredLog = true;
        }
      });

      child.on('error', err => {
        resolve({ success: false, error: `Process error: ${err.message}` });
      });

      child.on('close', () => {
        // Consider bridge "available" if it either produced valid stdout JSON
        // OR at least one structured stderr line (proves it ran and read input).
        let ok = false;
        try {
          if (out.trim()) {
            const parsed = JSON.parse(out);
            ok = parsed && typeof parsed === 'object';
          }
        } catch {
          // ignore
        }
        if (!ok && sawStructuredLog) ok = true;

        resolve(ok ? { success: true } : { success: false, error: 'No structured output detected' });
      });

      try {
        writeJsonLine(child, payload);
      } catch (e: any) {
        resolve({ success: false, error: `Failed to write to process: ${e?.message || e}` });
      }
    });
  }

  /* -----------------------------
     Public scrape API
  ------------------------------ */
  async scrapeProduct(
    url: string,
    options: ScrapeOptions = {},
    onProgress?: (progress: ScrapeProgress) => void
  ): Promise<ScrapeResult> {
    const urlValidation = this.validateUrl(url);
    if (!urlValidation.valid) {
      return { success: false, data: null, metadata: {}, error: `Invalid URL: ${urlValidation.error}` };
    }

    const sanitizedOptions = this.sanitizeOptions(options);

    if (!this.isAvailable) {
      await this.checkAvailability();
      if (!this.isAvailable) {
        return { success: false, data: null, metadata: {}, error: this.lastError || 'Python bridge not available' };
      }
    }

    return new Promise(async resolve => {
      await this.waitForSlot();
      const child = runBridge();
      this.activeProcesses.add(child);

      const stdoutChunks: Buffer[] = [];
      let stderrSize = 0;
      const MAX_STDOUT_SIZE = 10 * 1024 * 1024; // 10MB
      const MAX_STDERR_SIZE = 1024 * 1024; // 1MB
      let stdoutSize = 0;
      let timeout: NodeJS.Timeout;

      // Buffered stderr line parsing (handles CRLF + chunk splits)
      let stderrBuf = '';
      const diagnosticLogs: StructuredLogEvent[] = [];

      const cleanup = () => {
        child.stdout?.removeAllListeners();
        child.stderr?.removeAllListeners();
        child.removeAllListeners();
        clearTimeout(timeout);
        this.releaseSlot(child);
      };

      // 2-minute guard
      timeout = setTimeout(() => {
        cleanup();
        if (!child.killed) {
          child.kill('SIGTERM');
          setTimeout(() => {
            if (!child.killed) child.kill('SIGKILL');
          }, 5000);
        }
        resolve({
          success: false,
          data: null,
          metadata: {},
          error: 'Scraping timeout (120 seconds)',
          diagnostics: diagnosticLogs,
        });
      }, 120000);

      // Send input
      try {
        writeJsonLine(child, { url, options: sanitizedOptions });
      } catch (error) {
        cleanup();
        resolve({
          success: false,
          data: null,
          metadata: {},
          error: `Failed to write to process: ${error}`,
          diagnostics: diagnosticLogs,
        });
        return;
      }

      // stdout: single compact JSON on success
      child.stdout!.on('data', (data: Buffer) => {
        stdoutSize += data.length;
        if (stdoutSize > MAX_STDOUT_SIZE) {
          cleanup();
          child.kill();
          resolve({
            success: false,
            data: null,
            metadata: {},
            error: 'Output size exceeded 10MB limit',
            diagnostics: diagnosticLogs,
          });
          return;
        }
        stdoutChunks.push(data);
      });

      // stderr: structured logs line-by-line
      child.stderr!.on('data', (data: Buffer) => {
        stderrSize += data.length;
        if (stderrSize > MAX_STDERR_SIZE) return;

        stderrBuf += data.toString('utf8');

        let idx: number;
        while ((idx = stderrBuf.indexOf('\n')) >= 0) {
          const line = stderrBuf.slice(0, idx).replace(/\r$/, '');
          stderrBuf = stderrBuf.slice(idx + 1);
          if (!line) continue;

          const event = parseStructuredLine(line);
          if (event) {
            diagnosticLogs.push(event);
            if (event.ctx?.type === 'progress' && onProgress) {
              onProgress({
                type: 'progress',
                stage: event.ctx.stage,
                progress: event.ctx.progress,
                message: event.message,
                timestamp: Date.now(),
              });
            }
          }
        }
      });

      // exit
      child.on('close', (code) => {
        cleanup();
        if (code === null) return;

        try {
          const stdout = Buffer.concat(stdoutChunks).toString('utf8');
          if (!stdout.trim()) {
            resolve({
              success: false,
              data: null,
              metadata: {},
              error: 'No output received from Python process',
              diagnostics: diagnosticLogs,
            });
            return;
          }
          const result = JSON.parse(stdout) as ScrapeResult;
          result.diagnostics = diagnosticLogs;
          resolve(result);
        } catch (e) {
          const stdout = Buffer.concat(stdoutChunks).toString('utf8');
          if (stdout.trim().startsWith('{') && !stdout.includes('}')) {
            resolve({
              success: false,
              data: null,
              metadata: { partial_output: stdout.slice(0, 500) },
              error: 'Process terminated unexpectedly (partial output detected)',
              diagnostics: diagnosticLogs,
            });
          } else {
            resolve({
              success: false,
              data: null,
              metadata: {},
              error: `Failed to parse output: ${e}. stdout: ${stdout.slice(0, 200)}`,
              diagnostics: diagnosticLogs,
            });
          }
        }
      });

      child.on('error', error => {
        cleanup();
        resolve({
          success: false,
          data: null,
          metadata: {},
          error: `Process error: ${error.message}`,
          diagnostics: diagnosticLogs,
        });
      });
    });
  }

  /* -----------------------------
     Status + shutdown
  ------------------------------ */
  getStatus(): { available: boolean; error: string | null; bridgePath: string } {
    return { available: this.isAvailable, error: this.lastError, bridgePath: bridgePath() };
  }

  async shutdown(): Promise<void> {
    this.queue = [];
    const killPromises = Array.from(this.activeProcesses).map(proc => new Promise<void>(resolve => {
      if (proc.killed) return resolve();
      proc.once('exit', () => resolve());
      proc.kill('SIGTERM');
      setTimeout(() => { if (!proc.killed) proc.kill('SIGKILL'); }, 5000);
    }));
    await Promise.all(killPromises);
    this.activeProcesses.clear();
  }
}

/* Export singleton */
export const pythonBridge = new PythonBridge();

// PythonBridge.ts
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import { app } from 'electron';
import * as os from 'os';
import { ProjectState } from './ProjectState';
import { logger } from '../../shared/logging/Logger';

var log = logger.for('PythonBridge');

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
  const base = app.isPackaged
    ? path.join(process.resourcesPath)
    : path.join(app.getAppPath(), 'resources');
    
  const exe = process.platform === 'win32' ? 'electron_bridge.exe' : 'electron_bridge';
  
  // For development on Windows, check for prebuilt executable
  if (!app.isPackaged && process.platform === 'win32') {
    const prebuilt = path.join(app.getAppPath(), 'electron_bridge-win-x64', exe);
    if (fsSync.existsSync(prebuilt)) {
      log.info('[Bridge] Using prebuilt Windows executable:', { prebuilt });
      return prebuilt;
    }
  }

  // Try common packaged layouts
  const candidates = [
    path.join(base, 'python', 'electron_bridge', exe), // resources/python/electron_bridge/...
    path.join(base, 'dist', 'electron_bridge', exe),   // resources/dist/electron_bridge/...
    path.join(base, 'electron_bridge', exe),           // resources/electron_bridge/...
  ];

  const chosen = candidates.find(p => fsSync.existsSync(p)) ?? candidates[0];
  
  // Enhanced diagnostics for debugging
  log.info('[Bridge] Debug info:', {
    platform: process.platform,
    isPackaged: app.isPackaged,
    candidates: candidates,
    exists: candidates.map(p => ({ path: p, exists: fsSync.existsSync(p) })),
    chosen: chosen,
    chosenExists: fsSync.existsSync(chosen)
  });

  return chosen;
}

/* -----------------------------
   Spawning helper
------------------------------ */
export function runBridge(args: string[] = [], opts: any = {}): ChildProcess {
  const bridgeExecutable = bridgePath();
  
  log.info('[Bridge] Attempting to spawn:', {
    executable: bridgeExecutable,
    args: args,
    env: opts?.env ? Object.keys(opts.env) : 'none'
  });

  if (!app.isPackaged && !fsSync.existsSync(bridgeExecutable)) {
    console.warn(`Bridge executable not found at ${bridgeExecutable}. Run 'npm run bundle-python' first.`);
  }

  const mergedEnv = {
    ...process.env,
    // Force unbuffered output and UTF-8 everywhere
    PYTHONUNBUFFERED: '1',
    PYTHONIOENCODING: 'utf-8',
    ...(opts?.env || {}),
  } as NodeJS.ProcessEnv;

  const spawnOptions = {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
    shell: false,
    ...opts,
    env: mergedEnv,
  } as const;

  return spawn(bridgeExecutable, args, spawnOptions);
}

/* -----------------------------
   Utilities
------------------------------ */
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
     Log file path helper
  ------------------------------ */
  private getProjectLogFilePath(prefix: string = 'python_bridge'):
    string {
    try {
      const projectPath = ProjectState.getInstance().currentFilePath;
      const stamp = new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .replace('T', '_')
        .replace('Z', 'Z');
      if (projectPath) {
        const dir = path.join(projectPath, '.metadata', 'logs');
        return path.join(dir, `${prefix}_${stamp}.log`);
      }
    } catch {}
    return path.join(os.tmpdir(), 'specbridge', `${prefix}_${Date.now()}.log`);
  }

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
      log.info('[Bridge] testBridge environment check:', {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET',
        FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY ? 'SET' : 'NOT SET'
      });
      const child = runBridge([], { env: {
        SPEC_BRIDGE_PAYLOAD: JSON.stringify({ url: 'https://www.homedepot.com/p/DEWALT-20V-MAX-Cordless-Drill-Driver-Kit-DCD771C2/204279858', options: { method: 'requests' } }),
        SPEC_BRIDGE_LOG_FILE: this.getProjectLogFilePath('diagnostic')
      } });
      let out = '';
      let stderrSize = 0;
      const MAX_STDERR_SIZE = 256 * 1024;
      let stderrBuf = '';
      let sawStructuredLog = false;



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

      // No stdin write needed when using SPEC_BRIDGE_PAYLOAD
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
      // Prepare payload and send via environment to avoid stdin edge cases on Windows
      const payload = JSON.stringify({ url, options: sanitizedOptions });
      // Log environment status for debugging
      log.info('[Bridge] Environment check before spawn:', {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET',
        FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY ? 'SET' : 'NOT SET'
      });
      const child = runBridge([], { env: { SPEC_BRIDGE_PAYLOAD: payload } });
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
          // Windows doesn't support POSIX signals properly
          if (process.platform === 'win32') {
            child.kill();  // Default signal works on Windows
          } else {
            child.kill('SIGTERM');
          }
          setTimeout(() => {
            if (!child.killed) {
              if (process.platform === 'win32') {
                child.kill();  // Force kill on Windows
              } else {
                child.kill('SIGKILL');
              }
            }
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

      // No stdin write needed when using SPEC_BRIDGE_PAYLOAD

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
            // Enhanced debugging for Windows
            const debugInfo = {
              platform: process.platform,
              executablePath: bridgePath(),
              exitCode: code,
              stderrSize: stderrSize,
              stdoutSize: stdoutSize,
              diagnosticCount: diagnosticLogs.length,
              lastDiagnostic: diagnosticLogs[diagnosticLogs.length - 1] || null
            };
            
            resolve({
              success: false,
              data: null,
              metadata: { debug_info: debugInfo },
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
        log.error('[Bridge] Process spawn error:', {
          message: error.message,
          code: (error as any).code,
          syscall: (error as any).syscall,
          path: (error as any).path,
          spawnargs: (error as any).spawnargs,
          executable: bridgePath()
        });
        resolve({
          success: false,
          data: null,
          metadata: {
            spawn_error: {
              message: error.message,
              code: (error as any).code,
              syscall: (error as any).syscall,
              path: (error as any).path
            }
          },
          error: `Process error: ${error.message} (${(error as any).code || 'unknown'})`,
          diagnostics: diagnosticLogs,
        });
      });
    });
  }

  /* -----------------------------
     Diagnostic test function
  ------------------------------ */
  // Diagnostics removed

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
      // Windows doesn't support POSIX signals properly
      if (process.platform === 'win32') {
        proc.kill();  // Default signal works on Windows
      } else {
        proc.kill('SIGTERM');
        setTimeout(() => { 
          if (!proc.killed) proc.kill('SIGKILL'); 
        }, 5000);
      }
    }));
    await Promise.all(killPromises);
    this.activeProcesses.clear();
  }
}

/* Export singleton */
export const pythonBridge = new PythonBridge();

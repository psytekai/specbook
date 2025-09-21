// electron-app/src/shared/logging/Logger.ts
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { EOL } from 'os';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEvent {
  schema: 'v1';
  ts: string;               // ISO8601
  event_id: number;         // monotonic per-process
  level: LogLevel;
  component: string;        // required (explicit > brittle caller parsing)
  message: string;
  ctx?: Record<string, any>;
  pid?: number;             // added for multi-proc clarity
  source?: 'node' | 'python' | 'unknown';
}

type Destination = 'file' | 'console' | 'both';

class StructuredLogger {
  private eventCounter = 0;
  private stream: fs.WriteStream | null = null;
  private destination: Destination = (process.env.LOG_DEST as Destination) || 'both';
  private levelThreshold: LogLevel =
    (process.env.LOG_LEVEL as LogLevel) || (process.env.NODE_ENV === 'development' ? 'debug' : 'info');

  private logFileDir!: string;
  private logFilePath!: string;
  private rotatingByDate = true; // daily file name; easy rotation

  // Simple level ranking
  private ranks: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

  init(appName?: string) {
    // 1) Choose a stable, app-specific directory the OS expects
    // Electron gives an official logs dir:
    // macOS: ~/Library/Logs/<App Name>
    // Windows: %APPDATA%\<App Name>\logs
    // Linux: ~/.config/<App Name>/logs
    const logsDir = app.getPath('logs'); // reliable cross-platform
    const name = appName || app.getName();

    // 2) Ensure directory exists
    this.logFileDir = path.join(logsDir);
    fs.mkdirSync(this.logFileDir, { recursive: true });

    // 3) Daily rotating file name
    const stamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    this.logFilePath = path.join(this.logFileDir, `${name}-${stamp}.log`);

    // 4) Append-only, non-blocking stream
    this.stream = fs.createWriteStream(this.logFilePath, { flags: 'a' });

    // Flush on exit
    const flush = () => {
      if (this.stream) {
        try { this.stream.end(); } catch {}
      }
    };
    process.on('beforeExit', flush);
    process.on('exit', flush);
    process.on('SIGINT', () => { flush(); process.exit(0); });
    process.on('SIGTERM', () => { flush(); process.exit(0); });
  }

  getLogFilePath() { return this.logFilePath; }
  getLogDir() { return this.logFileDir; }

  setDestination(dest: Destination) { this.destination = dest; }
  setLevel(level: LogLevel) { this.levelThreshold = level; }

  // Used when piping child JSON log events directly
  writeRaw(event: Partial<LogEvent>) {
    const filled: LogEvent = {
      schema: 'v1',
      ts: new Date().toISOString(),
      event_id: ++this.eventCounter,
      level: (event.level ?? 'info') as LogLevel,
      component: event.component ?? 'Unknown',
      message: event.message ?? '',
      ctx: event.ctx,
      pid: event.pid ?? process.pid,
      source: event.source ?? 'unknown',
    };
    this.emit(filled);
  }

  private emit(ev: LogEvent) {
    // Respect level threshold
    if (this.ranks[ev.level] < this.ranks[this.levelThreshold]) return;

    const line = JSON.stringify(ev) + EOL;

    if ((this.destination === 'file' || this.destination === 'both') && this.stream) {
      // If backpressure builds, drop (or buffer) — here we choose to drop to protect the app.
      if (!this.stream.write(line)) {
        // Could implement a bounded queue if you prefer buffering
      }
    }

    if (this.destination === 'console' || this.destination === 'both') {
      const fn = ev.level === 'error' ? console.error
               : ev.level === 'warn'  ? console.warn
               : console.log;
      fn(`[${ev.level.toUpperCase()}] ${ev.component}: ${ev.message}`, ev.ctx ?? '');
    }

    // Rotate by date (simple strategy)
    if (this.rotatingByDate) {
      const today = new Date().toISOString().slice(0, 10);
      if (!this.logFilePath.includes(today)) {
        // date changed; reopen
        this.init();
      }
    }
  }

  private base(level: LogLevel, component: string, message: string, ctx?: Record<string, any>) {
    const ev: LogEvent = {
      schema: 'v1',
      ts: new Date().toISOString(),
      event_id: ++this.eventCounter,
      level,
      component,
      message,
      ctx,
      pid: process.pid,
      source: 'node',
    };
    this.emit(ev);
  }

  // Encourage explicit component; avoids brittle stack-parsing
  debug(component: string, message: string, ctx?: Record<string, any>) { this.base('debug', component, message, ctx); }
  info (component: string, message: string, ctx?: Record<string, any>) { this.base('info',  component, message, ctx); }
  warn (component: string, message: string, ctx?: Record<string, any>) { this.base('warn',  component, message, ctx); }
  error(component: string, message: string, ctx?: Record<string, any>) { this.base('error', component, message, ctx); }

  // Helper to create a component-specific facade
  for(component: string) {
    return {
      debug: (msg: string, ctx?: Record<string, any>) => this.debug(component, msg, ctx),
      info : (msg: string, ctx?: Record<string, any>) => this.info(component, msg, ctx),
      warn : (msg: string, ctx?: Record<string, any>) => this.warn(component, msg, ctx),
      error: (msg: string, ctx?: Record<string, any>) => this.error(component, msg, ctx),
    };
  }
}

// Export a singleton
export const logger = new StructuredLogger();

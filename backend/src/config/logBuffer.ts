import Transport from 'winston-transport';

const MAX_ENTRIES = 1000;

export interface LogEntry {
  level: string;
  message: string;
  timestamp: string;
  meta?: Record<string, unknown>;
}

const logBuffer: LogEntry[] = [];

export class MemoryTransport extends Transport {
  log(info: Record<string, unknown>, callback: () => void) {
    setImmediate(() => this.emit('logged', info));
    const { level, message, timestamp, ...rest } = info;
    const meta = Object.keys(rest).filter((k) => !['symbol', 'splat'].includes(k)).length ? rest : undefined;
    const cleanLevel = typeof level === 'string' ? level.replace(/\x1b\[\d+m/g, '') : 'info';
    logBuffer.push({
      level: cleanLevel,
      message: String(message || ''),
      timestamp: (timestamp as string) || new Date().toISOString(),
      meta,
    });
    if (logBuffer.length > MAX_ENTRIES) logBuffer.shift();
    callback();
  }
}

/** Match Winston levels (info, warn, error, debug, verbose, silly, http). */
export function getRecentLogs(limit = 200, level?: string): LogEntry[] {
  let entries = [...logBuffer].reverse();
  if (level) {
    const norm = level.toLowerCase();
    entries = entries.filter((e) => String(e.level).toLowerCase() === norm);
  }
  return entries.slice(0, limit);
}

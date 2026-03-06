export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  component: string;
  message: string;
  data?: unknown;
  timestamp: number;
}

export interface LogSink {
  write(entry: LogEntry): void;
}

export class StderrSink implements LogSink {
  private minLevel: LogLevel;
  private static LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

  constructor(minLevel?: LogLevel) {
    const envLevel =
      (typeof Deno !== "undefined" ? Deno.env.get("BROWSERX_LOG_LEVEL") : undefined) as
        | LogLevel
        | undefined;
    this.minLevel = minLevel ?? envLevel ?? "info";
  }

  write(entry: LogEntry): void {
    if (StderrSink.LEVELS[entry.level] < StderrSink.LEVELS[this.minLevel]) return;
    const prefix = `[${entry.component}]`;
    const method = entry.level === "error"
      ? "error"
      : entry.level === "warn"
      ? "warn"
      : entry.level === "debug"
      ? "debug"
      : "log";
    if (entry.data !== undefined) {
      (console as unknown as Record<string, (...a: unknown[]) => void>)[method](
        prefix,
        entry.message,
        entry.data,
      );
    } else {
      (console as unknown as Record<string, (...a: unknown[]) => void>)[method](prefix, entry.message);
    }
  }
}

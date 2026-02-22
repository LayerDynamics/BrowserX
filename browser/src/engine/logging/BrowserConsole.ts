import { type LogEntry, type LogLevel, type LogSink, StderrSink } from "./LogSink.ts";

export class BrowserConsole {
  private sink: LogSink;
  private component: string;
  private counters: Map<string, number> = new Map();
  private timers: Map<string, number> = new Map();
  private groupDepth: number = 0;

  constructor(component: string, sink?: LogSink) {
    this.component = component;
    this.sink = sink ?? new StderrSink();
  }

  private emit(level: LogLevel, message: string, data?: unknown): void {
    const indent = "  ".repeat(this.groupDepth);
    const entry: LogEntry = {
      level,
      component: this.component,
      message: indent + message,
      data,
      timestamp: Date.now(),
    };
    this.sink.write(entry);
  }

  log(message: string, ...args: unknown[]): void {
    this.emit("info", message, args.length === 1 ? args[0] : args.length > 1 ? args : undefined);
  }

  debug(message: string, ...args: unknown[]): void {
    this.emit("debug", message, args.length === 1 ? args[0] : args.length > 1 ? args : undefined);
  }

  info(message: string, ...args: unknown[]): void {
    this.emit("info", message, args.length === 1 ? args[0] : args.length > 1 ? args : undefined);
  }

  warn(message: string, ...args: unknown[]): void {
    this.emit("warn", message, args.length === 1 ? args[0] : args.length > 1 ? args : undefined);
  }

  error(message: string, ...args: unknown[]): void {
    this.emit("error", message, args.length === 1 ? args[0] : args.length > 1 ? args : undefined);
  }

  trace(message?: string): void {
    const stack = new Error().stack ?? "";
    this.emit("debug", message ?? "Trace", stack);
  }

  assert(condition: boolean, message?: string, ...args: unknown[]): void {
    if (!condition) {
      this.emit("error", `Assertion failed: ${message ?? ""}`, args.length > 0 ? args : undefined);
    }
  }

  count(label: string = "default"): void {
    const val = (this.counters.get(label) ?? 0) + 1;
    this.counters.set(label, val);
    this.emit("info", `${label}: ${val}`);
  }

  countReset(label: string = "default"): void {
    this.counters.set(label, 0);
  }

  time(label: string = "default"): void {
    this.timers.set(label, performance.now());
  }

  timeEnd(label: string = "default"): void {
    const start = this.timers.get(label);
    if (start === undefined) {
      this.emit("warn", `Timer '${label}' does not exist`);
      return;
    }
    const duration = performance.now() - start;
    this.timers.delete(label);
    this.emit("info", `${label}: ${duration.toFixed(3)}ms`);
  }

  timeLog(label: string = "default", ...args: unknown[]): void {
    const start = this.timers.get(label);
    if (start === undefined) {
      this.emit("warn", `Timer '${label}' does not exist`);
      return;
    }
    const duration = performance.now() - start;
    this.emit("info", `${label}: ${duration.toFixed(3)}ms`, args.length > 0 ? args : undefined);
  }

  group(label?: string): void {
    if (label) this.emit("info", label);
    this.groupDepth++;
  }

  groupEnd(): void {
    if (this.groupDepth > 0) this.groupDepth--;
  }

  dir(obj: unknown): void {
    this.emit("info", "dir", obj);
  }

  table(data: unknown): void {
    this.emit("info", "table", data);
  }

  clear(): void {
    this.emit("info", "Console cleared");
  }
}

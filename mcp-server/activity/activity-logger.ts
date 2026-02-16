/**
 * Activity Logger
 * Comprehensive activity logging for MCP server with spinner, logs, and status bar
 */

import {
  type ActivityEvent,
  type ActivityLoggerConfig,
  type StatusBarData,
  COLORS,
  TERMINAL,
  STATUS_ICONS,
} from "./types.ts";
import { Spinner } from "./spinner.ts";

/**
 * Writable sync interface for output
 */
interface WritableSync {
  writeSync(p: Uint8Array): number;
}

/**
 * Activity logger for MCP server
 * Provides visual feedback when the server is processing requests
 */
export class ActivityLogger {
  private readonly config: Required<Omit<ActivityLoggerConfig, "output"> & { output: WritableSync }>;
  private readonly spinner: Spinner;
  private readonly encoder = new TextEncoder();
  private readonly startTime: number;

  private statusBarIntervalId: number | null = null;
  private activeTools: Map<string, { name: string; startTime: number }> = new Map();
  private recentEvents: ActivityEvent[] = [];
  private maxRecentEvents = 50;

  // Metrics
  private toolCallCount = 0;
  private toolSuccessCount = 0;
  private toolErrorCount = 0;
  private lastStatusBarData: StatusBarData | null = null;

  // Callback to get current status data
  private statusDataProvider: (() => StatusBarData) | null = null;

  constructor(config: ActivityLoggerConfig = {}) {
    const isTTY = Deno.stderr.isTerminal();

    this.config = {
      enableSpinner: config.enableSpinner ?? isTTY,
      enableToolLogs: config.enableToolLogs ?? true,
      enableStatusBar: config.enableStatusBar ?? isTTY,
      statusBarInterval: config.statusBarInterval ?? 1000,
      useColors: config.useColors ?? isTTY,
      output: config.output ?? Deno.stderr,
      minLogLevel: config.minLogLevel ?? "info",
    };

    this.spinner = new Spinner({
      useColors: this.config.useColors,
      output: this.config.output,
    });

    this.startTime = Date.now();
  }

  /**
   * Set the status data provider callback
   */
  setStatusDataProvider(provider: () => StatusBarData): void {
    this.statusDataProvider = provider;
  }

  /**
   * Start the activity logger (enables status bar updates)
   */
  start(): void {
    if (this.config.enableStatusBar && this.statusBarIntervalId === null) {
      this.statusBarIntervalId = setInterval(() => {
        this.updateStatusBar();
      }, this.config.statusBarInterval);
    }

    this.logInfo("BrowserX MCP Server started");
  }

  /**
   * Stop the activity logger
   */
  stop(): void {
    if (this.statusBarIntervalId !== null) {
      clearInterval(this.statusBarIntervalId);
      this.statusBarIntervalId = null;
    }

    if (this.spinner.isSpinning()) {
      this.spinner.stop();
    }

    this.logInfo("BrowserX MCP Server stopped");
  }

  /**
   * Log a tool start event
   */
  toolStart(toolName: string, operationId: string): void {
    const event: ActivityEvent = {
      type: "tool_start",
      timestamp: Date.now(),
      toolName,
      message: `Tool ${toolName} started`,
    };

    this.addEvent(event);
    this.activeTools.set(operationId, { name: toolName, startTime: Date.now() });
    this.toolCallCount++;

    if (this.config.enableToolLogs) {
      this.logTool("start", toolName);
    }

    if (this.config.enableSpinner) {
      this.updateSpinner();
    }
  }

  /**
   * Log a tool progress event
   */
  toolProgress(toolName: string, operationId: string, progress: number, message?: string): void {
    const event: ActivityEvent = {
      type: "tool_progress",
      timestamp: Date.now(),
      toolName,
      progress,
      message: message ?? `${toolName} ${progress}%`,
    };

    this.addEvent(event);

    if (this.config.enableSpinner && this.spinner.isSpinning()) {
      const progressText = message ?? `${toolName} ${progress}%`;
      this.spinner.update(progressText);
    }
  }

  /**
   * Log a tool completion event
   */
  toolComplete(toolName: string, operationId: string, duration?: number): void {
    const toolInfo = this.activeTools.get(operationId);
    const actualDuration = duration ?? (toolInfo ? Date.now() - toolInfo.startTime : 0);

    const event: ActivityEvent = {
      type: "tool_complete",
      timestamp: Date.now(),
      toolName,
      duration: actualDuration,
      message: `Tool ${toolName} completed`,
    };

    this.addEvent(event);
    this.activeTools.delete(operationId);
    this.toolSuccessCount++;

    if (this.config.enableToolLogs) {
      this.logTool("complete", toolName, actualDuration);
    }

    if (this.config.enableSpinner) {
      if (this.activeTools.size === 0) {
        this.spinner.succeed(`${toolName} completed`);
      } else {
        this.updateSpinner();
      }
    }
  }

  /**
   * Log a tool error event
   */
  toolError(toolName: string, operationId: string, error: string, duration?: number): void {
    const toolInfo = this.activeTools.get(operationId);
    const actualDuration = duration ?? (toolInfo ? Date.now() - toolInfo.startTime : 0);

    const event: ActivityEvent = {
      type: "tool_error",
      timestamp: Date.now(),
      toolName,
      duration: actualDuration,
      error,
      message: `Tool ${toolName} failed: ${error}`,
    };

    this.addEvent(event);
    this.activeTools.delete(operationId);
    this.toolErrorCount++;

    if (this.config.enableToolLogs) {
      this.logTool("error", toolName, actualDuration, error);
    }

    if (this.config.enableSpinner) {
      if (this.activeTools.size === 0) {
        this.spinner.fail(`${toolName} failed`);
      } else {
        this.updateSpinner();
      }
    }
  }

  /**
   * Log a session created event
   */
  sessionCreated(sessionId: string): void {
    const event: ActivityEvent = {
      type: "session_created",
      timestamp: Date.now(),
      sessionId,
      message: `Session ${sessionId} created`,
    };

    this.addEvent(event);

    if (this.config.enableToolLogs) {
      this.logSession("created", sessionId);
    }
  }

  /**
   * Log a session closed event
   */
  sessionClosed(sessionId: string): void {
    const event: ActivityEvent = {
      type: "session_closed",
      timestamp: Date.now(),
      sessionId,
      message: `Session ${sessionId} closed`,
    };

    this.addEvent(event);

    if (this.config.enableToolLogs) {
      this.logSession("closed", sessionId);
    }
  }

  /**
   * Get activity metrics
   */
  getMetrics(): {
    totalCalls: number;
    successCount: number;
    errorCount: number;
    activeCount: number;
    uptime: number;
  } {
    return {
      totalCalls: this.toolCallCount,
      successCount: this.toolSuccessCount,
      errorCount: this.toolErrorCount,
      activeCount: this.activeTools.size,
      uptime: Date.now() - this.startTime,
    };
  }

  /**
   * Get recent events
   */
  getRecentEvents(): ActivityEvent[] {
    return [...this.recentEvents];
  }

  // ---- Private methods ----

  /**
   * Add an event to recent events list
   */
  private addEvent(event: ActivityEvent): void {
    this.recentEvents.push(event);
    if (this.recentEvents.length > this.maxRecentEvents) {
      this.recentEvents.shift();
    }
  }

  /**
   * Update the spinner text based on active tools
   */
  private updateSpinner(): void {
    if (this.activeTools.size === 0) {
      if (this.spinner.isSpinning()) {
        this.spinner.stop();
      }
      return;
    }

    const tools = Array.from(this.activeTools.values());

    if (tools.length === 1) {
      this.spinner.start(tools[0].name);
    } else {
      this.spinner.start(`${tools.length} tools running: ${tools.map((t) => t.name).join(", ")}`);
    }
  }

  /**
   * Update the status bar
   */
  private updateStatusBar(): void {
    if (!this.config.enableStatusBar || !this.statusDataProvider) {
      return;
    }

    // Don't update status bar while spinner is active (it would conflict)
    if (this.spinner.isSpinning()) {
      return;
    }

    const data = this.statusDataProvider();

    // Only update if data changed
    if (this.lastStatusBarData && this.isStatusDataEqual(data, this.lastStatusBarData)) {
      return;
    }

    this.lastStatusBarData = data;
    this.renderStatusBar(data);
  }

  /**
   * Render the status bar
   */
  private renderStatusBar(data: StatusBarData): void {
    const healthIcon = STATUS_ICONS[data.health];
    const healthColor = data.health === "healthy" ? COLORS.green : data.health === "degraded" ? COLORS.yellow : COLORS.red;

    let statusLine: string;

    if (this.config.useColors) {
      statusLine =
        `${COLORS.dim}[${COLORS.reset}` +
        `${healthColor}${healthIcon}${COLORS.reset} ` +
        `${COLORS.cyan}${data.uptime}${COLORS.reset} | ` +
        `${COLORS.blue}${data.activeSessions}/${data.maxSessions}${COLORS.reset} sessions | ` +
        `${COLORS.magenta}${data.activeOperations}${COLORS.reset} ops | ` +
        `${COLORS.green}${data.requestsPerSecond}${COLORS.reset} req/s` +
        `${COLORS.dim}]${COLORS.reset}`;
    } else {
      statusLine =
        `[${healthIcon} ${data.uptime} | ` +
        `${data.activeSessions}/${data.maxSessions} sessions | ` +
        `${data.activeOperations} ops | ` +
        `${data.requestsPerSecond} req/s]`;
    }

    // Clear line and write status
    this.write(TERMINAL.cursorStart + TERMINAL.clearLine + statusLine);
  }

  /**
   * Check if two status data objects are equal
   */
  private isStatusDataEqual(a: StatusBarData, b: StatusBarData): boolean {
    return (
      a.uptime === b.uptime &&
      a.activeSessions === b.activeSessions &&
      a.maxSessions === b.maxSessions &&
      a.activeOperations === b.activeOperations &&
      a.requestsPerSecond === b.requestsPerSecond &&
      a.health === b.health
    );
  }

  /**
   * Log a tool event
   */
  private logTool(action: "start" | "complete" | "error", toolName: string, duration?: number, error?: string): void {
    const timestamp = this.formatTimestamp();
    const durationStr = duration !== undefined ? ` (${this.formatDuration(duration)})` : "";

    let line: string;

    if (this.config.useColors) {
      const actionColor = action === "start" ? COLORS.cyan : action === "complete" ? COLORS.green : COLORS.red;
      const actionIcon = action === "start" ? STATUS_ICONS.running : action === "complete" ? STATUS_ICONS.complete : STATUS_ICONS.error;

      line = `${COLORS.dim}${timestamp}${COLORS.reset} ${actionColor}${actionIcon}${COLORS.reset} `;
      line += `${COLORS.bold}${toolName}${COLORS.reset}`;
      line += `${COLORS.dim}${durationStr}${COLORS.reset}`;

      if (error) {
        line += ` ${COLORS.red}${error}${COLORS.reset}`;
      }
    } else {
      const actionIcon = action === "start" ? ">" : action === "complete" ? "+" : "!";
      line = `${timestamp} [${actionIcon}] ${toolName}${durationStr}`;
      if (error) {
        line += ` ${error}`;
      }
    }

    this.writeLine(line);
  }

  /**
   * Log a session event
   */
  private logSession(action: "created" | "closed", sessionId: string): void {
    const timestamp = this.formatTimestamp();
    const shortId = sessionId.substring(0, 8);

    let line: string;

    if (this.config.useColors) {
      const actionColor = action === "created" ? COLORS.green : COLORS.yellow;
      line = `${COLORS.dim}${timestamp}${COLORS.reset} ${actionColor}${STATUS_ICONS.session}${COLORS.reset} `;
      line += `Session ${COLORS.cyan}${shortId}${COLORS.reset} ${action}`;
    } else {
      line = `${timestamp} [S] Session ${shortId} ${action}`;
    }

    this.writeLine(line);
  }

  /**
   * Log an info message
   */
  private logInfo(message: string): void {
    if (!this.config.enableToolLogs) return;

    const timestamp = this.formatTimestamp();
    let line: string;

    if (this.config.useColors) {
      line = `${COLORS.dim}${timestamp}${COLORS.reset} ${COLORS.blue}ℹ${COLORS.reset} ${message}`;
    } else {
      line = `${timestamp} [i] ${message}`;
    }

    this.writeLine(line);
  }

  /**
   * Format timestamp for logs
   */
  private formatTimestamp(): string {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;
  }

  /**
   * Format duration in human-readable form
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }

  /**
   * Write to output
   */
  private write(text: string): void {
    this.config.output.writeSync(this.encoder.encode(text));
  }

  /**
   * Write line to output
   */
  private writeLine(text: string): void {
    // If status bar is showing, we need to clear it first and restore after
    if (this.lastStatusBarData && !this.spinner.isSpinning()) {
      this.write(TERMINAL.cursorStart + TERMINAL.clearLine);
      this.write(text + "\n");
      // Re-render status bar on next interval
      this.lastStatusBarData = null;
    } else {
      this.write(text + "\n");
    }
  }
}

/**
 * Create a new activity logger instance
 */
export function createActivityLogger(config?: ActivityLoggerConfig): ActivityLogger {
  return new ActivityLogger(config);
}

// ---- Global Activity Logger ----

let globalActivityLogger: ActivityLogger | null = null;

/**
 * Set the global activity logger instance
 * Called once during server initialization
 */
export function setGlobalActivityLogger(logger: ActivityLogger): void {
  globalActivityLogger = logger;
}

/**
 * Get the global activity logger instance
 * Returns null if not set
 */
export function getGlobalActivityLogger(): ActivityLogger | null {
  return globalActivityLogger;
}

/**
 * Log tool start (convenience function)
 */
export function logToolStart(toolName: string, operationId: string): void {
  globalActivityLogger?.toolStart(toolName, operationId);
}

/**
 * Log tool complete (convenience function)
 */
export function logToolComplete(toolName: string, operationId: string, duration?: number): void {
  globalActivityLogger?.toolComplete(toolName, operationId, duration);
}

/**
 * Log tool error (convenience function)
 */
export function logToolError(toolName: string, operationId: string, error: string, duration?: number): void {
  globalActivityLogger?.toolError(toolName, operationId, error, duration);
}

/**
 * Log tool progress (convenience function)
 */
export function logToolProgress(toolName: string, operationId: string, progress: number, message?: string): void {
  globalActivityLogger?.toolProgress(toolName, operationId, progress, message);
}

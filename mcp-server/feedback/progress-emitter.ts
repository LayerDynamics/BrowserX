/**
 * Progress Emitter
 * Sends progress notifications during long-running operations
 *
 * Uses MCP notifications to provide real-time feedback to agents.
 * Rate-limited to avoid spam.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  ProgressLevel,
  type ProgressNotification,
  type ProgressState,
  type ProgressTiming,
} from "./types.ts";

/**
 * Progress emitter configuration
 */
export interface ProgressEmitterConfig {
  /** Minimum interval between notifications in milliseconds (default: 100) */
  minInterval?: number;
  /** Whether to include debug-level notifications (default: false) */
  includeDebug?: boolean;
  /** Logger name prefix (default: "browserx") */
  loggerPrefix?: string;
}

/**
 * Progress emitter for a single operation
 *
 * Provides methods to emit progress updates, stage transitions, and warnings.
 * Automatically tracks elapsed time and provides estimated remaining time.
 */
export class ProgressEmitter {
  private readonly operationId: string;
  private readonly toolName: string;
  private readonly startTime: number;
  private readonly minInterval: number;
  private readonly includeDebug: boolean;
  private readonly loggerPrefix: string;
  private lastEmitTime = 0;
  private server: McpServer | null;

  constructor(
    server: McpServer | null,
    operationId: string,
    toolName: string,
    config: ProgressEmitterConfig = {},
  ) {
    this.server = server;
    this.operationId = operationId;
    this.toolName = toolName;
    this.startTime = Date.now();
    this.minInterval = config.minInterval ?? 100;
    this.includeDebug = config.includeDebug ?? false;
    this.loggerPrefix = config.loggerPrefix ?? "browserx";
  }

  /**
   * Emit a progress notification
   */
  async emit(
    notification: Omit<ProgressNotification, "timing">,
  ): Promise<void> {
    // Skip if no server (e.g., in tests)
    if (!this.server) {
      return;
    }

    // Skip debug notifications if not enabled
    if (notification.level === ProgressLevel.DEBUG && !this.includeDebug) {
      return;
    }

    // Rate limit notifications
    const now = Date.now();
    if (now - this.lastEmitTime < this.minInterval) {
      return;
    }
    this.lastEmitTime = now;

    // Calculate timing
    const elapsed = now - this.startTime;
    const timing: ProgressTiming = {
      elapsed,
    };

    // Estimate remaining time based on progress
    if (notification.progress && notification.progress.percentage > 0) {
      const estimatedTotal = (elapsed / notification.progress.percentage) * 100;
      timing.estimated = Math.round(estimatedTotal - elapsed);
    }

    const fullNotification: ProgressNotification = {
      ...notification,
      timing,
    };

    // Send via MCP notification
    try {
      await this.sendNotification(fullNotification);
    } catch {
      // Ignore notification errors - don't fail the operation
    }
  }

  /**
   * Emit a stage transition
   */
  async stage(stage: string, message: string): Promise<void> {
    await this.emit({
      level: ProgressLevel.INFO,
      stage,
      message,
    });
  }

  /**
   * Emit progress with percentage
   */
  async progress(
    stage: string,
    message: string,
    current: number,
    total: number,
  ): Promise<void> {
    const progressState: ProgressState = {
      current,
      total,
      percentage: total > 0 ? Math.round((current / total) * 100) : 0,
    };

    await this.emit({
      level: ProgressLevel.INFO,
      stage,
      message,
      progress: progressState,
    });
  }

  /**
   * Emit a warning
   */
  async warn(stage: string, message: string): Promise<void> {
    await this.emit({
      level: ProgressLevel.WARNING,
      stage,
      message,
    });
  }

  /**
   * Emit a debug message
   */
  async debug(
    stage: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.emit({
      level: ProgressLevel.DEBUG,
      stage,
      message,
      metadata,
    });
  }

  /**
   * Get elapsed time in milliseconds
   */
  getElapsed(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Get the operation ID
   */
  getOperationId(): string {
    return this.operationId;
  }

  /**
   * Send notification through MCP server
   */
  private async sendNotification(
    notification: ProgressNotification,
  ): Promise<void> {
    // MCP SDK notification format
    const data = JSON.stringify({
      operationId: this.operationId,
      tool: this.toolName,
      ...notification,
    });

    // Access the server's notification method
    // The McpServer class exposes notification capability through its transport
    try {
      // Try to use the server's internal notification method
      // deno-lint-ignore no-explicit-any
      const server = this.server as any;

      // Check if server has a notification method
      if (typeof server.notification === "function") {
        await server.notification({
          method: "notifications/message",
          params: {
            level: notification.level,
            logger: `${this.loggerPrefix}/${this.toolName}`,
            data,
          },
        });
      } else if (server._transport?.send) {
        // Fall back to direct transport send
        await server._transport.send({
          jsonrpc: "2.0",
          method: "notifications/message",
          params: {
            level: notification.level,
            logger: `${this.loggerPrefix}/${this.toolName}`,
            data,
          },
        });
      }
    } catch {
      // Silently ignore - notifications are best-effort
    }
  }
}

/**
 * Create a progress emitter for an operation
 *
 * @param server - MCP server instance (or null for testing)
 * @param toolName - Name of the tool
 * @param config - Optional configuration
 */
export function createProgressEmitter(
  server: McpServer | null,
  toolName: string,
  config?: ProgressEmitterConfig,
): ProgressEmitter {
  const operationId = `${toolName}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  return new ProgressEmitter(server, operationId, toolName, config);
}

/**
 * Create a no-op progress emitter for when progress is disabled
 *
 * All methods are no-ops, making it safe to use in handlers
 * that don't want progress emissions.
 */
export function createNoopProgressEmitter(): ProgressEmitter {
  return new ProgressEmitter(null, "noop", "noop", {});
}

/**
 * Progress emitter factory that creates emitters with shared configuration
 */
export class ProgressEmitterFactory {
  private readonly config: ProgressEmitterConfig;

  constructor(config: ProgressEmitterConfig = {}) {
    this.config = config;
  }

  /**
   * Create a progress emitter for a tool
   */
  create(server: McpServer | null, toolName: string): ProgressEmitter {
    return createProgressEmitter(server, toolName, this.config);
  }

  /**
   * Create a no-op emitter
   */
  createNoop(): ProgressEmitter {
    return createNoopProgressEmitter();
  }
}

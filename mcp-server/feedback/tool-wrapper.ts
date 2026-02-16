/**
 * Tool Wrapper
 * Higher-order function to wrap tool handlers with feedback capabilities
 *
 * Provides automatic:
 * - Progress emission
 * - Error mapping to structured errors
 * - Timing collection
 * - Warning accumulation
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { mapError, formatErrorResponse } from "./error-mapper.ts";
import {
  createProgressEmitter,
  createNoopProgressEmitter,
  type ProgressEmitter,
} from "./progress-emitter.ts";
import type {
  EnhancedSuccessResponse,
  ResponseWarning,
  ErrorContext,
  TimingBreakdown,
} from "./types.ts";
import { wrapWithTimeout, type ToolResult, type TimeoutSystemConfig } from "../timeout/mod.ts";
import { logToolStart, logToolComplete, logToolError } from "../activity/mod.ts";

/**
 * Tool execution context passed to wrapped handlers
 *
 * Provides utilities for progress reporting, warning collection, and timing.
 */
export interface ToolExecutionContext {
  /** Progress emitter for this operation */
  progress: ProgressEmitter;
  /** Add a warning to the response */
  addWarning: (code: string, message: string, suggestion?: string) => void;
  /** Record timing for a phase */
  recordTiming: (phase: string, duration: number) => void;
  /** Get current elapsed time */
  getElapsed: () => number;
  /** Operation ID for tracking */
  operationId: string;
}

/**
 * Options for the tool wrapper
 */
export interface ToolWrapperOptions {
  /** Enable progress notifications (default: true) */
  enableProgress?: boolean;
  /** Include timing breakdown in response (default: true) */
  includeTiming?: boolean;
  /** Apply timeout enforcement (default: true) */
  applyTimeout?: boolean;
  /** Custom error context extractor */
  extractErrorContext?: (
    params: Record<string, unknown>,
  ) => Partial<Omit<ErrorContext, "tool">>;
  /** Timeout system configuration */
  timeoutConfig?: TimeoutSystemConfig;
}

/**
 * Result type for wrapped tool handlers
 */
export interface ToolHandlerResult<T = unknown> {
  /** The response data */
  data: T;
  /** Optional metadata to include in response */
  metadata?: Record<string, unknown>;
}

/**
 * Wrapped tool handler function type
 */
export type WrappedToolHandler<
  TParams extends Record<string, unknown>,
  TResult,
> = (params: TParams & { signal?: AbortSignal }, ctx: ToolExecutionContext) => Promise<ToolHandlerResult<TResult>>;

/**
 * Wrap a tool handler with feedback capabilities
 *
 * Usage:
 * ```typescript
 * server.tool(
 *   "browser_navigate",
 *   "...",
 *   { url: z.string() },
 *   withFeedback(
 *     server,
 *     "browser_navigate",
 *     async ({ url }, ctx) => {
 *       await ctx.progress.stage("STARTING", "Starting navigation");
 *       // ... do work ...
 *       ctx.recordTiming("navigation", elapsed);
 *       return { data: { url, sessionId } };
 *     }
 *   )
 * );
 * ```
 */
export function withFeedback<
  TParams extends Record<string, unknown>,
  TResult,
>(
  server: McpServer | null,
  toolName: string,
  handler: WrappedToolHandler<TParams, TResult>,
  options: ToolWrapperOptions = {},
): (params: TParams & { timeout?: number; signal?: AbortSignal }) => Promise<ToolResult> {
  const {
    enableProgress = true,
    includeTiming = true,
    applyTimeout = true,
    extractErrorContext,
    timeoutConfig,
  } = options;

  // Create the base handler with feedback
  const feedbackHandler = async (
    params: TParams & { timeout?: number; signal?: AbortSignal },
  ): Promise<ToolResult> => {
    const startTime = Date.now();
    const warnings: ResponseWarning[] = [];
    const timings: Record<string, number> = {};

    // Create progress emitter
    const progress = enableProgress
      ? createProgressEmitter(server, toolName)
      : createNoopProgressEmitter();

    const operationId = progress.getOperationId();

    // Create execution context
    const ctx: ToolExecutionContext = {
      progress,
      operationId,
      addWarning: (code, message, suggestion) => {
        warnings.push({ code, message, suggestion });
      },
      recordTiming: (phase, duration) => {
        timings[phase] = duration;
      },
      getElapsed: () => Date.now() - startTime,
    };

    // Log tool start
    logToolStart(toolName, operationId);

    try {
      // Execute the handler
      const result = await handler(params, ctx);

      // Build enhanced success response
      const totalTime = Date.now() - startTime;

      const timing: TimingBreakdown = {
        total: totalTime,
      };

      if (includeTiming && Object.keys(timings).length > 0) {
        timing.breakdown = timings;
      }

      const response: EnhancedSuccessResponse<TResult> = {
        success: true,
        data: result.data,
        timing,
        ...(warnings.length > 0 && { warnings }),
        ...(result.metadata && { metadata: result.metadata }),
      };

      // Log tool complete
      logToolComplete(toolName, operationId, totalTime);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      // Log tool error
      logToolError(
        toolName,
        operationId,
        error instanceof Error ? error.message : String(error),
        duration,
      );

      // Extract error context
      const errorContext = extractErrorContext
        ? extractErrorContext(params as Record<string, unknown>)
        : extractDefaultContext(params as Record<string, unknown>);

      // Map to structured error
      const structuredError = mapError(error, toolName, {
        ...errorContext,
        duration,
      });

      return formatErrorResponse(structuredError);
    }
  };

  // Apply timeout wrapper if enabled
  if (applyTimeout) {
    return wrapWithTimeout(toolName, feedbackHandler, timeoutConfig);
  }

  return feedbackHandler;
}

/**
 * Extract default context from common parameter patterns
 */
function extractDefaultContext(
  params: Record<string, unknown>,
): Partial<Omit<ErrorContext, "tool">> {
  const context: Partial<Omit<ErrorContext, "tool">> = {};

  // Extract common parameters
  if (typeof params.sessionId === "string") {
    context.sessionId = params.sessionId;
  }
  if (typeof params.url === "string") {
    context.url = params.url;
  }
  if (typeof params.selector === "string") {
    context.selector = params.selector;
  }
  if (typeof params.query === "string") {
    context.query = params.query;
  }

  // Include sanitized parameters (exclude sensitive fields)
  const safeParams = { ...params };
  // Don't include potentially sensitive data
  delete safeParams.text; // Typed text
  delete safeParams.script; // JavaScript code
  delete safeParams.args; // Script arguments
  delete safeParams.value; // Cache values

  if (Object.keys(safeParams).length > 0) {
    context.parameters = safeParams;
  }

  return context;
}

/**
 * Create a simple wrapper without progress (for INSTANT tier tools)
 *
 * For tools that should complete instantly, progress notifications
 * add unnecessary overhead. This wrapper provides error handling
 * without progress emission.
 */
export function withErrorHandling<
  TParams extends Record<string, unknown>,
  TResult,
>(
  toolName: string,
  handler: (params: TParams) => Promise<TResult>,
  options?: Pick<ToolWrapperOptions, "extractErrorContext" | "applyTimeout" | "timeoutConfig">,
): (params: TParams & { timeout?: number }) => Promise<ToolResult> {
  const { extractErrorContext, applyTimeout = true, timeoutConfig } = options ?? {};

  const errorHandler = async (
    params: TParams & { timeout?: number },
  ): Promise<ToolResult> => {
    const startTime = Date.now();

    try {
      const data = await handler(params);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: true,
                data,
                timing: { total: Date.now() - startTime },
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      const errorContext = extractErrorContext
        ? extractErrorContext(params as Record<string, unknown>)
        : extractDefaultContext(params as Record<string, unknown>);

      const structuredError = mapError(error, toolName, {
        ...errorContext,
        duration: Date.now() - startTime,
      });

      return formatErrorResponse(structuredError);
    }
  };

  if (applyTimeout) {
    return wrapWithTimeout(toolName, errorHandler, timeoutConfig);
  }

  return errorHandler;
}

/**
 * Create a timing recorder helper
 *
 * Usage:
 * ```typescript
 * const timing = createTimingRecorder();
 * timing.start("phase1");
 * // ... do work ...
 * timing.end("phase1");
 * const breakdown = timing.getBreakdown();
 * ```
 */
export function createTimingRecorder(): {
  start: (phase: string) => void;
  end: (phase: string) => number;
  record: (phase: string, duration: number) => void;
  getBreakdown: () => Record<string, number>;
  getTotal: () => number;
} {
  const starts: Map<string, number> = new Map();
  const durations: Map<string, number> = new Map();
  const overallStart = Date.now();

  return {
    start: (phase: string) => {
      starts.set(phase, Date.now());
    },
    end: (phase: string) => {
      const start = starts.get(phase);
      if (start) {
        const duration = Date.now() - start;
        durations.set(phase, duration);
        starts.delete(phase);
        return duration;
      }
      return 0;
    },
    record: (phase: string, duration: number) => {
      durations.set(phase, duration);
    },
    getBreakdown: () => Object.fromEntries(durations),
    getTotal: () => Date.now() - overallStart,
  };
}

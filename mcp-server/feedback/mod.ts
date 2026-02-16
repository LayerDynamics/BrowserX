/**
 * Feedback Module
 * Enhanced feedback system for MCP server
 *
 * Provides:
 * - Structured error types with codes and suggestions
 * - Error mapping from raw errors to structured errors
 * - Progress notifications during long operations
 * - Tool wrapper for automatic feedback handling
 *
 * Usage:
 * ```typescript
 * import {
 *   withFeedback,
 *   MCPErrorCode,
 *   PROGRESS_STAGES,
 * } from "./feedback/mod.ts";
 *
 * server.tool(
 *   "my_tool",
 *   "...",
 *   { param: z.string() },
 *   withFeedback(
 *     server,
 *     "my_tool",
 *     async ({ param }, ctx) => {
 *       await ctx.progress.stage("STARTING", "Starting operation");
 *       // ... do work ...
 *       return { data: { result: "..." } };
 *     }
 *   )
 * );
 * ```
 */

// Types
export {
  MCPErrorCode,
  ProgressLevel,
  type ErrorContext,
  type MCPStructuredError,
  type ProgressNotification,
  type ProgressState,
  type ProgressTiming,
  type ResponseWarning,
  type TimingBreakdown,
  type EnhancedSuccessResponse,
  type EnhancedErrorResponse,
  PROGRESS_STAGES,
  WARNING_CODES,
} from "./types.ts";

// Error mapping
export {
  mapError,
  createError,
  formatErrorResponse,
  shouldLogError,
} from "./error-mapper.ts";

// Progress emission
export {
  ProgressEmitter,
  type ProgressEmitterConfig,
  createProgressEmitter,
  createNoopProgressEmitter,
  ProgressEmitterFactory,
} from "./progress-emitter.ts";

// Tool wrapper
export {
  type ToolExecutionContext,
  type ToolWrapperOptions,
  type ToolHandlerResult,
  type WrappedToolHandler,
  withFeedback,
  withErrorHandling,
  createTimingRecorder,
} from "./tool-wrapper.ts";

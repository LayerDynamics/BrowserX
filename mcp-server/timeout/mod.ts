/**
 * Timeout Module
 * Tiered timeout system for MCP tools
 *
 * Provides:
 * - Timeout tier definitions (INSTANT, SHORT, LONG)
 * - Tool-to-tier mapping for all MCP tools
 * - Timeout wrapper for automatic enforcement
 * - Structured timeout error responses
 *
 * Usage:
 * ```typescript
 * import {
 *   TimeoutTier,
 *   getToolTier,
 *   wrapWithTimeout,
 *   calculateEffectiveTimeout,
 * } from "./timeout/mod.ts";
 *
 * // Wrap a tool handler with timeout
 * const wrappedHandler = wrapWithTimeout("browser_navigate", handler);
 *
 * // Calculate timeout for a tool
 * const { timeout, tier } = calculateEffectiveTimeout("browser_list_sessions");
 * ```
 */

// Types and constants
export {
  TimeoutTier,
  TIMEOUT_VALUES,
  TIMEOUT_CAPS,
  type ToolTimeoutConfig,
  type TimeoutErrorDetails,
  type TimeoutSystemConfig,
  resolveTimeoutConfig,
  getTierTimeout,
  getTierCap,
} from "./types.ts";

// Tool-tier mapping
export {
  TOOL_TIMEOUT_MAP,
  getToolTimeoutConfig,
  getToolsByTier,
  isKnownTool,
  getToolTier,
  getToolTierSummary,
} from "./tool-tiers.ts";

// Timeout wrapper
export {
  type ToolResult,
  type ToolHandler,
  TimeoutError,
  isTimeoutError,
  calculateEffectiveTimeout,
  createTimeoutErrorResult,
  wrapWithTimeout,
  createTimeoutAwareRegistrar,
  getTimeoutSchemaForTool,
  validateTimeout,
} from "./timeout-wrapper.ts";

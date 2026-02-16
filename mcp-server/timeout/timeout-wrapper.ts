/**
 * Timeout Wrapper for MCP Tools
 * Applies tiered timeouts to tool handlers
 *
 * Wraps tool handlers with timeout enforcement based on tool tier.
 * Uses existing timeout utilities from proxy-engine.
 */

import {
  withTimeout,
  TimeoutError,
  isTimeoutError,
} from "../../proxy-engine/core/network/utils/timeout.ts";

import {
  TimeoutTier,
  TIMEOUT_VALUES,
  TIMEOUT_CAPS,
  type TimeoutSystemConfig,
  type TimeoutErrorDetails,
  getTierTimeout,
  getTierCap,
} from "./types.ts";

import { getToolTimeoutConfig, getToolTier } from "./tool-tiers.ts";

// Re-export for convenience
export { TimeoutError, isTimeoutError };

/**
 * MCP Tool content item types (with index signature for MCP SDK compatibility)
 */
export type ToolContentItem =
  | { [x: string]: unknown; type: "text"; text: string }
  | { [x: string]: unknown; type: "image"; data: string; mimeType: string }
  | { [x: string]: unknown; type: "resource"; resource: { uri: string; mimeType?: string; blob: string } };

/**
 * MCP Tool result type (matches MCP SDK with index signature)
 */
export interface ToolResult {
  [x: string]: unknown;
  content: ToolContentItem[];
  isError?: boolean;
}

/**
 * Tool handler function type
 */
export type ToolHandler<T = Record<string, unknown>> = (
  args: T,
) => Promise<ToolResult>;

/**
 * Calculate effective timeout for a tool invocation
 *
 * @param toolName - Name of the tool
 * @param userTimeout - User-provided timeout (optional)
 * @param config - System timeout configuration (optional)
 * @returns Object with effective timeout and metadata
 */
export function calculateEffectiveTimeout(
  toolName: string,
  userTimeout?: number,
  config?: TimeoutSystemConfig,
): {
  timeout: number;
  tier: TimeoutTier;
  userProvided: boolean;
  wasCapped: boolean;
  cappedAt?: number;
} {
  const tier = getToolTier(toolName);
  const tierDefault = getTierTimeout(tier, config);
  const tierCap = getTierCap(tier, config);

  if (userTimeout !== undefined && userTimeout > 0) {
    // User provided a timeout - apply cap
    const wasCapped = userTimeout > tierCap;
    return {
      timeout: Math.min(userTimeout, tierCap),
      tier,
      userProvided: true,
      wasCapped,
      cappedAt: wasCapped ? tierCap : undefined,
    };
  }

  // Use tier default
  return {
    timeout: tierDefault,
    tier,
    userProvided: false,
    wasCapped: false,
  };
}

/**
 * Create structured timeout error response for MCP
 */
export function createTimeoutErrorResult(
  toolName: string,
  details: TimeoutErrorDetails,
): ToolResult {
  const tierInfo = getToolTimeoutConfig(toolName);
  const tierDescription = tierInfo?.description ?? "Unknown operation";

  const errorResponse = {
    success: false,
    error: {
      code: "TIMEOUT",
      message: `Tool "${toolName}" timed out after ${details.timeout}ms`,
      suggestion: getSuggestionForTier(details.tier, details.userProvided),
      retryable: true,
      context: {
        tool: toolName,
        tier: details.tier,
        tierDescription,
        timeout: details.timeout,
        userProvided: details.userProvided,
        ...(details.cappedAt && { cappedAt: details.cappedAt }),
      },
    },
  };

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(errorResponse, null, 2),
      },
    ],
    isError: true,
  };
}

/**
 * Get timeout suggestion based on tier
 */
function getSuggestionForTier(tier: TimeoutTier, userProvided: boolean): string {
  switch (tier) {
    case TimeoutTier.INSTANT:
      return userProvided
        ? "This operation should complete instantly. Check server health or try again."
        : `This operation has a ${TIMEOUT_VALUES.INSTANT}ms timeout. If server is under load, try again shortly.`;

    case TimeoutTier.SHORT:
      return userProvided
        ? `Consider using a longer timeout (max ${TIMEOUT_CAPS.SHORT}ms) if the operation needs more time.`
        : `This operation has a ${TIMEOUT_VALUES.SHORT}ms timeout. You can increase it with the timeout parameter (max ${TIMEOUT_CAPS.SHORT}ms).`;

    case TimeoutTier.LONG:
      return userProvided
        ? `The operation exceeded your timeout. Consider using a longer timeout (max ${TIMEOUT_CAPS.LONG}ms) or check if the target is responding.`
        : `This operation has a ${TIMEOUT_VALUES.LONG}ms timeout. You can increase it with the timeout parameter (max ${TIMEOUT_CAPS.LONG}ms).`;
  }
}

/**
 * Wrap a tool handler with timeout enforcement
 *
 * Usage:
 * ```typescript
 * const wrappedHandler = wrapWithTimeout("browser_navigate", originalHandler);
 * ```
 *
 * @param toolName - Name of the tool (for tier lookup)
 * @param handler - Original tool handler
 * @param config - Optional timeout system configuration
 */
export function wrapWithTimeout<T extends Record<string, unknown>>(
  toolName: string,
  handler: ToolHandler<T>,
  config?: TimeoutSystemConfig,
): ToolHandler<T & { timeout?: number; signal?: AbortSignal }> {
  // If timeout enforcement is disabled, return handler unchanged
  if (config?.enabled === false) {
    return handler as ToolHandler<T & { timeout?: number; signal?: AbortSignal }>;
  }

  return async (args: T & { timeout?: number; signal?: AbortSignal }): Promise<ToolResult> => {
    const timeoutInfo = calculateEffectiveTimeout(
      toolName,
      args.timeout,
      config,
    );

    // Create AbortSignal for this timeout - this is the KEY fix
    // The signal will be passed to the handler so it can propagate cancellation
    const signal = AbortSignal.timeout(timeoutInfo.timeout);

    // Add signal to args so handler can use it
    const argsWithSignal = { ...args, signal };

    try {
      // Execute handler with the signal-enriched args
      // The handler is responsible for passing signal to underlying operations
      const resultPromise = handler(argsWithSignal as T);

      // Race the result against the signal
      return await Promise.race([
        resultPromise,
        new Promise<never>((_, reject) => {
          signal.addEventListener("abort", () => {
            reject(new TimeoutError(
              `Tool "${toolName}" timed out after ${timeoutInfo.timeout}ms`,
              timeoutInfo.timeout,
            ));
          });
        }),
      ]);
    } catch (error) {
      // Check if this is a timeout error
      if (isTimeoutError(error)) {
        return createTimeoutErrorResult(toolName, {
          tool: toolName,
          tier: timeoutInfo.tier,
          timeout: timeoutInfo.timeout,
          userProvided: timeoutInfo.userProvided,
          cappedAt: timeoutInfo.cappedAt,
        });
      }

      // Re-throw other errors to be handled by tool's own error handling
      throw error;
    }
  };
}

/**
 * Create a timeout-aware tool registration helper
 *
 * This creates a wrapper around the tool registration that automatically
 * applies timeout enforcement based on tool tier.
 *
 * Usage:
 * ```typescript
 * const registerWithTimeout = createTimeoutAwareRegistrar(config);
 * registerWithTimeout(server, "browser_navigate", schema, handler);
 * ```
 */
export function createTimeoutAwareRegistrar(
  config?: TimeoutSystemConfig,
): <T extends Record<string, unknown>>(
  toolName: string,
  handler: ToolHandler<T>,
) => ToolHandler<T & { timeout?: number }> {
  return <T extends Record<string, unknown>>(
    toolName: string,
    handler: ToolHandler<T>,
  ): ToolHandler<T & { timeout?: number }> => {
    return wrapWithTimeout(toolName, handler, config);
  };
}

/**
 * Get timeout schema addition for a tool
 *
 * Returns Zod-compatible schema object for the timeout parameter
 * with tier-appropriate description.
 */
export function getTimeoutSchemaForTool(toolName: string): {
  type: "number";
  optional: true;
  description: string;
} {
  const tier = getToolTier(toolName);
  const defaultTimeout = TIMEOUT_VALUES[tier];
  const maxTimeout = TIMEOUT_CAPS[tier];

  return {
    type: "number",
    optional: true,
    description: `Timeout in milliseconds (default: ${defaultTimeout}ms, max: ${maxTimeout}ms)`,
  };
}

/**
 * Validate that a timeout value is within acceptable range
 */
export function validateTimeout(
  toolName: string,
  timeout: number | undefined,
): { valid: boolean; message?: string } {
  if (timeout === undefined) {
    return { valid: true };
  }

  if (typeof timeout !== "number" || !Number.isFinite(timeout)) {
    return { valid: false, message: "Timeout must be a finite number" };
  }

  if (timeout <= 0) {
    return { valid: false, message: "Timeout must be positive" };
  }

  const tier = getToolTier(toolName);
  const cap = TIMEOUT_CAPS[tier];

  if (timeout > cap) {
    return {
      valid: true, // Still valid, will be capped
      message: `Timeout will be capped to ${cap}ms (${tier} tier maximum)`,
    };
  }

  return { valid: true };
}

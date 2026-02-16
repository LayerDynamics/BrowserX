/**
 * Timeout System Types
 * Tiered timeout configuration for MCP tools
 *
 * Tools are classified into three tiers based on expected execution time:
 * - INSTANT: Local operations that should complete in <1s (lookups, status checks)
 * - SHORT: Simple operations without network (clicks, typing, cache ops)
 * - LONG: Complex operations with navigation/rendering (page loads, screenshots)
 */

/**
 * Timeout tier enumeration
 */
export enum TimeoutTier {
  /** 1 second - local/cached operations (list sessions, cache get, query status) */
  INSTANT = "INSTANT",
  /** 5 seconds - simple browser/proxy operations (click, type, cache set) */
  SHORT = "SHORT",
  /** 30 seconds - complex operations (navigate, screenshot, query execution) */
  LONG = "LONG",
}

/**
 * Default timeout values in milliseconds per tier
 */
export const TIMEOUT_VALUES: Record<TimeoutTier, number> = {
  [TimeoutTier.INSTANT]: 1000, // 1s
  [TimeoutTier.SHORT]: 5000, // 5s
  [TimeoutTier.LONG]: 30000, // 30s
};

/**
 * Maximum allowed timeout per tier (caps user-provided overrides)
 * Users can specify a custom timeout but cannot exceed these caps
 */
export const TIMEOUT_CAPS: Record<TimeoutTier, number> = {
  [TimeoutTier.INSTANT]: 2000, // 2s max
  [TimeoutTier.SHORT]: 15000, // 15s max
  [TimeoutTier.LONG]: 120000, // 2 minutes max
};

/**
 * Tool timeout configuration
 */
export interface ToolTimeoutConfig {
  /** The timeout tier for this tool */
  tier: TimeoutTier;
  /** Human-readable description of why this tier was chosen */
  description: string;
}

/**
 * Timeout error details for structured error responses
 */
export interface TimeoutErrorDetails {
  /** The tool that timed out */
  tool: string;
  /** The timeout tier that applied */
  tier: TimeoutTier;
  /** The actual timeout value in milliseconds */
  timeout: number;
  /** Whether user provided a custom timeout */
  userProvided: boolean;
  /** The tier cap that was applied (if user timeout exceeded cap) */
  cappedAt?: number;
}

/**
 * Configuration for the timeout system
 */
export interface TimeoutSystemConfig {
  /** Whether timeout enforcement is enabled (default: true) */
  enabled: boolean;
  /** Override default tier values */
  tierOverrides?: Partial<Record<TimeoutTier, number>>;
  /** Override tier caps */
  capOverrides?: Partial<Record<TimeoutTier, number>>;
}

/**
 * Create a resolved timeout configuration with overrides applied
 */
export function resolveTimeoutConfig(
  config?: Partial<TimeoutSystemConfig>,
): TimeoutSystemConfig {
  return {
    enabled: config?.enabled ?? true,
    tierOverrides: config?.tierOverrides,
    capOverrides: config?.capOverrides,
  };
}

/**
 * Get the effective timeout value for a tier, applying any overrides
 */
export function getTierTimeout(
  tier: TimeoutTier,
  config?: TimeoutSystemConfig,
): number {
  const override = config?.tierOverrides?.[tier];
  return override ?? TIMEOUT_VALUES[tier];
}

/**
 * Get the effective cap for a tier, applying any overrides
 */
export function getTierCap(
  tier: TimeoutTier,
  config?: TimeoutSystemConfig,
): number {
  const override = config?.capOverrides?.[tier];
  return override ?? TIMEOUT_CAPS[tier];
}

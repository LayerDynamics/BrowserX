/**
 * Tool-to-Tier Mapping
 * Maps each MCP tool to its appropriate timeout tier
 *
 * Classification criteria:
 * - INSTANT: No I/O, returns in-memory state
 * - SHORT: Simple I/O, no page loads
 * - LONG: Network requests, rendering, page loads
 */

import { TimeoutTier, type ToolTimeoutConfig } from "./types.ts";

/**
 * Complete mapping of all MCP tools to their timeout tiers
 */
export const TOOL_TIMEOUT_MAP: Record<string, ToolTimeoutConfig> = {
  // ============================================================
  // INSTANT TIER (1s) - Local lookups, no I/O
  // ============================================================

  browser_list_sessions: {
    tier: TimeoutTier.INSTANT,
    description: "Returns in-memory session pool statistics",
  },

  proxy_cache_get: {
    tier: TimeoutTier.INSTANT,
    description: "Retrieves from in-memory cache",
  },

  browserx_query_status: {
    tier: TimeoutTier.INSTANT,
    description: "Checks async query status from internal Map",
  },

  browserx_query_cancel: {
    tier: TimeoutTier.INSTANT,
    description: "Aborts query via AbortController signal",
  },

  proxy_remove_interceptor: {
    tier: TimeoutTier.INSTANT,
    description: "Removes from interceptor registry Map",
  },

  // Visibility tools (to be added)
  system_dashboard: {
    tier: TimeoutTier.INSTANT,
    description: "Aggregates in-memory stats from services",
  },

  query_dashboard: {
    tier: TimeoutTier.INSTANT,
    description: "Returns query engine metrics from memory",
  },

  // ============================================================
  // SHORT TIER (5s) - Simple operations, no full page loads
  // ============================================================

  browser_click: {
    tier: TimeoutTier.SHORT,
    description: "Click element in existing page",
  },

  browser_type: {
    tier: TimeoutTier.SHORT,
    description: "Type text into element",
  },

  browser_close_session: {
    tier: TimeoutTier.SHORT,
    description: "Close browser session and cleanup",
  },

  browser_query_dom: {
    tier: TimeoutTier.SHORT,
    description: "Query DOM elements in existing page",
  },

  proxy_cache_set: {
    tier: TimeoutTier.SHORT,
    description: "Store value in cache with optional eviction",
  },

  proxy_cache_clear: {
    tier: TimeoutTier.SHORT,
    description: "Clear cache entries by pattern",
  },

  proxy_add_interceptor: {
    tier: TimeoutTier.SHORT,
    description: "Register request interceptor pattern",
  },

  browserx_query_explain: {
    tier: TimeoutTier.SHORT,
    description: "Parse and plan query without execution",
  },

  // ============================================================
  // LONG TIER (30s) - Navigation, rendering, network operations
  // ============================================================

  browser_navigate: {
    tier: TimeoutTier.LONG,
    description: "Full page navigation with network requests",
  },

  browser_screenshot: {
    tier: TimeoutTier.LONG,
    description: "Render and capture page screenshot",
  },

  browser_pdf: {
    tier: TimeoutTier.LONG,
    description: "Generate PDF from page content",
  },

  browser_evaluate: {
    tier: TimeoutTier.LONG,
    description: "Execute JavaScript in page context",
  },

  browser_wait: {
    tier: TimeoutTier.LONG,
    description: "Wait for condition (selector, function, time)",
  },

  browserx_query: {
    tier: TimeoutTier.LONG,
    description: "Execute full query pipeline with browser operations",
  },

  browserx_query_async: {
    tier: TimeoutTier.LONG,
    description: "Submit async query for background execution",
  },
};

/**
 * Get timeout configuration for a tool
 * Returns undefined for unknown tools (caller should use default)
 */
export function getToolTimeoutConfig(
  toolName: string,
): ToolTimeoutConfig | undefined {
  return TOOL_TIMEOUT_MAP[toolName];
}

/**
 * Get all tools in a specific tier
 */
export function getToolsByTier(tier: TimeoutTier): string[] {
  return Object.entries(TOOL_TIMEOUT_MAP)
    .filter(([_, config]) => config.tier === tier)
    .map(([name]) => name);
}

/**
 * Check if a tool is known to the timeout system
 */
export function isKnownTool(toolName: string): boolean {
  return toolName in TOOL_TIMEOUT_MAP;
}

/**
 * Get the tier for a tool, defaulting to LONG for unknown tools
 * (fail-safe: unknown tools get generous timeout)
 */
export function getToolTier(toolName: string): TimeoutTier {
  return TOOL_TIMEOUT_MAP[toolName]?.tier ?? TimeoutTier.LONG;
}

/**
 * Summary of tool distribution across tiers
 */
export function getToolTierSummary(): Record<TimeoutTier, string[]> {
  return {
    [TimeoutTier.INSTANT]: getToolsByTier(TimeoutTier.INSTANT),
    [TimeoutTier.SHORT]: getToolsByTier(TimeoutTier.SHORT),
    [TimeoutTier.LONG]: getToolsByTier(TimeoutTier.LONG),
  };
}

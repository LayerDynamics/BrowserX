/**
 * Visibility Module
 * System visibility and monitoring for MCP server
 *
 * Provides:
 * - Types for visibility data (sessions, queries, operations, health)
 * - Operation tracker for real-time operation monitoring
 * - Visibility service aggregating data from all sources
 *
 * Usage:
 * ```typescript
 * import {
 *   VisibilityService,
 *   createVisibilityService,
 * } from "./visibility/mod.ts";
 *
 * const visibilityService = createVisibilityService();
 * visibilityService.setContext(context);
 *
 * // Track operations
 * const opId = visibilityService.operationTracker.startOperation(
 *   "navigate",
 *   "Navigate to example.com",
 *   sessionId,
 * );
 * // ... do work ...
 * visibilityService.operationTracker.completeOperation(opId);
 *
 * // Get dashboard
 * const dashboard = await visibilityService.getDashboard();
 * ```
 */

// Types
export {
  type OperationType,
  type EnhancedSessionInfo,
  type QueryState,
  type RunningQueryInfo,
  type ActiveOperation,
  type MemoryInfo,
  type SessionStats,
  type QueryStats,
  type OperationStats,
  type ErrorStats,
  type HealthStatus,
  type ServerHealthMetrics,
  type VisibilityDashboard,
  type OperationTrackerStats,
  formatUptime,
  formatBytes,
  truncate,
} from "./types.ts";

// Operation tracker
export {
  OperationTracker,
  type OperationTrackerConfig,
  createOperationTracker,
} from "./operation-tracker.ts";

// Visibility service
export {
  VisibilityService,
  type VisibilityServiceConfig,
  createVisibilityService,
} from "./visibility-service.ts";

/**
 * Visibility Service
 * Aggregates visibility data from all sources
 *
 * Combines data from:
 * - Session Manager (browser sessions)
 * - Query Engine (queries and metrics)
 * - Runtime (health and resources)
 * - Operation Tracker (active operations)
 */

import type { MCPServerContext } from "../server/mcp-server.ts";
import { OperationTracker, createOperationTracker } from "./operation-tracker.ts";
import {
  type EnhancedSessionInfo,
  type RunningQueryInfo,
  type ServerHealthMetrics,
  type VisibilityDashboard,
  type HealthStatus,
  type MemoryInfo,
  type QueryState,
  formatUptime,
} from "./types.ts";

/**
 * Visibility service configuration
 */
export interface VisibilityServiceConfig {
  /** Memory estimate per session in bytes (default: 50MB) */
  sessionMemoryEstimate?: number;
  /** Maximum query text length in dashboard (default: 100) */
  maxQueryLength?: number;
}

/**
 * Visibility service
 *
 * Provides methods to get visibility data from various sources.
 */
export class VisibilityService {
  private readonly startTime: number;
  public readonly operationTracker: OperationTracker;
  private readonly config: Required<VisibilityServiceConfig>;
  private context: MCPServerContext | null = null;

  constructor(config: VisibilityServiceConfig = {}) {
    this.startTime = Date.now();
    this.operationTracker = createOperationTracker();
    this.config = {
      sessionMemoryEstimate: config.sessionMemoryEstimate ?? 50 * 1024 * 1024, // 50MB
      maxQueryLength: config.maxQueryLength ?? 100,
    };
  }

  /**
   * Set the MCP server context
   * Called after context is created to provide access to services
   */
  setContext(context: MCPServerContext): void {
    this.context = context;
  }

  /**
   * Get enhanced session information
   */
  async getEnhancedSessions(): Promise<EnhancedSessionInfo[]> {
    if (!this.context) {
      return [];
    }

    // Check if session manager is ready (don't trigger lazy init for visibility)
    if (!this.context.serviceInitializer.isSessionManagerReady()) {
      return [];
    }

    const sessionManager = await this.context.getSessionManager();
    const stats = sessionManager.getPoolStats();
    const now = Date.now();

    return stats.sessions.map((session) => ({
      id: session.id,
      url: session.currentUrl,
      pageTitle: undefined, // Would need async page access
      createdAt: now - session.age,
      lastUsedAt: now - session.lastUsed,
      idleTimeMs: session.lastUsed,
      memoryEstimateBytes: this.config.sessionMemoryEstimate,
      pendingOperations: this.operationTracker.getSessionOperationCount(session.id),
      permissions: [], // Would need to expose from session
    }));
  }

  /**
   * Get running queries with timing
   */
  async getRunningQueries(): Promise<RunningQueryInfo[]> {
    if (!this.context) {
      return [];
    }

    // Check if query engine is ready (don't trigger lazy init for visibility)
    if (!this.context.serviceInitializer.isQueryEngineReady()) {
      return [];
    }

    const queryEngine = await this.context.getQueryEngine();
    const queries = queryEngine.getQueries();
    const now = Date.now();
    const activeStates = new Set([
      "PENDING",
      "LEXING",
      "PARSING",
      "ANALYZING",
      "OPTIMIZING",
      "PLANNING",
      "EXECUTING",
      "FORMATTING",
    ]);

    const results: RunningQueryInfo[] = [];

    for (const [queryId, status] of queries.entries()) {
      if (!activeStates.has(status.state)) {
        continue;
      }

      const startTime = this.extractStartTimeFromQueryId(queryId);
      const elapsedMs = now - startTime;

      // Estimate remaining time based on progress
      let estimatedRemainingMs: number | undefined;
      if (status.progress > 0 && status.progress < 100) {
        const estimatedTotal = (elapsedMs / status.progress) * 100;
        estimatedRemainingMs = Math.round(estimatedTotal - elapsedMs);
      }

      results.push({
        queryId,
        query: "", // Query text not stored in status
        state: status.state as QueryState,
        progress: status.progress,
        stepsCompleted: status.stepsCompleted,
        stepsTotal: status.stepsTotal,
        startedAt: startTime,
        elapsedMs,
        estimatedRemainingMs,
        currentStep: status.currentStep,
      });
    }

    return results;
  }

  /**
   * Get server health metrics
   */
  async getServerHealth(): Promise<ServerHealthMetrics> {
    const now = Date.now();
    const uptime = now - this.startTime;

    // Get memory info
    const memoryUsage = Deno.memoryUsage();
    const memory: MemoryInfo = {
      heapUsedMB: Math.round((memoryUsage.heapUsed / 1024 / 1024) * 100) / 100,
      heapTotalMB: Math.round((memoryUsage.heapTotal / 1024 / 1024) * 100) / 100,
      rssMB: Math.round((memoryUsage.rss / 1024 / 1024) * 100) / 100,
      externalMB: Math.round((memoryUsage.external / 1024 / 1024) * 100) / 100,
      usagePercent: Math.round(
        (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
      ),
    };

    // Get session stats (only if session manager is already initialized)
    let sessions = { active: 0, max: 10, totalCreated: 0, totalClosed: 0 };
    if (this.context && this.context.serviceInitializer.isSessionManagerReady()) {
      const sessionManager = await this.context.getSessionManager();
      const poolStats = sessionManager.getPoolStats();
      sessions = {
        active: poolStats.activeSessions,
        max: poolStats.maxSessions,
        totalCreated: poolStats.totalCreated,
        totalClosed: poolStats.totalClosed,
      };
    }

    // Get query stats (only if query engine is already initialized)
    let queries = {
      total: 0,
      active: 0,
      successful: 0,
      failed: 0,
      cancelled: 0,
      avgExecutionMs: 0,
    };
    if (this.context && this.context.serviceInitializer.isQueryEngineReady()) {
      const queryEngine = await this.context.getQueryEngine();
      const metrics = queryEngine.getMetrics();
      const runningQueries = await this.getRunningQueries();
      queries = {
        total: metrics.queries.total,
        active: runningQueries.length,
        successful: metrics.queries.successful,
        failed: metrics.queries.failed,
        cancelled: metrics.queries.cancelled,
        avgExecutionMs: metrics.performance.averageExecutionTime,
      };
    }

    // Get operation stats
    const opStats = this.operationTracker.getStats();
    const operations = {
      active: opStats.active,
      completedLastMinute: opStats.completedLastMinute,
      requestsPerSecond: opStats.requestsPerSecond,
    };

    // Get error stats (only if query engine is already initialized)
    let errorTotal = 0;
    if (this.context && this.context.serviceInitializer.isQueryEngineReady()) {
      const queryEngine = await this.context.getQueryEngine();
      errorTotal = queryEngine.getMetrics().errors?.total ?? 0;
    }
    const errors = {
      total: errorTotal,
      lastHour: opStats.errorsLastHour,
      rate: opStats.errorRate,
    };

    // Determine health status
    let status: HealthStatus = "healthy";

    // Check for unhealthy conditions
    if (
      memory.usagePercent > 95 ||
      opStats.errorRate > 10 ||
      (sessions.active >= sessions.max && sessions.max > 0)
    ) {
      status = "unhealthy";
    } else if (
      memory.usagePercent > 80 ||
      opStats.errorRate > 5 ||
      sessions.active >= sessions.max * 0.9
    ) {
      status = "degraded";
    }

    return {
      status,
      uptime,
      uptimeFormatted: formatUptime(uptime),
      memory,
      sessions,
      queries,
      operations,
      errors,
    };
  }

  /**
   * Get complete dashboard snapshot
   */
  async getDashboard(): Promise<VisibilityDashboard> {
    const [sessions, runningQueries, serverHealth] =
      await Promise.all([
        this.getEnhancedSessions(),
        this.getRunningQueries(),
        this.getServerHealth(),
      ]);

    // Get active operations (sync)
    const activeOperations = this.operationTracker.getActiveOperations();

    const summary = this.generateSummary(
      serverHealth,
      sessions.length,
      runningQueries.length,
      activeOperations.length,
    );

    return {
      timestamp: Date.now(),
      server: serverHealth,
      sessions,
      runningQueries,
      activeOperations,
      summary,
    };
  }

  /**
   * Get server uptime in milliseconds
   */
  getUptime(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Extract start time from query ID
   * Query IDs are formatted as: query_{timestamp}_{random}
   */
  private extractStartTimeFromQueryId(queryId: string): number {
    const match = queryId.match(/query_(\d+)_/);
    if (match) {
      return parseInt(match[1], 10);
    }
    // Fallback: assume recent
    return Date.now() - 1000;
  }

  /**
   * Generate human-readable summary
   */
  private generateSummary(
    health: ServerHealthMetrics,
    sessionCount: number,
    queryCount: number,
    opCount: number,
  ): string {
    const parts: string[] = [];

    // Status
    parts.push(`Server ${health.status}`);

    // Uptime
    parts.push(`uptime ${health.uptimeFormatted}`);

    // Sessions
    parts.push(`${sessionCount}/${health.sessions.max} sessions`);

    // Running queries
    if (queryCount > 0) {
      parts.push(`${queryCount} queries running`);
    }

    // Active operations
    if (opCount > 0) {
      parts.push(`${opCount} active operations`);
    }

    // Memory
    parts.push(`${health.memory.usagePercent}% memory`);

    // RPS
    if (health.operations.requestsPerSecond > 0) {
      parts.push(`${health.operations.requestsPerSecond} req/s`);
    }

    return parts.join(" | ");
  }
}

/**
 * Create a new visibility service
 */
export function createVisibilityService(
  config?: VisibilityServiceConfig,
): VisibilityService {
  return new VisibilityService(config);
}

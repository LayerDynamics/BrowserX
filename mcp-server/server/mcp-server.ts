/**
 * MCP Server Configuration and Setup
 * Creates and configures the McpServer instance
 *
 * Uses lazy initialization for heavy services:
 * - BrowserXRuntime (event loops, browser pool) - init on first browser tool use
 * - QueryEngine (SQL-like interface) - init on first query tool use
 * - SessionManager (browser sessions) - init on first session use
 *
 * This enables fast server startup (<100ms) and graceful degradation.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BrowserXRuntime } from "@browserx/runtime";
import type { IQueryEngine } from "@browserx/query-engine";
import type { SessionManager } from "../session/session-manager.ts";
import { PermissionGuard, type PermissionSet } from "../security/permission-guard.ts";
import { VisibilityService, createVisibilityService, formatUptime } from "../visibility/mod.ts";
import { type TimeoutSystemConfig, resolveTimeoutConfig } from "../timeout/mod.ts";
import { ActivityLogger, createActivityLogger, ActivityTracker, initActivityTracker } from "../activity/mod.ts";
import {
  ServiceInitializer,
  createServiceInitializer,
  type ServiceInitializerConfig,
} from "./service-initializer.ts";

/**
 * MCP Server configuration
 */
export interface MCPServerConfig {
  name?: string;
  version?: string;
  permissions?: PermissionSet;
  maxSessions?: number;
  sessionConfig?: {
    maxSessions?: number;
    sessionTimeout?: number;
    defaultViewport?: { width: number; height: number };
  };
  queryEngineConfig?: {
    security?: {
      sandbox?: {
        enabled?: boolean;
        timeout?: number;
      };
    };
  };
  runtimeConfig?: Record<string, unknown>;
  /** Timeout system configuration */
  timeoutConfig?: Partial<TimeoutSystemConfig>;
}

/**
 * MCP Server context - shared across all tools and resources
 *
 * Heavy services (runtime, queryEngine, sessionManager) are accessed
 * through the serviceInitializer, which provides lazy initialization.
 */
export interface MCPServerContext {
  /** Service initializer for lazy loading heavy services */
  serviceInitializer: ServiceInitializer;

  /** Permission guard - always available */
  permissionGuard: PermissionGuard;

  /** Visibility service - always available */
  visibilityService: VisibilityService;

  /** Activity logger - always available */
  activityLogger: ActivityLogger;

  /** Activity tracker - persistent file-based logging */
  activityTracker: ActivityTracker;

  /** Timeout configuration */
  timeoutConfig: TimeoutSystemConfig;

  /** Server configuration */
  config: MCPServerConfig;

  // ---- Convenience getters for lazy services ----

  /** Get runtime (lazy init on first call) */
  getRuntime(): Promise<BrowserXRuntime>;

  /** Get query engine (lazy init on first call) */
  getQueryEngine(): Promise<IQueryEngine>;

  /** Get session manager (lazy init on first call) */
  getSessionManager(): Promise<SessionManager>;
}

/**
 * Create a lightweight MCP server
 *
 * Only initializes minimal services needed to accept connections.
 * Heavy services (runtime, query engine, session manager) initialize
 * lazily on first use.
 *
 * Startup time: <100ms (vs 2-3s with eager initialization)
 */
export function createMCPServer(config: MCPServerConfig = {}): {
  server: McpServer;
  context: MCPServerContext;
} {
  const resolvedConfig: MCPServerConfig = {
    name: config.name ?? "browserx-mcp",
    version: config.version ?? "0.1.0",
    permissions: config.permissions ?? "AUTOMATION",
    maxSessions: config.maxSessions ?? 10,
    sessionConfig: {
      maxSessions: config.maxSessions ?? config.sessionConfig?.maxSessions ?? 10,
      sessionTimeout: config.sessionConfig?.sessionTimeout ?? 30 * 60 * 1000,
      defaultViewport: config.sessionConfig?.defaultViewport ?? { width: 1280, height: 720 },
    },
    queryEngineConfig: config.queryEngineConfig ?? {},
    runtimeConfig: config.runtimeConfig ?? {},
    timeoutConfig: config.timeoutConfig ?? {},
  };

  // Create MCP server instance (lightweight)
  const server = new McpServer({
    name: resolvedConfig.name!,
    version: resolvedConfig.version!,
  });

  // Create service initializer config
  const serviceConfig: ServiceInitializerConfig = {
    sessionConfig: resolvedConfig.sessionConfig,
    queryEngineConfig: resolvedConfig.queryEngineConfig,
    runtimeConfig: resolvedConfig.runtimeConfig as Record<string, unknown>,
  };

  // Create service initializer (no services started yet)
  const serviceInitializer = createServiceInitializer(serviceConfig);

  // Create permission guard (lightweight, always needed)
  const permissionGuard = new PermissionGuard(resolvedConfig.permissions);

  // Create visibility service (lightweight, always needed)
  const visibilityService = createVisibilityService();

  // Create activity logger (lightweight, always needed)
  const activityLogger = createActivityLogger();

  // Create activity tracker for persistent file logging (screenshots, etc.)
  const activityTracker = initActivityTracker(".browserx/usage_data");

  // Resolve timeout configuration
  const timeoutConfig = resolveTimeoutConfig(resolvedConfig.timeoutConfig);

  // Build context with lazy getters
  const context: MCPServerContext = {
    serviceInitializer,
    permissionGuard,
    visibilityService,
    activityLogger,
    activityTracker,
    timeoutConfig,
    config: resolvedConfig,

    // Convenience methods for lazy service access
    getRuntime: () => serviceInitializer.getRuntime(),
    getQueryEngine: () => serviceInitializer.getQueryEngine(),
    getSessionManager: () => serviceInitializer.getSessionManager(),
  };

  // Set context reference in visibility service
  visibilityService.setContext(context);

  // Set up status data provider for activity logger
  activityLogger.setStatusDataProvider(() => {
    const opStats = visibilityService.operationTracker.getStats();
    return {
      uptime: formatUptime(visibilityService.getUptime()),
      activeSessions: serviceInitializer.isSessionManagerReady() ? opStats.active : 0,
      maxSessions: resolvedConfig.maxSessions ?? 10,
      activeOperations: opStats.active,
      requestsPerSecond: opStats.requestsPerSecond,
      health: opStats.errorRate > 10 ? "unhealthy" : opStats.errorRate > 5 ? "degraded" : "healthy",
    };
  });

  return { server, context };
}

/**
 * Legacy async version for backwards compatibility
 *
 * @deprecated Use createMCPServer() instead - services now init lazily
 */
export async function createMCPServerAsync(config: MCPServerConfig = {}): Promise<{
  server: McpServer;
  context: MCPServerContext;
}> {
  // Just call the sync version - initialization is now lazy
  return createMCPServer(config);
}

/**
 * Shutdown the MCP server and cleanup resources
 */
export async function shutdownMCPServer(context: MCPServerContext): Promise<void> {
  await context.serviceInitializer.shutdown("MCP server shutdown");
}

/**
 * MCP Server Configuration and Setup
 * Creates and configures the McpServer instance
 *
 * Now uses BrowserXRuntime for unified lifecycle management,
 * event loop coordination, and resource management.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { QueryEngine } from "@browserx/query-engine";
import {
  BrowserXRuntime,
  type BrowserXRuntimeConfig,
  createTestConfig,
} from "@browserx/runtime";
import { SessionManager, type SessionManagerConfig } from "../session/session-manager.ts";
import { PermissionGuard, type PermissionSet } from "../security/permission-guard.ts";

/**
 * MCP Server configuration
 */
export interface MCPServerConfig {
  name?: string;
  version?: string;
  permissions?: PermissionSet;
  sessionConfig?: SessionManagerConfig;
  queryEngineConfig?: {
    security?: {
      sandbox?: {
        enabled?: boolean;
        timeout?: number;
      };
    };
  };
  runtimeConfig?: Partial<BrowserXRuntimeConfig>;
}

/**
 * MCP Server context - shared across all tools and resources
 */
export interface MCPServerContext {
  runtime: BrowserXRuntime;
  queryEngine: QueryEngine;
  sessionManager: SessionManager;
  permissionGuard: PermissionGuard;
  config: MCPServerConfig;
}

/**
 * Create and configure the MCP server
 */
export async function createMCPServer(config: MCPServerConfig = {}): Promise<{
  server: McpServer;
  context: MCPServerContext;
}> {
  const resolvedConfig: MCPServerConfig = {
    name: config.name ?? "browserx-mcp",
    version: config.version ?? "0.1.0",
    permissions: config.permissions ?? "AUTOMATION",
    sessionConfig: config.sessionConfig ?? {},
    queryEngineConfig: config.queryEngineConfig ?? {},
    runtimeConfig: config.runtimeConfig ?? {},
  };

  // Create MCP server
  const server = new McpServer({
    name: resolvedConfig.name!,
    version: resolvedConfig.version!,
  });

  // Create BrowserX Runtime with unified lifecycle management
  // Use test config as base for MCP server (lower resource usage)
  const baseConfig = createTestConfig();
  const runtime = new BrowserXRuntime({
    config: {
      ...baseConfig,
      ...resolvedConfig.runtimeConfig,
      // Override signal handling - MCP server handles its own signals
      signals: {
        handleSIGINT: false,
        handleSIGTERM: false,
        handleSIGHUP: false,
      },
      // Configure browser pool based on session config
      browser: {
        ...baseConfig.browser,
        maxInstances: resolvedConfig.sessionConfig?.maxSessions ?? 10,
      },
      // Configure query engine sandbox
      query: {
        ...baseConfig.query,
        sandbox: {
          enabled: resolvedConfig.queryEngineConfig?.security?.sandbox?.enabled ?? true,
          timeout: resolvedConfig.queryEngineConfig?.security?.sandbox?.timeout ?? 30000,
        },
      },
    },
  });

  // Start the runtime (initializes event loops, browser pool, etc.)
  await runtime.start();

  // Get query engine from runtime (or create one if not available)
  let queryEngine = runtime.getQueryEngine() as QueryEngine | undefined;
  if (!queryEngine) {
    // Fallback: create standalone query engine
    queryEngine = new QueryEngine();
    await queryEngine.initialize({
      security: {
        sandbox: {
          enabled: resolvedConfig.queryEngineConfig?.security?.sandbox?.enabled ?? true,
          timeout: resolvedConfig.queryEngineConfig?.security?.sandbox?.timeout ?? 30000,
        },
      },
    });
  }

  // Create session manager (uses runtime's browser pool internally)
  const sessionManager = new SessionManager(resolvedConfig.sessionConfig);

  // Create permission guard
  const permissionGuard = new PermissionGuard(resolvedConfig.permissions);

  // Build context
  const context: MCPServerContext = {
    runtime,
    queryEngine,
    sessionManager,
    permissionGuard,
    config: resolvedConfig,
  };

  return { server, context };
}

/**
 * Shutdown the MCP server and cleanup resources
 */
export async function shutdownMCPServer(context: MCPServerContext): Promise<void> {
  // Shutdown session manager first (closes browser sessions)
  await context.sessionManager.shutdown();

  // Shutdown runtime (handles query engine, browser pool, event loops, etc.)
  await context.runtime.shutdown("MCP server shutdown");
}

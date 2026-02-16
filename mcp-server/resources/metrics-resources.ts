/**
 * Metrics Resources for MCP Server
 * Exposes engine metrics and statistics
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MCPServerContext } from "../server/mcp-server.ts";

/**
 * Register metrics resources with the MCP server
 */
export function registerMetricsResources(
  server: McpServer,
  context: MCPServerContext,
): void {
  // Query engine metrics
  server.resource(
    "query-engine-metrics",
    "metrics://query-engine",
    async (uri) => {
      try {
        // Only return metrics if query engine is already initialized
        if (!context.serviceInitializer.isQueryEngineReady()) {
          return {
            contents: [
              {
                uri: uri.href,
                mimeType: "application/json",
                text: JSON.stringify({ initialized: false, message: "Query engine not yet initialized" }, null, 2),
              },
            ],
          };
        }

        const queryEngine = await context.getQueryEngine();
        const metrics = queryEngine.getMetrics();

        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify(metrics, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    },
  );

  // Browser session pool metrics
  server.resource(
    "browser-pool-metrics",
    "metrics://browser-pool",
    async (uri) => {
      try {
        // Only return metrics if session manager is already initialized
        if (!context.serviceInitializer.isSessionManagerReady()) {
          return {
            contents: [
              {
                uri: uri.href,
                mimeType: "application/json",
                text: JSON.stringify({ initialized: false, message: "Session manager not yet initialized" }, null, 2),
              },
            ],
          };
        }

        const sessionManager = await context.getSessionManager();
        const stats = sessionManager.getPoolStats();

        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify(stats, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    },
  );

  // Server info
  server.resource(
    "server-info",
    "metrics://server",
    async (uri) => {
      try {
        // Get session stats only if session manager is ready
        let maxSessions = context.config.maxSessions ?? 10;
        let activeSessions = 0;

        if (context.serviceInitializer.isSessionManagerReady()) {
          const sessionManager = await context.getSessionManager();
          const poolStats = sessionManager.getPoolStats();
          maxSessions = poolStats.maxSessions;
          activeSessions = poolStats.activeSessions;
        }

        const info = {
          name: context.config.name,
          version: context.config.version,
          permissions: context.permissionGuard.getPermissionSetName(),
          grantedPermissions: context.permissionGuard.getGrantedPermissions(),
          maxSessions,
          activeSessions,
          queryEngineInitialized: context.serviceInitializer.isQueryEngineReady(),
          sessionManagerInitialized: context.serviceInitializer.isSessionManagerReady(),
          runtimeInitialized: context.serviceInitializer.isRuntimeReady(),
        };

        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify(info, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    },
  );
}

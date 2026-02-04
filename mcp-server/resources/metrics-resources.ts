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
        const metrics = context.queryEngine.getMetrics();

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
        const stats = context.sessionManager.getPoolStats();

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
        const info = {
          name: context.config.name,
          version: context.config.version,
          permissions: context.permissionGuard.getPermissionSetName(),
          grantedPermissions: context.permissionGuard.getGrantedPermissions(),
          maxSessions: context.sessionManager.getPoolStats().maxSessions,
          activeSessions: context.sessionManager.getPoolStats().activeSessions,
          queryEngineInitialized: context.queryEngine.isInitialized(),
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

/**
 * Visibility Resources for MCP Server
 * Exposes system visibility data as MCP resources
 *
 * Resources provide read-only access to server state for monitoring
 * and debugging purposes.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MCPServerContext } from "../server/mcp-server.ts";
import type { VisibilityService } from "../visibility/mod.ts";

/**
 * Register visibility resources with the MCP server
 */
export function registerVisibilityResources(
  server: McpServer,
  _context: MCPServerContext,
  visibilityService: VisibilityService,
): void {
  // Complete dashboard snapshot
  server.resource(
    "visibility-dashboard",
    "visibility://dashboard",
    async (uri) => {
      try {
        const dashboard = await visibilityService.getDashboard();

        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify(dashboard, null, 2),
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

  // Enhanced session information
  server.resource(
    "visibility-sessions",
    "visibility://sessions",
    async (uri) => {
      try {
        const sessions = await visibilityService.getEnhancedSessions();

        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify(
                {
                  timestamp: Date.now(),
                  count: sessions.length,
                  sessions,
                },
                null,
                2,
              ),
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

  // Running queries dashboard
  server.resource(
    "visibility-queries",
    "visibility://queries",
    async (uri) => {
      try {
        const queries = await visibilityService.getRunningQueries();

        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify(
                {
                  timestamp: Date.now(),
                  count: queries.length,
                  queries,
                },
                null,
                2,
              ),
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

  // Server health metrics
  server.resource(
    "visibility-health",
    "visibility://health",
    async (uri) => {
      try {
        const health = await visibilityService.getServerHealth();

        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify(
                {
                  timestamp: Date.now(),
                  ...health,
                },
                null,
                2,
              ),
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

  // Active operations
  server.resource(
    "visibility-operations",
    "visibility://operations",
    async (uri) => {
      try {
        const operations = visibilityService.operationTracker.getActiveOperations();
        const stats = visibilityService.operationTracker.getStats();

        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify(
                {
                  timestamp: Date.now(),
                  stats,
                  operations,
                },
                null,
                2,
              ),
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

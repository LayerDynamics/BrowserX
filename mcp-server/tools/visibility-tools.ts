/**
 * Visibility Tools for MCP Server
 * Tools for actively querying system state
 *
 * These tools provide INSTANT-tier access to server visibility data.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MCPServerContext } from "../server/mcp-server.ts";
import type { VisibilityService } from "../visibility/mod.ts";

/**
 * Register visibility tools with the MCP server
 */
export function registerVisibilityTools(
  server: McpServer,
  context: MCPServerContext,
  visibilityService: VisibilityService,
): void {
  // Get system dashboard
  server.tool(
    "system_dashboard",
    "Get a comprehensive snapshot of the BrowserX server status including health, sessions, running queries, and active operations. This is the primary tool for understanding server state.",
    {},
    async () => {
      try {
        const dashboard = await visibilityService.getDashboard();

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  data: dashboard,
                  timing: { total: 0 }, // Instant operation
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: false,
                  error: {
                    code: "INTERNAL_ERROR",
                    message: error instanceof Error ? error.message : String(error),
                    suggestion: "Try again or check server logs for details.",
                    retryable: true,
                    context: { tool: "system_dashboard" },
                  },
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Get detailed query status
  server.tool(
    "query_dashboard",
    "Get detailed status of all running and recent queries, including query metrics and performance data.",
    {},
    async () => {
      try {
        const queries = await visibilityService.getRunningQueries();

        // Get metrics only if query engine is already initialized
        let metricsData = {
          total: 0,
          successful: 0,
          failed: 0,
          cancelled: 0,
          timeout: 0,
          averageExecutionMs: 0,
          p50: 0,
          p95: 0,
          p99: 0,
        };
        let resourcesData = {
          browsers: 0,
          pages: 0,
          connections: 0,
          memoryUsage: 0,
        };

        if (context.serviceInitializer.isQueryEngineReady()) {
          const queryEngine = await context.getQueryEngine();
          const metrics = queryEngine.getMetrics();
          metricsData = {
            total: metrics.queries.total,
            successful: metrics.queries.successful,
            failed: metrics.queries.failed,
            cancelled: metrics.queries.cancelled,
            timeout: metrics.queries.timeout,
            averageExecutionMs: metrics.performance.averageExecutionTime,
            p50: metrics.performance.p50,
            p95: metrics.performance.p95,
            p99: metrics.performance.p99,
          };
          resourcesData = {
            browsers: metrics.resources.browsers,
            pages: metrics.resources.pages,
            connections: metrics.resources.connections,
            memoryUsage: metrics.resources.memoryUsage,
          };
        }

        const result = {
          timestamp: Date.now(),
          running: queries,
          metrics: metricsData,
          resources: resourcesData,
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  data: result,
                  timing: { total: 0 }, // Instant operation
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: false,
                  error: {
                    code: "INTERNAL_ERROR",
                    message: error instanceof Error ? error.message : String(error),
                    suggestion: "Try again or check server logs for details.",
                    retryable: true,
                    context: { tool: "query_dashboard" },
                  },
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }
    },
  );
}

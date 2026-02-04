/**
 * Query Engine Tools for MCP Server
 * Exposes BrowserX query language as MCP tools
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MCPServerContext } from "../server/mcp-server.ts";

/**
 * Register query engine tools with the MCP server
 */
export function registerQueryTools(
  server: McpServer,
  context: MCPServerContext,
): void {
  // Primary tool: Execute BrowserX query
  server.tool(
    "browserx_query",
    "Execute a BrowserX query using SQL-like syntax. Examples: SELECT title FROM 'https://example.com', NAVIGATE TO 'https://example.com', SELECT text FROM '.article'",
    {
      query: z.string().describe(
        "BrowserX query in SQL-like syntax. Supports SELECT, NAVIGATE, SET, SHOW, FOR, IF, INSERT, UPDATE, DELETE statements.",
      ),
      timeout: z.number().optional().describe("Query timeout in milliseconds (default: 30000)"),
      format: z
        .enum(["JSON", "TABLE", "CSV", "HTML", "XML", "YAML"])
        .optional()
        .describe("Output format (default: JSON)"),
    },
    async ({ query, timeout, format }) => {
      // Check permissions
      context.permissionGuard.checkToolPermission("browserx_query");

      try {
        const result = await context.queryEngine.execute(query, {
          timeout: timeout ?? 30000,
          format: format ?? "JSON",
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  data: result.data,
                  timing: result.timing,
                  metadata: {
                    stepsExecuted: result.metadata.stepsExecuted,
                    browserNavigations: result.metadata.browserNavigations,
                    cacheHits: result.metadata.cacheHits,
                    cacheMisses: result.metadata.cacheMisses,
                  },
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
                  error: error instanceof Error ? error.message : String(error),
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

  // Explain query execution plan without running
  server.tool(
    "browserx_query_explain",
    "Analyze a BrowserX query and return the execution plan without executing it. Useful for understanding query complexity and optimization.",
    {
      query: z.string().describe("BrowserX query to analyze"),
    },
    async ({ query }) => {
      context.permissionGuard.checkToolPermission("browserx_query_explain");

      try {
        // Use query engine internals to get execution plan
        const { Lexer } = await import("@browserx/query-engine");
        const { Parser } = await import("@browserx/query-engine");
        const { SemanticAnalyzer } = await import("@browserx/query-engine");
        const { QueryOptimizer } = await import("@browserx/query-engine");
        const { ExecutionPlanner } = await import("@browserx/query-engine");

        const lexer = new Lexer(query);
        const tokens = lexer.tokenize();

        const parser = new Parser(tokens);
        const ast = parser.parse();

        const analyzer = new SemanticAnalyzer({
          allowUndefinedVariables: false,
          strictTypeChecking: true,
        });
        const annotatedAST = analyzer.analyze(ast);

        const optimizer = new QueryOptimizer({
          enableConstantFolding: true,
          enableDeadCodeElimination: true,
          enablePredicatePushdown: true,
          enableProjectionPushdown: true,
          enableCacheOptimization: true,
          enableParallelDetection: true,
        });
        const optimizationResult = optimizer.optimize(annotatedAST.ast);

        const planner = new ExecutionPlanner();
        const plan = planner.plan(optimizationResult.optimizedAST, {
          optimizationApplied: true,
          appliedPasses: optimizationResult.appliedPasses,
          estimatedImprovement: optimizationResult.improvement,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  plan: {
                    steps: plan.steps.map((step) => ({
                      id: step.id,
                      type: step.type,
                      cacheable: step.cacheable,
                    })),
                    estimatedCost: plan.estimatedCost,
                    resources: plan.resources,
                    parallelGroups: plan.parallelGroups,
                  },
                  optimization: {
                    appliedPasses: optimizationResult.appliedPasses,
                    improvement: optimizationResult.improvement,
                  },
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
                  error: error instanceof Error ? error.message : String(error),
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

  // Execute query asynchronously
  server.tool(
    "browserx_query_async",
    "Execute a BrowserX query asynchronously and return a query ID for status tracking. Use for long-running queries.",
    {
      query: z.string().describe("BrowserX query to execute asynchronously"),
      timeout: z.number().optional().describe("Query timeout in milliseconds"),
      format: z.enum(["JSON", "TABLE", "CSV"]).optional().describe("Output format"),
    },
    async ({ query, timeout, format }) => {
      context.permissionGuard.checkToolPermission("browserx_query_async");

      try {
        const queryId = await context.queryEngine.executeAsync(query, {
          timeout: timeout ?? 60000,
          format: format ?? "JSON",
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  queryId,
                  status: "PENDING",
                  message: "Query submitted. Use browserx_query_status to check progress.",
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
                  error: error instanceof Error ? error.message : String(error),
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

  // Check async query status
  server.tool(
    "browserx_query_status",
    "Check the status of an asynchronous query by its ID.",
    {
      queryId: z.string().describe("Query ID returned by browserx_query_async"),
    },
    async ({ queryId }) => {
      context.permissionGuard.checkToolPermission("browserx_query_status");

      try {
        const status = await context.queryEngine.getQueryStatus(queryId);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  queryId: status.queryId,
                  state: status.state,
                  progress: status.progress,
                  stepsCompleted: status.stepsCompleted,
                  stepsTotal: status.stepsTotal,
                  error: status.error ? String(status.error) : undefined,
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
                  error: error instanceof Error ? error.message : String(error),
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

  // Cancel async query
  server.tool(
    "browserx_query_cancel",
    "Cancel a running asynchronous query.",
    {
      queryId: z.string().describe("Query ID to cancel"),
    },
    async ({ queryId }) => {
      context.permissionGuard.checkToolPermission("browserx_query_cancel");

      try {
        await context.queryEngine.cancelQuery(queryId);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  queryId,
                  message: "Query cancelled successfully",
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
                  error: error instanceof Error ? error.message : String(error),
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

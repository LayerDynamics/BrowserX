/**
 * Query Engine Tools for MCP Server
 * Exposes BrowserX query language as MCP tools with enhanced feedback
 *
 * Query tools use lazy initialization - QueryEngine is only
 * initialized on first query tool call, not at server startup.
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MCPServerContext } from "../server/mcp-server.ts";
import {
  withFeedback,
  withErrorHandling,
  PROGRESS_STAGES,
} from "../feedback/mod.ts";
import type { OutputFormat } from "@browserx/query-engine";

/**
 * Register query engine tools with the MCP server
 */
export function registerQueryTools(
  server: McpServer,
  context: MCPServerContext,
): void {
  // Primary tool: Execute BrowserX query (LONG tier)
  server.tool(
    "browserx_query",
    "Execute a BrowserX query using SQL-like syntax. Examples: SELECT title FROM 'https://example.com', NAVIGATE TO 'https://example.com', SELECT text FROM '.article'",
    {
      query: z.string().describe(
        "BrowserX query in SQL-like syntax. " +
        "Statements: SELECT (extract data), NAVIGATE (go to URL), INSERT (type text), CLICK (click element), " +
        "IF/THEN/ELSE (conditionals), FOR (loops), SET (configure), SHOW (display state). " +
        "Examples: \"SELECT title FROM 'https://example.com'\", \"NAVIGATE TO 'https://example.com' CAPTURE title\", " +
        "\"INSERT 'user@test.com' INTO '#email'\""
      ),
      timeout: z.number().optional().describe(
        "Query timeout in milliseconds. Default: 30000. Increase for complex queries or slow pages."
      ),
      format: z
        .enum(["JSON", "TABLE", "CSV", "HTML", "XML", "YAML"])
        .optional()
        .describe(
          "Output format for results. 'JSON' (default) for structured data, 'TABLE' for tabular display, " +
          "'CSV' for spreadsheet export."
        ),
    },
    withFeedback(
      server,
      "browserx_query",
      async (params, ctx) => {
        const { query, timeout, format, signal } = params as {
          query: string;
          timeout?: number;
          format?: OutputFormat;
          signal?: AbortSignal;
        };

        context.permissionGuard.checkToolPermission("browserx_query");

        const opId = context.visibilityService.operationTracker.startOperation(
          "query",
          `Execute query: ${query.substring(0, 50)}...`,
        );

        try {
          await ctx.progress.stage("PARSING", PROGRESS_STAGES.QUERY.PARSING);
          await ctx.progress.stage("EXECUTING", PROGRESS_STAGES.QUERY.EXECUTING);

          // Get query engine (lazy init)
          const queryEngine = await context.getQueryEngine();
          const result = await queryEngine.execute(query, {
            timeout: timeout ?? 30000,
            format: (format ?? "JSON") as OutputFormat,
            signal, // Pass the AbortSignal for cancellation
          });

          await ctx.progress.stage("FORMATTING", PROGRESS_STAGES.QUERY.FORMATTING);
          context.visibilityService.operationTracker.completeOperation(opId);

          return {
            data: {
              data: result.data,
              timing: result.timing,
              metadata: {
                stepsExecuted: result.metadata.stepsExecuted,
                browserNavigations: result.metadata.browserNavigations,
                cacheHits: result.metadata.cacheHits,
                cacheMisses: result.metadata.cacheMisses,
              },
            },
          };
        } catch (error) {
          context.visibilityService.operationTracker.completeOperation(opId, error as Error);
          throw error;
        }
      },
      { timeoutConfig: context.timeoutConfig },
    ),
  );

  // Explain query execution plan (SHORT tier)
  server.tool(
    "browserx_query_explain",
    "Analyze a BrowserX query and return the execution plan without executing it. Useful for understanding query complexity and optimization.",
    {
      query: z.string().describe(
        "BrowserX query to analyze. Returns execution plan WITHOUT running the query. " +
        "Use this to preview complex queries before execution."
      ),
      timeout: z.number().optional().describe("Analysis timeout in milliseconds. Default: 5000."),
    },
    withFeedback(
      server,
      "browserx_query_explain",
      async (params, _ctx) => {
        const { query } = params as { query: string };

        context.permissionGuard.checkToolPermission("browserx_query_explain");

        const opId = context.visibilityService.operationTracker.startOperation(
          "other",
          "Explain query",
        );

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

          context.visibilityService.operationTracker.completeOperation(opId);

          return {
            data: {
              plan: {
                steps: plan.steps.map((step: { id: string; type: string; cacheable: boolean }) => ({
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
          };
        } catch (error) {
          context.visibilityService.operationTracker.completeOperation(opId, error as Error);
          throw error;
        }
      },
      { enableProgress: false, timeoutConfig: context.timeoutConfig },
    ),
  );

  // Execute query asynchronously (LONG tier)
  server.tool(
    "browserx_query_async",
    "Execute a BrowserX query asynchronously and return a query ID for status tracking. Use for long-running queries.",
    {
      query: z.string().describe(
        "BrowserX query to execute asynchronously. Use for long-running queries that may exceed " +
        "normal timeout. Returns queryId immediately - use browserx_query_status to poll for results."
      ),
      timeout: z.number().optional().describe(
        "Query timeout in milliseconds. Default: 60000 (1 minute). Can be much higher for async queries."
      ),
      format: z.enum(["JSON", "TABLE", "CSV"]).optional().describe(
        "Output format for results when query completes. Default: 'JSON'."
      ),
    },
    withFeedback(
      server,
      "browserx_query_async",
      async (params, _ctx) => {
        const { query, timeout, format } = params as {
          query: string;
          timeout?: number;
          format?: OutputFormat;
        };

        context.permissionGuard.checkToolPermission("browserx_query_async");

        const opId = context.visibilityService.operationTracker.startOperation(
          "query",
          `Submit async query`,
        );

        try {
          const queryEngine = await context.getQueryEngine();
          const queryId = await queryEngine.executeAsync(query, {
            timeout: timeout ?? 60000,
            format: (format ?? "JSON") as OutputFormat,
          });

          context.visibilityService.operationTracker.completeOperation(opId);

          return {
            data: {
              queryId,
              status: "PENDING",
              message: "Query submitted. Use browserx_query_status to check progress.",
            },
          };
        } catch (error) {
          context.visibilityService.operationTracker.completeOperation(opId, error as Error);
          throw error;
        }
      },
      { enableProgress: false, timeoutConfig: context.timeoutConfig },
    ),
  );

  // Check async query status (INSTANT tier)
  server.tool(
    "browserx_query_status",
    "Check the status of an asynchronous query by its ID.",
    {
      queryId: z.string().describe(
        "Query ID from browserx_query_async. Returns state (PENDING, RUNNING, COMPLETED, FAILED) " +
        "and progress info. Poll this until state is COMPLETED or FAILED."
      ),
    },
    withErrorHandling(
      "browserx_query_status",
      async (params) => {
        const { queryId } = params as { queryId: string };
        context.permissionGuard.checkToolPermission("browserx_query_status");

        // If query engine not initialized, query doesn't exist
        if (!context.serviceInitializer.isQueryEngineReady()) {
          return {
            queryId,
            state: "NOT_FOUND",
            error: "Query not found (query engine not initialized)",
          };
        }

        const queryEngine = await context.getQueryEngine();
        const status = await queryEngine.getQueryStatus(queryId);

        return {
          queryId: status.queryId,
          state: status.state,
          progress: status.progress,
          stepsCompleted: status.stepsCompleted,
          stepsTotal: status.stepsTotal,
          error: status.error ? String(status.error) : undefined,
        };
      },
      { timeoutConfig: context.timeoutConfig },
    ),
  );

  // Cancel async query (INSTANT tier)
  server.tool(
    "browserx_query_cancel",
    "Cancel a running asynchronous query.",
    {
      queryId: z.string().describe(
        "Query ID from browserx_query_async to cancel. Use when a query is taking too long " +
        "or no longer needed. Cancelled queries cannot be resumed."
      ),
    },
    withErrorHandling(
      "browserx_query_cancel",
      async (params) => {
        const { queryId } = params as { queryId: string };
        context.permissionGuard.checkToolPermission("browserx_query_cancel");

        // If query engine not initialized, query doesn't exist
        if (!context.serviceInitializer.isQueryEngineReady()) {
          return {
            queryId,
            message: "Query not found (query engine not initialized)",
          };
        }

        const queryEngine = await context.getQueryEngine();
        await queryEngine.cancelQuery(queryId);

        return {
          queryId,
          message: "Query cancelled successfully",
        };
      },
      { timeoutConfig: context.timeoutConfig },
    ),
  );
}

import { ProcessTraceModel } from "../ProcessTraceModel.ts";
import type { ProcessTrace, StageNode, StageEdge, StageStatus, StageTiming } from "../types.ts";

// ---------------------------------------------------------------------------
// Local input interfaces — no proxy-engine imports
// ---------------------------------------------------------------------------

export interface ProxyMiddlewareStepInput {
  name: string;
  result:
    | { type: "continue" }
    | { type: "respond"; statusCode: number }
    | { type: "error"; message: string };
  timing: number; // duration in ms
}

export interface ProxyUpstreamInput {
  host: string;
  port: number;
  statusCode: number;
  statusText: string;
  headers: Record<string, string>;
  bodySize: number;
  timing: number;
}

export interface ProxyResponseMiddlewareInput {
  name: string;
  timing: number;
  outputSummary: string; // e.g. "gzip, 42KB → 12KB"
}

export interface ProxyTraceInput {
  method: string;
  url: string;
  clientIP: string;
  routeId: string;
  routePattern: string;
  routePriority: number;
  requestMiddleware: ProxyMiddlewareStepInput[];
  upstream: ProxyUpstreamInput;
  responseMiddleware: ProxyResponseMiddlewareInput[];
  totalTime: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createIdGenerator(): (prefix: string) => string {
  let counter = 0;
  return (prefix: string) => `${prefix}-${++counter}`;
}

function wallClock(cursor: number, duration: number): StageTiming {
  return { startTime: cursor, endTime: cursor + duration, duration };
}

function middlewareStatus(
  result: ProxyMiddlewareStepInput["result"],
): StageStatus {
  return result.type === "error" ? "error" : "completed";
}

function middlewareSummary(result: ProxyMiddlewareStepInput["result"]): string {
  if (result.type === "continue") return "passthrough";
  if (result.type === "respond") return `respond: ${result.statusCode}`;
  return `error: ${result.message}`;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

/**
 * Converts a proxy request trace (middleware chain + upstream) into a linear
 * ProcessTrace.  The chain is built left-to-right:
 *
 *   Incoming Request
 *     → [request middlewares]
 *     → Route Match            (skipped on short-circuit)
 *     → Upstream               (skipped on short-circuit)
 *     → [response middlewares] (skipped on short-circuit)
 *     → Final Response / Short-Circuit Response
 */
export class ProxyMiddlewareAdapter {
  static fromProxyRequest(input: ProxyTraceInput): ProcessTrace {
    const nextId = createIdGenerator();
    const stages: StageNode[] = [];
    const edges: StageEdge[] = [];

    // Running wall-clock cursor (ms from start)
    let cursor = 0;

    // Helper: append a stage and wire it to the previous one.
    function addStage(stage: StageNode, edgeLabel: string): void {
      if (stages.length > 0) {
        const prev = stages[stages.length - 1];
        edges.push({
          id: `${prev.id}->${stage.id}`,
          sourceStage: prev.id,
          targetStage: stage.id,
          dataFlowLabel: edgeLabel,
        });
      }
      stages.push(stage);
    }

    // -----------------------------------------------------------------------
    // 1. Incoming Request
    // -----------------------------------------------------------------------
    const incomingId = nextId("incoming");
    addStage(
      {
        id: incomingId,
        stage: "Incoming Request",
        pipeline: "proxy",
        status: "completed",
        timing: wallClock(cursor, 0),
        inputSummary: `${input.method} ${input.url}`,
        outputData: { method: input.method, url: input.url, clientIP: input.clientIP },
        outputSummary: `${input.method} ${_urlPath(input.url)} from ${input.clientIP}`,
        metrics: { method: input.method, clientIP: input.clientIP },
      },
      "HTTP request",
    );

    // -----------------------------------------------------------------------
    // 2. Request middleware — short-circuit detection
    // -----------------------------------------------------------------------
    let shortCircuited = false;
    let isFirstRequestMiddleware = true;

    for (const mw of input.requestMiddleware) {
      cursor += mw.timing;
      const mwId = nextId("req-mw");
      const mwStatus = middlewareStatus(mw.result);
      const mwSummary = middlewareSummary(mw.result);

      // The first middleware receives the incoming request — label that edge
      // "HTTP request"; subsequent middleware-to-middleware edges use
      // "respond" or "passthrough" based on the previous middleware result.
      const incomingEdgeLabel = isFirstRequestMiddleware
        ? "HTTP request"
        : mw.result.type === "respond"
        ? "respond"
        : "passthrough";
      isFirstRequestMiddleware = false;

      addStage(
        {
          id: mwId,
          stage: `Middleware: ${mw.name}`,
          pipeline: "proxy",
          status: mwStatus,
          timing: wallClock(cursor - mw.timing, mw.timing),
          inputSummary: `Request middleware ${mw.name}`,
          outputData: mw.result,
          outputSummary: mwSummary,
          metrics: { duration: mw.timing, resultType: mw.result.type },
          error: mw.result.type === "error" ? new Error(mw.result.message) : undefined,
        },
        incomingEdgeLabel,
      );

      if (mw.result.type === "respond" || mw.result.type === "error") {
        shortCircuited = true;
        break;
      }
    }

    // -----------------------------------------------------------------------
    // Short-circuit: add final stage and return early
    // -----------------------------------------------------------------------
    if (shortCircuited) {
      const scId = nextId("short-circuit");
      const lastMw = stages[stages.length - 1];
      addStage(
        {
          id: scId,
          stage: "Short-Circuit Response",
          pipeline: "proxy",
          status: "completed",
          timing: wallClock(cursor, 0),
          inputSummary: `Short-circuit from ${lastMw.stage}`,
          outputData: lastMw.outputData,
          outputSummary: `Short-circuited after ${lastMw.stage}`,
          metrics: { shortCircuit: true, duration: 0 },
        },
        "short-circuit",
      );

      return ProcessTraceModel.fromStages("proxy", stages, edges, {
        method: input.method,
        url: input.url,
        totalTime: input.totalTime,
        shortCircuited: true,
      });
    }

    // -----------------------------------------------------------------------
    // 3. Route Match
    // When all request middlewares passed through (continue), the edge
    // carrying the request from the last middleware to the route matcher
    // is labelled "passthrough".  If there were no middlewares the request
    // flows directly from "Incoming Request" and is labelled "route".
    // -----------------------------------------------------------------------
    const routeIncomingLabel = input.requestMiddleware.length > 0 ? "passthrough" : "route";
    const routeId = nextId("route");
    addStage(
      {
        id: routeId,
        stage: "Route Match",
        pipeline: "proxy",
        status: "completed",
        timing: wallClock(cursor, 0),
        inputSummary: `Route lookup for ${input.url}`,
        outputData: {
          routeId: input.routeId,
          pattern: input.routePattern,
          priority: input.routePriority,
        },
        outputSummary: `${input.routeId} (priority ${input.routePriority})`,
        metrics: {
          routeId: input.routeId,
          pattern: input.routePattern,
          priority: input.routePriority,
        },
      },
      routeIncomingLabel,
    );

    // -----------------------------------------------------------------------
    // 4. Upstream
    // -----------------------------------------------------------------------
    cursor += input.upstream.timing;
    const upstreamId = nextId("upstream");
    addStage(
      {
        id: upstreamId,
        stage: `Upstream: ${input.upstream.host}:${input.upstream.port}`,
        pipeline: "proxy",
        status: "completed",
        timing: wallClock(cursor - input.upstream.timing, input.upstream.timing),
        inputSummary: `${input.method} ${input.upstream.host}:${input.upstream.port}`,
        outputData: {
          statusCode: input.upstream.statusCode,
          statusText: input.upstream.statusText,
          headers: input.upstream.headers,
          bodySize: input.upstream.bodySize,
        },
        outputSummary: `${input.upstream.statusCode} ${input.upstream.statusText}`,
        metrics: {
          statusCode: input.upstream.statusCode,
          bodySize: input.upstream.bodySize,
          duration: input.upstream.timing,
        },
      },
      "route",
    );

    // -----------------------------------------------------------------------
    // 5. Response middleware
    // The first response middleware immediately follows the upstream — its
    // incoming edge is labelled "upstream request" (the upstream sent back a
    // response).  All subsequent middleware edges use "HTTP response".
    // -----------------------------------------------------------------------
    let isFirstResponseMiddleware = true;
    for (const rmw of input.responseMiddleware) {
      cursor += rmw.timing;
      const rmwId = nextId("res-mw");
      const rmwEdgeLabel = isFirstResponseMiddleware ? "upstream request" : "HTTP response";
      isFirstResponseMiddleware = false;
      addStage(
        {
          id: rmwId,
          stage: `Middleware: ${rmw.name}`,
          pipeline: "proxy",
          status: "completed",
          timing: wallClock(cursor - rmw.timing, rmw.timing),
          inputSummary: `Response middleware ${rmw.name}`,
          outputData: {},
          outputSummary: rmw.outputSummary,
          metrics: { duration: rmw.timing },
        },
        rmwEdgeLabel,
      );
    }

    // -----------------------------------------------------------------------
    // 6. Final Response
    // When there were response middlewares, the edge from the last middleware
    // to Final Response is "HTTP response".  When there are none, the edge
    // from Upstream to Final Response carries "upstream request".
    // -----------------------------------------------------------------------
    const finalEdgeLabel = input.responseMiddleware.length > 0 ? "HTTP response" : "upstream request";
    const finalId = nextId("final");
    const lastStage = stages[stages.length - 1];
    addStage(
      {
        id: finalId,
        stage: "Final Response",
        pipeline: "proxy",
        status: "completed",
        timing: wallClock(cursor, 0),
        inputSummary: `Response from upstream ${input.upstream.host}:${input.upstream.port}`,
        outputData: lastStage.outputData,
        outputSummary: `${input.upstream.statusCode} ${input.upstream.statusText}`,
        metrics: {
          statusCode: input.upstream.statusCode,
          totalTime: input.totalTime,
          duration: 0,
        },
      },
      finalEdgeLabel,
    );

    return ProcessTraceModel.fromStages("proxy", stages, edges, {
      method: input.method,
      url: input.url,
      totalTime: input.totalTime,
      shortCircuited: false,
    });
  }
}

// ---------------------------------------------------------------------------
// Private utility
// ---------------------------------------------------------------------------

/** Extract just the path+query portion of a URL for display. */
function _urlPath(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch {
    return url;
  }
}

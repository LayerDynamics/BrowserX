import { assertEquals, assertExists } from "@std/assert";
import { ProxyMiddlewareAdapter } from "../../../src/canvas/adapters/ProxyMiddlewareAdapter.ts";
import type {
  ProxyTraceInput,
  ProxyMiddlewareStepInput,
  ProxyUpstreamInput,
  ProxyResponseMiddlewareInput,
} from "../../../src/canvas/adapters/ProxyMiddlewareAdapter.ts";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeUpstream(overrides: Partial<ProxyUpstreamInput> = {}): ProxyUpstreamInput {
  return {
    host: "api.example.com",
    port: 443,
    statusCode: 200,
    statusText: "OK",
    headers: { "content-type": "application/json" },
    bodySize: 1024,
    timing: 80,
    ...overrides,
  };
}

function makeTrace(overrides: Partial<ProxyTraceInput> = {}): ProxyTraceInput {
  return {
    method: "GET",
    url: "https://proxy.example.com/api/users",
    clientIP: "10.0.0.1",
    routeId: "route-api",
    routePattern: "/api/*",
    routePriority: 10,
    requestMiddleware: [],
    upstream: makeUpstream(),
    responseMiddleware: [],
    totalTime: 120,
    ...overrides,
  };
}

function continueMw(name: string, timing = 5): ProxyMiddlewareStepInput {
  return { name, result: { type: "continue" }, timing };
}

function respondMw(name: string, statusCode: number, timing = 3): ProxyMiddlewareStepInput {
  return { name, result: { type: "respond", statusCode }, timing };
}

function errorMw(name: string, message: string, timing = 2): ProxyMiddlewareStepInput {
  return { name, result: { type: "error", message }, timing };
}

function responseMw(name: string, summary: string, timing = 10): ProxyResponseMiddlewareInput {
  return { name, timing, outputSummary: summary };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test("ProxyMiddlewareAdapter - creates correct number of stages (no middleware)", () => {
  // With no request/response middleware: incoming + route + upstream + final = 4
  const trace = ProxyMiddlewareAdapter.fromProxyRequest(makeTrace());

  assertEquals(trace.stages.length, 4);
});

Deno.test("ProxyMiddlewareAdapter - creates correct number of stages with middleware", () => {
  // incoming(1) + req_mw(2) + route(1) + upstream(1) + res_mw(2) + final(1) = 8
  const trace = ProxyMiddlewareAdapter.fromProxyRequest(
    makeTrace({
      requestMiddleware: [continueMw("auth"), continueMw("ratelimit")],
      responseMiddleware: [responseMw("gzip", "gzip, 8KB → 2KB"), responseMw("cache", "cached")],
    }),
  );

  assertEquals(trace.stages.length, 8);
});

Deno.test("ProxyMiddlewareAdapter - short-circuit middleware terminates chain", () => {
  // incoming(1) + auth-continue(1) + respond-mw(1) + short-circuit(1) = 4
  const trace = ProxyMiddlewareAdapter.fromProxyRequest(
    makeTrace({
      requestMiddleware: [continueMw("auth"), respondMw("ip-block", 403)],
      // responseMiddleware and upstream should NOT appear
    }),
  );

  // Should NOT have route, upstream, or response middleware stages
  const stageNames = trace.stages.map((s) => s.stage);
  assertEquals(stageNames.includes("Route Match"), false);
  assertEquals(stageNames.includes("Short-Circuit Response"), true);
  assertEquals(trace.stages.length, 4);
  assertEquals(trace.metadata["shortCircuited"], true);
});

Deno.test("ProxyMiddlewareAdapter - route match stage shows pattern and priority", () => {
  const trace = ProxyMiddlewareAdapter.fromProxyRequest(
    makeTrace({ routeId: "route-v2", routePattern: "/v2/*", routePriority: 5 }),
  );

  const routeStage = trace.stages.find((s) => s.stage === "Route Match");
  assertExists(routeStage);
  assertEquals(routeStage.outputSummary, "route-v2 (priority 5)");

  const data = routeStage.outputData as Record<string, unknown>;
  assertEquals(data["routeId"], "route-v2");
  assertEquals(data["pattern"], "/v2/*");
  assertEquals(data["priority"], 5);
});

Deno.test("ProxyMiddlewareAdapter - upstream stage shows host and port", () => {
  const trace = ProxyMiddlewareAdapter.fromProxyRequest(
    makeTrace({ upstream: makeUpstream({ host: "backend.internal", port: 8080 }) }),
  );

  const upstreamStage = trace.stages.find((s) => s.stage.startsWith("Upstream:"));
  assertExists(upstreamStage);
  assertEquals(upstreamStage.stage, "Upstream: backend.internal:8080");
  assertEquals(upstreamStage.outputSummary, "200 OK");
});

Deno.test("ProxyMiddlewareAdapter - response middleware stages show outputSummary from input", () => {
  const trace = ProxyMiddlewareAdapter.fromProxyRequest(
    makeTrace({
      responseMiddleware: [responseMw("compress", "gzip, 42KB → 12KB")],
    }),
  );

  const resMwStage = trace.stages.find((s) => s.stage === "Middleware: compress");
  assertExists(resMwStage);
  assertEquals(resMwStage.outputSummary, "gzip, 42KB → 12KB");
});

Deno.test("ProxyMiddlewareAdapter - incoming request stage has method, url, clientIP", () => {
  const trace = ProxyMiddlewareAdapter.fromProxyRequest(
    makeTrace({
      method: "POST",
      url: "https://proxy.example.com/api/submit",
      clientIP: "192.168.1.50",
    }),
  );

  const incoming = trace.stages[0];
  assertEquals(incoming.stage, "Incoming Request");

  const data = incoming.outputData as Record<string, unknown>;
  assertEquals(data["method"], "POST");
  assertEquals(data["url"], "https://proxy.example.com/api/submit");
  assertEquals(data["clientIP"], "192.168.1.50");
  assertEquals(incoming.outputSummary, "POST /api/submit from 192.168.1.50");
});

Deno.test("ProxyMiddlewareAdapter - edge labels show request/response flow", () => {
  const trace = ProxyMiddlewareAdapter.fromProxyRequest(
    makeTrace({
      requestMiddleware: [continueMw("auth")],
      responseMiddleware: [responseMw("gzip", "compressed")],
    }),
  );

  const edgeLabels = trace.edges.map((e) => e.dataFlowLabel);

  // First edge from incoming → req middleware should indicate request flow
  assertEquals(edgeLabels.includes("HTTP request"), true);
  // At least one edge should carry "HTTP response" for response middleware
  assertEquals(edgeLabels.includes("HTTP response"), true);
  // Req middleware to route should be "passthrough"
  assertEquals(edgeLabels.includes("passthrough"), true);
  // Route to upstream
  assertEquals(edgeLabels.includes("route"), true);
  // Upstream to first response middleware
  const upstreamResponseIdx = edgeLabels.indexOf("upstream request");
  assertEquals(upstreamResponseIdx >= 0, true);
});

Deno.test("ProxyMiddlewareAdapter - handles empty middleware chains (incoming → route → upstream → final)", () => {
  const trace = ProxyMiddlewareAdapter.fromProxyRequest(makeTrace());

  const stageNames = trace.stages.map((s) => s.stage);
  assertEquals(stageNames[0], "Incoming Request");
  assertEquals(stageNames[1], "Route Match");
  assertEquals(stageNames[2].startsWith("Upstream:"), true);
  assertEquals(stageNames[3], "Final Response");

  // 3 edges: incoming→route, route→upstream, upstream→final
  assertEquals(trace.edges.length, 3);
});

Deno.test("ProxyMiddlewareAdapter - error middleware stage has error status", () => {
  const trace = ProxyMiddlewareAdapter.fromProxyRequest(
    makeTrace({
      requestMiddleware: [errorMw("waf", "blocked by WAF rule #42")],
    }),
  );

  const errorStage = trace.stages.find((s) => s.stage === "Middleware: waf");
  assertExists(errorStage);
  assertEquals(errorStage.status, "error");
  assertExists(errorStage.error);
  assertEquals(errorStage.error!.message, "blocked by WAF rule #42");

  // Short-circuit after error middleware
  assertEquals(trace.metadata["shortCircuited"], true);
});

Deno.test("ProxyMiddlewareAdapter - all stages have timing set (non-negative duration)", () => {
  const trace = ProxyMiddlewareAdapter.fromProxyRequest(
    makeTrace({
      requestMiddleware: [continueMw("auth", 15)],
      upstream: makeUpstream({ timing: 90 }),
      responseMiddleware: [responseMw("gzip", "compressed", 8)],
    }),
  );

  for (const stage of trace.stages) {
    assertExists(stage.timing, `stage ${stage.stage} missing timing`);
    assertEquals(
      stage.timing.duration >= 0,
      true,
      `stage ${stage.stage} has negative duration`,
    );
    assertEquals(
      stage.timing.endTime >= stage.timing.startTime,
      true,
      `stage ${stage.stage} endTime < startTime`,
    );
  }
});

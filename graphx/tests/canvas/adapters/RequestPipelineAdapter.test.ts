import { assertEquals, assertExists } from "@std/assert";
import { RequestPipelineAdapter } from "../../../src/canvas/adapters/RequestPipelineAdapter.ts";

/** Build a standard non-cached full-network request result */
function makeResult(overrides: Partial<{
  fromCache: boolean;
  timing: {
    dnsLookup: number;
    tcpConnection: number;
    tlsHandshake: number;
    requestSent: number;
    firstByte: number;
    download: number;
    total: number;
  };
}> = {}) {
  return {
    request: {
      method: "GET",
      url: "https://example.com/path?q=1",
      headers: new Map<string, string>([
        ["Accept", "text/html"],
        ["User-Agent", "BrowserX/1.0"],
        ["Cache-Control", "no-cache"],
      ]),
    },
    response: {
      statusCode: 200,
      statusText: "OK",
      headers: new Map<string, string>([
        ["Content-Type", "text/html"],
        ["Content-Length", "8192"],
      ]),
      body: new Uint8Array(8192),
    },
    fromCache: false,
    timing: {
      dnsLookup: 25,
      tcpConnection: 40,
      tlsHandshake: 60,
      requestSent: 5,
      firstByte: 80,
      download: 30,
      total: 240,
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test 1: Creates 6 stages from a non-cached result
// ---------------------------------------------------------------------------
Deno.test("RequestPipelineAdapter - creates 6 stages from non-cached result", () => {
  const result = makeResult();
  const trace = RequestPipelineAdapter.fromRequestResult(result);

  assertEquals(trace.stages.length, 6);
  assertEquals(trace.pipeline, "request");
  const names = trace.stages.map((s) => s.stage);
  assertEquals(names, [
    "Cache Check",
    "DNS Resolution",
    "TCP Connection",
    "TLS Handshake",
    "Request Send",
    "Response Receive",
  ]);
});

// ---------------------------------------------------------------------------
// Test 2: Cache HIT creates only 2 stages
// ---------------------------------------------------------------------------
Deno.test("RequestPipelineAdapter - cache HIT creates 2 stages", () => {
  const result = makeResult({ fromCache: true });
  const trace = RequestPipelineAdapter.fromRequestResult(result);

  assertEquals(trace.stages.length, 2);
  const names = trace.stages.map((s) => s.stage);
  assertEquals(names, ["Cache Check", "Cached Response"]);
  assertEquals(trace.stages[0].outputSummary, "HIT");
});

// ---------------------------------------------------------------------------
// Test 3: DNS stage shows timing in metrics
// ---------------------------------------------------------------------------
Deno.test("RequestPipelineAdapter - DNS stage shows timing in metrics", () => {
  const result = makeResult();
  const trace = RequestPipelineAdapter.fromRequestResult(result);

  const dnsStage = trace.stages.find((s) => s.stage === "DNS Resolution");
  assertExists(dnsStage);
  assertEquals(dnsStage.timing.duration, 25);
  assertEquals(dnsStage.metrics.dnsLookup, 25);
  assertEquals(dnsStage.outputSummary, "25ms");
});

// ---------------------------------------------------------------------------
// Test 4: Request stage outputData contains the full request with headers
// ---------------------------------------------------------------------------
Deno.test("RequestPipelineAdapter - Request Send outputData contains full request", () => {
  const result = makeResult();
  const trace = RequestPipelineAdapter.fromRequestResult(result);

  const reqStage = trace.stages.find((s) => s.stage === "Request Send");
  assertExists(reqStage);
  const data = reqStage.outputData as typeof result.request;
  assertEquals(data.method, "GET");
  assertEquals(data.url, "https://example.com/path?q=1");
  assertEquals(data.headers, result.request.headers);
});

// ---------------------------------------------------------------------------
// Test 5: Response stage outputData contains statusCode and headers
// ---------------------------------------------------------------------------
Deno.test("RequestPipelineAdapter - Response Receive outputData contains response with statusCode", () => {
  const result = makeResult();
  const trace = RequestPipelineAdapter.fromRequestResult(result);

  const respStage = trace.stages.find((s) => s.stage === "Response Receive");
  assertExists(respStage);
  const data = respStage.outputData as typeof result.response;
  assertEquals(data.statusCode, 200);
  assertEquals(data.statusText, "OK");
  assertEquals(data.headers, result.response.headers);
});

// ---------------------------------------------------------------------------
// Test 6: Stage timing maps correctly to timing fields
// ---------------------------------------------------------------------------
Deno.test("RequestPipelineAdapter - stage timing duration matches timing fields", () => {
  const result = makeResult();
  const trace = RequestPipelineAdapter.fromRequestResult(result);
  const t = result.timing;

  // DNS
  assertEquals(trace.stages[1].timing.duration, t.dnsLookup);
  // TCP
  assertEquals(trace.stages[2].timing.duration, t.tcpConnection);
  // TLS
  assertEquals(trace.stages[3].timing.duration, t.tlsHandshake);
  // Request Send
  assertEquals(trace.stages[4].timing.duration, t.requestSent);
  // Response Receive combines firstByte + download
  assertEquals(trace.stages[5].timing.duration, t.firstByte + t.download);
});

// ---------------------------------------------------------------------------
// Test 7: Handles zero TLS time — stage exists but is marked as skipped
// ---------------------------------------------------------------------------
Deno.test("RequestPipelineAdapter - zero TLS time creates skipped TLS stage", () => {
  const result = makeResult({
    timing: {
      dnsLookup: 20,
      tcpConnection: 35,
      tlsHandshake: 0,
      requestSent: 5,
      firstByte: 70,
      download: 25,
      total: 155,
    },
  });
  const trace = RequestPipelineAdapter.fromRequestResult(result);

  // All 6 stages still present
  assertEquals(trace.stages.length, 6);

  const tlsStage = trace.stages.find((s) => s.stage === "TLS Handshake");
  assertExists(tlsStage);
  assertEquals(tlsStage.timing.duration, 0);
  assertEquals(tlsStage.outputSummary, "skipped (HTTP)");
  assertEquals(tlsStage.metrics.skipped, true);
});

// ---------------------------------------------------------------------------
// Test 8: Edge labels describe data types flowing between stages
// ---------------------------------------------------------------------------
Deno.test("RequestPipelineAdapter - edge labels describe flowing data types", () => {
  const result = makeResult();
  const trace = RequestPipelineAdapter.fromRequestResult(result);

  assertEquals(trace.edges.length, 5);
  const labels = trace.edges.map((e) => e.dataFlowLabel);
  assertEquals(labels, [
    "IP address",
    "TCP stream",
    "TLS channel",
    "HTTP request",
    "HTTP response",
  ]);
});

// ---------------------------------------------------------------------------
// Test 9: Metrics include statusCode, bodySize, headerCount on response stage
// ---------------------------------------------------------------------------
Deno.test("RequestPipelineAdapter - response stage metrics include statusCode, bodySize, headerCount", () => {
  const result = makeResult();
  const trace = RequestPipelineAdapter.fromRequestResult(result);

  const respStage = trace.stages.find((s) => s.stage === "Response Receive");
  assertExists(respStage);
  assertEquals(respStage.metrics.statusCode, 200);
  assertEquals(respStage.metrics.bodySize, 8192);
  assertEquals(respStage.metrics.headerCount, 2); // Content-Type + Content-Length
});

// ---------------------------------------------------------------------------
// Test 10: outputSummary strings are formatted correctly
// ---------------------------------------------------------------------------
Deno.test("RequestPipelineAdapter - output summaries are formatted correctly", () => {
  const result = makeResult();
  const trace = RequestPipelineAdapter.fromRequestResult(result);

  // Cache Check MISS
  assertEquals(trace.stages[0].outputSummary, "MISS");

  // DNS Resolution: "{ms}ms"
  assertEquals(trace.stages[1].outputSummary, "25ms");

  // Request Send: "METHOD /path HTTP/1.1, N headers"
  const reqSummary = trace.stages[4].outputSummary;
  assertEquals(reqSummary, "GET /path?q=1 HTTP/1.1, 3 headers");

  // Response Receive: "STATUS statusText, N bytes, N headers"
  const respSummary = trace.stages[5].outputSummary;
  assertEquals(respSummary, "200 OK, 8192 bytes, 2 headers");
});

import type { ProcessTrace, StageNode, StageEdge } from "../types.ts";
import { ProcessTraceModel } from "../ProcessTraceModel.ts";

/** Input shape for the request pipeline adapter — defined locally, no browser/proxy engine import */
export interface RequestTraceInput {
  request: {
    method: string;
    url: string;
    headers: Record<string, string> | Map<string, string>;
  };
  response: {
    statusCode: number;
    statusText: string;
    headers: Record<string, string> | Map<string, string>;
    body?: { length?: number; byteLength?: number } | Uint8Array;
  };
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
}

/** Get the number of headers from either a Map or a plain Record */
function headerCount(headers: Record<string, string> | Map<string, string>): number {
  if (headers instanceof Map) return headers.size;
  return Object.keys(headers).length;
}

/** Get body size in bytes from the various shapes the body can take */
function bodySize(body: { length?: number; byteLength?: number } | Uint8Array | undefined): number {
  if (body === undefined || body === null) return 0;
  if (body instanceof Uint8Array) return body.byteLength;
  if (typeof (body as { byteLength?: number }).byteLength === "number") {
    return (body as { byteLength: number }).byteLength;
  }
  if (typeof (body as { length?: number }).length === "number") {
    return (body as { length: number }).length;
  }
  return 0;
}

/** Extract just the path + query from a URL string, falling back to the raw URL */
function urlPath(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname + parsed.search;
  } catch {
    return url;
  }
}

/**
 * Adapter that converts a BrowserX request pipeline result into a ProcessTrace.
 * Produces a 2-stage trace on cache HIT or a full 6-stage trace on cache MISS.
 * Does NOT import from browser/src/ or proxy-engine/ — uses the local RequestTraceInput shape.
 */
export class RequestPipelineAdapter {
  /**
   * Convert a request pipeline result into a ProcessTrace.
   * Returns 2 stages for cache hits, 6 stages for full network requests.
   */
  static fromRequestResult(result: RequestTraceInput): ProcessTrace {
    if (result.fromCache) {
      return RequestPipelineAdapter._buildCacheHitTrace(result);
    }
    return RequestPipelineAdapter._buildFullTrace(result);
  }

  // -------------------------------------------------------------------------
  // Cache-hit path: 2 stages
  // -------------------------------------------------------------------------
  private static _buildCacheHitTrace(result: RequestTraceInput): ProcessTrace {
    const t = result.timing;
    const respHeaders = headerCount(result.response.headers);
    const bytes = bodySize(result.response.body);

    const s1: StageNode = {
      id: "s1",
      stage: "Cache Check",
      pipeline: "request",
      status: "completed",
      timing: { startTime: 0, endTime: t.total / 2, duration: t.total / 2 },
      inputSummary: `${result.request.method} ${result.request.url}`,
      outputData: { hit: true },
      outputSummary: "HIT",
      metrics: { hit: true },
    };

    const s2: StageNode = {
      id: "s2",
      stage: "Cached Response",
      pipeline: "request",
      status: "completed",
      timing: { startTime: t.total / 2, endTime: t.total, duration: t.total / 2 },
      inputSummary: "cache entry",
      outputData: result.response,
      outputSummary: `${result.response.statusCode} ${result.response.statusText}, ${bytes} bytes`,
      metrics: {
        statusCode: result.response.statusCode,
        bodySize: bytes,
        headerCount: respHeaders,
      },
    };

    const stages: StageNode[] = [s1, s2];
    const edges: StageEdge[] = [
      {
        id: "s1->s2",
        sourceStage: "s1",
        targetStage: "s2",
        dataFlowLabel: "cache entry",
      },
    ];

    return ProcessTraceModel.fromStages("request", stages, edges, {
      fromCache: true,
      url: result.request.url,
    });
  }

  // -------------------------------------------------------------------------
  // Full network path: 6 stages
  // -------------------------------------------------------------------------
  private static _buildFullTrace(result: RequestTraceInput): ProcessTrace {
    const t = result.timing;
    const reqHeaders = headerCount(result.request.headers);
    const respHeaders = headerCount(result.response.headers);
    const bytes = bodySize(result.response.body);
    const path = urlPath(result.request.url);

    // Cumulative start times
    const starts = [
      0,
      t.dnsLookup,
      t.dnsLookup + t.tcpConnection,
      t.dnsLookup + t.tcpConnection + t.tlsHandshake,
      t.dnsLookup + t.tcpConnection + t.tlsHandshake + t.requestSent,
      t.dnsLookup + t.tcpConnection + t.tlsHandshake + t.requestSent + t.firstByte,
    ];

    // --- Stage 1: Cache Check (MISS) ---
    const s1: StageNode = {
      id: "s1",
      stage: "Cache Check",
      pipeline: "request",
      status: "completed",
      timing: { startTime: starts[0], endTime: starts[0], duration: 0 },
      inputSummary: `${result.request.method} ${result.request.url}`,
      outputData: { hit: false },
      outputSummary: "MISS",
      metrics: { hit: false },
    };

    // --- Stage 2: DNS Resolution ---
    const s2: StageNode = {
      id: "s2",
      stage: "DNS Resolution",
      pipeline: "request",
      status: "completed",
      timing: {
        startTime: starts[0],
        endTime: starts[0] + t.dnsLookup,
        duration: t.dnsLookup,
      },
      inputSummary: `hostname from ${result.request.url}`,
      outputData: { dnsLookup: t.dnsLookup },
      outputSummary: `${t.dnsLookup}ms`,
      metrics: { dnsLookup: t.dnsLookup },
    };

    // --- Stage 3: TCP Connection ---
    const s3: StageNode = {
      id: "s3",
      stage: "TCP Connection",
      pipeline: "request",
      status: "completed",
      timing: {
        startTime: starts[1],
        endTime: starts[1] + t.tcpConnection,
        duration: t.tcpConnection,
      },
      inputSummary: "IP address",
      outputData: { tcpConnection: t.tcpConnection },
      outputSummary: `connected in ${t.tcpConnection}ms`,
      metrics: { tcpConnection: t.tcpConnection },
    };

    // --- Stage 4: TLS Handshake (skipped if 0ms) ---
    const tlsSkipped = t.tlsHandshake === 0;
    const s4: StageNode = {
      id: "s4",
      stage: "TLS Handshake",
      pipeline: "request",
      status: "completed",
      timing: {
        startTime: starts[2],
        endTime: starts[2] + t.tlsHandshake,
        duration: t.tlsHandshake,
      },
      inputSummary: "TCP stream",
      outputData: { tlsHandshake: t.tlsHandshake, skipped: tlsSkipped },
      outputSummary: tlsSkipped ? "skipped (HTTP)" : `${t.tlsHandshake}ms`,
      metrics: tlsSkipped
        ? { skipped: true, tlsHandshake: 0 }
        : { tlsHandshake: t.tlsHandshake },
    };

    // --- Stage 5: Request Send ---
    const s5: StageNode = {
      id: "s5",
      stage: "Request Send",
      pipeline: "request",
      status: "completed",
      timing: {
        startTime: starts[3],
        endTime: starts[3] + t.requestSent,
        duration: t.requestSent,
      },
      inputSummary: "TLS channel",
      outputData: result.request,
      outputSummary: `${result.request.method} ${path} HTTP/1.1, ${reqHeaders} headers`,
      metrics: { requestSent: t.requestSent, headerCount: reqHeaders },
    };

    // --- Stage 6: Response Receive ---
    const s6: StageNode = {
      id: "s6",
      stage: "Response Receive",
      pipeline: "request",
      status: "completed",
      timing: {
        startTime: starts[4],
        endTime: starts[4] + t.firstByte + t.download,
        duration: t.firstByte + t.download,
      },
      inputSummary: "HTTP request",
      outputData: result.response,
      outputSummary: `${result.response.statusCode} ${result.response.statusText}, ${bytes} bytes, ${respHeaders} headers`,
      metrics: {
        statusCode: result.response.statusCode,
        bodySize: bytes,
        headerCount: respHeaders,
        firstByte: t.firstByte,
        download: t.download,
      },
    };

    const stages: StageNode[] = [s1, s2, s3, s4, s5, s6];

    // Linear chain edge labels describing what flows between stages
    const edgeLabels = [
      "cache miss",
      "IP address",
      "TCP stream",
      "TLS channel",
      "HTTP request",
      "HTTP response",
    ];

    const edges: StageEdge[] = [];
    for (let i = 0; i < stages.length - 1; i++) {
      const src = stages[i];
      const tgt = stages[i + 1];
      edges.push({
        id: `${src.id}->${tgt.id}`,
        sourceStage: src.id,
        targetStage: tgt.id,
        dataFlowLabel: edgeLabels[i + 1],
      });
    }

    return ProcessTraceModel.fromStages("request", stages, edges, {
      fromCache: false,
      url: result.request.url,
      totalDuration: t.total,
    });
  }
}

/**
 * LiveTraceBridge — generic bridge for real-time pipeline tracing.
 *
 * Receives stage events from any BrowserX pipeline observer and maintains
 * a live ProcessTrace backed by a GraphX DiGraph.
 *
 * Usage:
 *   const bridge = LiveTraceBridge.forRendering((trace) => canvas.setTrace(trace));
 *   pipeline.setObserver(bridge);
 *   // As pipeline executes, bridge updates the trace and calls onUpdate
 */
import { ProcessTraceModel } from "../ProcessTraceModel.ts";
import type { ProcessTrace, StageNode, StageEdge, PipelineType, StageStatus } from "../types.ts";

/** Stage event shape — matches PipelineStageEvent from browser/src/engine/PipelineObserver.ts */
export interface LiveStageEvent {
  stageId: string;
  stageName?: string;
  status: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  artifact?: unknown;
  error?: Error;
}

export type TraceUpdateCallback = (trace: ProcessTrace) => void;

export interface LiveTraceBridgeOptions {
  pipeline: PipelineType;
  stages: Array<{ id: string; name: string }>;
  edges: Array<{ source: string; target: string; label: string }>;
  onUpdate?: TraceUpdateCallback;
}

export class LiveTraceBridge {
  private trace: ProcessTrace;
  private onUpdate?: TraceUpdateCallback;

  constructor(options: LiveTraceBridgeOptions) {
    this.onUpdate = options.onUpdate;

    const stages: StageNode[] = options.stages.map((s) => ({
      id: s.id,
      stage: s.name,
      pipeline: options.pipeline,
      status: "pending" as StageStatus,
      timing: { startTime: 0, endTime: 0, duration: 0 },
      inputSummary: "",
      outputData: null,
      outputSummary: "pending",
      metrics: {},
    }));

    const edges: StageEdge[] = options.edges.map((e) => ({
      id: `${e.source}->${e.target}`,
      sourceStage: e.source,
      targetStage: e.target,
      dataFlowLabel: e.label,
    }));

    this.trace = ProcessTraceModel.fromStages(options.pipeline, stages, edges);
  }

  /** Called by any pipeline observer — implements PipelineObserver.onStage shape */
  onStage(event: LiveStageEvent): void {
    this.trace = ProcessTraceModel.updateStage(this.trace, event.stageId, {
      status: event.status as StageStatus,
      timing: {
        startTime: event.startTime,
        endTime: event.endTime ?? 0,
        duration: event.duration ?? 0,
      },
      outputData: event.artifact ?? null,
      outputSummary: event.status === "completed"
        ? (event.stageName ? `${event.stageName} done` : "done")
        : event.status === "error"
        ? `error: ${event.error?.message ?? "unknown"}`
        : event.status,
      ...(event.error ? { error: event.error } : {}),
    });
    this.onUpdate?.(this.trace);
  }

  /** Get the current trace snapshot */
  getTrace(): ProcessTrace {
    return this.trace;
  }

  // --- Factory methods for each pipeline ---

  /** Create a bridge for the rendering pipeline (9 stages) */
  static forRendering(onUpdate?: TraceUpdateCallback): LiveTraceBridge {
    return new LiveTraceBridge({
      pipeline: "rendering",
      onUpdate,
      stages: [
        { id: "html-fetch", name: "HTML Fetch" },
        { id: "html-parse", name: "HTML Parse" },
        { id: "css-fetch", name: "CSS Fetch" },
        { id: "css-parse", name: "CSS Parse" },
        { id: "script-execution", name: "Script Execution" },
        { id: "style-resolution", name: "Style Resolution" },
        { id: "layout", name: "Layout" },
        { id: "paint", name: "Paint" },
        { id: "composite", name: "Composite" },
      ],
      edges: [
        { source: "html-fetch", target: "html-parse", label: "HTML bytes" },
        { source: "html-parse", target: "css-fetch", label: "DOM tree" },
        { source: "css-fetch", target: "css-parse", label: "CSS text" },
        { source: "css-parse", target: "script-execution", label: "CSSOM" },
        { source: "script-execution", target: "style-resolution", label: "styled DOM" },
        { source: "style-resolution", target: "layout", label: "RenderTree" },
        { source: "layout", target: "paint", label: "LayoutBox tree" },
        { source: "paint", target: "composite", label: "DisplayList" },
      ],
    });
  }

  /** Create a bridge for the request pipeline (6 stages) */
  static forRequest(onUpdate?: TraceUpdateCallback): LiveTraceBridge {
    return new LiveTraceBridge({
      pipeline: "request",
      onUpdate,
      stages: [
        { id: "cache-check", name: "Cache Check" },
        { id: "dns-resolution", name: "DNS Resolution" },
        { id: "tcp-connection", name: "TCP Connection" },
        { id: "tls-handshake", name: "TLS Handshake" },
        { id: "http-send", name: "HTTP Send" },
        { id: "http-receive", name: "HTTP Receive" },
      ],
      edges: [
        { source: "cache-check", target: "dns-resolution", label: "cache miss" },
        { source: "dns-resolution", target: "tcp-connection", label: "IP addresses" },
        { source: "tcp-connection", target: "tls-handshake", label: "connection" },
        { source: "tls-handshake", target: "http-send", label: "secure channel" },
        { source: "http-send", target: "http-receive", label: "request bytes" },
      ],
    });
  }

  /** Create a bridge for the query engine pipeline (7 stages) */
  static forQuery(onUpdate?: TraceUpdateCallback): LiveTraceBridge {
    return new LiveTraceBridge({
      pipeline: "query",
      onUpdate,
      stages: [
        { id: "lexer", name: "Lexer" },
        { id: "parser", name: "Parser" },
        { id: "semantic-analysis", name: "Semantic Analysis" },
        { id: "optimization", name: "Optimization" },
        { id: "planning", name: "Planning" },
        { id: "execution", name: "Execution" },
        { id: "formatting", name: "Formatting" },
      ],
      edges: [
        { source: "lexer", target: "parser", label: "tokens" },
        { source: "parser", target: "semantic-analysis", label: "AST" },
        { source: "semantic-analysis", target: "optimization", label: "annotated AST" },
        { source: "optimization", target: "planning", label: "optimized AST" },
        { source: "planning", target: "execution", label: "execution plan" },
        { source: "execution", target: "formatting", label: "raw data" },
      ],
    });
  }

  /** Create a bridge for the proxy pipeline (5 stages) */
  static forProxy(onUpdate?: TraceUpdateCallback): LiveTraceBridge {
    return new LiveTraceBridge({
      pipeline: "proxy",
      onUpdate,
      stages: [
        { id: "request-middleware", name: "Request Middleware" },
        { id: "route-match", name: "Route Match" },
        { id: "proxy-forward", name: "Proxy Forward" },
        { id: "response-middleware", name: "Response Middleware" },
        { id: "response-send", name: "Response Send" },
      ],
      edges: [
        { source: "request-middleware", target: "route-match", label: "processed request" },
        { source: "route-match", target: "proxy-forward", label: "matched route" },
        { source: "proxy-forward", target: "response-middleware", label: "upstream response" },
        { source: "response-middleware", target: "response-send", label: "final response" },
      ],
    });
  }
}

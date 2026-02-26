import type { NodeId, EdgeId, Metadata } from "../types.ts";
import type { DiGraph } from "../graph/DiGraph.ts";

/** Status of a pipeline stage */
export type StageStatus = "pending" | "running" | "completed" | "error";

/** Which pipeline this trace represents */
export type PipelineType = "rendering" | "request" | "query" | "proxy";

/** Timing information for a pipeline stage */
export interface StageTiming {
  startTime: number;
  endTime: number;
  duration: number;
}

/** A single pipeline stage node — contains the ACTUAL stage artifact as outputData */
export interface StageNode {
  /** Unique stage identifier */
  id: NodeId;
  /** Human-readable stage name, e.g. "DNS Resolution", "HTML Parse", "Layout" */
  stage: string;
  /** Which pipeline this stage belongs to */
  pipeline: PipelineType;
  /** Current execution status */
  status: StageStatus;
  /** Wall-clock timing for this stage */
  timing: StageTiming;
  /** Human-readable description of stage input, e.g. "GET https://example.com" */
  inputSummary: string;
  /** The actual stage artifact: DOMNode tree, CSSOM, LayoutBox, HTTPResponse, StepResult, etc. */
  outputData: unknown;
  /** Human-readable description of stage output, e.g. "document with 47 nodes" */
  outputSummary: string;
  /** Numeric/boolean metrics: { size: 42819, cached: false, nodeCount: 47 } */
  metrics: Record<string, number | string | boolean>;
  /** Error if stage failed */
  error?: Error;
}

/** Edge between pipeline stages representing data flow */
export interface StageEdge {
  /** Unique edge identifier */
  id: EdgeId;
  /** Source stage node ID */
  sourceStage: NodeId;
  /** Target stage node ID */
  targetStage: NodeId;
  /** What data flows along this edge, e.g. "DOMNode tree", "CSS text", "HTTPResponse" */
  dataFlowLabel: string;
  /** Size of data flowing, in bytes if applicable */
  dataSize?: number;
}

/** Complete trace of a process execution across pipeline stages */
export interface ProcessTrace {
  /** Unique trace identifier */
  id: string;
  /** Which pipeline was traced */
  pipeline: PipelineType;
  /** When the trace started (Date.now()) */
  startTime: number;
  /** When the trace ended (Date.now()), undefined if still running */
  endTime?: number;
  /** All stages in this trace */
  stages: StageNode[];
  /** All edges (data flow connections) between stages */
  edges: StageEdge[];
  /** GraphX DiGraph built from stages and edges */
  graph: DiGraph<StageNode, StageEdge>;
  /** Additional trace-level metadata */
  metadata: Metadata;
}

/** Canvas theme with status-aware stage coloring */
export interface CanvasTheme {
  background: string;
  stage: {
    pending: { fill: string; border: string };
    running: { fill: string; border: string };
    completed: { fill: string; border: string };
    error: { fill: string; border: string };
  };
  edge: {
    stroke: string;
    flowStroke: string;
    width: number;
  };
  label: {
    color: string;
    font: string;
    fontSize: number;
  };
  timing: {
    barHeight: number;
    barColor: string;
    textColor: string;
  };
  selection: {
    stroke: string;
    width: number;
  };
  panel: {
    background: string;
    border: string;
    text: string;
    codeFont: string;
  };
}

/** Options for the <graphx-canvas> web component */
export interface GraphXCanvasOptions {
  width?: number;
  height?: number;
  theme?: "light" | "dark" | CanvasTheme;
  layout?: "hierarchical" | "force" | "radial" | "grid";
  layoutDirection?: "TB" | "LR" | "BT" | "RL";
  showLabels?: boolean;
  showTiming?: boolean;
  showDataFlow?: boolean;
  showPanel?: boolean;
  autoFit?: boolean;
}

/** Events emitted by the <graphx-canvas> web component */
export interface GraphXCanvasEventMap {
  "stage-select": CustomEvent<{ stage: StageNode }>;
  "stage-hover": CustomEvent<{ stageId: NodeId | null }>;
  "trace-complete": CustomEvent<{ trace: ProcessTrace }>;
}

/** Camera transform for pan/zoom */
export interface Transform {
  offsetX: number;
  offsetY: number;
  scale: number;
}

/** Node dimensions for hit-testing (computed from layout + renderer) */
export interface StageNodeRect {
  id: NodeId;
  x: number;
  y: number;
  width: number;
  height: number;
}

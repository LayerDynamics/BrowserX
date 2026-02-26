/**
 * GraphX - Comprehensive graph library for BrowserX
 *
 * Features:
 * - Graph data structures: Graph, DiGraph, DAG
 * - Graph algorithms: BFS, DFS, shortest path, topological sort, cycle detection, connected components
 * - Layout algorithms: Force-directed, hierarchical, radial, grid
 * - SVG rendering with theming support
 *
 * @module graphx
 */

// Core types
export type { Point, Rect, NodeId, EdgeId, Metadata } from "./src/types.ts";

// Graph data structures
export { Graph, DiGraph, DAG, GraphNode, GraphEdge, CycleError } from "./src/graph/mod.ts";

// Algorithms
export {
  bfs,
  dfs,
  dfsAll,
  topologicalSort,
  dijkstra,
  connectedComponents,
  hasCycle,
} from "./src/algorithms/mod.ts";

export type {
  BFSResult,
  DFSResult,
  TopologicalSortResult,
  ShortestPathResult,
  ConnectedComponentsResult,
} from "./src/algorithms/mod.ts";

// Layout algorithms
export { forceDirected, hierarchical, radial, grid } from "./src/layout/mod.ts";

export type {
  LayoutNode,
  LayoutEdge,
  LayoutResult,
  ForceDirectedOptions,
  HierarchicalOptions,
  RadialOptions,
  GridOptions,
} from "./src/layout/mod.ts";

// SVG rendering
export { SVGRenderer, render, buildArrowMarker } from "./src/svg/mod.ts";

export type { Theme, NodeStyle, EdgeStyle, SVGRenderOptions } from "./src/svg/mod.ts";

export { DEFAULT_LIGHT_THEME, DEFAULT_DARK_THEME } from "./src/svg/mod.ts";

// ASCII rendering
export {
  ASCIIRenderer,
  render as renderASCII,
} from "./src/ascii/mod.ts";

export type { ASCIIRenderOptions } from "./src/ascii/mod.ts";

// Canvas rendering (interactive web component + process tracing)
export {
  GraphXCanvas,
  CanvasRenderer,
  InteractionManager,
  AnimationController,
  DetailPanel,
  ProcessTraceModel,
  RenderingPipelineAdapter,
  RequestPipelineAdapter,
  QueryExecutorAdapter,
  ProxyMiddlewareAdapter,
  LiveTraceBridge,
  CANVAS_LIGHT_THEME,
  CANVAS_DARK_THEME,
  resolveTheme,
} from "./src/canvas/mod.ts";

export type {
  StageStatus,
  PipelineType,
  StageTiming,
  StageNode,
  StageEdge,
  ProcessTrace,
  CanvasTheme,
  GraphXCanvasOptions,
  GraphXCanvasEventMap,
  Transform,
  StageNodeRect,
  RenderingTraceInput,
  RequestTraceInput,
  QueryStepInput,
  QueryStepResult,
  QueryExecutionTraceInput,
  ProxyMiddlewareStepInput,
  ProxyUpstreamInput,
  ProxyResponseMiddlewareInput,
  ProxyTraceInput,
  LiveStageEvent,
  TraceUpdateCallback,
  LiveTraceBridgeOptions,
} from "./src/canvas/mod.ts";

// TDOM (Terminal DOM) rendering
export { TDomNode, TDomRenderer } from "./src/tdom/mod.ts";
export type { TDomLayout, TDomBorder, TDomStyle, TDomRenderOptions } from "./src/tdom/mod.ts";

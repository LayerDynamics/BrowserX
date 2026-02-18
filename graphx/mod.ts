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

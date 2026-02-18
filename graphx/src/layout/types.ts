import type { NodeId, Point } from "../types.ts";

/** A node with computed layout position */
export interface LayoutNode {
  id: NodeId;
  x: number;
  y: number;
}

/** An edge for layout (just references nodes) */
export interface LayoutEdge {
  source: NodeId;
  target: NodeId;
}

/** Result of a layout algorithm */
export interface LayoutResult {
  nodes: LayoutNode[];
  width: number;
  height: number;
}

/** Options for force-directed layout */
export interface ForceDirectedOptions {
  /** Bounding box width */
  width?: number;
  /** Bounding box height */
  height?: number;
  /** Number of simulation iterations */
  iterations?: number;
  /** Spring constant (attraction strength) */
  springConstant?: number;
  /** Repulsion constant (repulsion strength) */
  repulsionConstant?: number;
  /** Ideal spring length */
  springLength?: number;
  /** Random seed for reproducible layout */
  seed?: number;
}

/** Options for hierarchical layout */
export interface HierarchicalOptions {
  /** Direction: TB (top-bottom), LR (left-right), BT (bottom-top), RL (right-left) */
  direction?: "TB" | "LR" | "BT" | "RL";
  /** Horizontal spacing between nodes in same layer */
  horizontalSpacing?: number;
  /** Vertical spacing between layers */
  verticalSpacing?: number;
}

/** Options for radial layout */
export interface RadialOptions {
  /** Center point */
  center?: Point;
  /** Radius */
  radius?: number;
  /** Start angle in radians */
  startAngle?: number;
}

/** Options for grid layout */
export interface GridOptions {
  /** Number of columns (0 = auto-calculate) */
  columns?: number;
  /** Cell width */
  cellWidth?: number;
  /** Cell height */
  cellHeight?: number;
  /** Padding between cells */
  padding?: number;
}

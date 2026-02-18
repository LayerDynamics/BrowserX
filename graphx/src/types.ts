/** A 2D point */
export interface Point {
  x: number;
  y: number;
}

/** A 2D rectangle */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Unique node identifier */
export type NodeId = string;

/** Unique edge identifier */
export type EdgeId = string;

/** Arbitrary metadata attached to nodes or edges */
export type Metadata = Record<string, unknown>;

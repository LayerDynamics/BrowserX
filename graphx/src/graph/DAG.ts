import { DiGraph } from "./DiGraph.ts";
import type { GraphEdge } from "./GraphEdge.ts";
import { hasCycle } from "../algorithms/cycle-detection.ts";

/** Error thrown when adding an edge would create a cycle in a DAG */
export class CycleError extends Error {
  constructor(message = "Adding this edge would create a cycle") {
    super(message);
    this.name = "CycleError";
  }
}

/**
 * Directed Acyclic Graph.
 * Rejects any edge that would create a cycle.
 */
export class DAG<N = unknown, E = unknown> extends DiGraph<N, E> {
  override addEdge(edge: GraphEdge<E>): this {
    super.addEdge(edge);
    if (hasCycle(this)) {
      // Roll back the edge
      this._removeEdgeById(edge.id);
      throw new CycleError();
    }
    return this;
  }
}

import { DiGraph } from "./DiGraph.ts";
import type { GraphEdge } from "./GraphEdge.ts";

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
 * Uses incremental reachability check: before inserting edge (source→target),
 * verify target cannot already reach source. O(V+E) per check instead of
 * full-graph DFS on every insertion.
 */
export class DAG<N = unknown, E = unknown> extends DiGraph<N, E> {
  override addEdge(edge: GraphEdge<E>): this {
    // Incremental cycle check: if target can reach source, adding
    // source→target would create a cycle.
    if (this.hasNode(edge.target) && this.hasNode(edge.source)) {
      if (this._canReach(edge.target, edge.source)) {
        throw new CycleError();
      }
    }
    super.addEdge(edge);
    return this;
  }

  /** BFS from `start` to see if `goal` is reachable via successors */
  private _canReach(start: string, goal: string): boolean {
    if (start === goal) return true;
    const visited = new Set<string>();
    const queue = [start];
    visited.add(start);
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const neighbor of this.successors(current)) {
        if (neighbor.id === goal) return true;
        if (!visited.has(neighbor.id)) {
          visited.add(neighbor.id);
          queue.push(neighbor.id);
        }
      }
    }
    return false;
  }
}

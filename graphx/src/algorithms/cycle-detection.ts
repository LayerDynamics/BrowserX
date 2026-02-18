import type { NodeId } from "../types.ts";
import type { Graph } from "../graph/Graph.ts";

/**
 * DFS-based cycle detection for directed graphs.
 * Works on any Graph subclass but is meaningful for directed graphs.
 * For undirected graphs it will always return false for simple graphs.
 */
export function hasCycle<N, E>(graph: Graph<N, E>): boolean {
  const WHITE = 0; // unvisited
  const GRAY = 1; // in current DFS path
  const BLACK = 2; // fully processed

  const color = new Map<NodeId, number>();
  for (const node of graph.nodes()) {
    color.set(node.id, WHITE);
  }

  function dfs(id: NodeId): boolean {
    color.set(id, GRAY);
    // Use successors if available (DiGraph), otherwise neighbors
    const node = graph.getNode(id);
    if (!node) return false;

    // Check if the graph has successors method (DiGraph)
    type DiGraphLike = Graph<N, E> & { successors?: (id: NodeId) => { id: NodeId }[] };
    const g = graph as DiGraphLike;
    const adjacent = g.successors ? g.successors(id) : graph.neighbors(id);

    for (const neighbor of adjacent) {
      const c = color.get(neighbor.id) ?? WHITE;
      if (c === GRAY) return true; // back edge = cycle
      if (c === WHITE && dfs(neighbor.id)) return true;
    }
    color.set(id, BLACK);
    return false;
  }

  for (const node of graph.nodes()) {
    if ((color.get(node.id) ?? WHITE) === WHITE) {
      if (dfs(node.id)) return true;
    }
  }
  return false;
}

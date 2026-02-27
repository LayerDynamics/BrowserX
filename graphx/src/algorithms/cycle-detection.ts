import type { NodeId } from "../types.ts";
import type { Graph } from "../graph/Graph.ts";
import { DiGraph } from "../graph/DiGraph.ts";

/**
 * DFS-based cycle detection.
 *
 * For directed graphs (DiGraph): uses successors() with 3-color DFS to detect back edges.
 * For undirected graphs (Graph): uses neighbors() with parent tracking to avoid
 * falsely reporting the edge we arrived on as a cycle.
 */
export function hasCycle<N, E>(graph: Graph<N, E>): boolean {
  if (graph instanceof DiGraph) {
    return hasCycleDirected(graph);
  }
  return hasCycleUndirected(graph);
}

/** Directed cycle detection using 3-color DFS */
function hasCycleDirected<N, E>(graph: DiGraph<N, E>): boolean {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;

  const color = new Map<NodeId, number>();
  for (const node of graph.nodes()) {
    color.set(node.id, WHITE);
  }

  function dfs(id: NodeId): boolean {
    color.set(id, GRAY);
    for (const neighbor of graph.successors(id)) {
      const c = color.get(neighbor.id) ?? WHITE;
      if (c === GRAY) return true;
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

/** Undirected cycle detection using parent-tracking DFS */
function hasCycleUndirected<N, E>(graph: Graph<N, E>): boolean {
  const visited = new Set<NodeId>();

  function dfs(id: NodeId, parentId: NodeId | null): boolean {
    visited.add(id);
    for (const neighbor of graph.neighbors(id)) {
      if (neighbor.id === parentId) continue; // skip edge we arrived on
      if (visited.has(neighbor.id)) return true; // already visited via different path = cycle
      if (dfs(neighbor.id, id)) return true;
    }
    return false;
  }

  for (const node of graph.nodes()) {
    if (!visited.has(node.id)) {
      if (dfs(node.id, null)) return true;
    }
  }
  return false;
}

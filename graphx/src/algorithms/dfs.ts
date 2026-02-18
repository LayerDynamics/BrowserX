import type { NodeId } from "../types.ts";
import type { Graph } from "../graph/Graph.ts";

export interface DFSResult {
  /** Nodes in DFS traversal order */
  order: NodeId[];
  /** Parent map for reconstructing paths */
  parent: Map<NodeId, NodeId | null>;
  /** Depth of each node from start */
  depth: Map<NodeId, number>;
  /** Discovery time (order visited) */
  discovery: Map<NodeId, number>;
  /** Finish time (when all descendants processed) */
  finish: Map<NodeId, number>;
}

/**
 * Depth-First Search from a start node.
 */
export function dfs<N, E>(graph: Graph<N, E>, start: NodeId): DFSResult {
  if (!graph.hasNode(start)) {
    throw new Error(`Start node "${start}" does not exist`);
  }

  const order: NodeId[] = [];
  const parent = new Map<NodeId, NodeId | null>();
  const depth = new Map<NodeId, number>();
  const discovery = new Map<NodeId, number>();
  const finish = new Map<NodeId, number>();
  const visited = new Set<NodeId>();
  let time = 0;

  function visit(id: NodeId, d: number, p: NodeId | null) {
    visited.add(id);
    order.push(id);
    parent.set(id, p);
    depth.set(id, d);
    discovery.set(id, time++);

    for (const neighbor of graph.neighbors(id)) {
      if (!visited.has(neighbor.id)) {
        visit(neighbor.id, d + 1, id);
      }
    }

    finish.set(id, time++);
  }

  visit(start, 0, null);

  return { order, parent, depth, discovery, finish };
}

/**
 * Depth-First Search visiting all connected components.
 */
export function dfsAll<N, E>(graph: Graph<N, E>): DFSResult {
  const order: NodeId[] = [];
  const parent = new Map<NodeId, NodeId | null>();
  const depth = new Map<NodeId, number>();
  const discovery = new Map<NodeId, number>();
  const finish = new Map<NodeId, number>();
  const visited = new Set<NodeId>();
  let time = 0;

  function visit(id: NodeId, d: number, p: NodeId | null) {
    visited.add(id);
    order.push(id);
    parent.set(id, p);
    depth.set(id, d);
    discovery.set(id, time++);

    for (const neighbor of graph.neighbors(id)) {
      if (!visited.has(neighbor.id)) {
        visit(neighbor.id, d + 1, id);
      }
    }

    finish.set(id, time++);
  }

  for (const node of graph.nodes()) {
    if (!visited.has(node.id)) {
      visit(node.id, 0, null);
    }
  }

  return { order, parent, depth, discovery, finish };
}

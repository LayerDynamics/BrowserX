import type { NodeId } from "../types.ts";
import type { Graph } from "../graph/Graph.ts";
import { MinHeap } from "./min-heap.ts";

export interface ShortestPathResult {
  /** Distance from start to each node */
  distance: Map<NodeId, number>;
  /** Previous node in shortest path */
  previous: Map<NodeId, NodeId | null>;
  /** Get shortest path to a target node */
  path(target: NodeId): NodeId[];
  /** Get cost to reach a target node */
  cost(target: NodeId): number;
}

/**
 * Dijkstra's shortest path algorithm using a binary min-heap.
 * Time complexity: O((V + E) log V) instead of O(V²).
 * Returns shortest paths from start to all reachable nodes.
 */
export function dijkstra<N, E>(graph: Graph<N, E>, start: NodeId): ShortestPathResult {
  if (!graph.hasNode(start)) {
    throw new Error(`Start node "${start}" does not exist`);
  }

  const distance = new Map<NodeId, number>();
  const previous = new Map<NodeId, NodeId | null>();
  const visited = new Set<NodeId>();
  const heap = new MinHeap<NodeId>();

  for (const node of graph.nodes()) {
    distance.set(node.id, Infinity);
    previous.set(node.id, null);
  }
  distance.set(start, 0);
  heap.insert(start, 0);

  while (heap.size > 0) {
    const min = heap.extractMin()!;
    const current = min.key;

    if (visited.has(current)) continue;
    if (min.priority === Infinity) break;

    visited.add(current);

    const currentDist = distance.get(current)!;
    for (const edge of graph.incidentEdges(current)) {
      const neighborId = edge.source === current ? edge.target : edge.source;
      if (visited.has(neighborId)) continue;

      const alt = currentDist + edge.weight;
      if (alt < distance.get(neighborId)!) {
        distance.set(neighborId, alt);
        previous.set(neighborId, current);
        if (heap.has(neighborId)) {
          heap.decreaseKey(neighborId, alt);
        } else {
          heap.insert(neighborId, alt);
        }
      }
    }
  }

  function path(target: NodeId): NodeId[] {
    const p: NodeId[] = [];
    let current: NodeId | null = target;
    while (current !== null) {
      p.unshift(current);
      current = previous.get(current) ?? null;
    }
    return p.length > 0 && p[0] === start ? p : [];
  }

  function cost(target: NodeId): number {
    return distance.get(target) ?? Infinity;
  }

  return { distance, previous, path, cost };
}

import type { NodeId } from "../types.ts";
import type { Graph } from "../graph/Graph.ts";

export interface ConnectedComponentsResult {
  /** Map from node ID to component ID */
  componentOf: Map<NodeId, number>;
  /** Array of component sets (component ID -> set of node IDs) */
  components: Set<NodeId>[];
  /** Number of connected components */
  count: number;
}

/**
 * Find connected components using Union-Find.
 * For undirected graphs, finds connected components.
 * For directed graphs, finds weakly connected components.
 */
export function connectedComponents<N, E>(graph: Graph<N, E>): ConnectedComponentsResult {
  const parent = new Map<NodeId, NodeId>();
  const rank = new Map<NodeId, number>();

  // Initialize each node as its own parent
  for (const node of graph.nodes()) {
    parent.set(node.id, node.id);
    rank.set(node.id, 0);
  }

  function find(id: NodeId): NodeId {
    const p = parent.get(id)!;
    if (p !== id) {
      parent.set(id, find(p)); // path compression
    }
    return parent.get(id)!;
  }

  function union(a: NodeId, b: NodeId) {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA === rootB) return;

    // Union by rank
    const rankA = rank.get(rootA)!;
    const rankB = rank.get(rootB)!;
    if (rankA < rankB) {
      parent.set(rootA, rootB);
    } else if (rankA > rankB) {
      parent.set(rootB, rootA);
    } else {
      parent.set(rootB, rootA);
      rank.set(rootA, rankA + 1);
    }
  }

  // Union all edges
  for (const edge of graph.edges()) {
    union(edge.source, edge.target);
  }

  // Build component sets
  const componentMap = new Map<NodeId, Set<NodeId>>();
  for (const node of graph.nodes()) {
    const root = find(node.id);
    if (!componentMap.has(root)) {
      componentMap.set(root, new Set());
    }
    componentMap.get(root)!.add(node.id);
  }

  const components = Array.from(componentMap.values());
  const componentOf = new Map<NodeId, number>();
  components.forEach((comp, idx) => {
    for (const id of comp) {
      componentOf.set(id, idx);
    }
  });

  return {
    componentOf,
    components,
    count: components.length,
  };
}

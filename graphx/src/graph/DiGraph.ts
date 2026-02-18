import type { NodeId, EdgeId } from "../types.ts";
import { GraphNode } from "./GraphNode.ts";
import { GraphEdge } from "./GraphEdge.ts";
import { Graph } from "./Graph.ts";

/**
 * Directed graph. Extends Graph but tracks in/out adjacency separately.
 */
export class DiGraph<N = unknown, E = unknown> extends Graph<N, E> {
  /** out-adjacency: nodeId -> set of edge ids leaving this node */
  protected _outAdj: Map<NodeId, Set<EdgeId>> = new Map();
  /** in-adjacency: nodeId -> set of edge ids entering this node */
  protected _inAdj: Map<NodeId, Set<EdgeId>> = new Map();

  override addNode(node: GraphNode<N>): this {
    super.addNode(node);
    this._outAdj.set(node.id, new Set());
    this._inAdj.set(node.id, new Set());
    return this;
  }

  override removeNode(id: NodeId): boolean {
    if (!this._nodes.has(id)) return false;
    // Remove all edges where this node is source or target
    const outEdges = Array.from(this._outAdj.get(id) ?? []);
    const inEdges = Array.from(this._inAdj.get(id) ?? []);
    for (const eid of [...outEdges, ...inEdges]) {
      this._removeEdgeById(eid);
    }
    this._nodes.delete(id);
    this._adj.delete(id);
    this._outAdj.delete(id);
    this._inAdj.delete(id);
    return true;
  }

  override addEdge(edge: GraphEdge<E>): this {
    if (!this._nodes.has(edge.source)) {
      throw new Error(`Source node "${edge.source}" does not exist`);
    }
    if (!this._nodes.has(edge.target)) {
      throw new Error(`Target node "${edge.target}" does not exist`);
    }
    if (this._edges.has(edge.id)) {
      throw new Error(`Edge "${edge.id}" already exists`);
    }
    this._edges.set(edge.id, edge);
    // undirected adjacency for compatibility
    this._adj.get(edge.source)!.add(edge.id);
    this._adj.get(edge.target)!.add(edge.id);
    // directed adjacency
    this._outAdj.get(edge.source)!.add(edge.id);
    this._inAdj.get(edge.target)!.add(edge.id);
    return this;
  }

  protected override _removeEdgeById(id: EdgeId): boolean {
    const edge = this._edges.get(id);
    if (!edge) return false;
    this._adj.get(edge.source)?.delete(id);
    this._adj.get(edge.target)?.delete(id);
    this._outAdj.get(edge.source)?.delete(id);
    this._inAdj.get(edge.target)?.delete(id);
    this._edges.delete(id);
    return true;
  }

  /** Nodes reachable by following edges from this node */
  successors(id: NodeId): GraphNode<N>[] {
    const edgeIds = this._outAdj.get(id);
    if (!edgeIds) return [];
    return Array.from(edgeIds).map((eid) => {
      const e = this._edges.get(eid)!;
      return this._nodes.get(e.target)!;
    }).filter(Boolean);
  }

  /** Nodes that have edges pointing to this node */
  predecessors(id: NodeId): GraphNode<N>[] {
    const edgeIds = this._inAdj.get(id);
    if (!edgeIds) return [];
    return Array.from(edgeIds).map((eid) => {
      const e = this._edges.get(eid)!;
      return this._nodes.get(e.source)!;
    }).filter(Boolean);
  }

  /** Out-edges from a node */
  outEdges(id: NodeId): GraphEdge<E>[] {
    const edgeIds = this._outAdj.get(id);
    if (!edgeIds) return [];
    return Array.from(edgeIds).map((eid) => this._edges.get(eid)!);
  }

  /** In-edges to a node */
  inEdges(id: NodeId): GraphEdge<E>[] {
    const edgeIds = this._inAdj.get(id);
    if (!edgeIds) return [];
    return Array.from(edgeIds).map((eid) => this._edges.get(eid)!);
  }

  outDegree(id: NodeId): number {
    return this._outAdj.get(id)?.size ?? 0;
  }

  inDegree(id: NodeId): number {
    return this._inAdj.get(id)?.size ?? 0;
  }

  /** Returns a new DiGraph with all edges reversed */
  transpose(): DiGraph<N, E> {
    const g = new DiGraph<N, E>();
    for (const node of this.nodes()) {
      g.addNode(node.clone() as GraphNode<N>);
    }
    for (const edge of this.edges()) {
      g.addEdge(edge.reversed() as GraphEdge<E>);
    }
    return g;
  }

  /** For directed graphs, neighbors() returns successors */
  override neighbors(id: NodeId): GraphNode<N>[] {
    return this.successors(id);
  }
}

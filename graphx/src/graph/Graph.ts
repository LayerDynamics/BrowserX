import type { NodeId, EdgeId } from "../types.ts";
import { GraphNode } from "./GraphNode.ts";
import { GraphEdge } from "./GraphEdge.ts";

export class Graph<N = unknown, E = unknown> {
  protected _nodes: Map<NodeId, GraphNode<N>> = new Map();
  protected _edges: Map<EdgeId, GraphEdge<E>> = new Map();
  /** adjacency: nodeId -> set of edge ids */
  protected _adj: Map<NodeId, Set<EdgeId>> = new Map();

  get nodeCount(): number {
    return this._nodes.size;
  }

  get edgeCount(): number {
    return this._edges.size;
  }

  nodes(): GraphNode<N>[] {
    return Array.from(this._nodes.values());
  }

  edges(): GraphEdge<E>[] {
    return Array.from(this._edges.values());
  }

  hasNode(id: NodeId): boolean {
    return this._nodes.has(id);
  }

  hasEdge(id: EdgeId): boolean {
    return this._edges.has(id);
  }

  getNode(id: NodeId): GraphNode<N> | undefined {
    return this._nodes.get(id);
  }

  getEdge(id: EdgeId): GraphEdge<E> | undefined {
    return this._edges.get(id);
  }

  addNode(node: GraphNode<N>): this {
    if (this._nodes.has(node.id)) {
      throw new Error(`Node "${node.id}" already exists`);
    }
    this._nodes.set(node.id, node);
    this._adj.set(node.id, new Set());
    return this;
  }

  removeNode(id: NodeId): boolean {
    if (!this._nodes.has(id)) return false;
    // Remove all edges incident to this node
    const edgeIds = Array.from(this._adj.get(id) ?? []);
    for (const eid of edgeIds) {
      this._removeEdgeById(eid);
    }
    this._nodes.delete(id);
    this._adj.delete(id);
    return true;
  }

  addEdge(edge: GraphEdge<E>): this {
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
    this._adj.get(edge.source)!.add(edge.id);
    this._adj.get(edge.target)!.add(edge.id);
    return this;
  }

  removeEdge(id: EdgeId): boolean {
    return this._removeEdgeById(id);
  }

  protected _removeEdgeById(id: EdgeId): boolean {
    const edge = this._edges.get(id);
    if (!edge) return false;
    this._adj.get(edge.source)?.delete(id);
    this._adj.get(edge.target)?.delete(id);
    this._edges.delete(id);
    return true;
  }

  /** Returns all nodes adjacent to the given node (neighbors) */
  neighbors(id: NodeId): GraphNode<N>[] {
    const edgeIds = this._adj.get(id);
    if (!edgeIds) return [];
    const result: GraphNode<N>[] = [];
    const seen = new Set<NodeId>();
    for (const eid of edgeIds) {
      const edge = this._edges.get(eid)!;
      const neighborId = edge.source === id ? edge.target : edge.source;
      if (!seen.has(neighborId)) {
        seen.add(neighborId);
        const n = this._nodes.get(neighborId);
        if (n) result.push(n);
      }
    }
    return result;
  }

  /** Returns incident edges for a node */
  incidentEdges(id: NodeId): GraphEdge<E>[] {
    const edgeIds = this._adj.get(id);
    if (!edgeIds) return [];
    return Array.from(edgeIds).map((eid) => this._edges.get(eid)!);
  }

  degree(id: NodeId): number {
    return this._adj.get(id)?.size ?? 0;
  }

  clear(): void {
    this._nodes.clear();
    this._edges.clear();
    this._adj.clear();
  }

  toJSON(): Record<string, unknown> {
    return {
      nodes: this.nodes().map((n) => n.toJSON()),
      edges: this.edges().map((e) => e.toJSON()),
    };
  }
}

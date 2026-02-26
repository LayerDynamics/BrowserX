import type { EdgeId, NodeId, Metadata } from "../types.ts";

export class GraphEdge<T = unknown> {
  readonly id: EdgeId;
  readonly source: NodeId;
  readonly target: NodeId;
  weight: number;
  data: T | undefined;
  label: string;
  metadata: Metadata;

  constructor(
    id: EdgeId,
    source: NodeId,
    target: NodeId,
    weight = 1,
    data?: T,
    label?: string,
    metadata?: Metadata,
  ) {
    this.id = id;
    this.source = source;
    this.target = target;
    this.weight = weight;
    this.data = data;
    this.label = label ?? `${source}->${target}`;
    this.metadata = metadata ?? {};
  }

  reversed(): GraphEdge<T> {
    return new GraphEdge<T>(
      `${this.id}_rev`,
      this.target,
      this.source,
      this.weight,
      this.data,
      this.label,
      { ...this.metadata },
    );
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      source: this.source,
      target: this.target,
      weight: this.weight,
      data: this.data,
      label: this.label,
      metadata: this.metadata,
    };
  }
}

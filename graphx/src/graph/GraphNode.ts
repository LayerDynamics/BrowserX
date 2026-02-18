import type { NodeId, Metadata } from "../types.ts";

export class GraphNode<T = unknown> {
  readonly id: NodeId;
  data: T;
  label: string;
  metadata: Metadata;

  constructor(id: NodeId, data: T, label?: string, metadata?: Metadata) {
    this.id = id;
    this.data = data;
    this.label = label ?? id;
    this.metadata = metadata ?? {};
  }

  clone(): GraphNode<T> {
    return new GraphNode<T>(
      this.id,
      this.data,
      this.label,
      { ...this.metadata },
    );
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      data: this.data,
      label: this.label,
      metadata: this.metadata,
    };
  }
}

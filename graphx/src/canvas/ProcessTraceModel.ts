import { DiGraph } from "../graph/DiGraph.ts";
import { GraphNode } from "../graph/GraphNode.ts";
import { GraphEdge } from "../graph/GraphEdge.ts";
import type {
  PipelineType,
  ProcessTrace,
  StageNode,
  StageEdge,
} from "./types.ts";

/**
 * Builds a ProcessTrace from pipeline adapter output.
 * Converts StageNode[] + StageEdge[] into a GraphX DiGraph-backed trace.
 */
export class ProcessTraceModel {
  /**
   * Build a ProcessTrace from stages and edges produced by a pipeline adapter.
   * Creates a DiGraph<StageNode, StageEdge> with one node per stage and one edge per data flow.
   */
  static fromStages(
    pipeline: PipelineType,
    stages: StageNode[],
    edges: StageEdge[],
    metadata: Record<string, unknown> = {},
  ): ProcessTrace {
    const graph = new DiGraph<StageNode, StageEdge>();

    for (const stage of stages) {
      const node = new GraphNode<StageNode>(stage.id, stage, stage.stage);
      graph.addNode(node);
    }

    for (const edge of edges) {
      if (!graph.hasNode(edge.sourceStage) || !graph.hasNode(edge.targetStage)) {
        continue;
      }
      const graphEdge = new GraphEdge<StageEdge>(
        edge.id,
        edge.sourceStage,
        edge.targetStage,
        1,
        edge,
        edge.dataFlowLabel,
      );
      graph.addEdge(graphEdge);
    }

    const startTime = stages.length > 0
      ? Math.min(...stages.map((s) => s.timing.startTime))
      : Date.now();

    const completedStages = stages.filter((s) => s.status === "completed" || s.status === "error");
    const endTime = completedStages.length === stages.length && stages.length > 0
      ? Math.max(...stages.map((s) => s.timing.endTime))
      : undefined;

    return {
      id: `trace-${pipeline}-${Date.now()}`,
      pipeline,
      startTime,
      endTime,
      stages,
      edges,
      graph,
      metadata,
    };
  }

  /**
   * Update a stage within an existing trace (for live tracing).
   * Returns a new ProcessTrace with the updated stage.
   */
  static updateStage(
    trace: ProcessTrace,
    stageId: string,
    update: Partial<StageNode>,
  ): ProcessTrace {
    const updatedStages = trace.stages.map((s) =>
      s.id === stageId ? { ...s, ...update } : s
    );

    const updatedGraph = trace.graph;
    const existingNode = updatedGraph.getNode(stageId);
    if (existingNode) {
      const updatedStage = updatedStages.find((s) => s.id === stageId);
      if (updatedStage) {
        existingNode.data = updatedStage;
      }
    }

    const completedStages = updatedStages.filter(
      (s) => s.status === "completed" || s.status === "error",
    );
    const endTime = completedStages.length === updatedStages.length && updatedStages.length > 0
      ? Math.max(...updatedStages.map((s) => s.timing.endTime))
      : undefined;

    return {
      ...trace,
      stages: updatedStages,
      endTime,
    };
  }

  /** Get total duration of the trace in ms */
  static totalDuration(trace: ProcessTrace): number {
    if (trace.stages.length === 0) return 0;
    return trace.stages.reduce((sum, s) => sum + s.timing.duration, 0);
  }

  /** Get stages in topological order (respects dependencies) */
  static stagesInOrder(trace: ProcessTrace): StageNode[] {
    const visited = new Set<string>();
    const order: StageNode[] = [];
    const stageMap = new Map(trace.stages.map((s) => [s.id, s]));
    const depMap = new Map<string, string[]>();

    for (const edge of trace.edges) {
      if (!depMap.has(edge.targetStage)) {
        depMap.set(edge.targetStage, []);
      }
      depMap.get(edge.targetStage)!.push(edge.sourceStage);
    }

    const visit = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);
      for (const dep of depMap.get(id) ?? []) {
        visit(dep);
      }
      const stage = stageMap.get(id);
      if (stage) order.push(stage);
    };

    for (const stage of trace.stages) {
      visit(stage.id);
    }

    return order;
  }
}

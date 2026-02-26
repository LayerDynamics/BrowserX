import { ProcessTraceModel } from "../ProcessTraceModel.ts";
import type { ProcessTrace, StageNode, StageEdge, StageStatus, StageTiming } from "../types.ts";

// ---------------------------------------------------------------------------
// Local input interfaces — no query-engine imports
// ---------------------------------------------------------------------------

export interface QueryStepInput {
  id: string;
  type: string;           // "NAVIGATE", "DOM_QUERY", "FILTER", "SORT", "CLICK", etc.
  dependencies: string[]; // IDs of steps this depends on
  cacheable: boolean;
  estimatedCost?: number;
}

export interface QueryStepResult {
  stepId: string;
  success: boolean;
  data?: unknown;
  error?: Error;
  timing: { startTime: number; endTime: number; duration: number };
  cacheHit?: boolean;
}

export interface QueryExecutionTraceInput {
  queryId: string;
  steps: QueryStepInput[];
  stepResults: Map<string, QueryStepResult> | Record<string, QueryStepResult>;
  totalTime: number;
  cacheHits: number;
  cacheMisses: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Normalise stepResults to a plain Map regardless of whether it was passed as
 *  a Map or a plain Record. */
function toMap(
  stepResults: Map<string, QueryStepResult> | Record<string, QueryStepResult>,
): Map<string, QueryStepResult> {
  if (stepResults instanceof Map) return stepResults;
  return new Map(Object.entries(stepResults));
}

/** Build a human-readable outputSummary from the step type and its result data. */
function buildOutputSummary(stepType: string, data: unknown): string {
  const type = stepType.toUpperCase();

  if (type === "NAVIGATE") {
    if (data !== null && typeof data === "object") {
      const obj = data as Record<string, unknown>;
      if (typeof obj["url"] === "string") return `→ ${obj["url"]}`;
      if (typeof obj["href"] === "string") return `→ ${obj["href"]}`;
    }
    return "→ url";
  }

  if (type === "DOM_QUERY" || type === "SELECT") {
    if (Array.isArray(data)) return `${data.length} results`;
    return "0 results";
  }

  if (type === "FILTER") {
    if (Array.isArray(data)) return `${data.length} items`;
    if (data !== null && typeof data === "object") {
      const obj = data as Record<string, unknown>;
      if (typeof obj["outputCount"] === "number" && typeof obj["inputCount"] === "number") {
        return `${obj["inputCount"]} → ${obj["outputCount"]} items`;
      }
    }
    return "filtered";
  }

  if (type === "SORT") {
    if (Array.isArray(data)) return `${data.length} items sorted`;
    return "sorted";
  }

  if (type === "CLICK") {
    if (data !== null && typeof data === "object") {
      const obj = data as Record<string, unknown>;
      if (typeof obj["selector"] === "string") return `clicked ${obj["selector"]}`;
    }
    return "clicked";
  }

  if (Array.isArray(data)) return `${data.length} results`;
  if (data !== null && typeof data !== "undefined") return "completed";
  return type.toLowerCase();
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

/**
 * Converts a query execution trace into a ProcessTrace with one StageNode per
 * execution step and edges derived from each step's declared dependencies.
 */
export class QueryExecutorAdapter {
  /**
   * Build a ProcessTrace from a QueryExecutionTraceInput.
   *
   * Each step in `input.steps` becomes a StageNode.
   * Each dependency declaration becomes a directed edge: dep → step.
   */
  static fromExecutionResult(input: QueryExecutionTraceInput): ProcessTrace {
    const resultsMap = toMap(input.stepResults);

    const stages: StageNode[] = input.steps.map((step): StageNode => {
      const result = resultsMap.get(step.id);

      // Status
      let status: StageStatus;
      if (!result) {
        status = "pending";
      } else if (result.success) {
        status = "completed";
      } else {
        status = "error";
      }

      // Timing
      const timing: StageTiming = result
        ? result.timing
        : { startTime: 0, endTime: 0, duration: step.estimatedCost ?? 0 };

      // Output
      const outputData = result?.data;
      const outputSummary = result
        ? buildOutputSummary(step.type, outputData)
        : `${step.type.toLowerCase()} (pending)`;

      const metrics: Record<string, number | string | boolean> = {
        cacheable: step.cacheable,
        cacheHit: result?.cacheHit ?? false,
        duration: timing.duration,
      };

      const node: StageNode = {
        id: step.id,
        stage: `${step.type}(${step.id})`,
        pipeline: "query",
        status,
        timing,
        inputSummary: `Step ${step.type}`,
        outputData,
        outputSummary,
        metrics,
      };

      if (result && !result.success && result.error) {
        node.error = result.error;
      }

      return node;
    });

    // Build edges from dependency declarations
    const edges: StageEdge[] = [];
    for (const step of input.steps) {
      for (const dep of step.dependencies) {
        edges.push({
          id: `${dep}->${step.id}`,
          sourceStage: dep,
          targetStage: step.id,
          dataFlowLabel: "depends on",
        });
      }
    }

    return ProcessTraceModel.fromStages("query", stages, edges, {
      queryId: input.queryId,
      totalTime: input.totalTime,
      cacheHits: input.cacheHits,
      cacheMisses: input.cacheMisses,
    });
  }
}

import type { ProcessTrace, StageNode, StageEdge } from "../types.ts";
import { ProcessTraceModel } from "../ProcessTraceModel.ts";

/** Input shape for the rendering pipeline adapter — defined locally, no browser engine import */
export interface RenderingTraceInput {
  timing: {
    htmlFetch: number;
    htmlParse: number;
    cssFetch: number;
    cssParse: number;
    scriptExecution: number;
    styleResolution: number;
    layoutComputation: number;
    paintRecording: number;
    compositing: number;
    total: number;
  };
  dom: unknown;
  cssom: unknown;
  renderTree: unknown;
  layoutTree: unknown;
  displayList: unknown;
  scriptExecutor?: unknown;
  resources: Array<{
    url: string;
    type: string;
    size: number;
    fetchTime: number;
    cached: boolean;
  }>;
}

/** Walk a DOM-like node tree and count all nodes recursively */
function countDomNodes(node: unknown): number {
  if (node === null || node === undefined) return 0;
  let count = 1;
  const n = node as { childNodes?: unknown[] };
  if (Array.isArray(n.childNodes)) {
    for (const child of n.childNodes) {
      count += countDomNodes(child);
    }
  }
  return count;
}

/**
 * Adapter that converts a BrowserX rendering pipeline result into a 9-stage ProcessTrace.
 * Does NOT import from browser/src/ — accepts the generic RenderingTraceInput shape.
 */
export class RenderingPipelineAdapter {
  /**
   * Convert a rendering pipeline result into a 9-stage ProcessTrace.
   * Stages follow the full browser rendering pipeline from HTML fetch through compositing.
   */
  static fromRenderingResult(result: RenderingTraceInput): ProcessTrace {
    const t = result.timing;

    // Cumulative start times for each stage
    const starts = [
      0,
      t.htmlFetch,
      t.htmlFetch + t.htmlParse,
      t.htmlFetch + t.htmlParse + t.cssFetch,
      t.htmlFetch + t.htmlParse + t.cssFetch + t.cssParse,
      t.htmlFetch + t.htmlParse + t.cssFetch + t.cssParse + t.scriptExecution,
      t.htmlFetch + t.htmlParse + t.cssFetch + t.cssParse + t.scriptExecution + t.styleResolution,
      t.htmlFetch +
        t.htmlParse +
        t.cssFetch +
        t.cssParse +
        t.scriptExecution +
        t.styleResolution +
        t.layoutComputation,
      t.htmlFetch +
        t.htmlParse +
        t.cssFetch +
        t.cssParse +
        t.scriptExecution +
        t.styleResolution +
        t.layoutComputation +
        t.paintRecording,
    ];

    // --- Stage 1: HTML Fetch ---
    const htmlResource = result.resources.find((r) => r.type === "html") ?? result.resources[0];
    const s1: StageNode = {
      id: "s1",
      stage: "HTML Fetch",
      pipeline: "rendering",
      status: "completed",
      timing: {
        startTime: starts[0],
        endTime: starts[0] + t.htmlFetch,
        duration: t.htmlFetch,
      },
      inputSummary: htmlResource ? `GET ${htmlResource.url}` : "HTML fetch",
      outputData: htmlResource ?? null,
      outputSummary: htmlResource
        ? `${htmlResource.size} bytes${htmlResource.cached ? " (cached)" : ""}`
        : "no resource",
      metrics: htmlResource
        ? {
            url: htmlResource.url,
            size: htmlResource.size,
            cached: htmlResource.cached,
            fetchTime: htmlResource.fetchTime,
          }
        : {},
    };

    // --- Stage 2: HTML Parse ---
    const nodeCount = countDomNodes(result.dom);
    const s2: StageNode = {
      id: "s2",
      stage: "HTML Parse",
      pipeline: "rendering",
      status: "completed",
      timing: {
        startTime: starts[1],
        endTime: starts[1] + t.htmlParse,
        duration: t.htmlParse,
      },
      inputSummary: "HTML bytes",
      outputData: result.dom,
      outputSummary: `document with ${nodeCount} nodes`,
      metrics: { nodeCount },
    };

    // --- Stage 3: CSS Fetch ---
    const cssResources = result.resources.filter((r) => r.type === "css" || r.type === "stylesheet");
    const totalCssSize = cssResources.reduce((sum, r) => sum + r.size, 0);
    const s3: StageNode = {
      id: "s3",
      stage: "CSS Fetch",
      pipeline: "rendering",
      status: "completed",
      timing: {
        startTime: starts[2],
        endTime: starts[2] + t.cssFetch,
        duration: t.cssFetch,
      },
      inputSummary: `${cssResources.length} stylesheet(s)`,
      outputData: cssResources,
      outputSummary: `${cssResources.length} sheets, ${totalCssSize} bytes`,
      metrics: { sheetCount: cssResources.length, totalSize: totalCssSize },
    };

    // --- Stage 4: CSS Parse ---
    const cssom = result.cssom as { rules?: unknown[]; length?: number } | null | undefined;
    const ruleCount = cssom?.rules?.length ?? cssom?.length ?? 0;
    const s4: StageNode = {
      id: "s4",
      stage: "CSS Parse",
      pipeline: "rendering",
      status: "completed",
      timing: {
        startTime: starts[3],
        endTime: starts[3] + t.cssParse,
        duration: t.cssParse,
      },
      inputSummary: "CSS text",
      outputData: result.cssom,
      outputSummary: `${ruleCount} CSS rule(s)`,
      metrics: { ruleCount },
    };

    // --- Stage 5: Script Execution ---
    const scriptEnabled = t.scriptExecution > 0;
    const s5: StageNode = {
      id: "s5",
      stage: "Script Execution",
      pipeline: "rendering",
      status: "completed",
      timing: {
        startTime: starts[4],
        endTime: starts[4] + t.scriptExecution,
        duration: t.scriptExecution,
      },
      inputSummary: scriptEnabled ? "JS scripts" : "no scripts",
      outputData: result.scriptExecutor ?? null,
      outputSummary: scriptEnabled
        ? `executed in ${t.scriptExecution}ms`
        : "disabled",
      metrics: scriptEnabled
        ? { duration: t.scriptExecution }
        : { disabled: true },
    };

    // --- Stage 6: Style Resolution ---
    const s6: StageNode = {
      id: "s6",
      stage: "Style Resolution",
      pipeline: "rendering",
      status: "completed",
      timing: {
        startTime: starts[5],
        endTime: starts[5] + t.styleResolution,
        duration: t.styleResolution,
      },
      inputSummary: "DOM + CSSOM",
      outputData: result.renderTree,
      outputSummary: "render tree built",
      metrics: { duration: t.styleResolution },
    };

    // --- Stage 7: Layout ---
    const s7: StageNode = {
      id: "s7",
      stage: "Layout",
      pipeline: "rendering",
      status: "completed",
      timing: {
        startTime: starts[6],
        endTime: starts[6] + t.layoutComputation,
        duration: t.layoutComputation,
      },
      inputSummary: "RenderTree",
      outputData: result.layoutTree,
      outputSummary: "layout boxes computed",
      metrics: { duration: t.layoutComputation },
    };

    // --- Stage 8: Paint ---
    const s8: StageNode = {
      id: "s8",
      stage: "Paint",
      pipeline: "rendering",
      status: "completed",
      timing: {
        startTime: starts[7],
        endTime: starts[7] + t.paintRecording,
        duration: t.paintRecording,
      },
      inputSummary: "LayoutBox tree",
      outputData: result.displayList,
      outputSummary: "display list recorded",
      metrics: { duration: t.paintRecording },
    };

    // --- Stage 9: Composite ---
    const s9: StageNode = {
      id: "s9",
      stage: "Composite",
      pipeline: "rendering",
      status: "completed",
      timing: {
        startTime: starts[8],
        endTime: starts[8] + t.compositing,
        duration: t.compositing,
      },
      inputSummary: "DisplayList",
      outputData: null,
      outputSummary: "pixels composited",
      metrics: { duration: t.compositing },
    };

    const stages: StageNode[] = [s1, s2, s3, s4, s5, s6, s7, s8, s9];

    // Linear chain of edges with data-flow labels
    const edgeLabels = [
      "HTML bytes",
      "DOMNode tree",
      "CSS text",
      "CSSOM",
      "styled DOM",
      "RenderTree",
      "LayoutBox tree",
      "DisplayList",
      "pixels",
    ];

    const edges: StageEdge[] = [];
    for (let i = 0; i < stages.length - 1; i++) {
      const src = stages[i];
      const tgt = stages[i + 1];
      edges.push({
        id: `${src.id}->${tgt.id}`,
        sourceStage: src.id,
        targetStage: tgt.id,
        dataFlowLabel: edgeLabels[i],
      });
    }

    return ProcessTraceModel.fromStages("rendering", stages, edges, {
      totalResources: result.resources.length,
      totalDuration: t.total,
    });
  }
}

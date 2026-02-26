// Shim HTMLElement for non-browser environments (Deno CLI, tests)
if (typeof globalThis.HTMLElement === "undefined") {
  (globalThis as Record<string, unknown>).HTMLElement = class HTMLElement {
    connectedCallback() {}
    disconnectedCallback() {}
    setAttribute(_name: string, _value: string) {}
    getAttribute(_name: string): string | null { return null; }
    attachShadow(_init: unknown): unknown { return { innerHTML: "" }; }
  };
}

import { Graph } from "../graph/Graph.ts";
import { DiGraph } from "../graph/DiGraph.ts";
// GraphNode and GraphEdge types used implicitly via Graph.nodes()/edges() return types
import { forceDirected } from "../layout/force-directed.ts";
import { hierarchical } from "../layout/hierarchical.ts";
import { radial } from "../layout/radial.ts";
import { grid } from "../layout/grid.ts";
import { render as renderSVG } from "../svg/SVGRenderer.ts";
import type { LayoutResult } from "../layout/types.ts";
import type {
  ProcessTrace,
  StageNode,
  GraphXCanvasOptions,
  StageNodeRect,
} from "./types.ts";
import { CanvasRenderer } from "./CanvasRenderer.ts";
import { InteractionManager } from "./InteractionManager.ts";
import { AnimationController } from "./AnimationController.ts";
import { DetailPanel } from "./DetailPanel.ts";
import { ProcessTraceModel } from "./ProcessTraceModel.ts";
import { resolveTheme } from "./themes.ts";
import { RenderingPipelineAdapter } from "./adapters/RenderingPipelineAdapter.ts";
import { RequestPipelineAdapter } from "./adapters/RequestPipelineAdapter.ts";
import { QueryExecutorAdapter } from "./adapters/QueryExecutorAdapter.ts";
import { ProxyMiddlewareAdapter } from "./adapters/ProxyMiddlewareAdapter.ts";
import type { RenderingTraceInput } from "./adapters/RenderingPipelineAdapter.ts";
import type { RequestTraceInput } from "./adapters/RequestPipelineAdapter.ts";
import type { QueryExecutionTraceInput } from "./adapters/QueryExecutorAdapter.ts";
import type { ProxyTraceInput } from "./adapters/ProxyMiddlewareAdapter.ts";

const SHADOW_STYLES = `
:host {
  display: block;
  position: relative;
  overflow: hidden;
}
canvas {
  display: block;
  width: 100%;
  height: 100%;
}
.detail-panel {
  position: absolute;
  top: 8px;
  right: 8px;
  max-width: 340px;
  max-height: 60%;
  overflow-y: auto;
  border-radius: 8px;
  padding: 12px;
  font-family: monospace;
  font-size: 12px;
  pointer-events: auto;
  opacity: 0;
  transition: opacity 0.2s;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}
.detail-panel.visible {
  opacity: 1;
}
`;

/**
 * <graphx-canvas> — an embeddable web component that visualizes BrowserX process traces.
 *
 * Attach to any pipeline result to see stages, data flow, timing, and metadata:
 *   canvas.traceRendering(result)   — 9-stage rendering pipeline trace
 *   canvas.traceRequest(result)     — 6-stage network request trace
 *   canvas.traceQuery(result)       — N-stage query execution trace
 *   canvas.traceProxy(input)        — middleware chain trace
 *
 * Click any stage node to inspect its actual output data (DOM tree, headers, layout boxes, etc.)
 */
const BaseElement = typeof HTMLElement !== "undefined"
  ? HTMLElement
  : (class {} as unknown as typeof HTMLElement);

export class GraphXCanvas extends BaseElement {
  private _canvas!: HTMLCanvasElement;
  private _panelEl!: HTMLElement;
  private _renderer!: CanvasRenderer;
  private _interaction!: InteractionManager;
  private _animation!: AnimationController;
  private _panel!: DetailPanel;

  private _trace: ProcessTrace | null = null;
  private _layout: LayoutResult | null = null;
  private _selectedId: string | null = null;
  private _hoveredId: string | null = null;
  private _nodeRects: StageNodeRect[] = [];
  private _options: GraphXCanvasOptions = {};

  static get observedAttributes(): string[] {
    return [
      "width", "height", "theme", "layout", "layout-direction",
      "show-labels", "show-timing", "show-data-flow", "show-panel", "auto-fit",
    ];
  }

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = SHADOW_STYLES;

    this._canvas = document.createElement("canvas");
    this._canvas.width = 800;
    this._canvas.height = 600;

    this._panelEl = document.createElement("div");
    this._panelEl.className = "detail-panel";

    shadow.appendChild(style);
    shadow.appendChild(this._canvas);
    shadow.appendChild(this._panelEl);
  }

  connectedCallback(): void {
    this._syncOptions();

    const theme = resolveTheme(this._options.theme);
    const ctx = this._canvas.getContext("2d")!;

    this._renderer = new CanvasRenderer(ctx, theme);
    this._interaction = new InteractionManager(this._canvas);
    this._panel = new DetailPanel(this._panelEl, theme);
    this._animation = new AnimationController((ts) => this._renderFrame(ts));

    this._interaction.onStageSelect = (id) => {
      this._selectedId = id;
      if (id && this._trace) {
        const stage = this._trace.stages.find((s) => s.id === id);
        if (stage) {
          this._panel.showStage(stage);
          this.dispatchEvent(new CustomEvent("stage-select", { detail: { stage } }));
        }
      } else {
        this._panel.hide();
      }
      this._animation.markDirty();
    };

    this._interaction.onStageHover = (id) => {
      this._hoveredId = id;
      this._animation.markDirty();
      this.dispatchEvent(new CustomEvent("stage-hover", { detail: { stageId: id } }));
    };

    this._interaction.attach();
    this._animation.start();
  }

  disconnectedCallback(): void {
    this._animation?.stop();
    this._interaction?.detach();
  }

  attributeChangedCallback(_name: string, _oldVal: string | null, _newVal: string | null): void {
    this._syncOptions();
    if (this._trace) {
      this._computeLayout();
      this._animation?.markDirty();
    }
  }

  // --- Public API: Trace pipelines ---

  /** Trace a rendering pipeline result (9 stages: fetch→parse→style→layout→paint→composite) */
  traceRendering(result: RenderingTraceInput): void {
    this._setTrace(RenderingPipelineAdapter.fromRenderingResult(result));
  }

  /** Trace a network request result (6 stages: cache→DNS→TCP→TLS→send→receive) */
  traceRequest(result: RequestTraceInput): void {
    this._setTrace(RequestPipelineAdapter.fromRequestResult(result));
  }

  /** Trace a query execution (one stage per step, edges from dependencies) */
  traceQuery(input: QueryExecutionTraceInput): void {
    this._setTrace(QueryExecutorAdapter.fromExecutionResult(input));
  }

  /** Trace a proxy middleware chain (incoming→middlewares→route→upstream→response) */
  traceProxy(input: ProxyTraceInput): void {
    this._setTrace(ProxyMiddlewareAdapter.fromProxyRequest(input));
  }

  /** Set a ProcessTrace directly */
  setTrace(trace: ProcessTrace): void {
    this._setTrace(trace);
  }

  /** Set a raw GraphX graph (generic, non-pipeline mode) */
  setGraph(graph: Graph<unknown, unknown>): void {
    const stages: StageNode[] = graph.nodes().map((n) => ({
      id: n.id,
      stage: n.label || n.id,
      pipeline: "rendering" as const,
      status: "completed" as const,
      timing: { startTime: 0, endTime: 0, duration: 0 },
      inputSummary: "",
      outputData: n.data,
      outputSummary: n.label || n.id,
      metrics: {},
    }));

    const edges = graph.edges().map((e) => ({
      id: e.id,
      sourceStage: e.source,
      targetStage: e.target,
      dataFlowLabel: e.label || "",
    }));

    this._setTrace(ProcessTraceModel.fromStages("rendering", stages, edges));
  }

  /** Live update: update a specific stage (for live tracing) */
  updateStage(stageId: string, update: Partial<StageNode>): void {
    if (!this._trace) return;
    this._trace = ProcessTraceModel.updateStage(this._trace, stageId, update);
    this._animation?.markDirty();
  }

  // --- Selection ---

  selectStage(id: string): void {
    this._selectedId = id;
    if (this._trace) {
      const stage = this._trace.stages.find((s) => s.id === id);
      if (stage) this._panel?.showStage(stage);
    }
    this._animation?.markDirty();
  }

  clearSelection(): void {
    this._selectedId = null;
    this._panel?.hide();
    this._animation?.markDirty();
  }

  getSelectedStage(): StageNode | null {
    if (!this._selectedId || !this._trace) return null;
    return this._trace.stages.find((s) => s.id === this._selectedId) ?? null;
  }

  // --- Export ---

  /** Export the current canvas as a data URL (PNG or JPEG) */
  toDataURL(type = "image/png"): string {
    return this._canvas.toDataURL(type);
  }

  /** Export the current trace as SVG using the existing GraphX SVGRenderer */
  toSVG(): string {
    if (!this._trace || !this._layout) return "<svg></svg>";
    return renderSVG(this._trace.graph, this._layout, {
      showLabels: this._options.showLabels !== false,
      directed: true,
    });
  }

  /** Adjust view to fit all content */
  fitToContent(): void {
    if (this._layout) {
      this._interaction.fitToContent(this._layout, this._canvas.width, this._canvas.height);
      this._animation?.markDirty();
    }
  }

  // --- Internals ---

  private _setTrace(trace: ProcessTrace): void {
    this._trace = trace;
    this._selectedId = null;
    this._panel?.hide();
    this._computeLayout();
    if (this._options.autoFit !== false) {
      this.fitToContent();
    }
    this._animation?.markDirty();
    this.dispatchEvent(new CustomEvent("trace-complete", { detail: { trace } }));
  }

  private _computeLayout(): void {
    if (!this._trace) return;
    const graph = this._trace.graph;
    const layoutType = this._options.layout || "hierarchical";
    const direction = this._options.layoutDirection || "LR";

    switch (layoutType) {
      case "hierarchical":
        this._layout = hierarchical(graph as DiGraph<unknown, unknown>, {
          direction,
          horizontalSpacing: 120,
          verticalSpacing: 80,
        });
        break;
      case "force":
        this._layout = forceDirected(graph, {
          width: this._canvas.width,
          height: this._canvas.height,
          iterations: 50,
        });
        break;
      case "radial":
        this._layout = radial(graph, {
          center: { x: this._canvas.width / 2, y: this._canvas.height / 2 },
          radius: Math.min(this._canvas.width, this._canvas.height) / 3,
        });
        break;
      case "grid":
        this._layout = grid(graph, {
          cellWidth: CanvasRenderer.NODE_WIDTH + 40,
          cellHeight: CanvasRenderer.NODE_HEIGHT + 40,
        });
        break;
    }
  }

  private _renderFrame(_timestamp: number): void {
    if (!this._trace || !this._layout || !this._renderer) return;

    this._nodeRects = this._renderer.render(
      this._trace,
      this._layout,
      this._interaction.transform,
      this._selectedId,
      this._hoveredId,
      this._options.showTiming !== false,
      this._options.showDataFlow !== false,
    );
    this._interaction.setNodeRects(this._nodeRects);
  }

  private _syncOptions(): void {
    this._options = {
      width: this._getNumAttr("width", 800),
      height: this._getNumAttr("height", 600),
      theme: (this.getAttribute("theme") as "light" | "dark") || "light",
      layout: (this.getAttribute("layout") as GraphXCanvasOptions["layout"]) || "hierarchical",
      layoutDirection: (this.getAttribute("layout-direction") as GraphXCanvasOptions["layoutDirection"]) || "LR",
      showLabels: this.getAttribute("show-labels") !== "false",
      showTiming: this.getAttribute("show-timing") !== "false",
      showDataFlow: this.getAttribute("show-data-flow") !== "false",
      showPanel: this.getAttribute("show-panel") !== "false",
      autoFit: this.getAttribute("auto-fit") !== "false",
    };

    if (this._canvas) {
      this._canvas.width = this._options.width!;
      this._canvas.height = this._options.height!;
    }

    if (this._renderer) {
      this._renderer.setTheme(resolveTheme(this._options.theme));
    }
    if (this._panel) {
      this._panel.setTheme(resolveTheme(this._options.theme));
    }
  }

  private _getNumAttr(name: string, fallback: number): number {
    const val = this.getAttribute(name);
    return val ? parseInt(val, 10) : fallback;
  }
}

// Register the custom element
if (typeof customElements !== "undefined") {
  customElements.define("graphx-canvas", GraphXCanvas);
}

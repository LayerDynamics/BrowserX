/**
 * RenderingOrchestrator
 *
 * Orchestrates the complete render() pipeline: fetch -> parse -> style -> layout -> paint -> composite.
 * Manages observer pattern for pipeline stage events.
 */

import type { Pixels } from "../../types/identifiers.ts";
import type { DOMNode } from "../../types/dom.ts";
import type { LayoutBox } from "../../types/rendering.ts";
import { StyleResolver } from "./css-parser/StyleResolver.ts";
import { RenderTree } from "./rendering/RenderTree.ts";
import { LayoutEngine } from "./layout/LayoutEngine.ts";
import { DisplayList } from "./paint/DisplayList.ts";
import { PaintContext } from "./paint/PaintContext.ts";
import { CompositorThread } from "./compositor/CompositorThread.ts";
import { ScriptExecutor } from "../javascript/ScriptExecutor.ts";
import { ContentSecurityPolicy } from "../security/ContentSecurityPolicy.ts";
import type { PipelineObserver, PipelineStageEvent } from "../PipelineObserver.ts";
import type { StorageManager } from "../storage/StorageManager.ts";
import type {
  RenderingOptions,
  RenderingResult,
  RenderingTiming,
  ResourceInfo,
} from "../RenderingPipeline.ts";
import { RenderingPipelineError } from "../RenderingPipeline.ts";
import { ResourceFetcher } from "./ResourceFetcher.ts";
import type { RequestPipeline } from "../RequestPipeline.ts";
import { RenderToPixels } from "./paint/RenderToPixels.ts";

/**
 * RenderingOrchestrator runs the main render pipeline and manages the observer.
 */
export class RenderingOrchestrator {
  private observer?: PipelineObserver;
  private lastRenderArtifacts?: {
    dom: unknown;
    cssom: unknown;
    renderTree: unknown;
    layoutTree: unknown;
    displayList: unknown;
  };
  private csp?: ContentSecurityPolicy;
  private renderToPixels: RenderToPixels;

  constructor(
    private resourceFetcher: ResourceFetcher,
    private compositor: CompositorThread,
    private width: number,
    private height: number,
    private enableJavaScript: boolean,
    private storageManager?: StorageManager,
  ) {
    this.renderToPixels = new RenderToPixels();
  }

  setObserver(observer: PipelineObserver): void {
    this.observer = observer;
  }

  getLastRenderArtifacts(): {
    dom: unknown;
    cssom: unknown;
    renderTree: unknown;
    layoutTree: unknown;
    displayList: unknown;
  } | undefined {
    return this.lastRenderArtifacts;
  }

  setCSP(csp: ContentSecurityPolicy | undefined): void {
    this.csp = csp;
    this.resourceFetcher.setCSP(csp);
  }

  getCSP(): ContentSecurityPolicy | undefined {
    return this.csp;
  }

  setDimensions(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  private emitStage(
    stageId: string,
    stageName: string,
    status: PipelineStageEvent["status"],
    startTime: number,
    endTime?: number,
    duration?: number,
    artifact?: unknown,
    error?: Error,
  ): void {
    this.observer?.onStage({
      stageId,
      stageName,
      pipeline: "rendering",
      status,
      startTime,
      endTime,
      duration,
      artifact,
      error,
    });
  }

  /**
   * Load and render page
   */
  async render(
    url: string | URL,
    options: RenderingOptions = {},
    requestPipeline: RequestPipeline,
  ): Promise<RenderingResult> {
    if (options.signal?.aborted) {
      throw options.signal.reason || new Error("Rendering aborted");
    }

    const startTime = Date.now();
    const timing: Partial<RenderingTiming> = {};
    this.resourceFetcher.clearResources();

    try {
      // 1. Fetch HTML
      this.emitStage("html-fetch", "HTML Fetch", "running", Date.now());
      const htmlStart = Date.now();
      const htmlResult = await this.resourceFetcher.fetchHTML(url, options.signal);
      timing.htmlFetch = Date.now() - htmlStart;
      this.emitStage(
        "html-fetch",
        "HTML Fetch",
        "completed",
        htmlStart,
        Date.now(),
        timing.htmlFetch,
        htmlResult,
      );

      this.resourceFetcher.getResources().push({
        url: htmlResult.request.url,
        type: "html",
        size: htmlResult.response.body.byteLength,
        fetchTime: timing.htmlFetch,
        cached: htmlResult.fromCache,
      });

      // Parse CSP header
      const cspHeader = htmlResult.response.headers?.get("content-security-policy");
      const cspReportHeader = htmlResult.response.headers?.get(
        "content-security-policy-report-only",
      );
      if (cspHeader) {
        this.setCSP(new ContentSecurityPolicy(cspHeader, false));
      } else if (cspReportHeader) {
        this.setCSP(new ContentSecurityPolicy(cspReportHeader, true));
      }

      // 2. Parse HTML -> DOM
      this.emitStage("html-parse", "HTML Parse", "running", Date.now());
      const parseStart = Date.now();
      const dom = await this.resourceFetcher.parseHTML(htmlResult.response.body);
      timing.htmlParse = Date.now() - parseStart;
      this.emitStage(
        "html-parse",
        "HTML Parse",
        "completed",
        parseStart,
        Date.now(),
        timing.htmlParse,
        dom,
      );

      // 3. Discover and fetch CSS
      this.emitStage("css-fetch", "CSS Fetch", "running", Date.now());
      const cssStart = Date.now();
      const stylesheets = await this.resourceFetcher.fetchStylesheets(dom, url);
      timing.cssFetch = Date.now() - cssStart;
      this.emitStage(
        "css-fetch",
        "CSS Fetch",
        "completed",
        cssStart,
        Date.now(),
        timing.cssFetch,
        stylesheets,
      );

      // 4. Parse CSS -> CSSOM
      this.emitStage("css-parse", "CSS Parse", "running", Date.now());
      const cssParseStart = Date.now();
      const cssom = await this.resourceFetcher.parseCSS(stylesheets);
      timing.cssParse = Date.now() - cssParseStart;
      this.emitStage(
        "css-parse",
        "CSS Parse",
        "completed",
        cssParseStart,
        Date.now(),
        timing.cssParse,
        cssom,
      );

      // 4.5. Execute JavaScript (if enabled)
      this.emitStage("script-execution", "Script Execution", "running", Date.now());
      let scriptExecutor: ScriptExecutor | undefined;
      if (options.enableJavaScript ?? this.enableJavaScript) {
        const scriptStart = Date.now();
        scriptExecutor = new ScriptExecutor(
          dom,
          url.toString(),
          requestPipeline,
          this.storageManager,
        );
        if (this.csp) {
          scriptExecutor.setCSP(this.csp);
        }
        await scriptExecutor.executeScriptsInDOM();
        timing.scriptExecution = Date.now() - scriptStart;
      } else {
        timing.scriptExecution = 0;
      }
      this.emitStage(
        "script-execution",
        "Script Execution",
        "completed",
        Date.now(),
        Date.now(),
        timing.scriptExecution,
        scriptExecutor,
      );

      // 5. Build Render Tree
      this.emitStage("style-resolution", "Style Resolution", "running", Date.now());
      const styleStart = Date.now();
      const styleResolver = new StyleResolver(cssom);
      const renderTree = new RenderTree();

      const documentElement = this.resourceFetcher.getDocumentElement(dom);
      if (!documentElement) {
        throw new RenderingPipelineError(
          "No document element found in DOM",
          "render-tree-build",
        );
      }

      renderTree.build(documentElement, styleResolver);
      timing.styleResolution = Date.now() - styleStart;
      this.emitStage(
        "style-resolution",
        "Style Resolution",
        "completed",
        styleStart,
        Date.now(),
        timing.styleResolution,
        renderTree,
      );

      // 6. Layout
      this.emitStage("layout", "Layout", "running", Date.now());
      const layoutStart = Date.now();
      const layoutEngine = new LayoutEngine();
      const rootRenderObject = renderTree.getRoot();
      layoutEngine.layout(
        rootRenderObject,
        { width: this.width as Pixels, height: this.height as Pixels },
      );
      const layoutTree = rootRenderObject.layout!;
      timing.layoutComputation = Date.now() - layoutStart;
      this.emitStage(
        "layout",
        "Layout",
        "completed",
        layoutStart,
        Date.now(),
        timing.layoutComputation,
        layoutTree,
      );

      // 6.5. Fetch images
      const enableImages = options.enableImages ?? true;
      let imageMap = new Map<string, import("../../types/dom.ts").CanvasImageSource>();
      if (enableImages) {
        imageMap = await this.resourceFetcher.fetchImages(htmlResult, url, options.signal);
      }

      // 7. Paint
      this.emitStage("paint", "Paint", "running", Date.now());
      const paintStart = Date.now();
      const displayList = new DisplayList();
      const paintContext = new PaintContext();
      this.paint(layoutTree, paintContext);

      for (const command of paintContext.getCommands()) {
        const params = command.params && typeof command.params === "object"
          ? command.params as Record<string, unknown>
          : {};
        const displayCommand = {
          type: command.type,
          ...params,
        } as import("./paint/DisplayList.ts").AnyPaintCommand;
        displayList.add(displayCommand);
      }

      for (const [src, img] of imageMap) {
        displayList.registerImage(src, img);
      }

      // Also paint through RenderToPixels for stacking-context-aware layer tree
      const paintResult = this.renderToPixels.paint(
        rootRenderObject,
        this.width as Pixels,
        this.height as Pixels,
        false,
      );

      timing.paintRecording = Date.now() - paintStart;
      this.emitStage(
        "paint",
        "Paint",
        "completed",
        paintStart,
        Date.now(),
        timing.paintRecording,
        displayList,
      );

      // 7.5. Pass render tree to compositor for CPU rendering
      if (this.compositor.isCPUMode()) {
        this.compositor.setRenderTree(rootRenderObject);
      }

      // 8. Composite
      this.emitStage("composite", "Composite", "running", Date.now());
      const compositeStart = Date.now();
      this.compositor.composite();
      timing.compositing = Date.now() - compositeStart;
      this.emitStage(
        "composite",
        "Composite",
        "completed",
        compositeStart,
        Date.now(),
        timing.compositing,
      );

      timing.total = Date.now() - startTime;

      const result: RenderingResult = {
        dom,
        cssom,
        renderTree,
        layoutTree,
        displayList,
        layerTree: paintResult.layerTree,
        scriptExecutor,
        timing: timing as RenderingTiming,
        resources: this.resourceFetcher.getResources(),
      };

      this.lastRenderArtifacts = { dom, cssom, renderTree, layoutTree, displayList };

      return result;
    } catch (error) {
      this.emitStage(
        "unknown",
        "Unknown",
        "error",
        startTime,
        Date.now(),
        Date.now() - startTime,
        undefined,
        error instanceof Error ? error : new Error(String(error)),
      );
      if (error instanceof RenderingPipelineError) {
        throw error;
      }
      throw new RenderingPipelineError(
        `Rendering failed: ${error instanceof Error ? error.message : String(error)}`,
        "unknown",
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Paint layout tree to display list
   */
  private paint(layoutBox: LayoutBox, context: PaintContext): void {
    try {
      const style = layoutBox.style;

      // visibility: hidden — skip paint but preserve layout space
      if (style) {
        const visibility = style.getPropertyValue("visibility");
        if (visibility === "hidden") {
          return;
        }
      }

      // Wrap in save/restore for opacity
      const opacityStr = style?.getPropertyValue("opacity");
      const opacityValue =
        opacityStr != null ? parseFloat(opacityStr) : Number.NaN;
      const hasOpacity = !Number.isNaN(opacityValue) && opacityValue < 1;

      if (hasOpacity) {
        context.save();
        const clampedOpacity = Math.max(0, Math.min(1, opacityValue));
        context.setOpacity(clampedOpacity);
      }

      // box-shadow — paint shadow before background
      if (style) {
        const boxShadow = style.getPropertyValue("box-shadow");
        if (boxShadow && boxShadow !== "none") {
          const shadow = this.parseBoxShadow(boxShadow);
          if (shadow) {
            context.setShadow(
              shadow.offsetX as Pixels,
              shadow.offsetY as Pixels,
              shadow.blur as Pixels,
              shadow.color,
            );
            context.fillRect(
              layoutBox.x,
              layoutBox.y,
              layoutBox.width,
              layoutBox.height,
              style.getPropertyValue("background-color") || "transparent",
            );
            context.clearShadow();
          }
        }
      }

      // Background
      if (style) {
        const bgColor = style.getPropertyValue("background-color");
        if (bgColor && bgColor !== "transparent") {
          context.fillRect(
            layoutBox.x,
            layoutBox.y,
            layoutBox.width,
            layoutBox.height,
            bgColor,
          );
        }
      }

      // Borders
      if (style) {
        const borderColor = style.getPropertyValue("border-color") ||
          style.getPropertyValue("border-top-color");
        const borderWidthStr = style.getPropertyValue("border-width") ||
          style.getPropertyValue("border-top-width");
        if (borderColor && borderWidthStr) {
          const borderWidth = parseFloat(borderWidthStr) as Pixels;
          if (borderWidth > 0) {
            context.strokeRect(
              layoutBox.x,
              layoutBox.y,
              layoutBox.width,
              layoutBox.height,
              borderColor,
              borderWidth,
            );
          }
        }
      }

      // Images
      if (layoutBox.src) {
        context.drawImage(
          layoutBox.src,
          layoutBox.x,
          layoutBox.y,
          layoutBox.width,
          layoutBox.height,
        );
      }

      // Text
      if (layoutBox.type === "text" && layoutBox.text) {
        const color = style?.getPropertyValue("color") || "#000000";
        const fontSizeStr = style?.getPropertyValue("font-size");
        const fontSize = fontSizeStr ? parseFloat(fontSizeStr) : 16;
        const fontFamily = style?.getPropertyValue("font-family") || "sans-serif";
        const font = `${fontSize}px ${fontFamily}`;

        // text-shadow
        const textShadow = style?.getPropertyValue("text-shadow");
        if (textShadow && textShadow !== "none") {
          const shadow = this.parseTextShadow(textShadow);
          if (shadow) {
            context.setShadow(
              shadow.offsetX as Pixels,
              shadow.offsetY as Pixels,
              shadow.blur as Pixels,
              shadow.color,
            );
          }
        }

        context.fillText(
          layoutBox.text,
          layoutBox.x,
          layoutBox.y,
          font,
          color,
        );

        if (textShadow && textShadow !== "none") {
          context.clearShadow();
        }
      }

      // Outline (OUTLINE phase — painted after foreground)
      if (style) {
        const outlineColor = style.getPropertyValue("outline-color");
        const outlineWidthStr = style.getPropertyValue("outline-width");
        const outlineStyle = style.getPropertyValue("outline-style");
        if (outlineColor && outlineWidthStr && outlineStyle && outlineStyle !== "none") {
          const outlineWidth = parseFloat(outlineWidthStr) as Pixels;
          if (outlineWidth > 0) {
            context.strokeRect(
              (layoutBox.x - outlineWidth) as Pixels,
              (layoutBox.y - outlineWidth) as Pixels,
              (layoutBox.width + outlineWidth * 2) as Pixels,
              (layoutBox.height + outlineWidth * 2) as Pixels,
              outlineColor,
              outlineWidth,
            );
          }
        }
      }

      // Children
      if (layoutBox.children) {
        for (const child of layoutBox.children) {
          this.paint(child, context);
        }
      }

      if (hasOpacity) {
        context.restore();
      }
    } catch (error) {
      throw new RenderingPipelineError(
        `Failed to paint: ${error instanceof Error ? error.message : String(error)}`,
        "paint",
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Parse a box-shadow or text-shadow CSS value
   * Simplified: handles "offsetX offsetY blur color" format
   */
  private parseBoxShadow(
    value: string,
  ): { offsetX: number; offsetY: number; blur: number; color: string } | null {
    // Match patterns like "2px 2px 4px rgba(0,0,0,0.5)" or "2px 2px 4px #000"
    const match = value.match(
      /(-?\d+(?:\.\d+)?)\s*px\s+(-?\d+(?:\.\d+)?)\s*px\s+(-?\d+(?:\.\d+)?)\s*px\s+(.*)/,
    );
    if (match) {
      return {
        offsetX: parseFloat(match[1]),
        offsetY: parseFloat(match[2]),
        blur: parseFloat(match[3]),
        color: match[4].trim(),
      };
    }
    return null;
  }

  /**
   * Parse a text-shadow CSS value
   * Supports 2-length (offsetX offsetY color) and 3-length (offsetX offsetY blur color) forms.
   * Only parses the first shadow if comma-separated multiples are present.
   */
  private parseTextShadow(
    value: string,
  ): { offsetX: number; offsetY: number; blur: number; color: string } | null {
    // Take only the first shadow if multiple are specified
    const firstShadow = value.split(",")[0].trim();

    // Try 3-length: offsetX offsetY blur color
    const match3 = firstShadow.match(
      /(-?\d+(?:\.\d+)?)\s*px\s+(-?\d+(?:\.\d+)?)\s*px\s+(-?\d+(?:\.\d+)?)\s*px\s+(.*)/,
    );
    if (match3) {
      return {
        offsetX: parseFloat(match3[1]),
        offsetY: parseFloat(match3[2]),
        blur: parseFloat(match3[3]),
        color: match3[4].trim(),
      };
    }

    // Try 2-length: offsetX offsetY color (blur defaults to 0)
    const match2 = firstShadow.match(
      /(-?\d+(?:\.\d+)?)\s*px\s+(-?\d+(?:\.\d+)?)\s*px\s+(.*)/,
    );
    if (match2) {
      return {
        offsetX: parseFloat(match2[1]),
        offsetY: parseFloat(match2[2]),
        blur: 0,
        color: match2[3].trim(),
      };
    }

    return null;
  }
}

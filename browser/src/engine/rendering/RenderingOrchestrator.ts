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

/**
 * RenderingOrchestrator runs the main render pipeline and manages the observer.
 */
export class RenderingOrchestrator {
    private observer?: PipelineObserver;
    private lastRenderArtifacts?: { dom: unknown; cssom: unknown; renderTree: unknown; layoutTree: unknown; displayList: unknown };
    private csp?: ContentSecurityPolicy;

    constructor(
        private resourceFetcher: ResourceFetcher,
        private compositor: CompositorThread,
        private width: number,
        private height: number,
        private enableJavaScript: boolean,
        private storageManager?: StorageManager,
    ) {}

    setObserver(observer: PipelineObserver): void {
        this.observer = observer;
    }

    getLastRenderArtifacts(): { dom: unknown; cssom: unknown; renderTree: unknown; layoutTree: unknown; displayList: unknown } | undefined {
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

    private emitStage(stageId: string, stageName: string, status: PipelineStageEvent["status"], startTime: number, endTime?: number, duration?: number, artifact?: unknown, error?: Error): void {
        this.observer?.onStage({ stageId, stageName, pipeline: "rendering", status, startTime, endTime, duration, artifact, error });
    }

    /**
     * Load and render page
     */
    async render(url: string | URL, options: RenderingOptions = {}, requestPipeline: RequestPipeline): Promise<RenderingResult> {
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
            this.emitStage("html-fetch", "HTML Fetch", "completed", htmlStart, Date.now(), timing.htmlFetch, htmlResult);

            this.resourceFetcher.getResources().push({
                url: htmlResult.request.url,
                type: "html",
                size: htmlResult.response.body.byteLength,
                fetchTime: timing.htmlFetch,
                cached: htmlResult.fromCache,
            });

            // Parse CSP header
            const cspHeader = htmlResult.response.headers?.get("content-security-policy");
            const cspReportHeader = htmlResult.response.headers?.get("content-security-policy-report-only");
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
            this.emitStage("html-parse", "HTML Parse", "completed", parseStart, Date.now(), timing.htmlParse, dom);

            // 3. Discover and fetch CSS
            this.emitStage("css-fetch", "CSS Fetch", "running", Date.now());
            const cssStart = Date.now();
            const stylesheets = await this.resourceFetcher.fetchStylesheets(dom, url);
            timing.cssFetch = Date.now() - cssStart;
            this.emitStage("css-fetch", "CSS Fetch", "completed", cssStart, Date.now(), timing.cssFetch, stylesheets);

            // 4. Parse CSS -> CSSOM
            this.emitStage("css-parse", "CSS Parse", "running", Date.now());
            const cssParseStart = Date.now();
            const cssom = await this.resourceFetcher.parseCSS(stylesheets);
            timing.cssParse = Date.now() - cssParseStart;
            this.emitStage("css-parse", "CSS Parse", "completed", cssParseStart, Date.now(), timing.cssParse, cssom);

            // 4.5. Execute JavaScript (if enabled)
            this.emitStage("script-execution", "Script Execution", "running", Date.now());
            let scriptExecutor: ScriptExecutor | undefined;
            if (options.enableJavaScript ?? this.enableJavaScript) {
                const scriptStart = Date.now();
                scriptExecutor = new ScriptExecutor(dom, url.toString(), requestPipeline, this.storageManager);
                if (this.csp) {
                    scriptExecutor.setCSP(this.csp);
                }
                await scriptExecutor.executeScriptsInDOM();
                timing.scriptExecution = Date.now() - scriptStart;
            } else {
                timing.scriptExecution = 0;
            }
            this.emitStage("script-execution", "Script Execution", "completed", Date.now(), Date.now(), timing.scriptExecution, scriptExecutor);

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
            this.emitStage("style-resolution", "Style Resolution", "completed", styleStart, Date.now(), timing.styleResolution, renderTree);

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
            this.emitStage("layout", "Layout", "completed", layoutStart, Date.now(), timing.layoutComputation, layoutTree);

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
                const params = command.params && typeof command.params === "object" ? command.params as Record<string, unknown> : {};
                const displayCommand = {
                    type: command.type,
                    ...params,
                } as import("./paint/DisplayList.ts").AnyPaintCommand;
                displayList.add(displayCommand);
            }

            for (const [src, img] of imageMap) {
                displayList.registerImage(src, img);
            }

            timing.paintRecording = Date.now() - paintStart;
            this.emitStage("paint", "Paint", "completed", paintStart, Date.now(), timing.paintRecording, displayList);

            // 7.5. Pass render tree to compositor for CPU rendering
            if (this.compositor.isCPUMode()) {
                this.compositor.setRenderTree(rootRenderObject);
            }

            // 8. Composite
            this.emitStage("composite", "Composite", "running", Date.now());
            const compositeStart = Date.now();
            this.compositor.composite();
            timing.compositing = Date.now() - compositeStart;
            this.emitStage("composite", "Composite", "completed", compositeStart, Date.now(), timing.compositing);

            timing.total = Date.now() - startTime;

            const result: RenderingResult = {
                dom,
                cssom,
                renderTree,
                layoutTree,
                displayList,
                scriptExecutor,
                timing: timing as RenderingTiming,
                resources: this.resourceFetcher.getResources(),
            };

            this.lastRenderArtifacts = { dom, cssom, renderTree, layoutTree, displayList };

            return result;
        } catch (error) {
            this.emitStage("unknown", "Unknown", "error", startTime, Date.now(), Date.now() - startTime, undefined, error instanceof Error ? error : new Error(String(error)));
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

            if (style) {
                const borderColor = style.getPropertyValue("border-color") || style.getPropertyValue("border-top-color");
                const borderWidthStr = style.getPropertyValue("border-width") || style.getPropertyValue("border-top-width");
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

            if (layoutBox.src) {
                context.drawImage(
                    layoutBox.src,
                    layoutBox.x,
                    layoutBox.y,
                    layoutBox.width,
                    layoutBox.height,
                );
            }

            if (layoutBox.type === "text" && layoutBox.text) {
                const color = style?.getPropertyValue("color") || "#000000";
                const fontSizeStr = style?.getPropertyValue("font-size");
                const fontSize = fontSizeStr ? parseFloat(fontSizeStr) : 16;
                const fontFamily = style?.getPropertyValue("font-family") || "sans-serif";
                const font = `${fontSize}px ${fontFamily}`;
                context.fillText(
                    layoutBox.text,
                    layoutBox.x,
                    layoutBox.y,
                    font,
                    color,
                );
            }

            if (layoutBox.children) {
                for (const child of layoutBox.children) {
                    this.paint(child, context);
                }
            }
        } catch (error) {
            throw new RenderingPipelineError(
                `Failed to paint: ${error instanceof Error ? error.message : String(error)}`,
                "paint",
                error instanceof Error ? error : undefined,
            );
        }
    }
}

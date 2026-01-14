/**
 * Rendering Pipeline
 *
 * Orchestrates the complete rendering lifecycle from HTML to pixels:
 * 1. Fetch HTML (via RequestPipeline)
 * 2. Parse HTML → DOM Tree
 * 3. Fetch CSS → Parse CSS → CSSOM
 * 4. Build Render Tree
 * 5. Layout → Geometry
 * 6. Paint → Display List
 * 7. Composite → Pixels on screen
 */

import type { ByteBuffer, Pixels } from "../types/identifiers.ts";
import type { DOMElement, DOMNode, DOMNodeType } from "../types/dom.ts";
import type { CSSStyleSheet } from "../types/css.ts";
import type { LayoutBox } from "../types/rendering.ts";
import { RequestPipeline, type RequestResult } from "./RequestPipeline.ts";
import { HTMLTokenizer } from "./rendering/html-parser/HTMLTokenizer.ts";
import { HTMLTreeBuilder } from "./rendering/html-parser/HTMLTreeBuilder.ts";
import { PreloadScanner } from "./rendering/html-parser/PreloadScanner.ts";
import { CSSTokenizer } from "./rendering/css-parser/CSSTokenizer.ts";
import { CSSParser } from "./rendering/css-parser/CSSParser.ts";
import { CSSOM } from "./rendering/css-parser/CSSOM.ts";
import { StyleResolver } from "./rendering/css-parser/StyleResolver.ts";
import { RenderTree } from "./rendering/rendering/RenderTree.ts";
import { LayoutEngine } from "./rendering/layout/LayoutEngine.ts";
import { DisplayList } from "./rendering/paint/DisplayList.ts";
import { PaintContext } from "./rendering/paint/PaintContext.ts";
import { CompositorThread } from "./rendering/compositor/CompositorThread.ts";
import { ScriptExecutor } from "./javascript/ScriptExecutor.ts";

/**
 * Rendering options
 */
export interface RenderingOptions {
    width?: number;
    height?: number;
    devicePixelRatio?: number;
    enableJavaScript?: boolean;
    enableImages?: boolean;
    enableCSS?: boolean;
    timeout?: number;
}

/**
 * Rendering result
 */
export interface RenderingResult {
    dom: DOMNode;
    cssom: CSSOM;
    renderTree: RenderTree;
    layoutTree: LayoutBox;
    displayList: DisplayList;
    scriptExecutor?: ScriptExecutor;
    timing: RenderingTiming;
    resources: ResourceInfo[];
}

/**
 * Rendering timing breakdown
 */
export interface RenderingTiming {
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
}

/**
 * Resource information
 */
export interface ResourceInfo {
    url: string;
    type: "html" | "css" | "script" | "image" | "font" | "other";
    size: number;
    fetchTime: number;
    cached: boolean;
}

/**
 * Rendering Pipeline Error
 */
export class RenderingPipelineError extends Error {
    constructor(
        message: string,
        public readonly stage: string,
        public override readonly cause?: Error,
    ) {
        super(message);
        this.name = "RenderingPipelineError";
    }
}

/**
 * Rendering Pipeline
 * High-level orchestrator for page rendering
 */
export class RenderingPipeline {
    private requestPipeline: RequestPipeline;
    private compositor: CompositorThread;
    private width: number;
    private height: number;
    private devicePixelRatio: number;
    private enableJavaScript: boolean;
    private resources: ResourceInfo[] = [];
    public lastRenderResult?: RenderingResult;

    constructor(options: RenderingOptions = {}) {
        this.requestPipeline = new RequestPipeline();
        this.width = options.width ?? 1024;
        this.height = options.height ?? 768;
        this.devicePixelRatio = options.devicePixelRatio ?? 1.0;
        this.enableJavaScript = options.enableJavaScript ?? false;
        this.compositor = new CompositorThread();
    }

    /**
     * Load and render page
     */
    async render(url: string | URL, options: RenderingOptions = {}): Promise<RenderingResult> {
        const startTime = Date.now();
        const timing: Partial<RenderingTiming> = {};
        this.resources = [];

        try {
            // 1. Fetch HTML
            const htmlStart = Date.now();
            const htmlResult = await this.fetchHTML(url);
            timing.htmlFetch = Date.now() - htmlStart;

            this.resources.push({
                url: htmlResult.request.url,
                type: "html",
                size: htmlResult.response.body.byteLength,
                fetchTime: timing.htmlFetch,
                cached: htmlResult.fromCache,
            });

            // 2. Parse HTML → DOM
            const parseStart = Date.now();
            const dom = await this.parseHTML(htmlResult.response.body);
            timing.htmlParse = Date.now() - parseStart;

            // 3. Discover and fetch CSS
            const cssStart = Date.now();
            const stylesheets = await this.fetchStylesheets(dom, url);
            timing.cssFetch = Date.now() - cssStart;

            // 4. Parse CSS → CSSOM
            const cssParseStart = Date.now();
            const cssom = await this.parseCSS(stylesheets);
            timing.cssParse = Date.now() - cssParseStart;

            // 4.5. Execute JavaScript (if enabled)
            let scriptExecutor: ScriptExecutor | undefined;
            if (options.enableJavaScript ?? this.enableJavaScript) {
                const scriptStart = Date.now();
                scriptExecutor = new ScriptExecutor(dom, url.toString());
                await scriptExecutor.executeScriptsInDOM();
                timing.scriptExecution = Date.now() - scriptStart;
            } else {
                timing.scriptExecution = 0;
            }

            // 5. Build Render Tree (apply styles)
            const styleStart = Date.now();
            const styleResolver = new StyleResolver(cssom);
            const renderTree = new RenderTree();
            renderTree.build(dom, styleResolver);
            timing.styleResolution = Date.now() - styleStart;

            // 6. Layout → Compute geometry
            const layoutStart = Date.now();
            const layoutEngine = new LayoutEngine();
            const rootRenderObject = renderTree.getRoot();
            layoutEngine.layout(
                rootRenderObject,
                { width: this.width as Pixels, height: this.height as Pixels },
            );
            const layoutTree = rootRenderObject.layout!;
            timing.layoutComputation = Date.now() - layoutStart;

            // 7. Paint → Generate display list
            const paintStart = Date.now();
            const displayList = new DisplayList();
            const paintContext = new PaintContext();
            this.paint(layoutTree, paintContext);
            timing.paintRecording = Date.now() - paintStart;

            // 8. Composite → Render to pixels
            const compositeStart = Date.now();
            this.compositor.composite();
            timing.compositing = Date.now() - compositeStart;

            timing.total = Date.now() - startTime;

            const result: RenderingResult = {
                dom,
                cssom,
                renderTree,
                layoutTree,
                displayList,
                scriptExecutor,
                timing: timing as RenderingTiming,
                resources: this.resources,
            };

            // Store for access by BrowserPage API
            this.lastRenderResult = result;

            return result;
        } catch (error) {
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
     * Fetch HTML from URL
     */
    private async fetchHTML(url: string | URL): Promise<RequestResult> {
        try {
            return await this.requestPipeline.get(url, {
                headers: {
                    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                },
            });
        } catch (error) {
            throw new RenderingPipelineError(
                `Failed to fetch HTML: ${error instanceof Error ? error.message : String(error)}`,
                "html-fetch",
                error instanceof Error ? error : undefined,
            );
        }
    }

    /**
     * Parse HTML to DOM
     */
    private async parseHTML(html: ByteBuffer): Promise<DOMNode> {
        try {
            const text = new TextDecoder().decode(html);
            const tokenizer = new HTMLTokenizer();
            const tokens = tokenizer.tokenize(text);
            const treeBuilder = new HTMLTreeBuilder();

            // Build tree from tokens
            return treeBuilder.build(tokens);
        } catch (error) {
            throw new RenderingPipelineError(
                `Failed to parse HTML: ${error instanceof Error ? error.message : String(error)}`,
                "html-parse",
                error instanceof Error ? error : undefined,
            );
        }
    }

    /**
     * Fetch stylesheets from DOM
     */
    private async fetchStylesheets(dom: DOMNode, baseUrl: string | URL): Promise<string[]> {
        const stylesheets: string[] = [];

        try {
            // Extract <link rel="stylesheet"> and <style> elements
            const styleElements = this.findStyleElements(dom);

            for (const element of styleElements) {
                if (element.tagName === "link") {
                    // External stylesheet
                    const href = element.attributes.get("href");
                    if (href) {
                        const cssUrl = new URL(href, baseUrl);
                        const result = await this.requestPipeline.get(cssUrl);

                        this.resources.push({
                            url: result.request.url,
                            type: "css",
                            size: result.response.body.byteLength,
                            fetchTime: result.timing.total,
                            cached: result.fromCache,
                        });

                        const cssText = new TextDecoder().decode(result.response.body);
                        stylesheets.push(cssText);
                    }
                } else if (element.tagName === "style") {
                    // Inline stylesheet
                    const textContent = this.getTextContent(element);
                    if (textContent) {
                        stylesheets.push(textContent);
                    }
                }
            }

            return stylesheets;
        } catch (error) {
            // Don't fail if CSS fetch fails - continue with what we have
            console.warn("Failed to fetch some stylesheets:", error);
            return stylesheets;
        }
    }

    /**
     * Get text content from a node
     */
    private getTextContent(node: DOMNode): string {
        if (node.nodeType === 3) { // TEXT node
            return node.nodeValue || "";
        }

        let text = "";
        if (node.childNodes) {
            for (const child of node.childNodes) {
                text += this.getTextContent(child);
            }
        }
        return text;
    }

    /**
     * Find style elements in DOM
     */
    private findStyleElements(node: DOMNode): DOMElement[] {
        const elements: DOMElement[] = [];

        if (node.nodeType === 1) { // DOMNodeType.ELEMENT
            const element = node as DOMElement;
            if (element.tagName === "link" || element.tagName === "style") {
                elements.push(element);
            }
        }

        // Recursively search children
        if (node.childNodes) {
            for (const child of node.childNodes) {
                elements.push(...this.findStyleElements(child));
            }
        }

        return elements;
    }

    /**
     * Parse CSS to CSSOM
     */
    private async parseCSS(stylesheets: string[]): Promise<CSSOM> {
        try {
            const cssom = new CSSOM();

            for (const css of stylesheets) {
                const tokenizer = new CSSTokenizer();
                const tokens = tokenizer.tokenize(css);
                const parser = new CSSParser();
                const stylesheet = parser.parse(tokens);
                cssom.addStyleSheet(stylesheet);
            }

            return cssom;
        } catch (error) {
            throw new RenderingPipelineError(
                `Failed to parse CSS: ${error instanceof Error ? error.message : String(error)}`,
                "css-parse",
                error instanceof Error ? error : undefined,
            );
        }
    }

    /**
     * Paint layout tree to display list
     */
    private paint(layoutBox: LayoutBox, context: PaintContext): void {
        try {
            // Paint background
            if (layoutBox.style?.backgroundColor) {
                context.fillRect(
                    layoutBox.x,
                    layoutBox.y,
                    layoutBox.width,
                    layoutBox.height,
                    layoutBox.style.backgroundColor,
                );
            }

            // Paint border
            if (layoutBox.style?.borderColor && layoutBox.style?.borderWidth) {
                const borderWidth = layoutBox.style.borderWidth;
                context.strokeRect(
                    layoutBox.x,
                    layoutBox.y,
                    layoutBox.width,
                    layoutBox.height,
                    layoutBox.style.borderColor,
                    borderWidth,
                );
            }

            // Paint text content
            if (layoutBox.type === "text" && layoutBox.text) {
                context.fillText(
                    layoutBox.text,
                    layoutBox.x,
                    layoutBox.y,
                    layoutBox.style?.color ?? "#000000",
                    layoutBox.style?.fontSize ?? 16,
                    layoutBox.style?.fontFamily ?? "sans-serif",
                );
            }

            // Paint children
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

    /**
     * Get rendered pixels
     */
    async getPixels(): Promise<Uint8ClampedArray> {
        return await this.compositor.getPixels();
    }

    /**
     * Take screenshot
     */
    async screenshot(): Promise<Uint8ClampedArray> {
        return await this.getPixels();
    }

    /**
     * Set viewport size
     */
    setViewportSize(width: number, height: number): void {
        this.width = width;
        this.height = height;
        this.compositor.resize(
            width * this.devicePixelRatio,
            height * this.devicePixelRatio,
        );
    }

    /**
     * Get rendering statistics
     */
    getStats() {
        return {
            viewport: {
                width: this.width,
                height: this.height,
                devicePixelRatio: this.devicePixelRatio,
            },
            resources: {
                total: this.resources.length,
                byType: this.groupResourcesByType(),
                totalSize: this.resources.reduce((sum, r) => sum + r.size, 0),
                cachedCount: this.resources.filter((r) => r.cached).length,
            },
            requestPipeline: this.requestPipeline.getStats(),
            compositor: this.compositor.getStats(),
        };
    }

    /**
     * Group resources by type
     */
    private groupResourcesByType(): Record<string, number> {
        const grouped: Record<string, number> = {};
        for (const resource of this.resources) {
            grouped[resource.type] = (grouped[resource.type] || 0) + 1;
        }
        return grouped;
    }

    /**
     * Clear all caches
     */
    clearCache(): void {
        this.requestPipeline.clearDNSCache();
        this.resources = [];
    }

    // ========================================================================
    // Subsystem Access - Composable Toolkit API
    // ========================================================================

    /**
     * Get request pipeline
     *
     * Provides access to the HTTP request pipeline for resource fetching.
     *
     * The request pipeline handles:
     * - DNS resolution and caching
     * - Connection pooling and reuse
     * - TLS handshake management
     * - HTTP request/response processing
     * - HTTP caching
     *
     * Use this to:
     * - Fetch resources independently
     * - Manage DNS and connection caches
     * - Monitor network statistics
     * - Configure request options
     *
     * @returns {RequestPipeline} The request pipeline instance
     * @example
     * ```typescript
     * const pipeline = new RenderingPipeline();
     * const requestPipeline = pipeline.getRequestPipeline();
     * const result = await requestPipeline.get("https://example.com/data.json");
     * ```
     */
    getRequestPipeline(): RequestPipeline {
        return this.requestPipeline;
    }

    /**
     * Get compositor thread
     *
     * Provides access to the compositor for layer management and pixel rendering.
     *
     * The compositor thread handles:
     * - Layer composition and z-ordering
     * - Tiling and rasterization
     * - GPU texture upload
     * - VSync synchronization
     * - Transform and opacity application
     *
     * Use this to:
     * - Access rendered pixels directly
     * - Manage compositor lifecycle
     * - Monitor rendering statistics
     * - Control viewport and rendering settings
     *
     * @returns {CompositorThread} The compositor thread instance
     * @example
     * ```typescript
     * const pipeline = new RenderingPipeline();
     * await pipeline.render("https://example.com");
     * const compositor = pipeline.getCompositor();
     * const pixels = await compositor.getPixels();
     * ```
     */
    getCompositor(): CompositorThread {
        return this.compositor;
    }

    /**
     * Close pipeline and cleanup
     */
    async close(): Promise<void> {
        await this.requestPipeline.close();
        await this.compositor.destroy();
    }
}

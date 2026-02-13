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
import type { DOMElement, DOMNode, DOMNodeType, HTMLCanvasElement, ImageBitmap } from "../types/dom.ts";
import type { CSSStyleSheet } from "../types/css.ts";
import type { LayoutBox } from "../types/rendering.ts";
import type { OffscreenCanvas } from "../types/webgpu.ts";
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
import { OffscreenWebGPU, OffscreenWebGPUState } from "./webgpu/offscreen/mod.ts";
import { WebGPUCompositorLayer, LayerType, LayerBlendMode, LayerState } from "./webgpu/compositor/mod.ts";
import { WebGPUDevice } from "./webgpu/adapter/Device.ts";
import { WebGPUTextureManager } from "./webgpu/operations/render/TextureManager.ts";

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
    signal?: AbortSignal;
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
 * WebGPU statistics
 */
export interface WebGPUStats {
    active: boolean;
    available: boolean;
    offscreen?: import("./webgpu/offscreen/mod.ts").OffscreenWebGPUStatistics;
    device?: import("../types/webgpu.ts").GPUDeviceStats;
    layer?: import("./webgpu/compositor/mod.ts").LayerStatistics;
}

/**
 * Rendering pipeline statistics
 */
export interface RenderingPipelineStats {
    viewport: {
        width: number;
        height: number;
        devicePixelRatio: number;
    };
    resources: {
        total: number;
        byType: Record<string, number>;
        totalSize: number;
        cachedCount: number;
    };
    requestPipeline: ReturnType<import("./RequestPipeline.ts").RequestPipeline["getStats"]>;
    compositor: import("./rendering/compositor/CompositorThread.ts").CompositorStats;
    webgpu: WebGPUStats;
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
 * Create OffscreenCanvas abstraction for Deno runtime
 * Deno doesn't have native OffscreenCanvas, so we create a shim
 * that satisfies the type requirements. Actual rendering is handled by webgpu_x.
 */
function createOffscreenCanvas(width: number, height: number): OffscreenCanvas {
    return {
        width,
        height,
        getContext: (_contextId: string) => null,
        convertToBlob: async () => new Blob(),
        transferToImageBitmap: () => ({
            width,
            height,
            close: () => {},
        } as ImageBitmap),
    } as OffscreenCanvas;
}

/**
 * Rendering Pipeline
 * High-level orchestrator for page rendering
 */
export class RenderingPipeline {
    private requestPipeline: RequestPipeline;
    private compositor: CompositorThread;
    private canvas: OffscreenCanvas;
    private width: number;
    private height: number;
    private devicePixelRatio: number;
    private enableJavaScript: boolean;
    private resources: ResourceInfo[] = [];
    public lastRenderResult?: RenderingResult;
    private ownsRequestPipeline: boolean;

    // WebGPU rendering support
    private webgpu: OffscreenWebGPU | null = null;
    private webgpuDevice: WebGPUDevice | null = null;
    private webgpuTextureManager: WebGPUTextureManager | null = null;
    private webgpuLayer: WebGPUCompositorLayer | null = null;
    private useWebGPU: boolean = false;

    constructor(options: RenderingOptions = {}, requestPipeline?: RequestPipeline) {
        // Use provided RequestPipeline or create a new one
        // This allows sharing connection pools across multiple pipelines
        if (requestPipeline) {
            this.requestPipeline = requestPipeline;
            this.ownsRequestPipeline = false;
        } else {
            this.requestPipeline = new RequestPipeline();
            this.ownsRequestPipeline = true;
        }
        this.width = options.width ?? 1024;
        this.height = options.height ?? 768;
        this.devicePixelRatio = options.devicePixelRatio ?? 1.0;
        this.enableJavaScript = options.enableJavaScript ?? false;

        // Create OffscreenCanvas for compositor rendering
        this.canvas = createOffscreenCanvas(
            this.width * this.devicePixelRatio,
            this.height * this.devicePixelRatio
        );

        // Initialize compositor with canvas
        this.compositor = new CompositorThread();
        this.compositor.initialize(this.canvas as unknown as HTMLCanvasElement);
    }

    // ========================================================================
    // WebGPU Initialization
    // ========================================================================

    /**
     * Initialize WebGPU for GPU-accelerated rendering
     *
     * Attempts to initialize WebGPU for GPU-accelerated compositing:
     * - Creates OffscreenWebGPU context for headless rendering
     * - Creates WebGPUDevice for GPU resource management
     * - Creates WebGPUCompositorLayer for layer-based rendering
     *
     * Falls back gracefully to headless mode if WebGPU is unavailable.
     *
     * @returns true if WebGPU was initialized successfully, false otherwise
     */
    async initializeWebGPU(): Promise<boolean> {
        try {
            // Check WebGPU availability
            if (typeof navigator === "undefined" || !navigator.gpu) {
                return false;
            }

            // Initialize OffscreenWebGPU for headless rendering with pixel readback
            this.webgpu = new OffscreenWebGPU({
                debug: false,
                label: "RenderingPipeline-OffscreenWebGPU",
            });

            await this.webgpu.initialize(
                this.width * this.devicePixelRatio,
                this.height * this.devicePixelRatio
            );

            // Initialize WebGPUDevice for GPU resource management
            this.webgpuDevice = new WebGPUDevice({
                powerPreference: "high-performance",
                label: "RenderingPipeline-WebGPUDevice",
            });

            await this.webgpuDevice.initialize();

            // Create texture manager for GPU texture operations
            this.webgpuTextureManager = new WebGPUTextureManager(this.webgpuDevice);

            // Create WebGPUCompositorLayer for layer-based rendering
            // This layer will be used to render the paint output
            this.webgpuLayer = new WebGPUCompositorLayer(
                this.webgpuDevice,
                this.webgpuTextureManager,
                {
                    id: "root-layer" as import("../types/webgpu.ts").LayerID,
                    type: LayerType.ROOT,
                    x: 0 as Pixels,
                    y: 0 as Pixels,
                    width: (this.width * this.devicePixelRatio) as Pixels,
                    height: (this.height * this.devicePixelRatio) as Pixels,
                    zIndex: 0,
                    opacity: 1.0,
                    blendMode: LayerBlendMode.NORMAL,
                    visible: true,
                    clipToBounds: false,
                    backgroundColor: [1, 1, 1, 1], // White background
                }
            );

            // Set device lost handler for recovery
            this.webgpu.setDeviceLostHandler((reason) => {
                console.warn(`[RenderingPipeline] WebGPU device lost: ${reason}`);
                this.useWebGPU = false;
            });

            this.useWebGPU = true;
            return true;
        } catch (error) {
            // WebGPU initialization failed, fall back to headless mode
            console.warn(
                `[RenderingPipeline] WebGPU initialization failed, using headless fallback: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );

            // Clean up partial initialization
            await this.disposeWebGPU();

            return false;
        }
    }

    /**
     * Check if WebGPU rendering is active
     */
    isWebGPUActive(): boolean {
        return this.useWebGPU && this.webgpu !== null && this.webgpu.isReady();
    }

    /**
     * Dispose WebGPU resources
     */
    private async disposeWebGPU(): Promise<void> {
        if (this.webgpuLayer) {
            this.webgpuLayer.destroy();
            this.webgpuLayer = null;
        }

        if (this.webgpuTextureManager) {
            this.webgpuTextureManager.destroy();
            this.webgpuTextureManager = null;
        }

        if (this.webgpuDevice) {
            this.webgpuDevice.destroy();
            this.webgpuDevice = null;
        }

        if (this.webgpu) {
            this.webgpu.dispose();
            this.webgpu = null;
        }

        this.useWebGPU = false;
    }

    /**
     * Load and render page
     */
    async render(url: string | URL, options: RenderingOptions = {}): Promise<RenderingResult> {
        // Check if already aborted
        if (options.signal?.aborted) {
            throw options.signal.reason || new Error("Rendering aborted");
        }

        const startTime = Date.now();
        const timing: Partial<RenderingTiming> = {};
        this.resources = [];

        try {
            // 1. Fetch HTML
            const htmlStart = Date.now();
            const htmlResult = await this.fetchHTML(url, options.signal);
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

            // Get the document element (html) from the document node
            // The HTMLTreeBuilder returns a document node (nodeType 9), but the
            // RenderTreeBuilder expects an element node (nodeType 1)
            const documentElement = this.getDocumentElement(dom);
            if (!documentElement) {
                throw new RenderingPipelineError(
                    "No document element found in DOM",
                    "render-tree-build",
                );
            }

            renderTree.build(documentElement, styleResolver);
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

            // Transfer paint commands from context to display list
            // Convert from PaintContext format { type, params } to DisplayList format { type, ...params }
            for (const command of paintContext.getCommands()) {
                // Safely spread params if it's an object, otherwise just use the type
                const params = command.params && typeof command.params === "object" ? command.params as Record<string, unknown> : {};
                const displayCommand = {
                    type: command.type,
                    ...params,
                } as import("./rendering/paint/DisplayList.ts").AnyPaintCommand;
                displayList.add(displayCommand);
            }
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
     *
     * Handles special URLs that don't require network access:
     * - about:blank - Returns empty HTML document
     * - data: URLs - Returns data directly from the URL
     */
    private async fetchHTML(url: string | URL, signal?: AbortSignal): Promise<RequestResult> {
        const urlString = typeof url === "string" ? url : url.toString();

        // Handle special URLs that don't require network access
        // Check before parsing since some special URLs (like about:blank) may not parse correctly
        const specialResponse = this.handleSpecialURL(urlString);
        if (specialResponse) {
            return specialResponse;
        }

        try {
            return await this.requestPipeline.get(url, {
                headers: {
                    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                },
                signal,
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
     * Handle special URLs that don't require network access
     *
     * @param urlString - The URL as a string
     * @returns RequestResult if handled, undefined otherwise
     */
    private handleSpecialURL(urlString: string): RequestResult | undefined {
        // Handle about: URLs - returns an empty HTML document
        // about:blank is the most common, but all about: URLs are handled similarly
        if (urlString === "about:blank" || urlString.startsWith("about:")) {
            const emptyHtml = "<!DOCTYPE html><html><head></head><body></body></html>";
            const body = new TextEncoder().encode(emptyHtml) as ByteBuffer;

            return {
                request: {
                    id: `req-special-${Date.now()}` as import("../types/identifiers.ts").RequestID,
                    method: "GET",
                    url: urlString as import("../types/identifiers.ts").URLString,
                    version: "1.1",
                    headers: new Map(),
                    createdAt: Date.now(),
                },
                response: {
                    id: `req-special-${Date.now()}` as import("../types/identifiers.ts").RequestID,
                    statusCode: 200,
                    statusText: "OK",
                    version: "1.1",
                    headers: new Map([
                        ["content-type", "text/html; charset=utf-8"],
                        ["content-length", String(body.byteLength)],
                    ]),
                    body: body,
                    receivedAt: Date.now(),
                    fromCache: false,
                    timings: {
                        dnsStart: 0,
                        dnsEnd: 0,
                        connectStart: 0,
                        connectEnd: 0,
                        requestStart: 0,
                        responseStart: 0,
                        responseEnd: 0,
                        duration: 0,
                    },
                },
                fromCache: false,
                timing: {
                    dnsLookup: 0,
                    tcpConnection: 0,
                    tlsHandshake: 0,
                    requestSent: 0,
                    firstByte: 0,
                    download: 0,
                    total: 0,
                },
            };
        }

        // Handle data: URLs - return data directly from the URL
        if (urlString.startsWith("data:")) {
            const dataUrl = urlString;
            const commaIndex = dataUrl.indexOf(",");
            if (commaIndex === -1) {
                return undefined; // Invalid data URL
            }

            const meta = dataUrl.substring(5, commaIndex); // Skip "data:"
            const data = dataUrl.substring(commaIndex + 1);

            // Parse media type and encoding
            const isBase64 = meta.endsWith(";base64");
            const mediaType = isBase64 ? meta.slice(0, -7) : meta;
            const contentType = mediaType || "text/plain;charset=US-ASCII";

            // Decode the data
            let body: ByteBuffer;
            if (isBase64) {
                // Decode base64
                const binaryString = atob(data);
                const tempBody = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    tempBody[i] = binaryString.charCodeAt(i);
                }
                body = tempBody as ByteBuffer;
            } else {
                // URL-decode and convert to bytes
                body = new TextEncoder().encode(decodeURIComponent(data)) as ByteBuffer;
            }

            return {
                request: {
                    id: `req-data-${Date.now()}` as import("../types/identifiers.ts").RequestID,
                    method: "GET",
                    url: urlString as import("../types/identifiers.ts").URLString,
                    version: "1.1",
                    headers: new Map(),
                    createdAt: Date.now(),
                },
                response: {
                    id: `req-data-${Date.now()}` as import("../types/identifiers.ts").RequestID,
                    statusCode: 200,
                    statusText: "OK",
                    version: "1.1",
                    headers: new Map([
                        ["content-type", contentType],
                        ["content-length", String(body.byteLength)],
                    ]),
                    body: body,
                    receivedAt: Date.now(),
                    fromCache: false,
                    timings: {
                        dnsStart: 0,
                        dnsEnd: 0,
                        connectStart: 0,
                        connectEnd: 0,
                        requestStart: 0,
                        responseStart: 0,
                        responseEnd: 0,
                        duration: 0,
                    },
                },
                fromCache: false,
                timing: {
                    dnsLookup: 0,
                    tcpConnection: 0,
                    tlsHandshake: 0,
                    requestSent: 0,
                    firstByte: 0,
                    download: 0,
                    total: 0,
                },
            };
        }

        return undefined;
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
     *
     * Returns the rendered pixels from the compositor.
     * When WebGPU is active, uses GPU readback for real rendered pixels.
     * Otherwise, falls back to headless compositor (returns white pixels).
     *
     * @returns Pixel data as RGBA Uint8ClampedArray
     */
    async getPixels(): Promise<Uint8ClampedArray> {
        // Use WebGPU pixel readback when available
        if (this.useWebGPU && this.webgpu && this.webgpu.isReady()) {
            try {
                return await this.webgpu.getPixels();
            } catch (error) {
                console.warn(
                    `[RenderingPipeline] WebGPU pixel readback failed, falling back to compositor: ${
                        error instanceof Error ? error.message : String(error)
                    }`
                );
                // Fall through to compositor fallback
            }
        }

        // Fallback to headless compositor
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
     *
     * Resizes both the WebGL compositor and WebGPU offscreen context if active.
     */
    setViewportSize(width: number, height: number): void {
        this.width = width;
        this.height = height;

        const scaledWidth = width * this.devicePixelRatio;
        const scaledHeight = height * this.devicePixelRatio;

        // Resize WebGL compositor
        this.compositor.resize(scaledWidth, scaledHeight);

        // Resize WebGPU resources if active
        if (this.useWebGPU && this.webgpu && this.webgpu.isReady()) {
            try {
                this.webgpu.resize(scaledWidth, scaledHeight);

                // Update WebGPU layer dimensions
                if (this.webgpuLayer) {
                    this.webgpuLayer.resize(scaledWidth as Pixels, scaledHeight as Pixels);
                }
            } catch (error) {
                console.warn(
                    `[RenderingPipeline] WebGPU resize failed: ${
                        error instanceof Error ? error.message : String(error)
                    }`
                );
            }
        }
    }

    /**
     * Get rendering statistics
     */
    getStats(): RenderingPipelineStats {
        const baseStats: RenderingPipelineStats = {
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
            webgpu: {
                active: this.useWebGPU,
                available: typeof navigator !== "undefined" && !!navigator.gpu,
            },
        };

        // Add WebGPU statistics if active
        if (this.useWebGPU && this.webgpu) {
            baseStats.webgpu = {
                ...baseStats.webgpu,
                offscreen: this.webgpu.getStatistics(),
            };
        }

        // Add WebGPU device statistics if available
        if (this.useWebGPU && this.webgpuDevice && this.webgpuDevice.isReady()) {
            baseStats.webgpu = {
                ...baseStats.webgpu,
                device: this.webgpuDevice.getStats(),
            };
        }

        // Add WebGPU layer statistics if available
        if (this.useWebGPU && this.webgpuLayer) {
            baseStats.webgpu = {
                ...baseStats.webgpu,
                layer: this.webgpuLayer.getStatistics(),
            };
        }

        return baseStats;
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
     * Get the document element (html) from a DOM node
     * Handles both document nodes (nodeType 9) and element nodes (nodeType 1)
     */
    private getDocumentElement(dom: DOMNode): DOMNode | null {
        // If it's already an element, return it
        if (dom.nodeType === 1) {
            return dom;
        }

        // If it's a document, find the first element child (usually <html>)
        if (dom.nodeType === 9 && dom.childNodes) {
            for (const child of dom.childNodes) {
                if (child.nodeType === 1) {
                    return child;
                }
            }
        }

        return null;
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
     *
     * Disposes all resources including WebGPU context, compositor, and request pipeline.
     */
    async close(): Promise<void> {
        // Dispose WebGPU resources first
        await this.disposeWebGPU();

        // Only close request pipeline if we own it
        if (this.ownsRequestPipeline) {
            await this.requestPipeline.close();
        }

        // Destroy compositor
        await this.compositor.destroy();
    }
}

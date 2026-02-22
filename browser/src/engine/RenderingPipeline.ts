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
import type { PipelineObserver, PipelineStageEvent } from "./PipelineObserver.ts";
import type { StorageManager } from "./storage/StorageManager.ts";
import { ContentSecurityPolicy } from "./security/ContentSecurityPolicy.ts";

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
    storageManager?: StorageManager;
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
 * Parse intrinsic dimensions from image binary data.
 * Supports PNG, JPEG, GIF, WebP, and BMP header parsing.
 * Returns { width: 0, height: 0 } if format is unrecognized.
 */
function parseImageDimensions(data: Uint8Array): { width: number; height: number } {
    if (data.length < 8) return { width: 0, height: 0 };

    // PNG: bytes 0-7 are signature, IHDR chunk starts at 8, width at 16, height at 20 (big-endian)
    if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47) {
        if (data.length < 24) return { width: 0, height: 0 };
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        return {
            width: view.getUint32(16, false),
            height: view.getUint32(20, false),
        };
    }

    // JPEG: starts with 0xFFD8, scan for SOF0/SOF2 marker (0xFFC0/0xFFC2)
    if (data[0] === 0xFF && data[1] === 0xD8) {
        let offset = 2;
        while (offset < data.length - 9) {
            if (data[offset] !== 0xFF) { offset++; continue; }
            const marker = data[offset + 1];
            // SOF0 (0xC0) through SOF3 (0xC3), excluding DHT (0xC4)
            if (marker >= 0xC0 && marker <= 0xC3) {
                const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
                return {
                    width: view.getUint16(offset + 7, false),
                    height: view.getUint16(offset + 5, false),
                };
            }
            // Skip to next marker using segment length
            if (marker === 0xD0 || marker === 0xD1 || marker === 0xD2 || marker === 0xD3 ||
                marker === 0xD4 || marker === 0xD5 || marker === 0xD6 || marker === 0xD7 ||
                marker === 0xD8 || marker === 0xD9 || marker === 0x01) {
                offset += 2;
            } else {
                if (offset + 3 >= data.length) break;
                const segLen = (data[offset + 2] << 8) | data[offset + 3];
                offset += 2 + segLen;
            }
        }
        return { width: 0, height: 0 };
    }

    // GIF: "GIF87a" or "GIF89a", width at 6, height at 8 (little-endian)
    if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46) {
        if (data.length < 10) return { width: 0, height: 0 };
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        return {
            width: view.getUint16(6, true),
            height: view.getUint16(8, true),
        };
    }

    // WebP: "RIFF" at 0, "WEBP" at 8
    if (data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46 &&
        data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50) {
        // VP8 lossy: "VP8 " at 12, width at 26, height at 28
        if (data[12] === 0x56 && data[13] === 0x50 && data[14] === 0x38 && data[15] === 0x20) {
            if (data.length < 30) return { width: 0, height: 0 };
            const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
            return {
                width: view.getUint16(26, true) & 0x3FFF,
                height: view.getUint16(28, true) & 0x3FFF,
            };
        }
        // VP8L lossless: "VP8L" at 12, packed dimensions at 21
        if (data[12] === 0x56 && data[13] === 0x50 && data[14] === 0x38 && data[15] === 0x4C) {
            if (data.length < 25) return { width: 0, height: 0 };
            const bits = (data[21]) | (data[22] << 8) | (data[23] << 16) | (data[24] << 24);
            return {
                width: (bits & 0x3FFF) + 1,
                height: ((bits >> 14) & 0x3FFF) + 1,
            };
        }
        // VP8X extended: width at 24 (24-bit LE + 1), height at 27 (24-bit LE + 1)
        if (data[12] === 0x56 && data[13] === 0x50 && data[14] === 0x38 && data[15] === 0x58) {
            if (data.length < 30) return { width: 0, height: 0 };
            return {
                width: (data[24] | (data[25] << 8) | (data[26] << 16)) + 1,
                height: (data[27] | (data[28] << 8) | (data[29] << 16)) + 1,
            };
        }
    }

    // BMP: "BM" at 0, width at 18, height at 22 (little-endian, signed for height)
    if (data[0] === 0x42 && data[1] === 0x4D) {
        if (data.length < 26) return { width: 0, height: 0 };
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        return {
            width: view.getInt32(18, true),
            height: Math.abs(view.getInt32(22, true)),
        };
    }

    return { width: 0, height: 0 };
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
    private storageManager?: StorageManager;

    // WebGPU rendering support
    private webgpu: OffscreenWebGPU | null = null;
    private webgpuDevice: WebGPUDevice | null = null;
    private webgpuTextureManager: WebGPUTextureManager | null = null;
    private webgpuLayer: WebGPUCompositorLayer | null = null;
    private useWebGPU: boolean = false;

    private observer?: PipelineObserver;
    private lastRenderArtifacts?: { dom: unknown; cssom: unknown; renderTree: unknown; layoutTree: unknown; displayList: unknown };
    private csp?: ContentSecurityPolicy;

    setObserver(observer: PipelineObserver): void {
        this.observer = observer;
    }

    getLastRenderArtifacts(): { dom: unknown; cssom: unknown; renderTree: unknown; layoutTree: unknown; displayList: unknown } | undefined {
        return this.lastRenderArtifacts;
    }

    private emitStage(stageId: string, stageName: string, status: PipelineStageEvent["status"], startTime: number, endTime?: number, duration?: number, artifact?: unknown, error?: Error): void {
        this.observer?.onStage({ stageId, stageName, pipeline: "rendering", status, startTime, endTime, duration, artifact, error });
    }

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
        this.storageManager = options.storageManager;

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
            this.emitStage("html-fetch", "HTML Fetch", "running", Date.now());
            const htmlStart = Date.now();
            const htmlResult = await this.fetchHTML(url, options.signal);
            timing.htmlFetch = Date.now() - htmlStart;
            this.emitStage("html-fetch", "HTML Fetch", "completed", htmlStart, Date.now(), timing.htmlFetch, htmlResult);

            this.resources.push({
                url: htmlResult.request.url,
                type: "html",
                size: htmlResult.response.body.byteLength,
                fetchTime: timing.htmlFetch,
                cached: htmlResult.fromCache,
            });

            // Parse CSP header from HTML response if present
            const cspHeader = htmlResult.response.headers?.get("content-security-policy");
            const cspReportHeader = htmlResult.response.headers?.get("content-security-policy-report-only");
            if (cspHeader) {
                this.csp = new ContentSecurityPolicy(cspHeader, false);
            } else if (cspReportHeader) {
                this.csp = new ContentSecurityPolicy(cspReportHeader, true);
            }

            // 2. Parse HTML → DOM
            this.emitStage("html-parse", "HTML Parse", "running", Date.now());
            const parseStart = Date.now();
            const dom = await this.parseHTML(htmlResult.response.body);
            timing.htmlParse = Date.now() - parseStart;
            this.emitStage("html-parse", "HTML Parse", "completed", parseStart, Date.now(), timing.htmlParse, dom);

            // 3. Discover and fetch CSS
            this.emitStage("css-fetch", "CSS Fetch", "running", Date.now());
            const cssStart = Date.now();
            const stylesheets = await this.fetchStylesheets(dom, url);
            timing.cssFetch = Date.now() - cssStart;
            this.emitStage("css-fetch", "CSS Fetch", "completed", cssStart, Date.now(), timing.cssFetch, stylesheets);

            // 4. Parse CSS → CSSOM
            this.emitStage("css-parse", "CSS Parse", "running", Date.now());
            const cssParseStart = Date.now();
            const cssom = await this.parseCSS(stylesheets);
            timing.cssParse = Date.now() - cssParseStart;
            this.emitStage("css-parse", "CSS Parse", "completed", cssParseStart, Date.now(), timing.cssParse, cssom);

            // 4.5. Execute JavaScript (if enabled)
            this.emitStage("script-execution", "Script Execution", "running", Date.now());
            let scriptExecutor: ScriptExecutor | undefined;
            if (options.enableJavaScript ?? this.enableJavaScript) {
                const scriptStart = Date.now();
                scriptExecutor = new ScriptExecutor(dom, url.toString(), this.requestPipeline, this.storageManager);
                if (this.csp) {
                    scriptExecutor.setCSP(this.csp);
                }
                await scriptExecutor.executeScriptsInDOM();
                timing.scriptExecution = Date.now() - scriptStart;
            } else {
                timing.scriptExecution = 0;
            }
            this.emitStage("script-execution", "Script Execution", "completed", Date.now(), Date.now(), timing.scriptExecution, scriptExecutor);

            // 5. Build Render Tree (apply styles)
            this.emitStage("style-resolution", "Style Resolution", "running", Date.now());
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
            this.emitStage("style-resolution", "Style Resolution", "completed", styleStart, Date.now(), timing.styleResolution, renderTree);

            // 6. Layout → Compute geometry
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

            // 6.5. Fetch images (if enabled) using PreloadScanner
            // Discover image URLs from the raw HTML and fetch them via the RequestPipeline
            // so DRAW_IMAGE commands can render actual images
            const enableImages = options.enableImages ?? true;
            const imageMap = new Map<string, import("../types/dom.ts").CanvasImageSource>();
            if (enableImages) {
                const htmlText = new TextDecoder().decode(htmlResult.response.body);
                const preloadScanner = new PreloadScanner();
                const preloadResources = preloadScanner.scan(htmlText);
                const imageResources = preloadResources.filter(r => r.type === "image");

                for (const imgResource of imageResources) {
                    try {
                        const imgUrl = new URL(imgResource.url, url);

                        // CSP img-src check
                        if (this.csp) {
                            const pageOrigin = new URL(url.toString()).origin;
                            if (!this.csp.allows("img-src", imgUrl.toString(), pageOrigin)) {
                                console.warn(`[RenderingPipeline] Blocked image by CSP: ${imgUrl}`);
                                continue;
                            }
                        }

                        const imgResult = await this.requestPipeline.get(imgUrl, { signal: options.signal });

                        this.resources.push({
                            url: imgResult.request.url,
                            type: "image",
                            size: imgResult.response.body.byteLength,
                            fetchTime: imgResult.timing.total,
                            cached: imgResult.fromCache,
                        });

                        // Decode image bytes into a drawable ImageBitmap
                        const imgData = imgResult.response.body;
                        const dims = parseImageDimensions(new Uint8Array(imgData));
                        try {
                            // Determine MIME type from headers or binary signature
                            const contentType = imgResult.response.headers?.get("content-type") || "image/png";
                            const blob = new Blob([imgData], { type: contentType });
                            const bitmap = await createImageBitmap(blob as unknown as ImageBitmapSource);
                            imageMap.set(imgResource.url, bitmap as unknown as import("../types/dom.ts").CanvasImageSource);
                        } catch {
                            // createImageBitmap unavailable (headless) — store dimensions for layout
                            imageMap.set(imgResource.url, {
                                width: dims.width,
                                height: dims.height,
                                close: () => {},
                                _data: imgData,
                            } as any);
                        }
                    } catch {
                        // Image fetch failed — skip silently, broken-image placeholder will show
                    }
                }
            }

            // 7. Paint → Generate display list
            this.emitStage("paint", "Paint", "running", Date.now());
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

            // Register fetched images with the display list so DRAW_IMAGE commands can render
            for (const [src, img] of imageMap) {
                displayList.registerImage(src, img);
            }

            timing.paintRecording = Date.now() - paintStart;
            this.emitStage("paint", "Paint", "completed", paintStart, Date.now(), timing.paintRecording, displayList);

            // 7.5. Pass render tree to compositor for CPU rendering
            // CPU mode needs the render tree to paint via Canvas 2D
            if (this.compositor.isCPUMode()) {
                this.compositor.setRenderTree(rootRenderObject);
            }

            // 8. Composite → Render to pixels
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
                resources: this.resources,
            };

            // Store for access by BrowserPage API
            this.lastRenderResult = result;
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

                        // CSP style-src check for external stylesheets
                        if (this.csp) {
                            const pageOrigin = new URL(baseUrl.toString()).origin;
                            if (!this.csp.allows("style-src", cssUrl.toString(), pageOrigin)) {
                                console.warn(`[RenderingPipeline] Blocked stylesheet by CSP: ${cssUrl}`);
                                continue;
                            }
                        }

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
            const style = layoutBox.style;

            // Paint background
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

            // Paint border
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

            // Paint image content (replaced elements with src)
            if (layoutBox.src) {
                context.drawImage(
                    layoutBox.src,
                    layoutBox.x,
                    layoutBox.y,
                    layoutBox.width,
                    layoutBox.height,
                );
            }

            // Paint text content
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
    /**
     * Set Content Security Policy for resource loading enforcement
     */
    setCSP(csp: ContentSecurityPolicy): void {
        this.csp = csp;
    }

    /**
     * Get the current Content Security Policy
     */
    getCSP(): ContentSecurityPolicy | undefined {
        return this.csp;
    }

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

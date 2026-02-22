/**
 * Rendering Pipeline
 *
 * Thin facade that delegates to focused sub-components:
 * - ResourceFetcher: HTML/CSS/image fetching
 * - ImageDecoder: Binary format parsing (PNG/JPEG/GIF/WebP/SVG)
 * - WebGPUManager: GPU init/dispose/screenshot
 * - RenderingOrchestrator: render pipeline + observer
 *
 * Preserves the exact same public API for backward compatibility.
 */

import type { Pixels } from "../types/identifiers.ts";
import type { DOMNode, HTMLCanvasElement, ImageBitmap } from "../types/dom.ts";
import type { LayoutBox } from "../types/rendering.ts";
import type { OffscreenCanvas } from "../types/webgpu.ts";
import { RequestPipeline } from "./RequestPipeline.ts";
import { CompositorThread } from "./rendering/compositor/CompositorThread.ts";
import type { PipelineObserver } from "./PipelineObserver.ts";
import type { StorageManager } from "./storage/StorageManager.ts";
import { ContentSecurityPolicy } from "./security/ContentSecurityPolicy.ts";
import { CSSOM } from "./rendering/css-parser/CSSOM.ts";
import { RenderTree } from "./rendering/rendering/RenderTree.ts";
import { DisplayList } from "./rendering/paint/DisplayList.ts";
import { ScriptExecutor } from "./javascript/ScriptExecutor.ts";

// Sub-components
import { ResourceFetcher } from "./rendering/ResourceFetcher.ts";
import { ImageDecoder } from "./rendering/ImageDecoder.ts";
import { WebGPUManager } from "./rendering/WebGPUManager.ts";
import { RenderingOrchestrator } from "./rendering/RenderingOrchestrator.ts";

// Re-export sub-components for direct access
export { ResourceFetcher } from "./rendering/ResourceFetcher.ts";
export { ImageDecoder } from "./rendering/ImageDecoder.ts";
export { WebGPUManager } from "./rendering/WebGPUManager.ts";
export { RenderingOrchestrator } from "./rendering/RenderingOrchestrator.ts";

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
 * Create OffscreenCanvas abstraction for Deno runtime
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
 * Rendering Pipeline - Backward-compatible facade
 */
export class RenderingPipeline {
    private requestPipeline: RequestPipeline;
    private compositor: CompositorThread;
    private canvas: OffscreenCanvas;
    private width: number;
    private height: number;
    private devicePixelRatio: number;
    private ownsRequestPipeline: boolean;
    public lastRenderResult?: RenderingResult;

    // Sub-components
    private resourceFetcher: ResourceFetcher;
    private webgpuManager: WebGPUManager;
    private orchestrator: RenderingOrchestrator;

    constructor(options: RenderingOptions = {}, requestPipeline?: RequestPipeline) {
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

        this.canvas = createOffscreenCanvas(
            this.width * this.devicePixelRatio,
            this.height * this.devicePixelRatio
        );

        this.compositor = new CompositorThread();
        this.compositor.initialize(this.canvas as unknown as HTMLCanvasElement);

        // Initialize sub-components
        this.resourceFetcher = new ResourceFetcher(this.requestPipeline);
        this.webgpuManager = new WebGPUManager();
        this.orchestrator = new RenderingOrchestrator(
            this.resourceFetcher,
            this.compositor,
            this.width,
            this.height,
            options.enableJavaScript ?? false,
            options.storageManager,
        );
    }

    // ========================================================================
    // Observer
    // ========================================================================

    setObserver(observer: PipelineObserver): void {
        this.orchestrator.setObserver(observer);
    }

    getLastRenderArtifacts(): { dom: unknown; cssom: unknown; renderTree: unknown; layoutTree: unknown; displayList: unknown } | undefined {
        return this.orchestrator.getLastRenderArtifacts();
    }

    // ========================================================================
    // WebGPU
    // ========================================================================

    async initializeWebGPU(): Promise<boolean> {
        return this.webgpuManager.initializeWebGPU(
            this.width * this.devicePixelRatio,
            this.height * this.devicePixelRatio
        );
    }

    isWebGPUActive(): boolean {
        return this.webgpuManager.isWebGPUActive();
    }

    // ========================================================================
    // Render
    // ========================================================================

    async render(url: string | URL, options: RenderingOptions = {}): Promise<RenderingResult> {
        const result = await this.orchestrator.render(url, options, this.requestPipeline);
        this.lastRenderResult = result;
        return result;
    }

    // ========================================================================
    // Pixels / Screenshot
    // ========================================================================

    async getPixels(): Promise<Uint8ClampedArray> {
        return this.webgpuManager.getPixels(this.compositor);
    }

    async screenshot(): Promise<Uint8ClampedArray> {
        return await this.getPixels();
    }

    // ========================================================================
    // Viewport
    // ========================================================================

    setViewportSize(width: number, height: number): void {
        this.width = width;
        this.height = height;

        const scaledWidth = width * this.devicePixelRatio;
        const scaledHeight = height * this.devicePixelRatio;

        this.compositor.resize(scaledWidth, scaledHeight);
        this.webgpuManager.resizeWebGPU(scaledWidth, scaledHeight);
        this.orchestrator.setDimensions(width, height);
    }

    // ========================================================================
    // Stats
    // ========================================================================

    getStats(): RenderingPipelineStats {
        const resources = this.resourceFetcher.getResources();
        const grouped: Record<string, number> = {};
        for (const resource of resources) {
            grouped[resource.type] = (grouped[resource.type] || 0) + 1;
        }

        return {
            viewport: {
                width: this.width,
                height: this.height,
                devicePixelRatio: this.devicePixelRatio,
            },
            resources: {
                total: resources.length,
                byType: grouped,
                totalSize: resources.reduce((sum, r) => sum + r.size, 0),
                cachedCount: resources.filter((r) => r.cached).length,
            },
            requestPipeline: this.requestPipeline.getStats(),
            compositor: this.compositor.getStats(),
            webgpu: this.webgpuManager.getWebGPUStats(),
        };
    }

    // ========================================================================
    // CSP
    // ========================================================================

    setCSP(csp: ContentSecurityPolicy): void {
        this.orchestrator.setCSP(csp);
    }

    getCSP(): ContentSecurityPolicy | undefined {
        return this.orchestrator.getCSP();
    }

    // ========================================================================
    // Cache
    // ========================================================================

    clearCache(): void {
        this.requestPipeline.clearDNSCache();
        this.resourceFetcher.clearResources();
    }

    // ========================================================================
    // Subsystem Access
    // ========================================================================

    getRequestPipeline(): RequestPipeline {
        return this.requestPipeline;
    }

    getCompositor(): CompositorThread {
        return this.compositor;
    }

    // ========================================================================
    // Cleanup
    // ========================================================================

    async close(): Promise<void> {
        await this.webgpuManager.disposeWebGPU();

        if (this.ownsRequestPipeline) {
            await this.requestPipeline.close();
        }

        await this.compositor.destroy();
    }
}

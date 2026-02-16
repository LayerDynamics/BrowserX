/**
 * Compositor Thread - Coordinate GPU rendering
 *
 * The compositor thread coordinates all GPU-accelerated rendering:
 * - Manages WebGL context and shader programs
 * - Uploads paint layers to GPU textures
 * - Composites layers with transforms and effects
 * - Synchronizes with vsync for smooth rendering
 * - Handles frame scheduling and prioritization
 */

import type { Pixels } from "../../../types/identifiers.ts";
import type {
    Blob,
    HTMLCanvasElement,
    WebGLProgram,
    WebGLRenderingContext,
    WebGLShader,
} from "../../../types/dom.ts";
import type { BoundingBox } from "../paint/DisplayList.ts";
import { LayerTree, type PaintLayer } from "../paint/PaintLayer.ts";
import { CompositorLayer, CompositorLayerManager } from "./CompositorLayer.ts";
import { type FrameTiming, VSync, type VSyncStats } from "./VSync.ts";

/**
 * Compositor statistics
 */
export interface CompositorStats {
    frameCount: number;
    averageFPS: number;
    compositeTime: number;
    uploadTime: number;
    layerCount: number;
    textureMemory: number;
    vsyncStats: VSyncStats;
}

/**
 * Compositor configuration
 */
export interface CompositorConfig {
    enableVSync: boolean;
    enableTiling: boolean;
    targetFPS: number;
    maxTextureSize: number;
}

/**
 * WebGL shader program
 */
interface ShaderProgram {
    program: WebGLProgram;
    vertexShader: WebGLShader;
    fragmentShader: WebGLShader;
}

/**
 * CompositorThread
 * Coordinates GPU rendering and layer compositing
 *
 * Supports headless mode for environments without GPU/WebGL (e.g., Deno, tests).
 * In headless mode, compositing operations are no-ops and getPixels() returns blank data.
 */
export class CompositorThread {
    private canvas: HTMLCanvasElement | null = null;
    private gl: WebGLRenderingContext | null = null;
    private layerManager: CompositorLayerManager;
    private vsync: VSync;
    private config: CompositorConfig;
    private shaderProgram: ShaderProgram | null = null;
    private isRunning: boolean = false;
    private frameCount: number = 0;
    private lastCompositeTime: number = 0;
    private lastUploadTime: number = 0;
    private layerTree: LayerTree | null = null;
    private headlessMode: boolean = false;

    constructor(config?: Partial<CompositorConfig>) {
        this.config = {
            enableVSync: true,
            enableTiling: true,
            targetFPS: 60,
            maxTextureSize: 4096,
            ...config,
        };

        this.layerManager = new CompositorLayerManager();
        this.vsync = new VSync(this.config.targetFPS);
    }

    /**
     * Check if compositor is running in headless mode (no GPU)
     */
    isHeadless(): boolean {
        return this.headlessMode;
    }

    /**
     * Initialize compositor with canvas
     *
     * If WebGL context is not available, enters headless mode where
     * compositing operations are no-ops and getPixels() returns blank data.
     * This enables operation in environments without GPU support (Deno, tests).
     */
    initialize(canvas: HTMLCanvasElement): void {
        this.canvas = canvas;

        // Try to get WebGL context
        const gl = canvas.getContext("webgl", {
            alpha: true,
            antialias: true,
            depth: false,
            stencil: false,
            preserveDrawingBuffer: false,
            premultipliedAlpha: true,
        });

        if (!gl) {
            // Enter headless mode - no GPU rendering available
            // This is expected in Deno runtime or headless environments
            this.headlessMode = true;
            return;
        }

        this.gl = gl;

        // Initialize layer manager with WebGL context
        this.layerManager.initialize(gl);

        // Set up WebGL state
        this.setupWebGL();

        // Create shader program
        this.shaderProgram = this.createShaderProgram();
    }

    /**
     * Set up WebGL state
     */
    private setupWebGL(): void {
        if (!this.gl) {
            return;
        }

        // Enable blending for transparency
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA);

        // Set clear color
        this.gl.clearColor(1, 1, 1, 1);

        // Set viewport
        this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
    }

    /**
     * Create shader program
     */
    private createShaderProgram(): ShaderProgram {
        if (!this.gl) {
            throw new Error("WebGL context not initialized");
        }

        // Vertex shader
        const vertexShaderSource = `
            attribute vec2 a_position;
            attribute vec2 a_texcoord;
            uniform mat4 u_transform;
            varying vec2 v_texcoord;

            void main() {
                gl_Position = u_transform * vec4(a_position, 0.0, 1.0);
                v_texcoord = a_texcoord;
            }
        `;

        // Fragment shader
        const fragmentShaderSource = `
            precision mediump float;
            uniform sampler2D u_texture;
            uniform float u_opacity;
            varying vec2 v_texcoord;

            void main() {
                vec4 color = texture2D(u_texture, v_texcoord);
                gl_FragColor = color * u_opacity;
            }
        `;

        // Compile shaders
        const vertexShader = this.compileShader(this.gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = this.compileShader(this.gl.FRAGMENT_SHADER, fragmentShaderSource);

        // Create program
        const program = this.gl.createProgram();
        if (!program) {
            throw new Error("Failed to create shader program");
        }

        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);

        // Check link status
        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            const error = this.gl.getProgramInfoLog(program);
            throw new Error(`Failed to link shader program: ${error}`);
        }

        return {
            program,
            vertexShader,
            fragmentShader,
        };
    }

    /**
     * Compile shader
     */
    private compileShader(type: number, source: string): WebGLShader {
        if (!this.gl) {
            throw new Error("WebGL context not initialized");
        }

        const shader = this.gl.createShader(type);
        if (!shader) {
            throw new Error("Failed to create shader");
        }

        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);

        // Check compilation status
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            const error = this.gl.getShaderInfoLog(shader);
            throw new Error(`Failed to compile shader: ${error}`);
        }

        return shader;
    }

    /**
     * Start compositor loop
     *
     * In headless mode, this is a no-op since there's no frame loop needed.
     */
    start(): void {
        if (this.isRunning) {
            return;
        }

        this.isRunning = true;
        this.frameCount = 0;

        // In headless mode, no frame loop needed
        if (this.headlessMode) {
            return;
        }

        if (this.config.enableVSync) {
            // Start vsync loop
            this.vsync.addCallback((timing) => this.compositeFrame(timing));
            this.vsync.start();
        } else {
            // Manual loop without vsync
            this.compositeLoop();
        }
    }

    /**
     * Stop compositor loop
     */
    stop(): void {
        if (!this.isRunning) {
            return;
        }

        this.isRunning = false;
        this.vsync.stop();
    }

    /**
     * Manual composite loop (without vsync)
     */
    private async compositeLoop(): Promise<void> {
        while (this.isRunning) {
            const timing: FrameTiming = {
                timestamp: performance.now(),
                delta: 16.67, // Assume 60fps
                fps: 60,
                frameNumber: this.frameCount++,
            };

            await this.compositeFrame(timing);

            // Wait for next frame
            await new Promise((resolve) => setTimeout(resolve, 1000 / this.config.targetFPS));
        }
    }

    /**
     * Composite single frame
     */
    private async compositeFrame(timing: FrameTiming): Promise<void> {
        if (!this.gl || !this.shaderProgram || !this.layerTree) {
            return;
        }

        const startTime = performance.now();

        try {
            // Update layers from paint layers
            this.layerManager.updateLayers();

            // Upload pending textures
            const uploadStartTime = performance.now();
            await this.layerManager.uploadPendingLayers();
            this.lastUploadTime = performance.now() - uploadStartTime;

            // Clear framebuffer
            this.gl.clear(this.gl.COLOR_BUFFER_BIT);

            // Use shader program
            this.gl.useProgram(this.shaderProgram.program);

            // Get viewport
            const viewport: BoundingBox = {
                x: 0 as Pixels,
                y: 0 as Pixels,
                width: this.gl.canvas.width as Pixels,
                height: this.gl.canvas.height as Pixels,
            };

            // Composite all layers
            const layers = this.layerManager.getAllLayers();
            for (const layer of layers) {
                layer.composite(this.gl, this.shaderProgram.program, viewport);
            }

            this.lastCompositeTime = performance.now() - startTime;
            this.frameCount++;
        } catch (error) {
            console.error("Compositor frame error:", error);
        }
    }

    /**
     * Update layer tree
     * Creates compositor layers from paint layers
     *
     * In headless mode, stores the layer tree but doesn't create GPU resources.
     */
    updateLayerTree(layerTree: LayerTree): void {
        this.layerTree = layerTree;

        // In headless mode, just store the tree but don't create GPU resources
        if (this.headlessMode) {
            return;
        }

        // Clear existing layers
        this.layerManager.disposeAll();

        // Create compositor layers from paint layers
        const paintLayers = layerTree.getAllLayers();
        for (const paintLayer of paintLayers) {
            this.layerManager.createLayer(paintLayer, this.config.enableTiling);
        }
    }

    /**
     * Composite layers synchronously
     * Used for non-vsync rendering
     *
     * In headless mode, this is a no-op since there's no GPU to composite to.
     */
    composite(): void {
        // In headless mode, compositing is a no-op
        if (this.headlessMode) {
            this.frameCount++;
            return;
        }

        if (!this.isRunning) {
            // Manual composite
            const timing: FrameTiming = {
                timestamp: performance.now(),
                delta: 16.67,
                fps: 60,
                frameNumber: this.frameCount++,
            };

            this.compositeFrame(timing);
        }
    }

    /**
     * Resize compositor
     */
    resize(width: number, height: number): void {
        if (!this.canvas) {
            return;
        }

        this.canvas.width = width;
        this.canvas.height = height;

        // In headless mode, just update canvas dimensions
        if (this.headlessMode || !this.gl) {
            return;
        }

        this.gl.viewport(0, 0, width, height);

        // Invalidate all layers to force re-upload
        const layers = this.layerManager.getAllLayers();
        for (const layer of layers) {
            layer.invalidate();
        }
    }

    /**
     * Get statistics
     */
    getStats(): CompositorStats {
        // In headless mode, layer manager may not be initialized with GL
        const layerCount = this.headlessMode ? 0 : this.layerManager.getAllLayers().length;
        const textureMemory = this.headlessMode ? 0 : this.layerManager.getTotalTextureMemory();

        return {
            frameCount: this.frameCount,
            averageFPS: this.vsync.getAverageFPS(),
            compositeTime: this.lastCompositeTime,
            uploadTime: this.lastUploadTime,
            layerCount,
            textureMemory,
            vsyncStats: this.vsync.getStats(),
        };
    }

    /**
     * Get configuration
     */
    getConfig(): CompositorConfig {
        return { ...this.config };
    }

    /**
     * Update configuration
     */
    updateConfig(config: Partial<CompositorConfig>): void {
        this.config = { ...this.config, ...config };

        if (config.targetFPS !== undefined) {
            this.vsync.setTargetFPS(config.targetFPS);
        }
    }

    /**
     * Check if compositor is running
     */
    isActive(): boolean {
        return this.isRunning;
    }

    /**
     * Get WebGL context
     */
    getGLContext(): WebGLRenderingContext | null {
        return this.gl;
    }

    /**
     * Get canvas
     */
    getCanvas(): HTMLCanvasElement | null {
        return this.canvas;
    }

    /**
     * Get layer manager
     */
    getLayerManager(): CompositorLayerManager {
        return this.layerManager;
    }

    /**
     * Get VSync
     */
    getVSync(): VSync {
        return this.vsync;
    }

    /**
     * Take screenshot
     * Captures current framebuffer as image
     */
    takeScreenshot(): Promise<Blob | null> {
        return new Promise((resolve) => {
            if (!this.canvas) {
                resolve(null);
                return;
            }

            this.canvas.toBlob((blob: Blob | null) => {
                resolve(blob);
            });
        });
    }

    /**
     * Dispose compositor
     */
    dispose(): void {
        this.stop();

        // Dispose layers
        this.layerManager.disposeAll();

        // Delete shader program
        if (this.gl && this.shaderProgram) {
            this.gl.deleteProgram(this.shaderProgram.program);
            this.gl.deleteShader(this.shaderProgram.vertexShader);
            this.gl.deleteShader(this.shaderProgram.fragmentShader);
        }

        this.shaderProgram = null;
        this.gl = null;
        this.canvas = null;
        this.layerTree = null;
    }

    /**
     * Get pixels from the current composite
     *
     * In headless mode, returns white pixels (blank canvas).
     */
    async getPixels(): Promise<Uint8ClampedArray> {
        if (!this.canvas) {
            throw new Error("Compositor not initialized");
        }

        const width = this.canvas.width;
        const height = this.canvas.height;
        const pixels = new Uint8ClampedArray(width * height * 4);

        // In headless mode, return white pixels (RGBA: 255, 255, 255, 255)
        if (this.headlessMode || !this.gl) {
            for (let i = 0; i < pixels.length; i += 4) {
                pixels[i] = 255;     // R
                pixels[i + 1] = 255; // G
                pixels[i + 2] = 255; // B
                pixels[i + 3] = 255; // A
            }
            return pixels;
        }

        this.gl.readPixels(0, 0, width, height, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixels);

        return pixels;
    }

    /**
     * Destroy the compositor and cleanup resources
     */
    async destroy(): Promise<void> {
        this.stop();

        if (this.shaderProgram && this.gl) {
            this.gl.deleteProgram(this.shaderProgram.program);
            this.gl.deleteShader(this.shaderProgram.vertexShader);
            this.gl.deleteShader(this.shaderProgram.fragmentShader);
        }

        this.layerManager.cleanup();
        this.gl = null;
        this.canvas = null;
    }
}

/**
 * Compositor factory
 * Creates and configures compositor instances
 */
export class CompositorFactory {
    /**
     * Create compositor with default configuration
     */
    static createDefault(canvas: HTMLCanvasElement): CompositorThread {
        const compositor = new CompositorThread();
        compositor.initialize(canvas);
        return compositor;
    }

    /**
     * Create high-performance compositor
     */
    static createHighPerformance(canvas: HTMLCanvasElement): CompositorThread {
        const compositor = new CompositorThread({
            enableVSync: true,
            enableTiling: true,
            targetFPS: 60,
            maxTextureSize: 4096,
        });
        compositor.initialize(canvas);
        return compositor;
    }

    /**
     * Create power-saving compositor
     */
    static createPowerSaving(canvas: HTMLCanvasElement): CompositorThread {
        const compositor = new CompositorThread({
            enableVSync: true,
            enableTiling: false,
            targetFPS: 30,
            maxTextureSize: 2048,
        });
        compositor.initialize(canvas);
        return compositor;
    }

    /**
     * Create testing compositor (no vsync)
     */
    static createForTesting(canvas: HTMLCanvasElement): CompositorThread {
        const compositor = new CompositorThread({
            enableVSync: false,
            enableTiling: false,
            targetFPS: 60,
            maxTextureSize: 2048,
        });
        compositor.initialize(canvas);
        return compositor;
    }
}

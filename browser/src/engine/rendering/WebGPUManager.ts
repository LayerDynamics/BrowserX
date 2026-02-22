/**
 * WebGPUManager
 *
 * Manages WebGPU initialization, disposal, screenshots, and pixel readback
 * for the rendering pipeline.
 */

import type { Pixels } from "../../types/identifiers.ts";
import { OffscreenWebGPU } from "../webgpu/offscreen/mod.ts";
import { WebGPUCompositorLayer, LayerType, LayerBlendMode } from "../webgpu/compositor/mod.ts";
import { WebGPUDevice } from "../webgpu/adapter/Device.ts";
import { WebGPUTextureManager } from "../webgpu/operations/render/TextureManager.ts";
import { CompositorThread } from "./compositor/CompositorThread.ts";
import type { WebGPUStats } from "../RenderingPipeline.ts";

/**
 * WebGPUManager handles all WebGPU lifecycle:
 * - Initialization of OffscreenWebGPU, WebGPUDevice, TextureManager, CompositorLayer
 * - Pixel readback (getPixels / screenshot)
 * - Disposal of GPU resources
 * - Viewport resizing for WebGPU resources
 */
export class WebGPUManager {
    private webgpu: OffscreenWebGPU | null = null;
    private webgpuDevice: WebGPUDevice | null = null;
    private webgpuTextureManager: WebGPUTextureManager | null = null;
    private webgpuLayer: WebGPUCompositorLayer | null = null;
    private useWebGPU: boolean = false;

    /**
     * Initialize WebGPU for GPU-accelerated rendering
     */
    async initializeWebGPU(width: number, height: number): Promise<boolean> {
        try {
            if (typeof navigator === "undefined" || !navigator.gpu) {
                return false;
            }

            this.webgpu = new OffscreenWebGPU({
                debug: false,
                label: "RenderingPipeline-OffscreenWebGPU",
            });

            await this.webgpu.initialize(width, height);

            this.webgpuDevice = new WebGPUDevice({
                powerPreference: "high-performance",
                label: "RenderingPipeline-WebGPUDevice",
            });

            await this.webgpuDevice.initialize();

            this.webgpuTextureManager = new WebGPUTextureManager(this.webgpuDevice);

            this.webgpuLayer = new WebGPUCompositorLayer(
                this.webgpuDevice,
                this.webgpuTextureManager,
                {
                    id: "root-layer" as import("../../types/webgpu.ts").LayerID,
                    type: LayerType.ROOT,
                    x: 0 as Pixels,
                    y: 0 as Pixels,
                    width: width as Pixels,
                    height: height as Pixels,
                    zIndex: 0,
                    opacity: 1.0,
                    blendMode: LayerBlendMode.NORMAL,
                    visible: true,
                    clipToBounds: false,
                    backgroundColor: [1, 1, 1, 1],
                }
            );

            this.webgpu.setDeviceLostHandler((reason) => {
                console.warn(`[WebGPUManager] WebGPU device lost: ${reason}`);
                this.useWebGPU = false;
            });

            this.useWebGPU = true;
            return true;
        } catch (error) {
            console.warn(
                `[WebGPUManager] WebGPU initialization failed, using headless fallback: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );

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
    async disposeWebGPU(): Promise<void> {
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
     * Get rendered pixels - uses WebGPU readback when available, falls back to compositor
     */
    async getPixels(compositor: CompositorThread): Promise<Uint8ClampedArray> {
        if (this.useWebGPU && this.webgpu && this.webgpu.isReady()) {
            try {
                return await this.webgpu.getPixels();
            } catch (error) {
                console.warn(
                    `[WebGPUManager] WebGPU pixel readback failed, falling back to compositor: ${
                        error instanceof Error ? error.message : String(error)
                    }`
                );
            }
        }

        return await compositor.getPixels();
    }

    /**
     * Resize WebGPU resources
     */
    resizeWebGPU(scaledWidth: number, scaledHeight: number): void {
        if (this.useWebGPU && this.webgpu && this.webgpu.isReady()) {
            try {
                this.webgpu.resize(scaledWidth, scaledHeight);

                if (this.webgpuLayer) {
                    this.webgpuLayer.resize(scaledWidth as Pixels, scaledHeight as Pixels);
                }
            } catch (error) {
                console.warn(
                    `[WebGPUManager] WebGPU resize failed: ${
                        error instanceof Error ? error.message : String(error)
                    }`
                );
            }
        }
    }

    /**
     * Get WebGPU statistics
     */
    getWebGPUStats(): WebGPUStats {
        const stats: WebGPUStats = {
            active: this.useWebGPU,
            available: typeof navigator !== "undefined" && !!navigator.gpu,
        };

        if (this.useWebGPU && this.webgpu) {
            stats.offscreen = this.webgpu.getStatistics();
        }

        if (this.useWebGPU && this.webgpuDevice && this.webgpuDevice.isReady()) {
            stats.device = this.webgpuDevice.getStats();
        }

        if (this.useWebGPU && this.webgpuLayer) {
            stats.layer = this.webgpuLayer.getStatistics();
        }

        return stats;
    }
}

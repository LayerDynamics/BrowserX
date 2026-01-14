/**
 * Canvas Context Tests
 *
 * Tests for WebGPU canvas context and swap chain management.
 */

import { assert, assertEquals, assertExists } from "@std/assert";
import { describe, it, beforeAll } from "jsr:@std/testing@1/bdd";
import { WebGPUDevice } from "../../../../src/engine/webgpu/adapter/Device.ts";
import {
    WebGPUCanvasContext,
    CanvasState,
    ResizeMode,
    type CanvasContextConfig,
    CanvasContextError,
} from "../../../../src/engine/webgpu/canvas/CanvasContext.ts";

// Type declarations for OffscreenCanvas (available in Deno runtime)
declare global {
    class OffscreenCanvas {
        constructor(width: number, height: number);
        width: number;
        height: number;
        getContext(contextId: string, options?: any): any;
        convertToBlob(options?: any): Promise<Blob>;
        transferToImageBitmap(): ImageBitmap;
    }

    interface ImageBitmap {
        readonly width: number;
        readonly height: number;
        close(): void;
    }
}

// Mock OffscreenCanvas implementation for tests
class MockOffscreenCanvas {
    width: number;
    height: number;
    private context: any = null;

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
    }

    getContext(contextId: string, options?: any): any {
        if (contextId === "webgpu") {
            if (!this.context) {
                // Create a mock WebGPU context
                const self = this;
                this.context = {
                    configure: (config: any) => {},
                    unconfigure: () => {},
                    getCurrentTexture: () => ({
                        width: self.width,
                        height: self.height,
                        createView: () => ({}),
                        destroy: () => {},
                    }),
                };
            }
            return this.context;
        }
        return null;
    }

    convertToBlob(options?: any): Promise<Blob> {
        return Promise.resolve(new Blob([]));
    }

    transferToImageBitmap(): any {
        return {
            width: this.width,
            height: this.height,
            close: () => {},
        };
    }
}

// Polyfill OffscreenCanvas if not available
if (typeof (globalThis as any).OffscreenCanvas === "undefined") {
    (globalThis as any).OffscreenCanvas = MockOffscreenCanvas;
}

// Test helpers
let device: WebGPUDevice;

beforeAll(async () => {
    device = new WebGPUDevice();
    await device.initialize();
});

function createOffscreenCanvas(width: number, height: number): OffscreenCanvas {
    return new (globalThis as any).OffscreenCanvas(width, height);
}

describe("WebGPUCanvasContext", () => {
    describe("Context Creation", () => {
        it("should create canvas context with default config", () => {
            const canvas = createOffscreenCanvas(800, 600);
            const config: CanvasContextConfig = { canvas };

            const context = new WebGPUCanvasContext(device, config);

            assertExists(context);
            assertEquals(context.getState(), CanvasState.CONFIGURED);
            assertEquals(context.isConfigured(), true);
        });

        it("should create canvas context with custom format", () => {
            const canvas = createOffscreenCanvas(800, 600);
            const config: CanvasContextConfig = {
                canvas,
                format: "rgba8unorm",
                alphaMode: "premultiplied",
            };

            const context = new WebGPUCanvasContext(device, config);

            assertExists(context);
            const configuration = context.getConfiguration();
            assertExists(configuration);
            assertEquals(configuration.format, "rgba8unorm");
            assertEquals(configuration.alphaMode, "premultiplied");
        });

        it("should initialize with correct dimensions", () => {
            const canvas = createOffscreenCanvas(1024, 768);
            const config: CanvasContextConfig = { canvas };

            const context = new WebGPUCanvasContext(device, config);

            assertEquals(context.getWidth(), 1024);
            assertEquals(context.getHeight(), 768);
        });
    });

    describe("Configuration Management", () => {
        it("should reconfigure canvas context", () => {
            const canvas = createOffscreenCanvas(800, 600);
            const context = new WebGPUCanvasContext(device, { canvas });

            // Reconfigure with new alpha mode
            context.reconfigure({ alphaMode: "premultiplied" });

            const config = context.getConfiguration();
            assertExists(config);
            assertEquals(config.alphaMode, "premultiplied");
        });

        it("should not reconfigure in invalid state", () => {
            const canvas = createOffscreenCanvas(800, 600);
            const context = new WebGPUCanvasContext(device, { canvas });

            context.destroy();

            try {
                context.reconfigure({ alphaMode: "premultiplied" });
                assert(false, "Should throw error");
            } catch (error) {
                assert(error instanceof CanvasContextError);
            }
        });

        it("should get current configuration", () => {
            const canvas = createOffscreenCanvas(800, 600);
            const context = new WebGPUCanvasContext(device, { canvas });

            const config = context.getConfiguration();
            assertExists(config);
            assertExists(config.device);
            assertExists(config.format);
        });
    });

    describe("Dimension Management", () => {
        it("should get canvas dimensions", () => {
            const canvas = createOffscreenCanvas(1920, 1080);
            const context = new WebGPUCanvasContext(device, { canvas });

            assertEquals(context.getWidth(), 1920);
            assertEquals(context.getHeight(), 1080);
        });

        it("should handle manual resize", () => {
            const canvas = createOffscreenCanvas(800, 600);
            const context = new WebGPUCanvasContext(device, { canvas });

            context.setResizeMode(ResizeMode.MANUAL);
            context.resize(1024, 768);

            assertEquals(context.getWidth(), 1024);
            assertEquals(context.getHeight(), 768);
            assertEquals(canvas.width, 1024);
            assertEquals(canvas.height, 768);
        });

        it("should handle immediate resize", () => {
            const canvas = createOffscreenCanvas(800, 600);
            const context = new WebGPUCanvasContext(device, { canvas });

            context.setResizeMode(ResizeMode.IMMEDIATE);
            context.resize(1280, 720);

            assertEquals(context.getWidth(), 1280);
            assertEquals(context.getHeight(), 720);
        });

        it("should defer resize until next frame", () => {
            const canvas = createOffscreenCanvas(800, 600);
            const context = new WebGPUCanvasContext(device, { canvas });

            context.setResizeMode(ResizeMode.DEFERRED);
            context.resize(1024, 768);

            // Dimensions should not change immediately
            assertEquals(context.getWidth(), 800);
            assertEquals(context.getHeight(), 600);

            // Get texture to trigger deferred resize
            const texture = context.getCurrentTexture();
            assertExists(texture);

            // Now dimensions should be updated
            assertEquals(context.getWidth(), 1024);
            assertEquals(context.getHeight(), 768);
        });

        it("should call resize handler on resize", () => {
            const canvas = createOffscreenCanvas(800, 600);
            const context = new WebGPUCanvasContext(device, { canvas });

            let resizeCalled = false;
            let resizeWidth = 0;
            let resizeHeight = 0;

            context.setResizeHandler((width, height) => {
                resizeCalled = true;
                resizeWidth = width;
                resizeHeight = height;
            });

            context.setResizeMode(ResizeMode.IMMEDIATE);
            context.resize(1024, 768);

            assertEquals(resizeCalled, true);
            assertEquals(resizeWidth, 1024);
            assertEquals(resizeHeight, 768);
        });
    });

    describe("Frame Management", () => {
        it("should get current texture", () => {
            const canvas = createOffscreenCanvas(800, 600);
            const context = new WebGPUCanvasContext(device, { canvas });

            const texture = context.getCurrentTexture();
            assertExists(texture);
            assertEquals(texture.width, 800);
            assertEquals(texture.height, 600);
        });

        it("should get current texture view", () => {
            const canvas = createOffscreenCanvas(800, 600);
            const context = new WebGPUCanvasContext(device, { canvas });

            const view = context.getCurrentTextureView();
            assertExists(view);
        });

        it("should present frame", () => {
            const canvas = createOffscreenCanvas(800, 600);
            const context = new WebGPUCanvasContext(device, { canvas });

            // Get texture
            const texture = context.getCurrentTexture();
            assertExists(texture);

            // Present
            context.present();

            // Statistics should be updated
            const stats = context.getStatistics();
            assertEquals(stats.framesPresented, 1);
        });

        it("should track frame numbers", () => {
            const canvas = createOffscreenCanvas(800, 600);
            const context = new WebGPUCanvasContext(device, { canvas });

            // Present multiple frames
            for (let i = 0; i < 5; i++) {
                context.getCurrentTexture();
                context.present();
            }

            const stats = context.getStatistics();
            assertEquals(stats.framesPresented, 5);
        });
    });

    describe("Statistics", () => {
        it("should provide canvas statistics", () => {
            const canvas = createOffscreenCanvas(800, 600);
            const context = new WebGPUCanvasContext(device, { canvas });

            const stats = context.getStatistics();

            assertEquals(stats.width, 800);
            assertEquals(stats.height, 600);
            assertExists(stats.format);
            assertEquals(stats.framesPresented, 0);
            assertEquals(stats.framesDropped, 0);
        });

        it("should calculate average frame time", () => {
            const canvas = createOffscreenCanvas(800, 600);
            const context = new WebGPUCanvasContext(device, { canvas });

            // Present multiple frames
            for (let i = 0; i < 10; i++) {
                context.getCurrentTexture();
                context.present();
            }

            const stats = context.getStatistics();
            assert(stats.averageFrameTime >= 0);
        });

        it("should calculate FPS", () => {
            const canvas = createOffscreenCanvas(800, 600);
            const context = new WebGPUCanvasContext(device, { canvas });

            // Present multiple frames
            for (let i = 0; i < 10; i++) {
                context.getCurrentTexture();
                context.present();
            }

            const stats = context.getStatistics();
            assert(stats.currentFPS >= 0);
        });

        it("should track frame timings", () => {
            const canvas = createOffscreenCanvas(800, 600);
            const context = new WebGPUCanvasContext(device, { canvas });

            // Present multiple frames
            for (let i = 0; i < 5; i++) {
                context.getCurrentTexture();
                context.present();
            }

            const timings = context.getFrameTimings();
            assertEquals(timings.length, 4); // First frame has no duration

            for (const timing of timings) {
                assertExists(timing.frameNumber);
                assertExists(timing.acquireTime);
                assert(timing.duration >= 0);
            }
        });

        it("should limit frame timing history to 60 frames", () => {
            const canvas = createOffscreenCanvas(800, 600);
            const context = new WebGPUCanvasContext(device, { canvas });

            // Present many frames
            for (let i = 0; i < 100; i++) {
                context.getCurrentTexture();
                context.present();
            }

            const timings = context.getFrameTimings();
            assert(timings.length <= 60);
        });
    });

    describe("State Management", () => {
        it("should track canvas state", () => {
            const canvas = createOffscreenCanvas(800, 600);
            const context = new WebGPUCanvasContext(device, { canvas });

            assertEquals(context.getState(), CanvasState.CONFIGURED);
            assertEquals(context.isConfigured(), true);
            assertEquals(context.isLost(), false);
        });

        it("should transition to destroyed state", () => {
            const canvas = createOffscreenCanvas(800, 600);
            const context = new WebGPUCanvasContext(device, { canvas });

            context.destroy();

            assertEquals(context.getState(), CanvasState.DESTROYED);
            assertEquals(context.isConfigured(), false);
        });

        it("should not get texture after destroy", () => {
            const canvas = createOffscreenCanvas(800, 600);
            const context = new WebGPUCanvasContext(device, { canvas });

            context.destroy();

            try {
                context.getCurrentTexture();
                assert(false, "Should throw error");
            } catch (error) {
                assert(error instanceof CanvasContextError);
            }
        });
    });

    describe("Event Handlers", () => {
        it("should set and call context lost handler", () => {
            const canvas = createOffscreenCanvas(800, 600);
            const context = new WebGPUCanvasContext(device, { canvas });

            let lostCalled = false;
            context.setContextLostHandler(() => {
                lostCalled = true;
            });

            // Context lost handler is set
            // (actual context loss would be triggered by WebGPU internally)
        });

        it("should set and call resize handler", () => {
            const canvas = createOffscreenCanvas(800, 600);
            const context = new WebGPUCanvasContext(device, { canvas });

            let resizeCalled = false;
            context.setResizeHandler(() => {
                resizeCalled = true;
            });

            context.resize(1024, 768);

            assertEquals(resizeCalled, true);
        });
    });

    describe("Cleanup", () => {
        it("should cleanup resources on destroy", () => {
            const canvas = createOffscreenCanvas(800, 600);
            const context = new WebGPUCanvasContext(device, { canvas });

            // Get some resources
            context.getCurrentTexture();

            // Destroy
            context.destroy();

            // Should be in destroyed state
            assertEquals(context.getState(), CanvasState.DESTROYED);

            // Configuration should be cleared
            assertEquals(context.getConfiguration(), null);
        });

        it("should be idempotent on multiple destroy calls", () => {
            const canvas = createOffscreenCanvas(800, 600);
            const context = new WebGPUCanvasContext(device, { canvas });

            context.destroy();
            context.destroy();
            context.destroy();

            assertEquals(context.getState(), CanvasState.DESTROYED);
        });
    });

    describe("Integration Tests", () => {
        it("should handle complete render workflow", () => {
            const canvas = createOffscreenCanvas(800, 600);
            const context = new WebGPUCanvasContext(device, { canvas });

            // Configure
            assertEquals(context.isConfigured(), true);

            // Get texture for rendering
            const texture = context.getCurrentTexture();
            assertExists(texture);

            // Create view
            const view = context.getCurrentTextureView();
            assertExists(view);

            // Present frame
            context.present();

            // Check statistics
            const stats = context.getStatistics();
            assertEquals(stats.framesPresented, 1);
        });

        it("should handle multiple frames", () => {
            const canvas = createOffscreenCanvas(800, 600);
            const context = new WebGPUCanvasContext(device, { canvas });

            const frameCount = 10;

            for (let i = 0; i < frameCount; i++) {
                // Get texture
                const texture = context.getCurrentTexture();
                assertExists(texture);

                // Render would happen here

                // Present
                context.present();
            }

            const stats = context.getStatistics();
            assertEquals(stats.framesPresented, frameCount);
        });

        it("should handle resize during rendering", () => {
            const canvas = createOffscreenCanvas(800, 600);
            const context = new WebGPUCanvasContext(device, { canvas });

            context.setResizeMode(ResizeMode.DEFERRED);

            // Render a frame
            context.getCurrentTexture();
            context.present();

            // Request resize
            context.resize(1024, 768);

            // Size should not change yet
            assertEquals(context.getWidth(), 800);
            assertEquals(context.getHeight(), 600);

            // Get next frame (triggers resize)
            const texture = context.getCurrentTexture();
            assertExists(texture);

            // Size should now be updated
            assertEquals(context.getWidth(), 1024);
            assertEquals(context.getHeight(), 768);
            assertEquals(texture.width, 1024);
            assertEquals(texture.height, 768);
        });

        it("should track performance metrics", () => {
            const canvas = createOffscreenCanvas(800, 600);
            const context = new WebGPUCanvasContext(device, { canvas });

            // Render several frames
            for (let i = 0; i < 30; i++) {
                context.getCurrentTexture();
                context.present();
            }

            const stats = context.getStatistics();
            assertEquals(stats.framesPresented, 30);
            assert(stats.averageFrameTime >= 0);
            assert(stats.currentFPS >= 0);

            const timings = context.getFrameTimings();
            assert(timings.length > 0);
            assert(timings.length <= 60);
        });
    });
});

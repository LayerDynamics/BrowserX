/**
 * Texture Manager Tests
 *
 * Tests for WebGPU texture creation, bitmap uploads, samplers, and texture management.
 */

import { assert, assertEquals, assertExists, assertRejects } from "@std/assert";
import { describe, it, beforeAll } from "jsr:@std/testing@1/bdd";
import { WebGPUDevice } from "../../../../../src/engine/webgpu/adapter/Device.ts";
import {
    WebGPUTextureManager,
    type TextureDescriptor,
    type SamplerDescriptor,
} from "../../../../../src/engine/webgpu/operations/render/TextureManager.ts";
import { GPUTextureError } from "../../../../../src/engine/webgpu/errors.ts";

// Test helpers
let device: WebGPUDevice;
let textureManager: WebGPUTextureManager;

beforeAll(async () => {
    device = new WebGPUDevice();
    await device.initialize();
});

describe("WebGPUTextureManager", () => {
    describe("Texture Creation", () => {
        it("should create texture with default settings", () => {
            textureManager = new WebGPUTextureManager(device);

            const descriptor: TextureDescriptor = {
                width: 256,
                height: 256,
                format: "rgba8unorm",
                usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
            };

            const textureId = textureManager.createTexture(descriptor);
            assertExists(textureId);

            const texture = textureManager.getTexture(textureId);
            assertExists(texture);
            assertEquals(texture.width, 256);
            assertEquals(texture.height, 256);
        });

        it("should create texture with custom format", () => {
            textureManager = new WebGPUTextureManager(device);

            const descriptor: TextureDescriptor = {
                width: 512,
                height: 512,
                format: "bgra8unorm",
                usage: GPUTextureUsage.RENDER_ATTACHMENT,
            };

            const textureId = textureManager.createTexture(descriptor);
            const texture = textureManager.getTexture(textureId);

            assertExists(texture);
            assertEquals(texture.format, "bgra8unorm");
        });

        it("should create texture with mipmaps", () => {
            textureManager = new WebGPUTextureManager(device);

            const descriptor: TextureDescriptor = {
                width: 1024,
                height: 1024,
                format: "rgba8unorm",
                usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
                mipLevelCount: 5,
            };

            const textureId = textureManager.createTexture(descriptor);
            const texture = textureManager.getTexture(textureId);

            assertExists(texture);
            assertEquals(texture.mipLevelCount, 5);
        });

        it("should create texture with multisampling", () => {
            textureManager = new WebGPUTextureManager(device);

            const descriptor: TextureDescriptor = {
                width: 800,
                height: 600,
                format: "rgba8unorm",
                usage: GPUTextureUsage.RENDER_ATTACHMENT,
                sampleCount: 4,
            };

            const textureId = textureManager.createTexture(descriptor);
            const texture = textureManager.getTexture(textureId);

            assertExists(texture);
            assertEquals(texture.sampleCount, 4);
        });

        it("should track texture statistics", () => {
            textureManager = new WebGPUTextureManager(device);

            const descriptor: TextureDescriptor = {
                width: 256,
                height: 256,
                format: "rgba8unorm",
                usage: GPUTextureUsage.TEXTURE_BINDING,
            };

            textureManager.createTexture(descriptor);

            const stats = textureManager.getStatistics();
            assertEquals(stats.texturesCreated, 1);
            assertEquals(stats.activeTextures, 1);
            assert(stats.memoryUsed > 0);
        });
    });

    describe("Texture Descriptor Management", () => {
        it("should retrieve texture descriptor", () => {
            textureManager = new WebGPUTextureManager(device);

            const descriptor: TextureDescriptor = {
                width: 256,
                height: 256,
                format: "rgba8unorm",
                usage: GPUTextureUsage.TEXTURE_BINDING,
                label: "test-texture",
            };

            const textureId = textureManager.createTexture(descriptor);
            const retrievedDescriptor = textureManager.getTextureDescriptor(textureId);

            assertExists(retrievedDescriptor);
            assertEquals(retrievedDescriptor.width, 256);
            assertEquals(retrievedDescriptor.height, 256);
            assertEquals(retrievedDescriptor.format, "rgba8unorm");
        });

        it("should check texture existence", () => {
            textureManager = new WebGPUTextureManager(device);

            const descriptor: TextureDescriptor = {
                width: 256,
                height: 256,
                format: "rgba8unorm",
                usage: GPUTextureUsage.TEXTURE_BINDING,
            };

            const textureId = textureManager.createTexture(descriptor);

            assertEquals(textureManager.hasTexture(textureId), true);
            assertEquals(textureManager.hasTexture("nonexistent-texture" as any), false);
        });
    });

    describe("Texture Destruction", () => {
        it("should destroy texture", () => {
            textureManager = new WebGPUTextureManager(device);

            const descriptor: TextureDescriptor = {
                width: 256,
                height: 256,
                format: "rgba8unorm",
                usage: GPUTextureUsage.TEXTURE_BINDING,
            };

            const textureId = textureManager.createTexture(descriptor);
            assertEquals(textureManager.hasTexture(textureId), true);

            textureManager.destroyTexture(textureId);
            assertEquals(textureManager.hasTexture(textureId), false);

            const stats = textureManager.getStatistics();
            assertEquals(stats.activeTextures, 0);
        });

        it("should update memory statistics on destroy", () => {
            textureManager = new WebGPUTextureManager(device);

            const descriptor: TextureDescriptor = {
                width: 256,
                height: 256,
                format: "rgba8unorm",
                usage: GPUTextureUsage.TEXTURE_BINDING,
            };

            const textureId = textureManager.createTexture(descriptor);
            const statsBeforeDestroy = textureManager.getStatistics();
            const memoryBefore = statsBeforeDestroy.memoryUsed;

            textureManager.destroyTexture(textureId);
            const statsAfterDestroy = textureManager.getStatistics();

            assertEquals(statsAfterDestroy.memoryUsed, 0);
            assert(memoryBefore > 0);
        });
    });

    describe("Pixel Data Upload", () => {
        it("should upload pixel data to texture", () => {
            textureManager = new WebGPUTextureManager(device);

            const descriptor: TextureDescriptor = {
                width: 16,
                height: 16,
                format: "rgba8unorm",
                usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
            };

            const textureId = textureManager.createTexture(descriptor);
            const texture = textureManager.getTexture(textureId);
            assertExists(texture);

            // Create pixel data (16x16 RGBA)
            const pixelData = new Uint8Array(16 * 16 * 4);
            for (let i = 0; i < pixelData.length; i += 4) {
                pixelData[i] = 255;     // R
                pixelData[i + 1] = 0;   // G
                pixelData[i + 2] = 0;   // B
                pixelData[i + 3] = 255; // A
            }

            textureManager.uploadPixelData(texture, pixelData, 16, 16);

            const stats = textureManager.getStatistics();
            assertEquals(stats.bitmapUploads, 1);
        });

        it("should upload pixel data with custom bytes per row", () => {
            textureManager = new WebGPUTextureManager(device);

            const descriptor: TextureDescriptor = {
                width: 8,
                height: 8,
                format: "rgba8unorm",
                usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
            };

            const textureId = textureManager.createTexture(descriptor);
            const texture = textureManager.getTexture(textureId);
            assertExists(texture);

            const pixelData = new Uint8Array(8 * 8 * 4);
            pixelData.fill(128);

            textureManager.uploadPixelData(texture, pixelData, 8, 8, {
                bytesPerRow: 64, // 8 * 4 * 2 (padded)
            });

            const stats = textureManager.getStatistics();
            assertEquals(stats.bitmapUploads, 1);
        });
    });

    describe("Sampler Management", () => {
        it("should create sampler with default settings", () => {
            textureManager = new WebGPUTextureManager(device);

            const descriptor: SamplerDescriptor = {};
            const sampler = textureManager.getSampler(descriptor);

            assertExists(sampler);
        });

        it("should create sampler with custom settings", () => {
            textureManager = new WebGPUTextureManager(device);

            const descriptor: SamplerDescriptor = {
                addressModeU: "repeat",
                addressModeV: "repeat",
                magFilter: "nearest",
                minFilter: "nearest",
            };

            const sampler = textureManager.getSampler(descriptor);
            assertExists(sampler);
        });

        it("should cache samplers", () => {
            textureManager = new WebGPUTextureManager(device);

            const descriptor: SamplerDescriptor = {
                addressModeU: "clamp-to-edge",
                addressModeV: "clamp-to-edge",
                magFilter: "linear",
                minFilter: "linear",
            };

            const sampler1 = textureManager.getSampler(descriptor);
            const sampler2 = textureManager.getSampler(descriptor);

            // Same descriptor should return same sampler
            assertEquals(sampler1, sampler2);

            const stats = textureManager.getStatistics();
            assertEquals(stats.samplersCreated, 1);
            assertEquals(stats.cachedSamplers, 1);
        });

        it("should create different samplers for different descriptors", () => {
            textureManager = new WebGPUTextureManager(device);

            const descriptor1: SamplerDescriptor = {
                magFilter: "nearest",
            };

            const descriptor2: SamplerDescriptor = {
                magFilter: "linear",
            };

            const sampler1 = textureManager.getSampler(descriptor1);
            const sampler2 = textureManager.getSampler(descriptor2);

            // Different descriptors should return different samplers
            assert(sampler1 !== sampler2);

            const stats = textureManager.getStatistics();
            assertEquals(stats.samplersCreated, 2);
        });

        it("should clear sampler cache", () => {
            textureManager = new WebGPUTextureManager(device);

            const descriptor: SamplerDescriptor = {
                magFilter: "linear",
            };

            textureManager.getSampler(descriptor);
            let stats = textureManager.getStatistics();
            assertEquals(stats.cachedSamplers, 1);

            textureManager.clearSamplerCache();
            stats = textureManager.getStatistics();
            assertEquals(stats.cachedSamplers, 0);
        });
    });

    describe("Statistics", () => {
        it("should track texture creation statistics", () => {
            textureManager = new WebGPUTextureManager(device);

            const descriptor: TextureDescriptor = {
                width: 256,
                height: 256,
                format: "rgba8unorm",
                usage: GPUTextureUsage.TEXTURE_BINDING,
            };

            textureManager.createTexture(descriptor);
            textureManager.createTexture(descriptor);
            textureManager.createTexture(descriptor);

            const stats = textureManager.getStatistics();
            assertEquals(stats.texturesCreated, 3);
            assertEquals(stats.activeTextures, 3);
        });

        it("should calculate memory usage", () => {
            textureManager = new WebGPUTextureManager(device);

            const descriptor: TextureDescriptor = {
                width: 256,
                height: 256,
                format: "rgba8unorm",
                usage: GPUTextureUsage.TEXTURE_BINDING,
            };

            textureManager.createTexture(descriptor);

            const stats = textureManager.getStatistics();
            const expectedMemory = 256 * 256 * 4; // RGBA8 = 4 bytes per pixel
            assert(stats.memoryUsed >= expectedMemory);
        });

        it("should track multiple texture creations", () => {
            textureManager = new WebGPUTextureManager(device);

            for (let i = 0; i < 10; i++) {
                const descriptor: TextureDescriptor = {
                    width: 128,
                    height: 128,
                    format: "rgba8unorm",
                    usage: GPUTextureUsage.TEXTURE_BINDING,
                };
                textureManager.createTexture(descriptor);
            }

            const stats = textureManager.getStatistics();
            assertEquals(stats.texturesCreated, 10);
            assertEquals(stats.activeTextures, 10);
        });
    });

    describe("Cleanup", () => {
        it("should destroy all resources", () => {
            textureManager = new WebGPUTextureManager(device);

            // Create multiple textures
            for (let i = 0; i < 5; i++) {
                const descriptor: TextureDescriptor = {
                    width: 256,
                    height: 256,
                    format: "rgba8unorm",
                    usage: GPUTextureUsage.TEXTURE_BINDING,
                };
                textureManager.createTexture(descriptor);
            }

            // Create samplers
            textureManager.getSampler({ magFilter: "linear" });
            textureManager.getSampler({ magFilter: "nearest" });

            let stats = textureManager.getStatistics();
            assert(stats.activeTextures > 0);
            assert(stats.cachedSamplers > 0);

            // Destroy all
            textureManager.destroy();

            stats = textureManager.getStatistics();
            assertEquals(stats.texturesCreated, 0);
            assertEquals(stats.activeTextures, 0);
            assertEquals(stats.memoryUsed, 0);
            assertEquals(stats.cachedSamplers, 0);
        });
    });

    describe("Integration Tests", () => {
        it("should handle complete texture workflow", () => {
            textureManager = new WebGPUTextureManager(device);

            // Create texture
            const descriptor: TextureDescriptor = {
                width: 256,
                height: 256,
                format: "rgba8unorm",
                usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
            };

            const textureId = textureManager.createTexture(descriptor);
            const texture = textureManager.getTexture(textureId);
            assertExists(texture);

            // Upload pixel data
            const pixelData = new Uint8Array(256 * 256 * 4);
            pixelData.fill(255);
            textureManager.uploadPixelData(texture, pixelData, 256, 256);

            // Create sampler
            const sampler = textureManager.getSampler({
                magFilter: "linear",
                minFilter: "linear",
            });
            assertExists(sampler);

            // Verify statistics
            const stats = textureManager.getStatistics();
            assertEquals(stats.texturesCreated, 1);
            assertEquals(stats.activeTextures, 1);
            assertEquals(stats.bitmapUploads, 1);
            assertEquals(stats.samplersCreated, 1);

            // Cleanup
            textureManager.destroyTexture(textureId);
            assertEquals(textureManager.hasTexture(textureId), false);
        });

        it("should handle multiple textures with different formats", () => {
            textureManager = new WebGPUTextureManager(device);

            const formats: GPUTextureFormat[] = [
                "rgba8unorm",
                "bgra8unorm",
                "r8unorm",
                "rg8unorm",
            ];

            const textureIds = formats.map((format) => {
                const descriptor: TextureDescriptor = {
                    width: 256,
                    height: 256,
                    format,
                    usage: GPUTextureUsage.TEXTURE_BINDING,
                };
                return textureManager.createTexture(descriptor);
            });

            assertEquals(textureIds.length, 4);

            const stats = textureManager.getStatistics();
            assertEquals(stats.texturesCreated, 4);
            assertEquals(stats.activeTextures, 4);

            // Cleanup
            textureIds.forEach((id) => textureManager.destroyTexture(id));
            const finalStats = textureManager.getStatistics();
            assertEquals(finalStats.activeTextures, 0);
        });
    });
});

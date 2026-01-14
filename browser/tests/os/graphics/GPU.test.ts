/**
 * GPU Tests
 *
 * Comprehensive tests for OS-level GPU operations.
 */

import { assertEquals, assertExists } from "@std/assert";
import { GPU, GPUCompositorLayer } from "../../../src/os/graphics/GPU.ts";

Deno.test({
    name: "GPU - initialize handles WebGPU availability",
    async fn() {
        const gpu = new GPU();

        await gpu.initialize();

        // WebGPU may or may not be available depending on environment
        // Just verify that initialize() doesn't throw
        const isAvailable = gpu.isAvailable();
        assertEquals(typeof isAvailable, "boolean");

        const device = gpu.getDevice();
        if (isAvailable) {
            assertExists(device);
        } else {
            assertEquals(device, undefined);
        }
    },
});

Deno.test({
    name: "GPU - uploadTexture without GPU device creates stub handle",
    fn() {
        const gpu = new GPU();

        const data = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255]); // 2 RGBA pixels
        const handle = gpu.uploadTexture(data, 2, 1, "rgba8unorm");

        assertExists(handle);
        assertExists(handle.id);
        assertEquals(handle.width, 2);
        assertEquals(handle.height, 1);
        assertEquals(handle.format, "rgba8unorm");
        assertEquals(handle.texture, undefined); // No GPU device
    },
});

Deno.test({
    name: "GPU - uploadTexture generates unique texture IDs",
    fn() {
        const gpu = new GPU();

        const data1 = new Uint8Array([255, 0, 0, 255]);
        const data2 = new Uint8Array([0, 255, 0, 255]);

        const handle1 = gpu.uploadTexture(data1, 1, 1);
        const handle2 = gpu.uploadTexture(data2, 1, 1);

        // IDs should be different
        assertEquals(handle1.id !== handle2.id, true);
        assertEquals(handle1.id, "texture_0");
        assertEquals(handle2.id, "texture_1");
    },
});

Deno.test({
    name: "GPU - uploadTexture with default format",
    fn() {
        const gpu = new GPU();

        const data = new Uint8Array([255, 0, 0, 255]);
        const handle = gpu.uploadTexture(data, 1, 1); // No format specified

        assertEquals(handle.format, "rgba8unorm"); // Default format
    },
});

Deno.test({
    name: "GPU - uploadTexture with custom format",
    fn() {
        const gpu = new GPU();

        const data = new Uint8Array([255, 0, 0, 255]);
        const handle = gpu.uploadTexture(data, 1, 1, "bgra8unorm");

        assertEquals(handle.format, "bgra8unorm");
    },
});

Deno.test({
    name: "GPU - uploadTexture with various dimensions",
    fn() {
        const gpu = new GPU();

        // 1x1 texture
        const handle1 = gpu.uploadTexture(new Uint8Array(4), 1, 1);
        assertEquals(handle1.width, 1);
        assertEquals(handle1.height, 1);

        // 100x100 texture
        const handle2 = gpu.uploadTexture(new Uint8Array(100 * 100 * 4), 100, 100);
        assertEquals(handle2.width, 100);
        assertEquals(handle2.height, 100);

        // Wide texture
        const handle3 = gpu.uploadTexture(new Uint8Array(1920 * 1 * 4), 1920, 1);
        assertEquals(handle3.width, 1920);
        assertEquals(handle3.height, 1);

        // Tall texture
        const handle4 = gpu.uploadTexture(new Uint8Array(1 * 1080 * 4), 1, 1080);
        assertEquals(handle4.width, 1);
        assertEquals(handle4.height, 1080);
    },
});

Deno.test({
    name: "GPU - uploadTexture with empty data",
    fn() {
        const gpu = new GPU();

        const handle = gpu.uploadTexture(new Uint8Array(0), 0, 0);

        assertEquals(handle.width, 0);
        assertEquals(handle.height, 0);
    },
});

Deno.test({
    name: "GPU - getTexture retrieves uploaded texture",
    fn() {
        const gpu = new GPU();

        const data = new Uint8Array([255, 0, 0, 255]);
        const handle = gpu.uploadTexture(data, 1, 1);

        const retrieved = gpu.getTexture(handle.id);

        assertExists(retrieved);
        if (retrieved) {
            assertEquals(retrieved.id, handle.id);
            assertEquals(retrieved.width, 1);
            assertEquals(retrieved.height, 1);
        }
    },
});

Deno.test({
    name: "GPU - getTexture returns undefined for non-existent ID",
    fn() {
        const gpu = new GPU();

        const retrieved = gpu.getTexture("non_existent_texture");

        assertEquals(retrieved, undefined);
    },
});

Deno.test({
    name: "GPU - getTexture after deleting texture",
    fn() {
        const gpu = new GPU();

        const data = new Uint8Array([255, 0, 0, 255]);
        const handle = gpu.uploadTexture(data, 1, 1);

        gpu.deleteTexture(handle);

        const retrieved = gpu.getTexture(handle.id);
        assertEquals(retrieved, undefined);
    },
});

Deno.test({
    name: "GPU - deleteTexture removes texture from registry",
    fn() {
        const gpu = new GPU();

        const data = new Uint8Array([255, 0, 0, 255]);
        const handle = gpu.uploadTexture(data, 1, 1);

        assertEquals(gpu.getTexture(handle.id) !== undefined, true);

        gpu.deleteTexture(handle);

        assertEquals(gpu.getTexture(handle.id), undefined);
    },
});

Deno.test({
    name: "GPU - deleteTexture with stub handle doesn't throw",
    fn() {
        const gpu = new GPU();

        const data = new Uint8Array([255, 0, 0, 255]);
        const handle = gpu.uploadTexture(data, 1, 1);

        // Should not throw even without GPU device
        gpu.deleteTexture(handle);

        assertEquals(gpu.getTexture(handle.id), undefined);
    },
});

Deno.test({
    name: "GPU - deleteTexture can be called multiple times",
    fn() {
        const gpu = new GPU();

        const data = new Uint8Array([255, 0, 0, 255]);
        const handle = gpu.uploadTexture(data, 1, 1);

        gpu.deleteTexture(handle);
        // Calling again should not throw
        gpu.deleteTexture(handle);
    },
});

Deno.test({
    name: "GPU - multiple textures can coexist",
    fn() {
        const gpu = new GPU();

        const handles = [];
        for (let i = 0; i < 10; i++) {
            const data = new Uint8Array([i, i, i, 255]);
            handles.push(gpu.uploadTexture(data, 1, 1));
        }

        // All should be retrievable
        for (const handle of handles) {
            const retrieved = gpu.getTexture(handle.id);
            assertExists(retrieved);
            if (retrieved) {
                assertEquals(retrieved.id, handle.id);
            }
        }
    },
});

Deno.test({
    name: "GPU - composite with empty layers doesn't throw",
    fn() {
        const gpu = new GPU();

        // Should not throw
        gpu.composite([]);
    },
});

Deno.test({
    name: "GPU - composite with single layer",
    fn() {
        const gpu = new GPU();

        const data = new Uint8Array([255, 0, 0, 255]);
        const handle = gpu.uploadTexture(data, 1, 1);

        const layer: GPUCompositorLayer = {
            textureId: handle.id,
            x: 0,
            y: 0,
            width: 1,
            height: 1,
            opacity: 1.0,
            zIndex: 0,
        };

        // Should not throw
        gpu.composite([layer]);
    },
});

Deno.test({
    name: "GPU - composite with multiple layers",
    fn() {
        const gpu = new GPU();

        const handle1 = gpu.uploadTexture(new Uint8Array([255, 0, 0, 255]), 1, 1);
        const handle2 = gpu.uploadTexture(new Uint8Array([0, 255, 0, 255]), 1, 1);
        const handle3 = gpu.uploadTexture(new Uint8Array([0, 0, 255, 255]), 1, 1);

        const layers: GPUCompositorLayer[] = [
            {
                textureId: handle1.id,
                x: 0,
                y: 0,
                width: 100,
                height: 100,
                opacity: 1.0,
                zIndex: 0,
            },
            {
                textureId: handle2.id,
                x: 50,
                y: 50,
                width: 100,
                height: 100,
                opacity: 0.5,
                zIndex: 1,
            },
            {
                textureId: handle3.id,
                x: 100,
                y: 100,
                width: 100,
                height: 100,
                opacity: 0.75,
                zIndex: 2,
            },
        ];

        // Should not throw
        gpu.composite(layers);
    },
});

Deno.test({
    name: "GPU - composite with various opacity values",
    fn() {
        const gpu = new GPU();

        const handle = gpu.uploadTexture(new Uint8Array([255, 0, 0, 255]), 1, 1);

        const layers: GPUCompositorLayer[] = [
            {
                textureId: handle.id,
                x: 0,
                y: 0,
                width: 1,
                height: 1,
                opacity: 0.0, // Fully transparent
                zIndex: 0,
            },
            {
                textureId: handle.id,
                x: 1,
                y: 1,
                width: 1,
                height: 1,
                opacity: 0.5, // Half transparent
                zIndex: 1,
            },
            {
                textureId: handle.id,
                x: 2,
                y: 2,
                width: 1,
                height: 1,
                opacity: 1.0, // Fully opaque
                zIndex: 2,
            },
        ];

        // Should not throw
        gpu.composite(layers);
    },
});

Deno.test({
    name: "GPU - composite with negative positions",
    fn() {
        const gpu = new GPU();

        const handle = gpu.uploadTexture(new Uint8Array([255, 0, 0, 255]), 1, 1);

        const layer: GPUCompositorLayer = {
            textureId: handle.id,
            x: -10,
            y: -20,
            width: 100,
            height: 100,
            opacity: 1.0,
            zIndex: 0,
        };

        // Should not throw
        gpu.composite([layer]);
    },
});

Deno.test({
    name: "GPU - composite with various z-index values",
    fn() {
        const gpu = new GPU();

        const handle = gpu.uploadTexture(new Uint8Array([255, 0, 0, 255]), 1, 1);

        const layers: GPUCompositorLayer[] = [
            { textureId: handle.id, x: 0, y: 0, width: 10, height: 10, opacity: 1.0, zIndex: 100 },
            { textureId: handle.id, x: 0, y: 0, width: 10, height: 10, opacity: 1.0, zIndex: -5 },
            { textureId: handle.id, x: 0, y: 0, width: 10, height: 10, opacity: 1.0, zIndex: 0 },
            { textureId: handle.id, x: 0, y: 0, width: 10, height: 10, opacity: 1.0, zIndex: 1 },
        ];

        // Should not throw
        gpu.composite(layers);
    },
});

Deno.test({
    name: "GPU - isAvailable returns false without initialization",
    fn() {
        const gpu = new GPU();

        assertEquals(gpu.isAvailable(), false);
    },
});

Deno.test({
    name: "GPU - isAvailable reflects initialization state",
    async fn() {
        const gpu = new GPU();

        await gpu.initialize();

        // WebGPU availability depends on environment
        const isAvailable = gpu.isAvailable();
        assertEquals(typeof isAvailable, "boolean");
    },
});

Deno.test({
    name: "GPU - getDevice returns undefined without initialization",
    fn() {
        const gpu = new GPU();

        assertEquals(gpu.getDevice(), undefined);
    },
});

Deno.test({
    name: "GPU - getDevice returns device after initialization if available",
    async fn() {
        const gpu = new GPU();

        await gpu.initialize();

        // Device availability depends on WebGPU support
        const device = gpu.getDevice();
        if (gpu.isAvailable()) {
            assertExists(device);
        } else {
            assertEquals(device, undefined);
        }
    },
});

Deno.test({
    name: "GPU - texture handles persist after initialization",
    async fn() {
        const gpu = new GPU();

        const data = new Uint8Array([255, 0, 0, 255]);
        const handle = gpu.uploadTexture(data, 1, 1);

        await gpu.initialize();

        // Texture should still be retrievable
        const retrieved = gpu.getTexture(handle.id);
        assertExists(retrieved);
        if (retrieved) {
            assertEquals(retrieved.id, handle.id);
        }
    },
});

Deno.test({
    name: "GPU - uploadTexture with large texture dimensions",
    fn() {
        const gpu = new GPU();

        // 4K texture
        const width = 3840;
        const height = 2160;
        const data = new Uint8Array(width * height * 4);

        const handle = gpu.uploadTexture(data, width, height);

        assertEquals(handle.width, width);
        assertEquals(handle.height, height);
    },
});

Deno.test({
    name: "GPU - composite layer with zero dimensions",
    fn() {
        const gpu = new GPU();

        const handle = gpu.uploadTexture(new Uint8Array([255, 0, 0, 255]), 1, 1);

        const layer: GPUCompositorLayer = {
            textureId: handle.id,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            opacity: 1.0,
            zIndex: 0,
        };

        // Should not throw
        gpu.composite([layer]);
    },
});

Deno.test({
    name: "GPU - composite with non-existent texture ID",
    fn() {
        const gpu = new GPU();

        const layer: GPUCompositorLayer = {
            textureId: "non_existent",
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            opacity: 1.0,
            zIndex: 0,
        };

        // Should not throw (stub implementation)
        gpu.composite([layer]);
    },
});

Deno.test({
    name: "GPU - multiple GPU instances are independent",
    fn() {
        const gpu1 = new GPU();
        const gpu2 = new GPU();

        const data = new Uint8Array([255, 0, 0, 255]);
        const handle1 = gpu1.uploadTexture(data, 1, 1);
        const handle2 = gpu2.uploadTexture(data, 1, 1);

        // Both instances start with texture_0 ID
        assertEquals(handle1.id, "texture_0");
        assertEquals(handle2.id, "texture_0");

        // But they maintain separate texture registries
        const texture1 = gpu1.getTexture(handle1.id);
        const texture2 = gpu2.getTexture(handle2.id);

        assertExists(texture1);
        assertExists(texture2);

        // They should be separate objects even with same ID
        assertEquals(texture1 !== texture2, true);

        // Deleting from one doesn't affect the other
        gpu1.deleteTexture(handle1);
        assertEquals(gpu1.getTexture(handle1.id), undefined);
        assertExists(gpu2.getTexture(handle2.id)); // Still exists in gpu2
    },
});

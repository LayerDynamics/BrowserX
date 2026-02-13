/**
 * OffscreenWebGPU Tests
 *
 * Tests for the offscreen WebGPU rendering context.
 * Note: These tests require WebGPU support in the runtime.
 *
 * Run with: deno test --allow-all browser/src/engine/webgpu/offscreen/OffscreenWebGPU.test.ts
 */

import {
    assertEquals,
    assertExists,
    assertThrows,
    assertRejects,
} from "@std/assert";
import {
    OffscreenWebGPU,
    OffscreenWebGPUState,
    OffscreenWebGPUError,
} from "./OffscreenWebGPU.ts";

// Helper to check if WebGPU is available
function hasWebGPU(): boolean {
    return typeof navigator !== "undefined" && "gpu" in navigator;
}

// Skip decorator for tests that require WebGPU
const webgpuTest = hasWebGPU()
    ? Deno.test
    : (name: string, _fn: () => void | Promise<void>) => {
          Deno.test({
              name: `[SKIP - No WebGPU] ${name}`,
              fn: () => {
                  console.log("WebGPU not available, skipping test");
              },
              ignore: true,
          });
      };

// ============================================================================
// Unit Tests (no WebGPU required)
// ============================================================================

Deno.test("OffscreenWebGPU - constructor creates instance", () => {
    const offscreen = new OffscreenWebGPU();
    assertExists(offscreen);
    assertEquals(offscreen.getState(), OffscreenWebGPUState.UNINITIALIZED);
    assertEquals(offscreen.width, 0);
    assertEquals(offscreen.height, 0);
    assertEquals(offscreen.gpuDevice, null);
    assertEquals(offscreen.gpuAdapter, null);
    assertEquals(offscreen.texture, null);
    assertEquals(offscreen.textureView, null);
});

Deno.test("OffscreenWebGPU - constructor with config", () => {
    const offscreen = new OffscreenWebGPU({
        width: 800,
        height: 600,
        powerPreference: "low-power",
        debug: true,
        label: "TestOffscreen",
    });
    assertExists(offscreen);
    assertEquals(offscreen.getState(), OffscreenWebGPUState.UNINITIALIZED);
    // Note: Dimensions are not set until initialize() is called
    assertEquals(offscreen.width, 0);
    assertEquals(offscreen.height, 0);
});

Deno.test("OffscreenWebGPU - format returns rgba8unorm", () => {
    const offscreen = new OffscreenWebGPU();
    assertEquals(offscreen.format, "rgba8unorm");
});

Deno.test("OffscreenWebGPU - isReady returns false initially", () => {
    const offscreen = new OffscreenWebGPU();
    assertEquals(offscreen.isReady(), false);
});

Deno.test("OffscreenWebGPU - isLost returns false initially", () => {
    const offscreen = new OffscreenWebGPU();
    assertEquals(offscreen.isLost(), false);
});

Deno.test("OffscreenWebGPU - getStatistics returns initial stats", () => {
    const offscreen = new OffscreenWebGPU();
    const stats = offscreen.getStatistics();

    assertEquals(stats.state, OffscreenWebGPUState.UNINITIALIZED);
    assertEquals(stats.width, 0);
    assertEquals(stats.height, 0);
    assertEquals(stats.textureFormat, "rgba8unorm");
    assertEquals(stats.readbackCount, 0);
    assertEquals(stats.totalReadbackTime, 0);
    assertEquals(stats.averageReadbackTime, 0);
});

Deno.test("OffscreenWebGPU - setDeviceLostHandler accepts callback", () => {
    const offscreen = new OffscreenWebGPU();
    let called = false;
    offscreen.setDeviceLostHandler((reason) => {
        called = true;
    });
    // Handler is set but not called yet
    assertEquals(called, false);
});

Deno.test("OffscreenWebGPU - setResizeHandler accepts callback", () => {
    const offscreen = new OffscreenWebGPU();
    let called = false;
    offscreen.setResizeHandler((width, height) => {
        called = true;
    });
    // Handler is set but not called yet
    assertEquals(called, false);
});

Deno.test("OffscreenWebGPU - dispose on uninitialized instance", () => {
    const offscreen = new OffscreenWebGPU();
    // Should not throw
    offscreen.dispose();
    assertEquals(offscreen.getState(), OffscreenWebGPUState.DESTROYED);
});

Deno.test("OffscreenWebGPU - double dispose is safe", () => {
    const offscreen = new OffscreenWebGPU();
    offscreen.dispose();
    offscreen.dispose(); // Should not throw
    assertEquals(offscreen.getState(), OffscreenWebGPUState.DESTROYED);
});

// ============================================================================
// Integration Tests (require WebGPU)
// ============================================================================

webgpuTest("OffscreenWebGPU - initialize creates resources", async () => {
    const offscreen = new OffscreenWebGPU({ debug: true });

    try {
        await offscreen.initialize(800, 600);

        assertEquals(offscreen.getState(), OffscreenWebGPUState.READY);
        assertEquals(offscreen.width, 800);
        assertEquals(offscreen.height, 600);
        assertEquals(offscreen.isReady(), true);
        assertExists(offscreen.gpuDevice);
        assertExists(offscreen.gpuAdapter);
        assertExists(offscreen.texture);
        assertExists(offscreen.textureView);
    } finally {
        offscreen.dispose();
    }
});

webgpuTest("OffscreenWebGPU - initialize rejects invalid dimensions", async () => {
    const offscreen = new OffscreenWebGPU();

    await assertRejects(
        () => offscreen.initialize(0, 600),
        OffscreenWebGPUError,
        "Invalid dimensions"
    );

    await assertRejects(
        () => offscreen.initialize(800, -1),
        OffscreenWebGPUError,
        "Invalid dimensions"
    );
});

webgpuTest("OffscreenWebGPU - initialize twice fails", async () => {
    const offscreen = new OffscreenWebGPU();

    try {
        await offscreen.initialize(800, 600);

        await assertRejects(
            () => offscreen.initialize(800, 600),
            OffscreenWebGPUError,
            "Cannot initialize"
        );
    } finally {
        offscreen.dispose();
    }
});

webgpuTest("OffscreenWebGPU - resize updates dimensions", async () => {
    const offscreen = new OffscreenWebGPU();

    try {
        await offscreen.initialize(800, 600);

        offscreen.resize(1024, 768);

        assertEquals(offscreen.width, 1024);
        assertEquals(offscreen.height, 768);
        assertExists(offscreen.texture);
        assertExists(offscreen.textureView);
    } finally {
        offscreen.dispose();
    }
});

webgpuTest("OffscreenWebGPU - resize with same dimensions is no-op", async () => {
    const offscreen = new OffscreenWebGPU();

    try {
        await offscreen.initialize(800, 600);

        const originalTexture = offscreen.texture;
        offscreen.resize(800, 600);

        // Texture should be the same object (no recreation)
        assertEquals(offscreen.texture, originalTexture);
    } finally {
        offscreen.dispose();
    }
});

webgpuTest("OffscreenWebGPU - resize rejects invalid dimensions", async () => {
    const offscreen = new OffscreenWebGPU();

    try {
        await offscreen.initialize(800, 600);

        assertThrows(
            () => offscreen.resize(0, 600),
            OffscreenWebGPUError,
            "Invalid dimensions"
        );

        assertThrows(
            () => offscreen.resize(800, -100),
            OffscreenWebGPUError,
            "Invalid dimensions"
        );
    } finally {
        offscreen.dispose();
    }
});

webgpuTest("OffscreenWebGPU - resize callback is called", async () => {
    const offscreen = new OffscreenWebGPU();
    let callbackWidth = 0;
    let callbackHeight = 0;

    offscreen.setResizeHandler((w, h) => {
        callbackWidth = w;
        callbackHeight = h;
    });

    try {
        await offscreen.initialize(800, 600);
        offscreen.resize(1024, 768);

        assertEquals(callbackWidth, 1024);
        assertEquals(callbackHeight, 768);
    } finally {
        offscreen.dispose();
    }
});

webgpuTest("OffscreenWebGPU - getPixels returns pixel data", async () => {
    const offscreen = new OffscreenWebGPU();

    try {
        await offscreen.initialize(100, 100);

        // Clear to a known color using a simple render pass
        const device = offscreen.gpuDevice!;
        const textureView = offscreen.textureView!;

        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
            colorAttachments: [
                {
                    view: textureView,
                    loadOp: "clear",
                    storeOp: "store",
                    clearValue: { r: 1.0, g: 0.0, b: 0.0, a: 1.0 }, // Red
                },
            ],
        });
        pass.end();

        device.queue.submit([encoder.finish()]);

        // Read back pixels
        const pixels = await offscreen.getPixels();

        // Verify pixel data
        assertExists(pixels);
        assertEquals(pixels.length, 100 * 100 * 4); // Width * Height * RGBA

        // Check first pixel is red (RGBA: 255, 0, 0, 255)
        assertEquals(pixels[0], 255); // R
        assertEquals(pixels[1], 0);   // G
        assertEquals(pixels[2], 0);   // B
        assertEquals(pixels[3], 255); // A

        // Check stats were updated
        const stats = offscreen.getStatistics();
        assertEquals(stats.readbackCount, 1);
    } finally {
        offscreen.dispose();
    }
});

webgpuTest("OffscreenWebGPU - getPixels rejects when not ready", async () => {
    const offscreen = new OffscreenWebGPU();

    await assertRejects(
        () => offscreen.getPixels(),
        OffscreenWebGPUError,
        "Cannot read pixels"
    );
});

webgpuTest("OffscreenWebGPU - getPixels after resize", async () => {
    const offscreen = new OffscreenWebGPU();

    try {
        await offscreen.initialize(50, 50);

        offscreen.resize(100, 100);

        // Clear to green
        const device = offscreen.gpuDevice!;
        const textureView = offscreen.textureView!;

        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
            colorAttachments: [
                {
                    view: textureView,
                    loadOp: "clear",
                    storeOp: "store",
                    clearValue: { r: 0.0, g: 1.0, b: 0.0, a: 1.0 }, // Green
                },
            ],
        });
        pass.end();

        device.queue.submit([encoder.finish()]);

        // Read back pixels
        const pixels = await offscreen.getPixels();

        // Verify resized dimensions
        assertEquals(pixels.length, 100 * 100 * 4);

        // Check first pixel is green
        assertEquals(pixels[0], 0);   // R
        assertEquals(pixels[1], 255); // G
        assertEquals(pixels[2], 0);   // B
        assertEquals(pixels[3], 255); // A
    } finally {
        offscreen.dispose();
    }
});

webgpuTest("OffscreenWebGPU - statistics track readback time", async () => {
    const offscreen = new OffscreenWebGPU();

    try {
        await offscreen.initialize(50, 50);

        // Perform multiple readbacks
        await offscreen.getPixels();
        await offscreen.getPixels();
        await offscreen.getPixels();

        const stats = offscreen.getStatistics();
        assertEquals(stats.readbackCount, 3);
        // Total time should be > 0
        assertEquals(stats.totalReadbackTime > 0, true);
        // Average should be calculated
        assertEquals(stats.averageReadbackTime > 0, true);
    } finally {
        offscreen.dispose();
    }
});

webgpuTest("OffscreenWebGPU - recover from uninitialized fails", async () => {
    const offscreen = new OffscreenWebGPU();

    await assertRejects(
        () => offscreen.recover(),
        OffscreenWebGPUError,
        "Cannot recover"
    );
});

webgpuTest("OffscreenWebGPU - dispose cleans up resources", async () => {
    const offscreen = new OffscreenWebGPU();

    await offscreen.initialize(800, 600);

    offscreen.dispose();

    assertEquals(offscreen.getState(), OffscreenWebGPUState.DESTROYED);
    assertEquals(offscreen.gpuDevice, null);
    assertEquals(offscreen.gpuAdapter, null);
    assertEquals(offscreen.texture, null);
    assertEquals(offscreen.textureView, null);
});

webgpuTest("OffscreenWebGPU - operations fail after dispose", async () => {
    const offscreen = new OffscreenWebGPU();

    await offscreen.initialize(800, 600);
    offscreen.dispose();

    assertThrows(
        () => offscreen.resize(1024, 768),
        OffscreenWebGPUError,
        "Cannot resize"
    );

    await assertRejects(
        () => offscreen.getPixels(),
        OffscreenWebGPUError,
        "Cannot read pixels"
    );
});

// ============================================================================
// Edge Cases
// ============================================================================

webgpuTest("OffscreenWebGPU - handles very small dimensions", async () => {
    const offscreen = new OffscreenWebGPU();

    try {
        await offscreen.initialize(1, 1);

        assertEquals(offscreen.width, 1);
        assertEquals(offscreen.height, 1);

        const pixels = await offscreen.getPixels();
        assertEquals(pixels.length, 4); // 1x1 pixel, RGBA
    } finally {
        offscreen.dispose();
    }
});

webgpuTest("OffscreenWebGPU - handles non-aligned dimensions", async () => {
    const offscreen = new OffscreenWebGPU();

    try {
        // Width that doesn't align to 256-byte boundary
        await offscreen.initialize(17, 13);

        assertEquals(offscreen.width, 17);
        assertEquals(offscreen.height, 13);

        // Clear to blue
        const device = offscreen.gpuDevice!;
        const textureView = offscreen.textureView!;

        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
            colorAttachments: [
                {
                    view: textureView,
                    loadOp: "clear",
                    storeOp: "store",
                    clearValue: { r: 0.0, g: 0.0, b: 1.0, a: 1.0 }, // Blue
                },
            ],
        });
        pass.end();

        device.queue.submit([encoder.finish()]);

        const pixels = await offscreen.getPixels();
        assertEquals(pixels.length, 17 * 13 * 4);

        // Check first pixel is blue
        assertEquals(pixels[0], 0);   // R
        assertEquals(pixels[1], 0);   // G
        assertEquals(pixels[2], 255); // B
        assertEquals(pixels[3], 255); // A
    } finally {
        offscreen.dispose();
    }
});

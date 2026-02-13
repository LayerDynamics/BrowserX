/**
 * Tests for WebGPU Compositor Layer
 *
 * Tests the enhanced compositor layer with:
 * - Texture upload from DisplayList
 * - Bind group management
 * - Transform updates
 * - Tiling support for large layers
 * - Opacity and visibility
 */

import {
    assertEquals,
    assertExists,
    assertThrows,
} from "@std/assert";
import { WebGPUDevice } from "../../../../src/engine/webgpu/adapter/Device.ts";
import { WebGPUTextureManager } from "../../../../src/engine/webgpu/operations/render/TextureManager.ts";
import {
    WebGPUCompositorLayer,
    LayerState,
    LayerType,
    BlendMode,
    type LayerConfig,
    DEFAULT_TILE_SIZE,
    CompositorLayerError,
} from "../../../../src/engine/webgpu/compositor/WebGPUCompositorLayer.ts";
import { DisplayList, PaintCommandType } from "../../../../src/engine/rendering/paint/DisplayList.ts";
import type { Pixels, LayerID } from "../../../../src/types/webgpu.ts";
import { createCompositorBindGroupLayout } from "../../../../src/engine/webgpu/shaders/mod.ts";

// Skip all tests if WebGPU not available
const webgpuAvailable = typeof navigator !== "undefined" && "gpu" in navigator;

/**
 * Create a basic layer config for testing
 */
function createTestLayerConfig(overrides?: Partial<LayerConfig>): LayerConfig {
    return {
        id: "test-layer" as LayerID,
        type: LayerType.ELEMENT,
        x: 0 as Pixels,
        y: 0 as Pixels,
        width: 256 as Pixels,
        height: 256 as Pixels,
        zIndex: 0,
        opacity: 1.0,
        blendMode: BlendMode.NORMAL,
        visible: true,
        clipToBounds: true,
        ...overrides,
    };
}

/**
 * Create a simple display list for testing
 */
function createTestDisplayList(): DisplayList {
    const displayList = new DisplayList();
    displayList.add({
        type: PaintCommandType.FILL_RECT,
        x: 10 as Pixels,
        y: 10 as Pixels,
        width: 100 as Pixels,
        height: 100 as Pixels,
        color: "#ff0000",
    });
    displayList.add({
        type: PaintCommandType.FILL_TEXT,
        text: "Test",
        x: 50 as Pixels,
        y: 50 as Pixels,
        font: "16px sans-serif",
        color: "#000000",
    });
    return displayList;
}

if (webgpuAvailable) {
    // ========================================================================
    // Basic Layer Creation Tests
    // ========================================================================

    Deno.test("CompositorLayer - creates with correct initial state", async () => {
        const device = new WebGPUDevice();
        await device.initialize();

        const textureManager = new WebGPUTextureManager(device);
        const config = createTestLayerConfig();

        const layer = new WebGPUCompositorLayer(device, textureManager, config);

        assertEquals(layer.getId(), config.id);
        assertEquals(layer.getType(), LayerType.ELEMENT);
        assertEquals(layer.getState(), LayerState.READY);
        assertEquals(layer.getOpacity(), 1.0);
        assertEquals(layer.isVisible(), true);
        assertEquals(layer.isTiled(), false); // Small layer shouldn't tile

        layer.destroy();
        textureManager.destroy();
        device.destroy();
    });

    Deno.test("CompositorLayer - initializes content texture", async () => {
        const device = new WebGPUDevice();
        await device.initialize();

        const textureManager = new WebGPUTextureManager(device);
        const config = createTestLayerConfig();

        const layer = new WebGPUCompositorLayer(device, textureManager, config);

        const texture = layer.getContentTexture();
        const textureView = layer.getContentTextureView();

        assertExists(texture);
        assertExists(textureView);

        layer.destroy();
        textureManager.destroy();
        device.destroy();
    });

    Deno.test("CompositorLayer - initializes uniform buffer", async () => {
        const device = new WebGPUDevice();
        await device.initialize();

        const textureManager = new WebGPUTextureManager(device);
        const config = createTestLayerConfig();

        const layer = new WebGPUCompositorLayer(device, textureManager, config);

        const uniformBuffer = layer.getUniformBuffer();
        assertExists(uniformBuffer);

        layer.destroy();
        textureManager.destroy();
        device.destroy();
    });

    // ========================================================================
    // Transform Tests
    // ========================================================================

    Deno.test("CompositorLayer - transform updates correctly", async () => {
        const device = new WebGPUDevice();
        await device.initialize();

        const textureManager = new WebGPUTextureManager(device);
        const config = createTestLayerConfig();

        const layer = new WebGPUCompositorLayer(device, textureManager, config);

        // Set transform
        layer.setTransform({
            translateX: 100,
            translateY: 50,
            scaleX: 2.0,
            scaleY: 1.5,
            rotation: Math.PI / 4,
        });

        const transform = layer.getTransform();
        assertEquals(transform.translateX, 100);
        assertEquals(transform.translateY, 50);
        assertEquals(transform.scaleX, 2.0);
        assertEquals(transform.scaleY, 1.5);
        assertEquals(transform.rotation, Math.PI / 4);

        layer.destroy();
        textureManager.destroy();
        device.destroy();
    });

    Deno.test("CompositorLayer - transform matrix is 4x4", async () => {
        const device = new WebGPUDevice();
        await device.initialize();

        const textureManager = new WebGPUTextureManager(device);
        const config = createTestLayerConfig();

        const layer = new WebGPUCompositorLayer(device, textureManager, config);

        const matrix = layer.getTransformMatrix();
        assertEquals(matrix.length, 16);
        assertEquals(matrix instanceof Float32Array, true);

        layer.destroy();
        textureManager.destroy();
        device.destroy();
    });

    Deno.test("CompositorLayer - updateTransform accepts 4x4 matrix", async () => {
        const device = new WebGPUDevice();
        await device.initialize();

        const textureManager = new WebGPUTextureManager(device);
        const config = createTestLayerConfig();

        const layer = new WebGPUCompositorLayer(device, textureManager, config);

        const customMatrix = new Float32Array([
            2, 0, 0, 0,
            0, 2, 0, 0,
            0, 0, 1, 0,
            10, 20, 0, 1,
        ]);

        layer.updateTransform(customMatrix);

        const matrix = layer.getTransformMatrix();
        assertEquals(matrix[0], 2); // Scale X
        assertEquals(matrix[5], 2); // Scale Y
        assertEquals(matrix[12], 10); // Translate X
        assertEquals(matrix[13], 20); // Translate Y

        layer.destroy();
        textureManager.destroy();
        device.destroy();
    });

    Deno.test("CompositorLayer - updateTransform rejects invalid matrix", async () => {
        const device = new WebGPUDevice();
        await device.initialize();

        const textureManager = new WebGPUTextureManager(device);
        const config = createTestLayerConfig();

        const layer = new WebGPUCompositorLayer(device, textureManager, config);

        const invalidMatrix = new Float32Array(9); // 3x3 instead of 4x4

        assertThrows(
            () => layer.updateTransform(invalidMatrix),
            CompositorLayerError,
            "4x4"
        );

        layer.destroy();
        textureManager.destroy();
        device.destroy();
    });

    // ========================================================================
    // Opacity Tests
    // ========================================================================

    Deno.test("CompositorLayer - opacity is clamped", async () => {
        const device = new WebGPUDevice();
        await device.initialize();

        const textureManager = new WebGPUTextureManager(device);
        const config = createTestLayerConfig();

        const layer = new WebGPUCompositorLayer(device, textureManager, config);

        layer.setOpacity(-0.5);
        assertEquals(layer.getOpacity(), 0);

        layer.setOpacity(1.5);
        assertEquals(layer.getOpacity(), 1);

        layer.setOpacity(0.5);
        assertEquals(layer.getOpacity(), 0.5);

        layer.destroy();
        textureManager.destroy();
        device.destroy();
    });

    Deno.test("CompositorLayer - visibility respects opacity", async () => {
        const device = new WebGPUDevice();
        await device.initialize();

        const textureManager = new WebGPUTextureManager(device);
        const config = createTestLayerConfig();

        const layer = new WebGPUCompositorLayer(device, textureManager, config);

        assertEquals(layer.isVisible(), true);

        layer.setOpacity(0);
        assertEquals(layer.isVisible(), false);

        layer.setOpacity(0.5);
        assertEquals(layer.isVisible(), true);

        layer.setVisible(false);
        assertEquals(layer.isVisible(), false);

        layer.destroy();
        textureManager.destroy();
        device.destroy();
    });

    // ========================================================================
    // Tiling Tests
    // ========================================================================

    Deno.test("CompositorLayer - large layers use tiling", async () => {
        const device = new WebGPUDevice();
        await device.initialize();

        const textureManager = new WebGPUTextureManager(device);
        const config = createTestLayerConfig({
            width: 5000 as Pixels, // > 4096
            height: 3000 as Pixels,
        });

        const layer = new WebGPUCompositorLayer(device, textureManager, config);

        assertEquals(layer.isTiled(), true);

        const tiles = layer.getTiles();
        const expectedCols = Math.ceil(5000 / DEFAULT_TILE_SIZE);
        const expectedRows = Math.ceil(3000 / DEFAULT_TILE_SIZE);
        assertEquals(tiles.length, expectedCols * expectedRows);

        layer.destroy();
        textureManager.destroy();
        device.destroy();
    });

    Deno.test("CompositorLayer - tiling can be forced", async () => {
        const device = new WebGPUDevice();
        await device.initialize();

        const textureManager = new WebGPUTextureManager(device);
        const config = createTestLayerConfig({
            width: 512 as Pixels,
            height: 512 as Pixels,
        });

        const layer = new WebGPUCompositorLayer(device, textureManager, config, {
            useTiling: true,
        });

        assertEquals(layer.isTiled(), true);

        layer.destroy();
        textureManager.destroy();
        device.destroy();
    });

    Deno.test("CompositorLayer - custom tile size", async () => {
        const device = new WebGPUDevice();
        await device.initialize();

        const textureManager = new WebGPUTextureManager(device);
        const config = createTestLayerConfig({
            width: 1024 as Pixels,
            height: 1024 as Pixels,
        });

        const layer = new WebGPUCompositorLayer(device, textureManager, config, {
            useTiling: true,
            tileConfig: {
                tileWidth: 128 as Pixels,
                tileHeight: 128 as Pixels,
                scale: 1.0,
            },
        });

        const tiles = layer.getTiles();
        // 1024 / 128 = 8 tiles per dimension
        assertEquals(tiles.length, 64);

        layer.destroy();
        textureManager.destroy();
        device.destroy();
    });

    Deno.test("CompositorLayer - getVisibleTiles returns intersecting tiles", async () => {
        const device = new WebGPUDevice();
        await device.initialize();

        const textureManager = new WebGPUTextureManager(device);
        const config = createTestLayerConfig({
            width: 1024 as Pixels,
            height: 1024 as Pixels,
        });

        const layer = new WebGPUCompositorLayer(device, textureManager, config, {
            useTiling: true,
        });

        // Get tiles visible in a small viewport
        const visibleTiles = layer.getVisibleTiles({
            x: 0 as Pixels,
            y: 0 as Pixels,
            width: 300 as Pixels,
            height: 300 as Pixels,
        });

        // Should get tiles that intersect with 0-300 range
        // With 256x256 tiles, that's 2x2 = 4 tiles
        assertEquals(visibleTiles.length, 4);

        layer.destroy();
        textureManager.destroy();
        device.destroy();
    });

    // ========================================================================
    // Bind Group Tests
    // ========================================================================

    Deno.test("CompositorLayer - createBindGroup creates valid bind group", async () => {
        const device = new WebGPUDevice();
        await device.initialize();

        const textureManager = new WebGPUTextureManager(device);
        const config = createTestLayerConfig();

        const layer = new WebGPUCompositorLayer(device, textureManager, config);

        // Create bind group layout
        const layout = createCompositorBindGroupLayout(device.getDevice());

        // Create bind group
        const bindGroup = layer.createBindGroup(layout);

        assertExists(bindGroup);
        assertEquals(layer.getBindGroup(), bindGroup);

        layer.destroy();
        textureManager.destroy();
        device.destroy();
    });

    // ========================================================================
    // Resize Tests
    // ========================================================================

    Deno.test("CompositorLayer - resize recreates textures", async () => {
        const device = new WebGPUDevice();
        await device.initialize();

        const textureManager = new WebGPUTextureManager(device);
        const config = createTestLayerConfig({
            width: 256 as Pixels,
            height: 256 as Pixels,
        });

        const layer = new WebGPUCompositorLayer(device, textureManager, config);

        const oldSize = layer.getSize();
        assertEquals(oldSize.width, 256);
        assertEquals(oldSize.height, 256);

        layer.resize(512 as Pixels, 512 as Pixels);

        const newSize = layer.getSize();
        assertEquals(newSize.width, 512);
        assertEquals(newSize.height, 512);

        // Texture should still exist
        assertExists(layer.getContentTexture());

        layer.destroy();
        textureManager.destroy();
        device.destroy();
    });

    Deno.test("CompositorLayer - resize switches to tiling for large sizes", async () => {
        const device = new WebGPUDevice();
        await device.initialize();

        const textureManager = new WebGPUTextureManager(device);
        const config = createTestLayerConfig({
            width: 256 as Pixels,
            height: 256 as Pixels,
        });

        const layer = new WebGPUCompositorLayer(device, textureManager, config);

        assertEquals(layer.isTiled(), false);

        // Resize to large size
        layer.resize(5000 as Pixels, 5000 as Pixels);

        assertEquals(layer.isTiled(), true);
        assertEquals(layer.getTiles().length > 0, true);

        layer.destroy();
        textureManager.destroy();
        device.destroy();
    });

    // ========================================================================
    // Damage Tracking Tests
    // ========================================================================

    Deno.test("CompositorLayer - damage tracking works", async () => {
        const device = new WebGPUDevice();
        await device.initialize();

        const textureManager = new WebGPUTextureManager(device);
        const config = createTestLayerConfig();

        const layer = new WebGPUCompositorLayer(device, textureManager, config);

        // Initially should have full damage (from creation)
        assertEquals(layer.hasDamage(), true);

        // Clear damage
        layer.clearDamage();
        assertEquals(layer.hasDamage(), false);

        // Mark partial damage
        layer.markDamage({
            x: 10 as Pixels,
            y: 10 as Pixels,
            width: 50 as Pixels,
            height: 50 as Pixels,
        });
        assertEquals(layer.hasDamage(), true);

        // Get damage rects
        const rects = layer.getDamageRects();
        assertEquals(rects.length, 1);
        assertEquals(rects[0].width, 50);

        layer.destroy();
        textureManager.destroy();
        device.destroy();
    });

    // ========================================================================
    // Statistics Tests
    // ========================================================================

    Deno.test("CompositorLayer - statistics include memory usage", async () => {
        const device = new WebGPUDevice();
        await device.initialize();

        const textureManager = new WebGPUTextureManager(device);
        const config = createTestLayerConfig({
            width: 256 as Pixels,
            height: 256 as Pixels,
        });

        const layer = new WebGPUCompositorLayer(device, textureManager, config);

        const stats = layer.getStatistics();

        assertExists(stats);
        assertEquals(stats.layerId, config.id);
        assertEquals(stats.state, LayerState.READY);
        assertEquals(stats.framesRendered, 0);
        // 256 * 256 * 4 (RGBA) = 262144 + uniform buffer (80) = 262224
        assertEquals(stats.textureMemory > 0, true);

        layer.destroy();
        textureManager.destroy();
        device.destroy();
    });

    // ========================================================================
    // Cleanup Tests
    // ========================================================================

    Deno.test("CompositorLayer - destroy cleans up all resources", async () => {
        const device = new WebGPUDevice();
        await device.initialize();

        const textureManager = new WebGPUTextureManager(device);
        const config = createTestLayerConfig();

        const layer = new WebGPUCompositorLayer(device, textureManager, config);

        // Create bind group to test cleanup
        const layout = createCompositorBindGroupLayout(device.getDevice());
        layer.createBindGroup(layout);

        // Destroy layer
        layer.destroy();

        assertEquals(layer.getState(), LayerState.DESTROYED);
        assertEquals(layer.getContentTexture(), null);
        assertEquals(layer.getContentTextureView(), null);
        assertEquals(layer.getUniformBuffer(), null);
        assertEquals(layer.getBindGroup(), null);

        textureManager.destroy();
        device.destroy();
    });

    Deno.test("CompositorLayer - destroy handles tiled layers", async () => {
        const device = new WebGPUDevice();
        await device.initialize();

        const textureManager = new WebGPUTextureManager(device);
        const config = createTestLayerConfig({
            width: 5000 as Pixels,
            height: 5000 as Pixels,
        });

        const layer = new WebGPUCompositorLayer(device, textureManager, config);

        assertEquals(layer.isTiled(), true);
        assertEquals(layer.getTiles().length > 0, true);

        layer.destroy();

        assertEquals(layer.getState(), LayerState.DESTROYED);
        assertEquals(layer.getTiles().length, 0);

        textureManager.destroy();
        device.destroy();
    });

    // ========================================================================
    // Position Tests
    // ========================================================================

    Deno.test("CompositorLayer - position management", async () => {
        const device = new WebGPUDevice();
        await device.initialize();

        const textureManager = new WebGPUTextureManager(device);
        const config = createTestLayerConfig({
            x: 100 as Pixels,
            y: 200 as Pixels,
        });

        const layer = new WebGPUCompositorLayer(device, textureManager, config);

        const pos = layer.getPosition();
        assertEquals(pos.x, 100);
        assertEquals(pos.y, 200);

        layer.setPosition(300 as Pixels, 400 as Pixels);

        const newPos = layer.getPosition();
        assertEquals(newPos.x, 300);
        assertEquals(newPos.y, 400);

        layer.destroy();
        textureManager.destroy();
        device.destroy();
    });

    // ========================================================================
    // Z-Index Tests
    // ========================================================================

    Deno.test("CompositorLayer - z-index management", async () => {
        const device = new WebGPUDevice();
        await device.initialize();

        const textureManager = new WebGPUTextureManager(device);
        const config = createTestLayerConfig({ zIndex: 5 });

        const layer = new WebGPUCompositorLayer(device, textureManager, config);

        assertEquals(layer.getZIndex(), 5);

        layer.setZIndex(10);
        assertEquals(layer.getZIndex(), 10);

        layer.destroy();
        textureManager.destroy();
        device.destroy();
    });

    // ========================================================================
    // Parent-Child Tests
    // ========================================================================

    Deno.test("CompositorLayer - parent-child relationships", async () => {
        const device = new WebGPUDevice();
        await device.initialize();

        const textureManager = new WebGPUTextureManager(device);
        const config = createTestLayerConfig();

        const layer = new WebGPUCompositorLayer(device, textureManager, config);

        assertEquals(layer.getParent(), null);
        assertEquals(layer.getChildren().length, 0);

        // Set parent
        const parentId = "parent-layer" as LayerID;
        layer.setParent(parentId);
        assertEquals(layer.getParent(), parentId);

        // Add children
        const childId = "child-layer" as LayerID;
        layer.addChild(childId);
        assertEquals(layer.getChildren().length, 1);
        assertEquals(layer.getChildren()[0], childId);

        // Remove child
        layer.removeChild(childId);
        assertEquals(layer.getChildren().length, 0);

        layer.destroy();
        textureManager.destroy();
        device.destroy();
    });

} else {
    Deno.test("CompositorLayer - WebGPU not available", () => {
        console.log("Skipping WebGPU compositor layer tests - WebGPU not available");
        assertEquals(webgpuAvailable, false);
    });
}

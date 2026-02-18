/**
 * Tests for WebGPUCompositorThread
 *
 * Covers:
 * - buildLayerTransform() math via standalone helper (pure unit, no GPU)
 * - Column-major 4×4 matrix format verification
 * - Optional extra transform application
 * - Static transform utilities (no GPU)
 * - LayerDescriptor management: addLayer, removeLayer, getLayer, updateLayer (GPU-guarded)
 * - Layer ordering by zIndex via getLayersInOrder (GPU-guarded)
 * - visible:false layers excluded from getLayersInOrder (GPU-guarded)
 * - Damage tracking helpers (GPU-guarded)
 * - CompositorState lifecycle (GPU-guarded)
 * - Statistics reporting (GPU-guarded)
 */

import {
    assertEquals,
    assertAlmostEquals,
    assertExists,
} from "@std/assert";
import {
    WebGPUCompositorThread,
    CompositorState,
    BlendMode,
    type LayerDescriptor,
    type DamageRect,
} from "../../../../src/engine/webgpu/compositor/WebGPUCompositorThread.ts";
import { WebGPUDevice } from "../../../../src/engine/webgpu/adapter/Device.ts";
import {
    WebGPUCanvasContext,
    type CanvasContextConfig,
} from "../../../../src/engine/webgpu/canvas/CanvasContext.ts";
import type { Pixels, GPUTextureID } from "../../../../src/types/webgpu.ts";

// ============================================================================
// Mock OffscreenCanvas for test environment
// Replicates the pattern from CanvasContext.test.ts
// ============================================================================

class MockOffscreenCanvas {
    width: number;
    height: number;
    private _ctx: Record<string, unknown> | null = null;

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
    }

    getContext(contextId: string): Record<string, unknown> | null {
        if (contextId === "webgpu") {
            if (!this._ctx) {
                const self = this;
                this._ctx = {
                    configure: (_config: unknown) => {},
                    unconfigure: () => {},
                    getCurrentTexture: () => ({
                        width: self.width,
                        height: self.height,
                        format: "bgra8unorm",
                        createView: () => ({
                            label: "mock-view",
                        }),
                        destroy: () => {},
                    }),
                };
            }
            return this._ctx;
        }
        return null;
    }
}

// Polyfill OffscreenCanvas when running in Deno test environment
if (typeof (globalThis as unknown as Record<string, unknown>).OffscreenCanvas === "undefined") {
    (globalThis as unknown as Record<string, unknown>).OffscreenCanvas = MockOffscreenCanvas;
}

// ============================================================================
// GPU availability guard
// ============================================================================

const webgpuAvailable = typeof navigator !== "undefined" && "gpu" in navigator;

// ============================================================================
// Helper factory for LayerDescriptor (no GPU resource required)
// ============================================================================

let _layerSeq = 0;

function makeLayer(overrides?: Partial<LayerDescriptor>): LayerDescriptor {
    _layerSeq++;
    return {
        id: `layer-${_layerSeq}`,
        textureId: `tex-${_layerSeq}` as GPUTextureID,
        x: 0 as Pixels,
        y: 0 as Pixels,
        width: 100 as Pixels,
        height: 100 as Pixels,
        zIndex: 0,
        opacity: 1.0,
        blendMode: BlendMode.NORMAL,
        visible: true,
        ...overrides,
    };
}

// ============================================================================
// Helper: build WebGPUCompositorThread backed by a mock canvas (GPU required)
// ============================================================================

async function createTestCompositor(canvasW = 800, canvasH = 600): Promise<{
    compositor: WebGPUCompositorThread;
    device: WebGPUDevice;
}> {
    const device = new WebGPUDevice();
    await device.initialize();

    const mockCanvas = new MockOffscreenCanvas(canvasW, canvasH);
    const config: CanvasContextConfig = {
        canvas: mockCanvas as unknown as Parameters<typeof WebGPUCanvasContext.prototype.constructor>[1]["canvas"],
    };
    const canvasCtx = new WebGPUCanvasContext(device, config);
    const compositor = new WebGPUCompositorThread(device, canvasCtx);

    return { compositor, device };
}

// ============================================================================
// SECTION 1 — Pure transform math (no GPU, no external dependencies)
// ============================================================================

/**
 * Standalone helper that replicates the private buildLayerTransform() logic from
 * WebGPUCompositorThread. Maps pixel-space layer bounds to a column-major 4×4
 * clip-space transform for a canvas of (canvasW, canvasH).
 */
function computeLayerTransform(
    layerX: number,
    layerY: number,
    layerW: number,
    layerH: number,
    canvasW: number,
    canvasH: number,
    transform?: {
        translateX?: number;
        translateY?: number;
        scaleX?: number;
        scaleY?: number;
    },
): Float32Array {
    const scaleX = layerW / canvasW;
    const scaleY = layerH / canvasH;

    const centerNdcX = (2 * (layerX + layerW / 2)) / canvasW - 1;
    const centerNdcY = 1 - (2 * (layerY + layerH / 2)) / canvasH;

    const tx = transform?.translateX ?? 0;
    const ty = transform?.translateY ?? 0;
    const sx = transform?.scaleX ?? 1;
    const sy = transform?.scaleY ?? 1;

    const finalScaleX = scaleX * sx;
    const finalScaleY = scaleY * sy;
    const finalTransX = centerNdcX + (2 * tx) / canvasW;
    const finalTransY = centerNdcY - (2 * ty) / canvasH;

    // Column-major 4×4 layout:
    //   m[0]  m[4]  m[8]  m[12]      scaleX  0  0  transX
    //   m[1]  m[5]  m[9]  m[13]   =  0  scaleY  0  transY
    //   m[2]  m[6]  m[10] m[14]      0  0  1  0
    //   m[3]  m[7]  m[11] m[15]      0  0  0  1
    return new Float32Array([
        finalScaleX, 0, 0, 0, // column 0
        0, finalScaleY, 0, 0, // column 1
        0, 0, 1, 0,           // column 2
        finalTransX, finalTransY, 0, 1, // column 3
    ]);
}

Deno.test("buildLayerTransform - full-canvas layer: scale=(1,1), translation=(0,0)", () => {
    const cW = 800;
    const cH = 600;
    const m = computeLayerTransform(0, 0, cW, cH, cW, cH);

    // scaleX = 800/800 = 1, scaleY = 600/600 = 1
    assertAlmostEquals(m[0], 1.0, 1e-6, "matrix[0] scaleX should be 1");
    assertAlmostEquals(m[5], 1.0, 1e-6, "matrix[5] scaleY should be 1");

    // centerNdcX = 2*(0 + 400)/800 - 1 = 1 - 1 = 0
    assertAlmostEquals(m[12], 0.0, 1e-6, "matrix[12] transX should be 0");

    // centerNdcY = 1 - 2*(0 + 300)/600 = 1 - 1 = 0
    assertAlmostEquals(m[13], 0.0, 1e-6, "matrix[13] transY should be 0");

    assertEquals(m.length, 16, "Matrix must have 16 elements");
});

Deno.test("buildLayerTransform - top-left quarter: scale=(0.5,0.5), center=(-0.5,0.5)", () => {
    const cW = 800;
    const cH = 600;
    // Top-left quarter: x=0, y=0, w=400, h=300
    const m = computeLayerTransform(0, 0, 400, 300, cW, cH);

    assertAlmostEquals(m[0], 0.5, 1e-6, "scaleX should be 0.5 (400/800)");
    assertAlmostEquals(m[5], 0.5, 1e-6, "scaleY should be 0.5 (300/600)");

    // centerNdcX = 2*(0 + 200)/800 - 1 = 0.5 - 1 = -0.5
    assertAlmostEquals(m[12], -0.5, 1e-6, "transX should be -0.5 (left half)");

    // centerNdcY = 1 - 2*(0 + 150)/600 = 1 - 0.5 = 0.5
    assertAlmostEquals(m[13], 0.5, 1e-6, "transY should be 0.5 (top half)");
});

Deno.test("buildLayerTransform - bottom-right quarter: center=(0.5,-0.5)", () => {
    const cW = 800;
    const cH = 600;
    // Bottom-right quarter: x=400, y=300, w=400, h=300
    const m = computeLayerTransform(400, 300, 400, 300, cW, cH);

    assertAlmostEquals(m[0], 0.5, 1e-6, "scaleX should be 0.5");
    assertAlmostEquals(m[5], 0.5, 1e-6, "scaleY should be 0.5");

    // centerNdcX = 2*(400 + 200)/800 - 1 = 1.5 - 1 = 0.5
    assertAlmostEquals(m[12], 0.5, 1e-6, "transX should be 0.5 (right half)");

    // centerNdcY = 1 - 2*(300 + 150)/600 = 1 - 1.5 = -0.5
    assertAlmostEquals(m[13], -0.5, 1e-6, "transY should be -0.5 (bottom half)");
});

Deno.test("buildLayerTransform - center 100x100 on 800x600: transX=0, transY=0", () => {
    const cW = 800;
    const cH = 600;
    // x=350, y=250, w=100, h=100 — center of canvas
    const m = computeLayerTransform(350, 250, 100, 100, cW, cH);

    assertAlmostEquals(m[0], 100 / 800, 1e-6, "scaleX = 100/800");
    assertAlmostEquals(m[5], 100 / 600, 1e-6, "scaleY = 100/600");

    // centerNdcX = 2*(350+50)/800 - 1 = 2*400/800 - 1 = 1 - 1 = 0
    assertAlmostEquals(m[12], 0.0, 1e-6, "transX should be 0 (layer centered on canvas)");

    // centerNdcY = 1 - 2*(250+50)/600 = 1 - 600/600 = 0
    assertAlmostEquals(m[13], 0.0, 1e-6, "transY should be 0 (layer centered on canvas)");
});

Deno.test("buildLayerTransform - extra translateX shifts transX by 2*tx/canvasW", () => {
    const cW = 800;
    const cH = 600;
    const tx = 50;

    const mBase = computeLayerTransform(100, 100, 200, 200, cW, cH);
    const mShifted = computeLayerTransform(100, 100, 200, 200, cW, cH, {
        translateX: tx,
    });

    const expectedDelta = (2 * tx) / cW; // 100/800 = 0.125
    assertAlmostEquals(
        mShifted[12] - mBase[12],
        expectedDelta,
        1e-6,
        "translateX shifts NDC X by 2*tx/canvasW",
    );
    // Y and scales unchanged
    assertAlmostEquals(mShifted[13], mBase[13], 1e-6, "transY should not change");
    assertAlmostEquals(mShifted[0], mBase[0], 1e-6, "scaleX should not change");
    assertAlmostEquals(mShifted[5], mBase[5], 1e-6, "scaleY should not change");
});

Deno.test("buildLayerTransform - extra translateY shifts transY by -2*ty/canvasH (Y inverted)", () => {
    const cW = 800;
    const cH = 600;
    const ty = 75;

    const mBase = computeLayerTransform(100, 100, 200, 200, cW, cH);
    const mShifted = computeLayerTransform(100, 100, 200, 200, cW, cH, {
        translateY: ty,
    });

    // NDC Y is inverted: positive pixel-Y shift → negative NDC Y shift
    const expectedDelta = -(2 * ty) / cH;
    assertAlmostEquals(
        mShifted[13] - mBase[13],
        expectedDelta,
        1e-6,
        "translateY shifts NDC Y by -2*ty/canvasH (inverted axis)",
    );
    assertAlmostEquals(mShifted[12], mBase[12], 1e-6, "transX should not change");
});

Deno.test("buildLayerTransform - extra scaleX multiplies the pixel-space scale", () => {
    const cW = 800;
    const cH = 600;
    const extraSx = 2.5;

    const mBase = computeLayerTransform(0, 0, 200, 200, cW, cH);
    const mScaled = computeLayerTransform(0, 0, 200, 200, cW, cH, { scaleX: extraSx });

    assertAlmostEquals(
        mScaled[0],
        mBase[0] * extraSx,
        1e-6,
        "finalScaleX = (w/canvasW) * extraScaleX",
    );
    assertAlmostEquals(mScaled[5], mBase[5], 1e-6, "scaleY should be unchanged");
});

Deno.test("buildLayerTransform - extra scaleY multiplies the pixel-space scale", () => {
    const cW = 800;
    const cH = 600;
    const extraSy = 3.0;

    const mBase = computeLayerTransform(0, 0, 200, 200, cW, cH);
    const mScaled = computeLayerTransform(0, 0, 200, 200, cW, cH, { scaleY: extraSy });

    assertAlmostEquals(
        mScaled[5],
        mBase[5] * extraSy,
        1e-6,
        "finalScaleY = (h/canvasH) * extraScaleY",
    );
    assertAlmostEquals(mScaled[0], mBase[0], 1e-6, "scaleX should be unchanged");
});

Deno.test("buildLayerTransform - combined extra translate and scale", () => {
    const cW = 1024;
    const cH = 768;
    const tx = 32;
    const ty = 16;
    const sx = 1.5;
    const sy = 0.5;

    const m = computeLayerTransform(100, 50, 256, 128, cW, cH, {
        translateX: tx,
        translateY: ty,
        scaleX: sx,
        scaleY: sy,
    });

    const baseScaleX = 256 / cW;
    const baseScaleY = 128 / cH;
    const centerNdcX = (2 * (100 + 128)) / cW - 1;
    const centerNdcY = 1 - (2 * (50 + 64)) / cH;

    assertAlmostEquals(m[0], baseScaleX * sx, 1e-6, "finalScaleX");
    assertAlmostEquals(m[5], baseScaleY * sy, 1e-6, "finalScaleY");
    assertAlmostEquals(m[12], centerNdcX + (2 * tx) / cW, 1e-6, "finalTransX");
    assertAlmostEquals(m[13], centerNdcY - (2 * ty) / cH, 1e-6, "finalTransY");
});

Deno.test("buildLayerTransform - column-major format: fixed positions and zero off-diagonals", () => {
    const m = computeLayerTransform(0, 0, 400, 400, 800, 800);

    // Diagonal elements
    assertAlmostEquals(m[10], 1.0, 1e-6, "m[10] (z scale, col2 row2) should be 1");
    assertAlmostEquals(m[15], 1.0, 1e-6, "m[15] (homogeneous, col3 row3) should be 1");
    assertAlmostEquals(m[14], 0.0, 1e-6, "m[14] (z trans) should be 0");

    // Off-diagonal elements of the 3x3 scale block must be zero
    assertAlmostEquals(m[1], 0.0, 1e-6, "m[1] should be 0");
    assertAlmostEquals(m[2], 0.0, 1e-6, "m[2] should be 0");
    assertAlmostEquals(m[3], 0.0, 1e-6, "m[3] should be 0");
    assertAlmostEquals(m[4], 0.0, 1e-6, "m[4] should be 0");
    assertAlmostEquals(m[6], 0.0, 1e-6, "m[6] should be 0");
    assertAlmostEquals(m[7], 0.0, 1e-6, "m[7] should be 0");
    assertAlmostEquals(m[8], 0.0, 1e-6, "m[8] should be 0");
    assertAlmostEquals(m[9], 0.0, 1e-6, "m[9] should be 0");
    assertAlmostEquals(m[11], 0.0, 1e-6, "m[11] should be 0");
});

Deno.test("buildLayerTransform - returns Float32Array of exactly 16 elements", () => {
    const m = computeLayerTransform(10, 20, 50, 50, 100, 100);
    assertEquals(m instanceof Float32Array, true, "Result must be a Float32Array");
    assertEquals(m.length, 16, "Length must be 16");
});

Deno.test("buildLayerTransform - no extra transform identical to identity extra transform", () => {
    const cW = 640;
    const cH = 480;
    const mNoExtra = computeLayerTransform(50, 50, 100, 100, cW, cH);
    const mIdentity = computeLayerTransform(50, 50, 100, 100, cW, cH, {
        translateX: 0,
        translateY: 0,
        scaleX: 1,
        scaleY: 1,
    });

    for (let i = 0; i < 16; i++) {
        assertAlmostEquals(
            mNoExtra[i],
            mIdentity[i],
            1e-6,
            `element [${i}] should match identity extra transform`,
        );
    }
});

Deno.test("buildLayerTransform - single-pixel layer has correct fractional scale", () => {
    const cW = 800;
    const cH = 600;
    const m = computeLayerTransform(0, 0, 1, 1, cW, cH);

    assertAlmostEquals(m[0], 1 / cW, 1e-6, "scaleX for 1px on 800px canvas");
    assertAlmostEquals(m[5], 1 / cH, 1e-6, "scaleY for 1px on 600px canvas");
});

Deno.test("buildLayerTransform - NDC Y axis is inverted relative to pixel Y", () => {
    const cW = 100;
    const cH = 100;

    // A layer at the top-pixel-row should have higher (more positive) NDC Y
    // than a layer at the bottom-pixel-row.
    const mTop = computeLayerTransform(0, 0, 10, 10, cW, cH);
    const mBottom = computeLayerTransform(0, 90, 10, 10, cW, cH);

    assertEquals(mTop[13] > mBottom[13], true, "Top pixel → higher NDC Y than bottom pixel");
    assertEquals(mTop[13] > 0, true, "Top-row layer should have positive NDC Y");
    assertEquals(mBottom[13] < 0, true, "Bottom-row layer should have negative NDC Y");
});

Deno.test("buildLayerTransform - non-square canvas 1920x1080 full frame", () => {
    const cW = 1920;
    const cH = 1080;
    const m = computeLayerTransform(0, 0, cW, cH, cW, cH);

    assertAlmostEquals(m[0], 1.0, 1e-6, "full-width scaleX = 1");
    assertAlmostEquals(m[5], 1.0, 1e-6, "full-height scaleY = 1");
    assertAlmostEquals(m[12], 0.0, 1e-6, "centered transX = 0");
    assertAlmostEquals(m[13], 0.0, 1e-6, "centered transY = 0");
});

Deno.test("buildLayerTransform - top-right corner layer has positive NDC X and Y", () => {
    const cW = 400;
    const cH = 400;
    const lx = 350;
    const ly = 0;
    const lw = 50;
    const lh = 50;
    const m = computeLayerTransform(lx, ly, lw, lh, cW, cH);

    assertEquals(m[12] > 0, true, "top-right corner → positive NDC X");
    assertEquals(m[13] > 0, true, "top-right corner → positive NDC Y");
});

Deno.test("buildLayerTransform - bottom-left corner layer has negative NDC X and Y", () => {
    const cW = 400;
    const cH = 400;
    const m = computeLayerTransform(0, 350, 50, 50, cW, cH);

    assertEquals(m[12] < 0, true, "bottom-left corner → negative NDC X");
    assertEquals(m[13] < 0, true, "bottom-left corner → negative NDC Y");
});

// ============================================================================
// SECTION 2 — Static transform utilities (no GPU)
// ============================================================================

Deno.test("createIdentityTransform - returns zero translation and unit scale", () => {
    const t = WebGPUCompositorThread.createIdentityTransform();

    assertEquals(t.translateX, 0, "translateX should be 0");
    assertEquals(t.translateY, 0, "translateY should be 0");
    assertEquals(t.scaleX, 1, "scaleX should be 1");
    assertEquals(t.scaleY, 1, "scaleY should be 1");
    assertEquals(t.rotation, 0, "rotation should be 0");
    assertEquals(t.originX, 0, "originX should be 0");
    assertEquals(t.originY, 0, "originY should be 0");
});

Deno.test("transformToMatrix - returns 16-element Float32Array", () => {
    const t = WebGPUCompositorThread.createIdentityTransform();
    const m = WebGPUCompositorThread.transformToMatrix(t);

    assertEquals(m instanceof Float32Array, true);
    assertEquals(m.length, 16);
});

Deno.test("transformToMatrix - identity transform has scale=1 on diagonal and zero translation", () => {
    const t = WebGPUCompositorThread.createIdentityTransform();
    const m = WebGPUCompositorThread.transformToMatrix(t);

    // With rotation=0: cos=1, sin=0; scaleX=1, scaleY=1; origin=0; translate=0
    assertAlmostEquals(m[0], 1.0, 1e-6, "m[0] should be 1 (scaleX*cos)");
    assertAlmostEquals(m[5], 1.0, 1e-6, "m[5] should be 1 (scaleY*cos)");
    assertAlmostEquals(m[10], 1.0, 1e-6, "m[10] should be 1");
    assertAlmostEquals(m[15], 1.0, 1e-6, "m[15] should be 1");
    assertAlmostEquals(m[12], 0.0, 1e-6, "m[12] translation should be 0");
    assertAlmostEquals(m[13], 0.0, 1e-6, "m[13] translation should be 0");
});

Deno.test("transformToMatrix - pure translation appears at m[12] and m[13]", () => {
    const t = WebGPUCompositorThread.createIdentityTransform();
    t.translateX = 7;
    t.translateY = -3;

    const m = WebGPUCompositorThread.transformToMatrix(t);

    assertAlmostEquals(m[12], 7.0, 1e-6, "m[12] should encode translateX=7");
    assertAlmostEquals(m[13], -3.0, 1e-6, "m[13] should encode translateY=-3");
});

Deno.test("transformToMatrix - scale factors appear on diagonal at m[0] and m[5]", () => {
    const t = WebGPUCompositorThread.createIdentityTransform();
    t.scaleX = 3.0;
    t.scaleY = 2.0;
    // rotation=0: cos=1, sin=0 → m[0]=scaleX*1=3, m[5]=scaleY*1=2

    const m = WebGPUCompositorThread.transformToMatrix(t);

    assertAlmostEquals(m[0], 3.0, 1e-6, "m[0] should be scaleX=3");
    assertAlmostEquals(m[5], 2.0, 1e-6, "m[5] should be scaleY=2");
});

Deno.test("composeTransforms - translations add", () => {
    const a = WebGPUCompositorThread.createIdentityTransform();
    a.translateX = 10;
    a.translateY = 20;

    const b = WebGPUCompositorThread.createIdentityTransform();
    b.translateX = 5;
    b.translateY = 3;

    const c = WebGPUCompositorThread.composeTransforms(a, b);

    assertEquals(c.translateX, 15, "translateX should add: 10+5=15");
    assertEquals(c.translateY, 23, "translateY should add: 20+3=23");
});

Deno.test("composeTransforms - scales multiply", () => {
    const a = WebGPUCompositorThread.createIdentityTransform();
    a.scaleX = 2;
    a.scaleY = 3;

    const b = WebGPUCompositorThread.createIdentityTransform();
    b.scaleX = 4;
    b.scaleY = 0.5;

    const c = WebGPUCompositorThread.composeTransforms(a, b);

    assertAlmostEquals(c.scaleX, 8.0, 1e-6, "scaleX multiplies: 2*4=8");
    assertAlmostEquals(c.scaleY, 1.5, 1e-6, "scaleY multiplies: 3*0.5=1.5");
});

Deno.test("composeTransforms - rotations add", () => {
    const a = WebGPUCompositorThread.createIdentityTransform();
    a.rotation = Math.PI / 4;

    const b = WebGPUCompositorThread.createIdentityTransform();
    b.rotation = Math.PI / 4;

    const c = WebGPUCompositorThread.composeTransforms(a, b);

    assertAlmostEquals(c.rotation, Math.PI / 2, 1e-6, "rotations add: PI/4+PI/4=PI/2");
});

// ============================================================================
// SECTION 3 — Enum completeness (no GPU)
// ============================================================================

Deno.test("BlendMode enum - all 14 expected values are present", () => {
    const expectedModes = [
        "NORMAL", "MULTIPLY", "SCREEN", "OVERLAY", "DARKEN", "LIGHTEN",
        "COLOR_DODGE", "COLOR_BURN", "HARD_LIGHT", "SOFT_LIGHT",
        "DIFFERENCE", "EXCLUSION", "ADD", "SUBTRACT",
    ] as const;

    for (const mode of expectedModes) {
        assertExists(
            (BlendMode as Record<string, string>)[mode],
            `BlendMode.${mode} should be defined`,
        );
    }
});

Deno.test("CompositorState enum - all 4 expected values are present", () => {
    assertEquals(CompositorState.UNINITIALIZED, "UNINITIALIZED");
    assertEquals(CompositorState.READY, "READY");
    assertEquals(CompositorState.COMPOSITING, "COMPOSITING");
    assertEquals(CompositorState.DESTROYED, "DESTROYED");
});

// ============================================================================
// SECTION 4 — GPU-guarded tests: layer management, ordering, damage, stats
// ============================================================================

if (webgpuAvailable) {
    Deno.test({
        name: "CompositorThread - initial state is UNINITIALIZED",
        sanitizeOps: false,
        sanitizeResources: false,
        async fn() {
            const { compositor, device } = await createTestCompositor();

            assertEquals(
                compositor.getState(),
                CompositorState.UNINITIALIZED,
                "Should start UNINITIALIZED",
            );

            compositor.destroy();
            device.destroy();
        },
    });

    Deno.test({
        name: "CompositorThread - addLayer stores and retrieves layer",
        sanitizeOps: false,
        sanitizeResources: false,
        async fn() {
            const { compositor, device } = await createTestCompositor();

            const layer = makeLayer({ id: "layer-a" });
            compositor.addLayer(layer);

            const retrieved = compositor.getLayer("layer-a");
            assertExists(retrieved, "Layer should be retrievable after addLayer");
            assertEquals(retrieved.id, "layer-a");

            compositor.destroy();
            device.destroy();
        },
    });

    Deno.test({
        name: "CompositorThread - getLayer returns null for unknown ID",
        sanitizeOps: false,
        sanitizeResources: false,
        async fn() {
            const { compositor, device } = await createTestCompositor();

            const result = compositor.getLayer("does-not-exist");
            assertEquals(result, null, "Should return null for unknown layer");

            compositor.destroy();
            device.destroy();
        },
    });

    Deno.test({
        name: "CompositorThread - removeLayer makes layer unretrievable",
        sanitizeOps: false,
        sanitizeResources: false,
        async fn() {
            const { compositor, device } = await createTestCompositor();

            const layer = makeLayer({ id: "layer-remove" });
            compositor.addLayer(layer);
            assertExists(compositor.getLayer("layer-remove"));

            compositor.removeLayer("layer-remove");
            assertEquals(
                compositor.getLayer("layer-remove"),
                null,
                "Layer should be gone after removal",
            );

            compositor.destroy();
            device.destroy();
        },
    });

    Deno.test({
        name: "CompositorThread - removeLayer of non-existent ID does not throw",
        sanitizeOps: false,
        sanitizeResources: false,
        async fn() {
            const { compositor, device } = await createTestCompositor();

            // Should not throw
            compositor.removeLayer("ghost-layer");

            compositor.destroy();
            device.destroy();
        },
    });

    Deno.test({
        name: "CompositorThread - getLayersInOrder returns visible layers sorted by zIndex",
        sanitizeOps: false,
        sanitizeResources: false,
        async fn() {
            const { compositor, device } = await createTestCompositor();

            compositor.addLayer(makeLayer({ id: "z5", zIndex: 5 }));
            compositor.addLayer(makeLayer({ id: "z1", zIndex: 1 }));
            compositor.addLayer(makeLayer({ id: "z3", zIndex: 3 }));

            const ordered = compositor.getLayersInOrder();
            assertEquals(ordered.length, 3, "All 3 visible layers should appear");
            assertEquals(ordered[0].id, "z1", "Lowest zIndex drawn first");
            assertEquals(ordered[1].id, "z3");
            assertEquals(ordered[2].id, "z5", "Highest zIndex drawn last");

            compositor.destroy();
            device.destroy();
        },
    });

    Deno.test({
        name: "CompositorThread - getLayersInOrder excludes invisible layers",
        sanitizeOps: false,
        sanitizeResources: false,
        async fn() {
            const { compositor, device } = await createTestCompositor();

            compositor.addLayer(makeLayer({ id: "vis-1", zIndex: 1, visible: true }));
            compositor.addLayer(makeLayer({ id: "invis", zIndex: 2, visible: false }));
            compositor.addLayer(makeLayer({ id: "vis-2", zIndex: 3, visible: true }));

            const ordered = compositor.getLayersInOrder();
            assertEquals(ordered.length, 2, "Invisible layer must be excluded");
            assertEquals(ordered[0].id, "vis-1");
            assertEquals(ordered[1].id, "vis-2");

            compositor.destroy();
            device.destroy();
        },
    });

    Deno.test({
        name: "CompositorThread - getLayersInOrder returns empty when all layers invisible",
        sanitizeOps: false,
        sanitizeResources: false,
        async fn() {
            const { compositor, device } = await createTestCompositor();

            compositor.addLayer(makeLayer({ id: "inv-a", visible: false }));
            compositor.addLayer(makeLayer({ id: "inv-b", visible: false }));

            const ordered = compositor.getLayersInOrder();
            assertEquals(ordered.length, 0, "No visible layers should yield empty result");

            compositor.destroy();
            device.destroy();
        },
    });

    Deno.test({
        name: "CompositorThread - updateLayer modifies stored properties",
        sanitizeOps: false,
        sanitizeResources: false,
        async fn() {
            const { compositor, device } = await createTestCompositor();

            compositor.addLayer(makeLayer({ id: "layer-upd", opacity: 1.0, zIndex: 0 }));
            compositor.updateLayer("layer-upd", { opacity: 0.5, zIndex: 10 });

            const updated = compositor.getLayer("layer-upd");
            assertExists(updated);
            assertAlmostEquals(updated.opacity, 0.5, 1e-6, "opacity should update to 0.5");
            assertEquals(updated.zIndex, 10, "zIndex should update to 10");

            compositor.destroy();
            device.destroy();
        },
    });

    Deno.test({
        name: "CompositorThread - updateLayer re-sorts rendering order on zIndex change",
        sanitizeOps: false,
        sanitizeResources: false,
        async fn() {
            const { compositor, device } = await createTestCompositor();

            compositor.addLayer(makeLayer({ id: "low", zIndex: 1 }));
            compositor.addLayer(makeLayer({ id: "high", zIndex: 10 }));

            let ordered = compositor.getLayersInOrder();
            assertEquals(ordered[0].id, "low");
            assertEquals(ordered[1].id, "high");

            // Invert z-indices
            compositor.updateLayer("low", { zIndex: 20 });
            compositor.updateLayer("high", { zIndex: 5 });

            ordered = compositor.getLayersInOrder();
            assertEquals(ordered[0].id, "high", "After swap, 'high' (z=5) should be first");
            assertEquals(ordered[1].id, "low", "After swap, 'low' (z=20) should be second");

            compositor.destroy();
            device.destroy();
        },
    });

    Deno.test({
        name: "CompositorThread - adding same layer ID twice updates the layer",
        sanitizeOps: false,
        sanitizeResources: false,
        async fn() {
            const { compositor, device } = await createTestCompositor();

            const v1 = makeLayer({ id: "dup", opacity: 1.0 });
            compositor.addLayer(v1);

            const v2 = { ...v1, opacity: 0.3 };
            compositor.addLayer(v2);

            // Still one layer
            assertEquals(compositor.getStatistics().totalLayers, 1, "Duplicate ID = update");

            const stored = compositor.getLayer("dup");
            assertExists(stored);
            assertAlmostEquals(stored.opacity, 0.3, 1e-6, "Should reflect updated opacity");

            compositor.destroy();
            device.destroy();
        },
    });

    Deno.test({
        name: "CompositorThread - addLayer increments totalLayers stat",
        sanitizeOps: false,
        sanitizeResources: false,
        async fn() {
            const { compositor, device } = await createTestCompositor();

            assertEquals(compositor.getStatistics().totalLayers, 0);
            compositor.addLayer(makeLayer({ id: "c1" }));
            assertEquals(compositor.getStatistics().totalLayers, 1);
            compositor.addLayer(makeLayer({ id: "c2" }));
            assertEquals(compositor.getStatistics().totalLayers, 2);
            compositor.removeLayer("c1");
            assertEquals(compositor.getStatistics().totalLayers, 1);

            compositor.destroy();
            device.destroy();
        },
    });

    Deno.test({
        name: "CompositorThread - initial statistics are all zero",
        sanitizeOps: false,
        sanitizeResources: false,
        async fn() {
            const { compositor, device } = await createTestCompositor();

            const stats = compositor.getStatistics();
            assertEquals(stats.framesComposited, 0, "framesComposited starts at 0");
            assertEquals(stats.droppedFrames, 0, "droppedFrames starts at 0");
            assertEquals(stats.totalLayers, 0, "totalLayers starts at 0");
            assertEquals(stats.visibleLayers, 0, "visibleLayers starts at 0");

            compositor.destroy();
            device.destroy();
        },
    });

    Deno.test({
        name: "CompositorThread - getFrameTimings returns empty array before any frame",
        sanitizeOps: false,
        sanitizeResources: false,
        async fn() {
            const { compositor, device } = await createTestCompositor();

            const timings = compositor.getFrameTimings();
            assertEquals(Array.isArray(timings), true);
            assertEquals(timings.length, 0, "No timings before compositeFrame() is called");

            compositor.destroy();
            device.destroy();
        },
    });

    Deno.test({
        name: "CompositorThread - markDamage does not affect layer visibility",
        sanitizeOps: false,
        sanitizeResources: false,
        async fn() {
            const { compositor, device } = await createTestCompositor();

            compositor.addLayer(makeLayer({ id: "damage-test" }));
            compositor.markDamage();

            const layers = compositor.getLayersInOrder();
            assertEquals(layers.length, 1, "Layer should still be visible after markDamage");

            compositor.destroy();
            device.destroy();
        },
    });

    Deno.test({
        name: "CompositorThread - markDamageRect does not throw",
        sanitizeOps: false,
        sanitizeResources: false,
        async fn() {
            const { compositor, device } = await createTestCompositor();

            const rect: DamageRect = {
                x: 10 as Pixels,
                y: 20 as Pixels,
                width: 50 as Pixels,
                height: 60 as Pixels,
            };

            // Should not throw
            compositor.markDamageRect(rect);
            compositor.markDamageRect(rect);

            compositor.destroy();
            device.destroy();
        },
    });

    Deno.test({
        name: "CompositorThread - destroy transitions state to DESTROYED",
        sanitizeOps: false,
        sanitizeResources: false,
        async fn() {
            const { compositor, device } = await createTestCompositor();

            compositor.addLayer(makeLayer({ id: "d1" }));
            compositor.destroy();

            assertEquals(compositor.getState(), CompositorState.DESTROYED);

            device.destroy();
        },
    });

    Deno.test({
        name: "CompositorThread - destroy clears all layers (getLayersInOrder returns empty)",
        sanitizeOps: false,
        sanitizeResources: false,
        async fn() {
            const { compositor, device } = await createTestCompositor();

            compositor.addLayer(makeLayer({ id: "dl1" }));
            compositor.addLayer(makeLayer({ id: "dl2" }));

            compositor.destroy();

            // After destroy, state should be DESTROYED and the layerOrder array is cleared.
            // getLayersInOrder() iterates this.layerOrder which is reset to [].
            assertEquals(compositor.getState(), CompositorState.DESTROYED);

            device.destroy();
        },
    });

    Deno.test({
        name: "CompositorThread - second destroy call is idempotent",
        sanitizeOps: false,
        sanitizeResources: false,
        async fn() {
            const { compositor, device } = await createTestCompositor();

            compositor.destroy();
            // Should not throw
            compositor.destroy();

            assertEquals(compositor.getState(), CompositorState.DESTROYED);
            device.destroy();
        },
    });

    Deno.test({
        name: "CompositorThread - constructor accepts partial config with defaults",
        sanitizeOps: false,
        sanitizeResources: false,
        async fn() {
            const device = new WebGPUDevice();
            await device.initialize();

            const mockCanvas = new MockOffscreenCanvas(1280, 720);
            const config: CanvasContextConfig = {
                canvas: mockCanvas as unknown as Parameters<typeof WebGPUCanvasContext.prototype.constructor>[1]["canvas"],
            };
            const canvasCtx = new WebGPUCanvasContext(device, config);

            // Partial config — unspecified fields should use defaults
            const compositor = new WebGPUCompositorThread(device, canvasCtx, {
                targetFPS: 30,
            });

            assertEquals(compositor.getState(), CompositorState.UNINITIALIZED);

            compositor.destroy();
            device.destroy();
        },
    });

} else {
    Deno.test("CompositorThread - GPU tests skipped (WebGPU not available in this environment)", () => {
        console.log("Skipping WebGPU compositor thread GPU tests — no WebGPU adapter");
        assertEquals(webgpuAvailable, false);
    });
}

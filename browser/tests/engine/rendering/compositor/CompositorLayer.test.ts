/**
 * CompositorLayer tests — transform matrix construction
 * Verifies rotation, scale, translation, and transform origin
 */

import { assert, assertEquals, assertExists } from "@std/assert";
import {
  CompositorLayer,
  type CompositorLayerID,
} from "../../../../src/engine/rendering/compositor/CompositorLayer.ts";
import { PaintLayer, type Transform } from "../../../../src/engine/rendering/paint/PaintLayer.ts";
import type { Pixels } from "../../../../src/types/identifiers.ts";

// Helper: create a PaintLayer with a given transform
function createLayerWithTransform(t: Partial<Transform>): CompositorLayer {
  const paintLayer = new PaintLayer("test" as any, {
    x: 0 as Pixels,
    y: 0 as Pixels,
    width: 100 as Pixels,
    height: 100 as Pixels,
  });
  paintLayer.setTransform({
    translateX: (t.translateX ?? 0) as Pixels,
    translateY: (t.translateY ?? 0) as Pixels,
    scaleX: t.scaleX ?? 1,
    scaleY: t.scaleY ?? 1,
    rotation: t.rotation ?? 0,
    originX: (t.originX ?? 0) as Pixels,
    originY: (t.originY ?? 0) as Pixels,
  });
  return new CompositorLayer("layer-1" as CompositorLayerID, paintLayer, false);
}

// Helper: get transform matrix from layer (private method)
function getMatrix(layer: CompositorLayer): Float32Array {
  return (layer as any).createTransformMatrix();
}

const EPSILON = 1e-6;
function approxEqual(a: number, b: number, msg?: string): void {
  assert(
    Math.abs(a - b) < EPSILON,
    `${msg ?? ""} Expected ${b}, got ${a} (diff ${Math.abs(a - b)})`,
  );
}

// =============================================================================
// Identity transform
// =============================================================================

Deno.test("createTransformMatrix - identity transform", () => {
  const layer = createLayerWithTransform({});
  const m = getMatrix(layer);
  assertEquals(m.length, 16);
  // Should be identity matrix
  approxEqual(m[0], 1, "m[0]");
  approxEqual(m[5], 1, "m[5]");
  approxEqual(m[10], 1, "m[10]");
  approxEqual(m[15], 1, "m[15]");
  approxEqual(m[12], 0, "tx");
  approxEqual(m[13], 0, "ty");
  // Off-diagonal should be 0
  approxEqual(m[1], 0, "m[1]");
  approxEqual(m[4], 0, "m[4]");
});

// =============================================================================
// Translation only
// =============================================================================

Deno.test("createTransformMatrix - translation only", () => {
  const layer = createLayerWithTransform({ translateX: 50 as Pixels, translateY: 30 as Pixels });
  const m = getMatrix(layer);
  approxEqual(m[12], 50, "tx");
  approxEqual(m[13], 30, "ty");
  // Scale should be 1
  approxEqual(m[0], 1, "m[0]");
  approxEqual(m[5], 1, "m[5]");
});

// =============================================================================
// Scale only
// =============================================================================

Deno.test("createTransformMatrix - scale only", () => {
  const layer = createLayerWithTransform({ scaleX: 2, scaleY: 3 });
  const m = getMatrix(layer);
  approxEqual(m[0], 2, "scaleX");
  approxEqual(m[5], 3, "scaleY");
  // No rotation: sin=0 entries should be 0
  approxEqual(m[1], 0, "m[1]");
  approxEqual(m[4], 0, "m[4]");
});

// =============================================================================
// Rotation only
// =============================================================================

Deno.test("createTransformMatrix - 90 degree rotation", () => {
  const layer = createLayerWithTransform({ rotation: Math.PI / 2 });
  const m = getMatrix(layer);
  // cos(90°) ≈ 0, sin(90°) ≈ 1
  approxEqual(m[0], 0, "m[0] = cos(90°)");
  approxEqual(m[1], 1, "m[1] = sin(90°)");
  approxEqual(m[4], -1, "m[4] = -sin(90°)");
  approxEqual(m[5], 0, "m[5] = cos(90°)");
});

Deno.test("createTransformMatrix - 45 degree rotation", () => {
  const layer = createLayerWithTransform({ rotation: Math.PI / 4 });
  const m = getMatrix(layer);
  const s2 = Math.SQRT2 / 2; // ≈ 0.7071
  approxEqual(m[0], s2, "m[0]");
  approxEqual(m[1], s2, "m[1]");
  approxEqual(m[4], -s2, "m[4]");
  approxEqual(m[5], s2, "m[5]");
});

Deno.test("createTransformMatrix - 180 degree rotation", () => {
  const layer = createLayerWithTransform({ rotation: Math.PI });
  const m = getMatrix(layer);
  approxEqual(m[0], -1, "m[0] = cos(180°)");
  approxEqual(m[1], 0, "m[1] = sin(180°)");
  approxEqual(m[4], 0, "m[4] = -sin(180°)");
  approxEqual(m[5], -1, "m[5] = cos(180°)");
});

// =============================================================================
// Combined rotation + scale
// =============================================================================

Deno.test("createTransformMatrix - scale + rotation composed", () => {
  const layer = createLayerWithTransform({
    scaleX: 2,
    scaleY: 3,
    rotation: Math.PI / 2,
  });
  const m = getMatrix(layer);
  // m[0] = scaleX * cos(90°) = 2 * 0 = 0
  // m[1] = scaleX * sin(90°) = 2 * 1 = 2
  // m[4] = -scaleY * sin(90°) = -3 * 1 = -3
  // m[5] = scaleY * cos(90°) = 3 * 0 = 0
  approxEqual(m[0], 0, "m[0]");
  approxEqual(m[1], 2, "m[1]");
  approxEqual(m[4], -3, "m[4]");
  approxEqual(m[5], 0, "m[5]");
});

// =============================================================================
// Combined translation + rotation + scale
// =============================================================================

Deno.test("createTransformMatrix - translate + rotate + scale", () => {
  const layer = createLayerWithTransform({
    translateX: 10 as Pixels,
    translateY: 20 as Pixels,
    scaleX: 2,
    scaleY: 2,
    rotation: 0,
  });
  const m = getMatrix(layer);
  approxEqual(m[0], 2, "scaleX");
  approxEqual(m[5], 2, "scaleY");
  approxEqual(m[12], 10, "tx");
  approxEqual(m[13], 20, "ty");
});

// =============================================================================
// Transform origin
// =============================================================================

Deno.test("createTransformMatrix - transform origin with rotation", () => {
  // Rotate 90° around center (50, 50)
  const layer = createLayerWithTransform({
    rotation: Math.PI / 2,
    originX: 50 as Pixels,
    originY: 50 as Pixels,
  });
  const m = getMatrix(layer);

  // tx = translateX - originX*(scaleX*cos - 1) + originY*scaleY*sin
  // tx = 0 - 50*(0 - 1) + 50*1*1 = 50 + 50 = 100
  // ty = translateY - originX*scaleX*sin - originY*(scaleY*cos - 1)
  // ty = 0 - 50*1*1 - 50*(0 - 1) = -50 + 50 = 0
  approxEqual(m[12], 100, "tx with origin");
  approxEqual(m[13], 0, "ty with origin");
});

Deno.test("createTransformMatrix - transform origin with scale", () => {
  // Scale 2x from center (50, 50)
  const layer = createLayerWithTransform({
    scaleX: 2,
    scaleY: 2,
    originX: 50 as Pixels,
    originY: 50 as Pixels,
  });
  const m = getMatrix(layer);
  // tx = 0 - 50*(2*1 - 1) + 50*2*0 = -50
  // ty = 0 - 50*2*0 - 50*(2*1 - 1) = -50
  approxEqual(m[12], -50, "tx: scale from center shifts left");
  approxEqual(m[13], -50, "ty: scale from center shifts up");
});

// =============================================================================
// Z passthrough and W
// =============================================================================

Deno.test("createTransformMatrix - Z and W components", () => {
  const layer = createLayerWithTransform({
    translateX: 10 as Pixels,
    rotation: Math.PI / 3,
    scaleX: 1.5,
  });
  const m = getMatrix(layer);
  // Z column: passthrough
  approxEqual(m[8], 0);
  approxEqual(m[9], 0);
  approxEqual(m[10], 1);
  approxEqual(m[11], 0);
  // W row
  approxEqual(m[3], 0);
  approxEqual(m[7], 0);
  approxEqual(m[14], 0);
  approxEqual(m[15], 1);
});

// =============================================================================
// No overwrite bug regression
// =============================================================================

Deno.test("createTransformMatrix - scale does not overwrite rotation", () => {
  // This was the original bug: matrix[0] set to identity then overwritten by scaleX
  // ignoring rotation. With rotation, m[0] should NOT equal scaleX.
  const layer = createLayerWithTransform({
    scaleX: 2,
    rotation: Math.PI / 4,
  });
  const m = getMatrix(layer);
  // m[0] should be scaleX * cos(45°) ≈ 2 * 0.7071 ≈ 1.4142, NOT 2
  const expected = 2 * Math.cos(Math.PI / 4);
  approxEqual(m[0], expected, "m[0] must compose scale with rotation");
  assert(Math.abs(m[0] - 2) > 0.1, "m[0] must NOT be raw scaleX (regression)");
});

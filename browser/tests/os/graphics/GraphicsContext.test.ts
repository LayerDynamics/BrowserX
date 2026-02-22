/**
 * GraphicsContext Tests
 *
 * Comprehensive tests for 2D graphics rendering context.
 */

import { assertEquals, assertExists } from "@std/assert";
import { GraphicsContext } from "../../../src/os/graphics/GraphicsContext.ts";

Deno.test({
  name: "GraphicsContext - constructor creates context with dimensions",
  fn() {
    const ctx = new GraphicsContext(800, 600);

    const dims = ctx.getDimensions();
    assertEquals(dims.width, 800);
    assertEquals(dims.height, 600);
  },
});

Deno.test({
  name: "GraphicsContext - constructor with zero dimensions",
  fn() {
    const ctx = new GraphicsContext(0, 0);

    const dims = ctx.getDimensions();
    assertEquals(dims.width, 0);
    assertEquals(dims.height, 0);
  },
});

Deno.test({
  name: "GraphicsContext - constructor with large dimensions",
  fn() {
    const ctx = new GraphicsContext(4096, 2160);

    const dims = ctx.getDimensions();
    assertEquals(dims.width, 4096);
    assertEquals(dims.height, 2160);
  },
});

Deno.test({
  name: "GraphicsContext - setFillStyle and fillRect",
  fn() {
    const ctx = new GraphicsContext(100, 100);

    ctx.setFillStyle("#ff0000");
    // Should not throw
    ctx.fillRect(10, 10, 50, 50);
  },
});

Deno.test({
  name: "GraphicsContext - setFillStyle with various color formats",
  fn() {
    const ctx = new GraphicsContext(100, 100);

    // Hex color
    ctx.setFillStyle("#ff0000");
    ctx.fillRect(0, 0, 10, 10);

    // RGB color
    ctx.setFillStyle("rgb(255, 0, 0)");
    ctx.fillRect(0, 0, 10, 10);

    // RGBA color
    ctx.setFillStyle("rgba(255, 0, 0, 0.5)");
    ctx.fillRect(0, 0, 10, 10);

    // Named color
    ctx.setFillStyle("red");
    ctx.fillRect(0, 0, 10, 10);
  },
});

Deno.test({
  name: "GraphicsContext - setStrokeStyle and strokeRect",
  fn() {
    const ctx = new GraphicsContext(100, 100);

    ctx.setStrokeStyle("#00ff00");
    ctx.strokeRect(10, 10, 50, 50);
  },
});

Deno.test({
  name: "GraphicsContext - setLineWidth",
  fn() {
    const ctx = new GraphicsContext(100, 100);

    ctx.setLineWidth(5);
    ctx.strokeRect(10, 10, 50, 50);

    ctx.setLineWidth(0.5);
    ctx.strokeRect(20, 20, 30, 30);
  },
});

Deno.test({
  name: "GraphicsContext - setFont",
  fn() {
    const ctx = new GraphicsContext(100, 100);

    ctx.setFont("12px Arial");
    ctx.setFont("bold 16px 'Times New Roman'");
    ctx.setFont("italic 14px monospace");
  },
});

Deno.test({
  name: "GraphicsContext - setGlobalAlpha",
  fn() {
    const ctx = new GraphicsContext(100, 100);

    ctx.setGlobalAlpha(1.0);
    ctx.fillRect(0, 0, 10, 10);

    ctx.setGlobalAlpha(0.5);
    ctx.fillRect(10, 10, 10, 10);

    ctx.setGlobalAlpha(0.0);
    ctx.fillRect(20, 20, 10, 10);
  },
});

Deno.test({
  name: "GraphicsContext - fillRect with various positions and sizes",
  fn() {
    const ctx = new GraphicsContext(100, 100);

    // Normal rect
    ctx.fillRect(10, 10, 20, 20);

    // Rect at origin
    ctx.fillRect(0, 0, 10, 10);

    // Rect with negative position (outside canvas)
    ctx.fillRect(-5, -5, 10, 10);

    // Rect extending beyond canvas
    ctx.fillRect(90, 90, 20, 20);

    // Zero-size rect
    ctx.fillRect(50, 50, 0, 0);

    // Single pixel rect
    ctx.fillRect(50, 50, 1, 1);
  },
});

Deno.test({
  name: "GraphicsContext - strokeRect with various positions and sizes",
  fn() {
    const ctx = new GraphicsContext(100, 100);

    ctx.strokeRect(10, 10, 20, 20);
    ctx.strokeRect(0, 0, 100, 100);
    ctx.strokeRect(-10, -10, 20, 20);
    ctx.strokeRect(50, 50, 0, 0);
  },
});

Deno.test({
  name: "GraphicsContext - clearRect",
  fn() {
    const ctx = new GraphicsContext(100, 100);

    ctx.fillRect(0, 0, 100, 100);
    ctx.clearRect(10, 10, 80, 80);
    ctx.clearRect(0, 0, 100, 100);
  },
});

Deno.test({
  name: "GraphicsContext - fillText",
  fn() {
    const ctx = new GraphicsContext(200, 100);

    ctx.setFont("16px Arial");
    ctx.fillText("Hello", 10, 20);
    ctx.fillText("World", 10, 40);

    // With max width
    ctx.fillText("Long text that should be constrained", 10, 60, 100);
  },
});

Deno.test({
  name: "GraphicsContext - fillText with special characters",
  fn() {
    const ctx = new GraphicsContext(200, 100);

    ctx.fillText("Hello 世界", 10, 20);
    ctx.fillText("Test 🌍 emoji", 10, 40);
    ctx.fillText("مرحبا Привет", 10, 60);
  },
});

Deno.test({
  name: "GraphicsContext - fillText with empty string",
  fn() {
    const ctx = new GraphicsContext(100, 100);

    // Should not throw
    ctx.fillText("", 10, 20);
  },
});

Deno.test({
  name: "GraphicsContext - strokeText",
  fn() {
    const ctx = new GraphicsContext(200, 100);

    ctx.setFont("16px Arial");
    ctx.strokeText("Outlined", 10, 20);
    ctx.strokeText("Text", 10, 40, 100);
  },
});

Deno.test({
  name: "GraphicsContext - measureText",
  fn() {
    const ctx = new GraphicsContext(100, 100);

    ctx.setFont("16px Arial");

    const width1 = ctx.measureText("Hello");
    assertExists(width1);
    assertEquals(typeof width1, "number");
    assertEquals(width1 > 0, true);

    const width2 = ctx.measureText("A");
    assertEquals(width2 > 0, true);

    // Longer text should be wider
    assertEquals(width1 > width2, true);
  },
});

Deno.test({
  name: "GraphicsContext - measureText with empty string",
  fn() {
    const ctx = new GraphicsContext(100, 100);

    const width = ctx.measureText("");
    assertEquals(width, 0);
  },
});

Deno.test({
  name: "GraphicsContext - measureText without canvas (stub)",
  fn() {
    const ctx = new GraphicsContext(100, 100);

    // In Deno environment, uses font-size-aware calculation
    // Default font is "10px sans-serif" → 10 * 0.6 * 5 = 30
    const width = ctx.measureText("Hello");
    assertEquals(width, 10 * 0.6 * 5);
  },
});

Deno.test({
  name: "GraphicsContext - path operations",
  fn() {
    const ctx = new GraphicsContext(100, 100);

    ctx.beginPath();
    ctx.moveTo(10, 10);
    ctx.lineTo(50, 50);
    ctx.lineTo(90, 10);
    ctx.closePath();
    ctx.stroke();
  },
});

Deno.test({
  name: "GraphicsContext - fill path",
  fn() {
    const ctx = new GraphicsContext(100, 100);

    ctx.beginPath();
    ctx.moveTo(50, 10);
    ctx.lineTo(90, 90);
    ctx.lineTo(10, 90);
    ctx.closePath();
    ctx.fill();
  },
});

Deno.test({
  name: "GraphicsContext - complex path with multiple segments",
  fn() {
    const ctx = new GraphicsContext(100, 100);

    ctx.beginPath();
    ctx.moveTo(10, 10);
    ctx.lineTo(20, 20);
    ctx.lineTo(30, 15);
    ctx.lineTo(40, 25);
    ctx.lineTo(50, 10);
    ctx.stroke();
  },
});

Deno.test({
  name: "GraphicsContext - clip",
  fn() {
    const ctx = new GraphicsContext(100, 100);

    ctx.beginPath();
    ctx.moveTo(10, 10);
    ctx.lineTo(90, 10);
    ctx.lineTo(90, 90);
    ctx.lineTo(10, 90);
    ctx.closePath();
    ctx.clip();

    // Drawing after clip
    ctx.fillRect(0, 0, 100, 100);
  },
});

Deno.test({
  name: "GraphicsContext - save and restore",
  fn() {
    const ctx = new GraphicsContext(100, 100);

    ctx.setFillStyle("#ff0000");
    ctx.setLineWidth(5);
    ctx.setFont("20px Arial");
    ctx.setGlobalAlpha(0.5);

    ctx.save();

    // Change state
    ctx.setFillStyle("#00ff00");
    ctx.setLineWidth(1);
    ctx.setFont("10px monospace");
    ctx.setGlobalAlpha(1.0);

    ctx.restore();

    // State should be restored (we can't directly test this without internal access)
    // But the operations should not throw
  },
});

Deno.test({
  name: "GraphicsContext - multiple save and restore",
  fn() {
    const ctx = new GraphicsContext(100, 100);

    ctx.save();
    ctx.setFillStyle("#ff0000");

    ctx.save();
    ctx.setFillStyle("#00ff00");

    ctx.save();
    ctx.setFillStyle("#0000ff");

    ctx.restore(); // Back to green
    ctx.restore(); // Back to red
    ctx.restore(); // Back to original
  },
});

Deno.test({
  name: "GraphicsContext - restore without save",
  fn() {
    const ctx = new GraphicsContext(100, 100);

    // Should not throw
    ctx.restore();
  },
});

Deno.test({
  name: "GraphicsContext - save and restore with path state",
  fn() {
    const ctx = new GraphicsContext(100, 100);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(10, 10);
    ctx.lineTo(50, 50);
    ctx.restore();

    // Can still draw
    ctx.fillRect(0, 0, 10, 10);
  },
});

Deno.test({
  name: "GraphicsContext - translate",
  fn() {
    const ctx = new GraphicsContext(100, 100);

    ctx.translate(50, 50);
    ctx.fillRect(0, 0, 10, 10); // Should draw at (50, 50)

    ctx.translate(-25, -25);
    ctx.fillRect(0, 0, 10, 10); // Should draw at (25, 25)
  },
});

Deno.test({
  name: "GraphicsContext - translate with negative values",
  fn() {
    const ctx = new GraphicsContext(100, 100);

    ctx.translate(-10, -10);
    ctx.fillRect(0, 0, 20, 20);
  },
});

Deno.test({
  name: "GraphicsContext - scale",
  fn() {
    const ctx = new GraphicsContext(100, 100);

    ctx.scale(2, 2);
    ctx.fillRect(0, 0, 10, 10); // Should draw 20x20 rect

    ctx.scale(0.5, 0.5);
    ctx.fillRect(0, 0, 10, 10); // Back to 10x10
  },
});

Deno.test({
  name: "GraphicsContext - scale with negative values (flip)",
  fn() {
    const ctx = new GraphicsContext(100, 100);

    ctx.scale(-1, 1); // Flip horizontally
    ctx.fillRect(-50, 25, 20, 20);

    ctx.scale(1, -1); // Flip back and vertically
    ctx.fillRect(-50, -75, 20, 20);
  },
});

Deno.test({
  name: "GraphicsContext - rotate",
  fn() {
    const ctx = new GraphicsContext(100, 100);

    ctx.rotate(Math.PI / 4); // 45 degrees
    ctx.fillRect(50, 0, 20, 20);

    ctx.rotate(-Math.PI / 4); // Rotate back
    ctx.fillRect(0, 50, 20, 20);
  },
});

Deno.test({
  name: "GraphicsContext - rotate full circle",
  fn() {
    const ctx = new GraphicsContext(100, 100);

    ctx.rotate(Math.PI * 2); // 360 degrees
    ctx.fillRect(50, 50, 10, 10);
  },
});

Deno.test({
  name: "GraphicsContext - combined transformations",
  fn() {
    const ctx = new GraphicsContext(100, 100);

    ctx.translate(50, 50);
    ctx.rotate(Math.PI / 6);
    ctx.scale(1.5, 1.5);

    ctx.fillRect(-10, -10, 20, 20);
  },
});

Deno.test({
  name: "GraphicsContext - save and restore with transformations",
  fn() {
    const ctx = new GraphicsContext(100, 100);

    ctx.save();
    ctx.translate(50, 50);
    ctx.scale(2, 2);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(0, 0, 10, 10);
    ctx.restore();

    // Transformations should be restored
    ctx.fillRect(0, 0, 10, 10);
  },
});

Deno.test({
  name: "GraphicsContext - getImageData",
  fn() {
    const ctx = new GraphicsContext(100, 100);

    const imageData = ctx.getImageData(0, 0, 50, 50);

    assertExists(imageData);
    assertEquals(imageData instanceof Uint8Array, true);
    // RGBA format: width * height * 4
    assertEquals(imageData.length, 50 * 50 * 4);
  },
});

Deno.test({
  name: "GraphicsContext - getImageData with various regions",
  fn() {
    const ctx = new GraphicsContext(100, 100);

    // Full canvas
    const data1 = ctx.getImageData(0, 0, 100, 100);
    assertEquals(data1.length, 100 * 100 * 4);

    // Partial region
    const data2 = ctx.getImageData(10, 10, 20, 20);
    assertEquals(data2.length, 20 * 20 * 4);

    // Single pixel
    const data3 = ctx.getImageData(50, 50, 1, 1);
    assertEquals(data3.length, 4); // RGBA
  },
});

Deno.test({
  name: "GraphicsContext - getImageData with zero dimensions",
  fn() {
    const ctx = new GraphicsContext(100, 100);

    const data = ctx.getImageData(0, 0, 0, 0);
    assertEquals(data.length, 0);
  },
});

Deno.test({
  name: "GraphicsContext - getDimensions",
  fn() {
    const ctx = new GraphicsContext(640, 480);

    const dims = ctx.getDimensions();

    assertEquals(dims.width, 640);
    assertEquals(dims.height, 480);
  },
});

Deno.test({
  name: "GraphicsContext - getDimensions is consistent",
  fn() {
    const ctx = new GraphicsContext(1920, 1080);

    const dims1 = ctx.getDimensions();
    const dims2 = ctx.getDimensions();

    assertEquals(dims1.width, dims2.width);
    assertEquals(dims1.height, dims2.height);
  },
});

Deno.test({
  name: "GraphicsContext - sequential drawing operations",
  fn() {
    const ctx = new GraphicsContext(200, 200);

    // Draw multiple shapes in sequence
    ctx.setFillStyle("#ff0000");
    ctx.fillRect(10, 10, 50, 50);

    ctx.setFillStyle("#00ff00");
    ctx.fillRect(70, 10, 50, 50);

    ctx.setFillStyle("#0000ff");
    ctx.fillRect(130, 10, 50, 50);

    ctx.setStrokeStyle("#000000");
    ctx.setLineWidth(2);
    ctx.strokeRect(5, 5, 190, 60);
  },
});

Deno.test({
  name: "GraphicsContext - path operations without close",
  fn() {
    const ctx = new GraphicsContext(100, 100);

    ctx.beginPath();
    ctx.moveTo(10, 10);
    ctx.lineTo(50, 50);
    ctx.lineTo(90, 10);
    // No closePath()
    ctx.stroke();
  },
});

Deno.test({
  name: "GraphicsContext - multiple beginPath calls",
  fn() {
    const ctx = new GraphicsContext(100, 100);

    ctx.beginPath();
    ctx.moveTo(10, 10);
    ctx.lineTo(50, 50);

    ctx.beginPath(); // Start new path
    ctx.moveTo(60, 60);
    ctx.lineTo(90, 90);

    ctx.stroke();
  },
});

Deno.test({
  name: "GraphicsContext - empty path operations",
  fn() {
    const ctx = new GraphicsContext(100, 100);

    ctx.beginPath();
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  },
});

Deno.test({
  name: "GraphicsContext - drawing with extreme coordinates",
  fn() {
    const ctx = new GraphicsContext(100, 100);

    // Very large coordinates
    ctx.fillRect(10000, 10000, 100, 100);

    // Very negative coordinates
    ctx.fillRect(-10000, -10000, 100, 100);

    // Mixed
    ctx.fillRect(-5000, 5000, 100, 100);
  },
});

Deno.test({
  name: "GraphicsContext - text at various positions",
  fn() {
    const ctx = new GraphicsContext(200, 200);

    ctx.fillText("Top-left", 0, 10);
    ctx.fillText("Center", 100, 100);
    ctx.fillText("Bottom-right", 150, 190);
    ctx.fillText("Negative", -50, 50);
  },
});

Deno.test({
  name: "GraphicsContext - setting same style multiple times",
  fn() {
    const ctx = new GraphicsContext(100, 100);

    ctx.setFillStyle("#ff0000");
    ctx.setFillStyle("#ff0000"); // Same color
    ctx.setFillStyle("#ff0000"); // Again

    ctx.fillRect(10, 10, 20, 20);
  },
});

Deno.test({
  name: "GraphicsContext - rapid state changes",
  fn() {
    const ctx = new GraphicsContext(100, 100);

    for (let i = 0; i < 100; i++) {
      ctx.setFillStyle(`#${(i * 2).toString(16).padStart(2, "0")}0000`);
      ctx.setGlobalAlpha(i / 100);
      ctx.fillRect(i % 10 * 10, Math.floor(i / 10) * 10, 10, 10);
    }
  },
});

// ============================================================
// New tests for headless software rasterization (Gap 17)
// ============================================================

Deno.test({
  name: "GraphicsContext - fillRect writes correct pixels to buffer",
  fn() {
    const ctx = new GraphicsContext(10, 10);

    ctx.setFillStyle("#ff0000");
    ctx.fillRect(0, 0, 2, 2);

    const data = ctx.getImageData(0, 0, 2, 2);
    // All 4 pixels should be red
    for (let i = 0; i < 4; i++) {
      assertEquals(data[i * 4], 255, `pixel ${i} R`);
      assertEquals(data[i * 4 + 1], 0, `pixel ${i} G`);
      assertEquals(data[i * 4 + 2], 0, `pixel ${i} B`);
      assertEquals(data[i * 4 + 3], 255, `pixel ${i} A`);
    }
  },
});

Deno.test({
  name: "GraphicsContext - clearRect zeros out pixels",
  fn() {
    const ctx = new GraphicsContext(10, 10);

    ctx.setFillStyle("#ff0000");
    ctx.fillRect(0, 0, 5, 5);
    ctx.clearRect(0, 0, 5, 5);

    const data = ctx.getImageData(0, 0, 5, 5);
    for (let i = 0; i < data.length; i++) {
      assertEquals(data[i], 0);
    }
  },
});

Deno.test({
  name: "GraphicsContext - strokeRect draws outline",
  fn() {
    const ctx = new GraphicsContext(20, 20);

    ctx.setStrokeStyle("#00ff00");
    ctx.strokeRect(2, 2, 10, 10);

    // Top edge pixel should be green (#00ff00 = 0,255,0)
    const topEdge = ctx.getImageData(5, 2, 1, 1);
    assertEquals(topEdge[0], 0);
    assertEquals(topEdge[1], 255);
    assertEquals(topEdge[2], 0);
    assertEquals(topEdge[3], 255);

    // Center should be empty
    const center = ctx.getImageData(7, 7, 1, 1);
    assertEquals(center[0], 0);
    assertEquals(center[1], 0);
    assertEquals(center[2], 0);
    assertEquals(center[3], 0);
  },
});

Deno.test({
  name: "GraphicsContext - fillText renders non-zero pixels",
  fn() {
    const ctx = new GraphicsContext(100, 50);

    ctx.setFillStyle("#ffffff");
    ctx.setFont("16px Arial");
    ctx.fillText("A", 5, 30);

    const data = ctx.getImageData(0, 0, 100, 50);
    // At least some pixels should be non-zero
    let nonZero = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 0 || data[i + 1] > 0 || data[i + 2] > 0) {
        nonZero++;
      }
    }
    assertEquals(nonZero > 0, true, "fillText should produce non-zero pixels");
  },
});

Deno.test({
  name: "GraphicsContext - measureText returns font-size-aware values",
  fn() {
    const ctx = new GraphicsContext(100, 100);

    ctx.setFont("16px Arial");
    const w16 = ctx.measureText("Hello");
    assertEquals(w16, 16 * 0.6 * 5); // 48

    ctx.setFont("32px Arial");
    const w32 = ctx.measureText("Hello");
    assertEquals(w32, 32 * 0.6 * 5); // 96

    // Larger font = wider text
    assertEquals(w32 > w16, true);
  },
});

Deno.test({
  name: "GraphicsContext - color parsing #hex",
  fn() {
    const ctx = new GraphicsContext(10, 10);

    // #rrggbb
    ctx.setFillStyle("#ff8000");
    ctx.fillRect(0, 0, 1, 1);
    let px = ctx.getImageData(0, 0, 1, 1);
    assertEquals(px[0], 255);
    assertEquals(px[1], 128);
    assertEquals(px[2], 0);
    assertEquals(px[3], 255);

    // #rgb shorthand
    ctx.setFillStyle("#f00");
    ctx.fillRect(1, 0, 1, 1);
    px = ctx.getImageData(1, 0, 1, 1);
    assertEquals(px[0], 255);
    assertEquals(px[1], 0);
    assertEquals(px[2], 0);
    assertEquals(px[3], 255);
  },
});

Deno.test({
  name: "GraphicsContext - color parsing rgb() and rgba()",
  fn() {
    const ctx = new GraphicsContext(10, 10);

    ctx.setFillStyle("rgb(100, 200, 50)");
    ctx.fillRect(0, 0, 1, 1);
    let px = ctx.getImageData(0, 0, 1, 1);
    assertEquals(px[0], 100);
    assertEquals(px[1], 200);
    assertEquals(px[2], 50);
    assertEquals(px[3], 255);

    ctx.setFillStyle("rgba(100, 200, 50, 0.5)");
    ctx.setGlobalAlpha(1.0);
    // Clear first
    ctx.clearRect(1, 0, 1, 1);
    ctx.fillRect(1, 0, 1, 1);
    px = ctx.getImageData(1, 0, 1, 1);
    assertEquals(px[0], 100);
    assertEquals(px[1], 200);
    assertEquals(px[2], 50);
    // Alpha should be ~128 (0.5 * 255)
    assertEquals(px[3], 128);
  },
});

Deno.test({
  name: "GraphicsContext - color parsing named colors",
  fn() {
    const ctx = new GraphicsContext(10, 10);

    ctx.setFillStyle("red");
    ctx.fillRect(0, 0, 1, 1);
    let px = ctx.getImageData(0, 0, 1, 1);
    assertEquals(px[0], 255);
    assertEquals(px[1], 0);
    assertEquals(px[2], 0);

    ctx.setFillStyle("blue");
    ctx.fillRect(1, 0, 1, 1);
    px = ctx.getImageData(1, 0, 1, 1);
    assertEquals(px[0], 0);
    assertEquals(px[1], 0);
    assertEquals(px[2], 255);

    ctx.setFillStyle("white");
    ctx.fillRect(2, 0, 1, 1);
    px = ctx.getImageData(2, 0, 1, 1);
    assertEquals(px[0], 255);
    assertEquals(px[1], 255);
    assertEquals(px[2], 255);
  },
});

Deno.test({
  name: "GraphicsContext - getImageData returns drawn content not all-zeros",
  fn() {
    const ctx = new GraphicsContext(20, 20);

    ctx.setFillStyle("#abcdef");
    ctx.fillRect(0, 0, 20, 20);

    const data = ctx.getImageData(0, 0, 20, 20);
    // 0xAB = 171, 0xCD = 205, 0xEF = 239
    assertEquals(data[0], 0xAB);
    assertEquals(data[1], 0xCD);
    assertEquals(data[2], 0xEF);
    assertEquals(data[3], 255);
  },
});

Deno.test({
  name: "GraphicsContext - save/restore preserves fill style via drawing",
  fn() {
    const ctx = new GraphicsContext(10, 10);

    ctx.setFillStyle("#ff0000");
    ctx.save();
    ctx.setFillStyle("#0000ff");
    ctx.fillRect(0, 0, 1, 1); // blue
    ctx.restore();
    ctx.fillRect(1, 0, 1, 1); // should be red again

    const blue = ctx.getImageData(0, 0, 1, 1);
    assertEquals(blue[0], 0);
    assertEquals(blue[2], 255);

    const red = ctx.getImageData(1, 0, 1, 1);
    assertEquals(red[0], 255);
    assertEquals(red[2], 0);
  },
});

Deno.test({
  name: "GraphicsContext - translate affects drawing position",
  fn() {
    const ctx = new GraphicsContext(20, 20);

    ctx.translate(5, 5);
    ctx.setFillStyle("#ff0000");
    ctx.fillRect(0, 0, 2, 2);

    // Pixel at (0,0) should be empty
    const origin = ctx.getImageData(0, 0, 1, 1);
    assertEquals(origin[3], 0, "origin should be transparent");

    // Pixel at (5,5) should be red
    const translated = ctx.getImageData(5, 5, 1, 1);
    assertEquals(translated[0], 255, "translated pixel should be red");
    assertEquals(translated[3], 255);
  },
});

Deno.test({
  name: "GraphicsContext - save/restore preserves transform",
  fn() {
    const ctx = new GraphicsContext(20, 20);

    ctx.save();
    ctx.translate(10, 10);
    ctx.restore();

    // After restore, transform should be identity again
    ctx.setFillStyle("#ff0000");
    ctx.fillRect(0, 0, 1, 1);

    const px = ctx.getImageData(0, 0, 1, 1);
    assertEquals(px[0], 255, "pixel at origin should be red (transform restored)");
  },
});

Deno.test({
  name: "GraphicsContext - clip restricts drawing area",
  fn() {
    const ctx = new GraphicsContext(20, 20);

    // Clip to 5,5 -> 15,15
    ctx.beginPath();
    ctx.moveTo(5, 5);
    ctx.lineTo(15, 5);
    ctx.lineTo(15, 15);
    ctx.lineTo(5, 15);
    ctx.closePath();
    ctx.clip();

    // Fill entire canvas
    ctx.setFillStyle("#ff0000");
    ctx.fillRect(0, 0, 20, 20);

    // Pixel at (0,0) should be empty (clipped)
    const outside = ctx.getImageData(0, 0, 1, 1);
    assertEquals(outside[3], 0, "outside clip should be transparent");

    // Pixel at (10,10) should be red (inside clip)
    const inside = ctx.getImageData(10, 10, 1, 1);
    assertEquals(inside[0], 255, "inside clip should be red");
  },
});

Deno.test({
  name: "GraphicsContext - path stroke draws line pixels",
  fn() {
    const ctx = new GraphicsContext(20, 20);

    ctx.setStrokeStyle("#ff0000");
    ctx.beginPath();
    ctx.moveTo(0, 10);
    ctx.lineTo(19, 10);
    ctx.stroke();

    // Pixel on the horizontal line should be red
    const px = ctx.getImageData(10, 10, 1, 1);
    assertEquals(px[0], 255);
    assertEquals(px[3], 255);
  },
});

Deno.test({
  name: "GraphicsContext - path fill draws filled polygon",
  fn() {
    const ctx = new GraphicsContext(20, 20);

    ctx.setFillStyle("#00ff00");
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(19, 0);
    ctx.lineTo(19, 19);
    ctx.lineTo(0, 19);
    ctx.closePath();
    ctx.fill();

    // Center pixel should be green
    const px = ctx.getImageData(10, 10, 1, 1);
    assertEquals(px[1], 255);
    assertEquals(px[3], 255);
  },
});

Deno.test({
  name: "GraphicsContext - scale affects drawing",
  fn() {
    const ctx = new GraphicsContext(20, 20);

    ctx.scale(2, 2);
    ctx.setFillStyle("#ff0000");
    ctx.fillRect(0, 0, 5, 5); // Should fill 0,0 to 10,10

    // Pixel at (9,9) should be red (inside 2x scaled rect)
    const inside = ctx.getImageData(9, 9, 1, 1);
    assertEquals(inside[0], 255);

    // Pixel at (11,11) should be empty (outside 2x scaled rect)
    const outside = ctx.getImageData(11, 11, 1, 1);
    assertEquals(outside[3], 0);
  },
});

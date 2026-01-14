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

        // In Deno environment, should use stub approximation
        const width = ctx.measureText("Hello");
        assertEquals(width, 5 * 8); // 5 chars * 8 pixels
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

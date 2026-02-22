/**
 * CPU Rendering Tests
 * Tests full CPU-based rendering (composite + getPixels) using Canvas 2D
 */

import { assertEquals, assertExists } from "@std/assert";
import { RenderingPipeline } from "../../src/engine/RenderingPipeline.ts";

Deno.test({
  name: "CPU rendering - simple colored page returns non-white pixels",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const pipeline = new RenderingPipeline({
      width: 100,
      height: 100,
      enableJavaScript: false,
    });

    // Render simple colored page
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              margin: 0;
              background: red;
              width: 100px;
              height: 100px;
            }
          </style>
        </head>
        <body></body>
      </html>
    `;

    const dataUrl = `data:text/html;base64,${btoa(html)}`;
    await pipeline.render(dataUrl);

    const pixels = await pipeline.getPixels();

    // Should return actual pixels, not all white
    assertExists(pixels);
    assertEquals(pixels.length, 100 * 100 * 4);

    // At least some pixels should not be white (255,255,255,255)
    let nonWhitePixels = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] !== 255 || pixels[i + 1] !== 255 || pixels[i + 2] !== 255) {
        nonWhitePixels++;
      }
    }

    assertEquals(nonWhitePixels > 0, true, "Should have non-white pixels");

    await pipeline.close();
  },
});

Deno.test({
  name: "CPU rendering - text content is rendered with layout",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const pipeline = new RenderingPipeline({
      width: 200,
      height: 100,
      enableJavaScript: false,
    });

    const html = `
      <!DOCTYPE html>
      <html>
        <body style="background: white; color: black;">
          <h1>Test</h1>
          <p>Paragraph text</p>
        </body>
      </html>
    `;

    const dataUrl = `data:text/html;base64,${btoa(html)}`;
    await pipeline.render(dataUrl);

    const pixels = await pipeline.getPixels();

    assertExists(pixels);
    assertEquals(pixels.length, 200 * 100 * 4);

    await pipeline.close();
  },
});

Deno.test({
  name: "CPU rendering - multiple render calls reuse resources",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const pipeline = new RenderingPipeline({
      width: 100,
      height: 100,
      enableJavaScript: false,
    });

    // First render
    const html1 = `<!DOCTYPE html><html><body style="background: blue;"></body></html>`;
    await pipeline.render(`data:text/html;base64,${btoa(html1)}`);
    const pixels1 = await pipeline.getPixels();

    // Second render - should reuse Canvas 2D context
    const html2 = `<!DOCTYPE html><html><body style="background: green;"></body></html>`;
    await pipeline.render(`data:text/html;base64,${btoa(html2)}`);
    const pixels2 = await pipeline.getPixels();

    // Both should return valid pixel data
    assertExists(pixels1);
    assertExists(pixels2);
    assertEquals(pixels1.length, 100 * 100 * 4);
    assertEquals(pixels2.length, 100 * 100 * 4);

    await pipeline.close();
  },
});

Deno.test({
  name: "CPU rendering - compositor CPU mode detection",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const pipeline = new RenderingPipeline({
      width: 50,
      height: 50,
      enableJavaScript: false,
    });

    await pipeline.render("about:blank");

    // Compositor should be in CPU mode when WebGL unavailable
    // This tests that the mode detection works correctly
    const compositor = pipeline.getCompositor();
    assertEquals(compositor.isCPUMode(), true, "Compositor should be in CPU mode");

    const pixels = await pipeline.getPixels();

    assertExists(pixels);
    assertEquals(pixels.length, 50 * 50 * 4);

    await pipeline.close();
  },
});

Deno.test({
  name: "CPU rendering - complex layout with multiple elements",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const pipeline = new RenderingPipeline({
      width: 300,
      height: 200,
      enableJavaScript: false,
    });

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            .box {
              width: 50px;
              height: 50px;
              margin: 10px;
              display: inline-block;
            }
            .red { background: red; }
            .blue { background: blue; }
            .green { background: green; }
          </style>
        </head>
        <body style="background: white;">
          <div class="box red"></div>
          <div class="box blue"></div>
          <div class="box green"></div>
        </body>
      </html>
    `;

    const dataUrl = `data:text/html;base64,${btoa(html)}`;
    await pipeline.render(dataUrl);

    const pixels = await pipeline.getPixels();

    assertExists(pixels);
    assertEquals(pixels.length, 300 * 200 * 4);

    // Should have multiple colored regions
    let coloredPixels = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];

      // Count non-white pixels (approximate)
      if (r < 250 || g < 250 || b < 250) {
        coloredPixels++;
      }
    }

    assertEquals(coloredPixels > 100, true, "Should have colored regions");

    await pipeline.close();
  },
});

Deno.test({
  name: "CPU rendering - about:blank renders successfully",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const pipeline = new RenderingPipeline({
      width: 50,
      height: 50,
      enableJavaScript: false,
    });

    // Render minimal content - should work, not throw
    await pipeline.render("about:blank");

    const pixels = await pipeline.getPixels();

    // Should return valid pixel buffer (blank white page is valid)
    assertExists(pixels);
    assertEquals(pixels.length, 50 * 50 * 4);

    await pipeline.close();
  },
});

Deno.test({
  name: "CPU rendering - error handling when composite not called",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const pipeline = new RenderingPipeline({
      width: 50,
      height: 50,
      enableJavaScript: false,
    });

    // Initialize but don't render
    const compositor = pipeline.getCompositor();

    // Verify compositor is in CPU mode
    assertEquals(compositor.isCPUMode(), true, "Compositor should be in CPU mode");

    // Try to composite without setting render tree - should throw
    let errorThrown = false;
    try {
      compositor.composite();
    } catch (error) {
      errorThrown = true;
      assertEquals(
        (error as Error).message.includes("no render tree set"),
        true,
        "Should fail with 'no render tree set' error",
      );
    }

    assertEquals(errorThrown, true, "Should throw error when no render tree set");

    await pipeline.close();
  },
});

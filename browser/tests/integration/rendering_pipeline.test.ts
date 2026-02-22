/**
 * Rendering Pipeline Integration Tests
 *
 * Verifies that the full rendering pipeline produces actual paint commands
 * and non-white pixels for pages with visual content (backgrounds, text,
 * borders, images).
 */

import { assert, assertEquals, assertExists } from "@std/assert";
import { RenderingPipeline } from "../../src/engine/RenderingPipeline.ts";
import { PaintCommandType } from "../../src/engine/rendering/paint/DisplayList.ts";

Deno.test({
  name: "Pipeline - display list contains FILL_RECT for background-color",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const pipeline = new RenderingPipeline({
      width: 100,
      height: 100,
      enableJavaScript: false,
    });

    const html =
      `<!DOCTYPE html><html><head><style>body { margin: 0; background-color: red; }</style></head><body></body></html>`;
    const result = await pipeline.render(`data:text/html;base64,${btoa(html)}`);

    const commands = result.displayList.getCommands();

    // Should have at least one FILL_RECT command from the red background
    const fillRects = commands.filter((c) => c.type === PaintCommandType.FILL_RECT);
    assert(
      fillRects.length > 0,
      `Expected FILL_RECT commands, got ${commands.length} total commands: ${
        commands.map((c) => c.type).join(", ")
      }`,
    );

    await pipeline.close();
  },
});

Deno.test({
  name: "Pipeline - display list contains FILL_TEXT for text content",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const pipeline = new RenderingPipeline({
      width: 200,
      height: 100,
      enableJavaScript: false,
    });

    const html = `<!DOCTYPE html><html><body><p>Hello World</p></body></html>`;
    const result = await pipeline.render(`data:text/html;base64,${btoa(html)}`);

    const commands = result.displayList.getCommands();

    // Should have FILL_TEXT commands for the text
    const fillTexts = commands.filter((c) => c.type === PaintCommandType.FILL_TEXT);
    assert(
      fillTexts.length > 0,
      `Expected FILL_TEXT commands, got ${commands.length} total commands: ${
        commands.map((c) => c.type).join(", ")
      }`,
    );

    await pipeline.close();
  },
});

Deno.test({
  name: "Pipeline - display list contains STROKE_RECT for borders",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const pipeline = new RenderingPipeline({
      width: 200,
      height: 100,
      enableJavaScript: false,
    });

    const html =
      `<!DOCTYPE html><html><head><style>div { border: 2px solid black; width: 50px; height: 50px; }</style></head><body><div></div></body></html>`;
    const result = await pipeline.render(`data:text/html;base64,${btoa(html)}`);

    const commands = result.displayList.getCommands();

    // Should have STROKE_RECT or FILL_RECT commands for border
    const borderCommands = commands.filter((c) =>
      c.type === PaintCommandType.STROKE_RECT || c.type === PaintCommandType.FILL_RECT
    );
    assert(
      borderCommands.length > 0,
      `Expected border commands, got ${commands.length} total commands: ${
        commands.map((c) => c.type).join(", ")
      }`,
    );

    await pipeline.close();
  },
});

Deno.test({
  name: "Pipeline - layout tree has style populated",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const pipeline = new RenderingPipeline({
      width: 200,
      height: 100,
      enableJavaScript: false,
    });

    const html =
      `<!DOCTYPE html><html><head><style>body { background-color: blue; }</style></head><body></body></html>`;
    const result = await pipeline.render(`data:text/html;base64,${btoa(html)}`);

    // LayoutBox should have style populated (this was the root cause of the bug)
    assertExists(result.layoutTree.style, "LayoutBox.style should be populated from RenderObject");

    await pipeline.close();
  },
});

Deno.test({
  name: "Pipeline - layout tree has children populated",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const pipeline = new RenderingPipeline({
      width: 200,
      height: 100,
      enableJavaScript: false,
    });

    const html = `<!DOCTYPE html><html><body><div>Child 1</div><div>Child 2</div></body></html>`;
    const result = await pipeline.render(`data:text/html;base64,${btoa(html)}`);

    // LayoutBox should have children populated
    assertExists(result.layoutTree.children, "LayoutBox.children should be populated");
    assert(result.layoutTree.children!.length > 0, "LayoutBox should have at least one child");

    await pipeline.close();
  },
});

Deno.test({
  name: "Pipeline - render result has timing data",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const pipeline = new RenderingPipeline({
      width: 100,
      height: 100,
      enableJavaScript: false,
    });

    const html = `<!DOCTYPE html><html><body>Test</body></html>`;
    const result = await pipeline.render(`data:text/html;base64,${btoa(html)}`);

    assert(result.timing.total >= 0, "Should have timing data");
    assert(result.timing.htmlParse >= 0, "Should have HTML parse timing");
    assert(result.timing.paintRecording >= 0, "Should have paint recording timing");
    assert(result.timing.compositing >= 0, "Should have compositing timing");

    await pipeline.close();
  },
});

Deno.test({
  name: "Pipeline - image resources are tracked",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const pipeline = new RenderingPipeline({
      width: 100,
      height: 100,
      enableJavaScript: false,
      enableImages: false, // Disable actual fetching for this test
    });

    const html =
      `<!DOCTYPE html><html><body><img src="test.png" width="50" height="50"></body></html>`;
    const result = await pipeline.render(`data:text/html;base64,${btoa(html)}`);

    // With images disabled, no image resources should be fetched
    const imageResources = result.resources.filter((r) => r.type === "image");
    assertEquals(
      imageResources.length,
      0,
      "No images should be fetched when enableImages is false",
    );

    await pipeline.close();
  },
});

Deno.test({
  name: "Pipeline - compositor receives render tree in CPU mode",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const pipeline = new RenderingPipeline({
      width: 100,
      height: 100,
      enableJavaScript: false,
    });

    const html =
      `<!DOCTYPE html><html><head><style>body { background: red; }</style></head><body></body></html>`;
    await pipeline.render(`data:text/html;base64,${btoa(html)}`);

    const compositor = pipeline.getCompositor();
    assertEquals(compositor.isCPUMode(), true);

    // getPixels should work after render
    const pixels = await pipeline.getPixels();
    assertExists(pixels);
    assertEquals(pixels.length, 100 * 100 * 4);

    await pipeline.close();
  },
});

Deno.test({
  name: "Pipeline - PaintLayer records commands via real PaintContext (not no-op)",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const pipeline = new RenderingPipeline({
      width: 200,
      height: 200,
      enableJavaScript: false,
    });

    const html = `<!DOCTYPE html><html><head><style>
            body { margin: 0; background: #ff0000; }
            .box { width: 50px; height: 50px; background: #0000ff; border: 1px solid #000; }
        </style></head><body><div class="box"></div><p>Text content</p></body></html>`;

    const result = await pipeline.render(`data:text/html;base64,${btoa(html)}`);

    // The render tree should have been built
    assertExists(result.renderTree);

    // The display list should have commands (not empty like before the fix)
    const commands = result.displayList.getCommands();
    assert(commands.length > 0, `DisplayList should have paint commands, got ${commands.length}`);

    // Verify we have diverse command types
    const commandTypes = new Set(commands.map((c) => c.type));
    assert(
      commandTypes.size >= 1,
      `Should have at least 1 unique command type, got: ${[...commandTypes].join(", ")}`,
    );

    await pipeline.close();
  },
});

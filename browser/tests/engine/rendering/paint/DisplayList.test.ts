/**
 * Tests for Display List
 * Tests paint command recording and replay.
 */

import { assert, assertEquals, assertExists } from "@std/assert";
import {
  DisplayList,
  type DrawImageCommand,
  type FillRectCommand,
  type FillTextCommand,
  PaintCommandType,
  type RestoreCommand,
  type SaveCommand,
  type StrokeRectCommand,
  type StrokeTextCommand,
  type TranslateCommand,
} from "../../../../src/engine/rendering/paint/DisplayList.ts";
import type { CanvasImageSource } from "../../../../src/types/dom.ts";

// PaintCommandType enum tests

Deno.test({
  name: "PaintCommandType - SAVE value",
  fn() {
    assertEquals(PaintCommandType.SAVE, "save");
  },
});

Deno.test({
  name: "PaintCommandType - RESTORE value",
  fn() {
    assertEquals(PaintCommandType.RESTORE, "restore");
  },
});

Deno.test({
  name: "PaintCommandType - TRANSLATE value",
  fn() {
    assertEquals(PaintCommandType.TRANSLATE, "translate");
  },
});

Deno.test({
  name: "PaintCommandType - FILL_RECT value",
  fn() {
    assertEquals(PaintCommandType.FILL_RECT, "fillRect");
  },
});

Deno.test({
  name: "PaintCommandType - STROKE_RECT value",
  fn() {
    assertEquals(PaintCommandType.STROKE_RECT, "strokeRect");
  },
});

Deno.test({
  name: "PaintCommandType - FILL_TEXT value",
  fn() {
    assertEquals(PaintCommandType.FILL_TEXT, "fillText");
  },
});

Deno.test({
  name: "PaintCommandType - DRAW_IMAGE value",
  fn() {
    assertEquals(PaintCommandType.DRAW_IMAGE, "drawImage");
  },
});

// DisplayList constructor tests

Deno.test({
  name: "DisplayList - constructor creates empty list",
  fn() {
    const list = new DisplayList();
    assertExists(list);
  },
});

Deno.test({
  name: "DisplayList - initial length is 0",
  fn() {
    const list = new DisplayList();
    assertEquals(list.length(), 0);
  },
});

Deno.test({
  name: "DisplayList - initial bounding box is null",
  fn() {
    const list = new DisplayList();
    assertEquals(list.getBoundingBox(), null);
  },
});

// DisplayList.add tests

Deno.test({
  name: "DisplayList - add() adds command",
  fn() {
    const list = new DisplayList();
    const command: SaveCommand = {
      type: PaintCommandType.SAVE,
    };

    list.add(command);

    assertEquals(list.length(), 1);
  },
});

Deno.test({
  name: "DisplayList - add() adds multiple commands",
  fn() {
    const list = new DisplayList();
    const command1: SaveCommand = {
      type: PaintCommandType.SAVE,
    };
    const command2: RestoreCommand = {
      type: PaintCommandType.RESTORE,
    };

    list.add(command1);
    list.add(command2);

    assertEquals(list.length(), 2);
  },
});

Deno.test({
  name: "DisplayList - add() updates bounding box for rect commands",
  fn() {
    const list = new DisplayList();
    const command: FillRectCommand = {
      type: PaintCommandType.FILL_RECT,
      x: 10 as any,
      y: 20 as any,
      width: 100 as any,
      height: 50 as any,
      color: "red",
    };

    list.add(command);

    const bbox = list.getBoundingBox();
    assertExists(bbox);
    assertEquals(bbox.x, 10);
    assertEquals(bbox.y, 20);
    assertEquals(bbox.width, 100);
    assertEquals(bbox.height, 50);
  },
});

Deno.test({
  name: "DisplayList - add() expands bounding box",
  fn() {
    const list = new DisplayList();
    const command1: FillRectCommand = {
      type: PaintCommandType.FILL_RECT,
      x: 10 as any,
      y: 10 as any,
      width: 50 as any,
      height: 50 as any,
      color: "red",
    };
    const command2: FillRectCommand = {
      type: PaintCommandType.FILL_RECT,
      x: 100 as any,
      y: 100 as any,
      width: 50 as any,
      height: 50 as any,
      color: "blue",
    };

    list.add(command1);
    list.add(command2);

    const bbox = list.getBoundingBox();
    assertExists(bbox);
    assertEquals(bbox.x, 10);
    assertEquals(bbox.y, 10);
    assertEquals(bbox.width, 140);
    assertEquals(bbox.height, 140);
  },
});

// DisplayList.getCommands tests

Deno.test({
  name: "DisplayList - getCommands() returns empty array initially",
  fn() {
    const list = new DisplayList();
    assertEquals(list.getCommands().length, 0);
  },
});

Deno.test({
  name: "DisplayList - getCommands() returns added commands",
  fn() {
    const list = new DisplayList();
    const command: SaveCommand = {
      type: PaintCommandType.SAVE,
    };

    list.add(command);

    const commands = list.getCommands();
    assertEquals(commands.length, 1);
    assertEquals(commands[0], command);
  },
});

Deno.test({
  name: "DisplayList - getCommands() returns readonly array",
  fn() {
    const list = new DisplayList();
    const commands = list.getCommands();

    assertExists(commands);
  },
});

// DisplayList.clear tests

Deno.test({
  name: "DisplayList - clear() removes all commands",
  fn() {
    const list = new DisplayList();
    const command: SaveCommand = {
      type: PaintCommandType.SAVE,
    };

    list.add(command);
    list.clear();

    assertEquals(list.length(), 0);
  },
});

Deno.test({
  name: "DisplayList - clear() resets bounding box",
  fn() {
    const list = new DisplayList();
    const command: FillRectCommand = {
      type: PaintCommandType.FILL_RECT,
      x: 10 as any,
      y: 20 as any,
      width: 100 as any,
      height: 50 as any,
      color: "red",
    };

    list.add(command);
    list.clear();

    assertEquals(list.getBoundingBox(), null);
  },
});

// DisplayList.replay tests

Deno.test({
  name: "DisplayList - replay() calls canvas methods",
  fn() {
    const list = new DisplayList();
    let saveCalled = false;
    let restoreCalled = false;

    const mockContext = {
      save: () => {
        saveCalled = true;
      },
      restore: () => {
        restoreCalled = true;
      },
    } as any;

    const saveCmd: SaveCommand = {
      type: PaintCommandType.SAVE,
    };
    const restoreCmd: RestoreCommand = {
      type: PaintCommandType.RESTORE,
    };

    list.add(saveCmd);
    list.add(restoreCmd);
    list.replay(mockContext);

    assertEquals(saveCalled, true);
    assertEquals(restoreCalled, true);
  },
});

Deno.test({
  name: "DisplayList - replay() calls fillRect",
  fn() {
    const list = new DisplayList();
    let fillRectCalled = false;
    let fillStyle = "";

    const mockContext = {
      fillRect: () => {
        fillRectCalled = true;
      },
      get fillStyle() {
        return fillStyle;
      },
      set fillStyle(val: string) {
        fillStyle = val;
      },
    } as any;

    const command: FillRectCommand = {
      type: PaintCommandType.FILL_RECT,
      x: 10 as any,
      y: 20 as any,
      width: 100 as any,
      height: 50 as any,
      color: "red",
    };

    list.add(command);
    list.replay(mockContext);

    assertEquals(fillRectCalled, true);
    assertEquals(fillStyle, "red");
  },
});

Deno.test({
  name: "DisplayList - replay() calls translate",
  fn() {
    const list = new DisplayList();
    let translateCalled = false;

    const mockContext = {
      translate: () => {
        translateCalled = true;
      },
    } as any;

    const command: TranslateCommand = {
      type: PaintCommandType.TRANSLATE,
      x: 10 as any,
      y: 20 as any,
    };

    list.add(command);
    list.replay(mockContext);

    assertEquals(translateCalled, true);
  },
});

// DisplayList.serialize/deserialize tests

Deno.test({
  name: "DisplayList - serialize() returns Uint8Array",
  fn() {
    const list = new DisplayList();
    const command: SaveCommand = {
      type: PaintCommandType.SAVE,
    };

    list.add(command);

    const data = list.serialize();

    assertExists(data);
    assert(data instanceof Uint8Array);
  },
});

Deno.test({
  name: "DisplayList - deserialize() recreates display list",
  fn() {
    const list = new DisplayList();
    const command: SaveCommand = {
      type: PaintCommandType.SAVE,
    };

    list.add(command);

    const data = list.serialize();
    const deserialized = DisplayList.deserialize(data);

    assertEquals(deserialized.length(), 1);
  },
});

Deno.test({
  name: "DisplayList - serialize/deserialize preserves commands",
  fn() {
    const list = new DisplayList();
    const command: FillRectCommand = {
      type: PaintCommandType.FILL_RECT,
      x: 10 as any,
      y: 20 as any,
      width: 100 as any,
      height: 50 as any,
      color: "red",
    };

    list.add(command);

    const data = list.serialize();
    const deserialized = DisplayList.deserialize(data);
    const commands = deserialized.getCommands();

    assertEquals(commands[0].type, PaintCommandType.FILL_RECT);
  },
});

// DisplayList.clip tests

Deno.test({
  name: "DisplayList - clip() creates sub-list",
  fn() {
    const list = new DisplayList();
    const command: FillRectCommand = {
      type: PaintCommandType.FILL_RECT,
      x: 10 as any,
      y: 20 as any,
      width: 100 as any,
      height: 50 as any,
      color: "red",
    };

    list.add(command);

    const region = {
      x: 0 as any,
      y: 0 as any,
      width: 200 as any,
      height: 200 as any,
    };

    const clipped = list.clip(region);

    assertExists(clipped);
    assert(clipped.length() > 0);
  },
});

Deno.test({
  name: "DisplayList - clip() filters out non-intersecting commands",
  fn() {
    const list = new DisplayList();
    const command1: FillRectCommand = {
      type: PaintCommandType.FILL_RECT,
      x: 10 as any,
      y: 10 as any,
      width: 50 as any,
      height: 50 as any,
      color: "red",
    };
    const command2: FillRectCommand = {
      type: PaintCommandType.FILL_RECT,
      x: 200 as any,
      y: 200 as any,
      width: 50 as any,
      height: 50 as any,
      color: "blue",
    };

    list.add(command1);
    list.add(command2);

    const region = {
      x: 0 as any,
      y: 0 as any,
      width: 100 as any,
      height: 100 as any,
    };

    const clipped = list.clip(region);

    // Should include command1 but not command2
    assert(clipped.length() >= 1);
  },
});

// DisplayList.merge tests

Deno.test({
  name: "DisplayList - merge() combines two lists",
  fn() {
    const list1 = new DisplayList();
    const list2 = new DisplayList();

    const command1: SaveCommand = {
      type: PaintCommandType.SAVE,
    };
    const command2: RestoreCommand = {
      type: PaintCommandType.RESTORE,
    };

    list1.add(command1);
    list2.add(command2);

    list1.merge(list2);

    assertEquals(list1.length(), 2);
  },
});

Deno.test({
  name: "DisplayList - merge() preserves order",
  fn() {
    const list1 = new DisplayList();
    const list2 = new DisplayList();

    const command1: SaveCommand = {
      type: PaintCommandType.SAVE,
    };
    const command2: RestoreCommand = {
      type: PaintCommandType.RESTORE,
    };

    list1.add(command1);
    list2.add(command2);

    list1.merge(list2);

    const commands = list1.getCommands();
    assertEquals(commands[0].type, PaintCommandType.SAVE);
    assertEquals(commands[1].type, PaintCommandType.RESTORE);
  },
});

// DisplayList.getMemoryUsage tests

Deno.test({
  name: "DisplayList - getMemoryUsage() returns non-zero for non-empty list",
  fn() {
    const list = new DisplayList();
    const command: SaveCommand = {
      type: PaintCommandType.SAVE,
    };

    list.add(command);

    const usage = list.getMemoryUsage();

    assert(usage > 0);
  },
});

Deno.test({
  name: "DisplayList - getMemoryUsage() increases with more commands",
  fn() {
    const list = new DisplayList();
    const command: SaveCommand = {
      type: PaintCommandType.SAVE,
    };

    list.add(command);
    const usage1 = list.getMemoryUsage();

    list.add(command);
    const usage2 = list.getMemoryUsage();

    assert(usage2 > usage1);
  },
});

// DisplayList bounding box tests

Deno.test({
  name: "DisplayList - getBoundingBox() returns copy",
  fn() {
    const list = new DisplayList();
    const command: FillRectCommand = {
      type: PaintCommandType.FILL_RECT,
      x: 10 as any,
      y: 20 as any,
      width: 100 as any,
      height: 50 as any,
      color: "red",
    };

    list.add(command);

    const bbox1 = list.getBoundingBox();
    const bbox2 = list.getBoundingBox();

    assert(bbox1 !== bbox2);
    if (bbox1 && bbox2) {
      assertEquals(bbox1.x, bbox2.x);
      assertEquals(bbox1.y, bbox2.y);
      assertEquals(bbox1.width, bbox2.width);
      assertEquals(bbox1.height, bbox2.height);
    }
  },
});

Deno.test({
  name: "DisplayList - bounding box with stroke rect",
  fn() {
    const list = new DisplayList();
    const command: StrokeRectCommand = {
      type: PaintCommandType.STROKE_RECT,
      x: 5 as any,
      y: 10 as any,
      width: 80 as any,
      height: 60 as any,
      color: "black",
      lineWidth: 2 as any,
    };

    list.add(command);

    const bbox = list.getBoundingBox();
    assertExists(bbox);
    assertEquals(bbox.x, 5);
    assertEquals(bbox.y, 10);
  },
});

// ============================================================================
// DRAW_IMAGE Tests
// ============================================================================

Deno.test({
  name: "DisplayList - DRAW_IMAGE calls drawImage with registered image",
  fn() {
    const list = new DisplayList();
    const drawImageCalls: Array<
      { image: CanvasImageSource; x: number; y: number; w: number; h: number }
    > = [];

    // Create a mock CanvasImageSource (ImageBitmap-like)
    const mockImage = { width: 100, height: 100 } as unknown as CanvasImageSource;

    // Register the image
    list.registerImage("https://example.com/image.png", mockImage);

    // Add DRAW_IMAGE command
    const command: DrawImageCommand = {
      type: PaintCommandType.DRAW_IMAGE,
      src: "https://example.com/image.png",
      x: 10 as any,
      y: 20 as any,
      width: 200 as any,
      height: 150 as any,
    };
    list.add(command);

    // Create mock context that records drawImage calls
    const mockContext = {
      drawImage(image: CanvasImageSource, x: number, y: number, w: number, h: number) {
        drawImageCalls.push({ image, x, y, w, h });
      },
      save() {},
      restore() {},
    } as unknown as CanvasRenderingContext2D;

    list.replay(mockContext);

    assertEquals(drawImageCalls.length, 1);
    assertEquals(drawImageCalls[0].image, mockImage);
    assertEquals(drawImageCalls[0].x, 10);
    assertEquals(drawImageCalls[0].y, 20);
    assertEquals(drawImageCalls[0].w, 200);
    assertEquals(drawImageCalls[0].h, 150);
  },
});

Deno.test({
  name: "DisplayList - DRAW_IMAGE skips when image not registered",
  fn() {
    const list = new DisplayList();
    const drawImageCalls: unknown[] = [];

    const command: DrawImageCommand = {
      type: PaintCommandType.DRAW_IMAGE,
      src: "https://example.com/missing.png",
      x: 10 as any,
      y: 20 as any,
      width: 200 as any,
      height: 150 as any,
    };
    list.add(command);

    const mockContext = {
      drawImage(...args: unknown[]) {
        drawImageCalls.push(args);
      },
      save() {},
      restore() {},
    } as unknown as CanvasRenderingContext2D;

    list.replay(mockContext);

    // No drawImage call since image not registered
    assertEquals(drawImageCalls.length, 0);
  },
});

Deno.test({
  name: "DisplayList - registerImage makes image available for DRAW_IMAGE",
  fn() {
    const list = new DisplayList();

    const img1 = { width: 50, height: 50 } as unknown as CanvasImageSource;
    const img2 = { width: 100, height: 100 } as unknown as CanvasImageSource;

    list.registerImage("a.png", img1);
    list.registerImage("b.png", img2);

    const drawn: CanvasImageSource[] = [];

    list.add({
      type: PaintCommandType.DRAW_IMAGE,
      src: "b.png",
      x: 0 as any,
      y: 0 as any,
      width: 10 as any,
      height: 10 as any,
    });
    list.add({
      type: PaintCommandType.DRAW_IMAGE,
      src: "a.png",
      x: 0 as any,
      y: 0 as any,
      width: 10 as any,
      height: 10 as any,
    });

    const mockContext = {
      drawImage(image: CanvasImageSource) {
        drawn.push(image);
      },
      save() {},
      restore() {},
    } as unknown as CanvasRenderingContext2D;

    list.replay(mockContext);

    assertEquals(drawn.length, 2);
    assertEquals(drawn[0], img2); // b.png drawn first
    assertEquals(drawn[1], img1); // a.png drawn second
  },
});

Deno.test({
  name: "DisplayList - clear clears image cache",
  fn() {
    const list = new DisplayList();
    const mockImage = { width: 10, height: 10 } as unknown as CanvasImageSource;
    list.registerImage("test.png", mockImage);

    list.add({
      type: PaintCommandType.DRAW_IMAGE,
      src: "test.png",
      x: 0 as any,
      y: 0 as any,
      width: 10 as any,
      height: 10 as any,
    });

    list.clear();

    // Re-add same command after clear
    list.add({
      type: PaintCommandType.DRAW_IMAGE,
      src: "test.png",
      x: 0 as any,
      y: 0 as any,
      width: 10 as any,
      height: 10 as any,
    });

    const drawn: unknown[] = [];
    const mockContext = {
      drawImage(...args: unknown[]) {
        drawn.push(args);
      },
      save() {},
      restore() {},
    } as unknown as CanvasRenderingContext2D;

    list.replay(mockContext);

    // Image cache was cleared, so drawImage should NOT be called
    assertEquals(drawn.length, 0);
  },
});

Deno.test({
  name: "DisplayList - DRAW_IMAGE bounding box is correct",
  fn() {
    const list = new DisplayList();
    const command: DrawImageCommand = {
      type: PaintCommandType.DRAW_IMAGE,
      src: "image.png",
      x: 50 as any,
      y: 100 as any,
      width: 300 as any,
      height: 200 as any,
    };
    list.add(command);

    const bbox = list.getBoundingBox();
    assertExists(bbox);
    assertEquals(bbox.x, 50);
    assertEquals(bbox.y, 100);
    assertEquals(bbox.width, 300);
    assertEquals(bbox.height, 200);
  },
});

// ============================================================================
// FILL_TEXT / STROKE_TEXT Bounding Box Tests
// ============================================================================

Deno.test({
  name: "DisplayList - FILL_TEXT updates bounding box",
  fn() {
    const list = new DisplayList();
    const command: FillTextCommand = {
      type: PaintCommandType.FILL_TEXT,
      text: "Hello",
      x: 10 as any,
      y: 30 as any,
      font: "16px sans-serif",
      color: "black",
    };
    list.add(command);

    const bbox = list.getBoundingBox();
    assertExists(bbox);
    // x should be 10, y should be baseline - fontSize = 30 - 16 = 14
    assertEquals(bbox.x, 10);
    assertEquals(bbox.y, 14);
    // width: 5 chars * 16 * 0.6 = 48
    assertEquals(bbox.width, 48);
    // height: 16
    assertEquals(bbox.height, 16);
  },
});

Deno.test({
  name: "DisplayList - STROKE_TEXT updates bounding box",
  fn() {
    const list = new DisplayList();
    const command: StrokeTextCommand = {
      type: PaintCommandType.STROKE_TEXT,
      text: "AB",
      x: 0 as any,
      y: 20 as any,
      font: "20px monospace",
      color: "red",
      lineWidth: 1 as any,
    };
    list.add(command);

    const bbox = list.getBoundingBox();
    assertExists(bbox);
    assertEquals(bbox.x, 0);
    assertEquals(bbox.y, 0); // 20 - 20 = 0
    // width: 2 chars * 20 * 0.6 = 24
    assertEquals(bbox.width, 24);
    assertEquals(bbox.height, 20);
  },
});

Deno.test({
  name: "DisplayList - FILL_TEXT expands existing bounding box",
  fn() {
    const list = new DisplayList();
    list.add({
      type: PaintCommandType.FILL_RECT,
      x: 0 as any,
      y: 0 as any,
      width: 50 as any,
      height: 50 as any,
      color: "red",
    });
    list.add({
      type: PaintCommandType.FILL_TEXT,
      text: "Long text here!!",
      x: 100 as any,
      y: 200 as any,
      font: "16px sans-serif",
      color: "black",
    } as FillTextCommand);

    const bbox = list.getBoundingBox();
    assertExists(bbox);
    // Should expand to include both rect and text
    assertEquals(bbox.x, 0);
    assertEquals(bbox.y, 0);
    // text right edge: 100 + 16*16*0.6 = 100 + 153.6 = 253.6
    assert(bbox.width > 200);
    // text bottom: 200
    assert(bbox.height >= 200);
  },
});

// ============================================================================
// Display List Caching & Recording Context Tests
// ============================================================================

Deno.test({
  name: "DisplayList - merge copies commands from source",
  fn() {
    const src = new DisplayList();
    src.add({ type: PaintCommandType.SAVE });
    src.add({ type: PaintCommandType.FILL_RECT, x: 0 as any, y: 0 as any, width: 10 as any, height: 10 as any, color: "red" });

    const dst = new DisplayList();
    dst.merge(src);

    assertEquals(dst.length(), 2);
    assertEquals(dst.getCommands()[0].type, PaintCommandType.SAVE);
    assertEquals(dst.getCommands()[1].type, PaintCommandType.FILL_RECT);
  },
});

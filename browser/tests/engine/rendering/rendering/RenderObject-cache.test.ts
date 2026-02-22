import { assertEquals } from "@std/assert";
import type { Pixels } from "../../../../src/types/identifiers.ts";
import type { ComputedStyle } from "../../../../src/types/css.ts";
import type { DOMElement } from "../../../../src/types/dom.ts";
import type {
  LayoutBox,
  LayoutConstraints,
  PaintContext,
} from "../../../../src/types/rendering.ts";
import { RenderObject } from "../../../../src/engine/rendering/rendering/RenderObject.ts";

// Concrete subclass for testing
class TestRenderObject extends RenderObject {
  doLayout(_constraints: LayoutConstraints): void {
    this.needsLayout = false;
  }
  paint(_context: PaintContext): void {
    this.needsPaint = false;
  }
  setPosition(x: Pixels, y: Pixels): void {
    if (!this.layout) {
      this.layout = { x, y, width: 0 as Pixels, height: 0 as Pixels } as LayoutBox;
    } else {
      this.layout.x = x;
      this.layout.y = y;
    }
  }
}

function createMockStyle(properties: Record<string, string>): ComputedStyle {
  const props = new Map(Object.entries(properties));
  return {
    getPropertyValue(name: string): string {
      return props.get(name) ?? "";
    },
    setProperty(name: string, value: string): void {
      props.set(name, value);
    },
  } as unknown as ComputedStyle;
}

function createMockElement(tagName = "div"): DOMElement {
  return {
    tagName,
    attributes: new Map(),
    children: [],
  } as unknown as DOMElement;
}

function createTestObject(properties: Record<string, string>, tagName = "div"): TestRenderObject {
  return new TestRenderObject(createMockElement(tagName), createMockStyle(properties));
}

Deno.test("RenderObject pixel value cache", async (t) => {
  await t.step("getPixelValue returns consistent results on repeated calls", () => {
    const obj = createTestObject({ width: "100px" });
    const first = obj.getPixelValue("width");
    const second = obj.getPixelValue("width");
    assertEquals(first, 100);
    assertEquals(second, 100);
  });

  await t.step("cached value is used on second call (same reference)", () => {
    let callCount = 0;
    const style = {
      getPropertyValue(name: string): string {
        if (name === "width") {
          callCount++;
          return "200px";
        }
        return "";
      },
    } as unknown as ComputedStyle;
    const obj = new TestRenderObject(createMockElement(), style);

    obj.getPixelValue("width");
    obj.getPixelValue("width");
    // Style was only queried once because cache hit on second call
    assertEquals(callCount, 1);
  });

  await t.step("markNeedsLayout clears the cache", () => {
    let callCount = 0;
    const style = {
      getPropertyValue(name: string): string {
        if (name === "width") {
          callCount++;
          return "150px";
        }
        return "";
      },
    } as unknown as ComputedStyle;
    const obj = new TestRenderObject(createMockElement(), style);

    obj.getPixelValue("width");
    assertEquals(callCount, 1);

    // Reset needsLayout so markNeedsLayout actually runs
    obj.needsLayout = false;
    obj.markNeedsLayout();

    obj.getPixelValue("width");
    assertEquals(callCount, 2); // cache was cleared, style queried again
  });

  await t.step("clearPixelValueCache invalidates cache", () => {
    let callCount = 0;
    const style = {
      getPropertyValue(name: string): string {
        if (name === "height") {
          callCount++;
          return "50px";
        }
        return "";
      },
    } as unknown as ComputedStyle;
    const obj = new TestRenderObject(createMockElement(), style);

    obj.getPixelValue("height");
    assertEquals(callCount, 1);

    obj.clearPixelValueCache();

    obj.getPixelValue("height");
    assertEquals(callCount, 2);
  });

  await t.step("different properties have independent cache entries", () => {
    const obj = createTestObject({ width: "100px", height: "200px" });
    assertEquals(obj.getPixelValue("width"), 100);
    assertEquals(obj.getPixelValue("height"), 200);
  });

  await t.step("percentage values recalculate after parent resize", () => {
    const parent = createTestObject({ width: "800px" });
    parent.layout = {
      x: 0 as Pixels,
      y: 0 as Pixels,
      width: 800 as Pixels,
      height: 600 as Pixels,
    } as LayoutBox;

    const child = createTestObject({ width: "50%" });
    parent.appendChild(child);

    assertEquals(child.getPixelValue("width"), 400);

    // Simulate parent resize
    child.needsLayout = false;
    child.markNeedsLayout();
    parent.layout.width = 1000 as Pixels;

    assertEquals(child.getPixelValue("width"), 500);
  });

  await t.step("auto and none values are not cached (return default)", () => {
    const obj = createTestObject({ width: "auto" });
    assertEquals(obj.getPixelValue("width"), 0);
    assertEquals(obj.getPixelValue("width", 42 as Pixels), 42);
  });

  await t.step("appendChild triggers markNeedsLayout which clears cache", () => {
    let callCount = 0;
    const style = {
      getPropertyValue(name: string): string {
        if (name === "width") {
          callCount++;
          return "300px";
        }
        return "";
      },
    } as unknown as ComputedStyle;
    const parent = new TestRenderObject(createMockElement(), style);
    parent.needsLayout = false;

    parent.getPixelValue("width");
    assertEquals(callCount, 1);

    const child = createTestObject({});
    parent.appendChild(child);

    parent.getPixelValue("width");
    assertEquals(callCount, 2); // cache cleared by appendChild -> markNeedsLayout
  });
});

import { assertEquals, assertExists } from "@std/assert";
import { DetailPanel } from "../../src/canvas/DetailPanel.ts";
import { CANVAS_LIGHT_THEME, CANVAS_DARK_THEME } from "../../src/canvas/themes.ts";
import type { StageNode } from "../../src/canvas/types.ts";

// ---------------------------------------------------------------------------
// Minimal DOM mock for Deno (no JSDOM dependency)
// ---------------------------------------------------------------------------

interface MockElement {
  tagName: string;
  innerHTML: string;
  textContent: string;
  style: Record<string, string>;
  _classList: Set<string>;
  _children: MockElement[];
  classList: {
    add(c: string): void;
    remove(c: string): void;
    contains(c: string): boolean;
  };
  appendChild(child: MockElement): MockElement;
}

function createMockElement(tag = "div"): MockElement {
  const children: MockElement[] = [];
  const classList = new Set<string>();
  const style: Record<string, string> = {};

  const el: MockElement = {
    tagName: tag.toUpperCase(),
    innerHTML: "",
    textContent: "",
    style,
    _classList: classList,
    _children: children,
    classList: {
      add(c: string) { classList.add(c); },
      remove(c: string) { classList.delete(c); },
      contains(c: string) { return classList.has(c); },
    },
    appendChild(child: MockElement): MockElement {
      children.push(child);
      return child;
    },
  };

  return el;
}

/** Install a minimal document.createElement mock into globalThis */
function installDocumentMock(): void {
  // deno-lint-ignore no-explicit-any
  (globalThis as any).document = {
    createElement(tag: string): MockElement {
      return createMockElement(tag);
    },
  };
}

installDocumentMock();

// ---------------------------------------------------------------------------
// Helper: build a minimal StageNode for tests
// ---------------------------------------------------------------------------

function makeStage(overrides: Partial<StageNode> = {}): StageNode {
  return {
    id: "stage-1",
    stage: "HTML Parse",
    pipeline: "rendering",
    status: "completed",
    timing: { startTime: 0, endTime: 50, duration: 50 },
    inputSummary: "raw HTML bytes",
    outputData: null,
    outputSummary: "document with 47 nodes",
    metrics: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test("DetailPanel - showStage adds 'visible' class to container", () => {
  const container = createMockElement();
  const panel = new DetailPanel(container as unknown as HTMLElement, CANVAS_LIGHT_THEME);

  panel.showStage(makeStage());

  assertEquals(container.classList.contains("visible"), true);
});

Deno.test("DetailPanel - hide removes 'visible' class and clears innerHTML", () => {
  const container = createMockElement();
  const panel = new DetailPanel(container as unknown as HTMLElement, CANVAS_LIGHT_THEME);

  panel.showStage(makeStage());
  assertEquals(container.classList.contains("visible"), true);

  panel.hide();

  assertEquals(container.classList.contains("visible"), false);
  assertEquals(container.innerHTML, "");
});

Deno.test("DetailPanel - selectedStageId returns the current stage ID after showStage", () => {
  const container = createMockElement();
  const panel = new DetailPanel(container as unknown as HTMLElement, CANVAS_LIGHT_THEME);

  panel.showStage(makeStage({ id: "stage-abc" }));

  assertEquals(panel.selectedStageId, "stage-abc");
});

Deno.test("DetailPanel - selectedStageId returns null after hide", () => {
  const container = createMockElement();
  const panel = new DetailPanel(container as unknown as HTMLElement, CANVAS_LIGHT_THEME);

  panel.showStage(makeStage({ id: "stage-xyz" }));
  assertExists(panel.selectedStageId);

  panel.hide();

  assertEquals(panel.selectedStageId, null);
});

Deno.test("DetailPanel - setTheme updates the theme used when applying panel styles", () => {
  const container = createMockElement();
  const panel = new DetailPanel(container as unknown as HTMLElement, CANVAS_LIGHT_THEME);

  // Switch to dark theme, then show a stage — container style should reflect dark panel bg.
  panel.setTheme(CANVAS_DARK_THEME);
  panel.showStage(makeStage());

  assertEquals(container.style.backgroundColor, CANVAS_DARK_THEME.panel.background);
  assertEquals(container.style.color, CANVAS_DARK_THEME.panel.text);
});

Deno.test("DetailPanel - HTML special characters in stage name are escaped in header", () => {
  const container = createMockElement();
  const panel = new DetailPanel(container as unknown as HTMLElement, CANVAS_LIGHT_THEME);

  // A stage name containing characters that must be HTML-escaped.
  const maliciousName = '<script>alert("xss")</script>';
  panel.showStage(makeStage({ stage: maliciousName }));

  // The container's innerHTML is set to "" at the start of showStage; after that,
  // children are appended via appendChild (not via innerHTML on container directly).
  // The header child's innerHTML is where the stage name lands — it must be escaped.
  const headerChild = container._children.find(
    (c) => c._children.some((inner) => {
      // The "left" span inside the header holds the escaped stage name.
      return inner.innerHTML !== undefined &&
        inner.innerHTML.includes("&lt;script&gt;");
    }),
  );
  assertExists(
    headerChild,
    "Header element must contain the escaped stage name (no raw <script> tags)",
  );
});

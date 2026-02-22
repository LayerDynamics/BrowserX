// Polyfill HTMLElement for Deno (GraphXCanvas extends it in the barrel export)
// Must be set before any module evaluation via dynamic imports
if (typeof globalThis.HTMLElement === "undefined") {
  (globalThis as Record<string, unknown>).HTMLElement = class HTMLElement {};
}
if (typeof globalThis.customElements === "undefined") {
  (globalThis as Record<string, unknown>).customElements = {
    define() {},
    get() {
      return undefined;
    },
  };
}

const { assert, assertEquals } = await import("@std/assert");
const { domTreeToGraph, domTreeAsSvg } = await import(
  "../../../../src/engine/rendering/graphs/dom-tree-graph.ts"
);
const { cssomToGraph, cssomAsSvg } = await import(
  "../../../../src/engine/rendering/graphs/cssom-graph.ts"
);
const { layoutTreeToGraph, layoutTreeAsSvg } = await import(
  "../../../../src/engine/rendering/graphs/layout-tree-graph.ts"
);
const { displayListToGraph, displayListAsSvg } = await import(
  "../../../../src/engine/rendering/graphs/display-list-graph.ts"
);

// --- DOM Tree Graph ---
Deno.test("domTreeToGraph - creates graph from DOM-like tree", () => {
  const dom = {
    nodeType: 1,
    tagName: "html",
    attributes: new Map([["id", "root"]]),
    childNodes: [
      { nodeType: 1, tagName: "head", childNodes: [] },
      {
        nodeType: 1,
        tagName: "body",
        childNodes: [
          {
            nodeType: 1,
            tagName: "div",
            childNodes: [
              { nodeType: 3, nodeName: "#text", childNodes: [] },
            ],
          },
        ],
      },
    ],
  };

  const graph = domTreeToGraph(dom);
  assertEquals(graph.nodeCount, 5);
  assertEquals(graph.edgeCount, 4);
});

Deno.test("domTreeAsSvg - returns SVG string", () => {
  const dom = { nodeType: 1, tagName: "div", childNodes: [] };
  const svg = domTreeAsSvg(dom);
  assert(svg.includes("<svg"), "Should contain <svg");
});

Deno.test("domTreeToGraph - handles null root", () => {
  const graph = domTreeToGraph(null);
  assertEquals(graph.nodeCount, 0);
});

// --- CSSOM Graph ---
Deno.test("cssomToGraph - creates graph from CSSOM-like structure", () => {
  const cssom = {
    stylesheets: [
      {
        origin: "author",
        rules: [
          {
            selector: "body",
            style: { color: "red", "font-size": "16px" },
          },
          { selector: "h1", style: { "font-weight": "bold" } },
        ],
      },
    ],
  };

  const graph = cssomToGraph(cssom);
  // root + 1 stylesheet + 2 rules + 3 declarations = 7
  assertEquals(graph.nodeCount, 7);
});

Deno.test("cssomAsSvg - returns SVG string", () => {
  const cssom = { stylesheets: [{ rules: [] }] };
  const svg = cssomAsSvg(cssom);
  assert(svg.includes("<svg"), "Should contain <svg");
});

// --- Layout Tree Graph ---
Deno.test("layoutTreeToGraph - creates graph from layout box tree", () => {
  const layout = {
    type: "block",
    x: 0,
    y: 0,
    width: 800,
    height: 600,
    children: [
      {
        type: "block",
        x: 0,
        y: 0,
        width: 800,
        height: 100,
        children: [],
      },
      {
        type: "text",
        x: 0,
        y: 100,
        width: 200,
        height: 20,
        text: "Hello",
        children: [],
      },
    ],
  };

  const graph = layoutTreeToGraph(layout);
  assertEquals(graph.nodeCount, 3);
  assertEquals(graph.edgeCount, 2);
});

Deno.test("layoutTreeAsSvg - returns SVG string", () => {
  const layout = { type: "block", x: 0, y: 0, width: 100, height: 100 };
  const svg = layoutTreeAsSvg(layout);
  assert(svg.includes("<svg"), "Should contain <svg");
});

// --- Display List Graph ---
Deno.test("displayListToGraph - creates linear chain from commands", () => {
  const displayList = {
    getCommands: () => [
      { type: "SAVE" },
      {
        type: "FILL_RECT",
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        color: "red",
      },
      {
        type: "FILL_TEXT",
        text: "Hello",
        x: 10,
        y: 20,
        font: "16px sans-serif",
        color: "black",
      },
      { type: "RESTORE" },
    ],
  };

  const graph = displayListToGraph(displayList);
  assertEquals(graph.nodeCount, 4);
  assertEquals(graph.edgeCount, 3);
});

Deno.test("displayListToGraph - handles commands array directly", () => {
  const displayList = {
    commands: [
      {
        type: "FILL_RECT",
        x: 0,
        y: 0,
        width: 50,
        height: 50,
        color: "blue",
      },
      {
        type: "DRAW_IMAGE",
        src: "https://example.com/img.png",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      },
    ],
  };

  const graph = displayListToGraph(displayList);
  assertEquals(graph.nodeCount, 2);
  assertEquals(graph.edgeCount, 1);
});

Deno.test("displayListAsSvg - returns SVG string", () => {
  const displayList = { commands: [{ type: "SAVE" }] };
  const svg = displayListAsSvg(displayList);
  assert(svg.includes("<svg"), "Should contain <svg");
});

Deno.test("displayListToGraph - empty display list", () => {
  const graph = displayListToGraph({ commands: [] });
  assertEquals(graph.nodeCount, 0);
  assertEquals(graph.edgeCount, 0);
});

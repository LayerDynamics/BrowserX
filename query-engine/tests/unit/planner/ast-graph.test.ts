// Polyfill HTMLElement for Deno (GraphXCanvas extends it in the barrel export)
if (typeof globalThis.HTMLElement === "undefined") {
  (globalThis as Record<string, unknown>).HTMLElement = class HTMLElement {};
}
if (typeof globalThis.customElements === "undefined") {
  (globalThis as Record<string, unknown>).customElements = {
    define() {},
    get() { return undefined; },
  };
}

const { assert, assertEquals } = await import("@std/assert");
const { astToGraph, astAsSvg } = await import(
  "../../../planner/ast-graph.ts"
);

Deno.test("astToGraph - creates graph from AST-like structure", () => {
  const ast = {
    type: "SELECT",
    columns: [
      { type: "column", value: "title" },
      { type: "column", value: "description" },
    ],
    from: { type: "source", value: "https://example.com" },
  };

  const graph = astToGraph(ast);
  assertEquals(graph.nodeCount, 4);
  assert(graph.edgeCount >= 3);
});

Deno.test("astAsSvg - returns SVG string", () => {
  const ast = {
    type: "SET",
    name: "x",
    value: { type: "literal", value: "1" },
  };
  const svg = astAsSvg(ast);
  assert(svg.includes("<svg"), "Should contain <svg");
});

Deno.test("astToGraph - handles null", () => {
  const graph = astToGraph(null);
  assertEquals(graph.nodeCount, 0);
});

import { assertEquals } from "@std/assert";
import { assertStringIncludes } from "@std/assert/string-includes";
import { domToGraph, renderDomAsSvg } from "../../domains/dom/dom-graph.ts";
import type { DOMNode } from "../../../browser/src/types/dom.ts";
import { DOMNodeType } from "../../../browser/src/types/dom.ts";

/** Create a minimal mock DOMNode for testing */
function mockNode(id: number, name: string, children: DOMNode[] = []): DOMNode {
  return {
    nodeId: id as unknown as import("../../../browser/src/types/identifiers.ts").NodeID,
    nodeType: DOMNodeType.ELEMENT,
    nodeName: name,
    nodeValue: null,
    parentNode: null,
    childNodes: children,
    firstChild: children[0] ?? null,
    lastChild: children[children.length - 1] ?? null,
    previousSibling: null,
    nextSibling: null,
    ownerDocument: null,
    cloneNode: () => mockNode(id, name),
    appendChild: (c: DOMNode) => c,
    removeChild: (c: DOMNode) => c,
    insertBefore: (n: DOMNode) => n,
    replaceChild: (n: DOMNode) => n,
    contains: () => false,
    compareDocumentPosition: () => 0,
  } as DOMNode;
}

Deno.test("domToGraph creates correct node and edge count for 3-node tree", () => {
  const child1 = mockNode(2, "SPAN");
  const child2 = mockNode(3, "P");
  const root = mockNode(1, "DIV", [child1, child2]);

  const graph = domToGraph(root);

  assertEquals(graph.nodeCount, 3);
  assertEquals(graph.edgeCount, 2);
});

Deno.test("domToGraph handles single node (no children)", () => {
  const root = mockNode(1, "DIV");
  const graph = domToGraph(root);

  assertEquals(graph.nodeCount, 1);
  assertEquals(graph.edgeCount, 0);
});

Deno.test("domToGraph handles nested tree", () => {
  const grandchild = mockNode(3, "A");
  const child = mockNode(2, "SPAN", [grandchild]);
  const root = mockNode(1, "DIV", [child]);

  const graph = domToGraph(root);

  assertEquals(graph.nodeCount, 3);
  assertEquals(graph.edgeCount, 2);
});

Deno.test("renderDomAsSvg returns valid SVG with expected elements", () => {
  const child1 = mockNode(2, "SPAN");
  const child2 = mockNode(3, "P");
  const root = mockNode(1, "DIV", [child1, child2]);

  const svg = renderDomAsSvg(root);

  assertStringIncludes(svg, "<svg");
  assertStringIncludes(svg, "</svg>");
  assertStringIncludes(svg, "DIV");
  assertStringIncludes(svg, "SPAN");
  assertStringIncludes(svg, "P");
});

Deno.test("renderDomAsSvg supports dark theme", () => {
  const root = mockNode(1, "DIV");
  const svg = renderDomAsSvg(root, { theme: "dark" });

  assertStringIncludes(svg, "<svg");
  assertStringIncludes(svg, "</svg>");
});

Deno.test("renderDomAsSvg supports LR direction", () => {
  const child = mockNode(2, "SPAN");
  const root = mockNode(1, "DIV", [child]);

  const svg = renderDomAsSvg(root, { direction: "LR" });

  assertStringIncludes(svg, "<svg");
});

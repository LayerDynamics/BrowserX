import { assertEquals, assert, assertStringIncludes } from "@std/assert";
import { SVGRenderer, render } from "../../src/svg/mod.ts";
import { Graph, DiGraph, GraphNode, GraphEdge } from "../../src/graph/mod.ts";
import { forceDirected } from "../../src/layout/mod.ts";
import { DEFAULT_LIGHT_THEME, DEFAULT_DARK_THEME } from "../../src/svg/mod.ts";

Deno.test("SVGRenderer - returns valid SVG string", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "Node A"));
  graph.addNode(new GraphNode("B", "Node B"));

  const layout = forceDirected(graph, { seed: 123, width: 400, height: 300 });
  const renderer = new SVGRenderer(graph, layout);
  const svg = renderer.render();

  assert(svg.startsWith("<svg"), "SVG should start with <svg tag");
  assert(svg.endsWith("</svg>"), "SVG should end with </svg> tag");
});

Deno.test("SVGRenderer - contains correct viewBox", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "Node A"));

  const width = 500;
  const height = 400;
  const layout = forceDirected(graph, { width, height, seed: 123 });
  const renderer = new SVGRenderer(graph, layout);
  const svg = renderer.render();

  assertStringIncludes(svg, `viewBox="0 0 ${width} ${height}"`);
  assertStringIncludes(svg, `width="${width}"`);
  assertStringIncludes(svg, `height="${height}"`);
});

Deno.test("SVGRenderer - contains background rect", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "Node A"));

  const layout = forceDirected(graph, { seed: 123 });
  const renderer = new SVGRenderer(graph, layout);
  const svg = renderer.render();

  assertStringIncludes(svg, "<rect");
  assertStringIncludes(svg, 'fill="#ffffff"'); // Default light theme background
});

Deno.test("SVGRenderer - contains nodes as circles", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "Node A"));
  graph.addNode(new GraphNode("B", "Node B"));

  const layout = forceDirected(graph, { seed: 123 });
  const renderer = new SVGRenderer(graph, layout);
  const svg = renderer.render();

  assertStringIncludes(svg, '<g id="nodes">');
  assertStringIncludes(svg, "<circle");
  // Should have 2 circles
  const circleCount = (svg.match(/<circle/g) || []).length;
  assertEquals(circleCount, 2, "Should have 2 circle elements");
});

Deno.test("SVGRenderer - contains edges as lines", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "Node A"));
  graph.addNode(new GraphNode("B", "Node B"));
  graph.addEdge(new GraphEdge("AB", "A", "B"));

  const layout = forceDirected(graph, { seed: 123 });
  const renderer = new SVGRenderer(graph, layout);
  const svg = renderer.render();

  assertStringIncludes(svg, '<g id="edges">');
  assertStringIncludes(svg, "<line");
  // Should have 1 line
  const lineCount = (svg.match(/<line/g) || []).length;
  assertEquals(lineCount, 1, "Should have 1 line element");
});

Deno.test("SVGRenderer - node labels rendered when showLabels=true", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "data", "Label A"));
  graph.addNode(new GraphNode("B", "data", "Label B"));

  const layout = forceDirected(graph, { seed: 123 });
  const renderer = new SVGRenderer(graph, layout, { showLabels: true });
  const svg = renderer.render();

  assertStringIncludes(svg, "Label A");
  assertStringIncludes(svg, "Label B");
});

Deno.test("SVGRenderer - node labels not rendered when showLabels=false", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "data", "Label A"));
  graph.addNode(new GraphNode("B", "data", "Label B"));

  const layout = forceDirected(graph, { seed: 123 });
  const renderer = new SVGRenderer(graph, layout, { showLabels: false });
  const svg = renderer.render();

  assert(!svg.includes("Label A"), "Label A should not appear when showLabels=false");
  assert(!svg.includes("Label B"), "Label B should not appear when showLabels=false");
});

Deno.test("SVGRenderer - directed edges have arrowheads", () => {
  const graph = new DiGraph<string, string>();
  graph.addNode(new GraphNode("A", "Node A"));
  graph.addNode(new GraphNode("B", "Node B"));
  graph.addEdge(new GraphEdge("AB", "A", "B"));

  const layout = forceDirected(graph, { seed: 123 });
  const renderer = new SVGRenderer(graph, layout, { directed: true });
  const svg = renderer.render();

  assertStringIncludes(svg, "<defs>");
  assertStringIncludes(svg, 'marker-end="url(#arrowhead-');
});

Deno.test("SVGRenderer - undirected edges have no arrowheads", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "Node A"));
  graph.addNode(new GraphNode("B", "Node B"));
  graph.addEdge(new GraphEdge("AB", "A", "B"));

  const layout = forceDirected(graph, { seed: 123 });
  const renderer = new SVGRenderer(graph, layout, { directed: false });
  const svg = renderer.render();

  assert(!svg.includes("<defs>"), "Should not have defs section for undirected graph");
  assert(!svg.includes("marker-end"), "Should not have marker-end attribute");
});

Deno.test("SVGRenderer - XML escaping works", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "data", "<Node> & \"Label\" with 'quotes'"));

  const layout = forceDirected(graph, { seed: 123 });
  const renderer = new SVGRenderer(graph, layout, { showLabels: true });
  const svg = renderer.render();

  assertStringIncludes(svg, "&lt;Node&gt;");
  assertStringIncludes(svg, "&amp;");
  assertStringIncludes(svg, "&quot;");
  assertStringIncludes(svg, "&apos;");
  assert(!svg.includes("<Node>"), "Angle brackets should be escaped");
});

Deno.test("SVGRenderer - custom theme applied", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "Node A"));

  const layout = forceDirected(graph, { seed: 123 });
  const renderer = new SVGRenderer(graph, layout, { theme: DEFAULT_DARK_THEME });
  const svg = renderer.render();

  // Check for dark theme colors
  assertStringIncludes(svg, DEFAULT_DARK_THEME.background);
  assertStringIncludes(svg, DEFAULT_DARK_THEME.node.fill);
  assertStringIncludes(svg, DEFAULT_DARK_THEME.node.stroke);
});

Deno.test("SVGRenderer - convenience render() function works", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "data", "Node A"));
  graph.addNode(new GraphNode("B", "data", "Node B"));

  const layout = forceDirected(graph, { seed: 123 });
  const svg = render(graph, layout, { showLabels: true });

  assert(svg.startsWith("<svg"), "render() should return valid SVG");
  assert(svg.endsWith("</svg>"), "render() should return complete SVG");
  assertStringIncludes(svg, "Node A");
  assertStringIncludes(svg, "Node B");
});

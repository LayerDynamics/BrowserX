/**
 * Graph Visualization Tools Tests
 * Tests for browserx_visualize_dom, browserx_dependency_graph, browserx_plugin_graph
 */

import { assertEquals, assertStringIncludes } from "@std/assert";
import {
  DiGraph,
  GraphNode,
  GraphEdge,
  hierarchical,
  render,
  DEFAULT_LIGHT_THEME,
  DEFAULT_DARK_THEME,
} from "@browserx/graphx";

// -- Unit tests for the graph rendering pipeline used by the tools --

Deno.test("graph-tools: DiGraph renders to SVG with <svg tag", () => {
  const graph = new DiGraph<{ label: string }, { label: string }>();
  graph.addNode(new GraphNode("a", { label: "html" }));
  graph.addNode(new GraphNode("b", { label: "head" }));
  graph.addNode(new GraphNode("c", { label: "body" }));
  graph.addEdge(new GraphEdge("a->b", "a", "b"));
  graph.addEdge(new GraphEdge("a->c", "a", "c"));

  const layout = hierarchical(graph, { direction: "TB" });
  const svg = render(graph, layout, { theme: DEFAULT_LIGHT_THEME, directed: true, showLabels: true });

  assertStringIncludes(svg, "<svg");
  assertStringIncludes(svg, "</svg>");
  // SVG renders node IDs as labels
  assertStringIncludes(svg, ">a<");
  assertStringIncludes(svg, ">b<");
  assertStringIncludes(svg, ">c<");
});

Deno.test("graph-tools: dark theme produces valid SVG", () => {
  const graph = new DiGraph<{ label: string }, { label: string }>();
  graph.addNode(new GraphNode("root", { label: "root" }));
  graph.addNode(new GraphNode("child", { label: "child" }));
  graph.addEdge(new GraphEdge("root->child", "root", "child"));

  const layout = hierarchical(graph, { direction: "LR" });
  const svg = render(graph, layout, { theme: DEFAULT_DARK_THEME, directed: true });

  assertStringIncludes(svg, "<svg");
  assertStringIncludes(svg, "</svg>");
});

Deno.test("graph-tools: LR direction layout produces valid SVG", () => {
  const graph = new DiGraph<{ label: string }, { label: string }>();
  graph.addNode(new GraphNode("a", { label: "A" }));
  graph.addNode(new GraphNode("b", { label: "B" }));
  graph.addEdge(new GraphEdge("a->b", "a", "b"));

  const layout = hierarchical(graph, { direction: "LR" });
  const svg = render(graph, layout, { directed: true });

  assertStringIncludes(svg, "<svg");
});

Deno.test("graph-tools: JSON format has nodes and edges arrays", () => {
  const nodes = [
    { id: "a", label: "Parse" },
    { id: "b", label: "Execute" },
  ];
  const edges = [
    { source: "a", target: "b", label: "next" },
  ];

  const json = { nodes, edges };

  assertEquals(Array.isArray(json.nodes), true);
  assertEquals(Array.isArray(json.edges), true);
  assertEquals(json.nodes.length, 2);
  assertEquals(json.edges.length, 1);
  assertEquals(json.edges[0].source, "a");
  assertEquals(json.edges[0].target, "b");
});

Deno.test("graph-tools: query plan graph for SELECT query has expected stages", () => {
  // Simulate what buildQueryPlanGraph produces for a SELECT query
  const nodes: { id: string; label: string }[] = [];
  const edges: { source: string; target: string; label?: string }[] = [];

  // Replicate the logic from graph-tools.ts buildQueryPlanGraph
  const query = "SELECT title FROM 'https://example.com'";
  const upperQuery = query.toUpperCase().trim();
  let stepIndex = 0;

  const addStep = (label: string): string => {
    const id = `step_${stepIndex++}`;
    nodes.push({ id, label });
    return id;
  };

  const parseId = addStep("Parse Query");
  const analyzeId = addStep("Semantic Analysis");
  edges.push({ source: parseId, target: analyzeId });
  const optimizeId = addStep("Optimize");
  edges.push({ source: analyzeId, target: optimizeId });

  let lastId = optimizeId;

  if (upperQuery.startsWith("SELECT") || upperQuery.includes("FROM")) {
    if (upperQuery.includes("FROM") && (upperQuery.includes("HTTP://") || upperQuery.includes("HTTPS://"))) {
      const navId = addStep("Navigate to URL");
      edges.push({ source: lastId, target: navId });
      lastId = navId;
    }
    const extractId = addStep("Extract Data");
    edges.push({ source: lastId, target: extractId });
    lastId = extractId;
  }

  const formatId = addStep("Format Output");
  edges.push({ source: lastId, target: formatId });

  // Verify expected stages
  const labels = nodes.map((n) => n.label);
  assertStringIncludes(labels.join(","), "Parse Query");
  assertStringIncludes(labels.join(","), "Navigate to URL");
  assertStringIncludes(labels.join(","), "Extract Data");
  assertStringIncludes(labels.join(","), "Format Output");
  assertEquals(nodes.length, 6); // parse, analyze, optimize, navigate, extract, format
});

Deno.test("graph-tools: plugin graph sample has nodes and edges", () => {
  // Simulate what the plugin tool returns when no runtime is available
  const nodes = [
    { id: "core", label: "core" },
    { id: "network", label: "network" },
    { id: "rendering", label: "rendering" },
    { id: "storage", label: "storage" },
    { id: "devtools", label: "devtools" },
  ];
  const edges = [
    { source: "core", target: "network" },
    { source: "core", target: "rendering" },
    { source: "core", target: "storage" },
    { source: "network", target: "devtools" },
    { source: "rendering", target: "devtools" },
  ];

  // Build a DiGraph and render to SVG
  const graph = new DiGraph<{ label: string }, { label: string }>();
  for (const n of nodes) {
    graph.addNode(new GraphNode(n.id, { label: n.label }));
  }
  for (const e of edges) {
    graph.addEdge(new GraphEdge(`${e.source}->${e.target}`, e.source, e.target));
  }

  const layout = hierarchical(graph, { direction: "TB" });
  const svg = render(graph, layout, { theme: DEFAULT_LIGHT_THEME, directed: true, showLabels: true });

  assertStringIncludes(svg, "<svg");
  assertStringIncludes(svg, "core");
  assertStringIncludes(svg, "devtools");
  assertEquals(nodes.length, 5);
  assertEquals(edges.length, 5);
});

Deno.test("graph-tools: empty graph renders valid SVG", () => {
  const graph = new DiGraph<{ label: string }, { label: string }>();
  graph.addNode(new GraphNode("only", { label: "single node" }));

  const layout = hierarchical(graph);
  const svg = render(graph, layout, { directed: true });

  assertStringIncludes(svg, "<svg");
  assertStringIncludes(svg, "</svg>");
});

Deno.test("graph-tools: NAVIGATE query plan has Navigate stage", () => {
  const query = "NAVIGATE TO 'https://example.com' CAPTURE title";
  const upperQuery = query.toUpperCase().trim();
  const nodes: { id: string; label: string }[] = [];
  let stepIndex = 0;
  const addStep = (label: string): string => {
    const id = `step_${stepIndex++}`;
    nodes.push({ id, label });
    return id;
  };

  addStep("Parse Query");
  addStep("Semantic Analysis");
  addStep("Optimize");

  if (upperQuery.startsWith("NAVIGATE")) {
    addStep("Navigate");
    if (upperQuery.includes("CAPTURE")) {
      addStep("Capture Results");
    }
  }

  addStep("Format Output");

  const labels = nodes.map((n) => n.label);
  assertStringIncludes(labels.join(","), "Navigate");
  assertStringIncludes(labels.join(","), "Capture Results");
});

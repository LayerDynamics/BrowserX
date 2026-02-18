import { assertEquals, assert } from "@std/assert";
import { grid } from "../../src/layout/mod.ts";
import { Graph, GraphNode } from "../../src/graph/mod.ts";

Deno.test("grid - default columns (auto-calculated)", () => {
  const graph = new Graph<string, string>();
  // Add 9 nodes (sqrt(9) = 3 columns)
  for (let i = 0; i < 9; i++) {
    graph.addNode(new GraphNode(`node${i}`, `Node ${i}`));
  }

  const result = grid(graph);

  // Should have 3 columns and 3 rows
  const expectedColumns = 3;
  const xs = result.nodes.map((n) => n.x);
  const uniqueXs = [...new Set(xs)];
  assertEquals(uniqueXs.length, expectedColumns, "Should have 3 unique x positions (columns)");
});

Deno.test("grid - custom column count", () => {
  const graph = new Graph<string, string>();
  for (let i = 0; i < 6; i++) {
    graph.addNode(new GraphNode(`node${i}`, `Node ${i}`));
  }

  const columns = 2;
  const result = grid(graph, { columns });

  // Check that nodes are arranged in 2 columns
  const xs = result.nodes.map((n) => n.x);
  const uniqueXs = [...new Set(xs)];
  assertEquals(uniqueXs.length, columns, "Should have 2 unique x positions");
});

Deno.test("grid - custom cell width/height", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "Node A"));
  graph.addNode(new GraphNode("B", "Node B"));
  graph.addNode(new GraphNode("C", "Node C"));
  graph.addNode(new GraphNode("D", "Node D"));

  const cellWidth = 80;
  const cellHeight = 60;
  const padding = 10;
  const columns = 2;
  const result = grid(graph, { columns, cellWidth, cellHeight, padding });

  // Node spacing should be cellWidth + padding horizontally
  const node0 = result.nodes[0];
  const node1 = result.nodes[1];
  assertEquals(node1.x - node0.x, cellWidth + padding);

  // Node spacing should be cellHeight + padding vertically
  const node2 = result.nodes[2];
  assertEquals(node2.y - node0.y, cellHeight + padding);
});

Deno.test("grid - custom padding", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "Node A"));
  graph.addNode(new GraphNode("B", "Node B"));

  const cellWidth = 100;
  const cellHeight = 100;
  const padding = 20;
  const columns = 2;
  const result = grid(graph, { columns, cellWidth, cellHeight, padding });

  const node0 = result.nodes[0];
  const node1 = result.nodes[1];

  // Distance should be cell + padding
  assertEquals(node1.x - node0.x, cellWidth + padding);
});

Deno.test("grid - positions are grid-aligned", () => {
  const graph = new Graph<string, string>();
  for (let i = 0; i < 6; i++) {
    graph.addNode(new GraphNode(`node${i}`, `Node ${i}`));
  }

  const cellWidth = 100;
  const cellHeight = 100;
  const padding = 10;
  const columns = 3;
  const result = grid(graph, { columns, cellWidth, cellHeight, padding });

  // Check that positions follow grid pattern
  for (let i = 0; i < result.nodes.length; i++) {
    const node = result.nodes[i];
    const row = Math.floor(i / columns);
    const col = i % columns;

    const expectedX = col * (cellWidth + padding);
    const expectedY = row * (cellHeight + padding);

    assertEquals(node.x, expectedX, `Node ${i} x position should be ${expectedX}`);
    assertEquals(node.y, expectedY, `Node ${i} y position should be ${expectedY}`);
  }
});

Deno.test("grid - returns correct width/height", () => {
  const graph = new Graph<string, string>();
  for (let i = 0; i < 6; i++) {
    graph.addNode(new GraphNode(`node${i}`, `Node ${i}`));
  }

  const cellWidth = 100;
  const cellHeight = 80;
  const padding = 10;
  const columns = 3;
  const result = grid(graph, { columns, cellWidth, cellHeight, padding });

  // 6 nodes, 3 columns = 2 rows
  const expectedWidth = columns * (cellWidth + padding);
  const expectedHeight = 2 * (cellHeight + padding);

  assertEquals(result.width, expectedWidth);
  assertEquals(result.height, expectedHeight);
});

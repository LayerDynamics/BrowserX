import { assertEquals, assert } from "@std/assert";
import { radial } from "../../src/layout/mod.ts";
import { Graph, GraphNode } from "../../src/graph/mod.ts";

Deno.test("radial - nodes arranged in circle", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "Node A"));
  graph.addNode(new GraphNode("B", "Node B"));
  graph.addNode(new GraphNode("C", "Node C"));
  graph.addNode(new GraphNode("D", "Node D"));

  const radius = 100;
  const result = radial(graph, { radius, center: { x: 200, y: 200 } });

  // Check each node is approximately at radius distance from center
  for (const node of result.nodes) {
    const dx = node.x - 200;
    const dy = node.y - 200;
    const distance = Math.sqrt(dx * dx + dy * dy);
    assert(
      Math.abs(distance - radius) < 0.01,
      `Node ${node.id} distance ${distance} should be approximately ${radius}`,
    );
  }
});

Deno.test("radial - custom radius", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "Node A"));
  graph.addNode(new GraphNode("B", "Node B"));
  graph.addNode(new GraphNode("C", "Node C"));

  const customRadius = 150;
  const result = radial(graph, { radius: customRadius, center: { x: 0, y: 0 } });

  for (const node of result.nodes) {
    const distance = Math.sqrt(node.x * node.x + node.y * node.y);
    assert(
      Math.abs(distance - customRadius) < 0.01,
      `Distance should be approximately ${customRadius}`,
    );
  }
});

Deno.test("radial - custom center point", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "Node A"));
  graph.addNode(new GraphNode("B", "Node B"));

  const center = { x: 300, y: 400 };
  const radius = 50;
  const result = radial(graph, { radius, center });

  for (const node of result.nodes) {
    const dx = node.x - center.x;
    const dy = node.y - center.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    assert(
      Math.abs(distance - radius) < 0.01,
      `Node should be at radius ${radius} from center (${center.x}, ${center.y})`,
    );
  }
});

Deno.test("radial - custom start angle", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "Node A"));
  graph.addNode(new GraphNode("B", "Node B"));

  const startAngle = Math.PI / 2; // 90 degrees
  const radius = 100;
  const center = { x: 0, y: 0 };
  const result = radial(graph, { radius, center, startAngle });

  // First node should be at startAngle
  const firstNode = result.nodes[0];
  const expectedX = center.x + radius * Math.cos(startAngle);
  const expectedY = center.y + radius * Math.sin(startAngle);

  assert(Math.abs(firstNode.x - expectedX) < 0.01, "First node x should match start angle");
  assert(Math.abs(firstNode.y - expectedY) < 0.01, "First node y should match start angle");
});

Deno.test("radial - nodes evenly spaced by angle", () => {
  const graph = new Graph<string, string>();
  graph.addNode(new GraphNode("A", "Node A"));
  graph.addNode(new GraphNode("B", "Node B"));
  graph.addNode(new GraphNode("C", "Node C"));
  graph.addNode(new GraphNode("D", "Node D"));

  const center = { x: 0, y: 0 };
  const radius = 100;
  const result = radial(graph, { radius, center, startAngle: 0 });

  // Calculate angles for each node
  const angles: number[] = [];
  for (const node of result.nodes) {
    const angle = Math.atan2(node.y - center.y, node.x - center.x);
    angles.push(angle);
  }

  // Check that angular spacing is approximately equal
  const expectedAngleStep = (2 * Math.PI) / graph.nodeCount;
  for (let i = 1; i < angles.length; i++) {
    let angleDiff = angles[i] - angles[i - 1];
    if (angleDiff < 0) angleDiff += 2 * Math.PI;
    assert(
      Math.abs(angleDiff - expectedAngleStep) < 0.01,
      `Angle difference ${angleDiff} should be approximately ${expectedAngleStep}`,
    );
  }
});

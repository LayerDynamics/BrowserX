import type { Graph } from "../graph/Graph.ts";
import type { ForceDirectedOptions, LayoutResult, LayoutNode } from "./types.ts";

/**
 * Force-directed layout using Fruchterman-Reingold algorithm.
 * Uses a seeded LCG RNG for reproducibility.
 */
export function forceDirected<N, E>(
  graph: Graph<N, E>,
  options: ForceDirectedOptions = {},
): LayoutResult {
  const width = options.width ?? 800;
  const height = options.height ?? 600;
  const iterations = options.iterations ?? 50;
  const k = options.springLength ?? Math.sqrt((width * height) / graph.nodeCount);
  const C1 = options.springConstant ?? 2.0;
  const C2 = options.repulsionConstant ?? 1.0;

  // Seeded LCG RNG for reproducible layouts
  const seed = options.seed ?? Date.now();
  let state = seed;
  function random(): number {
    state = (state * 1664525 + 1013904223) >>> 0;
    return (state >>> 0) / 0xFFFFFFFF;
  }

  const nodes = graph.nodes();
  const positions = new Map<string, { x: number; y: number }>();

  // Initialize positions randomly
  for (const node of nodes) {
    positions.set(node.id, {
      x: random() * width,
      y: random() * height,
    });
  }

  // Simulation
  for (let iter = 0; iter < iterations; iter++) {
    const disp = new Map<string, { x: number; y: number }>();
    for (const node of nodes) {
      disp.set(node.id, { x: 0, y: 0 });
    }

    // Calculate repulsive forces
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const v = nodes[i];
        const u = nodes[j];
        const posV = positions.get(v.id)!;
        const posU = positions.get(u.id)!;
        const dx = posV.x - posU.x;
        const dy = posV.y - posU.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const force = C2 * (k * k) / dist;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        const dispV = disp.get(v.id)!;
        const dispU = disp.get(u.id)!;
        dispV.x += fx;
        dispV.y += fy;
        dispU.x -= fx;
        dispU.y -= fy;
      }
    }

    // Calculate attractive forces (edges)
    for (const edge of graph.edges()) {
      const posV = positions.get(edge.source)!;
      const posU = positions.get(edge.target)!;
      const dx = posV.x - posU.x;
      const dy = posV.y - posU.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const force = C1 * (dist * dist) / k;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      const dispV = disp.get(edge.source)!;
      const dispU = disp.get(edge.target)!;
      dispV.x -= fx;
      dispV.y -= fy;
      dispU.x += fx;
      dispU.y += fy;
    }

    // Apply displacement with temperature cooling
    const temp = width / 10 * (1 - iter / iterations);
    for (const node of nodes) {
      const pos = positions.get(node.id)!;
      const d = disp.get(node.id)!;
      const len = Math.sqrt(d.x * d.x + d.y * d.y) || 0.01;
      pos.x += (d.x / len) * Math.min(len, temp);
      pos.y += (d.y / len) * Math.min(len, temp);
      // Constrain to bounds
      pos.x = Math.max(0, Math.min(width, pos.x));
      pos.y = Math.max(0, Math.min(height, pos.y));
    }
  }

  const layoutNodes: LayoutNode[] = nodes.map((n) => {
    const pos = positions.get(n.id)!;
    return { id: n.id, x: pos.x, y: pos.y };
  });

  return { nodes: layoutNodes, width, height };
}

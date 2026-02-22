/**
 * Render Tree Graph Exporter
 *
 * Converts a RenderObject tree into a GraphX DiGraph for visualization,
 * with node data capturing layout/paint state.
 */

import { DiGraph, GraphEdge, GraphNode } from "@browserx/graphx/graph";
import { hierarchical } from "@browserx/graphx/layout";
import type { LayoutResult } from "@browserx/graphx/layout";
import { DEFAULT_LIGHT_THEME, render } from "@browserx/graphx/svg";
import type { SVGRenderOptions } from "@browserx/graphx/svg";
import type { RenderObject } from "./RenderObject.ts";

/**
 * Node data attached to each graph node representing a RenderObject.
 */
export interface RenderTreeNodeData {
  type: string;
  tagName: string;
  needsLayout: boolean;
  needsPaint: boolean;
}

/**
 * Walk a RenderObject tree and build a DiGraph.
 * Each RenderObject becomes a node; parent->child relationships become edges.
 */
export function renderTreeToGraph(root: RenderObject): DiGraph<RenderTreeNodeData> {
  const graph = new DiGraph<RenderTreeNodeData>();
  let edgeCounter = 0;

  function walk(obj: RenderObject): void {
    const nodeId = String(obj.id);
    const tagName = obj.element?.tagName ?? "unknown";
    const type = obj.constructor.name;
    const label = `${type}(${tagName})`;

    const data: RenderTreeNodeData = {
      type,
      tagName,
      needsLayout: obj.needsLayout,
      needsPaint: obj.needsPaint,
    };

    const graphNode = new GraphNode<RenderTreeNodeData>(nodeId, data, label);
    graph.addNode(graphNode);

    for (const child of obj.children) {
      walk(child);
      const edgeId = `e${edgeCounter++}`;
      const edge = new GraphEdge(edgeId, nodeId, String(child.id));
      graph.addEdge(edge);
    }
  }

  walk(root);
  return graph;
}

/**
 * Render a RenderObject tree as an SVG string using hierarchical layout.
 */
export function renderTreeAsSvg(root: RenderObject): string {
  const graph = renderTreeToGraph(root);
  const layout: LayoutResult = hierarchical(graph, { direction: "TB" });
  const svgOptions: SVGRenderOptions = {
    directed: true,
    showLabels: true,
    theme: DEFAULT_LIGHT_THEME,
  };
  return render(graph, layout, svgOptions);
}

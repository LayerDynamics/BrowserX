/**
 * DOM Tree Visualizer
 *
 * Converts a DOMNode tree into a GraphX DiGraph for visualization,
 * and renders it as SVG using hierarchical layout.
 */

import { DiGraph, GraphNode, GraphEdge, hierarchical, render, DEFAULT_LIGHT_THEME, DEFAULT_DARK_THEME } from "@browserx/graphx";
import type { LayoutResult, SVGRenderOptions, Theme } from "@browserx/graphx";
import type { DOMNode } from "../../../browser/src/types/dom.ts";

/**
 * Options for rendering the DOM tree as SVG.
 */
export interface DomGraphOptions {
  direction?: "TB" | "LR";
  theme?: "light" | "dark";
}

/**
 * Walk a DOMNode tree and build a DiGraph.
 * Each node becomes a GraphNode (id = String(nodeId)),
 * with edges from parent to children.
 */
export function domToGraph(root: DOMNode): DiGraph {
  const graph = new DiGraph();
  let edgeCounter = 0;

  function walk(node: DOMNode): void {
    const nodeId = String(node.nodeId);
    const label = node.nodeName || "unknown";
    const graphNode = new GraphNode(nodeId, {
      nodeType: node.nodeType,
      nodeName: node.nodeName,
      nodeValue: node.nodeValue,
    }, label);
    graph.addNode(graphNode);

    for (const child of node.childNodes ?? []) {
      const childId = String(child.nodeId);
      walk(child);
      const edgeId = `e${edgeCounter++}`;
      const edge = new GraphEdge(edgeId, nodeId, childId);
      graph.addEdge(edge);
    }
  }

  walk(root);
  return graph;
}

/**
 * Render a DOMNode tree as an SVG string using hierarchical layout.
 */
export function renderDomAsSvg(root: DOMNode, options?: DomGraphOptions): string {
  const graph = domToGraph(root);
  const direction = options?.direction ?? "TB";
  const theme: Theme = options?.theme === "dark" ? DEFAULT_DARK_THEME : DEFAULT_LIGHT_THEME;

  const layout: LayoutResult = hierarchical(graph, { direction });
  const svgOptions: SVGRenderOptions = {
    directed: true,
    showLabels: true,
    theme,
  };

  return render(graph, layout, svgOptions);
}

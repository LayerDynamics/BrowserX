/**
 * DOM Tree → GraphX DiGraph converter
 */
import { DiGraph, GraphEdge, GraphNode } from "@browserx/graphx/graph";
import { hierarchical } from "@browserx/graphx/layout";
import type { LayoutResult } from "@browserx/graphx/layout";
import { DEFAULT_LIGHT_THEME, render } from "@browserx/graphx/svg";

export interface DOMGraphNodeData {
  nodeType: number;
  tagName: string;
  id?: string;
  className?: string;
  childCount: number;
}

export function domTreeToGraph(root: unknown): DiGraph<DOMGraphNodeData> {
  const graph = new DiGraph<DOMGraphNodeData>();
  let nodeCounter = 0;
  let edgeCounter = 0;

  function walk(node: unknown): string {
    const n = node as Record<string, unknown>;
    const id = `dom_${nodeCounter++}`;
    const nodeType = (n.nodeType as number) ?? 1;
    const tagName = ((n.tagName ?? n.nodeName ?? "node") as string).toLowerCase();
    const attrs = n.attributes as Map<string, string> | undefined;
    const elemId = attrs?.get?.("id") ?? (n.id as string | undefined);
    const className = attrs?.get?.("class") ?? (n.className as string | undefined);
    const children = (n.childNodes ?? n.children ?? []) as unknown[];

    let label = tagName;
    if (elemId) label += `#${elemId}`;
    if (className) label += `.${className.split(" ")[0]}`;

    const data: DOMGraphNodeData = {
      nodeType,
      tagName,
      id: elemId,
      className,
      childCount: children.length,
    };
    graph.addNode(new GraphNode<DOMGraphNodeData>(id, data, label));

    for (const child of children) {
      if (child === null || child === undefined) continue;
      const childId = walk(child);
      graph.addEdge(new GraphEdge(`e${edgeCounter++}`, id, childId));
    }
    return id;
  }

  if (root) walk(root);
  return graph;
}

export function domTreeAsSvg(
  root: unknown,
  direction: "TB" | "LR" = "TB",
): string {
  const graph = domTreeToGraph(root);
  const layout: LayoutResult = hierarchical(graph, { direction });
  return render(graph, layout, {
    directed: true,
    showLabels: true,
    theme: DEFAULT_LIGHT_THEME,
  });
}

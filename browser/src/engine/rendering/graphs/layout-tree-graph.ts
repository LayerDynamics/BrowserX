/**
 * LayoutBox tree → GraphX DiGraph converter
 */
import { DiGraph, GraphEdge, GraphNode } from "@browserx/graphx/graph";
import { hierarchical } from "@browserx/graphx/layout";
import type { LayoutResult } from "@browserx/graphx/layout";
import { DEFAULT_LIGHT_THEME, render } from "@browserx/graphx/svg";

export interface LayoutGraphNodeData {
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  hasStyle: boolean;
  text?: string;
}

export function layoutTreeToGraph(
  root: unknown,
): DiGraph<LayoutGraphNodeData> {
  const graph = new DiGraph<LayoutGraphNodeData>();
  let nodeCounter = 0;
  let edgeCounter = 0;

  function walk(box: unknown): string {
    const b = box as Record<string, unknown>;
    const id = `layout_${nodeCounter++}`;
    const type = (b.type as string) ?? "block";
    const x = (b.x as number) ?? 0;
    const y = (b.y as number) ?? 0;
    const width = (b.width as number) ?? 0;
    const height = (b.height as number) ?? 0;
    const text = b.text as string | undefined;
    const hasStyle = b.style !== undefined && b.style !== null;

    let label: string;
    if (type === "text" && text) {
      const truncated = text.length > 15 ? text.slice(0, 12) + "..." : text;
      label = `"${truncated}"`;
    } else {
      label = `${type} ${Math.round(width)}x${Math.round(height)}`;
    }

    const data: LayoutGraphNodeData = {
      type,
      x,
      y,
      width,
      height,
      hasStyle,
      text,
    };
    graph.addNode(new GraphNode<LayoutGraphNodeData>(id, data, label));

    const children = (b.children ?? []) as unknown[];
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

export function layoutTreeAsSvg(
  root: unknown,
  direction: "TB" | "LR" = "TB",
): string {
  const graph = layoutTreeToGraph(root);
  const layout: LayoutResult = hierarchical(graph, { direction });
  return render(graph, layout, {
    directed: true,
    showLabels: true,
    theme: DEFAULT_LIGHT_THEME,
  });
}

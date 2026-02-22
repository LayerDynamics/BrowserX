/**
 * Query AST → GraphX DiGraph converter
 */
import {
  DEFAULT_LIGHT_THEME,
  DiGraph,
  GraphEdge,
  GraphNode,
  hierarchical,
  render,
} from "@browserx/graphx";
import type { LayoutResult } from "@browserx/graphx";

export interface ASTGraphNodeData {
  nodeType: string;
  value?: string;
}

export function astToGraph(ast: unknown): DiGraph<ASTGraphNodeData> {
  const graph = new DiGraph<ASTGraphNodeData>();
  let nodeCounter = 0;
  let edgeCounter = 0;

  function walk(node: unknown): string {
    if (node === null || node === undefined) return "";
    const n = node as Record<string, unknown>;
    const id = `ast_${nodeCounter++}`;
    const nodeType = (n.type as string) ?? (n.kind as string) ?? "node";
    const value =
      (n.value as string) ?? (n.name as string) ?? undefined;

    let label = nodeType;
    if (value) {
      const truncated =
        value.length > 20 ? value.slice(0, 17) + "..." : value;
      label += `: ${truncated}`;
    }

    graph.addNode(
      new GraphNode<ASTGraphNodeData>(id, { nodeType, value }, label),
    );

    const childKeys = [
      "body",
      "statements",
      "columns",
      "expressions",
      "args",
      "arguments",
      "left",
      "right",
      "condition",
      "then",
      "else",
      "from",
      "where",
      "orderBy",
      "groupBy",
      "having",
      "limit",
      "offset",
      "select",
      "insert",
      "update",
      "delete",
      "table",
      "source",
      "target",
      "items",
      "children",
    ];

    for (const key of childKeys) {
      const child = n[key];
      if (child === null || child === undefined) continue;

      if (Array.isArray(child)) {
        for (const item of child) {
          if (item && typeof item === "object") {
            const childId = walk(item);
            if (childId) {
              graph.addEdge(
                new GraphEdge(
                  `e${edgeCounter++}`,
                  id,
                  childId,
                  1,
                  undefined,
                  key,
                ),
              );
            }
          }
        }
      } else if (typeof child === "object") {
        const childId = walk(child);
        if (childId) {
          graph.addEdge(
            new GraphEdge(
              `e${edgeCounter++}`,
              id,
              childId,
              1,
              undefined,
              key,
            ),
          );
        }
      }
    }

    return id;
  }

  if (ast) walk(ast);
  return graph;
}

export function astAsSvg(
  ast: unknown,
  direction: "TB" | "LR" = "TB",
): string {
  const graph = astToGraph(ast);
  const layout: LayoutResult = hierarchical(graph, { direction });
  return render(graph, layout, {
    directed: true,
    showLabels: true,
    theme: DEFAULT_LIGHT_THEME,
  });
}

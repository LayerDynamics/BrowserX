/**
 * CSSOM → GraphX DiGraph converter
 */
import { DiGraph, GraphEdge, GraphNode } from "@browserx/graphx/graph";
import { hierarchical } from "@browserx/graphx/layout";
import type { LayoutResult } from "@browserx/graphx/layout";
import { DEFAULT_LIGHT_THEME, render } from "@browserx/graphx/svg";

export interface CSSOMGraphNodeData {
  type: "root" | "stylesheet" | "rule" | "declaration";
  selector?: string;
  property?: string;
  value?: string;
}

export function cssomToGraph(cssom: unknown): DiGraph<CSSOMGraphNodeData> {
  const graph = new DiGraph<CSSOMGraphNodeData>();
  let nodeCounter = 0;
  let edgeCounter = 0;

  const rootId = `css_${nodeCounter++}`;
  graph.addNode(
    new GraphNode<CSSOMGraphNodeData>(rootId, { type: "root" }, "CSSOM"),
  );

  const c = cssom as Record<string, unknown>;

  const stylesheets = (c.stylesheets ?? [c]) as unknown[];
  for (const sheet of stylesheets) {
    const s = sheet as Record<string, unknown>;
    const sheetId = `css_${nodeCounter++}`;
    const origin = (s.origin as string) ?? "author";
    graph.addNode(
      new GraphNode<CSSOMGraphNodeData>(
        sheetId,
        { type: "stylesheet" },
        `stylesheet (${origin})`,
      ),
    );
    graph.addEdge(new GraphEdge(`e${edgeCounter++}`, rootId, sheetId));

    const rules = (s.rules ?? s.cssRules ?? []) as unknown[];
    for (const rule of rules) {
      const r = rule as Record<string, unknown>;
      const ruleId = `css_${nodeCounter++}`;
      const selector = (r.selectorText ?? r.selector ?? "") as string;
      const truncated = selector.length > 30 ? selector.slice(0, 27) + "..." : selector;
      graph.addNode(
        new GraphNode<CSSOMGraphNodeData>(
          ruleId,
          { type: "rule", selector },
          truncated || "rule",
        ),
      );
      graph.addEdge(new GraphEdge(`e${edgeCounter++}`, sheetId, ruleId));

      const style = (r.style ?? r.declarations ?? {}) as Record<
        string,
        unknown
      >;
      const entries = style instanceof Map
        ? [...style.entries()]
        : typeof style === "object" && style !== null
        ? Object.entries(style)
        : [];
      for (const [prop, val] of entries.slice(0, 5)) {
        const declId = `css_${nodeCounter++}`;
        const label = `${prop}: ${String(val).slice(0, 20)}`;
        graph.addNode(
          new GraphNode<CSSOMGraphNodeData>(
            declId,
            { type: "declaration", property: prop, value: String(val) },
            label,
          ),
        );
        graph.addEdge(new GraphEdge(`e${edgeCounter++}`, ruleId, declId));
      }
    }
  }

  return graph;
}

export function cssomAsSvg(
  cssom: unknown,
  direction: "TB" | "LR" = "TB",
): string {
  const graph = cssomToGraph(cssom);
  const layout: LayoutResult = hierarchical(graph, { direction });
  return render(graph, layout, {
    directed: true,
    showLabels: true,
    theme: DEFAULT_LIGHT_THEME,
  });
}

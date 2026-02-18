import type { Graph } from "../graph/Graph.ts";
import type { LayoutResult } from "../layout/types.ts";
import type { Theme } from "./styles.ts";
import { DEFAULT_LIGHT_THEME } from "./styles.ts";
import { buildArrowMarker } from "./markers.ts";

/** Escape XML special characters */
function escapeXML(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export interface SVGRenderOptions {
  theme?: Theme;
  showLabels?: boolean;
  showEdgeLabels?: boolean;
  directed?: boolean;
}

/**
 * SVGRenderer class for rendering graphs to SVG strings.
 */
export class SVGRenderer<N = unknown, E = unknown> {
  constructor(
    private graph: Graph<N, E>,
    private layout: LayoutResult,
    private options: SVGRenderOptions = {},
  ) {}

  render(): string {
    const theme = this.options.theme ?? DEFAULT_LIGHT_THEME;
    const showLabels = this.options.showLabels ?? true;
    const showEdgeLabels = this.options.showEdgeLabels ?? false;
    const directed = this.options.directed ?? false;

    const { nodes: layoutNodes, width, height } = this.layout;
    const nodeMap = new Map(layoutNodes.map((n) => [n.id, n]));

    // SVG header
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" `;
    svg += `viewBox="0 0 ${width} ${height}">\n`;

    // Background
    svg += `  <rect width="${width}" height="${height}" fill="${theme.background}"/>\n`;

    // Marker definitions (for directed edges)
    if (directed) {
      svg += `  <defs>\n`;
      svg += buildArrowMarker(theme.edge);
      svg += `  </defs>\n`;
    }

    // Render edges
    svg += `  <g id="edges">\n`;
    for (const edge of this.graph.edges()) {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (!source || !target) continue;

      const markerId = directed ? `url(#arrowhead-${theme.edge.arrowType})` : "";
      svg += `    <line x1="${source.x}" y1="${source.y}" `;
      svg += `x2="${target.x}" y2="${target.y}" `;
      svg += `stroke="${theme.edge.stroke}" stroke-width="${theme.edge.strokeWidth}" `;
      if (directed) svg += `marker-end="${markerId}" `;
      svg += `/>\n`;

      if (showEdgeLabels && edge.label) {
        const mx = (source.x + target.x) / 2;
        const my = (source.y + target.y) / 2;
        svg += `    <text x="${mx}" y="${my}" `;
        svg += `font-size="${theme.edge.fontSize}" font-family="${theme.edge.fontFamily}" `;
        svg += `fill="${theme.edge.labelColor}" text-anchor="middle">${escapeXML(edge.label)}</text>\n`;
      }
    }
    svg += `  </g>\n`;

    // Render nodes
    svg += `  <g id="nodes">\n`;
    for (const layoutNode of layoutNodes) {
      const node = this.graph.getNode(layoutNode.id);
      if (!node) continue;

      svg += `    <circle cx="${layoutNode.x}" cy="${layoutNode.y}" `;
      svg += `r="${theme.node.radius}" `;
      svg += `fill="${theme.node.fill}" stroke="${theme.node.stroke}" `;
      svg += `stroke-width="${theme.node.strokeWidth}"/>\n`;

      if (showLabels) {
        svg += `    <text x="${layoutNode.x}" y="${layoutNode.y + theme.node.fontSize / 3}" `;
        svg += `font-size="${theme.node.fontSize}" font-family="${theme.node.fontFamily}" `;
        svg += `fill="${theme.node.labelColor}" text-anchor="middle">${escapeXML(node.label)}</text>\n`;
      }
    }
    svg += `  </g>\n`;

    svg += `</svg>`;
    return svg;
  }
}

/**
 * Convenience function to render a graph with layout to SVG.
 */
export function render<N, E>(
  graph: Graph<N, E>,
  layout: LayoutResult,
  options?: SVGRenderOptions,
): string {
  const renderer = new SVGRenderer(graph, layout, options);
  return renderer.render();
}

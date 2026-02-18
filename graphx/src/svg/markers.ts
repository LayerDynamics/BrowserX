import type { EdgeStyle } from "./styles.ts";

/**
 * Build SVG marker definitions for arrowheads.
 */
export function buildArrowMarker(style: EdgeStyle): string {
  const { arrowType, arrowSize, stroke } = style;

  switch (arrowType) {
    case "open":
      return `
<marker id="arrowhead-open" markerWidth="${arrowSize}" markerHeight="${arrowSize}"
        refX="${arrowSize - 1}" refY="${arrowSize / 2}" orient="auto">
  <polyline points="0,0 ${arrowSize},${arrowSize / 2} 0,${arrowSize}"
            fill="none" stroke="${stroke}" stroke-width="1.5"/>
</marker>`;

    case "filled":
      return `
<marker id="arrowhead-filled" markerWidth="${arrowSize}" markerHeight="${arrowSize}"
        refX="${arrowSize}" refY="${arrowSize / 2}" orient="auto">
  <polygon points="0,0 ${arrowSize},${arrowSize / 2} 0,${arrowSize}"
           fill="${stroke}"/>
</marker>`;

    case "circle":
      return `
<marker id="arrowhead-circle" markerWidth="${arrowSize}" markerHeight="${arrowSize}"
        refX="${arrowSize / 2}" refY="${arrowSize / 2}" orient="auto">
  <circle cx="${arrowSize / 2}" cy="${arrowSize / 2}" r="${arrowSize / 2}"
          fill="${stroke}"/>
</marker>`;

    default:
      return "";
  }
}

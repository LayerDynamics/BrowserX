import type { Graph } from "../graph/Graph.ts";
import type { LayoutResult } from "../layout/types.ts";

export interface ASCIIRenderOptions {
  border?: "single" | "double" | "rounded";
  arrows?: boolean;
  padding?: number;
  scaleX?: number;
  scaleY?: number;
  showEdgeLabels?: boolean;
}

interface BoxChar {
  tl: string;
  tr: string;
  bl: string;
  br: string;
  h: string;
  v: string;
}

const BORDERS: Record<string, BoxChar> = {
  single:  { tl: "\u250C", tr: "\u2510", bl: "\u2514", br: "\u2518", h: "\u2500", v: "\u2502" },
  double:  { tl: "\u2554", tr: "\u2557", bl: "\u255A", br: "\u255D", h: "\u2550", v: "\u2551" },
  rounded: { tl: "\u256D", tr: "\u256E", bl: "\u2570", br: "\u256F", h: "\u2500", v: "\u2502" },
};

interface NodeBox {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
  label: string;
}

export class ASCIIRenderer<N = unknown, E = unknown> {
  private graph: Graph<N, E>;
  private layout: LayoutResult;
  private options: ASCIIRenderOptions;

  constructor(graph: Graph<N, E>, layout: LayoutResult, options: ASCIIRenderOptions = {}) {
    this.graph = graph;
    this.layout = layout;
    this.options = options;
  }

  render(): string {
    const nodes = this.layout.nodes;
    if (nodes.length === 0) return "";

    const arrows = this.options.arrows ?? true;
    const padding = this.options.padding ?? 1;
    const scaleX = this.options.scaleX ?? 0.15;
    const scaleY = this.options.scaleY ?? 0.08;
    const borderStyle = this.options.border ?? "single";
    const showEdgeLabels = this.options.showEdgeLabels ?? false;
    const bc = BORDERS[borderStyle];

    // Build node boxes
    const boxes = new Map<string, NodeBox>();
    for (const ln of nodes) {
      const gn = this.graph.getNode(ln.id);
      const label = gn ? gn.label : ln.id;
      const w = label.length + 2 * padding + 2;
      const h = 1 + 2 * padding + 2;
      const x = Math.round(ln.x * scaleX);
      const y = Math.round(ln.y * scaleY);
      boxes.set(ln.id, { x, y, w, h, cx: x + Math.floor(w / 2), cy: y + Math.floor(h / 2), label });
    }

    // Compute grid size
    let gridW = 0;
    let gridH = 0;
    for (const b of boxes.values()) {
      gridW = Math.max(gridW, b.x + b.w);
      gridH = Math.max(gridH, b.y + b.h);
    }
    // Add margin for edges that extend beyond
    gridW += 4;
    gridH += 2;

    // Create grid
    const grid: string[][] = [];
    for (let r = 0; r < gridH; r++) {
      grid.push(new Array(gridW).fill(" "));
    }

    const setChar = (r: number, c: number, ch: string) => {
      if (r >= 0 && r < gridH && c >= 0 && c < gridW) {
        grid[r][c] = ch;
      }
    };

    // Draw edges first
    for (const edge of this.graph.edges()) {
      const src = boxes.get(edge.source);
      const tgt = boxes.get(edge.target);
      if (!src || !tgt) continue;

      // Determine exit/entry points on box edges
      let sx = src.cx;
      let sy = src.cy;
      let tx = tgt.cx;
      let ty = tgt.cy;

      // Adjust start point to box border
      if (tx > sx + Math.floor(src.w / 2)) {
        sx = src.x + src.w - 1; // right edge
        sy = src.cy;
      } else if (tx < sx - Math.floor(src.w / 2)) {
        sx = src.x; // left edge
        sy = src.cy;
      } else {
        sx = src.cx;
        if (ty > sy) sy = src.y + src.h - 1;
        else sy = src.y;
      }

      // Adjust end point to box border
      if (sx > tx + Math.floor(tgt.w / 2)) {
        tx = tgt.x + tgt.w - 1;
        ty = tgt.cy;
      } else if (sx < tx - Math.floor(tgt.w / 2)) {
        tx = tgt.x;
        ty = tgt.cy;
      } else {
        tx = tgt.cx;
        if (sy > ty) ty = tgt.y + tgt.h - 1;
        else ty = tgt.y;
      }

      // L-shaped routing: horizontal first, then vertical
      const hDir = tx > sx ? 1 : tx < sx ? -1 : 0;
      const vDir = ty > sy ? 1 : ty < sy ? -1 : 0;

      // Draw horizontal segment
      if (hDir !== 0) {
        for (let c = sx; c !== tx; c += hDir) {
          setChar(sy, c, "\u2500");
        }
      }

      // Draw corner if needed
      if (hDir !== 0 && vDir !== 0) {
        if (hDir > 0 && vDir > 0) setChar(sy, tx, "\u2510");
        else if (hDir > 0 && vDir < 0) setChar(sy, tx, "\u2518");
        else if (hDir < 0 && vDir > 0) setChar(sy, tx, "\u250C");
        else if (hDir < 0 && vDir < 0) setChar(sy, tx, "\u2514");
      }

      // Draw vertical segment
      if (vDir !== 0) {
        const startV = sy + (hDir !== 0 ? vDir : 0);
        for (let r = startV; r !== ty; r += vDir) {
          setChar(r, tx, "\u2502");
        }
      }

      // Arrow at target (one step before target box border so node drawing doesn't overwrite)
      if (arrows) {
        if (vDir !== 0) {
          const ar = ty - vDir;
          setChar(ar, tx, vDir > 0 ? "\u2193" : "\u2191");
        } else if (hDir !== 0) {
          const ac = tx - hDir;
          setChar(sy, ac, hDir > 0 ? "\u2192" : "\u2190");
        }
      }

      // Edge label at midpoint
      if (showEdgeLabels && edge.label) {
        const mx = Math.round((sx + tx) / 2);
        const my = Math.round((sy + ty) / 2);
        const lbl = edge.label;
        const startC = mx - Math.floor(lbl.length / 2);
        for (let i = 0; i < lbl.length; i++) {
          setChar(my, startC + i, lbl[i]);
        }
      }
    }

    // Draw node boxes on top
    for (const b of boxes.values()) {
      // Top border
      setChar(b.y, b.x, bc.tl);
      for (let c = 1; c < b.w - 1; c++) setChar(b.y, b.x + c, bc.h);
      setChar(b.y, b.x + b.w - 1, bc.tr);

      // Bottom border
      setChar(b.y + b.h - 1, b.x, bc.bl);
      for (let c = 1; c < b.w - 1; c++) setChar(b.y + b.h - 1, b.x + c, bc.h);
      setChar(b.y + b.h - 1, b.x + b.w - 1, bc.br);

      // Side borders and interior
      for (let r = 1; r < b.h - 1; r++) {
        setChar(b.y + r, b.x, bc.v);
        for (let c = 1; c < b.w - 1; c++) setChar(b.y + r, b.x + c, " ");
        setChar(b.y + r, b.x + b.w - 1, bc.v);
      }

      // Label centered
      const labelRow = b.y + 1 + padding;
      const labelCol = b.x + 1 + padding;
      for (let i = 0; i < b.label.length; i++) {
        setChar(labelRow, labelCol + i, b.label[i]);
      }
    }

    // Join rows, trim trailing spaces per line, trim trailing empty lines
    const lines = grid.map((row) => row.join("").replace(/\s+$/, ""));
    // Remove trailing empty lines
    while (lines.length > 0 && lines[lines.length - 1] === "") {
      lines.pop();
    }

    return lines.join("\n");
  }
}

/**
 * Convenience function to render a graph to ASCII.
 */
export function render<N, E>(
  graph: Graph<N, E>,
  layout: LayoutResult,
  options?: ASCIIRenderOptions,
): string {
  const renderer = new ASCIIRenderer(graph, layout, options);
  return renderer.render();
}

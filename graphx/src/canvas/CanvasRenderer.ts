import type { CanvasTheme, StageNode, StageEdge, Transform, StageNodeRect } from "./types.ts";
import type { LayoutResult, LayoutNode } from "../layout/types.ts";
import type { ProcessTrace } from "./types.ts";

export class CanvasRenderer {
  private ctx: CanvasRenderingContext2D;
  private theme: CanvasTheme;

  // Stage node dimensions
  static readonly NODE_WIDTH = 180;
  static readonly NODE_HEIGHT = 70;
  static readonly CORNER_RADIUS = 8;
  static readonly STATUS_DOT_RADIUS = 5;
  static readonly ARROW_SIZE = 8;

  constructor(ctx: CanvasRenderingContext2D, theme: CanvasTheme) {
    this.ctx = ctx;
    this.theme = theme;
  }

  setTheme(theme: CanvasTheme): void {
    this.theme = theme;
  }

  render(
    trace: ProcessTrace,
    layout: LayoutResult,
    transform: Transform,
    selectedId: string | null,
    hoveredId: string | null,
    showTiming: boolean,
    showDataFlow: boolean,
  ): StageNodeRect[] {
    this.clear();

    const totalDuration = trace.stages.reduce((sum, s) => sum + s.timing.duration, 0);

    // Build a map from stage id → layout node
    const layoutMap = new Map<string, LayoutNode>();
    for (const ln of layout.nodes) {
      layoutMap.set(ln.id, ln);
    }

    // Render all stage nodes, collect rects
    const rects: StageNodeRect[] = [];
    for (const stage of trace.stages) {
      const pos = layoutMap.get(stage.id);
      if (!pos) continue;
      const rect = this.renderStageNode(
        stage,
        pos,
        transform,
        stage.id === selectedId,
        stage.id === hoveredId,
        showTiming,
        totalDuration,
      );
      rects.push(rect);
    }

    // Build rect map for edge rendering
    const rectMap = new Map<string, StageNodeRect>();
    for (const r of rects) {
      rectMap.set(r.id, r);
    }

    // Render edges
    for (const edge of trace.edges) {
      const srcRect = rectMap.get(edge.sourceStage);
      const tgtRect = rectMap.get(edge.targetStage);
      if (srcRect && tgtRect) {
        this.renderEdge(edge, srcRect, tgtRect, transform, showDataFlow);
      }
    }

    return rects;
  }

  clear(): void {
    const canvas = this.ctx.canvas;
    this.ctx.fillStyle = this.theme.background;
    this.ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  private renderStageNode(
    stage: StageNode,
    pos: LayoutNode,
    transform: Transform,
    isSelected: boolean,
    isHovered: boolean,
    showTiming: boolean,
    totalDuration: number,
  ): StageNodeRect {
    const W = CanvasRenderer.NODE_WIDTH;
    const H = CanvasRenderer.NODE_HEIGHT;
    const R = CanvasRenderer.CORNER_RADIUS;

    const screen = this.applyTransform(pos.x, pos.y, transform);
    const sx = screen.x;
    const sy = screen.y;
    const sw = W * transform.scale;
    const sh = H * transform.scale;

    const statusColors = this.theme.stage[stage.status];

    // Hovered: slight opacity boost via globalAlpha
    if (isHovered) {
      this.ctx.globalAlpha = 1.0;
    } else {
      this.ctx.globalAlpha = 0.95;
    }

    // Rounded rect fill
    this.ctx.fillStyle = statusColors.fill;
    this.drawRoundedRect(sx, sy, sw, sh, R * transform.scale);
    this.ctx.fill();

    // Rounded rect stroke
    this.ctx.strokeStyle = statusColors.border;
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();

    // Selection ring
    if (isSelected) {
      this.ctx.strokeStyle = this.theme.selection.stroke;
      this.ctx.lineWidth = this.theme.selection.width;
      this.drawRoundedRect(
        sx - 2 * transform.scale,
        sy - 2 * transform.scale,
        sw + 4 * transform.scale,
        sh + 4 * transform.scale,
        (R + 2) * transform.scale,
      );
      this.ctx.stroke();
    }

    this.ctx.globalAlpha = 1.0;

    // Status dot (top-left corner)
    const dotR = CanvasRenderer.STATUS_DOT_RADIUS * transform.scale;
    const dotX = sx + dotR + 6 * transform.scale;
    const dotY = sy + dotR + 6 * transform.scale;
    this.ctx.beginPath();
    this.ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
    this.ctx.fillStyle = statusColors.border;
    this.ctx.fill();

    // Stage name text (bold)
    const fontSize = this.theme.label.fontSize * transform.scale;
    this.ctx.font = `bold ${fontSize}px ${this.theme.label.font}`;
    this.ctx.fillStyle = this.theme.label.color;
    this.ctx.textBaseline = "top";

    const nameX = sx + 18 * transform.scale;
    const nameY = sy + 8 * transform.scale;
    const maxTextWidth = sw - 24 * transform.scale;
    const stageName = this.truncateText(stage.stage, maxTextWidth);
    this.ctx.fillText(stageName, nameX, nameY);

    // Duration text below name
    this.ctx.font = `${fontSize * 0.9}px ${this.theme.label.font}`;
    this.ctx.fillStyle = this.theme.timing.textColor;
    const durationText = `${stage.timing.duration}ms`;
    const durationY = nameY + fontSize + 2 * transform.scale;
    this.ctx.fillText(durationText, nameX, durationY);

    // Output summary text
    this.ctx.font = `${fontSize * 0.85}px ${this.theme.label.font}`;
    this.ctx.fillStyle = this.theme.label.color;
    const summaryText = this.truncateText(`→ ${stage.outputSummary}`, maxTextWidth);
    const summaryY = durationY + fontSize * 0.9 + 2 * transform.scale;
    this.ctx.fillText(summaryText, nameX, summaryY);

    // Optional timing bar at bottom
    if (showTiming && totalDuration > 0) {
      const barH = this.theme.timing.barHeight * transform.scale;
      const barY = sy + sh - barH;
      const barW = (stage.timing.duration / totalDuration) * sw;
      this.ctx.fillStyle = this.theme.timing.barColor;
      this.ctx.fillRect(sx, barY, barW, barH);
    }

    return {
      id: stage.id,
      x: sx,
      y: sy,
      width: sw,
      height: sh,
    };
  }

  private renderEdge(
    edge: StageEdge,
    sourceRect: StageNodeRect,
    targetRect: StageNodeRect,
    transform: Transform,
    showDataFlow: boolean,
  ): void {
    // Right-center of source → left-center of target
    const startX = sourceRect.x + sourceRect.width;
    const startY = sourceRect.y + sourceRect.height / 2;
    const endX = targetRect.x;
    const endY = targetRect.y + targetRect.height / 2;

    this.ctx.beginPath();
    this.ctx.moveTo(startX, startY);
    this.ctx.lineTo(endX, endY);
    this.ctx.strokeStyle = this.theme.edge.stroke;
    this.ctx.lineWidth = this.theme.edge.width * transform.scale;
    this.ctx.stroke();

    // Arrow at target end
    const angle = Math.atan2(endY - startY, endX - startX);
    this.renderArrow(endX, endY, angle);

    // Data flow label at midpoint
    if (showDataFlow && edge.dataFlowLabel) {
      const midX = (startX + endX) / 2;
      const midY = (startY + endY) / 2;
      const fontSize = this.theme.label.fontSize * transform.scale * 0.85;
      this.ctx.font = `${fontSize}px ${this.theme.label.font}`;
      this.ctx.fillStyle = this.theme.edge.flowStroke;
      this.ctx.textBaseline = "middle";
      this.ctx.fillText(edge.dataFlowLabel, midX, midY - 6 * transform.scale);
    }
  }

  private renderArrow(x: number, y: number, angle: number): void {
    const size = CanvasRenderer.ARROW_SIZE;
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    this.ctx.lineTo(
      x - size * Math.cos(angle - Math.PI / 6),
      y - size * Math.sin(angle - Math.PI / 6),
    );
    this.ctx.lineTo(
      x - size * Math.cos(angle + Math.PI / 6),
      y - size * Math.sin(angle + Math.PI / 6),
    );
    this.ctx.closePath();
    this.ctx.fillStyle = this.theme.edge.stroke;
    this.ctx.fill();
  }

  private drawRoundedRect(x: number, y: number, w: number, h: number, r: number): void {
    const maxR = Math.min(r, w / 2, h / 2);
    this.ctx.beginPath();
    this.ctx.moveTo(x + maxR, y);
    this.ctx.arcTo(x + w, y, x + w, y + h, maxR);
    this.ctx.arcTo(x + w, y + h, x, y + h, maxR);
    this.ctx.arcTo(x, y + h, x, y, maxR);
    this.ctx.arcTo(x, y, x + w, y, maxR);
    this.ctx.closePath();
  }

  private truncateText(text: string, maxWidth: number): string {
    if (maxWidth <= 0) return "";
    const measured = this.ctx.measureText(text);
    if (measured.width <= maxWidth) return text;
    const ellipsis = "\u2026";
    let truncated = text;
    while (truncated.length > 0 && this.ctx.measureText(truncated + ellipsis).width > maxWidth) {
      truncated = truncated.slice(0, -1);
    }
    return truncated + ellipsis;
  }

  private applyTransform(x: number, y: number, transform: Transform): { x: number; y: number } {
    return {
      x: x * transform.scale + transform.offsetX,
      y: y * transform.scale + transform.offsetY,
    };
  }
}

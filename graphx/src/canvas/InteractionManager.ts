import type { Transform, StageNodeRect } from "./types.ts";
import type { Point } from "../types.ts";
import type { LayoutResult } from "../layout/types.ts";
import { CanvasRenderer } from "./CanvasRenderer.ts";

export class InteractionManager {
  transform: Transform;
  onStageSelect: ((stageId: string | null) => void) | null;
  onStageHover: ((stageId: string | null) => void) | null;

  private canvas: HTMLCanvasElement;
  private isDragging: boolean;
  private dragStart: Point;
  private nodeRects: StageNodeRect[];

  // Zoom limits
  static readonly MIN_SCALE = 0.1;
  static readonly MAX_SCALE = 5.0;
  static readonly ZOOM_FACTOR = 0.1;

  // Bound event handler references for attach/detach
  private _handleMouseDown: (e: MouseEvent) => void;
  private _handleMouseMove: (e: MouseEvent) => void;
  private _handleMouseUp: (e: MouseEvent) => void;
  private _handleWheel: (e: WheelEvent) => void;
  private _handleDblClick: (e: MouseEvent) => void;

  // Layout reference used by dblclick fitToContent
  private _layout: LayoutResult | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.transform = { offsetX: 0, offsetY: 0, scale: 1 };
    this.onStageSelect = null;
    this.onStageHover = null;
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.nodeRects = [];

    // Bind handlers so attach/detach can use the same references
    this._handleMouseDown = (e: MouseEvent) => this.handleMouseDown(e);
    this._handleMouseMove = (e: MouseEvent) => this.handleMouseMove(e);
    this._handleMouseUp = (e: MouseEvent) => this.handleMouseUp(e);
    this._handleWheel = (e: WheelEvent) => this.handleWheel(e);
    this._handleDblClick = (e: MouseEvent) => this.handleDblClick(e);
  }

  /** Update the node rects for hit-testing (called after each render) */
  setNodeRects(rects: StageNodeRect[]): void {
    this.nodeRects = rects;
  }

  /** Hit-test: find which stage node contains the screen point */
  hitTest(screenX: number, screenY: number): string | null {
    for (const rect of this.nodeRects) {
      if (
        screenX >= rect.x &&
        screenX <= rect.x + rect.width &&
        screenY >= rect.y &&
        screenY <= rect.y + rect.height
      ) {
        return rect.id;
      }
    }
    return null;
  }

  /** Convert screen coordinates to world coordinates */
  screenToWorld(screenX: number, screenY: number): Point {
    return {
      x: (screenX - this.transform.offsetX) / this.transform.scale,
      y: (screenY - this.transform.offsetY) / this.transform.scale,
    };
  }

  /** Convert world coordinates to screen coordinates */
  worldToScreen(worldX: number, worldY: number): Point {
    return {
      x: worldX * this.transform.scale + this.transform.offsetX,
      y: worldY * this.transform.scale + this.transform.offsetY,
    };
  }

  /** Auto-fit: adjust transform so all content is visible with padding */
  fitToContent(layout: LayoutResult, canvasWidth: number, canvasHeight: number): void {
    this._layout = layout;

    if (layout.nodes.length === 0) return;

    const W = CanvasRenderer.NODE_WIDTH;
    const H = CanvasRenderer.NODE_HEIGHT;
    const padding = 40;

    // Compute bounding box of all node positions (world space, top-left corner of each node)
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const node of layout.nodes) {
      if (node.x < minX) minX = node.x;
      if (node.y < minY) minY = node.y;
      if (node.x + W > maxX) maxX = node.x + W;
      if (node.y + H > maxY) maxY = node.y + H;
    }

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    const availableWidth = canvasWidth - padding * 2;
    const availableHeight = canvasHeight - padding * 2;

    const scaleX = availableWidth / contentWidth;
    const scaleY = availableHeight / contentHeight;
    const scale = Math.min(scaleX, scaleY, InteractionManager.MAX_SCALE);
    const clampedScale = Math.max(scale, InteractionManager.MIN_SCALE);

    // Center in canvas
    const scaledWidth = contentWidth * clampedScale;
    const scaledHeight = contentHeight * clampedScale;

    const offsetX = (canvasWidth - scaledWidth) / 2 - minX * clampedScale;
    const offsetY = (canvasHeight - scaledHeight) / 2 - minY * clampedScale;

    this.transform = { offsetX, offsetY, scale: clampedScale };
  }

  /** Attach mouse/wheel event listeners to canvas */
  attach(): void {
    this.canvas.addEventListener("mousedown", this._handleMouseDown);
    this.canvas.addEventListener("mousemove", this._handleMouseMove);
    this.canvas.addEventListener("mouseup", this._handleMouseUp);
    this.canvas.addEventListener("wheel", this._handleWheel);
    this.canvas.addEventListener("dblclick", this._handleDblClick);
  }

  /** Detach all event listeners */
  detach(): void {
    this.canvas.removeEventListener("mousedown", this._handleMouseDown);
    this.canvas.removeEventListener("mousemove", this._handleMouseMove);
    this.canvas.removeEventListener("mouseup", this._handleMouseUp);
    this.canvas.removeEventListener("wheel", this._handleWheel);
    this.canvas.removeEventListener("dblclick", this._handleDblClick);
  }

  private handleMouseDown(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    const hit = this.hitTest(screenX, screenY);
    if (hit !== null) {
      // Select clicked node
      this.onStageSelect?.(hit);
    } else {
      // Start panning
      this.isDragging = true;
      this.dragStart = { x: e.clientX - this.transform.offsetX, y: e.clientY - this.transform.offsetY };
      this.onStageSelect?.(null);
    }
  }

  private handleMouseMove(e: MouseEvent): void {
    if (this.isDragging) {
      // Pan
      this.transform = {
        ...this.transform,
        offsetX: e.clientX - this.dragStart.x,
        offsetY: e.clientY - this.dragStart.y,
      };
    } else {
      // Hover hit-test
      const rect = this.canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const hit = this.hitTest(screenX, screenY);
      this.onStageHover?.(hit);
    }
  }

  private handleMouseUp(_e: MouseEvent): void {
    this.isDragging = false;
  }

  private handleWheel(e: WheelEvent): void {
    e.preventDefault();

    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // World position under cursor before zoom
    const worldBefore = this.screenToWorld(screenX, screenY);

    // Adjust scale
    const delta = e.deltaY < 0 ? InteractionManager.ZOOM_FACTOR : -InteractionManager.ZOOM_FACTOR;
    const newScale = Math.min(
      InteractionManager.MAX_SCALE,
      Math.max(InteractionManager.MIN_SCALE, this.transform.scale + delta),
    );

    // Recompute offset so that the point under the cursor stays fixed
    const newOffsetX = screenX - worldBefore.x * newScale;
    const newOffsetY = screenY - worldBefore.y * newScale;

    this.transform = { offsetX: newOffsetX, offsetY: newOffsetY, scale: newScale };
  }

  private handleDblClick(_e: MouseEvent): void {
    if (this._layout) {
      this.fitToContent(this._layout, this.canvas.width, this.canvas.height);
    }
  }
}

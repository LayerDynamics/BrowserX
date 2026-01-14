// ============================================================================
// RENDERING TYPES
// ============================================================================

import type { LayerID, Pixels, RenderObjectID } from "./identifiers.ts";
import type { ComputedStyle } from "./css.ts";
import type { DOMElement, WebGLTexture } from "./dom.ts";

/**
 * Layout box (position and dimensions)
 */
export interface LayoutBox {
    // Position (relative to parent)
    x: Pixels;
    y: Pixels;

    // Content box size
    width: Pixels;
    height: Pixels;

    // Padding
    paddingTop: Pixels;
    paddingRight: Pixels;
    paddingBottom: Pixels;
    paddingLeft: Pixels;

    // Border
    borderTopWidth: Pixels;
    borderRightWidth: Pixels;
    borderBottomWidth: Pixels;
    borderLeftWidth: Pixels;

    // Margin
    marginTop: Pixels;
    marginRight: Pixels;
    marginBottom: Pixels;
    marginLeft: Pixels;

    // Style and content
    style?: ComputedStyle;
    type?: string;
    text?: string;
    children?: LayoutBox[];

    /**
     * Get content box dimensions
     */
    getContentBox(): { x: Pixels; y: Pixels; width: Pixels; height: Pixels };

    /**
     * Get padding box dimensions
     */
    getPaddingBox(): { x: Pixels; y: Pixels; width: Pixels; height: Pixels };

    /**
     * Get border box dimensions
     */
    getBorderBox(): { x: Pixels; y: Pixels; width: Pixels; height: Pixels };

    /**
     * Get margin box dimensions
     */
    getMarginBox(): { x: Pixels; y: Pixels; width: Pixels; height: Pixels };

    /**
     * Get total width (including margin)
     */
    getTotalWidth(): Pixels;

    /**
     * Get total height (including margin)
     */
    getTotalHeight(): Pixels;
}

/**
 * Layout constraints (min/max dimensions)
 */
export interface LayoutConstraints {
    minWidth: Pixels;
    maxWidth: Pixels;
    minHeight: Pixels;
    maxHeight: Pixels;
}

/**
 * Render object (node in render tree)
 */
export interface RenderObject {
    readonly id: RenderObjectID;
    readonly element: DOMElement;
    readonly style: ComputedStyle;

    // Tree structure
    parent: RenderObject | null;
    children: RenderObject[];
    nextSibling: RenderObject | null;

    // Layout
    layout: LayoutBox | null;
    needsLayout: boolean;

    // Paint
    paintLayer: PaintLayer | null;
    needsPaint: boolean;

    /**
     * Mark as needing layout
     */
    markNeedsLayout(): void;

    /**
     * Perform layout
     */
    doLayout(constraints: LayoutConstraints): void;

    /**
     * Mark as needing paint
     */
    markNeedsPaint(): void;

    /**
     * Paint to display list
     */
    paint(context: PaintContext): void;
}

/**
 * Paint command type
 */
export enum PaintCommandType {
    SAVE = "save",
    RESTORE = "restore",
    TRANSLATE = "translate",
    SCALE = "scale",
    ROTATE = "rotate",
    CLIP_RECT = "clipRect",
    FILL_RECT = "fillRect",
    STROKE_RECT = "strokeRect",
    FILL_TEXT = "fillText",
    STROKE_TEXT = "strokeText",
    DRAW_IMAGE = "drawImage",
    FILL_PATH = "fillPath",
    STROKE_PATH = "strokePath",
    SET_FILL_STYLE = "setFillStyle",
    SET_STROKE_STYLE = "setStrokeStyle",
    SET_LINE_WIDTH = "setLineWidth",
    SET_FONT = "setFont",
    SET_GLOBAL_ALPHA = "setGlobalAlpha",
    SET_SHADOW = "setShadow",
    TRANSFORM = "transform",
    SET_OPACITY = "setOpacity",
}

/**
 * Paint command
 */
export interface PaintCommand {
    type: PaintCommandType;
    params?: unknown;
    data?: unknown;
}

/**
 * Paint context (collects paint commands)
 */
export interface PaintContext {
    commands: PaintCommand[];

    /**
     * Fill rectangle
     */
    fillRect(x: Pixels, y: Pixels, width: Pixels, height: Pixels, color: string): void;

    /**
     * Stroke rectangle
     */
    strokeRect(
        x: Pixels,
        y: Pixels,
        width: Pixels,
        height: Pixels,
        color: string,
        lineWidth: Pixels,
    ): void;

    /**
     * Fill text
     */
    fillText(text: string, x: Pixels, y: Pixels, font: string, color: string): void;

    /**
     * Draw image
     */
    drawImage(src: string, x: Pixels, y: Pixels, width: Pixels, height: Pixels): void;

    /**
     * Save graphics state
     */
    save(): void;

    /**
     * Restore graphics state
     */
    restore(): void;

    /**
     * Apply transform
     */
    transform(matrix: TransformMatrix): void;

    /**
     * Set opacity
     */
    setOpacity(opacity: number): void;
}

/**
 * Paint layer
 */
export interface PaintLayer {
    readonly id: LayerID;
    zIndex: number;
    renderObjects: RenderObject[];
    displayList: PaintCommand[];

    // Compositing
    transform: TransformMatrix;
    opacity: number;
    needsCompositing: boolean;

    /**
     * Rasterize layer to bitmap
     */
    rasterize(): ImageBitmap;
}

/**
 * Transform matrix (4x4 for 3D transforms)
 */
export interface TransformMatrix {
    m11: number;
    m12: number;
    m13: number;
    m14: number;
    m21: number;
    m22: number;
    m23: number;
    m24: number;
    m31: number;
    m32: number;
    m33: number;
    m34: number;
    m41: number;
    m42: number;
    m43: number;
    m44: number;

    /**
     * Multiply with another matrix
     */
    multiply(other: TransformMatrix): TransformMatrix;

    /**
     * Translate
     */
    translate(x: Pixels, y: Pixels, z?: Pixels): TransformMatrix;

    /**
     * Scale
     */
    scale(x: number, y: number, z?: number): TransformMatrix;

    /**
     * Rotate (degrees)
     */
    rotate(degrees: number): TransformMatrix;

    /**
     * Get inverse
     */
    inverse(): TransformMatrix;
}

/**
 * Compositor layer data
 */
export interface CompositorLayerData {
    readonly id: LayerID;
    zIndex: number;
    transform: TransformMatrix;
    opacity: number;

    // Tiling
    tiles: Tile[];

    // GPU resources
    texture: WebGLTexture | null;

    /**
     * Upload texture to GPU
     */
    uploadTexture(): void;

    /**
     * Composite layer
     */
    composite(): void;
}

/**
 * Tile (subdivision of layer)
 */
export interface Tile {
    x: Pixels;
    y: Pixels;
    width: Pixels;
    height: Pixels;
    priority: number;
    rasterized: boolean;
    bitmap: ImageBitmap | null;
}

/**
 * Rendering Domain Types
 *
 * Types for render tree inspection, layout analysis, display list viewing,
 * compositor layer inspection, and rendering timing diagnostics.
 * BrowserX-specific DevTools types for the Rendering domain.
 */

/**
 * Render tree node - serialized representation of a RenderObject
 */
export interface RenderTreeNode {
    nodeId: number;
    type: string;
    bounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    childCount: number;
    needsRepaint: boolean;
    needsLayout: boolean;
    layerId?: string;
    children?: RenderTreeNode[];
}

/**
 * Layout box description - serialized representation of a LayoutBox
 */
export interface LayoutBoxDescription {
    x: number;
    y: number;
    width: number;
    height: number;
    paddingTop: number;
    paddingRight: number;
    paddingBottom: number;
    paddingLeft: number;
    borderTop: number;
    borderRight: number;
    borderBottom: number;
    borderLeft: number;
    marginTop: number;
    marginRight: number;
    marginBottom: number;
    marginLeft: number;
}

/**
 * Layout tree node - serialized representation of layout information
 */
export interface LayoutTreeNode {
    nodeId: number;
    box: LayoutBoxDescription;
    childCount: number;
    children?: LayoutTreeNode[];
}

/**
 * Display list entry - serialized paint command
 */
export interface DisplayListEntry {
    type: string;
    data: Record<string, unknown>;
}

/**
 * Compositor layer - serialized representation of a CompositorLayerData
 */
export interface CompositorLayer {
    id: string;
    bounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    opacity: number;
    composited: boolean;
    paintCommandCount: number;
    childCount: number;
}

/**
 * Rendering timing information
 */
export interface RenderingTimingInfo {
    htmlParse: number;
    cssParse: number;
    styleResolution: number;
    renderTreeBuild: number;
    layout: number;
    paint: number;
    composite: number;
    total: number;
}

/**
 * Result of getRenderTree method
 */
export interface GetRenderTreeResult {
    root: RenderTreeNode | null;
}

/**
 * Result of getLayoutTree method
 */
export interface GetLayoutTreeResult {
    root: LayoutTreeNode | null;
}

/**
 * Result of getDisplayList method
 */
export interface GetDisplayListResult {
    commands: DisplayListEntry[];
}

/**
 * Result of getCompositorLayers method
 */
export interface GetCompositorLayersResult {
    layers: CompositorLayer[];
}

/**
 * Result of getRenderingTiming method
 */
export interface GetRenderingTimingResult {
    timing: RenderingTimingInfo;
}

/**
 * Parameters for setShowPaintRects
 */
export interface SetShowPaintRectsParams {
    show: boolean;
}

/**
 * Parameters for setShowLayoutBorders
 */
export interface SetShowLayoutBordersParams {
    show: boolean;
}

/**
 * Parameters for setShowFPSCounter
 */
export interface SetShowFPSCounterParams {
    show: boolean;
}

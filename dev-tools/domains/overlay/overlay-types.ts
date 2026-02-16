/**
 * Overlay Domain Types
 *
 * Types for visual overlay and element inspection in the DevTools.
 * Supports highlighting nodes, rectangles, quads, and frames,
 * as well as inspect mode for interactive element selection.
 */

/**
 * RGBA color value
 */
export interface RGBA {
    r: number;
    g: number;
    b: number;
    a?: number;
}

/**
 * Configuration for how a node highlight should be rendered
 */
export interface HighlightConfig {
    /** Show an info tooltip with tag name, dimensions, etc. */
    showInfo?: boolean;
    /** Show applied styles in the highlight */
    showStyles?: boolean;
    /** Show rulers along the viewport edges */
    showRulers?: boolean;
    /** Show accessibility information in the tooltip */
    showAccessibilityInfo?: boolean;
    /** Color for the content box area */
    contentColor?: RGBA;
    /** Color for the padding area */
    paddingColor?: RGBA;
    /** Color for the border area */
    borderColor?: RGBA;
    /** Color for the margin area */
    marginColor?: RGBA;
}

/**
 * Inspect mode determines how the overlay reacts to user interaction
 */
export type InspectMode =
    | "searchForNode"
    | "searchForUAShadowDOM"
    | "captureAreaScreenshot"
    | "showDistances"
    | "none";

/**
 * Parameters for highlighting a specific DOM node
 */
export interface HighlightNodeParams {
    /** The node to highlight */
    nodeId: number;
    /** How to render the highlight */
    highlightConfig: HighlightConfig;
}

/**
 * Parameters for highlighting an arbitrary rectangle on the page
 */
export interface HighlightRectParams {
    x: number;
    y: number;
    width: number;
    height: number;
    /** Fill color for the rectangle */
    color?: RGBA;
    /** Outline color for the rectangle */
    outlineColor?: RGBA;
}

/**
 * Parameters for highlighting a quadrilateral region
 */
export interface HighlightQuadParams {
    /** Array of x/y coordinate pairs forming a quad (8 numbers) */
    quad: number[];
    /** Fill color for the quad */
    color?: RGBA;
    /** Outline color for the quad */
    outlineColor?: RGBA;
}

/**
 * Parameters for setting the inspect mode
 */
export interface SetInspectModeParams {
    /** The inspect mode to activate */
    mode: InspectMode;
    /** Optional highlight config to use while inspecting */
    highlightConfig?: HighlightConfig;
}

/**
 * Parameters for getting highlight object data for testing
 */
export interface GetHighlightObjectForTestParams {
    /** The node to compute highlight data for */
    nodeId: number;
}

/**
 * Result of getHighlightObjectForTest
 */
export interface GetHighlightObjectForTestResult {
    /** The complete highlight object with box model data */
    highlight: Record<string, unknown>;
}

/**
 * Parameters for highlighting a frame
 */
export interface HighlightFrameParams {
    /** The frame identifier to highlight */
    frameId: string;
    /** Fill color for the frame content area */
    contentColor?: RGBA;
    /** Outline color for the frame border */
    contentOutlineColor?: RGBA;
}

/**
 * Stored rectangle highlight information
 */
export interface HighlightedRect {
    x: number;
    y: number;
    width: number;
    height: number;
    color?: RGBA;
    outlineColor?: RGBA;
}

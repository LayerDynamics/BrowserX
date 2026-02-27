/**
 * Overlay Domain Agent
 *
 * Provides visual overlay functionality for element inspection and highlighting.
 * Renders highlight overlays on DOM nodes, rectangles, quads, and frames.
 * Supports inspect mode for interactive element selection in the viewport.
 *
 * Communicates with the DOM domain via EventBus to resolve node layout data.
 */

import type { DomainName } from "../../protocol/types.ts";
import { BaseDomain } from "../base-domain.ts";
import type { DOMElement, DOMNode } from "../../../browser/src/types/dom.ts";
import { DOMNodeType } from "../../../browser/src/types/dom.ts";
import type { NodeID } from "../../../browser/src/types/identifiers.ts";
import type { LayoutBox } from "../../../browser/src/types/rendering.ts";
import type {
    InspectMode,
    HighlightConfig,
    HighlightNodeParams,
    HighlightRectParams,
    HighlightQuadParams,
    SetInspectModeParams,
    GetHighlightObjectForTestParams,
    GetHighlightObjectForTestResult,
    HighlightFrameParams,
    HighlightedRect,
    RGBA,
} from "./overlay-types.ts";
import { validateParams } from "../../protocol/validate-params.ts";
import { validateHighlightNodeParams, validateHighlightRectParams, validateHighlightQuadParams, validateSetInspectModeParams, validateGetHighlightObjectForTestParams, validateHighlightFrameParams, validateSetShowGridOverlaysParams, validateSetShowFlexOverlaysParams } from "./overlay-validators.ts";

/**
 * Default highlight colors matching Chrome DevTools conventions
 */
const DEFAULT_CONTENT_COLOR: RGBA = { r: 111, g: 168, b: 220, a: 0.66 };
const DEFAULT_PADDING_COLOR: RGBA = { r: 147, g: 196, b: 125, a: 0.55 };
const DEFAULT_BORDER_COLOR: RGBA = { r: 255, g: 229, b: 153, a: 0.66 };
const DEFAULT_MARGIN_COLOR: RGBA = { r: 246, g: 178, b: 107, a: 0.66 };

/**
 * Overlay Domain - visual highlights and inspect mode
 */
export class OverlayDomain extends BaseDomain {
    readonly name: DomainName = "Overlay";

    /** Currently highlighted node ID, or null if none */
    private highlightedNodeId: number | null = null;

    /** Current inspect mode */
    private inspectMode: InspectMode = "none";

    /** Current highlight configuration for the active highlight */
    private highlightConfig: HighlightConfig | null = null;

    /** Active rectangle highlights */
    private highlightedRects: HighlightedRect[] = [];

    /** Active quad highlights */
    private highlightedQuads: Array<{ quad: number[]; color?: RGBA; outlineColor?: RGBA }> = [];

    /** Stored EventBus handler references for cleanup */
    private nodeSelectedHandler: ((data: unknown) => void) | null = null;
    private documentUpdatedHandler: (() => void) | null = null;

    /** Highlighted frame ID */
    private highlightedFrameId: string | null = null;

    /** Whether grid overlays are shown */
    private showGridOverlays: boolean = false;

    /** Whether flex overlays are shown */
    private showFlexOverlays: boolean = false;

    protected setup(): void {
        // Register methods
        this.registerMethod("highlightNode", "Highlight a DOM node with box model overlay", async (params) => {
            return await this.highlightNode(validateParams(params, validateHighlightNodeParams) as HighlightNodeParams);
        });

        this.registerMethod("highlightRect", "Highlight an arbitrary rectangle", async (params) => {
            return await this.highlightRect(validateParams(params, validateHighlightRectParams) as HighlightRectParams);
        });

        this.registerMethod("highlightQuad", "Highlight a quadrilateral region", async (params) => {
            return await this.highlightQuad(validateParams(params, validateHighlightQuadParams) as HighlightQuadParams);
        });

        this.registerMethod("hideHighlight", "Clear all active highlights", async () => {
            return await this.hideHighlight();
        });

        this.registerMethod("setInspectMode", "Set the element inspect mode", async (params) => {
            return await this.setInspectMode(validateParams(params, validateSetInspectModeParams) as SetInspectModeParams);
        });

        this.registerMethod("getHighlightObjectForTest", "Get highlight data for a node (testing)", async (params) => {
            return await this.getHighlightObjectForTest(validateParams(params, validateGetHighlightObjectForTestParams) as GetHighlightObjectForTestParams);
        });

        this.registerMethod("highlightFrame", "Highlight an entire frame", async (params) => {
            return await this.highlightFrame(validateParams(params, validateHighlightFrameParams) as HighlightFrameParams);
        });

        this.registerMethod("setShowGridOverlays", "Toggle CSS grid overlay visualization", async (params) => {
            return await this.setShowGridOverlays(validateParams(params, validateSetShowGridOverlaysParams) as Record<string, unknown>);
        });

        this.registerMethod("setShowFlexOverlays", "Toggle CSS flexbox overlay visualization", async (params) => {
            return await this.setShowFlexOverlays(validateParams(params, validateSetShowFlexOverlaysParams) as Record<string, unknown>);
        });

        // Register events
        this.registerEvent("nodeHighlightRequested", "A node highlight was requested by the overlay");
        this.registerEvent("inspectNodeRequested", "User selected a node while in inspect mode");
        this.registerEvent("screenshotRequested", "Area screenshot requested in capture mode");
        this.registerEvent("inspectModeCanceled", "Inspect mode was canceled");

        // Listen for DOM node selection events from other domains
        this.nodeSelectedHandler = (data: unknown) => {
            if (!this.enabled) return;
            const eventData = data as Record<string, unknown>;
            const nodeId = eventData?.nodeId as number | undefined;
            if (nodeId !== undefined) {
                this.handleNodeSelected(nodeId);
            }
        };
        this.eventBus.on("DOM.nodeSelected", this.nodeSelectedHandler);

        // Listen for DOM document updates to clear stale highlights
        this.documentUpdatedHandler = () => {
            if (!this.enabled) return;
            this.clearAllHighlightState();
        };
        this.eventBus.on("DOM.documentUpdated", this.documentUpdatedHandler);
    }

    override async enable(): Promise<Record<string, unknown>> {
        await super.enable();
        return {};
    }

    override async disable(): Promise<Record<string, unknown>> {
        // Clear all highlights when domain is disabled
        this.clearAllHighlightState();
        if (this.inspectMode !== "none") {
            this.inspectMode = "none";
            this.emitEvent("inspectModeCanceled", {});
        }
        await super.disable();
        return {};
    }

    // ---- Method implementations ----

    /**
     * Highlight a specific DOM node with its box model
     */
    private async highlightNode(params: HighlightNodeParams): Promise<Record<string, unknown>> {
        this.highlightedNodeId = params.nodeId;
        this.highlightConfig = params.highlightConfig;

        // Clear any rectangle/quad highlights when highlighting a node
        this.highlightedRects = [];
        this.highlightedQuads = [];
        this.highlightedFrameId = null;

        // Try to resolve the layout box for this node via the DOM
        const layout = this.getNodeLayout(params.nodeId);

        // Emit the highlight event with resolved layout data
        this.emitEvent("nodeHighlightRequested", {
            nodeId: params.nodeId,
            highlightConfig: params.highlightConfig,
            layout: layout ? this.serializeLayout(layout) : null,
        });

        // Notify via event bus so rendering domain can paint the overlay
        this.eventBus.emit("Overlay.nodeHighlighted", {
            nodeId: params.nodeId,
            highlightConfig: params.highlightConfig,
            layout: layout ? this.serializeLayout(layout) : null,
        });

        return {};
    }

    /**
     * Highlight an arbitrary rectangle on the page
     */
    private async highlightRect(params: HighlightRectParams): Promise<Record<string, unknown>> {
        // Clear node highlight when using rect highlight
        this.highlightedNodeId = null;
        this.highlightConfig = null;
        this.highlightedQuads = [];
        this.highlightedFrameId = null;

        const rect: HighlightedRect = {
            x: params.x,
            y: params.y,
            width: params.width,
            height: params.height,
            color: params.color,
            outlineColor: params.outlineColor,
        };

        this.highlightedRects = [rect];

        this.eventBus.emit("Overlay.rectHighlighted", {
            rect,
        });

        return {};
    }

    /**
     * Highlight a quadrilateral region
     */
    private async highlightQuad(params: HighlightQuadParams): Promise<Record<string, unknown>> {
        // Clear other highlights
        this.highlightedNodeId = null;
        this.highlightConfig = null;
        this.highlightedRects = [];
        this.highlightedFrameId = null;

        const quadEntry = {
            quad: params.quad,
            color: params.color,
            outlineColor: params.outlineColor,
        };

        this.highlightedQuads = [quadEntry];

        this.eventBus.emit("Overlay.quadHighlighted", {
            quad: params.quad,
            color: params.color,
            outlineColor: params.outlineColor,
        });

        return {};
    }

    /**
     * Clear all active highlights
     */
    private async hideHighlight(): Promise<Record<string, unknown>> {
        this.clearAllHighlightState();

        this.eventBus.emit("Overlay.highlightCleared", {});

        return {};
    }

    /**
     * Set the inspect mode for interactive element selection
     */
    private async setInspectMode(params: SetInspectModeParams): Promise<Record<string, unknown>> {
        const previousMode = this.inspectMode;
        this.inspectMode = params.mode;

        if (params.highlightConfig) {
            this.highlightConfig = params.highlightConfig;
        }

        // Emit cancel event if we're leaving an active inspect mode
        if (previousMode !== "none" && params.mode === "none") {
            this.emitEvent("inspectModeCanceled", {});
        }

        // Notify other domains about the mode change
        this.eventBus.emit("Overlay.inspectModeChanged", {
            mode: params.mode,
            highlightConfig: params.highlightConfig ?? null,
        });

        // If entering capture mode, emit screenshot event
        if (params.mode === "captureAreaScreenshot") {
            this.emitEvent("screenshotRequested", {
                mode: "captureAreaScreenshot",
            });
        }

        return {};
    }

    /**
     * Get the highlight object data for a node, used primarily for testing
     */
    private async getHighlightObjectForTest(
        params: GetHighlightObjectForTestParams,
    ): Promise<GetHighlightObjectForTestResult> {
        const layout = this.getNodeLayout(params.nodeId);
        const node = this.getNodeById(params.nodeId);

        if (!layout) {
            return {
                highlight: {
                    nodeId: params.nodeId,
                    contentQuad: [0, 0, 0, 0, 0, 0, 0, 0],
                    paddingQuad: [0, 0, 0, 0, 0, 0, 0, 0],
                    borderQuad: [0, 0, 0, 0, 0, 0, 0, 0],
                    marginQuad: [0, 0, 0, 0, 0, 0, 0, 0],
                    width: 0,
                    height: 0,
                    tagName: node ? (node as DOMElement).tagName ?? node.nodeName : "unknown",
                },
            };
        }

        // Compute box model quads from layout
        const contentBox = this.computeContentQuad(layout);
        const paddingBox = this.computePaddingQuad(layout);
        const borderBox = this.computeBorderQuad(layout);
        const marginBox = this.computeMarginQuad(layout);

        const highlight: Record<string, unknown> = {
            nodeId: params.nodeId,
            contentQuad: contentBox,
            paddingQuad: paddingBox,
            borderQuad: borderBox,
            marginQuad: marginBox,
            contentColor: DEFAULT_CONTENT_COLOR,
            paddingColor: DEFAULT_PADDING_COLOR,
            borderColor: DEFAULT_BORDER_COLOR,
            marginColor: DEFAULT_MARGIN_COLOR,
            width: layout.width,
            height: layout.height,
            tagName: node ? (node as DOMElement).tagName ?? node.nodeName : "unknown",
        };

        // Add element info if available
        if (node && node.nodeType === DOMNodeType.ELEMENT) {
            const element = node as unknown as DOMElement;
            highlight.id = element.id || "";
            highlight.className = element.className || "";
            const attributes: Record<string, string> = {};
            if (element.attributes instanceof Map) {
                for (const [key, value] of element.attributes) {
                    attributes[key] = value;
                }
            }
            highlight.attributes = attributes;
        }

        return { highlight };
    }

    /**
     * Highlight an entire frame
     */
    private async highlightFrame(params: HighlightFrameParams): Promise<Record<string, unknown>> {
        // Clear other highlights
        this.highlightedNodeId = null;
        this.highlightConfig = null;
        this.highlightedRects = [];
        this.highlightedQuads = [];

        this.highlightedFrameId = params.frameId;

        this.eventBus.emit("Overlay.frameHighlighted", {
            frameId: params.frameId,
            contentColor: params.contentColor,
            contentOutlineColor: params.contentOutlineColor,
        });

        return {};
    }

    /**
     * Toggle CSS grid overlay visualization
     */
    private async setShowGridOverlays(params: Record<string, unknown>): Promise<Record<string, unknown>> {
        const gridOverlayConfigs = params.gridNodeHighlightConfigs as unknown[] ?? [];
        this.showGridOverlays = gridOverlayConfigs.length > 0;

        this.eventBus.emit("Overlay.gridOverlaysChanged", {
            enabled: this.showGridOverlays,
            configs: gridOverlayConfigs,
        });

        return {};
    }

    /**
     * Toggle CSS flexbox overlay visualization
     */
    private async setShowFlexOverlays(params: Record<string, unknown>): Promise<Record<string, unknown>> {
        const flexOverlayConfigs = params.flexNodeHighlightConfigs as unknown[] ?? [];
        this.showFlexOverlays = flexOverlayConfigs.length > 0;

        this.eventBus.emit("Overlay.flexOverlaysChanged", {
            enabled: this.showFlexOverlays,
            configs: flexOverlayConfigs,
        });

        return {};
    }

    // ---- Private helpers ----

    /**
     * Handle a node selection event from the DOM domain
     */
    private handleNodeSelected(nodeId: number): void {
        if (this.inspectMode === "searchForNode" || this.inspectMode === "searchForUAShadowDOM") {
            // When in inspect mode, emit inspectNodeRequested with the selected node
            this.emitEvent("inspectNodeRequested", { nodeId });

            // Auto-highlight the selected node with default config
            const config = this.highlightConfig ?? {
                showInfo: true,
                contentColor: DEFAULT_CONTENT_COLOR,
                paddingColor: DEFAULT_PADDING_COLOR,
                borderColor: DEFAULT_BORDER_COLOR,
                marginColor: DEFAULT_MARGIN_COLOR,
            };

            this.highlightedNodeId = nodeId;
            this.highlightConfig = config;

            const layout = this.getNodeLayout(nodeId);
            this.eventBus.emit("Overlay.nodeHighlighted", {
                nodeId,
                highlightConfig: config,
                layout: layout ? this.serializeLayout(layout) : null,
            });
        } else if (this.inspectMode === "showDistances") {
            // In distance mode, highlight the node to show distances to neighboring elements
            const layout = this.getNodeLayout(nodeId);
            this.emitEvent("nodeHighlightRequested", {
                nodeId,
                mode: "showDistances",
                layout: layout ? this.serializeLayout(layout) : null,
            });
        }
    }

    /**
     * Get the layout box for a node by looking up the DOM tree
     */
    private getNodeLayout(nodeId: NodeID): LayoutBox | null {
        const node = this.getNodeById(nodeId);
        if (!node || node.nodeType !== DOMNodeType.ELEMENT) {
            return null;
        }

        const element = node as unknown as DOMElement;
        const renderObj = element.__renderObject;
        if (renderObj && renderObj.layout) {
            return renderObj.layout as LayoutBox;
        }

        return null;
    }

    /**
     * Get a DOM node by its ID from the rendering pipeline
     */
    private getNodeById(nodeId: NodeID): DOMNode | null {
        const pipeline = this.context.renderingPipeline;
        const stats = pipeline.getStats();
        if (stats && typeof stats === "object" && "lastRenderResult" in stats) {
            const result = (stats as Record<string, unknown>).lastRenderResult;
            if (result && typeof result === "object" && "dom" in result) {
                const dom = (result as Record<string, unknown>).dom as DOMNode;
                return this.findNodeById(dom, nodeId);
            }
        }
        return null;
    }

    /**
     * Recursively search for a node by ID in the DOM tree
     */
    private findNodeById(node: DOMNode, nodeId: NodeID): DOMNode | null {
        if (node.nodeId === nodeId) {
            return node;
        }
        if (node.childNodes) {
            for (const child of node.childNodes) {
                const found = this.findNodeById(child, nodeId);
                if (found) {
                    return found;
                }
            }
        }
        return null;
    }

    /**
     * Serialize a LayoutBox to a plain object for event transport
     */
    private serializeLayout(layout: LayoutBox): Record<string, unknown> {
        return {
            x: layout.x,
            y: layout.y,
            width: layout.width,
            height: layout.height,
            paddingTop: layout.paddingTop,
            paddingRight: layout.paddingRight,
            paddingBottom: layout.paddingBottom,
            paddingLeft: layout.paddingLeft,
            borderTopWidth: layout.borderTopWidth,
            borderRightWidth: layout.borderRightWidth,
            borderBottomWidth: layout.borderBottomWidth,
            borderLeftWidth: layout.borderLeftWidth,
            marginTop: layout.marginTop,
            marginRight: layout.marginRight,
            marginBottom: layout.marginBottom,
            marginLeft: layout.marginLeft,
        };
    }

    /**
     * Compute the content quad (8 numbers: 4 x/y pairs) from a LayoutBox
     */
    private computeContentQuad(layout: LayoutBox): number[] {
        const x = layout.x + layout.borderLeftWidth + layout.paddingLeft;
        const y = layout.y + layout.borderTopWidth + layout.paddingTop;
        const w = layout.width;
        const h = layout.height;
        // Quad: top-left, top-right, bottom-right, bottom-left
        return [x, y, x + w, y, x + w, y + h, x, y + h];
    }

    /**
     * Compute the padding quad from a LayoutBox
     */
    private computePaddingQuad(layout: LayoutBox): number[] {
        const x = layout.x + layout.borderLeftWidth;
        const y = layout.y + layout.borderTopWidth;
        const w = layout.width + layout.paddingLeft + layout.paddingRight;
        const h = layout.height + layout.paddingTop + layout.paddingBottom;
        return [x, y, x + w, y, x + w, y + h, x, y + h];
    }

    /**
     * Compute the border quad from a LayoutBox
     */
    private computeBorderQuad(layout: LayoutBox): number[] {
        const x = layout.x;
        const y = layout.y;
        const w = layout.width + layout.paddingLeft + layout.paddingRight +
            layout.borderLeftWidth + layout.borderRightWidth;
        const h = layout.height + layout.paddingTop + layout.paddingBottom +
            layout.borderTopWidth + layout.borderBottomWidth;
        return [x, y, x + w, y, x + w, y + h, x, y + h];
    }

    /**
     * Compute the margin quad from a LayoutBox
     */
    private computeMarginQuad(layout: LayoutBox): number[] {
        const bx = layout.x;
        const by = layout.y;
        const bw = layout.width + layout.paddingLeft + layout.paddingRight +
            layout.borderLeftWidth + layout.borderRightWidth;
        const bh = layout.height + layout.paddingTop + layout.paddingBottom +
            layout.borderTopWidth + layout.borderBottomWidth;
        const x = bx - layout.marginLeft;
        const y = by - layout.marginTop;
        const w = bw + layout.marginLeft + layout.marginRight;
        const h = bh + layout.marginTop + layout.marginBottom;
        return [x, y, x + w, y, x + w, y + h, x, y + h];
    }

    /**
     * Clear all highlight state without emitting events
     */
    private clearAllHighlightState(): void {
        this.highlightedNodeId = null;
        this.highlightConfig = null;
        this.highlightedRects = [];
        this.highlightedQuads = [];
        this.highlightedFrameId = null;
    }

    /**
     * Get the current overlay state for debugging and inspection
     */
    getOverlayState(): Record<string, unknown> {
        return {
            highlightedNodeId: this.highlightedNodeId,
            inspectMode: this.inspectMode,
            highlightConfig: this.highlightConfig,
            highlightedRects: this.highlightedRects,
            highlightedQuads: this.highlightedQuads,
            highlightedFrameId: this.highlightedFrameId,
            showGridOverlays: this.showGridOverlays,
            showFlexOverlays: this.showFlexOverlays,
        };
    }

    override dispose(): void {
        if (this.nodeSelectedHandler) {
            this.eventBus.off("DOM.nodeSelected", this.nodeSelectedHandler);
            this.nodeSelectedHandler = null;
        }
        if (this.documentUpdatedHandler) {
            this.eventBus.off("DOM.documentUpdated", this.documentUpdatedHandler);
            this.documentUpdatedHandler = null;
        }
        this.clearAllHighlightState();
        this.inspectMode = "none";
        this.showGridOverlays = false;
        this.showFlexOverlays = false;
        super.dispose();
    }
}

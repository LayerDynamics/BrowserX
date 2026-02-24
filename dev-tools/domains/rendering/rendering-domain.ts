/**
 * Rendering Domain Agent
 *
 * Provides render tree inspection, layout analysis, display list viewing,
 * compositor layer inspection, and rendering timing diagnostics.
 * Hooks into the RenderingPipeline for access to rendering internals.
 */

import type { DomainName } from "../../protocol/types.ts";
import { BaseDomain } from "../base-domain.ts";
import type {
    RenderTreeNode,
    LayoutTreeNode,
    LayoutBoxDescription,
    DisplayListEntry,
    CompositorLayer,
    RenderingTimingInfo,
    GetRenderTreeResult,
    GetLayoutTreeResult,
    GetDisplayListResult,
    GetCompositorLayersResult,
    GetRenderingTimingResult,
    SetShowPaintRectsParams,
    SetShowLayoutBordersParams,
    SetShowFPSCounterParams,
} from "./rendering-types.ts";
import type { RenderObject, PaintCommand, CompositorLayerData } from "../../../browser/src/types/rendering.ts";

/**
 * Rendering Domain - render tree, layout, paint, and compositor inspection
 */
export class RenderingDomain extends BaseDomain {
    readonly name: DomainName = "Rendering";

    /** Visualization overlay flags */
    private showPaintRects: boolean = false;
    private showLayoutBorders: boolean = false;
    private showFPSCounter: boolean = false;

    protected setup(): void {
        // Register methods
        this.registerMethod("getRenderTree", "Get the current render tree", async (params) => {
            return await this.getRenderTree();
        });

        this.registerMethod("getLayoutTree", "Get the current layout tree", async (params) => {
            return await this.getLayoutTree();
        });

        this.registerMethod("getDisplayList", "Get the current display list", async (params) => {
            return await this.getDisplayList();
        });

        this.registerMethod("getCompositorLayers", "Get compositor layer information", async (params) => {
            return await this.getCompositorLayers();
        });

        this.registerMethod("getRenderingTiming", "Get rendering timing breakdown", async (params) => {
            return await this.getRenderingTiming();
        });

        this.registerMethod("setShowPaintRects", "Toggle paint rectangle visualization", async (params) => {
            return await this.setShowPaintRects(params as unknown as SetShowPaintRectsParams);
        });

        this.registerMethod("setShowLayoutBorders", "Toggle layout border visualization", async (params) => {
            return await this.setShowLayoutBorders(params as unknown as SetShowLayoutBordersParams);
        });

        this.registerMethod("setShowFPSCounter", "Toggle FPS counter overlay", async (params) => {
            return await this.setShowFPSCounter(params as unknown as SetShowFPSCounterParams);
        });

        // Register events
        this.registerEvent("renderingStatsUpdated", "Rendering statistics have been updated");
        this.registerEvent("paintFlashing", "Paint operation occurred in a region");
    }

    override async enable(): Promise<Record<string, unknown>> {
        await super.enable();

        // Emit initial rendering stats if a render result is available
        const lastResult = this.getLastRenderResult();
        if (lastResult) {
            this.emitEvent("renderingStatsUpdated", {
                timing: this.extractTimingInfo(lastResult.timing),
            });
        }

        return {};
    }

    override async disable(): Promise<Record<string, unknown>> {
        // Reset visualization flags when domain is disabled
        this.showPaintRects = false;
        this.showLayoutBorders = false;
        this.showFPSCounter = false;

        return await super.disable();
    }

    // ---- Method implementations ----

    /**
     * Get the render tree serialized as RenderTreeNode hierarchy
     */
    private async getRenderTree(): Promise<GetRenderTreeResult> {
        const lastResult = this.getLastRenderResult();

        if (!lastResult || !lastResult.renderTree) {
            return { root: null };
        }

        try {
            const renderRoot = lastResult.renderTree.getRoot();
            const root = this.serializeRenderObject(renderRoot);
            return { root };
        } catch (_error) {
            return { root: null };
        }
    }

    /**
     * Get the layout tree serialized as LayoutTreeNode hierarchy
     */
    private async getLayoutTree(): Promise<GetLayoutTreeResult> {
        const lastResult = this.getLastRenderResult();

        if (!lastResult || !lastResult.layoutTree) {
            return { root: null };
        }

        try {
            const root = this.serializeLayoutBox(lastResult.layoutTree, 0);
            return { root };
        } catch (_error) {
            return { root: null };
        }
    }

    /**
     * Get the display list as serialized paint commands
     */
    private async getDisplayList(): Promise<GetDisplayListResult> {
        const lastResult = this.getLastRenderResult();

        if (!lastResult || !lastResult.displayList) {
            return { commands: [] };
        }

        try {
            const rawCommands = lastResult.displayList.getCommands();
            const commands: DisplayListEntry[] = rawCommands.map((cmd: PaintCommand) => {
                return this.serializePaintCommand(cmd);
            });
            return { commands };
        } catch (_error) {
            return { commands: [] };
        }
    }

    /**
     * Get compositor layer information
     */
    private async getCompositorLayers(): Promise<GetCompositorLayersResult> {
        const stats = this.context.renderingPipeline.getStats();

        try {
            const compositor = this.context.renderingPipeline.getCompositor();
            const layerManager = compositor.getLayerManager();
            const allLayers = layerManager.getAllLayers();

            const layers: CompositorLayer[] = allLayers.map((layer) => {
                return this.serializeCompositorLayer(layer);
            });

            return { layers };
        } catch (_error) {
            // Fallback: provide basic layer info from stats
            return {
                layers: [{
                    id: "root-layer",
                    bounds: {
                        x: 0,
                        y: 0,
                        width: stats.viewport.width,
                        height: stats.viewport.height,
                    },
                    opacity: 1.0,
                    composited: true,
                    paintCommandCount: 0,
                    childCount: 0,
                }],
            };
        }
    }

    /**
     * Get rendering timing breakdown
     */
    private async getRenderingTiming(): Promise<GetRenderingTimingResult> {
        const lastResult = this.getLastRenderResult();

        if (!lastResult || !lastResult.timing) {
            return {
                timing: {
                    htmlParse: 0,
                    cssParse: 0,
                    styleResolution: 0,
                    renderTreeBuild: 0,
                    layout: 0,
                    paint: 0,
                    composite: 0,
                    total: 0,
                },
            };
        }

        return {
            timing: this.extractTimingInfo(lastResult.timing),
        };
    }

    /**
     * Toggle paint rectangle visualization overlay
     */
    private async setShowPaintRects(params: SetShowPaintRectsParams): Promise<Record<string, unknown>> {
        this.showPaintRects = params.show;

        if (this.showPaintRects && this.enabled) {
            this.emitEvent("paintFlashing", {
                enabled: true,
            });
        }

        return { show: this.showPaintRects };
    }

    /**
     * Toggle layout border visualization overlay
     */
    private async setShowLayoutBorders(params: SetShowLayoutBordersParams): Promise<Record<string, unknown>> {
        this.showLayoutBorders = params.show;
        return { show: this.showLayoutBorders };
    }

    /**
     * Toggle FPS counter overlay
     */
    private async setShowFPSCounter(params: SetShowFPSCounterParams): Promise<Record<string, unknown>> {
        this.showFPSCounter = params.show;

        if (this.showFPSCounter && this.enabled) {
            const compositorStats = this.context.renderingPipeline.getStats().compositor;
            this.emitEvent("renderingStatsUpdated", {
                fps: compositorStats.averageFPS,
                frameCount: compositorStats.frameCount,
                compositeTime: compositorStats.compositeTime,
            });
        }

        return { show: this.showFPSCounter };
    }

    // ---- Serialization helpers ----

    /**
     * Serialize a RenderObject tree to RenderTreeNode format
     */
    private serializeRenderObject(renderObj: RenderObject): RenderTreeNode {
        const layout = renderObj.layout;
        const bounds = layout
            ? { x: layout.x, y: layout.y, width: layout.width, height: layout.height }
            : { x: 0, y: 0, width: 0, height: 0 };

        const node: RenderTreeNode = {
            nodeId: parseInt(renderObj.id, 10) || 0,
            type: renderObj.element?.tagName || "unknown",
            bounds,
            childCount: renderObj.children.length,
            needsRepaint: renderObj.needsPaint,
            needsLayout: renderObj.needsLayout,
        };

        // Include layer ID if a paint layer exists
        if (renderObj.paintLayer) {
            node.layerId = String(renderObj.paintLayer.id);
        }

        // Recursively serialize children
        if (renderObj.children.length > 0) {
            node.children = renderObj.children.map((child) =>
                this.serializeRenderObject(child)
            );
        }

        return node;
    }

    /**
     * Serialize a LayoutBox tree to LayoutTreeNode format
     */
    private serializeLayoutBox(layoutBox: import("../../../browser/src/types/rendering.ts").LayoutBox, nodeId: number): LayoutTreeNode {
        const box: LayoutBoxDescription = {
            x: layoutBox.x,
            y: layoutBox.y,
            width: layoutBox.width,
            height: layoutBox.height,
            paddingTop: layoutBox.paddingTop,
            paddingRight: layoutBox.paddingRight,
            paddingBottom: layoutBox.paddingBottom,
            paddingLeft: layoutBox.paddingLeft,
            borderTop: layoutBox.borderTopWidth,
            borderRight: layoutBox.borderRightWidth,
            borderBottom: layoutBox.borderBottomWidth,
            borderLeft: layoutBox.borderLeftWidth,
            marginTop: layoutBox.marginTop,
            marginRight: layoutBox.marginRight,
            marginBottom: layoutBox.marginBottom,
            marginLeft: layoutBox.marginLeft,
        };

        const childBoxes = layoutBox.children || [];

        // Use DOM nodeId directly when available; fall back to synthetic ID
        const effectiveNodeId = layoutBox.nodeId ?? nodeId;

        const node: LayoutTreeNode = {
            nodeId: effectiveNodeId,
            box,
            childCount: childBoxes.length,
        };

        // Recursively serialize children
        if (childBoxes.length > 0) {
            node.children = childBoxes.map((child, index) => {
                // Synthetic fallback: parent synthetic ID * 1000 + index + 1
                const syntheticChildId = effectiveNodeId * 1000 + index + 1;
                return this.serializeLayoutBox(child, syntheticChildId);
            });
        }

        return node;
    }

    /**
     * Serialize a PaintCommand to DisplayListEntry format
     */
    private serializePaintCommand(cmd: PaintCommand): DisplayListEntry {
        const data: Record<string, unknown> = {};

        // Extract all properties from the command except 'type'
        if (cmd.params !== undefined) {
            if (typeof cmd.params === "object" && cmd.params !== null) {
                Object.assign(data, cmd.params);
            } else {
                data.params = cmd.params;
            }
        }

        if (cmd.data !== undefined) {
            if (typeof cmd.data === "object" && cmd.data !== null) {
                Object.assign(data, cmd.data);
            } else {
                data.data = cmd.data;
            }
        }

        return {
            type: String(cmd.type),
            data,
        };
    }

    /**
     * Serialize a compositor layer to CompositorLayer format
     */
    private serializeCompositorLayer(layer: unknown): CompositorLayer {
        // The layer may be a CompositorLayer from the compositor subsystem
        const layerObj = layer as Record<string, unknown>;

        const id = String(layerObj.id || "unknown");
        const bounds = layerObj.bounds as { x: number; y: number; width: number; height: number } | undefined;
        const opacity = typeof layerObj.opacity === "number" ? layerObj.opacity : 1.0;
        const paintCommands = layerObj.paintCommands as unknown[] | undefined;
        const children = layerObj.children as unknown[] | undefined;

        return {
            id,
            bounds: bounds || { x: 0, y: 0, width: 0, height: 0 },
            opacity,
            composited: true,
            paintCommandCount: paintCommands ? paintCommands.length : 0,
            childCount: children ? children.length : 0,
        };
    }

    /**
     * Extract timing info from the RenderingTiming result
     */
    private extractTimingInfo(timing: import("../../../browser/src/engine/RenderingPipeline.ts").RenderingTiming): RenderingTimingInfo {
        return {
            htmlParse: timing.htmlParse,
            cssParse: timing.cssParse,
            styleResolution: timing.styleResolution,
            renderTreeBuild: 0, // Not separately tracked in RenderingTiming; included in styleResolution
            layout: timing.layoutComputation,
            paint: timing.paintRecording,
            composite: timing.compositing,
            total: timing.total,
        };
    }

    override dispose(): void {
        this.showPaintRects = false;
        this.showLayoutBorders = false;
        this.showFPSCounter = false;
        super.dispose();
    }
}

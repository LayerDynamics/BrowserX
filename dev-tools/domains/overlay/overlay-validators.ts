import { assertObject, requireNumber, requireString } from "../../protocol/validate-params.ts";
import type { HighlightConfig, InspectMode, RGBA } from "./overlay-types.ts";

export function validateHighlightNodeParams(p: unknown) {
    const obj = assertObject(p);
    return {
        nodeId: requireNumber(obj, "nodeId"),
        highlightConfig: obj.highlightConfig as HighlightConfig,
    };
}

export function validateHighlightRectParams(p: unknown) {
    const obj = assertObject(p);
    return {
        x: requireNumber(obj, "x"),
        y: requireNumber(obj, "y"),
        width: requireNumber(obj, "width"),
        height: requireNumber(obj, "height"),
        color: obj.color as RGBA | undefined,
        outlineColor: obj.outlineColor as RGBA | undefined,
    };
}

export function validateHighlightQuadParams(p: unknown) {
    const obj = assertObject(p);
    const quad = obj.quad;
    if (!Array.isArray(quad)) {
        throw new Error("'quad' must be an array");
    }
    return {
        quad: quad as number[],
        color: obj.color as RGBA | undefined,
        outlineColor: obj.outlineColor as RGBA | undefined,
    };
}

export function validateSetInspectModeParams(p: unknown) {
    const obj = assertObject(p);
    return {
        mode: requireString(obj, "mode") as InspectMode,
        highlightConfig: obj.highlightConfig as HighlightConfig | undefined,
    };
}

export function validateGetHighlightObjectForTestParams(p: unknown) {
    const obj = assertObject(p);
    return {
        nodeId: requireNumber(obj, "nodeId"),
    };
}

export function validateHighlightFrameParams(p: unknown) {
    const obj = assertObject(p);
    return {
        frameId: requireString(obj, "frameId"),
        contentColor: obj.contentColor as RGBA | undefined,
        contentOutlineColor: obj.contentOutlineColor as RGBA | undefined,
    };
}

export function validateSetShowGridOverlaysParams(p: unknown) {
    const obj = assertObject(p);
    return {
        gridNodeHighlightConfigs: obj.gridNodeHighlightConfigs as unknown[] ?? [],
    };
}

export function validateSetShowFlexOverlaysParams(p: unknown) {
    const obj = assertObject(p);
    return {
        flexNodeHighlightConfigs: obj.flexNodeHighlightConfigs as unknown[] ?? [],
    };
}

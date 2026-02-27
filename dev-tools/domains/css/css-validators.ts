import { assertObject, requireNumber, requireString } from "../../protocol/validate-params.ts";

export function validateGetComputedStyleParams(p: unknown) {
    const obj = assertObject(p);
    return {
        nodeId: requireNumber(obj, "nodeId"),
    };
}

export function validateGetMatchedStylesParams(p: unknown) {
    const obj = assertObject(p);
    return {
        nodeId: requireNumber(obj, "nodeId"),
    };
}

export function validateGetStyleSheetTextParams(p: unknown) {
    const obj = assertObject(p);
    return {
        styleSheetId: requireString(obj, "styleSheetId"),
    };
}

export function validateForcePseudoStateParams(p: unknown) {
    const obj = assertObject(p);
    const classes = obj.forcedPseudoClasses;
    if (!Array.isArray(classes)) {
        throw new Error("'forcedPseudoClasses' must be an array");
    }
    return {
        nodeId: requireNumber(obj, "nodeId"),
        forcedPseudoClasses: classes as string[],
    };
}

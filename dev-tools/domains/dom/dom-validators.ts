import { assertObject, requireNumber, requireString, optionalNumber } from "../../protocol/validate-params.ts";

export function validateGetDocumentParams(p: unknown) {
    const obj = assertObject(p);
    return {
        depth: optionalNumber(obj, "depth"),
        pierce: obj.pierce as boolean | undefined,
    };
}

export function validateQuerySelectorParams(p: unknown) {
    const obj = assertObject(p);
    return {
        nodeId: requireNumber(obj, "nodeId"),
        selector: requireString(obj, "selector"),
    };
}

export function validateQuerySelectorAllParams(p: unknown) {
    const obj = assertObject(p);
    return {
        nodeId: requireNumber(obj, "nodeId"),
        selector: requireString(obj, "selector"),
    };
}

export function validateGetOuterHTMLParams(p: unknown) {
    const obj = assertObject(p);
    return {
        nodeId: requireNumber(obj, "nodeId"),
    };
}

export function validateSetAttributeValueParams(p: unknown) {
    const obj = assertObject(p);
    return {
        nodeId: requireNumber(obj, "nodeId"),
        name: requireString(obj, "name"),
        value: requireString(obj, "value"),
    };
}

export function validateRemoveAttributeParams(p: unknown) {
    const obj = assertObject(p);
    return {
        nodeId: requireNumber(obj, "nodeId"),
        name: requireString(obj, "name"),
    };
}

export function validateRemoveNodeParams(p: unknown) {
    const obj = assertObject(p);
    return {
        nodeId: requireNumber(obj, "nodeId"),
    };
}

export function validateGetBoxModelParams(p: unknown) {
    const obj = assertObject(p);
    return {
        nodeId: requireNumber(obj, "nodeId"),
    };
}

export function validateRequestChildNodesParams(p: unknown) {
    const obj = assertObject(p);
    return {
        nodeId: requireNumber(obj, "nodeId"),
        depth: optionalNumber(obj, "depth"),
    };
}

export function validatePerformSearchParams(p: unknown) {
    const obj = assertObject(p);
    return {
        query: requireString(obj, "query"),
        includeUserAgentShadowDOM: obj.includeUserAgentShadowDOM as boolean | undefined,
    };
}

export function validateGetSearchResultsParams(p: unknown) {
    const obj = assertObject(p);
    return {
        searchId: requireString(obj, "searchId"),
        fromIndex: requireNumber(obj, "fromIndex"),
        toIndex: requireNumber(obj, "toIndex"),
    };
}

import { assertObject, requireString, requireNumber, optionalString, optionalNumber, optionalBoolean } from "../../protocol/validate-params.ts";

export function validateSetBreakpointParams(p: unknown) {
    const obj = assertObject(p);
    const location = assertObject(obj.location);
    return {
        location: {
            scriptId: requireString(location, "scriptId"),
            lineNumber: requireNumber(location, "lineNumber"),
            columnNumber: optionalNumber(location, "columnNumber"),
        },
        condition: optionalString(obj, "condition"),
    };
}

export function validateSetBreakpointByUrlParams(p: unknown) {
    const obj = assertObject(p);
    return {
        url: requireString(obj, "url"),
        lineNumber: requireNumber(obj, "lineNumber"),
        columnNumber: optionalNumber(obj, "columnNumber"),
        condition: optionalString(obj, "condition"),
    };
}

export function validateRemoveBreakpointParams(p: unknown) {
    const obj = assertObject(p);
    return {
        breakpointId: requireString(obj, "breakpointId"),
    };
}

export function validateGetScriptSourceParams(p: unknown) {
    const obj = assertObject(p);
    return {
        scriptId: requireString(obj, "scriptId"),
    };
}

export function validateEvaluateOnCallFrameParams(p: unknown) {
    const obj = assertObject(p);
    return {
        callFrameId: requireString(obj, "callFrameId"),
        expression: requireString(obj, "expression"),
        objectGroup: optionalString(obj, "objectGroup"),
        includeCommandLineAPI: optionalBoolean(obj, "includeCommandLineAPI"),
        silent: optionalBoolean(obj, "silent"),
        returnByValue: optionalBoolean(obj, "returnByValue"),
    };
}

export function validateGetPossibleBreakpointsParams(p: unknown) {
    const obj = assertObject(p);
    const start = assertObject(obj.start);
    const end = obj.end ? assertObject(obj.end) : undefined;
    return {
        start: {
            scriptId: requireString(start, "scriptId"),
            lineNumber: requireNumber(start, "lineNumber"),
            columnNumber: optionalNumber(start, "columnNumber"),
        },
        end: end ? {
            scriptId: requireString(end, "scriptId"),
            lineNumber: requireNumber(end, "lineNumber"),
            columnNumber: optionalNumber(end, "columnNumber"),
        } : undefined,
    };
}

export function validateGetPropertiesParams(p: unknown) {
    const obj = assertObject(p);
    return {
        objectId: requireString(obj, "objectId"),
    };
}

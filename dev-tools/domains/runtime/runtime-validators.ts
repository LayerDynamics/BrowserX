import { assertObject, requireString, optionalString, optionalNumber, optionalBoolean } from "../../protocol/validate-params.ts";

export function validateEvaluateParams(p: unknown) {
    const obj = assertObject(p);
    return {
        expression: requireString(obj, "expression"),
        objectGroup: optionalString(obj, "objectGroup"),
        includeCommandLineAPI: optionalBoolean(obj, "includeCommandLineAPI"),
        silent: optionalBoolean(obj, "silent"),
        contextId: optionalNumber(obj, "contextId"),
        returnByValue: optionalBoolean(obj, "returnByValue"),
        awaitPromise: optionalBoolean(obj, "awaitPromise"),
        timeout: optionalNumber(obj, "timeout"),
    };
}

export function validateGetPropertiesParams(p: unknown) {
    const obj = assertObject(p);
    return {
        objectId: requireString(obj, "objectId"),
        ownProperties: optionalBoolean(obj, "ownProperties"),
        accessorPropertiesOnly: optionalBoolean(obj, "accessorPropertiesOnly"),
    };
}

export function validateReleaseObjectParams(p: unknown) {
    const obj = assertObject(p);
    return {
        objectId: requireString(obj, "objectId"),
    };
}

export function validateReleaseObjectGroupParams(p: unknown) {
    const obj = assertObject(p);
    return {
        objectGroup: requireString(obj, "objectGroup"),
    };
}

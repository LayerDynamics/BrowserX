import { assertObject } from "../../protocol/validate-params.ts";

function requireBoolean(obj: Record<string, unknown>, key: string): boolean {
    const val = obj[key];
    if (typeof val !== "boolean") {
        throw new Error(`'${key}' must be a boolean`);
    }
    return val;
}

export function validateSetShowPaintRectsParams(p: unknown) {
    const obj = assertObject(p);
    return {
        show: requireBoolean(obj, "show"),
    };
}

export function validateSetShowLayoutBordersParams(p: unknown) {
    const obj = assertObject(p);
    return {
        show: requireBoolean(obj, "show"),
    };
}

export function validateSetShowFPSCounterParams(p: unknown) {
    const obj = assertObject(p);
    return {
        show: requireBoolean(obj, "show"),
    };
}

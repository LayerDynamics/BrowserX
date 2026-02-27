import { assertObject, requireString, optionalString, optionalNumber, optionalBoolean } from "../../protocol/validate-params.ts";

export function validateNavigateParams(p: unknown) {
    const obj = assertObject(p);
    return {
        url: requireString(obj, "url"),
        referrer: optionalString(obj, "referrer"),
        transitionType: optionalString(obj, "transitionType"),
    };
}

export function validateReloadParams(p: unknown) {
    const obj = assertObject(p);
    return {
        ignoreCache: optionalBoolean(obj, "ignoreCache"),
        scriptToEvaluateOnLoad: optionalString(obj, "scriptToEvaluateOnLoad"),
    };
}

export function validateScreenshotParams(p: unknown) {
    const obj = assertObject(p);
    return {
        format: optionalString(obj, "format") as "jpeg" | "png" | "webp" | undefined,
        quality: optionalNumber(obj, "quality"),
        clip: obj.clip as { x: number; y: number; width: number; height: number; scale: number } | undefined,
        fromSurface: optionalBoolean(obj, "fromSurface"),
    };
}

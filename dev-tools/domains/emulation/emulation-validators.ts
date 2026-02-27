import { assertObject, requireString, requireNumber, optionalString, optionalNumber } from "../../protocol/validate-params.ts";
import type { ScreenOrientation, DisplayFeature, MediaFeature, UserAgentMetadata } from "./emulation-types.ts";

function requireBoolean(obj: Record<string, unknown>, key: string): boolean {
    const val = obj[key];
    if (typeof val !== "boolean") {
        throw new Error(`'${key}' must be a boolean`);
    }
    return val;
}

export function validateDeviceMetricsParams(p: unknown) {
    const obj = assertObject(p);
    return {
        width: requireNumber(obj, "width"),
        height: requireNumber(obj, "height"),
        deviceScaleFactor: requireNumber(obj, "deviceScaleFactor"),
        mobile: requireBoolean(obj, "mobile"),
        screenOrientation: obj.screenOrientation as ScreenOrientation | undefined,
        screenWidth: optionalNumber(obj, "screenWidth"),
        screenHeight: optionalNumber(obj, "screenHeight"),
        displayFeature: obj.displayFeature as DisplayFeature | undefined,
    };
}

export function validateSetUserAgentOverrideParams(p: unknown) {
    const obj = assertObject(p);
    return {
        userAgent: requireString(obj, "userAgent"),
        acceptLanguage: optionalString(obj, "acceptLanguage"),
        platform: optionalString(obj, "platform"),
        userAgentMetadata: obj.userAgentMetadata as UserAgentMetadata | undefined,
    };
}

export function validateSetEmulatedMediaParams(p: unknown) {
    const obj = assertObject(p);
    return {
        media: optionalString(obj, "media"),
        features: obj.features as MediaFeature[] | undefined,
    };
}

export function validateSetGeolocationOverrideParams(p: unknown) {
    const obj = assertObject(p);
    return {
        latitude: optionalNumber(obj, "latitude"),
        longitude: optionalNumber(obj, "longitude"),
        accuracy: optionalNumber(obj, "accuracy"),
    };
}

export function validateSetTimezoneOverrideParams(p: unknown) {
    const obj = assertObject(p);
    return {
        timezoneId: requireString(obj, "timezoneId"),
    };
}

export function validateSetLocaleOverrideParams(p: unknown) {
    const obj = assertObject(p);
    return {
        locale: optionalString(obj, "locale"),
    };
}

export function validateSetTouchEmulationEnabledParams(p: unknown) {
    const obj = assertObject(p);
    return {
        enabled: requireBoolean(obj, "enabled"),
        maxTouchPoints: optionalNumber(obj, "maxTouchPoints"),
    };
}

export function validateSetNetworkConditionsParams(p: unknown) {
    const obj = assertObject(p);
    return {
        offline: requireBoolean(obj, "offline"),
        latency: requireNumber(obj, "latency"),
        downloadThroughput: requireNumber(obj, "downloadThroughput"),
        uploadThroughput: requireNumber(obj, "uploadThroughput"),
    };
}

export function validateSetCPUThrottlingRateParams(p: unknown) {
    const obj = assertObject(p);
    return {
        rate: requireNumber(obj, "rate"),
    };
}

export function validateSetScriptExecutionDisabledParams(p: unknown) {
    const obj = assertObject(p);
    return {
        value: requireBoolean(obj, "value"),
    };
}

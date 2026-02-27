import { assertObject, requireString, optionalString, optionalNumber, optionalBoolean, ParamValidationError } from "../../protocol/validate-params.ts";
import type { StorageType } from "./storage-types.ts";

export function validateGetCookiesParams(p: unknown) {
    const obj = assertObject(p);
    return {
        urls: obj.urls as string[] | undefined,
    };
}

export function validateSetCookieParams(p: unknown) {
    const obj = assertObject(p);
    const sameSite = optionalString(obj, "sameSite");
    if (sameSite !== undefined && sameSite !== "Strict" && sameSite !== "Lax" && sameSite !== "None") {
        throw new ParamValidationError("'sameSite' must be 'Strict', 'Lax', or 'None'");
    }
    return {
        name: requireString(obj, "name"),
        value: requireString(obj, "value"),
        domain: optionalString(obj, "domain"),
        path: optionalString(obj, "path"),
        expires: optionalNumber(obj, "expires"),
        httpOnly: optionalBoolean(obj, "httpOnly"),
        secure: optionalBoolean(obj, "secure"),
        sameSite: sameSite as "Strict" | "Lax" | "None" | undefined,
    };
}

export function validateDeleteCookieParams(p: unknown) {
    const obj = assertObject(p);
    return {
        name: requireString(obj, "name"),
        url: optionalString(obj, "url"),
        domain: optionalString(obj, "domain"),
        path: optionalString(obj, "path"),
    };
}

export function validateGetStorageEntriesParams(p: unknown) {
    const obj = assertObject(p);
    return {
        origin: requireString(obj, "origin"),
        storageType: requireString(obj, "storageType") as StorageType,
    };
}

export function validateClearStorageParams(p: unknown) {
    const obj = assertObject(p);
    return {
        origin: requireString(obj, "origin"),
        storageTypes: obj.storageTypes as StorageType[] | undefined,
    };
}

export function validateGetUsageAndQuotaParams(p: unknown) {
    const obj = assertObject(p);
    return {
        origin: requireString(obj, "origin"),
    };
}

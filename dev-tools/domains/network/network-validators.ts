import { assertObject, requireString, optionalString, optionalBoolean } from "../../protocol/validate-params.ts";

export function validateGetResponseBodyParams(p: unknown) {
    const obj = assertObject(p);
    return {
        requestId: requireString(obj, "requestId"),
    };
}

export function validateGetCookiesParams(p: unknown) {
    const obj = assertObject(p);
    return {
        urls: obj.urls as string[] | undefined,
    };
}

export function validateSetCookieParams(p: unknown) {
    const obj = assertObject(p);
    return {
        name: requireString(obj, "name"),
        value: requireString(obj, "value"),
        url: optionalString(obj, "url"),
        domain: optionalString(obj, "domain"),
        path: optionalString(obj, "path"),
        secure: optionalBoolean(obj, "secure"),
        httpOnly: optionalBoolean(obj, "httpOnly"),
        sameSite: optionalString(obj, "sameSite"),
    };
}

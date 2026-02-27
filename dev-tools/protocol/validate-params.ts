/**
 * Parameter Validation Helper
 *
 * Replaces unsafe `as unknown as T` casts with runtime validation.
 * Provides a generic validateParams function and concrete validators
 * for the highest-risk domain param types.
 */

import { ProtocolErrorCode } from "./types.ts";

/**
 * Protocol parameter validation error
 */
export class ParamValidationError extends Error {
    readonly code: number;
    constructor(message: string) {
        super(message);
        this.name = "ParamValidationError";
        this.code = ProtocolErrorCode.INVALID_PARAMS;
    }
}

/**
 * Validate and cast protocol parameters using a validator function.
 *
 * @param params - Raw params from the protocol message
 * @param validator - Function that validates and returns typed params, or throws
 * @returns Validated and typed params
 * @throws ParamValidationError if validation fails
 */
export function validateParams<T>(
    params: unknown,
    validator: (p: unknown) => T,
): T {
    try {
        return validator(params);
    } catch (err) {
        if (err instanceof ParamValidationError) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        throw new ParamValidationError(`Invalid params: ${msg}`);
    }
}

// ---- Helpers (exported for per-domain validator files) ----

export function assertObject(p: unknown): Record<string, unknown> {
    if (p === null || p === undefined || typeof p !== "object" || Array.isArray(p)) {
        throw new ParamValidationError("params must be a non-null object");
    }
    return p as Record<string, unknown>;
}

export function requireString(obj: Record<string, unknown>, key: string): string {
    const val = obj[key];
    if (typeof val !== "string") {
        throw new ParamValidationError(`'${key}' must be a string`);
    }
    return val;
}

export function requireNumber(obj: Record<string, unknown>, key: string): number {
    const val = obj[key];
    if (typeof val !== "number") {
        throw new ParamValidationError(`'${key}' must be a number`);
    }
    return val;
}

export function optionalString(obj: Record<string, unknown>, key: string): string | undefined {
    const val = obj[key];
    if (val === undefined) return undefined;
    if (typeof val !== "string") {
        throw new ParamValidationError(`'${key}' must be a string if provided`);
    }
    return val;
}

export function optionalNumber(obj: Record<string, unknown>, key: string): number | undefined {
    const val = obj[key];
    if (val === undefined) return undefined;
    if (typeof val !== "number") {
        throw new ParamValidationError(`'${key}' must be a number if provided`);
    }
    return val;
}

export function optionalBoolean(obj: Record<string, unknown>, key: string): boolean | undefined {
    const val = obj[key];
    if (val === undefined) return undefined;
    if (typeof val !== "boolean") {
        throw new ParamValidationError(`'${key}' must be a boolean if provided`);
    }
    return val;
}

/**
 * Validate Runtime.evaluate params
 */
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

/**
 * Validate Storage.setCookie params
 */
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

/**
 * Validate DOM.querySelector params
 */
export function validateQuerySelectorParams(p: unknown) {
    const obj = assertObject(p);
    return {
        nodeId: requireNumber(obj, "nodeId"),
        selector: requireString(obj, "selector"),
    };
}

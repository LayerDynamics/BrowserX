import { assertObject, optionalNumber } from "../../protocol/validate-params.ts";

export function validateAssertObject(p: unknown) {
    return assertObject(p);
}

export function validateProfileParams(p: unknown) {
    const obj = assertObject(p);
    return {
        samplingInterval: optionalNumber(obj, "samplingInterval"),
    };
}

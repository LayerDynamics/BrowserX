import { assertObject, optionalNumber, optionalBoolean } from "../../protocol/validate-params.ts";

export function validateAssertObject(p: unknown) {
    return assertObject(p);
}

export function validateTakeHeapSnapshotParams(p: unknown) {
    const obj = assertObject(p);
    return {
        reportProgress: optionalBoolean(obj, "reportProgress"),
        treatGlobalObjectsAsRoots: optionalBoolean(obj, "treatGlobalObjectsAsRoots"),
    };
}

export function validateStartSamplingParams(p: unknown) {
    const obj = assertObject(p);
    return {
        samplingInterval: optionalNumber(obj, "samplingInterval"),
    };
}

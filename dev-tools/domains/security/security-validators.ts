import { assertObject, requireString } from "../../protocol/validate-params.ts";

export function validateGetCertificateParams(p: unknown) {
    const obj = assertObject(p);
    return {
        origin: requireString(obj, "origin"),
    };
}

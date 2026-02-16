/**
 * Security Domain Types
 *
 * Types for security state inspection, certificate details,
 * and mixed content detection.
 */

import type { Certificate } from "../../../browser/src/types/network.ts";

/**
 * Security state of the page
 */
export type SecurityState =
    | "unknown"
    | "neutral"
    | "insecure"
    | "secure"
    | "info";

/**
 * Mixed content type classification
 */
export type MixedContentType =
    | "blockable"
    | "optionally-blockable"
    | "none";

/**
 * Certificate information for protocol transport
 */
export interface CertificateInfo {
    subject: string;
    issuer: string;
    validFrom: string;
    validTo: string;
    serialNumber: string;
    fingerprint: string;
    protocol: string;
    keyExchange: string;
    cipher: string;
    subjectAltNames: string[];
}

/**
 * Security state explanation entry
 * Describes a factor contributing to the overall security state
 */
export interface SecurityStateExplanation {
    securityState: SecurityState;
    title: string;
    summary: string;
    description: string;
    mixedContentType: MixedContentType;
    certificate?: CertificateInfo;
}

/**
 * Insecure content status for the page
 */
export interface InsecureContentStatus {
    ranMixedContent: boolean;
    displayedMixedContent: boolean;
    ranInsecureContentStyle: SecurityState;
    displayedInsecureContentStyle: SecurityState;
}

// ============================================================================
// Method Params and Results
// ============================================================================

/**
 * Result for getSecurityState method
 */
export interface GetSecurityStateResult {
    securityState: SecurityState;
    explanations: SecurityStateExplanation[];
    summary: string;
}

/**
 * Parameters for getCertificate method
 */
export interface GetCertificateParams {
    origin: string;
}

/**
 * Result for getCertificate method
 */
export interface GetCertificateResult {
    certificate: CertificateInfo | null;
}

/**
 * Convert an internal Certificate to a CertificateInfo for protocol transport
 */
export function certificateToCertificateInfo(cert: Certificate): CertificateInfo {
    return {
        subject: cert.subject,
        issuer: cert.issuer,
        validFrom: cert.notBefore.toISOString(),
        validTo: cert.notAfter.toISOString(),
        serialNumber: cert.serialNumber,
        fingerprint: cert.signatureAlgorithm,
        protocol: "TLS 1.3",
        keyExchange: "ECDHE",
        cipher: cert.signatureAlgorithm,
        subjectAltNames: cert.subjectAltNames || [],
    };
}

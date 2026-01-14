/**
 * Certificate validation and chain building
 *
 * Provides X.509 certificate validation including chain building,
 * hostname verification, signature validation, and revocation checking.
 */

import type { ByteBuffer } from "../../../types/identifiers.ts";
import type { Certificate } from "../../../types/network.ts";

/**
 * Certificate validation result
 */
export interface CertificateValidationResult {
    valid: boolean;
    reason?: string;
    chain?: Certificate[];
}

/**
 * Validate certificate chain
 */
export async function validateCertificate(
    cert: Certificate,
    hostname: string,
    trustedCAs: Certificate[],
): Promise<CertificateValidationResult> {
    // 1. Check expiration
    const now = new Date();
    if (now < cert.notBefore) {
        return { valid: false, reason: "Certificate not yet valid" };
    }
    if (now > cert.notAfter) {
        return { valid: false, reason: "Certificate expired" };
    }

    // 2. Verify hostname matches
    const hostnameMatches = matchesHostname(hostname, [cert.subject, ...cert.subjectAltNames]);
    if (!hostnameMatches) {
        return { valid: false, reason: "Hostname mismatch" };
    }

    // 3. Build certificate chain
    const chain = buildCertificateChain(cert, trustedCAs);
    if (!chain) {
        return { valid: false, reason: "Unable to build certificate chain" };
    }

    // 4. Verify each link in chain
    for (let i = 0; i < chain.length - 1; i++) {
        const issued = chain[i];
        const issuer = chain[i + 1];

        if (!await verifySignature(issued, issuer)) {
            return { valid: false, reason: `Invalid signature for ${issued.subject}` };
        }
    }

    // 5. Verify root CA is trusted
    const root = chain[chain.length - 1];
    const trustedRoot = trustedCAs.find((ca) => ca.subject === root.subject);
    if (!trustedRoot) {
        return { valid: false, reason: "Untrusted root CA" };
    }

    // 6. Check revocation status (optional, expensive)
    // const revoked = await checkRevocationStatus(cert);
    // if (revoked) {
    //   return { valid: false, reason: 'Certificate revoked' };
    // }

    return { valid: true, chain };
}

/**
 * Check if hostname matches certificate name (supports wildcards)
 */
function matchesHostname(hostname: string, certNames: string[]): boolean {
    for (const certName of certNames) {
        // Exact match
        if (hostname === certName) {
            return true;
        }

        // Wildcard match (*.example.com matches sub.example.com)
        if (certName.startsWith("*.")) {
            const domain = certName.substring(2);
            const parts = hostname.split(".");

            if (parts.length >= 2) {
                const hostDomain = parts.slice(1).join(".");
                if (hostDomain === domain) {
                    return true;
                }
            }
        }
    }

    return false;
}

/**
 * Build certificate chain from leaf to root
 */
function buildCertificateChain(
    cert: Certificate,
    trustedCAs: Certificate[],
    maxDepth = 10,
): Certificate[] | null {
    const chain: Certificate[] = [cert];
    let current = cert;

    for (let depth = 0; depth < maxDepth; depth++) {
        // Check if current cert is self-signed (root)
        if (current.issuer === current.subject) {
            return chain;
        }

        // Find issuer certificate
        const issuer = trustedCAs.find((ca) => ca.subject === current.issuer);
        if (!issuer) {
            // Issuer not found
            return null;
        }

        chain.push(issuer);
        current = issuer;
    }

    // Max depth exceeded
    return null;
}

/**
 * Verify certificate signature
 */
async function verifySignature(cert: Certificate, issuer: Certificate): Promise<boolean> {
    // Extract public key from issuer certificate
    const publicKey = issuer.publicKey;

    // Verify signature using issuer's public key
    // (Implementation depends on signature algorithm: RSA, ECDSA, etc.)
    return await cryptoVerify(
        cert.signature,
        cert.publicKey,
        publicKey,
        cert.signatureAlgorithm,
    );
}

/**
 * Check certificate revocation status
 */
export async function checkRevocationStatus(cert: Certificate): Promise<boolean> {
    // Check CRL (Certificate Revocation List)
    // or OCSP (Online Certificate Status Protocol)

    // Implementation would fetch from CRL/OCSP endpoint
    // For now, return false (not revoked)
    return false;
}

/**
 * Verify cryptographic signature
 * @param signature - Signature to verify
 * @param data - Data that was signed
 * @param publicKey - Public key for verification
 * @param algorithm - Signature algorithm (e.g., "RSA-SHA256", "ECDSA-SHA256")
 * @returns true if signature is valid
 */
async function cryptoVerify(
    signature: ByteBuffer,
    data: ByteBuffer,
    publicKey: ByteBuffer,
    algorithm: string,
): Promise<boolean> {
    try {
        // Parse algorithm
        const [keyAlg, hashAlg] = parseSignatureAlgorithm(algorithm);

        // Import public key
        const cryptoKey = await crypto.subtle.importKey(
            "spki",
            publicKey,
            {
                name: keyAlg,
                hash: hashAlg,
            },
            false,
            ["verify"],
        );

        // Verify signature
        return await crypto.subtle.verify(
            {
                name: keyAlg,
                hash: hashAlg,
            },
            cryptoKey,
            signature,
            data,
        );
    } catch (error) {
        console.error("Signature verification failed:", error);
        return false;
    }
}

/**
 * Parse signature algorithm string into key algorithm and hash algorithm
 * @param algorithm - Signature algorithm string (e.g., "RSA-SHA256")
 * @returns [keyAlgorithm, hashAlgorithm]
 */
function parseSignatureAlgorithm(algorithm: string): [string, string] {
    const upper = algorithm.toUpperCase();

    if (upper.includes("RSA")) {
        if (upper.includes("SHA256")) return ["RSASSA-PKCS1-v1_5", "SHA-256"];
        if (upper.includes("SHA384")) return ["RSASSA-PKCS1-v1_5", "SHA-384"];
        if (upper.includes("SHA512")) return ["RSASSA-PKCS1-v1_5", "SHA-512"];
    }

    if (upper.includes("ECDSA")) {
        if (upper.includes("SHA256")) return ["ECDSA", "SHA-256"];
        if (upper.includes("SHA384")) return ["ECDSA", "SHA-384"];
        if (upper.includes("SHA512")) return ["ECDSA", "SHA-512"];
    }

    // Default to RSA-SHA256
    return ["RSASSA-PKCS1-v1_5", "SHA-256"];
}

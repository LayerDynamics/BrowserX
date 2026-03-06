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
 * @param cert - The leaf (server) certificate to validate
 * @param hostname - The hostname to verify against the certificate
 * @param trustedCAs - Array of trusted root CA certificates
 * @param intermediateCerts - Optional array of intermediate certificates provided by the server
 */
export async function validateCertificate(
  cert: Certificate,
  hostname: string,
  trustedCAs: Certificate[],
  intermediateCerts: Certificate[] = [],
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

  // 3. Build certificate chain using both intermediate certs and trusted CAs
  const chain = buildCertificateChain(cert, trustedCAs, intermediateCerts);
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
  const trustedRoot = trustedCAs.find((ca) =>
    ca.subject === root.subject &&
    ca.serialNumber === root.serialNumber &&
    arraysEqual(ca.publicKey, root.publicKey)
  );
  if (!trustedRoot) {
    return { valid: false, reason: "Untrusted root CA" };
  }

  // 6. Check revocation status (optional, expensive)
  const issuerCert = chain.length > 1 ? chain[1] : undefined;
  const revoked = await checkRevocationStatus(cert, issuerCert);
  if (revoked) {
    return { valid: false, reason: "Certificate revoked" };
  }

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

      if (parts.length >= 3 && domain.split(".").length >= 2) {
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
 * @param cert - The leaf certificate
 * @param trustedCAs - Array of trusted root CA certificates
 * @param intermediateCerts - Array of intermediate certificates provided by the server
 * @param maxDepth - Maximum chain depth (default 10)
 */
function buildCertificateChain(
  cert: Certificate,
  trustedCAs: Certificate[],
  intermediateCerts: Certificate[] = [],
  maxDepth = 10,
): Certificate[] | null {
  const chain: Certificate[] = [cert];
  let current = cert;

  // Combine intermediate certs with trusted CAs for issuer lookup
  // Intermediates are searched first, then trusted CAs
  const allCerts = [...intermediateCerts, ...trustedCAs];

  for (let depth = 0; depth < maxDepth; depth++) {
    // Check if current cert is self-signed (root)
    if (current.issuer === current.subject) {
      return chain;
    }

    // Find issuer certificate in intermediates or trusted CAs
    // Verify both subject name match AND public key linkage for chain integrity
    const issuer = allCerts.find((ca) => {
      if (ca.subject !== current.issuer) return false;
      // If the current cert has an issuerPublicKey field, verify it matches the candidate's publicKey
      const currentWithIssuerKey = current as Certificate & { issuerPublicKey?: ByteBuffer };
      if (currentWithIssuerKey.issuerPublicKey) {
        return arraysEqual(currentWithIssuerKey.issuerPublicKey, ca.publicKey);
      }
      return true;
    });
    if (!issuer) {
      // Issuer not found in provided certificates
      // This could mean we're missing an intermediate or the root CA isn't trusted
      return null;
    }

    chain.push(issuer);
    current = issuer;

    // If we've reached a trusted root CA, we're done
    // Note: A certificate is considered a valid root if:
    // 1. It's self-signed (issuer === subject), OR
    // 2. It's directly in our trusted CA list (handles cross-signed roots)
    const isInTrustedStore = trustedCAs.some((ca) => ca.subject === current.subject);

    if (isInTrustedStore) {
      return chain;
    }
  }

  // Max depth exceeded
  return null;
}

/**
 * Verify certificate signature
 */
async function verifySignature(cert: Certificate, issuer: Certificate): Promise<boolean> {
  // Reject weak signature algorithms
  if (cert.signatureAlgorithm === "RSA-SHA1" || cert.signatureAlgorithm === "RSA-MD5") {
    console.error(`Rejecting certificate with weak signature algorithm: ${cert.signatureAlgorithm}`);
    return false;
  }

  // The TBS (To-Be-Signed) certificate data is what was signed
  const tbsData = cert.tbsCertificate;
  if (!tbsData) {
    console.error("Cannot verify signature: missing TBS certificate data");
    return false;
  }

  // Extract public key from issuer certificate
  const publicKey = issuer.publicKey;

  // Verify signature using issuer's public key
  return await cryptoVerify(
    cert.signature,
    tbsData,
    publicKey,
    cert.signatureAlgorithm,
  );
}

/**
 * DER-encode a Distinguished Name string (e.g., "CN=Example CA, O=Example Inc") into ASN.1 RDN SEQUENCE.
 * Used as fallback when raw DER issuer bytes are not available.
 * Produces: SEQUENCE { SET { SEQUENCE { OID, PrintableString } } ... }
 */
export function derEncodeDistinguishedName(dn: string): Uint8Array {
  // Parse "KEY=value, KEY=value" format
  const rdnParts: { oid: Uint8Array; value: string }[] = [];

  // RDN attribute type OIDs (2.5.4.x)
  const oidMap: Record<string, Uint8Array> = {
    "CN": new Uint8Array([0x55, 0x04, 0x03]),
    "C": new Uint8Array([0x55, 0x04, 0x06]),
    "L": new Uint8Array([0x55, 0x04, 0x07]),
    "ST": new Uint8Array([0x55, 0x04, 0x08]),
    "O": new Uint8Array([0x55, 0x04, 0x0a]),
    "OU": new Uint8Array([0x55, 0x04, 0x0b]),
  };

  // Split on ", " but handle values that may contain commas within (simple heuristic)
  const parts = dn.split(/,\s*/);
  for (const part of parts) {
    const eqIdx = part.indexOf("=");
    if (eqIdx === -1) continue;
    const key = part.substring(0, eqIdx).trim().toUpperCase();
    const value = part.substring(eqIdx + 1).trim();
    const oid = oidMap[key];
    if (oid) {
      rdnParts.push({ oid, value });
    }
  }

  // Build SET OF AttributeTypeAndValue for each RDN
  const encoder = new TextEncoder();
  const sets: Uint8Array[] = [];
  for (const { oid, value } of rdnParts) {
    const oidTLV = derWrap(0x06, oid);
    const valueTLV = derWrap(0x13, encoder.encode(value)); // PrintableString
    const atv = derWrap(0x30, new Uint8Array([...oidTLV, ...valueTLV])); // SEQUENCE
    const set = derWrap(0x31, atv); // SET
    sets.push(set);
  }

  // Concatenate all SETs and wrap in outer SEQUENCE
  const totalLen = sets.reduce((acc, s) => acc + s.length, 0);
  const allSets = new Uint8Array(totalLen);
  let offset = 0;
  for (const s of sets) {
    allSets.set(s, offset);
    offset += s.length;
  }

  return derWrap(0x30, allSets);
}

/**
 * Check certificate revocation status
 */
export async function checkRevocationStatus(cert: Certificate, issuerCert?: Certificate): Promise<boolean> {
  // Extract AIA OCSP responder URL from the certificate's parsed extensions
  // The parseDERCertificate function stores it on the cert object if found
  const ocspUrl = (cert as Certificate & { ocspResponderUrl?: string }).ocspResponderUrl;

  if (!ocspUrl) {
    // No AIA extension with OCSP URL — soft-fail as not revoked
    return false;
  }

  try {
    // Build a minimal OCSP request
    // Serial number bytes from hex string
    const serialHex = cert.serialNumber.replace(/:/g, "");
    const serialBytes = new Uint8Array(serialHex.length / 2);
    for (let i = 0; i < serialBytes.length; i++) {
      serialBytes[i] = parseInt(serialHex.substring(i * 2, i * 2 + 2), 16);
    }

    // SHA-1 OID: 1.3.14.3.2.26
    const sha1OID = new Uint8Array([0x06, 0x05, 0x2b, 0x0e, 0x03, 0x02, 0x1a]);
    const nullParam = new Uint8Array([0x05, 0x00]);

    // hashAlgorithm SEQUENCE
    const hashAlgContent = new Uint8Array([...sha1OID, ...nullParam]);
    const hashAlg = derWrap(0x30, hashAlgContent);

    // Compute SHA-1 hashes of issuer name and public key for CertID
    let nameHashBytes: Uint8Array;
    let keyHashBytes: Uint8Array;
    if (issuerCert) {
      // RFC 6960: issuerNameHash is SHA-1 of the DER-encoded issuer DN, NOT text encoding
      // Use cert.issuerRaw (raw DER of the issuer field) if available, otherwise fall back to
      // the issuer cert's subject DN raw bytes, or finally DER-encode from the string
      const issuerDNBytes = (cert as Certificate & { issuerRaw?: ByteBuffer }).issuerRaw
        ?? (issuerCert as Certificate & { issuerRaw?: ByteBuffer }).issuerRaw
        ?? derEncodeDistinguishedName(cert.issuer);
      nameHashBytes = new Uint8Array(await crypto.subtle.digest("SHA-1", issuerDNBytes as BufferSource));
      keyHashBytes = new Uint8Array(await crypto.subtle.digest("SHA-1", issuerCert.publicKey));
    } else {
      // No issuer cert available — use zero-byte placeholders (OCSP responder may return "unknown")
      nameHashBytes = new Uint8Array(20);
      keyHashBytes = new Uint8Array(20);
    }
    const issuerNameHash = new Uint8Array([0x04, 20, ...nameHashBytes]);
    const issuerKeyHash = new Uint8Array([0x04, 20, ...keyHashBytes]);
    const serialInt = new Uint8Array([0x02, serialBytes.length, ...serialBytes]);

    const certID = derWrap(0x30, new Uint8Array([...hashAlg, ...issuerNameHash, ...issuerKeyHash, ...serialInt]));
    const request = derWrap(0x30, certID);
    const requestList = derWrap(0x30, request);
    const tbsRequest = derWrap(0x30, requestList);
    const ocspRequest = derWrap(0x30, tbsRequest);

    const response = await fetch(ocspUrl, {
      method: "POST",
      headers: { "Content-Type": "application/ocsp-request" },
      body: new Uint8Array(ocspRequest),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      // Network/server error — soft-fail
      return false;
    }

    const responseData = new Uint8Array(await response.arrayBuffer());

    // Parse OCSP response ASN.1 structure to find certStatus
    // OCSPResponse ::= SEQUENCE { responseStatus ENUMERATED, responseBytes [0] EXPLICIT ... }
    if (responseData.length < 3 || responseData[0] !== 0x30) return false;

    const certStatus = parseOCSPCertStatus(responseData as ByteBuffer);
    if (certStatus === "good") return false;
    if (certStatus === "revoked") return true;

    return false;
  } catch {
    // Network error — soft-fail as not revoked
    return false;
  }
}

/**
 * Parse OCSP response ASN.1 structure to extract certStatus.
 * Walks: OCSPResponse SEQUENCE → responseBytes [0] → BasicOCSPResponse → responses → SingleResponse → certStatus
 * Returns "good", "revoked", or "unknown".
 */
function parseOCSPCertStatus(data: ByteBuffer): "good" | "revoked" | "unknown" {
  try {
    let offset = 0;

    // OCSPResponse ::= SEQUENCE
    if (data[offset] !== 0x30) return "unknown";
    offset++;
    const { length: _outerLen, bytesRead: outerBR } = parseDERLength(data, offset);
    offset += outerBR;

    // responseStatus ENUMERATED
    if (data[offset] !== 0x0a) return "unknown";
    offset++;
    const statusLen = data[offset++];
    const responseStatus = data[offset];
    offset += statusLen;
    if (responseStatus !== 0) return "unknown"; // not "successful"

    // responseBytes [0] EXPLICIT
    if (data[offset] !== 0xa0) return "unknown";
    offset++;
    const { bytesRead: rbBR } = parseDERLength(data, offset);
    offset += rbBR;

    // ResponseBytes ::= SEQUENCE
    if (data[offset] !== 0x30) return "unknown";
    offset++;
    const { bytesRead: rbSeqBR } = parseDERLength(data, offset);
    offset += rbSeqBR;

    // responseType OID — skip it
    if (data[offset] !== 0x06) return "unknown";
    offset++;
    const oidLen = data[offset++];
    offset += oidLen;

    // response OCTET STRING containing BasicOCSPResponse
    if (data[offset] !== 0x04) return "unknown";
    offset++;
    const { bytesRead: octetBR } = parseDERLength(data, offset);
    offset += octetBR;

    // BasicOCSPResponse ::= SEQUENCE
    if (data[offset] !== 0x30) return "unknown";
    offset++;
    const { bytesRead: basicBR } = parseDERLength(data, offset);
    offset += basicBR;

    // tbsResponseData ::= SEQUENCE
    if (data[offset] !== 0x30) return "unknown";
    offset++;
    const { bytesRead: tbsBR } = parseDERLength(data, offset);
    offset += tbsBR;

    // Skip optional version [0] if present
    if (data[offset] === 0xa0) {
      offset++;
      const { length: vLen, bytesRead: vBR } = parseDERLength(data, offset);
      offset += vBR + vLen;
    }

    // responderID — either [1] (byName) or [2] (byKey)
    if (data[offset] === 0xa1 || data[offset] === 0xa2) {
      offset++;
      const { length: ridLen, bytesRead: ridBR } = parseDERLength(data, offset);
      offset += ridBR + ridLen;
    } else {
      return "unknown";
    }

    // producedAt GeneralizedTime
    if (data[offset] === 0x18 || data[offset] === 0x17) {
      offset++;
      const { length: tLen, bytesRead: tBR } = parseDERLength(data, offset);
      offset += tBR + tLen;
    } else {
      return "unknown";
    }

    // responses SEQUENCE OF SingleResponse
    if (data[offset] !== 0x30) return "unknown";
    offset++;
    const { bytesRead: rspsBR } = parseDERLength(data, offset);
    offset += rspsBR;

    // First SingleResponse SEQUENCE
    if (data[offset] !== 0x30) return "unknown";
    offset++;
    const { bytesRead: srBR } = parseDERLength(data, offset);
    offset += srBR;

    // certID SEQUENCE — skip
    if (data[offset] !== 0x30) return "unknown";
    offset++;
    const { length: cidLen, bytesRead: cidBR } = parseDERLength(data, offset);
    offset += cidBR + cidLen;

    // certStatus: good [0] IMPLICIT NULL, revoked [1] CONSTRUCTED, unknown [2] IMPLICIT NULL
    const statusTag = data[offset];
    if (statusTag === 0x80) return "good";
    if (statusTag === 0xa1) return "revoked";
    if (statusTag === 0x82) return "unknown";

    return "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Wrap content with a DER tag and length
 */
function derWrap(tag: number, content: Uint8Array): Uint8Array {
  let lengthBytes: Uint8Array;
  if (content.length < 0x80) {
    lengthBytes = new Uint8Array([content.length]);
  } else if (content.length < 0x100) {
    lengthBytes = new Uint8Array([0x81, content.length]);
  } else {
    lengthBytes = new Uint8Array([0x82, (content.length >> 8) & 0xff, content.length & 0xff]);
  }
  const result = new Uint8Array(1 + lengthBytes.length + content.length);
  result[0] = tag;
  result.set(lengthBytes, 1);
  result.set(content, 1 + lengthBytes.length);
  return result;
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

    // Build import and verify parameters based on key algorithm
    let importParams: AlgorithmIdentifier | RsaHashedImportParams | EcKeyImportParams;
    let verifyParams: AlgorithmIdentifier | RsaHashedImportParams | EcdsaParams;

    if (keyAlg === "ECDSA") {
      // ECDSA requires namedCurve for import, hash for verify
      // Determine curve from hash algorithm
      const namedCurve = hashAlg === "SHA-384"
        ? "P-384"
        : hashAlg === "SHA-512"
        ? "P-521"
        : "P-256";
      importParams = { name: "ECDSA", namedCurve } as EcKeyImportParams;
      verifyParams = { name: "ECDSA", hash: hashAlg } as EcdsaParams;
    } else {
      // RSA uses hash for both import and verify
      importParams = { name: keyAlg, hash: hashAlg };
      verifyParams = { name: keyAlg };
    }

    // Import public key
    const cryptoKey = await crypto.subtle.importKey(
      "spki",
      publicKey,
      importParams,
      false,
      ["verify"],
    );

    // For ECDSA, convert DER-encoded signature to raw IEEE P1363 format
    let sigBytes: ByteBuffer = signature;
    if (keyAlg === "ECDSA") {
      sigBytes = derEcdsaSignatureToRaw(signature) as ByteBuffer;
    }

    // Verify signature
    return await crypto.subtle.verify(
      verifyParams,
      cryptoKey,
      sigBytes,
      data,
    );
  } catch (error) {
    console.error("Signature verification failed:", error);
    return false;
  }
}

/**
 * Convert DER-encoded ECDSA signature (ASN.1 SEQUENCE of r,s INTEGERs) to raw IEEE P1363 format (r||s)
 * Web Crypto API requires raw format for ECDSA verification
 */
function derEcdsaSignatureToRaw(derSig: ByteBuffer): Uint8Array {
  let offset = 0;

  // Parse outer SEQUENCE
  if (derSig[offset] !== 0x30) {
    throw new Error("Invalid ECDSA signature: expected SEQUENCE");
  }
  offset++;
  // Skip length
  if (derSig[offset] & 0x80) {
    offset += (derSig[offset] & 0x7f) + 1;
  } else {
    offset++;
  }

  // Parse r INTEGER
  if (derSig[offset] !== 0x02) {
    throw new Error("Invalid ECDSA signature: expected INTEGER for r");
  }
  offset++;
  const rLen = derSig[offset++];
  let rStart = offset;
  let rSize = rLen;
  // Skip leading zero padding (used for positive sign)
  if (derSig[rStart] === 0x00 && rSize > 1) {
    rStart++;
    rSize--;
  }
  offset += rLen;

  // Parse s INTEGER
  if (derSig[offset] !== 0x02) {
    throw new Error("Invalid ECDSA signature: expected INTEGER for s");
  }
  offset++;
  const sLen = derSig[offset++];
  let sStart = offset;
  let sSize = sLen;
  // Skip leading zero padding
  if (derSig[sStart] === 0x00 && sSize > 1) {
    sStart++;
    sSize--;
  }

  // Determine component size (32 bytes for P-256, 48 for P-384, 66 for P-521)
  const componentSize = Math.max(rSize, sSize);
  // Round up to standard sizes
  const padSize = componentSize <= 32 ? 32 : componentSize <= 48 ? 48 : 66;

  // Build raw signature: r || s, each zero-padded to padSize
  const raw = new Uint8Array(padSize * 2);
  raw.set(derSig.slice(rStart, rStart + rSize), padSize - rSize);
  raw.set(derSig.slice(sStart, sStart + sSize), padSize * 2 - sSize);

  return raw;
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

  throw new Error("Unsupported signature algorithm: " + algorithm);
}

/**
 * System CA certificate paths by platform
 */
const SYSTEM_CA_PATHS: Record<string, string[]> = {
  darwin: [
    "/etc/ssl/cert.pem",
    "/System/Library/Keychains/SystemRootCertificates.keychain",
  ],
  linux: [
    "/etc/ssl/certs/ca-certificates.crt",
    "/etc/pki/tls/certs/ca-bundle.crt",
    "/etc/ssl/ca-bundle.pem",
    "/etc/pki/ca-trust/extracted/pem/tls-ca-bundle.pem",
  ],
  windows: [
    // Windows uses certificate store, not files
    // Handled separately via Deno.connectTls
  ],
};

/**
 * Cached system CA certificates
 */
let systemCACache: Certificate[] | null = null;
let systemCAsLoading: Promise<Certificate[]> | null = null;

/**
 * Load system trusted CA certificates
 * Loads from platform-specific locations and caches the result
 */
export async function loadSystemCAs(): Promise<Certificate[]> {
  if (systemCACache !== null) {
    return systemCACache;
  }

  // Prevent concurrent duplicate loads via promise guard
  if (systemCAsLoading !== null) {
    return systemCAsLoading;
  }

  systemCAsLoading = loadSystemCAsImpl();
  try {
    return await systemCAsLoading;
  } finally {
    systemCAsLoading = null;
  }
}

/**
 * Internal implementation of system CA loading
 */
async function loadSystemCAsImpl(): Promise<Certificate[]> {

  const platform = Deno.build.os;
  const paths = SYSTEM_CA_PATHS[platform] || [];
  const certificates: Certificate[] = [];

  for (const path of paths) {
    try {
      const stat = await Deno.stat(path);
      if (!stat.isFile) continue;

      const content = await Deno.readTextFile(path);
      const certs = parsePEMCertificates(content);
      certificates.push(...certs);

      if (certificates.length > 0) {
        console.error(`Loaded ${certificates.length} system CA certificates from ${path}`);
        break; // Found valid CAs, stop searching
      }
    } catch {
      // Path doesn't exist or not accessible, try next
      continue;
    }
  }

  // If no system CAs found, try using Deno's built-in CA bundle location
  if (certificates.length === 0) {
    try {
      // Deno stores CA certs in DENO_DIR/certs/
      const denoDir = Deno.env.get("DENO_DIR") || `${Deno.env.get("HOME")}/.cache/deno`;
      const denoCerts = `${denoDir}/certs/roots/mozilla.pem`;
      const content = await Deno.readTextFile(denoCerts);
      const certs = parsePEMCertificates(content);
      certificates.push(...certs);
      console.error(`Loaded ${certificates.length} CA certificates from Deno cache`);
    } catch {
      console.warn("No system CA certificates found - TLS certificate validation may fail");
    }
  }

  systemCACache = certificates;
  return certificates;
}

/**
 * Parse PEM-encoded certificates from a string
 * @param pem - PEM-encoded certificate bundle
 * @returns Array of parsed certificates
 */
export function parsePEMCertificates(pem: string): Certificate[] {
  const certificates: Certificate[] = [];
  const certRegex = /-----BEGIN CERTIFICATE-----\r?\n([\s\S]*?)\r?\n-----END CERTIFICATE-----/g;

  let match: RegExpExecArray | null;
  while ((match = certRegex.exec(pem)) !== null) {
    try {
      const base64 = match[1].replace(/\s/g, "");
      const der = base64ToUint8Array(base64);
      const cert = parseDERCertificate(der as ByteBuffer);
      certificates.push(cert);
    } catch (e) {
      // Skip malformed certificates
      console.warn("Failed to parse PEM certificate:", e);
    }
  }

  return certificates;
}

/**
 * Convert base64 string to Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Parse a DER-encoded X.509 certificate
 * This is a simplified parser that extracts the essential fields
 */
function parseDERCertificate(der: ByteBuffer): Certificate {
  // Parse outer SEQUENCE
  let offset = 0;

  if (der.length < 2) {
    throw new Error("DER data truncated: certificate too short");
  }

  // Check for SEQUENCE tag (0x30)
  if (der[offset] !== 0x30) {
    throw new Error("Invalid certificate: expected SEQUENCE");
  }
  offset++;

  // Parse length
  const { length: certLength, bytesRead } = parseDERLength(der, offset);
  offset += bytesRead;
  if (offset + certLength > der.length) {
    throw new Error("DER: unexpected end of data at certificate SEQUENCE");
  }

  // Parse TBSCertificate SEQUENCE
  if (der[offset] !== 0x30) {
    throw new Error("Invalid TBSCertificate: expected SEQUENCE");
  }
  const tbsStartOffset = offset; // Capture start for raw TBS bytes
  offset++;
  const { length: tbsLength, bytesRead: tbsBytesRead } = parseDERLength(der, offset);
  offset += tbsBytesRead;
  const tbsEnd = offset + tbsLength;
  if (tbsEnd > der.length) {
    throw new Error("DER: unexpected end of data at TBSCertificate");
  }
  // Raw TBS certificate data (tag + length + content) for signature verification
  const rawTbsCertificate = der.slice(tbsStartOffset, tbsEnd) as ByteBuffer;

  // Parse version if present (context tag [0]) - default to v1 (0)
  let version = 1; // X.509 v1
  if (der[offset] === 0xa0) {
    offset++;
    const { length: verLen, bytesRead: verBytesRead } = parseDERLength(der, offset);
    offset += verBytesRead;
    if (offset + verLen > der.length) {
      throw new Error("DER: unexpected end of data at version");
    }
    // Version is an INTEGER inside the explicit tag
    if (der[offset] === 0x02) {
      offset++;
      const versionLen = der[offset];
      offset++;
      if (offset + versionLen > der.length) {
        throw new Error("DER: unexpected end of data at version INTEGER");
      }
      version = der[offset] + 1; // X.509 v1=0, v2=1, v3=2, so add 1
      offset += versionLen;
    } else {
      offset += verLen;
    }
  }

  // Parse serial number (INTEGER) - convert to hex string
  if (der[offset] !== 0x02) {
    throw new Error("Invalid serial number: expected INTEGER");
  }
  offset++;
  const { length: serialLen, bytesRead: serialBytesRead } = parseDERLength(der, offset);
  offset += serialBytesRead;
  if (offset + serialLen > der.length) {
    throw new Error("DER data truncated: expected " + serialLen + " bytes at offset " + offset);
  }
  const serialBytes = der.slice(offset, offset + serialLen);
  const serialNumber = Array.from(serialBytes).map((b) => b.toString(16).padStart(2, "0")).join(
    ":",
  );
  offset += serialLen;

  // Parse signature algorithm (SEQUENCE)
  if (der[offset] !== 0x30) {
    throw new Error("Invalid signature algorithm: expected SEQUENCE");
  }
  offset++;
  const { length: sigAlgLen, bytesRead: sigAlgBytesRead } = parseDERLength(der, offset);
  offset += sigAlgBytesRead;
  if (offset + sigAlgLen > der.length) {
    throw new Error("DER: unexpected end of data at signature algorithm");
  }
  const signatureAlgorithm = parseOID(der, offset);
  offset += sigAlgLen;

  // Parse issuer (SEQUENCE) — capture raw DER bytes for OCSP hashing (RFC 6960)
  const issuerRawStart = offset;
  const issuer = parseDN(der, offset);
  const issuerRawLen = getDNLength(der, offset);
  const issuerRaw = der.slice(issuerRawStart, issuerRawStart + issuerRawLen) as ByteBuffer;
  offset += issuerRawLen;

  // Parse validity (SEQUENCE)
  if (der[offset] !== 0x30) {
    throw new Error("Invalid validity: expected SEQUENCE");
  }
  offset++;
  const { length: validityLen, bytesRead: validityBytesRead } = parseDERLength(der, offset);
  offset += validityBytesRead;
  if (offset + validityLen > der.length) {
    throw new Error("DER: unexpected end of data at validity");
  }
  const notBefore = parseTime(der, offset);
  offset += getTimeLength(der, offset);
  const notAfter = parseTime(der, offset);
  offset += getTimeLength(der, offset);

  // Parse subject (SEQUENCE)
  const subject = parseDN(der, offset);
  offset += getDNLength(der, offset);

  // Parse subjectPublicKeyInfo (SEQUENCE) - keep full SPKI for crypto.subtle.importKey("spki", ...)
  if (der[offset] !== 0x30) {
    throw new Error("Invalid subjectPublicKeyInfo: expected SEQUENCE");
  }
  const spkiStart = offset;
  offset++;
  const { length: spkiLen, bytesRead: spkiBytesRead } = parseDERLength(der, offset);
  offset += spkiBytesRead;
  offset += spkiLen;
  if (offset > der.length) {
    throw new Error("DER data truncated: expected SPKI data up to offset " + offset);
  }
  const publicKey = der.slice(spkiStart, offset) as ByteBuffer;

  // Parse extensions if present (context tag [3])
  const subjectAltNames: string[] = [];
  let aiaOcspUrl: string | undefined;
  while (offset < tbsEnd) {
    if (der[offset] === 0xa3) {
      offset++;
      const { length: extContainerLen, bytesRead: extContainerBytesRead } = parseDERLength(der, offset);
      offset += extContainerBytesRead;
      const extContainerEnd = offset + extContainerLen;
      if (extContainerEnd > der.length) {
        throw new Error("DER: unexpected end of data at extensions container");
      }

      // Extensions is a SEQUENCE OF Extension
      if (offset < extContainerEnd && der[offset] === 0x30) {
        offset++;
        const { length: extSeqLen, bytesRead: extSeqBytesRead } = parseDERLength(der, offset);
        offset += extSeqBytesRead;
        const extSeqEnd = offset + extSeqLen;
        if (extSeqEnd > der.length) {
          throw new Error("DER: unexpected end of data at extensions SEQUENCE");
        }

        // Parse each Extension SEQUENCE
        while (offset < extSeqEnd) {
          if (der[offset] !== 0x30) break;
          offset++;
          const { length: singleExtLen, bytesRead: singleExtBytesRead } = parseDERLength(der, offset);
          offset += singleExtBytesRead;
          const singleExtEnd = offset + singleExtLen;
          if (singleExtEnd > der.length) {
            throw new Error("DER: unexpected end of data at extension");
          }

          // Parse extension OID
          if (offset < singleExtEnd && der[offset] === 0x06) {
            const oidLen = der[offset + 1];
            if (offset + 2 + oidLen > der.length) { offset = singleExtEnd; continue; }
            const oidBytes = der.slice(offset + 2, offset + 2 + oidLen);
            offset += 2 + oidLen;

            // Skip optional critical BOOLEAN
            if (offset < singleExtEnd && der[offset] === 0x01) {
              if (offset + 1 >= der.length) {
                throw new Error("DER: unexpected end of data at critical BOOLEAN");
              }
              offset += 2 + der[offset + 1];
            }

            // Extension value is an OCTET STRING
            if (offset < singleExtEnd && der[offset] === 0x04) {
              offset++;
              const { length: valLen, bytesRead: valBytesRead } = parseDERLength(der, offset);
              offset += valBytesRead;
              const valEnd = offset + valLen;
              if (valEnd > der.length) {
                throw new Error("DER: unexpected end of data at extension value");
              }

              // SAN OID: 2.5.29.17 = [55 1d 11]
              if (oidBytes.length === 3 && oidBytes[0] === 0x55 && oidBytes[1] === 0x1d && oidBytes[2] === 0x11) {
                // SAN value is a SEQUENCE OF GeneralName
                if (offset < valEnd && der[offset] === 0x30) {
                  offset++;
                  const { length: sanSeqLen, bytesRead: sanSeqBytesRead } = parseDERLength(der, offset);
                  offset += sanSeqBytesRead;
                  const sanSeqEnd = offset + sanSeqLen;
                  if (sanSeqEnd > der.length) {
                    throw new Error("DER: unexpected end of data at SAN SEQUENCE");
                  }

                  while (offset < sanSeqEnd) {
                    const gnTag = der[offset];
                    offset++;
                    const { length: gnLen, bytesRead: gnBytesRead } = parseDERLength(der, offset);
                    offset += gnBytesRead;
                    if (offset + gnLen > der.length) break;

                    if (gnTag === 0x82) {
                      // dNSName [2] — IA5String
                      const dnsName = new TextDecoder().decode(der.slice(offset, offset + gnLen));
                      subjectAltNames.push(dnsName);
                    } else if (gnTag === 0x87) {
                      // iPAddress [7]
                      if (gnLen === 4) {
                        // IPv4
                        subjectAltNames.push(`${der[offset]}.${der[offset + 1]}.${der[offset + 2]}.${der[offset + 3]}`);
                      } else if (gnLen === 16) {
                        // IPv6
                        const parts: string[] = [];
                        for (let i = 0; i < 16; i += 2) {
                          parts.push(((der[offset + i] << 8) | der[offset + i + 1]).toString(16));
                        }
                        subjectAltNames.push(parts.join(":"));
                      }
                    }
                    offset += gnLen;
                  }
                }
              }

              // AIA OID: 1.3.6.1.5.5.7.1.1 = [2b 06 01 05 05 07 01 01]
              if (oidBytes.length === 8 &&
                  oidBytes[0] === 0x2b && oidBytes[1] === 0x06 && oidBytes[2] === 0x01 &&
                  oidBytes[3] === 0x05 && oidBytes[4] === 0x05 && oidBytes[5] === 0x07 &&
                  oidBytes[6] === 0x01 && oidBytes[7] === 0x01) {
                // Scan for context tag [6] (URI) within AIA value
                for (let i = offset; i < valEnd - 2; i++) {
                  if (der[i] === 0x86) {
                    const { length: urlLen, bytesRead: urlBytesRead } = parseDERLength(der, i + 1);
                    const urlStart = i + 1 + urlBytesRead;
                    if (urlStart + urlLen <= valEnd) {
                      const url = new TextDecoder().decode(der.slice(urlStart, urlStart + urlLen));
                      if (url.startsWith("http")) {
                        aiaOcspUrl = url;
                        break;
                      }
                    }
                  }
                }
              }

              offset = valEnd;
            } else {
              offset = singleExtEnd;
            }
          } else {
            offset = singleExtEnd;
          }
        }
      }
      offset = extContainerEnd;
    } else {
      break;
    }
  }

  // Skip to signature at end
  offset = tbsEnd;

  // Parse signatureAlgorithm (again, outside TBS)
  if (der[offset] !== 0x30) {
    throw new Error("Invalid outer signature algorithm: expected SEQUENCE");
  }
  offset++;
  const { length: outerSigAlgLen, bytesRead: outerSigAlgBytesRead } = parseDERLength(der, offset);
  offset += outerSigAlgBytesRead;
  if (offset + outerSigAlgLen > der.length) {
    throw new Error("DER: unexpected end of data at outer signature algorithm");
  }
  offset += outerSigAlgLen;

  // Parse signature (BIT STRING)
  if (der[offset] !== 0x03) {
    throw new Error("Invalid signature: expected BIT STRING");
  }
  offset++;
  const { length: sigLen, bytesRead: sigBytesRead } = parseDERLength(der, offset);
  offset += sigBytesRead;
  // Skip unused bits byte
  offset++;
  if (offset + sigLen - 1 > der.length) {
    throw new Error("DER data truncated: expected " + (sigLen - 1) + " signature bytes at offset " + offset);
  }
  const signature = der.slice(offset, offset + sigLen - 1) as ByteBuffer;

  const cert: Certificate & { ocspResponderUrl?: string } = {
    version,
    serialNumber,
    issuer,
    subject,
    notBefore,
    notAfter,
    publicKey,
    signature,
    signatureAlgorithm,
    subjectAltNames,
    tbsCertificate: rawTbsCertificate,
    issuerRaw,
  };
  if (aiaOcspUrl) {
    cert.ocspResponderUrl = aiaOcspUrl;
  }
  return cert;
}

/**
 * Parse DER length encoding
 */
function parseDERLength(data: ByteBuffer, offset: number): { length: number; bytesRead: number } {
  if (offset >= data.length) {
    throw new Error("DER data truncated: expected length byte at offset " + offset);
  }
  const firstByte = data[offset];
  if (firstByte < 0x80) {
    return { length: firstByte, bytesRead: 1 };
  }

  const numBytes = firstByte & 0x7f;
  if (numBytes > 4) {
    throw new Error("DER length field too large");
  }
  if (offset + 1 + numBytes > data.length) {
    throw new Error("DER data truncated: expected " + numBytes + " length bytes at offset " + (offset + 1));
  }
  let length = 0;
  for (let i = 0; i < numBytes; i++) {
    length = (length << 8) | data[offset + 1 + i];
  }
  return { length, bytesRead: 1 + numBytes };
}

/**
 * Parse OID from DER data (returns algorithm name string)
 */
function parseOID(data: ByteBuffer, offset: number): string {
  // Simplified OID parsing - return common algorithm names
  if (offset + 1 >= data.length) {
    throw new Error("DER data truncated: expected OID at offset " + offset);
  }
  if (data[offset] === 0x06) {
    const len = data[offset + 1];
    if (offset + 2 + len > data.length) {
      throw new Error("DER data truncated: expected " + len + " OID bytes at offset " + (offset + 2));
    }
    const oidBytes = data.slice(offset + 2, offset + 2 + len);

    // Common signature algorithm OIDs
    // 1.2.840.113549.1.1.1 — RSA encryption
    if (matchesOID(oidBytes, [0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01])) {
      return "RSA";
    }
    // 1.2.840.113549.1.1.4 — MD5WithRSA
    if (matchesOID(oidBytes, [0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x04])) {
      return "RSA-MD5";
    }
    // 1.2.840.113549.1.1.5 — SHA1WithRSA
    if (matchesOID(oidBytes, [0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x05])) {
      return "RSA-SHA1";
    }
    // 1.2.840.113549.1.1.11 — SHA256WithRSA
    if (matchesOID(oidBytes, [0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x0b])) {
      return "RSA-SHA256";
    }
    // 1.2.840.113549.1.1.12 — SHA384WithRSA
    if (matchesOID(oidBytes, [0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x0c])) {
      return "RSA-SHA384";
    }
    // 1.2.840.113549.1.1.13 — SHA512WithRSA
    if (matchesOID(oidBytes, [0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x0d])) {
      return "RSA-SHA512";
    }
    // 1.2.840.113549.1.1.14 — SHA224WithRSA
    if (matchesOID(oidBytes, [0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x0e])) {
      return "RSA-SHA224";
    }
    // 1.2.840.10045.4.3.2 — ECDSA-SHA256
    if (matchesOID(oidBytes, [0x2a, 0x86, 0x48, 0xce, 0x3d, 0x04, 0x03, 0x02])) {
      return "ECDSA-SHA256";
    }
    // 1.2.840.10045.4.3.3 — ECDSA-SHA384
    if (matchesOID(oidBytes, [0x2a, 0x86, 0x48, 0xce, 0x3d, 0x04, 0x03, 0x03])) {
      return "ECDSA-SHA384";
    }
    // 1.2.840.10045.4.3.4 — ECDSA-SHA512
    if (matchesOID(oidBytes, [0x2a, 0x86, 0x48, 0xce, 0x3d, 0x04, 0x03, 0x04])) {
      return "ECDSA-SHA512";
    }
    // 1.2.840.10045.4.3.1 — ECDSA-SHA224
    if (matchesOID(oidBytes, [0x2a, 0x86, 0x48, 0xce, 0x3d, 0x04, 0x03, 0x01])) {
      return "ECDSA-SHA224";
    }
    // 1.2.840.10045.2.1 — EC public key
    if (matchesOID(oidBytes, [0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01])) {
      return "EC";
    }
    // 1.3.101.112 — Ed25519
    if (matchesOID(oidBytes, [0x2b, 0x65, 0x70])) {
      return "Ed25519";
    }
    // 1.3.101.113 — Ed448
    if (matchesOID(oidBytes, [0x2b, 0x65, 0x71])) {
      return "Ed448";
    }
    // Unknown OID — return dotted notation string instead of throwing
    const oidStr = decodeOIDBytes(oidBytes);
    return "OID:" + oidStr;
  }
  // No OID tag — return generic string instead of throwing
  return "UNKNOWN";
}

/**
 * Check if OID bytes match expected OID
 */
function matchesOID(data: ByteBuffer, expected: number[]): boolean {
  if (data.length !== expected.length) return false;
  for (let i = 0; i < expected.length; i++) {
    if (data[i] !== expected[i]) return false;
  }
  return true;
}

/**
 * Parse Distinguished Name from DER data
 */
function parseDN(data: ByteBuffer, offset: number): string {
  if (data[offset] !== 0x30) {
    return "Unknown";
  }

  const { length, bytesRead } = parseDERLength(data, offset + 1);
  const dnEnd = offset + 1 + bytesRead + length;
  let pos = offset + 1 + bytesRead;

  const parts: string[] = [];

  // Parse SET OF AttributeTypeAndValue
  while (pos < dnEnd) {
    if (data[pos] !== 0x31) break; // SET
    pos++;
    const { length: setLen, bytesRead: setBytesRead } = parseDERLength(data, pos);
    pos += setBytesRead;
    const setEnd = pos + setLen;

    // Parse SEQUENCE
    if (data[pos] === 0x30) {
      pos++;
      const { length: seqLen, bytesRead: seqBytesRead } = parseDERLength(data, pos);
      pos += seqBytesRead;
      const seqEnd = pos + seqLen;

      // Parse OID
      if (data[pos] === 0x06 && pos < seqEnd) {
        if (pos + 1 >= data.length) break;
        const oidLen = data[pos + 1];
        if (pos + 2 + oidLen > data.length) break;
        const attrType = getRDNType(data.slice(pos + 2, pos + 2 + oidLen) as ByteBuffer);
        pos += 2 + oidLen;

        // Parse value (PrintableString, UTF8String, etc.)
        if (pos < data.length && (data[pos] === 0x13 || data[pos] === 0x0c || data[pos] === 0x16)) {
          pos++;
          const { length: valLen, bytesRead: valBytesRead } = parseDERLength(data, pos);
          pos += valBytesRead;
          if (pos + valLen > data.length) break;
          const value = new TextDecoder().decode(data.slice(pos, pos + valLen));
          parts.push(`${attrType}=${value}`);
          pos += valLen;
        }
      }
    }
    pos = setEnd;
  }

  return parts.join(", ") || "Unknown";
}

/**
 * Get RDN attribute type name from OID
 */
function getRDNType(oid: ByteBuffer): string {
  // Common RDN OIDs (2.5.4.x)
  if (oid.length >= 3 && oid[0] === 0x55 && oid[1] === 0x04) {
    switch (oid[2]) {
      case 0x03:
        return "CN";
      case 0x06:
        return "C";
      case 0x07:
        return "L";
      case 0x08:
        return "ST";
      case 0x0a:
        return "O";
      case 0x0b:
        return "OU";
    }
  }
  return "Unknown";
}

/**
 * Get length of DN structure
 */
function getDNLength(data: ByteBuffer, offset: number): number {
  if (offset >= data.length || data[offset] !== 0x30) return 0;
  const { length, bytesRead } = parseDERLength(data, offset + 1);
  const total = 1 + bytesRead + length;
  if (offset + total > data.length) {
    throw new Error("DER: unexpected end of data at DN");
  }
  return total;
}

/**
 * Parse time value (UTCTime or GeneralizedTime)
 */
function parseTime(data: ByteBuffer, offset: number): Date {
  if (offset + 1 >= data.length) {
    throw new Error("DER: unexpected end of data at time tag");
  }
  const tag = data[offset];
  const { length: len, bytesRead: timeBytesRead } = parseDERLength(data, offset + 1);
  const timeDataStart = offset + 1 + timeBytesRead;
  if (timeDataStart + len > data.length) {
    throw new Error("DER: unexpected end of data at time value");
  }
  const timeStr = new TextDecoder().decode(data.slice(timeDataStart, timeDataStart + len));

  if (tag === 0x17) {
    // UTCTime (YYMMDDHHMMSSZ)
    let year = parseInt(timeStr.substring(0, 2));
    year += year >= 50 ? 1900 : 2000;
    const month = parseInt(timeStr.substring(2, 4)) - 1;
    const day = parseInt(timeStr.substring(4, 6));
    const hour = parseInt(timeStr.substring(6, 8));
    const minute = parseInt(timeStr.substring(8, 10));
    const second = parseInt(timeStr.substring(10, 12));
    return new Date(Date.UTC(year, month, day, hour, minute, second));
  } else if (tag === 0x18) {
    // GeneralizedTime (YYYYMMDDHHMMSSZ)
    const year = parseInt(timeStr.substring(0, 4));
    const month = parseInt(timeStr.substring(4, 6)) - 1;
    const day = parseInt(timeStr.substring(6, 8));
    const hour = parseInt(timeStr.substring(8, 10));
    const minute = parseInt(timeStr.substring(10, 12));
    const second = parseInt(timeStr.substring(12, 14));
    return new Date(Date.UTC(year, month, day, hour, minute, second));
  }

  throw new Error("Invalid DER time tag: 0x" + tag.toString(16));
}

/**
 * Get length of time structure
 */
function getTimeLength(data: ByteBuffer, offset: number): number {
  if (offset + 1 >= data.length) {
    throw new Error("DER: unexpected end of data at time length");
  }
  const { length, bytesRead } = parseDERLength(data, offset + 1);
  return 1 + bytesRead + length;
}

/**
 * Compare two ByteBuffer/Uint8Array instances for equality
 */
function arraysEqual(a: ByteBuffer, b: ByteBuffer): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Decode DER OID bytes to dotted notation string
 */
function decodeOIDBytes(oidBytes: ByteBuffer): string {
  if (oidBytes.length === 0) return "";
  const components: number[] = [];
  // First byte encodes first two components: value = 40*X + Y
  components.push(Math.floor(oidBytes[0] / 40));
  components.push(oidBytes[0] % 40);
  let value = 0;
  for (let i = 1; i < oidBytes.length; i++) {
    value = (value << 7) | (oidBytes[i] & 0x7f);
    if ((oidBytes[i] & 0x80) === 0) {
      components.push(value);
      value = 0;
    }
  }
  return components.join(".");
}

/**
 * Clear the system CA cache (useful for testing)
 */
export function clearSystemCACache(): void {
  systemCACache = null;
  systemCAsLoading = null;
}

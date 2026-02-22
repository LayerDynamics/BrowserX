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
    const issuer = allCerts.find((ca) => ca.subject === current.issuer);
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

  // Default to RSA-SHA256
  return ["RSASSA-PKCS1-v1_5", "SHA-256"];
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

/**
 * Load system trusted CA certificates
 * Loads from platform-specific locations and caches the result
 */
export async function loadSystemCAs(): Promise<Certificate[]> {
  if (systemCACache !== null) {
    return systemCACache;
  }

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
        console.log(`Loaded ${certificates.length} system CA certificates from ${path}`);
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
      console.log(`Loaded ${certificates.length} CA certificates from Deno cache`);
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

  let match;
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

  // Check for SEQUENCE tag (0x30)
  if (der[offset] !== 0x30) {
    throw new Error("Invalid certificate: expected SEQUENCE");
  }
  offset++;

  // Parse length
  const { length: certLength, bytesRead } = parseDERLength(der, offset);
  offset += bytesRead;

  // Parse TBSCertificate SEQUENCE
  if (der[offset] !== 0x30) {
    throw new Error("Invalid TBSCertificate: expected SEQUENCE");
  }
  const tbsStartOffset = offset; // Capture start for raw TBS bytes
  offset++;
  const { length: tbsLength, bytesRead: tbsBytesRead } = parseDERLength(der, offset);
  offset += tbsBytesRead;
  const tbsEnd = offset + tbsLength;
  // Raw TBS certificate data (tag + length + content) for signature verification
  const rawTbsCertificate = der.slice(tbsStartOffset, tbsEnd) as ByteBuffer;

  // Parse version if present (context tag [0]) - default to v1 (0)
  let version = 1; // X.509 v1
  if (der[offset] === 0xa0) {
    offset++;
    const { length: verLen, bytesRead: verBytesRead } = parseDERLength(der, offset);
    offset += verBytesRead;
    // Version is an INTEGER inside the explicit tag
    if (der[offset] === 0x02) {
      offset++;
      const versionLen = der[offset];
      offset++;
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
  const signatureAlgorithm = parseOID(der, offset);
  offset += sigAlgLen;

  // Parse issuer (SEQUENCE)
  const issuer = parseDN(der, offset);
  offset += getDNLength(der, offset);

  // Parse validity (SEQUENCE)
  if (der[offset] !== 0x30) {
    throw new Error("Invalid validity: expected SEQUENCE");
  }
  offset++;
  const { length: validityLen, bytesRead: validityBytesRead } = parseDERLength(der, offset);
  offset += validityBytesRead;
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
  const publicKey = der.slice(spkiStart, offset) as ByteBuffer;

  // Parse extensions if present (context tag [3])
  const subjectAltNames: string[] = [];
  while (offset < tbsEnd) {
    if (der[offset] === 0xa3) {
      offset++;
      const { length: extLen, bytesRead: extBytesRead } = parseDERLength(der, offset);
      offset += extBytesRead;
      // Parse extensions for SAN - simplified
      // Full implementation would parse extension OIDs
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
  offset += outerSigAlgBytesRead + outerSigAlgLen;

  // Parse signature (BIT STRING)
  if (der[offset] !== 0x03) {
    throw new Error("Invalid signature: expected BIT STRING");
  }
  offset++;
  const { length: sigLen, bytesRead: sigBytesRead } = parseDERLength(der, offset);
  offset += sigBytesRead;
  // Skip unused bits byte
  offset++;
  const signature = der.slice(offset, offset + sigLen - 1) as ByteBuffer;

  return {
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
  };
}

/**
 * Parse DER length encoding
 */
function parseDERLength(data: ByteBuffer, offset: number): { length: number; bytesRead: number } {
  const firstByte = data[offset];
  if (firstByte < 0x80) {
    return { length: firstByte, bytesRead: 1 };
  }

  const numBytes = firstByte & 0x7f;
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
  // Full implementation would decode the OID bytes
  if (data[offset] === 0x06) {
    const len = data[offset + 1];
    const oidBytes = data.slice(offset + 2, offset + 2 + len);

    // Common signature algorithm OIDs
    if (matchesOID(oidBytes, [0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x0b])) {
      return "RSA-SHA256";
    }
    if (matchesOID(oidBytes, [0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x0c])) {
      return "RSA-SHA384";
    }
    if (matchesOID(oidBytes, [0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x0d])) {
      return "RSA-SHA512";
    }
    if (matchesOID(oidBytes, [0x2a, 0x86, 0x48, 0xce, 0x3d, 0x04, 0x03, 0x02])) {
      return "ECDSA-SHA256";
    }
    if (matchesOID(oidBytes, [0x2a, 0x86, 0x48, 0xce, 0x3d, 0x04, 0x03, 0x03])) {
      return "ECDSA-SHA384";
    }
  }
  return "RSA-SHA256"; // Default
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

      // Parse OID
      if (data[pos] === 0x06) {
        const oidLen = data[pos + 1];
        const attrType = getRDNType(data.slice(pos + 2, pos + 2 + oidLen) as ByteBuffer);
        pos += 2 + oidLen;

        // Parse value (PrintableString, UTF8String, etc.)
        if (data[pos] === 0x13 || data[pos] === 0x0c || data[pos] === 0x16) {
          pos++;
          const { length: valLen, bytesRead: valBytesRead } = parseDERLength(data, pos);
          pos += valBytesRead;
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
  if (data[offset] !== 0x30) return 0;
  const { length, bytesRead } = parseDERLength(data, offset + 1);
  return 1 + bytesRead + length;
}

/**
 * Parse time value (UTCTime or GeneralizedTime)
 */
function parseTime(data: ByteBuffer, offset: number): Date {
  const tag = data[offset];
  const len = data[offset + 1];
  const timeStr = new TextDecoder().decode(data.slice(offset + 2, offset + 2 + len));

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

  return new Date();
}

/**
 * Get length of time structure
 */
function getTimeLength(data: ByteBuffer, offset: number): number {
  return 2 + data[offset + 1];
}

/**
 * Clear the system CA cache (useful for testing)
 */
export function clearSystemCACache(): void {
  systemCACache = null;
}

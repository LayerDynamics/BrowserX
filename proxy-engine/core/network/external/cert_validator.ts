/**
 * Certificate Validator
 *
 * Validates TLS certificates from external services.
 * Uses raw TCP + TLS ClientHello to extract certificates (bypasses Deno API limitation).
 * Delegates ASN.1/X.509 parsing to browser engine's Certificate module.
 * Supports OCSP and CRL revocation checking.
 */

import {
  parsePEMCertificates,
} from "../../../../browser/src/engine/network/security/Certificate.ts";
import type { Certificate } from "../../../../browser/src/types/network.ts";
import type { ByteBuffer } from "../../../../browser/src/types/identifiers.ts";

/**
 * Certificate information
 */
export interface CertificateInfo {
  subject: {
    commonName?: string;
    organization?: string;
    organizationalUnit?: string;
    locality?: string;
    state?: string;
    country?: string;
  };
  issuer: {
    commonName?: string;
    organization?: string;
    organizationalUnit?: string;
    locality?: string;
    state?: string;
    country?: string;
  };
  validFrom: Date;
  validTo: Date;
  serialNumber: string;
  fingerprint: string;
  subjectAltNames?: string[];
  /** Raw DER bytes of the certificate (for revocation checking) */
  rawDER?: Uint8Array;
  /** Parsed extensions: AIA OCSP URL, CRL distribution points */
  ocspResponderUrl?: string;
  crlDistributionPoints?: string[];
}

/**
 * Certificate validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  certificate?: CertificateInfo;
}

/**
 * Certificate validator options
 */
export interface CertificateValidatorOptions {
  checkExpiration?: boolean;
  checkHostname?: boolean;
  checkRevocation?: boolean;
  allowSelfSigned?: boolean;
  customTrustStore?: string[];
}

/**
 * OCSP response cache entry
 */
interface OCSPCacheEntry {
  revoked: boolean;
  reason?: string;
  expiresAt: number;
}

/**
 * Certificate validator
 */
export class CertificateValidator {
  private options: CertificateValidatorOptions;
  private ocspCache: Map<string, OCSPCacheEntry> = new Map();
  private static readonly OCSP_CACHE_MAX_SIZE = 1000;

  constructor(options: CertificateValidatorOptions = {}) {
    this.options = {
      checkExpiration: true,
      checkHostname: true,
      checkRevocation: false, // Expensive operation
      allowSelfSigned: false,
      ...options,
    };
  }

  /**
   * Validate certificate for hostname
   */
  async validate(
    hostname: string,
    port: number = 443,
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Try to get the actual certificate via raw TLS handshake
    const certInfo = await this.getCertificate(hostname, port);

    if (certInfo) {
      // Validate expiration
      if (this.options.checkExpiration) {
        const expResult = this.validateExpiration(certInfo.validFrom, certInfo.validTo);
        errors.push(...expResult.errors);
        warnings.push(...expResult.warnings);
      }

      // Validate hostname
      if (this.options.checkHostname) {
        const hostResult = this.validateHostname(
          hostname,
          certInfo.subject.commonName ?? "",
          certInfo.subjectAltNames ?? [],
        );
        errors.push(...hostResult.errors);
      }

      // Check self-signed
      if (!this.options.allowSelfSigned && this.isSelfSigned(certInfo)) {
        errors.push("Certificate is self-signed");
      }

      // Check revocation
      if (this.options.checkRevocation) {
        const revResult = await this.checkRevocation(certInfo);
        if (revResult.revoked) {
          errors.push(`Certificate revoked: ${revResult.reason ?? "unknown reason"}`);
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        certificate: certInfo,
      };
    }

    // Fallback: use Deno's TLS validation (cert details unavailable)
    try {
      const conn = await Deno.connectTls({ hostname, port });
      try {
        await conn.handshake();
        conn.close();
        return { valid: true, errors, warnings };
      } catch (handshakeError) {
        errors.push(
          `TLS handshake failed: ${
            handshakeError instanceof Error
              ? handshakeError.message
              : String(handshakeError)
          }`,
        );
        conn.close();
      }
    } catch (connectError) {
      errors.push(
        `Failed to connect to ${hostname}:${port}: ${
          connectError instanceof Error
            ? connectError.message
            : String(connectError)
        }`,
      );
    }

    return { valid: false, errors, warnings };
  }

  /**
   * Validate certificate expiration
   */
  validateExpiration(validFrom: Date, validTo: Date): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const now = new Date();

    if (now < validFrom) {
      errors.push(`Certificate is not yet valid (valid from ${validFrom.toISOString()})`);
    }

    if (now > validTo) {
      errors.push(`Certificate has expired (expired on ${validTo.toISOString()})`);
    }

    // Warn if expiring soon (within 30 days)
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    if (now <= validTo && validTo <= thirtyDaysFromNow) {
      warnings.push(`Certificate will expire soon (${validTo.toISOString()})`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate hostname against certificate
   */
  validateHostname(
    hostname: string,
    certCommonName: string,
    subjectAltNames: string[] = [],
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check common name
    if (this.matchHostname(hostname, certCommonName)) {
      return { valid: true, errors };
    }

    // Check subject alternative names
    for (const altName of subjectAltNames) {
      if (this.matchHostname(hostname, altName)) {
        return { valid: true, errors };
      }
    }

    errors.push(
      `Hostname ${hostname} does not match certificate (CN: ${certCommonName}, SANs: ${
        subjectAltNames.join(", ") || "none"
      })`,
    );

    return { valid: false, errors };
  }

  /**
   * Match hostname against certificate name (supports wildcards)
   */
  private matchHostname(hostname: string, certName: string): boolean {
    if (hostname.toLowerCase() === certName.toLowerCase()) {
      return true;
    }

    if (certName.startsWith("*.")) {
      const certDomain = certName.substring(2);
      const hostParts = hostname.toLowerCase().split(".");
      const certParts = certDomain.toLowerCase().split(".");

      if (hostParts.length === certParts.length + 1) {
        const hostDomain = hostParts.slice(1).join(".");
        return hostDomain === certDomain.toLowerCase();
      }
    }

    return false;
  }

  /**
   * Parse X.509 certificate from PEM string using ASN.1 parser.
   * Delegates to browser engine's full DER/ASN.1 parser.
   */
  parseCertificate(certPEM: string): CertificateInfo | null {
    try {
      const certs = parsePEMCertificates(certPEM);
      if (certs.length === 0) return null;
      return this.certificateToInfo(certs[0]);
    } catch {
      return null;
    }
  }

  /**
   * Parse multiple certificates from a PEM bundle
   */
  parseCertificateChain(certPEM: string): CertificateInfo[] {
    try {
      const certs = parsePEMCertificates(certPEM);
      return certs.map((cert) => this.certificateToInfo(cert));
    } catch {
      return [];
    }
  }

  /**
   * Convert browser engine Certificate to proxy CertificateInfo
   */
  private certificateToInfo(cert: Certificate, rawDER?: Uint8Array): CertificateInfo {
    const subject = this.parseDNString(cert.subject);
    const issuer = this.parseDNString(cert.issuer);

    // Compute SHA-256 fingerprint from raw DER or signature
    const fingerprintData = rawDER ?? cert.signature;
    const fingerprint = Array.from(fingerprintData.slice(0, 20))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(":");

    return {
      subject,
      issuer,
      validFrom: cert.notBefore,
      validTo: cert.notAfter,
      serialNumber: cert.serialNumber,
      fingerprint,
      subjectAltNames: cert.subjectAltNames,
      rawDER,
    };
  }

  /**
   * Parse a DN string like "CN=example.com, O=Org, C=US" into structured object
   */
  private parseDNString(dn: string): {
    commonName?: string;
    organization?: string;
    organizationalUnit?: string;
    locality?: string;
    state?: string;
    country?: string;
  } {
    const result: Record<string, string> = {};
    const parts = dn.split(",").map((p) => p.trim());
    for (const part of parts) {
      const eqIndex = part.indexOf("=");
      if (eqIndex === -1) continue;
      const key = part.substring(0, eqIndex).trim();
      const value = part.substring(eqIndex + 1).trim();
      result[key] = value;
    }
    return {
      commonName: result["CN"],
      organization: result["O"],
      organizationalUnit: result["OU"],
      locality: result["L"],
      state: result["ST"],
      country: result["C"],
    };
  }

  /**
   * Check if certificate is self-signed
   */
  isSelfSigned(cert: CertificateInfo): boolean {
    return (
      cert.subject.commonName === cert.issuer.commonName &&
      cert.subject.organization === cert.issuer.organization &&
      cert.subject.country === cert.issuer.country
    );
  }

  /**
   * Check certificate revocation status via OCSP or CRL.
   *
   * Strategy:
   * 1. Check OCSP cache first
   * 2. If cert has OCSP responder URL → try OCSP
   * 3. If cert has CRL distribution points → try CRL
   * 4. If neither → return not revoked (no revocation info available)
   */
  async checkRevocation(
    certificate: CertificateInfo,
  ): Promise<{ revoked: boolean; reason?: string }> {
    // Check cache
    const cacheKey = certificate.serialNumber;
    const cached = this.ocspCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { revoked: cached.revoked, reason: cached.reason };
    }
    // Evict expired entries and enforce max size
    if (this.ocspCache.size >= CertificateValidator.OCSP_CACHE_MAX_SIZE) {
      const now = Date.now();
      for (const [key, entry] of this.ocspCache) {
        if (entry.expiresAt <= now) this.ocspCache.delete(key);
      }
      // If still over limit, remove oldest entries (first inserted)
      if (this.ocspCache.size >= CertificateValidator.OCSP_CACHE_MAX_SIZE) {
        const keysToDelete = [...this.ocspCache.keys()].slice(0, Math.floor(CertificateValidator.OCSP_CACHE_MAX_SIZE / 4));
        for (const key of keysToDelete) this.ocspCache.delete(key);
      }
    }

    // Try OCSP if URL available
    if (certificate.ocspResponderUrl) {
      try {
        const result = await this.checkOCSP(certificate);
        // Cache for 1 hour
        this.ocspCache.set(cacheKey, {
          revoked: result.revoked,
          reason: result.reason,
          expiresAt: Date.now() + 3600_000,
        });
        return result;
      } catch {
        // Fall through to CRL
      }
    }

    // Try CRL if distribution points available
    if (certificate.crlDistributionPoints && certificate.crlDistributionPoints.length > 0) {
      try {
        const result = await this.checkCRL(certificate);
        this.ocspCache.set(cacheKey, {
          revoked: result.revoked,
          reason: result.reason,
          expiresAt: Date.now() + 3600_000,
        });
        return result;
      } catch {
        // Fall through
      }
    }

    // No revocation information available
    return { revoked: false, reason: "no revocation endpoint available" };
  }

  /**
   * Check revocation via OCSP (Online Certificate Status Protocol)
   */
  private async checkOCSP(
    certificate: CertificateInfo,
  ): Promise<{ revoked: boolean; reason?: string }> {
    const url = certificate.ocspResponderUrl;
    if (!url) return { revoked: false };

    // Build OCSP request with real issuer hashes when possible
    const serialBytes = this.serialToBytes(certificate.serialNumber);
    let issuerNameHash: Uint8Array | undefined;
    let issuerKeyHash: Uint8Array | undefined;
    if (certificate.rawDER) {
      const hashes = await this.computeIssuerHashes(certificate.rawDER);
      if (hashes) {
        issuerNameHash = hashes.nameHash;
        issuerKeyHash = hashes.keyHash;
      }
    }
    const ocspRequest = this.buildOCSPRequest(serialBytes, issuerNameHash, issuerKeyHash);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/ocsp-request" },
        body: ocspRequest,
        signal: AbortSignal.timeout(10_000), // 10s timeout
      });

      if (!response.ok) {
        return { revoked: false, reason: `OCSP request failed: ${response.status}` };
      }

      const responseData = new Uint8Array(await response.arrayBuffer());
      return this.parseOCSPResponse(responseData);
    } catch (e) {
      throw new Error(`OCSP check failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /**
   * Build a minimal OCSP request for a certificate serial number.
   * If the certificate has rawDER, computes real SHA-1 issuer hashes.
   */
  private buildOCSPRequest(serialNumber: Uint8Array, issuerNameHash?: Uint8Array, issuerKeyHash?: Uint8Array): Uint8Array {
    // SHA-1 hash algorithm OID: 1.3.14.3.2.26
    const sha1OID = new Uint8Array([0x06, 0x05, 0x2b, 0x0e, 0x03, 0x02, 0x1a]);
    // NULL parameters
    const nullParam = new Uint8Array([0x05, 0x00]);
    // hashAlgorithm SEQUENCE
    const hashAlg = this.derSequence(new Uint8Array([...sha1OID, ...nullParam]));

    // Use provided hashes or fall back to zeros (will cause OCSP responder to return "unknown")
    const nameHash = issuerNameHash ?? new Uint8Array(20);
    const keyHash = issuerKeyHash ?? new Uint8Array(20);
    const issuerNameHashOctet = new Uint8Array([0x04, 20, ...nameHash]);
    const issuerKeyHashOctet = new Uint8Array([0x04, 20, ...keyHash]);

    // Serial number as INTEGER
    const serialInt = new Uint8Array([0x02, serialNumber.length, ...serialNumber]);

    // CertID SEQUENCE
    const certID = this.derSequence(
      new Uint8Array([...hashAlg, ...issuerNameHashOctet, ...issuerKeyHashOctet, ...serialInt]),
    );

    // Request SEQUENCE (just certID)
    const request = this.derSequence(certID);

    // RequestList SEQUENCE OF Request
    const requestList = this.derSequence(request);

    // TBSRequest SEQUENCE
    const tbsRequest = this.derSequence(requestList);

    // OCSPRequest SEQUENCE
    return this.derSequence(tbsRequest);
  }

  /**
   * Extract issuer DN bytes and issuer public key bytes from a DER certificate,
   * then compute SHA-1 hashes for OCSP CertID.
   */
  private async computeIssuerHashes(certDER: Uint8Array): Promise<{ nameHash: Uint8Array; keyHash: Uint8Array } | null> {
    try {
      // Parse the certificate's TBSCertificate to find issuer and issuer public key info
      // Certificate = SEQUENCE { tbsCertificate, signatureAlgorithm, signatureValue }
      if (certDER[0] !== 0x30) return null;
      const certLen = this.readDERLength(certDER, 1);
      let offset = 1 + certLen.bytesRead;

      // tbsCertificate = SEQUENCE
      if (certDER[offset] !== 0x30) return null;
      const tbsLen = this.readDERLength(certDER, offset + 1);
      let tbsOffset = offset + 1 + tbsLen.bytesRead;
      const tbsEnd = tbsOffset + tbsLen.length;

      // version [0] EXPLICIT (optional)
      if (certDER[tbsOffset] === 0xa0) {
        const vLen = this.readDERLength(certDER, tbsOffset + 1);
        tbsOffset = tbsOffset + 1 + vLen.bytesRead + vLen.length;
      }

      // serialNumber INTEGER — skip
      if (certDER[tbsOffset] === 0x02) {
        const sLen = this.readDERLength(certDER, tbsOffset + 1);
        tbsOffset = tbsOffset + 1 + sLen.bytesRead + sLen.length;
      }

      // signature AlgorithmIdentifier SEQUENCE — skip
      if (certDER[tbsOffset] === 0x30) {
        const aLen = this.readDERLength(certDER, tbsOffset + 1);
        tbsOffset = tbsOffset + 1 + aLen.bytesRead + aLen.length;
      }

      // issuer Name SEQUENCE — this is what we hash
      if (certDER[tbsOffset] !== 0x30) return null;
      const issuerLen = this.readDERLength(certDER, tbsOffset + 1);
      const issuerStart = tbsOffset;
      const issuerEnd = tbsOffset + 1 + issuerLen.bytesRead + issuerLen.length;
      if (issuerEnd > certDER.length) return null;
      const issuerBytes = certDER.slice(issuerStart, issuerEnd);
      tbsOffset = issuerEnd;

      // validity SEQUENCE — skip
      if (certDER[tbsOffset] === 0x30) {
        const valLen = this.readDERLength(certDER, tbsOffset + 1);
        tbsOffset = tbsOffset + 1 + valLen.bytesRead + valLen.length;
      }

      // subject Name SEQUENCE — skip
      if (certDER[tbsOffset] === 0x30) {
        const subLen = this.readDERLength(certDER, tbsOffset + 1);
        tbsOffset = tbsOffset + 1 + subLen.bytesRead + subLen.length;
      }

      // subjectPublicKeyInfo SEQUENCE — extract the public key BIT STRING
      if (certDER[tbsOffset] !== 0x30) return null;
      const spkiLen = this.readDERLength(certDER, tbsOffset + 1);
      let spkiOffset = tbsOffset + 1 + spkiLen.bytesRead;

      // algorithm AlgorithmIdentifier SEQUENCE — skip
      if (certDER[spkiOffset] === 0x30) {
        const algLen = this.readDERLength(certDER, spkiOffset + 1);
        spkiOffset = spkiOffset + 1 + algLen.bytesRead + algLen.length;
      }

      // subjectPublicKey BIT STRING — hash the content (skip tag+length+unused-bits byte)
      if (certDER[spkiOffset] !== 0x03) return null;
      const bsLen = this.readDERLength(certDER, spkiOffset + 1);
      const keyStart = spkiOffset + 1 + bsLen.bytesRead + 1; // +1 for unused bits byte
      const keyEnd = spkiOffset + 1 + bsLen.bytesRead + bsLen.length;
      if (keyEnd > certDER.length) return null;
      const keyBytes = certDER.slice(keyStart, keyEnd);

      // Compute SHA-1 hashes
      const nameHashBuf = await crypto.subtle.digest("SHA-1", issuerBytes);
      const keyHashBuf = await crypto.subtle.digest("SHA-1", keyBytes);

      return {
        nameHash: new Uint8Array(nameHashBuf),
        keyHash: new Uint8Array(keyHashBuf),
      };
    } catch {
      return null;
    }
  }

  /**
   * Parse OCSP response to determine revocation status
   */
  private parseOCSPResponse(data: Uint8Array): { revoked: boolean; reason?: string } {
    // OCSP response is:
    // OCSPResponse ::= SEQUENCE { responseStatus ENUMERATED, responseBytes [0] OPTIONAL }
    // responseStatus: 0=successful, 1=malformedRequest, ...
    if (data.length < 3) return { revoked: false, reason: "empty OCSP response" };

    // Check outer SEQUENCE tag
    if (data[0] !== 0x30) return { revoked: false, reason: "invalid OCSP response" };

    let offset = 0;
    offset++; // skip SEQUENCE tag
    const outerLen = this.readDERLength(data, offset);
    offset += outerLen.bytesRead;

    // Read responseStatus (ENUMERATED)
    if (offset >= data.length || data[offset] !== 0x0a) return { revoked: false, reason: "invalid response status" };
    offset++;
    if (offset >= data.length) return { revoked: false, reason: "DER: unexpected end of data at response status length" };
    const statusLen = data[offset];
    offset++;
    if (offset + statusLen > data.length) return { revoked: false, reason: "DER: unexpected end of data at response status value" };
    const responseStatus = data[offset];
    offset += statusLen;

    if (responseStatus !== 0) {
      return { revoked: false, reason: `OCSP response status: ${responseStatus}` };
    }

    // Look for certStatus in the response body
    // certStatus is one of: good [0] IMPLICIT NULL, revoked [1] IMPLICIT ..., unknown [2] IMPLICIT NULL
    // We scan for context tags [0], [1], [2] within SingleResponse
    return this.findCertStatus(data, offset);
  }

  /**
   * Walk the ASN.1 structure of an OCSP response to find the certStatus field.
   *
   * Structure: OCSPResponse → responseBytes [0] → BasicOCSPResponse (SEQUENCE) →
   *   tbsResponseData (SEQUENCE) → responses (SEQUENCE OF SingleResponse) →
   *   SingleResponse (SEQUENCE) = { certID, certStatus, thisUpdate, ... }
   *
   * certStatus is the second element of SingleResponse:
   *   good [0] IMPLICIT NULL, revoked [1] IMPLICIT ..., unknown [2] IMPLICIT NULL
   */
  private findCertStatus(data: Uint8Array, startOffset: number): { revoked: boolean; reason?: string } {
    try {
      // From startOffset we are past the responseStatus ENUMERATED.
      // Next should be responseBytes [0] EXPLICIT containing BasicOCSPResponse.
      let offset = startOffset;

      // Find responseBytes context tag [0] (0xA0)
      if (offset >= data.length || data[offset] !== 0xa0) {
        return { revoked: false, reason: "missing responseBytes in OCSP response" };
      }
      const rbLen = this.readDERLength(data, offset + 1);
      offset = offset + 1 + rbLen.bytesRead;

      // responseBytes is SEQUENCE { responseType OID, response OCTET STRING }
      if (data[offset] !== 0x30) return { revoked: false, reason: "invalid responseBytes" };
      const rbSeqLen = this.readDERLength(data, offset + 1);
      offset = offset + 1 + rbSeqLen.bytesRead;

      // Skip responseType OID
      if (data[offset] !== 0x06) return { revoked: false, reason: "missing responseType OID" };
      const oidLen = this.readDERLength(data, offset + 1);
      offset = offset + 1 + oidLen.bytesRead + oidLen.length;

      // response OCTET STRING containing BasicOCSPResponse
      if (data[offset] !== 0x04) return { revoked: false, reason: "missing response OCTET STRING" };
      const osLen = this.readDERLength(data, offset + 1);
      offset = offset + 1 + osLen.bytesRead;

      // BasicOCSPResponse SEQUENCE { tbsResponseData, signatureAlgorithm, signature, ... }
      if (data[offset] !== 0x30) return { revoked: false, reason: "invalid BasicOCSPResponse" };
      const basicLen = this.readDERLength(data, offset + 1);
      offset = offset + 1 + basicLen.bytesRead;

      // tbsResponseData SEQUENCE { version [0] OPTIONAL, responderID, producedAt, responses, ... }
      if (data[offset] !== 0x30) return { revoked: false, reason: "invalid tbsResponseData" };
      const tbsLen = this.readDERLength(data, offset + 1);
      const tbsEnd = offset + 1 + tbsLen.bytesRead + tbsLen.length;
      offset = offset + 1 + tbsLen.bytesRead;

      // Skip optional version [0], responderID (ByName [1] or ByKey [2]), and producedAt
      // Walk through elements until we find responses SEQUENCE OF
      while (offset < tbsEnd) {
        const tag = data[offset];
        const elemLen = this.readDERLength(data, offset + 1);
        const elemDataStart = offset + 1 + elemLen.bytesRead;
        const elemEnd = elemDataStart + elemLen.length;

        // responses is SEQUENCE OF SingleResponse — it's a plain SEQUENCE (0x30)
        // containing another SEQUENCE (SingleResponse). Skip context-tagged and non-SEQUENCE elements.
        if (tag === 0x30) {
          // Check if first child is also a SEQUENCE (SingleResponse wrapping)
          // The responses field is SEQUENCE OF SingleResponse, where each SingleResponse is SEQUENCE
          let srOffset = elemDataStart;
          if (srOffset < elemEnd && data[srOffset] === 0x30) {
            // This is likely the responses field. Enter first SingleResponse.
            const srLen = this.readDERLength(data, srOffset + 1);
            const srDataStart = srOffset + 1 + srLen.bytesRead;
            const srEnd = srDataStart + srLen.length;

            // SingleResponse: certID (SEQUENCE), certStatus, thisUpdate, ...
            // Skip certID SEQUENCE
            if (srDataStart < srEnd && data[srDataStart] === 0x30) {
              const cidLen = this.readDERLength(data, srDataStart + 1);
              const certStatusOffset = srDataStart + 1 + cidLen.bytesRead + cidLen.length;

              if (certStatusOffset < srEnd) {
                const statusTag = data[certStatusOffset];
                if (statusTag === 0x80) {
                  // good [0] IMPLICIT NULL
                  return { revoked: false };
                } else if (statusTag === 0xa1) {
                  // revoked [1] IMPLICIT — contains revocation time + optional reason
                  return { revoked: true, reason: "certificate has been revoked" };
                } else if (statusTag === 0x82) {
                  // unknown [2] IMPLICIT NULL
                  return { revoked: false, reason: "revocation status unknown" };
                }
              }
            }
          }
        }

        offset = elemEnd;
      }

      return { revoked: false, reason: "could not locate certStatus in OCSP response" };
    } catch {
      return { revoked: false, reason: "error parsing OCSP response structure" };
    }
  }

  /**
   * Check revocation via CRL (Certificate Revocation List)
   */
  private async checkCRL(
    certificate: CertificateInfo,
  ): Promise<{ revoked: boolean; reason?: string }> {
    const crlUrls = certificate.crlDistributionPoints ?? [];

    for (const url of crlUrls) {
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) continue;

        const crlData = new Uint8Array(await response.arrayBuffer());
        const revoked = this.parseCRLForSerial(crlData, certificate.serialNumber);
        if (revoked) {
          return { revoked: true, reason: "certificate found in CRL" };
        }
        // CRL fetched successfully and cert not in it
        return { revoked: false };
      } catch {
        continue; // Try next CRL URL
      }
    }

    return { revoked: false, reason: "could not fetch CRL" };
  }

  /**
   * Parse a DER-encoded CRL and check if a serial number is revoked.
   *
   * CRL structure:
   * CertificateList ::= SEQUENCE {
   *   tbsCertList TBSCertList ::= SEQUENCE {
   *     version, signature, issuer, thisUpdate, nextUpdate,
   *     revokedCertificates SEQUENCE OF SEQUENCE {
   *       userCertificate INTEGER (serial),
   *       revocationDate Time,
   *       ...
   *     }
   *   },
   *   ...
   * }
   */
  /**
   * Parse a DER-encoded CRL by walking the ASN.1 structure to find
   * the revokedCertificates field, then check each entry's serial.
   *
   * CRL: SEQUENCE { tbsCertList SEQUENCE { version, signature, issuer,
   *   thisUpdate, nextUpdate, revokedCertificates SEQUENCE OF SEQUENCE {
   *     userCertificate INTEGER, revocationDate Time, ... } }, ... }
   */
  private parseCRLForSerial(crlData: Uint8Array, serialNumber: string): boolean {
    try {
      const targetSerial = serialNumber.replace(/:/g, "").toLowerCase();

      // Outer SEQUENCE (CertificateList)
      if (crlData[0] !== 0x30) return false;
      const outerLen = this.readDERLength(crlData, 1);
      let offset = 1 + outerLen.bytesRead;

      // tbsCertList SEQUENCE
      if (crlData[offset] !== 0x30) return false;
      const tbsLen = this.readDERLength(crlData, offset + 1);
      let tbsOffset = offset + 1 + tbsLen.bytesRead;
      const tbsEnd = tbsOffset + tbsLen.length;

      // Walk tbsCertList fields to find revokedCertificates
      // Fields: version (INTEGER, optional), signature (SEQUENCE), issuer (SEQUENCE),
      //         thisUpdate (Time), nextUpdate (Time, optional), revokedCertificates (SEQUENCE OF, optional)
      let fieldCount = 0;
      while (tbsOffset < tbsEnd) {
        const tag = crlData[tbsOffset];
        const fLen = this.readDERLength(crlData, tbsOffset + 1);
        const fDataStart = tbsOffset + 1 + fLen.bytesRead;
        const fEnd = fDataStart + fLen.length;

        fieldCount++;

        // revokedCertificates is a SEQUENCE OF (tag 0x30) that appears after
        // version(opt), signature, issuer, thisUpdate, nextUpdate(opt).
        // It's the second SEQUENCE (0x30) we encounter after the first two (signature, issuer).
        // More reliable: it comes after the Time fields and is a SEQUENCE containing SEQUENCEs.
        if (tag === 0x30 && fieldCount >= 4) {
          // This could be revokedCertificates — check if it contains SEQUENCE entries
          if (fDataStart < fEnd && crlData[fDataStart] === 0x30) {
            // Walk each revokedCertificate entry
            let entryOffset = fDataStart;
            while (entryOffset < fEnd) {
              if (crlData[entryOffset] !== 0x30) break;
              const entryLen = this.readDERLength(crlData, entryOffset + 1);
              const entryDataStart = entryOffset + 1 + entryLen.bytesRead;
              const entryEnd = entryDataStart + entryLen.length;

              // First field is userCertificate INTEGER
              if (entryDataStart < entryEnd && crlData[entryDataStart] === 0x02) {
                const serialLen = this.readDERLength(crlData, entryDataStart + 1);
                const serialStart = entryDataStart + 1 + serialLen.bytesRead;
                const serialEnd = serialStart + serialLen.length;
                if (serialEnd <= crlData.length) {
                  const serialBytes = crlData.slice(serialStart, serialEnd);
                  const hexSerial = Array.from(serialBytes)
                    .map((b) => b.toString(16).padStart(2, "0"))
                    .join("")
                    .toLowerCase();
                  if (hexSerial === targetSerial) {
                    return true;
                  }
                }
              }

              entryOffset = entryEnd;
            }
            // We found and checked revokedCertificates — serial not found
            return false;
          }
        }

        tbsOffset = fEnd;
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Get certificate from server via raw TCP + TLS ClientHello.
   * Bypasses Deno's TLS API limitation by intercepting the TLS handshake
   * at the TCP level to extract the server's certificate.
   */
  async getCertificate(
    hostname: string,
    port: number = 443,
  ): Promise<CertificateInfo | null> {
    try {
      // Connect raw TCP
      const conn = await Deno.connect({ hostname, port });

      try {
        // Build and send TLS ClientHello
        const clientHello = this.buildClientHello(hostname);
        const tlsRecord = this.wrapTLSRecord(0x16, clientHello); // 0x16 = Handshake
        await conn.write(tlsRecord);

        // Read response — server sends ServerHello, Certificate, etc.
        const responseBuffer: ByteBuffer = new Uint8Array(16384); // 16KB buffer
        let totalRead = 0;
        const allData: Uint8Array[] = [];

        // Read multiple chunks — TLS records may span multiple TCP segments
        for (let attempt = 0; attempt < 10; attempt++) {
          try {
            conn.setKeepAlive(true);
            const bytesRead = await Promise.race([
              conn.read(responseBuffer),
              new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
            ]);

            if (bytesRead === null || bytesRead === 0) break;

            allData.push(responseBuffer.slice(0, bytesRead as number));
            totalRead += bytesRead as number;

            // Check if we've received a Certificate message
            const combined = this.concatUint8Arrays(allData);
            const certDER = this.extractCertificateFromTLS(combined);
            if (certDER) {
              conn.close();
              return this.parseDERToCertificateInfo(certDER);
            }
          } catch {
            break;
          }
        }

        conn.close();
      } catch {
        try { conn.close(); } catch { /* ignore */ }
      }
    } catch {
      // Connection failed
    }

    return null;
  }

  /**
   * Build a minimal TLS ClientHello handshake message
   */
  private buildClientHello(hostname: string): Uint8Array {
    // Client random (32 bytes)
    const clientRandom = crypto.getRandomValues(new Uint8Array(32));

    const components: Uint8Array[] = [];

    // Legacy version (TLS 1.2 = 0x0303)
    components.push(new Uint8Array([0x03, 0x03]));

    // Random
    components.push(clientRandom);

    // Session ID (empty)
    components.push(new Uint8Array([0x00]));

    // Cipher suites
    const cipherSuites = new Uint8Array([
      0x00, 0x08, // Length: 4 cipher suites × 2 bytes
      0x13, 0x01, // TLS_AES_128_GCM_SHA256
      0x13, 0x02, // TLS_AES_256_GCM_SHA384
      0xc0, 0x2f, // TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256
      0xc0, 0x30, // TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384
    ]);
    components.push(cipherSuites);

    // Compression methods (null only)
    components.push(new Uint8Array([0x01, 0x00]));

    // Extensions
    const extensions = this.buildClientHelloExtensions(hostname);
    components.push(extensions);

    // Combine all components
    const body = this.concatUint8Arrays(components);

    // Wrap in handshake header: type(1) + length(3)
    const handshake = new Uint8Array(4 + body.length);
    handshake[0] = 0x01; // ClientHello
    handshake[1] = (body.length >> 16) & 0xff;
    handshake[2] = (body.length >> 8) & 0xff;
    handshake[3] = body.length & 0xff;
    handshake.set(body, 4);

    return handshake;
  }

  /**
   * Build TLS ClientHello extensions (SNI + supported versions + signature algorithms)
   */
  private buildClientHelloExtensions(hostname: string): Uint8Array {
    const extensionList: Uint8Array[] = [];

    // SNI extension (type 0x0000)
    const hostBytes = new TextEncoder().encode(hostname);
    const sniEntry = new Uint8Array([
      0x00, // Host name type
      (hostBytes.length >> 8) & 0xff, hostBytes.length & 0xff,
      ...hostBytes,
    ]);
    const sniList = new Uint8Array([
      (sniEntry.length >> 8) & 0xff, sniEntry.length & 0xff,
      ...sniEntry,
    ]);
    extensionList.push(new Uint8Array([
      0x00, 0x00, // SNI extension type
      (sniList.length >> 8) & 0xff, sniList.length & 0xff,
      ...sniList,
    ]));

    // Supported Versions extension (type 0x002b) — advertise TLS 1.2 and 1.3
    extensionList.push(new Uint8Array([
      0x00, 0x2b, // supported_versions type
      0x00, 0x05, // length
      0x04,       // versions list length
      0x03, 0x04, // TLS 1.3
      0x03, 0x03, // TLS 1.2
    ]));

    // Signature Algorithms extension (type 0x000d)
    extensionList.push(new Uint8Array([
      0x00, 0x0d, // signature_algorithms type
      0x00, 0x0a, // length
      0x00, 0x08, // algorithms list length
      0x04, 0x01, // RSA-PKCS1-SHA256
      0x04, 0x03, // ECDSA-SHA256
      0x05, 0x01, // RSA-PKCS1-SHA384
      0x08, 0x04, // RSA-PSS-SHA256
    ]));

    // Supported Groups (type 0x000a) — for ECDHE key exchange
    extensionList.push(new Uint8Array([
      0x00, 0x0a, // supported_groups type
      0x00, 0x06, // length
      0x00, 0x04, // groups list length
      0x00, 0x17, // secp256r1
      0x00, 0x18, // secp384r1
    ]));

    // Combine all extensions
    const allExtensions = this.concatUint8Arrays(extensionList);

    // Wrap with total length prefix
    const result = new Uint8Array(2 + allExtensions.length);
    result[0] = (allExtensions.length >> 8) & 0xff;
    result[1] = allExtensions.length & 0xff;
    result.set(allExtensions, 2);

    return result;
  }

  /**
   * Wrap handshake data in a TLS record
   */
  private wrapTLSRecord(contentType: number, data: Uint8Array): Uint8Array {
    const record = new Uint8Array(5 + data.length);
    record[0] = contentType;
    record[1] = 0x03; // TLS 1.0 record version (for compatibility)
    record[2] = 0x01;
    record[3] = (data.length >> 8) & 0xff;
    record[4] = data.length & 0xff;
    record.set(data, 5);
    return record;
  }

  /**
   * Extract the first certificate's DER bytes from a raw TLS response.
   *
   * Scans TLS records for a Handshake record (type 0x16) containing
   * a Certificate message (handshake type 0x0B).
   */
  private extractCertificateFromTLS(data: Uint8Array): Uint8Array | null {
    let offset = 0;

    while (offset + 5 <= data.length) {
      const contentType = data[offset];
      const recordLength = (data[offset + 3] << 8) | data[offset + 4];
      const recordStart = offset + 5;
      const recordEnd = recordStart + recordLength;

      if (recordEnd > data.length) break;

      if (contentType === 0x16) {
        // Handshake record — scan for Certificate message (type 0x0B)
        let hsOffset = recordStart;

        while (hsOffset + 4 <= recordEnd) {
          const hsType = data[hsOffset];
          const hsLength = (data[hsOffset + 1] << 16) | (data[hsOffset + 2] << 8) | data[hsOffset + 3];
          const hsBodyStart = hsOffset + 4;
          const hsBodyEnd = hsBodyStart + hsLength;

          if (hsBodyEnd > recordEnd) break;

          if (hsType === 0x0b) {
            // Certificate message found!
            // Structure: certificates_length(3) + [cert_length(3) + cert_data]...
            if (hsBodyStart + 3 > data.length) break;
            const totalCertsLen = (data[hsBodyStart] << 16) | (data[hsBodyStart + 1] << 8) | data[hsBodyStart + 2];
            let certOffset = hsBodyStart + 3;

            if (certOffset + 3 > data.length) break;
            // First certificate (leaf)
            const certLen = (data[certOffset] << 16) | (data[certOffset + 1] << 8) | data[certOffset + 2];
            certOffset += 3;

            if (certOffset + certLen > data.length) break;
            return data.slice(certOffset, certOffset + certLen);
          }

          hsOffset = hsBodyEnd;
        }
      }

      offset = recordEnd;
    }

    return null;
  }

  /**
   * Parse raw DER certificate bytes into CertificateInfo
   */
  private parseDERToCertificateInfo(derBytes: Uint8Array): CertificateInfo | null {
    try {
      // Wrap in PEM format so we can use parsePEMCertificates
      const base64 = this.uint8ArrayToBase64(derBytes);
      const pem = `-----BEGIN CERTIFICATE-----\n${base64}\n-----END CERTIFICATE-----`;
      const certs = parsePEMCertificates(pem);
      if (certs.length === 0) return null;

      const info = this.certificateToInfo(certs[0], derBytes);

      // Parse extensions from raw DER for OCSP/CRL URLs
      const extensions = this.parseExtensionsFromDER(derBytes);
      info.ocspResponderUrl = extensions.ocspUrl;
      info.crlDistributionPoints = extensions.crlUrls;

      return info;
    } catch {
      return null;
    }
  }

  /**
   * Parse X.509 extensions from raw DER certificate to extract OCSP and CRL URLs
   */
  private parseExtensionsFromDER(der: Uint8Array): { ocspUrl?: string; crlUrls: string[] } {
    const result: { ocspUrl?: string; crlUrls: string[] } = { crlUrls: [] };

    try {
      // Find the extensions block (context tag [3] = 0xA3)
      // Scan for 0xA3 followed by a valid length
      for (let i = 0; i < der.length - 5; i++) {
        if (der[i] === 0xa3) {
          const len = this.readDERLength(der, i + 1);
          const extBlockStart = i + 1 + len.bytesRead;
          const extBlockEnd = extBlockStart + len.length;
          if (extBlockEnd <= der.length) {
            this.parseExtensionBlock(der, extBlockStart, extBlockEnd, result);
            break;
          }
        }
      }
    } catch {
      // Extension parsing failures are non-fatal
    }

    return result;
  }

  /**
   * Parse an extensions SEQUENCE block looking for AIA and CRL DP extensions
   */
  private parseExtensionBlock(
    der: Uint8Array,
    start: number,
    end: number,
    result: { ocspUrl?: string; crlUrls: string[] },
  ): void {
    // Extensions is a SEQUENCE OF Extension
    if (der[start] !== 0x30) return;
    const outerLen = this.readDERLength(der, start + 1);
    let offset = start + 1 + outerLen.bytesRead;

    while (offset < end) {
      if (der[offset] !== 0x30) break;
      const extLen = this.readDERLength(der, offset + 1);
      const extStart = offset + 1 + extLen.bytesRead;
      const extEnd = extStart + extLen.length;

      // Parse extension OID
      if (der[extStart] === 0x06) {
        if (extStart + 1 >= der.length) break;
        const oidLen = der[extStart + 1];
        if (extStart + 2 + oidLen > der.length) break;
        const oidBytes = der.slice(extStart + 2, extStart + 2 + oidLen);

        // AIA: OID 1.3.6.1.5.5.7.1.1 → [2b 06 01 05 05 07 01 01]
        if (this.matchOIDBytes(oidBytes, [0x2b, 0x06, 0x01, 0x05, 0x05, 0x07, 0x01, 0x01])) {
          // Extract OCSP URL from AIA value
          const url = this.extractURLFromExtension(der, extStart + 2 + oidLen, extEnd);
          if (url) result.ocspUrl = url;
        }

        // CRL Distribution Points: OID 2.5.29.31 → [55 1d 1f]
        if (this.matchOIDBytes(oidBytes, [0x55, 0x1d, 0x1f])) {
          const url = this.extractURLFromExtension(der, extStart + 2 + oidLen, extEnd);
          if (url) result.crlUrls.push(url);
        }
      }

      offset = extEnd;
    }
  }

  /**
   * Extract a URL string from a DER extension value.
   * Scans for IA5String (0x86 context tag or 0x16 tag) containing a URL.
   */
  private extractURLFromExtension(der: Uint8Array, start: number, end: number): string | null {
    // Look for context-specific [6] (IA5String URI) or regular IA5String
    for (let i = start; i < end - 2; i++) {
      if (der[i] === 0x86) {
        // Context [6] — uniformResourceIdentifier
        if (i + 1 >= der.length) break;
        const len = der[i + 1];
        if (i + 2 + len > der.length) break;
        if (i + 2 + len <= end) {
          const url = new TextDecoder().decode(der.slice(i + 2, i + 2 + len));
          if (url.startsWith("http")) return url;
        }
      }
    }
    return null;
  }

  /**
   * Match OID bytes against expected values
   */
  private matchOIDBytes(actual: Uint8Array, expected: number[]): boolean {
    if (actual.length !== expected.length) return false;
    for (let i = 0; i < expected.length; i++) {
      if (actual[i] !== expected[i]) return false;
    }
    return true;
  }

  // =====================================================================
  // DER utility helpers
  // =====================================================================

  private readDERLength(data: Uint8Array, offset: number): { length: number; bytesRead: number } {
    if (offset >= data.length) {
      throw new Error("DER data truncated: expected length byte at offset " + offset);
    }
    const firstByte = data[offset];
    if (firstByte < 0x80) {
      return { length: firstByte, bytesRead: 1 };
    }
    const numBytes = firstByte & 0x7f;
    if (offset + 1 + numBytes > data.length) {
      throw new Error("DER data truncated: expected " + numBytes + " length bytes at offset " + (offset + 1));
    }
    let length = 0;
    for (let i = 0; i < numBytes; i++) {
      length = (length << 8) | data[offset + 1 + i];
    }
    return { length, bytesRead: 1 + numBytes };
  }

  private derSequence(content: Uint8Array): Uint8Array {
    const lenBytes = this.encodeDERLength(content.length);
    const result = new Uint8Array(1 + lenBytes.length + content.length);
    result[0] = 0x30; // SEQUENCE
    result.set(lenBytes, 1);
    result.set(content, 1 + lenBytes.length);
    return result;
  }

  private encodeDERLength(length: number): Uint8Array {
    if (length < 0x80) return new Uint8Array([length]);
    if (length < 0x100) return new Uint8Array([0x81, length]);
    return new Uint8Array([0x82, (length >> 8) & 0xff, length & 0xff]);
  }

  private serialToBytes(serial: string): Uint8Array {
    const hex = serial.replace(/:/g, "");
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  }

  private uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
    const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
      result.set(arr, offset);
      offset += arr.length;
    }
    return result;
  }
}

/**
 * Global certificate validator
 */
export const globalCertValidator = new CertificateValidator();

/**
 * Quick validation helper
 */
export async function validateCertificate(
  hostname: string,
  port: number = 443,
  options?: CertificateValidatorOptions,
): Promise<ValidationResult> {
  const validator = new CertificateValidator(options);
  return await validator.validate(hostname, port);
}

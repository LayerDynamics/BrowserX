/**
 * CertificateValidator tests
 * Tests parseCertificate, checkRevocation, getCertificate, TLS helpers, validation logic
 */

import { assertEquals, assert, assertExists } from "@std/assert";
import { CertificateValidator } from "../../../../core/network/external/cert_validator.ts";
import type { CertificateInfo } from "../../../../core/network/external/cert_validator.ts";

// =============================================================================
// Self-signed test certificate (PEM)
// =============================================================================

// Real self-signed certificate generated with OpenSSL for testing
const TEST_CERT_PEM = `-----BEGIN CERTIFICATE-----
MIIC5DCCAcwCCQCkifVB8WLwPTANBgkqhkiG9w0BAQsFADA0MRIwEAYDVQQDDAls
b2NhbGhvc3QxETAPBgNVBAoMCFRlc3QgT3JnMQswCQYDVQQGEwJVUzAeFw0yNjAy
MjIxMTA1NDlaFw0yNzAyMjIxMTA1NDlaMDQxEjAQBgNVBAMMCWxvY2FsaG9zdDER
MA8GA1UECgwIVGVzdCBPcmcxCzAJBgNVBAYTAlVTMIIBIjANBgkqhkiG9w0BAQEF
AAOCAQ8AMIIBCgKCAQEAs/UoKF20vCDqNUYGAQ7qNi9uirQ1ar28gQwIPSiW1H/D
s4i0DHlTCVe9ogtbyb3AdjJNp2zZH20uVpvQc0BEj0azbWtY1bOlL3Y2StNU77ZG
FaPY+wonjhkqqYHUiVo2FMOZ66AtkG3XUlfweGLjtQ7E6nW2kjld9+PiwcLFA2O2
ANFiY7WcZvanQrXVn7j6lo7D7Tk6LTpB07B2LBtfgwWZu3UrpW2xAYbCEeZMp2fV
YEcOD5ZLjitaZ3KXDYFBouNBvOGNovZelz+ST2FXfOqal5wKf0U93OTLq2pFAqUD
AR3UBUqOwIwCmzym+bsFYs3+yOCWQ8FtJDQ4GshC4wIDAQABMA0GCSqGSIb3DQEB
CwUAA4IBAQA11v5qXbawNxrJ6jYXgB//Kj/487MHFW6Wy6yiIWB7s96QP22SubxW
cZr9DGEF+srK9lZ7qiCq9/5GbVWovKV6ciJrnIGepzfHYzjQnmNDWb2Q38F3dABi
sGRi1tGBqQwl2AaW3Mbw7O04ChaHyrQEHSY/1pmxWt6o+IXGSzblGVj8eo8cp5ly
OWvBKh+VavD4nMNinyT22ugSmhjJw9o6zn2oXUfsWuDPuCFdC3MYVEagwsqDPHc/
c8KtKaDv5ITQtW1usc5dbkDU45JksibCdSuiSzsbGuJlmKcz3l4XcPXMiJU+rrCf
DnfItHwQCKKeRfZSPF3RtjkXgCo5oB+L
-----END CERTIFICATE-----`;

// =============================================================================
// parseCertificate
// =============================================================================

Deno.test("parseCertificate - valid PEM returns CertificateInfo", () => {
    const validator = new CertificateValidator();
    const info = validator.parseCertificate(TEST_CERT_PEM);
    assertExists(info);
    assertEquals(info.subject.commonName, "localhost");
    assert(info.validFrom instanceof Date);
    assert(info.validTo instanceof Date);
    assert(info.serialNumber.length > 0);
    assert(info.fingerprint.length > 0);
});

Deno.test("parseCertificate - invalid PEM returns null", () => {
    const validator = new CertificateValidator();
    assertEquals(validator.parseCertificate("not a certificate"), null);
    assertEquals(validator.parseCertificate(""), null);
    assertEquals(validator.parseCertificate("-----BEGIN CERTIFICATE-----\ninvalid\n-----END CERTIFICATE-----"), null);
});

Deno.test("parseCertificateChain - returns array of CertificateInfo", () => {
    const validator = new CertificateValidator();
    const chain = validator.parseCertificateChain(TEST_CERT_PEM);
    assertEquals(chain.length, 1);
    assertEquals(chain[0].subject.commonName, "localhost");
});

Deno.test("parseCertificateChain - invalid PEM returns empty array", () => {
    const validator = new CertificateValidator();
    assertEquals(validator.parseCertificateChain("garbage").length, 0);
});

// =============================================================================
// validateExpiration
// =============================================================================

Deno.test("validateExpiration - valid certificate", () => {
    const validator = new CertificateValidator();
    const past = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const result = validator.validateExpiration(past, future);
    assertEquals(result.valid, true);
    assertEquals(result.errors.length, 0);
});

Deno.test("validateExpiration - expired certificate", () => {
    const validator = new CertificateValidator();
    const past1 = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000);
    const past2 = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const result = validator.validateExpiration(past1, past2);
    assertEquals(result.valid, false);
    assert(result.errors[0].includes("expired"));
});

Deno.test("validateExpiration - not yet valid certificate", () => {
    const validator = new CertificateValidator();
    const future1 = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const future2 = new Date(Date.now() + 730 * 24 * 60 * 60 * 1000);
    const result = validator.validateExpiration(future1, future2);
    assertEquals(result.valid, false);
    assert(result.errors[0].includes("not yet valid"));
});

Deno.test("validateExpiration - expiring within 30 days warns", () => {
    const validator = new CertificateValidator();
    const past = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const soonExpire = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
    const result = validator.validateExpiration(past, soonExpire);
    assertEquals(result.valid, true);
    assert(result.warnings.length > 0);
    assert(result.warnings[0].includes("expire soon"));
});

// =============================================================================
// validateHostname
// =============================================================================

Deno.test("validateHostname - exact match", () => {
    const validator = new CertificateValidator();
    const result = validator.validateHostname("example.com", "example.com");
    assertEquals(result.valid, true);
});

Deno.test("validateHostname - case insensitive", () => {
    const validator = new CertificateValidator();
    assertEquals(validator.validateHostname("Example.COM", "example.com").valid, true);
});

Deno.test("validateHostname - wildcard match", () => {
    const validator = new CertificateValidator();
    assertEquals(validator.validateHostname("www.example.com", "*.example.com").valid, true);
    assertEquals(validator.validateHostname("api.example.com", "*.example.com").valid, true);
});

Deno.test("validateHostname - wildcard does not match bare domain", () => {
    const validator = new CertificateValidator();
    assertEquals(validator.validateHostname("example.com", "*.example.com").valid, false);
});

Deno.test("validateHostname - wildcard does not match sub-subdomain", () => {
    const validator = new CertificateValidator();
    assertEquals(validator.validateHostname("a.b.example.com", "*.example.com").valid, false);
});

Deno.test("validateHostname - SAN match", () => {
    const validator = new CertificateValidator();
    const result = validator.validateHostname("api.example.com", "example.com", ["api.example.com", "www.example.com"]);
    assertEquals(result.valid, true);
});

Deno.test("validateHostname - no match reports error", () => {
    const validator = new CertificateValidator();
    const result = validator.validateHostname("evil.com", "example.com", ["www.example.com"]);
    assertEquals(result.valid, false);
    assert(result.errors[0].includes("evil.com"));
});

// =============================================================================
// isSelfSigned
// =============================================================================

Deno.test("isSelfSigned - detects self-signed cert", () => {
    const validator = new CertificateValidator();
    const cert: CertificateInfo = {
        subject: { commonName: "Test CA", organization: "Self", country: "US" },
        issuer: { commonName: "Test CA", organization: "Self", country: "US" },
        validFrom: new Date(),
        validTo: new Date(),
        serialNumber: "01",
        fingerprint: "aa:bb",
    };
    assertEquals(validator.isSelfSigned(cert), true);
});

Deno.test("isSelfSigned - non-self-signed cert", () => {
    const validator = new CertificateValidator();
    const cert: CertificateInfo = {
        subject: { commonName: "example.com", organization: "Example" },
        issuer: { commonName: "DigiCert", organization: "DigiCert Inc" },
        validFrom: new Date(),
        validTo: new Date(),
        serialNumber: "01",
        fingerprint: "aa:bb",
    };
    assertEquals(validator.isSelfSigned(cert), false);
});

// =============================================================================
// checkRevocation
// =============================================================================

Deno.test("checkRevocation - no OCSP or CRL returns not revoked", async () => {
    const validator = new CertificateValidator();
    const cert: CertificateInfo = {
        subject: { commonName: "test" },
        issuer: { commonName: "issuer" },
        validFrom: new Date(),
        validTo: new Date(),
        serialNumber: "01:02:03",
        fingerprint: "aa:bb",
    };
    const result = await validator.checkRevocation(cert);
    assertEquals(result.revoked, false);
    assert(result.reason?.includes("no revocation endpoint"));
});

Deno.test("checkRevocation - cached result is returned", async () => {
    const validator = new CertificateValidator();
    const cert: CertificateInfo = {
        subject: { commonName: "test" },
        issuer: { commonName: "issuer" },
        validFrom: new Date(),
        validTo: new Date(),
        serialNumber: "cached-serial",
        fingerprint: "aa:bb",
    };

    // First call — no endpoints, gets cached as not revoked
    await validator.checkRevocation(cert);

    // Second call — should hit cache
    const result = await validator.checkRevocation(cert);
    assertEquals(result.revoked, false);
});

// =============================================================================
// TLS ClientHello builder
// =============================================================================

Deno.test("buildClientHello produces valid TLS record", () => {
    const validator = new CertificateValidator();
    // Access private method via prototype
    const buildClientHello = (validator as any).buildClientHello.bind(validator);
    const hello = buildClientHello("example.com");

    // Should be a handshake message (type 0x01 = ClientHello)
    assertEquals(hello[0], 0x01);

    // Length is 3 bytes (big-endian)
    const length = (hello[1] << 16) | (hello[2] << 8) | hello[3];
    assertEquals(hello.length, 4 + length);
});

Deno.test("wrapTLSRecord creates proper TLS record", () => {
    const validator = new CertificateValidator();
    const wrap = (validator as any).wrapTLSRecord.bind(validator);
    const payload = new Uint8Array([0x01, 0x02, 0x03]);
    const record = wrap(0x16, payload);

    assertEquals(record[0], 0x16); // Handshake content type
    assertEquals(record[1], 0x03); // TLS 1.0
    assertEquals(record[2], 0x01);
    assertEquals((record[3] << 8) | record[4], 3); // length
    assertEquals(record[5], 0x01);
    assertEquals(record[6], 0x02);
    assertEquals(record[7], 0x03);
});

Deno.test("buildClientHelloExtensions includes SNI", () => {
    const validator = new CertificateValidator();
    const buildExt = (validator as any).buildClientHelloExtensions.bind(validator);
    const ext = buildExt("example.com");

    // Should contain "example.com" bytes
    const hostBytes = new TextEncoder().encode("example.com");
    const extStr = new TextDecoder().decode(ext);
    assert(extStr.includes("example.com"));
});

// =============================================================================
// extractCertificateFromTLS
// =============================================================================

Deno.test("extractCertificateFromTLS - extracts cert from valid TLS record", () => {
    const validator = new CertificateValidator();
    const extract = (validator as any).extractCertificateFromTLS.bind(validator);

    // Build a fake TLS record with a Certificate handshake message
    // Certificate handshake body: total_certs_len(3) + cert_len(3) + cert_data(4) = 10 bytes
    // Handshake msg: type(1) + length(3) + body(10) = 14 bytes total
    const certMsg = new Uint8Array([
        0x0b, // Certificate handshake type
        0x00, 0x00, 0x0a, // handshake body length = 10
        // total_certs_length = 3 + 4 = 7
        0x00, 0x00, 0x07,
        // first cert length = 4
        0x00, 0x00, 0x04,
        // cert data
        0xDE, 0xAD, 0xBE, 0xEF,
    ]);

    // Wrap in TLS record
    const tlsRecord = new Uint8Array(5 + certMsg.length);
    tlsRecord[0] = 0x16; // Handshake
    tlsRecord[1] = 0x03;
    tlsRecord[2] = 0x03;
    tlsRecord[3] = (certMsg.length >> 8) & 0xff;
    tlsRecord[4] = certMsg.length & 0xff;
    tlsRecord.set(certMsg, 5);

    const result = extract(tlsRecord);
    assertExists(result);
    assertEquals(result.length, 4);
    assertEquals(result[0], 0xDE);
    assertEquals(result[1], 0xAD);
    assertEquals(result[2], 0xBE);
    assertEquals(result[3], 0xEF);
});

Deno.test("extractCertificateFromTLS - returns null for non-handshake records", () => {
    const validator = new CertificateValidator();
    const extract = (validator as any).extractCertificateFromTLS.bind(validator);

    // Application data record (type 0x17), not handshake
    const record = new Uint8Array([0x17, 0x03, 0x03, 0x00, 0x03, 0x01, 0x02, 0x03]);
    assertEquals(extract(record), null);
});

Deno.test("extractCertificateFromTLS - returns null for empty data", () => {
    const validator = new CertificateValidator();
    const extract = (validator as any).extractCertificateFromTLS.bind(validator);
    assertEquals(extract(new Uint8Array(0)), null);
    assertEquals(extract(new Uint8Array([0x16, 0x03])), null);
});

// =============================================================================
// DER helpers
// =============================================================================

Deno.test("readDERLength - short form", () => {
    const validator = new CertificateValidator();
    const read = (validator as any).readDERLength.bind(validator);
    const data = new Uint8Array([42]);
    const result = read(data, 0);
    assertEquals(result.length, 42);
    assertEquals(result.bytesRead, 1);
});

Deno.test("readDERLength - long form (2 bytes)", () => {
    const validator = new CertificateValidator();
    const read = (validator as any).readDERLength.bind(validator);
    const data = new Uint8Array([0x82, 0x01, 0x00]); // 256
    const result = read(data, 0);
    assertEquals(result.length, 256);
    assertEquals(result.bytesRead, 3);
});

Deno.test("encodeDERLength - short form", () => {
    const validator = new CertificateValidator();
    const encode = (validator as any).encodeDERLength.bind(validator);
    const result = encode(42);
    assertEquals(result.length, 1);
    assertEquals(result[0], 42);
});

Deno.test("encodeDERLength - long form (1 extra byte)", () => {
    const validator = new CertificateValidator();
    const encode = (validator as any).encodeDERLength.bind(validator);
    const result = encode(200);
    assertEquals(result[0], 0x81);
    assertEquals(result[1], 200);
});

Deno.test("encodeDERLength - long form (2 extra bytes)", () => {
    const validator = new CertificateValidator();
    const encode = (validator as any).encodeDERLength.bind(validator);
    const result = encode(300);
    assertEquals(result[0], 0x82);
    assertEquals((result[1] << 8) | result[2], 300);
});

Deno.test("derSequence wraps content with SEQUENCE tag", () => {
    const validator = new CertificateValidator();
    const seq = (validator as any).derSequence.bind(validator);
    const content = new Uint8Array([0x01, 0x02, 0x03]);
    const result = seq(content);
    assertEquals(result[0], 0x30); // SEQUENCE tag
    assertEquals(result[1], 3);    // length
    assertEquals(result[2], 0x01);
    assertEquals(result[3], 0x02);
    assertEquals(result[4], 0x03);
});

Deno.test("serialToBytes converts hex serial", () => {
    const validator = new CertificateValidator();
    const convert = (validator as any).serialToBytes.bind(validator);
    const result = convert("01:02:ff");
    assertEquals(result.length, 3);
    assertEquals(result[0], 0x01);
    assertEquals(result[1], 0x02);
    assertEquals(result[2], 0xff);
});

Deno.test("uint8ArrayToBase64 roundtrip", () => {
    const validator = new CertificateValidator();
    const toBase64 = (validator as any).uint8ArrayToBase64.bind(validator);
    const bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    assertEquals(toBase64(bytes), btoa("Hello"));
});

Deno.test("concatUint8Arrays merges correctly", () => {
    const validator = new CertificateValidator();
    const concat = (validator as any).concatUint8Arrays.bind(validator);
    const result = concat([
        new Uint8Array([1, 2]),
        new Uint8Array([3, 4, 5]),
    ]);
    assertEquals(result.length, 5);
    assertEquals(Array.from(result), [1, 2, 3, 4, 5]);
});

// =============================================================================
// OCSP response parsing
// =============================================================================

/**
 * Build a minimal valid OCSP response with the given certStatus tag.
 * Structure: OCSPResponse { ENUMERATED(0), responseBytes [0] {
 *   SEQUENCE { OID(basic), OCTET STRING { BasicOCSPResponse SEQUENCE {
 *     tbsResponseData SEQUENCE { responses SEQUENCE OF { SingleResponse SEQUENCE {
 *       certID SEQUENCE { ... }, certStatus } } } } } } }
 */
function buildOCSPResponse(certStatusTag: number, certStatusLen: number, certStatusBody: number[] = []): Uint8Array {
    // certID: minimal SEQUENCE with just an INTEGER
    const certID = [0x30, 0x03, 0x02, 0x01, 0x01]; // SEQUENCE { INTEGER(1) }
    // certStatus
    const certStatus = [certStatusTag, certStatusLen, ...certStatusBody];
    // SingleResponse SEQUENCE
    const singleResp = [0x30, certID.length + certStatus.length, ...certID, ...certStatus];
    // responses SEQUENCE OF
    const responses = [0x30, singleResp.length, ...singleResp];
    // tbsResponseData SEQUENCE
    const tbsData = [0x30, responses.length, ...responses];
    // BasicOCSPResponse SEQUENCE
    const basic = [0x30, tbsData.length, ...tbsData];
    // OCTET STRING wrapping BasicOCSPResponse
    const octetStr = [0x04, basic.length, ...basic];
    // id-pkix-ocsp-basic OID (1.3.6.1.5.5.7.48.1.1)
    const oid = [0x06, 0x09, 0x2b, 0x06, 0x01, 0x05, 0x05, 0x07, 0x30, 0x01, 0x01];
    // responseBytes inner SEQUENCE { OID, OCTET STRING }
    const rbInner = [0x30, oid.length + octetStr.length, ...oid, ...octetStr];
    // responseBytes [0] EXPLICIT
    const rb = [0xa0, rbInner.length, ...rbInner];
    // OCSPResponse SEQUENCE { ENUMERATED(0=successful), responseBytes }
    const enumField = [0x0a, 0x01, 0x00]; // successful
    const outer = [0x30, enumField.length + rb.length, ...enumField, ...rb];
    return new Uint8Array(outer);
}

Deno.test("parseOCSPResponse - good status", () => {
    const validator = new CertificateValidator();
    const parse = (validator as any).parseOCSPResponse.bind(validator);
    // certStatus good [0] IMPLICIT NULL
    const data = buildOCSPResponse(0x80, 0x00);
    const result = parse(data);
    assertEquals(result.revoked, false);
});

Deno.test("parseOCSPResponse - revoked status", () => {
    const validator = new CertificateValidator();
    const parse = (validator as any).parseOCSPResponse.bind(validator);
    // certStatus revoked [1] with 3 bytes body (revocation time placeholder)
    const data = buildOCSPResponse(0xa1, 0x03, [0x00, 0x00, 0x00]);
    const result = parse(data);
    assertEquals(result.revoked, true);
});

Deno.test("parseOCSPResponse - empty response", () => {
    const validator = new CertificateValidator();
    const parse = (validator as any).parseOCSPResponse.bind(validator);
    const result = parse(new Uint8Array([0x30, 0x00]));
    assertEquals(result.revoked, false);
});

// =============================================================================
// CRL parsing
// =============================================================================

/**
 * Build a minimal valid CRL with revokedCertificates entries.
 * Structure: CertificateList SEQUENCE { tbsCertList SEQUENCE {
 *   version INTEGER, signature SEQUENCE{OID}, issuer SEQUENCE{SET},
 *   thisUpdate UTCTime, revokedCertificates SEQUENCE OF { SEQUENCE { INTEGER, UTCTime } }
 * } }
 */
function buildCRL(serials: number[][]): Uint8Array {
    // Build revokedCertificates entries
    const entries: number[] = [];
    for (const serial of serials) {
        const entry = [0x30, 2 + serial.length + 2, 0x02, serial.length, ...serial, 0x17, 0x00];
        entries.push(...entry);
    }
    // revokedCertificates SEQUENCE OF
    const revokedCerts = [0x30, entries.length, ...entries];
    // version INTEGER(1)
    const version = [0x02, 0x01, 0x01];
    // signature AlgorithmIdentifier SEQUENCE { OID }
    const sig = [0x30, 0x03, 0x06, 0x01, 0x00];
    // issuer Name SEQUENCE { SET { SEQUENCE { OID, UTF8String } } }
    const issuer = [0x30, 0x05, 0x31, 0x03, 0x30, 0x01, 0x00];
    // thisUpdate UTCTime (minimal)
    const thisUpdate = [0x17, 0x00];
    // tbsCertList SEQUENCE
    const tbsBody = [...version, ...sig, ...issuer, ...thisUpdate, ...revokedCerts];
    const tbs = [0x30, tbsBody.length, ...tbsBody];
    // CertificateList SEQUENCE
    return new Uint8Array([0x30, tbs.length, ...tbs]);
}

Deno.test("parseCRLForSerial - finds matching serial", () => {
    const validator = new CertificateValidator();
    const parseCRL = (validator as any).parseCRLForSerial.bind(validator);

    const crlData = buildCRL([[0xDE, 0xAD]]);

    assertEquals(parseCRL(crlData, "dead"), true);
    assertEquals(parseCRL(crlData, "beef"), false);
});

Deno.test("parseCRLForSerial - handles colons in serial", () => {
    const validator = new CertificateValidator();
    const parseCRL = (validator as any).parseCRLForSerial.bind(validator);

    const crlData = buildCRL([[0x01, 0x02, 0x03]]);

    assertEquals(parseCRL(crlData, "01:02:03"), true);
});

// =============================================================================
// Constructor defaults
// =============================================================================

Deno.test("CertificateValidator defaults", () => {
    const validator = new CertificateValidator();
    const opts = (validator as any).options;
    assertEquals(opts.checkExpiration, true);
    assertEquals(opts.checkHostname, true);
    assertEquals(opts.checkRevocation, false);
    assertEquals(opts.allowSelfSigned, false);
});

Deno.test("CertificateValidator custom options", () => {
    const validator = new CertificateValidator({
        checkExpiration: false,
        allowSelfSigned: true,
        checkRevocation: true,
    });
    const opts = (validator as any).options;
    assertEquals(opts.checkExpiration, false);
    assertEquals(opts.allowSelfSigned, true);
    assertEquals(opts.checkRevocation, true);
});

// =============================================================================
// buildOCSPRequest produces valid structure
// =============================================================================

Deno.test("buildOCSPRequest produces DER SEQUENCE", () => {
    const validator = new CertificateValidator();
    const build = (validator as any).buildOCSPRequest.bind(validator);
    const serialBytes = new Uint8Array([0x01, 0x02, 0x03]);
    const request = build(serialBytes);

    // Should start with SEQUENCE tag
    assertEquals(request[0], 0x30);
    assert(request.length > 10);
});

// =============================================================================
// DN string parsing
// =============================================================================

Deno.test("parseDNString parses CN, O, C", () => {
    const validator = new CertificateValidator();
    const parse = (validator as any).parseDNString.bind(validator);

    const result = parse("CN=example.com, O=Example Inc, C=US, ST=California, L=SF, OU=Engineering");
    assertEquals(result.commonName, "example.com");
    assertEquals(result.organization, "Example Inc");
    assertEquals(result.country, "US");
    assertEquals(result.state, "California");
    assertEquals(result.locality, "SF");
    assertEquals(result.organizationalUnit, "Engineering");
});

Deno.test("parseDNString handles empty string", () => {
    const validator = new CertificateValidator();
    const parse = (validator as any).parseDNString.bind(validator);
    const result = parse("");
    assertEquals(result.commonName, undefined);
});

// =============================================================================
// matchOIDBytes
// =============================================================================

Deno.test("matchOIDBytes - match", () => {
    const validator = new CertificateValidator();
    const match = (validator as any).matchOIDBytes.bind(validator);
    assertEquals(match(new Uint8Array([0x55, 0x1d, 0x1f]), [0x55, 0x1d, 0x1f]), true);
});

Deno.test("matchOIDBytes - no match", () => {
    const validator = new CertificateValidator();
    const match = (validator as any).matchOIDBytes.bind(validator);
    assertEquals(match(new Uint8Array([0x55, 0x1d, 0x1f]), [0x55, 0x1d, 0x20]), false);
});

Deno.test("matchOIDBytes - length mismatch", () => {
    const validator = new CertificateValidator();
    const match = (validator as any).matchOIDBytes.bind(validator);
    assertEquals(match(new Uint8Array([0x55, 0x1d]), [0x55, 0x1d, 0x1f]), false);
});

// =============================================================================
// extractURLFromExtension
// =============================================================================

Deno.test("extractURLFromExtension - finds URL with context tag 0x86", () => {
    const validator = new CertificateValidator();
    const extract = (validator as any).extractURLFromExtension.bind(validator);

    const url = "http://ocsp.example.com";
    const urlBytes = new TextEncoder().encode(url);
    const data = new Uint8Array([
        0x30, 0x20, // some wrapping
        0x86, urlBytes.length, ...urlBytes,
    ]);

    const result = extract(data, 0, data.length);
    assertEquals(result, url);
});

Deno.test("extractURLFromExtension - returns null when no URL found", () => {
    const validator = new CertificateValidator();
    const extract = (validator as any).extractURLFromExtension.bind(validator);
    assertEquals(extract(new Uint8Array([0x30, 0x02, 0x00, 0x00]), 0, 4), null);
});

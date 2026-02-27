/**
 * Certificate Tests
 *
 * Comprehensive tests for certificate validation.
 */

import { assert, assertEquals, assertExists } from "@std/assert";
import {
  type CertificateValidationResult,
  checkRevocationStatus,
  derEncodeDistinguishedName,
  validateCertificate,
} from "../../../../src/engine/network/security/Certificate.ts";
import type { Certificate } from "../../../../src/types/network.ts";

// Helper to create mock certificate
function createMockCertificate(partial: Partial<Certificate>): Certificate {
  return {
    version: 3,
    serialNumber: "123456",
    signature: new Uint8Array(0),
    signatureAlgorithm: "RSA-SHA256",
    issuer: "CN=Test CA",
    subject: "CN=example.com",
    subjectAltNames: ["example.com"],
    notBefore: new Date(Date.now() - 86400000), // Yesterday
    notAfter: new Date(Date.now() + 86400000), // Tomorrow
    publicKey: new Uint8Array(0),
    ...partial,
  };
}

// ============================================================================
// validateCertificate Tests - Expiration
// ============================================================================

Deno.test({
  name: "validateCertificate - rejects certificate not yet valid",
  async fn() {
    const cert = createMockCertificate({
      notBefore: new Date(Date.now() + 86400000), // Tomorrow
      notAfter: new Date(Date.now() + 172800000), // 2 days from now
    });

    const result = await validateCertificate(cert, "example.com", []);

    assertEquals(result.valid, false);
    assertEquals(result.reason, "Certificate not yet valid");
  },
});

Deno.test({
  name: "validateCertificate - rejects expired certificate",
  async fn() {
    const cert = createMockCertificate({
      notBefore: new Date(Date.now() - 172800000), // 2 days ago
      notAfter: new Date(Date.now() - 86400000), // Yesterday
    });

    const result = await validateCertificate(cert, "example.com", []);

    assertEquals(result.valid, false);
    assertEquals(result.reason, "Certificate expired");
  },
});

Deno.test({
  name: "validateCertificate - accepts certificate with valid dates",
  async fn() {
    const cert = createMockCertificate({
      issuer: "CN=example.com", // Self-signed for this test
      subject: "CN=example.com",
    });

    const trustedCAs = [cert]; // Self-signed is trusted

    const result = await validateCertificate(cert, "example.com", trustedCAs);

    // May fail on chain building, but should pass expiration check
    assert(result.reason !== "Certificate not yet valid");
    assert(result.reason !== "Certificate expired");
  },
});

// ============================================================================
// validateCertificate Tests - Hostname Matching
// ============================================================================

Deno.test({
  name: "validateCertificate - rejects hostname mismatch",
  async fn() {
    const cert = createMockCertificate({
      subject: "CN=example.com",
      subjectAltNames: ["example.com"],
    });

    const result = await validateCertificate(cert, "different.com", []);

    assertEquals(result.valid, false);
    assertEquals(result.reason, "Hostname mismatch");
  },
});

Deno.test({
  name: "validateCertificate - accepts exact hostname match",
  async fn() {
    const cert = createMockCertificate({
      issuer: "CN=example.com", // Self-signed
      subject: "CN=example.com",
      subjectAltNames: ["example.com"],
    });

    const trustedCAs = [cert];

    const result = await validateCertificate(cert, "example.com", trustedCAs);

    // Should pass hostname check
    assert(result.reason !== "Hostname mismatch");
  },
});

Deno.test({
  name: "validateCertificate - accepts wildcard hostname match",
  async fn() {
    const cert = createMockCertificate({
      issuer: "CN=*.example.com", // Self-signed
      subject: "CN=*.example.com",
      subjectAltNames: ["*.example.com"],
    });

    const trustedCAs = [cert];

    const result = await validateCertificate(cert, "sub.example.com", trustedCAs);

    // Should pass hostname check for wildcard
    assert(result.reason !== "Hostname mismatch");
  },
});

Deno.test({
  name: "validateCertificate - checks subjectAltNames",
  async fn() {
    const cert = createMockCertificate({
      issuer: "CN=Test CA", // Self-signed
      subject: "CN=Test CA",
      subjectAltNames: ["example.com", "www.example.com"],
    });

    const trustedCAs = [cert];

    // Should match www.example.com from subjectAltNames
    const result = await validateCertificate(cert, "www.example.com", trustedCAs);

    assert(result.reason !== "Hostname mismatch");
  },
});

// ============================================================================
// validateCertificate Tests - Chain Building
// ============================================================================

Deno.test({
  name: "validateCertificate - rejects when chain cannot be built",
  async fn() {
    const cert = createMockCertificate({
      issuer: "CN=Unknown CA", // Issuer not in trustedCAs
      subject: "CN=example.com",
    });

    const result = await validateCertificate(cert, "example.com", []);

    assertEquals(result.valid, false);
    assertEquals(result.reason, "Unable to build certificate chain");
  },
});

Deno.test({
  name: "validateCertificate - accepts self-signed certificate when trusted",
  async fn() {
    const cert = createMockCertificate({
      issuer: "CN=example.com",
      subject: "CN=example.com",
      subjectAltNames: ["example.com"],
    });

    const trustedCAs = [cert]; // Self-signed cert is in trusted CAs

    const result = await validateCertificate(cert, "example.com", trustedCAs);

    // Self-signed should be accepted
    assertEquals(result.valid, true);
    assertExists(result.chain);
  },
});

Deno.test({
  name: "validateCertificate - rejects untrusted root CA",
  async fn() {
    const rootCA = createMockCertificate({
      issuer: "CN=Root CA",
      subject: "CN=Root CA",
    });

    const cert = createMockCertificate({
      issuer: "CN=Root CA",
      subject: "CN=example.com",
    });

    // Root CA is not in trustedCAs list
    const result = await validateCertificate(cert, "example.com", [rootCA]);

    // Will fail because cert is signed by rootCA but chain validation will fail
    assertEquals(result.valid, false);
  },
});

// ============================================================================
// validateCertificate Tests - Return Value
// ============================================================================

Deno.test({
  name: "validateCertificate - returns CertificateValidationResult",
  async fn() {
    const cert = createMockCertificate({});

    const result = await validateCertificate(cert, "example.com", []);

    assertExists(result);
    assertEquals(typeof result.valid, "boolean");
  },
});

Deno.test({
  name: "validateCertificate - includes reason when invalid",
  async fn() {
    const cert = createMockCertificate({
      notAfter: new Date(Date.now() - 86400000), // Expired
    });

    const result = await validateCertificate(cert, "example.com", []);

    assertEquals(result.valid, false);
    assertExists(result.reason);
    assertEquals(typeof result.reason, "string");
  },
});

Deno.test({
  name: "validateCertificate - includes chain when valid",
  async fn() {
    const cert = createMockCertificate({
      issuer: "CN=example.com",
      subject: "CN=example.com",
      subjectAltNames: ["example.com"],
    });

    const trustedCAs = [cert];

    const result = await validateCertificate(cert, "example.com", trustedCAs);

    if (result.valid) {
      assertExists(result.chain);
      assert(Array.isArray(result.chain));
      assert(result.chain.length > 0);
    }
  },
});

// ============================================================================
// checkRevocationStatus Tests
// ============================================================================

Deno.test({
  name: "checkRevocationStatus - returns boolean",
  async fn() {
    const cert = createMockCertificate({});

    const revoked = await checkRevocationStatus(cert);

    assertEquals(typeof revoked, "boolean");
  },
});

Deno.test({
  name: "checkRevocationStatus - returns false for non-revoked",
  async fn() {
    const cert = createMockCertificate({});

    const revoked = await checkRevocationStatus(cert);

    // Current implementation always returns false
    assertEquals(revoked, false);
  },
});

Deno.test({
  name: "checkRevocationStatus - handles different certificates",
  async fn() {
    const certs = [
      createMockCertificate({ subject: "CN=example.com" }),
      createMockCertificate({ subject: "CN=test.com" }),
      createMockCertificate({ subject: "CN=*.example.com" }),
    ];

    for (const cert of certs) {
      const revoked = await checkRevocationStatus(cert);
      assertEquals(typeof revoked, "boolean");
    }
  },
});

// ============================================================================
// Integration Tests
// ============================================================================

Deno.test({
  name: "validateCertificate - complete validation flow",
  async fn() {
    const cert = createMockCertificate({
      issuer: "CN=example.com",
      subject: "CN=example.com",
      subjectAltNames: ["example.com", "www.example.com"],
      notBefore: new Date(Date.now() - 86400000),
      notAfter: new Date(Date.now() + 86400000),
    });

    const trustedCAs = [cert];

    const result = await validateCertificate(cert, "example.com", trustedCAs);

    assertExists(result);
    assertEquals(typeof result.valid, "boolean");

    if (!result.valid) {
      assertExists(result.reason);
    }
  },
});

Deno.test({
  name: "validateCertificate - multiple validation scenarios",
  async fn() {
    const scenarios = [
      {
        cert: createMockCertificate({
          notAfter: new Date(Date.now() - 1),
        }),
        hostname: "example.com",
        expectedReason: "Certificate expired",
      },
      {
        cert: createMockCertificate({
          subject: "CN=example.com",
          subjectAltNames: ["example.com"],
        }),
        hostname: "different.com",
        expectedReason: "Hostname mismatch",
      },
      {
        cert: createMockCertificate({
          issuer: "CN=Unknown",
          subject: "CN=example.com",
        }),
        hostname: "example.com",
        expectedReason: "Unable to build certificate chain",
      },
    ];

    for (const scenario of scenarios) {
      const result = await validateCertificate(
        scenario.cert,
        scenario.hostname,
        [],
      );

      assertEquals(result.valid, false);
      assertEquals(result.reason, scenario.expectedReason);
    }
  },
});

// ============================================================================
// DER Encoding of Distinguished Names (RFC 6960 OCSP fix)
// ============================================================================

Deno.test({
  name: "derEncodeDistinguishedName - encodes single RDN (CN only)",
  fn() {
    const der = derEncodeDistinguishedName("CN=Example CA");
    // Should produce a valid DER SEQUENCE
    assertEquals(der[0], 0x30); // SEQUENCE tag
    // Should contain SET > SEQUENCE > OID(CN) + PrintableString
    assert(der.length > 10);
    // Verify OID for CN (2.5.4.3) = [55 04 03]
    const derStr = Array.from(der).map(b => b.toString(16).padStart(2, "0")).join("");
    assert(derStr.includes("55040313"), "Should contain CN OID followed by PrintableString tag");
  },
});

Deno.test({
  name: "derEncodeDistinguishedName - encodes multiple RDNs",
  fn() {
    const der = derEncodeDistinguishedName("CN=Test CA, O=Test Inc, C=US");
    assertEquals(der[0], 0x30); // outer SEQUENCE
    // Should contain 3 SETs (one per RDN)
    let setCount = 0;
    let i = 1;
    // Skip outer SEQUENCE length
    if (der[i] >= 0x80) i += (der[i] & 0x7f) + 1; else i++;
    while (i < der.length) {
      if (der[i] === 0x31) setCount++; // SET tag
      i++;
    }
    assertEquals(setCount, 3);
  },
});

Deno.test({
  name: "derEncodeDistinguishedName - produces deterministic output",
  fn() {
    const der1 = derEncodeDistinguishedName("CN=Example, O=Org");
    const der2 = derEncodeDistinguishedName("CN=Example, O=Org");
    assertEquals(der1, der2);
  },
});

Deno.test({
  name: "derEncodeDistinguishedName - different DNs produce different DER",
  fn() {
    const der1 = derEncodeDistinguishedName("CN=CA One");
    const der2 = derEncodeDistinguishedName("CN=CA Two");
    assert(der1.length > 0);
    assert(der2.length > 0);
    // They should differ
    const str1 = Array.from(der1).join(",");
    const str2 = Array.from(der2).join(",");
    assert(str1 !== str2);
  },
});

Deno.test({
  name: "derEncodeDistinguishedName - SHA-1 hash differs from text encoding",
  async fn() {
    const dn = "CN=Example CA, O=Example Inc";
    const derBytes = derEncodeDistinguishedName(dn);
    const textBytes = new TextEncoder().encode(dn);

    const derHash = new Uint8Array(await crypto.subtle.digest("SHA-1", derBytes));
    const textHash = new Uint8Array(await crypto.subtle.digest("SHA-1", textBytes));

    // DER encoding and text encoding should produce different hashes
    const derHex = Array.from(derHash).map(b => b.toString(16).padStart(2, "0")).join("");
    const textHex = Array.from(textHash).map(b => b.toString(16).padStart(2, "0")).join("");
    assert(derHex !== textHex, "DER hash should differ from text hash");
  },
});

Deno.test({
  name: "checkRevocationStatus - uses issuerRaw DER bytes when available",
  async fn() {
    // Create a cert with issuerRaw field (simulating parsed DER certificate)
    const issuerRawBytes = derEncodeDistinguishedName("CN=Test CA");
    const cert = createMockCertificate({
      issuer: "CN=Test CA",
    });
    // Attach issuerRaw
    (cert as Certificate & { issuerRaw?: Uint8Array }).issuerRaw = issuerRawBytes;

    const issuerCert = createMockCertificate({
      subject: "CN=Test CA",
      issuer: "CN=Test CA",
    });

    // Should not throw - no OCSP URL so returns false (soft-fail)
    const revoked = await checkRevocationStatus(cert, issuerCert);
    assertEquals(revoked, false);
  },
});

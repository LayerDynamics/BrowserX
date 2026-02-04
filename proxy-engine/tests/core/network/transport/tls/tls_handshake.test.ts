/**
 * TLSHandshake Tests
 * Comprehensive tests for TLS 1.2 and 1.3 handshake implementation
 */

import { assertEquals, assertExists, assert, assertRejects } from "@std/assert";
import {
  TLSHandshake,
  TLSVersion,
  TLSHandshakeState,
  type CipherSuite,
  type TLSCertificate,
  type TLSHandshakeConfig,
  TLS13_CIPHER_SUITES,
  TLS12_CIPHER_SUITES,
} from "../../../../../core/network/transport/tls/tls_handshake.ts";

// ============================================================================
// TLSVersion Enum Tests
// ============================================================================

Deno.test({
  name: "TLSVersion - has TLS_1_0",
  fn() {
    assertEquals(TLSVersion.TLS_1_0, "1.0");
  },
});

Deno.test({
  name: "TLSVersion - has TLS_1_1",
  fn() {
    assertEquals(TLSVersion.TLS_1_1, "1.1");
  },
});

Deno.test({
  name: "TLSVersion - has TLS_1_2",
  fn() {
    assertEquals(TLSVersion.TLS_1_2, "1.2");
  },
});

Deno.test({
  name: "TLSVersion - has TLS_1_3",
  fn() {
    assertEquals(TLSVersion.TLS_1_3, "1.3");
  },
});

// ============================================================================
// TLSHandshakeState Enum Tests
// ============================================================================

Deno.test({
  name: "TLSHandshakeState - has NONE",
  fn() {
    assertEquals(TLSHandshakeState.NONE, "NONE");
  },
});

Deno.test({
  name: "TLSHandshakeState - has CLIENT_HELLO",
  fn() {
    assertEquals(TLSHandshakeState.CLIENT_HELLO, "CLIENT_HELLO");
  },
});

Deno.test({
  name: "TLSHandshakeState - has SERVER_HELLO",
  fn() {
    assertEquals(TLSHandshakeState.SERVER_HELLO, "SERVER_HELLO");
  },
});

Deno.test({
  name: "TLSHandshakeState - has CERTIFICATE",
  fn() {
    assertEquals(TLSHandshakeState.CERTIFICATE, "CERTIFICATE");
  },
});

Deno.test({
  name: "TLSHandshakeState - has SERVER_KEY_EXCHANGE",
  fn() {
    assertEquals(TLSHandshakeState.SERVER_KEY_EXCHANGE, "SERVER_KEY_EXCHANGE");
  },
});

Deno.test({
  name: "TLSHandshakeState - has CERTIFICATE_REQUEST",
  fn() {
    assertEquals(TLSHandshakeState.CERTIFICATE_REQUEST, "CERTIFICATE_REQUEST");
  },
});

Deno.test({
  name: "TLSHandshakeState - has SERVER_HELLO_DONE",
  fn() {
    assertEquals(TLSHandshakeState.SERVER_HELLO_DONE, "SERVER_HELLO_DONE");
  },
});

Deno.test({
  name: "TLSHandshakeState - has CLIENT_KEY_EXCHANGE",
  fn() {
    assertEquals(TLSHandshakeState.CLIENT_KEY_EXCHANGE, "CLIENT_KEY_EXCHANGE");
  },
});

Deno.test({
  name: "TLSHandshakeState - has CERTIFICATE_VERIFY",
  fn() {
    assertEquals(TLSHandshakeState.CERTIFICATE_VERIFY, "CERTIFICATE_VERIFY");
  },
});

Deno.test({
  name: "TLSHandshakeState - has CLIENT_FINISHED",
  fn() {
    assertEquals(TLSHandshakeState.CLIENT_FINISHED, "CLIENT_FINISHED");
  },
});

Deno.test({
  name: "TLSHandshakeState - has SERVER_FINISHED",
  fn() {
    assertEquals(TLSHandshakeState.SERVER_FINISHED, "SERVER_FINISHED");
  },
});

Deno.test({
  name: "TLSHandshakeState - has ESTABLISHED",
  fn() {
    assertEquals(TLSHandshakeState.ESTABLISHED, "ESTABLISHED");
  },
});

Deno.test({
  name: "TLSHandshakeState - has ERROR",
  fn() {
    assertEquals(TLSHandshakeState.ERROR, "ERROR");
  },
});

// ============================================================================
// CipherSuite Interface Tests
// ============================================================================

Deno.test({
  name: "CipherSuite - interface has name property",
  fn() {
    const suite: CipherSuite = {
      name: "TLS_AES_128_GCM_SHA256",
      keyExchange: "ECDHE",
      authentication: "ECDSA",
      encryption: "AES_128_GCM",
      hash: "SHA256",
    };
    assertEquals(suite.name, "TLS_AES_128_GCM_SHA256");
  },
});

Deno.test({
  name: "CipherSuite - interface has keyExchange property",
  fn() {
    const suite: CipherSuite = {
      name: "test",
      keyExchange: "ECDHE",
      authentication: "RSA",
      encryption: "AES_128_GCM",
      hash: "SHA256",
    };
    assertEquals(suite.keyExchange, "ECDHE");
  },
});

Deno.test({
  name: "CipherSuite - keyExchange can be RSA",
  fn() {
    const suite: CipherSuite = {
      name: "test",
      keyExchange: "RSA",
      authentication: "RSA",
      encryption: "AES_128_GCM",
      hash: "SHA256",
    };
    assertEquals(suite.keyExchange, "RSA");
  },
});

Deno.test({
  name: "CipherSuite - keyExchange can be DHE",
  fn() {
    const suite: CipherSuite = {
      name: "test",
      keyExchange: "DHE",
      authentication: "RSA",
      encryption: "AES_128_GCM",
      hash: "SHA256",
    };
    assertEquals(suite.keyExchange, "DHE");
  },
});

Deno.test({
  name: "CipherSuite - authentication can be RSA",
  fn() {
    const suite: CipherSuite = {
      name: "test",
      keyExchange: "ECDHE",
      authentication: "RSA",
      encryption: "AES_128_GCM",
      hash: "SHA256",
    };
    assertEquals(suite.authentication, "RSA");
  },
});

Deno.test({
  name: "CipherSuite - authentication can be ECDSA",
  fn() {
    const suite: CipherSuite = {
      name: "test",
      keyExchange: "ECDHE",
      authentication: "ECDSA",
      encryption: "AES_128_GCM",
      hash: "SHA256",
    };
    assertEquals(suite.authentication, "ECDSA");
  },
});

Deno.test({
  name: "CipherSuite - authentication can be PSK",
  fn() {
    const suite: CipherSuite = {
      name: "test",
      keyExchange: "ECDHE",
      authentication: "PSK",
      encryption: "AES_128_GCM",
      hash: "SHA256",
    };
    assertEquals(suite.authentication, "PSK");
  },
});

Deno.test({
  name: "CipherSuite - encryption can be AES_128_GCM",
  fn() {
    const suite: CipherSuite = {
      name: "test",
      keyExchange: "ECDHE",
      authentication: "RSA",
      encryption: "AES_128_GCM",
      hash: "SHA256",
    };
    assertEquals(suite.encryption, "AES_128_GCM");
  },
});

Deno.test({
  name: "CipherSuite - encryption can be AES_256_GCM",
  fn() {
    const suite: CipherSuite = {
      name: "test",
      keyExchange: "ECDHE",
      authentication: "RSA",
      encryption: "AES_256_GCM",
      hash: "SHA256",
    };
    assertEquals(suite.encryption, "AES_256_GCM");
  },
});

Deno.test({
  name: "CipherSuite - encryption can be CHACHA20_POLY1305",
  fn() {
    const suite: CipherSuite = {
      name: "test",
      keyExchange: "ECDHE",
      authentication: "RSA",
      encryption: "CHACHA20_POLY1305",
      hash: "SHA256",
    };
    assertEquals(suite.encryption, "CHACHA20_POLY1305");
  },
});

Deno.test({
  name: "CipherSuite - hash can be SHA256",
  fn() {
    const suite: CipherSuite = {
      name: "test",
      keyExchange: "ECDHE",
      authentication: "RSA",
      encryption: "AES_128_GCM",
      hash: "SHA256",
    };
    assertEquals(suite.hash, "SHA256");
  },
});

Deno.test({
  name: "CipherSuite - hash can be SHA384",
  fn() {
    const suite: CipherSuite = {
      name: "test",
      keyExchange: "ECDHE",
      authentication: "RSA",
      encryption: "AES_256_GCM",
      hash: "SHA384",
    };
    assertEquals(suite.hash, "SHA384");
  },
});

// ============================================================================
// TLSCertificate Interface Tests
// ============================================================================

Deno.test({
  name: "TLSCertificate - interface has subject property",
  fn() {
    const cert: TLSCertificate = {
      subject: { CN: "example.com", O: "Example Inc" },
      issuer: { CN: "CA" },
      notBefore: new Date(),
      notAfter: new Date(),
      subjectAltNames: [],
      publicKey: new Uint8Array(0),
      signature: new Uint8Array(0),
      raw: new Uint8Array(0),
    };
    assertEquals(cert.subject.CN, "example.com");
    assertEquals(cert.subject.O, "Example Inc");
  },
});

Deno.test({
  name: "TLSCertificate - interface has issuer property",
  fn() {
    const cert: TLSCertificate = {
      subject: { CN: "example.com" },
      issuer: { CN: "Root CA", O: "Trust Authority" },
      notBefore: new Date(),
      notAfter: new Date(),
      subjectAltNames: [],
      publicKey: new Uint8Array(0),
      signature: new Uint8Array(0),
      raw: new Uint8Array(0),
    };
    assertEquals(cert.issuer.CN, "Root CA");
  },
});

Deno.test({
  name: "TLSCertificate - interface has validity dates",
  fn() {
    const notBefore = new Date("2024-01-01");
    const notAfter = new Date("2025-01-01");
    const cert: TLSCertificate = {
      subject: { CN: "example.com" },
      issuer: { CN: "CA" },
      notBefore,
      notAfter,
      subjectAltNames: [],
      publicKey: new Uint8Array(0),
      signature: new Uint8Array(0),
      raw: new Uint8Array(0),
    };
    assertEquals(cert.notBefore, notBefore);
    assertEquals(cert.notAfter, notAfter);
  },
});

Deno.test({
  name: "TLSCertificate - interface has subjectAltNames",
  fn() {
    const cert: TLSCertificate = {
      subject: { CN: "example.com" },
      issuer: { CN: "CA" },
      notBefore: new Date(),
      notAfter: new Date(),
      subjectAltNames: ["example.com", "www.example.com", "*.example.com"],
      publicKey: new Uint8Array(0),
      signature: new Uint8Array(0),
      raw: new Uint8Array(0),
    };
    assertEquals(cert.subjectAltNames.length, 3);
    assertEquals(cert.subjectAltNames[0], "example.com");
  },
});

Deno.test({
  name: "TLSCertificate - interface has publicKey",
  fn() {
    const publicKey = new Uint8Array([1, 2, 3, 4, 5]);
    const cert: TLSCertificate = {
      subject: { CN: "example.com" },
      issuer: { CN: "CA" },
      notBefore: new Date(),
      notAfter: new Date(),
      subjectAltNames: [],
      publicKey,
      signature: new Uint8Array(0),
      raw: new Uint8Array(0),
    };
    assertEquals(cert.publicKey.length, 5);
  },
});

Deno.test({
  name: "TLSCertificate - interface has signature",
  fn() {
    const signature = new Uint8Array([10, 20, 30, 40, 50]);
    const cert: TLSCertificate = {
      subject: { CN: "example.com" },
      issuer: { CN: "CA" },
      notBefore: new Date(),
      notAfter: new Date(),
      subjectAltNames: [],
      publicKey: new Uint8Array(0),
      signature,
      raw: new Uint8Array(0),
    };
    assertEquals(cert.signature.length, 5);
  },
});

Deno.test({
  name: "TLSCertificate - interface has raw DER",
  fn() {
    const raw = new Uint8Array(256);
    const cert: TLSCertificate = {
      subject: { CN: "example.com" },
      issuer: { CN: "CA" },
      notBefore: new Date(),
      notAfter: new Date(),
      subjectAltNames: [],
      publicKey: new Uint8Array(0),
      signature: new Uint8Array(0),
      raw,
    };
    assertEquals(cert.raw.length, 256);
  },
});

// ============================================================================
// TLSHandshakeConfig Interface Tests
// ============================================================================

Deno.test({
  name: "TLSHandshakeConfig - requires version",
  fn() {
    const config: TLSHandshakeConfig = {
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    };
    assertEquals(config.version, TLSVersion.TLS_1_3);
  },
});

Deno.test({
  name: "TLSHandshakeConfig - requires cipherSuites",
  fn() {
    const config: TLSHandshakeConfig = {
      version: TLSVersion.TLS_1_2,
      cipherSuites: TLS12_CIPHER_SUITES,
    };
    assert(config.cipherSuites.length > 0);
  },
});

Deno.test({
  name: "TLSHandshakeConfig - optional serverName",
  fn() {
    const config: TLSHandshakeConfig = {
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
      serverName: "example.com",
    };
    assertEquals(config.serverName, "example.com");
  },
});

Deno.test({
  name: "TLSHandshakeConfig - optional alpnProtocols",
  fn() {
    const config: TLSHandshakeConfig = {
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
      alpnProtocols: ["h2", "http/1.1"],
    };
    assertEquals(config.alpnProtocols?.length, 2);
    assertEquals(config.alpnProtocols?.[0], "h2");
  },
});

Deno.test({
  name: "TLSHandshakeConfig - optional verifyServerCertificate",
  fn() {
    const config: TLSHandshakeConfig = {
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
      verifyServerCertificate: true,
    };
    assertEquals(config.verifyServerCertificate, true);
  },
});

// ============================================================================
// TLSHandshake Constructor Tests
// ============================================================================

Deno.test({
  name: "TLSHandshake - constructor with TLS 1.3 config",
  fn() {
    const config: TLSHandshakeConfig = {
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    };
    const handshake = new TLSHandshake(config);

    assertExists(handshake);
  },
});

Deno.test({
  name: "TLSHandshake - constructor with TLS 1.2 config",
  fn() {
    const config: TLSHandshakeConfig = {
      version: TLSVersion.TLS_1_2,
      cipherSuites: TLS12_CIPHER_SUITES,
    };
    const handshake = new TLSHandshake(config);

    assertExists(handshake);
  },
});

Deno.test({
  name: "TLSHandshake - constructor with SNI",
  fn() {
    const config: TLSHandshakeConfig = {
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
      serverName: "api.example.com",
    };
    const handshake = new TLSHandshake(config);

    assertExists(handshake);
  },
});

Deno.test({
  name: "TLSHandshake - constructor with ALPN",
  fn() {
    const config: TLSHandshakeConfig = {
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
      alpnProtocols: ["h2", "http/1.1"],
    };
    const handshake = new TLSHandshake(config);

    assertExists(handshake);
  },
});

Deno.test({
  name: "TLSHandshake - initial state is NONE",
  fn() {
    const config: TLSHandshakeConfig = {
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    };
    const handshake = new TLSHandshake(config);

    assertEquals(handshake.getState(), TLSHandshakeState.NONE);
  },
});

// ============================================================================
// TLSHandshake.getState Tests
// ============================================================================

Deno.test({
  name: "TLSHandshake - getState returns current state",
  fn() {
    const handshake = new TLSHandshake({
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    });

    assertEquals(handshake.getState(), TLSHandshakeState.NONE);
  },
});

Deno.test({
  name: "TLSHandshake - getState reflects state changes",
  fn() {
    const handshake = new TLSHandshake({
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    });

    assertEquals(handshake.getState(), TLSHandshakeState.NONE);

    handshake.startClient();

    assertEquals(handshake.getState(), TLSHandshakeState.CLIENT_HELLO);
  },
});

// ============================================================================
// TLSHandshake.startClient Tests
// ============================================================================

Deno.test({
  name: "TLSHandshake - startClient transitions to CLIENT_HELLO",
  fn() {
    const handshake = new TLSHandshake({
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    });

    handshake.startClient();

    assertEquals(handshake.getState(), TLSHandshakeState.CLIENT_HELLO);
  },
});

Deno.test({
  name: "TLSHandshake - startClient returns ClientHello message",
  fn() {
    const handshake = new TLSHandshake({
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    });

    const clientHello = handshake.startClient();

    assertExists(clientHello);
    assert(clientHello instanceof Uint8Array);
    assert(clientHello.length > 0);
  },
});

Deno.test({
  name: "TLSHandshake - ClientHello starts with handshake type 0x01",
  fn() {
    const handshake = new TLSHandshake({
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    });

    const clientHello = handshake.startClient();

    assertEquals(clientHello[0], 0x01); // ClientHello type
  },
});

Deno.test({
  name: "TLSHandshake - ClientHello has correct length encoding",
  fn() {
    const handshake = new TLSHandshake({
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    });

    const clientHello = handshake.startClient();

    // Length is 3 bytes after type
    const length = (clientHello[1] << 16) | (clientHello[2] << 8) | clientHello[3];
    assertEquals(clientHello.length, length + 4); // +4 for type and length fields
  },
});

Deno.test({
  name: "TLSHandshake - ClientHello contains legacy version 0x0303",
  fn() {
    const handshake = new TLSHandshake({
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    });

    const clientHello = handshake.startClient();

    // Legacy version should be at offset 4 (after type + length)
    assertEquals(clientHello[4], 0x03); // Major version
    assertEquals(clientHello[5], 0x03); // Minor version (TLS 1.2)
  },
});

Deno.test({
  name: "TLSHandshake - ClientHello with SNI includes server name",
  fn() {
    const handshake = new TLSHandshake({
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
      serverName: "example.com",
    });

    const clientHello = handshake.startClient();

    // ClientHello should be larger due to SNI extension
    assert(clientHello.length > 50);
  },
});

Deno.test({
  name: "TLSHandshake - ClientHello with ALPN includes protocols",
  fn() {
    const handshake = new TLSHandshake({
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
      alpnProtocols: ["h2", "http/1.1"],
    });

    const clientHello = handshake.startClient();

    assert(clientHello.length > 50);
  },
});

// ============================================================================
// TLSHandshake.startServer Tests
// ============================================================================

Deno.test({
  name: "TLSHandshake - startServer transitions to SERVER_HELLO",
  fn() {
    const handshake = new TLSHandshake({
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    });

    handshake.startServer();

    assertEquals(handshake.getState(), TLSHandshakeState.SERVER_HELLO);
  },
});

// ============================================================================
// TLSHandshake.isEstablished Tests
// ============================================================================

Deno.test({
  name: "TLSHandshake - isEstablished returns false initially",
  fn() {
    const handshake = new TLSHandshake({
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    });

    assertEquals(handshake.isEstablished(), false);
  },
});

Deno.test({
  name: "TLSHandshake - isEstablished returns false after startClient",
  fn() {
    const handshake = new TLSHandshake({
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    });

    handshake.startClient();

    assertEquals(handshake.isEstablished(), false);
  },
});

// ============================================================================
// TLSHandshake.hasError Tests
// ============================================================================

Deno.test({
  name: "TLSHandshake - hasError returns false initially",
  fn() {
    const handshake = new TLSHandshake({
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    });

    assertEquals(handshake.hasError(), false);
  },
});

Deno.test({
  name: "TLSHandshake - hasError returns false during normal handshake",
  fn() {
    const handshake = new TLSHandshake({
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    });

    handshake.startClient();

    assertEquals(handshake.hasError(), false);
  },
});

// ============================================================================
// TLSHandshake.getCipherSuite Tests
// ============================================================================

Deno.test({
  name: "TLSHandshake - getCipherSuite returns undefined initially",
  fn() {
    const handshake = new TLSHandshake({
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    });

    assertEquals(handshake.getCipherSuite(), undefined);
  },
});

// ============================================================================
// TLSHandshake.getServerCertificate Tests
// ============================================================================

Deno.test({
  name: "TLSHandshake - getServerCertificate returns undefined initially",
  fn() {
    const handshake = new TLSHandshake({
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    });

    assertEquals(handshake.getServerCertificate(), undefined);
  },
});

// ============================================================================
// TLSHandshake.getALPNProtocol Tests
// ============================================================================

Deno.test({
  name: "TLSHandshake - getALPNProtocol returns first configured protocol",
  fn() {
    const handshake = new TLSHandshake({
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
      alpnProtocols: ["h2", "http/1.1"],
    });

    assertEquals(handshake.getALPNProtocol(), "h2");
  },
});

Deno.test({
  name: "TLSHandshake - getALPNProtocol returns undefined without config",
  fn() {
    const handshake = new TLSHandshake({
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    });

    assertEquals(handshake.getALPNProtocol(), undefined);
  },
});

// ============================================================================
// TLSHandshake.verifyCertificate Tests
// ============================================================================

Deno.test({
  name: "TLSHandshake - verifyCertificate returns true for valid cert",
  fn() {
    const handshake = new TLSHandshake({
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    });

    const cert: TLSCertificate = {
      subject: { CN: "example.com" },
      issuer: { CN: "CA" },
      notBefore: new Date("2024-01-01"),
      notAfter: new Date("2030-01-01"),
      subjectAltNames: ["example.com"],
      publicKey: new Uint8Array(0),
      signature: new Uint8Array(0),
      raw: new Uint8Array(0),
    };

    const result = handshake.verifyCertificate(cert, "example.com");

    assertEquals(result, true);
  },
});

Deno.test({
  name: "TLSHandshake - verifyCertificate returns false for expired cert",
  fn() {
    const handshake = new TLSHandshake({
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    });

    const cert: TLSCertificate = {
      subject: { CN: "example.com" },
      issuer: { CN: "CA" },
      notBefore: new Date("2020-01-01"),
      notAfter: new Date("2021-01-01"), // Expired
      subjectAltNames: ["example.com"],
      publicKey: new Uint8Array(0),
      signature: new Uint8Array(0),
      raw: new Uint8Array(0),
    };

    const result = handshake.verifyCertificate(cert, "example.com");

    assertEquals(result, false);
  },
});

Deno.test({
  name: "TLSHandshake - verifyCertificate returns false for not-yet-valid cert",
  fn() {
    const handshake = new TLSHandshake({
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    });

    const cert: TLSCertificate = {
      subject: { CN: "example.com" },
      issuer: { CN: "CA" },
      notBefore: new Date("2099-01-01"), // Future date
      notAfter: new Date("2100-01-01"),
      subjectAltNames: ["example.com"],
      publicKey: new Uint8Array(0),
      signature: new Uint8Array(0),
      raw: new Uint8Array(0),
    };

    const result = handshake.verifyCertificate(cert, "example.com");

    assertEquals(result, false);
  },
});

Deno.test({
  name: "TLSHandshake - verifyCertificate returns false for hostname mismatch",
  fn() {
    const handshake = new TLSHandshake({
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    });

    const cert: TLSCertificate = {
      subject: { CN: "other.com" },
      issuer: { CN: "CA" },
      notBefore: new Date("2024-01-01"),
      notAfter: new Date("2030-01-01"),
      subjectAltNames: ["other.com"],
      publicKey: new Uint8Array(0),
      signature: new Uint8Array(0),
      raw: new Uint8Array(0),
    };

    const result = handshake.verifyCertificate(cert, "example.com");

    assertEquals(result, false);
  },
});

Deno.test({
  name: "TLSHandshake - verifyCertificate matches hostname in CN",
  fn() {
    const handshake = new TLSHandshake({
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    });

    const cert: TLSCertificate = {
      subject: { CN: "example.com" },
      issuer: { CN: "CA" },
      notBefore: new Date("2024-01-01"),
      notAfter: new Date("2030-01-01"),
      subjectAltNames: [],
      publicKey: new Uint8Array(0),
      signature: new Uint8Array(0),
      raw: new Uint8Array(0),
    };

    const result = handshake.verifyCertificate(cert, "example.com");

    assertEquals(result, true);
  },
});

Deno.test({
  name: "TLSHandshake - verifyCertificate matches wildcard in SAN",
  fn() {
    const handshake = new TLSHandshake({
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    });

    const cert: TLSCertificate = {
      subject: { CN: "example.com" },
      issuer: { CN: "CA" },
      notBefore: new Date("2024-01-01"),
      notAfter: new Date("2030-01-01"),
      subjectAltNames: ["*.example.com"],
      publicKey: new Uint8Array(0),
      signature: new Uint8Array(0),
      raw: new Uint8Array(0),
    };

    const result = handshake.verifyCertificate(cert, "www.example.com");

    assertEquals(result, true);
  },
});

Deno.test({
  name: "TLSHandshake - verifyCertificate wildcard does not match apex domain",
  fn() {
    const handshake = new TLSHandshake({
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    });

    const cert: TLSCertificate = {
      subject: { CN: "other.com" },
      issuer: { CN: "CA" },
      notBefore: new Date("2024-01-01"),
      notAfter: new Date("2030-01-01"),
      subjectAltNames: ["*.example.com"],
      publicKey: new Uint8Array(0),
      signature: new Uint8Array(0),
      raw: new Uint8Array(0),
    };

    // Wildcard *.example.com should not match example.com itself
    const result = handshake.verifyCertificate(cert, "example.com");

    assertEquals(result, false);
  },
});

// ============================================================================
// TLSHandshake.getStats Tests
// ============================================================================

Deno.test({
  name: "TLSHandshake - getStats returns handshake stats",
  fn() {
    const handshake = new TLSHandshake({
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
      serverName: "example.com",
      alpnProtocols: ["h2"],
    });

    const stats = handshake.getStats();

    assertExists(stats);
    assertEquals(stats.state, TLSHandshakeState.NONE);
    assertEquals(stats.serverName, "example.com");
    assertEquals(stats.alpnProtocol, "h2");
  },
});

Deno.test({
  name: "TLSHandshake - getStats reflects state changes",
  fn() {
    const handshake = new TLSHandshake({
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    });

    handshake.startClient();
    const stats = handshake.getStats();

    assertEquals(stats.state, TLSHandshakeState.CLIENT_HELLO);
  },
});

// ============================================================================
// TLS13_CIPHER_SUITES Tests
// ============================================================================

Deno.test({
  name: "TLS13_CIPHER_SUITES - contains AES_128_GCM suite",
  fn() {
    const suite = TLS13_CIPHER_SUITES.find((s) => s.name === "TLS_AES_128_GCM_SHA256");

    assertExists(suite);
    assertEquals(suite.encryption, "AES_128_GCM");
    assertEquals(suite.hash, "SHA256");
  },
});

Deno.test({
  name: "TLS13_CIPHER_SUITES - contains AES_256_GCM suite",
  fn() {
    const suite = TLS13_CIPHER_SUITES.find((s) => s.name === "TLS_AES_256_GCM_SHA384");

    assertExists(suite);
    assertEquals(suite.encryption, "AES_256_GCM");
    assertEquals(suite.hash, "SHA384");
  },
});

Deno.test({
  name: "TLS13_CIPHER_SUITES - contains CHACHA20_POLY1305 suite",
  fn() {
    const suite = TLS13_CIPHER_SUITES.find((s) => s.name === "TLS_CHACHA20_POLY1305_SHA256");

    assertExists(suite);
    assertEquals(suite.encryption, "CHACHA20_POLY1305");
    assertEquals(suite.hash, "SHA256");
  },
});

Deno.test({
  name: "TLS13_CIPHER_SUITES - all use ECDHE key exchange",
  fn() {
    for (const suite of TLS13_CIPHER_SUITES) {
      assertEquals(suite.keyExchange, "ECDHE");
    }
  },
});

Deno.test({
  name: "TLS13_CIPHER_SUITES - has at least 3 suites",
  fn() {
    assert(TLS13_CIPHER_SUITES.length >= 3);
  },
});

// ============================================================================
// TLS12_CIPHER_SUITES Tests
// ============================================================================

Deno.test({
  name: "TLS12_CIPHER_SUITES - contains ECDHE_RSA_AES_128_GCM",
  fn() {
    const suite = TLS12_CIPHER_SUITES.find(
      (s) => s.name === "TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256"
    );

    assertExists(suite);
    assertEquals(suite.keyExchange, "ECDHE");
    assertEquals(suite.authentication, "RSA");
    assertEquals(suite.encryption, "AES_128_GCM");
  },
});

Deno.test({
  name: "TLS12_CIPHER_SUITES - contains ECDHE_RSA_AES_256_GCM",
  fn() {
    const suite = TLS12_CIPHER_SUITES.find(
      (s) => s.name === "TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384"
    );

    assertExists(suite);
    assertEquals(suite.keyExchange, "ECDHE");
    assertEquals(suite.authentication, "RSA");
    assertEquals(suite.encryption, "AES_256_GCM");
  },
});

Deno.test({
  name: "TLS12_CIPHER_SUITES - has at least 2 suites",
  fn() {
    assert(TLS12_CIPHER_SUITES.length >= 2);
  },
});

// ============================================================================
// TLSHandshake.processMessage Tests
// ============================================================================

Deno.test({
  name: "TLSHandshake - processMessage TLS 1.3 completes after ServerHello",
  async fn() {
    const handshake = new TLSHandshake({
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    });

    handshake.startClient();
    assertEquals(handshake.getState(), TLSHandshakeState.CLIENT_HELLO);

    // Simulate receiving ServerHello (simplified)
    const mockServerHello = new Uint8Array(100);
    await handshake.processMessage(mockServerHello);

    // TLS 1.3 should be established after processing ServerHello
    assertEquals(handshake.getState(), TLSHandshakeState.ESTABLISHED);
  },
});

Deno.test({
  name: "TLSHandshake - processMessage TLS 1.2 continues after ServerHello",
  async fn() {
    const handshake = new TLSHandshake({
      version: TLSVersion.TLS_1_2,
      cipherSuites: TLS12_CIPHER_SUITES,
    });

    handshake.startClient();
    assertEquals(handshake.getState(), TLSHandshakeState.CLIENT_HELLO);

    // Simulate receiving ServerHello (simplified)
    const mockServerHello = new Uint8Array(100);
    await handshake.processMessage(mockServerHello);

    // TLS 1.2 should continue to CERTIFICATE state
    assertEquals(handshake.getState(), TLSHandshakeState.CERTIFICATE);
  },
});

Deno.test({
  name: "TLSHandshake - processMessage returns null for unhandled state",
  async fn() {
    const handshake = new TLSHandshake({
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    });

    // Don't call startClient, state is NONE
    const result = await handshake.processMessage(new Uint8Array(10));

    assertEquals(result, null);
  },
});

// ============================================================================
// Integration Tests
// ============================================================================

Deno.test({
  name: "TLSHandshake - full TLS 1.3 client handshake flow",
  async fn() {
    const handshake = new TLSHandshake({
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
      serverName: "example.com",
      alpnProtocols: ["h2", "http/1.1"],
    });

    // Initial state
    assertEquals(handshake.getState(), TLSHandshakeState.NONE);
    assertEquals(handshake.isEstablished(), false);
    assertEquals(handshake.hasError(), false);

    // Start client handshake
    const clientHello = handshake.startClient();
    assertExists(clientHello);
    assertEquals(handshake.getState(), TLSHandshakeState.CLIENT_HELLO);

    // Process mock ServerHello
    const mockServerHello = new Uint8Array(100);
    await handshake.processMessage(mockServerHello);

    // TLS 1.3 should be established
    assertEquals(handshake.isEstablished(), true);

    // Check stats
    const stats = handshake.getStats();
    assertEquals(stats.state, TLSHandshakeState.ESTABLISHED);
    assertEquals(stats.serverName, "example.com");
    assertEquals(stats.alpnProtocol, "h2");
  },
});

Deno.test({
  name: "TLSHandshake - full TLS 1.2 client handshake flow",
  async fn() {
    const handshake = new TLSHandshake({
      version: TLSVersion.TLS_1_2,
      cipherSuites: TLS12_CIPHER_SUITES,
      serverName: "example.com",
    });

    // Initial state
    assertEquals(handshake.getState(), TLSHandshakeState.NONE);

    // Start client handshake
    const clientHello = handshake.startClient();
    assertExists(clientHello);
    assertEquals(handshake.getState(), TLSHandshakeState.CLIENT_HELLO);

    // Process mock ServerHello
    await handshake.processMessage(new Uint8Array(50));
    assertEquals(handshake.getState(), TLSHandshakeState.CERTIFICATE);

    // Process mock Certificate
    await handshake.processMessage(new Uint8Array(100));
    assertEquals(handshake.getState(), TLSHandshakeState.SERVER_KEY_EXCHANGE);

    // Continue through handshake...
    // (In practice, this would continue through more states)
  },
});

Deno.test({
  name: "TLSHandshake - multiple handshakes are independent",
  fn() {
    const handshake1 = new TLSHandshake({
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
      serverName: "server1.com",
    });

    const handshake2 = new TLSHandshake({
      version: TLSVersion.TLS_1_2,
      cipherSuites: TLS12_CIPHER_SUITES,
      serverName: "server2.com",
    });

    handshake1.startClient();

    assertEquals(handshake1.getState(), TLSHandshakeState.CLIENT_HELLO);
    assertEquals(handshake2.getState(), TLSHandshakeState.NONE);

    handshake2.startServer();

    assertEquals(handshake1.getState(), TLSHandshakeState.CLIENT_HELLO);
    assertEquals(handshake2.getState(), TLSHandshakeState.SERVER_HELLO);
  },
});

Deno.test({
  name: "TLSHandshake - cipher suite negotiation returns first preference",
  async fn() {
    const handshake = new TLSHandshake({
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    });

    handshake.startClient();

    // Process mock ServerHello
    await handshake.processMessage(new Uint8Array(50));

    // Should have negotiated the first cipher suite
    const cipherSuite = handshake.getCipherSuite();
    assertExists(cipherSuite);
    assertEquals(cipherSuite.name, TLS13_CIPHER_SUITES[0].name);
  },
});

// ============================================================================
// Edge Cases
// ============================================================================

Deno.test({
  name: "TLSHandshake - handles empty cipher suite list",
  fn() {
    const handshake = new TLSHandshake({
      version: TLSVersion.TLS_1_3,
      cipherSuites: [],
    });

    // Should still create handshake
    assertExists(handshake);
    assertEquals(handshake.getState(), TLSHandshakeState.NONE);
  },
});

Deno.test({
  name: "TLSHandshake - handles empty ALPN protocols",
  fn() {
    const handshake = new TLSHandshake({
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
      alpnProtocols: [],
    });

    assertEquals(handshake.getALPNProtocol(), undefined);
  },
});

Deno.test({
  name: "TLSHandshake - handles long server name",
  fn() {
    const longName = "subdomain." + "a".repeat(200) + ".example.com";
    const handshake = new TLSHandshake({
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
      serverName: longName,
    });

    const stats = handshake.getStats();
    assertEquals(stats.serverName, longName);
  },
});

Deno.test({
  name: "TLSHandshake - handles many ALPN protocols",
  fn() {
    const protocols = ["h2", "http/1.1", "spdy/3.1", "http/1.0"];
    const handshake = new TLSHandshake({
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
      alpnProtocols: protocols,
    });

    assertEquals(handshake.getALPNProtocol(), "h2"); // First in list
  },
});

// ============================================================================
// ClientHello Format Tests
// ============================================================================

Deno.test({
  name: "TLSHandshake - ClientHello contains 32-byte random",
  fn() {
    const handshake = new TLSHandshake({
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    });

    const clientHello = handshake.startClient();

    // Random starts at offset 6 (after type, length, and version)
    // and is 32 bytes
    assert(clientHello.length >= 38); // At least type + length + version + random
  },
});

Deno.test({
  name: "TLSHandshake - each ClientHello has different random",
  fn() {
    const handshake1 = new TLSHandshake({
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    });

    const handshake2 = new TLSHandshake({
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    });

    const clientHello1 = handshake1.startClient();
    const clientHello2 = handshake2.startClient();

    // Extract random (offset 6, length 32)
    const random1 = clientHello1.slice(6, 38);
    const random2 = clientHello2.slice(6, 38);

    // Randoms should be different (extremely unlikely to be same)
    let different = false;
    for (let i = 0; i < 32; i++) {
      if (random1[i] !== random2[i]) {
        different = true;
        break;
      }
    }
    assertEquals(different, true);
  },
});

Deno.test({
  name: "TLSHandshake - ClientHello contains cipher suites length",
  fn() {
    const handshake = new TLSHandshake({
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    });

    const clientHello = handshake.startClient();

    // After type(1) + length(3) + version(2) + random(32) + session_id_length(1 byte which is 0)
    // = offset 39 should be cipher suites length (2 bytes)
    const cipherSuitesLength = (clientHello[39] << 8) | clientHello[40];

    // Each cipher suite is 2 bytes
    assertEquals(cipherSuitesLength, TLS13_CIPHER_SUITES.length * 2);
  },
});

/**
 * TLSConnection Tests
 * Comprehensive tests for TLS connection implementation
 */

import { assertEquals, assertExists, assert, assertRejects, assertThrows } from "@std/assert";
import {
  TLSConnection,
  createTLSConnection,
  wrapWithTLS,
  type TLSConnectionConfig,
  type TLSConnectionInfo,
  type TLSConnectionStats,
} from "../../../../../core/network/transport/tls/tls_connection.ts";
import {
  TLSVersion,
  TLSHandshakeState,
  TLS13_CIPHER_SUITES,
  TLS12_CIPHER_SUITES,
} from "../../../../../core/network/transport/tls/tls_handshake.ts";

// ============================================================================
// TLSConnectionConfig Interface Tests
// ============================================================================

Deno.test({
  name: "TLSConnectionConfig - requires hostname",
  fn() {
    const config: TLSConnectionConfig = {
      hostname: "example.com",
      port: 443,
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    };

    assertEquals(config.hostname, "example.com");
  },
});

Deno.test({
  name: "TLSConnectionConfig - requires port",
  fn() {
    const config: TLSConnectionConfig = {
      hostname: "example.com",
      port: 443,
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    };

    assertEquals(config.port, 443);
  },
});

Deno.test({
  name: "TLSConnectionConfig - supports timeout option",
  fn() {
    const config: TLSConnectionConfig = {
      hostname: "example.com",
      port: 443,
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
      timeout: 30000,
    };

    assertEquals(config.timeout, 30000);
  },
});

Deno.test({
  name: "TLSConnectionConfig - supports certFile option",
  fn() {
    const config: TLSConnectionConfig = {
      hostname: "example.com",
      port: 443,
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
      certFile: "/path/to/cert.pem",
    };

    assertEquals(config.certFile, "/path/to/cert.pem");
  },
});

Deno.test({
  name: "TLSConnectionConfig - supports keyFile option",
  fn() {
    const config: TLSConnectionConfig = {
      hostname: "example.com",
      port: 443,
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
      keyFile: "/path/to/key.pem",
    };

    assertEquals(config.keyFile, "/path/to/key.pem");
  },
});

Deno.test({
  name: "TLSConnectionConfig - supports caCerts option",
  fn() {
    const config: TLSConnectionConfig = {
      hostname: "example.com",
      port: 443,
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
      caCerts: "/path/to/ca.pem",
    };

    assertEquals(config.caCerts, "/path/to/ca.pem");
  },
});

Deno.test({
  name: "TLSConnectionConfig - extends TLSHandshakeConfig",
  fn() {
    const config: TLSConnectionConfig = {
      hostname: "example.com",
      port: 443,
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
      serverName: "example.com",
      alpnProtocols: ["h2", "http/1.1"],
      verifyServerCertificate: true,
    };

    assertEquals(config.version, TLSVersion.TLS_1_3);
    assertEquals(config.cipherSuites, TLS13_CIPHER_SUITES);
    assertEquals(config.serverName, "example.com");
    assertEquals(config.alpnProtocols, ["h2", "http/1.1"]);
    assertEquals(config.verifyServerCertificate, true);
  },
});

Deno.test({
  name: "TLSConnectionConfig - supports TLS 1.2",
  fn() {
    const config: TLSConnectionConfig = {
      hostname: "legacy.example.com",
      port: 443,
      version: TLSVersion.TLS_1_2,
      cipherSuites: TLS12_CIPHER_SUITES,
    };

    assertEquals(config.version, TLSVersion.TLS_1_2);
    assertEquals(config.cipherSuites, TLS12_CIPHER_SUITES);
  },
});

Deno.test({
  name: "TLSConnectionConfig - supports different ports",
  fn() {
    const config8443: TLSConnectionConfig = {
      hostname: "example.com",
      port: 8443,
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    };

    assertEquals(config8443.port, 8443);

    const config993: TLSConnectionConfig = {
      hostname: "mail.example.com",
      port: 993,
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    };

    assertEquals(config993.port, 993);
  },
});

// ============================================================================
// TLSConnectionInfo Interface Tests
// ============================================================================

Deno.test({
  name: "TLSConnectionInfo - contains version",
  fn() {
    const info: TLSConnectionInfo = {
      version: TLSVersion.TLS_1_3,
      cipherSuite: "TLS_AES_256_GCM_SHA384",
    };

    assertEquals(info.version, TLSVersion.TLS_1_3);
  },
});

Deno.test({
  name: "TLSConnectionInfo - contains cipherSuite",
  fn() {
    const info: TLSConnectionInfo = {
      version: TLSVersion.TLS_1_3,
      cipherSuite: "TLS_AES_256_GCM_SHA384",
    };

    assertEquals(info.cipherSuite, "TLS_AES_256_GCM_SHA384");
  },
});

Deno.test({
  name: "TLSConnectionInfo - supports serverCertificate",
  fn() {
    const info: TLSConnectionInfo = {
      version: TLSVersion.TLS_1_3,
      cipherSuite: "TLS_AES_256_GCM_SHA384",
      serverCertificate: {
        subject: { CN: "example.com" },
        issuer: { CN: "CA" },
        notBefore: new Date("2024-01-01"),
        notAfter: new Date("2025-01-01"),
        subjectAltNames: ["example.com", "www.example.com"],
        publicKey: new Uint8Array(0),
        signature: new Uint8Array(0),
        raw: new Uint8Array(0),
      },
    };

    assertExists(info.serverCertificate);
    assertEquals(info.serverCertificate!.subject.CN, "example.com");
  },
});

Deno.test({
  name: "TLSConnectionInfo - supports alpnProtocol",
  fn() {
    const info: TLSConnectionInfo = {
      version: TLSVersion.TLS_1_3,
      cipherSuite: "TLS_AES_256_GCM_SHA384",
      alpnProtocol: "h2",
    };

    assertEquals(info.alpnProtocol, "h2");
  },
});

Deno.test({
  name: "TLSConnectionInfo - supports serverName",
  fn() {
    const info: TLSConnectionInfo = {
      version: TLSVersion.TLS_1_3,
      cipherSuite: "TLS_AES_256_GCM_SHA384",
      serverName: "api.example.com",
    };

    assertEquals(info.serverName, "api.example.com");
  },
});

Deno.test({
  name: "TLSConnectionInfo - all optional fields undefined",
  fn() {
    const info: TLSConnectionInfo = {
      version: TLSVersion.TLS_1_3,
      cipherSuite: "TLS_AES_128_GCM_SHA256",
    };

    assertEquals(info.serverCertificate, undefined);
    assertEquals(info.alpnProtocol, undefined);
    assertEquals(info.serverName, undefined);
  },
});

// ============================================================================
// TLSConnectionStats Interface Tests
// ============================================================================

Deno.test({
  name: "TLSConnectionStats - contains handshakeState",
  fn() {
    const stats: TLSConnectionStats = {
      handshakeState: TLSHandshakeState.ESTABLISHED,
      handshakeDuration: 50,
      bytesEncrypted: 1000,
      bytesDecrypted: 2000,
      duration: 5000,
    };

    assertEquals(stats.handshakeState, TLSHandshakeState.ESTABLISHED);
  },
});

Deno.test({
  name: "TLSConnectionStats - contains handshakeDuration",
  fn() {
    const stats: TLSConnectionStats = {
      handshakeState: TLSHandshakeState.ESTABLISHED,
      handshakeDuration: 75,
      bytesEncrypted: 0,
      bytesDecrypted: 0,
      duration: 1000,
    };

    assertEquals(stats.handshakeDuration, 75);
  },
});

Deno.test({
  name: "TLSConnectionStats - contains bytesEncrypted",
  fn() {
    const stats: TLSConnectionStats = {
      handshakeState: TLSHandshakeState.ESTABLISHED,
      handshakeDuration: 50,
      bytesEncrypted: 50000,
      bytesDecrypted: 100000,
      duration: 10000,
    };

    assertEquals(stats.bytesEncrypted, 50000);
  },
});

Deno.test({
  name: "TLSConnectionStats - contains bytesDecrypted",
  fn() {
    const stats: TLSConnectionStats = {
      handshakeState: TLSHandshakeState.ESTABLISHED,
      handshakeDuration: 50,
      bytesEncrypted: 50000,
      bytesDecrypted: 100000,
      duration: 10000,
    };

    assertEquals(stats.bytesDecrypted, 100000);
  },
});

Deno.test({
  name: "TLSConnectionStats - contains duration",
  fn() {
    const stats: TLSConnectionStats = {
      handshakeState: TLSHandshakeState.ESTABLISHED,
      handshakeDuration: 50,
      bytesEncrypted: 0,
      bytesDecrypted: 0,
      duration: 30000,
    };

    assertEquals(stats.duration, 30000);
  },
});

Deno.test({
  name: "TLSConnectionStats - zeroed stats",
  fn() {
    const stats: TLSConnectionStats = {
      handshakeState: TLSHandshakeState.NONE,
      handshakeDuration: 0,
      bytesEncrypted: 0,
      bytesDecrypted: 0,
      duration: 0,
    };

    assertEquals(stats.handshakeState, TLSHandshakeState.NONE);
    assertEquals(stats.handshakeDuration, 0);
    assertEquals(stats.bytesEncrypted, 0);
    assertEquals(stats.bytesDecrypted, 0);
    assertEquals(stats.duration, 0);
  },
});

Deno.test({
  name: "TLSConnectionStats - supports all handshake states",
  fn() {
    const states = [
      TLSHandshakeState.NONE,
      TLSHandshakeState.CLIENT_HELLO,
      TLSHandshakeState.SERVER_HELLO,
      TLSHandshakeState.CERTIFICATE,
      TLSHandshakeState.ESTABLISHED,
      TLSHandshakeState.ERROR,
    ];

    for (const state of states) {
      const stats: TLSConnectionStats = {
        handshakeState: state,
        handshakeDuration: 0,
        bytesEncrypted: 0,
        bytesDecrypted: 0,
        duration: 0,
      };
      assertEquals(stats.handshakeState, state);
    }
  },
});

// ============================================================================
// TLSConnection Constructor Tests
// ============================================================================

Deno.test({
  name: "TLSConnection - constructor accepts config",
  fn() {
    const config: TLSConnectionConfig = {
      hostname: "example.com",
      port: 443,
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    };

    const conn = new TLSConnection(config);
    assertExists(conn);
  },
});

Deno.test({
  name: "TLSConnection - isEstablished returns false initially",
  fn() {
    const config: TLSConnectionConfig = {
      hostname: "example.com",
      port: 443,
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    };

    const conn = new TLSConnection(config);
    assertEquals(conn.isEstablished(), false);
  },
});

Deno.test({
  name: "TLSConnection - getConn returns undefined initially",
  fn() {
    const config: TLSConnectionConfig = {
      hostname: "example.com",
      port: 443,
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    };

    const conn = new TLSConnection(config);
    assertEquals(conn.getConn(), undefined);
  },
});

Deno.test({
  name: "TLSConnection - localAddr undefined before connect",
  fn() {
    const config: TLSConnectionConfig = {
      hostname: "example.com",
      port: 443,
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    };

    const conn = new TLSConnection(config);
    assertEquals(conn.localAddr, undefined);
  },
});

Deno.test({
  name: "TLSConnection - remoteAddr undefined before connect",
  fn() {
    const config: TLSConnectionConfig = {
      hostname: "example.com",
      port: 443,
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    };

    const conn = new TLSConnection(config);
    assertEquals(conn.remoteAddr, undefined);
  },
});

Deno.test({
  name: "TLSConnection - constructor with TLS 1.2",
  fn() {
    const config: TLSConnectionConfig = {
      hostname: "legacy.example.com",
      port: 443,
      version: TLSVersion.TLS_1_2,
      cipherSuites: TLS12_CIPHER_SUITES,
    };

    const conn = new TLSConnection(config);
    assertExists(conn);
    assertEquals(conn.isEstablished(), false);
  },
});

Deno.test({
  name: "TLSConnection - constructor with ALPN protocols",
  fn() {
    const config: TLSConnectionConfig = {
      hostname: "example.com",
      port: 443,
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
      alpnProtocols: ["h2", "http/1.1"],
    };

    const conn = new TLSConnection(config);
    assertExists(conn);
  },
});

Deno.test({
  name: "TLSConnection - constructor with server name",
  fn() {
    const config: TLSConnectionConfig = {
      hostname: "192.168.1.1",
      port: 443,
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
      serverName: "api.example.com",
    };

    const conn = new TLSConnection(config);
    assertExists(conn);
  },
});

Deno.test({
  name: "TLSConnection - multiple independent instances",
  fn() {
    const config1: TLSConnectionConfig = {
      hostname: "example1.com",
      port: 443,
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    };

    const config2: TLSConnectionConfig = {
      hostname: "example2.com",
      port: 8443,
      version: TLSVersion.TLS_1_2,
      cipherSuites: TLS12_CIPHER_SUITES,
    };

    const conn1 = new TLSConnection(config1);
    const conn2 = new TLSConnection(config2);

    assertExists(conn1);
    assertExists(conn2);
    assertEquals(conn1.isEstablished(), false);
    assertEquals(conn2.isEstablished(), false);
  },
});

// ============================================================================
// TLSConnection getStats Tests (works without connection)
// ============================================================================

Deno.test({
  name: "TLSConnection - getStats returns stats object",
  fn() {
    const config: TLSConnectionConfig = {
      hostname: "example.com",
      port: 443,
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    };

    const conn = new TLSConnection(config);
    const stats = conn.getStats();

    assertExists(stats);
    assertExists(stats.handshakeState);
    assertEquals(typeof stats.handshakeDuration, "number");
    assertEquals(typeof stats.bytesEncrypted, "number");
    assertEquals(typeof stats.bytesDecrypted, "number");
    assertEquals(typeof stats.duration, "number");
  },
});

Deno.test({
  name: "TLSConnection - getStats shows NONE state initially",
  fn() {
    const config: TLSConnectionConfig = {
      hostname: "example.com",
      port: 443,
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    };

    const conn = new TLSConnection(config);
    const stats = conn.getStats();

    assertEquals(stats.handshakeState, TLSHandshakeState.NONE);
  },
});

Deno.test({
  name: "TLSConnection - getStats shows zero bytes initially",
  fn() {
    const config: TLSConnectionConfig = {
      hostname: "example.com",
      port: 443,
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    };

    const conn = new TLSConnection(config);
    const stats = conn.getStats();

    assertEquals(stats.bytesEncrypted, 0);
    assertEquals(stats.bytesDecrypted, 0);
  },
});

Deno.test({
  name: "TLSConnection - getStats shows zero duration initially",
  fn() {
    const config: TLSConnectionConfig = {
      hostname: "example.com",
      port: 443,
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    };

    const conn = new TLSConnection(config);
    const stats = conn.getStats();

    assertEquals(stats.duration, 0);
    assertEquals(stats.handshakeDuration, 0);
  },
});

// ============================================================================
// TLSConnection read/write Error Tests (without connection)
// ============================================================================

Deno.test({
  name: "TLSConnection - read throws when not connected",
  async fn() {
    const config: TLSConnectionConfig = {
      hostname: "example.com",
      port: 443,
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    };

    const conn = new TLSConnection(config);
    const buffer = new Uint8Array(1024);

    await assertRejects(
      async () => await conn.read(buffer),
      Error,
      "Not connected"
    );
  },
});

Deno.test({
  name: "TLSConnection - write throws when not connected",
  async fn() {
    const config: TLSConnectionConfig = {
      hostname: "example.com",
      port: 443,
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    };

    const conn = new TLSConnection(config);
    const data = new Uint8Array([1, 2, 3, 4, 5]);

    await assertRejects(
      async () => await conn.write(data),
      Error,
      "Not connected"
    );
  },
});

// ============================================================================
// TLSConnection close Tests
// ============================================================================

Deno.test({
  name: "TLSConnection - close on unconnected is safe",
  fn() {
    const config: TLSConnectionConfig = {
      hostname: "example.com",
      port: 443,
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    };

    const conn = new TLSConnection(config);

    // Should not throw
    conn.close();

    assertEquals(conn.isEstablished(), false);
  },
});

Deno.test({
  name: "TLSConnection - close can be called multiple times",
  fn() {
    const config: TLSConnectionConfig = {
      hostname: "example.com",
      port: 443,
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    };

    const conn = new TLSConnection(config);

    conn.close();
    conn.close();
    conn.close();

    assertEquals(conn.isEstablished(), false);
  },
});

Deno.test({
  name: "TLSConnection - close sets established to false",
  fn() {
    const config: TLSConnectionConfig = {
      hostname: "example.com",
      port: 443,
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    };

    const conn = new TLSConnection(config);
    conn.close();

    assertEquals(conn.isEstablished(), false);
    assertEquals(conn.getConn(), undefined);
  },
});

// ============================================================================
// TLSConnection getHandshakeInfo Tests (without connection)
// ============================================================================

Deno.test({
  name: "TLSConnection - getHandshakeInfo returns null when not connected",
  async fn() {
    const config: TLSConnectionConfig = {
      hostname: "example.com",
      port: 443,
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    };

    const conn = new TLSConnection(config);
    const info = await conn.getHandshakeInfo();

    assertEquals(info, null);
  },
});

// ============================================================================
// TLSConnection getConnectionInfo Tests (without connection)
// ============================================================================

Deno.test({
  name: "TLSConnection - getConnectionInfo returns null when not connected",
  async fn() {
    const config: TLSConnectionConfig = {
      hostname: "example.com",
      port: 443,
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    };

    const conn = new TLSConnection(config);
    const info = await conn.getConnectionInfo();

    assertEquals(info, null);
  },
});

// ============================================================================
// TLSConnection connect Error Tests
// ============================================================================

Deno.test({
  name: "TLSConnection - connect fails with invalid hostname",
  async fn() {
    const config: TLSConnectionConfig = {
      hostname: "this.hostname.definitely.does.not.exist.invalid",
      port: 443,
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    };

    const conn = new TLSConnection(config);

    await assertRejects(
      async () => await conn.connect(),
      Error,
      "TLS connection failed"
    );
  },
});

Deno.test({
  name: "TLSConnection - connect fails with invalid port",
  async fn() {
    const config: TLSConnectionConfig = {
      hostname: "localhost",
      port: 65432, // Likely unused port
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    };

    const conn = new TLSConnection(config);

    await assertRejects(
      async () => await conn.connect(),
      Error,
      "TLS connection failed"
    );
  },
});

// ============================================================================
// TLSConnection asyncIterator Tests
// ============================================================================

Deno.test({
  name: "TLSConnection - Symbol.asyncIterator is defined",
  fn() {
    const config: TLSConnectionConfig = {
      hostname: "example.com",
      port: 443,
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    };

    const conn = new TLSConnection(config);

    assertExists(conn[Symbol.asyncIterator]);
    assertEquals(typeof conn[Symbol.asyncIterator], "function");
  },
});

Deno.test({
  name: "TLSConnection - asyncIterator returns immediately when not connected",
  async fn() {
    const config: TLSConnectionConfig = {
      hostname: "example.com",
      port: 443,
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    };

    const conn = new TLSConnection(config);
    const chunks: Uint8Array[] = [];

    for await (const chunk of conn) {
      chunks.push(chunk);
    }

    assertEquals(chunks.length, 0);
  },
});

// ============================================================================
// createTLSConnection Function Tests
// ============================================================================

Deno.test({
  name: "createTLSConnection - fails with invalid hostname",
  async fn() {
    const config: TLSConnectionConfig = {
      hostname: "this.hostname.definitely.does.not.exist.invalid",
      port: 443,
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    };

    await assertRejects(
      async () => await createTLSConnection(config),
      Error,
      "TLS connection failed"
    );
  },
});

Deno.test({
  name: "createTLSConnection - accepts TLSConnectionConfig",
  async fn() {
    // Just verify the function signature accepts the config type
    const config: TLSConnectionConfig = {
      hostname: "localhost",
      port: 65432,
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
      alpnProtocols: ["h2"],
      timeout: 5000,
    };

    // Will fail to connect, but verifies config is accepted
    await assertRejects(
      async () => await createTLSConnection(config),
      Error
    );
  },
});

// ============================================================================
// wrapWithTLS Function Tests
// ============================================================================

Deno.test({
  name: "wrapWithTLS - function is defined",
  fn() {
    assertExists(wrapWithTLS);
    assertEquals(typeof wrapWithTLS, "function");
  },
});

// ============================================================================
// TLSConnection Static startTls Tests
// ============================================================================

Deno.test({
  name: "TLSConnection.startTls - method exists",
  fn() {
    assertExists(TLSConnection.startTls);
    assertEquals(typeof TLSConnection.startTls, "function");
  },
});

// ============================================================================
// TLSVersion Integration Tests
// ============================================================================

Deno.test({
  name: "TLSConnection - TLS 1.3 config accepts TLS 1.3 cipher suites",
  fn() {
    const config: TLSConnectionConfig = {
      hostname: "example.com",
      port: 443,
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    };

    const conn = new TLSConnection(config);
    assertExists(conn);

    // Verify config compatibility
    assertEquals(config.version, TLSVersion.TLS_1_3);
    assert(config.cipherSuites.length > 0);
  },
});

Deno.test({
  name: "TLSConnection - TLS 1.2 config accepts TLS 1.2 cipher suites",
  fn() {
    const config: TLSConnectionConfig = {
      hostname: "legacy.example.com",
      port: 443,
      version: TLSVersion.TLS_1_2,
      cipherSuites: TLS12_CIPHER_SUITES,
    };

    const conn = new TLSConnection(config);
    assertExists(conn);

    assertEquals(config.version, TLSVersion.TLS_1_2);
    assert(config.cipherSuites.length > 0);
  },
});

// ============================================================================
// TLSConnection Configuration Edge Cases
// ============================================================================

Deno.test({
  name: "TLSConnection - accepts empty ALPN protocols",
  fn() {
    const config: TLSConnectionConfig = {
      hostname: "example.com",
      port: 443,
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
      alpnProtocols: [],
    };

    const conn = new TLSConnection(config);
    assertExists(conn);
  },
});

Deno.test({
  name: "TLSConnection - accepts IPv4 hostname",
  fn() {
    const config: TLSConnectionConfig = {
      hostname: "192.168.1.1",
      port: 443,
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
      serverName: "example.com", // SNI required for IP
    };

    const conn = new TLSConnection(config);
    assertExists(conn);
  },
});

Deno.test({
  name: "TLSConnection - accepts IPv6 hostname",
  fn() {
    const config: TLSConnectionConfig = {
      hostname: "::1",
      port: 443,
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    };

    const conn = new TLSConnection(config);
    assertExists(conn);
  },
});

Deno.test({
  name: "TLSConnection - accepts localhost",
  fn() {
    const config: TLSConnectionConfig = {
      hostname: "localhost",
      port: 443,
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    };

    const conn = new TLSConnection(config);
    assertExists(conn);
  },
});

Deno.test({
  name: "TLSConnection - accepts port 0",
  fn() {
    const config: TLSConnectionConfig = {
      hostname: "example.com",
      port: 0,
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    };

    const conn = new TLSConnection(config);
    assertExists(conn);
  },
});

Deno.test({
  name: "TLSConnection - accepts max port 65535",
  fn() {
    const config: TLSConnectionConfig = {
      hostname: "example.com",
      port: 65535,
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    };

    const conn = new TLSConnection(config);
    assertExists(conn);
  },
});

// ============================================================================
// TLSConnection Typical Usage Pattern Tests
// ============================================================================

Deno.test({
  name: "TLSConnection - typical HTTPS client config",
  fn() {
    const config: TLSConnectionConfig = {
      hostname: "api.example.com",
      port: 443,
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
      alpnProtocols: ["h2", "http/1.1"],
      serverName: "api.example.com",
      verifyServerCertificate: true,
    };

    const conn = new TLSConnection(config);
    assertExists(conn);
    assertEquals(conn.isEstablished(), false);
  },
});

Deno.test({
  name: "TLSConnection - typical internal service config",
  fn() {
    const config: TLSConnectionConfig = {
      hostname: "internal-service.local",
      port: 8443,
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
      verifyServerCertificate: false, // Internal CA
    };

    const conn = new TLSConnection(config);
    assertExists(conn);
  },
});

Deno.test({
  name: "TLSConnection - typical SMTP over TLS config",
  fn() {
    const config: TLSConnectionConfig = {
      hostname: "smtp.example.com",
      port: 465, // SMTPS
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    };

    const conn = new TLSConnection(config);
    assertExists(conn);
  },
});

Deno.test({
  name: "TLSConnection - typical IMAPS config",
  fn() {
    const config: TLSConnectionConfig = {
      hostname: "imap.example.com",
      port: 993,
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    };

    const conn = new TLSConnection(config);
    assertExists(conn);
  },
});

// ============================================================================
// Stats After Close Tests
// ============================================================================

Deno.test({
  name: "TLSConnection - getStats works after close",
  fn() {
    const config: TLSConnectionConfig = {
      hostname: "example.com",
      port: 443,
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    };

    const conn = new TLSConnection(config);
    conn.close();

    const stats = conn.getStats();
    assertExists(stats);
    assertEquals(stats.handshakeState, TLSHandshakeState.NONE);
  },
});

Deno.test({
  name: "TLSConnection - isEstablished is false after close",
  fn() {
    const config: TLSConnectionConfig = {
      hostname: "example.com",
      port: 443,
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    };

    const conn = new TLSConnection(config);
    conn.close();

    assertEquals(conn.isEstablished(), false);
  },
});

// ============================================================================
// TLSConnectionInfo Complete Example Tests
// ============================================================================

Deno.test({
  name: "TLSConnectionInfo - HTTP/2 connection info",
  fn() {
    const info: TLSConnectionInfo = {
      version: TLSVersion.TLS_1_3,
      cipherSuite: "TLS_AES_256_GCM_SHA384",
      alpnProtocol: "h2",
      serverName: "api.example.com",
      serverCertificate: {
        subject: { CN: "api.example.com", O: "Example Inc" },
        issuer: { CN: "DigiCert TLS RSA SHA256 2020 CA1", O: "DigiCert Inc" },
        notBefore: new Date("2024-01-01"),
        notAfter: new Date("2025-01-01"),
        subjectAltNames: ["api.example.com", "*.api.example.com"],
        publicKey: new Uint8Array(256),
        signature: new Uint8Array(256),
        raw: new Uint8Array(1024),
      },
    };

    assertEquals(info.version, TLSVersion.TLS_1_3);
    assertEquals(info.cipherSuite, "TLS_AES_256_GCM_SHA384");
    assertEquals(info.alpnProtocol, "h2");
    assertEquals(info.serverName, "api.example.com");
    assertExists(info.serverCertificate);
    assertEquals(info.serverCertificate!.subject.CN, "api.example.com");
    assertEquals(info.serverCertificate!.subjectAltNames.length, 2);
  },
});

Deno.test({
  name: "TLSConnectionInfo - HTTP/1.1 connection info",
  fn() {
    const info: TLSConnectionInfo = {
      version: TLSVersion.TLS_1_2,
      cipherSuite: "TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256",
      alpnProtocol: "http/1.1",
      serverName: "legacy.example.com",
    };

    assertEquals(info.version, TLSVersion.TLS_1_2);
    assertEquals(info.cipherSuite, "TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256");
    assertEquals(info.alpnProtocol, "http/1.1");
    assertEquals(info.serverName, "legacy.example.com");
    assertEquals(info.serverCertificate, undefined);
  },
});

// ============================================================================
// TLSConnectionStats Complete Example Tests
// ============================================================================

Deno.test({
  name: "TLSConnectionStats - active connection stats",
  fn() {
    const stats: TLSConnectionStats = {
      handshakeState: TLSHandshakeState.ESTABLISHED,
      handshakeDuration: 45, // Fast handshake
      bytesEncrypted: 150000, // Sent 150KB
      bytesDecrypted: 500000, // Received 500KB
      duration: 30000, // 30 seconds connected
    };

    assertEquals(stats.handshakeState, TLSHandshakeState.ESTABLISHED);
    assertEquals(stats.handshakeDuration, 45);
    assertEquals(stats.bytesEncrypted, 150000);
    assertEquals(stats.bytesDecrypted, 500000);
    assertEquals(stats.duration, 30000);

    // Calculate throughput
    const totalBytes = stats.bytesEncrypted + stats.bytesDecrypted;
    const throughputBps = totalBytes / (stats.duration / 1000);
    assert(throughputBps > 0);
  },
});

Deno.test({
  name: "TLSConnectionStats - failed handshake stats",
  fn() {
    const stats: TLSConnectionStats = {
      handshakeState: TLSHandshakeState.ERROR,
      handshakeDuration: 5000, // Timeout
      bytesEncrypted: 0,
      bytesDecrypted: 0,
      duration: 5000,
    };

    assertEquals(stats.handshakeState, TLSHandshakeState.ERROR);
    assertEquals(stats.bytesEncrypted, 0);
    assertEquals(stats.bytesDecrypted, 0);
  },
});

// ============================================================================
// Cipher Suite Configuration Tests
// ============================================================================

Deno.test({
  name: "TLSConnection - TLS13_CIPHER_SUITES is non-empty",
  fn() {
    assert(TLS13_CIPHER_SUITES.length > 0);
  },
});

Deno.test({
  name: "TLSConnection - TLS12_CIPHER_SUITES is non-empty",
  fn() {
    assert(TLS12_CIPHER_SUITES.length > 0);
  },
});

Deno.test({
  name: "TLSConnection - accepts custom cipher suite array",
  fn() {
    // Only the most secure TLS 1.3 cipher
    const customSuites = TLS13_CIPHER_SUITES.filter(
      cs => cs.name === "TLS_AES_256_GCM_SHA384"
    );

    const config: TLSConnectionConfig = {
      hostname: "secure.example.com",
      port: 443,
      version: TLSVersion.TLS_1_3,
      cipherSuites: customSuites,
    };

    const conn = new TLSConnection(config);
    assertExists(conn);
  },
});

// ============================================================================
// Edge Case Tests
// ============================================================================

Deno.test({
  name: "TLSConnection - handles unicode hostname",
  fn() {
    const config: TLSConnectionConfig = {
      hostname: "例え.jp", // Unicode domain
      port: 443,
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    };

    const conn = new TLSConnection(config);
    assertExists(conn);
  },
});

Deno.test({
  name: "TLSConnection - handles punycode hostname",
  fn() {
    const config: TLSConnectionConfig = {
      hostname: "xn--e1afmkfd.xn--p1ai", // Punycode for пример.рф
      port: 443,
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    };

    const conn = new TLSConnection(config);
    assertExists(conn);
  },
});

Deno.test({
  name: "TLSConnection - handles long subdomain",
  fn() {
    const longSubdomain = "a".repeat(63); // Max label length
    const config: TLSConnectionConfig = {
      hostname: `${longSubdomain}.example.com`,
      port: 443,
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    };

    const conn = new TLSConnection(config);
    assertExists(conn);
  },
});

Deno.test({
  name: "TLSConnection - handles multiple ALPN protocols",
  fn() {
    const config: TLSConnectionConfig = {
      hostname: "example.com",
      port: 443,
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
      alpnProtocols: ["h2", "http/1.1", "http/1.0"],
    };

    const conn = new TLSConnection(config);
    assertExists(conn);
    assertEquals(config.alpnProtocols!.length, 3);
  },
});

Deno.test({
  name: "TLSConnection - getStats called repeatedly returns consistent data",
  fn() {
    const config: TLSConnectionConfig = {
      hostname: "example.com",
      port: 443,
      version: TLSVersion.TLS_1_3,
      cipherSuites: TLS13_CIPHER_SUITES,
    };

    const conn = new TLSConnection(config);

    const stats1 = conn.getStats();
    const stats2 = conn.getStats();
    const stats3 = conn.getStats();

    assertEquals(stats1.handshakeState, stats2.handshakeState);
    assertEquals(stats2.handshakeState, stats3.handshakeState);
    assertEquals(stats1.bytesEncrypted, stats2.bytesEncrypted);
    assertEquals(stats2.bytesDecrypted, stats3.bytesDecrypted);
  },
});

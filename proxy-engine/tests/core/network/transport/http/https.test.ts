/**
 * HTTPS Tests
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { HTTPSClient } from "../../../../../core/network/transport/http/https.ts";

// ============================================================================
// Construction
// ============================================================================

Deno.test({
  name: "HTTPSClient - constructs with host only",
  fn() {
    const client = new HTTPSClient("example.com");
    assertExists(client);
  },
});

Deno.test({
  name: "HTTPSClient - constructs with host and port",
  fn() {
    const client = new HTTPSClient("example.com", 8443);
    assertExists(client);
  },
});

Deno.test({
  name: "HTTPSClient - constructs with TLS options",
  fn() {
    const client = new HTTPSClient("example.com", 443, { alpnProtocols: ["h2", "http/1.1"] });
    assertExists(client);
  },
});

// ============================================================================
// getHost() / getPort() / getTLSOptions()
// ============================================================================

Deno.test({
  name: "HTTPSClient - getHost() returns configured host",
  fn() {
    const client = new HTTPSClient("api.example.com");
    assertEquals(client.getHost(), "api.example.com");
  },
});

Deno.test({
  name: "HTTPSClient - getPort() defaults to 443",
  fn() {
    const client = new HTTPSClient("example.com");
    assertEquals(client.getPort(), 443);
  },
});

Deno.test({
  name: "HTTPSClient - getPort() returns custom port",
  fn() {
    const client = new HTTPSClient("example.com", 8443);
    assertEquals(client.getPort(), 8443);
  },
});

Deno.test({
  name: "HTTPSClient - getTLSOptions() returns provided TLS options",
  fn() {
    const opts = { alpnProtocols: ["h2"] };
    const client = new HTTPSClient("example.com", 443, opts);
    assertEquals(client.getTLSOptions().alpnProtocols, ["h2"]);
  },
});

Deno.test({
  name: "HTTPSClient - getTLSOptions() returns empty object when none provided",
  fn() {
    const client = new HTTPSClient("example.com");
    assertExists(client.getTLSOptions());
  },
});

// ============================================================================
// isConnected()
// ============================================================================

Deno.test({
  name: "HTTPSClient - isConnected() is false before connect()",
  fn() {
    const client = new HTTPSClient("example.com");
    assertEquals(client.isConnected(), false);
  },
});

// ============================================================================
// getTLSConnection() / getSocket() / getHTTPClient()
// ============================================================================

Deno.test({
  name: "HTTPSClient - getTLSConnection() returns null before connect",
  fn() {
    const client = new HTTPSClient("example.com");
    assertEquals(client.getTLSConnection(), null);
  },
});

Deno.test({
  name: "HTTPSClient - getSocket() returns null before connect",
  fn() {
    const client = new HTTPSClient("example.com");
    assertEquals(client.getSocket(), null);
  },
});

Deno.test({
  name: "HTTPSClient - getHTTPClient() returns null before connect",
  fn() {
    const client = new HTTPSClient("example.com");
    assertEquals(client.getHTTPClient(), null);
  },
});

// ============================================================================
// sendRequest() before connect
// ============================================================================

Deno.test({
  name: "HTTPSClient - sendRequest() throws when not connected",
  async fn() {
    const client = new HTTPSClient("example.com");
    let threw = false;
    try {
      await client.sendRequest({
        method: "GET",
        uri: "https://example.com/",
        version: "1.1",
        headers: {},
      });
    } catch {
      threw = true;
    }
    assert(threw);
  },
});

// ============================================================================
// close() before connect
// ============================================================================

Deno.test({
  name: "HTTPSClient - close() before connect does not throw",
  fn() {
    const client = new HTTPSClient("example.com");
    client.close(); // Should be a no-op
    assertEquals(client.isConnected(), false);
  },
});

// ============================================================================
// connect() to unreachable host throws
// ============================================================================

Deno.test({
  name: "HTTPSClient - connect() to refused port throws",
  async fn() {
    // Port 19999 is very unlikely to be listening - connection refused is immediate
    const client = new HTTPSClient("127.0.0.1", 19999);
    let threw = false;
    try {
      await client.connect();
    } catch {
      threw = true;
    }
    assert(threw);
    assertEquals(client.isConnected(), false);
  },
});

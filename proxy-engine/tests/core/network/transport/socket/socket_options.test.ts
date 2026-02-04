/**
 * SocketOptions Tests
 * Comprehensive tests for socket configuration options
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import {
  DEFAULT_SOCKET_OPTIONS,
  mergeSocketOptions,
  type SocketOptions,
} from "../../../../../core/network/transport/socket/socket_options.ts";

// ============================================================================
// DEFAULT_SOCKET_OPTIONS Tests
// ============================================================================

Deno.test({
  name: "DEFAULT_SOCKET_OPTIONS - has all required properties",
  fn() {
    assertExists(DEFAULT_SOCKET_OPTIONS);
    assertEquals(typeof DEFAULT_SOCKET_OPTIONS.tcpNoDelay, "boolean");
    assertEquals(typeof DEFAULT_SOCKET_OPTIONS.tcpKeepAlive, "boolean");
    assertEquals(typeof DEFAULT_SOCKET_OPTIONS.reuseAddr, "boolean");
    assertEquals(typeof DEFAULT_SOCKET_OPTIONS.recvBufferSize, "number");
    assertEquals(typeof DEFAULT_SOCKET_OPTIONS.sendBufferSize, "number");
    assertEquals(typeof DEFAULT_SOCKET_OPTIONS.connectTimeout, "number");
    assertEquals(typeof DEFAULT_SOCKET_OPTIONS.readTimeout, "number");
    assertEquals(typeof DEFAULT_SOCKET_OPTIONS.writeTimeout, "number");
  },
});

Deno.test({
  name: "DEFAULT_SOCKET_OPTIONS - tcpNoDelay is true by default",
  fn() {
    assertEquals(DEFAULT_SOCKET_OPTIONS.tcpNoDelay, true);
  },
});

Deno.test({
  name: "DEFAULT_SOCKET_OPTIONS - tcpKeepAlive is true by default",
  fn() {
    assertEquals(DEFAULT_SOCKET_OPTIONS.tcpKeepAlive, true);
  },
});

Deno.test({
  name: "DEFAULT_SOCKET_OPTIONS - reuseAddr is true by default",
  fn() {
    assertEquals(DEFAULT_SOCKET_OPTIONS.reuseAddr, true);
  },
});

Deno.test({
  name: "DEFAULT_SOCKET_OPTIONS - recvBufferSize is 64KB",
  fn() {
    assertEquals(DEFAULT_SOCKET_OPTIONS.recvBufferSize, 65536);
  },
});

Deno.test({
  name: "DEFAULT_SOCKET_OPTIONS - sendBufferSize is 64KB",
  fn() {
    assertEquals(DEFAULT_SOCKET_OPTIONS.sendBufferSize, 65536);
  },
});

Deno.test({
  name: "DEFAULT_SOCKET_OPTIONS - connectTimeout is 30 seconds",
  fn() {
    assertEquals(DEFAULT_SOCKET_OPTIONS.connectTimeout, 30000);
  },
});

Deno.test({
  name: "DEFAULT_SOCKET_OPTIONS - readTimeout is 0 (no timeout)",
  fn() {
    assertEquals(DEFAULT_SOCKET_OPTIONS.readTimeout, 0);
  },
});

Deno.test({
  name: "DEFAULT_SOCKET_OPTIONS - writeTimeout is 0 (no timeout)",
  fn() {
    assertEquals(DEFAULT_SOCKET_OPTIONS.writeTimeout, 0);
  },
});

// ============================================================================
// mergeSocketOptions Tests
// ============================================================================

Deno.test({
  name: "mergeSocketOptions - returns defaults when no options provided",
  fn() {
    const result = mergeSocketOptions();

    assertEquals(result.tcpNoDelay, DEFAULT_SOCKET_OPTIONS.tcpNoDelay);
    assertEquals(result.tcpKeepAlive, DEFAULT_SOCKET_OPTIONS.tcpKeepAlive);
    assertEquals(result.reuseAddr, DEFAULT_SOCKET_OPTIONS.reuseAddr);
    assertEquals(result.recvBufferSize, DEFAULT_SOCKET_OPTIONS.recvBufferSize);
    assertEquals(result.sendBufferSize, DEFAULT_SOCKET_OPTIONS.sendBufferSize);
    assertEquals(result.connectTimeout, DEFAULT_SOCKET_OPTIONS.connectTimeout);
    assertEquals(result.readTimeout, DEFAULT_SOCKET_OPTIONS.readTimeout);
    assertEquals(result.writeTimeout, DEFAULT_SOCKET_OPTIONS.writeTimeout);
  },
});

Deno.test({
  name: "mergeSocketOptions - returns defaults when empty object provided",
  fn() {
    const result = mergeSocketOptions({});

    assertEquals(result.tcpNoDelay, DEFAULT_SOCKET_OPTIONS.tcpNoDelay);
    assertEquals(result.tcpKeepAlive, DEFAULT_SOCKET_OPTIONS.tcpKeepAlive);
    assertEquals(result.reuseAddr, DEFAULT_SOCKET_OPTIONS.reuseAddr);
  },
});

Deno.test({
  name: "mergeSocketOptions - overrides tcpNoDelay",
  fn() {
    const options: SocketOptions = { tcpNoDelay: false };
    const result = mergeSocketOptions(options);

    assertEquals(result.tcpNoDelay, false);
    // Other defaults preserved
    assertEquals(result.tcpKeepAlive, DEFAULT_SOCKET_OPTIONS.tcpKeepAlive);
  },
});

Deno.test({
  name: "mergeSocketOptions - overrides tcpKeepAlive",
  fn() {
    const options: SocketOptions = { tcpKeepAlive: false };
    const result = mergeSocketOptions(options);

    assertEquals(result.tcpKeepAlive, false);
    assertEquals(result.tcpNoDelay, DEFAULT_SOCKET_OPTIONS.tcpNoDelay);
  },
});

Deno.test({
  name: "mergeSocketOptions - overrides reuseAddr",
  fn() {
    const options: SocketOptions = { reuseAddr: false };
    const result = mergeSocketOptions(options);

    assertEquals(result.reuseAddr, false);
  },
});

Deno.test({
  name: "mergeSocketOptions - overrides recvBufferSize",
  fn() {
    const options: SocketOptions = { recvBufferSize: 131072 }; // 128KB
    const result = mergeSocketOptions(options);

    assertEquals(result.recvBufferSize, 131072);
    assertEquals(result.sendBufferSize, DEFAULT_SOCKET_OPTIONS.sendBufferSize);
  },
});

Deno.test({
  name: "mergeSocketOptions - overrides sendBufferSize",
  fn() {
    const options: SocketOptions = { sendBufferSize: 262144 }; // 256KB
    const result = mergeSocketOptions(options);

    assertEquals(result.sendBufferSize, 262144);
    assertEquals(result.recvBufferSize, DEFAULT_SOCKET_OPTIONS.recvBufferSize);
  },
});

Deno.test({
  name: "mergeSocketOptions - overrides connectTimeout",
  fn() {
    const options: SocketOptions = { connectTimeout: 5000 }; // 5 seconds
    const result = mergeSocketOptions(options);

    assertEquals(result.connectTimeout, 5000);
  },
});

Deno.test({
  name: "mergeSocketOptions - overrides readTimeout",
  fn() {
    const options: SocketOptions = { readTimeout: 60000 }; // 60 seconds
    const result = mergeSocketOptions(options);

    assertEquals(result.readTimeout, 60000);
  },
});

Deno.test({
  name: "mergeSocketOptions - overrides writeTimeout",
  fn() {
    const options: SocketOptions = { writeTimeout: 30000 }; // 30 seconds
    const result = mergeSocketOptions(options);

    assertEquals(result.writeTimeout, 30000);
  },
});

Deno.test({
  name: "mergeSocketOptions - overrides multiple options",
  fn() {
    const options: SocketOptions = {
      tcpNoDelay: false,
      tcpKeepAlive: false,
      connectTimeout: 10000,
      recvBufferSize: 32768,
    };
    const result = mergeSocketOptions(options);

    assertEquals(result.tcpNoDelay, false);
    assertEquals(result.tcpKeepAlive, false);
    assertEquals(result.connectTimeout, 10000);
    assertEquals(result.recvBufferSize, 32768);
    // Defaults preserved for non-overridden
    assertEquals(result.reuseAddr, DEFAULT_SOCKET_OPTIONS.reuseAddr);
    assertEquals(result.sendBufferSize, DEFAULT_SOCKET_OPTIONS.sendBufferSize);
    assertEquals(result.readTimeout, DEFAULT_SOCKET_OPTIONS.readTimeout);
    assertEquals(result.writeTimeout, DEFAULT_SOCKET_OPTIONS.writeTimeout);
  },
});

Deno.test({
  name: "mergeSocketOptions - overrides all options",
  fn() {
    const options: SocketOptions = {
      tcpNoDelay: false,
      tcpKeepAlive: false,
      reuseAddr: false,
      recvBufferSize: 1024,
      sendBufferSize: 2048,
      connectTimeout: 1000,
      readTimeout: 2000,
      writeTimeout: 3000,
    };
    const result = mergeSocketOptions(options);

    assertEquals(result.tcpNoDelay, false);
    assertEquals(result.tcpKeepAlive, false);
    assertEquals(result.reuseAddr, false);
    assertEquals(result.recvBufferSize, 1024);
    assertEquals(result.sendBufferSize, 2048);
    assertEquals(result.connectTimeout, 1000);
    assertEquals(result.readTimeout, 2000);
    assertEquals(result.writeTimeout, 3000);
  },
});

Deno.test({
  name: "mergeSocketOptions - handles zero values",
  fn() {
    const options: SocketOptions = {
      recvBufferSize: 0,
      sendBufferSize: 0,
      connectTimeout: 0,
    };
    const result = mergeSocketOptions(options);

    assertEquals(result.recvBufferSize, 0);
    assertEquals(result.sendBufferSize, 0);
    assertEquals(result.connectTimeout, 0);
  },
});

Deno.test({
  name: "mergeSocketOptions - returns Required<SocketOptions>",
  fn() {
    const result = mergeSocketOptions();

    // All properties should be defined (not undefined)
    assert(result.tcpNoDelay !== undefined);
    assert(result.tcpKeepAlive !== undefined);
    assert(result.reuseAddr !== undefined);
    assert(result.recvBufferSize !== undefined);
    assert(result.sendBufferSize !== undefined);
    assert(result.connectTimeout !== undefined);
    assert(result.readTimeout !== undefined);
    assert(result.writeTimeout !== undefined);
  },
});

Deno.test({
  name: "mergeSocketOptions - does not mutate input options",
  fn() {
    const options: SocketOptions = { tcpNoDelay: false };
    const optionsCopy = { ...options };

    mergeSocketOptions(options);

    assertEquals(options, optionsCopy);
  },
});

Deno.test({
  name: "mergeSocketOptions - does not mutate defaults",
  fn() {
    const originalDefaults = { ...DEFAULT_SOCKET_OPTIONS };

    mergeSocketOptions({ tcpNoDelay: false });

    assertEquals(DEFAULT_SOCKET_OPTIONS, originalDefaults);
  },
});

// ============================================================================
// Edge Cases
// ============================================================================

Deno.test({
  name: "mergeSocketOptions - handles large buffer sizes",
  fn() {
    const options: SocketOptions = {
      recvBufferSize: 10 * 1024 * 1024, // 10MB
      sendBufferSize: 10 * 1024 * 1024,
    };
    const result = mergeSocketOptions(options);

    assertEquals(result.recvBufferSize, 10 * 1024 * 1024);
    assertEquals(result.sendBufferSize, 10 * 1024 * 1024);
  },
});

Deno.test({
  name: "mergeSocketOptions - handles large timeout values",
  fn() {
    const options: SocketOptions = {
      connectTimeout: 300000, // 5 minutes
      readTimeout: 600000, // 10 minutes
      writeTimeout: 600000,
    };
    const result = mergeSocketOptions(options);

    assertEquals(result.connectTimeout, 300000);
    assertEquals(result.readTimeout, 600000);
    assertEquals(result.writeTimeout, 600000);
  },
});

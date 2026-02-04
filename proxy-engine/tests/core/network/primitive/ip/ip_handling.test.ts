/**
 * IPHandling Tests
 * Comprehensive tests for IPv4Address, IPv6Address, and utility functions
 */

import { assertEquals, assertExists, assert, assertThrows } from "@std/assert";
import {
  IPv4Address,
  IPv6Address,
  parseIPAddress,
  isValidIPAddress,
} from "../../../../../core/network/primitive/ip/ip_handling.ts";

// ============================================================================
// IPv4Address Constructor Tests
// ============================================================================

Deno.test({
  name: "IPv4Address - parses valid address",
  fn() {
    const addr = new IPv4Address("192.168.1.1");
    assertExists(addr);
    assertEquals(addr.toString(), "192.168.1.1");
  },
});

Deno.test({
  name: "IPv4Address - parses address with zeros",
  fn() {
    const addr = new IPv4Address("0.0.0.0");
    assertEquals(addr.toString(), "0.0.0.0");
  },
});

Deno.test({
  name: "IPv4Address - parses address with 255s",
  fn() {
    const addr = new IPv4Address("255.255.255.255");
    assertEquals(addr.toString(), "255.255.255.255");
  },
});

Deno.test({
  name: "IPv4Address - throws on too few octets",
  fn() {
    assertThrows(
      () => new IPv4Address("192.168.1"),
      Error,
      "Invalid IPv4 address"
    );
  },
});

Deno.test({
  name: "IPv4Address - throws on too many octets",
  fn() {
    assertThrows(
      () => new IPv4Address("192.168.1.1.1"),
      Error,
      "Invalid IPv4 address"
    );
  },
});

Deno.test({
  name: "IPv4Address - throws on octet value too high",
  fn() {
    assertThrows(
      () => new IPv4Address("192.168.1.256"),
      Error,
      "Invalid IPv4 octet"
    );
  },
});

Deno.test({
  name: "IPv4Address - throws on negative octet",
  fn() {
    assertThrows(
      () => new IPv4Address("192.168.-1.1"),
      Error,
      "Invalid IPv4 octet"
    );
  },
});

Deno.test({
  name: "IPv4Address - throws on non-numeric octet",
  fn() {
    assertThrows(
      () => new IPv4Address("192.168.abc.1"),
      Error,
      "Invalid IPv4 octet"
    );
  },
});

Deno.test({
  name: "IPv4Address - throws on empty string",
  fn() {
    assertThrows(
      () => new IPv4Address(""),
      Error,
      "Invalid IPv4"
    );
  },
});

// ============================================================================
// IPv4Address toString Tests
// ============================================================================

Deno.test({
  name: "IPv4Address - toString returns dotted decimal format",
  fn() {
    const addr = new IPv4Address("10.20.30.40");
    assertEquals(addr.toString(), "10.20.30.40");
  },
});

// ============================================================================
// IPv4Address toInteger Tests
// ============================================================================

Deno.test({
  name: "IPv4Address - toInteger returns correct value for 0.0.0.0",
  fn() {
    const addr = new IPv4Address("0.0.0.0");
    assertEquals(addr.toInteger(), 0);
  },
});

Deno.test({
  name: "IPv4Address - toInteger returns correct value for 0.0.0.1",
  fn() {
    const addr = new IPv4Address("0.0.0.1");
    assertEquals(addr.toInteger(), 1);
  },
});

Deno.test({
  name: "IPv4Address - toInteger returns correct value for 0.0.1.0",
  fn() {
    const addr = new IPv4Address("0.0.1.0");
    assertEquals(addr.toInteger(), 256);
  },
});

Deno.test({
  name: "IPv4Address - toInteger returns correct value for 192.168.1.1",
  fn() {
    const addr = new IPv4Address("192.168.1.1");
    // 192*2^24 + 168*2^16 + 1*2^8 + 1 = 3232235777
    assertEquals(addr.toInteger(), (192 << 24) | (168 << 16) | (1 << 8) | 1);
  },
});

// ============================================================================
// IPv4Address isPrivate Tests
// ============================================================================

Deno.test({
  name: "IPv4Address - isPrivate returns true for 10.x.x.x",
  fn() {
    assert(new IPv4Address("10.0.0.0").isPrivate());
    assert(new IPv4Address("10.255.255.255").isPrivate());
    assert(new IPv4Address("10.50.100.200").isPrivate());
  },
});

Deno.test({
  name: "IPv4Address - isPrivate returns true for 172.16.x.x - 172.31.x.x",
  fn() {
    assert(new IPv4Address("172.16.0.0").isPrivate());
    assert(new IPv4Address("172.31.255.255").isPrivate());
    assert(new IPv4Address("172.20.100.50").isPrivate());
  },
});

Deno.test({
  name: "IPv4Address - isPrivate returns false for 172.15.x.x and 172.32.x.x",
  fn() {
    assert(!new IPv4Address("172.15.255.255").isPrivate());
    assert(!new IPv4Address("172.32.0.0").isPrivate());
  },
});

Deno.test({
  name: "IPv4Address - isPrivate returns true for 192.168.x.x",
  fn() {
    assert(new IPv4Address("192.168.0.0").isPrivate());
    assert(new IPv4Address("192.168.255.255").isPrivate());
    assert(new IPv4Address("192.168.1.100").isPrivate());
  },
});

Deno.test({
  name: "IPv4Address - isPrivate returns false for public IPs",
  fn() {
    assert(!new IPv4Address("8.8.8.8").isPrivate());
    assert(!new IPv4Address("1.1.1.1").isPrivate());
    assert(!new IPv4Address("142.250.80.46").isPrivate());
  },
});

// ============================================================================
// IPv4Address isLoopback Tests
// ============================================================================

Deno.test({
  name: "IPv4Address - isLoopback returns true for 127.x.x.x",
  fn() {
    assert(new IPv4Address("127.0.0.1").isLoopback());
    assert(new IPv4Address("127.255.255.255").isLoopback());
    assert(new IPv4Address("127.1.2.3").isLoopback());
  },
});

Deno.test({
  name: "IPv4Address - isLoopback returns false for non-loopback",
  fn() {
    assert(!new IPv4Address("128.0.0.1").isLoopback());
    assert(!new IPv4Address("126.255.255.255").isLoopback());
    assert(!new IPv4Address("192.168.1.1").isLoopback());
  },
});

// ============================================================================
// IPv4Address isMulticast Tests
// ============================================================================

Deno.test({
  name: "IPv4Address - isMulticast returns true for 224-239.x.x.x",
  fn() {
    assert(new IPv4Address("224.0.0.0").isMulticast());
    assert(new IPv4Address("239.255.255.255").isMulticast());
    assert(new IPv4Address("230.1.2.3").isMulticast());
  },
});

Deno.test({
  name: "IPv4Address - isMulticast returns false for non-multicast",
  fn() {
    assert(!new IPv4Address("223.255.255.255").isMulticast());
    assert(!new IPv4Address("240.0.0.0").isMulticast());
    assert(!new IPv4Address("192.168.1.1").isMulticast());
  },
});

// ============================================================================
// IPv4Address isLinkLocal Tests
// ============================================================================

Deno.test({
  name: "IPv4Address - isLinkLocal returns true for 169.254.x.x",
  fn() {
    assert(new IPv4Address("169.254.0.0").isLinkLocal());
    assert(new IPv4Address("169.254.255.255").isLinkLocal());
    assert(new IPv4Address("169.254.100.50").isLinkLocal());
  },
});

Deno.test({
  name: "IPv4Address - isLinkLocal returns false for non-link-local",
  fn() {
    assert(!new IPv4Address("169.253.255.255").isLinkLocal());
    assert(!new IPv4Address("169.255.0.0").isLinkLocal());
    assert(!new IPv4Address("192.168.1.1").isLinkLocal());
  },
});

// ============================================================================
// IPv4Address getClass Tests
// ============================================================================

Deno.test({
  name: "IPv4Address - getClass returns A for 1-126",
  fn() {
    assertEquals(new IPv4Address("1.0.0.0").getClass(), "A");
    assertEquals(new IPv4Address("126.255.255.255").getClass(), "A");
    assertEquals(new IPv4Address("10.0.0.1").getClass(), "A");
  },
});

Deno.test({
  name: "IPv4Address - getClass returns B for 128-191",
  fn() {
    assertEquals(new IPv4Address("128.0.0.0").getClass(), "B");
    assertEquals(new IPv4Address("191.255.255.255").getClass(), "B");
    assertEquals(new IPv4Address("172.16.0.1").getClass(), "B");
  },
});

Deno.test({
  name: "IPv4Address - getClass returns C for 192-223",
  fn() {
    assertEquals(new IPv4Address("192.0.0.0").getClass(), "C");
    assertEquals(new IPv4Address("223.255.255.255").getClass(), "C");
    assertEquals(new IPv4Address("192.168.1.1").getClass(), "C");
  },
});

Deno.test({
  name: "IPv4Address - getClass returns D for 224-239 (multicast)",
  fn() {
    assertEquals(new IPv4Address("224.0.0.0").getClass(), "D");
    assertEquals(new IPv4Address("239.255.255.255").getClass(), "D");
  },
});

Deno.test({
  name: "IPv4Address - getClass returns E for 240-255 (reserved)",
  fn() {
    assertEquals(new IPv4Address("240.0.0.0").getClass(), "E");
    assertEquals(new IPv4Address("255.255.255.255").getClass(), "E");
  },
});

Deno.test({
  name: "IPv4Address - getClass returns E for 0 and 127",
  fn() {
    assertEquals(new IPv4Address("0.0.0.0").getClass(), "E");
    assertEquals(new IPv4Address("127.0.0.1").getClass(), "E");
  },
});

// ============================================================================
// IPv6Address Constructor Tests
// ============================================================================

Deno.test({
  name: "IPv6Address - parses full address",
  fn() {
    const addr = new IPv6Address("2001:0db8:85a3:0000:0000:8a2e:0370:7334");
    assertExists(addr);
  },
});

Deno.test({
  name: "IPv6Address - parses compressed address with ::",
  fn() {
    const addr = new IPv6Address("2001:db8::1");
    assertExists(addr);
  },
});

Deno.test({
  name: "IPv6Address - parses loopback ::1",
  fn() {
    const addr = new IPv6Address("::1");
    assertExists(addr);
    assert(addr.isLoopback());
  },
});

Deno.test({
  name: "IPv6Address - parses unspecified ::",
  fn() {
    const addr = new IPv6Address("::");
    assertExists(addr);
  },
});

Deno.test({
  name: "IPv6Address - parses address with leading compression",
  fn() {
    const addr = new IPv6Address("::ffff:192.0.2.1");
    assertExists(addr);
  },
});

Deno.test({
  name: "IPv6Address - parses address with trailing compression",
  fn() {
    const addr = new IPv6Address("2001:db8::");
    assertExists(addr);
  },
});

Deno.test({
  name: "IPv6Address - throws on invalid hextet",
  fn() {
    assertThrows(
      () => new IPv6Address("2001:db8:85a3:0000:0000:8a2e:0370:gggg"),
      Error,
      "Invalid IPv6"
    );
  },
});

Deno.test({
  name: "IPv6Address - throws on too many hextets",
  fn() {
    assertThrows(
      () => new IPv6Address("2001:db8:85a3:0000:0000:8a2e:0370:7334:extra"),
      Error,
      "Invalid IPv6"
    );
  },
});

// ============================================================================
// IPv6Address toString Tests
// ============================================================================

Deno.test({
  name: "IPv6Address - toString compresses zeros",
  fn() {
    const addr = new IPv6Address("2001:db8:0:0:0:0:0:1");
    const str = addr.toString();
    // Should contain :: for zero compression
    assert(str.includes("::") || str === "2001:db8::1");
  },
});

Deno.test({
  name: "IPv6Address - toString for loopback",
  fn() {
    const addr = new IPv6Address("::1");
    assertEquals(addr.toString(), "::1");
  },
});

Deno.test({
  name: "IPv6Address - toString for unspecified",
  fn() {
    const addr = new IPv6Address("::");
    assertEquals(addr.toString(), "::");
  },
});

// ============================================================================
// IPv6Address isLoopback Tests
// ============================================================================

Deno.test({
  name: "IPv6Address - isLoopback returns true for ::1",
  fn() {
    assert(new IPv6Address("::1").isLoopback());
    assert(new IPv6Address("0:0:0:0:0:0:0:1").isLoopback());
  },
});

Deno.test({
  name: "IPv6Address - isLoopback returns false for non-loopback",
  fn() {
    assert(!new IPv6Address("::2").isLoopback());
    assert(!new IPv6Address("2001:db8::1").isLoopback());
    assert(!new IPv6Address("::").isLoopback());
  },
});

// ============================================================================
// IPv6Address isLinkLocal Tests
// ============================================================================

Deno.test({
  name: "IPv6Address - isLinkLocal returns true for fe80::/10",
  fn() {
    assert(new IPv6Address("fe80::1").isLinkLocal());
    assert(new IPv6Address("fe80:0:0:0:0:0:0:1").isLinkLocal());
    assert(new IPv6Address("febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff").isLinkLocal());
  },
});

Deno.test({
  name: "IPv6Address - isLinkLocal returns false for non-link-local",
  fn() {
    assert(!new IPv6Address("fe00::1").isLinkLocal());
    assert(!new IPv6Address("fec0::1").isLinkLocal());
    assert(!new IPv6Address("2001:db8::1").isLinkLocal());
  },
});

// ============================================================================
// IPv6Address isMulticast Tests
// ============================================================================

Deno.test({
  name: "IPv6Address - isMulticast returns true for ff00::/8",
  fn() {
    assert(new IPv6Address("ff00::1").isMulticast());
    assert(new IPv6Address("ff02::1").isMulticast());
    assert(new IPv6Address("ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff").isMulticast());
  },
});

Deno.test({
  name: "IPv6Address - isMulticast returns false for non-multicast",
  fn() {
    assert(!new IPv6Address("fe00::1").isMulticast());
    assert(!new IPv6Address("2001:db8::1").isMulticast());
    assert(!new IPv6Address("::1").isMulticast());
  },
});

// ============================================================================
// IPv6Address isUniqueLocal Tests
// ============================================================================

Deno.test({
  name: "IPv6Address - isUniqueLocal returns true for fc00::/7",
  fn() {
    assert(new IPv6Address("fc00::1").isUniqueLocal());
    assert(new IPv6Address("fd00::1").isUniqueLocal());
    assert(new IPv6Address("fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff").isUniqueLocal());
  },
});

Deno.test({
  name: "IPv6Address - isUniqueLocal returns false for non-unique-local",
  fn() {
    assert(!new IPv6Address("fe00::1").isUniqueLocal());
    assert(!new IPv6Address("2001:db8::1").isUniqueLocal());
    assert(!new IPv6Address("::1").isUniqueLocal());
  },
});

// ============================================================================
// parseIPAddress Tests
// ============================================================================

Deno.test({
  name: "parseIPAddress - returns IPv4Address for IPv4 format",
  fn() {
    const addr = parseIPAddress("192.168.1.1");
    assert(addr instanceof IPv4Address);
    assertEquals(addr.toString(), "192.168.1.1");
  },
});

Deno.test({
  name: "parseIPAddress - returns IPv6Address for IPv6 format",
  fn() {
    const addr = parseIPAddress("2001:db8::1");
    assert(addr instanceof IPv6Address);
  },
});

Deno.test({
  name: "parseIPAddress - returns IPv6Address for address with colons",
  fn() {
    const addr = parseIPAddress("::1");
    assert(addr instanceof IPv6Address);
  },
});

Deno.test({
  name: "parseIPAddress - throws on invalid address",
  fn() {
    assertThrows(
      () => parseIPAddress("not.an.ip.address"),
      Error
    );
  },
});

// ============================================================================
// isValidIPAddress Tests
// ============================================================================

Deno.test({
  name: "isValidIPAddress - returns true for valid IPv4",
  fn() {
    assert(isValidIPAddress("192.168.1.1"));
    assert(isValidIPAddress("0.0.0.0"));
    assert(isValidIPAddress("255.255.255.255"));
    assert(isValidIPAddress("8.8.8.8"));
  },
});

Deno.test({
  name: "isValidIPAddress - returns true for valid IPv6",
  fn() {
    assert(isValidIPAddress("::1"));
    assert(isValidIPAddress("::"));
    assert(isValidIPAddress("2001:db8::1"));
    assert(isValidIPAddress("fe80::1"));
  },
});

Deno.test({
  name: "isValidIPAddress - returns false for invalid addresses",
  fn() {
    assert(!isValidIPAddress(""));
    assert(!isValidIPAddress("not.an.address"));
    assert(!isValidIPAddress("192.168.1.256"));
    assert(!isValidIPAddress("192.168.1"));
    assert(!isValidIPAddress("random text"));
  },
});

// ============================================================================
// Edge Cases
// ============================================================================

Deno.test({
  name: "IPv4Address - handles common special addresses",
  fn() {
    // Broadcast
    const broadcast = new IPv4Address("255.255.255.255");
    assertEquals(broadcast.toString(), "255.255.255.255");

    // Localhost
    const localhost = new IPv4Address("127.0.0.1");
    assert(localhost.isLoopback());

    // Any address
    const any = new IPv4Address("0.0.0.0");
    assertEquals(any.toInteger(), 0);
  },
});

Deno.test({
  name: "IPv6Address - handles special addresses",
  fn() {
    // Documentation prefix
    const doc = new IPv6Address("2001:db8::1");
    assertExists(doc);

    // All zeros
    const zeros = new IPv6Address("::");
    assertExists(zeros);

    // All ones
    const ones = new IPv6Address("ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff");
    assertExists(ones);
  },
});

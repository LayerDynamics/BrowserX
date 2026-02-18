/**
 * CacheKey Tests
 * Comprehensive tests for CacheKey
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { CacheKey } from "../../../../core/cache/kv/key.ts";

// ============================================================================
// CacheKey.generate() Tests
// ============================================================================

Deno.test({
  name: "CacheKey.generate - basic method and URL",
  fn() {
    const key = CacheKey.generate("GET", "http://example.com/");
    assertEquals(key, "GET:http://example.com/");
  },
});

Deno.test({
  name: "CacheKey.generate - uppercases method",
  fn() {
    const key = CacheKey.generate("get", "http://example.com/page");
    assertEquals(key, "GET:http://example.com/page");
  },
});

Deno.test({
  name: "CacheKey.generate - POST method",
  fn() {
    const key = CacheKey.generate("POST", "http://api.example.com/submit");
    assertEquals(key, "POST:http://api.example.com/submit");
  },
});

Deno.test({
  name: "CacheKey.generate - with single vary header",
  fn() {
    const key = CacheKey.generate("GET", "http://example.com/", {
      "accept": "text/html",
    });
    assertEquals(key, "GET:http://example.com/:accept=text/html");
  },
});

Deno.test({
  name: "CacheKey.generate - vary headers sorted alphabetically",
  fn() {
    const key = CacheKey.generate("GET", "http://example.com/", {
      "content-type": "application/json",
      "accept": "text/html",
      "accept-language": "en-US",
    });
    assertEquals(
      key,
      "GET:http://example.com/:accept=text/html:accept-language=en-US:content-type=application/json",
    );
  },
});

Deno.test({
  name: "CacheKey.generate - empty vary headers object treated as no vary",
  fn() {
    const key = CacheKey.generate("GET", "http://example.com/", {});
    assertEquals(key, "GET:http://example.com/");
  },
});

Deno.test({
  name: "CacheKey.generate - undefined vary headers treated as no vary",
  fn() {
    const key = CacheKey.generate("GET", "http://example.com/");
    assertEquals(key, "GET:http://example.com/");
  },
});

Deno.test({
  name: "CacheKey.generate - different URLs produce different keys",
  fn() {
    const key1 = CacheKey.generate("GET", "http://example.com/page1");
    const key2 = CacheKey.generate("GET", "http://example.com/page2");
    assert(key1 !== key2);
  },
});

Deno.test({
  name: "CacheKey.generate - same inputs produce same key",
  fn() {
    const key1 = CacheKey.generate("GET", "http://example.com/resource");
    const key2 = CacheKey.generate("GET", "http://example.com/resource");
    assertEquals(key1, key2);
  },
});

// ============================================================================
// CacheKey.generateHash() Tests
// ============================================================================

Deno.test({
  name: "CacheKey.generateHash - returns 64-character hex string",
  async fn() {
    const hash = await CacheKey.generateHash("GET", "http://example.com/");
    assertExists(hash);
    assertEquals(hash.length, 64);
    assert(/^[0-9a-f]+$/.test(hash), "Hash should be lowercase hex");
  },
});

Deno.test({
  name: "CacheKey.generateHash - deterministic for same inputs",
  async fn() {
    const hash1 = await CacheKey.generateHash("GET", "http://example.com/");
    const hash2 = await CacheKey.generateHash("GET", "http://example.com/");
    assertEquals(hash1, hash2);
  },
});

Deno.test({
  name: "CacheKey.generateHash - different inputs produce different hashes",
  async fn() {
    const hash1 = await CacheKey.generateHash("GET", "http://example.com/page1");
    const hash2 = await CacheKey.generateHash("GET", "http://example.com/page2");
    assert(hash1 !== hash2);
  },
});

Deno.test({
  name: "CacheKey.generateHash - vary headers change hash",
  async fn() {
    const hash1 = await CacheKey.generateHash("GET", "http://example.com/");
    const hash2 = await CacheKey.generateHash("GET", "http://example.com/", {
      "accept": "text/html",
    });
    assert(hash1 !== hash2);
  },
});

Deno.test({
  name: "CacheKey.generateHash - method change changes hash",
  async fn() {
    const hash1 = await CacheKey.generateHash("GET", "http://example.com/");
    const hash2 = await CacheKey.generateHash("POST", "http://example.com/");
    assert(hash1 !== hash2);
  },
});

// ============================================================================
// CacheKey.parse() Tests
// ============================================================================

Deno.test({
  name: "CacheKey.parse - parses method and URL from basic key",
  fn() {
    const parsed = CacheKey.parse("GET:http://example.com/");
    assertEquals(parsed.method, "GET");
    assertEquals(parsed.url, "http://example.com/");
    assertEquals(parsed.varyHeaders, {});
  },
});

Deno.test({
  name: "CacheKey.parse - round-trip with generate (no vary headers)",
  fn() {
    const key = CacheKey.generate("PUT", "http://api.example.com/resource");
    const parsed = CacheKey.parse(key);
    assertEquals(parsed.method, "PUT");
    assertEquals(parsed.url, "http://api.example.com/resource");
    assertEquals(parsed.varyHeaders, {});
  },
});

Deno.test({
  name: "CacheKey.parse - round-trip with generate (with vary headers)",
  fn() {
    const key = CacheKey.generate("GET", "http://example.com/", {
      "accept": "text/html",
    });
    const parsed = CacheKey.parse(key);
    assertEquals(parsed.method, "GET");
    assertEquals(parsed.url, "http://example.com/");
    assertEquals(parsed.varyHeaders["accept"], "text/html");
  },
});

Deno.test({
  name: "CacheKey.parse - returns empty varyHeaders for key without vary",
  fn() {
    const parsed = CacheKey.parse("GET:http://example.com/home");
    assertEquals(Object.keys(parsed.varyHeaders).length, 0);
  },
});

// ============================================================================
// CacheKey.matches() Tests
// ============================================================================

Deno.test({
  name: "CacheKey.matches - string pattern matches when URL includes it",
  fn() {
    const key = CacheKey.generate("GET", "http://example.com/api/users");
    assert(CacheKey.matches(key, "api/users"));
  },
});

Deno.test({
  name: "CacheKey.matches - string pattern does not match unrelated URL",
  fn() {
    const key = CacheKey.generate("GET", "http://example.com/home");
    assert(!CacheKey.matches(key, "api/users"));
  },
});

Deno.test({
  name: "CacheKey.matches - RegExp pattern matches URL",
  fn() {
    const key = CacheKey.generate("GET", "http://example.com/api/users/42");
    assert(CacheKey.matches(key, /\/api\/users\/\d+/));
  },
});

Deno.test({
  name: "CacheKey.matches - RegExp pattern does not match unrelated URL",
  fn() {
    const key = CacheKey.generate("GET", "http://example.com/home");
    assert(!CacheKey.matches(key, /\/api\/users\/\d+/));
  },
});

Deno.test({
  name: "CacheKey.matches - string pattern matching full domain",
  fn() {
    const key = CacheKey.generate("GET", "http://example.com/page");
    assert(CacheKey.matches(key, "example.com"));
  },
});

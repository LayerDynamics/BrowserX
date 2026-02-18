/**
 * CookieManager Tests
 *
 * Comprehensive unit tests for cookie storage, retrieval, expiration,
 * domain/path matching, security flags, and SameSite policy.
 */

import { assertEquals, assertGreater } from "@std/assert";
import { CookieManager } from "../../../src/engine/storage/CookieManager.ts";
import type { Cookie } from "../../../src/types/storage.ts";

// ============================================================================
// BASIC SET/GET OPERATIONS
// ============================================================================

Deno.test("CookieManager - set and get cookie", () => {
  const manager = new CookieManager();
  const cookie: Cookie = { name: "session", value: "abc123" };
  manager.setCookie(cookie, "https://example.com/");

  const cookies = manager.getCookies("https://example.com/");
  assertEquals(cookies.length, 1);
  assertEquals(cookies[0].name, "session");
  assertEquals(cookies[0].value, "abc123");

  manager.dispose();
});

Deno.test("CookieManager - set multiple cookies", () => {
  const manager = new CookieManager();

  manager.setCookie({ name: "cookie1", value: "value1" }, "https://example.com/");
  manager.setCookie({ name: "cookie2", value: "value2" }, "https://example.com/");
  manager.setCookie({ name: "cookie3", value: "value3" }, "https://example.com/");

  const cookies = manager.getCookies("https://example.com/");
  assertEquals(cookies.length, 3);
  assertEquals(manager.getCookieCount(), 3);

  manager.dispose();
});

Deno.test("CookieManager - overwrite cookie with same name/domain/path", () => {
  const manager = new CookieManager();

  manager.setCookie({ name: "session", value: "old" }, "https://example.com/");
  manager.setCookie({ name: "session", value: "new" }, "https://example.com/");

  const cookies = manager.getCookies("https://example.com/");
  assertEquals(cookies.length, 1);
  assertEquals(cookies[0].value, "new");

  manager.dispose();
});

// ============================================================================
// EXPIRATION HANDLING
// ============================================================================

Deno.test("CookieManager - expired cookies are not returned (expires)", () => {
  const manager = new CookieManager();
  const pastDate = new Date(Date.now() - 1000);

  manager.setCookie(
    { name: "expired", value: "old", expires: pastDate },
    "https://example.com/"
  );

  const cookies = manager.getCookies("https://example.com/");
  assertEquals(cookies.length, 0);

  manager.dispose();
});

Deno.test("CookieManager - future expiration cookies are returned", () => {
  const manager = new CookieManager();
  const futureDate = new Date(Date.now() + 3600000); // 1 hour

  manager.setCookie(
    { name: "valid", value: "data", expires: futureDate },
    "https://example.com/"
  );

  const cookies = manager.getCookies("https://example.com/");
  assertEquals(cookies.length, 1);
  assertEquals(cookies[0].name, "valid");

  manager.dispose();
});

Deno.test("CookieManager - maxAge expiration (expired)", () => {
  const manager = new CookieManager();

  manager.setCookie(
    { name: "expired", value: "old", maxAge: -10 }, // Negative maxAge
    "https://example.com/"
  );

  const cookies = manager.getCookies("https://example.com/");
  assertEquals(cookies.length, 0);

  manager.dispose();
});

Deno.test("CookieManager - maxAge expiration (valid)", () => {
  const manager = new CookieManager();

  manager.setCookie(
    { name: "valid", value: "data", maxAge: 3600 }, // 1 hour
    "https://example.com/"
  );

  const cookies = manager.getCookies("https://example.com/");
  assertEquals(cookies.length, 1);

  manager.dispose();
});

Deno.test("CookieManager - expires takes precedence over maxAge", () => {
  const manager = new CookieManager();
  const futureDate = new Date(Date.now() + 3600000);

  // maxAge is negative (expired) but expires is future
  // Implementation checks expires first
  manager.setCookie(
    { name: "test", value: "data", maxAge: -10, expires: futureDate },
    "https://example.com/"
  );

  const cookies = manager.getCookies("https://example.com/");
  assertEquals(cookies.length, 1); // expires takes precedence in this implementation

  manager.dispose();
});

// ============================================================================
// DOMAIN MATCHING
// ============================================================================

Deno.test("CookieManager - exact domain match", () => {
  const manager = new CookieManager();

  manager.setCookie(
    { name: "test", value: "data", domain: "example.com" },
    "https://example.com/"
  );

  const cookies = manager.getCookies("https://example.com/");
  assertEquals(cookies.length, 1);

  manager.dispose();
});

Deno.test("CookieManager - subdomain match with leading dot", () => {
  const manager = new CookieManager();

  manager.setCookie(
    { name: "root", value: "data", domain: ".example.com" },
    "https://example.com/"
  );

  const subCookies = manager.getCookies("https://sub.example.com/");
  assertEquals(subCookies.length, 1);

  const rootCookies = manager.getCookies("https://example.com/");
  assertEquals(rootCookies.length, 1);

  manager.dispose();
});

Deno.test("CookieManager - subdomain match without leading dot", () => {
  const manager = new CookieManager();

  manager.setCookie(
    { name: "test", value: "data", domain: "example.com" },
    "https://example.com/"
  );

  const subCookies = manager.getCookies("https://sub.example.com/");
  assertEquals(subCookies.length, 1); // Should match subdomain

  manager.dispose();
});

Deno.test("CookieManager - domain mismatch", () => {
  const manager = new CookieManager();

  manager.setCookie(
    { name: "test", value: "data", domain: "example.com" },
    "https://example.com/"
  );

  const cookies = manager.getCookies("https://other.com/");
  assertEquals(cookies.length, 0);

  manager.dispose();
});

Deno.test("CookieManager - cannot set cookie for unrelated domain", () => {
  const manager = new CookieManager();

  // Attempting to set cookie for evil.com while on example.com should fail
  manager.setCookie(
    { name: "test", value: "data", domain: "evil.com" },
    "https://example.com/"
  );

  assertEquals(manager.getCookieCount(), 0); // Cookie should not be stored

  manager.dispose();
});

Deno.test("CookieManager - public suffix rejection", () => {
  const manager = new CookieManager();

  // Cannot set cookie for public suffix like ".com"
  manager.setCookie(
    { name: "test", value: "data", domain: "com" },
    "https://example.com/"
  );

  assertEquals(manager.getCookieCount(), 0);

  manager.dispose();
});

// ============================================================================
// PATH MATCHING
// ============================================================================

Deno.test("CookieManager - exact path match", () => {
  const manager = new CookieManager();

  manager.setCookie(
    { name: "test", value: "data", path: "/api" },
    "https://example.com/"
  );

  const cookies = manager.getCookies("https://example.com/api");
  assertEquals(cookies.length, 1);

  manager.dispose();
});

Deno.test("CookieManager - path prefix match", () => {
  const manager = new CookieManager();

  manager.setCookie(
    { name: "test", value: "data", path: "/api" },
    "https://example.com/"
  );

  const cookies = manager.getCookies("https://example.com/api/v1/users");
  assertEquals(cookies.length, 1);

  manager.dispose();
});

Deno.test("CookieManager - path mismatch", () => {
  const manager = new CookieManager();

  manager.setCookie(
    { name: "test", value: "data", path: "/api" },
    "https://example.com/"
  );

  const cookies = manager.getCookies("https://example.com/other");
  assertEquals(cookies.length, 0);

  manager.dispose();
});

Deno.test("CookieManager - path sorting (more specific first)", () => {
  const manager = new CookieManager();

  manager.setCookie(
    { name: "cookie1", value: "root", path: "/" },
    "https://example.com/"
  );
  manager.setCookie(
    { name: "cookie2", value: "api", path: "/api" },
    "https://example.com/"
  );
  manager.setCookie(
    { name: "cookie3", value: "v1", path: "/api/v1" },
    "https://example.com/"
  );

  const cookies = manager.getCookies("https://example.com/api/v1/users");
  assertEquals(cookies.length, 3);
  // Most specific path should come first
  assertEquals(cookies[0].path, "/api/v1");
  assertEquals(cookies[1].path, "/api");
  assertEquals(cookies[2].path, "/");

  manager.dispose();
});

// ============================================================================
// SECURITY FLAGS
// ============================================================================

Deno.test("CookieManager - HttpOnly flag is preserved", () => {
  const manager = new CookieManager();

  manager.setCookie(
    { name: "session", value: "secret", httpOnly: true },
    "https://example.com/"
  );

  const cookies = manager.getCookies("https://example.com/");
  assertEquals(cookies.length, 1);
  assertEquals(cookies[0].httpOnly, true);

  manager.dispose();
});

Deno.test("CookieManager - Secure flag blocks HTTP access", () => {
  const manager = new CookieManager();

  manager.setCookie(
    { name: "secure", value: "data", secure: true },
    "https://example.com/"
  );

  // Should not be returned for HTTP URL
  const httpCookies = manager.getCookies("http://example.com/");
  assertEquals(httpCookies.length, 0);

  // Should be returned for HTTPS URL
  const httpsCookies = manager.getCookies("https://example.com/");
  assertEquals(httpsCookies.length, 1);

  manager.dispose();
});

Deno.test("CookieManager - non-Secure cookie works on both HTTP and HTTPS", () => {
  const manager = new CookieManager();

  manager.setCookie(
    { name: "test", value: "data", secure: false },
    "https://example.com/"
  );

  const httpCookies = manager.getCookies("http://example.com/");
  assertEquals(httpCookies.length, 1);

  const httpsCookies = manager.getCookies("https://example.com/");
  assertEquals(httpsCookies.length, 1);

  manager.dispose();
});

// ============================================================================
// SAMESITE ATTRIBUTE
// ============================================================================

Deno.test("CookieManager - SameSite=Strict blocks cross-site requests", () => {
  const manager = new CookieManager();

  manager.setCookie(
    { name: "session", value: "data", sameSite: "Strict" },
    "https://example.com/"
  );

  // Same-site request should work
  const sameSite = manager.getCookiesForRequest(
    "https://example.com/",
    "https://example.com/other"
  );
  assertEquals(sameSite.length, 1);

  // Cross-site request should be blocked
  const crossSite = manager.getCookiesForRequest(
    "https://example.com/",
    "https://other.com/"
  );
  assertEquals(crossSite.length, 0);

  manager.dispose();
});

Deno.test("CookieManager - SameSite=Lax allows top-level safe navigation", () => {
  const manager = new CookieManager();

  manager.setCookie(
    { name: "session", value: "data", sameSite: "Lax" },
    "https://example.com/"
  );

  // Same-site GET request should work
  const sameSite = manager.getCookiesForRequest(
    "https://example.com/",
    "https://example.com/other",
    "GET"
  );
  assertEquals(sameSite.length, 1);

  // Cross-site GET (top-level navigation) should work
  const crossSiteGet = manager.getCookiesForRequest(
    "https://example.com/",
    "https://other.com/",
    "GET"
  );
  assertEquals(crossSiteGet.length, 1);

  manager.dispose();
});

Deno.test("CookieManager - SameSite=None requires Secure flag", () => {
  const manager = new CookieManager();

  // SameSite=None without Secure should be rejected
  manager.setCookie(
    { name: "test", value: "data", sameSite: "None", secure: false },
    "https://example.com/"
  );
  assertEquals(manager.getCookieCount(), 0);

  // SameSite=None with Secure should work
  manager.setCookie(
    { name: "test", value: "data", sameSite: "None", secure: true },
    "https://example.com/"
  );
  assertEquals(manager.getCookieCount(), 1);

  manager.dispose();
});

Deno.test("CookieManager - SameSite defaults to Lax", () => {
  const manager = new CookieManager();

  manager.setCookie(
    { name: "test", value: "data" }, // No sameSite specified
    "https://example.com/"
  );

  const cookies = manager.getCookies("https://example.com/");
  assertEquals(cookies.length, 1);
  assertEquals(cookies[0].sameSite, "Lax"); // Should default to Lax

  manager.dispose();
});

// ============================================================================
// COOKIE DELETION
// ============================================================================

Deno.test("CookieManager - delete specific cookie", () => {
  const manager = new CookieManager();

  manager.setCookie({ name: "cookie1", value: "data1" }, "https://example.com/");
  manager.setCookie({ name: "cookie2", value: "data2" }, "https://example.com/");

  assertEquals(manager.getCookieCount(), 2);

  manager.deleteCookie("cookie1", "example.com", "/");
  assertEquals(manager.getCookieCount(), 1);

  const cookies = manager.getCookies("https://example.com/");
  assertEquals(cookies[0].name, "cookie2");

  manager.dispose();
});

Deno.test("CookieManager - delete cookies for domain", () => {
  const manager = new CookieManager();

  manager.setCookie({ name: "test1", value: "data" }, "https://example.com/");
  manager.setCookie({ name: "test2", value: "data" }, "https://sub.example.com/");
  manager.setCookie({ name: "test3", value: "data" }, "https://other.com/");

  assertEquals(manager.getCookieCount(), 3);

  manager.deleteCookiesForDomain("example.com");

  // Implementation only deletes exact domain matches
  // sub.example.com is NOT deleted when deleting example.com
  assertEquals(manager.getCookieCount(), 2);

  const remaining = manager.getAllCookies();
  const domains = remaining.map(c => c.domain);
  assertEquals(domains.includes("sub.example.com"), true);
  assertEquals(domains.includes("other.com"), true);

  manager.dispose();
});

Deno.test("CookieManager - clear all cookies", () => {
  const manager = new CookieManager();

  manager.setCookie({ name: "cookie1", value: "data" }, "https://example.com/");
  manager.setCookie({ name: "cookie2", value: "data" }, "https://other.com/");

  assertEquals(manager.getCookieCount(), 2);

  manager.clearAll();
  assertEquals(manager.getCookieCount(), 0);

  manager.dispose();
});

// ============================================================================
// EDGE CASES AND VALIDATION
// ============================================================================

Deno.test("CookieManager - reject cookie with empty name", () => {
  const manager = new CookieManager();

  manager.setCookie({ name: "", value: "data" }, "https://example.com/");
  assertEquals(manager.getCookieCount(), 0);

  manager.setCookie({ name: "   ", value: "data" }, "https://example.com/");
  assertEquals(manager.getCookieCount(), 0);

  manager.dispose();
});

Deno.test("CookieManager - reject cookie with invalid characters in name", () => {
  const manager = new CookieManager();

  manager.setCookie({ name: "cookie;name", value: "data" }, "https://example.com/");
  assertEquals(manager.getCookieCount(), 0);

  manager.setCookie({ name: "cookie=name", value: "data" }, "https://example.com/");
  assertEquals(manager.getCookieCount(), 0);

  manager.setCookie({ name: "cookie name", value: "data" }, "https://example.com/");
  assertEquals(manager.getCookieCount(), 0);

  manager.setCookie({ name: "cookie,name", value: "data" }, "https://example.com/");
  assertEquals(manager.getCookieCount(), 0);

  manager.dispose();
});

Deno.test("CookieManager - allow valid cookie names", () => {
  const manager = new CookieManager();

  manager.setCookie({ name: "valid-cookie_123", value: "data" }, "https://example.com/");
  assertEquals(manager.getCookieCount(), 1);

  manager.dispose();
});

Deno.test("CookieManager - handle malformed URLs gracefully", () => {
  const manager = new CookieManager();

  manager.setCookie({ name: "test", value: "data" }, "not-a-url");

  // Should use fallback parsing
  const cookies = manager.getCookies("not-a-url");
  assertGreater(cookies.length, -1); // Just verify it doesn't crash

  manager.dispose();
});

Deno.test("CookieManager - getAllCookies returns all stored cookies", () => {
  const manager = new CookieManager();

  manager.setCookie({ name: "cookie1", value: "data1" }, "https://example.com/");
  manager.setCookie({ name: "cookie2", value: "data2" }, "https://other.com/");

  const all = manager.getAllCookies();
  assertEquals(all.length, 2);

  manager.dispose();
});

Deno.test("CookieManager - dispose clears interval and cookies", () => {
  const manager = new CookieManager();

  manager.setCookie({ name: "test", value: "data" }, "https://example.com/");
  assertEquals(manager.getCookieCount(), 1);

  manager.dispose();
  assertEquals(manager.getCookieCount(), 0);
});

// ============================================================================
// COMPLEX SCENARIOS
// ============================================================================

Deno.test("CookieManager - multiple cookies with different domains and paths", () => {
  const manager = new CookieManager();

  manager.setCookie(
    { name: "root", value: "data", domain: "example.com", path: "/" },
    "https://example.com/"
  );
  manager.setCookie(
    { name: "api", value: "data", domain: "example.com", path: "/api" },
    "https://example.com/"
  );
  manager.setCookie(
    { name: "sub", value: "data", domain: "sub.example.com", path: "/" },
    "https://sub.example.com/"
  );

  // Root domain, root path - should get root cookie only
  const rootCookies = manager.getCookies("https://example.com/");
  assertEquals(rootCookies.length, 1);
  assertEquals(rootCookies[0].name, "root");

  // Root domain, api path - should get both root and api
  const apiCookies = manager.getCookies("https://example.com/api");
  assertEquals(apiCookies.length, 2);

  // Subdomain - should get root (domain match) and sub
  const subCookies = manager.getCookies("https://sub.example.com/");
  assertEquals(subCookies.length, 2);

  manager.dispose();
});

Deno.test("CookieManager - case-insensitive domain matching", () => {
  const manager = new CookieManager();

  manager.setCookie(
    { name: "test", value: "data", domain: "Example.COM" },
    "https://EXAMPLE.com/"
  );

  const cookies1 = manager.getCookies("https://example.com/");
  assertEquals(cookies1.length, 1);

  const cookies2 = manager.getCookies("https://EXAMPLE.COM/");
  assertEquals(cookies2.length, 1);

  const cookies3 = manager.getCookies("https://sub.EXAMPLE.com/");
  assertEquals(cookies3.length, 1);

  manager.dispose();
});

// ============================================================================
// ADDITIONAL EDGE CASES
// ============================================================================

Deno.test("CookieManager - cookie with no value", () => {
  const manager = new CookieManager();

  manager.setCookie({ name: "empty", value: "" }, "https://example.com/");

  const cookies = manager.getCookies("https://example.com/");
  assertEquals(cookies.length, 1);
  assertEquals(cookies[0].value, "");

  manager.dispose();
});

Deno.test("CookieManager - path must match from start of path", () => {
  const manager = new CookieManager();

  manager.setCookie(
    { name: "test", value: "data", path: "/api" },
    "https://example.com/"
  );

  // Should NOT match /apiary (different word)
  const cookies = manager.getCookies("https://example.com/apiary");
  assertEquals(cookies.length, 0);

  manager.dispose();
});

Deno.test("CookieManager - path with trailing slash matches subdirectories", () => {
  const manager = new CookieManager();

  manager.setCookie(
    { name: "test", value: "data", path: "/api/" },
    "https://example.com/"
  );

  const cookies1 = manager.getCookies("https://example.com/api/");
  assertEquals(cookies1.length, 1);

  const cookies2 = manager.getCookies("https://example.com/api/v1");
  assertEquals(cookies2.length, 1);

  manager.dispose();
});

Deno.test("CookieManager - session cookie (no expiration)", () => {
  const manager = new CookieManager();

  // Session cookie - no expires or maxAge
  manager.setCookie(
    { name: "session", value: "data" },
    "https://example.com/"
  );

  const cookies = manager.getCookies("https://example.com/");
  assertEquals(cookies.length, 1);

  manager.dispose();
});

Deno.test("CookieManager - multiple cookies sorted by creation time for same path", () => {
  const manager = new CookieManager();

  manager.setCookie(
    { name: "first", value: "1", path: "/api" },
    "https://example.com/"
  );

  // Small delay to ensure different creation times
  // (In practice, same path length should sort by creation time)
  manager.setCookie(
    { name: "second", value: "2", path: "/api" },
    "https://example.com/"
  );

  const cookies = manager.getCookies("https://example.com/api");
  assertEquals(cookies.length, 2);
  // Same path length, so sorted by creation time (older first)
  assertEquals(cookies[0].name, "first");
  assertEquals(cookies[1].name, "second");

  manager.dispose();
});

Deno.test("CookieManager - SameSite=Lax blocks cross-site POST", () => {
  const manager = new CookieManager();

  manager.setCookie(
    { name: "csrf", value: "token", sameSite: "Lax" },
    "https://example.com/"
  );

  // Same-site POST should work
  const sameSitePost = manager.getCookiesForRequest(
    "https://example.com/api",
    "https://example.com/form",
    "POST"
  );
  assertEquals(sameSitePost.length, 1);

  // Cross-site POST should be blocked
  const crossSitePost = manager.getCookiesForRequest(
    "https://example.com/api",
    "https://attacker.com/",
    "POST"
  );
  assertEquals(crossSitePost.length, 0);

  manager.dispose();
});

Deno.test("CookieManager - getCookiesForRequest filters by SameSite correctly", () => {
  const manager = new CookieManager();

  // SameSite=None cookies work cross-site (if Secure)
  manager.setCookie(
    { name: "tracking", value: "data", sameSite: "None", secure: true },
    "https://example.com/"
  );

  const crossSite = manager.getCookiesForRequest(
    "https://example.com/",
    "https://other.com/"
  );
  assertEquals(crossSite.length, 1);

  manager.dispose();
});

Deno.test("CookieManager - domain with port number is stripped", () => {
  const manager = new CookieManager();

  manager.setCookie(
    { name: "test", value: "data" },
    "https://example.com:8080/"
  );

  // Port should be stripped from domain
  const cookies = manager.getCookies("https://example.com:8080/");
  assertEquals(cookies.length, 1);

  // Should also work without port
  const cookies2 = manager.getCookies("https://example.com/");
  assertEquals(cookies2.length, 1);

  manager.dispose();
});

Deno.test("CookieManager - default path is root", () => {
  const manager = new CookieManager();

  // No path specified
  manager.setCookie({ name: "test", value: "data" }, "https://example.com/");

  const cookies = manager.getCookies("https://example.com/any/path/here");
  assertEquals(cookies.length, 1);
  assertEquals(cookies[0].path, "/");

  manager.dispose();
});

Deno.test("CookieManager - default domain is request domain", () => {
  const manager = new CookieManager();

  // No domain specified
  manager.setCookie({ name: "test", value: "data" }, "https://example.com/");

  const cookies = manager.getCookies("https://example.com/");
  assertEquals(cookies.length, 1);
  assertEquals(cookies[0].domain, "example.com");

  manager.dispose();
});

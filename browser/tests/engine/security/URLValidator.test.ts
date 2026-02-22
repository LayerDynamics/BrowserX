import { assertEquals, assertThrows } from "@std/assert";
import { SSRFError, URLValidator } from "../../../src/engine/security/URLValidator.ts";

Deno.test("URLValidator — blocks 10.x.x.x (private class A)", () => {
  assertThrows(() => URLValidator.validate("http://10.0.0.1/secret"), SSRFError);
  assertThrows(() => URLValidator.validate("http://10.255.255.255"), SSRFError);
});

Deno.test("URLValidator — blocks 172.16-31.x.x (private class B)", () => {
  assertThrows(() => URLValidator.validate("http://172.16.0.1"), SSRFError);
  assertThrows(() => URLValidator.validate("http://172.31.255.255"), SSRFError);
});

Deno.test("URLValidator — allows 172.15.x.x (not private)", () => {
  // Should NOT throw — 172.15 is public
  URLValidator.validate("http://172.15.0.1");
});

Deno.test("URLValidator — allows 172.32.x.x (not private)", () => {
  URLValidator.validate("http://172.32.0.1");
});

Deno.test("URLValidator — blocks 192.168.x.x", () => {
  assertThrows(() => URLValidator.validate("http://192.168.1.1"), SSRFError);
  assertThrows(() => URLValidator.validate("http://192.168.0.100/admin"), SSRFError);
});

Deno.test("URLValidator — blocks 127.x.x.x (loopback)", () => {
  assertThrows(() => URLValidator.validate("http://127.0.0.1"), SSRFError);
  assertThrows(() => URLValidator.validate("http://127.1.2.3:8080/path"), SSRFError);
});

Deno.test("URLValidator — blocks localhost", () => {
  assertThrows(() => URLValidator.validate("http://localhost"), SSRFError);
  assertThrows(() => URLValidator.validate("http://localhost:3000/api"), SSRFError);
});

Deno.test("URLValidator — blocks 0.0.0.0", () => {
  assertThrows(() => URLValidator.validate("http://0.0.0.0"), SSRFError);
});

Deno.test("URLValidator — blocks 169.254.x.x (link-local / metadata)", () => {
  assertThrows(() => URLValidator.validate("http://169.254.169.254/latest/meta-data/"), SSRFError);
  assertThrows(() => URLValidator.validate("http://169.254.0.1"), SSRFError);
});

Deno.test("URLValidator — blocks IPv6 loopback ::1", () => {
  assertThrows(() => URLValidator.validate("http://[::1]"), SSRFError);
});

Deno.test("URLValidator — blocks IPv6 fe80:: link-local", () => {
  assertThrows(() => URLValidator.validate("http://[fe80::1]"), SSRFError);
});

Deno.test("URLValidator — blocks file:// protocol", () => {
  assertThrows(() => URLValidator.validate("file:///etc/passwd"), SSRFError);
});

Deno.test("URLValidator — blocks ftp:// protocol", () => {
  assertThrows(() => URLValidator.validate("ftp://evil.com/file"), SSRFError);
});

Deno.test("URLValidator — allows data:image/*", () => {
  URLValidator.validate("data:image/png;base64,iVBOR...");
  URLValidator.validate("data:image/svg+xml,<svg></svg>");
});

Deno.test("URLValidator — blocks non-image data: URIs", () => {
  assertThrows(() => URLValidator.validate("data:text/html,<script>alert(1)</script>"), SSRFError);
  assertThrows(() => URLValidator.validate("data:application/json,{}"), SSRFError);
});

Deno.test("URLValidator — allows public HTTP/HTTPS URLs", () => {
  URLValidator.validate("https://example.com");
  URLValidator.validate("http://api.github.com/repos");
  URLValidator.validate("https://1.1.1.1/dns-query");
});

Deno.test("URLValidator — throws on invalid URLs", () => {
  assertThrows(() => URLValidator.validate("not-a-url"), SSRFError);
  assertThrows(() => URLValidator.validate(""), SSRFError);
});

Deno.test("URLValidator — allowlist bypasses validation", () => {
  const v = new URLValidator({ allowlist: ["127.0.0.1", "localhost"] });
  // These would normally be blocked
  v.validateUrl("http://127.0.0.1:8080/test");
  v.validateUrl("http://localhost:3000/api");
});

Deno.test("URLValidator — allowlist does not bypass for unlisted hosts", () => {
  const v = new URLValidator({ allowlist: ["127.0.0.1"] });
  assertThrows(() => v.validateUrl("http://10.0.0.1/secret"), SSRFError);
});

Deno.test("URLValidator — SSRFError has correct name", () => {
  const err = new SSRFError("test");
  assertEquals(err.name, "SSRFError");
  assertEquals(err.message, "test");
  assertEquals(err instanceof Error, true);
});

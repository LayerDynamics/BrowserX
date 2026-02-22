import { assertEquals } from "https://deno.land/std@0.208.0/assert/assert_equals.ts";
import { assert } from "https://deno.land/std@0.208.0/assert/assert.ts";
import {
  ContentSecurityPolicy,
  CSPViolation,
} from "../../../src/engine/security/ContentSecurityPolicy.ts";

Deno.test("CSP: parse default-src 'self' header", () => {
  const csp = new ContentSecurityPolicy("default-src 'self'");
  const directives = csp.getDirectives();
  assertEquals(directives.get("default-src"), ["'self'"]);
});

Deno.test("CSP: allows() returns true for same-origin with 'self'", () => {
  const csp = new ContentSecurityPolicy("default-src 'self'");
  assert(csp.allows("script-src", "https://example.com/app.js", "https://example.com"));
});

Deno.test("CSP: allows() returns false for cross-origin with 'self'", () => {
  const csp = new ContentSecurityPolicy("default-src 'self'");
  assertEquals(csp.allows("script-src", "https://evil.com/app.js", "https://example.com"), false);
});

Deno.test("CSP: allows() falls back to default-src when specific directive missing", () => {
  const csp = new ContentSecurityPolicy("default-src 'self'");
  assert(csp.allows("img-src", "https://example.com/img.png", "https://example.com"));
  assertEquals(csp.allows("img-src", "https://other.com/img.png", "https://example.com"), false);
});

Deno.test("CSP: allows() with 'none' blocks everything", () => {
  const csp = new ContentSecurityPolicy("script-src 'none'");
  assertEquals(
    csp.allows("script-src", "https://example.com/app.js", "https://example.com"),
    false,
  );
});

Deno.test("CSP: allows() with * allows everything", () => {
  const csp = new ContentSecurityPolicy("script-src *");
  assert(csp.allows("script-src", "https://anything.com/app.js", "https://example.com"));
});

Deno.test("CSP: allows() with host-source exact match", () => {
  const csp = new ContentSecurityPolicy("script-src cdn.example.com");
  assert(csp.allows("script-src", "https://cdn.example.com/app.js", "https://example.com"));
  assertEquals(csp.allows("script-src", "https://other.com/app.js", "https://example.com"), false);
});

Deno.test("CSP: allows() with wildcard subdomain *.example.com", () => {
  const csp = new ContentSecurityPolicy("img-src *.example.com");
  assert(csp.allows("img-src", "https://cdn.example.com/img.png", "https://other.com"));
  assert(csp.allows("img-src", "https://a.b.example.com/img.png", "https://other.com"));
  assertEquals(csp.allows("img-src", "https://evil.com/img.png", "https://other.com"), false);
});

Deno.test("CSP: allows() with scheme-source 'https:'", () => {
  const csp = new ContentSecurityPolicy("img-src https:");
  assert(csp.allows("img-src", "https://any.com/img.png", "https://example.com"));
  assertEquals(csp.allows("img-src", "http://any.com/img.png", "https://example.com"), false);
});

Deno.test("CSP: allowsInlineScript() blocks without unsafe-inline", () => {
  const csp = new ContentSecurityPolicy("script-src 'self'");
  assertEquals(csp.allowsInlineScript(), false);
});

Deno.test("CSP: allowsInlineScript() allows with unsafe-inline", () => {
  const csp = new ContentSecurityPolicy("script-src 'unsafe-inline'");
  assert(csp.allowsInlineScript());
});

Deno.test("CSP: allowsInlineScript() allows with matching nonce", () => {
  const csp = new ContentSecurityPolicy("script-src 'nonce-abc123'");
  assert(csp.allowsInlineScript("abc123"));
  assertEquals(csp.allowsInlineScript("wrong"), false);
});

Deno.test("CSP: allowsInlineScript() allows with matching hash", () => {
  const csp = new ContentSecurityPolicy("script-src 'sha256-abc123'");
  assert(csp.allowsInlineScript(undefined, "abc123"));
  assertEquals(csp.allowsInlineScript(undefined, "wrong"), false);
});

Deno.test("CSP: allowsEval() blocks without unsafe-eval", () => {
  const csp = new ContentSecurityPolicy("script-src 'self'");
  assertEquals(csp.allowsEval(), false);
});

Deno.test("CSP: allowsEval() allows with unsafe-eval", () => {
  const csp = new ContentSecurityPolicy("script-src 'unsafe-eval'");
  assert(csp.allowsEval());
});

Deno.test("CSP: allowsInlineStyle() blocks without unsafe-inline", () => {
  const csp = new ContentSecurityPolicy("style-src 'self'");
  assertEquals(csp.allowsInlineStyle(), false);
});

Deno.test("CSP: allowsInlineStyle() allows with unsafe-inline", () => {
  const csp = new ContentSecurityPolicy("style-src 'unsafe-inline'");
  assert(csp.allowsInlineStyle());
});

Deno.test("CSP: allowsInlineStyle() allows with matching nonce", () => {
  const csp = new ContentSecurityPolicy("style-src 'nonce-xyz789'");
  assert(csp.allowsInlineStyle("xyz789"));
});

Deno.test("CSP: report-only mode allows but records violations", () => {
  const csp = new ContentSecurityPolicy("script-src 'self'", true);
  const result = csp.allows("script-src", "https://evil.com/app.js", "https://example.com");
  assert(result); // report-only allows
  assertEquals(csp.getViolations().length, 1);
  assert(csp.getViolations()[0].reportOnly);
});

Deno.test("CSP: getViolations() returns recorded violations", () => {
  const csp = new ContentSecurityPolicy("script-src 'none'");
  csp.allows("script-src", "https://evil.com/app.js", "https://example.com");
  csp.allowsInlineScript();
  const violations = csp.getViolations();
  assertEquals(violations.length, 2);
  assertEquals(violations[0].directive, "script-src");
  assertEquals(violations[0].blockedURI, "https://evil.com/app.js");
  assertEquals(violations[1].blockedURI, "inline");
});

Deno.test("CSP: clearViolations() empties violation list", () => {
  const csp = new ContentSecurityPolicy("script-src 'none'");
  csp.allows("script-src", "https://evil.com/app.js", "https://example.com");
  assertEquals(csp.getViolations().length, 1);
  csp.clearViolations();
  assertEquals(csp.getViolations().length, 0);
});

Deno.test("CSP: multiple directives parsed correctly", () => {
  const csp = new ContentSecurityPolicy(
    "default-src 'self'; script-src 'unsafe-inline'; img-src https: *.cdn.com; report-uri /csp-report",
  );
  const directives = csp.getDirectives();
  assertEquals(directives.get("default-src"), ["'self'"]);
  assertEquals(directives.get("script-src"), ["'unsafe-inline'"]);
  assertEquals(directives.get("img-src"), ["https:", "*.cdn.com"]);
  assertEquals(directives.get("report-uri"), ["/csp-report"]);
});

Deno.test("CSP: getReportUri() returns report-uri value", () => {
  const csp = new ContentSecurityPolicy("default-src 'self'; report-uri /csp-report");
  assertEquals(csp.getReportUri(), "/csp-report");
});

Deno.test("CSP: isReportOnly() returns correct value", () => {
  const enforcing = new ContentSecurityPolicy("default-src 'self'");
  const reportOnly = new ContentSecurityPolicy("default-src 'self'", true);
  assertEquals(enforcing.isReportOnly(), false);
  assertEquals(reportOnly.isReportOnly(), true);
});

Deno.test("CSP: no policy means allow all", () => {
  const csp = new ContentSecurityPolicy("");
  assert(csp.allows("script-src", "https://anything.com/app.js", "https://example.com"));
  assert(csp.allowsInlineScript());
  assert(csp.allowsEval());
  assert(csp.allowsInlineStyle());
});

Deno.test("CSP: CSPViolation constructor sets all fields", () => {
  const v = new CSPViolation("script-src", "https://evil.com", "blocked", true);
  assertEquals(v.directive, "script-src");
  assertEquals(v.blockedURI, "https://evil.com");
  assertEquals(v.message, "blocked");
  assertEquals(v.reportOnly, true);
});

Deno.test("CSP: allows() with full URL host-source match", () => {
  const csp = new ContentSecurityPolicy("script-src https://cdn.example.com");
  assert(csp.allows("script-src", "https://cdn.example.com/app.js", "https://example.com"));
  assertEquals(
    csp.allows("script-src", "http://cdn.example.com/app.js", "https://example.com"),
    false,
  );
});

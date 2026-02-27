/**
 * Public Suffix List Tests
 *
 * Tests the PSL trie-based matcher against known rules including
 * plain rules, wildcards, and exceptions.
 */

import { assertEquals } from "@std/assert";
import {
  isPublicSuffix,
  getRegistrableDomain,
} from "../../../src/engine/storage/public-suffix-list.ts";

// ============================================================================
// BASIC TLDs
// ============================================================================

Deno.test("PSL - basic TLDs are public suffixes", () => {
  assertEquals(isPublicSuffix("com"), true);
  assertEquals(isPublicSuffix("org"), true);
  assertEquals(isPublicSuffix("net"), true);
  assertEquals(isPublicSuffix("edu"), true);
  assertEquals(isPublicSuffix("gov"), true);
  assertEquals(isPublicSuffix("uk"), true);
  assertEquals(isPublicSuffix("de"), true);
  assertEquals(isPublicSuffix("jp"), true);
  assertEquals(isPublicSuffix("au"), true);
  assertEquals(isPublicSuffix("io"), true);
});

Deno.test("PSL - case insensitive", () => {
  assertEquals(isPublicSuffix("COM"), true);
  assertEquals(isPublicSuffix("Co.Uk"), true);
  assertEquals(isPublicSuffix("ORG"), true);
});

// ============================================================================
// SECOND-LEVEL PUBLIC SUFFIXES
// ============================================================================

Deno.test("PSL - second-level public suffixes", () => {
  assertEquals(isPublicSuffix("co.uk"), true);
  assertEquals(isPublicSuffix("co.jp"), true);
  assertEquals(isPublicSuffix("com.au"), true);
  assertEquals(isPublicSuffix("com.br"), true);
  assertEquals(isPublicSuffix("co.nz"), true);
  assertEquals(isPublicSuffix("co.za"), true);
  assertEquals(isPublicSuffix("co.kr"), true);
  assertEquals(isPublicSuffix("co.in"), true);
  assertEquals(isPublicSuffix("org.uk"), true);
  assertEquals(isPublicSuffix("ac.uk"), true);
  assertEquals(isPublicSuffix("ac.jp"), true);
  assertEquals(isPublicSuffix("or.jp"), true);
  assertEquals(isPublicSuffix("ne.jp"), true);
});

// ============================================================================
// NON-PUBLIC SUFFIXES (registrable domains)
// ============================================================================

Deno.test("PSL - registrable domains are NOT public suffixes", () => {
  assertEquals(isPublicSuffix("example.com"), false);
  assertEquals(isPublicSuffix("google.co.uk"), false);
  assertEquals(isPublicSuffix("amazon.com.au"), false);
  assertEquals(isPublicSuffix("test.org"), false);
  assertEquals(isPublicSuffix("foo.bar.com"), false);
});

// ============================================================================
// WILDCARD RULES
// ============================================================================

Deno.test("PSL - wildcard rules (*.ck)", () => {
  // *.ck means any X.ck is a public suffix
  assertEquals(isPublicSuffix("anything.ck"), true);
  assertEquals(isPublicSuffix("foo.ck"), true);
  assertEquals(isPublicSuffix("ck"), true); // ck itself is a public suffix
});

Deno.test("PSL - wildcard rules (*.er)", () => {
  assertEquals(isPublicSuffix("anything.er"), true);
  assertEquals(isPublicSuffix("gov.er"), true);
});

Deno.test("PSL - wildcard rules (*.np)", () => {
  assertEquals(isPublicSuffix("anything.np"), true);
  assertEquals(isPublicSuffix("com.np"), true);
});

Deno.test("PSL - wildcard: domain under wildcard is registrable", () => {
  // example.anything.ck should be a registrable domain, not a public suffix
  assertEquals(isPublicSuffix("example.foo.ck"), false);
});

// ============================================================================
// EXCEPTION RULES
// ============================================================================

Deno.test("PSL - exception rules (!www.ck)", () => {
  // *.ck makes any X.ck a public suffix
  // !www.ck is an exception: www.ck is NOT a public suffix
  assertEquals(isPublicSuffix("www.ck"), false);
  assertEquals(isPublicSuffix("other.ck"), true); // no exception for this
});

Deno.test("PSL - Japanese city exceptions", () => {
  // *.kawasaki.jp makes X.kawasaki.jp a public suffix
  // !city.kawasaki.jp is an exception
  assertEquals(isPublicSuffix("foo.kawasaki.jp"), true);
  assertEquals(isPublicSuffix("city.kawasaki.jp"), false);

  assertEquals(isPublicSuffix("foo.kobe.jp"), true);
  assertEquals(isPublicSuffix("city.kobe.jp"), false);
});

// ============================================================================
// getRegistrableDomain
// ============================================================================

Deno.test("PSL - getRegistrableDomain for simple TLDs", () => {
  assertEquals(getRegistrableDomain("example.com"), "example.com");
  assertEquals(getRegistrableDomain("www.example.com"), "example.com");
  assertEquals(getRegistrableDomain("sub.www.example.com"), "example.com");
});

Deno.test("PSL - getRegistrableDomain returns null for public suffixes", () => {
  assertEquals(getRegistrableDomain("com"), null);
  assertEquals(getRegistrableDomain("co.uk"), null);
  assertEquals(getRegistrableDomain("com.au"), null);
});

Deno.test("PSL - getRegistrableDomain for second-level TLDs", () => {
  assertEquals(getRegistrableDomain("example.co.uk"), "example.co.uk");
  assertEquals(getRegistrableDomain("www.example.co.uk"), "example.co.uk");
  assertEquals(getRegistrableDomain("test.com.au"), "test.com.au");
  assertEquals(getRegistrableDomain("www.test.com.au"), "test.com.au");
});

Deno.test("PSL - getRegistrableDomain with wildcards", () => {
  // *.ck means foo.ck is a PS, so example.foo.ck is the registrable domain
  assertEquals(getRegistrableDomain("example.foo.ck"), "example.foo.ck");
  assertEquals(getRegistrableDomain("foo.ck"), null); // foo.ck is a PS
});

Deno.test("PSL - getRegistrableDomain with exceptions", () => {
  // www.ck is NOT a PS (exception), so www.ck is itself a registrable domain
  assertEquals(getRegistrableDomain("www.ck"), "www.ck");
  assertEquals(getRegistrableDomain("sub.www.ck"), "www.ck");
});

Deno.test("PSL - getRegistrableDomain case insensitive", () => {
  assertEquals(getRegistrableDomain("WWW.Example.COM"), "example.com");
  assertEquals(getRegistrableDomain("Test.Co.UK"), "test.co.uk");
});

// ============================================================================
// EDGE CASES
// ============================================================================

Deno.test("PSL - empty/invalid input", () => {
  assertEquals(isPublicSuffix(""), false);
  assertEquals(isPublicSuffix(" "), false);
  assertEquals(getRegistrableDomain(""), null);
  assertEquals(getRegistrableDomain(" "), null);
});

Deno.test("PSL - leading dot stripped", () => {
  assertEquals(isPublicSuffix(".com"), true);
  assertEquals(getRegistrableDomain(".example.com"), "example.com");
});

Deno.test("PSL - Japanese prefecture domains", () => {
  // tokyo.jp is in the PSL
  assertEquals(isPublicSuffix("tokyo.jp"), true);
  assertEquals(isPublicSuffix("osaka.jp"), true);
  assertEquals(getRegistrableDomain("example.tokyo.jp"), "example.tokyo.jp");
});

Deno.test("PSL - multi-level Japanese municipality domains", () => {
  // city.aichi.jp is in the PSL (aisai.aichi.jp etc.)
  assertEquals(isPublicSuffix("aisai.aichi.jp"), true);
  assertEquals(getRegistrableDomain("www.aisai.aichi.jp"), "www.aisai.aichi.jp");
});

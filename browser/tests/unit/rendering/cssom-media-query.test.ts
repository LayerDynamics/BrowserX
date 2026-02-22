/**
 * Tests for CSSOM media query matching
 */

import { assertEquals } from "@std/assert";
import { CSSOM } from "../../../src/engine/rendering/css-parser/CSSOM.ts";

// ============================================================================
// Media Type Tests
// ============================================================================

Deno.test("matchesMediaQuery - screen returns true", () => {
  const cssom = new CSSOM();
  assertEquals(cssom.matchesMediaQuery("screen"), true);
});

Deno.test("matchesMediaQuery - print returns false", () => {
  const cssom = new CSSOM();
  assertEquals(cssom.matchesMediaQuery("print"), false);
});

Deno.test("matchesMediaQuery - speech returns false", () => {
  const cssom = new CSSOM();
  assertEquals(cssom.matchesMediaQuery("speech"), false);
});

Deno.test("matchesMediaQuery - all returns true", () => {
  const cssom = new CSSOM();
  assertEquals(cssom.matchesMediaQuery("all"), true);
});

Deno.test("matchesMediaQuery - empty string returns true", () => {
  const cssom = new CSSOM();
  assertEquals(cssom.matchesMediaQuery(""), true);
});

// ============================================================================
// Dimension Feature Tests (default viewport 1280x720)
// ============================================================================

Deno.test("matchesMediaQuery - min-width 1024px matches 1280 viewport", () => {
  const cssom = new CSSOM();
  assertEquals(cssom.matchesMediaQuery("(min-width: 1024px)"), true);
});

Deno.test("matchesMediaQuery - min-width 1400px does not match 1280 viewport", () => {
  const cssom = new CSSOM();
  assertEquals(cssom.matchesMediaQuery("(min-width: 1400px)"), false);
});

Deno.test("matchesMediaQuery - max-width 1400px matches 1280 viewport", () => {
  const cssom = new CSSOM();
  assertEquals(cssom.matchesMediaQuery("(max-width: 1400px)"), true);
});

Deno.test("matchesMediaQuery - max-width 1024px does not match 1280 viewport", () => {
  const cssom = new CSSOM();
  assertEquals(cssom.matchesMediaQuery("(max-width: 1024px)"), false);
});

Deno.test("matchesMediaQuery - min-width with em units (80em = 1280px)", () => {
  const cssom = new CSSOM();
  assertEquals(cssom.matchesMediaQuery("(min-width: 80em)"), true);
  assertEquals(cssom.matchesMediaQuery("(min-width: 81em)"), false);
});

Deno.test("matchesMediaQuery - min-width with rem units", () => {
  const cssom = new CSSOM();
  assertEquals(cssom.matchesMediaQuery("(min-width: 80rem)"), true);
  assertEquals(cssom.matchesMediaQuery("(min-width: 81rem)"), false);
});

// ============================================================================
// Orientation Tests
// ============================================================================

Deno.test("matchesMediaQuery - orientation landscape (1280 > 720)", () => {
  const cssom = new CSSOM();
  assertEquals(cssom.matchesMediaQuery("(orientation: landscape)"), true);
});

Deno.test("matchesMediaQuery - orientation portrait does not match landscape viewport", () => {
  const cssom = new CSSOM();
  assertEquals(cssom.matchesMediaQuery("(orientation: portrait)"), false);
});

Deno.test("matchesMediaQuery - orientation portrait matches portrait viewport", () => {
  const cssom = new CSSOM();
  cssom.setViewport(720, 1280);
  assertEquals(cssom.matchesMediaQuery("(orientation: portrait)"), true);
});

// ============================================================================
// Comma-Separated (OR) Tests
// ============================================================================

Deno.test("matchesMediaQuery - 'screen, print' returns true (screen matches)", () => {
  const cssom = new CSSOM();
  assertEquals(cssom.matchesMediaQuery("screen, print"), true);
});

Deno.test("matchesMediaQuery - 'print, speech' returns false (neither matches)", () => {
  const cssom = new CSSOM();
  assertEquals(cssom.matchesMediaQuery("print, speech"), false);
});

// ============================================================================
// Combined and Viewport Tests
// ============================================================================

Deno.test("matchesMediaQuery - screen and min-width combined", () => {
  const cssom = new CSSOM();
  assertEquals(cssom.matchesMediaQuery("screen and (min-width: 1024px)"), true);
  assertEquals(cssom.matchesMediaQuery("print and (min-width: 1024px)"), false);
});

Deno.test("setViewport changes dimension matching", () => {
  const cssom = new CSSOM();
  cssom.setViewport(800, 600);
  assertEquals(cssom.matchesMediaQuery("(min-width: 1024px)"), false);
  assertEquals(cssom.matchesMediaQuery("(max-width: 1024px)"), true);
});

Deno.test("matchesMediaQuery - unknown feature defaults to true", () => {
  const cssom = new CSSOM();
  assertEquals(cssom.matchesMediaQuery("(color)"), true);
  assertEquals(cssom.matchesMediaQuery("(hover: hover)"), true);
});

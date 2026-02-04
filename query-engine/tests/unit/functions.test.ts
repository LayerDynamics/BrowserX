/**
 * Functions Unit Tests
 * Tests for all built-in functions: string, math, aggregate, utility, and DOM functions
 */

import { assertEquals, assertExists, assert, assertThrows } from "@std/assert";

// Import string functions
import {
  UPPER,
  LOWER,
  TRIM,
  SUBSTRING,
  REPLACE,
  SPLIT,
  CONCAT,
  LENGTH,
  CONTAINS,
  STARTS_WITH,
  ENDS_WITH,
  STRING_FUNCTIONS,
} from "../../schema/functions/string-functions.ts";

// Import math functions
import {
  ABS,
  CEIL,
  FLOOR,
  ROUND,
  SQRT,
  POW,
  MIN,
  MAX,
  RANDOM,
  MATH_FUNCTIONS,
} from "../../schema/functions/math-functions.ts";

// Import aggregate functions
import {
  SUM,
  AVG,
  FIRST,
  LAST,
  AGGREGATE_FUNCTIONS,
} from "../../schema/functions/aggregate-functions.ts";

// Import utility functions
import {
  PARSE_JSON,
  TO_JSON,
  WAIT,
  NOW,
  UUID,
  UTILITY_FUNCTIONS,
} from "../../schema/functions/utility-functions.ts";

// Import DOM functions for signature tests
import {
  TEXT,
  HTML,
  ATTR,
  COUNT,
  EXISTS,
  DOM_FUNCTIONS,
} from "../../schema/functions/dom-functions.ts";

import { FunctionCategory } from "../../schema/types.ts";

// ============================================================================
// String Functions Tests
// ============================================================================

Deno.test({
  name: "STRING_FUNCTIONS - all functions exported",
  fn() {
    assertEquals(STRING_FUNCTIONS.length, 11);
    const names = STRING_FUNCTIONS.map((f) => f.signature.name);
    assert(names.includes("UPPER"));
    assert(names.includes("LOWER"));
    assert(names.includes("TRIM"));
    assert(names.includes("SUBSTRING"));
    assert(names.includes("REPLACE"));
    assert(names.includes("SPLIT"));
    assert(names.includes("CONCAT"));
    assert(names.includes("LENGTH"));
    assert(names.includes("CONTAINS"));
    assert(names.includes("STARTS_WITH"));
    assert(names.includes("ENDS_WITH"));
  },
});

Deno.test({
  name: "UPPER - converts string to uppercase",
  fn() {
    const impl = UPPER.implementation as (str: unknown) => string;
    assertEquals(impl("hello"), "HELLO");
    assertEquals(impl("Hello World"), "HELLO WORLD");
    assertEquals(impl("ALREADY UPPER"), "ALREADY UPPER");
    assertEquals(impl(""), "");
  },
});

Deno.test({
  name: "UPPER - handles non-string input",
  fn() {
    const impl = UPPER.implementation as (str: unknown) => string;
    assertEquals(impl(123), "123");
    assertEquals(impl(true), "TRUE");
    assertEquals(impl(null), "NULL");
  },
});

Deno.test({
  name: "UPPER - signature is correct",
  fn() {
    assertEquals(UPPER.signature.name, "UPPER");
    assertEquals(UPPER.signature.category, FunctionCategory.STRING);
    assertEquals(UPPER.signature.minArgs, 1);
    assertEquals(UPPER.signature.maxArgs, 1);
    assertEquals(UPPER.signature.returnType, "string");
    assertEquals(UPPER.signature.isAsync, false);
  },
});

Deno.test({
  name: "LOWER - converts string to lowercase",
  fn() {
    const impl = LOWER.implementation as (str: unknown) => string;
    assertEquals(impl("HELLO"), "hello");
    assertEquals(impl("Hello World"), "hello world");
    assertEquals(impl("already lower"), "already lower");
    assertEquals(impl(""), "");
  },
});

Deno.test({
  name: "TRIM - removes whitespace from both ends",
  fn() {
    const impl = TRIM.implementation as (str: unknown) => string;
    assertEquals(impl("  hello  "), "hello");
    assertEquals(impl("\t\ntrim me\t\n"), "trim me");
    assertEquals(impl("no spaces"), "no spaces");
    assertEquals(impl("   "), "");
  },
});

Deno.test({
  name: "SUBSTRING - extracts substring with start index",
  fn() {
    const impl = SUBSTRING.implementation as (
      str: unknown,
      start: unknown,
      length?: unknown,
    ) => string;
    assertEquals(impl("hello", 1), "ello");
    assertEquals(impl("hello", 0), "hello");
    assertEquals(impl("hello", 5), "");
  },
});

Deno.test({
  name: "SUBSTRING - extracts substring with start and length",
  fn() {
    const impl = SUBSTRING.implementation as (
      str: unknown,
      start: unknown,
      length?: unknown,
    ) => string;
    assertEquals(impl("hello", 1, 3), "ell");
    assertEquals(impl("hello", 0, 2), "he");
    assertEquals(impl("hello", 2, 10), "llo");
  },
});

Deno.test({
  name: "REPLACE - replaces all occurrences",
  fn() {
    const impl = REPLACE.implementation as (
      str: unknown,
      search: unknown,
      replacement: unknown,
    ) => string;
    assertEquals(impl("hello world", "world", "there"), "hello there");
    assertEquals(impl("aaa", "a", "b"), "bbb");
    assertEquals(impl("no match", "x", "y"), "no match");
    assertEquals(impl("", "a", "b"), "");
  },
});

Deno.test({
  name: "SPLIT - splits string by delimiter",
  fn() {
    const impl = SPLIT.implementation as (
      str: unknown,
      delimiter: unknown,
    ) => string[];
    assertEquals(impl("a,b,c", ","), ["a", "b", "c"]);
    assertEquals(impl("hello world", " "), ["hello", "world"]);
    assertEquals(impl("no delimiter", "x"), ["no delimiter"]);
    assertEquals(impl("", ","), [""]);
  },
});

Deno.test({
  name: "CONCAT - concatenates multiple strings",
  fn() {
    const impl = CONCAT.implementation as (...args: unknown[]) => string;
    assertEquals(impl("hello", " ", "world"), "hello world");
    assertEquals(impl("single"), "single");
    assertEquals(impl("a", "b", "c", "d"), "abcd");
    assertEquals(impl(1, 2, 3), "123");
  },
});

Deno.test({
  name: "CONCAT - signature allows variadic args",
  fn() {
    assertEquals(CONCAT.signature.minArgs, 1);
    assertEquals(CONCAT.signature.maxArgs, "variadic");
  },
});

Deno.test({
  name: "LENGTH - returns string length",
  fn() {
    const impl = LENGTH.implementation as (str: unknown) => number;
    assertEquals(impl("hello"), 5);
    assertEquals(impl(""), 0);
    assertEquals(impl("unicode: 日本語"), 12);
  },
});

Deno.test({
  name: "CONTAINS - checks substring presence",
  fn() {
    const impl = CONTAINS.implementation as (
      str: unknown,
      search: unknown,
    ) => boolean;
    assertEquals(impl("hello world", "world"), true);
    assertEquals(impl("hello world", "WORLD"), false);
    assertEquals(impl("hello", ""), true);
    assertEquals(impl("", "a"), false);
  },
});

Deno.test({
  name: "STARTS_WITH - checks prefix",
  fn() {
    const impl = STARTS_WITH.implementation as (
      str: unknown,
      prefix: unknown,
    ) => boolean;
    assertEquals(impl("hello", "hel"), true);
    assertEquals(impl("hello", "HEL"), false);
    assertEquals(impl("hello", ""), true);
    assertEquals(impl("hello", "hello world"), false);
  },
});

Deno.test({
  name: "ENDS_WITH - checks suffix",
  fn() {
    const impl = ENDS_WITH.implementation as (
      str: unknown,
      suffix: unknown,
    ) => boolean;
    assertEquals(impl("hello", "llo"), true);
    assertEquals(impl("hello", "LLO"), false);
    assertEquals(impl("hello", ""), true);
    assertEquals(impl("hello", "hello world"), false);
  },
});

// ============================================================================
// Math Functions Tests
// ============================================================================

Deno.test({
  name: "MATH_FUNCTIONS - all functions exported",
  fn() {
    assertEquals(MATH_FUNCTIONS.length, 9);
    const names = MATH_FUNCTIONS.map((f) => f.signature.name);
    assert(names.includes("ABS"));
    assert(names.includes("CEIL"));
    assert(names.includes("FLOOR"));
    assert(names.includes("ROUND"));
    assert(names.includes("SQRT"));
    assert(names.includes("POW"));
    assert(names.includes("MIN"));
    assert(names.includes("MAX"));
    assert(names.includes("RANDOM"));
  },
});

Deno.test({
  name: "ABS - returns absolute value",
  fn() {
    const impl = ABS.implementation as (num: unknown) => number;
    assertEquals(impl(-5), 5);
    assertEquals(impl(5), 5);
    assertEquals(impl(-3.14), 3.14);
    assertEquals(impl(0), 0);
  },
});

Deno.test({
  name: "ABS - signature is correct",
  fn() {
    assertEquals(ABS.signature.name, "ABS");
    assertEquals(ABS.signature.category, FunctionCategory.MATH);
    assertEquals(ABS.signature.returnType, "number");
  },
});

Deno.test({
  name: "CEIL - rounds up to nearest integer",
  fn() {
    const impl = CEIL.implementation as (num: unknown) => number;
    assertEquals(impl(3.14), 4);
    assertEquals(impl(-2.5), -2);
    assertEquals(impl(3), 3);
    assertEquals(impl(0.001), 1);
  },
});

Deno.test({
  name: "FLOOR - rounds down to nearest integer",
  fn() {
    const impl = FLOOR.implementation as (num: unknown) => number;
    assertEquals(impl(3.14), 3);
    assertEquals(impl(-2.5), -3);
    assertEquals(impl(3), 3);
    assertEquals(impl(0.999), 0);
  },
});

Deno.test({
  name: "ROUND - rounds to nearest integer",
  fn() {
    const impl = ROUND.implementation as (
      num: unknown,
      decimals?: unknown,
    ) => number;
    assertEquals(impl(3.4), 3);
    assertEquals(impl(3.5), 4);
    assertEquals(impl(-2.5), -2);
    assertEquals(impl(3), 3);
  },
});

Deno.test({
  name: "ROUND - rounds to specified decimal places",
  fn() {
    const impl = ROUND.implementation as (
      num: unknown,
      decimals?: unknown,
    ) => number;
    assertEquals(impl(3.14159, 2), 3.14);
    assertEquals(impl(3.14159, 3), 3.142);
    assertEquals(impl(3.14159, 0), 3);
    assertEquals(impl(123.456, 1), 123.5);
  },
});

Deno.test({
  name: "SQRT - calculates square root",
  fn() {
    const impl = SQRT.implementation as (num: unknown) => number;
    assertEquals(impl(16), 4);
    assertEquals(impl(4), 2);
    assertEquals(impl(0), 0);
    assertEquals(impl(1), 1);
    assert(Math.abs(impl(2) - 1.4142135623730951) < 0.0001);
  },
});

Deno.test({
  name: "POW - raises to power",
  fn() {
    const impl = POW.implementation as (
      base: unknown,
      exponent: unknown,
    ) => number;
    assertEquals(impl(2, 3), 8);
    assertEquals(impl(10, 2), 100);
    assertEquals(impl(2, 0), 1);
    assertEquals(impl(5, 1), 5);
    assertEquals(impl(2, -1), 0.5);
  },
});

Deno.test({
  name: "MIN - returns minimum value",
  fn() {
    const impl = MIN.implementation as (...args: unknown[]) => number;
    assertEquals(impl(5, 2, 8, 1), 1);
    assertEquals(impl(10), 10);
    assertEquals(impl(-5, 0, 5), -5);
    assertEquals(impl(3.14, 2.71, 1.41), 1.41);
  },
});

Deno.test({
  name: "MAX - returns maximum value",
  fn() {
    const impl = MAX.implementation as (...args: unknown[]) => number;
    assertEquals(impl(5, 2, 8, 1), 8);
    assertEquals(impl(10), 10);
    assertEquals(impl(-5, 0, 5), 5);
    assertEquals(impl(3.14, 2.71, 1.41), 3.14);
  },
});

Deno.test({
  name: "RANDOM - returns random number between 0 and 1",
  fn() {
    const impl = RANDOM.implementation as (
      min?: unknown,
      max?: unknown,
    ) => number;
    for (let i = 0; i < 10; i++) {
      const result = impl();
      assert(result >= 0 && result < 1, `Expected 0-1, got ${result}`);
    }
  },
});

Deno.test({
  name: "RANDOM - returns random integer up to max",
  fn() {
    const impl = RANDOM.implementation as (
      min?: unknown,
      max?: unknown,
    ) => number;
    for (let i = 0; i < 10; i++) {
      const result = impl(10);
      assert(
        result >= 0 && result < 10 && Number.isInteger(result),
        `Expected 0-9 integer, got ${result}`,
      );
    }
  },
});

Deno.test({
  name: "RANDOM - returns random integer in range",
  fn() {
    const impl = RANDOM.implementation as (
      min?: unknown,
      max?: unknown,
    ) => number;
    for (let i = 0; i < 10; i++) {
      const result = impl(5, 10);
      assert(
        result >= 5 && result <= 10 && Number.isInteger(result),
        `Expected 5-10 integer, got ${result}`,
      );
    }
  },
});

// ============================================================================
// Aggregate Functions Tests
// ============================================================================

Deno.test({
  name: "AGGREGATE_FUNCTIONS - all functions exported",
  fn() {
    assertEquals(AGGREGATE_FUNCTIONS.length, 4);
    const names = AGGREGATE_FUNCTIONS.map((f) => f.signature.name);
    assert(names.includes("SUM"));
    assert(names.includes("AVG"));
    assert(names.includes("FIRST"));
    assert(names.includes("LAST"));
  },
});

Deno.test({
  name: "SUM - sums multiple arguments",
  fn() {
    const impl = SUM.implementation as (...args: unknown[]) => number;
    assertEquals(impl(1, 2, 3), 6);
    assertEquals(impl(10), 10);
    assertEquals(impl(1, 2, 3, 4, 5), 15);
    assertEquals(impl(-1, 1), 0);
  },
});

Deno.test({
  name: "SUM - sums array",
  fn() {
    const impl = SUM.implementation as (...args: unknown[]) => number;
    assertEquals(impl([1, 2, 3]), 6);
    assertEquals(impl([10, 20, 30]), 60);
    assertEquals(impl([]), 0);
  },
});

Deno.test({
  name: "SUM - signature is correct",
  fn() {
    assertEquals(SUM.signature.name, "SUM");
    assertEquals(SUM.signature.category, FunctionCategory.AGGREGATE);
    assertEquals(SUM.signature.maxArgs, "variadic");
  },
});

Deno.test({
  name: "AVG - calculates average of arguments",
  fn() {
    const impl = AVG.implementation as (...args: unknown[]) => number;
    assertEquals(impl(1, 2, 3), 2);
    assertEquals(impl(10), 10);
    assertEquals(impl(0, 10), 5);
  },
});

Deno.test({
  name: "AVG - calculates average of array",
  fn() {
    const impl = AVG.implementation as (...args: unknown[]) => number;
    assertEquals(impl([1, 2, 3, 4]), 2.5);
    assertEquals(impl([10, 20, 30]), 20);
    assertEquals(impl([]), 0);
  },
});

Deno.test({
  name: "FIRST - returns first element",
  fn() {
    const impl = FIRST.implementation as (arr: unknown) => unknown;
    assertEquals(impl([1, 2, 3]), 1);
    assertEquals(impl(["a", "b", "c"]), "a");
    assertEquals(impl([{ id: 1 }]), { id: 1 });
  },
});

Deno.test({
  name: "FIRST - returns undefined for empty array",
  fn() {
    const impl = FIRST.implementation as (arr: unknown) => unknown;
    assertEquals(impl([]), undefined);
  },
});

Deno.test({
  name: "FIRST - throws on non-array",
  fn() {
    const impl = FIRST.implementation as (arr: unknown) => unknown;
    assertThrows(
      () => impl("not an array"),
      TypeError,
      "FIRST function requires an array",
    );
  },
});

Deno.test({
  name: "LAST - returns last element",
  fn() {
    const impl = LAST.implementation as (arr: unknown) => unknown;
    assertEquals(impl([1, 2, 3]), 3);
    assertEquals(impl(["a", "b", "c"]), "c");
    assertEquals(impl([{ id: 1 }, { id: 2 }]), { id: 2 });
  },
});

Deno.test({
  name: "LAST - returns undefined for empty array",
  fn() {
    const impl = LAST.implementation as (arr: unknown) => unknown;
    assertEquals(impl([]), undefined);
  },
});

Deno.test({
  name: "LAST - throws on non-array",
  fn() {
    const impl = LAST.implementation as (arr: unknown) => unknown;
    assertThrows(
      () => impl(123),
      TypeError,
      "LAST function requires an array",
    );
  },
});

// ============================================================================
// Utility Functions Tests
// ============================================================================

Deno.test({
  name: "UTILITY_FUNCTIONS - all functions exported",
  fn() {
    assertEquals(UTILITY_FUNCTIONS.length, 7);
    const names = UTILITY_FUNCTIONS.map((f) => f.signature.name);
    assert(names.includes("PARSE_JSON"));
    assert(names.includes("TO_JSON"));
    assert(names.includes("WAIT"));
    assert(names.includes("SCREENSHOT"));
    assert(names.includes("PDF"));
    assert(names.includes("NOW"));
    assert(names.includes("UUID"));
  },
});

Deno.test({
  name: "PARSE_JSON - parses valid JSON",
  fn() {
    const impl = PARSE_JSON.implementation as (str: unknown) => unknown;
    assertEquals(impl('{"a":1}'), { a: 1 });
    assertEquals(impl("[1,2,3]"), [1, 2, 3]);
    assertEquals(impl('"hello"'), "hello");
    assertEquals(impl("123"), 123);
    assertEquals(impl("true"), true);
    assertEquals(impl("null"), null);
  },
});

Deno.test({
  name: "PARSE_JSON - returns null for invalid JSON",
  fn() {
    const impl = PARSE_JSON.implementation as (str: unknown) => unknown;
    assertEquals(impl("invalid json"), null);
    assertEquals(impl("{malformed}"), null);
    assertEquals(impl("undefined"), null);
  },
});

Deno.test({
  name: "PARSE_JSON - signature is correct",
  fn() {
    assertEquals(PARSE_JSON.signature.name, "PARSE_JSON");
    assertEquals(PARSE_JSON.signature.category, FunctionCategory.UTILITY);
    assertEquals(PARSE_JSON.signature.isAsync, false);
  },
});

Deno.test({
  name: "TO_JSON - converts value to JSON string",
  fn() {
    const impl = TO_JSON.implementation as (
      value: unknown,
      pretty?: unknown,
    ) => string;
    assertEquals(impl({ a: 1 }), '{"a":1}');
    assertEquals(impl([1, 2, 3]), "[1,2,3]");
    assertEquals(impl("hello"), '"hello"');
    assertEquals(impl(123), "123");
    assertEquals(impl(true), "true");
  },
});

Deno.test({
  name: "TO_JSON - formats with pretty option",
  fn() {
    const impl = TO_JSON.implementation as (
      value: unknown,
      pretty?: unknown,
    ) => string;
    const result = impl({ a: 1 }, true);
    assert(result.includes("\n"));
    assert(result.includes("  "));
  },
});

Deno.test({
  name: "WAIT - waits for specified duration",
  async fn() {
    const impl = WAIT.implementation as (ms: unknown) => Promise<{
      completed: boolean;
      duration: number;
      requestedDuration: number;
    }>;

    const start = Date.now();
    const result = await impl(50);
    const elapsed = Date.now() - start;

    assertEquals(result.completed, true);
    assertEquals(result.requestedDuration, 50);
    assert(elapsed >= 40, `Expected at least 40ms, got ${elapsed}`);
  },
});

Deno.test({
  name: "WAIT - handles zero duration",
  async fn() {
    const impl = WAIT.implementation as (ms: unknown) => Promise<{
      completed: boolean;
    }>;

    const result = await impl(0);
    assertEquals(result.completed, true);
  },
});

Deno.test({
  name: "WAIT - signature is async",
  fn() {
    assertEquals(WAIT.signature.isAsync, true);
  },
});

Deno.test({
  name: "NOW - returns current timestamp",
  fn() {
    const impl = NOW.implementation as () => number;
    const before = Date.now();
    const result = impl();
    const after = Date.now();

    assert(result >= before && result <= after);
    assert(typeof result === "number");
  },
});

Deno.test({
  name: "NOW - signature is correct",
  fn() {
    assertEquals(NOW.signature.name, "NOW");
    assertEquals(NOW.signature.minArgs, 0);
    assertEquals(NOW.signature.maxArgs, 0);
    assertEquals(NOW.signature.returnType, "number");
    assertEquals(NOW.signature.isAsync, false);
  },
});

Deno.test({
  name: "UUID - generates valid UUID v4",
  fn() {
    const impl = UUID.implementation as () => string;
    const uuid = impl();

    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    assert(uuidRegex.test(uuid), `Invalid UUID format: ${uuid}`);
  },
});

Deno.test({
  name: "UUID - generates unique values",
  fn() {
    const impl = UUID.implementation as () => string;
    const uuids = new Set<string>();

    for (let i = 0; i < 100; i++) {
      uuids.add(impl());
    }

    assertEquals(uuids.size, 100, "UUIDs should be unique");
  },
});

// ============================================================================
// DOM Functions Tests (Signatures Only - Require Browser Context)
// ============================================================================

Deno.test({
  name: "DOM_FUNCTIONS - all functions exported",
  fn() {
    assertEquals(DOM_FUNCTIONS.length, 5);
    const names = DOM_FUNCTIONS.map((f) => f.signature.name);
    assert(names.includes("TEXT"));
    assert(names.includes("HTML"));
    assert(names.includes("ATTR"));
    assert(names.includes("COUNT"));
    assert(names.includes("EXISTS"));
  },
});

Deno.test({
  name: "TEXT - signature is correct",
  fn() {
    assertEquals(TEXT.signature.name, "TEXT");
    assertEquals(TEXT.signature.category, FunctionCategory.DOM);
    assertEquals(TEXT.signature.minArgs, 1);
    assertEquals(TEXT.signature.maxArgs, 1);
    assertEquals(TEXT.signature.returnType, "string");
    assertEquals(TEXT.signature.isAsync, true);
    assertExists(TEXT.signature.description);
    assertExists(TEXT.signature.examples);
  },
});

Deno.test({
  name: "HTML - signature is correct",
  fn() {
    assertEquals(HTML.signature.name, "HTML");
    assertEquals(HTML.signature.category, FunctionCategory.DOM);
    assertEquals(HTML.signature.minArgs, 1);
    assertEquals(HTML.signature.maxArgs, 1);
    assertEquals(HTML.signature.returnType, "string");
    assertEquals(HTML.signature.isAsync, true);
  },
});

Deno.test({
  name: "ATTR - signature is correct",
  fn() {
    assertEquals(ATTR.signature.name, "ATTR");
    assertEquals(ATTR.signature.category, FunctionCategory.DOM);
    assertEquals(ATTR.signature.minArgs, 2);
    assertEquals(ATTR.signature.maxArgs, 2);
    assertEquals(ATTR.signature.returnType, "string");
    assertEquals(ATTR.signature.isAsync, true);
  },
});

Deno.test({
  name: "COUNT - signature is correct",
  fn() {
    assertEquals(COUNT.signature.name, "COUNT");
    assertEquals(COUNT.signature.category, FunctionCategory.DOM);
    assertEquals(COUNT.signature.minArgs, 1);
    assertEquals(COUNT.signature.maxArgs, 1);
    assertEquals(COUNT.signature.returnType, "number");
    assertEquals(COUNT.signature.isAsync, true);
  },
});

Deno.test({
  name: "EXISTS - signature is correct",
  fn() {
    assertEquals(EXISTS.signature.name, "EXISTS");
    assertEquals(EXISTS.signature.category, FunctionCategory.DOM);
    assertEquals(EXISTS.signature.minArgs, 1);
    assertEquals(EXISTS.signature.maxArgs, 1);
    assertEquals(EXISTS.signature.returnType, "boolean");
    assertEquals(EXISTS.signature.isAsync, true);
  },
});

// ============================================================================
// Additional Edge Cases and Type Coercion Tests
// ============================================================================

Deno.test({
  name: "String functions handle numeric input",
  fn() {
    const upper = UPPER.implementation as (str: unknown) => string;
    const lower = LOWER.implementation as (str: unknown) => string;
    const length = LENGTH.implementation as (str: unknown) => number;

    assertEquals(upper(123), "123");
    assertEquals(lower(456), "456");
    assertEquals(length(12345), 5);
  },
});

Deno.test({
  name: "Math functions handle string numeric input",
  fn() {
    const abs = ABS.implementation as (num: unknown) => number;
    const ceil = CEIL.implementation as (num: unknown) => number;

    assertEquals(abs("-5"), 5);
    assertEquals(ceil("3.14"), 4);
  },
});

Deno.test({
  name: "Functions have proper examples",
  fn() {
    // Verify all functions have examples
    const allFunctions = [
      ...STRING_FUNCTIONS,
      ...MATH_FUNCTIONS,
      ...AGGREGATE_FUNCTIONS,
      ...UTILITY_FUNCTIONS,
      ...DOM_FUNCTIONS,
    ];

    for (const func of allFunctions) {
      assertExists(
        func.signature.examples,
        `${func.signature.name} should have examples`,
      );
      assert(
        func.signature.examples.length > 0,
        `${func.signature.name} should have at least one example`,
      );
    }
  },
});

Deno.test({
  name: "Functions have proper descriptions",
  fn() {
    const allFunctions = [
      ...STRING_FUNCTIONS,
      ...MATH_FUNCTIONS,
      ...AGGREGATE_FUNCTIONS,
      ...UTILITY_FUNCTIONS,
      ...DOM_FUNCTIONS,
    ];

    for (const func of allFunctions) {
      assertExists(
        func.signature.description,
        `${func.signature.name} should have description`,
      );
      assert(
        func.signature.description.length > 0,
        `${func.signature.name} description should not be empty`,
      );
    }
  },
});

Deno.test({
  name: "Functions have correct category",
  fn() {
    for (const func of STRING_FUNCTIONS) {
      assertEquals(
        func.signature.category,
        FunctionCategory.STRING,
        `${func.signature.name} should be STRING category`,
      );
    }

    for (const func of MATH_FUNCTIONS) {
      assertEquals(
        func.signature.category,
        FunctionCategory.MATH,
        `${func.signature.name} should be MATH category`,
      );
    }

    for (const func of AGGREGATE_FUNCTIONS) {
      assertEquals(
        func.signature.category,
        FunctionCategory.AGGREGATE,
        `${func.signature.name} should be AGGREGATE category`,
      );
    }

    for (const func of DOM_FUNCTIONS) {
      assertEquals(
        func.signature.category,
        FunctionCategory.DOM,
        `${func.signature.name} should be DOM category`,
      );
    }
  },
});

// ============================================================================
// SCREENSHOT and PDF Signature Tests (Require Browser Context)
// ============================================================================

Deno.test({
  name: "SCREENSHOT - signature is correct",
  async fn() {
    // Dynamic import to get SCREENSHOT
    const { SCREENSHOT } = await import("../../schema/functions/utility-functions.ts");

    assertEquals(SCREENSHOT.signature.name, "SCREENSHOT");
    assertEquals(SCREENSHOT.signature.category, FunctionCategory.UTILITY);
    assertEquals(SCREENSHOT.signature.minArgs, 0);
    assertEquals(SCREENSHOT.signature.maxArgs, 1);
    assertEquals(SCREENSHOT.signature.returnType, "buffer");
    assertEquals(SCREENSHOT.signature.isAsync, true);
  },
});

Deno.test({
  name: "PDF - signature is correct",
  async fn() {
    // Dynamic import to get PDF
    const { PDF } = await import("../../schema/functions/utility-functions.ts");

    assertEquals(PDF.signature.name, "PDF");
    assertEquals(PDF.signature.category, FunctionCategory.UTILITY);
    assertEquals(PDF.signature.minArgs, 0);
    assertEquals(PDF.signature.maxArgs, 1);
    assertEquals(PDF.signature.returnType, "buffer");
    assertEquals(PDF.signature.isAsync, true);
  },
});

// ============================================================================
// Boundary and Special Value Tests
// ============================================================================

Deno.test({
  name: "CEIL handles special numbers",
  fn() {
    const impl = CEIL.implementation as (num: unknown) => number;
    assertEquals(impl(Infinity), Infinity);
    assertEquals(impl(-Infinity), -Infinity);
    assert(Number.isNaN(impl(NaN)));
  },
});

Deno.test({
  name: "FLOOR handles special numbers",
  fn() {
    const impl = FLOOR.implementation as (num: unknown) => number;
    assertEquals(impl(Infinity), Infinity);
    assertEquals(impl(-Infinity), -Infinity);
    assert(Number.isNaN(impl(NaN)));
  },
});

Deno.test({
  name: "SQRT handles edge cases",
  fn() {
    const impl = SQRT.implementation as (num: unknown) => number;
    assertEquals(impl(0), 0);
    assertEquals(impl(1), 1);
    assert(Number.isNaN(impl(-1)), "SQRT of negative should be NaN");
  },
});

Deno.test({
  name: "SUBSTRING handles edge cases",
  fn() {
    const impl = SUBSTRING.implementation as (
      str: unknown,
      start: unknown,
      length?: unknown,
    ) => string;

    // Negative start is treated as 0 by substring
    assertEquals(impl("hello", -1), "hello");

    // Start beyond string length
    assertEquals(impl("hello", 100), "");

    // Length of 0
    assertEquals(impl("hello", 0, 0), "");
  },
});

Deno.test({
  name: "SPLIT handles empty delimiter",
  fn() {
    const impl = SPLIT.implementation as (
      str: unknown,
      delimiter: unknown,
    ) => string[];

    // Empty delimiter splits into characters
    assertEquals(impl("abc", ""), ["a", "b", "c"]);
  },
});

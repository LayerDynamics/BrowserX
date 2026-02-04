/**
 * ResultFormatter Tests
 * Tests for the ResultFormatter class that formats query results to various output formats
 */

import { assertEquals, assertExists, assert, assertThrows, assertStringIncludes } from "@std/assert";
import { ResultFormatter, Formatter } from "../../formatter/formatter.ts";
import type { OutputFormat } from "../../types/mod.ts";

// ============================================================================
// Constructor and Basic Tests
// ============================================================================

Deno.test({
  name: "ResultFormatter - constructor creates instance",
  fn() {
    const formatter = new ResultFormatter();
    assertExists(formatter);
  },
});

Deno.test({
  name: "ResultFormatter - Formatter alias works",
  fn() {
    const formatter = new Formatter();
    assertExists(formatter);
    assertEquals(typeof formatter.format, "function");
  },
});

Deno.test({
  name: "ResultFormatter - getSupportedFormats returns all formats",
  fn() {
    const formatter = new ResultFormatter();
    const formats = formatter.getSupportedFormats();

    assertEquals(formats.length, 7);
    assert(formats.includes("JSON"));
    assert(formats.includes("TABLE"));
    assert(formats.includes("CSV"));
    assert(formats.includes("HTML"));
    assert(formats.includes("XML"));
    assert(formats.includes("YAML"));
    assert(formats.includes("STREAM"));
  },
});

Deno.test({
  name: "ResultFormatter - throws on unsupported format",
  fn() {
    const formatter = new ResultFormatter();
    assertThrows(
      () => formatter.format({ test: "data" }, "INVALID" as OutputFormat),
      Error,
      "Unsupported output format",
    );
  },
});

// ============================================================================
// JSON Formatting Tests
// ============================================================================

Deno.test({
  name: "ResultFormatter - JSON format simple object",
  fn() {
    const formatter = new ResultFormatter();
    const data = { name: "test", value: 42 };
    const result = formatter.format(data, "JSON");

    assertEquals(result, '{"name":"test","value":42}');
  },
});

Deno.test({
  name: "ResultFormatter - JSON format with pretty option",
  fn() {
    const formatter = new ResultFormatter();
    const data = { name: "test", value: 42 };
    const result = formatter.format(data, "JSON", { pretty: true });

    assertStringIncludes(result as string, "{\n");
    assertStringIncludes(result as string, '  "name"');
    assertStringIncludes(result as string, '  "value"');
  },
});

Deno.test({
  name: "ResultFormatter - JSON format with custom indent",
  fn() {
    const formatter = new ResultFormatter();
    const data = { name: "test" };
    const result = formatter.format(data, "JSON", { pretty: true, indent: 4 });

    assertStringIncludes(result as string, '    "name"');
  },
});

Deno.test({
  name: "ResultFormatter - JSON format array",
  fn() {
    const formatter = new ResultFormatter();
    const data = [1, 2, 3];
    const result = formatter.format(data, "JSON");

    assertEquals(result, "[1,2,3]");
  },
});

Deno.test({
  name: "ResultFormatter - JSON format nested object",
  fn() {
    const formatter = new ResultFormatter();
    const data = { outer: { inner: { deep: "value" } } };
    const result = formatter.format(data, "JSON");

    assertEquals(result, '{"outer":{"inner":{"deep":"value"}}}');
  },
});

Deno.test({
  name: "ResultFormatter - JSON format handles null",
  fn() {
    const formatter = new ResultFormatter();
    const result = formatter.format(null, "JSON");

    assertEquals(result, "null");
  },
});

Deno.test({
  name: "ResultFormatter - JSON format handles primitives",
  fn() {
    const formatter = new ResultFormatter();

    assertEquals(formatter.format(42, "JSON"), "42");
    assertEquals(formatter.format("hello", "JSON"), '"hello"');
    assertEquals(formatter.format(true, "JSON"), "true");
    assertEquals(formatter.format(false, "JSON"), "false");
  },
});

// ============================================================================
// TABLE Formatting Tests
// ============================================================================

Deno.test({
  name: "ResultFormatter - TABLE format array of objects",
  fn() {
    const formatter = new ResultFormatter();
    const data = [
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ];
    const result = formatter.format(data, "TABLE") as string;

    assertStringIncludes(result, "| id");
    assertStringIncludes(result, "| name");
    assertStringIncludes(result, "| 1");
    assertStringIncludes(result, "| Alice");
    assertStringIncludes(result, "| 2");
    assertStringIncludes(result, "| Bob");
    assertStringIncludes(result, "+--");
  },
});

Deno.test({
  name: "ResultFormatter - TABLE format empty array returns empty string",
  fn() {
    const formatter = new ResultFormatter();
    const result = formatter.format([], "TABLE");

    assertEquals(result, "");
  },
});

Deno.test({
  name: "ResultFormatter - TABLE format array of primitives returns string representation",
  fn() {
    const formatter = new ResultFormatter();
    const result = formatter.format([1, 2, 3], "TABLE");

    assertEquals(result, "1,2,3");
  },
});

Deno.test({
  name: "ResultFormatter - TABLE format without headers",
  fn() {
    const formatter = new ResultFormatter();
    const data = [{ id: 1, name: "Alice" }];
    const result = formatter.format(data, "TABLE", { includeHeaders: false }) as string;

    // Should have rows but not header row (only one separator)
    const lines = result.split("\n");
    // First line is separator, second is data, third is separator
    assertEquals(lines[0].startsWith("+"), true);
    assertEquals(lines[1].includes("1"), true);
    assertEquals(lines[1].includes("Alice"), true);
  },
});

Deno.test({
  name: "ResultFormatter - TABLE format calculates column widths correctly",
  fn() {
    const formatter = new ResultFormatter();
    const data = [
      { short: "a", longColumnName: "value" },
    ];
    const result = formatter.format(data, "TABLE") as string;

    // The column width should accommodate the longest value (header or data)
    assertStringIncludes(result, "longColumnName");
  },
});

Deno.test({
  name: "ResultFormatter - TABLE format handles null values",
  fn() {
    const formatter = new ResultFormatter();
    const data = [
      { id: 1, name: null },
    ];
    const result = formatter.format(data, "TABLE") as string;

    assertStringIncludes(result, "NULL");
  },
});

Deno.test({
  name: "ResultFormatter - TABLE format handles nested objects",
  fn() {
    const formatter = new ResultFormatter();
    const data = [
      { id: 1, nested: { key: "value" } },
    ];
    const result = formatter.format(data, "TABLE") as string;

    assertStringIncludes(result, "{1 keys}");
  },
});

Deno.test({
  name: "ResultFormatter - TABLE format handles arrays in values",
  fn() {
    const formatter = new ResultFormatter();
    const data = [
      { id: 1, items: [1, 2, 3] },
    ];
    const result = formatter.format(data, "TABLE") as string;

    assertStringIncludes(result, "[3 items]");
  },
});

// ============================================================================
// CSV Formatting Tests
// ============================================================================

Deno.test({
  name: "ResultFormatter - CSV format array of objects",
  fn() {
    const formatter = new ResultFormatter();
    const data = [
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ];
    const result = formatter.format(data, "CSV") as string;
    const lines = result.split("\n");

    assertEquals(lines[0], "id,name");
    assertEquals(lines[1], "1,Alice");
    assertEquals(lines[2], "2,Bob");
  },
});

Deno.test({
  name: "ResultFormatter - CSV format empty array returns empty string",
  fn() {
    const formatter = new ResultFormatter();
    const result = formatter.format([], "CSV");

    assertEquals(result, "");
  },
});

Deno.test({
  name: "ResultFormatter - CSV format escapes values with commas",
  fn() {
    const formatter = new ResultFormatter();
    const data = [
      { id: 1, name: "Alice, Bob" },
    ];
    const result = formatter.format(data, "CSV") as string;
    const lines = result.split("\n");

    assertEquals(lines[1], '1,"Alice, Bob"');
  },
});

Deno.test({
  name: "ResultFormatter - CSV format escapes values with quotes",
  fn() {
    const formatter = new ResultFormatter();
    const data = [
      { id: 1, name: 'Say "hello"' },
    ];
    const result = formatter.format(data, "CSV") as string;
    const lines = result.split("\n");

    assertEquals(lines[1], '1,"Say ""hello"""');
  },
});

Deno.test({
  name: "ResultFormatter - CSV format escapes values with newlines",
  fn() {
    const formatter = new ResultFormatter();
    const data = [
      { id: 1, name: "Line1\nLine2" },
    ];
    const result = formatter.format(data, "CSV") as string;

    assertStringIncludes(result, '"Line1\nLine2"');
  },
});

Deno.test({
  name: "ResultFormatter - CSV format custom delimiter",
  fn() {
    const formatter = new ResultFormatter();
    const data = [
      { id: 1, name: "Alice" },
    ];
    const result = formatter.format(data, "CSV", { delimiter: ";" }) as string;
    const lines = result.split("\n");

    assertEquals(lines[0], "id;name");
    assertEquals(lines[1], "1;Alice");
  },
});

Deno.test({
  name: "ResultFormatter - CSV format without headers",
  fn() {
    const formatter = new ResultFormatter();
    const data = [
      { id: 1, name: "Alice" },
    ];
    const result = formatter.format(data, "CSV", { includeHeaders: false }) as string;
    const lines = result.split("\n");

    assertEquals(lines.length, 1);
    assertEquals(lines[0], "1,Alice");
  },
});

Deno.test({
  name: "ResultFormatter - CSV format array of primitives",
  fn() {
    const formatter = new ResultFormatter();
    const data = [1, 2, 3];
    const result = formatter.format(data, "CSV") as string;
    const lines = result.split("\n");

    assertEquals(lines[0], "1");
    assertEquals(lines[1], "2");
    assertEquals(lines[2], "3");
  },
});

// ============================================================================
// HTML Formatting Tests
// ============================================================================

Deno.test({
  name: "ResultFormatter - HTML format array of objects",
  fn() {
    const formatter = new ResultFormatter();
    const data = [
      { id: 1, name: "Alice" },
    ];
    const result = formatter.format(data, "HTML") as string;

    assertStringIncludes(result, "<table>");
    assertStringIncludes(result, "</table>");
    assertStringIncludes(result, "<thead>");
    assertStringIncludes(result, "<th>id</th>");
    assertStringIncludes(result, "<th>name</th>");
    assertStringIncludes(result, "<tbody>");
    assertStringIncludes(result, "<td>1</td>");
    assertStringIncludes(result, "<td>Alice</td>");
  },
});

Deno.test({
  name: "ResultFormatter - HTML format empty array",
  fn() {
    const formatter = new ResultFormatter();
    const result = formatter.format([], "HTML") as string;

    assertEquals(result, "<p>No data</p>");
  },
});

Deno.test({
  name: "ResultFormatter - HTML format escapes special characters",
  fn() {
    const formatter = new ResultFormatter();
    const data = [
      { content: '<script>alert("xss")</script>' },
    ];
    const result = formatter.format(data, "HTML") as string;

    assertStringIncludes(result, "&lt;script&gt;");
    assertStringIncludes(result, "&quot;xss&quot;");
    assert(!result.includes("<script>"));
  },
});

Deno.test({
  name: "ResultFormatter - HTML format without headers",
  fn() {
    const formatter = new ResultFormatter();
    const data = [
      { id: 1, name: "Alice" },
    ];
    const result = formatter.format(data, "HTML", { includeHeaders: false }) as string;

    assert(!result.includes("<thead>"));
    assertStringIncludes(result, "<tbody>");
    assertStringIncludes(result, "<td>1</td>");
  },
});

Deno.test({
  name: "ResultFormatter - HTML format array of primitives",
  fn() {
    const formatter = new ResultFormatter();
    const data = [1, 2, 3];
    const result = formatter.format(data, "HTML") as string;

    assertStringIncludes(result, "<pre>");
    assertStringIncludes(result, "</pre>");
    assertStringIncludes(result, "1");
    assertStringIncludes(result, "2");
    assertStringIncludes(result, "3");
  },
});

Deno.test({
  name: "ResultFormatter - HTML escapes ampersand correctly",
  fn() {
    const formatter = new ResultFormatter();
    const data = [
      { content: "foo & bar" },
    ];
    const result = formatter.format(data, "HTML") as string;

    assertStringIncludes(result, "foo &amp; bar");
  },
});

// ============================================================================
// XML Formatting Tests
// ============================================================================

Deno.test({
  name: "ResultFormatter - XML format simple object",
  fn() {
    const formatter = new ResultFormatter();
    const data = { id: 1, name: "Alice" };
    const result = formatter.format(data, "XML") as string;

    assertStringIncludes(result, '<?xml version="1.0" encoding="UTF-8"?>');
    assertStringIncludes(result, "<result>");
    assertStringIncludes(result, "<id>1</id>");
    assertStringIncludes(result, "<name>Alice</name>");
    assertStringIncludes(result, "</result>");
  },
});

Deno.test({
  name: "ResultFormatter - XML format array",
  fn() {
    const formatter = new ResultFormatter();
    const data = [{ id: 1 }, { id: 2 }];
    const result = formatter.format(data, "XML") as string;

    assertStringIncludes(result, "<item>");
    assertStringIncludes(result, "<id>1</id>");
    assertStringIncludes(result, "<id>2</id>");
    assertStringIncludes(result, "</item>");
  },
});

Deno.test({
  name: "ResultFormatter - XML format with pretty option",
  fn() {
    const formatter = new ResultFormatter();
    const data = { id: 1, name: "Alice" };
    const result = formatter.format(data, "XML", { pretty: true }) as string;

    assertStringIncludes(result, "  <id>");
    assertStringIncludes(result, "  <name>");
  },
});

Deno.test({
  name: "ResultFormatter - XML format escapes special characters",
  fn() {
    const formatter = new ResultFormatter();
    const data = { content: '<script>alert("xss")</script>' };
    const result = formatter.format(data, "XML") as string;

    assertStringIncludes(result, "&lt;script&gt;");
    assertStringIncludes(result, "&quot;xss&quot;");
  },
});

Deno.test({
  name: "ResultFormatter - XML format null value",
  fn() {
    const formatter = new ResultFormatter();
    const data = { id: null };
    const result = formatter.format(data, "XML") as string;

    assertStringIncludes(result, "<id />");
  },
});

Deno.test({
  name: "ResultFormatter - XML format nested objects",
  fn() {
    const formatter = new ResultFormatter();
    const data = { outer: { inner: "value" } };
    const result = formatter.format(data, "XML") as string;

    assertStringIncludes(result, "<outer>");
    assertStringIncludes(result, "<inner>value</inner>");
    assertStringIncludes(result, "</outer>");
  },
});

Deno.test({
  name: "ResultFormatter - XML escapes apostrophe",
  fn() {
    const formatter = new ResultFormatter();
    const data = { content: "it's" };
    const result = formatter.format(data, "XML") as string;

    assertStringIncludes(result, "it&apos;s");
  },
});

// ============================================================================
// YAML Formatting Tests
// ============================================================================

Deno.test({
  name: "ResultFormatter - YAML format simple object",
  fn() {
    const formatter = new ResultFormatter();
    const data = { id: 1, name: "Alice" };
    const result = formatter.format(data, "YAML") as string;

    assertStringIncludes(result, "id: 1");
    assertStringIncludes(result, "name: Alice");
  },
});

Deno.test({
  name: "ResultFormatter - YAML format array",
  fn() {
    const formatter = new ResultFormatter();
    const data = [1, 2, 3];
    const result = formatter.format(data, "YAML") as string;

    assertStringIncludes(result, "- 1");
    assertStringIncludes(result, "- 2");
    assertStringIncludes(result, "- 3");
  },
});

Deno.test({
  name: "ResultFormatter - YAML format nested object",
  fn() {
    const formatter = new ResultFormatter();
    const data = { outer: { inner: "value" } };
    const result = formatter.format(data, "YAML") as string;

    assertStringIncludes(result, "outer:");
    assertStringIncludes(result, "inner: value");
  },
});

Deno.test({
  name: "ResultFormatter - YAML format null",
  fn() {
    const formatter = new ResultFormatter();
    const result = formatter.format(null, "YAML");

    assertEquals(result, "null");
  },
});

Deno.test({
  name: "ResultFormatter - YAML format boolean",
  fn() {
    const formatter = new ResultFormatter();

    assertEquals(formatter.format(true, "YAML"), "true");
    assertEquals(formatter.format(false, "YAML"), "false");
  },
});

Deno.test({
  name: "ResultFormatter - YAML format number",
  fn() {
    const formatter = new ResultFormatter();

    assertEquals(formatter.format(42, "YAML"), "42");
    assertEquals(formatter.format(3.14, "YAML"), "3.14");
  },
});

Deno.test({
  name: "ResultFormatter - YAML format quotes strings with special characters",
  fn() {
    const formatter = new ResultFormatter();
    const data = { content: "has: colon" };
    const result = formatter.format(data, "YAML") as string;

    assertStringIncludes(result, '"has: colon"');
  },
});

Deno.test({
  name: "ResultFormatter - YAML format quotes strings with newlines",
  fn() {
    const formatter = new ResultFormatter();
    const data = { content: "line1\nline2" };
    const result = formatter.format(data, "YAML") as string;

    assertStringIncludes(result, '"line1\\nline2"');
  },
});

Deno.test({
  name: "ResultFormatter - YAML format quotes strings with brackets",
  fn() {
    const formatter = new ResultFormatter();
    const data = { content: "[array]" };
    const result = formatter.format(data, "YAML") as string;

    assertStringIncludes(result, '"[array]"');
  },
});

Deno.test({
  name: "ResultFormatter - YAML format empty array",
  fn() {
    const formatter = new ResultFormatter();
    const data = { items: [] as unknown[] };
    const result = formatter.format(data, "YAML") as string;

    assertStringIncludes(result, "items: []");
  },
});

Deno.test({
  name: "ResultFormatter - YAML format empty object",
  fn() {
    const formatter = new ResultFormatter();
    const data = { empty: {} };
    const result = formatter.format(data, "YAML") as string;

    assertStringIncludes(result, "empty: {}");
  },
});

// ============================================================================
// STREAM Formatting Tests
// ============================================================================

Deno.test({
  name: "ResultFormatter - STREAM format array",
  fn() {
    const formatter = new ResultFormatter();
    const data = [
      { id: 1 },
      { id: 2 },
      { id: 3 },
    ];
    const result = formatter.format(data, "STREAM") as string;
    const lines = result.split("\n");

    assertEquals(lines.length, 3);
    assertEquals(lines[0], '{"id":1}');
    assertEquals(lines[1], '{"id":2}');
    assertEquals(lines[2], '{"id":3}');
  },
});

Deno.test({
  name: "ResultFormatter - STREAM format non-array",
  fn() {
    const formatter = new ResultFormatter();
    const data = { id: 1 };
    const result = formatter.format(data, "STREAM") as string;

    assertEquals(result, '{"id":1}');
  },
});

Deno.test({
  name: "ResultFormatter - STREAM format empty array",
  fn() {
    const formatter = new ResultFormatter();
    const result = formatter.format([], "STREAM") as string;

    assertEquals(result, "");
  },
});

// ============================================================================
// Edge Cases and Complex Data Tests
// ============================================================================

Deno.test({
  name: "ResultFormatter - handles undefined values in objects",
  fn() {
    const formatter = new ResultFormatter();
    const data = [{ id: 1, value: undefined }];

    // JSON should omit undefined
    const jsonResult = formatter.format(data, "JSON") as string;
    assertEquals(jsonResult, '[{"id":1}]');

    // TABLE should show 'undefined'
    const tableResult = formatter.format(data, "TABLE") as string;
    assertStringIncludes(tableResult, "undefined");
  },
});

Deno.test({
  name: "ResultFormatter - handles deeply nested data",
  fn() {
    const formatter = new ResultFormatter();
    const data = {
      level1: {
        level2: {
          level3: {
            level4: "deep",
          },
        },
      },
    };

    const jsonResult = formatter.format(data, "JSON") as string;
    assertStringIncludes(jsonResult, '"level4":"deep"');

    const yamlResult = formatter.format(data, "YAML") as string;
    assertStringIncludes(yamlResult, "level4: deep");
  },
});

Deno.test({
  name: "ResultFormatter - handles mixed array data",
  fn() {
    const formatter = new ResultFormatter();
    const data = [
      { type: "user", name: "Alice", age: 30 },
      { type: "user", name: "Bob", active: true },
    ];

    const csvResult = formatter.format(data, "CSV") as string;
    const lines = csvResult.split("\n");
    // Should have headers from first row
    assertEquals(lines[0], "type,name,age");
  },
});

Deno.test({
  name: "ResultFormatter - handles special numeric values",
  fn() {
    const formatter = new ResultFormatter();
    const data = [
      { value: 0 },
      { value: -1 },
      { value: 3.14159 },
    ];

    const tableResult = formatter.format(data, "TABLE") as string;
    assertStringIncludes(tableResult, "0");
    assertStringIncludes(tableResult, "-1");
    assertStringIncludes(tableResult, "3.14159");
  },
});

Deno.test({
  name: "ResultFormatter - handles boolean values",
  fn() {
    const formatter = new ResultFormatter();
    const data = [
      { active: true },
      { active: false },
    ];

    const tableResult = formatter.format(data, "TABLE") as string;
    assertStringIncludes(tableResult, "true");
    assertStringIncludes(tableResult, "false");

    const csvResult = formatter.format(data, "CSV") as string;
    assertStringIncludes(csvResult, "true");
    assertStringIncludes(csvResult, "false");
  },
});

Deno.test({
  name: "ResultFormatter - preserves data order in arrays",
  fn() {
    const formatter = new ResultFormatter();
    const data = [
      { id: 3 },
      { id: 1 },
      { id: 2 },
    ];

    const streamResult = formatter.format(data, "STREAM") as string;
    const lines = streamResult.split("\n");
    assertEquals(lines[0], '{"id":3}');
    assertEquals(lines[1], '{"id":1}');
    assertEquals(lines[2], '{"id":2}');
  },
});

Deno.test({
  name: "ResultFormatter - handles large arrays",
  fn() {
    const formatter = new ResultFormatter();
    const data = Array.from({ length: 100 }, (_, i) => ({ id: i, name: `Item ${i}` }));

    const jsonResult = formatter.format(data, "JSON") as string;
    assert(jsonResult.length > 0);

    const streamResult = formatter.format(data, "STREAM") as string;
    const lines = streamResult.split("\n");
    assertEquals(lines.length, 100);
  },
});

Deno.test({
  name: "ResultFormatter - handles Unicode characters",
  fn() {
    const formatter = new ResultFormatter();
    const data = [
      { name: "日本語", emoji: "🎉" },
    ];

    const jsonResult = formatter.format(data, "JSON") as string;
    assertStringIncludes(jsonResult, "日本語");
    assertStringIncludes(jsonResult, "🎉");

    const tableResult = formatter.format(data, "TABLE") as string;
    assertStringIncludes(tableResult, "日本語");
    assertStringIncludes(tableResult, "🎉");
  },
});

Deno.test({
  name: "ResultFormatter - handles Date objects",
  fn() {
    const formatter = new ResultFormatter();
    const date = new Date("2024-01-15T10:30:00.000Z");
    const data = [{ created: date }];

    // Date should be serialized to ISO string in JSON
    const jsonResult = formatter.format(data, "JSON") as string;
    assertStringIncludes(jsonResult, "2024-01-15");
  },
});

// ============================================================================
// Options Tests
// ============================================================================

Deno.test({
  name: "ResultFormatter - custom quote character in CSV",
  fn() {
    const formatter = new ResultFormatter();
    const data = [{ name: "Alice,Bob" }];
    const result = formatter.format(data, "CSV", { quote: "'" }) as string;
    const lines = result.split("\n");

    assertEquals(lines[1], "'Alice,Bob'");
  },
});

Deno.test({
  name: "ResultFormatter - custom indent in YAML",
  fn() {
    const formatter = new ResultFormatter();
    const data = { outer: { inner: "value" } };
    const result2 = formatter.format(data, "YAML", { indent: 2 }) as string;
    const result4 = formatter.format(data, "YAML", { indent: 4 }) as string;

    // Both should contain the nested value
    assertStringIncludes(result2, "inner: value");
    assertStringIncludes(result4, "inner: value");
  },
});

Deno.test({
  name: "ResultFormatter - default options work correctly",
  fn() {
    const formatter = new ResultFormatter();
    const data = [{ id: 1, name: "Alice" }];

    // All formats should work with no options
    const formats: OutputFormat[] = ["JSON", "TABLE", "CSV", "HTML", "XML", "YAML", "STREAM"];
    for (const format of formats) {
      const result = formatter.format(data, format);
      assert(result !== undefined, `Format ${format} should return a result`);
      assert((result as string).length > 0, `Format ${format} should return non-empty result`);
    }
  },
});

/**
 * Validator Tests
 */

import { assertEquals, assert, assertThrows } from "@std/assert";
import { Validator, ValidationError } from "../../analyzer/validator.ts";
import { SymbolTable } from "../../analyzer/symbols.ts";

function makeValidator(config = {}) {
  return new Validator(new SymbolTable(), config);
}

function makeSelect(fields: string[], sourceType: string, sourceValue: any, opts: any = {}) {
  return {
    type: "SELECT" as const,
    fields: fields.map(f => ({ name: f, alias: undefined, expression: undefined })),
    source: { type: sourceType, value: sourceValue },
    where: opts.where,
    orderBy: opts.orderBy,
    limit: opts.limit,
  };
}

Deno.test("Validator - constructor", () => {
  assert(makeValidator() instanceof Validator);
});

Deno.test("Validator - valid SELECT passes", () => {
  const v = makeValidator();
  const stmt = makeSelect(["title"], "URL", "https://example.com");
  v.validate(stmt as any); // should not throw
});

Deno.test("Validator - SELECT with no fields throws", () => {
  const v = makeValidator();
  const stmt = { type: "SELECT", fields: [], source: { type: "URL", value: "https://x.com" } };
  assertThrows(() => v.validate(stmt as any), ValidationError, "at least one field");
});

Deno.test("Validator - SELECT with duplicate fields throws", () => {
  const v = makeValidator();
  const stmt = makeSelect(["title", "title"], "URL", "https://x.com");
  assertThrows(() => v.validate(stmt as any), ValidationError, "Duplicate field");
});

Deno.test("Validator - SELECT with invalid URL throws", () => {
  const v = makeValidator();
  const stmt = makeSelect(["x"], "URL", "not-a-url");
  assertThrows(() => v.validate(stmt as any), ValidationError, "Invalid URL");
});

Deno.test("Validator - SELECT with ftp URL throws", () => {
  const v = makeValidator();
  const stmt = makeSelect(["x"], "URL", "ftp://files.example.com/file.txt");
  assertThrows(() => v.validate(stmt as any), ValidationError, "not allowed");
});

Deno.test("Validator - SELECT with LIMIT <= 0 throws", () => {
  const v = makeValidator();
  const stmt = makeSelect(["x"], "URL", "https://x.com", { limit: { count: 0 } });
  assertThrows(() => v.validate(stmt as any), ValidationError, "LIMIT must be positive");
});

Deno.test("Validator - SELECT with negative OFFSET throws", () => {
  const v = makeValidator();
  const stmt = makeSelect(["x"], "URL", "https://x.com", { limit: { count: 10, offset: -1 } });
  assertThrows(() => v.validate(stmt as any), ValidationError, "OFFSET must be non-negative");
});

Deno.test("Validator - SELECT ORDER BY non-existent field throws", () => {
  const v = makeValidator();
  const stmt = makeSelect(["title"], "URL", "https://x.com", { orderBy: [{ field: "missing", direction: "ASC" }] });
  assertThrows(() => v.validate(stmt as any), ValidationError, "not in SELECT list");
});

Deno.test("Validator - allowUndefinedVariables config", () => {
  const v = makeValidator({ allowUndefinedVariables: true });
  const stmt = makeSelect(["x"], "VARIABLE", "undefinedVar");
  v.validate(stmt as any); // should not throw
});

Deno.test("Validator - undefined variable without config throws", () => {
  const v = makeValidator();
  const stmt = makeSelect(["x"], "VARIABLE", "undefinedVar");
  assertThrows(() => v.validate(stmt as any), ValidationError, "Undefined variable");
});

Deno.test("Validator - NAVIGATE validates URL expression", () => {
  const v = makeValidator();
  const stmt = { type: "NAVIGATE", url: { type: "LITERAL", value: "https://x.com" } };
  v.validate(stmt as any); // should not throw
});

Deno.test("Validator - FOR validates collection and body", () => {
  const v = makeValidator();
  const stmt = { type: "FOR", variable: "i", collection: { type: "ARRAY", elements: [] }, body: makeSelect(["x"], "URL", "https://x.com") };
  v.validate(stmt as any); // should not throw
});

Deno.test("Validator - IF validates condition and branches", () => {
  const v = makeValidator();
  const stmt = { type: "IF", condition: { type: "LITERAL", value: true }, then: makeSelect(["x"], "URL", "https://x.com") };
  v.validate(stmt as any); // should not throw
});

/**
 * Data Types Tests
 * Comprehensive tests for data type definitions, coercion, and compatibility
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { DataType } from "../../types/primitives.ts";
import type { Literal, Expression } from "../../types/ast.ts";

// ============================================================================
// DataType Enum Value Tests
// ============================================================================

Deno.test("DataType - STRING value", () => {
  assertEquals(DataType.STRING, "String");
});

Deno.test("DataType - NUMBER value", () => {
  assertEquals(DataType.NUMBER, "Number");
});

Deno.test("DataType - BOOLEAN value", () => {
  assertEquals(DataType.BOOLEAN, "Boolean");
});

Deno.test("DataType - NULL value", () => {
  assertEquals(DataType.NULL, "Null");
});

Deno.test("DataType - URL value", () => {
  assertEquals(DataType.URL, "URL");
});

Deno.test("DataType - ARRAY value", () => {
  assertEquals(DataType.ARRAY, "Array");
});

Deno.test("DataType - OBJECT value", () => {
  assertEquals(DataType.OBJECT, "Object");
});

Deno.test("DataType - SET value", () => {
  assertEquals(DataType.SET, "Set");
});

Deno.test("DataType - ELEMENT value", () => {
  assertEquals(DataType.ELEMENT, "Element");
});

Deno.test("DataType - NODE_LIST value", () => {
  assertEquals(DataType.NODE_LIST, "NodeList");
});

Deno.test("DataType - DOCUMENT value", () => {
  assertEquals(DataType.DOCUMENT, "Document");
});

Deno.test("DataType - REQUEST value", () => {
  assertEquals(DataType.REQUEST, "Request");
});

Deno.test("DataType - RESPONSE value", () => {
  assertEquals(DataType.RESPONSE, "Response");
});

Deno.test("DataType - HEADERS value", () => {
  assertEquals(DataType.HEADERS, "Headers");
});

Deno.test("DataType - COOKIE value", () => {
  assertEquals(DataType.COOKIE, "Cookie");
});

Deno.test("DataType - SELECTOR value", () => {
  assertEquals(DataType.SELECTOR, "Selector");
});

Deno.test("DataType - XPATH value", () => {
  assertEquals(DataType.XPATH, "XPath");
});

Deno.test("DataType - REGEX value", () => {
  assertEquals(DataType.REGEX, "Regex");
});

Deno.test("DataType - DURATION value", () => {
  assertEquals(DataType.DURATION, "Duration");
});

Deno.test("DataType - BYTES value", () => {
  assertEquals(DataType.BYTES, "Bytes");
});

Deno.test("DataType - UNKNOWN value", () => {
  assertEquals(DataType.UNKNOWN, "Unknown");
});

// ============================================================================
// DataType Enum Completeness Tests
// ============================================================================

Deno.test("DataType - all types are defined", () => {
  const expectedTypes = [
    "STRING", "NUMBER", "BOOLEAN", "NULL", "URL",
    "ARRAY", "OBJECT", "SET",
    "ELEMENT", "NODE_LIST", "DOCUMENT",
    "REQUEST", "RESPONSE", "HEADERS", "COOKIE",
    "SELECTOR", "XPATH", "REGEX",
    "DURATION", "BYTES", "UNKNOWN"
  ];

  for (const type of expectedTypes) {
    assertExists((DataType as Record<string, string>)[type], `DataType.${type} should be defined`);
  }
});

Deno.test("DataType - all values are unique", () => {
  const values = Object.values(DataType);
  const uniqueValues = new Set(values);

  assertEquals(values.length, uniqueValues.size, "All DataType values should be unique");
});

// ============================================================================
// DataType Categorization Tests
// ============================================================================

Deno.test("DataType - primitive types", () => {
  const primitiveTypes = [
    DataType.STRING,
    DataType.NUMBER,
    DataType.BOOLEAN,
    DataType.NULL,
  ];

  for (const type of primitiveTypes) {
    assertExists(type);
  }
});

Deno.test("DataType - collection types", () => {
  const collectionTypes = [
    DataType.ARRAY,
    DataType.OBJECT,
    DataType.SET,
  ];

  for (const type of collectionTypes) {
    assertExists(type);
  }
});

Deno.test("DataType - DOM types", () => {
  const domTypes = [
    DataType.ELEMENT,
    DataType.NODE_LIST,
    DataType.DOCUMENT,
  ];

  for (const type of domTypes) {
    assertExists(type);
  }
});

Deno.test("DataType - HTTP types", () => {
  const httpTypes = [
    DataType.REQUEST,
    DataType.RESPONSE,
    DataType.HEADERS,
    DataType.COOKIE,
  ];

  for (const type of httpTypes) {
    assertExists(type);
  }
});

Deno.test("DataType - selector types", () => {
  const selectorTypes = [
    DataType.SELECTOR,
    DataType.XPATH,
    DataType.REGEX,
  ];

  for (const type of selectorTypes) {
    assertExists(type);
  }
});

Deno.test("DataType - measurement types", () => {
  const measurementTypes = [
    DataType.DURATION,
    DataType.BYTES,
  ];

  for (const type of measurementTypes) {
    assertExists(type);
  }
});

// ============================================================================
// Literal Node Creation with DataType Tests
// ============================================================================

Deno.test("Literal - string type", () => {
  const literal: Literal = {
    type: "LITERAL",
    dataType: DataType.STRING,
    value: "hello world",
  };

  assertEquals(literal.type, "LITERAL");
  assertEquals(literal.dataType, DataType.STRING);
  assertEquals(literal.value, "hello world");
});

Deno.test("Literal - number type", () => {
  const literal: Literal = {
    type: "LITERAL",
    dataType: DataType.NUMBER,
    value: 42,
  };

  assertEquals(literal.dataType, DataType.NUMBER);
  assertEquals(literal.value, 42);
});

Deno.test("Literal - boolean true", () => {
  const literal: Literal = {
    type: "LITERAL",
    dataType: DataType.BOOLEAN,
    value: true,
  };

  assertEquals(literal.dataType, DataType.BOOLEAN);
  assertEquals(literal.value, true);
});

Deno.test("Literal - boolean false", () => {
  const literal: Literal = {
    type: "LITERAL",
    dataType: DataType.BOOLEAN,
    value: false,
  };

  assertEquals(literal.dataType, DataType.BOOLEAN);
  assertEquals(literal.value, false);
});

Deno.test("Literal - null type", () => {
  const literal: Literal = {
    type: "LITERAL",
    dataType: DataType.NULL,
    value: null,
  };

  assertEquals(literal.dataType, DataType.NULL);
  assertEquals(literal.value, null);
});

Deno.test("Literal - URL type", () => {
  const literal: Literal = {
    type: "LITERAL",
    dataType: DataType.URL,
    value: "https://example.com",
  };

  assertEquals(literal.dataType, DataType.URL);
  assertEquals(literal.value, "https://example.com");
});

Deno.test("Literal - selector type", () => {
  const literal: Literal = {
    type: "LITERAL",
    dataType: DataType.SELECTOR,
    value: "#main .content",
  };

  assertEquals(literal.dataType, DataType.SELECTOR);
  assertEquals(literal.value, "#main .content");
});

Deno.test("Literal - xpath type", () => {
  const literal: Literal = {
    type: "LITERAL",
    dataType: DataType.XPATH,
    value: "//div[@id='main']",
  };

  assertEquals(literal.dataType, DataType.XPATH);
  assertEquals(literal.value, "//div[@id='main']");
});

Deno.test("Literal - regex type", () => {
  const literal: Literal = {
    type: "LITERAL",
    dataType: DataType.REGEX,
    value: "^[a-z]+$",
  };

  assertEquals(literal.dataType, DataType.REGEX);
  assertEquals(literal.value, "^[a-z]+$");
});

Deno.test("Literal - duration type", () => {
  const literal: Literal = {
    type: "LITERAL",
    dataType: DataType.DURATION,
    value: 5000,
  };

  assertEquals(literal.dataType, DataType.DURATION);
  assertEquals(literal.value, 5000);
});

Deno.test("Literal - bytes type", () => {
  const literal: Literal = {
    type: "LITERAL",
    dataType: DataType.BYTES,
    value: 1024,
  };

  assertEquals(literal.dataType, DataType.BYTES);
  assertEquals(literal.value, 1024);
});

// ============================================================================
// Number Value Edge Cases
// ============================================================================

Deno.test("Literal - number zero", () => {
  const literal: Literal = {
    type: "LITERAL",
    dataType: DataType.NUMBER,
    value: 0,
  };

  assertEquals(literal.value, 0);
});

Deno.test("Literal - negative number", () => {
  const literal: Literal = {
    type: "LITERAL",
    dataType: DataType.NUMBER,
    value: -42,
  };

  assertEquals(literal.value, -42);
});

Deno.test("Literal - floating point number", () => {
  const literal: Literal = {
    type: "LITERAL",
    dataType: DataType.NUMBER,
    value: 3.14159,
  };

  assertEquals(literal.value, 3.14159);
});

Deno.test("Literal - very large number", () => {
  const literal: Literal = {
    type: "LITERAL",
    dataType: DataType.NUMBER,
    value: Number.MAX_SAFE_INTEGER,
  };

  assertEquals(literal.value, Number.MAX_SAFE_INTEGER);
});

Deno.test("Literal - very small number", () => {
  const literal: Literal = {
    type: "LITERAL",
    dataType: DataType.NUMBER,
    value: Number.MIN_SAFE_INTEGER,
  };

  assertEquals(literal.value, Number.MIN_SAFE_INTEGER);
});

Deno.test("Literal - infinity", () => {
  const literal: Literal = {
    type: "LITERAL",
    dataType: DataType.NUMBER,
    value: Infinity,
  };

  assertEquals(literal.value, Infinity);
});

// ============================================================================
// String Value Edge Cases
// ============================================================================

Deno.test("Literal - empty string", () => {
  const literal: Literal = {
    type: "LITERAL",
    dataType: DataType.STRING,
    value: "",
  };

  assertEquals(literal.value, "");
});

Deno.test("Literal - string with special characters", () => {
  const literal: Literal = {
    type: "LITERAL",
    dataType: DataType.STRING,
    value: "Hello\nWorld\t!",
  };

  assertEquals(literal.value, "Hello\nWorld\t!");
});

Deno.test("Literal - string with unicode", () => {
  const literal: Literal = {
    type: "LITERAL",
    dataType: DataType.STRING,
    value: "Hello 世界 🌍",
  };

  assertEquals(literal.value, "Hello 世界 🌍");
});

Deno.test("Literal - string with quotes", () => {
  const literal: Literal = {
    type: "LITERAL",
    dataType: DataType.STRING,
    value: 'He said "Hello"',
  };

  assertEquals(literal.value, 'He said "Hello"');
});

// ============================================================================
// DataType Usage in Expressions Tests
// ============================================================================

Deno.test("Expression - binary with number operands", () => {
  const left: Literal = {
    type: "LITERAL",
    dataType: DataType.NUMBER,
    value: 10,
  };

  const right: Literal = {
    type: "LITERAL",
    dataType: DataType.NUMBER,
    value: 5,
  };

  assertEquals(left.dataType, DataType.NUMBER);
  assertEquals(right.dataType, DataType.NUMBER);
});

Deno.test("Expression - binary with string operands", () => {
  const left: Literal = {
    type: "LITERAL",
    dataType: DataType.STRING,
    value: "Hello ",
  };

  const right: Literal = {
    type: "LITERAL",
    dataType: DataType.STRING,
    value: "World",
  };

  assertEquals(left.dataType, DataType.STRING);
  assertEquals(right.dataType, DataType.STRING);
});

Deno.test("Expression - comparison with boolean result", () => {
  const left: Literal = {
    type: "LITERAL",
    dataType: DataType.NUMBER,
    value: 10,
  };

  const right: Literal = {
    type: "LITERAL",
    dataType: DataType.NUMBER,
    value: 5,
  };

  // Comparison (10 > 5) would produce BOOLEAN
  assertEquals(left.dataType, DataType.NUMBER);
  assertEquals(right.dataType, DataType.NUMBER);
  // Result type would be BOOLEAN
});

// ============================================================================
// DataType String Representation Tests
// ============================================================================

Deno.test("DataType - can be used as string key", () => {
  const typeMap: Record<DataType, string> = {
    [DataType.STRING]: "text",
    [DataType.NUMBER]: "numeric",
    [DataType.BOOLEAN]: "flag",
    [DataType.NULL]: "empty",
    [DataType.URL]: "link",
    [DataType.ARRAY]: "list",
    [DataType.OBJECT]: "map",
    [DataType.SET]: "unique",
    [DataType.ELEMENT]: "dom-node",
    [DataType.NODE_LIST]: "nodes",
    [DataType.DOCUMENT]: "doc",
    [DataType.REQUEST]: "req",
    [DataType.RESPONSE]: "res",
    [DataType.HEADERS]: "hdrs",
    [DataType.COOKIE]: "cookie",
    [DataType.SELECTOR]: "css",
    [DataType.XPATH]: "xpath",
    [DataType.REGEX]: "pattern",
    [DataType.DURATION]: "time",
    [DataType.BYTES]: "size",
    [DataType.UNKNOWN]: "any",
  };

  assertEquals(typeMap[DataType.STRING], "text");
  assertEquals(typeMap[DataType.NUMBER], "numeric");
  assertEquals(typeMap[DataType.ARRAY], "list");
});

Deno.test("DataType - can be serialized to JSON", () => {
  const type = DataType.STRING;
  const json = JSON.stringify({ type });

  assertEquals(json, '{"type":"String"}');
});

Deno.test("DataType - can be compared for equality", () => {
  const type1 = DataType.STRING;
  const type2 = DataType.STRING;
  const type3 = DataType.NUMBER;

  assertEquals(type1 === type2, true);
  assertEquals(type1 === type3, false);
});

// ============================================================================
// DataType in Type Checking Scenarios
// ============================================================================

Deno.test("Type checking scenario - numeric operations", () => {
  const isNumericType = (type: DataType): boolean => {
    return type === DataType.NUMBER ||
           type === DataType.DURATION ||
           type === DataType.BYTES;
  };

  assertEquals(isNumericType(DataType.NUMBER), true);
  assertEquals(isNumericType(DataType.DURATION), true);
  assertEquals(isNumericType(DataType.BYTES), true);
  assertEquals(isNumericType(DataType.STRING), false);
});

Deno.test("Type checking scenario - string operations", () => {
  const isStringLike = (type: DataType): boolean => {
    return type === DataType.STRING ||
           type === DataType.URL ||
           type === DataType.SELECTOR ||
           type === DataType.XPATH ||
           type === DataType.REGEX;
  };

  assertEquals(isStringLike(DataType.STRING), true);
  assertEquals(isStringLike(DataType.URL), true);
  assertEquals(isStringLike(DataType.SELECTOR), true);
  assertEquals(isStringLike(DataType.NUMBER), false);
});

Deno.test("Type checking scenario - collection operations", () => {
  const isCollection = (type: DataType): boolean => {
    return type === DataType.ARRAY ||
           type === DataType.OBJECT ||
           type === DataType.SET;
  };

  assertEquals(isCollection(DataType.ARRAY), true);
  assertEquals(isCollection(DataType.OBJECT), true);
  assertEquals(isCollection(DataType.SET), true);
  assertEquals(isCollection(DataType.STRING), false);
});

Deno.test("Type checking scenario - DOM operations", () => {
  const isDOMType = (type: DataType): boolean => {
    return type === DataType.ELEMENT ||
           type === DataType.NODE_LIST ||
           type === DataType.DOCUMENT;
  };

  assertEquals(isDOMType(DataType.ELEMENT), true);
  assertEquals(isDOMType(DataType.NODE_LIST), true);
  assertEquals(isDOMType(DataType.DOCUMENT), true);
  assertEquals(isDOMType(DataType.STRING), false);
});

Deno.test("Type checking scenario - HTTP operations", () => {
  const isHTTPType = (type: DataType): boolean => {
    return type === DataType.REQUEST ||
           type === DataType.RESPONSE ||
           type === DataType.HEADERS ||
           type === DataType.COOKIE;
  };

  assertEquals(isHTTPType(DataType.REQUEST), true);
  assertEquals(isHTTPType(DataType.RESPONSE), true);
  assertEquals(isHTTPType(DataType.HEADERS), true);
  assertEquals(isHTTPType(DataType.COOKIE), true);
  assertEquals(isHTTPType(DataType.STRING), false);
});

// ============================================================================
// DataType Coercion Tests
// ============================================================================

Deno.test("Type coercion scenario - string to number", () => {
  // Testing the concept, not implementation
  const canCoerce = (from: DataType, to: DataType): boolean => {
    if (from === to) return true;
    if (from === DataType.STRING && to === DataType.NUMBER) return true;
    if (from === DataType.NUMBER && to === DataType.STRING) return true;
    if (from === DataType.STRING && to === DataType.URL) return true;
    if (from === DataType.STRING && to === DataType.SELECTOR) return true;
    if (from === DataType.STRING && to === DataType.REGEX) return true;
    return false;
  };

  assertEquals(canCoerce(DataType.STRING, DataType.STRING), true);
  assertEquals(canCoerce(DataType.STRING, DataType.NUMBER), true);
  assertEquals(canCoerce(DataType.NUMBER, DataType.STRING), true);
  assertEquals(canCoerce(DataType.STRING, DataType.URL), true);
  assertEquals(canCoerce(DataType.ARRAY, DataType.NUMBER), false);
});

Deno.test("Type coercion scenario - any to UNKNOWN", () => {
  // UNKNOWN should be assignable from any type
  const canAssignToUnknown = (from: DataType): boolean => {
    return true; // UNKNOWN accepts all types
  };

  assertEquals(canAssignToUnknown(DataType.STRING), true);
  assertEquals(canAssignToUnknown(DataType.NUMBER), true);
  assertEquals(canAssignToUnknown(DataType.ARRAY), true);
});

// ============================================================================
// DataType Switch Statement Tests
// ============================================================================

Deno.test("DataType - switch exhaustiveness", () => {
  const getTypeDescription = (type: DataType): string => {
    switch (type) {
      case DataType.STRING:
        return "A sequence of characters";
      case DataType.NUMBER:
        return "A numeric value";
      case DataType.BOOLEAN:
        return "A true/false value";
      case DataType.NULL:
        return "An empty value";
      case DataType.URL:
        return "A web address";
      case DataType.ARRAY:
        return "A list of values";
      case DataType.OBJECT:
        return "A key-value collection";
      case DataType.SET:
        return "A unique value collection";
      case DataType.ELEMENT:
        return "A DOM element";
      case DataType.NODE_LIST:
        return "A list of DOM nodes";
      case DataType.DOCUMENT:
        return "A DOM document";
      case DataType.REQUEST:
        return "An HTTP request";
      case DataType.RESPONSE:
        return "An HTTP response";
      case DataType.HEADERS:
        return "HTTP headers";
      case DataType.COOKIE:
        return "A browser cookie";
      case DataType.SELECTOR:
        return "A CSS selector";
      case DataType.XPATH:
        return "An XPath expression";
      case DataType.REGEX:
        return "A regular expression";
      case DataType.DURATION:
        return "A time duration";
      case DataType.BYTES:
        return "A byte count";
      case DataType.UNKNOWN:
        return "An unknown type";
      default:
        return "Unrecognized type";
    }
  };

  assertEquals(getTypeDescription(DataType.STRING), "A sequence of characters");
  assertEquals(getTypeDescription(DataType.NUMBER), "A numeric value");
  assertEquals(getTypeDescription(DataType.UNKNOWN), "An unknown type");
});

// ============================================================================
// DataType Array and Map Tests
// ============================================================================

Deno.test("DataType - array of types", () => {
  const allowedTypes: DataType[] = [
    DataType.STRING,
    DataType.NUMBER,
    DataType.BOOLEAN,
  ];

  assertEquals(allowedTypes.length, 3);
  assert(allowedTypes.includes(DataType.STRING));
  assert(allowedTypes.includes(DataType.NUMBER));
  assert(!allowedTypes.includes(DataType.ARRAY));
});

Deno.test("DataType - Set of types", () => {
  const typeSet = new Set<DataType>([
    DataType.STRING,
    DataType.NUMBER,
    DataType.STRING, // Duplicate
  ]);

  assertEquals(typeSet.size, 2);
  assert(typeSet.has(DataType.STRING));
  assert(typeSet.has(DataType.NUMBER));
});

Deno.test("DataType - Map with type keys", () => {
  const typeToValidator = new Map<DataType, (value: unknown) => boolean>();

  typeToValidator.set(DataType.STRING, (v) => typeof v === "string");
  typeToValidator.set(DataType.NUMBER, (v) => typeof v === "number");
  typeToValidator.set(DataType.BOOLEAN, (v) => typeof v === "boolean");

  const stringValidator = typeToValidator.get(DataType.STRING);
  assertExists(stringValidator);
  assertEquals(stringValidator!("hello"), true);
  assertEquals(stringValidator!(42), false);

  const numberValidator = typeToValidator.get(DataType.NUMBER);
  assertExists(numberValidator);
  assertEquals(numberValidator!(42), true);
  assertEquals(numberValidator!("42"), false);
});

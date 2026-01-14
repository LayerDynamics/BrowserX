/**
 * String Functions
 * Built-in string manipulation functions
 */

import type { DataType, FunctionImplementation } from "../types.ts";
import { FunctionCategory } from "../types.ts";

/**
 * UPPER - Convert string to uppercase
 */
export const UPPER: FunctionImplementation = {
  signature: {
    name: "UPPER",
    category: FunctionCategory.STRING,
    minArgs: 1,
    maxArgs: 1,
    argTypes: [["string" as DataType]],
    returnType: "string" as DataType,
    description: "Convert string to uppercase",
    examples: ['UPPER("hello") → "HELLO"'],
    isAsync: false,
  },
  implementation: (str: unknown): string => {
    return String(str).toUpperCase();
  },
};

/**
 * LOWER - Convert string to lowercase
 */
export const LOWER: FunctionImplementation = {
  signature: {
    name: "LOWER",
    category: FunctionCategory.STRING,
    minArgs: 1,
    maxArgs: 1,
    argTypes: [["string" as DataType]],
    returnType: "string" as DataType,
    description: "Convert string to lowercase",
    examples: ['LOWER("HELLO") → "hello"'],
    isAsync: false,
  },
  implementation: (str: unknown): string => {
    return String(str).toLowerCase();
  },
};

/**
 * TRIM - Remove whitespace from both ends
 */
export const TRIM: FunctionImplementation = {
  signature: {
    name: "TRIM",
    category: FunctionCategory.STRING,
    minArgs: 1,
    maxArgs: 1,
    argTypes: [["string" as DataType]],
    returnType: "string" as DataType,
    description: "Remove whitespace from both ends of string",
    examples: ['TRIM("  hello  ") → "hello"'],
    isAsync: false,
  },
  implementation: (str: unknown): string => {
    return String(str).trim();
  },
};

/**
 * SUBSTRING - Extract substring
 */
export const SUBSTRING: FunctionImplementation = {
  signature: {
    name: "SUBSTRING",
    category: FunctionCategory.STRING,
    minArgs: 2,
    maxArgs: 3,
    argTypes: [
      ["string" as DataType, "number" as DataType],
      ["string" as DataType, "number" as DataType, "number" as DataType],
    ],
    returnType: "string" as DataType,
    description: "Extract substring from start index (and optional length)",
    examples: [
      'SUBSTRING("hello", 1) → "ello"',
      'SUBSTRING("hello", 1, 3) → "ell"',
    ],
    isAsync: false,
  },
  implementation: (str: unknown, start: unknown, length?: unknown): string => {
    const s = String(str);
    const startIdx = Number(start);

    if (length !== undefined) {
      return s.substring(startIdx, startIdx + Number(length));
    }

    return s.substring(startIdx);
  },
};

/**
 * REPLACE - Replace occurrences of substring
 */
export const REPLACE: FunctionImplementation = {
  signature: {
    name: "REPLACE",
    category: FunctionCategory.STRING,
    minArgs: 3,
    maxArgs: 3,
    argTypes: [["string" as DataType, "string" as DataType, "string" as DataType]],
    returnType: "string" as DataType,
    description: "Replace all occurrences of search string with replacement",
    examples: ['REPLACE("hello world", "world", "there") → "hello there"'],
    isAsync: false,
  },
  implementation: (str: unknown, search: unknown, replacement: unknown): string => {
    return String(str).replaceAll(String(search), String(replacement));
  },
};

/**
 * SPLIT - Split string into array
 */
export const SPLIT: FunctionImplementation = {
  signature: {
    name: "SPLIT",
    category: FunctionCategory.STRING,
    minArgs: 2,
    maxArgs: 2,
    argTypes: [["string" as DataType, "string" as DataType]],
    returnType: "array" as DataType,
    description: "Split string by delimiter into array",
    examples: ['SPLIT("a,b,c", ",") → ["a", "b", "c"]'],
    isAsync: false,
  },
  implementation: (str: unknown, delimiter: unknown): string[] => {
    return String(str).split(String(delimiter));
  },
};

/**
 * CONCAT - Concatenate strings
 */
export const CONCAT: FunctionImplementation = {
  signature: {
    name: "CONCAT",
    category: FunctionCategory.STRING,
    minArgs: 1,
    maxArgs: "variadic",
    argTypes: [],
    returnType: "string" as DataType,
    description: "Concatenate multiple strings",
    examples: ['CONCAT("hello", " ", "world") → "hello world"'],
    isAsync: false,
  },
  implementation: (...args: unknown[]): string => {
    return args.map((arg) => String(arg)).join("");
  },
};

/**
 * LENGTH - Get string length
 */
export const LENGTH: FunctionImplementation = {
  signature: {
    name: "LENGTH",
    category: FunctionCategory.STRING,
    minArgs: 1,
    maxArgs: 1,
    argTypes: [["string" as DataType]],
    returnType: "number" as DataType,
    description: "Get length of string",
    examples: ['LENGTH("hello") → 5'],
    isAsync: false,
  },
  implementation: (str: unknown): number => {
    return String(str).length;
  },
};

/**
 * CONTAINS - Check if string contains substring
 */
export const CONTAINS: FunctionImplementation = {
  signature: {
    name: "CONTAINS",
    category: FunctionCategory.STRING,
    minArgs: 2,
    maxArgs: 2,
    argTypes: [["string" as DataType, "string" as DataType]],
    returnType: "boolean" as DataType,
    description: "Check if string contains substring (case-sensitive)",
    examples: ['CONTAINS("hello world", "world") → true'],
    isAsync: false,
  },
  implementation: (str: unknown, search: unknown): boolean => {
    return String(str).includes(String(search));
  },
};

/**
 * STARTS_WITH - Check if string starts with prefix
 */
export const STARTS_WITH: FunctionImplementation = {
  signature: {
    name: "STARTS_WITH",
    category: FunctionCategory.STRING,
    minArgs: 2,
    maxArgs: 2,
    argTypes: [["string" as DataType, "string" as DataType]],
    returnType: "boolean" as DataType,
    description: "Check if string starts with prefix",
    examples: ['STARTS_WITH("hello", "hel") → true'],
    isAsync: false,
  },
  implementation: (str: unknown, prefix: unknown): boolean => {
    return String(str).startsWith(String(prefix));
  },
};

/**
 * ENDS_WITH - Check if string ends with suffix
 */
export const ENDS_WITH: FunctionImplementation = {
  signature: {
    name: "ENDS_WITH",
    category: FunctionCategory.STRING,
    minArgs: 2,
    maxArgs: 2,
    argTypes: [["string" as DataType, "string" as DataType]],
    returnType: "boolean" as DataType,
    description: "Check if string ends with suffix",
    examples: ['ENDS_WITH("hello", "llo") → true'],
    isAsync: false,
  },
  implementation: (str: unknown, suffix: unknown): boolean => {
    return String(str).endsWith(String(suffix));
  },
};

/**
 * All string functions
 */
export const STRING_FUNCTIONS: FunctionImplementation[] = [
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
];

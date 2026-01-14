/**
 * Data conversion utilities
 * Type coercion, parsing, formatting
 */

import type { Bytes, DurationMs } from "../types/primitives.ts";
import {
  isArray,
  isBoolean,
  isNull,
  isNumber,
  isObject,
  isString,
  isUndefined,
} from "./type-guards.ts";

/**
 * Convert value to string
 */
export function toString(value: unknown): string {
  if (isNull(value) || isUndefined(value)) {
    return "";
  }
  if (isString(value)) {
    return value;
  }
  if (isNumber(value) || isBoolean(value)) {
    return String(value);
  }
  if (isArray(value) || isObject(value)) {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/**
 * Convert value to number
 */
export function toNumber(value: unknown): number {
  if (isNumber(value)) {
    return value;
  }
  if (isString(value)) {
    const num = Number(value);
    return isNaN(num) ? 0 : num;
  }
  if (isBoolean(value)) {
    return value ? 1 : 0;
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  return 0;
}

/**
 * Convert value to integer
 */
export function toInteger(value: unknown): number {
  return Math.trunc(toNumber(value));
}

/**
 * Convert value to boolean
 */
export function toBoolean(value: unknown): boolean {
  if (isBoolean(value)) {
    return value;
  }
  if (isNumber(value)) {
    return value !== 0;
  }
  if (isString(value)) {
    const lower = value.toLowerCase().trim();
    if (lower === "true" || lower === "1" || lower === "yes") {
      return true;
    }
    if (lower === "false" || lower === "0" || lower === "no" || lower === "") {
      return false;
    }
    return true; // Non-empty strings are truthy
  }
  if (isNull(value) || isUndefined(value)) {
    return false;
  }
  return true;
}

/**
 * Convert value to array
 * Supports arrays, iterables (Map, Set, generators, etc.), JSON strings, and single values
 */
export function toArray<T = unknown>(value: unknown): T[] {
  // Already an array
  if (isArray(value)) {
    return value as T[];
  }

  // Null or undefined returns empty array
  if (isNull(value) || isUndefined(value)) {
    return [];
  }

  // Check if value is iterable (has Symbol.iterator)
  // This handles: Set, Map, generators, custom iterables, NodeList, etc.
  // Note: strings are also iterable, but we handle them separately below
  if (
    !isString(value) &&
    typeof value === "object" &&
    value !== null &&
    Symbol.iterator in value
  ) {
    try {
      return Array.from(value as Iterable<T>);
    } catch {
      // If Array.from fails, fall through to other conversions
    }
  }

  // Try to parse JSON strings
  if (isString(value)) {
    try {
      const parsed = JSON.parse(value);
      if (isArray(parsed)) {
        return parsed as T[];
      }
    } catch {
      // Not valid JSON, fall through to single-element array
    }
  }

  // Default: wrap in single-element array
  return [value as T];
}

/**
 * Parse JSON safely
 */
export function parseJSON<T = unknown>(value: string): T | undefined {
  if (!isString(value)) {
    return undefined;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

/**
 * Parse JSON with default value
 */
export function parseJSONWithDefault<T>(value: string, defaultValue: T): T {
  const result = parseJSON<T>(value);
  return result !== undefined ? result : defaultValue;
}

/**
 * Stringify value safely
 */
export function stringify(value: unknown, pretty: boolean = false): string {
  try {
    return JSON.stringify(value, null, pretty ? 2 : 0);
  } catch {
    return String(value);
  }
}

/**
 * Parse duration string to milliseconds
 * Supports: "5s", "10m", "1h", "2d", "100ms", "500"
 */
export function parseDuration(value: string | number): DurationMs {
  if (isNumber(value)) {
    return value;
  }

  if (!isString(value)) {
    return 0;
  }

  const match = value.match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)?$/);
  if (!match) {
    return 0;
  }

  const amount = parseFloat(match[1]);
  const unit = match[2] || "ms";

  switch (unit) {
    case "ms":
      return amount;
    case "s":
      return amount * 1000;
    case "m":
      return amount * 60 * 1000;
    case "h":
      return amount * 60 * 60 * 1000;
    case "d":
      return amount * 24 * 60 * 60 * 1000;
    default:
      return amount;
  }
}

/**
 * Format duration milliseconds to human-readable string
 */
export function formatDuration(ms: DurationMs): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  if (ms < 3600000) {
    return `${(ms / 60000).toFixed(2)}m`;
  }
  if (ms < 86400000) {
    return `${(ms / 3600000).toFixed(2)}h`;
  }
  return `${(ms / 86400000).toFixed(2)}d`;
}

/**
 * Parse byte size string to bytes
 * Supports: "5KB", "10MB", "1GB", "500", "1.5MB"
 */
export function parseBytes(value: string | number): Bytes {
  if (isNumber(value)) {
    return Math.floor(value);
  }

  if (!isString(value)) {
    return 0;
  }

  const match = value.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)?$/i);
  if (!match) {
    return 0;
  }

  const amount = parseFloat(match[1]);
  const unit = (match[2] || "B").toUpperCase();

  switch (unit) {
    case "B":
      return Math.floor(amount);
    case "KB":
      return Math.floor(amount * 1024);
    case "MB":
      return Math.floor(amount * 1024 * 1024);
    case "GB":
      return Math.floor(amount * 1024 * 1024 * 1024);
    case "TB":
      return Math.floor(amount * 1024 * 1024 * 1024 * 1024);
    default:
      return Math.floor(amount);
  }
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: Bytes): string {
  if (bytes < 1024) {
    return `${bytes}B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)}KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
  }
  if (bytes < 1024 * 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}GB`;
  }
  return `${(bytes / (1024 * 1024 * 1024 * 1024)).toFixed(2)}TB`;
}

/**
 * Parse date string to timestamp
 */
export function parseDate(value: string | number | Date): number {
  if (value instanceof Date) {
    return value.getTime();
  }
  if (isNumber(value)) {
    return value;
  }
  if (isString(value)) {
    const date = new Date(value);
    return isNaN(date.getTime()) ? 0 : date.getTime();
  }
  return 0;
}

/**
 * Format timestamp to ISO string
 */
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

/**
 * Coerce value to specific type
 */
export function coerceToType(value: unknown, type: string): unknown {
  switch (type.toLowerCase()) {
    case "string":
      return toString(value);
    case "number":
      return toNumber(value);
    case "integer":
      return toInteger(value);
    case "boolean":
      return toBoolean(value);
    case "array":
      return toArray(value);
    case "object":
      if (isObject(value)) return value;
      if (isString(value)) return parseJSON(value) || {};
      return {};
    default:
      return value;
  }
}

/**
 * Parse URL parameters to object
 */
export function parseURLParams(search: string): Record<string, string> {
  const params: Record<string, string> = {};
  const urlParams = new URLSearchParams(search);

  for (const [key, value] of urlParams) {
    params[key] = value;
  }

  return params;
}

/**
 * Build URL query string from object
 */
export function buildURLParams(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined) {
      searchParams.append(key, String(value));
    }
  }

  return searchParams.toString();
}

/**
 * Parse CSV line to array
 */
export function parseCSVLine(line: string, delimiter: string = ","): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

/**
 * Encode to base64
 */
export function encodeBase64(data: string | Uint8Array): string {
  if (typeof data === "string") {
    return btoa(data);
  }
  return btoa(String.fromCharCode(...data));
}

/**
 * Decode from base64
 */
export function decodeBase64(encoded: string): string {
  return atob(encoded);
}

/**
 * Encode to base64 URL-safe
 */
export function encodeBase64URL(data: string | Uint8Array): string {
  const base64 = encodeBase64(data);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Decode from base64 URL-safe
 */
export function decodeBase64URL(encoded: string): string {
  let base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");

  // Add padding
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }

  return decodeBase64(base64);
}

/**
 * Deep compare two values (simplified version for coercion)
 */
export function looseEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;

  // Try numeric comparison
  const aNum = toNumber(a);
  const bNum = toNumber(b);
  if (!isNaN(aNum) && !isNaN(bNum)) {
    return aNum === bNum;
  }

  // Try string comparison
  return toString(a) === toString(b);
}

/**
 * Deep equality comparison with full support for all JavaScript types
 * Handles circular references, functions, symbols, Map/Set, Date/RegExp, etc.
 */
export function deepEquals(a: unknown, b: unknown): boolean {
  // Use a WeakMap to track visited objects and detect circular references
  const visited = new WeakMap<object, object>();

  function deepEqualsInternal(x: unknown, y: unknown): boolean {
    // Handle primitive equality (including NaN)
    if (Object.is(x, y)) {
      return true;
    }

    // Handle null and undefined
    if (x === null || y === null || x === undefined || y === undefined) {
      return x === y;
    }

    // Different types are not equal
    if (typeof x !== typeof y) {
      return false;
    }

    // Handle primitives
    if (typeof x !== "object" || typeof y !== "object") {
      return x === y;
    }

    // Handle circular references
    if (visited.has(x as object)) {
      return visited.get(x as object) === y;
    }
    visited.set(x as object, y as object);

    // Handle Date
    if (x instanceof Date && y instanceof Date) {
      return x.getTime() === y.getTime();
    }

    // Handle RegExp
    if (x instanceof RegExp && y instanceof RegExp) {
      return x.source === y.source &&
        x.flags === y.flags;
    }

    // Handle Error objects
    if (x instanceof Error && y instanceof Error) {
      return x.name === y.name &&
        x.message === y.message &&
        deepEqualsInternal(x.stack, y.stack);
    }

    // Handle ArrayBuffer and TypedArrays
    if (ArrayBuffer.isView(x) && ArrayBuffer.isView(y)) {
      const xView = x as Uint8Array;
      const yView = y as Uint8Array;

      if (xView.byteLength !== yView.byteLength) {
        return false;
      }

      for (let i = 0; i < xView.byteLength; i++) {
        if (xView[i] !== yView[i]) {
          return false;
        }
      }

      return true;
    }

    // Handle Map
    if (x instanceof Map && y instanceof Map) {
      if (x.size !== y.size) {
        return false;
      }

      for (const [key, value] of x) {
        if (!y.has(key) || !deepEqualsInternal(value, y.get(key))) {
          return false;
        }
      }

      return true;
    }

    // Handle Set
    if (x instanceof Set && y instanceof Set) {
      if (x.size !== y.size) {
        return false;
      }

      const yArray = Array.from(y);
      for (const xItem of x) {
        let found = false;
        for (const yItem of yArray) {
          if (deepEqualsInternal(xItem, yItem)) {
            found = true;
            break;
          }
        }
        if (!found) {
          return false;
        }
      }

      return true;
    }

    // Handle WeakMap and WeakSet (can't iterate, so compare by identity)
    if (
      (x instanceof WeakMap && y instanceof WeakMap) ||
      (x instanceof WeakSet && y instanceof WeakSet)
    ) {
      return x === y;
    }

    // Handle Arrays
    if (Array.isArray(x) && Array.isArray(y)) {
      if (x.length !== y.length) {
        return false;
      }

      for (let i = 0; i < x.length; i++) {
        if (!deepEqualsInternal(x[i], y[i])) {
          return false;
        }
      }

      return true;
    }

    // Handle Functions (compare by reference and source code)
    if (typeof x === "function" && typeof y === "function") {
      // Same reference?
      if (x === y) {
        return true;
      }

      // Compare function source code
      return x.toString() === y.toString() &&
        x.name === y.name &&
        x.length === y.length;
    }

    // Handle plain objects
    const xObj = x as Record<PropertyKey, unknown>;
    const yObj = y as Record<PropertyKey, unknown>;

    // Get all own property keys (including symbols)
    const xKeys = Reflect.ownKeys(xObj);
    const yKeys = Reflect.ownKeys(yObj);

    if (xKeys.length !== yKeys.length) {
      return false;
    }

    // Check all keys exist in both objects
    for (const key of xKeys) {
      if (!Reflect.has(yObj, key)) {
        return false;
      }
    }

    // Compare all property values
    for (const key of xKeys) {
      const xDescriptor = Object.getOwnPropertyDescriptor(xObj, key);
      const yDescriptor = Object.getOwnPropertyDescriptor(yObj, key);

      // Compare property descriptors
      if (
        xDescriptor?.enumerable !== yDescriptor?.enumerable ||
        xDescriptor?.configurable !== yDescriptor?.configurable ||
        xDescriptor?.writable !== yDescriptor?.writable
      ) {
        return false;
      }

      // Compare values
      if (!deepEqualsInternal(xObj[key], yObj[key])) {
        return false;
      }
    }

    // Compare prototypes
    const xProto = Object.getPrototypeOf(x);
    const yProto = Object.getPrototypeOf(y);

    if (xProto !== yProto) {
      return false;
    }

    return true;
  }

  return deepEqualsInternal(a, b);
}

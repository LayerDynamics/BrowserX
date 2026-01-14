/**
 * Type guard utilities
 * Comprehensive type checking functions with TypeScript type narrowing
 */

import type { Bytes, DurationMs, Timestamp, URLString } from "../types/primitives.ts";

/**
 * Check if value is string
 */
export function isString(value: unknown): value is string {
  return typeof value === "string";
}

/**
 * Check if value is non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/**
 * Check if value is number
 */
export function isNumber(value: unknown): value is number {
  return typeof value === "number" && !isNaN(value);
}

/**
 * Check if value is finite number (not NaN or Infinity)
 */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && isFinite(value);
}

/**
 * Check if value is integer
 */
export function isInteger(value: unknown): value is number {
  return isNumber(value) && Number.isInteger(value);
}

/**
 * Check if value is positive number
 */
export function isPositiveNumber(value: unknown): value is number {
  return isNumber(value) && value > 0;
}

/**
 * Check if value is non-negative number
 */
export function isNonNegativeNumber(value: unknown): value is number {
  return isNumber(value) && value >= 0;
}

/**
 * Check if value is boolean
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

/**
 * Check if value is null
 */
export function isNull(value: unknown): value is null {
  return value === null;
}

/**
 * Check if value is undefined
 */
export function isUndefined(value: unknown): value is undefined {
  return value === undefined;
}

/**
 * Check if value is null or undefined
 */
export function isNullish(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

/**
 * Check if value is function
 */
export function isFunction(value: unknown): value is Function {
  return typeof value === "function";
}

/**
 * Check if value is object (excluding null and arrays)
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Check if value is plain object (not class instance)
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!isObject(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

/**
 * Check if value is array
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * Check if value is non-empty array
 */
export function isNonEmptyArray(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.length > 0;
}

/**
 * Check if value is array of specific type
 */
export function isArrayOf<T>(
  value: unknown,
  guard: (item: unknown) => item is T,
): value is T[] {
  return Array.isArray(value) && value.every(guard);
}

/**
 * Check if value is Date
 */
export function isDate(value: unknown): value is Date {
  return value instanceof Date && !isNaN(value.getTime());
}

/**
 * Check if value is RegExp
 */
export function isRegExp(value: unknown): value is RegExp {
  return value instanceof RegExp;
}

/**
 * Check if value is Error
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Check if value is Promise
 */
export function isPromise(value: unknown): value is Promise<unknown> {
  return value instanceof Promise ||
    (isObject(value) && isFunction((value as any).then));
}

/**
 * Check if value is Uint8Array
 */
export function isUint8Array(value: unknown): value is Uint8Array {
  return value instanceof Uint8Array;
}

/**
 * Check if value is Map
 */
export function isMap(value: unknown): value is Map<unknown, unknown> {
  return value instanceof Map;
}

/**
 * Check if value is Set
 */
export function isSet(value: unknown): value is Set<unknown> {
  return value instanceof Set;
}

/**
 * Check if value is empty (null, undefined, empty string, empty array, empty object)
 */
export function isEmpty(value: unknown): boolean {
  if (isNullish(value)) return true;
  if (isString(value)) return value.length === 0;
  if (isArray(value)) return value.length === 0;
  if (isObject(value)) return Object.keys(value).length === 0;
  if (isMap(value)) return value.size === 0;
  if (isSet(value)) return value.size === 0;
  return false;
}

/**
 * Check if value is valid URL string
 */
export function isURLString(value: unknown): value is URLString {
  if (!isString(value)) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if value is valid HTTP/HTTPS URL
 */
export function isHTTPURL(value: unknown): value is URLString {
  if (!isURLString(value)) return false;
  const url = new URL(value);
  return url.protocol === "http:" || url.protocol === "https:";
}

/**
 * Check if value is valid duration in milliseconds
 */
export function isDurationMs(value: unknown): value is DurationMs {
  return isNonNegativeNumber(value);
}

/**
 * Check if value is valid timestamp
 */
export function isTimestamp(value: unknown): value is Timestamp {
  return isNonNegativeNumber(value);
}

/**
 * Check if value is valid byte count
 */
export function isBytes(value: unknown): value is Bytes {
  return isNonNegativeNumber(value) && isInteger(value);
}

/**
 * Check if value looks like a CSS selector
 */
export function isCSSSelector(value: unknown): boolean {
  if (!isString(value) || value.length === 0) return false;
  // Basic CSS selector patterns
  return /^[#.\[a-zA-Z]/.test(value);
}

/**
 * Check if value looks like an XPath expression
 */
export function isXPath(value: unknown): boolean {
  if (!isString(value) || value.length === 0) return false;
  // Basic XPath patterns
  return value.startsWith("/") || value.startsWith("(") || value.includes("::");
}

/**
 * Check if value is valid JSON string
 */
export function isJSONString(value: unknown): value is string {
  if (!isString(value)) return false;
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if value is iterable
 */
export function isIterable(value: unknown): value is Iterable<unknown> {
  if (isNullish(value)) return false;
  return isFunction((value as any)[Symbol.iterator]);
}

/**
 * Check if value is async iterable
 */
export function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  if (isNullish(value)) return false;
  return isFunction((value as any)[Symbol.asyncIterator]);
}

/**
 * Type guard factory for specific string literals
 */
export function isOneOf<T extends string>(
  ...values: T[]
): (value: unknown) => value is T {
  const set = new Set(values);
  return (value: unknown): value is T => {
    return isString(value) && set.has(value as any);
  };
}

/**
 * Check if value has specific property
 */
export function hasProperty<K extends string>(
  value: unknown,
  key: K,
): value is Record<K, unknown> {
  return isObject(value) && key in value;
}

/**
 * Check if value has all specified properties
 */
export function hasProperties<K extends string>(
  value: unknown,
  ...keys: K[]
): value is Record<K, unknown> {
  return isObject(value) && keys.every((key) => key in value);
}

/**
 * Assert value is defined (throw if null/undefined)
 */
export function assertDefined<T>(
  value: T | null | undefined,
  message?: string,
): asserts value is T {
  if (isNullish(value)) {
    throw new Error(message || "Value is null or undefined");
  }
}

/**
 * Assert value matches guard (throw if doesn't match)
 */
export function assertGuard<T>(
  value: unknown,
  guard: (v: unknown) => v is T,
  message?: string,
): asserts value is T {
  if (!guard(value)) {
    throw new Error(message || "Value does not match type guard");
  }
}

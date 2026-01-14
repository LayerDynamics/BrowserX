/**
 * Object utility functions
 * Deep operations, equality checking, merging, path access
 */

import { isArray, isDate, isObject, isRegExp } from "./type-guards.ts";

/**
 * Deep clone object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as any;
  }

  if (obj instanceof RegExp) {
    return new RegExp(obj.source, obj.flags) as any;
  }

  if (obj instanceof Map) {
    return new Map(Array.from(obj.entries()).map(([k, v]) => [k, deepClone(v)])) as any;
  }

  if (obj instanceof Set) {
    return new Set(Array.from(obj).map((v) => deepClone(v))) as any;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => deepClone(item)) as any;
  }

  if (obj instanceof Uint8Array) {
    return new Uint8Array(obj) as any;
  }

  const cloned: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone((obj as any)[key]);
    }
  }

  return cloned;
}

/**
 * Deep merge objects (later objects override earlier ones)
 */
export function deepMerge<T extends Record<string, any>>(...objects: Partial<T>[]): T {
  const result: any = {};

  for (const obj of objects) {
    if (!isObject(obj)) continue;

    for (const key in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;

      const value = obj[key];

      if (isObject(value) && isObject(result[key])) {
        result[key] = deepMerge(result[key], value);
      } else {
        result[key] = deepClone(value);
      }
    }
  }

  return result;
}

/**
 * Deep equality check (handles objects, arrays, dates, regexes, maps, sets)
 */
export function isEqual(a: unknown, b: unknown): boolean {
  // Same reference or primitive equality
  if (a === b) return true;

  // Null/undefined check
  if (a == null || b == null) return a === b;

  // Type check
  if (typeof a !== typeof b) return false;

  // Date
  if (isDate(a) && isDate(b)) {
    return a.getTime() === b.getTime();
  }

  // RegExp
  if (isRegExp(a) && isRegExp(b)) {
    return a.source === b.source && a.flags === b.flags;
  }

  // Map
  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) return false;
    for (const [key, value] of a) {
      if (!b.has(key) || !isEqual(value, b.get(key))) {
        return false;
      }
    }
    return true;
  }

  // Set
  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size) return false;
    for (const value of a) {
      if (!b.has(value)) return false;
    }
    return true;
  }

  // Uint8Array
  if (a instanceof Uint8Array && b instanceof Uint8Array) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  // Array
  if (isArray(a) && isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!isEqual(a[i], b[i])) return false;
    }
    return true;
  }

  // Object
  if (isObject(a) && isObject(b)) {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
      if (!isEqual(a[key], b[key])) return false;
    }

    return true;
  }

  return false;
}

/**
 * Get nested property by path
 */
export function get(obj: any, path: string | string[], defaultValue?: unknown): unknown {
  const keys = Array.isArray(path) ? path : path.split(".");

  let current = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") {
      return defaultValue;
    }
    current = current[key];
  }

  return current === undefined ? defaultValue : current;
}

/**
 * Set nested property by path
 */
export function set(obj: any, path: string | string[], value: unknown): void {
  const keys = Array.isArray(path) ? path : path.split(".");
  const lastKey = keys.pop();

  if (!lastKey) return;

  let current = obj;
  for (const key of keys) {
    if (!(key in current) || typeof current[key] !== "object") {
      current[key] = {};
    }
    current = current[key];
  }

  current[lastKey] = value;
}

/**
 * Check if object has nested property
 */
export function has(obj: any, path: string | string[]): boolean {
  const keys = Array.isArray(path) ? path : path.split(".");

  let current = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object" || !(key in current)) {
      return false;
    }
    current = current[key];
  }

  return true;
}

/**
 * Delete nested property by path
 */
export function unset(obj: any, path: string | string[]): boolean {
  const keys = Array.isArray(path) ? path : path.split(".");
  const lastKey = keys.pop();

  if (!lastKey) return false;

  let current = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") {
      return false;
    }
    current = current[key];
  }

  if (current != null && typeof current === "object" && lastKey in current) {
    delete current[lastKey];
    return true;
  }

  return false;
}

/**
 * Pick specified keys from object
 */
export function pick<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[],
): Pick<T, K> {
  const result: any = {};

  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }

  return result;
}

/**
 * Omit specified keys from object
 */
export function omit<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[],
): Omit<T, K> {
  const result: any = { ...obj };
  const keySet = new Set(keys);

  for (const key in result) {
    if (keySet.has(key as any)) {
      delete result[key];
    }
  }

  return result;
}

/**
 * Map object values
 */
export function mapValues<T extends Record<string, any>, U>(
  obj: T,
  mapper: (value: T[keyof T], key: keyof T) => U,
): Record<keyof T, U> {
  const result: any = {};

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      result[key] = mapper(obj[key], key);
    }
  }

  return result;
}

/**
 * Map object keys
 */
export function mapKeys<T extends Record<string, any>>(
  obj: T,
  mapper: (key: keyof T, value: T[keyof T]) => string,
): Record<string, T[keyof T]> {
  const result: any = {};

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const newKey = mapper(key, obj[key]);
      result[newKey] = obj[key];
    }
  }

  return result;
}

/**
 * Filter object by predicate
 */
export function filterObject<T extends Record<string, any>>(
  obj: T,
  predicate: (value: T[keyof T], key: keyof T) => boolean,
): Partial<T> {
  const result: any = {};

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      if (predicate(obj[key], key)) {
        result[key] = obj[key];
      }
    }
  }

  return result;
}

/**
 * Invert object (swap keys and values)
 */
export function invert<T extends Record<string, string | number>>(
  obj: T,
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      result[String(obj[key])] = key;
    }
  }

  return result;
}

/**
 * Flatten nested object to dot notation
 */
export function flatten(obj: any, prefix: string = ""): Record<string, any> {
  const result: Record<string, any> = {};

  for (const key in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;

    const value = obj[key];
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (isObject(value) && !isDate(value) && !isRegExp(value)) {
      Object.assign(result, flatten(value, newKey));
    } else {
      result[newKey] = value;
    }
  }

  return result;
}

/**
 * Unflatten dot notation object
 */
export function unflatten(obj: Record<string, any>): any {
  const result: any = {};

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      set(result, key, obj[key]);
    }
  }

  return result;
}

/**
 * Get all paths in nested object
 */
export function paths(obj: any, prefix: string = ""): string[] {
  const result: string[] = [];

  for (const key in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;

    const value = obj[key];
    const path = prefix ? `${prefix}.${key}` : key;

    result.push(path);

    if (isObject(value) && !isDate(value) && !isRegExp(value)) {
      result.push(...paths(value, path));
    }
  }

  return result;
}

/**
 * Freeze object deeply (immutable)
 */
export function deepFreeze<T>(obj: T): Readonly<T> {
  Object.freeze(obj);

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = (obj as any)[key];
      if (value != null && typeof value === "object" && !Object.isFrozen(value)) {
        deepFreeze(value);
      }
    }
  }

  return obj;
}

/**
 * Check if object is empty
 */
export function isEmpty(obj: any): boolean {
  if (obj == null) return true;
  if (isArray(obj) || typeof obj === "string") return obj.length === 0;
  if (obj instanceof Map || obj instanceof Set) return obj.size === 0;
  if (isObject(obj)) return Object.keys(obj).length === 0;
  return false;
}

/**
 * Compact object (remove null/undefined values)
 */
export function compact<T extends Record<string, any>>(obj: T): Partial<T> {
  return filterObject(obj, (value) => value != null);
}

/**
 * Defaults - fill in undefined properties
 */
export function defaults<T extends Record<string, any>>(
  obj: T,
  ...sources: Partial<T>[]
): T {
  const result = { ...obj };

  for (const source of sources) {
    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        if (result[key] === undefined) {
          result[key] = source[key] as any;
        }
      }
    }
  }

  return result;
}

/**
 * Object size (number of own properties)
 */
export function size(obj: any): number {
  if (obj == null) return 0;
  if (isArray(obj) || typeof obj === "string") return obj.length;
  if (obj instanceof Map || obj instanceof Set) return obj.size;
  if (isObject(obj)) return Object.keys(obj).length;
  return 0;
}

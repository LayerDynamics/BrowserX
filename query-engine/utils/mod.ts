/**
 * Utils module exports
 * Comprehensive utility functions for query engine
 */

// Type guards
export * from "./type-guards.ts";

// Validation
export * from "./validation.ts";

// String utilities (has toString, avoid conflict with data-conversion)
export {
  capitalize,
  countOccurrences,
  dedent,
  escapeRegex,
  escapeString,
  indent,
  interpolate,
  levenshteinDistance,
  matchesLike,
  matchesPattern,
  padLeft,
  padRight,
  repeat,
  reverse,
  slugify,
  stringSimilarity,
  toCamelCase,
  toKebabCase,
  toPascalCase,
  toSnakeCase,
  truncate,
  unescapeString,
  wrapText,
} from "./string-utils.ts";

// Array utilities (has compact and flatten, avoid conflicts with object-utils)
export {
  binarySearch,
  chunk,
  compact as compactArray,
  type DependencyGraph,
  difference,
  drop,
  flatten as flattenArray,
  flattenDepth,
  groupBy,
  intersection,
  partition,
  sample,
  shuffle,
  sortBy,
  symmetricDifference,
  take,
  topologicalSort,
  union,
  unique,
  uniqueBy,
  unzip,
  zip,
} from "./array-utils.ts";

// Object utilities (has isEmpty, compact, flatten)
export {
  compact as compactObject,
  deepClone,
  deepMerge,
  defaults,
  flatten as flattenObject,
  get,
  has,
  invert,
  isEmpty as isObjectEmpty,
  isEqual,
  mapKeys,
  mapValues,
  omit,
  pick,
  set,
  unflatten,
  unset,
} from "./object-utils.ts";

// Error utilities
export * from "./error-utils.ts";

// Performance utilities (has formatDuration)
export {
  createTimer,
  debounce,
  formatDuration as formatDurationMs,
  globalProfiler,
  measure,
  measureAsync,
  measureAsyncWith,
  measureWith,
  memoize,
  once,
  Profiler,
  throttle,
} from "./performance-utils.ts";

// Cache utilities
export * from "./cache-utils.ts";

// Data conversion (has toString, formatDuration)
export {
  buildURLParams,
  coerceToType,
  decodeBase64,
  decodeBase64URL,
  encodeBase64,
  encodeBase64URL,
  formatBytes,
  formatDate,
  formatDuration,
  looseEqual,
  parseBytes,
  parseCSVLine,
  parseDate,
  parseDuration,
  parseJSON,
  parseJSONWithDefault,
  parseURLParams,
  stringify,
  toArray,
  toBoolean,
  toInteger,
  toNumber,
  toString,
} from "./data-conversion.ts";

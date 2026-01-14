/**
 * Browser Module - Root Exports
 *
 * Root module aggregating all browser components following Deno conventions.
 */

// Re-export everything from lib
export * from "./lib.ts";

// Re-export Browser API for query-engine integration
export * from "./api/mod.ts";

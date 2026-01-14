/**
 * Network Schema
 * Maps field names to HTTP request/response properties
 */

import type { DataType, NetworkSchemaEntry, SchemaResolutionResult } from "./types.ts";

/**
 * Built-in network schema mappings
 * Field name → request/response property path
 */
const NETWORK_SCHEMA = new Map<string, NetworkSchemaEntry>([
  // Request fields
  ["request.url", {
    field: "request.url",
    source: "request",
    path: ["url"],
    type: "url" as DataType,
    description: "Request URL",
  }],

  ["request.method", {
    field: "request.method",
    source: "request",
    path: ["method"],
    type: "string" as DataType,
    description: "HTTP method (GET, POST, etc.)",
  }],

  ["request.headers", {
    field: "request.headers",
    source: "request",
    path: ["headers"],
    type: "object" as DataType,
    description: "Request headers",
  }],

  ["request.body", {
    field: "request.body",
    source: "request",
    path: ["body"],
    type: "buffer" as DataType,
    description: "Request body",
  }],

  ["request.version", {
    field: "request.version",
    source: "request",
    path: ["version"],
    type: "string" as DataType,
    description: "HTTP version (1.1, 2.0, etc.)",
  }],

  ["request.initiator", {
    field: "request.initiator",
    source: "request",
    path: ["initiator"],
    type: "string" as DataType,
    description: "Request initiator (navigation, parser, script, etc.)",
  }],

  // Response fields
  ["response.status", {
    field: "response.status",
    source: "response",
    path: ["statusCode"],
    type: "number" as DataType,
    description: "HTTP status code",
  }],

  ["response.statusText", {
    field: "response.statusText",
    source: "response",
    path: ["statusText"],
    type: "string" as DataType,
    description: "HTTP status text",
  }],

  ["response.headers", {
    field: "response.headers",
    source: "response",
    path: ["headers"],
    type: "object" as DataType,
    description: "Response headers",
  }],

  ["response.body", {
    field: "response.body",
    source: "response",
    path: ["body"],
    type: "buffer" as DataType,
    description: "Response body",
  }],

  ["response.version", {
    field: "response.version",
    source: "response",
    path: ["version"],
    type: "string" as DataType,
    description: "HTTP version",
  }],

  ["response.cached", {
    field: "response.cached",
    source: "response",
    path: ["fromCache"],
    type: "boolean" as DataType,
    description: "Whether response was served from cache",
  }],

  ["response.contentType", {
    field: "response.contentType",
    source: "response",
    path: ["headers", "content-type"],
    type: "string" as DataType,
    description: "Content-Type header",
  }],

  ["response.contentLength", {
    field: "response.contentLength",
    source: "response",
    path: ["headers", "content-length"],
    type: "number" as DataType,
    description: "Content-Length header",
  }],

  // Timing fields
  ["timing.dns", {
    field: "timing.dns",
    source: "timing",
    path: ["dnsTime"],
    type: "number" as DataType,
    description: "DNS resolution time (ms)",
  }],

  ["timing.tcp", {
    field: "timing.tcp",
    source: "timing",
    path: ["tcpTime"],
    type: "number" as DataType,
    description: "TCP connection time (ms)",
  }],

  ["timing.tls", {
    field: "timing.tls",
    source: "timing",
    path: ["tlsTime"],
    type: "number" as DataType,
    description: "TLS handshake time (ms)",
  }],

  ["timing.request", {
    field: "timing.request",
    source: "timing",
    path: ["requestTime"],
    type: "number" as DataType,
    description: "Request send time (ms)",
  }],

  ["timing.response", {
    field: "timing.response",
    source: "timing",
    path: ["responseTime"],
    type: "number" as DataType,
    description: "Response receive time (ms)",
  }],

  ["timing.total", {
    field: "timing.total",
    source: "timing",
    path: ["totalTime"],
    type: "number" as DataType,
    description: "Total request time (ms)",
  }],

  ["timing.ttfb", {
    field: "timing.ttfb",
    source: "timing",
    path: ["ttfb"],
    type: "number" as DataType,
    description: "Time to first byte (ms)",
  }],

  // Common header shortcuts
  ["header.contentType", {
    field: "header.contentType",
    source: "response",
    path: ["headers", "content-type"],
    type: "string" as DataType,
    description: "Content-Type response header",
  }],

  ["header.cacheControl", {
    field: "header.cacheControl",
    source: "response",
    path: ["headers", "cache-control"],
    type: "string" as DataType,
    description: "Cache-Control response header",
  }],

  ["header.etag", {
    field: "header.etag",
    source: "response",
    path: ["headers", "etag"],
    type: "string" as DataType,
    description: "ETag response header",
  }],

  ["header.lastModified", {
    field: "header.lastModified",
    source: "response",
    path: ["headers", "last-modified"],
    type: "string" as DataType,
    description: "Last-Modified response header",
  }],

  ["header.location", {
    field: "header.location",
    source: "response",
    path: ["headers", "location"],
    type: "string" as DataType,
    description: "Location redirect header",
  }],

  ["header.setCookie", {
    field: "header.setCookie",
    source: "response",
    path: ["headers", "set-cookie"],
    type: "string" as DataType,
    description: "Set-Cookie response header",
  }],
]);

/**
 * Resolve field name to network schema entry
 */
export function resolveNetworkField(field: string): SchemaResolutionResult {
  const entry = NETWORK_SCHEMA.get(field.toLowerCase());

  if (!entry) {
    return {
      found: false,
      error: `Unknown network field: ${field}`,
    };
  }

  return {
    found: true,
    entry,
  };
}

/**
 * Register custom network field
 */
export function registerNetworkField(entry: NetworkSchemaEntry): void {
  const field = entry.field.toLowerCase();

  if (NETWORK_SCHEMA.has(field)) {
    throw new Error(`Network field ${field} is already registered`);
  }

  NETWORK_SCHEMA.set(field, entry);
}

/**
 * Get all registered network fields
 */
export function getAllNetworkFields(): string[] {
  return Array.from(NETWORK_SCHEMA.keys());
}

/**
 * Check if field is registered
 */
export function hasNetworkField(field: string): boolean {
  return NETWORK_SCHEMA.has(field.toLowerCase());
}

/**
 * Get network schema entry
 */
export function getNetworkSchemaEntry(field: string): NetworkSchemaEntry | undefined {
  return NETWORK_SCHEMA.get(field.toLowerCase());
}

/**
 * Extract value from request/response using schema entry
 */
export function extractNetworkValue(
  entry: NetworkSchemaEntry,
  data: { request?: unknown; response?: unknown; timing?: unknown },
): unknown {
  const source = data[entry.source];

  if (!source || typeof source !== "object") {
    return undefined;
  }

  // Navigate path to extract value
  let value: any = source;

  for (const key of entry.path) {
    if (value && typeof value === "object" && key in value) {
      value = (value as any)[key];
    } else {
      return undefined;
    }
  }

  return value;
}

/**
 * Clear all custom network fields (keeps built-in fields)
 */
export function clearCustomNetworkFields(): void {
  // Store built-in fields
  const builtinFields = new Map(NETWORK_SCHEMA);

  // Clear all
  NETWORK_SCHEMA.clear();

  // Restore built-in fields
  for (const [key, value] of builtinFields) {
    NETWORK_SCHEMA.set(key, value);
  }
}

/**
 * HTTP HTTPHeaders Utilities
 *
 * Utilities for manipulating HTTP headers
 */

/**
 * HTTP headers type (case-insensitive keys)
 */
export type HTTPHeaders = Record<string, string>;

/**
 * Normalize header name to lowercase
 */
export function normalizeHeaderName(name: string): string {
  return name.toLowerCase().trim();
}

/**
 * Get header value (case-insensitive)
 */
export function getHeader(headers: HTTPHeaders, name: string): string | undefined {
  const normalizedName = normalizeHeaderName(name);

  for (const [key, value] of Object.entries(headers)) {
    if (normalizeHeaderName(key) === normalizedName) {
      return value;
    }
  }

  return undefined;
}

/**
 * Set header value (case-insensitive, replaces existing)
 */
export function setHeader(
  headers: HTTPHeaders,
  name: string,
  value: string,
): HTTPHeaders {
  const normalizedName = normalizeHeaderName(name);

  // Remove existing header with any casing
  const newHTTPHeaders: HTTPHeaders = {};
  for (const [key, val] of Object.entries(headers)) {
    if (normalizeHeaderName(key) !== normalizedName) {
      newHTTPHeaders[key] = val;
    }
  }

  // Add new header
  newHTTPHeaders[normalizedName] = value;

  return newHTTPHeaders;
}

/**
 * Delete header (case-insensitive)
 */
export function deleteHeader(headers: HTTPHeaders, name: string): HTTPHeaders {
  const normalizedName = normalizeHeaderName(name);
  const newHTTPHeaders: HTTPHeaders = {};

  for (const [key, value] of Object.entries(headers)) {
    if (normalizeHeaderName(key) !== normalizedName) {
      newHTTPHeaders[key] = value;
    }
  }

  return newHTTPHeaders;
}

/**
 * Check if header exists (case-insensitive)
 */
export function hasHeader(headers: HTTPHeaders, name: string): boolean {
  return getHeader(headers, name) !== undefined;
}

/**
 * Merge multiple headers objects (later values override earlier)
 */
export function mergeHTTPHeaders(...headerSets: HTTPHeaders[]): HTTPHeaders {
  const merged: HTTPHeaders = {};

  for (const headers of headerSets) {
    for (const [name, value] of Object.entries(headers)) {
      const normalizedName = normalizeHeaderName(name);
      merged[normalizedName] = value;
    }
  }

  return merged;
}

/**
 * Normalize all header names to lowercase
 */
export function normalizeHTTPHeaders(headers: HTTPHeaders): HTTPHeaders {
  const normalized: HTTPHeaders = {};

  for (const [name, value] of Object.entries(headers)) {
    normalized[normalizeHeaderName(name)] = value;
  }

  return normalized;
}

/**
 * Parse comma-separated header value into array
 */
export function parseHeaderList(value: string): string[] {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

/**
 * Join array into comma-separated header value
 */
export function joinHeaderList(values: string[]): string {
  return values.join(", ");
}

/**
 * Parse Cache-Control header into object
 */
export interface CacheControl {
  "max-age"?: number;
  "s-maxage"?: number;
  "no-cache"?: boolean;
  "no-store"?: boolean;
  "no-transform"?: boolean;
  "must-revalidate"?: boolean;
  "proxy-revalidate"?: boolean;
  public?: boolean;
  private?: boolean;
  immutable?: boolean;
  "stale-while-revalidate"?: number;
  "stale-if-error"?: number;
}

export function parseCacheControl(value: string): CacheControl {
  const directives: CacheControl = {};

  value.split(",").forEach((directive) => {
    const [key, val] = directive.trim().split("=").map((s) => s.trim());

    if (val !== undefined) {
      const numValue = parseInt(val, 10);
      directives[key as keyof CacheControl] = numValue as never;
    } else {
      directives[key as keyof CacheControl] = true as never;
    }
  });

  return directives;
}

/**
 * Format Cache-Control object into header value
 */
export function formatCacheControl(directives: CacheControl): string {
  const parts: string[] = [];

  for (const [key, value] of Object.entries(directives)) {
    if (value === true) {
      parts.push(key);
    } else if (typeof value === "number") {
      parts.push(`${key}=${value}`);
    }
  }

  return parts.join(", ");
}

/**
 * Parse Content-Type header
 */
export interface ContentType {
  mediaType: string;
  charset?: string;
  boundary?: string;
  parameters: Record<string, string>;
}

export function parseContentType(value: string): ContentType {
  const parts = value.split(";").map((s) => s.trim());
  const mediaType = parts[0];
  const parameters: Record<string, string> = {};

  for (let i = 1; i < parts.length; i++) {
    const [key, val] = parts[i].split("=").map((s) => s.trim());
    if (key && val) {
      // Remove quotes from value
      const cleanValue = val.replace(/^["']|["']$/g, "");
      parameters[key.toLowerCase()] = cleanValue;
    }
  }

  return {
    mediaType,
    charset: parameters.charset,
    boundary: parameters.boundary,
    parameters,
  };
}

/**
 * Format Content-Type object into header value
 */
export function formatContentType(contentType: ContentType): string {
  let result = contentType.mediaType;

  for (const [key, value] of Object.entries(contentType.parameters)) {
    // Quote value if it contains special characters
    const quotedValue = /[,;=\s]/.test(value) ? `"${value}"` : value;
    result += `; ${key}=${quotedValue}`;
  }

  return result;
}

/**
 * Check if content type is JSON
 */
export function isJSONContentType(value: string): boolean {
  const ct = parseContentType(value);
  return ct.mediaType === "application/json" ||
    ct.mediaType.endsWith("+json");
}

/**
 * Check if content type is HTML
 */
export function isHTMLContentType(value: string): boolean {
  const ct = parseContentType(value);
  return ct.mediaType === "text/html";
}

/**
 * Check if content type is text
 */
export function isTextContentType(value: string): boolean {
  const ct = parseContentType(value);
  return ct.mediaType.startsWith("text/");
}

/**
 * Parse Accept header with quality values
 */
export interface AcceptItem {
  type: string;
  quality: number;
}

export function parseAccept(value: string): AcceptItem[] {
  return value
    .split(",")
    .map((item) => {
      const parts = item.trim().split(";");
      const type = parts[0].trim();
      let quality = 1.0;

      for (let i = 1; i < parts.length; i++) {
        const [key, val] = parts[i].trim().split("=");
        if (key === "q" && val) {
          quality = parseFloat(val);
        }
      }

      return { type, quality };
    })
    .sort((a, b) => b.quality - a.quality);
}

/**
 * Get content length from headers
 */
export function getContentLength(headers: HTTPHeaders): number | undefined {
  const value = getHeader(headers, "content-length");
  if (!value) return undefined;

  const length = parseInt(value, 10);
  return isNaN(length) ? undefined : length;
}

/**
 * Check if transfer encoding is chunked
 */
export function isChunkedEncoding(headers: HTTPHeaders): boolean {
  const value = getHeader(headers, "transfer-encoding");
  return value?.toLowerCase().includes("chunked") ?? false;
}

/**
 * Get connection header value
 */
export function getConnection(headers: HTTPHeaders): string | undefined {
  return getHeader(headers, "connection");
}

/**
 * Check if connection should be kept alive
 */
export function shouldKeepAlive(
  headers: HTTPHeaders,
  httpVersion: string,
): boolean {
  const connection = getConnection(headers);

  if (connection) {
    return connection.toLowerCase() === "keep-alive";
  }

  // HTTP/1.1 defaults to keep-alive
  return httpVersion === "1.1";
}

/**
 * Validation utilities
 * Comprehensive validation functions for URLs, selectors, fields, and other data
 */

import { isCSSSelector, isHTTPURL, isNonEmptyString, isString, isXPath } from "./type-guards.ts";

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

/**
 * URL validation options
 */
export interface URLValidationOptions {
  allowHttp?: boolean; // Allow http:// (default true)
  allowHttps?: boolean; // Allow https:// (default true)
  allowFile?: boolean; // Allow file:// (default false)
  allowData?: boolean; // Allow data: (default false)
  requireTLD?: boolean; // Require top-level domain (default false)
  maxLength?: number; // Max URL length (default 2048)
  allowPrivateIP?: boolean; // Allow private IP addresses (default true)
}

/**
 * Validate URL
 */
export function validateURL(
  url: unknown,
  options: URLValidationOptions = {},
): ValidationResult {
  const opts = {
    allowHttp: options.allowHttp ?? true,
    allowHttps: options.allowHttps ?? true,
    allowFile: options.allowFile ?? false,
    allowData: options.allowData ?? false,
    requireTLD: options.requireTLD ?? false,
    maxLength: options.maxLength ?? 2048,
    allowPrivateIP: options.allowPrivateIP ?? true,
  };

  // Check if string
  if (!isString(url)) {
    return { valid: false, error: "URL must be a string" };
  }

  // Check length
  if (url.length > opts.maxLength) {
    return { valid: false, error: `URL exceeds maximum length of ${opts.maxLength}` };
  }

  // Parse URL
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch (e) {
    return {
      valid: false,
      error: `Invalid URL format: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  // Check protocol
  const protocol = parsed.protocol;
  if (protocol === "http:" && !opts.allowHttp) {
    return { valid: false, error: "HTTP protocol not allowed" };
  }
  if (protocol === "https:" && !opts.allowHttps) {
    return { valid: false, error: "HTTPS protocol not allowed" };
  }
  if (protocol === "file:" && !opts.allowFile) {
    return { valid: false, error: "File protocol not allowed" };
  }
  if (protocol === "data:" && !opts.allowData) {
    return { valid: false, error: "Data URL not allowed" };
  }

  // Check TLD requirement
  if (opts.requireTLD && protocol !== "file:" && protocol !== "data:") {
    const hostname = parsed.hostname;
    if (!hostname.includes(".")) {
      return { valid: false, error: "URL must include top-level domain" };
    }
  }

  // Check private IP
  if (!opts.allowPrivateIP && protocol !== "file:" && protocol !== "data:") {
    if (isPrivateIP(parsed.hostname)) {
      return { valid: false, error: "Private IP addresses not allowed" };
    }
  }

  return { valid: true };
}

/**
 * Check if hostname is private IP address
 */
export function isPrivateIP(hostname: string): boolean {
  // IPv4 private ranges
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = hostname.match(ipv4Regex);

  if (match) {
    const [, a, b, c, d] = match.map(Number);

    // 10.0.0.0/8
    if (a === 10) return true;

    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return true;

    // 192.168.0.0/16
    if (a === 192 && b === 168) return true;

    // 127.0.0.0/8 (localhost)
    if (a === 127) return true;

    // 169.254.0.0/16 (link-local)
    if (a === 169 && b === 254) return true;
  }

  // localhost
  if (hostname === "localhost") return true;

  // IPv6 private ranges - proper RFC 4291 validation
  if (isPrivateIPv6(hostname)) return true;

  return false;
}

/**
 * Parse IPv6 address to array of 8 16-bit segments
 * Handles compression (::), mixed IPv4 notation, and full format
 * Returns null if invalid format
 */
export function parseIPv6(address: string): number[] | null {
  // Remove brackets if present (e.g., [::1])
  const addr = address.replace(/^\[|]$/g, "");

  // Handle IPv4-mapped IPv6 addresses (e.g., ::ffff:192.0.2.1)
  const ipv4MappedMatch = addr.match(/^(.*):(\d+\.\d+\.\d+\.\d+)$/);
  if (ipv4MappedMatch) {
    const [, ipv6Part, ipv4Part] = ipv4MappedMatch;
    const ipv4Match = ipv4Part.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!ipv4Match) return null;

    const [, a, b, c, d] = ipv4Match.map(Number);
    if (a > 255 || b > 255 || c > 255 || d > 255) return null;

    // Convert IPv4 to two 16-bit segments
    const ipv4Segments = [(a << 8) | b, (c << 8) | d];

    // Parse the IPv6 part (should have 6 segments or less with ::)
    const ipv6Segments = parseIPv6Part(ipv6Part, 6);
    if (!ipv6Segments) return null;

    return [...ipv6Segments, ...ipv4Segments];
  }

  // Pure IPv6 address
  return parseIPv6Part(addr, 8);
}

/**
 * Parse IPv6 part (handles :: compression)
 * Returns array of segments, or null if invalid
 */
function parseIPv6Part(addr: string, expectedSegments: number): number[] | null {
  // Check for :: compression
  const doubleColonIndex = addr.indexOf("::");

  if (doubleColonIndex !== -1) {
    // Has compression
    // Split into before and after :: parts
    const before = addr.substring(0, doubleColonIndex);
    const after = addr.substring(doubleColonIndex + 2);

    const beforeSegments: (number | null)[] = before
      ? before.split(":").map((s) => {
        if (s === "") return null;
        const val = parseInt(s, 16);
        return isNaN(val) || val > 0xFFFF ? null : val;
      })
      : [];

    const afterSegments: (number | null)[] = after
      ? after.split(":").map((s) => {
        if (s === "") return null;
        const val = parseInt(s, 16);
        return isNaN(val) || val > 0xFFFF ? null : val;
      })
      : [];

    // Check if any segment is null (invalid hex)
    if (beforeSegments.includes(null) || afterSegments.includes(null)) {
      return null;
    }

    // Calculate number of zero segments
    const totalSegments = (beforeSegments as number[]).length + (afterSegments as number[]).length;
    if (totalSegments >= expectedSegments) {
      // :: can only be used if it saves at least one segment
      return null;
    }

    const zeroSegments = expectedSegments - totalSegments;
    const zeros = new Array(zeroSegments).fill(0);

    return [...(beforeSegments as number[]), ...zeros, ...(afterSegments as number[])];
  } else {
    // No compression - must have exactly expectedSegments segments
    const segments = addr.split(":");
    if (segments.length !== expectedSegments) return null;

    const parsed = segments.map((s) => {
      const val = parseInt(s, 16);
      return isNaN(val) || val > 0xFFFF ? null : val;
    });

    if (parsed.includes(null as any)) return null;

    return parsed as number[];
  }
}

/**
 * Check if IPv6 address is within a specific prefix
 * @param address IPv6 address string
 * @param prefixSegments Array of 8 16-bit segments representing the prefix
 * @param prefixLength Number of bits in the prefix (0-128)
 */
export function isIPv6InPrefix(
  address: string,
  prefixSegments: number[],
  prefixLength: number,
): boolean {
  const addrSegments = parseIPv6(address);
  if (!addrSegments || addrSegments.length !== 8) return false;
  if (prefixSegments.length !== 8) return false;
  if (prefixLength < 0 || prefixLength > 128) return false;

  // Check each bit up to prefixLength
  const fullSegments = Math.floor(prefixLength / 16);
  const remainingBits = prefixLength % 16;

  // Check full segments
  for (let i = 0; i < fullSegments; i++) {
    if (addrSegments[i] !== prefixSegments[i]) return false;
  }

  // Check remaining bits in partial segment
  if (remainingBits > 0) {
    const mask = 0xFFFF << (16 - remainingBits);
    const segmentIndex = fullSegments;
    if ((addrSegments[segmentIndex] & mask) !== (prefixSegments[segmentIndex] & mask)) {
      return false;
    }
  }

  return true;
}

/**
 * Check if hostname is a private IPv6 address per RFC 4291
 * Checks for:
 * - ::1 (loopback)
 * - fc00::/7 (unique local addresses)
 * - fe80::/10 (link-local addresses)
 */
export function isPrivateIPv6(hostname: string): boolean {
  const segments = parseIPv6(hostname);
  if (!segments || segments.length !== 8) return false;

  // ::1 (loopback) - all zeros except last segment is 1
  if (
    segments[0] === 0 &&
    segments[1] === 0 &&
    segments[2] === 0 &&
    segments[3] === 0 &&
    segments[4] === 0 &&
    segments[5] === 0 &&
    segments[6] === 0 &&
    segments[7] === 1
  ) {
    return true;
  }

  // fc00::/7 - Unique local addresses
  // Check first 7 bits: 1111 110x
  // First segment must be in range 0xFC00-0xFDFF
  const firstSegment = segments[0];
  if ((firstSegment & 0xFE00) === 0xFC00) {
    return true;
  }

  // fe80::/10 - Link-local addresses
  // Check first 10 bits: 1111 1110 10xx xxxx
  // First segment must be in range 0xFE80-0xFEBF
  if ((firstSegment & 0xFFC0) === 0xFE80) {
    return true;
  }

  return false;
}

/**
 * Validate CSS selector
 */
export function isValidCSSSelector(selector: unknown): boolean {
  if (!isNonEmptyString(selector)) return false;

  try {
    // Try to use browser's querySelector (won't actually query, just validate)
    // In Deno, we can use a simple regex-based check
    return isCSSSelector(selector) && !selector.includes("\\x00");
  } catch {
    return false;
  }
}

/**
 * Validate XPath expression
 */
export function isValidXPath(xpath: unknown): boolean {
  if (!isNonEmptyString(xpath)) return false;

  try {
    // Basic XPath validation
    // In a real browser environment, you'd use document.evaluate
    return isXPath(xpath);
  } catch {
    return false;
  }
}

/**
 * Validate field path (e.g., "obj.field.subfield")
 */
export function validateFieldPath(path: unknown): ValidationResult {
  if (!isNonEmptyString(path)) {
    return { valid: false, error: "Field path must be a non-empty string" };
  }

  // Check for invalid characters
  if (/[^a-zA-Z0-9._\[\]]/.test(path)) {
    return {
      valid: false,
      error:
        "Field path contains invalid characters. Allowed: a-z, A-Z, 0-9, dot, underscore, brackets",
    };
  }

  // Check for empty segments
  const segments = path.split(".");
  if (segments.some((s) => s.length === 0)) {
    return { valid: false, error: "Field path contains empty segments" };
  }

  return { valid: true };
}

/**
 * Validate identifier (variable name, function name, etc.)
 */
export function isValidIdentifier(name: unknown): boolean {
  if (!isNonEmptyString(name)) return false;

  // JavaScript identifier rules: start with letter, $, or _, followed by letters, digits, $, _
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name);
}

/**
 * Validate email address (basic validation)
 */
export function isValidEmail(email: unknown): boolean {
  if (!isString(email)) return false;

  // Basic email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate domain name
 */
export function isValidDomain(domain: unknown): boolean {
  if (!isNonEmptyString(domain)) return false;

  // Domain regex: letters, numbers, hyphens, dots
  const domainRegex =
    /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(?:\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?)*$/;
  return domainRegex.test(domain);
}

/**
 * Validate port number
 */
export function isValidPort(port: unknown): boolean {
  let portNum: number;

  if (typeof port === "number") {
    portNum = port;
  } else if (isString(port)) {
    // Try parsing string
    portNum = parseInt(port, 10);
    if (isNaN(portNum)) return false;
  } else {
    return false;
  }

  return Number.isInteger(portNum) && portNum >= 1 && portNum <= 65535;
}

/**
 * Validate HTTP method
 */
export function isValidHTTPMethod(method: unknown): boolean {
  if (!isString(method)) return false;

  const validMethods = [
    "GET",
    "POST",
    "PUT",
    "DELETE",
    "PATCH",
    "HEAD",
    "OPTIONS",
    "CONNECT",
    "TRACE",
  ];
  return validMethods.includes(method.toUpperCase());
}

/**
 * Validate HTTP status code
 */
export function isValidHTTPStatus(status: unknown): boolean {
  if (typeof status !== "number") return false;
  return Number.isInteger(status) && status >= 100 && status < 600;
}

/**
 * Validate content type (MIME type)
 */
export function isValidContentType(contentType: unknown): boolean {
  if (!isNonEmptyString(contentType)) return false;

  // Basic MIME type regex: type/subtype with optional parameters
  const mimeRegex =
    /^[a-zA-Z0-9][a-zA-Z0-9!#$&^_.-]{0,126}\/[a-zA-Z0-9][a-zA-Z0-9!#$&^_.-]{0,126}(?:\s*;\s*[a-zA-Z0-9][a-zA-Z0-9!#$&^_.-]*=[^\s;]+)*$/;
  return mimeRegex.test(contentType);
}

/**
 * Validate JSON string
 */
export function validateJSON(value: unknown): ValidationResult {
  if (!isString(value)) {
    return { valid: false, error: "Value must be a string" };
  }

  try {
    JSON.parse(value);
    return { valid: true };
  } catch (e) {
    return {
      valid: false,
      error: `Invalid JSON: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

/**
 * Validate regex pattern
 */
export function validateRegex(pattern: unknown, flags?: string): ValidationResult {
  if (!isString(pattern)) {
    return { valid: false, error: "Pattern must be a string" };
  }

  try {
    new RegExp(pattern, flags);
    return { valid: true };
  } catch (e) {
    return {
      valid: false,
      error: `Invalid regex: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

/**
 * Validate range (min <= value <= max)
 */
export function isInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

/**
 * Sanitize string for safe output (remove null bytes, control characters)
 */
export function sanitizeString(str: string): string {
  return str
    .replace(/\x00/g, "") // Remove null bytes
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ""); // Remove control characters
}

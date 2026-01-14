/**
 * URL Utilities
 *
 * Parse, normalize, and manipulate URLs
 */

/**
 * Parse URL into components
 */
export function parseURL(urlString: string): URL {
  try {
    return new URL(urlString);
  } catch {
    throw new Error(`Invalid URL: ${urlString}`);
  }
}

/**
 * Normalize URL by removing default ports and trailing slashes
 */
export function normalizeURL(urlString: string): string {
  const url = parseURL(urlString);

  // Remove default ports
  if (
    (url.protocol === "http:" && url.port === "80") ||
    (url.protocol === "https:" && url.port === "443") ||
    (url.protocol === "ws:" && url.port === "80") ||
    (url.protocol === "wss:" && url.port === "443")
  ) {
    url.port = "";
  }

  // Remove trailing slash from pathname (except for root)
  if (url.pathname !== "/" && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }

  return url.toString();
}

/**
 * Extract hostname from URL
 */
export function getHostname(urlString: string): string {
  return parseURL(urlString).hostname;
}

/**
 * Extract port from URL (returns default if not specified)
 */
export function getPort(urlString: string): number {
  const url = parseURL(urlString);

  if (url.port) {
    return parseInt(url.port, 10);
  }

  // Return default port based on protocol
  switch (url.protocol) {
    case "http:":
    case "ws:":
      return 80;
    case "https:":
    case "wss:":
      return 443;
    case "ftp:":
      return 21;
    default:
      return 0;
  }
}

/**
 * Get origin from URL (protocol + hostname + port)
 */
export function getOrigin(urlString: string): string {
  const url = parseURL(urlString);
  return url.origin;
}

/**
 * Check if URL is absolute
 */
export function isAbsoluteURL(urlString: string): boolean {
  try {
    new URL(urlString);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if URL is relative
 */
export function isRelativeURL(urlString: string): boolean {
  return !isAbsoluteURL(urlString);
}

/**
 * Resolve relative URL against base URL
 */
export function resolveURL(baseURL: string, relativeURL: string): string {
  const base = parseURL(baseURL);
  return new URL(relativeURL, base).toString();
}

/**
 * Check if URL uses secure protocol (https:// or wss://)
 */
export function isSecureURL(urlString: string): boolean {
  const url = parseURL(urlString);
  return url.protocol === "https:" || url.protocol === "wss:";
}

/**
 * Build URL from components
 */
export interface URLComponents {
  protocol?: string;
  hostname: string;
  port?: number;
  pathname?: string;
  search?: string;
  hash?: string;
}

export function buildURL(components: URLComponents): string {
  const protocol = components.protocol || "http:";
  const hostname = components.hostname;
  const port = components.port;
  const pathname = components.pathname || "/";
  const search = components.search || "";
  const hash = components.hash || "";

  let url = `${protocol}//${hostname}`;

  // Add port if specified and not default
  if (port) {
    const isDefaultPort =
      (protocol === "http:" && port === 80) ||
      (protocol === "https:" && port === 443) ||
      (protocol === "ws:" && port === 80) ||
      (protocol === "wss:" && port === 443);

    if (!isDefaultPort) {
      url += `:${port}`;
    }
  }

  url += pathname;

  if (search) {
    url += search.startsWith("?") ? search : `?${search}`;
  }

  if (hash) {
    url += hash.startsWith("#") ? hash : `#${hash}`;
  }

  return url;
}

/**
 * Extract query parameters from URL
 */
export function getQueryParams(urlString: string): Record<string, string> {
  const url = parseURL(urlString);
  const params: Record<string, string> = {};

  url.searchParams.forEach((value, key) => {
    params[key] = value;
  });

  return params;
}

/**
 * Add query parameters to URL
 */
export function addQueryParams(
  urlString: string,
  params: Record<string, string>,
): string {
  const url = parseURL(urlString);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return url.toString();
}

/**
 * Remove query parameters from URL
 */
export function removeQueryParams(urlString: string, keys: string[]): string {
  const url = parseURL(urlString);

  keys.forEach((key) => {
    url.searchParams.delete(key);
  });

  return url.toString();
}

/**
 * Check if two URLs are same origin
 */
export function isSameOrigin(url1: string, url2: string): boolean {
  const a = parseURL(url1);
  const b = parseURL(url2);

  return a.origin === b.origin;
}

/**
 * Get path segments from URL
 */
export function getPathSegments(urlString: string): string[] {
  const url = parseURL(urlString);
  return url.pathname.split("/").filter((segment) => segment.length > 0);
}

/**
 * Join path segments into URL path
 */
export function joinPathSegments(...segments: string[]): string {
  return "/" + segments.filter((s) => s.length > 0).join("/");
}

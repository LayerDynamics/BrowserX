/**
 * Cookie Utilities
 *
 * Parse and format HTTP cookies (Cookie and Set-Cookie headers)
 */

/**
 * Cookie interface
 */
export interface Cookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: Date;
  maxAge?: number;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
}

/**
 * Parse Cookie header value (client → server)
 */
export function parseCookie(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};

  cookieHeader.split(";").forEach((cookie) => {
    const [name, ...rest] = cookie.trim().split("=");
    if (name) {
      const value = rest.join("="); // Handle values with = in them
      cookies[name.trim()] = decodeURIComponent(value || "");
    }
  });

  return cookies;
}

/**
 * Format cookies object into Cookie header value
 */
export function formatCookie(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
    .join("; ");
}

/**
 * Parse Set-Cookie header value (server → client)
 */
export function parseSetCookie(setCookieHeader: string): Cookie {
  const parts = setCookieHeader.split(";").map((s) => s.trim());
  const [nameValue] = parts;
  const [name, ...valueParts] = nameValue.split("=");
  const value = decodeURIComponent(valueParts.join("="));

  const cookie: Cookie = {
    name: name.trim(),
    value: value || "",
  };

  for (let i = 1; i < parts.length; i++) {
    const [attr, attrValue] = parts[i].split("=").map((s) => s.trim());
    const attrLower = attr.toLowerCase();

    switch (attrLower) {
      case "domain":
        cookie.domain = attrValue;
        break;
      case "path":
        cookie.path = attrValue;
        break;
      case "expires":
        cookie.expires = new Date(attrValue);
        break;
      case "max-age":
        cookie.maxAge = parseInt(attrValue, 10);
        break;
      case "secure":
        cookie.secure = true;
        break;
      case "httponly":
        cookie.httpOnly = true;
        break;
      case "samesite":
        const sameSiteValue = attrValue?.toLowerCase();
        if (sameSiteValue === "strict") {
          cookie.sameSite = "Strict";
        } else if (sameSiteValue === "lax") {
          cookie.sameSite = "Lax";
        } else if (sameSiteValue === "none") {
          cookie.sameSite = "None";
        }
        break;
    }
  }

  return cookie;
}

/**
 * Format Cookie object into Set-Cookie header value
 */
export function formatSetCookie(cookie: Cookie): string {
  let result = `${cookie.name}=${encodeURIComponent(cookie.value)}`;

  if (cookie.domain) {
    result += `; Domain=${cookie.domain}`;
  }

  if (cookie.path) {
    result += `; Path=${cookie.path}`;
  }

  if (cookie.expires) {
    result += `; Expires=${cookie.expires.toUTCString()}`;
  }

  if (cookie.maxAge !== undefined) {
    result += `; Max-Age=${cookie.maxAge}`;
  }

  if (cookie.secure) {
    result += "; Secure";
  }

  if (cookie.httpOnly) {
    result += "; HttpOnly";
  }

  if (cookie.sameSite) {
    result += `; SameSite=${cookie.sameSite}`;
  }

  return result;
}

/**
 * Parse multiple Set-Cookie headers
 */
export function parseSetCookies(setCookieHeaders: string[]): Cookie[] {
  return setCookieHeaders.map(parseSetCookie);
}

/**
 * Check if cookie matches domain
 */
export function cookieMatchesDomain(cookie: Cookie, domain: string): boolean {
  if (!cookie.domain) {
    return true; // No domain restriction
  }

  const cookieDomain = cookie.domain.toLowerCase();
  const targetDomain = domain.toLowerCase();

  // Exact match
  if (cookieDomain === targetDomain) {
    return true;
  }

  // Domain cookie (starts with .)
  if (cookieDomain.startsWith(".")) {
    return targetDomain.endsWith(cookieDomain) ||
      targetDomain === cookieDomain.slice(1);
  }

  // Subdomain match
  return targetDomain.endsWith(`.${cookieDomain}`);
}

/**
 * Check if cookie matches path
 */
export function cookieMatchesPath(cookie: Cookie, path: string): boolean {
  if (!cookie.path) {
    return true; // No path restriction
  }

  const cookiePath = cookie.path;

  // Exact match
  if (cookiePath === path) {
    return true;
  }

  // Path prefix match
  if (path.startsWith(cookiePath)) {
    // Cookie path must end with / or next char in path must be /
    return cookiePath.endsWith("/") || path[cookiePath.length] === "/";
  }

  return false;
}

/**
 * Check if cookie is expired
 */
export function isCookieExpired(cookie: Cookie): boolean {
  // Check Expires attribute
  if (cookie.expires) {
    return cookie.expires.getTime() < Date.now();
  }

  // Max-Age takes precedence over Expires
  if (cookie.maxAge !== undefined) {
    return cookie.maxAge <= 0;
  }

  return false;
}

/**
 * Check if cookie is session cookie (no Expires or Max-Age)
 */
export function isSessionCookie(cookie: Cookie): boolean {
  return !cookie.expires && cookie.maxAge === undefined;
}

/**
 * Create cookie jar for managing cookies
 */
export class CookieJar {
  private cookies: Map<string, Cookie> = new Map();

  /**
   * Add cookie to jar
   */
  addCookie(cookie: Cookie): void {
    const key = `${cookie.name}:${cookie.domain || ""}:${cookie.path || ""}`;
    this.cookies.set(key, cookie);
  }

  /**
   * Get cookies matching domain and path
   */
  getCookies(domain: string, path: string, secure: boolean): Cookie[] {
    const matching: Cookie[] = [];

    for (const cookie of this.cookies.values()) {
      // Skip expired cookies
      if (isCookieExpired(cookie)) {
        continue;
      }

      // Skip secure cookies on non-secure connections
      if (cookie.secure && !secure) {
        continue;
      }

      // Check domain match
      if (!cookieMatchesDomain(cookie, domain)) {
        continue;
      }

      // Check path match
      if (!cookieMatchesPath(cookie, path)) {
        continue;
      }

      matching.push(cookie);
    }

    return matching;
  }

  /**
   * Get Cookie header value for request
   */
  getCookieHeader(domain: string, path: string, secure: boolean): string {
    const cookies = this.getCookies(domain, path, secure);
    const cookieObj: Record<string, string> = {};

    cookies.forEach((cookie) => {
      cookieObj[cookie.name] = cookie.value;
    });

    return formatCookie(cookieObj);
  }

  /**
   * Process Set-Cookie header from response
   */
  setCookie(setCookieHeader: string, domain: string): void {
    const cookie = parseSetCookie(setCookieHeader);

    // Set default domain if not specified
    if (!cookie.domain) {
      cookie.domain = domain;
    }

    // Set default path if not specified
    if (!cookie.path) {
      cookie.path = "/";
    }

    this.addCookie(cookie);
  }

  /**
   * Clear all cookies
   */
  clear(): void {
    this.cookies.clear();
  }

  /**
   * Remove expired cookies
   */
  removeExpired(): void {
    for (const [key, cookie] of this.cookies.entries()) {
      if (isCookieExpired(cookie)) {
        this.cookies.delete(key);
      }
    }
  }

  /**
   * Get all cookies
   */
  getAllCookies(): Cookie[] {
    return Array.from(this.cookies.values());
  }
}

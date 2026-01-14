/**
 * Cookie Manager
 *
 * Manages HTTP cookies with domain/path matching and SameSite policy.
 * Implements cookie storage, retrieval, expiration, and security policies.
 */

import type { Cookie } from "../../types/storage.ts";

/**
 * Cookie storage key
 */
interface CookieKey {
    name: string;
    domain: string;
    path: string;
}

/**
 * Stored cookie with metadata
 */
interface StoredCookie extends Cookie {
    createdAt: number;
}

/**
 * Cookie Manager
 */
export class CookieManager {
    private cookies: Map<string, StoredCookie> = new Map();
    private cleanupInterval: number | null = null;

    constructor() {
        // Start periodic cleanup of expired cookies every 60 seconds
        this.cleanupInterval = setInterval(() => this.cleanupExpired(), 60000) as unknown as number;
    }

    /**
     * Set cookie with validation
     */
    setCookie(cookie: Cookie, requestUrl: string): void {
        // Validate cookie
        if (!this.validateCookie(cookie, requestUrl)) {
            return;
        }

        // Apply defaults
        const normalizedCookie: StoredCookie = {
            ...cookie,
            domain: cookie.domain || this.extractDomain(requestUrl),
            path: cookie.path || "/",
            secure: cookie.secure ?? false,
            httpOnly: cookie.httpOnly ?? false,
            sameSite: cookie.sameSite || "Lax",
            createdAt: Date.now(),
        };

        // Create storage key
        const key = this.createKey({
            name: normalizedCookie.name,
            domain: normalizedCookie.domain!,
            path: normalizedCookie.path!,
        });

        // Store cookie
        this.cookies.set(key, normalizedCookie);
    }

    /**
     * Get cookies for URL that match domain, path, and security requirements
     */
    getCookies(url: string): Cookie[] {
        const parsedUrl = this.parseUrl(url);
        const isSecure = parsedUrl.protocol === "https:";
        const now = Date.now();

        const matchingCookies: Cookie[] = [];

        for (const [key, cookie] of this.cookies.entries()) {
            // Check if expired
            if (this.isExpired(cookie, now)) {
                this.cookies.delete(key);
                continue;
            }

            // Check secure flag
            if (cookie.secure && !isSecure) {
                continue;
            }

            // Check domain match
            if (!this.domainMatches(cookie.domain!, parsedUrl.hostname)) {
                continue;
            }

            // Check path match
            if (!this.pathMatches(cookie.path!, parsedUrl.pathname)) {
                continue;
            }

            matchingCookies.push(cookie);
        }

        // Sort by path length (more specific first) and creation time
        matchingCookies.sort((a, b) => {
            const pathDiff = (b.path?.length || 0) - (a.path?.length || 0);
            if (pathDiff !== 0) return pathDiff;

            const aCreated = (a as StoredCookie).createdAt || 0;
            const bCreated = (b as StoredCookie).createdAt || 0;
            return aCreated - bCreated;
        });

        return matchingCookies;
    }

    /**
     * Get cookies for URL and SameSite context
     */
    getCookiesForRequest(url: string, requestUrl: string, method: string = "GET"): Cookie[] {
        const cookies = this.getCookies(url);
        const isSameSite = this.isSameSiteRequest(url, requestUrl);
        const isSafeMethod = ["GET", "HEAD", "OPTIONS", "TRACE"].includes(method.toUpperCase());

        return cookies.filter((cookie) => {
            // SameSite=Strict: Only same-site requests
            if (cookie.sameSite === "Strict" && !isSameSite) {
                return false;
            }

            // SameSite=Lax: Same-site or top-level navigation with safe method
            if (cookie.sameSite === "Lax") {
                if (!isSameSite && !(isSafeMethod && this.isTopLevelNavigation(requestUrl))) {
                    return false;
                }
            }

            // SameSite=None: Must be secure
            if (cookie.sameSite === "None" && !cookie.secure) {
                return false;
            }

            return true;
        });
    }

    /**
     * Delete cookie
     */
    deleteCookie(name: string, domain: string, path: string): void {
        const key = this.createKey({ name, domain, path });
        this.cookies.delete(key);
    }

    /**
     * Delete all cookies for domain
     */
    deleteCookiesForDomain(domain: string): void {
        const toDelete: string[] = [];

        for (const [key, cookie] of this.cookies.entries()) {
            if (this.domainMatches(cookie.domain!, domain)) {
                toDelete.push(key);
            }
        }

        for (const key of toDelete) {
            this.cookies.delete(key);
        }
    }

    /**
     * Clear all cookies
     */
    clearAll(): void {
        this.cookies.clear();
    }

    /**
     * Get all cookies (for debugging)
     */
    getAllCookies(): Cookie[] {
        return Array.from(this.cookies.values());
    }

    /**
     * Get cookie count
     */
    getCookieCount(): number {
        return this.cookies.size;
    }

    /**
     * Validate cookie before storing
     */
    private validateCookie(cookie: Cookie, requestUrl: string): boolean {
        // Name is required
        if (!cookie.name || cookie.name.trim() === "") {
            return false;
        }

        // Check for invalid characters in name
        if (/[;,\s=]/.test(cookie.name)) {
            return false;
        }

        // If domain is set, validate it
        if (cookie.domain) {
            const requestDomain = this.extractDomain(requestUrl);

            // Domain must be same or parent domain
            if (!this.domainMatches(cookie.domain, requestDomain)) {
                return false;
            }

            // Cannot set cookie for public suffix (simplified check)
            if (this.isPublicSuffix(cookie.domain)) {
                return false;
            }
        }

        // SameSite=None must be Secure
        if (cookie.sameSite === "None" && !cookie.secure) {
            return false;
        }

        return true;
    }

    /**
     * Check if cookie is expired
     */
    private isExpired(cookie: StoredCookie, now: number): boolean {
        // Check expires date
        if (cookie.expires) {
            return cookie.expires.getTime() < now;
        }

        // Check max-age
        if (cookie.maxAge !== undefined) {
            const expiresAt = cookie.createdAt + (cookie.maxAge * 1000);
            return expiresAt < now;
        }

        return false;
    }

    /**
     * Check if domain matches
     */
    private domainMatches(cookieDomain: string, requestDomain: string): boolean {
        // Normalize domains to lowercase
        const cookie = cookieDomain.toLowerCase();
        const request = requestDomain.toLowerCase();

        // Exact match
        if (cookie === request) {
            return true;
        }

        // Subdomain match (cookie domain starts with .)
        if (cookie.startsWith(".")) {
            const domain = cookie.substring(1);
            return request === domain || request.endsWith("." + domain);
        }

        // Check if request is subdomain of cookie
        return request.endsWith("." + cookie);
    }

    /**
     * Check if path matches
     */
    private pathMatches(cookiePath: string, requestPath: string): boolean {
        // Exact match
        if (cookiePath === requestPath) {
            return true;
        }

        // Cookie path is prefix of request path
        if (requestPath.startsWith(cookiePath)) {
            // Cookie path must end with / or request path must have / after it
            return cookiePath.endsWith("/") || requestPath[cookiePath.length] === "/";
        }

        return false;
    }

    /**
     * Check if request is same-site
     */
    private isSameSiteRequest(targetUrl: string, requestUrl: string): boolean {
        const target = this.parseUrl(targetUrl);
        const request = this.parseUrl(requestUrl);

        return this.getRegistrableDomain(target.hostname) ===
            this.getRegistrableDomain(request.hostname);
    }

    /**
     * Check if navigation is top-level
     */
    private isTopLevelNavigation(url: string): boolean {
        // Simplified: assume navigation if URL is provided
        // In real implementation, would check if this is a main frame navigation
        return true;
    }

    /**
     * Get registrable domain (eTLD+1)
     */
    private getRegistrableDomain(hostname: string): string {
        const parts = hostname.split(".");

        // Simplified: return last two parts for .com, .org, etc.
        // Real implementation would use Public Suffix List
        if (parts.length >= 2) {
            return parts.slice(-2).join(".");
        }

        return hostname;
    }

    /**
     * Check if domain is public suffix
     */
    private isPublicSuffix(domain: string): boolean {
        // Simplified check for common TLDs
        const publicSuffixes = ["com", "org", "net", "edu", "gov", "mil", "co.uk", "co.jp"];
        return publicSuffixes.includes(domain.toLowerCase());
    }

    /**
     * Parse URL
     */
    private parseUrl(url: string): { protocol: string; hostname: string; pathname: string } {
        try {
            const parsed = new URL(url);
            return {
                protocol: parsed.protocol,
                hostname: parsed.hostname,
                pathname: parsed.pathname,
            };
        } catch {
            // Fallback for invalid URLs
            return {
                protocol: "http:",
                hostname: url,
                pathname: "/",
            };
        }
    }

    /**
     * Extract domain from URL
     */
    private extractDomain(url: string): string {
        return this.parseUrl(url).hostname;
    }

    /**
     * Create storage key
     */
    private createKey(key: CookieKey): string {
        return `${key.domain}:${key.path}:${key.name}`;
    }

    /**
     * Clean up expired cookies
     */
    private cleanupExpired(): void {
        const now = Date.now();
        const toDelete: string[] = [];

        for (const [key, cookie] of this.cookies.entries()) {
            if (this.isExpired(cookie, now)) {
                toDelete.push(key);
            }
        }

        for (const key of toDelete) {
            this.cookies.delete(key);
        }
    }

    /**
     * Dispose cookie manager
     */
    dispose(): void {
        if (this.cleanupInterval !== null) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.cookies.clear();
    }
}

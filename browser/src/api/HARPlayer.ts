/**
 * HAR Player API
 *
 * Replays HTTP traffic from HAR (HTTP Archive) format for testing,
 * mocking, and offline simulation scenarios.
 */

import { BrowserPage } from "./BrowserPage.ts";
import {
  HAR,
  HAREntry,
  HARCookie,
} from "./HARRecorder.ts";

// ============================================================================
// Types
// ============================================================================

/**
 * Match strategy for finding HAR entries
 */
export type MatchStrategy = "exact" | "pattern" | "method-url" | "custom";

/**
 * Network throttle preset
 */
export type ThrottlePreset = "slow-3g" | "fast-3g" | "4g" | "wifi" | "offline" | "custom";

/**
 * Custom throttle configuration
 */
export interface ThrottleConfig {
  /** Download throughput in bytes per second */
  downloadThroughput: number;
  /** Upload throughput in bytes per second */
  uploadThroughput: number;
  /** Added latency in milliseconds */
  latency: number;
}

/**
 * Throttle presets with realistic network conditions
 */
export const THROTTLE_PRESETS: Record<Exclude<ThrottlePreset, "custom">, ThrottleConfig> = {
  "slow-3g": {
    downloadThroughput: 500 * 1024,      // 500 KB/s
    uploadThroughput: 500 * 1024,        // 500 KB/s
    latency: 400,                         // 400ms
  },
  "fast-3g": {
    downloadThroughput: 1.6 * 1024 * 1024, // 1.6 MB/s
    uploadThroughput: 750 * 1024,          // 750 KB/s
    latency: 150,                          // 150ms
  },
  "4g": {
    downloadThroughput: 4 * 1024 * 1024,   // 4 MB/s
    uploadThroughput: 3 * 1024 * 1024,     // 3 MB/s
    latency: 20,                           // 20ms
  },
  "wifi": {
    downloadThroughput: 30 * 1024 * 1024,  // 30 MB/s
    uploadThroughput: 15 * 1024 * 1024,    // 15 MB/s
    latency: 2,                            // 2ms
  },
  "offline": {
    downloadThroughput: 0,
    uploadThroughput: 0,
    latency: 0,
  },
};

/**
 * Custom request matcher function
 */
export type RequestMatcher = (request: RequestInfo, entry: HAREntry) => boolean;

/**
 * Request information for matching
 */
export interface RequestInfo {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: string;
}

/**
 * Playback options
 */
export interface PlaybackOptions {
  /** Strategy for matching requests to HAR entries */
  matchStrategy?: MatchStrategy;
  /** Custom matcher function (used when matchStrategy is "custom") */
  customMatcher?: RequestMatcher;
  /** Reject unmatched requests (offline simulation) */
  rejectUnmatched?: boolean;
  /** Network throttle preset */
  throttle?: ThrottlePreset;
  /** Custom throttle configuration (used when throttle is "custom") */
  customThrottle?: ThrottleConfig;
  /** Maintain cookies from HAR */
  maintainCookies?: boolean;
  /** Maintain authentication from HAR */
  maintainAuth?: boolean;
  /** URL patterns to ignore (will pass through) */
  ignorePatterns?: string[];
}

/**
 * Request log entry
 */
export interface RequestLogEntry {
  url: string;
  method: string;
  matched: boolean;
  matchedEntry?: HAREntry;
  timestamp: Date;
  responseTime?: number;
}

/**
 * Playback statistics
 */
export interface PlaybackStats {
  /** Total requests processed */
  totalRequests: number;
  /** Requests matched to HAR entries */
  matchedRequests: number;
  /** Requests not matched */
  unmatchedRequests: number;
  /** Match rate as percentage (0-100) */
  matchRate: number;
  /** Log of all requests */
  requestLog: RequestLogEntry[];
}

/**
 * Replayed response
 */
export interface ReplayedResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body?: string;
  fromHAR: boolean;
  entry?: HAREntry;
  delayApplied?: number;
}

/**
 * Extracted cookies from HAR
 */
export interface ExtractedCookies {
  cookies: HARCookie[];
  domains: Set<string>;
}

/**
 * Extracted authentication from HAR
 */
export interface ExtractedAuth {
  basicAuth?: { username: string; password: string };
  bearerToken?: string;
  apiKey?: { header: string; value: string };
  cookies: HARCookie[];
}

/**
 * Playback result
 */
export interface PlaybackResult {
  success: boolean;
  response?: ReplayedResponse;
  error?: string;
}

// ============================================================================
// HARPlayer Class
// ============================================================================

/**
 * HAR Player for replaying recorded HTTP traffic
 */
export class HARPlayer {
  private page: BrowserPage;
  private har: HAR | null = null;
  private playing: boolean = false;
  private options: PlaybackOptions = {};
  private stats: PlaybackStats = {
    totalRequests: 0,
    matchedRequests: 0,
    unmatchedRequests: 0,
    matchRate: 0,
    requestLog: [],
  };

  constructor(page: BrowserPage) {
    this.page = page;
  }

  /**
   * Load HAR data for playback
   * @param harOrJson - HAR object or JSON string
   */
  loadHAR(harOrJson: HAR | string): void {
    if (typeof harOrJson === "string") {
      try {
        this.har = JSON.parse(harOrJson) as HAR;
      } catch (error) {
        throw new Error(`Failed to parse HAR JSON: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      this.har = harOrJson;
    }

    // Validate HAR structure
    if (!this.har.log || !Array.isArray(this.har.log.entries)) {
      throw new Error("Invalid HAR structure: missing log.entries");
    }
  }

  /**
   * Get loaded HAR data
   */
  getHAR(): HAR | null {
    return this.har;
  }

  /**
   * Check if HAR data is loaded
   */
  isLoaded(): boolean {
    return this.har !== null;
  }

  /**
   * Start playback mode
   * @param options - Playback options
   */
  startPlayback(options: PlaybackOptions = {}): void {
    if (!this.har) {
      throw new Error("No HAR data loaded. Call loadHAR() first.");
    }

    if (this.playing) {
      return;
    }

    this.options = {
      matchStrategy: "method-url",
      rejectUnmatched: false,
      maintainCookies: false,
      maintainAuth: false,
      ...options,
    };

    this.playing = true;
    this.resetStats();

    // Extract and apply cookies/auth if requested
    if (this.options.maintainCookies) {
      this.applyCookiesFromHAR();
    }

    if (this.options.maintainAuth) {
      this.applyAuthFromHAR();
    }
  }

  /**
   * Stop playback mode
   */
  stopPlayback(): void {
    this.playing = false;
  }

  /**
   * Check if playback is active
   */
  isPlaying(): boolean {
    return this.playing;
  }

  /**
   * Find a matching HAR entry for a request
   * @param request - Request information to match
   */
  findMatchingEntry(request: RequestInfo): HAREntry | null {
    if (!this.har) {
      return null;
    }

    // Check ignore patterns first
    if (this.options.ignorePatterns) {
      for (const pattern of this.options.ignorePatterns) {
        try {
          if (new RegExp(pattern).test(request.url)) {
            return null;
          }
        } catch {
          // Invalid pattern, skip
        }
      }
    }

    for (const entry of this.har.log.entries) {
      if (this.matchEntry(request, entry)) {
        return entry;
      }
    }

    return null;
  }

  /**
   * Match a request against an entry based on strategy
   */
  private matchEntry(request: RequestInfo, entry: HAREntry): boolean {
    switch (this.options.matchStrategy) {
      case "exact":
        return this.matchExact(request, entry);
      case "pattern":
        return this.matchPattern(request, entry);
      case "method-url":
        return this.matchMethodUrl(request, entry);
      case "custom":
        return this.options.customMatcher?.(request, entry) ?? false;
      default:
        return this.matchMethodUrl(request, entry);
    }
  }

  /**
   * Exact match: method, URL (including query string), and headers
   */
  private matchExact(request: RequestInfo, entry: HAREntry): boolean {
    if (request.method.toUpperCase() !== entry.request.method.toUpperCase()) {
      return false;
    }

    if (request.url !== entry.request.url) {
      return false;
    }

    // Match headers if provided
    if (request.headers) {
      for (const header of entry.request.headers) {
        const requestValue = request.headers[header.name.toLowerCase()];
        if (requestValue !== header.value) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Pattern match: method and URL path pattern
   */
  private matchPattern(request: RequestInfo, entry: HAREntry): boolean {
    if (request.method.toUpperCase() !== entry.request.method.toUpperCase()) {
      return false;
    }

    try {
      const requestUrl = new URL(request.url);
      const entryUrl = new URL(entry.request.url);

      // Match host and path, ignoring query string
      if (requestUrl.host !== entryUrl.host) {
        return false;
      }

      // Convert path to pattern (replace UUIDs, numbers with wildcards)
      const normalizedRequestPath = this.normalizePath(requestUrl.pathname);
      const normalizedEntryPath = this.normalizePath(entryUrl.pathname);

      return normalizedRequestPath === normalizedEntryPath;
    } catch {
      return false;
    }
  }

  /**
   * Normalize path for pattern matching
   */
  private normalizePath(path: string): string {
    return path
      // Replace UUIDs
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "{uuid}")
      // Replace numeric IDs
      .replace(/\/\d+/g, "/{id}")
      // Replace hex strings (8+ chars)
      .replace(/\/[0-9a-f]{8,}/gi, "/{hex}");
  }

  /**
   * Method-URL match: method and URL (excluding query string variations)
   */
  private matchMethodUrl(request: RequestInfo, entry: HAREntry): boolean {
    if (request.method.toUpperCase() !== entry.request.method.toUpperCase()) {
      return false;
    }

    try {
      const requestUrl = new URL(request.url);
      const entryUrl = new URL(entry.request.url);

      // Match origin and pathname
      return requestUrl.origin + requestUrl.pathname === entryUrl.origin + entryUrl.pathname;
    } catch {
      // Fallback to exact URL match if parsing fails
      return request.url === entry.request.url;
    }
  }

  /**
   * Replay a response from a HAR entry
   * @param entry - HAR entry to replay
   */
  async replayResponse(entry: HAREntry): Promise<ReplayedResponse> {
    const startTime = Date.now();

    // Apply throttling delay if configured
    const delay = await this.calculateThrottleDelay(entry);
    if (delay > 0) {
      await this.delay(delay);
    }

    // Convert headers to Record
    const headers: Record<string, string> = {};
    for (const header of entry.response.headers) {
      headers[header.name.toLowerCase()] = header.value;
    }

    const responseTime = Date.now() - startTime;

    return {
      status: entry.response.status,
      statusText: entry.response.statusText,
      headers,
      body: entry.response.content.text,
      fromHAR: true,
      entry,
      delayApplied: delay > 0 ? responseTime : undefined,
    };
  }

  /**
   * Calculate throttle delay based on response size
   */
  private async calculateThrottleDelay(entry: HAREntry): Promise<number> {
    if (!this.options.throttle) {
      return 0;
    }

    let config: ThrottleConfig;
    if (this.options.throttle === "custom") {
      config = this.options.customThrottle || THROTTLE_PRESETS["wifi"];
    } else {
      config = THROTTLE_PRESETS[this.options.throttle];
    }

    // Offline mode - infinite delay (handled specially)
    if (config.downloadThroughput === 0) {
      return -1; // Signal offline
    }

    const responseSize = entry.response.bodySize || entry.response.content.size || 0;

    // Calculate download time based on throughput
    const downloadTime = config.downloadThroughput > 0
      ? (responseSize / config.downloadThroughput) * 1000
      : 0;

    return config.latency + downloadTime;
  }

  /**
   * Process a request through the HAR player
   * @param request - Request to process
   */
  async processRequest(request: RequestInfo): Promise<PlaybackResult> {
    const startTime = Date.now();

    this.stats.totalRequests++;

    const entry = this.findMatchingEntry(request);

    const logEntry: RequestLogEntry = {
      url: request.url,
      method: request.method,
      matched: entry !== null,
      matchedEntry: entry || undefined,
      timestamp: new Date(),
    };

    if (entry) {
      this.stats.matchedRequests++;

      try {
        const response = await this.replayResponse(entry);
        logEntry.responseTime = Date.now() - startTime;
        this.stats.requestLog.push(logEntry);
        this.updateMatchRate();

        return {
          success: true,
          response,
        };
      } catch (error) {
        this.stats.requestLog.push(logEntry);
        this.updateMatchRate();

        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    } else {
      this.stats.unmatchedRequests++;
      this.stats.requestLog.push(logEntry);
      this.updateMatchRate();

      if (this.options.rejectUnmatched) {
        return {
          success: false,
          error: `No matching HAR entry for ${request.method} ${request.url}`,
        };
      }

      // Return empty response for pass-through
      return {
        success: true,
        response: {
          status: 0,
          statusText: "No Match",
          headers: {},
          fromHAR: false,
        },
      };
    }
  }

  /**
   * Update match rate calculation
   */
  private updateMatchRate(): void {
    if (this.stats.totalRequests > 0) {
      this.stats.matchRate = (this.stats.matchedRequests / this.stats.totalRequests) * 100;
    }
  }

  /**
   * Get playback statistics
   */
  getStats(): PlaybackStats {
    return { ...this.stats };
  }

  /**
   * Get match rate as percentage
   */
  getMatchRate(): number {
    return this.stats.matchRate;
  }

  /**
   * Get list of unmatched requests
   */
  getUnmatchedRequests(): RequestLogEntry[] {
    return this.stats.requestLog.filter(entry => !entry.matched);
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      matchedRequests: 0,
      unmatchedRequests: 0,
      matchRate: 0,
      requestLog: [],
    };
  }

  /**
   * Assert all requests were matched (for testing)
   * @throws Error if any requests were unmatched
   */
  assertAllRequestsMatched(): void {
    if (this.stats.unmatchedRequests > 0) {
      const unmatched = this.getUnmatchedRequests();
      const urls = unmatched.map(r => `${r.method} ${r.url}`).join("\n  ");
      throw new Error(`${this.stats.unmatchedRequests} unmatched request(s):\n  ${urls}`);
    }
  }

  /**
   * Assert match rate meets minimum threshold (for testing)
   * @param minRate - Minimum acceptable match rate (0-100)
   * @throws Error if match rate is below threshold
   */
  assertMatchRate(minRate: number): void {
    if (this.stats.matchRate < minRate) {
      throw new Error(
        `Match rate ${this.stats.matchRate.toFixed(1)}% is below minimum ${minRate}%`
      );
    }
  }

  /**
   * Extract cookies from HAR data
   */
  extractCookiesFromHAR(): ExtractedCookies {
    if (!this.har) {
      return { cookies: [], domains: new Set() };
    }

    const cookies: HARCookie[] = [];
    const domains = new Set<string>();

    for (const entry of this.har.log.entries) {
      // Extract cookies from requests
      for (const cookie of entry.request.cookies) {
        if (!cookies.some(c => c.name === cookie.name && c.domain === cookie.domain)) {
          cookies.push(cookie);
          if (cookie.domain) {
            domains.add(cookie.domain);
          }
        }
      }

      // Extract Set-Cookie from responses
      for (const cookie of entry.response.cookies) {
        if (!cookies.some(c => c.name === cookie.name && c.domain === cookie.domain)) {
          cookies.push(cookie);
          if (cookie.domain) {
            domains.add(cookie.domain);
          }
        }
      }
    }

    return { cookies, domains };
  }

  /**
   * Extract authentication information from HAR data
   */
  extractAuthFromHAR(): ExtractedAuth {
    if (!this.har) {
      return { cookies: [] };
    }

    const auth: ExtractedAuth = { cookies: [] };

    for (const entry of this.har.log.entries) {
      for (const header of entry.request.headers) {
        const headerName = header.name.toLowerCase();

        // Basic Auth
        if (headerName === "authorization" && header.value.startsWith("Basic ")) {
          try {
            const encoded = header.value.substring(6);
            const decoded = atob(encoded);
            const [username, password] = decoded.split(":");
            if (username && password) {
              auth.basicAuth = { username, password };
            }
          } catch {
            // Invalid Base64, skip
          }
        }

        // Bearer Token
        if (headerName === "authorization" && header.value.startsWith("Bearer ")) {
          auth.bearerToken = header.value.substring(7);
        }

        // API Key (common header names)
        const apiKeyHeaders = ["x-api-key", "api-key", "apikey", "x-auth-token"];
        if (apiKeyHeaders.includes(headerName)) {
          auth.apiKey = { header: header.name, value: header.value };
        }
      }

      // Collect auth-related cookies
      for (const cookie of entry.request.cookies) {
        const isAuthCookie =
          cookie.name.toLowerCase().includes("session") ||
          cookie.name.toLowerCase().includes("token") ||
          cookie.name.toLowerCase().includes("auth");

        if (isAuthCookie && !auth.cookies.some(c => c.name === cookie.name)) {
          auth.cookies.push(cookie);
        }
      }
    }

    return auth;
  }

  /**
   * Apply cookies from HAR to current page context
   */
  private applyCookiesFromHAR(): void {
    const { cookies } = this.extractCookiesFromHAR();

    // This would integrate with the page's cookie manager
    // For now, we store them and they can be retrieved via getCookies()
    this.extractedCookies = cookies;
  }

  private extractedCookies: HARCookie[] = [];

  /**
   * Get extracted cookies
   */
  getCookies(): HARCookie[] {
    return [...this.extractedCookies];
  }

  /**
   * Apply authentication from HAR
   */
  private applyAuthFromHAR(): void {
    const auth = this.extractAuthFromHAR();

    // Store extracted auth for retrieval
    this.extractedAuth = auth;
  }

  private extractedAuth: ExtractedAuth | null = null;

  /**
   * Get extracted authentication
   */
  getAuth(): ExtractedAuth | null {
    return this.extractedAuth;
  }

  /**
   * Get entry count in loaded HAR
   */
  getEntryCount(): number {
    return this.har?.log.entries.length || 0;
  }

  /**
   * Get all unique URLs in HAR
   */
  getUniqueUrls(): string[] {
    if (!this.har) {
      return [];
    }

    const urls = new Set<string>();
    for (const entry of this.har.log.entries) {
      urls.add(entry.request.url);
    }
    return Array.from(urls);
  }

  /**
   * Filter entries by URL pattern
   * @param pattern - RegExp pattern to match URLs
   */
  filterEntriesByUrl(pattern: RegExp): HAREntry[] {
    if (!this.har) {
      return [];
    }

    return this.har.log.entries.filter(entry => pattern.test(entry.request.url));
  }

  /**
   * Filter entries by method
   * @param method - HTTP method to filter by
   */
  filterEntriesByMethod(method: string): HAREntry[] {
    if (!this.har) {
      return [];
    }

    return this.har.log.entries.filter(
      entry => entry.request.method.toUpperCase() === method.toUpperCase()
    );
  }

  /**
   * Filter entries by status code
   * @param status - Status code or range (e.g., 200, "2xx", "4xx")
   */
  filterEntriesByStatus(status: number | string): HAREntry[] {
    if (!this.har) {
      return [];
    }

    return this.har.log.entries.filter(entry => {
      if (typeof status === "number") {
        return entry.response.status === status;
      }
      // Handle patterns like "2xx", "4xx"
      if (status.endsWith("xx")) {
        const prefix = parseInt(status[0]);
        return Math.floor(entry.response.status / 100) === prefix;
      }
      return false;
    });
  }

  /**
   * Get page reference
   */
  getPage(): BrowserPage {
    return this.page;
  }

  /**
   * Helper to delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

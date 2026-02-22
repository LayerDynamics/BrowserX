/**
 * HAR Recorder API
 *
 * Records HTTP traffic in HAR (HTTP Archive) format for debugging,
 * performance analysis, and test data generation.
 */

import { BrowserPage } from "./BrowserPage.ts";

/**
 * HAR format version
 */
export const HAR_VERSION = "1.2";

/**
 * HAR Creator info
 */
export interface HARCreator {
  name: string;
  version: string;
  comment?: string;
}

/**
 * HAR Browser info
 */
export interface HARBrowser {
  name: string;
  version: string;
  comment?: string;
}

/**
 * HAR Page timing
 */
export interface HARPageTiming {
  /** Content of the page loaded (DOMContentLoaded event) */
  onContentLoad: number;
  /** Page is loaded (load event) */
  onLoad: number;
  comment?: string;
}

/**
 * HAR Page
 */
export interface HARPage {
  /** Start time of page load */
  startedDateTime: string;
  /** Unique page identifier */
  id: string;
  /** Page title */
  title: string;
  /** Page timing */
  pageTimings: HARPageTiming;
  comment?: string;
}

/**
 * HAR Cookie
 */
export interface HARCookie {
  name: string;
  value: string;
  path?: string;
  domain?: string;
  expires?: string;
  httpOnly?: boolean;
  secure?: boolean;
  comment?: string;
}

/**
 * HAR Header
 */
export interface HARHeader {
  name: string;
  value: string;
  comment?: string;
}

/**
 * HAR Query string
 */
export interface HARQueryString {
  name: string;
  value: string;
  comment?: string;
}

/**
 * HAR Post data parameter
 */
export interface HARPostParam {
  name: string;
  value?: string;
  fileName?: string;
  contentType?: string;
  comment?: string;
}

/**
 * HAR Post data
 */
export interface HARPostData {
  mimeType: string;
  params?: HARPostParam[];
  text?: string;
  comment?: string;
}

/**
 * HAR Content
 */
export interface HARContent {
  /** Length of the returned content in bytes */
  size: number;
  /** Number of bytes saved via compression */
  compression?: number;
  /** MIME type of the response */
  mimeType: string;
  /** Response body text */
  text?: string;
  /** Encoding used for response text */
  encoding?: string;
  comment?: string;
}

/**
 * HAR Request
 */
export interface HARRequest {
  method: string;
  url: string;
  httpVersion: string;
  cookies: HARCookie[];
  headers: HARHeader[];
  queryString: HARQueryString[];
  postData?: HARPostData;
  /** Total request header size */
  headersSize: number;
  /** Total request body size */
  bodySize: number;
  comment?: string;
}

/**
 * HAR Response
 */
export interface HARResponse {
  status: number;
  statusText: string;
  httpVersion: string;
  cookies: HARCookie[];
  headers: HARHeader[];
  content: HARContent;
  redirectURL: string;
  /** Total response header size */
  headersSize: number;
  /** Total response body size */
  bodySize: number;
  comment?: string;
}

/**
 * HAR Cache state
 */
export interface HARCacheState {
  expires?: string;
  lastAccess: string;
  eTag: string;
  hitCount: number;
  comment?: string;
}

/**
 * HAR Cache
 */
export interface HARCache {
  beforeRequest?: HARCacheState;
  afterRequest?: HARCacheState;
  comment?: string;
}

/**
 * HAR Timings
 */
export interface HARTimings {
  /** Time spent in a queue waiting for a network connection */
  blocked: number;
  /** DNS resolution time */
  dns: number;
  /** Time required to create TCP connection */
  connect: number;
  /** Time required to send HTTP request */
  send: number;
  /** Waiting for a response from the server */
  wait: number;
  /** Time required to read entire response from server */
  receive: number;
  /** Time required for SSL/TLS negotiation */
  ssl: number;
  comment?: string;
}

/**
 * HAR Entry
 */
export interface HAREntry {
  /** Reference to parent page */
  pageref?: string;
  /** Start time of the request */
  startedDateTime: string;
  /** Total elapsed time of the request in milliseconds */
  time: number;
  /** Request info */
  request: HARRequest;
  /** Response info */
  response: HARResponse;
  /** Cache usage info */
  cache: HARCache;
  /** Detailed timing info */
  timings: HARTimings;
  /** Unique ID for connection */
  serverIPAddress?: string;
  /** Port of the TCP connection */
  connection?: string;
  comment?: string;
}

/**
 * HAR Log
 */
export interface HARLog {
  version: string;
  creator: HARCreator;
  browser?: HARBrowser;
  pages?: HARPage[];
  entries: HAREntry[];
  comment?: string;
}

/**
 * HAR document
 */
export interface HAR {
  log: HARLog;
}

/**
 * Recording options
 */
export interface RecordingOptions {
  /** Include request body */
  captureRequestBody?: boolean;
  /** Include response body */
  captureResponseBody?: boolean;
  /** Maximum response body size to capture (bytes) */
  maxResponseBodySize?: number;
  /** URL patterns to include (regex strings) */
  includePatterns?: string[];
  /** URL patterns to exclude (regex strings) */
  excludePatterns?: string[];
  /** Include only specific content types */
  contentTypeFilter?: string[];
  /** Capture timing information */
  captureTiming?: boolean;
  /** Capture cookies */
  captureCookies?: boolean;
}

/**
 * Network request event
 */
export interface NetworkRequestEvent {
  requestId: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  postData?: string;
  timestamp: number;
}

/**
 * Network response event
 */
export interface NetworkResponseEvent {
  requestId: string;
  url: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  mimeType: string;
  body?: string;
  bodySize: number;
  timestamp: number;
  fromCache?: boolean;
}

/**
 * HAR Recorder class
 */
export class HARRecorder {
  private page: BrowserPage;
  private recording: boolean = false;
  private entries: HAREntry[] = [];
  private pages: HARPage[] = [];
  private pendingRequests: Map<string, { request: NetworkRequestEvent; startTime: number }> =
    new Map();
  private options: RecordingOptions = {};
  private currentPageId: string | null = null;
  private pageIdCounter: number = 0;

  constructor(page: BrowserPage) {
    this.page = page;
  }

  /**
   * Start recording network traffic
   */
  startRecording(options: RecordingOptions = {}): void {
    if (this.recording) {
      return;
    }

    this.options = {
      captureRequestBody: true,
      captureResponseBody: true,
      maxResponseBodySize: 1024 * 1024, // 1MB default
      captureTiming: true,
      captureCookies: true,
      ...options,
    };

    this.recording = true;
    this.entries = [];
    this.pages = [];
    this.pendingRequests.clear();
    this.currentPageId = null;
    this.pageIdCounter = 0;
  }

  /**
   * Stop recording network traffic
   */
  stopRecording(): void {
    this.recording = false;
  }

  /**
   * Check if recording is active
   */
  isRecording(): boolean {
    return this.recording;
  }

  /**
   * Record a new page load
   */
  recordPageLoad(title?: string): string {
    const pageId = `page_${++this.pageIdCounter}`;
    const now = new Date();

    const harPage: HARPage = {
      startedDateTime: now.toISOString(),
      id: pageId,
      title: title || this.page.getCurrentURL() || "Untitled Page",
      pageTimings: {
        onContentLoad: -1,
        onLoad: -1,
      },
    };

    this.pages.push(harPage);
    this.currentPageId = pageId;

    return pageId;
  }

  /**
   * Update page timing information
   */
  updatePageTiming(pageId: string, timing: Partial<HARPageTiming>): void {
    const page = this.pages.find((p) => p.id === pageId);
    if (page) {
      if (timing.onContentLoad !== undefined) {
        page.pageTimings.onContentLoad = timing.onContentLoad;
      }
      if (timing.onLoad !== undefined) {
        page.pageTimings.onLoad = timing.onLoad;
      }
    }
  }

  /**
   * Record a network request
   */
  recordRequest(event: NetworkRequestEvent): void {
    if (!this.recording) return;

    // Check URL filters
    if (!this.shouldRecord(event.url)) {
      return;
    }

    this.pendingRequests.set(event.requestId, {
      request: event,
      startTime: event.timestamp,
    });
  }

  /**
   * Record a network response
   */
  recordResponse(event: NetworkResponseEvent): void {
    if (!this.recording) return;

    const pending = this.pendingRequests.get(event.requestId);
    if (!pending) {
      return;
    }

    this.pendingRequests.delete(event.requestId);

    const { request, startTime } = pending;
    const endTime = event.timestamp;
    const duration = endTime - startTime;

    // Parse URL
    let urlObj: URL;
    try {
      urlObj = new URL(request.url);
    } catch {
      return; // Invalid URL, skip
    }

    // Parse query string
    const queryString: HARQueryString[] = [];
    urlObj.searchParams.forEach((value, name) => {
      queryString.push({ name, value });
    });

    // Parse request headers
    const requestHeaders: HARHeader[] = Object.entries(request.headers).map(([name, value]) => ({
      name,
      value,
    }));

    // Parse response headers
    const responseHeaders: HARHeader[] = Object.entries(event.headers).map(([name, value]) => ({
      name,
      value,
    }));

    // Create HAR request
    const harRequest: HARRequest = {
      method: request.method,
      url: request.url,
      httpVersion: "HTTP/1.1",
      cookies: this.options.captureCookies ? this.extractCookies(request.headers["cookie"]) : [],
      headers: requestHeaders,
      queryString,
      postData: this.options.captureRequestBody && request.postData
        ? this.parsePostData(request.postData, request.headers["content-type"])
        : undefined,
      headersSize: this.calculateHeadersSize(requestHeaders),
      bodySize: request.postData?.length || 0,
    };

    // Truncate response body if needed
    let responseBody = event.body;
    if (
      responseBody && this.options.maxResponseBodySize &&
      responseBody.length > this.options.maxResponseBodySize
    ) {
      responseBody = responseBody.substring(0, this.options.maxResponseBodySize);
    }

    // Create HAR response
    const harResponse: HARResponse = {
      status: event.status,
      statusText: event.statusText,
      httpVersion: "HTTP/1.1",
      cookies: this.options.captureCookies
        ? this.extractSetCookies(event.headers["set-cookie"])
        : [],
      headers: responseHeaders,
      content: {
        size: event.bodySize,
        mimeType: event.mimeType,
        text: this.options.captureResponseBody ? responseBody : undefined,
      },
      redirectURL: event.headers["location"] || "",
      headersSize: this.calculateHeadersSize(responseHeaders),
      bodySize: event.bodySize,
    };

    // Create HAR entry
    const entry: HAREntry = {
      pageref: this.currentPageId || undefined,
      startedDateTime: new Date(startTime).toISOString(),
      time: duration,
      request: harRequest,
      response: harResponse,
      cache: {
        beforeRequest: event.fromCache
          ? { lastAccess: new Date(startTime).toISOString(), eTag: "", hitCount: 1 }
          : undefined,
      },
      timings: this.options.captureTiming
        ? {
          blocked: 0,
          dns: -1,
          connect: -1,
          send: 0,
          wait: duration,
          receive: 0,
          ssl: -1,
        }
        : {
          blocked: -1,
          dns: -1,
          connect: -1,
          send: -1,
          wait: -1,
          receive: -1,
          ssl: -1,
        },
    };

    this.entries.push(entry);
  }

  /**
   * Get the current HAR data
   */
  getHAR(): HAR {
    return {
      log: {
        version: HAR_VERSION,
        creator: {
          name: "BrowserX",
          version: "1.0.0",
        },
        browser: {
          name: "BrowserX",
          version: "1.0.0",
        },
        pages: this.pages,
        entries: this.entries,
      },
    };
  }

  /**
   * Get HAR as JSON string
   */
  getHARJson(pretty: boolean = false): string {
    const har = this.getHAR();
    return pretty ? JSON.stringify(har, null, 2) : JSON.stringify(har);
  }

  /**
   * Get all recorded entries
   */
  getEntries(): HAREntry[] {
    return [...this.entries];
  }

  /**
   * Get entries filtered by URL pattern
   */
  getEntriesByUrl(pattern: string | RegExp): HAREntry[] {
    const regex = typeof pattern === "string" ? new RegExp(pattern) : pattern;
    return this.entries.filter((entry) => regex.test(entry.request.url));
  }

  /**
   * Get entries filtered by content type
   */
  getEntriesByContentType(contentType: string): HAREntry[] {
    return this.entries.filter((entry) => entry.response.content.mimeType.includes(contentType));
  }

  /**
   * Get entries filtered by status code
   */
  getEntriesByStatus(status: number | number[]): HAREntry[] {
    const statuses = Array.isArray(status) ? status : [status];
    return this.entries.filter((entry) => statuses.includes(entry.response.status));
  }

  /**
   * Get failed requests (status >= 400)
   */
  getFailedRequests(): HAREntry[] {
    return this.entries.filter((entry) => entry.response.status >= 400);
  }

  /**
   * Get slow requests
   */
  getSlowRequests(thresholdMs: number): HAREntry[] {
    return this.entries.filter((entry) => entry.time >= thresholdMs);
  }

  /**
   * Get network statistics
   */
  getStatistics(): {
    totalRequests: number;
    totalSize: number;
    totalTime: number;
    averageTime: number;
    requestsByType: Record<string, number>;
    requestsByStatus: Record<string, number>;
  } {
    const stats = {
      totalRequests: this.entries.length,
      totalSize: 0,
      totalTime: 0,
      averageTime: 0,
      requestsByType: {} as Record<string, number>,
      requestsByStatus: {} as Record<string, number>,
    };

    for (const entry of this.entries) {
      stats.totalSize += entry.response.bodySize;
      stats.totalTime += entry.time;

      const mimeType = entry.response.content.mimeType.split(";")[0];
      stats.requestsByType[mimeType] = (stats.requestsByType[mimeType] || 0) + 1;

      const statusGroup = `${Math.floor(entry.response.status / 100)}xx`;
      stats.requestsByStatus[statusGroup] = (stats.requestsByStatus[statusGroup] || 0) + 1;
    }

    stats.averageTime = stats.totalRequests > 0 ? stats.totalTime / stats.totalRequests : 0;

    return stats;
  }

  /**
   * Clear all recorded data
   */
  clear(): void {
    this.entries = [];
    this.pages = [];
    this.pendingRequests.clear();
    this.currentPageId = null;
  }

  /**
   * Check if URL should be recorded based on filters
   */
  private shouldRecord(url: string): boolean {
    // Check exclude patterns
    if (this.options.excludePatterns) {
      for (const pattern of this.options.excludePatterns) {
        if (new RegExp(pattern).test(url)) {
          return false;
        }
      }
    }

    // Check include patterns
    if (this.options.includePatterns && this.options.includePatterns.length > 0) {
      for (const pattern of this.options.includePatterns) {
        if (new RegExp(pattern).test(url)) {
          return true;
        }
      }
      return false;
    }

    return true;
  }

  /**
   * Extract cookies from Cookie header
   */
  private extractCookies(cookieHeader?: string): HARCookie[] {
    if (!cookieHeader) return [];

    return cookieHeader.split(";").map((cookie) => {
      const [name, ...valueParts] = cookie.trim().split("=");
      return {
        name: name.trim(),
        value: valueParts.join("=").trim(),
      };
    });
  }

  /**
   * Extract cookies from Set-Cookie header
   */
  private extractSetCookies(setCookieHeader?: string): HARCookie[] {
    if (!setCookieHeader) return [];

    // Set-Cookie headers should be separate, but may be combined
    const cookies = setCookieHeader.split(/,(?=[^;,]*=)/);

    return cookies.map((cookie) => {
      const parts = cookie.split(";");
      const [name, ...valueParts] = parts[0].trim().split("=");

      const harCookie: HARCookie = {
        name: name.trim(),
        value: valueParts.join("=").trim(),
      };

      // Parse cookie attributes
      for (let i = 1; i < parts.length; i++) {
        const attr = parts[i].trim().toLowerCase();
        if (attr.startsWith("path=")) {
          harCookie.path = attr.substring(5);
        } else if (attr.startsWith("domain=")) {
          harCookie.domain = attr.substring(7);
        } else if (attr.startsWith("expires=")) {
          harCookie.expires = attr.substring(8);
        } else if (attr === "httponly") {
          harCookie.httpOnly = true;
        } else if (attr === "secure") {
          harCookie.secure = true;
        }
      }

      return harCookie;
    });
  }

  /**
   * Parse POST data
   */
  private parsePostData(data: string, contentType?: string): HARPostData {
    const mimeType = contentType?.split(";")[0] || "application/octet-stream";

    if (mimeType === "application/x-www-form-urlencoded") {
      const params: HARPostParam[] = [];
      const searchParams = new URLSearchParams(data);
      searchParams.forEach((value, name) => {
        params.push({ name, value });
      });
      return { mimeType, params };
    }

    return { mimeType, text: data };
  }

  /**
   * Calculate headers size
   */
  private calculateHeadersSize(headers: HARHeader[]): number {
    let size = 0;
    for (const header of headers) {
      size += header.name.length + header.value.length + 4; // ": " + "\r\n"
    }
    return size;
  }
}

/**
 * Create a HARRecorder instance for a page
 */
export function createHARRecorder(page: BrowserPage): HARRecorder {
  return new HARRecorder(page);
}

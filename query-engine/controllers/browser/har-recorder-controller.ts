/**
 * HAR Recorder Controller
 *
 * Bridges the query engine with browser HAR recording capabilities.
 * Provides network traffic recording and analysis for query execution.
 */

import type { BrowserPage } from "../../../browser/src/api/BrowserPage.ts";
import {
  HARRecorder,
  createHARRecorder,
  type HAR,
  type HAREntry,
  type HARPage,
  type RecordingOptions,
  type NetworkRequestEvent,
  type NetworkResponseEvent,
} from "../../../browser/src/api/HARRecorder.ts";
import { getCurrentBrowserController } from "./browser-context.ts";

/**
 * Network summary
 */
export interface NetworkSummary {
  /** Total number of requests */
  totalRequests: number;
  /** Total bytes transferred */
  totalBytes: number;
  /** Total time in milliseconds */
  totalTimeMs: number;
  /** Average request time in milliseconds */
  averageTimeMs: number;
  /** Number of failed requests (status >= 400) */
  failedRequests: number;
  /** Number of cached requests */
  cachedRequests: number;
  /** Breakdown by content type */
  byContentType: Record<string, { count: number; bytes: number }>;
  /** Breakdown by status code */
  byStatus: Record<string, number>;
  /** Slowest requests */
  slowestRequests: Array<{ url: string; timeMs: number }>;
  /** Largest requests */
  largestRequests: Array<{ url: string; bytes: number }>;
}

/**
 * HAR Recorder Controller for query engine integration
 */
export class HARRecorderController {
  private harRecorder: HARRecorder | null = null;

  /**
   * Get or create HARRecorder instance
   */
  private async getHARRecorder(): Promise<HARRecorder> {
    if (this.harRecorder) {
      return this.harRecorder;
    }

    const browserController = getCurrentBrowserController();
    if (!browserController) {
      throw new Error("Browser context not initialized. Navigate to a page first.");
    }

    const page = browserController.getCurrentPage();
    if (!page) {
      throw new Error("No page available in browser context.");
    }

    this.harRecorder = createHARRecorder(page as unknown as BrowserPage);
    return this.harRecorder;
  }

  /**
   * Start recording network traffic
   */
  async startRecording(options: RecordingOptions = {}): Promise<void> {
    const recorder = await this.getHARRecorder();
    recorder.startRecording(options);
  }

  /**
   * Stop recording network traffic
   */
  async stopRecording(): Promise<void> {
    const recorder = await this.getHARRecorder();
    recorder.stopRecording();
  }

  /**
   * Check if recording is active
   */
  async isRecording(): Promise<boolean> {
    const recorder = await this.getHARRecorder();
    return recorder.isRecording();
  }

  /**
   * Record a page load event
   */
  async recordPageLoad(title?: string): Promise<string> {
    const recorder = await this.getHARRecorder();
    return recorder.recordPageLoad(title);
  }

  /**
   * Record a network request
   */
  async recordRequest(event: NetworkRequestEvent): Promise<void> {
    const recorder = await this.getHARRecorder();
    recorder.recordRequest(event);
  }

  /**
   * Record a network response
   */
  async recordResponse(event: NetworkResponseEvent): Promise<void> {
    const recorder = await this.getHARRecorder();
    recorder.recordResponse(event);
  }

  /**
   * Get the current HAR data
   */
  async getHAR(): Promise<HAR> {
    const recorder = await this.getHARRecorder();
    return recorder.getHAR();
  }

  /**
   * Get HAR as JSON string
   */
  async getHARJson(pretty?: boolean): Promise<string> {
    const recorder = await this.getHARRecorder();
    return recorder.getHARJson(pretty);
  }

  /**
   * Get all recorded entries
   */
  async getEntries(): Promise<HAREntry[]> {
    const recorder = await this.getHARRecorder();
    return recorder.getEntries();
  }

  /**
   * Get entries filtered by URL pattern
   */
  async getEntriesByUrl(pattern: string | RegExp): Promise<HAREntry[]> {
    const recorder = await this.getHARRecorder();
    return recorder.getEntriesByUrl(pattern);
  }

  /**
   * Get entries filtered by content type
   */
  async getEntriesByContentType(contentType: string): Promise<HAREntry[]> {
    const recorder = await this.getHARRecorder();
    return recorder.getEntriesByContentType(contentType);
  }

  /**
   * Get entries filtered by status code
   */
  async getEntriesByStatus(status: number | number[]): Promise<HAREntry[]> {
    const recorder = await this.getHARRecorder();
    return recorder.getEntriesByStatus(status);
  }

  /**
   * Get failed requests (status >= 400)
   */
  async getFailedRequests(): Promise<HAREntry[]> {
    const recorder = await this.getHARRecorder();
    return recorder.getFailedRequests();
  }

  /**
   * Get slow requests above threshold
   */
  async getSlowRequests(thresholdMs: number): Promise<HAREntry[]> {
    const recorder = await this.getHARRecorder();
    return recorder.getSlowRequests(thresholdMs);
  }

  /**
   * Get network statistics
   */
  async getStatistics(): Promise<{
    totalRequests: number;
    totalSize: number;
    totalTime: number;
    averageTime: number;
    requestsByType: Record<string, number>;
    requestsByStatus: Record<string, number>;
  }> {
    const recorder = await this.getHARRecorder();
    return recorder.getStatistics();
  }

  /**
   * Get a comprehensive network summary
   */
  async getNetworkSummary(): Promise<NetworkSummary> {
    const entries = await this.getEntries();

    const summary: NetworkSummary = {
      totalRequests: entries.length,
      totalBytes: 0,
      totalTimeMs: 0,
      averageTimeMs: 0,
      failedRequests: 0,
      cachedRequests: 0,
      byContentType: {},
      byStatus: {},
      slowestRequests: [],
      largestRequests: [],
    };

    const requestTimes: Array<{ url: string; timeMs: number }> = [];
    const requestSizes: Array<{ url: string; bytes: number }> = [];

    for (const entry of entries) {
      // Total bytes
      summary.totalBytes += entry.response.bodySize;

      // Total time
      summary.totalTimeMs += entry.time;

      // Track times and sizes for sorting
      requestTimes.push({ url: entry.request.url, timeMs: entry.time });
      requestSizes.push({ url: entry.request.url, bytes: entry.response.bodySize });

      // Failed requests
      if (entry.response.status >= 400) {
        summary.failedRequests++;
      }

      // Cached requests
      if (entry.cache.beforeRequest) {
        summary.cachedRequests++;
      }

      // By content type
      const contentType = entry.response.content.mimeType.split(";")[0];
      if (!summary.byContentType[contentType]) {
        summary.byContentType[contentType] = { count: 0, bytes: 0 };
      }
      summary.byContentType[contentType].count++;
      summary.byContentType[contentType].bytes += entry.response.bodySize;

      // By status
      const statusGroup = `${Math.floor(entry.response.status / 100)}xx`;
      summary.byStatus[statusGroup] = (summary.byStatus[statusGroup] || 0) + 1;
    }

    // Calculate average
    summary.averageTimeMs = entries.length > 0 ? summary.totalTimeMs / entries.length : 0;

    // Get top 5 slowest requests
    summary.slowestRequests = requestTimes
      .sort((a, b) => b.timeMs - a.timeMs)
      .slice(0, 5);

    // Get top 5 largest requests
    summary.largestRequests = requestSizes
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 5);

    return summary;
  }

  /**
   * Find requests containing specific header
   */
  async findByHeader(headerName: string, headerValue?: string): Promise<HAREntry[]> {
    const entries = await this.getEntries();

    return entries.filter(entry => {
      const header = entry.request.headers.find(
        h => h.name.toLowerCase() === headerName.toLowerCase()
      );
      if (!header) return false;
      if (headerValue === undefined) return true;
      return header.value.includes(headerValue);
    });
  }

  /**
   * Find requests by method
   */
  async findByMethod(method: string): Promise<HAREntry[]> {
    const entries = await this.getEntries();
    return entries.filter(entry => entry.request.method.toUpperCase() === method.toUpperCase());
  }

  /**
   * Check if any request failed
   */
  async hasFailures(): Promise<boolean> {
    const failed = await this.getFailedRequests();
    return failed.length > 0;
  }

  /**
   * Wait for pending requests to complete
   */
  async waitForPendingRequests(timeout: number = 30000): Promise<boolean> {
    // In a real implementation, this would monitor pending requests
    // For now, we just wait a short time for any pending to complete
    await new Promise(resolve => setTimeout(resolve, Math.min(timeout, 1000)));
    return true;
  }

  /**
   * Assert no failed requests
   */
  async assertNoFailures(): Promise<{
    passed: boolean;
    failedRequests: Array<{ url: string; status: number }>;
  }> {
    const failed = await this.getFailedRequests();

    return {
      passed: failed.length === 0,
      failedRequests: failed.map(e => ({
        url: e.request.url,
        status: e.response.status,
      })),
    };
  }

  /**
   * Assert no slow requests
   */
  async assertNoSlowRequests(thresholdMs: number): Promise<{
    passed: boolean;
    slowRequests: Array<{ url: string; timeMs: number }>;
  }> {
    const slow = await this.getSlowRequests(thresholdMs);

    return {
      passed: slow.length === 0,
      slowRequests: slow.map(e => ({
        url: e.request.url,
        timeMs: e.time,
      })),
    };
  }

  /**
   * Assert request was made to URL
   */
  async assertRequestMade(urlPattern: string | RegExp): Promise<{
    passed: boolean;
    matchedRequests: number;
  }> {
    const matched = await this.getEntriesByUrl(urlPattern);

    return {
      passed: matched.length > 0,
      matchedRequests: matched.length,
    };
  }

  /**
   * Clear all recorded data
   */
  async clear(): Promise<void> {
    const recorder = await this.getHARRecorder();
    recorder.clear();
  }

  /**
   * Clear the HAR recorder instance (for cleanup)
   */
  clearController(): void {
    this.harRecorder = null;
  }
}

// Singleton instance
let harRecorderControllerInstance: HARRecorderController | null = null;

/**
 * Get the HAR recorder controller instance
 */
export function getHARRecorderController(): HARRecorderController {
  if (!harRecorderControllerInstance) {
    harRecorderControllerInstance = new HARRecorderController();
  }
  return harRecorderControllerInstance;
}

/**
 * Clear the HAR recorder controller instance
 */
export function clearHARRecorderController(): void {
  if (harRecorderControllerInstance) {
    harRecorderControllerInstance.clearController();
    harRecorderControllerInstance = null;
  }
}

// Re-export types for convenience
export type {
  HAR,
  HAREntry,
  HARPage,
  HARRequest,
  HARResponse,
  HARTimings,
  HARCookie,
  HARHeader,
  RecordingOptions,
  NetworkRequestEvent,
  NetworkResponseEvent,
};

// Import and re-export these types
import type {
  HARRequest,
  HARResponse,
  HARTimings,
  HARCookie,
  HARHeader,
} from "../../../browser/src/api/HARRecorder.ts";

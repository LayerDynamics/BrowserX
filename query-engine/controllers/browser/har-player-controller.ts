/**
 * HAR Player Controller
 *
 * Bridges the query engine with browser HAR playback capabilities.
 * Provides network traffic mocking and replay for testing and offline simulation.
 */

import type { BrowserPage } from "@browserx/browser";
import {
  HARPlayer,
  THROTTLE_PRESETS,
  type MatchStrategy,
  type ThrottlePreset,
  type ThrottleConfig,
  type PlaybackOptions,
  type PlaybackStats,
  type RequestInfo,
  type RequestLogEntry,
  type ReplayedResponse,
  type ExtractedCookies,
  type ExtractedAuth,
  type PlaybackResult,
} from "@browserx/browser";
import type { HAR, HAREntry } from "@browserx/browser";
import { getCurrentBrowserController } from "./browser-context.ts";
import { getHARRecorderController } from "./har-recorder-controller.ts";

/**
 * HAR Player Controller for query engine integration
 */
export class HARPlayerController {
  private harPlayer: HARPlayer | null = null;

  /**
   * Get or create HARPlayer instance
   */
  private async getHARPlayer(): Promise<HARPlayer> {
    if (this.harPlayer) {
      return this.harPlayer;
    }

    const browserController = getCurrentBrowserController();
    if (!browserController) {
      throw new Error("Browser context not initialized. Navigate to a page first.");
    }

    const page = browserController.getCurrentPage();
    if (!page) {
      throw new Error("No page available in browser context.");
    }

    this.harPlayer = new HARPlayer(page as unknown as BrowserPage);
    return this.harPlayer;
  }

  /**
   * Load HAR data for playback
   * @param harOrJson - HAR object or JSON string
   */
  async loadHAR(harOrJson: HAR | string): Promise<void> {
    const player = await this.getHARPlayer();
    player.loadHAR(harOrJson);
  }

  /**
   * Load HAR data from the active HARRecorder
   */
  async loadHARFromRecorder(): Promise<void> {
    const recorder = getHARRecorderController();
    const har = await recorder.getHAR();
    await this.loadHAR(har);
  }

  /**
   * Check if HAR data is loaded
   */
  async isLoaded(): Promise<boolean> {
    const player = await this.getHARPlayer();
    return player.isLoaded();
  }

  /**
   * Get loaded HAR data
   */
  async getHAR(): Promise<HAR | null> {
    const player = await this.getHARPlayer();
    return player.getHAR();
  }

  /**
   * Start HAR playback mode
   * @param options - Playback options
   */
  async startPlayback(options: PlaybackOptions = {}): Promise<void> {
    const player = await this.getHARPlayer();
    player.startPlayback(options);
  }

  /**
   * Stop HAR playback mode
   */
  async stopPlayback(): Promise<void> {
    const player = await this.getHARPlayer();
    player.stopPlayback();
  }

  /**
   * Check if playback is active
   */
  async isPlaying(): Promise<boolean> {
    const player = await this.getHARPlayer();
    return player.isPlaying();
  }

  /**
   * Find a matching HAR entry for a request
   * @param method - HTTP method
   * @param url - Request URL
   * @param headers - Optional headers
   */
  async findMatch(
    method: string,
    url: string,
    headers?: Record<string, string>
  ): Promise<HAREntry | null> {
    const player = await this.getHARPlayer();
    return player.findMatchingEntry({ method, url, headers });
  }

  /**
   * Process a request through the HAR player
   * @param method - HTTP method
   * @param url - Request URL
   * @param headers - Optional headers
   * @param body - Optional request body
   */
  async processRequest(
    method: string,
    url: string,
    headers?: Record<string, string>,
    body?: string
  ): Promise<PlaybackResult> {
    const player = await this.getHARPlayer();
    return player.processRequest({ method, url, headers, body });
  }

  /**
   * Replay a specific HAR entry
   * @param entry - HAR entry to replay
   */
  async replayEntry(entry: HAREntry): Promise<ReplayedResponse> {
    const player = await this.getHARPlayer();
    return player.replayResponse(entry);
  }

  /**
   * Get playback statistics
   */
  async getStats(): Promise<PlaybackStats> {
    const player = await this.getHARPlayer();
    return player.getStats();
  }

  /**
   * Get match rate as percentage (0-100)
   */
  async getMatchRate(): Promise<number> {
    const player = await this.getHARPlayer();
    return player.getMatchRate();
  }

  /**
   * Get unmatched requests
   */
  async getUnmatchedRequests(): Promise<RequestLogEntry[]> {
    const player = await this.getHARPlayer();
    return player.getUnmatchedRequests();
  }

  /**
   * Reset playback statistics
   */
  async resetStats(): Promise<void> {
    const player = await this.getHARPlayer();
    player.resetStats();
  }

  /**
   * Assert all requests were matched (for testing)
   * @throws Error if any requests were unmatched
   */
  async assertAllRequestsMatched(): Promise<{
    passed: boolean;
    unmatchedCount: number;
    unmatchedRequests: Array<{ method: string; url: string }>;
  }> {
    const player = await this.getHARPlayer();
    const unmatched = player.getUnmatchedRequests();

    if (unmatched.length > 0) {
      return {
        passed: false,
        unmatchedCount: unmatched.length,
        unmatchedRequests: unmatched.map(r => ({ method: r.method, url: r.url })),
      };
    }

    return {
      passed: true,
      unmatchedCount: 0,
      unmatchedRequests: [],
    };
  }

  /**
   * Assert match rate meets minimum threshold (for testing)
   * @param minRate - Minimum acceptable match rate (0-100)
   */
  async assertMatchRate(minRate: number): Promise<{
    passed: boolean;
    actualRate: number;
    minRate: number;
  }> {
    const player = await this.getHARPlayer();
    const actualRate = player.getMatchRate();

    return {
      passed: actualRate >= minRate,
      actualRate,
      minRate,
    };
  }

  /**
   * Extract cookies from loaded HAR
   */
  async extractCookies(): Promise<ExtractedCookies> {
    const player = await this.getHARPlayer();
    return player.extractCookiesFromHAR();
  }

  /**
   * Extract authentication from loaded HAR
   */
  async extractAuth(): Promise<ExtractedAuth> {
    const player = await this.getHARPlayer();
    return player.extractAuthFromHAR();
  }

  /**
   * Get number of entries in loaded HAR
   */
  async getEntryCount(): Promise<number> {
    const player = await this.getHARPlayer();
    return player.getEntryCount();
  }

  /**
   * Get all unique URLs in HAR
   */
  async getUniqueUrls(): Promise<string[]> {
    const player = await this.getHARPlayer();
    return player.getUniqueUrls();
  }

  /**
   * Filter entries by URL pattern
   * @param pattern - RegExp pattern string
   */
  async filterEntriesByUrl(pattern: string): Promise<HAREntry[]> {
    const player = await this.getHARPlayer();
    return player.filterEntriesByUrl(new RegExp(pattern));
  }

  /**
   * Filter entries by HTTP method
   * @param method - HTTP method (GET, POST, etc.)
   */
  async filterEntriesByMethod(method: string): Promise<HAREntry[]> {
    const player = await this.getHARPlayer();
    return player.filterEntriesByMethod(method);
  }

  /**
   * Filter entries by status code
   * @param status - Status code or pattern (200, "2xx", "4xx")
   */
  async filterEntriesByStatus(status: number | string): Promise<HAREntry[]> {
    const player = await this.getHARPlayer();
    return player.filterEntriesByStatus(status);
  }

  /**
   * Get available throttle presets
   */
  getThrottlePresets(): Record<string, ThrottleConfig> {
    return { ...THROTTLE_PRESETS };
  }

  /**
   * Create playback options with specific throttle preset
   * @param preset - Throttle preset name
   * @param additionalOptions - Additional playback options
   */
  createThrottledOptions(
    preset: ThrottlePreset,
    additionalOptions: Partial<PlaybackOptions> = {}
  ): PlaybackOptions {
    return {
      throttle: preset,
      ...additionalOptions,
    };
  }

  /**
   * Create playback options for offline simulation
   * @param additionalOptions - Additional playback options
   */
  createOfflineOptions(additionalOptions: Partial<PlaybackOptions> = {}): PlaybackOptions {
    return {
      throttle: "offline",
      rejectUnmatched: true,
      ...additionalOptions,
    };
  }

  /**
   * Create playback options for exact matching
   * @param additionalOptions - Additional playback options
   */
  createExactMatchOptions(additionalOptions: Partial<PlaybackOptions> = {}): PlaybackOptions {
    return {
      matchStrategy: "exact",
      rejectUnmatched: true,
      ...additionalOptions,
    };
  }

  /**
   * Get a summary of the loaded HAR
   */
  async getHARSummary(): Promise<{
    entryCount: number;
    uniqueUrls: number;
    methods: Record<string, number>;
    statusCodes: Record<string, number>;
    contentTypes: Record<string, number>;
    totalSize: number;
  }> {
    const player = await this.getHARPlayer();
    const har = player.getHAR();

    if (!har) {
      return {
        entryCount: 0,
        uniqueUrls: 0,
        methods: {},
        statusCodes: {},
        contentTypes: {},
        totalSize: 0,
      };
    }

    const methods: Record<string, number> = {};
    const statusCodes: Record<string, number> = {};
    const contentTypes: Record<string, number> = {};
    const urls = new Set<string>();
    let totalSize = 0;

    for (const entry of har.log.entries) {
      // Track URLs
      urls.add(entry.request.url);

      // Track methods
      const method = entry.request.method;
      methods[method] = (methods[method] || 0) + 1;

      // Track status codes
      const status = String(entry.response.status);
      statusCodes[status] = (statusCodes[status] || 0) + 1;

      // Track content types
      const contentType = entry.response.content.mimeType.split(";")[0];
      contentTypes[contentType] = (contentTypes[contentType] || 0) + 1;

      // Track total size
      totalSize += entry.response.bodySize || entry.response.content.size || 0;
    }

    return {
      entryCount: har.log.entries.length,
      uniqueUrls: urls.size,
      methods,
      statusCodes,
      contentTypes,
      totalSize,
    };
  }

  /**
   * Clear the HAR player instance
   */
  clearController(): void {
    if (this.harPlayer) {
      this.harPlayer.stopPlayback();
    }
    this.harPlayer = null;
  }
}

// Singleton instance
let harPlayerControllerInstance: HARPlayerController | null = null;

/**
 * Get the HAR player controller instance
 */
export function getHARPlayerController(): HARPlayerController {
  if (!harPlayerControllerInstance) {
    harPlayerControllerInstance = new HARPlayerController();
  }
  return harPlayerControllerInstance;
}

/**
 * Clear the HAR player controller instance
 */
export function clearHARPlayerController(): void {
  if (harPlayerControllerInstance) {
    harPlayerControllerInstance.clearController();
    harPlayerControllerInstance = null;
  }
}

// Re-export types for convenience
export type {
  HAR,
  HAREntry,
  MatchStrategy,
  ThrottlePreset,
  ThrottleConfig,
  PlaybackOptions,
  PlaybackStats,
  RequestInfo,
  RequestLogEntry,
  ReplayedResponse,
  ExtractedCookies,
  ExtractedAuth,
  PlaybackResult,
};

export { THROTTLE_PRESETS };

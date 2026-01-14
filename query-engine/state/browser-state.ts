/**
 * Browser state tracker
 * Tracks navigation history, viewport, scroll position, and other browser state
 */

import type { URLString } from "../types/primitives.ts";
import type { BrowserStateSnapshot } from "./types.ts";

/**
 * Browser state tracker
 *
 * Maintains browser state across navigation:
 * - Navigation history with back/forward support
 * - Current URL and page title
 * - Viewport dimensions
 * - Scroll position
 * - User agent
 */
export class BrowserStateTracker {
  private navigationHistory: URLString[] = [];
  private historyIndex: number = -1;
  private currentURL?: URLString;
  private title?: string;
  private viewport?: { width: number; height: number };
  private scrollPosition?: { x: number; y: number };
  private userAgent?: string;

  constructor() {}

  /**
   * Navigate to URL (adds to history)
   */
  navigate(url: URLString, title?: string): void {
    // If not at end of history, truncate forward history
    if (this.historyIndex < this.navigationHistory.length - 1) {
      this.navigationHistory = this.navigationHistory.slice(0, this.historyIndex + 1);
    }

    // Add to history
    this.navigationHistory.push(url);
    this.historyIndex = this.navigationHistory.length - 1;

    // Update current state
    this.currentURL = url;
    this.title = title;

    // Reset scroll on navigation
    this.scrollPosition = { x: 0, y: 0 };
  }

  /**
   * Go back in history
   * Returns previous URL
   * @throws {Error} If at the beginning of history (cannot go back)
   */
  goBack(): URLString {
    if (!this.canGoBack()) {
      if (this.navigationHistory.length === 0) {
        throw new Error("Cannot go back: navigation history is empty");
      }
      throw new Error(
        `Cannot go back: already at the beginning of history (index ${this.historyIndex})`,
      );
    }

    this.historyIndex--;
    this.currentURL = this.navigationHistory[this.historyIndex];
    this.scrollPosition = { x: 0, y: 0 };
    return this.currentURL;
  }

  /**
   * Go forward in history
   * Returns next URL
   * @throws {Error} If at the end of history (cannot go forward)
   */
  goForward(): URLString {
    if (!this.canGoForward()) {
      if (this.navigationHistory.length === 0) {
        throw new Error("Cannot go forward: navigation history is empty");
      }
      throw new Error(
        `Cannot go forward: already at the end of history (index ${this.historyIndex} of ${this.navigationHistory.length - 1})`,
      );
    }

    this.historyIndex++;
    this.currentURL = this.navigationHistory[this.historyIndex];
    this.scrollPosition = { x: 0, y: 0 };
    return this.currentURL;
  }

  /**
   * Check if can go back
   */
  canGoBack(): boolean {
    return this.historyIndex > 0;
  }

  /**
   * Check if can go forward
   */
  canGoForward(): boolean {
    return this.historyIndex < this.navigationHistory.length - 1;
  }

  /**
   * Get current URL
   */
  getCurrentURL(): URLString | undefined {
    return this.currentURL;
  }

  /**
   * Get current page title
   */
  getTitle(): string | undefined {
    return this.title;
  }

  /**
   * Set page title
   */
  setTitle(title: string): void {
    this.title = title;
  }

  /**
   * Get navigation history
   */
  getNavigationHistory(): URLString[] {
    return [...this.navigationHistory];
  }

  /**
   * Get current history index
   */
  getHistoryIndex(): number {
    return this.historyIndex;
  }

  /**
   * Clear navigation history
   */
  clearHistory(): void {
    this.navigationHistory = [];
    this.historyIndex = -1;
    this.currentURL = undefined;
    this.title = undefined;
  }

  /**
   * Set viewport size
   */
  setViewport(width: number, height: number): void {
    this.viewport = { width, height };
  }

  /**
   * Get viewport size
   */
  getViewport(): { width: number; height: number } | undefined {
    return this.viewport ? { ...this.viewport } : undefined;
  }

  /**
   * Set scroll position
   */
  setScrollPosition(x: number, y: number): void {
    this.scrollPosition = { x, y };
  }

  /**
   * Get scroll position
   */
  getScrollPosition(): { x: number; y: number } | undefined {
    return this.scrollPosition ? { ...this.scrollPosition } : undefined;
  }

  /**
   * Set user agent
   */
  setUserAgent(userAgent: string): void {
    this.userAgent = userAgent;
  }

  /**
   * Get user agent
   */
  getUserAgent(): string | undefined {
    return this.userAgent;
  }

  /**
   * Create snapshot of current state
   */
  getSnapshot(): BrowserStateSnapshot {
    return {
      currentURL: this.currentURL,
      title: this.title,
      navigationHistory: [...this.navigationHistory],
      historyIndex: this.historyIndex,
      viewport: this.viewport ? { ...this.viewport } : undefined,
      scrollPosition: this.scrollPosition ? { ...this.scrollPosition } : undefined,
      userAgent: this.userAgent,
    };
  }

  /**
   * Restore state from snapshot
   */
  restoreSnapshot(snapshot: BrowserStateSnapshot): void {
    this.currentURL = snapshot.currentURL;
    this.title = snapshot.title;
    this.navigationHistory = [...snapshot.navigationHistory];
    this.historyIndex = snapshot.historyIndex;
    this.viewport = snapshot.viewport ? { ...snapshot.viewport } : undefined;
    this.scrollPosition = snapshot.scrollPosition ? { ...snapshot.scrollPosition } : undefined;
    this.userAgent = snapshot.userAgent;
  }

  /**
   * Reset all state
   */
  reset(): void {
    this.navigationHistory = [];
    this.historyIndex = -1;
    this.currentURL = undefined;
    this.title = undefined;
    this.viewport = undefined;
    this.scrollPosition = undefined;
    this.userAgent = undefined;
  }

  /**
   * Export state for debugging
   */
  toJSON(): object {
    return {
      currentURL: this.currentURL,
      title: this.title,
      historyLength: this.navigationHistory.length,
      historyIndex: this.historyIndex,
      canGoBack: this.canGoBack(),
      canGoForward: this.canGoForward(),
      viewport: this.viewport,
      scrollPosition: this.scrollPosition,
      userAgent: this.userAgent,
    };
  }
}

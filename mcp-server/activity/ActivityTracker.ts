/**
 * Activity Tracker - Persistent subsystem for logging all BrowserX usage
 *
 * Automatically captures and saves:
 * - Screenshots
 * - Page metadata
 * - Navigation history
 * - Timing data
 * - Errors
 */

import { ensureDir } from "https://deno.land/std@0.208.0/fs/ensure_dir.ts";

export interface ActivityEntry {
  id: string;
  timestamp: string;
  type: "navigate" | "screenshot" | "click" | "type" | "query" | "error";
  sessionId?: string;
  url?: string;
  data: Record<string, unknown>;
  timing?: {
    total: number;
    breakdown?: Record<string, number>;
  };
}

export interface ScreenshotEntry {
  id: string;
  timestamp: string;
  sessionId: string;
  url: string;
  width: number;
  height: number;
  filePath: string;
  size: number;
}

export class ActivityTracker {
  private baseDir: string;
  private enabled: boolean = true;
  private activities: ActivityEntry[] = [];
  private screenshots: ScreenshotEntry[] = [];
  private initialized: boolean = false;

  constructor(baseDir: string = ".browserx/usage_data") {
    this.baseDir = baseDir;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await ensureDir(this.baseDir);
    await ensureDir(`${this.baseDir}/screenshots`);
    await ensureDir(`${this.baseDir}/logs`);
    await ensureDir(`${this.baseDir}/metadata`);

    this.initialized = true;
    console.log(`[ActivityTracker] Initialized at ${this.baseDir}`);
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private getDatePath(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }

  /**
   * Track a navigation event
   */
  async trackNavigation(
    sessionId: string,
    url: string,
    timing: { total: number; breakdown?: Record<string, number> }
  ): Promise<void> {
    if (!this.enabled) return;
    await this.initialize();

    const entry: ActivityEntry = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      type: "navigate",
      sessionId,
      url,
      data: { url },
      timing,
    };

    this.activities.push(entry);
    await this.appendLog(entry);
  }

  /**
   * Save a screenshot and track it
   */
  async saveScreenshot(
    sessionId: string,
    url: string,
    imageData: string,
    width: number = 1920,
    height: number = 1080
  ): Promise<string> {
    if (!this.enabled) return "";
    await this.initialize();

    const id = this.generateId();
    const datePath = this.getDatePath();
    const fileName = `${id}.png`;
    const dirPath = `${this.baseDir}/screenshots/${datePath}`;
    const filePath = `${dirPath}/${fileName}`;

    await ensureDir(dirPath);

    // Decode base64 and save
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
    const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
    await Deno.writeFile(filePath, binaryData);

    const entry: ScreenshotEntry = {
      id,
      timestamp: new Date().toISOString(),
      sessionId,
      url,
      width,
      height,
      filePath,
      size: binaryData.length,
    };

    this.screenshots.push(entry);

    // Also track as activity
    await this.trackActivity("screenshot", sessionId, url, {
      filePath,
      width,
      height,
      size: binaryData.length,
    });

    console.log(`[ActivityTracker] Screenshot saved: ${filePath} (${binaryData.length} bytes)`);
    return filePath;
  }

  /**
   * Track a generic activity
   */
  async trackActivity(
    type: ActivityEntry["type"],
    sessionId: string | undefined,
    url: string | undefined,
    data: Record<string, unknown>,
    timing?: { total: number; breakdown?: Record<string, number> }
  ): Promise<void> {
    if (!this.enabled) return;
    await this.initialize();

    const entry: ActivityEntry = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      type,
      sessionId,
      url,
      data,
      timing,
    };

    this.activities.push(entry);
    await this.appendLog(entry);
  }

  /**
   * Track an error
   */
  async trackError(
    sessionId: string | undefined,
    url: string | undefined,
    error: string,
    context?: Record<string, unknown>
  ): Promise<void> {
    if (!this.enabled) return;
    await this.initialize();

    await this.trackActivity("error", sessionId, url, {
      error,
      ...context,
    });
  }

  /**
   * Track a query execution
   */
  async trackQuery(
    query: string,
    result: unknown,
    timing: { total: number }
  ): Promise<void> {
    if (!this.enabled) return;
    await this.initialize();

    await this.trackActivity("query", undefined, undefined, {
      query,
      resultType: typeof result,
      success: result !== null && result !== undefined,
    }, timing);
  }

  /**
   * Append entry to daily log file
   */
  private async appendLog(entry: ActivityEntry): Promise<void> {
    const datePath = this.getDatePath();
    const logPath = `${this.baseDir}/logs/${datePath}.jsonl`;

    const line = JSON.stringify(entry) + "\n";
    await Deno.writeTextFile(logPath, line, { append: true, create: true });
  }

  /**
   * Save session metadata
   */
  async saveSessionMetadata(
    sessionId: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    if (!this.enabled) return;
    await this.initialize();

    const filePath = `${this.baseDir}/metadata/${sessionId}.json`;
    await Deno.writeTextFile(filePath, JSON.stringify(metadata, null, 2));
  }

  /**
   * Get recent activities
   */
  getRecentActivities(limit: number = 100): ActivityEntry[] {
    return this.activities.slice(-limit);
  }

  /**
   * Get recent screenshots
   */
  getRecentScreenshots(limit: number = 20): ScreenshotEntry[] {
    return this.screenshots.slice(-limit);
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalActivities: number;
    totalScreenshots: number;
    activitiesByType: Record<string, number>;
  } {
    const activitiesByType: Record<string, number> = {};
    for (const entry of this.activities) {
      activitiesByType[entry.type] = (activitiesByType[entry.type] || 0) + 1;
    }

    return {
      totalActivities: this.activities.length,
      totalScreenshots: this.screenshots.length,
      activitiesByType,
    };
  }

  /**
   * Enable/disable tracking
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    console.log(`[ActivityTracker] ${enabled ? "Enabled" : "Disabled"}`);
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

// Singleton instance
let instance: ActivityTracker | null = null;

export function getActivityTracker(): ActivityTracker {
  if (!instance) {
    instance = new ActivityTracker();
  }
  return instance;
}

export function initActivityTracker(baseDir?: string): ActivityTracker {
  instance = new ActivityTracker(baseDir);
  return instance;
}

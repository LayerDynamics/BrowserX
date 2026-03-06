/**
 * WindowRenderer — Bridge between compositor pixel output and display targets.
 *
 * Supports two modes:
 *   1. **Native** — Sends pixels to a pixpane window via FFI (create_window → upload → render).
 *   2. **Offscreen** — Stores the latest pixel buffer in memory for programmatic access
 *      (screenshots, MCP tools, tests).
 *
 * After `RenderingOrchestrator.render()` completes the composite step the caller
 * invokes `present(pixels, width, height)` which routes to the active target.
 */

import { Window, type WindowConfig, type WindowEvent } from "../../os/window/mod.ts";
import { WindowContext, type WindowContextConfig } from "../../os/window/mod.ts";
import { BrowserConsole } from "../logging/BrowserConsole.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DisplayMode = "native" | "offscreen";

export interface WindowRendererConfig {
  /** Display mode — "native" opens a pixpane window, "offscreen" stores pixels in memory. */
  mode: DisplayMode;
  /** Window title (native mode). */
  title?: string;
  /** Viewport width in logical pixels. */
  width: number;
  /** Viewport height in logical pixels. */
  height: number;
  /** Enable vsync in native mode. */
  vsync?: boolean;
  /** Whether the native window is resizable. */
  resizable?: boolean;
}

export interface PresentFrameInfo {
  /** Frame sequence number. */
  frameNumber: number;
  /** Time spent presenting the frame (ms). */
  presentTime: number;
}

// ---------------------------------------------------------------------------
// WindowRenderer
// ---------------------------------------------------------------------------

export class WindowRenderer {
  private logger = new BrowserConsole("WindowRenderer");
  private config: WindowRendererConfig;
  private window: Window | null = null;
  private windowContext: WindowContext | null = null;
  private frameNumber = 0;
  private running = false;

  /** Offscreen pixel buffer — always kept up-to-date regardless of mode. */
  private offscreenBuffer: Uint8ClampedArray | null = null;
  private offscreenWidth = 0;
  private offscreenHeight = 0;

  /** Accumulated events from poll_event (native mode). */
  private pendingEvents: WindowEvent[] = [];

  constructor(config: WindowRendererConfig) {
    this.config = { ...config };
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  /**
   * Initialize the renderer. In native mode this opens the pixpane window.
   * In offscreen mode this is essentially a no-op (prepares the buffer).
   */
  async initialize(): Promise<void> {
    if (this.running) return;

    if (this.config.mode === "native") {
      const windowConfig: WindowConfig = {
        title: this.config.title ?? "BrowserX",
        width: this.config.width,
        height: this.config.height,
        resizable: this.config.resizable ?? true,
        visible: true,
      };

      this.window = new Window(windowConfig);
      await this.window.open();

      const contextConfig: WindowContextConfig = {
        vsync: this.config.vsync ?? true,
      };
      this.windowContext = new WindowContext(this.window, contextConfig);
      await this.windowContext.initialize();

      if (this.window.isHeadlessMode()) {
        this.logger.warn(
          "Pixpane FFI unavailable — falling back to offscreen mode",
        );
      }
    }

    this.running = true;
    this.logger.info(
      `Initialized in ${this.config.mode} mode (${this.config.width}x${this.config.height})`,
    );
  }

  /**
   * Present a frame. Stores pixels in the offscreen buffer *and* pushes to
   * the native window when in native mode.
   */
  present(pixels: Uint8ClampedArray, width: number, height: number): PresentFrameInfo {
    const start = performance.now();

    // Always store in offscreen buffer
    this.offscreenBuffer = pixels;
    this.offscreenWidth = width;
    this.offscreenHeight = height;

    // Push to native window if available
    if (this.windowContext && this.window && !this.window.isHeadlessMode()) {
      this.windowContext.present(pixels, width, height);
    }

    this.frameNumber++;
    const presentTime = performance.now() - start;

    return { frameNumber: this.frameNumber, presentTime };
  }

  /**
   * Poll pending window events (native mode only). Returns an empty array in
   * offscreen mode.
   */
  async pollEvents(): Promise<WindowEvent[]> {
    if (!this.window || this.window.isHeadlessMode()) {
      return [];
    }

    return this.window.pollEvents();
  }

  /**
   * Destroy the renderer and release all resources.
   */
  destroy(): void {
    if (this.windowContext) {
      this.windowContext.destroy();
      this.windowContext = null;
    }
    if (this.window) {
      this.window.close();
      this.window = null;
    }
    this.offscreenBuffer = null;
    this.running = false;
    this.logger.info("Destroyed");
  }

  // -----------------------------------------------------------------------
  // Accessors
  // -----------------------------------------------------------------------

  /** Get the latest pixel buffer (available in both modes). */
  getPixels(): Uint8ClampedArray | null {
    return this.offscreenBuffer;
  }

  /** Dimensions of the latest pixel buffer. */
  getPixelDimensions(): { width: number; height: number } {
    return { width: this.offscreenWidth, height: this.offscreenHeight };
  }

  /** Current display mode. */
  getMode(): DisplayMode {
    return this.config.mode;
  }

  /** Whether the renderer is initialized and running. */
  isRunning(): boolean {
    return this.running;
  }

  /** Current frame number. */
  getFrameNumber(): number {
    return this.frameNumber;
  }

  /** Resize the viewport. Updates the native window if applicable. */
  resize(width: number, height: number): void {
    this.config.width = width;
    this.config.height = height;
    if (this.window && !this.window.isHeadlessMode()) {
      this.window.resize(width, height);
    }
  }
}

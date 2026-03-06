/**
 * WindowContext - Rendering context for a Window
 *
 * Manages the GPU/rendering context associated with a Window instance.
 * Supports vsync and MSAA configuration.
 *
 * In native mode, present() uploads RGBA8 pixels to the pixpane window and renders.
 * In headless mode, present() is a no-op (pixels are stored in WindowRenderer's offscreen buffer).
 */

import { Window } from "./Window.ts";

export interface WindowContextConfig {
  vsync?: boolean;
  msaa?: number;
}

export class WindowContext {
  private window: Window;
  private config: WindowContextConfig;
  private _active: boolean = false;
  private frameCount = 0;

  constructor(window: Window, config?: WindowContextConfig) {
    this.window = window;
    this.config = { vsync: true, msaa: 1, ...config };
  }

  /**
   * Initialize the rendering context.
   * The window must be open before initializing.
   */
  async initialize(): Promise<void> {
    if (!this.window.isOpen()) {
      throw new Error("Cannot initialize context: window is not open");
    }

    if (this._active) {
      return;
    }

    this._active = true;
  }

  /**
   * Destroy the rendering context and release GPU resources.
   */
  destroy(): void {
    this._active = false;
  }

  /**
   * Whether the context is currently active.
   */
  isActive(): boolean {
    return this._active;
  }

  /**
   * Get the associated window.
   */
  getWindow(): Window {
    return this.window;
  }

  /**
   * Get the context configuration.
   */
  getConfig(): WindowContextConfig {
    return { ...this.config };
  }

  /**
   * Get the number of frames presented.
   */
  getFrameCount(): number {
    return this.frameCount;
  }

  /**
   * Present pixels to the window surface.
   *
   * Accepts an RGBA8 pixel buffer and uploads it to the native pixpane window
   * via `window_upload_pixels` + `window_render`. No-op in headless mode.
   *
   * @param pixels RGBA8 pixel data (width * height * 4 bytes)
   * @param width  Pixel buffer width
   * @param height Pixel buffer height
   */
  present(pixels?: Uint8ClampedArray, width?: number, height?: number): void {
    if (this.window.isHeadlessMode()) {
      this.frameCount++;
      return;
    }

    const pixpane = this.window.getPixpane();
    const windowId = this.window.getWindowId();

    if (!pixpane || windowId === 0n) {
      this.frameCount++;
      return;
    }

    // Upload pixels if provided
    if (pixels && width !== undefined && height !== undefined) {
      const u8 = new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength);
      const result = pixpane.window_upload_pixels(windowId, u8, width, height);
      if (result !== 0) {
        const err = pixpane.get_last_error();
        throw new Error(`window_upload_pixels failed: ${err}`);
      }
    }

    // Render frame
    const renderResult = pixpane.window_render(windowId);
    if (renderResult !== 0) {
      const err = pixpane.get_last_error();
      throw new Error(`window_render failed: ${err}`);
    }

    this.frameCount++;
  }
}

/**
 * WindowContext - Rendering context for a Window
 *
 * Manages the GPU/rendering context associated with a Window instance.
 * Supports vsync and MSAA configuration. No-ops in headless mode.
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
   * Present the current frame to the window surface.
   * No-op in headless mode.
   */
  present(): void {
    if (this.window.isHeadlessMode()) {
      return;
    }
    // In non-headless mode, pixpane FFI would swap buffers here
  }
}

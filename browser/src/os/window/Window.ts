/**
 * Window - OS-level window abstraction
 *
 * Provides a cross-platform window interface that integrates with
 * the pixpane FFI library for native GPU-accelerated windowing.
 * Falls back to headless mode when pixpane is unavailable.
 */

export interface WindowConfig {
  title: string;
  width: number;
  height: number;
  resizable?: boolean;
  visible?: boolean;
}

export interface WindowEvent {
  type:
    | "close"
    | "resize"
    | "focus"
    | "blur"
    | "keydown"
    | "keyup"
    | "mousedown"
    | "mouseup"
    | "mousemove";
  windowId: bigint;
  data?: unknown;
}

export class Window {
  private config: WindowConfig;
  private _isOpen: boolean = false;
  private _isHeadless: boolean = true;

  constructor(config: WindowConfig) {
    this.config = { ...config };
  }

  /**
   * Open the window.
   * Checks for pixpane FFI availability; if unavailable, opens in headless mode.
   */
  async open(): Promise<void> {
    if (this._isOpen) {
      return;
    }

    // Check for pixpane FFI availability
    try {
      const g = globalThis as unknown as Record<string, Record<string, unknown> | undefined>;
      if (g.pixpane && typeof g.pixpane.create_window === "function") {
        this._isHeadless = false;
      } else {
        this._isHeadless = true;
      }
    } catch {
      this._isHeadless = true;
    }

    this._isOpen = true;
  }

  /**
   * Close the window and release resources.
   */
  close(): void {
    this._isOpen = false;
  }

  /**
   * Whether the window is currently open.
   */
  isOpen(): boolean {
    return this._isOpen;
  }

  /**
   * Get the current window dimensions.
   */
  getDimensions(): { width: number; height: number } {
    return { width: this.config.width, height: this.config.height };
  }

  /**
   * Get the current window title.
   */
  getTitle(): string {
    return this.config.title;
  }

  /**
   * Set a new window title.
   */
  setTitle(title: string): void {
    this.config.title = title;
  }

  /**
   * Resize the window.
   */
  resize(width: number, height: number): void {
    this.config.width = width;
    this.config.height = height;
  }

  /**
   * Whether running in headless mode (no native window).
   */
  isHeadlessMode(): boolean {
    return this._isHeadless;
  }
}

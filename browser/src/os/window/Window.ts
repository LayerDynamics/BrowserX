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

/**
 * Pixpane FFI bindings interface.
 * Matches the exported functions from crates/pixpane/bindings/bindings.ts.
 */
interface PixpaneBindings {
  create_window: (config: { title: string; width: number; height: number; resizable?: boolean; visible?: boolean }) => bigint;
  window_close: (windowId: bigint) => number;
  window_set_title: (windowId: bigint, title: string) => number;
  window_set_size: (windowId: bigint, width: number, height: number) => number;
  window_upload_pixels: (windowId: bigint, pixels: Uint8Array, width: number, height: number) => number;
  window_render: (windowId: bigint) => number;
  poll_event: () => Promise<{ has_event: number; event?: { type: string; window_id?: number; data?: unknown } }>;
  pump_events: () => void;
  get_last_error: () => string;
}

/** Try to load pixpane bindings. Returns null if unavailable. */
async function loadPixpane(): Promise<PixpaneBindings | null> {
  try {
    // Dynamic import — the bindings file opens the dylib on load.
    // The path is relative to the browser package root.
    const mod = await import("../../../../../crates/pixpane/bindings/bindings.ts");
    if (typeof mod.create_window === "function") {
      return mod as unknown as PixpaneBindings;
    }
    return null;
  } catch {
    return null;
  }
}

export class Window {
  private config: WindowConfig;
  private _isOpen: boolean = false;
  private _isHeadless: boolean = true;
  private _windowId: bigint = 0n;
  private pixpane: PixpaneBindings | null = null;

  constructor(config: WindowConfig) {
    this.config = { ...config };
  }

  /**
   * Open the window.
   * Loads pixpane FFI and creates a native window; if unavailable, opens in headless mode.
   */
  async open(): Promise<void> {
    if (this._isOpen) {
      return;
    }

    // Attempt to load pixpane FFI
    this.pixpane = await loadPixpane();

    if (this.pixpane) {
      try {
        const windowId = this.pixpane.create_window({
          title: this.config.title,
          width: this.config.width,
          height: this.config.height,
          resizable: this.config.resizable ?? true,
          visible: this.config.visible ?? true,
        });

        if (windowId === 0n) {
          const err = this.pixpane.get_last_error();
          throw new Error(`pixpane create_window failed: ${err}`);
        }

        this._windowId = windowId;
        this._isHeadless = false;
      } catch {
        // FFI call failed — fall back to headless
        this._isHeadless = true;
        this.pixpane = null;
      }
    } else {
      this._isHeadless = true;
    }

    this._isOpen = true;
  }

  /**
   * Close the window and release resources.
   */
  close(): void {
    if (this.pixpane && this._windowId !== 0n) {
      this.pixpane.window_close(this._windowId);
      this._windowId = 0n;
    }
    this._isOpen = false;
    this.pixpane = null;
  }

  /**
   * Whether the window is currently open.
   */
  isOpen(): boolean {
    return this._isOpen;
  }

  /**
   * Get the native pixpane window ID. Returns 0n in headless mode.
   */
  getWindowId(): bigint {
    return this._windowId;
  }

  /**
   * Get the pixpane FFI bindings (null in headless mode).
   */
  getPixpane(): PixpaneBindings | null {
    return this.pixpane;
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
    if (this.pixpane && this._windowId !== 0n) {
      this.pixpane.window_set_title(this._windowId, title);
    }
  }

  /**
   * Resize the window.
   */
  resize(width: number, height: number): void {
    this.config.width = width;
    this.config.height = height;
    if (this.pixpane && this._windowId !== 0n) {
      this.pixpane.window_set_size(this._windowId, width, height);
    }
  }

  /**
   * Poll for pending window events. Returns empty array in headless mode.
   */
  async pollEvents(): Promise<WindowEvent[]> {
    if (!this.pixpane || this._isHeadless) {
      return [];
    }

    const events: WindowEvent[] = [];

    // Pump the event loop first
    this.pixpane.pump_events();

    // Drain all pending events
    while (true) {
      const result = await this.pixpane.poll_event();
      if (!result || result.has_event === 0) break;

      const raw = result.event;
      if (raw) {
        events.push({
          type: this.mapEventType(raw.type),
          windowId: BigInt(raw.window_id ?? 0),
          data: raw.data,
        });
      }
    }

    return events;
  }

  /**
   * Whether running in headless mode (no native window).
   */
  isHeadlessMode(): boolean {
    return this._isHeadless;
  }

  private mapEventType(raw: string): WindowEvent["type"] {
    const map: Record<string, WindowEvent["type"]> = {
      "CloseRequested": "close",
      "Resized": "resize",
      "Focused": "focus",
      "Unfocused": "blur",
      "KeyboardInput": "keydown",
      "CursorMoved": "mousemove",
      "MouseInput": "mousedown",
    };
    return map[raw] ?? "focus";
  }
}

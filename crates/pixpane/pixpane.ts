// Pixpane - High-level TypeScript wrapper for pixpane
//
// This provides an ergonomic API over the raw deno_bindgen functions.

import * as raw from "./bindings/bindings.ts";

export interface WindowOptions {
  title?: string;
  width?: number;
  height?: number;
  resizable?: boolean;
  decorations?: boolean;
  transparent?: boolean;
  always_on_top?: boolean;
  maximized?: boolean;
  visible?: boolean;
  min_width?: number | null;
  min_height?: number | null;
  max_width?: number | null;
  max_height?: null;
}

export type WindowEvent =
  | { type: "CloseRequested" }
  | { type: "Resized"; width: number; height: number }
  | { type: "Moved"; x: number; y: number }
  | { type: "Focused"; focused: boolean }
  | { type: "CursorEntered" }
  | { type: "CursorLeft" }
  | { type: "MouseMoved"; x: number; y: number }
  | { type: "MouseInput"; button: string; pressed: boolean }
  | { type: "MouseWheel"; delta_x: number; delta_y: number }
  | { type: "KeyboardInput"; key: string; pressed: boolean }
  | { type: "RedrawRequested" }
  | { type: "ScaleFactorChanged"; scale_factor: number }
  | { type: "Destroyed" };

export class PixpaneWindow {
  readonly id: bigint;
  private closed = false;

  constructor(options: WindowOptions = {}) {
    const opts = {
      title: options.title ?? "Pixpane Window",
      width: options.width ?? 800,
      height: options.height ?? 600,
      resizable: options.resizable ?? true,
      decorations: options.decorations ?? true,
      transparent: options.transparent ?? false,
      always_on_top: options.always_on_top ?? false,
      maximized: options.maximized ?? false,
      visible: options.visible ?? true,
      min_width: options.min_width ?? null,
      min_height: options.min_height ?? null,
      max_width: options.max_width ?? null,
      max_height: options.max_height ?? null,
    };

    this.id = raw.create_window(opts);
    if (this.id === 0n) {
      throw new Error(`Failed to create window: ${raw.get_last_error()}`);
    }
  }

  /**
   * Upload RGBA8 pixel data to the window's content texture
   */
  uploadPixels(pixels: Uint8Array, width: number, height: number): void {
    if (this.closed) throw new Error("Window is closed");
    const result = raw.window_upload_pixels(this.id, pixels, width, height);
    if (result !== 0) {
      throw new Error(`Failed to upload pixels: ${raw.get_last_error()}`);
    }
  }

  /**
   * Render the window (call after uploading pixels and building UI)
   */
  render(): void {
    if (this.closed) throw new Error("Window is closed");
    const result = raw.window_render(this.id);
    if (result !== 0) {
      throw new Error(`Failed to render: ${raw.get_last_error()}`);
    }
  }

  /**
   * Close the window
   */
  close(): void {
    if (!this.closed) {
      raw.window_close(this.id);
      this.closed = true;
    }
  }

  /**
   * Check if the window is closed
   */
  isClosed(): boolean {
    return this.closed;
  }
}

export class EguiBuilder {
  private windowId: bigint;
  private frameStarted = false;

  constructor(window: PixpaneWindow) {
    this.windowId = window.id;
  }

  /**
   * Begin an egui frame (call once at the start of your render loop)
   */
  begin(): void {
    const result = raw.egui_begin_frame(this.windowId);
    if (result !== 0) {
      throw new Error(`Failed to begin frame: ${raw.get_last_error()}`);
    }
    this.frameStarted = true;
  }

  /**
   * Add a label to the UI
   */
  label(text: string): this {
    if (!this.frameStarted) throw new Error("Must call begin() first");
    raw.egui_label(this.windowId, text);
    return this;
  }

  /**
   * Add a button to the UI
   * @returns true if the button was clicked
   */
  button(label: string): boolean {
    if (!this.frameStarted) throw new Error("Must call begin() first");
    return raw.egui_button(this.windowId, label) === 1;
  }

  /**
   * Add a text input to the UI
   * @returns the current text value (updated if user typed)
   */
  textInput(id: string, currentValue: string): string {
    if (!this.frameStarted) throw new Error("Must call begin() first");
    return raw.egui_text_input(this.windowId, id, currentValue);
  }

  /**
   * Begin a horizontal layout
   */
  horizontalBegin(): this {
    if (!this.frameStarted) throw new Error("Must call begin() first");
    raw.egui_horizontal_begin(this.windowId);
    return this;
  }

  /**
   * End a horizontal layout
   */
  horizontalEnd(): this {
    if (!this.frameStarted) throw new Error("Must call begin() first");
    raw.egui_horizontal_end(this.windowId);
    return this;
  }

  /**
   * Build a horizontal layout with a callback
   */
  horizontal(callback: () => void): this {
    this.horizontalBegin();
    callback();
    this.horizontalEnd();
    return this;
  }

  /**
   * Create a context menu area (responds to right-click)
   */
  contextMenuArea(id: string): this {
    if (!this.frameStarted) throw new Error("Must call begin() first");
    raw.egui_context_menu_area(this.windowId, id);
    return this;
  }

  /**
   * Begin defining a context menu
   */
  contextMenuBegin(menuId: string): this {
    if (!this.frameStarted) throw new Error("Must call begin() first");
    raw.egui_context_menu_begin(this.windowId, menuId);
    return this;
  }

  /**
   * Add a context menu item
   * @returns the item ID if this item was clicked, empty string otherwise
   */
  contextMenuItem(menuId: string, itemId: string, label: string): string {
    if (!this.frameStarted) throw new Error("Must call begin() first");
    return raw.egui_context_menu_item(this.windowId, menuId, itemId, label);
  }

  /**
   * End a context menu definition
   */
  contextMenuEnd(): this {
    if (!this.frameStarted) throw new Error("Must call begin() first");
    raw.egui_context_menu_end(this.windowId);
    return this;
  }

  /**
   * Build a context menu with a callback
   */
  contextMenu(id: string, menuId: string, callback: (builder: this) => void): this {
    this.contextMenuArea(id);
    this.contextMenuBegin(menuId);
    callback(this);
    this.contextMenuEnd();
    return this;
  }

  /**
   * End the egui frame and prepare for rendering
   */
  end(): void {
    if (!this.frameStarted) throw new Error("Must call begin() first");
    const result = raw.egui_end_frame(this.windowId);
    if (result !== 0) {
      throw new Error(`Failed to end frame: ${raw.get_last_error()}`);
    }
    this.frameStarted = false;
  }
}

/**
 * Pump the event loop to process pending events
 */
export function pumpEvents(): void {
  raw.pump_events();
}

/**
 * Poll for the next window event (non-blocking)
 */
export async function pollEvent(): Promise<{ windowId: bigint; event: WindowEvent } | null> {
  const result = await raw.poll_event();
  if (!result.has_event) {
    return null;
  }

  const evt = result.event.event;

  // Handle both string and object formats from deno_bindgen
  if (typeof evt === "string") {
    // Legacy string format
    if (evt === "CloseRequested") {
      return { windowId: result.event.window_id, event: { type: "CloseRequested" } };
    }
    return null;
  }

  // Object format
  return {
    windowId: result.event.window_id,
    event: evt as WindowEvent,
  };
}

/**
 * Get the last error message
 */
export function getLastError(): string {
  return raw.get_last_error();
}

/**
 * Get the current platform name
 */
export function platform(): string {
  return raw.platform();
}

/**
 * Get the count of currently open windows
 */
export function windowCount(): number {
  return raw.window_count();
}

// Auto-generated with deno_bindgen
function encode(v: string | Uint8Array): Uint8Array {
  if (typeof v !== "string") return v
  return new TextEncoder().encode(v)
}

function decode(v: Uint8Array): string {
  return new TextDecoder().decode(v)
}

// deno-lint-ignore no-explicit-any
function readPointer(v: any): Uint8Array {
  const ptr = new Deno.UnsafePointerView(v)
  const lengthBe = new Uint8Array(4)
  const view = new DataView(lengthBe.buffer)
  ptr.copyInto(lengthBe, 0)
  const buf = new Uint8Array(view.getUint32(0))
  ptr.copyInto(buf, 4)
  return buf
}

const url = new URL("../../target/release", import.meta.url)

let uri = url.pathname
if (!uri.endsWith("/")) uri += "/"

// https://docs.microsoft.com/en-us/windows/win32/api/libloaderapi/nf-libloaderapi-loadlibrarya#parameters
if (Deno.build.os === "windows") {
  uri = uri.replace(/\//g, "\\")
  // Remove leading slash
  if (uri.startsWith("\\")) {
    uri = uri.slice(1)
  }
}

const { symbols } = Deno.dlopen(
  {
    darwin: uri + "libpixpane.dylib",
    windows: uri + "pixpane.dll",
    linux: uri + "libpixpane.so",
    freebsd: uri + "libpixpane.so",
    netbsd: uri + "libpixpane.so",
    aix: uri + "libpixpane.so",
    solaris: uri + "libpixpane.so",
    illumos: uri + "libpixpane.so",
  }[Deno.build.os],
  {
    create_window: {
      parameters: ["buffer", "usize"],
      result: "u64",
      nonblocking: false,
    },
    egui_begin_frame: { parameters: ["u64"], result: "u8", nonblocking: false },
    egui_button: {
      parameters: ["u64", "buffer", "usize"],
      result: "u8",
      nonblocking: false,
    },
    egui_context_menu_area: {
      parameters: ["u64", "buffer", "usize"],
      result: "u8",
      nonblocking: false,
    },
    egui_context_menu_begin: {
      parameters: ["u64", "buffer", "usize"],
      result: "u8",
      nonblocking: false,
    },
    egui_context_menu_end: {
      parameters: ["u64"],
      result: "u8",
      nonblocking: false,
    },
    egui_context_menu_item: {
      parameters: [
        "u64",
        "buffer",
        "usize",
        "buffer",
        "usize",
        "buffer",
        "usize",
      ],
      result: "buffer",
      nonblocking: false,
    },
    egui_end_frame: { parameters: ["u64"], result: "u8", nonblocking: false },
    egui_horizontal_begin: {
      parameters: ["u64"],
      result: "u8",
      nonblocking: false,
    },
    egui_horizontal_end: {
      parameters: ["u64"],
      result: "u8",
      nonblocking: false,
    },
    egui_label: {
      parameters: ["u64", "buffer", "usize"],
      result: "u8",
      nonblocking: false,
    },
    egui_text_input: {
      parameters: ["u64", "buffer", "usize", "buffer", "usize"],
      result: "buffer",
      nonblocking: false,
    },
    get_last_error: { parameters: [], result: "buffer", nonblocking: false },
    platform: { parameters: [], result: "buffer", nonblocking: false },
    poll_event: { parameters: [], result: "buffer", nonblocking: true },
    pump_events: { parameters: [], result: "void", nonblocking: false },
    window_close: { parameters: ["u64"], result: "u8", nonblocking: false },
    window_count: { parameters: [], result: "usize", nonblocking: false },
    window_exists: { parameters: ["u64"], result: "u8", nonblocking: false },
    window_focus: { parameters: ["u64"], result: "u8", nonblocking: false },
    window_inner_position: {
      parameters: ["u64"],
      result: "buffer",
      nonblocking: false,
    },
    window_inner_size: {
      parameters: ["u64"],
      result: "buffer",
      nonblocking: false,
    },
    window_is_decorated: {
      parameters: ["u64"],
      result: "u8",
      nonblocking: false,
    },
    window_is_maximized: {
      parameters: ["u64"],
      result: "u8",
      nonblocking: false,
    },
    window_is_minimized: {
      parameters: ["u64"],
      result: "u8",
      nonblocking: false,
    },
    window_is_resizable: {
      parameters: ["u64"],
      result: "u8",
      nonblocking: false,
    },
    window_is_visible: {
      parameters: ["u64"],
      result: "u8",
      nonblocking: false,
    },
    window_outer_position: {
      parameters: ["u64"],
      result: "buffer",
      nonblocking: false,
    },
    window_outer_size: {
      parameters: ["u64"],
      result: "buffer",
      nonblocking: false,
    },
    window_render: { parameters: ["u64"], result: "u8", nonblocking: false },
    window_request_redraw: {
      parameters: ["u64"],
      result: "u8",
      nonblocking: false,
    },
    window_scale_factor: {
      parameters: ["u64"],
      result: "f64",
      nonblocking: false,
    },
    window_set_always_on_top: {
      parameters: ["u64", "u8"],
      result: "u8",
      nonblocking: false,
    },
    window_set_cursor_grab: {
      parameters: ["u64", "u8"],
      result: "u8",
      nonblocking: false,
    },
    window_set_cursor_position: {
      parameters: ["u64", "f64", "f64"],
      result: "u8",
      nonblocking: false,
    },
    window_set_cursor_visible: {
      parameters: ["u64", "u8"],
      result: "u8",
      nonblocking: false,
    },
    window_set_decorations: {
      parameters: ["u64", "u8"],
      result: "u8",
      nonblocking: false,
    },
    window_set_fullscreen: {
      parameters: ["u64", "u8"],
      result: "u8",
      nonblocking: false,
    },
    window_set_max_size: {
      parameters: ["u64", "u32", "u32"],
      result: "u8",
      nonblocking: false,
    },
    window_set_maximized: {
      parameters: ["u64", "u8"],
      result: "u8",
      nonblocking: false,
    },
    window_set_min_size: {
      parameters: ["u64", "u32", "u32"],
      result: "u8",
      nonblocking: false,
    },
    window_set_minimized: {
      parameters: ["u64", "u8"],
      result: "u8",
      nonblocking: false,
    },
    window_set_position: {
      parameters: ["u64", "i32", "i32"],
      result: "u8",
      nonblocking: false,
    },
    window_set_resizable: {
      parameters: ["u64", "u8"],
      result: "u8",
      nonblocking: false,
    },
    window_set_size: {
      parameters: ["u64", "u32", "u32"],
      result: "u8",
      nonblocking: false,
    },
    window_set_title: {
      parameters: ["u64", "buffer", "usize"],
      result: "u8",
      nonblocking: false,
    },
    window_set_visible: {
      parameters: ["u64", "u8"],
      result: "u8",
      nonblocking: false,
    },
    window_upload_pixels: {
      parameters: ["u64", "buffer", "usize", "u32", "u32"],
      result: "u8",
      nonblocking: false,
    },
  },
)
/**
 * Event container with window ID
 *
 * This wraps a WindowEvent with the window ID that generated it,
 * allowing the Deno side to know which window the event came from.
 */
export type Event = {
  /**
   * The ID of the window that generated this event
   */
  window_id: number
  /**
   * The event itself
   */
  event: WindowEvent
}
/**
 * Event result with success flag
 */
export type EventResult = {
  /**
   * 0 = no event available, 1 = event available
   */
  has_event: number
  /**
   * The event (only valid if has_event == 1)
   */
  event: Event
}
/**
 * Window configuration (deno_bindgen compatible)
 *
 * This struct is fully serializable and can be passed across the
 * FFI boundary from Deno/TypeScript to Rust.
 */
export type WindowConfig = {
  /**
   * Window title
   */
  title: string
  /**
   * Window width in logical pixels
   */
  width: number
  /**
   * Window height in logical pixels
   */
  height: number
  /**
   * Whether the window is resizable
   */
  resizable: boolean
  /**
   * Whether the window has decorations (title bar, borders)
   */
  decorations: boolean
  /**
   * Whether the window is transparent
   */
  transparent: boolean
  /**
   * Whether the window stays on top of others
   */
  always_on_top: boolean
  /**
   * Whether the window starts maximized
   */
  maximized: boolean
  /**
   * Whether the window is visible on creation
   */
  visible: boolean
  /**
   * Minimum window width (optional)
   */
  min_width: number | undefined | null
  /**
   * Minimum window height (optional)
   */
  min_height: number | undefined | null
  /**
   * Maximum window width (optional)
   */
  max_width: number | undefined | null
  /**
   * Maximum window height (optional)
   */
  max_height: number | undefined | null
}
/**
 * Window events that can be sent across the FFI boundary
 *
 * All variants are fully serializable and designed to be
 * easily consumed from Deno/TypeScript.
 */
export type WindowEvent = /**
   * Window was resized
   */
  | { type: "Resized"; data: { width: number; height: number } }
  | /**
   * Window was moved
   */
  { type: "Moved"; data: { x: number; y: number } }
  | /**
   * Window close was requested (e.g., user clicked X button)
   */
  "CloseRequested"
  | /**
   * Window was destroyed
   */
  "Destroyed"
  | /**
   * Window focus changed
   */
  { type: "Focused"; data: { focused: boolean } }
  | /**
   * Keyboard input event
   */
  { type: "KeyboardInput"; data: { key: string; pressed: boolean } }
  | /**
   * Mouse button event
   */
  { type: "MouseInput"; data: { button: string; pressed: boolean } }
  | /**
   * Mouse cursor moved
   */
  { type: "MouseMoved"; data: { x: number; y: number } }
  | /**
   * Mouse wheel scrolled
   */
  { type: "MouseWheel"; data: { delta_x: number; delta_y: number } }
  | /**
   * Cursor entered window
   */
  "CursorEntered"
  | /**
   * Cursor left window
   */
  "CursorLeft"
  | /**
   * Window needs to be redrawn
   */
  "RedrawRequested"
  | /**
   * DPI scale factor changed
   */
  { type: "ScaleFactorChanged"; data: { scale_factor: number } }
  | /**
   * Theme changed (light/dark mode)
   */
  { type: "ThemeChanged"; data: { theme: string } }
/**
 * Window position information with success flag
 */
export type WindowPosition = {
  /**
   * 0 = failure, 1 = success
   */
  success: number
  x: number
  y: number
}
/**
 * Window size information with success flag
 */
export type WindowSize = {
  /**
   * 0 = failure, 1 = success
   */
  success: number
  width: number
  height: number
}
export function create_window(a0: WindowConfig) {
  const a0_buf = encode(JSON.stringify(a0))

  const rawResult = symbols.create_window(a0_buf, a0_buf.byteLength)
  const result = rawResult
  return result
}
export function egui_begin_frame(a0: bigint) {
  const rawResult = symbols.egui_begin_frame(a0)
  const result = rawResult
  return result
}
export function egui_button(a0: bigint, a1: string) {
  const a1_buf = encode(a1)

  const rawResult = symbols.egui_button(a0, a1_buf, a1_buf.byteLength)
  const result = rawResult
  return result
}
export function egui_context_menu_area(a0: bigint, a1: string) {
  const a1_buf = encode(a1)

  const rawResult = symbols.egui_context_menu_area(
    a0,
    a1_buf,
    a1_buf.byteLength,
  )
  const result = rawResult
  return result
}
export function egui_context_menu_begin(a0: bigint, a1: string) {
  const a1_buf = encode(a1)

  const rawResult = symbols.egui_context_menu_begin(
    a0,
    a1_buf,
    a1_buf.byteLength,
  )
  const result = rawResult
  return result
}
export function egui_context_menu_end(a0: bigint) {
  const rawResult = symbols.egui_context_menu_end(a0)
  const result = rawResult
  return result
}
export function egui_context_menu_item(
  a0: bigint,
  a1: string,
  a2: string,
  a3: string,
) {
  const a1_buf = encode(a1)
  const a2_buf = encode(a2)
  const a3_buf = encode(a3)

  const rawResult = symbols.egui_context_menu_item(
    a0,
    a1_buf,
    a1_buf.byteLength,
    a2_buf,
    a2_buf.byteLength,
    a3_buf,
    a3_buf.byteLength,
  )
  const result = readPointer(rawResult)
  return decode(result)
}
export function egui_end_frame(a0: bigint) {
  const rawResult = symbols.egui_end_frame(a0)
  const result = rawResult
  return result
}
export function egui_horizontal_begin(a0: bigint) {
  const rawResult = symbols.egui_horizontal_begin(a0)
  const result = rawResult
  return result
}
export function egui_horizontal_end(a0: bigint) {
  const rawResult = symbols.egui_horizontal_end(a0)
  const result = rawResult
  return result
}
export function egui_label(a0: bigint, a1: string) {
  const a1_buf = encode(a1)

  const rawResult = symbols.egui_label(a0, a1_buf, a1_buf.byteLength)
  const result = rawResult
  return result
}
export function egui_text_input(a0: bigint, a1: string, a2: string) {
  const a1_buf = encode(a1)
  const a2_buf = encode(a2)

  const rawResult = symbols.egui_text_input(
    a0,
    a1_buf,
    a1_buf.byteLength,
    a2_buf,
    a2_buf.byteLength,
  )
  const result = readPointer(rawResult)
  return decode(result)
}
export function get_last_error() {
  const rawResult = symbols.get_last_error()
  const result = readPointer(rawResult)
  return decode(result)
}
export function platform() {
  const rawResult = symbols.platform()
  const result = readPointer(rawResult)
  return decode(result)
}
export function poll_event() {
  const rawResult = symbols.poll_event()
  const result = rawResult.then(readPointer)
  return result.then(r => JSON.parse(decode(r))) as Promise<EventResult>
}
export function pump_events() {
  const rawResult = symbols.pump_events()
  const result = rawResult
  return result
}
export function window_close(a0: bigint) {
  const rawResult = symbols.window_close(a0)
  const result = rawResult
  return result
}
export function window_count() {
  const rawResult = symbols.window_count()
  const result = rawResult
  return result
}
export function window_exists(a0: bigint) {
  const rawResult = symbols.window_exists(a0)
  const result = rawResult
  return result
}
export function window_focus(a0: bigint) {
  const rawResult = symbols.window_focus(a0)
  const result = rawResult
  return result
}
export function window_inner_position(a0: bigint) {
  const rawResult = symbols.window_inner_position(a0)
  const result = readPointer(rawResult)
  return JSON.parse(decode(result)) as WindowPosition
}
export function window_inner_size(a0: bigint) {
  const rawResult = symbols.window_inner_size(a0)
  const result = readPointer(rawResult)
  return JSON.parse(decode(result)) as WindowSize
}
export function window_is_decorated(a0: bigint) {
  const rawResult = symbols.window_is_decorated(a0)
  const result = rawResult
  return result
}
export function window_is_maximized(a0: bigint) {
  const rawResult = symbols.window_is_maximized(a0)
  const result = rawResult
  return result
}
export function window_is_minimized(a0: bigint) {
  const rawResult = symbols.window_is_minimized(a0)
  const result = rawResult
  return result
}
export function window_is_resizable(a0: bigint) {
  const rawResult = symbols.window_is_resizable(a0)
  const result = rawResult
  return result
}
export function window_is_visible(a0: bigint) {
  const rawResult = symbols.window_is_visible(a0)
  const result = rawResult
  return result
}
export function window_outer_position(a0: bigint) {
  const rawResult = symbols.window_outer_position(a0)
  const result = readPointer(rawResult)
  return JSON.parse(decode(result)) as WindowPosition
}
export function window_outer_size(a0: bigint) {
  const rawResult = symbols.window_outer_size(a0)
  const result = readPointer(rawResult)
  return JSON.parse(decode(result)) as WindowSize
}
export function window_render(a0: bigint) {
  const rawResult = symbols.window_render(a0)
  const result = rawResult
  return result
}
export function window_request_redraw(a0: bigint) {
  const rawResult = symbols.window_request_redraw(a0)
  const result = rawResult
  return result
}
export function window_scale_factor(a0: bigint) {
  const rawResult = symbols.window_scale_factor(a0)
  const result = rawResult
  return result
}
export function window_set_always_on_top(a0: bigint, a1: number) {
  const rawResult = symbols.window_set_always_on_top(a0, a1)
  const result = rawResult
  return result
}
export function window_set_cursor_grab(a0: bigint, a1: number) {
  const rawResult = symbols.window_set_cursor_grab(a0, a1)
  const result = rawResult
  return result
}
export function window_set_cursor_position(a0: bigint, a1: number, a2: number) {
  const rawResult = symbols.window_set_cursor_position(a0, a1, a2)
  const result = rawResult
  return result
}
export function window_set_cursor_visible(a0: bigint, a1: number) {
  const rawResult = symbols.window_set_cursor_visible(a0, a1)
  const result = rawResult
  return result
}
export function window_set_decorations(a0: bigint, a1: number) {
  const rawResult = symbols.window_set_decorations(a0, a1)
  const result = rawResult
  return result
}
export function window_set_fullscreen(a0: bigint, a1: number) {
  const rawResult = symbols.window_set_fullscreen(a0, a1)
  const result = rawResult
  return result
}
export function window_set_max_size(a0: bigint, a1: number, a2: number) {
  const rawResult = symbols.window_set_max_size(a0, a1, a2)
  const result = rawResult
  return result
}
export function window_set_maximized(a0: bigint, a1: number) {
  const rawResult = symbols.window_set_maximized(a0, a1)
  const result = rawResult
  return result
}
export function window_set_min_size(a0: bigint, a1: number, a2: number) {
  const rawResult = symbols.window_set_min_size(a0, a1, a2)
  const result = rawResult
  return result
}
export function window_set_minimized(a0: bigint, a1: number) {
  const rawResult = symbols.window_set_minimized(a0, a1)
  const result = rawResult
  return result
}
export function window_set_position(a0: bigint, a1: number, a2: number) {
  const rawResult = symbols.window_set_position(a0, a1, a2)
  const result = rawResult
  return result
}
export function window_set_resizable(a0: bigint, a1: number) {
  const rawResult = symbols.window_set_resizable(a0, a1)
  const result = rawResult
  return result
}
export function window_set_size(a0: bigint, a1: number, a2: number) {
  const rawResult = symbols.window_set_size(a0, a1, a2)
  const result = rawResult
  return result
}
export function window_set_title(a0: bigint, a1: string) {
  const a1_buf = encode(a1)

  const rawResult = symbols.window_set_title(a0, a1_buf, a1_buf.byteLength)
  const result = rawResult
  return result
}
export function window_set_visible(a0: bigint, a1: number) {
  const rawResult = symbols.window_set_visible(a0, a1)
  const result = rawResult
  return result
}
export function window_upload_pixels(
  a0: bigint,
  a1: Uint8Array,
  a2: number,
  a3: number,
) {
  const a1_buf = encode(a1)

  const rawResult = symbols.window_upload_pixels(
    a0,
    a1_buf,
    a1_buf.byteLength,
    a2,
    a3,
  )
  const result = rawResult
  return result
}

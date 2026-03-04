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
    darwin: uri + "libserialx.dylib",
    windows: uri + "serialx.dll",
    linux: uri + "libserialx.so",
    freebsd: uri + "libserialx.so",
    netbsd: uri + "libserialx.so",
    aix: uri + "libserialx.so",
    solaris: uri + "libserialx.so",
    illumos: uri + "libserialx.so",
  }[Deno.build.os],
  {
    serialx_bytes_available: {
      parameters: ["u64"],
      result: "i32",
      nonblocking: false,
    },
    serialx_clear_trace_log: {
      parameters: [],
      result: "void",
      nonblocking: false,
    },
    serialx_close: { parameters: ["u64"], result: "u8", nonblocking: false },
    serialx_configure: {
      parameters: ["u64", "buffer", "usize"],
      result: "u8",
      nonblocking: false,
    },
    serialx_escpos_command: {
      parameters: ["u64", "buffer", "usize"],
      result: "u8",
      nonblocking: false,
    },
    serialx_flush: { parameters: ["u64"], result: "u8", nonblocking: false },
    serialx_get_last_error: {
      parameters: [],
      result: "buffer",
      nonblocking: false,
    },
    serialx_get_trace_log: {
      parameters: [],
      result: "buffer",
      nonblocking: false,
    },
    serialx_init: { parameters: [], result: "u8", nonblocking: false },
    serialx_list_ports: {
      parameters: [],
      result: "buffer",
      nonblocking: false,
    },
    serialx_list_printers: {
      parameters: [],
      result: "buffer",
      nonblocking: false,
    },
    serialx_open: {
      parameters: ["buffer", "usize", "u32"],
      result: "u64",
      nonblocking: false,
    },
    serialx_read: {
      parameters: ["u64", "u32", "u32"],
      result: "buffer",
      nonblocking: false,
    },
    serialx_version: { parameters: [], result: "buffer", nonblocking: false },
    serialx_write: {
      parameters: ["u64", "buffer", "usize"],
      result: "i32",
      nonblocking: false,
    },
  },
)

export function serialx_bytes_available(a0: bigint) {
  const rawResult = symbols.serialx_bytes_available(a0)
  const result = rawResult
  return result
}
export function serialx_clear_trace_log() {
  const rawResult = symbols.serialx_clear_trace_log()
  const result = rawResult
  return result
}
export function serialx_close(a0: bigint) {
  const rawResult = symbols.serialx_close(a0)
  const result = rawResult
  return result
}
export function serialx_configure(a0: bigint, a1: string) {
  const a1_buf = encode(a1)

  const rawResult = symbols.serialx_configure(a0, a1_buf, a1_buf.byteLength)
  const result = rawResult
  return result
}
export function serialx_escpos_command(a0: bigint, a1: string) {
  const a1_buf = encode(a1)

  const rawResult = symbols.serialx_escpos_command(
    a0,
    a1_buf,
    a1_buf.byteLength,
  )
  const result = rawResult
  return result
}
export function serialx_flush(a0: bigint) {
  const rawResult = symbols.serialx_flush(a0)
  const result = rawResult
  return result
}
export function serialx_get_last_error() {
  const rawResult = symbols.serialx_get_last_error()
  const result = readPointer(rawResult)
  return decode(result)
}
export function serialx_get_trace_log() {
  const rawResult = symbols.serialx_get_trace_log()
  const result = readPointer(rawResult)
  return decode(result)
}
export function serialx_init() {
  const rawResult = symbols.serialx_init()
  const result = rawResult
  return result
}
export function serialx_list_ports() {
  const rawResult = symbols.serialx_list_ports()
  const result = readPointer(rawResult)
  return decode(result)
}
export function serialx_list_printers() {
  const rawResult = symbols.serialx_list_printers()
  const result = readPointer(rawResult)
  return decode(result)
}
export function serialx_open(a0: string, a1: number) {
  const a0_buf = encode(a0)

  const rawResult = symbols.serialx_open(a0_buf, a0_buf.byteLength, a1)
  const result = rawResult
  return result
}
export function serialx_read(a0: bigint, a1: number, a2: number) {
  const rawResult = symbols.serialx_read(a0, a1, a2)
  const result = readPointer(rawResult)
  return decode(result)
}
export function serialx_version() {
  const rawResult = symbols.serialx_version()
  const result = readPointer(rawResult)
  return decode(result)
}
export function serialx_write(a0: bigint, a1: string) {
  const a1_buf = encode(a1)

  const rawResult = symbols.serialx_write(a0, a1_buf, a1_buf.byteLength)
  const result = rawResult
  return result
}

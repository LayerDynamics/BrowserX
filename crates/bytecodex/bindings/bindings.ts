// Auto-generated with deno_bindgen
// @ts-nocheck - generated FFI bindings have known type issues
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

// ── Lazy FFI loader ─────────────────────────────────────────────────────────
let _lib: Deno.DynamicLibrary<Record<string, Deno.ForeignFunction>> | null = null;

function _loadLib() {
  if (_lib !== null) return _lib;
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
  _lib = Deno.dlopen(
    {
      darwin: uri + "libbytecodex.dylib",
      windows: uri + "bytecodex.dll",
      linux: uri + "libbytecodex.so",
      freebsd: uri + "libbytecodex.so",
      netbsd: uri + "libbytecodex.so",
      aix: uri + "libbytecodex.so",
      solaris: uri + "libbytecodex.so",
      illumos: uri + "libbytecodex.so",
    }[Deno.build.os],
    {
      bytecodex_disassemble: {
        parameters: ["buffer", "usize"],
        result: "buffer",
        nonblocking: false,
      },
      bytecodex_get_last_error: {
        parameters: [],
        result: "buffer",
        nonblocking: false,
      },
      bytecodex_init: { parameters: [], result: "u8", nonblocking: false },
      bytecodex_optimize: {
        parameters: ["buffer", "usize"],
        result: "buffer",
        nonblocking: false,
      },
      bytecodex_validate: {
        parameters: ["buffer", "usize"],
        result: "buffer",
        nonblocking: false,
      },
      bytecodex_version: { parameters: [], result: "buffer", nonblocking: false },
    },
  );
  return _lib;
}

// Proxy that triggers lazy load on first property access
const symbols = new Proxy({} as ReturnType<typeof _loadLib>["symbols"], {
  get(_target, prop: string | symbol) {
    return Reflect.get(_loadLib().symbols, prop);
  },
});
export function bytecodex_disassemble(a0: string) {
  const a0_buf = encode(a0)

  const rawResult = symbols.bytecodex_disassemble(a0_buf, a0_buf.byteLength)
  const result = readPointer(rawResult)
  return decode(result)
}
export function bytecodex_get_last_error() {
  const rawResult = symbols.bytecodex_get_last_error()
  const result = readPointer(rawResult)
  return decode(result)
}
export function bytecodex_init() {
  const rawResult = symbols.bytecodex_init()
  const result = rawResult
  return result
}
export function bytecodex_optimize(a0: string) {
  const a0_buf = encode(a0)

  const rawResult = symbols.bytecodex_optimize(a0_buf, a0_buf.byteLength)
  const result = readPointer(rawResult)
  return decode(result)
}
export function bytecodex_validate(a0: string) {
  const a0_buf = encode(a0)

  const rawResult = symbols.bytecodex_validate(a0_buf, a0_buf.byteLength)
  const result = readPointer(rawResult)
  return decode(result)
}
export function bytecodex_version() {
  const rawResult = symbols.bytecodex_version()
  const result = readPointer(rawResult)
  return decode(result)
}

/**
 * Pre-load the FFI library.
 */
export function preloadLib(): void {
  _loadLib();
}

/**
 * Close the FFI library and release native resources.
 */
export function closeLib(): void {
  if (_lib !== null) {
    _lib.close();
    _lib = null;
  }
}

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
  const url = new URL("../../../target/release", import.meta.url)

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

  const libPaths: Record<string, string> = {
      darwin: uri + "libtransportx.dylib",
      windows: uri + "transportx.dll",
      linux: uri + "libtransportx.so",
      freebsd: uri + "libtransportx.so",
      netbsd: uri + "libtransportx.so",
      aix: uri + "libtransportx.so",
      solaris: uri + "libtransportx.so",
      illumos: uri + "libtransportx.so",
      android: uri + "libtransportx.so",
  };
  _lib = Deno.dlopen(
    libPaths[Deno.build.os] ?? libPaths.linux,
    {
      close_lib: { parameters: [], result: "u8", nonblocking: false },
      http3_connection_create: {
        parameters: ["u64", "buffer", "usize"],
        result: "u8",
        nonblocking: false,
      },
      http3_get_settings: {
        parameters: ["u64"],
        result: "buffer",
        nonblocking: false,
      },
      http3_poll: { parameters: ["u64"], result: "buffer", nonblocking: false },
      http3_send_body: {
        parameters: ["u64", "u64", "buffer", "usize", "u8"],
        result: "u8",
        nonblocking: false,
      },
      http3_send_request: {
        parameters: ["u64", "buffer", "usize", "buffer", "usize", "u8"],
        result: "i64",
        nonblocking: false,
      },
      http3_send_response: {
        parameters: ["u64", "u64", "buffer", "usize", "u8"],
        result: "u8",
        nonblocking: false,
      },
      preload_lib: { parameters: [], result: "u8", nonblocking: false },
      quic_connection_close: {
        parameters: ["u64", "u64", "buffer", "usize"],
        result: "u8",
        nonblocking: false,
      },
      quic_connection_connect: {
        parameters: ["u64", "buffer", "usize", "u16"],
        result: "u8",
        nonblocking: false,
      },
      quic_connection_create: {
        parameters: ["buffer", "usize"],
        result: "u64",
        nonblocking: false,
      },
      quic_connection_get_state: {
        parameters: ["u64"],
        result: "u32",
        nonblocking: false,
      },
      quic_connection_get_stats: {
        parameters: ["u64"],
        result: "buffer",
        nonblocking: false,
      },
      quic_connection_is_closed: {
        parameters: ["u64"],
        result: "u8",
        nonblocking: false,
      },
      quic_connection_is_established: {
        parameters: ["u64"],
        result: "u8",
        nonblocking: false,
      },
      quic_connection_poll: {
        parameters: ["u64"],
        result: "buffer",
        nonblocking: false,
      },
      quic_is_available: { parameters: [], result: "u8", nonblocking: false },
      quic_stream_capacity: {
        parameters: ["u64", "u64"],
        result: "i64",
        nonblocking: false,
      },
      quic_stream_finished: {
        parameters: ["u64", "u64"],
        result: "u8",
        nonblocking: false,
      },
      quic_stream_recv: {
        parameters: ["u64", "u64"],
        result: "buffer",
        nonblocking: false,
      },
      quic_stream_send: {
        parameters: ["u64", "u64", "buffer", "usize", "u8"],
        result: "i32",
        nonblocking: false,
      },
      quic_stream_shutdown: {
        parameters: ["u64", "u64", "u8", "u64"],
        result: "u8",
        nonblocking: false,
      },
      transportx_get_last_error: {
        parameters: [],
        result: "buffer",
        nonblocking: false,
      },
      transportx_init: { parameters: [], result: "u8", nonblocking: false },
      transportx_version: {
        parameters: [],
        result: "buffer",
        nonblocking: false,
      },
      udp_socket_close: {
        parameters: ["u64"],
        result: "void",
        nonblocking: false,
      },
      udp_socket_create: {
        parameters: ["buffer", "usize"],
        result: "u64",
        nonblocking: false,
      },
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
/**
 * TransportX error types
 */
export type TransportXError = /**
   * UDP socket operation failed
   */
  | {
    SocketError: {
      message: string
    }
  }
  | /**
   * QUIC connection error
   */
  {
    ConnectionError: {
      message: string
      connection_id: number | undefined | null
    }
  }
  | /**
   * QUIC stream error
   */
  {
    StreamError: {
      message: string
      stream_id: number | undefined | null
    }
  }
  | /**
   * HTTP/3 layer error
   */
  {
    Http3Error: {
      message: string
    }
  }
  | /**
   * Configuration error
   */
  {
    ConfigError: {
      field: string
      message: string
    }
  }
  | /**
   * FFI serialization error
   */
  {
    SerializationError: {
      message: string
    }
  }
  | /**
   * Handle not found in registry
   */
  {
    HandleNotFound: {
      handle: number
      resource_type: string
    }
  }
  | /**
   * Connection state error (wrong state for operation)
   */
  {
    StateError: {
      expected: string
      actual: string
    }
  }
  | /**
   * TLS/crypto error
   */
  {
    TlsError: {
      message: string
    }
  }
  | /**
   * Timeout error
   */
  {
    TimeoutError: {
      message: string
    }
  }
export function close_lib() {
  const rawResult = symbols.close_lib()
  const result = rawResult
  return result
}
export function http3_connection_create(a0: bigint, a1: string) {
  const a1_buf = encode(a1)

  const rawResult = symbols.http3_connection_create(
    a0,
    a1_buf,
    a1_buf.byteLength,
  )
  const result = rawResult
  return result
}
export function http3_get_settings(a0: bigint) {
  const rawResult = symbols.http3_get_settings(a0)
  const result = readPointer(rawResult)
  return decode(result)
}
export function http3_poll(a0: bigint) {
  const rawResult = symbols.http3_poll(a0)
  const result = readPointer(rawResult)
  return decode(result)
}
export function http3_send_body(
  a0: bigint,
  a1: bigint,
  a2: string,
  a3: number,
) {
  const a2_buf = encode(a2)

  const rawResult = symbols.http3_send_body(
    a0,
    a1,
    a2_buf,
    a2_buf.byteLength,
    a3,
  )
  const result = rawResult
  return result
}
export function http3_send_request(
  a0: bigint,
  a1: string,
  a2: string,
  a3: number,
) {
  const a1_buf = encode(a1)
  const a2_buf = encode(a2)

  const rawResult = symbols.http3_send_request(
    a0,
    a1_buf,
    a1_buf.byteLength,
    a2_buf,
    a2_buf.byteLength,
    a3,
  )
  const result = rawResult
  return result
}
export function http3_send_response(
  a0: bigint,
  a1: bigint,
  a2: string,
  a3: number,
) {
  const a2_buf = encode(a2)

  const rawResult = symbols.http3_send_response(
    a0,
    a1,
    a2_buf,
    a2_buf.byteLength,
    a3,
  )
  const result = rawResult
  return result
}
export function preload_lib() {
  const rawResult = symbols.preload_lib()
  const result = rawResult
  return result
}
export function quic_connection_close(a0: bigint, a1: bigint, a2: string) {
  const a2_buf = encode(a2)

  const rawResult = symbols.quic_connection_close(
    a0,
    a1,
    a2_buf,
    a2_buf.byteLength,
  )
  const result = rawResult
  return result
}
export function quic_connection_connect(a0: bigint, a1: string, a2: number) {
  const a1_buf = encode(a1)

  const rawResult = symbols.quic_connection_connect(
    a0,
    a1_buf,
    a1_buf.byteLength,
    a2,
  )
  const result = rawResult
  return result
}
export function quic_connection_create(a0: string) {
  const a0_buf = encode(a0)

  const rawResult = symbols.quic_connection_create(a0_buf, a0_buf.byteLength)
  const result = rawResult
  return result
}
export function quic_connection_get_state(a0: bigint) {
  const rawResult = symbols.quic_connection_get_state(a0)
  const result = rawResult
  return result
}
export function quic_connection_get_stats(a0: bigint) {
  const rawResult = symbols.quic_connection_get_stats(a0)
  const result = readPointer(rawResult)
  return decode(result)
}
export function quic_connection_is_closed(a0: bigint) {
  const rawResult = symbols.quic_connection_is_closed(a0)
  const result = rawResult
  return result
}
export function quic_connection_is_established(a0: bigint) {
  const rawResult = symbols.quic_connection_is_established(a0)
  const result = rawResult
  return result
}
export function quic_connection_poll(a0: bigint) {
  const rawResult = symbols.quic_connection_poll(a0)
  const result = readPointer(rawResult)
  return decode(result)
}
export function quic_is_available() {
  const rawResult = symbols.quic_is_available()
  const result = rawResult
  return result
}
export function quic_stream_capacity(a0: bigint, a1: bigint) {
  const rawResult = symbols.quic_stream_capacity(a0, a1)
  const result = rawResult
  return result
}
export function quic_stream_finished(a0: bigint, a1: bigint) {
  const rawResult = symbols.quic_stream_finished(a0, a1)
  const result = rawResult
  return result
}
export function quic_stream_recv(a0: bigint, a1: bigint) {
  const rawResult = symbols.quic_stream_recv(a0, a1)
  const result = readPointer(rawResult)
  return decode(result)
}
export function quic_stream_send(
  a0: bigint,
  a1: bigint,
  a2: string,
  a3: number,
) {
  const a2_buf = encode(a2)

  const rawResult = symbols.quic_stream_send(
    a0,
    a1,
    a2_buf,
    a2_buf.byteLength,
    a3,
  )
  const result = rawResult
  return result
}
export function quic_stream_shutdown(
  a0: bigint,
  a1: bigint,
  a2: number,
  a3: bigint,
) {
  const rawResult = symbols.quic_stream_shutdown(a0, a1, a2, a3)
  const result = rawResult
  return result
}
export function transportx_get_last_error() {
  const rawResult = symbols.transportx_get_last_error()
  const result = readPointer(rawResult)
  return decode(result)
}
export function transportx_init() {
  const rawResult = symbols.transportx_init()
  const result = rawResult
  return result
}
export function transportx_version() {
  const rawResult = symbols.transportx_version()
  const result = readPointer(rawResult)
  return decode(result)
}
export function udp_socket_close(a0: bigint) {
  const rawResult = symbols.udp_socket_close(a0)
  const result = rawResult
  return result
}
export function udp_socket_create(a0: string) {
  const a0_buf = encode(a0)

  const rawResult = symbols.udp_socket_create(a0_buf, a0_buf.byteLength)
  const result = rawResult
  return result
}

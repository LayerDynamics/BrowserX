# SerialX

Serial port and device communication library for BrowserX via Rust FFI.

## Features

- Cross-platform serial port enumeration and I/O
- ESC/POS receipt printer protocol support
- OS printer discovery (lpstat on macOS/Linux)
- Trace logging for diagnostics
- Graceful degradation when FFI unavailable

## Build

```bash
cargo build --release -p serialx
cd crates/serialx && deno run --allow-all gen_bindings.ts
```

## Usage

```typescript
import { SerialPort, EscPos, SerialTrace } from "@browserx/serialx";

// Check availability
if (SerialPort.isAvailable()) {
  // List ports
  const ports = SerialPort.listPorts();
  console.log("Available ports:", ports);

  // Open a port
  const port = new SerialPort();
  if (port.open("/dev/ttyUSB0", 9600)) {
    // Write/read data
    port.write(new TextEncoder().encode("Hello"));
    const response = port.read(1024, 1000);

    // ESC/POS printing
    const printer = new EscPos(port);
    printer.init();
    printer.align("center");
    printer.bold(true);
    printer.print("Receipt Header");
    printer.bold(false);
    printer.align("left");
    printer.print("Item 1       $5.00");
    printer.feedAndCut();

    port.close();
  }

  // View trace log
  const log = SerialTrace.getLog();
  console.log("Trace events:", log.length);
}
```

## Architecture

```
serialx.ts (TypeScript API)
  └─ bindings/bindings.ts (auto-generated FFI)
      └─ libserialx.dylib/.so/.dll (Rust cdylib)
          ├─ trace.rs      — Ring buffer trace logging
          ├─ enumerate.rs  — Port/printer discovery
          ├─ device.rs     — Open/close/configure
          ├─ io.rs         — Read/write/flush
          ├─ protocol.rs   — ESC/POS commands
          └─ deno_bindings.rs — FFI entry points
```

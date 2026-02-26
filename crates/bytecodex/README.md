# bytecodex

Rust FFI crate for BrowserX bytecode optimization and validation. Exposed to Deno via `deno_bindgen`.

## Features

- **Constant Folding** — Folds arithmetic on constant operands into single constants
- **Dead Store Elimination** — Removes `STAR rN` where register N is never read
- **Peephole Optimization** — Pattern-matches small instruction windows (e.g., `STAR r0; LDAR r0` → `STAR r0`)
- **Bytecode Validation** — Checks opcode validity, operand counts, constant pool bounds, jump targets
- **Disassembly** — Human-readable bytecode output

## Usage

```typescript
import { ByteCodeX } from "@browserx/bytecodex";

const bcx = new ByteCodeX();

// Optimize bytecode
const result = bcx.optimize({
  instructions: [0x09, 0x00, 0x03, 0x00, 0x09, 0x01, 0x10, 0x00, 0x43],
  constant_pool: [5.0, 3.0],
});
// result.stats.constants_folded === 1

// Validate bytecode
const validation = bcx.validate({
  instructions: [0x09, 0x00, 0x43],
  constant_pool: [42],
});
// validation.valid === true

// Disassemble
const text = bcx.disassemble({
  instructions: [0x09, 0x00, 0x43],
  constant_pool: [42],
});
// "0000: LDA_CONSTANT 0\n0002: RETURN\n"
```

## Build

```bash
cargo build --release -p bytecodex
deno run --allow-all gen_bindings.ts
```

## Test

```bash
cargo test -p bytecodex
```

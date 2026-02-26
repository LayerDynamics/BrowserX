# Code Review: bytecodex

## Summary

The bytecodex crate is a well-architected Rust FFI library providing bytecode optimization, validation, and disassembly for BrowserX's JavaScript engine. The three-pass optimizer pipeline and two-pass validator are cleanly separated. However, there are critical issues around silent truncation of constant pool indices during optimization, unsafe FFI library lifecycle management in the TypeScript bindings, and error swallowing that could cause silent correctness failures in production.

## Findings

### Critical

- **Constant folding emits pool index as `u8` with no bounds check** (`optimizer.rs:63`) — `new_idx as u8` silently truncates if the constant pool exceeds 255 entries. Each folded constant appends an entry, so aggressive folding on large programs produces incorrect pool indices (e.g. index 256 → 0), corrupting program semantics. No assert, checked cast, or error path exists.

- **`readPointer` assumes big-endian length prefix with no safety guarantee** (`bindings/bindings.ts:15-20`) — Reads a 4-byte length via `getUint32(0)` (big-endian) then allocates and copies that many bytes. No bounds check on the pointer's readable length. Corrupted or zero-length buffers cause out-of-bounds reads or Deno runtime panics. The byte-order convention with Rust is entirely undocumented.

- **`closeLib()` has no reference counting — use-after-free risk** (`bindings/bindings.ts:24`) — If multiple Deno workers import the bindings, one calling `closeLib()` while another is mid-FFI-call causes undefined behavior. `ByteCodeX` class has no `dispose()` method and never calls `closeLib()`, making the library either leak-or-crash.

### High

- **`optimize()` and `validate()` silently swallow all errors** (`bytecodex.ts:118-122, 139-143`) — Both return `null` on any failure without calling `getLastError()`. Callers get `null` with zero diagnostics. A production optimizer silently discarding results is a serious correctness hazard.

- **Dead store elimination is effectively a no-op** (`optimizer.rs:121-128`) — Marks all 256 registers as read on any CALL/CONSTRUCT instruction. Since virtually all real programs contain function calls, the pass preserves every register and provides zero benefit in practice.

- **`OPCODE_OPERAND_COUNTS` is always all-`None`** (`bytecode.rs:234-238`) — Public const lookup table is declared but cannot be populated in const context, so every entry is `None`. Any caller trusting this table will silently misparse bytecode.

- **No input size limit on FFI entry points** (`deno_bindings.rs:31-87`) — `bytecodex_optimize`, `bytecodex_validate`, and `bytecodex_disassemble` accept unbounded input. The optimizer clones the constant pool on every pass, enabling memory exhaustion from malicious or buggy callers.

- **`InstructionIterator` silently truncates instructions with missing operands** (`bytecode.rs:311-315`) — Returns instructions with fewer operands than expected if the bytecode stream ends early. Optimizer and disassembler access operands by index without checking for truncation.

- **`Proxy` object type cast is unsound** (`bindings/bindings.ts:81`) — `{} as ReturnType<...>["symbols"]` with `@ts-nocheck` means TypeScript provides zero type safety on FFI symbol calls. Wrong argument types and renamed Rust symbols are undetected at compile time.

- **`gen_bindings.ts` uses pinned, outdated `deno_bindgen@0.8.1`** (`gen_bindings.ts:4`) — Imported from mutable `deno.land/x` URL. No integrity hash. A developer re-running this could silently generate incompatible bindings.

### Medium

- **`ValidationResult::valid` logic is fragile to new severity levels** (`validator.rs:122`) — `errors.iter().all(|e| matches!(e.severity, ErrorSeverity::Warning))` is correct today but if a third severity (e.g. `Info`) is added, bytecode with only `Info` errors would be marked invalid. Using `!matches!(e.severity, ErrorSeverity::Error)` expresses intent more clearly.

- **Unknown opcodes silently converted to NOP** (`bytecode.rs:300-306`) — Iterator emits synthetic `NOP` with the unknown byte as operand, changing offset progression. Downstream optimizer passes this through, potentially producing different output than input for corrupt bytecode.

- **`LDA_UNDEFINED, RETURN` peephole is a no-op** (`optimizer.rs:190-197`) — Detects the pattern then explicitly skips optimization "for correctness". Dead code branch adds confusion.

- **`gen_bindings.ts` uses brittle regex transformation** (`gen_bindings.ts:60-107`) — If `deno_bindgen` codegen format changes, the regexes silently fail and the raw eager-loading code is written without the lazy wrapper. No warning on failure.

- **`constant_pool: unknown[]` accepts non-serializable values** (`bytecodex.ts:26`) — Callers can pass `undefined`, `Symbol`, or functions which `JSON.stringify` silently drops, causing pool size mismatch and out-of-bounds errors in Rust.

- **`readPointer` allocates per FFI call** (`bindings/bindings.ts:18-19`) — Every optimize/validate/disassemble call allocates a new `Uint8Array` and `TextDecoder`. On the hot path (per-function compilation), this creates significant GC pressure.

- **`lazy_static!` used where `std::sync::LazyLock` (stable since Rust 1.80) suffices** (`error.rs:1-7`) — Single dependency for one global Mutex. Standard library replacement eliminates the external dependency.

- **`check_operand` missing match arm for `LDA`** (`validator.rs:140-168`) — `LDA` operand is not validated, so its register reference (if any) does not update `max_register`.

### Low

- **`Opcode::name()` duplicates enum variant names** (`bytecode.rs:127-175`) — A `Display` derive or `strum::Display` would eliminate the parallel match block.

- **`operand_count` is a free function instead of `impl Opcode` method** (`bytecode.rs:179`) — Belongs as `Opcode::operand_count(&self)` for discoverability.

- **`build.rs` comment is misleading** (`build.rs`) — Claims it "ensures deno_bindgen has an OUT_DIR to write to" but `OUT_DIR` is always set by Cargo for any crate with a `build.rs`.

- **Missing `panic = "abort"` in release profile** (`Cargo.toml:24-27`) — For a `cdylib` FFI library, panics unwinding across the FFI boundary are UB. `panic = "abort"` is both safer and smaller.

- **`deno.json` disables `noUnusedLocals`/`noUnusedParameters`** (`deno.json:14-15`) — Contradicts the project rule that unused variables are always critical.

- **`gen_bindings.ts` uses `std@0.132.0` (2022)** (`gen_bindings.ts:3`) — Mixing old `deno.land/std` with modern JSR imports. Inconsistent and potentially unmaintained.

- **README only documents Rust tests** (`README.md:49-53`) — No documented workflow for verifying TypeScript bindings.

- **No `dispose()` or `[Symbol.dispose]()` on `ByteCodeX` class** (`bytecodex.ts:80`) — Ownership model between class instance and module-level `_lib` is ambiguous.

## Strengths

- **Clean opcode enum design** — `#[repr(u8)]` with explicit hex discriminants, safe `from_byte` returning `Option`, exhaustive `operand_count` match. Adding an opcode forces compiler errors on incomplete matches.

- **Three-pass optimizer pipeline** — Constant folding, dead store elimination, and peephole as discrete `OptimizationPass` trait objects. Easy to extend, reorder, or disable individually. Unified `OptimizationStats` reporting.

- **Two-pass validator** — Pass 1 (opcode/operand validity, pool bounds) separated from pass 2 (jump target validation against collected instruction offsets). Architecturally correct.

- **FFI error propagation pattern** — Global `LAST_ERROR` mutex with `bytecodex_get_last_error()` is a sound, conventional approach for FFI libraries. Consistent with the pixpane crate pattern.

- **Lazy FFI loading via Proxy pattern** — `Deno.dlopen` deferred to first use means importing the module doesn't fail if the native library isn't built. Exactly right for an optional acceleration path.

- **Graceful fallback in V8Compiler** — `try/catch` around the dynamic import nulls `_bytecodex` on failure. Compiler continues without native optimization. Correct default for dev environments without Rust.

- **Strict TypeScript compiler options** — `strict`, `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes` all enabled in `deno.json`.

## Recommendations

1. **Fix `u8` truncation in constant folding** — Use `u8::try_from(new_idx).map_err(...)` or return an error when pool exceeds 255 entries
2. **Add `getLastError()` calls before returning `null`** in `optimize()` and `validate()` — throw or return `{ error: string }`
3. **Add `panic = "abort"` to release profile** — prevent UB from unwinding across FFI boundary
4. **Add input size limits** to FFI entry points (cap instructions and pool length)
5. **Remove or properly populate `OPCODE_OPERAND_COUNTS`** — it's dead API surface that misleads callers
6. **Rework dead store elimination** to track actual register usage per-call rather than marking all 256 as live
7. **Add `dispose()` / `[Symbol.dispose]()` to `ByteCodeX`** with reference counting on the native library
8. **Type `constant_pool` as `(string | number | boolean | null)[]`** to prevent non-serializable values
9. **Replace `lazy_static!` with `std::sync::LazyLock`** to drop the external dependency
10. **Add bounds check and documentation to `readPointer`** for the big-endian length prefix contract

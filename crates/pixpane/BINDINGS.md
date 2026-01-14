# Generating Deno Bindings

## Problem

The official `deno_bindgen` CLI doesn't work correctly when run from within a Cargo workspace member crate. It fails silently because it can't find the `bindings.json` file generated during the Rust build.

## Solution

Use the custom `gen_bindings.ts` script instead of the official CLI.

## Usage

### 1. Build the Rust library

```bash
cargo build --release
```

### 2. Generate TypeScript bindings

```bash
deno run --allow-all gen_bindings.ts
```

This will:

- Find the `bindings.json` file in the build output
- Generate `bindings/bindings.ts` with all FFI type definitions and functions
- Set the correct library path for the workspace structure

### 3. Test the bindings

```bash
deno run --allow-all tests/test.ts
```

## What Gets Generated

The `bindings/bindings.ts` file contains:

- Helper functions for encoding/decoding data
- FFI symbol definitions for all `#[deno_bindgen]` functions
- TypeScript type definitions for all Rust structs/enums
- Wrapper functions that handle serialization/deserialization

## Workflow

After making changes to `src/deno_bindings.rs`:

```bash
cargo build --release && deno run --allow-all gen_bindings.ts
```

The bindings are now ready to import in your Deno code:

```typescript
import { create_window, poll_event } from "./bindings/bindings.ts";
```

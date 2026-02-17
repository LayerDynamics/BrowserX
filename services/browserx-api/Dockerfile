# ── Stage 1: Compile webgpu_x Rust FFI library ──────────────────────────────
FROM rust:latest AS rust-builder

WORKDIR /workspace

# Copy workspace manifests first for better layer caching
COPY Cargo.toml Cargo.lock ./
COPY crates/webgpu_x ./crates/webgpu_x
COPY crates/pixpane ./crates/pixpane

# Build only webgpu_x cdylib (not the full workspace)
# Skips LTO/strip for faster Docker builds; full optimization done in release CI
RUN cargo build --release -p webgpu_x

# ── Stage 2: Deno runtime with compiled FFI library ─────────────────────────
FROM denoland/deno:2.6.9

WORKDIR /app

# Copy entire monorepo (needed for workspace imports: query-engine, browser, etc.)
COPY . .

# Place compiled webgpu_x binary where Deno.dlopen expects it:
# bindings.ts resolves "../../target/release" from crates/webgpu_x/bindings/
# → /app/target/release/libwebgpu_x.so
RUN mkdir -p target/release
COPY --from=rust-builder /workspace/target/release/libwebgpu_x.so target/release/libwebgpu_x.so

# Cache the API service and all its transitive dependencies
# Now succeeds because libwebgpu_x.so is present for Deno.dlopen
RUN deno cache \
      --allow-import \
      services/browserx-api/main.ts

EXPOSE 8080

CMD ["deno", "run", \
     "--allow-net", \
     "--allow-read", \
     "--allow-env", \
     "--allow-ffi", \
     "services/browserx-api/main.ts"]

#!/usr/bin/env bash
# ============================================================
# build-binaries.sh — Build BrowserX native libraries for
# the current platform using Cargo.
#
# Produces:
#   macOS:   target/release/libpixpane.dylib
#            target/release/libwebgpu_x.dylib
#   Linux:   target/release/libpixpane.so
#            target/release/libwebgpu_x.so
#   Windows: target/release/pixpane.dll
#            target/release/webgpu_x.dll
#
# Usage: ./scripts/build-binaries.sh
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "${SCRIPT_DIR}")"

cd "${ROOT_DIR}"

echo "==> Building BrowserX native binaries"
echo "    Platform: $(uname -s)-$(uname -m)"
echo "    Rust:     $(rustc --version)"
echo ""

echo "--- Building pixpane..."
cargo build --release -p pixpane
echo "    Done: pixpane"

echo "--- Building webgpu_x..."
cargo build --release -p webgpu_x
echo "    Done: webgpu_x"

echo ""
echo "==> Build complete. Artifacts in target/release/:"
find target/release -maxdepth 1 \( \
  -name "libpixpane*" -o -name "libwebgpu_x*" \
  -o -name "pixpane.dll" -o -name "webgpu_x.dll" \
\) -exec ls -lh {} \;

#!/usr/bin/env bash
# ============================================================
# download-binaries.sh — Download pre-built platform binaries
# from a GitHub Release. Use this instead of building from
# source when a tagged release is available.
#
# Usage:
#   ./scripts/download-binaries.sh [VERSION] [DEST_DIR]
# Examples:
#   ./scripts/download-binaries.sh                      # latest → ./target/release/
#   ./scripts/download-binaries.sh v0.1.0               # specific tag
#   ./scripts/download-binaries.sh v0.1.0 ./libs        # custom destination
# ============================================================
set -euo pipefail

REPO="LayerDynamics/BrowserX"
VERSION="${1:-latest}"
DEST="${2:-./target/release}"

# ── Platform detection ───────────────────────────────────────
OS="$(uname -s)"
ARCH="$(uname -m)"

case "${OS}-${ARCH}" in
  Linux-x86_64)
    TARGET="x86_64-unknown-linux-gnu"
    EXT=".so"
    PREFIX="lib"
    ;;
  Darwin-arm64)
    TARGET="aarch64-apple-darwin"
    EXT=".dylib"
    PREFIX="lib"
    ;;
  Darwin-x86_64)
    TARGET="x86_64-apple-darwin"
    EXT=".dylib"
    PREFIX="lib"
    ;;
  MINGW*-x86_64|MSYS*-x86_64|CYGWIN*-x86_64)
    TARGET="x86_64-pc-windows-msvc"
    EXT=".dll"
    PREFIX=""
    ;;
  *)
    echo "ERROR: Unsupported platform: ${OS}-${ARCH}"
    echo "Supported: Linux-x86_64, Darwin-arm64, Darwin-x86_64, Windows-x86_64"
    echo "Build from source instead: ./scripts/build-binaries.sh"
    exit 1
    ;;
esac

if [[ "${VERSION}" == "latest" ]]; then
  echo "==> Resolving latest release tag..."
  VERSION="$(curl -fsSL \
    "https://api.github.com/repos/${REPO}/releases/latest" \
    | python3 -c "import sys, json; print(json.load(sys.stdin)['tag_name'])")"
  echo "    Latest: ${VERSION}"
fi

echo "==> Downloading BrowserX binaries"
echo "    Repository: ${REPO}"
echo "    Version:    ${VERSION}"
echo "    Platform:   ${TARGET}"
echo "    Destination: ${DEST}"
echo ""

mkdir -p "${DEST}"

download_binary() {
  local lib_name="$1"
  local asset_name="${PREFIX}${lib_name}-${TARGET}${EXT}"
  local local_name="${PREFIX}${lib_name}${EXT}"
  local url="https://github.com/${REPO}/releases/download/${VERSION}/${asset_name}"

  echo "--- Downloading ${asset_name}..."
  if curl -fSL --progress-bar -o "${DEST}/${local_name}" "${url}"; then
    local size
    size="$(du -sh "${DEST}/${local_name}" | cut -f1)"
    echo "    Saved: ${DEST}/${local_name} (${size})"
  else
    echo "ERROR: Download failed for ${asset_name}"
    echo "       URL tried: ${url}"
    echo "       Verify that ${VERSION} exists at: https://github.com/${REPO}/releases"
    exit 1
  fi
}

download_binary "pixpane"
download_binary "webgpu_x"

echo ""
echo "==> Download complete!"
ls -lh \
  "${DEST}/${PREFIX}pixpane${EXT}" \
  "${DEST}/${PREFIX}webgpu_x${EXT}"

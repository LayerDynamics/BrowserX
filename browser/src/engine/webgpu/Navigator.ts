/**
 * WebGPU Navigator Shim
 *
 * Provides a `navigator.gpu` compatibility shim for environments where the
 * global `navigator` object may not expose the WebGPU GPU interface directly.
 * Used by the BrowserX WebGPU subsystem to ensure consistent GPU access.
 *
 * @module webgpu
 */

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Subset of the WebGPU GPU interface used by BrowserX.
 * The full GPUAdapter/GPUDevice types come from Deno's built-in WebGPU support.
 */
export interface GPU {
  /** Request a GPU adapter for the given options */
  requestAdapter(options?: GPURequestAdapterOptions): Promise<GPUAdapter | null>;
  /** Get the preferred canvas texture format for the current platform */
  getPreferredCanvasFormat(): GPUTextureFormat;
  /** Optional set of enabled WGSL language features (ReadonlySet<string> per WebGPU spec) */
  wgslLanguageFeatures?: ReadonlySet<string>;
}

/**
 * Extension of the Navigator interface to include WebGPU support.
 */
export interface NavigatorGPU {
  readonly gpu: GPU;
}

// ============================================================================
// Installation Utility
// ============================================================================

/**
 * Installs `navigator.gpu` into the given navigator-like object.
 *
 * Resolution order:
 * 1. `globalThis.navigator?.gpu` — Deno's native WebGPU GPU object
 * 2. `globalThis.Deno?.gpu` — Deno-specific fallback (older Deno versions)
 * 3. Does nothing if neither is available (non-GPU environments)
 *
 * @param nav - A record representing the navigator object to install into.
 */
export function installNavigatorGPU(nav: Record<string, unknown>): void {
  // Already installed
  if (nav["gpu"] !== undefined) {
    return;
  }

  // Prefer globalThis.navigator.gpu (standard Deno WebGPU path)
  const globalNav = (globalThis as Record<string, unknown>)["navigator"] as
    | Record<string, unknown>
    | undefined;

  if (globalNav !== undefined && globalNav["gpu"] !== undefined) {
    nav["gpu"] = globalNav["gpu"];
    return;
  }

  // Fallback: Deno.gpu (older Deno versions exposed GPU here)
  const deno = (globalThis as Record<string, unknown>)["Deno"] as
    | Record<string, unknown>
    | undefined;

  if (deno !== undefined && deno["gpu"] !== undefined) {
    nav["gpu"] = deno["gpu"];
    return;
  }

  // No WebGPU available — leave nav.gpu unset (headless mode will apply)
}

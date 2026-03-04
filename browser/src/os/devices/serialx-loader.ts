/**
 * Shared lazy loader for serialx FFI module.
 * Centralizes the import/caching logic used across Serial.ts, Printer.ts, etc.
 */

let serialxModule: typeof import("@browserx/serialx") | null = null;
let serialxLoaded = false;
let serialxLoadAttempted = false;

/** Lazy-load the serialx module. Returns null if unavailable. */
export async function loadSerialx(): Promise<typeof import("@browserx/serialx") | null> {
  if (serialxLoadAttempted) return serialxModule;
  serialxLoadAttempted = true;
  try {
    serialxModule = await import("@browserx/serialx");
    serialxLoaded = true;
    return serialxModule;
  } catch {
    return null;
  }
}

/** Check if serialx has been loaded (synchronous, uses cached state). */
export function isSerialxLoaded(): boolean {
  return serialxLoaded;
}

/** Get the cached serialx module (null if not loaded or unavailable). */
export function getSerialxModule(): typeof import("@browserx/serialx") | null {
  return serialxModule;
}

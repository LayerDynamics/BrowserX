/**
 * FontEngine — TTF/OTF glyph rasterization using fontdue WASM bindings.
 *
 * Uses `denosaurs/font` (Deno WASM bindings to the fontdue Rust crate)
 * for high-quality anti-aliased glyph rendering from TrueType/OpenType fonts.
 *
 * Font resolution: CSS font-family → loaded fonts → system fonts → bundled fallback
 *
 * Usage:
 *   const engine = new FontEngine();
 *   await engine.initialize();          // loads WASM module
 *   await engine.discoverSystemFonts(); // finds system TTF/OTF files
 *   const glyph = engine.rasterizeGlyph("A", 16, "sans-serif");
 *   const width = engine.measureText("Hello world", "sans-serif", 16);
 */

// deno-lint-ignore-file no-explicit-any

/**
 * Rasterized glyph — alpha coverage bitmap + metrics
 */
export interface RasterizedGlyph {
  /** Alpha coverage values (0-255) per pixel, row-major */
  bitmap: Uint8Array;
  /** Bitmap width in pixels */
  width: number;
  /** Bitmap height in pixels */
  height: number;
  /** Pixel offset of left-most edge (may be negative) */
  xmin: number;
  /** Pixel offset of bottom-most edge (may be negative = below baseline) */
  ymin: number;
  /** Horizontal advance to next character (subpixels) */
  advanceWidth: number;
}

/**
 * Font metrics for a given size
 */
export interface FontMetrics {
  ascent: number;
  descent: number;
  lineGap: number;
  lineHeight: number;
}

/**
 * Internal: a loaded font with its fontdue handle
 */
interface LoadedFont {
  name: string;
  path: string;
  handle: any; // fontdue Font instance
}

/**
 * Map generic CSS font-family names to common system font filenames.
 */
const GENERIC_FONT_FAMILIES: Record<string, string[]> = {
  "sans-serif": [
    "Arial", "Helvetica", "Helvetica Neue", "HelveticaNeue",
    "Liberation Sans", "DejaVu Sans", "DejaVuSans",
    "Noto Sans", "NotoSans", "Roboto", "SF Pro", "SFPro",
    "Segoe UI", "SegoeUI",
  ],
  "serif": [
    "Times New Roman", "TimesNewRoman", "Times",
    "Liberation Serif", "DejaVu Serif", "DejaVuSerif",
    "Noto Serif", "NotoSerif", "Georgia",
  ],
  "monospace": [
    "Courier New", "CourierNew", "Courier",
    "Liberation Mono", "DejaVu Sans Mono", "DejaVuSansMono",
    "Noto Sans Mono", "NotoSansMono", "Menlo", "Consolas",
    "SF Mono", "SFMono",
  ],
  "system-ui": [
    "SF Pro", "SFPro", "Segoe UI", "SegoeUI",
    "Roboto", "Helvetica Neue", "HelveticaNeue", "Arial",
  ],
};

/**
 * Platform-specific system font directories.
 */
function getSystemFontDirs(): string[] {
  const os = Deno.build.os;
  const home = Deno.env.get("HOME") ?? "";
  if (os === "darwin") {
    return [
      "/System/Library/Fonts",
      "/System/Library/Fonts/Supplemental",
      "/Library/Fonts",
      `${home}/Library/Fonts`,
    ];
  }
  if (os === "linux") {
    return [
      "/usr/share/fonts",
      "/usr/local/share/fonts",
      `${home}/.fonts`,
      `${home}/.local/share/fonts`,
    ];
  }
  const windir = Deno.env.get("WINDIR") ?? "C:\\Windows";
  const localAppData = Deno.env.get("LOCALAPPDATA") ?? "";
  return [
    `${windir}\\Fonts`,
    localAppData ? `${localAppData}\\Microsoft\\Windows\\Fonts` : "",
  ].filter(Boolean);
}

/**
 * FontEngine provides real TTF/OTF glyph rasterization via fontdue WASM.
 */
export class FontEngine {
  /** fontdue Font class constructor */
  private FontClass: any = null;
  /** loaded fonts keyed by lowercase name */
  private fonts = new Map<string, LoadedFont>();
  /** glyph raster cache: "family:size:char" → RasterizedGlyph */
  private glyphCache = new Map<string, RasterizedGlyph>();
  private initialized = false;
  private initFailed = false;

  /**
   * Load the fontdue WASM module.
   * Returns true if successful, false if fontdue is unavailable.
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) return !this.initFailed;
    this.initialized = true;

    try {
      const mod = await import("https://deno.land/x/font@0.1.3/mod.ts");
      this.FontClass = (mod as any).Font ?? (mod as any).default;
      if (!this.FontClass) {
        this.initFailed = true;
        return false;
      }
      return true;
    } catch {
      this.initFailed = true;
      return false;
    }
  }

  /**
   * Load a font from a file path.
   */
  async loadFont(name: string, path: string): Promise<boolean> {
    if (!this.FontClass) return false;
    try {
      const data = await Deno.readFile(path);
      const handle = new this.FontClass(data);
      const key = name.toLowerCase();
      this.fonts.set(key, { name, path, handle });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Load a font from raw byte data.
   */
  loadFontFromBytes(name: string, data: Uint8Array): boolean {
    if (!this.FontClass) return false;
    try {
      const handle = new this.FontClass(data);
      this.fonts.set(name.toLowerCase(), { name, path: "", handle });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Discover and load system fonts for generic CSS families.
   * Scans system font directories and loads the first match for
   * each generic family (sans-serif, serif, monospace, system-ui).
   * Returns total number of fonts loaded.
   */
  async discoverSystemFonts(): Promise<number> {
    if (!this.FontClass) return 0;
    const dirs = getSystemFontDirs();
    let loaded = 0;

    // Collect all font files first
    const fontFiles: Array<{ name: string; path: string }> = [];
    for (const dir of dirs) {
      try {
        for await (const entry of Deno.readDir(dir)) {
          if (!entry.isFile) continue;
          const lower = entry.name.toLowerCase();
          if (!lower.endsWith(".ttf") && !lower.endsWith(".otf")) continue;
          fontFiles.push({
            name: entry.name.replace(/\.(ttf|otf)$/i, ""),
            path: `${dir}/${entry.name}`,
          });
        }
      } catch {
        // Directory not accessible
      }
    }

    // Match fonts to generic families
    for (const [generic, candidates] of Object.entries(GENERIC_FONT_FAMILIES)) {
      if (this.fonts.has(generic)) continue; // already loaded
      for (const candidate of candidates) {
        const candidateLower = candidate.toLowerCase().replace(/\s+/g, "");
        const match = fontFiles.find((f) => {
          const fLower = f.name.toLowerCase().replace(/[\s-_]+/g, "");
          // Match "Arial" to "Arial.ttf", "arial-regular.ttf", etc.
          return fLower === candidateLower ||
            fLower.startsWith(candidateLower) && (
              fLower === candidateLower ||
              fLower[candidateLower.length] === "-" ||
              fLower.includes("regular")
            );
        });
        if (match) {
          if (await this.loadFont(generic, match.path)) {
            // Also register under the specific font name
            const specificKey = candidate.toLowerCase();
            if (!this.fonts.has(specificKey)) {
              this.fonts.set(specificKey, this.fonts.get(generic)!);
            }
            loaded++;
            break;
          }
        }
      }
    }

    return loaded;
  }

  /**
   * Resolve a CSS font-family string to a loaded font handle.
   * Tries each family in the comma-separated stack, then falls back.
   */
  resolveFont(fontFamily: string): LoadedFont | null {
    const families = fontFamily
      .split(",")
      .map((f) => f.trim().replace(/['"]/g, "").toLowerCase());

    for (const family of families) {
      const font = this.fonts.get(family);
      if (font) return font;
    }

    // Fallback chain: sans-serif → serif → first loaded font
    for (const fallback of ["sans-serif", "serif", "monospace"]) {
      const font = this.fonts.get(fallback);
      if (font) return font;
    }

    // Last resort: first loaded font
    const first = this.fonts.values().next();
    return first.done ? null : first.value;
  }

  /**
   * Rasterize a single character glyph at the given font size.
   * Returns alpha coverage bitmap with positioning metrics.
   */
  rasterizeGlyph(
    char: string,
    fontSize: number,
    fontFamily = "sans-serif",
  ): RasterizedGlyph | null {
    const cacheKey = `${fontFamily}:${fontSize}:${char}`;
    const cached = this.glyphCache.get(cacheKey);
    if (cached) return cached;

    const font = this.resolveFont(fontFamily);
    if (!font) return null;

    try {
      const result = font.handle.rasterize(char, fontSize);
      if (!result) return null;

      const metrics = result.metrics ?? result;
      const bitmap = result.bitmap ?? new Uint8Array(0);

      const glyph: RasterizedGlyph = {
        bitmap: bitmap instanceof Uint8Array ? bitmap : new Uint8Array(bitmap),
        width: metrics.width ?? 0,
        height: metrics.height ?? 0,
        xmin: metrics.xmin ?? 0,
        ymin: metrics.ymin ?? 0,
        advanceWidth: metrics.advance_width ?? metrics.advanceWidth ?? fontSize * 0.55,
      };

      this.glyphCache.set(cacheKey, glyph);
      return glyph;
    } catch {
      return null;
    }
  }

  /**
   * Measure text width using real advance widths.
   */
  measureText(text: string, fontFamily: string, fontSize: number): number {
    let total = 0;
    for (let i = 0; i < text.length; i++) {
      const glyph = this.rasterizeGlyph(text[i], fontSize, fontFamily);
      if (glyph) {
        total += glyph.advanceWidth;
      } else {
        // Proportional fallback
        total += fontSize * 0.55;
      }
    }
    return total;
  }

  /**
   * Render a full string of text into an RGBA pixel buffer
   * using real anti-aliased glyph bitmaps.
   *
   * @param pixels   Target RGBA buffer
   * @param bufW     Buffer width
   * @param bufH     Buffer height
   * @param text     String to render
   * @param x        Left x position
   * @param baselineY Baseline y position
   * @param fontSize  Font size in pixels
   * @param fontFamily CSS font-family string
   * @param color    Fill color [r, g, b, a] (rgb 0-255, a 0-1)
   * @param alpha    Global alpha multiplier (0-1)
   * @returns number of characters rendered with real glyphs (0 = all missed)
   */
  renderText(
    pixels: Uint8ClampedArray,
    bufW: number,
    bufH: number,
    text: string,
    x: number,
    baselineY: number,
    fontSize: number,
    fontFamily: string,
    color: [number, number, number, number],
    alpha: number,
  ): number {
    let curX = x;
    let rendered = 0;

    for (let i = 0; i < text.length; i++) {
      const glyph = this.rasterizeGlyph(text[i], fontSize, fontFamily);
      if (!glyph || glyph.width === 0 || glyph.height === 0) {
        // No glyph — advance by estimated width, caller can overlay bitmap fallback
        curX += glyph?.advanceWidth ?? fontSize * 0.55;
        continue;
      }

      rendered++;

      // glyph.xmin = offset from pen to left edge of bitmap
      // glyph.ymin = offset from bottom of bitmap to baseline
      //   (positive = above baseline, but fontdue uses bottom-up ymin)
      // For screen coords (y-down): glyph top = baselineY - (ymin + height)
      const gx = Math.round(curX + glyph.xmin);
      const gy = Math.round(baselineY - glyph.ymin - glyph.height);

      for (let row = 0; row < glyph.height; row++) {
        const py = gy + row;
        if (py < 0 || py >= bufH) continue;
        for (let col = 0; col < glyph.width; col++) {
          const px = gx + col;
          if (px < 0 || px >= bufW) continue;

          const coverage = glyph.bitmap[row * glyph.width + col];
          if (coverage === 0) continue;

          const srcA = (coverage / 255) * color[3] * alpha;
          const idx = (py * bufW + px) * 4;

          if (srcA >= 0.999) {
            // Opaque fast path
            pixels[idx] = color[0];
            pixels[idx + 1] = color[1];
            pixels[idx + 2] = color[2];
            pixels[idx + 3] = 255;
          } else {
            const dstA = pixels[idx + 3] / 255;
            const outA = srcA + dstA * (1 - srcA);
            if (outA > 0) {
              pixels[idx] = Math.round(
                (color[0] * srcA + pixels[idx] * dstA * (1 - srcA)) / outA,
              );
              pixels[idx + 1] = Math.round(
                (color[1] * srcA + pixels[idx + 1] * dstA * (1 - srcA)) / outA,
              );
              pixels[idx + 2] = Math.round(
                (color[2] * srcA + pixels[idx + 2] * dstA * (1 - srcA)) / outA,
              );
              pixels[idx + 3] = Math.round(outA * 255);
            }
          }
        }
      }

      curX += glyph.advanceWidth;
    }

    return rendered;
  }

  /** Check if real rasterization is available */
  isAvailable(): boolean {
    return this.FontClass !== null;
  }

  /** Check if any fonts are loaded */
  hasFonts(): boolean {
    return this.fonts.size > 0;
  }

  /** Get number of loaded fonts */
  getFontCount(): number {
    return this.fonts.size;
  }

  /** Get loaded font family names */
  getFontNames(): string[] {
    return Array.from(this.fonts.keys());
  }

  /** Clear glyph raster cache */
  clearCache(): void {
    this.glyphCache.clear();
  }

  /** Dispose all fonts and caches */
  dispose(): void {
    this.fonts.clear();
    this.glyphCache.clear();
    this.FontClass = null;
    this.initialized = false;
    this.initFailed = false;
  }
}

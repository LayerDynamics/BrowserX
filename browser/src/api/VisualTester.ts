/**
 * Visual Tester API
 *
 * Provides visual testing capabilities including screenshot comparison,
 * visual regression testing, element visibility checks, and layout verification.
 */

import { BrowserPage, DOMElement } from "./BrowserPage.ts";

/**
 * Screenshot options
 */
export interface ScreenshotConfig {
  /** Full page screenshot (not just viewport) */
  fullPage?: boolean;
  /** Clip to specific region */
  clip?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Element selector to screenshot */
  selector?: string;
  /** Image format */
  format?: "png" | "jpeg";
  /** Quality for jpeg (0-100) */
  quality?: number;
  /** Scale factor */
  scale?: number;
  /** Whether to hide scrollbars */
  hideScrollbars?: boolean;
  /** CSS selectors to hide during screenshot */
  hideSelectors?: string[];
  /** Wait for selector before screenshot */
  waitForSelector?: string;
  /** Timeout for waiting */
  timeout?: number;
}

/**
 * Screenshot result
 */
export interface ScreenshotResult {
  /** Screenshot data as base64 */
  data: string;
  /** Format of the image */
  format: "png" | "jpeg";
  /** Width of the screenshot */
  width: number;
  /** Height of the screenshot */
  height: number;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Visual comparison options
 */
export interface ComparisonOptions {
  /** Threshold for pixel difference (0-1, 0 = exact match) */
  threshold?: number;
  /** Include anti-aliasing pixels in diff */
  includeAntiAliasing?: boolean;
  /** Regions to ignore during comparison */
  ignoreRegions?: {
    x: number;
    y: number;
    width: number;
    height: number;
  }[];
  /** CSS selectors to mask during comparison */
  maskSelectors?: string[];
  /** Diff output color */
  diffColor?: { r: number; g: number; b: number };
}

/**
 * Visual comparison result
 */
export interface ComparisonResult {
  /** Whether images match within threshold */
  match: boolean;
  /** Percentage of pixels that differ */
  diffPercentage: number;
  /** Number of different pixels */
  diffPixelCount: number;
  /** Total pixels compared */
  totalPixels: number;
  /** Diff image data as base64 (if images differ) */
  diffImage?: string;
  /** Dimensions of compared images */
  dimensions: {
    width: number;
    height: number;
  };
  /** Whether images had same dimensions */
  sameDimensions: boolean;
}

/**
 * Element visibility result
 */
export interface VisibilityResult {
  /** Whether element exists in DOM */
  exists: boolean;
  /** Whether element is visible */
  visible: boolean;
  /** Whether element is in viewport */
  inViewport: boolean;
  /** Computed visibility style */
  computedVisibility: string | null;
  /** Computed display style */
  computedDisplay: string | null;
  /** Computed opacity */
  computedOpacity: number | null;
  /** Element bounding box */
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
}

/**
 * Layout check result
 */
export interface LayoutCheckResult {
  /** Whether layout check passed */
  passed: boolean;
  /** Actual values */
  actual: Record<string, number | string>;
  /** Expected values */
  expected: Record<string, number | string>;
  /** Differences */
  differences: string[];
}

/**
 * Visual snapshot metadata
 */
export interface SnapshotMetadata {
  /** Snapshot name/identifier */
  name: string;
  /** URL where snapshot was taken */
  url: string;
  /** Viewport dimensions */
  viewport: {
    width: number;
    height: number;
  };
  /** Timestamp */
  timestamp: Date;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Visual Tester class
 */
export class VisualTester {
  private page: BrowserPage;
  private baselineSnapshots: Map<string, { data: string; metadata: SnapshotMetadata }> = new Map();

  constructor(page: BrowserPage) {
    this.page = page;
  }

  /**
   * Take a screenshot of the current page
   */
  async screenshot(config: ScreenshotConfig = {}): Promise<ScreenshotResult> {
    const format = config.format || "png";
    const timestamp = new Date();

    // Default viewport size (standard desktop)
    const defaultViewportSize = { width: 1920, height: 1080 };

    // Wait for selector if specified
    if (config.waitForSelector) {
      await this.page.wait({
        type: "selector",
        selector: config.waitForSelector,
        timeout: config.timeout || 30000,
      });
    }

    // Hide elements if specified
    const hiddenElements: { selector: string; originalDisplay: string }[] = [];
    if (config.hideSelectors) {
      for (const selector of config.hideSelectors) {
        const elements = await this.page.query(selector);
        for (const element of elements) {
          const display = await element.getProperty("style.display") as string || "";
          hiddenElements.push({ selector, originalDisplay: display });
          // Actually hide the element
          await this.page.evaluate(`document.querySelector('${selector}').style.display = 'none'`);
        }
      }
    }

    // Take screenshot using page's screenshot method
    let screenshotData: Uint8Array;
    try {
      if (config.selector) {
        // Element screenshot
        const elements = await this.page.query(config.selector);
        if (elements.length === 0) {
          throw new Error(`Element not found: ${config.selector}`);
        }
        // Screenshot the element
        screenshotData = await this.page.screenshot({
          format,
          quality: config.quality,
          selector: config.selector,
        });
      } else {
        // Full page or viewport screenshot
        screenshotData = await this.page.screenshot({
          format,
          quality: config.quality,
          fullPage: config.fullPage,
        });
      }
    } finally {
      // Restore hidden elements - use the stored display values
      for (const hidden of hiddenElements) {
        await this.page.evaluate(
          `document.querySelector('${hidden.selector}').style.display = '${hidden.originalDisplay}'`,
        );
      }
    }

    // Convert to base64
    const base64 = this.arrayBufferToBase64(screenshotData);

    // Get dimensions from the screenshot (simplified - would need image parsing)
    // Using clip dimensions if provided, otherwise default viewport
    const width = config.clip?.width || defaultViewportSize.width;
    const height = config.clip?.height ||
      (config.fullPage ? defaultViewportSize.height * 2 : defaultViewportSize.height);

    return {
      data: base64,
      format,
      width,
      height,
      timestamp,
    };
  }

  /**
   * Take a screenshot of a specific element
   */
  async screenshotElement(
    selector: string,
    config: Omit<ScreenshotConfig, "selector"> = {},
  ): Promise<ScreenshotResult> {
    return this.screenshot({ ...config, selector });
  }

  /**
   * Compare two screenshots
   */
  async compare(
    image1: string | Uint8Array,
    image2: string | Uint8Array,
    options: ComparisonOptions = {},
  ): Promise<ComparisonResult> {
    const threshold = options.threshold ?? 0.1;

    // Convert to Uint8Array if base64
    const data1 = typeof image1 === "string" ? this.base64ToArrayBuffer(image1) : image1;
    const data2 = typeof image2 === "string" ? this.base64ToArrayBuffer(image2) : image2;

    // Decode PNG images to raw RGBA pixels for accurate comparison
    const decoded1 = await this.decodePNGToRGBA(data1);
    const decoded2 = await this.decodePNGToRGBA(data2);

    const sameDimensions = decoded1.width === decoded2.width && decoded1.height === decoded2.height;
    const width = Math.max(decoded1.width, decoded2.width);
    const height = Math.max(decoded1.height, decoded2.height);
    const totalPixels = width * height;

    // Compare decoded RGBA pixels
    let diffPixelCount = 0;
    const thresholdValue = threshold * 255;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i1 = (y * decoded1.width + x) * 4;
        const i2 = (y * decoded2.width + x) * 4;

        // Out-of-bounds pixels count as different
        if (
          x >= decoded1.width || y >= decoded1.height ||
          x >= decoded2.width || y >= decoded2.height
        ) {
          diffPixelCount++;
          continue;
        }

        // Compare RGBA channels
        const dr = Math.abs(decoded1.pixels[i1] - decoded2.pixels[i2]);
        const dg = Math.abs(decoded1.pixels[i1 + 1] - decoded2.pixels[i2 + 1]);
        const db = Math.abs(decoded1.pixels[i1 + 2] - decoded2.pixels[i2 + 2]);
        const da = Math.abs(decoded1.pixels[i1 + 3] - decoded2.pixels[i2 + 3]);

        if (
          dr > thresholdValue || dg > thresholdValue ||
          db > thresholdValue || da > thresholdValue
        ) {
          diffPixelCount++;
        }
      }
    }

    const diffPercentage = totalPixels > 0 ? (diffPixelCount / totalPixels) * 100 : 0;

    return {
      match: diffPercentage <= threshold * 100,
      diffPercentage,
      diffPixelCount,
      totalPixels,
      sameDimensions,
      dimensions: { width, height },
    };
  }

  /**
   * Compare current page with a baseline snapshot
   */
  async compareWithBaseline(
    baselineName: string,
    config: ScreenshotConfig = {},
    options: ComparisonOptions = {},
  ): Promise<ComparisonResult & { baselineExists: boolean }> {
    const baseline = this.baselineSnapshots.get(baselineName);

    if (!baseline) {
      return {
        match: false,
        diffPercentage: 100,
        diffPixelCount: 0,
        totalPixels: 0,
        sameDimensions: false,
        dimensions: { width: 0, height: 0 },
        baselineExists: false,
      };
    }

    const currentScreenshot = await this.screenshot(config);
    const result = await this.compare(baseline.data, currentScreenshot.data, options);

    return {
      ...result,
      baselineExists: true,
    };
  }

  /**
   * Save a baseline snapshot
   */
  async saveBaseline(
    name: string,
    config: ScreenshotConfig = {},
    metadata?: Record<string, unknown>,
  ): Promise<SnapshotMetadata> {
    const screenshot = await this.screenshot(config);
    // Default viewport size (standard desktop) - BrowserPage doesn't expose viewport
    const defaultViewportSize = { width: 1920, height: 1080 };

    const snapshotMetadata: SnapshotMetadata = {
      name,
      url: this.page.getCurrentURL() || "",
      viewport: defaultViewportSize,
      timestamp: screenshot.timestamp,
      metadata,
    };

    this.baselineSnapshots.set(name, {
      data: screenshot.data,
      metadata: snapshotMetadata,
    });

    return snapshotMetadata;
  }

  /**
   * Get a stored baseline snapshot
   */
  getBaseline(name: string): { data: string; metadata: SnapshotMetadata } | null {
    return this.baselineSnapshots.get(name) || null;
  }

  /**
   * Delete a stored baseline snapshot
   */
  deleteBaseline(name: string): boolean {
    return this.baselineSnapshots.delete(name);
  }

  /**
   * List all stored baseline snapshots
   */
  listBaselines(): SnapshotMetadata[] {
    return Array.from(this.baselineSnapshots.values()).map((b) => b.metadata);
  }

  /**
   * Check if an element is visible
   */
  async checkVisibility(selector: string): Promise<VisibilityResult> {
    const elements = await this.page.query(selector);

    if (elements.length === 0) {
      return {
        exists: false,
        visible: false,
        inViewport: false,
        computedVisibility: null,
        computedDisplay: null,
        computedOpacity: null,
        boundingBox: null,
      };
    }

    const element = elements[0];

    // Get computed styles
    const visibility = await element.getProperty("style.visibility") as string | null;
    const display = await element.getProperty("style.display") as string | null;
    const opacityStr = await element.getProperty("style.opacity") as string | null;
    const opacity = opacityStr ? parseFloat(opacityStr) : null;

    // Get bounding box
    const rect = await this.getElementBoundingBox(element);

    // Determine visibility
    const isVisible = display !== "none" &&
      visibility !== "hidden" &&
      (opacity === null || opacity > 0) &&
      rect !== null &&
      rect.width > 0 &&
      rect.height > 0;

    // Check if in viewport
    // Default viewport size (standard desktop) - BrowserPage doesn't expose viewport
    const defaultViewportSize = { width: 1920, height: 1080 };
    const inViewport = rect !== null &&
      rect.x < defaultViewportSize.width &&
      rect.y < defaultViewportSize.height &&
      rect.x + rect.width > 0 &&
      rect.y + rect.height > 0;

    return {
      exists: true,
      visible: isVisible,
      inViewport,
      computedVisibility: visibility,
      computedDisplay: display,
      computedOpacity: opacity,
      boundingBox: rect,
    };
  }

  /**
   * Check if multiple elements are visible
   */
  async checkMultipleVisibility(selectors: string[]): Promise<Map<string, VisibilityResult>> {
    const results = new Map<string, VisibilityResult>();

    for (const selector of selectors) {
      results.set(selector, await this.checkVisibility(selector));
    }

    return results;
  }

  /**
   * Verify element layout against expected values
   */
  async verifyLayout(
    selector: string,
    expected: {
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      minWidth?: number;
      maxWidth?: number;
      minHeight?: number;
      maxHeight?: number;
    },
    tolerance: number = 1,
  ): Promise<LayoutCheckResult> {
    const elements = await this.page.query(selector);

    if (elements.length === 0) {
      return {
        passed: false,
        actual: {},
        expected: expected as Record<string, number>,
        differences: ["Element not found"],
      };
    }

    const rect = await this.getElementBoundingBox(elements[0]);
    if (!rect) {
      return {
        passed: false,
        actual: {},
        expected: expected as Record<string, number>,
        differences: ["Could not get element bounding box"],
      };
    }

    const actual: Record<string, number> = {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    };

    const differences: string[] = [];

    // Check each expected property
    if (expected.x !== undefined && Math.abs(rect.x - expected.x) > tolerance) {
      differences.push(`x: expected ${expected.x}, got ${rect.x}`);
    }
    if (expected.y !== undefined && Math.abs(rect.y - expected.y) > tolerance) {
      differences.push(`y: expected ${expected.y}, got ${rect.y}`);
    }
    if (expected.width !== undefined && Math.abs(rect.width - expected.width) > tolerance) {
      differences.push(`width: expected ${expected.width}, got ${rect.width}`);
    }
    if (expected.height !== undefined && Math.abs(rect.height - expected.height) > tolerance) {
      differences.push(`height: expected ${expected.height}, got ${rect.height}`);
    }
    if (expected.minWidth !== undefined && rect.width < expected.minWidth - tolerance) {
      differences.push(`width ${rect.width} is less than minWidth ${expected.minWidth}`);
    }
    if (expected.maxWidth !== undefined && rect.width > expected.maxWidth + tolerance) {
      differences.push(`width ${rect.width} is greater than maxWidth ${expected.maxWidth}`);
    }
    if (expected.minHeight !== undefined && rect.height < expected.minHeight - tolerance) {
      differences.push(`height ${rect.height} is less than minHeight ${expected.minHeight}`);
    }
    if (expected.maxHeight !== undefined && rect.height > expected.maxHeight + tolerance) {
      differences.push(`height ${rect.height} is greater than maxHeight ${expected.maxHeight}`);
    }

    return {
      passed: differences.length === 0,
      actual,
      expected: expected as Record<string, number>,
      differences,
    };
  }

  /**
   * Verify relative positioning between two elements
   */
  async verifyRelativePosition(
    selector1: string,
    selector2: string,
    relationship: "above" | "below" | "left" | "right" | "overlapping" | "adjacent",
    tolerance: number = 1,
  ): Promise<{ passed: boolean; details: string }> {
    const elements1 = await this.page.query(selector1);
    const elements2 = await this.page.query(selector2);

    if (elements1.length === 0) {
      return { passed: false, details: `Element not found: ${selector1}` };
    }
    if (elements2.length === 0) {
      return { passed: false, details: `Element not found: ${selector2}` };
    }

    const rect1 = await this.getElementBoundingBox(elements1[0]);
    const rect2 = await this.getElementBoundingBox(elements2[0]);

    if (!rect1 || !rect2) {
      return { passed: false, details: "Could not get element bounding boxes" };
    }

    let passed = false;
    let details = "";

    switch (relationship) {
      case "above":
        passed = rect1.y + rect1.height <= rect2.y + tolerance;
        details = passed
          ? `${selector1} is above ${selector2}`
          : `${selector1} bottom (${
            rect1.y + rect1.height
          }) is not above ${selector2} top (${rect2.y})`;
        break;
      case "below":
        passed = rect1.y >= rect2.y + rect2.height - tolerance;
        details = passed
          ? `${selector1} is below ${selector2}`
          : `${selector1} top (${rect1.y}) is not below ${selector2} bottom (${
            rect2.y + rect2.height
          })`;
        break;
      case "left":
        passed = rect1.x + rect1.width <= rect2.x + tolerance;
        details = passed
          ? `${selector1} is left of ${selector2}`
          : `${selector1} right (${
            rect1.x + rect1.width
          }) is not left of ${selector2} left (${rect2.x})`;
        break;
      case "right":
        passed = rect1.x >= rect2.x + rect2.width - tolerance;
        details = passed
          ? `${selector1} is right of ${selector2}`
          : `${selector1} left (${rect1.x}) is not right of ${selector2} right (${
            rect2.x + rect2.width
          })`;
        break;
      case "overlapping":
        passed = !(
          rect1.x + rect1.width < rect2.x ||
          rect2.x + rect2.width < rect1.x ||
          rect1.y + rect1.height < rect2.y ||
          rect2.y + rect2.height < rect1.y
        );
        details = passed
          ? `${selector1} overlaps with ${selector2}`
          : `${selector1} does not overlap with ${selector2}`;
        break;
      case "adjacent":
        const horizontallyAdjacent = Math.abs(rect1.x + rect1.width - rect2.x) <= tolerance ||
          Math.abs(rect2.x + rect2.width - rect1.x) <= tolerance;
        const verticallyAdjacent = Math.abs(rect1.y + rect1.height - rect2.y) <= tolerance ||
          Math.abs(rect2.y + rect2.height - rect1.y) <= tolerance;
        passed = horizontallyAdjacent || verticallyAdjacent;
        details = passed
          ? `${selector1} is adjacent to ${selector2}`
          : `${selector1} is not adjacent to ${selector2}`;
        break;
    }

    return { passed, details };
  }

  /**
   * Wait for visual stability (no more layout changes)
   */
  async waitForVisualStability(
    timeout: number = 5000,
    checkInterval: number = 100,
  ): Promise<boolean> {
    let previousScreenshot: string | null = null;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const currentScreenshot = await this.screenshot({ format: "png" });

      if (previousScreenshot) {
        const comparison = await this.compare(previousScreenshot, currentScreenshot.data, {
          threshold: 0.01,
        });

        if (comparison.match) {
          return true;
        }
      }

      previousScreenshot = currentScreenshot.data;
      await this.sleep(checkInterval);
    }

    return false;
  }

  /**
   * Get element bounding box
   */
  private async getElementBoundingBox(
    element: DOMElement,
  ): Promise<{ x: number; y: number; width: number; height: number } | null> {
    try {
      // Get bounding rect properties
      const x = await element.getProperty("offsetLeft") as number | null;
      const y = await element.getProperty("offsetTop") as number | null;
      const width = await element.getProperty("offsetWidth") as number | null;
      const height = await element.getProperty("offsetHeight") as number | null;

      if (x === null || y === null || width === null || height === null) {
        return null;
      }

      return { x, y, width, height };
    } catch {
      return null;
    }
  }

  /**
   * Convert ArrayBuffer to base64
   */
  private arrayBufferToBase64(buffer: Uint8Array): string {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert base64 to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Decode PNG file bytes to raw RGBA pixel data.
   * Parses PNG chunks, decompresses IDAT, applies scanline filters,
   * converts all color types to RGBA.
   */
  private async decodePNGToRGBA(pngData: Uint8Array): Promise<{
    pixels: Uint8Array;
    width: number;
    height: number;
  }> {
    const empty = { pixels: new Uint8Array(0), width: 0, height: 0 };

    // Validate PNG signature
    if (
      pngData.length < 8 || pngData[0] !== 0x89 || pngData[1] !== 0x50 ||
      pngData[2] !== 0x4E || pngData[3] !== 0x47
    ) {
      // Not PNG — treat raw bytes as RGBA
      const totalPixels = Math.floor(pngData.length / 4);
      const side = Math.ceil(Math.sqrt(totalPixels));
      return { pixels: pngData, width: side, height: side };
    }

    // Parse chunks
    let offset = 8;
    let width = 0, height = 0, bitDepth = 0, colorType = 0;
    let palette: Uint8Array | null = null;
    const idatChunks: Uint8Array[] = [];

    while (offset + 8 <= pngData.length) {
      const chunkLen = (pngData[offset] << 24) | (pngData[offset + 1] << 16) |
        (pngData[offset + 2] << 8) | pngData[offset + 3];
      const chunkType = String.fromCharCode(
        pngData[offset + 4],
        pngData[offset + 5],
        pngData[offset + 6],
        pngData[offset + 7],
      );
      const dataStart = offset + 8;

      if (chunkType === "IHDR") {
        width = (pngData[dataStart] << 24) | (pngData[dataStart + 1] << 16) |
          (pngData[dataStart + 2] << 8) | pngData[dataStart + 3];
        height = (pngData[dataStart + 4] << 24) | (pngData[dataStart + 5] << 16) |
          (pngData[dataStart + 6] << 8) | pngData[dataStart + 7];
        bitDepth = pngData[dataStart + 8];
        colorType = pngData[dataStart + 9];
      } else if (chunkType === "PLTE") {
        palette = pngData.slice(dataStart, dataStart + chunkLen);
      } else if (chunkType === "IDAT") {
        idatChunks.push(pngData.slice(dataStart, dataStart + chunkLen));
      } else if (chunkType === "IEND") {
        break;
      }
      offset = dataStart + chunkLen + 4; // +4 for CRC
    }

    if (width === 0 || height === 0 || idatChunks.length === 0) return empty;

    // Concatenate and decompress IDAT
    const totalLen = idatChunks.reduce((s, c) => s + c.length, 0);
    const compressed = new Uint8Array(totalLen);
    let pos = 0;
    for (const chunk of idatChunks) {
      compressed.set(chunk, pos);
      pos += chunk.length;
    }

    let decompressed: Uint8Array;
    try {
      const ds = new DecompressionStream("deflate");
      const writer = ds.writable.getWriter();
      const reader = ds.readable.getReader();
      const writeP = writer.write(compressed).then(() => writer.close());
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      await writeP;
      const dLen = chunks.reduce((s, c) => s + c.length, 0);
      decompressed = new Uint8Array(dLen);
      let dPos = 0;
      for (const c of chunks) {
        decompressed.set(c, dPos);
        dPos += c.length;
      }
    } catch {
      return empty;
    }

    // Bytes per pixel
    const bpp = this.pngBytesPerPixel(colorType, bitDepth);
    const scanlineBytes = width * bpp;

    // Apply scanline filters
    const filtered = new Uint8Array(height * scanlineBytes);
    const stride = scanlineBytes + 1;

    for (let y = 0; y < height; y++) {
      const filterByte = decompressed[y * stride];
      const srcOff = y * stride + 1;
      const dstOff = y * scanlineBytes;
      const priorOff = (y - 1) * scanlineBytes;

      for (let x = 0; x < scanlineBytes; x++) {
        const raw = decompressed[srcOff + x];
        const a = x >= bpp ? filtered[dstOff + x - bpp] : 0;
        const b = y > 0 ? filtered[priorOff + x] : 0;
        const c = (x >= bpp && y > 0) ? filtered[priorOff + x - bpp] : 0;

        let v: number;
        switch (filterByte) {
          case 0:
            v = raw;
            break;
          case 1:
            v = (raw + a) & 0xFF;
            break;
          case 2:
            v = (raw + b) & 0xFF;
            break;
          case 3:
            v = (raw + Math.floor((a + b) / 2)) & 0xFF;
            break;
          case 4: {
            const p = a + b - c;
            const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
            const pr = (pa <= pb && pa <= pc) ? a : (pb <= pc) ? b : c;
            v = (raw + pr) & 0xFF;
            break;
          }
          default:
            v = raw;
        }
        filtered[dstOff + x] = v;
      }
    }

    // Convert to RGBA
    const rgba = new Uint8Array(width * height * 4);
    const totalPixels = width * height;

    switch (colorType) {
      case 0: // Grayscale
        for (let i = 0; i < totalPixels; i++) {
          const g = filtered[i];
          rgba[i * 4] = g;
          rgba[i * 4 + 1] = g;
          rgba[i * 4 + 2] = g;
          rgba[i * 4 + 3] = 255;
        }
        break;
      case 2: // RGB
        for (let i = 0; i < totalPixels; i++) {
          rgba[i * 4] = filtered[i * 3];
          rgba[i * 4 + 1] = filtered[i * 3 + 1];
          rgba[i * 4 + 2] = filtered[i * 3 + 2];
          rgba[i * 4 + 3] = 255;
        }
        break;
      case 3: // Indexed
        if (palette) {
          for (let i = 0; i < totalPixels; i++) {
            const idx = filtered[i] * 3;
            rgba[i * 4] = palette[idx];
            rgba[i * 4 + 1] = palette[idx + 1];
            rgba[i * 4 + 2] = palette[idx + 2];
            rgba[i * 4 + 3] = 255;
          }
        }
        break;
      case 4: // Grayscale + Alpha
        for (let i = 0; i < totalPixels; i++) {
          const g = filtered[i * 2];
          rgba[i * 4] = g;
          rgba[i * 4 + 1] = g;
          rgba[i * 4 + 2] = g;
          rgba[i * 4 + 3] = filtered[i * 2 + 1];
        }
        break;
      case 6: // RGBA
        rgba.set(filtered.slice(0, totalPixels * 4));
        break;
    }

    return { pixels: rgba, width, height };
  }

  /**
   * Bytes per pixel for PNG color type
   */
  private pngBytesPerPixel(colorType: number, bitDepth: number): number {
    const cb = Math.max(1, bitDepth / 8);
    switch (colorType) {
      case 0:
        return cb;
      case 2:
        return cb * 3;
      case 3:
        return 1;
      case 4:
        return cb * 2;
      case 6:
        return cb * 4;
      default:
        return cb * 4;
    }
  }
}

/**
 * Create a VisualTester instance for a page
 */
export function createVisualTester(page: BrowserPage): VisualTester {
  return new VisualTester(page);
}

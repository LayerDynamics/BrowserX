/**
 * PDF Generator API
 *
 * Provides PDF generation capabilities for browser content.
 * Wraps the core PDF generator with additional features and convenience methods.
 */

// Declare Deno global for file operations
declare const Deno: {
  writeFile(path: string, data: Uint8Array): Promise<void>;
};

import type { BrowserPage } from "./BrowserPage.ts";
import type { PDFOptions as CorePDFOptions } from "../engine/rendering/pdf/PDFGenerator.ts";

/**
 * PDF page format options
 */
export type PDFFormat = "A4" | "Letter" | "Legal" | "A3" | "A5" | "Tabloid";

/**
 * PDF page orientation
 */
export type PDFOrientation = "portrait" | "landscape";

/**
 * PDF margin options (in pixels or percentage)
 */
export interface PDFMargins {
  top?: number | string;
  right?: number | string;
  bottom?: number | string;
  left?: number | string;
}

/**
 * PDF generation options
 */
export interface PDFOptions {
  /** Page format */
  format?: PDFFormat;
  /** Page orientation */
  orientation?: PDFOrientation;
  /** Page margins */
  margin?: PDFMargins;
  /** Scale factor (0.1 to 2.0) */
  scale?: number;
  /** Print background colors and images */
  printBackground?: boolean;
  /** Display header and footer */
  displayHeaderFooter?: boolean;
  /** Header template (HTML) */
  headerTemplate?: string;
  /** Footer template (HTML) */
  footerTemplate?: string;
  /** Page ranges to print (e.g., "1-5", "1,3,5-9") */
  pageRanges?: string;
  /** Prefer CSS page size over format */
  preferCSSPageSize?: boolean;
  /** Custom page width (overrides format) */
  width?: number | string;
  /** Custom page height (overrides format) */
  height?: number | string;
  /** Wait for network idle before generating */
  waitForNetworkIdle?: boolean;
  /** Wait for selector before generating */
  waitForSelector?: string;
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * PDF generation result
 */
export interface PDFResult {
  /** PDF data as bytes */
  data: Uint8Array;
  /** Number of pages generated */
  pageCount: number;
  /** Total file size in bytes */
  size: number;
  /** Generation time in milliseconds */
  generationTimeMs: number;
}

/**
 * Page dimensions in points (1 point = 1/72 inch)
 */
export const PAGE_DIMENSIONS: Record<PDFFormat, { width: number; height: number }> = {
  A3: { width: 841.89, height: 1190.55 },
  A4: { width: 595.28, height: 841.89 },
  A5: { width: 419.53, height: 595.28 },
  Letter: { width: 612, height: 792 },
  Legal: { width: 612, height: 1008 },
  Tabloid: { width: 792, height: 1224 },
};

/**
 * PDF Generator
 *
 * Generates PDF documents from browser content.
 */
export class PDFGeneratorAPI {
  private page: BrowserPage;
  private defaultOptions: PDFOptions;

  constructor(page: BrowserPage, defaultOptions: PDFOptions = {}) {
    this.page = page;
    this.defaultOptions = {
      format: "A4",
      orientation: "portrait",
      margin: { top: 72, right: 72, bottom: 72, left: 72 },
      scale: 1.0,
      printBackground: true,
      displayHeaderFooter: false,
      headerTemplate: "",
      footerTemplate: "",
      preferCSSPageSize: false,
      waitForNetworkIdle: false,
      timeout: 30000,
      ...defaultOptions,
    };
  }

  /**
   * Generate PDF from current page
   */
  async generate(options?: PDFOptions): Promise<PDFResult> {
    const startTime = performance.now();
    const mergedOptions = { ...this.defaultOptions, ...options };

    // Wait for conditions if specified
    if (mergedOptions.waitForSelector) {
      await this.page.wait({
        type: "selector",
        selector: mergedOptions.waitForSelector,
        timeout: mergedOptions.timeout,
      });
    }

    if (mergedOptions.waitForNetworkIdle) {
      // Wait for network to be idle (simplified - just wait a bit)
      await this.page.wait({ type: "time", duration: 500 });
    }

    // Convert options to core PDF options
    const coreOptions = this.toCoreOptions(mergedOptions);

    // Generate PDF using BrowserPage's pdf method
    const pdfData = await this.page.pdf(coreOptions);

    const generationTimeMs = performance.now() - startTime;

    return {
      data: pdfData,
      pageCount: this.estimatePageCount(pdfData),
      size: pdfData.byteLength,
      generationTimeMs,
    };
  }

  /**
   * Generate PDF from URL
   */
  async generateFromURL(url: string, options?: PDFOptions): Promise<PDFResult> {
    await this.page.navigate(url, { waitFor: "load" });
    return this.generate(options);
  }

  /**
   * Generate PDF with custom header and footer
   */
  async generateWithHeaderFooter(
    headerHTML: string,
    footerHTML: string,
    options?: PDFOptions,
  ): Promise<PDFResult> {
    return this.generate({
      ...options,
      displayHeaderFooter: true,
      headerTemplate: headerHTML,
      footerTemplate: footerHTML,
    });
  }

  /**
   * Generate PDF in specific format
   */
  async generateInFormat(format: PDFFormat, options?: PDFOptions): Promise<PDFResult> {
    return this.generate({ ...options, format });
  }

  /**
   * Generate landscape PDF
   */
  async generateLandscape(options?: PDFOptions): Promise<PDFResult> {
    return this.generate({ ...options, orientation: "landscape" });
  }

  /**
   * Generate PDF with no margins
   */
  async generateFullPage(options?: PDFOptions): Promise<PDFResult> {
    return this.generate({
      ...options,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
  }

  /**
   * Generate PDF optimized for printing
   */
  async generateForPrint(options?: PDFOptions): Promise<PDFResult> {
    return this.generate({
      ...options,
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `
                <div style="font-size: 9px; width: 100%; text-align: center;">
                    <span class="title"></span>
                </div>
            `,
      footerTemplate: `
                <div style="font-size: 9px; width: 100%; text-align: center;">
                    <span class="pageNumber"></span> / <span class="totalPages"></span>
                </div>
            `,
    });
  }

  /**
   * Get PDF as base64 string
   */
  async generateBase64(options?: PDFOptions): Promise<string> {
    const result = await this.generate(options);
    return this.arrayBufferToBase64(result.data);
  }

  /**
   * Get PDF as data URL
   */
  async generateDataURL(options?: PDFOptions): Promise<string> {
    const base64 = await this.generateBase64(options);
    return `data:application/pdf;base64,${base64}`;
  }

  /**
   * Generate PDF and save to file (returns file path)
   */
  async generateToFile(filePath: string, options?: PDFOptions): Promise<string> {
    const result = await this.generate(options);
    await Deno.writeFile(filePath, result.data);
    return filePath;
  }

  /**
   * Get page dimensions for a format
   */
  getPageDimensions(
    format: PDFFormat,
    orientation: PDFOrientation = "portrait",
  ): { width: number; height: number } {
    const dims = PAGE_DIMENSIONS[format];
    if (orientation === "landscape") {
      return { width: dims.height, height: dims.width };
    }
    return dims;
  }

  /**
   * Set default options
   */
  setDefaultOptions(options: Partial<PDFOptions>): void {
    this.defaultOptions = { ...this.defaultOptions, ...options };
  }

  /**
   * Get current default options
   */
  getDefaultOptions(): PDFOptions {
    return { ...this.defaultOptions };
  }

  /**
   * Convert API options to core PDF options
   */
  private toCoreOptions(options: PDFOptions): CorePDFOptions {
    const margins = this.parseMargins(options.margin);

    // Map format (A5 and Tabloid not supported in core, use A4/Letter)
    let format: "A4" | "Letter" | "Legal" | "A3" = options.format as
      | "A4"
      | "Letter"
      | "Legal"
      | "A3";
    if (options.format === "A5") format = "A4";
    if (options.format === "Tabloid") format = "Letter";

    return {
      format,
      orientation: options.orientation,
      margin: margins,
      scale: options.scale,
      printBackground: options.printBackground,
      displayHeaderFooter: options.displayHeaderFooter,
      headerTemplate: options.headerTemplate,
      footerTemplate: options.footerTemplate,
    };
  }

  /**
   * Parse margin values (convert strings like "1in" to numbers)
   */
  private parseMargins(
    margins?: PDFMargins,
  ): { top: number; right: number; bottom: number; left: number } {
    const defaultMargin = 72; // 1 inch in points

    if (!margins) {
      return {
        top: defaultMargin,
        right: defaultMargin,
        bottom: defaultMargin,
        left: defaultMargin,
      };
    }

    return {
      top: this.parseMarginValue(margins.top) ?? defaultMargin,
      right: this.parseMarginValue(margins.right) ?? defaultMargin,
      bottom: this.parseMarginValue(margins.bottom) ?? defaultMargin,
      left: this.parseMarginValue(margins.left) ?? defaultMargin,
    };
  }

  /**
   * Parse a single margin value
   */
  private parseMarginValue(value?: number | string): number | undefined {
    if (value === undefined) return undefined;
    if (typeof value === "number") return value;

    // Parse string values like "1in", "2.5cm", "10mm", "72pt", "10%"
    const match = value.match(/^([\d.]+)(in|cm|mm|pt|%)?$/);
    if (!match) return undefined;

    const num = parseFloat(match[1]);
    const unit = match[2] || "pt";

    switch (unit) {
      case "in":
        return num * 72; // 72 points per inch
      case "cm":
        return num * 28.35; // 28.35 points per cm
      case "mm":
        return num * 2.835; // 2.835 points per mm
      case "pt":
        return num;
      case "%":
        // Percentage of A4 page width (595.28 points)
        return (num / 100) * 595.28;
      default:
        return num;
    }
  }

  /**
   * Estimate page count from PDF data
   */
  private estimatePageCount(pdfData: Uint8Array): number {
    // Simple estimation by counting "/Page" occurrences (not /Pages)
    const text = new TextDecoder().decode(pdfData);
    const matches = text.match(/\/Type\s*\/Page[^s]/g);
    return matches ? matches.length : 1;
  }

  /**
   * Convert array buffer to base64
   */
  private arrayBufferToBase64(buffer: Uint8Array): string {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}

/**
 * Create a PDF generator instance
 */
export function createPDFGenerator(page: BrowserPage, options?: PDFOptions): PDFGeneratorAPI {
  return new PDFGeneratorAPI(page, options);
}

/**
 * PDF Template builder for creating reusable PDF templates
 */
export class PDFTemplate {
  private options: PDFOptions;
  private headerTemplate: string = "";
  private footerTemplate: string = "";
  private styles: string = "";

  constructor(options?: PDFOptions) {
    this.options = options || {};
  }

  /**
   * Set header template
   */
  setHeader(html: string): this {
    this.headerTemplate = html;
    return this;
  }

  /**
   * Set footer template
   */
  setFooter(html: string): this {
    this.footerTemplate = html;
    return this;
  }

  /**
   * Set custom styles to inject
   */
  setStyles(css: string): this {
    this.styles = css;
    return this;
  }

  /**
   * Set page format
   */
  setFormat(format: PDFFormat): this {
    this.options.format = format;
    return this;
  }

  /**
   * Set orientation
   */
  setOrientation(orientation: PDFOrientation): this {
    this.options.orientation = orientation;
    return this;
  }

  /**
   * Set margins
   */
  setMargins(margins: PDFMargins): this {
    this.options.margin = margins;
    return this;
  }

  /**
   * Set scale
   */
  setScale(scale: number): this {
    this.options.scale = scale;
    return this;
  }

  /**
   * Get styles
   */
  getStyles(): string {
    return this.styles;
  }

  /**
   * Build the PDF options
   */
  build(): PDFOptions {
    // Inject styles into header template if styles are defined
    let headerTemplate = this.headerTemplate;
    if (this.styles) {
      const styleTag = `<style>${this.styles}</style>`;
      headerTemplate = styleTag + headerTemplate;
    }

    return {
      ...this.options,
      displayHeaderFooter: !!(this.headerTemplate || this.footerTemplate),
      headerTemplate,
      footerTemplate: this.footerTemplate,
    };
  }

  /**
   * Generate PDF using this template
   */
  async generate(page: BrowserPage): Promise<PDFResult> {
    const generator = createPDFGenerator(page, this.build());
    return generator.generate();
  }
}

/**
 * Create a PDF template builder
 */
export function createPDFTemplate(options?: PDFOptions): PDFTemplate {
  return new PDFTemplate(options);
}

/**
 * Common PDF templates
 */
export const CommonTemplates = {
  /**
   * Standard document template with header and footer
   */
  document(): PDFTemplate {
    return createPDFTemplate()
      .setFormat("A4")
      .setOrientation("portrait")
      .setMargins({ top: 72, right: 72, bottom: 72, left: 72 })
      .setHeader(`
                <div style="font-size: 10px; width: 100%; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 10px;">
                    <span class="title" style="float: left;"></span>
                    <span class="date" style="float: right;"></span>
                </div>
            `)
      .setFooter(`
                <div style="font-size: 9px; width: 100%; border-top: 1px solid #ccc; padding-top: 5px; text-align: center;">
                    Page <span class="pageNumber"></span> of <span class="totalPages"></span>
                </div>
            `);
  },

  /**
   * Report template
   */
  report(): PDFTemplate {
    return createPDFTemplate()
      .setFormat("A4")
      .setOrientation("portrait")
      .setMargins({ top: 100, right: 50, bottom: 80, left: 50 })
      .setHeader(`
                <div style="font-size: 12px; width: 100%; text-align: center; margin-bottom: 20px;">
                    <strong><span class="title"></span></strong>
                </div>
            `)
      .setFooter(`
                <div style="font-size: 9px; width: 100%; text-align: center;">
                    <span class="pageNumber"></span> / <span class="totalPages"></span>
                    <br/>
                    <span class="date"></span>
                </div>
            `);
  },

  /**
   * Invoice template
   */
  invoice(): PDFTemplate {
    return createPDFTemplate()
      .setFormat("Letter")
      .setOrientation("portrait")
      .setMargins({ top: 50, right: 50, bottom: 100, left: 50 });
  },

  /**
   * Presentation/slides template
   */
  slides(): PDFTemplate {
    return createPDFTemplate()
      .setFormat("Letter")
      .setOrientation("landscape")
      .setMargins({ top: 36, right: 36, bottom: 36, left: 36 });
  },

  /**
   * Full page (no margins)
   */
  fullPage(): PDFTemplate {
    return createPDFTemplate()
      .setMargins({ top: 0, right: 0, bottom: 0, left: 0 });
  },
};

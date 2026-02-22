/**
 * PDF Controller
 *
 * Bridges the query engine with browser PDF generation capabilities.
 * Provides PDF generation and configuration for query execution.
 */

// Declare Deno global for file operations
declare const Deno: {
    writeFile(path: string, data: Uint8Array): Promise<void>;
};

import type { BrowserPage } from "@browserx/browser";
import {
    PDFGeneratorAPI,
    createPDFGenerator,
    PDFTemplate,
    createPDFTemplate,
    CommonTemplates,
    PAGE_DIMENSIONS,
    type PDFOptions,
    type PDFResult,
    type PDFFormat,
    type PDFOrientation,
    type PDFMargins,
} from "@browserx/browser";
import { getCurrentBrowserController } from "./browser-context.ts";

/**
 * PDF generation batch options
 */
export interface PDFBatchOptions {
    /** URLs to generate PDFs from */
    urls: string[];
    /** Output directory for PDFs */
    outputDir?: string;
    /** File name pattern (use {index}, {url} placeholders) */
    fileNamePattern?: string;
    /** Common PDF options for all pages */
    options?: PDFOptions;
    /** Delay between PDF generations (ms) */
    delayBetween?: number;
}

/**
 * PDF batch result
 */
export interface PDFBatchResult {
    /** Successfully generated PDFs */
    successful: Array<{
        url: string;
        filePath?: string;
        result: PDFResult;
    }>;
    /** Failed PDF generations */
    failed: Array<{
        url: string;
        error: string;
    }>;
    /** Total generation time */
    totalTimeMs: number;
}

/**
 * PDF merge options
 */
export interface PDFMergeOptions {
    /** PDF data to merge */
    pdfs: Uint8Array[];
    /** Output file path (optional) */
    outputPath?: string;
}

/**
 * PDF Controller for query engine integration
 */
export class PDFController {
    private generator: PDFGeneratorAPI | null = null;
    private template: PDFTemplate | null = null;

    /**
     * Get or create PDFGenerator instance
     */
    private async getGenerator(): Promise<PDFGeneratorAPI> {
        if (this.generator) {
            return this.generator;
        }

        const browserController = getCurrentBrowserController();
        if (!browserController) {
            throw new Error("Browser context not initialized. Navigate to a page first.");
        }

        const page = browserController.getCurrentPage();
        if (!page) {
            throw new Error("No page available in browser context.");
        }

        this.generator = createPDFGenerator(page as unknown as BrowserPage);
        return this.generator;
    }

    /**
     * Generate PDF from current page
     */
    async generate(options?: PDFOptions): Promise<PDFResult> {
        const generator = await this.getGenerator();
        return generator.generate(options);
    }

    /**
     * Generate PDF from URL
     */
    async generateFromURL(url: string, options?: PDFOptions): Promise<PDFResult> {
        const generator = await this.getGenerator();
        return generator.generateFromURL(url, options);
    }

    /**
     * Generate PDF with header and footer
     */
    async generateWithHeaderFooter(
        headerHTML: string,
        footerHTML: string,
        options?: PDFOptions,
    ): Promise<PDFResult> {
        const generator = await this.getGenerator();
        return generator.generateWithHeaderFooter(headerHTML, footerHTML, options);
    }

    /**
     * Generate PDF in specific format
     */
    async generateInFormat(format: PDFFormat, options?: PDFOptions): Promise<PDFResult> {
        const generator = await this.getGenerator();
        return generator.generateInFormat(format, options);
    }

    /**
     * Generate landscape PDF
     */
    async generateLandscape(options?: PDFOptions): Promise<PDFResult> {
        const generator = await this.getGenerator();
        return generator.generateLandscape(options);
    }

    /**
     * Generate full page PDF (no margins)
     */
    async generateFullPage(options?: PDFOptions): Promise<PDFResult> {
        const generator = await this.getGenerator();
        return generator.generateFullPage(options);
    }

    /**
     * Generate PDF optimized for printing
     */
    async generateForPrint(options?: PDFOptions): Promise<PDFResult> {
        const generator = await this.getGenerator();
        return generator.generateForPrint(options);
    }

    /**
     * Generate PDF as base64 string
     */
    async generateBase64(options?: PDFOptions): Promise<string> {
        const generator = await this.getGenerator();
        return generator.generateBase64(options);
    }

    /**
     * Generate PDF as data URL
     */
    async generateDataURL(options?: PDFOptions): Promise<string> {
        const generator = await this.getGenerator();
        return generator.generateDataURL(options);
    }

    /**
     * Generate PDF and save to file
     */
    async saveToFile(filePath: string, options?: PDFOptions): Promise<string> {
        const generator = await this.getGenerator();
        return generator.generateToFile(filePath, options);
    }

    /**
     * Generate PDFs from multiple URLs
     */
    async generateBatch(batchOptions: PDFBatchOptions): Promise<PDFBatchResult> {
        const startTime = performance.now();
        const generator = await this.getGenerator();

        const result: PDFBatchResult = {
            successful: [],
            failed: [],
            totalTimeMs: 0,
        };

        for (let i = 0; i < batchOptions.urls.length; i++) {
            const url = batchOptions.urls[i];

            try {
                const pdfResult = await generator.generateFromURL(url, batchOptions.options);

                let filePath: string | undefined;
                if (batchOptions.outputDir) {
                    // Generate file path
                    const fileName = this.generateFileName(
                        batchOptions.fileNamePattern || "{index}.pdf",
                        i,
                        url,
                    );
                    filePath = `${batchOptions.outputDir}/${fileName}`;
                    await Deno.writeFile(filePath, pdfResult.data);
                }

                result.successful.push({ url, filePath, result: pdfResult });

                // Delay between generations
                if (batchOptions.delayBetween && i < batchOptions.urls.length - 1) {
                    await new Promise((resolve) => setTimeout(resolve, batchOptions.delayBetween));
                }
            } catch (error) {
                result.failed.push({
                    url,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }

        result.totalTimeMs = performance.now() - startTime;
        return result;
    }

    /**
     * Generate file name from pattern
     */
    private generateFileName(pattern: string, index: number, url: string): string {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.replace(/[^a-zA-Z0-9]/g, "_");
        const pathname = urlObj.pathname.replace(/[^a-zA-Z0-9]/g, "_") || "index";

        return pattern
            .replace("{index}", String(index + 1).padStart(3, "0"))
            .replace("{url}", `${hostname}${pathname}`)
            .replace("{hostname}", hostname)
            .replace("{timestamp}", Date.now().toString());
    }

    /**
     * Use a predefined template
     */
    useTemplate(template: "document" | "report" | "invoice" | "slides" | "fullPage"): void {
        switch (template) {
            case "document":
                this.template = CommonTemplates.document();
                break;
            case "report":
                this.template = CommonTemplates.report();
                break;
            case "invoice":
                this.template = CommonTemplates.invoice();
                break;
            case "slides":
                this.template = CommonTemplates.slides();
                break;
            case "fullPage":
                this.template = CommonTemplates.fullPage();
                break;
        }
    }

    /**
     * Create a custom template
     */
    createTemplate(options?: PDFOptions): PDFTemplate {
        this.template = createPDFTemplate(options);
        return this.template;
    }

    /**
     * Get current template
     */
    getTemplate(): PDFTemplate | null {
        return this.template;
    }

    /**
     * Generate PDF using current template
     */
    async generateWithTemplate(template?: PDFTemplate): Promise<PDFResult> {
        const templateToUse = template || this.template;
        if (!templateToUse) {
            throw new Error("No template configured. Use useTemplate() or createTemplate() first.");
        }

        const options = templateToUse.build();
        return this.generate(options);
    }

    /**
     * Get page dimensions for a format
     */
    getPageDimensions(format: PDFFormat, orientation: PDFOrientation = "portrait"): { width: number; height: number } {
        const dims = PAGE_DIMENSIONS[format];
        if (!dims) {
            throw new Error(`Unknown format: ${format}`);
        }
        if (orientation === "landscape") {
            return { width: dims.height, height: dims.width };
        }
        return dims;
    }

    /**
     * Get all available formats
     */
    getAvailableFormats(): PDFFormat[] {
        return Object.keys(PAGE_DIMENSIONS) as PDFFormat[];
    }

    /**
     * Configure default options
     */
    async setDefaultOptions(options: Partial<PDFOptions>): Promise<void> {
        const generator = await this.getGenerator();
        generator.setDefaultOptions(options);
    }

    /**
     * Get current default options
     */
    async getDefaultOptions(): Promise<PDFOptions> {
        const generator = await this.getGenerator();
        return generator.getDefaultOptions();
    }

    /**
     * Assert PDF was generated successfully
     */
    async assertPDFGenerated(options?: PDFOptions): Promise<{
        passed: boolean;
        result?: PDFResult;
        error?: string;
    }> {
        try {
            const result = await this.generate(options);
            return {
                passed: result.data.byteLength > 0,
                result,
            };
        } catch (error) {
            return {
                passed: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * Assert PDF size is within limits
     */
    async assertPDFSize(maxSizeBytes: number, options?: PDFOptions): Promise<{
        passed: boolean;
        actualSize: number;
        maxSize: number;
    }> {
        const result = await this.generate(options);
        return {
            passed: result.size <= maxSizeBytes,
            actualSize: result.size,
            maxSize: maxSizeBytes,
        };
    }

    /**
     * Assert PDF page count
     */
    async assertPageCount(expectedCount: number, options?: PDFOptions): Promise<{
        passed: boolean;
        actualCount: number;
        expectedCount: number;
    }> {
        const result = await this.generate(options);
        return {
            passed: result.pageCount === expectedCount,
            actualCount: result.pageCount,
            expectedCount,
        };
    }

    /**
     * Clear the generator instance (for cleanup)
     */
    clearController(): void {
        this.generator = null;
        this.template = null;
    }
}

// Singleton instance
let pdfControllerInstance: PDFController | null = null;

/**
 * Get the PDF controller instance
 */
export function getPDFController(): PDFController {
    if (!pdfControllerInstance) {
        pdfControllerInstance = new PDFController();
    }
    return pdfControllerInstance;
}

/**
 * Clear the PDF controller instance
 */
export function clearPDFController(): void {
    if (pdfControllerInstance) {
        pdfControllerInstance.clearController();
        pdfControllerInstance = null;
    }
}

// Re-export types for convenience
export type {
    PDFOptions,
    PDFResult,
    PDFFormat,
    PDFOrientation,
    PDFMargins,
};

export { PDFTemplate, CommonTemplates, PAGE_DIMENSIONS };

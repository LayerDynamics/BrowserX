/**
 * Scraper Controller
 *
 * Bridges the query engine with browser web scraping capabilities.
 * Provides data extraction and pagination for query execution.
 */

import type { BrowserPage } from "@browserx/browser";
import {
  WebScraper,
  createWebScraper,
  type ExtractionRule,
  type ScrapeConfig,
  type ScrapeResult,
  type TableConfig,
  type ListConfig,
  type ExtractedLink,
  type ExtractedImage,
  type PaginationConfig,
  type PaginatedScrapeResult,
} from "@browserx/browser";
import { getCurrentBrowserController } from "./browser-context.ts";

/**
 * Quick scrape options for simple extractions
 */
export interface QuickScrapeOptions {
  /** CSS selector */
  selector: string;
  /** What to extract */
  extract?: "text" | "html" | "attribute";
  /** Attribute name (when extract is "attribute") */
  attribute?: string;
  /** Whether to extract from all matching elements */
  multiple?: boolean;
  /** Wait for selector before scraping */
  waitFor?: boolean;
  /** Timeout (ms) */
  timeout?: number;
}

/**
 * Scraper Controller for query engine integration
 */
export class ScraperController {
  private scraper: WebScraper | null = null;

  /**
   * Get or create WebScraper instance
   */
  private async getScraper(): Promise<WebScraper> {
    if (this.scraper) {
      return this.scraper;
    }

    const browserController = getCurrentBrowserController();
    if (!browserController) {
      throw new Error("Browser context not initialized. Navigate to a page first.");
    }

    const page = browserController.getCurrentPage();
    if (!page) {
      throw new Error("No page available in browser context.");
    }

    this.scraper = createWebScraper(page as unknown as BrowserPage);
    return this.scraper;
  }

  /**
   * Scrape data using extraction rules
   */
  async scrape<T = Record<string, unknown>>(config: ScrapeConfig): Promise<ScrapeResult<T>> {
    const scraper = await this.getScraper();
    return scraper.scrape<T>(config);
  }

  /**
   * Quick scrape - simple extraction with minimal configuration
   */
  async quickScrape(options: QuickScrapeOptions): Promise<ScrapeResult<string | string[]>> {
    const scraper = await this.getScraper();

    const rule: ExtractionRule = {
      name: "value",
      selector: options.selector,
      extract: options.extract || "text",
      attribute: options.attribute,
      multiple: options.multiple,
    };

    const config: ScrapeConfig = {
      rules: [rule],
      waitForSelector: options.waitFor ? options.selector : undefined,
      timeout: options.timeout,
    };

    const result = await scraper.scrape<{ value: string | string[] }>(config);

    if (result.success) {
      // Handle the case where data could be single object or array
      const dataObj = Array.isArray(result.data) ? result.data[0] : result.data;
      return {
        ...result,
        data: dataObj?.value ?? (options.multiple ? [] : ""),
      };
    }

    return {
      ...result,
      data: options.multiple ? [] : "",
    };
  }

  /**
   * Extract text from an element
   */
  async extractText(selector: string, waitFor?: boolean): Promise<string | null> {
    try {
      const result = await this.quickScrape({
        selector,
        extract: "text",
        waitFor,
      });
      return result.success ? (result.data as string) : null;
    } catch {
      return null;
    }
  }

  /**
   * Extract all text from matching elements
   */
  async extractAllText(selector: string, waitFor?: boolean): Promise<string[]> {
    try {
      const result = await this.quickScrape({
        selector,
        extract: "text",
        multiple: true,
        waitFor,
      });
      return result.success ? (result.data as string[]) : [];
    } catch {
      return [];
    }
  }

  /**
   * Extract an attribute from an element
   */
  async extractAttribute(selector: string, attribute: string, waitFor?: boolean): Promise<string | null> {
    try {
      const result = await this.quickScrape({
        selector,
        extract: "attribute",
        attribute,
        waitFor,
      });
      return result.success ? (result.data as string) : null;
    } catch {
      return null;
    }
  }

  /**
   * Extract HTML content from an element
   */
  async extractHtml(selector: string, waitFor?: boolean): Promise<string | null> {
    try {
      const result = await this.quickScrape({
        selector,
        extract: "html",
        waitFor,
      });
      return result.success ? (result.data as string) : null;
    } catch {
      return null;
    }
  }

  /**
   * Extract a table from the page
   */
  async extractTable(config: TableConfig): Promise<ScrapeResult<Record<string, string>[]>> {
    const scraper = await this.getScraper();
    return scraper.extractTable(config);
  }

  /**
   * Extract a table with simple configuration
   */
  async extractTableSimple(
    selector: string,
    options: {
      firstRowAsHeaders?: boolean;
      headers?: string[];
      maxRows?: number;
    } = {}
  ): Promise<Record<string, string>[]> {
    const result = await this.extractTable({
      selector,
      firstRowAsHeaders: options.firstRowAsHeaders ?? true,
      headers: options.headers,
      maxRows: options.maxRows,
    });
    if (!result.success) return [];
    // Handle both single array and nested array cases
    const data = result.data;
    if (Array.isArray(data) && data.length > 0 && Array.isArray(data[0])) {
      // Nested array - flatten first level
      return (data as Record<string, string>[][]).flat();
    }
    return data as Record<string, string>[];
  }

  /**
   * Extract a list from the page
   */
  async extractList<T = Record<string, unknown>>(config: ListConfig): Promise<ScrapeResult<T[]>> {
    const scraper = await this.getScraper();
    return scraper.extractList<T>(config);
  }

  /**
   * Extract a simple list of text items
   */
  async extractListSimple(selector: string, itemSelector?: string): Promise<string[]> {
    const result = await this.extractList<{ text: string }>({
      selector,
      itemSelector,
    });
    if (!result.success) return [];
    // Handle both single array and nested array cases
    const data = result.data;
    const items = Array.isArray(data) && data.length > 0 && Array.isArray(data[0])
      ? (data as { text: string }[][]).flat()
      : (data as { text: string }[]);
    return items.map((item: { text: string }) => item.text);
  }

  /**
   * Extract all links from the page
   */
  async extractLinks(selector?: string): Promise<ScrapeResult<ExtractedLink[]>> {
    const scraper = await this.getScraper();
    return scraper.extractLinks(selector);
  }

  /**
   * Extract just the URLs from all links
   */
  async extractLinkUrls(selector?: string): Promise<string[]> {
    const result = await this.extractLinks(selector);
    if (!result.success) return [];
    // Handle both single array and nested array cases
    const data = result.data;
    const links = Array.isArray(data) && data.length > 0 && Array.isArray(data[0])
      ? (data as ExtractedLink[][]).flat()
      : (data as ExtractedLink[]);
    return links.map((link: ExtractedLink) => link.href);
  }

  /**
   * Extract all images from the page
   */
  async extractImages(selector?: string): Promise<ScrapeResult<ExtractedImage[]>> {
    const scraper = await this.getScraper();
    return scraper.extractImages(selector);
  }

  /**
   * Extract just the image URLs
   */
  async extractImageUrls(selector?: string): Promise<string[]> {
    const result = await this.extractImages(selector);
    if (!result.success) return [];
    // Handle both single array and nested array cases
    const data = result.data;
    const images = Array.isArray(data) && data.length > 0 && Array.isArray(data[0])
      ? (data as ExtractedImage[][]).flat()
      : (data as ExtractedImage[]);
    return images.map((img: ExtractedImage) => img.src);
  }

  /**
   * Scrape multiple pages with pagination
   */
  async scrapePaginated<T = Record<string, unknown>>(
    scrapeConfig: ScrapeConfig,
    paginationConfig: PaginationConfig
  ): Promise<PaginatedScrapeResult<T>> {
    const scraper = await this.getScraper();
    return scraper.scrapePaginated<T>(scrapeConfig, paginationConfig);
  }

  /**
   * Wait for dynamic content to load
   */
  async waitForContent(selector: string, timeout?: number): Promise<boolean> {
    const scraper = await this.getScraper();
    return scraper.waitForContent(selector, timeout);
  }

  /**
   * Get the current page URL
   */
  async getCurrentUrl(): Promise<string> {
    const scraper = await this.getScraper();
    return scraper.getCurrentUrl();
  }

  /**
   * Check if an element exists
   */
  async exists(selector: string): Promise<boolean> {
    try {
      const browserController = getCurrentBrowserController();
      if (!browserController) return false;

      const page = browserController.getCurrentPage();
      if (!page) return false;

      const elements = await page.query(selector);
      return elements.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Count matching elements
   */
  async count(selector: string): Promise<number> {
    try {
      const browserController = getCurrentBrowserController();
      if (!browserController) return 0;

      const page = browserController.getCurrentPage();
      if (!page) return 0;

      const elements = await page.query(selector);
      return elements.length;
    } catch {
      return 0;
    }
  }

  /**
   * Clear the scraper instance (for cleanup)
   */
  clear(): void {
    this.scraper = null;
  }
}

// Singleton instance
let scraperControllerInstance: ScraperController | null = null;

/**
 * Get the scraper controller instance
 */
export function getScraperController(): ScraperController {
  if (!scraperControllerInstance) {
    scraperControllerInstance = new ScraperController();
  }
  return scraperControllerInstance;
}

/**
 * Clear the scraper controller instance
 */
export function clearScraperController(): void {
  if (scraperControllerInstance) {
    scraperControllerInstance.clear();
    scraperControllerInstance = null;
  }
}

// Re-export types for convenience
export type {
  ExtractionRule,
  ScrapeConfig,
  ScrapeResult,
  TableConfig,
  ListConfig,
  ExtractedLink,
  ExtractedImage,
  PaginationConfig,
  PaginatedScrapeResult,
};

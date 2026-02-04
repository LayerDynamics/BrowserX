/**
 * Web Scraper API
 *
 * Provides high-level web scraping capabilities for extracting data from pages.
 * Supports CSS selectors, XPath, structured data extraction, and pagination.
 */

import { BrowserPage, DOMElement } from "./BrowserPage.ts";

/**
 * Extraction rule for scraping data
 */
export interface ExtractionRule {
  /** Field name for the extracted data */
  name: string;
  /** CSS selector or XPath expression */
  selector: string;
  /** Selector type */
  selectorType?: "css" | "xpath";
  /** What to extract from the element */
  extract: "text" | "html" | "attribute" | "property" | "count";
  /** Attribute name (when extract is "attribute") */
  attribute?: string;
  /** Property name (when extract is "property") */
  property?: string;
  /** Whether to extract from all matching elements or just the first */
  multiple?: boolean;
  /** Transform function to apply to extracted value */
  transform?: (value: string | string[]) => unknown;
  /** Default value if element not found */
  defaultValue?: unknown;
  /** Whether this field is required */
  required?: boolean;
  /** Nested extraction rules for child elements */
  children?: ExtractionRule[];
}

/**
 * Scraping configuration
 */
export interface ScrapeConfig {
  /** Extraction rules */
  rules: ExtractionRule[];
  /** Root selector (optional, defaults to document) */
  rootSelector?: string;
  /** Root selector type */
  rootSelectorType?: "css" | "xpath";
  /** Whether to extract from all matching root elements */
  multiple?: boolean;
  /** Wait for selector before scraping */
  waitForSelector?: string;
  /** Timeout for waiting (ms) */
  timeout?: number;
}

/**
 * Table extraction configuration
 */
export interface TableConfig {
  /** Table selector */
  selector: string;
  /** Selector type */
  selectorType?: "css" | "xpath";
  /** Header row selector (relative to table) */
  headerSelector?: string;
  /** Data row selector (relative to table) */
  rowSelector?: string;
  /** Cell selector (relative to row) */
  cellSelector?: string;
  /** Whether to use first row as headers */
  firstRowAsHeaders?: boolean;
  /** Custom header names */
  headers?: string[];
  /** Skip first N rows */
  skipRows?: number;
  /** Maximum rows to extract */
  maxRows?: number;
}

/**
 * List extraction configuration
 */
export interface ListConfig {
  /** List container selector */
  selector: string;
  /** Selector type */
  selectorType?: "css" | "xpath";
  /** Item selector (relative to container) */
  itemSelector?: string;
  /** Extraction rules for each item */
  itemRules?: ExtractionRule[];
  /** Maximum items to extract */
  maxItems?: number;
}

/**
 * Link extraction result
 */
export interface ExtractedLink {
  /** Link text */
  text: string;
  /** Link URL (href attribute) */
  href: string;
  /** Link title attribute */
  title: string | null;
  /** Link target attribute */
  target: string | null;
  /** Link rel attribute */
  rel: string | null;
  /** Whether it's an external link */
  isExternal: boolean;
}

/**
 * Image extraction result
 */
export interface ExtractedImage {
  /** Image source URL */
  src: string;
  /** Alternative text */
  alt: string | null;
  /** Image title */
  title: string | null;
  /** Image width */
  width: string | null;
  /** Image height */
  height: string | null;
  /** Loading attribute */
  loading: string | null;
}

/**
 * Pagination configuration
 */
export interface PaginationConfig {
  /** Next page button/link selector */
  nextSelector: string;
  /** Selector type */
  selectorType?: "css" | "xpath";
  /** Maximum pages to scrape */
  maxPages?: number;
  /** Delay between pages (ms) */
  delayBetweenPages?: number;
  /** Wait for selector after page load */
  waitForSelector?: string;
  /** Timeout for page loads (ms) */
  timeout?: number;
  /** Stop condition - selector that indicates last page */
  stopSelector?: string;
  /** Stop condition - URL pattern that indicates last page */
  stopUrlPattern?: RegExp;
}

/**
 * Scrape result
 */
export interface ScrapeResult<T = Record<string, unknown>> {
  /** Whether scraping was successful */
  success: boolean;
  /** Extracted data */
  data: T | T[];
  /** Error message if failed */
  error?: string;
  /** URL scraped */
  url: string;
  /** Timestamp */
  timestamp: Date;
  /** Number of items extracted */
  itemCount: number;
}

/**
 * Paginated scrape result
 */
export interface PaginatedScrapeResult<T = Record<string, unknown>> {
  /** Whether scraping was successful */
  success: boolean;
  /** All extracted data */
  data: T[];
  /** Number of pages scraped */
  pageCount: number;
  /** Errors by page */
  errors: Map<number, string>;
  /** URLs scraped */
  urls: string[];
  /** Timestamp */
  timestamp: Date;
}

/**
 * Web Scraper class
 */
export class WebScraper {
  private page: BrowserPage;

  constructor(page: BrowserPage) {
    this.page = page;
  }

  /**
   * Scrape data from the current page using extraction rules
   */
  async scrape<T = Record<string, unknown>>(config: ScrapeConfig): Promise<ScrapeResult<T>> {
    const url = this.page.getCurrentURL() || "";
    const timestamp = new Date();

    try {
      // Wait for selector if specified
      if (config.waitForSelector) {
        await this.page.wait({
          type: "selector",
          selector: config.waitForSelector,
          timeout: config.timeout || 30000,
        });
      }

      // Get root element(s)
      let rootElements: DOMElement[];
      if (config.rootSelector) {
        rootElements = await this.page.query(config.rootSelector, config.rootSelectorType || "css");
      } else {
        // Use entire page - query for html element as root
        rootElements = await this.page.query("html");
      }

      if (rootElements.length === 0) {
        return {
          success: false,
          data: (config.multiple ? [] : {}) as T | T[],
          error: "No root elements found",
          url,
          timestamp,
          itemCount: 0,
        };
      }

      // Extract data
      if (config.multiple) {
        const results: Record<string, unknown>[] = [];
        for (const root of rootElements) {
          const item = await this.extractFromElement(root, config.rules);
          results.push(item);
        }
        return {
          success: true,
          data: results as T[],
          url,
          timestamp,
          itemCount: results.length,
        };
      } else {
        const data = await this.extractFromElement(rootElements[0], config.rules);
        return {
          success: true,
          data: data as T,
          url,
          timestamp,
          itemCount: 1,
        };
      }
    } catch (error) {
      return {
        success: false,
        data: (config.multiple ? [] : {}) as T | T[],
        error: error instanceof Error ? error.message : String(error),
        url,
        timestamp,
        itemCount: 0,
      };
    }
  }

  /**
   * Extract data from a single element using rules
   */
  private async extractFromElement(
    element: DOMElement,
    rules: ExtractionRule[]
  ): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {};

    for (const rule of rules) {
      try {
        const value = await this.extractByRule(element, rule);
        result[rule.name] = value;
      } catch (error) {
        if (rule.required) {
          throw error;
        }
        result[rule.name] = rule.defaultValue ?? null;
      }
    }

    return result;
  }

  /**
   * Extract value by a single rule
   */
  private async extractByRule(
    rootElement: DOMElement,
    rule: ExtractionRule
  ): Promise<unknown> {
    // Query elements within the root context
    // Use rootElement to validate context and filter appropriately
    const elements = await this.page.query(rule.selector, rule.selectorType || "css");

    // Filter elements that are within the root element context
    // This ensures scoped extraction when a root selector is specified
    const rootTagName = await rootElement.getProperty("tagName") as string | null;
    const rootTag = rootTagName?.toLowerCase() || "html";
    const filteredElements = rootTag === "html"
      ? elements
      : elements.filter(el => {
          // Check if the element is contained within the root element
          const root = rootElement.getInternalElement();
          return root.contains(el.getInternalElement());
        });

    if (filteredElements.length === 0) {
      if (rule.required) {
        throw new Error(`Required element not found: ${rule.selector}`);
      }
      return rule.defaultValue ?? (rule.multiple ? [] : null);
    }

    const targetElements = rule.multiple ? filteredElements : [filteredElements[0]];
    const values: (string | Record<string, unknown>)[] = [];

    for (const element of targetElements) {
      let value: string | Record<string, unknown>;

      // Handle nested children
      if (rule.children && rule.children.length > 0) {
        value = await this.extractFromElement(element, rule.children);
      } else {
        // Extract based on type
        switch (rule.extract) {
          case "text":
            value = await element.getText();
            break;
          case "html":
            value = await element.getProperty("innerHTML") as string || "";
            break;
          case "attribute":
            value = await element.getAttribute(rule.attribute || "") || "";
            break;
          case "property":
            value = String(await element.getProperty(rule.property || "") || "");
            break;
          case "count":
            value = String(elements.length);
            break;
          default:
            value = await element.getText();
        }
      }

      // Apply transform if provided
      if (rule.transform && typeof value === "string") {
        value = rule.transform(value) as string;
      }

      values.push(value);
    }

    return rule.multiple ? values : values[0];
  }

  /**
   * Extract a table from the page
   */
  async extractTable(config: TableConfig): Promise<ScrapeResult<Record<string, string>[]>> {
    const url = this.page.getCurrentURL() || "";
    const timestamp = new Date();

    try {
      // Find the table
      const tables = await this.page.query(config.selector, config.selectorType || "css");
      if (tables.length === 0) {
        return {
          success: false,
          data: [],
          error: "Table not found",
          url,
          timestamp,
          itemCount: 0,
        };
      }

      const table = tables[0];
      // Validate that we have a table element
      const tableTagName = await table.getProperty("tagName") as string | null;
      const tableTag = tableTagName?.toLowerCase();
      if (tableTag && tableTag !== "table") {
        // Log warning but continue - selector might be targeting a table-like structure
        console.warn(`Expected table element but found: ${tableTag}`);
      }

      // Get headers
      let headers: string[] = [];
      if (config.headers) {
        headers = config.headers;
      } else if (config.headerSelector) {
        const headerCells = await this.page.query(`${config.selector} ${config.headerSelector}`);
        for (const cell of headerCells) {
          headers.push(await cell.getText());
        }
      } else if (config.firstRowAsHeaders) {
        const firstRowSelector = config.rowSelector || "tr";
        const firstRowCells = await this.page.query(`${config.selector} ${firstRowSelector}:first-child td, ${config.selector} ${firstRowSelector}:first-child th`);
        for (const cell of firstRowCells) {
          headers.push(await cell.getText());
        }
      }

      // Get data rows
      const rowSelector = config.rowSelector || "tr";
      const cellSelector = config.cellSelector || "td";
      const skipRows = config.skipRows || (config.firstRowAsHeaders ? 1 : 0);

      const rows = await this.page.query(`${config.selector} ${rowSelector}`);
      const data: Record<string, string>[] = [];

      let rowCount = 0;
      for (let i = skipRows; i < rows.length; i++) {
        if (config.maxRows && rowCount >= config.maxRows) break;

        const row = rows[i];
        // Use the row element to get row-level attributes or validation
        const rowTagName = await row.getProperty("tagName") as string | null;
        const rowTag = rowTagName?.toLowerCase();
        if (rowTag && rowTag !== "tr") {
          // Non-tr row element found, which is fine for custom table structures
          console.debug(`Row ${i} is a ${rowTag} element`);
        }

        const cells = await this.page.query(`${config.selector} ${rowSelector}:nth-child(${i + 1}) ${cellSelector}`);
        const rowData: Record<string, string> = {};

        for (let j = 0; j < cells.length; j++) {
          const header = headers[j] || `column_${j}`;
          rowData[header] = await cells[j].getText();
        }

        data.push(rowData);
        rowCount++;
      }

      return {
        success: true,
        data,
        url,
        timestamp,
        itemCount: data.length,
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : String(error),
        url,
        timestamp,
        itemCount: 0,
      };
    }
  }

  /**
   * Extract a list from the page
   */
  async extractList<T = Record<string, unknown>>(config: ListConfig): Promise<ScrapeResult<T[]>> {
    const url = this.page.getCurrentURL() || "";
    const timestamp = new Date();

    try {
      // Find the list container
      const containers = await this.page.query(config.selector, config.selectorType || "css");
      if (containers.length === 0) {
        return {
          success: false,
          data: [],
          error: "List container not found",
          url,
          timestamp,
          itemCount: 0,
        };
      }

      // Get list items
      const itemSelector = config.itemSelector || "li";
      const items = await this.page.query(`${config.selector} ${itemSelector}`);

      const data: T[] = [];
      const maxItems = config.maxItems || items.length;

      for (let i = 0; i < Math.min(items.length, maxItems); i++) {
        const item = items[i];

        if (config.itemRules) {
          const extracted = await this.extractFromElement(item, config.itemRules);
          data.push(extracted as T);
        } else {
          // Just extract text if no rules specified
          data.push({ text: await item.getText() } as T);
        }
      }

      return {
        success: true,
        data,
        url,
        timestamp,
        itemCount: data.length,
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : String(error),
        url,
        timestamp,
        itemCount: 0,
      };
    }
  }

  /**
   * Extract all links from the page
   */
  async extractLinks(selector?: string): Promise<ScrapeResult<ExtractedLink[]>> {
    const url = this.page.getCurrentURL() || "";
    const timestamp = new Date();

    try {
      const linkSelector = selector || "a[href]";
      const links = await this.page.query(linkSelector);
      const baseUrl = url ? new URL(url) : null;

      const data: ExtractedLink[] = [];

      for (const link of links) {
        const href = await link.getAttribute("href") || "";
        const text = await link.getText();
        const title = await link.getAttribute("title");
        const target = await link.getAttribute("target");
        const rel = await link.getAttribute("rel");

        // Determine if external
        let isExternal = false;
        if (baseUrl && href) {
          try {
            const linkUrl = new URL(href, baseUrl);
            isExternal = linkUrl.host !== baseUrl.host;
          } catch {
            isExternal = href.startsWith("http://") || href.startsWith("https://");
          }
        }

        data.push({
          text,
          href,
          title,
          target,
          rel,
          isExternal,
        });
      }

      return {
        success: true,
        data,
        url,
        timestamp,
        itemCount: data.length,
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : String(error),
        url,
        timestamp,
        itemCount: 0,
      };
    }
  }

  /**
   * Extract all images from the page
   */
  async extractImages(selector?: string): Promise<ScrapeResult<ExtractedImage[]>> {
    const url = this.page.getCurrentURL() || "";
    const timestamp = new Date();

    try {
      const imageSelector = selector || "img[src]";
      const images = await this.page.query(imageSelector);

      const data: ExtractedImage[] = [];

      for (const image of images) {
        data.push({
          src: await image.getAttribute("src") || "",
          alt: await image.getAttribute("alt"),
          title: await image.getAttribute("title"),
          width: await image.getAttribute("width"),
          height: await image.getAttribute("height"),
          loading: await image.getAttribute("loading"),
        });
      }

      return {
        success: true,
        data,
        url,
        timestamp,
        itemCount: data.length,
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : String(error),
        url,
        timestamp,
        itemCount: 0,
      };
    }
  }

  /**
   * Extract text content from the page
   */
  async extractText(selector?: string): Promise<ScrapeResult<string>> {
    const url = this.page.getCurrentURL() || "";
    const timestamp = new Date();

    try {
      const textSelector = selector || "body";
      const elements = await this.page.query(textSelector);

      if (elements.length === 0) {
        return {
          success: false,
          data: "",
          error: "Element not found",
          url,
          timestamp,
          itemCount: 0,
        };
      }

      const text = await elements[0].getText();

      return {
        success: true,
        data: text,
        url,
        timestamp,
        itemCount: 1,
      };
    } catch (error) {
      return {
        success: false,
        data: "",
        error: error instanceof Error ? error.message : String(error),
        url,
        timestamp,
        itemCount: 0,
      };
    }
  }

  /**
   * Scrape multiple pages using pagination
   */
  async scrapePaginated<T = Record<string, unknown>>(
    scrapeConfig: ScrapeConfig,
    paginationConfig: PaginationConfig
  ): Promise<PaginatedScrapeResult<T>> {
    const allData: T[] = [];
    const urls: string[] = [];
    const errors = new Map<number, string>();
    const timestamp = new Date();

    let pageNumber = 1;
    const maxPages = paginationConfig.maxPages || Infinity;

    while (pageNumber <= maxPages) {
      // Scrape current page
      const result = await this.scrape<T>(scrapeConfig);
      urls.push(result.url);

      if (result.success) {
        if (Array.isArray(result.data)) {
          allData.push(...result.data);
        } else {
          allData.push(result.data as T);
        }
      } else {
        errors.set(pageNumber, result.error || "Unknown error");
      }

      // Check for stop condition
      if (paginationConfig.stopSelector) {
        const stopElements = await this.page.query(paginationConfig.stopSelector);
        if (stopElements.length > 0) {
          break;
        }
      }

      if (paginationConfig.stopUrlPattern) {
        const currentUrl = this.page.getCurrentURL() || "";
        if (paginationConfig.stopUrlPattern.test(currentUrl)) {
          break;
        }
      }

      // Try to go to next page
      try {
        const nextElements = await this.page.query(
          paginationConfig.nextSelector,
          paginationConfig.selectorType || "css"
        );

        if (nextElements.length === 0) {
          break; // No more pages
        }

        // Click next button
        await this.page.click(paginationConfig.nextSelector, paginationConfig.selectorType || "css");

        // Wait for navigation or content to load
        if (paginationConfig.waitForSelector) {
          await this.page.wait({
            type: "selector",
            selector: paginationConfig.waitForSelector,
            timeout: paginationConfig.timeout || 30000,
          });
        } else {
          await this.page.wait({
            type: "time",
            duration: paginationConfig.delayBetweenPages || 1000,
          });
        }

        pageNumber++;
      } catch {
        break; // Error navigating to next page
      }
    }

    return {
      success: errors.size === 0,
      data: allData,
      pageCount: urls.length,
      errors,
      urls,
      timestamp,
    };
  }

  /**
   * Wait for dynamic content to load
   */
  async waitForContent(selector: string, timeout?: number): Promise<boolean> {
    try {
      await this.page.wait({
        type: "selector",
        selector,
        timeout: timeout || 30000,
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the current page URL
   */
  getCurrentUrl(): string {
    return this.page.getCurrentURL() || "";
  }
}

/**
 * Create a WebScraper instance for a page
 */
export function createWebScraper(page: BrowserPage): WebScraper {
  return new WebScraper(page);
}

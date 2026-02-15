/**
 * Browser Controller
 * Interfaces with the Browser Engine to execute browser operations
 */

import {
  ClickStep,
  DOMQueryStep,
  EvaluateJSStep,
  NavigateStep,
  PDFStep,
  ScreenshotStep,
  TypeStep,
  WaitStep,
} from "../../planner/mod.ts";
import { DurationMs, URLString } from "../../types/primitives.ts";
import {
  type EvaluationContext,
  ExpressionEvaluator,
} from "../../executor/expression-evaluator.ts";

/**
 * Query DOM options
 */
export interface QueryDOMOptions {
  signal?: AbortSignal;
}

/**
 * Click options
 */
export interface ClickOptions {
  signal?: AbortSignal;
}

/**
 * Evaluate options
 */
export interface EvaluateOptions {
  signal?: AbortSignal;
}

/**
 * Browser page interface
 * Aligned with browser/src/api/BrowserPage.ts implementation
 */
export interface BrowserPage {
  navigate(url: URLString, options?: NavigateOptions): Promise<void>;
  query(selector: string, type?: "css" | "xpath", options?: QueryDOMOptions): Promise<DOMElement[]>;
  click(selector: string, type?: "css" | "xpath", options?: ClickOptions): Promise<void>;
  type(selector: string, text: string, options?: TypeOptions): Promise<void>;
  wait(options: WaitOptions): Promise<void>;
  screenshot(options?: ScreenshotOptions): Promise<Uint8Array>;
  pdf(options?: PDFOptions): Promise<Uint8Array>;
  evaluate(script: string, args?: unknown[], options?: EvaluateOptions): Promise<unknown>;
  close(): Promise<void>;
  getCurrentURL(): string | undefined;
  getMetadata?(): Promise<Record<string, unknown>>;
}

/**
 * DOM element interface
 */
export interface DOMElement {
  getText(): Promise<string>;
  getAttribute(name: string): Promise<string | null>;
  getProperty(name: string): Promise<unknown>;
  click(): Promise<void>;
  type(text: string): Promise<void>;
  getInternalElement(): any;
}

/**
 * Navigate options
 */
export interface NavigateOptions {
  waitFor?: "load" | "domcontentloaded" | "networkidle" | string;
  timeout?: DurationMs;
  signal?: AbortSignal;
}

/**
 * Type options
 */
export interface TypeOptions {
  clear?: boolean;
  delay?: DurationMs;
  signal?: AbortSignal;
}

/**
 * Wait options
 */
export interface WaitOptions {
  type: "time" | "selector" | "function";
  duration?: DurationMs;
  selector?: string;
  selectorType?: "css" | "xpath";
  condition?: string;
  timeout?: DurationMs;
  signal?: AbortSignal;
}

/**
 * Screenshot options
 */
export interface ScreenshotOptions {
  fullPage?: boolean;
  selector?: string;
  format?: "png" | "jpeg";
  quality?: number;
  signal?: AbortSignal;
}

/**
 * PDF options
 */
export interface PDFOptions {
  format?: "A4" | "Letter" | "Legal" | "A3";
  orientation?: "portrait" | "landscape";
  landscape?: boolean; // deprecated - use orientation instead
  margin?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
  scale?: number;
  printBackground?: boolean;
  signal?: AbortSignal;
}

/**
 * Browser engine interface
 */
export interface BrowserEngine {
  newPage(): Promise<BrowserPage>;
  close(): Promise<void>;
}

/**
 * Execution options with signal support
 */
export interface ExecuteOptions {
  signal?: AbortSignal;
}

/**
 * Browser controller
 */
export class BrowserController {
  private browserEngine?: BrowserEngine;
  private currentPage?: BrowserPage;

  constructor(browserEngine?: BrowserEngine) {
    this.browserEngine = browserEngine;
  }

  /**
   * Check if signal is aborted and throw if so
   */
  private checkAbort(options?: ExecuteOptions): void {
    if (options?.signal?.aborted) {
      throw options.signal.reason || new Error("Operation aborted");
    }
  }

  /**
   * Execute navigation step
   */
  async executeNavigate(step: NavigateStep, options?: ExecuteOptions): Promise<unknown> {
    this.checkAbort(options);

    if (!this.currentPage) {
      this.currentPage = await this.createPage();
    }

    const navigateOptions: NavigateOptions = {
      waitFor: step.options?.waitFor || "load",
      timeout: step.options?.timeout || 30000,
      signal: options?.signal,
    };

    await this.currentPage.navigate(step.url, navigateOptions);

    this.checkAbort(options);

    // If screenshot requested
    if (step.options?.screenshot) {
      const screenshot = await this.currentPage.screenshot();
      return { navigated: true, url: step.url, screenshot };
    }

    return { navigated: true, url: step.url };
  }

  /**
   * Execute DOM query step
   */
  async executeDOMQuery(step: DOMQueryStep, options?: ExecuteOptions): Promise<unknown> {
    this.checkAbort(options);

    if (!this.currentPage) {
      throw new Error("No page available for DOM query");
    }

    // Query elements
    const elements = await this.currentPage.query(step.selector, step.selectorType);

    this.checkAbort(options);

    // Extract fields from elements
    const results: Record<string, unknown>[] = [];

    // Get page metadata once before the loop
    const metadata = await this.currentPage.getMetadata?.() ?? {};

    for (const element of elements) {
      this.checkAbort(options);

      const extracted: Record<string, unknown> = {};

      // Create evaluation context with element data
      const elementData: Record<string, unknown> = {
        text: await element.getText(),
        element: element.getInternalElement(),
      };

      // Get all attributes
      const internalElement = element.getInternalElement();
      if (internalElement.attributes) {
        for (const [attrName, attrValue] of internalElement.attributes.entries()) {
          elementData[attrName] = attrValue;
        }
      }

      // Merge page metadata (lower priority) with element data (higher priority)
      const evalContext: EvaluationContext = {
        variables: new Map([
          ...Object.entries(metadata),      // page-level: title, description, url
          ...Object.entries(elementData),   // element-level: text, attributes (overrides)
        ]),
        functions: new Map(),
      };

      const evaluator = new ExpressionEvaluator(evalContext);

      for (const field of step.extractFields) {
        // Evaluate the field expression in the context of the element
        const value = await evaluator.evaluate(field.expression);
        extracted[field.name] = value;
      }

      results.push(extracted);
    }

    return results;
  }

  /**
   * Execute click step
   */
  async executeClick(step: ClickStep, options?: ExecuteOptions): Promise<void> {
    this.checkAbort(options);

    if (!this.currentPage) {
      throw new Error("No page available for click");
    }

    await this.currentPage.click(step.selector, step.selectorType);

    this.checkAbort(options);

    if (step.waitForNavigation) {
      await this.currentPage.wait({
        type: "time",
        duration: 1000, // Wait 1 second for navigation
      });
    }
  }

  /**
   * Execute type step
   */
  async executeType(step: TypeStep, options?: ExecuteOptions): Promise<void> {
    this.checkAbort(options);

    if (!this.currentPage) {
      throw new Error("No page available for typing");
    }

    const typeOptions: TypeOptions = {
      clear: step.clear,
      delay: step.delay,
    };

    await this.currentPage.type(step.selector, step.text, typeOptions);
  }

  /**
   * Execute wait step
   */
  async executeWait(step: WaitStep, options?: ExecuteOptions): Promise<void> {
    this.checkAbort(options);

    if (!this.currentPage) {
      throw new Error("No page available for wait");
    }

    const waitOptions: WaitOptions = {
      type: step.waitType,
      duration: step.duration,
      selector: step.selector,
      selectorType: "css",
      condition: step.condition,
      timeout: 30000,
      signal: options?.signal,
    };

    await this.currentPage.wait(waitOptions);
  }

  /**
   * Execute screenshot step
   */
  async executeScreenshot(step: ScreenshotStep, options?: ExecuteOptions): Promise<Uint8Array> {
    this.checkAbort(options);

    if (!this.currentPage) {
      throw new Error("No page available for screenshot");
    }

    const screenshotOptions: ScreenshotOptions = {
      fullPage: step.fullPage,
      selector: step.selector,
      format: step.format,
      quality: step.quality,
    };

    return await this.currentPage.screenshot(screenshotOptions);
  }

  /**
   * Execute PDF step
   */
  async executePDF(step: PDFStep, options?: ExecuteOptions): Promise<Uint8Array> {
    this.checkAbort(options);

    if (!this.currentPage) {
      throw new Error("No page available for PDF generation");
    }

    const pdfOptions: PDFOptions = {
      format: step.format,
      landscape: step.landscape,
      margin: step.margin,
    };

    return await this.currentPage.pdf(pdfOptions);
  }

  /**
   * Execute JavaScript evaluation step
   */
  async executeEvaluateJS(step: EvaluateJSStep, options?: ExecuteOptions): Promise<unknown> {
    this.checkAbort(options);

    if (!this.currentPage) {
      throw new Error("No page available for JavaScript evaluation");
    }

    return await this.currentPage.evaluate(step.script, step.args);
  }

  /**
   * Create a new page
   */
  private async createPage(): Promise<BrowserPage> {
    if (!this.browserEngine) {
      throw new Error(
        "Browser engine not configured. Please provide a BrowserEngine instance in the constructor.",
      );
    }

    return await this.browserEngine.newPage();
  }

  /**
   * Close current page
   */
  async closePage(): Promise<void> {
    if (this.currentPage) {
      await this.currentPage.close();
      this.currentPage = undefined;
    }
  }

  /**
   * Get current page
   */
  getCurrentPage(): BrowserPage | undefined {
    return this.currentPage;
  }

  /**
   * Get browser engine
   */
  getBrowserEngine(): BrowserEngine | undefined {
    return this.browserEngine;
  }
}

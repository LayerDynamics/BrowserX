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
 * Browser page interface
 */
export interface BrowserPage {
  navigate(url: URLString, options?: NavigateOptions): Promise<void>;
  query(selector: string, type?: "css" | "xpath"): Promise<DOMElement[]>;
  click(selector: string, type?: "css" | "xpath"): Promise<void>;
  type(selector: string, text: string, options?: TypeOptions): Promise<void>;
  wait(options: WaitOptions): Promise<void>;
  screenshot(options?: ScreenshotOptions): Promise<Uint8Array>;
  pdf(options?: PDFOptions): Promise<Uint8Array>;
  evaluate(script: string, args?: unknown[]): Promise<unknown>;
  close(): Promise<void>;
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
}

/**
 * Type options
 */
export interface TypeOptions {
  clear?: boolean;
  delay?: DurationMs;
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
}

/**
 * Screenshot options
 */
export interface ScreenshotOptions {
  fullPage?: boolean;
  selector?: string;
  format?: "png" | "jpeg";
  quality?: number;
}

/**
 * PDF options
 */
export interface PDFOptions {
  format?: "A4" | "Letter";
  landscape?: boolean;
  margin?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
}

/**
 * Browser engine interface
 */
export interface BrowserEngine {
  newPage(): Promise<BrowserPage>;
  close(): Promise<void>;
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
   * Execute navigation step
   */
  async executeNavigate(step: NavigateStep): Promise<unknown> {
    if (!this.currentPage) {
      this.currentPage = await this.createPage();
    }

    const options: NavigateOptions = {
      waitFor: step.options?.waitFor || "load",
      timeout: step.options?.timeout || 30000,
    };

    await this.currentPage.navigate(step.url, options);

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
  async executeDOMQuery(step: DOMQueryStep): Promise<unknown> {
    if (!this.currentPage) {
      throw new Error("No page available for DOM query");
    }

    // Query elements
    const elements = await this.currentPage.query(step.selector, step.selectorType);

    // Extract fields from elements
    const results = [];

    for (const element of elements) {
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

      const evalContext: EvaluationContext = {
        variables: new Map(Object.entries(elementData)),
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
  async executeClick(step: ClickStep): Promise<void> {
    if (!this.currentPage) {
      throw new Error("No page available for click");
    }

    await this.currentPage.click(step.selector, step.selectorType);

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
  async executeType(step: TypeStep): Promise<void> {
    if (!this.currentPage) {
      throw new Error("No page available for typing");
    }

    const options: TypeOptions = {
      clear: step.clear,
      delay: step.delay,
    };

    await this.currentPage.type(step.selector, step.text, options);
  }

  /**
   * Execute wait step
   */
  async executeWait(step: WaitStep): Promise<void> {
    if (!this.currentPage) {
      throw new Error("No page available for wait");
    }

    const options: WaitOptions = {
      type: step.waitType,
      duration: step.duration,
      selector: step.selector,
      selectorType: "css",
      condition: step.condition,
      timeout: 30000,
    };

    await this.currentPage.wait(options);
  }

  /**
   * Execute screenshot step
   */
  async executeScreenshot(step: ScreenshotStep): Promise<Uint8Array> {
    if (!this.currentPage) {
      throw new Error("No page available for screenshot");
    }

    const options: ScreenshotOptions = {
      fullPage: step.fullPage,
      selector: step.selector,
      format: step.format,
      quality: step.quality,
    };

    return await this.currentPage.screenshot(options);
  }

  /**
   * Execute PDF step
   */
  async executePDF(step: PDFStep): Promise<Uint8Array> {
    if (!this.currentPage) {
      throw new Error("No page available for PDF generation");
    }

    const options: PDFOptions = {
      format: step.format,
      landscape: step.landscape,
      margin: step.margin,
    };

    return await this.currentPage.pdf(options);
  }

  /**
   * Execute JavaScript evaluation step
   */
  async executeEvaluateJS(step: EvaluateJSStep): Promise<unknown> {
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

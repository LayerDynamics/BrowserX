/**
 * DOM Functions
 * Functions that interact with DOM (require browser context)
 */

import type { DataType, FunctionImplementation } from "../types.ts";
import { FunctionCategory } from "../types.ts";
import { requireBrowserController } from "../../controllers/browser/browser-context.ts";

/**
 * TEXT - Extract text content from element
 */
export const TEXT: FunctionImplementation = {
  signature: {
    name: "TEXT",
    category: FunctionCategory.DOM,
    minArgs: 1,
    maxArgs: 1,
    argTypes: [["css_selector" as DataType]],
    returnType: "string" as DataType,
    description: "Extract text content from element matching selector",
    examples: ['TEXT("h1") → "Page Title"'],
    isAsync: true,
  },
  implementation: async (selector: unknown): Promise<string> => {
    const controller = requireBrowserController();
    const page = controller.getCurrentPage();

    if (!page) {
      throw new Error("No page available. Navigate to a URL first.");
    }

    const selectorStr = String(selector);

    // Query elements using the selector
    const elements = await page.query(selectorStr, "css");

    if (elements.length === 0) {
      return "";
    }

    // Extract text from all matching elements and join
    const texts: string[] = [];
    for (const element of elements) {
      const text = await element.getText();
      if (text) {
        texts.push(text);
      }
    }

    return texts.join(" ");
  },
};

/**
 * HTML - Extract HTML content from element
 */
export const HTML: FunctionImplementation = {
  signature: {
    name: "HTML",
    category: FunctionCategory.DOM,
    minArgs: 1,
    maxArgs: 1,
    argTypes: [["css_selector" as DataType]],
    returnType: "string" as DataType,
    description: "Extract HTML content from element matching selector",
    examples: ['HTML("#main") → "<div>...</div>"'],
    isAsync: true,
  },
  implementation: async (selector: unknown): Promise<string> => {
    const controller = requireBrowserController();
    const page = controller.getCurrentPage();

    if (!page) {
      throw new Error("No page available. Navigate to a URL first.");
    }

    const selectorStr = String(selector);

    // Query elements using the selector
    const elements = await page.query(selectorStr, "css");

    if (elements.length === 0) {
      return "";
    }

    // Get innerHTML property from elements
    const htmlParts: string[] = [];
    for (const element of elements) {
      const innerHTML = await element.getProperty("innerHTML");
      if (innerHTML !== null && innerHTML !== undefined) {
        htmlParts.push(String(innerHTML));
      }
    }

    return htmlParts.join("");
  },
};

/**
 * ATTR - Get attribute value from element
 */
export const ATTR: FunctionImplementation = {
  signature: {
    name: "ATTR",
    category: FunctionCategory.DOM,
    minArgs: 2,
    maxArgs: 2,
    argTypes: [["css_selector" as DataType, "string" as DataType]],
    returnType: "string" as DataType,
    description: "Get attribute value from element matching selector",
    examples: ['ATTR("a", "href") → "https://example.com"'],
    isAsync: true,
  },
  implementation: async (selector: unknown, attribute: unknown): Promise<string | null> => {
    const controller = requireBrowserController();
    const page = controller.getCurrentPage();

    if (!page) {
      throw new Error("No page available. Navigate to a URL first.");
    }

    const selectorStr = String(selector);
    const attributeName = String(attribute);

    // Query elements using the selector
    const elements = await page.query(selectorStr, "css");

    if (elements.length === 0) {
      return null;
    }

    // Get attribute from first matching element
    const firstElement = elements[0];
    const attrValue = await firstElement.getAttribute(attributeName);

    return attrValue;
  },
};

/**
 * COUNT - Count elements matching selector
 */
export const COUNT: FunctionImplementation = {
  signature: {
    name: "COUNT",
    category: FunctionCategory.DOM,
    minArgs: 1,
    maxArgs: 1,
    argTypes: [["css_selector" as DataType]],
    returnType: "number" as DataType,
    description: "Count number of elements matching selector",
    examples: ['COUNT("p") → 5'],
    isAsync: true,
  },
  implementation: async (selector: unknown): Promise<number> => {
    const controller = requireBrowserController();
    const page = controller.getCurrentPage();

    if (!page) {
      throw new Error("No page available. Navigate to a URL first.");
    }

    const selectorStr = String(selector);

    // Query elements using the selector
    const elements = await page.query(selectorStr, "css");

    return elements.length;
  },
};

/**
 * EXISTS - Check if element exists
 */
export const EXISTS: FunctionImplementation = {
  signature: {
    name: "EXISTS",
    category: FunctionCategory.DOM,
    minArgs: 1,
    maxArgs: 1,
    argTypes: [["css_selector" as DataType]],
    returnType: "boolean" as DataType,
    description: "Check if element matching selector exists",
    examples: ['EXISTS("#main") → true'],
    isAsync: true,
  },
  implementation: async (selector: unknown): Promise<boolean> => {
    const controller = requireBrowserController();
    const page = controller.getCurrentPage();

    if (!page) {
      throw new Error("No page available. Navigate to a URL first.");
    }

    const selectorStr = String(selector);

    // Query elements using the selector
    const elements = await page.query(selectorStr, "css");

    return elements.length > 0;
  },
};

/**
 * All DOM functions
 */
export const DOM_FUNCTIONS: FunctionImplementation[] = [
  TEXT,
  HTML,
  ATTR,
  COUNT,
  EXISTS,
];

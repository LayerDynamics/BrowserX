/**
 * Utility Functions
 * General-purpose utility functions
 */

import type { DataType, FunctionImplementation } from "../types.ts";
import { FunctionCategory } from "../types.ts";

/**
 * PARSE_JSON - Parse JSON string
 */
export const PARSE_JSON: FunctionImplementation = {
  signature: {
    name: "PARSE_JSON",
    category: FunctionCategory.UTILITY,
    minArgs: 1,
    maxArgs: 1,
    argTypes: [["string" as DataType]],
    returnType: "any" as DataType,
    description: "Parse JSON string to object",
    examples: ["PARSE_JSON('{\"a\":1}') → {a: 1}"],
    isAsync: false,
  },
  implementation: (str: unknown): unknown => {
    const input = String(str);
    try {
      return JSON.parse(input);
    } catch (error) {
      // Log detailed error information for debugging
      const errorMessage = error instanceof Error ? error.message : String(error);
      const preview = input.length > 100
        ? input.substring(0, 100) + "..."
        : input;

      console.error(
        `PARSE_JSON failed to parse input: ${errorMessage}`,
        {
          input: preview,
          inputLength: input.length,
          error: errorMessage,
        }
      );

      // Return null for failed parsing (allows queries to continue)
      return null;
    }
  },
};

/**
 * TO_JSON - Convert value to JSON string
 */
export const TO_JSON: FunctionImplementation = {
  signature: {
    name: "TO_JSON",
    category: FunctionCategory.UTILITY,
    minArgs: 1,
    maxArgs: 2,
    argTypes: [
      ["any" as DataType],
      ["any" as DataType, "boolean" as DataType],
    ],
    returnType: "string" as DataType,
    description: "Convert value to JSON string (optional pretty print)",
    examples: [
      "TO_JSON({a: 1}) → '{\"a\":1}'",
      "TO_JSON({a: 1}, true) → formatted JSON",
    ],
    isAsync: false,
  },
  implementation: (value: unknown, pretty?: unknown): string => {
    try {
      const indent = pretty ? 2 : 0;
      return JSON.stringify(value, null, indent);
    } catch {
      return String(value);
    }
  },
};

/**
 * WAIT - Sleep/delay execution
 */
export const WAIT: FunctionImplementation = {
  signature: {
    name: "WAIT",
    category: FunctionCategory.UTILITY,
    minArgs: 1,
    maxArgs: 1,
    argTypes: [["number" as DataType]],
    returnType: "object" as DataType,
    description: "Wait for specified milliseconds",
    examples: ["WAIT(1000) → waits 1 second"],
    isAsync: true,
  },
  implementation: async (ms: unknown): Promise<{
    completed: boolean;
    duration: number;
    requestedDuration: number;
    timestamp: number;
    startTime: number;
    endTime: number;
  }> => {
    const requestedMs = Number(ms);

    if (isNaN(requestedMs) || requestedMs < 0) {
      throw new Error("WAIT requires a non-negative number of milliseconds");
    }

    const startTime = Date.now();

    await new Promise((resolve) => setTimeout(resolve, requestedMs));

    const endTime = Date.now();
    const actualDuration = endTime - startTime;

    return {
      completed: true,
      duration: actualDuration,
      requestedDuration: requestedMs,
      timestamp: endTime,
      startTime,
      endTime,
    };
  },
};

/**
 * SCREENSHOT - Take screenshot (placeholder, requires browser context)
 */
export const SCREENSHOT: FunctionImplementation = {
  signature: {
    name: "SCREENSHOT",
    category: FunctionCategory.UTILITY,
    minArgs: 0,
    maxArgs: 1,
    argTypes: [
      [],
      ["string" as DataType], // Optional selector
    ],
    returnType: "buffer" as DataType,
    description: "Take screenshot of page or element",
    examples: ["SCREENSHOT() → screenshot buffer", 'SCREENSHOT("#main") → element screenshot'],
    isAsync: true,
  },
  implementation: async (selector?: unknown): Promise<Uint8Array> => {
    const { requireBrowserController } = await import(
      "../../controllers/browser/browser-context.ts"
    );

    const controller = requireBrowserController();
    const page = controller.getCurrentPage();

    if (!page) {
      throw new Error("No page available. Navigate to a URL first.");
    }

    const options: {
      fullPage?: boolean;
      selector?: string;
      format?: "png" | "jpeg";
      quality?: number;
    } = {
      fullPage: !selector,
      format: "png",
    };

    if (selector) {
      options.selector = String(selector);
      options.fullPage = false;
    }

    return await page.screenshot(options);
  },
};

/**
 * PDF - Generate PDF (placeholder, requires browser context)
 */
export const PDF: FunctionImplementation = {
  signature: {
    name: "PDF",
    category: FunctionCategory.UTILITY,
    minArgs: 0,
    maxArgs: 1,
    argTypes: [
      [],
      ["object" as DataType], // Optional options
    ],
    returnType: "buffer" as DataType,
    description: "Generate PDF of page",
    examples: ["PDF() → PDF buffer", "PDF({landscape: true}) → landscape PDF"],
    isAsync: true,
  },
  implementation: async (options?: unknown): Promise<Uint8Array> => {
    const { requireBrowserController } = await import(
      "../../controllers/browser/browser-context.ts"
    );

    const controller = requireBrowserController();
    const page = controller.getCurrentPage();

    if (!page) {
      throw new Error("No page available. Navigate to a URL first.");
    }

    // Parse options object if provided
    const pdfOptions: {
      format?: "A4" | "Letter";
      landscape?: boolean;
      margin?: {
        top?: number;
        right?: number;
        bottom?: number;
        left?: number;
      };
    } = {};

    if (options && typeof options === "object") {
      const opts = options as any;
      if (opts.format) {
        pdfOptions.format = String(opts.format) as "A4" | "Letter";
      }
      if (opts.landscape !== undefined) {
        pdfOptions.landscape = Boolean(opts.landscape);
      }
      if (opts.margin && typeof opts.margin === "object") {
        pdfOptions.margin = {
          top: opts.margin.top !== undefined ? Number(opts.margin.top) : undefined,
          right: opts.margin.right !== undefined ? Number(opts.margin.right) : undefined,
          bottom: opts.margin.bottom !== undefined ? Number(opts.margin.bottom) : undefined,
          left: opts.margin.left !== undefined ? Number(opts.margin.left) : undefined,
        };
      }
    }

    return await page.pdf(pdfOptions);
  },
};

/**
 * NOW - Current timestamp
 */
export const NOW: FunctionImplementation = {
  signature: {
    name: "NOW",
    category: FunctionCategory.UTILITY,
    minArgs: 0,
    maxArgs: 0,
    argTypes: [[]],
    returnType: "number" as DataType,
    description: "Get current timestamp in milliseconds",
    examples: ["NOW() → 1234567890123"],
    isAsync: false,
  },
  implementation: (): number => {
    return Date.now();
  },
};

/**
 * UUID - Generate UUID v4
 */
export const UUID: FunctionImplementation = {
  signature: {
    name: "UUID",
    category: FunctionCategory.UTILITY,
    minArgs: 0,
    maxArgs: 0,
    argTypes: [[]],
    returnType: "string" as DataType,
    description: "Generate random UUID v4",
    examples: ['UUID() → "550e8400-e29b-41d4-a716-446655440000"'],
    isAsync: false,
  },
  implementation: (): string => {
    return crypto.randomUUID();
  },
};

/**
 * All utility functions
 */
export const UTILITY_FUNCTIONS: FunctionImplementation[] = [
  PARSE_JSON,
  TO_JSON,
  WAIT,
  SCREENSHOT,
  PDF,
  NOW,
  UUID,
];

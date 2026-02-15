/**
 * BrowserController Tests
 * Comprehensive tests for browser controller functionality
 */

import { assertEquals, assertExists, assert, assertRejects } from "@std/assert";
import {
  BrowserController,
  type BrowserEngine,
  type BrowserPage,
  type DOMElement,
  type NavigateOptions,
  type TypeOptions,
  type WaitOptions,
  type ScreenshotOptions,
  type PDFOptions,
} from "../../controllers/browser/browser-controller.ts";
import {
  type NavigateStep,
  type DOMQueryStep,
  type ClickStep,
  type TypeStep,
  type WaitStep,
  type ScreenshotStep,
  type PDFStep,
  type EvaluateJSStep,
  ExecutionStepType,
} from "../../planner/mod.ts";
import { DataType, type URLString } from "../../types/primitives.ts";

// ============================================================================
// Mock Implementations
// ============================================================================

/**
 * Creates a mock DOMElement
 */
function createMockDOMElement(
  text: string = "Element text",
  attributes: Map<string, string> = new Map()
): DOMElement {
  return {
    getText: async () => text,
    getAttribute: async (name: string) => attributes.get(name) || null,
    getProperty: async (name: string) => {
      if (name === "innerText") return text;
      if (name === "tagName") return "DIV";
      return undefined;
    },
    click: async () => {},
    type: async (_text: string) => {},
    getInternalElement: () => ({
      attributes,
      innerText: text,
      tagName: "DIV",
    }),
  };
}

/**
 * Creates a mock BrowserPage
 */
function createMockBrowserPage(options: {
  navigatedUrls?: string[];
  elements?: DOMElement[];
  clickedSelectors?: string[];
  typedInputs?: { selector: string; text: string; options?: TypeOptions }[];
  waitCalls?: WaitOptions[];
  screenshotResult?: Uint8Array;
  pdfResult?: Uint8Array;
  evaluateResult?: unknown;
} = {}): BrowserPage {
  const navigatedUrls = options.navigatedUrls || [];
  const elements = options.elements || [];
  const clickedSelectors = options.clickedSelectors || [];
  const typedInputs = options.typedInputs || [];
  const waitCalls = options.waitCalls || [];
  const screenshotResult = options.screenshotResult || new Uint8Array([137, 80, 78, 71]); // PNG header
  const pdfResult = options.pdfResult || new Uint8Array([37, 80, 68, 70]); // PDF header
  const evaluateResult = options.evaluateResult;

  return {
    navigate: async (url: URLString, _opts?: NavigateOptions) => {
      navigatedUrls.push(url);
    },
    query: async (_selector: string, _type?: "css" | "xpath") => elements,
    click: async (selector: string, _type?: "css" | "xpath") => {
      clickedSelectors.push(selector);
    },
    type: async (selector: string, text: string, opts?: TypeOptions) => {
      typedInputs.push({ selector, text, options: opts });
    },
    wait: async (opts: WaitOptions) => {
      waitCalls.push(opts);
    },
    screenshot: async (_opts?: ScreenshotOptions) => screenshotResult,
    pdf: async (_opts?: PDFOptions) => pdfResult,
    evaluate: async (_script: string, _args?: unknown[]) => evaluateResult,
    close: async () => {},
    getCurrentURL: () => undefined,
  };
}

/**
 * Creates a mock BrowserEngine
 */
function createMockBrowserEngine(page?: BrowserPage): BrowserEngine {
  return {
    newPage: async () => page || createMockBrowserPage(),
    close: async () => {},
  };
}

/**
 * Creates a base execution step with defaults
 */
function createBaseStep(overrides: Partial<{
  id: string;
  type: ExecutionStepType;
  estimatedCost: number;
  dependencies: string[];
  cacheable: boolean;
}> = {}): {
  id: string;
  estimatedCost: number;
  dependencies: string[];
  cacheable: boolean;
} {
  return {
    id: overrides.id || "step-1",
    estimatedCost: overrides.estimatedCost || 100,
    dependencies: overrides.dependencies || [],
    cacheable: overrides.cacheable || false,
  };
}

// ============================================================================
// Constructor Tests
// ============================================================================

Deno.test("BrowserController - constructor without browser engine", () => {
  const controller = new BrowserController();

  assertEquals(controller.getBrowserEngine(), undefined);
  assertEquals(controller.getCurrentPage(), undefined);
});

Deno.test("BrowserController - constructor with browser engine", () => {
  const mockEngine = createMockBrowserEngine();
  const controller = new BrowserController(mockEngine);

  assertExists(controller.getBrowserEngine());
  assertEquals(controller.getCurrentPage(), undefined);
});

// ============================================================================
// executeNavigate Tests
// ============================================================================

Deno.test("BrowserController - executeNavigate creates page and navigates", async () => {
  const navigatedUrls: string[] = [];
  const mockPage = createMockBrowserPage({ navigatedUrls });
  const mockEngine = createMockBrowserEngine(mockPage);
  const controller = new BrowserController(mockEngine);

  const step: NavigateStep = {
    ...createBaseStep(),
    type: ExecutionStepType.NAVIGATE,
    url: "https://example.com",
  };

  const result = await controller.executeNavigate(step);

  assertExists(result);
  assertEquals((result as any).navigated, true);
  assertEquals((result as any).url, "https://example.com");
  assertEquals(navigatedUrls.length, 1);
  assertEquals(navigatedUrls[0], "https://example.com");
  assertExists(controller.getCurrentPage());
});

Deno.test("BrowserController - executeNavigate with default options", async () => {
  const navigatedUrls: string[] = [];
  const mockPage = createMockBrowserPage({ navigatedUrls });
  const mockEngine = createMockBrowserEngine(mockPage);
  const controller = new BrowserController(mockEngine);

  const step: NavigateStep = {
    ...createBaseStep(),
    type: ExecutionStepType.NAVIGATE,
    url: "https://example.com",
  };

  await controller.executeNavigate(step);

  assertEquals(navigatedUrls.length, 1);
});

Deno.test("BrowserController - executeNavigate with waitFor option", async () => {
  const navigatedUrls: string[] = [];
  const mockPage = createMockBrowserPage({ navigatedUrls });
  const mockEngine = createMockBrowserEngine(mockPage);
  const controller = new BrowserController(mockEngine);

  const step: NavigateStep = {
    ...createBaseStep(),
    type: ExecutionStepType.NAVIGATE,
    url: "https://example.com",
    options: {
      waitFor: "networkidle",
      timeout: 60000,
    },
  };

  const result = await controller.executeNavigate(step);

  assertEquals((result as any).navigated, true);
});

Deno.test("BrowserController - executeNavigate with screenshot option", async () => {
  const mockPage = createMockBrowserPage({
    screenshotResult: new Uint8Array([1, 2, 3, 4]),
  });
  const mockEngine = createMockBrowserEngine(mockPage);
  const controller = new BrowserController(mockEngine);

  const step: NavigateStep = {
    ...createBaseStep(),
    type: ExecutionStepType.NAVIGATE,
    url: "https://example.com",
    options: {
      screenshot: true,
    },
  };

  const result = await controller.executeNavigate(step);

  assertExists(result);
  assertEquals((result as any).navigated, true);
  assertExists((result as any).screenshot);
  assertEquals((result as any).screenshot.length, 4);
});

Deno.test("BrowserController - executeNavigate throws without browser engine", async () => {
  const controller = new BrowserController();

  const step: NavigateStep = {
    ...createBaseStep(),
    type: ExecutionStepType.NAVIGATE,
    url: "https://example.com",
  };

  await assertRejects(
    async () => await controller.executeNavigate(step),
    Error,
    "Browser engine not configured"
  );
});

Deno.test("BrowserController - executeNavigate reuses existing page", async () => {
  let newPageCallCount = 0;
  const mockEngine: BrowserEngine = {
    newPage: async () => {
      newPageCallCount++;
      return createMockBrowserPage();
    },
    close: async () => {},
  };
  const controller = new BrowserController(mockEngine);

  const step: NavigateStep = {
    ...createBaseStep(),
    type: ExecutionStepType.NAVIGATE,
    url: "https://example.com",
  };

  // First navigation - creates page
  await controller.executeNavigate(step);
  assertEquals(newPageCallCount, 1);

  // Second navigation - reuses page
  await controller.executeNavigate({ ...step, url: "https://example.org" });
  assertEquals(newPageCallCount, 1);
});

// ============================================================================
// executeDOMQuery Tests
// ============================================================================

Deno.test("BrowserController - executeDOMQuery extracts fields from elements", async () => {
  const elements = [
    createMockDOMElement("Hello World", new Map([["href", "https://link1.com"]])),
    createMockDOMElement("Goodbye World", new Map([["href", "https://link2.com"]])),
  ];
  const mockPage = createMockBrowserPage({ elements });
  const mockEngine = createMockBrowserEngine(mockPage);
  const controller = new BrowserController(mockEngine);

  // Navigate first to create a page
  await controller.executeNavigate({
    ...createBaseStep(),
    type: ExecutionStepType.NAVIGATE,
    url: "https://example.com",
  });

  const step: DOMQueryStep = {
    ...createBaseStep({ id: "step-2" }),
    type: ExecutionStepType.DOM_QUERY,
    selector: ".item",
    selectorType: "css",
    extractFields: [
      {
        name: "content",
        expression: { type: "IDENTIFIER", name: "text" },
      },
    ],
  };

  const result = await controller.executeDOMQuery(step);

  assertExists(result);
  assert(Array.isArray(result));
  assertEquals((result as any[]).length, 2);
  assertEquals((result as any[])[0].content, "Hello World");
  assertEquals((result as any[])[1].content, "Goodbye World");
});

Deno.test("BrowserController - executeDOMQuery with empty results", async () => {
  const mockPage = createMockBrowserPage({ elements: [] });
  const mockEngine = createMockBrowserEngine(mockPage);
  const controller = new BrowserController(mockEngine);

  await controller.executeNavigate({
    ...createBaseStep(),
    type: ExecutionStepType.NAVIGATE,
    url: "https://example.com",
  });

  const step: DOMQueryStep = {
    ...createBaseStep({ id: "step-2" }),
    type: ExecutionStepType.DOM_QUERY,
    selector: ".nonexistent",
    selectorType: "css",
    extractFields: [
      {
        name: "text",
        expression: { type: "IDENTIFIER", name: "text" },
      },
    ],
  };

  const result = await controller.executeDOMQuery(step);

  assertExists(result);
  assert(Array.isArray(result));
  assertEquals((result as any[]).length, 0);
});

Deno.test("BrowserController - executeDOMQuery throws without page", async () => {
  const controller = new BrowserController();

  const step: DOMQueryStep = {
    ...createBaseStep(),
    type: ExecutionStepType.DOM_QUERY,
    selector: ".item",
    selectorType: "css",
    extractFields: [],
  };

  await assertRejects(
    async () => await controller.executeDOMQuery(step),
    Error,
    "No page available for DOM query"
  );
});

Deno.test("BrowserController - executeDOMQuery with xpath selector", async () => {
  const elements = [createMockDOMElement("XPath Result")];
  const mockPage = createMockBrowserPage({ elements });
  const mockEngine = createMockBrowserEngine(mockPage);
  const controller = new BrowserController(mockEngine);

  await controller.executeNavigate({
    ...createBaseStep(),
    type: ExecutionStepType.NAVIGATE,
    url: "https://example.com",
  });

  const step: DOMQueryStep = {
    ...createBaseStep({ id: "step-2" }),
    type: ExecutionStepType.DOM_QUERY,
    selector: "//div[@class='item']",
    selectorType: "xpath",
    extractFields: [
      {
        name: "content",
        expression: { type: "IDENTIFIER", name: "text" },
      },
    ],
  };

  const result = await controller.executeDOMQuery(step);

  assertEquals((result as any[])[0].content, "XPath Result");
});

Deno.test("BrowserController - executeDOMQuery extracts multiple fields", async () => {
  const elements = [
    createMockDOMElement("Article Title", new Map([
      ["href", "https://article.com"],
      ["data-id", "123"],
    ])),
  ];
  const mockPage = createMockBrowserPage({ elements });
  const mockEngine = createMockBrowserEngine(mockPage);
  const controller = new BrowserController(mockEngine);

  await controller.executeNavigate({
    ...createBaseStep(),
    type: ExecutionStepType.NAVIGATE,
    url: "https://example.com",
  });

  const step: DOMQueryStep = {
    ...createBaseStep({ id: "step-2" }),
    type: ExecutionStepType.DOM_QUERY,
    selector: "article",
    selectorType: "css",
    extractFields: [
      {
        name: "title",
        expression: { type: "IDENTIFIER", name: "text" },
      },
      {
        name: "link",
        expression: { type: "IDENTIFIER", name: "href" },
      },
      {
        name: "id",
        expression: { type: "IDENTIFIER", name: "data-id" },
      },
    ],
  };

  const result = await controller.executeDOMQuery(step);

  assertEquals((result as any[])[0].title, "Article Title");
  assertEquals((result as any[])[0].link, "https://article.com");
  assertEquals((result as any[])[0].id, "123");
});

// ============================================================================
// executeClick Tests
// ============================================================================

Deno.test("BrowserController - executeClick clicks element", async () => {
  const clickedSelectors: string[] = [];
  const mockPage = createMockBrowserPage({ clickedSelectors });
  const mockEngine = createMockBrowserEngine(mockPage);
  const controller = new BrowserController(mockEngine);

  await controller.executeNavigate({
    ...createBaseStep(),
    type: ExecutionStepType.NAVIGATE,
    url: "https://example.com",
  });

  const step: ClickStep = {
    ...createBaseStep({ id: "step-2" }),
    type: ExecutionStepType.CLICK,
    selector: "#submit-button",
    selectorType: "css",
  };

  await controller.executeClick(step);

  assertEquals(clickedSelectors.length, 1);
  assertEquals(clickedSelectors[0], "#submit-button");
});

Deno.test("BrowserController - executeClick with waitForNavigation", async () => {
  const clickedSelectors: string[] = [];
  const waitCalls: WaitOptions[] = [];
  const mockPage = createMockBrowserPage({ clickedSelectors, waitCalls });
  const mockEngine = createMockBrowserEngine(mockPage);
  const controller = new BrowserController(mockEngine);

  await controller.executeNavigate({
    ...createBaseStep(),
    type: ExecutionStepType.NAVIGATE,
    url: "https://example.com",
  });

  const step: ClickStep = {
    ...createBaseStep({ id: "step-2" }),
    type: ExecutionStepType.CLICK,
    selector: "a.link",
    selectorType: "css",
    waitForNavigation: true,
  };

  await controller.executeClick(step);

  assertEquals(clickedSelectors.length, 1);
  assertEquals(waitCalls.length, 1);
  assertEquals(waitCalls[0].type, "time");
  assertEquals(waitCalls[0].duration, 1000);
});

Deno.test("BrowserController - executeClick without waitForNavigation", async () => {
  const waitCalls: WaitOptions[] = [];
  const mockPage = createMockBrowserPage({ waitCalls });
  const mockEngine = createMockBrowserEngine(mockPage);
  const controller = new BrowserController(mockEngine);

  await controller.executeNavigate({
    ...createBaseStep(),
    type: ExecutionStepType.NAVIGATE,
    url: "https://example.com",
  });

  const step: ClickStep = {
    ...createBaseStep({ id: "step-2" }),
    type: ExecutionStepType.CLICK,
    selector: "button",
    selectorType: "css",
    waitForNavigation: false,
  };

  await controller.executeClick(step);

  assertEquals(waitCalls.length, 0);
});

Deno.test("BrowserController - executeClick throws without page", async () => {
  const controller = new BrowserController();

  const step: ClickStep = {
    ...createBaseStep(),
    type: ExecutionStepType.CLICK,
    selector: "button",
    selectorType: "css",
  };

  await assertRejects(
    async () => await controller.executeClick(step),
    Error,
    "No page available for click"
  );
});

Deno.test("BrowserController - executeClick with xpath selector", async () => {
  const clickedSelectors: string[] = [];
  const mockPage = createMockBrowserPage({ clickedSelectors });
  const mockEngine = createMockBrowserEngine(mockPage);
  const controller = new BrowserController(mockEngine);

  await controller.executeNavigate({
    ...createBaseStep(),
    type: ExecutionStepType.NAVIGATE,
    url: "https://example.com",
  });

  const step: ClickStep = {
    ...createBaseStep({ id: "step-2" }),
    type: ExecutionStepType.CLICK,
    selector: "//button[@id='submit']",
    selectorType: "xpath",
  };

  await controller.executeClick(step);

  assertEquals(clickedSelectors[0], "//button[@id='submit']");
});

// ============================================================================
// executeType Tests
// ============================================================================

Deno.test("BrowserController - executeType types text into element", async () => {
  const typedInputs: { selector: string; text: string; options?: TypeOptions }[] = [];
  const mockPage = createMockBrowserPage({ typedInputs });
  const mockEngine = createMockBrowserEngine(mockPage);
  const controller = new BrowserController(mockEngine);

  await controller.executeNavigate({
    ...createBaseStep(),
    type: ExecutionStepType.NAVIGATE,
    url: "https://example.com",
  });

  const step: TypeStep = {
    ...createBaseStep({ id: "step-2" }),
    type: ExecutionStepType.TYPE,
    selector: "#username",
    selectorType: "css",
    text: "testuser",
  };

  await controller.executeType(step);

  assertEquals(typedInputs.length, 1);
  assertEquals(typedInputs[0].selector, "#username");
  assertEquals(typedInputs[0].text, "testuser");
});

Deno.test("BrowserController - executeType with clear option", async () => {
  const typedInputs: { selector: string; text: string; options?: TypeOptions }[] = [];
  const mockPage = createMockBrowserPage({ typedInputs });
  const mockEngine = createMockBrowserEngine(mockPage);
  const controller = new BrowserController(mockEngine);

  await controller.executeNavigate({
    ...createBaseStep(),
    type: ExecutionStepType.NAVIGATE,
    url: "https://example.com",
  });

  const step: TypeStep = {
    ...createBaseStep({ id: "step-2" }),
    type: ExecutionStepType.TYPE,
    selector: "#email",
    selectorType: "css",
    text: "test@example.com",
    clear: true,
  };

  await controller.executeType(step);

  assertEquals(typedInputs[0].options?.clear, true);
});

Deno.test("BrowserController - executeType with delay option", async () => {
  const typedInputs: { selector: string; text: string; options?: TypeOptions }[] = [];
  const mockPage = createMockBrowserPage({ typedInputs });
  const mockEngine = createMockBrowserEngine(mockPage);
  const controller = new BrowserController(mockEngine);

  await controller.executeNavigate({
    ...createBaseStep(),
    type: ExecutionStepType.NAVIGATE,
    url: "https://example.com",
  });

  const step: TypeStep = {
    ...createBaseStep({ id: "step-2" }),
    type: ExecutionStepType.TYPE,
    selector: "#password",
    selectorType: "css",
    text: "secretpass",
    delay: 50,
  };

  await controller.executeType(step);

  assertEquals(typedInputs[0].options?.delay, 50);
});

Deno.test("BrowserController - executeType throws without page", async () => {
  const controller = new BrowserController();

  const step: TypeStep = {
    ...createBaseStep(),
    type: ExecutionStepType.TYPE,
    selector: "#input",
    selectorType: "css",
    text: "test",
  };

  await assertRejects(
    async () => await controller.executeType(step),
    Error,
    "No page available for typing"
  );
});

// ============================================================================
// executeWait Tests
// ============================================================================

Deno.test("BrowserController - executeWait with time type", async () => {
  const waitCalls: WaitOptions[] = [];
  const mockPage = createMockBrowserPage({ waitCalls });
  const mockEngine = createMockBrowserEngine(mockPage);
  const controller = new BrowserController(mockEngine);

  await controller.executeNavigate({
    ...createBaseStep(),
    type: ExecutionStepType.NAVIGATE,
    url: "https://example.com",
  });

  const step: WaitStep = {
    ...createBaseStep({ id: "step-2" }),
    type: ExecutionStepType.WAIT,
    waitType: "time",
    duration: 2000,
  };

  await controller.executeWait(step);

  assertEquals(waitCalls.length, 1);
  assertEquals(waitCalls[0].type, "time");
  assertEquals(waitCalls[0].duration, 2000);
});

Deno.test("BrowserController - executeWait with selector type", async () => {
  const waitCalls: WaitOptions[] = [];
  const mockPage = createMockBrowserPage({ waitCalls });
  const mockEngine = createMockBrowserEngine(mockPage);
  const controller = new BrowserController(mockEngine);

  await controller.executeNavigate({
    ...createBaseStep(),
    type: ExecutionStepType.NAVIGATE,
    url: "https://example.com",
  });

  const step: WaitStep = {
    ...createBaseStep({ id: "step-2" }),
    type: ExecutionStepType.WAIT,
    waitType: "selector",
    selector: "#loaded",
  };

  await controller.executeWait(step);

  assertEquals(waitCalls[0].type, "selector");
  assertEquals(waitCalls[0].selector, "#loaded");
});

Deno.test("BrowserController - executeWait with function type", async () => {
  const waitCalls: WaitOptions[] = [];
  const mockPage = createMockBrowserPage({ waitCalls });
  const mockEngine = createMockBrowserEngine(mockPage);
  const controller = new BrowserController(mockEngine);

  await controller.executeNavigate({
    ...createBaseStep(),
    type: ExecutionStepType.NAVIGATE,
    url: "https://example.com",
  });

  const step: WaitStep = {
    ...createBaseStep({ id: "step-2" }),
    type: ExecutionStepType.WAIT,
    waitType: "function",
    condition: "document.readyState === 'complete'",
  };

  await controller.executeWait(step);

  assertEquals(waitCalls[0].type, "function");
  assertEquals(waitCalls[0].condition, "document.readyState === 'complete'");
});

Deno.test("BrowserController - executeWait throws without page", async () => {
  const controller = new BrowserController();

  const step: WaitStep = {
    ...createBaseStep(),
    type: ExecutionStepType.WAIT,
    waitType: "time",
    duration: 1000,
  };

  await assertRejects(
    async () => await controller.executeWait(step),
    Error,
    "No page available for wait"
  );
});

// ============================================================================
// executeScreenshot Tests
// ============================================================================

Deno.test("BrowserController - executeScreenshot takes screenshot", async () => {
  const screenshotData = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]); // PNG header
  const mockPage = createMockBrowserPage({ screenshotResult: screenshotData });
  const mockEngine = createMockBrowserEngine(mockPage);
  const controller = new BrowserController(mockEngine);

  await controller.executeNavigate({
    ...createBaseStep(),
    type: ExecutionStepType.NAVIGATE,
    url: "https://example.com",
  });

  const step: ScreenshotStep = {
    ...createBaseStep({ id: "step-2" }),
    type: ExecutionStepType.SCREENSHOT,
  };

  const result = await controller.executeScreenshot(step);

  assertExists(result);
  assert(result instanceof Uint8Array);
  assertEquals(result.length, 8);
  assertEquals(result[0], 137); // PNG magic number
});

Deno.test("BrowserController - executeScreenshot with fullPage option", async () => {
  const mockPage = createMockBrowserPage();
  const mockEngine = createMockBrowserEngine(mockPage);
  const controller = new BrowserController(mockEngine);

  await controller.executeNavigate({
    ...createBaseStep(),
    type: ExecutionStepType.NAVIGATE,
    url: "https://example.com",
  });

  const step: ScreenshotStep = {
    ...createBaseStep({ id: "step-2" }),
    type: ExecutionStepType.SCREENSHOT,
    fullPage: true,
  };

  const result = await controller.executeScreenshot(step);

  assertExists(result);
});

Deno.test("BrowserController - executeScreenshot with selector option", async () => {
  const mockPage = createMockBrowserPage();
  const mockEngine = createMockBrowserEngine(mockPage);
  const controller = new BrowserController(mockEngine);

  await controller.executeNavigate({
    ...createBaseStep(),
    type: ExecutionStepType.NAVIGATE,
    url: "https://example.com",
  });

  const step: ScreenshotStep = {
    ...createBaseStep({ id: "step-2" }),
    type: ExecutionStepType.SCREENSHOT,
    selector: "#main-content",
  };

  const result = await controller.executeScreenshot(step);

  assertExists(result);
});

Deno.test("BrowserController - executeScreenshot with format and quality", async () => {
  const mockPage = createMockBrowserPage();
  const mockEngine = createMockBrowserEngine(mockPage);
  const controller = new BrowserController(mockEngine);

  await controller.executeNavigate({
    ...createBaseStep(),
    type: ExecutionStepType.NAVIGATE,
    url: "https://example.com",
  });

  const step: ScreenshotStep = {
    ...createBaseStep({ id: "step-2" }),
    type: ExecutionStepType.SCREENSHOT,
    format: "jpeg",
    quality: 80,
  };

  const result = await controller.executeScreenshot(step);

  assertExists(result);
});

Deno.test("BrowserController - executeScreenshot throws without page", async () => {
  const controller = new BrowserController();

  const step: ScreenshotStep = {
    ...createBaseStep(),
    type: ExecutionStepType.SCREENSHOT,
  };

  await assertRejects(
    async () => await controller.executeScreenshot(step),
    Error,
    "No page available for screenshot"
  );
});

// ============================================================================
// executePDF Tests
// ============================================================================

Deno.test("BrowserController - executePDF generates PDF", async () => {
  const pdfData = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52]); // %PDF-1.4
  const mockPage = createMockBrowserPage({ pdfResult: pdfData });
  const mockEngine = createMockBrowserEngine(mockPage);
  const controller = new BrowserController(mockEngine);

  await controller.executeNavigate({
    ...createBaseStep(),
    type: ExecutionStepType.NAVIGATE,
    url: "https://example.com",
  });

  const step: PDFStep = {
    ...createBaseStep({ id: "step-2" }),
    type: ExecutionStepType.PDF,
  };

  const result = await controller.executePDF(step);

  assertExists(result);
  assert(result instanceof Uint8Array);
  assertEquals(result[0], 37); // % character
});

Deno.test("BrowserController - executePDF with format option", async () => {
  const mockPage = createMockBrowserPage();
  const mockEngine = createMockBrowserEngine(mockPage);
  const controller = new BrowserController(mockEngine);

  await controller.executeNavigate({
    ...createBaseStep(),
    type: ExecutionStepType.NAVIGATE,
    url: "https://example.com",
  });

  const step: PDFStep = {
    ...createBaseStep({ id: "step-2" }),
    type: ExecutionStepType.PDF,
    format: "Letter",
  };

  const result = await controller.executePDF(step);

  assertExists(result);
});

Deno.test("BrowserController - executePDF with landscape option", async () => {
  const mockPage = createMockBrowserPage();
  const mockEngine = createMockBrowserEngine(mockPage);
  const controller = new BrowserController(mockEngine);

  await controller.executeNavigate({
    ...createBaseStep(),
    type: ExecutionStepType.NAVIGATE,
    url: "https://example.com",
  });

  const step: PDFStep = {
    ...createBaseStep({ id: "step-2" }),
    type: ExecutionStepType.PDF,
    format: "A4",
    landscape: true,
  };

  const result = await controller.executePDF(step);

  assertExists(result);
});

Deno.test("BrowserController - executePDF with margin options", async () => {
  const mockPage = createMockBrowserPage();
  const mockEngine = createMockBrowserEngine(mockPage);
  const controller = new BrowserController(mockEngine);

  await controller.executeNavigate({
    ...createBaseStep(),
    type: ExecutionStepType.NAVIGATE,
    url: "https://example.com",
  });

  const step: PDFStep = {
    ...createBaseStep({ id: "step-2" }),
    type: ExecutionStepType.PDF,
    margin: {
      top: 20,
      right: 15,
      bottom: 20,
      left: 15,
    },
  };

  const result = await controller.executePDF(step);

  assertExists(result);
});

Deno.test("BrowserController - executePDF throws without page", async () => {
  const controller = new BrowserController();

  const step: PDFStep = {
    ...createBaseStep(),
    type: ExecutionStepType.PDF,
  };

  await assertRejects(
    async () => await controller.executePDF(step),
    Error,
    "No page available for PDF generation"
  );
});

// ============================================================================
// executeEvaluateJS Tests
// ============================================================================

Deno.test("BrowserController - executeEvaluateJS executes script", async () => {
  const mockPage = createMockBrowserPage({ evaluateResult: 42 });
  const mockEngine = createMockBrowserEngine(mockPage);
  const controller = new BrowserController(mockEngine);

  await controller.executeNavigate({
    ...createBaseStep(),
    type: ExecutionStepType.NAVIGATE,
    url: "https://example.com",
  });

  const step: EvaluateJSStep = {
    ...createBaseStep({ id: "step-2" }),
    type: ExecutionStepType.EVALUATE_JS,
    script: "return 40 + 2",
  };

  const result = await controller.executeEvaluateJS(step);

  assertEquals(result, 42);
});

Deno.test("BrowserController - executeEvaluateJS with arguments", async () => {
  const mockPage = createMockBrowserPage({ evaluateResult: "hello-world" });
  const mockEngine = createMockBrowserEngine(mockPage);
  const controller = new BrowserController(mockEngine);

  await controller.executeNavigate({
    ...createBaseStep(),
    type: ExecutionStepType.NAVIGATE,
    url: "https://example.com",
  });

  const step: EvaluateJSStep = {
    ...createBaseStep({ id: "step-2" }),
    type: ExecutionStepType.EVALUATE_JS,
    script: "(a, b) => a + '-' + b",
    args: ["hello", "world"],
  };

  const result = await controller.executeEvaluateJS(step);

  assertEquals(result, "hello-world");
});

Deno.test("BrowserController - executeEvaluateJS returns object", async () => {
  const mockPage = createMockBrowserPage({
    evaluateResult: { title: "Test", count: 5 },
  });
  const mockEngine = createMockBrowserEngine(mockPage);
  const controller = new BrowserController(mockEngine);

  await controller.executeNavigate({
    ...createBaseStep(),
    type: ExecutionStepType.NAVIGATE,
    url: "https://example.com",
  });

  const step: EvaluateJSStep = {
    ...createBaseStep({ id: "step-2" }),
    type: ExecutionStepType.EVALUATE_JS,
    script: "() => ({ title: document.title, count: 5 })",
  };

  const result = await controller.executeEvaluateJS(step);

  assertEquals((result as any).title, "Test");
  assertEquals((result as any).count, 5);
});

Deno.test("BrowserController - executeEvaluateJS returns array", async () => {
  const mockPage = createMockBrowserPage({
    evaluateResult: [1, 2, 3, 4, 5],
  });
  const mockEngine = createMockBrowserEngine(mockPage);
  const controller = new BrowserController(mockEngine);

  await controller.executeNavigate({
    ...createBaseStep(),
    type: ExecutionStepType.NAVIGATE,
    url: "https://example.com",
  });

  const step: EvaluateJSStep = {
    ...createBaseStep({ id: "step-2" }),
    type: ExecutionStepType.EVALUATE_JS,
    script: "Array.from({length: 5}, (_, i) => i + 1)",
  };

  const result = await controller.executeEvaluateJS(step);

  assert(Array.isArray(result));
  assertEquals((result as number[]).length, 5);
});

Deno.test("BrowserController - executeEvaluateJS throws without page", async () => {
  const controller = new BrowserController();

  const step: EvaluateJSStep = {
    ...createBaseStep(),
    type: ExecutionStepType.EVALUATE_JS,
    script: "return 1",
  };

  await assertRejects(
    async () => await controller.executeEvaluateJS(step),
    Error,
    "No page available for JavaScript evaluation"
  );
});

// ============================================================================
// Page Management Tests
// ============================================================================

Deno.test("BrowserController - closePage closes and clears page", async () => {
  let pageClosed = false;
  const mockPage: BrowserPage = {
    ...createMockBrowserPage(),
    close: async () => {
      pageClosed = true;
    },
  };
  const mockEngine = createMockBrowserEngine(mockPage);
  const controller = new BrowserController(mockEngine);

  await controller.executeNavigate({
    ...createBaseStep(),
    type: ExecutionStepType.NAVIGATE,
    url: "https://example.com",
  });

  assertExists(controller.getCurrentPage());

  await controller.closePage();

  assertEquals(pageClosed, true);
  assertEquals(controller.getCurrentPage(), undefined);
});

Deno.test("BrowserController - closePage does nothing without page", async () => {
  const controller = new BrowserController();

  assertEquals(controller.getCurrentPage(), undefined);

  // Should not throw
  await controller.closePage();

  assertEquals(controller.getCurrentPage(), undefined);
});

Deno.test("BrowserController - getCurrentPage returns current page", async () => {
  const mockPage = createMockBrowserPage();
  const mockEngine = createMockBrowserEngine(mockPage);
  const controller = new BrowserController(mockEngine);

  assertEquals(controller.getCurrentPage(), undefined);

  await controller.executeNavigate({
    ...createBaseStep(),
    type: ExecutionStepType.NAVIGATE,
    url: "https://example.com",
  });

  assertExists(controller.getCurrentPage());
});

Deno.test("BrowserController - getBrowserEngine returns engine", () => {
  const mockEngine = createMockBrowserEngine();
  const controller = new BrowserController(mockEngine);

  const engine = controller.getBrowserEngine();

  assertExists(engine);
  assertEquals(engine, mockEngine);
});

Deno.test("BrowserController - getBrowserEngine returns undefined without engine", () => {
  const controller = new BrowserController();

  assertEquals(controller.getBrowserEngine(), undefined);
});

// ============================================================================
// Complex Workflow Tests
// ============================================================================

Deno.test("BrowserController - complex workflow: navigate, query, click, type", async () => {
  const navigatedUrls: string[] = [];
  const clickedSelectors: string[] = [];
  const typedInputs: { selector: string; text: string }[] = [];
  const elements = [createMockDOMElement("Login Form")];

  const mockPage: BrowserPage = {
    navigate: async (url: URLString) => {
      navigatedUrls.push(url);
    },
    query: async () => elements,
    click: async (selector: string) => {
      clickedSelectors.push(selector);
    },
    type: async (selector: string, text: string) => {
      typedInputs.push({ selector, text });
    },
    wait: async () => {},
    screenshot: async () => new Uint8Array(),
    pdf: async () => new Uint8Array(),
    evaluate: async () => undefined,
    close: async () => {},
    getCurrentURL: () => undefined,
  };

  const mockEngine = createMockBrowserEngine(mockPage);
  const controller = new BrowserController(mockEngine);

  // Step 1: Navigate
  await controller.executeNavigate({
    ...createBaseStep({ id: "step-1" }),
    type: ExecutionStepType.NAVIGATE,
    url: "https://example.com/login",
  });

  // Step 2: Query DOM
  const queryResult = await controller.executeDOMQuery({
    ...createBaseStep({ id: "step-2" }),
    type: ExecutionStepType.DOM_QUERY,
    selector: "#login-form",
    selectorType: "css",
    extractFields: [
      { name: "title", expression: { type: "IDENTIFIER", name: "text" } },
    ],
  });

  // Step 3: Type username
  await controller.executeType({
    ...createBaseStep({ id: "step-3" }),
    type: ExecutionStepType.TYPE,
    selector: "#username",
    selectorType: "css",
    text: "testuser",
    clear: true,
  });

  // Step 4: Type password
  await controller.executeType({
    ...createBaseStep({ id: "step-4" }),
    type: ExecutionStepType.TYPE,
    selector: "#password",
    selectorType: "css",
    text: "testpass",
    clear: true,
  });

  // Step 5: Click submit
  await controller.executeClick({
    ...createBaseStep({ id: "step-5" }),
    type: ExecutionStepType.CLICK,
    selector: "#submit",
    selectorType: "css",
    waitForNavigation: true,
  });

  // Verify workflow
  assertEquals(navigatedUrls.length, 1);
  assertEquals(navigatedUrls[0], "https://example.com/login");

  assertEquals((queryResult as any[])[0].title, "Login Form");

  assertEquals(typedInputs.length, 2);
  assertEquals(typedInputs[0].selector, "#username");
  assertEquals(typedInputs[0].text, "testuser");
  assertEquals(typedInputs[1].selector, "#password");
  assertEquals(typedInputs[1].text, "testpass");

  assertEquals(clickedSelectors.length, 1);
  assertEquals(clickedSelectors[0], "#submit");
});

Deno.test("BrowserController - multiple navigations", async () => {
  const navigatedUrls: string[] = [];
  const mockPage = createMockBrowserPage({ navigatedUrls });
  const mockEngine = createMockBrowserEngine(mockPage);
  const controller = new BrowserController(mockEngine);

  const urls = [
    "https://example.com/page1",
    "https://example.com/page2",
    "https://example.com/page3",
  ];

  for (const url of urls) {
    await controller.executeNavigate({
      ...createBaseStep(),
      type: ExecutionStepType.NAVIGATE,
      url,
    });
  }

  assertEquals(navigatedUrls.length, 3);
  assertEquals(navigatedUrls, urls);
});

Deno.test("BrowserController - screenshot after navigation", async () => {
  const screenshotData = new Uint8Array([1, 2, 3, 4, 5]);
  const mockPage = createMockBrowserPage({ screenshotResult: screenshotData });
  const mockEngine = createMockBrowserEngine(mockPage);
  const controller = new BrowserController(mockEngine);

  await controller.executeNavigate({
    ...createBaseStep({ id: "step-1" }),
    type: ExecutionStepType.NAVIGATE,
    url: "https://example.com",
  });

  const result = await controller.executeScreenshot({
    ...createBaseStep({ id: "step-2" }),
    type: ExecutionStepType.SCREENSHOT,
    fullPage: true,
    format: "png",
  });

  assertEquals(result, screenshotData);
});

// ============================================================================
// Interface Tests
// ============================================================================

Deno.test("NavigateOptions - all properties", () => {
  const options: NavigateOptions = {
    waitFor: "networkidle",
    timeout: 60000,
  };

  assertEquals(options.waitFor, "networkidle");
  assertEquals(options.timeout, 60000);
});

Deno.test("TypeOptions - all properties", () => {
  const options: TypeOptions = {
    clear: true,
    delay: 100,
  };

  assertEquals(options.clear, true);
  assertEquals(options.delay, 100);
});

Deno.test("WaitOptions - time type", () => {
  const options: WaitOptions = {
    type: "time",
    duration: 5000,
    timeout: 30000,
  };

  assertEquals(options.type, "time");
  assertEquals(options.duration, 5000);
});

Deno.test("WaitOptions - selector type", () => {
  const options: WaitOptions = {
    type: "selector",
    selector: "#element",
    selectorType: "css",
    timeout: 30000,
  };

  assertEquals(options.type, "selector");
  assertEquals(options.selector, "#element");
  assertEquals(options.selectorType, "css");
});

Deno.test("WaitOptions - function type", () => {
  const options: WaitOptions = {
    type: "function",
    condition: "window.loaded === true",
    timeout: 30000,
  };

  assertEquals(options.type, "function");
  assertEquals(options.condition, "window.loaded === true");
});

Deno.test("ScreenshotOptions - all properties", () => {
  const options: ScreenshotOptions = {
    fullPage: true,
    selector: "#main",
    format: "jpeg",
    quality: 90,
  };

  assertEquals(options.fullPage, true);
  assertEquals(options.selector, "#main");
  assertEquals(options.format, "jpeg");
  assertEquals(options.quality, 90);
});

Deno.test("PDFOptions - all properties", () => {
  const options: PDFOptions = {
    format: "A4",
    landscape: false,
    margin: {
      top: 10,
      right: 10,
      bottom: 10,
      left: 10,
    },
  };

  assertEquals(options.format, "A4");
  assertEquals(options.landscape, false);
  assertEquals(options.margin?.top, 10);
  assertEquals(options.margin?.right, 10);
  assertEquals(options.margin?.bottom, 10);
  assertEquals(options.margin?.left, 10);
});

// ============================================================================
// DOMElement Interface Tests
// ============================================================================

Deno.test("DOMElement - getText returns text content", async () => {
  const element = createMockDOMElement("Hello World");

  const text = await element.getText();

  assertEquals(text, "Hello World");
});

Deno.test("DOMElement - getAttribute returns attribute value", async () => {
  const element = createMockDOMElement("Link", new Map([["href", "https://example.com"]]));

  const href = await element.getAttribute("href");

  assertEquals(href, "https://example.com");
});

Deno.test("DOMElement - getAttribute returns null for missing attribute", async () => {
  const element = createMockDOMElement("Text");

  const result = await element.getAttribute("nonexistent");

  assertEquals(result, null);
});

Deno.test("DOMElement - getProperty returns property value", async () => {
  const element = createMockDOMElement("Content");

  const innerText = await element.getProperty("innerText");
  const tagName = await element.getProperty("tagName");

  assertEquals(innerText, "Content");
  assertEquals(tagName, "DIV");
});

Deno.test("DOMElement - getInternalElement returns internal element", () => {
  const element = createMockDOMElement("Test", new Map([["id", "test-id"]]));

  const internal = element.getInternalElement();

  assertExists(internal);
  assertEquals(internal.innerText, "Test");
});

/**
 * BrowserController tests
 */
import { assertEquals, assertRejects } from "@std/assert";
import {
  BrowserController,
  type BrowserEngine,
  type BrowserPage,
  type DOMElement,
} from "../../../../controllers/browser/browser-controller.ts";
import { ExecutionStepType } from "../../../../planner/plan.ts";

function createMockElement(text = "hello", attrs: Record<string, string> = {}): DOMElement {
  const attrMap = new Map(Object.entries(attrs));
  return {
    getText: () => Promise.resolve(text),
    getAttribute: (name: string) => Promise.resolve(attrs[name] ?? null),
    getProperty: (name: string) => Promise.resolve(attrs[name] ?? null),
    click: () => Promise.resolve(),
    type: (_text: string) => Promise.resolve(),
    getInternalElement: () => ({ attributes: attrMap }),
  };
}

function createMockPage(overrides: Partial<BrowserPage> = {}): BrowserPage {
  return {
    navigate: () => Promise.resolve(),
    query: () => Promise.resolve([]),
    click: () => Promise.resolve(),
    type: () => Promise.resolve(),
    wait: () => Promise.resolve(),
    screenshot: () => Promise.resolve(new Uint8Array([1, 2, 3])),
    pdf: () => Promise.resolve(new Uint8Array([4, 5, 6])),
    evaluate: () => Promise.resolve(42),
    close: () => Promise.resolve(),
    getCurrentURL: () => "https://example.com",
    getMetadata: () => Promise.resolve({ title: "Test" }),
    ...overrides,
  };
}

function createMockEngine(page?: BrowserPage): BrowserEngine {
  return {
    newPage: () => Promise.resolve(page ?? createMockPage()),
    close: () => Promise.resolve(),
  };
}

Deno.test("BrowserController - construction without engine", () => {
  const ctrl = new BrowserController();
  assertEquals(ctrl.getBrowserEngine(), undefined);
  assertEquals(ctrl.getCurrentPage(), undefined);
});

Deno.test("BrowserController - construction with engine", () => {
  const engine = createMockEngine();
  const ctrl = new BrowserController(engine);
  assertEquals(ctrl.getBrowserEngine(), engine);
});

Deno.test("BrowserController - executeNavigate creates page and navigates", async () => {
  let navigatedUrl = "";
  const page = createMockPage({
    navigate: (url) => { navigatedUrl = url; return Promise.resolve(); },
  });
  const ctrl = new BrowserController(createMockEngine(page));

  const result = await ctrl.executeNavigate({
    type: ExecutionStepType.NAVIGATE,
    url: "https://example.com",
    description: "nav",
  });

  assertEquals(navigatedUrl, "https://example.com");
  assertEquals((result as Record<string, unknown>).navigated, true);
});

Deno.test("BrowserController - executeNavigate without engine throws", async () => {
  const ctrl = new BrowserController();
  await assertRejects(
    () => ctrl.executeNavigate({ type: ExecutionStepType.NAVIGATE, url: "https://x.com", description: "nav" }),
    Error,
    "Browser engine not configured",
  );
});

Deno.test("BrowserController - executeNavigate with screenshot option", async () => {
  const page = createMockPage();
  const ctrl = new BrowserController(createMockEngine(page));

  const result = await ctrl.executeNavigate({
    type: ExecutionStepType.NAVIGATE,
    url: "https://example.com",
    description: "nav",
    options: { screenshot: true },
  });

  assertEquals((result as Record<string, unknown>).screenshot instanceof Uint8Array, true);
});

Deno.test("BrowserController - executeDOMQuery without page throws", async () => {
  const ctrl = new BrowserController();
  await assertRejects(
    () => ctrl.executeDOMQuery({
      type: ExecutionStepType.DOM_QUERY,
      selector: "h1",
      selectorType: "css",
      extractFields: [],
      description: "query",
    }),
    Error,
    "No page available",
  );
});

Deno.test("BrowserController - executeClick delegates to page", async () => {
  let clickedSelector = "";
  const page = createMockPage({
    click: (sel) => { clickedSelector = sel; return Promise.resolve(); },
  });
  const ctrl = new BrowserController(createMockEngine(page));
  await ctrl.executeNavigate({ type: ExecutionStepType.NAVIGATE, url: "https://x.com", description: "nav" });

  await ctrl.executeClick({
    type: ExecutionStepType.CLICK,
    selector: "#btn",
    selectorType: "css",
    description: "click",
  });

  assertEquals(clickedSelector, "#btn");
});

Deno.test("BrowserController - executeType delegates to page", async () => {
  let typedText = "";
  const page = createMockPage({
    type: (_sel, text) => { typedText = text; return Promise.resolve(); },
  });
  const ctrl = new BrowserController(createMockEngine(page));
  await ctrl.executeNavigate({ type: ExecutionStepType.NAVIGATE, url: "https://x.com", description: "nav" });

  await ctrl.executeType({
    type: ExecutionStepType.TYPE,
    selector: "#input",
    selectorType: "css",
    text: "hello",
    description: "type",
  });

  assertEquals(typedText, "hello");
});

Deno.test("BrowserController - executeScreenshot returns bytes", async () => {
  const page = createMockPage();
  const ctrl = new BrowserController(createMockEngine(page));
  await ctrl.executeNavigate({ type: ExecutionStepType.NAVIGATE, url: "https://x.com", description: "nav" });

  const result = await ctrl.executeScreenshot({
    type: ExecutionStepType.SCREENSHOT,
    fullPage: true,
    format: "png",
    description: "screenshot",
  });

  assertEquals(result instanceof Uint8Array, true);
});

Deno.test("BrowserController - executePDF returns bytes", async () => {
  const page = createMockPage();
  const ctrl = new BrowserController(createMockEngine(page));
  await ctrl.executeNavigate({ type: ExecutionStepType.NAVIGATE, url: "https://x.com", description: "nav" });

  const result = await ctrl.executePDF({
    type: ExecutionStepType.PDF,
    format: "A4",
    description: "pdf",
  });

  assertEquals(result instanceof Uint8Array, true);
});

Deno.test("BrowserController - executeEvaluateJS delegates to page", async () => {
  const page = createMockPage({
    evaluate: (script) => Promise.resolve(script === "1+1" ? 2 : null),
  });
  const ctrl = new BrowserController(createMockEngine(page));
  await ctrl.executeNavigate({ type: ExecutionStepType.NAVIGATE, url: "https://x.com", description: "nav" });

  const result = await ctrl.executeEvaluateJS({
    type: ExecutionStepType.EVALUATE_JS,
    script: "1+1",
    description: "eval",
  });

  assertEquals(result, 2);
});

Deno.test("BrowserController - closePage clears current page", async () => {
  const page = createMockPage();
  const ctrl = new BrowserController(createMockEngine(page));
  await ctrl.executeNavigate({ type: ExecutionStepType.NAVIGATE, url: "https://x.com", description: "nav" });
  assertEquals(ctrl.getCurrentPage() !== undefined, true);

  await ctrl.closePage();
  assertEquals(ctrl.getCurrentPage(), undefined);
});

Deno.test("BrowserController - abort signal throws", async () => {
  const ac = new AbortController();
  ac.abort(new Error("cancelled"));
  const page = createMockPage();
  const ctrl = new BrowserController(createMockEngine(page));

  await assertRejects(
    () => ctrl.executeNavigate(
      { type: ExecutionStepType.NAVIGATE, url: "https://x.com", description: "nav" },
      { signal: ac.signal },
    ),
    Error,
    "cancelled",
  );
});

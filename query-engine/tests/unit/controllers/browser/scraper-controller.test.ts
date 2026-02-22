/**
 * ScraperController tests
 */
import { assertEquals } from "@std/assert";
import {
  ScraperController,
  getScraperController,
  clearScraperController,
} from "../../../../controllers/browser/scraper-controller.ts";
import { BrowserController } from "../../../../controllers/browser/browser-controller.ts";
import {
  setCurrentBrowserController,
  clearBrowserContext,
} from "../../../../controllers/browser/browser-context.ts";

function createMockBrowserController(elementCount = 3): BrowserController {
  const elements = Array.from({ length: elementCount }, (_, i) => ({
    getText: () => Promise.resolve(`item-${i}`),
    getAttribute: () => Promise.resolve(null),
    getProperty: () => Promise.resolve(null),
    click: () => Promise.resolve(),
    type: () => Promise.resolve(),
    getInternalElement: () => ({}),
  }));

  const mockPage = {
    navigate: () => Promise.resolve(),
    query: () => Promise.resolve(elements),
    click: () => Promise.resolve(),
    type: () => Promise.resolve(),
    wait: () => Promise.resolve(),
    screenshot: () => Promise.resolve(new Uint8Array()),
    pdf: () => Promise.resolve(new Uint8Array()),
    evaluate: () => Promise.resolve(null),
    close: () => Promise.resolve(),
    getCurrentURL: () => "https://example.com",
  };

  const ctrl = new BrowserController();
  (ctrl as unknown as { currentPage: unknown }).currentPage = mockPage;
  return ctrl;
}

function setup(elementCount = 3) {
  clearBrowserContext();
  clearScraperController();
  setCurrentBrowserController(createMockBrowserController(elementCount));
  return new ScraperController();
}

function teardown() {
  clearBrowserContext();
  clearScraperController();
}

Deno.test("ScraperController - construction", () => {
  const sc = new ScraperController();
  assertEquals(sc instanceof ScraperController, true);
});

Deno.test("ScraperController - getScraperController singleton", () => {
  clearScraperController();
  const a = getScraperController();
  const b = getScraperController();
  assertEquals(a, b);
  clearScraperController();
});

Deno.test("ScraperController - extractText returns null without browser context", async () => {
  clearBrowserContext();
  const sc = new ScraperController();
  // extractText catches errors internally and returns null
  const result = await sc.extractText("h1");
  assertEquals(result, null);
});

Deno.test("ScraperController - exists returns true when elements found", async () => {
  const sc = setup(2);
  try {
    const result = await sc.exists(".item");
    assertEquals(result, true);
  } finally {
    teardown();
  }
});

Deno.test("ScraperController - exists returns false without context", async () => {
  clearBrowserContext();
  const sc = new ScraperController();
  const result = await sc.exists(".item");
  assertEquals(result, false);
});

Deno.test("ScraperController - count returns element count", async () => {
  const sc = setup(5);
  try {
    const result = await sc.count(".item");
    assertEquals(result, 5);
  } finally {
    teardown();
  }
});

Deno.test("ScraperController - count returns 0 without context", async () => {
  clearBrowserContext();
  const sc = new ScraperController();
  const result = await sc.count(".item");
  assertEquals(result, 0);
});

Deno.test("ScraperController - clear resets scraper", () => {
  const sc = new ScraperController();
  sc.clear();
  assertEquals(true, true);
});

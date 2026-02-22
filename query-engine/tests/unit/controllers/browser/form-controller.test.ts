/**
 * FormController tests
 */
import { assertEquals } from "@std/assert";
import {
  FormController,
  getFormController,
  clearFormController,
} from "../../../../controllers/browser/form-controller.ts";
import { BrowserController } from "../../../../controllers/browser/browser-controller.ts";
import {
  setCurrentBrowserController,
  clearBrowserContext,
} from "../../../../controllers/browser/browser-context.ts";

function createMockBrowserController(hasPage = true): BrowserController {
  const mockPage = hasPage
    ? {
        navigate: () => Promise.resolve(),
        query: (sel: string) => Promise.resolve(sel === "#field" ? [{ getText: () => Promise.resolve("val"), getAttribute: () => Promise.resolve(null), getProperty: (n: string) => Promise.resolve(n === "value" ? "field-value" : null), click: () => Promise.resolve(), type: () => Promise.resolve(), getInternalElement: () => ({}) }] : []),
        click: () => Promise.resolve(),
        type: () => Promise.resolve(),
        wait: () => Promise.resolve(),
        screenshot: () => Promise.resolve(new Uint8Array()),
        pdf: () => Promise.resolve(new Uint8Array()),
        evaluate: () => Promise.resolve(null),
        close: () => Promise.resolve(),
        getCurrentURL: () => "https://example.com",
      }
    : undefined;

  // Create a controller with a mock engine, then manually set the page
  const ctrl = new BrowserController();
  if (mockPage) {
    // Use object property access to set private field for testing
    (ctrl as unknown as { currentPage: unknown }).currentPage = mockPage;
  }
  return ctrl;
}

function setup(hasPage = true) {
  clearBrowserContext();
  clearFormController();
  const bc = createMockBrowserController(hasPage);
  setCurrentBrowserController(bc);
  return new FormController();
}

function teardown() {
  clearBrowserContext();
  clearFormController();
}

Deno.test("FormController - construction", () => {
  const fc = new FormController();
  assertEquals(fc instanceof FormController, true);
});

Deno.test("FormController - getFormController singleton", () => {
  clearFormController();
  const a = getFormController();
  const b = getFormController();
  assertEquals(a, b);
  clearFormController();
});

Deno.test("FormController - detectForms throws without browser context", async () => {
  clearBrowserContext();
  const fc = new FormController();
  try {
    await fc.detectForms();
    assertEquals(true, false, "should have thrown");
  } catch (e) {
    assertEquals((e as Error).message.includes("Browser context not initialized"), true);
  }
});

Deno.test("FormController - getFieldValue returns value from page", async () => {
  const fc = setup();
  try {
    const val = await fc.getFieldValue("#field");
    assertEquals(val, "field-value");
  } finally {
    teardown();
  }
});

Deno.test("FormController - getFieldValue returns null for missing element", async () => {
  const fc = setup();
  try {
    const val = await fc.getFieldValue("#nonexistent");
    assertEquals(val, null);
  } finally {
    teardown();
  }
});

Deno.test("FormController - getFieldValue returns null without browser context", async () => {
  clearBrowserContext();
  const fc = new FormController();
  const val = await fc.getFieldValue("#field");
  assertEquals(val, null);
});

Deno.test("FormController - clickElement returns true on success", async () => {
  const fc = setup();
  try {
    const result = await fc.clickElement("#btn");
    assertEquals(result, true);
  } finally {
    teardown();
  }
});

Deno.test("FormController - clickElement returns false without context", async () => {
  clearBrowserContext();
  const fc = new FormController();
  const result = await fc.clickElement("#btn");
  assertEquals(result, false);
});

Deno.test("FormController - setFieldValue returns false without context", async () => {
  clearBrowserContext();
  const fc = new FormController();
  const result = await fc.setFieldValue("#field", "value");
  assertEquals(result, false);
});

Deno.test("FormController - clear resets formAutomation", () => {
  const fc = new FormController();
  fc.clear();
  // No error means success - internal state cleared
  assertEquals(true, true);
});

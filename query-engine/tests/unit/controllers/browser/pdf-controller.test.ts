/**
 * PDFController tests
 */
import { assertEquals, assertThrows } from "@std/assert";
import {
  PDFController,
  getPDFController,
  clearPDFController,
  PAGE_DIMENSIONS,
  CommonTemplates,
} from "../../../../controllers/browser/pdf-controller.ts";
import {
  clearBrowserContext,
} from "../../../../controllers/browser/browser-context.ts";

function setup() {
  clearBrowserContext();
  clearPDFController();
}

function teardown() {
  clearBrowserContext();
  clearPDFController();
}

Deno.test("PDFController - construction", () => {
  const pc = new PDFController();
  assertEquals(pc instanceof PDFController, true);
});

Deno.test("PDFController - getPDFController singleton", () => {
  clearPDFController();
  const a = getPDFController();
  const b = getPDFController();
  assertEquals(a, b);
  clearPDFController();
});

Deno.test("PDFController - generate throws without browser context", async () => {
  setup();
  const pc = new PDFController();
  try {
    await pc.generate();
    assertEquals(true, false, "should have thrown");
  } catch (e) {
    assertEquals((e as Error).message.includes("Browser context not initialized"), true);
  } finally {
    teardown();
  }
});

Deno.test("PDFController - getPageDimensions portrait", () => {
  const pc = new PDFController();
  const dims = pc.getPageDimensions("A4", "portrait");
  assertEquals(dims.width, PAGE_DIMENSIONS["A4"].width);
  assertEquals(dims.height, PAGE_DIMENSIONS["A4"].height);
});

Deno.test("PDFController - getPageDimensions landscape swaps", () => {
  const pc = new PDFController();
  const dims = pc.getPageDimensions("A4", "landscape");
  assertEquals(dims.width, PAGE_DIMENSIONS["A4"].height);
  assertEquals(dims.height, PAGE_DIMENSIONS["A4"].width);
});

Deno.test("PDFController - getPageDimensions unknown format throws", () => {
  const pc = new PDFController();
  assertThrows(
    () => pc.getPageDimensions("UNKNOWN" as any),
    Error,
    "Unknown format",
  );
});

Deno.test("PDFController - getAvailableFormats returns formats", () => {
  const pc = new PDFController();
  const formats = pc.getAvailableFormats();
  assertEquals(formats.length > 0, true);
  assertEquals(formats.includes("A4"), true);
  assertEquals(formats.includes("Letter"), true);
});

Deno.test("PDFController - useTemplate sets template", () => {
  const pc = new PDFController();
  pc.useTemplate("document");
  assertEquals(pc.getTemplate() !== null, true);
});

Deno.test("PDFController - useTemplate all types", () => {
  const pc = new PDFController();
  const types = ["document", "report", "invoice", "slides", "fullPage"] as const;
  for (const t of types) {
    pc.useTemplate(t);
    assertEquals(pc.getTemplate() !== null, true);
  }
});

Deno.test("PDFController - createTemplate returns template", () => {
  const pc = new PDFController();
  const template = pc.createTemplate({ format: "A4" });
  assertEquals(template !== null, true);
  assertEquals(pc.getTemplate(), template);
});

Deno.test("PDFController - generateWithTemplate throws without template", async () => {
  setup();
  const pc = new PDFController();
  try {
    await pc.generateWithTemplate();
    assertEquals(true, false, "should have thrown");
  } catch (e) {
    assertEquals((e as Error).message.includes("No template configured"), true);
  } finally {
    teardown();
  }
});

Deno.test("PDFController - clearController resets state", () => {
  const pc = new PDFController();
  pc.useTemplate("document");
  pc.clearController();
  assertEquals(pc.getTemplate(), null);
});

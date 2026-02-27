/**
 * BrowserPage Tests
 * Tests for navigate URL timing (Task 10)
 */

import { assertEquals, assertRejects } from "@std/assert";
import { BrowserPage } from "../../src/api/BrowserPage.ts";

// Minimal mock browser that succeeds
function createMockBrowser(shouldFail = false) {
  return {
    navigate: async (_url: string) => {
      if (shouldFail) {
        throw new Error("Navigation failed");
      }
    },
    getRenderingPipeline: () => ({
      lastRenderResult: { document: { title: "Test" } },
    }),
  } as any;
}

Deno.test({
  name: "BrowserPage.navigate - sets currentURL after successful navigation",
  async fn() {
    const page = new BrowserPage(createMockBrowser());
    assertEquals(page.getCurrentURL(), undefined);

    await page.navigate("https://example.com");
    assertEquals(page.getCurrentURL(), "https://example.com");
  },
});

Deno.test({
  name: "BrowserPage.navigate - does not update currentURL on failure",
  async fn() {
    const page = new BrowserPage(createMockBrowser());

    // Navigate successfully first
    await page.navigate("https://good.com");
    assertEquals(page.getCurrentURL(), "https://good.com");

    // Now fail navigation
    const failPage = new BrowserPage(createMockBrowser(true));
    // Set up a known good URL via successful nav mock first
    const goodBrowser = createMockBrowser(false);
    const page2 = new BrowserPage(goodBrowser);
    await page2.navigate("https://original.com");
    assertEquals(page2.getCurrentURL(), "https://original.com");

    // Swap to failing browser
    (page2 as any).browser = createMockBrowser(true);
    await assertRejects(
      () => page2.navigate("https://bad.com"),
      Error,
      "Navigation failed",
    );

    // currentURL should remain the original
    assertEquals(page2.getCurrentURL(), "https://original.com");
  },
});

Deno.test({
  name: "BrowserPage.navigate - currentURL stays undefined if first navigation fails",
  async fn() {
    const page = new BrowserPage(createMockBrowser(true));

    await assertRejects(
      () => page.navigate("https://bad.com"),
      Error,
      "Navigation failed",
    );

    assertEquals(page.getCurrentURL(), undefined);
  },
});

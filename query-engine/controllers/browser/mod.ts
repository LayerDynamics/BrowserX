/**
 * Browser controller module exports
 */

export { BrowserController } from "./browser-controller.ts";

// Re-export browser context functions
export {
  setCurrentBrowserController,
  getCurrentBrowserController,
  pushBrowserController,
  popBrowserController,
  clearBrowserContext,
  hasBrowserContext,
  withBrowserContext,
  requireBrowserController,
} from "./browser-context.ts";

// Re-export types from browser-controller
export type {
  BrowserPage,
  DOMElement,
  BrowserEngine,
  NavigateOptions,
  TypeOptions,
  WaitOptions,
  ScreenshotOptions,
  PDFOptions,
} from "./browser-controller.ts";

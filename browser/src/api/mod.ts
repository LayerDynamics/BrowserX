/**
 * Browser API Module
 *
 * Public API for programmatic browser control.
 * Used by the query-engine to interact with browser instances and pages.
 */

export { BrowserEngine, type IBrowserEngine } from "./BrowserEngine.ts";
export { BrowserPage, DOMElement } from "./BrowserPage.ts";
export type {
    NavigateOptions,
    PDFOptions,
    ScreenshotOptions,
    TypeOptions,
    WaitOptions,
} from "./BrowserPage.ts";

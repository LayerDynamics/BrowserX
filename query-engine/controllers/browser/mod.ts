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

// Form controller
export {
  FormController,
  getFormController,
  clearFormController,
} from "./form-controller.ts";

export type {
  FormDetectionResult,
  FormFillResult,
} from "./form-controller.ts";

// Authentication controller
export {
  AuthController,
  getAuthController,
  clearAuthController,
} from "./auth-controller.ts";

export type {
  AuthState,
  AuthCredentials,
  AuthenticationResult,
  AuthSession,
  AuthStateChangeEvent,
  AuthenticationType,
  BasicAuthCredentials,
  BearerAuthCredentials,
  ApiKeyCredentials,
  CookieAuthCredentials,
  CookieConfig,
  FormLoginCredentials,
  OAuth2Credentials,
  CustomAuthCredentials,
} from "./auth-controller.ts";

// Scraper controller
export {
  ScraperController,
  getScraperController,
  clearScraperController,
} from "./scraper-controller.ts";

export type {
  QuickScrapeOptions,
  ExtractionRule,
  ScrapeConfig,
  ScrapeResult,
  TableConfig,
  ListConfig,
  ExtractedLink,
  ExtractedImage,
  PaginationConfig,
  PaginatedScrapeResult,
} from "./scraper-controller.ts";

// Visual tester controller
export {
  VisualTesterController,
  getVisualTesterController,
  clearVisualTesterController,
} from "./visual-tester-controller.ts";

export type {
  VisualAssertionResult,
  ScreenshotConfig,
  ScreenshotResult,
  ComparisonOptions,
  ComparisonResult,
  VisibilityResult,
  LayoutCheckResult,
  SnapshotMetadata,
} from "./visual-tester-controller.ts";

// HAR recorder controller
export {
  HARRecorderController,
  getHARRecorderController,
  clearHARRecorderController,
} from "./har-recorder-controller.ts";

export type {
  NetworkSummary,
  HAR,
  HAREntry,
  HARPage,
  HARRequest,
  HARResponse,
  HARTimings,
  HARCookie,
  HARHeader,
  RecordingOptions,
  NetworkRequestEvent,
  NetworkResponseEvent,
} from "./har-recorder-controller.ts";

// HAR player controller
export {
  HARPlayerController,
  getHARPlayerController,
  clearHARPlayerController,
  THROTTLE_PRESETS,
} from "./har-player-controller.ts";

export type {
  MatchStrategy,
  ThrottlePreset,
  ThrottleConfig,
  PlaybackOptions,
  PlaybackStats,
  RequestInfo,
  RequestLogEntry,
  ReplayedResponse,
  ExtractedCookies,
  ExtractedAuth,
  PlaybackResult,
} from "./har-player-controller.ts";

// Performance profiler controller
export {
  PerformanceProfilerController,
  getPerformanceProfilerController,
  clearPerformanceProfilerController,
} from "./performance-profiler-controller.ts";

export type {
  PerformanceThresholds,
  PerformanceAssertionResult,
  PerformanceComparison,
  NavigationTiming,
  ResourceTiming,
  WebVitals,
  PaintTiming,
  MemoryInfo,
  RenderingMetrics,
  NetworkPerformance,
  PerformanceProfile,
  PerformanceMark,
  PerformanceMeasure,
  ProfilingOptions,
} from "./performance-profiler-controller.ts";

// PDF controller
export {
  PDFController,
  getPDFController,
  clearPDFController,
  PDFTemplate,
  CommonTemplates,
  PAGE_DIMENSIONS,
} from "./pdf-controller.ts";

export type {
  PDFBatchOptions,
  PDFBatchResult,
  PDFMergeOptions,
  PDFResult,
  PDFFormat,
  PDFOrientation,
  PDFMargins,
} from "./pdf-controller.ts";

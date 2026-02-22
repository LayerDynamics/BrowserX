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
  ScreenshotOptions,
  TypeOptions,
  WaitOptions,
} from "./BrowserPage.ts";

// Form Automation API
export { createFormAutomation, FormAutomation } from "./FormAutomation.ts";
export type {
  DetectedForm,
  FileUploadInfo,
  FormField,
  FormFieldOption,
  FormFieldType,
  FormFillData,
  FormFillOptions,
  FormSubmitOptions,
  FormSubmitResult,
  MultiStepFormConfig,
  MultiStepFormStep,
} from "./FormAutomation.ts";

// Authentication Manager API
export { AuthenticationManager, createAuthenticationManager } from "./AuthenticationManager.ts";
export type {
  ApiKeyCredentials,
  AuthCredentials,
  AuthenticationResult,
  AuthenticationType,
  AuthSession,
  AuthStateChangeEvent,
  BasicAuthCredentials,
  BearerAuthCredentials,
  CookieAuthCredentials,
  CookieConfig,
  CustomAuthCredentials,
  FormLoginCredentials,
  OAuth2Credentials,
} from "./AuthenticationManager.ts";

// Web Scraper API
export { createWebScraper, WebScraper } from "./WebScraper.ts";
export type {
  ExtractedImage,
  ExtractedLink,
  ExtractionRule,
  ListConfig,
  PaginatedScrapeResult,
  PaginationConfig,
  ScrapeConfig,
  ScrapeResult,
  TableConfig,
} from "./WebScraper.ts";

// Visual Tester API
export { createVisualTester, VisualTester } from "./VisualTester.ts";
export type {
  ComparisonOptions,
  ComparisonResult,
  LayoutCheckResult,
  ScreenshotConfig,
  ScreenshotResult,
  SnapshotMetadata,
  VisibilityResult,
} from "./VisualTester.ts";

// HAR Recorder API
export { createHARRecorder, HAR_VERSION, HARRecorder } from "./HARRecorder.ts";
export type {
  HAR,
  HARBrowser,
  HARCache,
  HARContent,
  HARCookie,
  HARCreator,
  HAREntry,
  HARHeader,
  HARLog,
  HARPage,
  HARPageTiming,
  HARPostData,
  HARQueryString,
  HARRequest,
  HARResponse,
  HARTimings,
  NetworkRequestEvent,
  NetworkResponseEvent,
  RecordingOptions,
} from "./HARRecorder.ts";

// HAR Player API
export { HARPlayer, THROTTLE_PRESETS } from "./HARPlayer.ts";
export type {
  ExtractedAuth,
  ExtractedCookies,
  MatchStrategy,
  PlaybackOptions,
  PlaybackResult,
  PlaybackStats,
  ReplayedResponse,
  RequestInfo,
  RequestLogEntry,
  RequestMatcher,
  ThrottleConfig,
  ThrottlePreset,
} from "./HARPlayer.ts";

// Performance Profiler API
export { createPerformanceProfiler, PerformanceProfiler } from "./PerformanceProfiler.ts";
export type {
  MemoryInfo,
  NavigationTiming,
  NetworkPerformance,
  PaintTiming,
  PerformanceMark,
  PerformanceMeasure,
  PerformanceProfile,
  ProfilingOptions,
  RenderingMetrics,
  ResourceTiming,
  WebVitals,
} from "./PerformanceProfiler.ts";

// PDF Generator API
export {
  CommonTemplates,
  createPDFGenerator,
  createPDFTemplate,
  PAGE_DIMENSIONS,
  PDFGeneratorAPI,
  PDFTemplate,
} from "./PDFGenerator.ts";
export type {
  PDFFormat,
  PDFMargins,
  PDFOptions,
  PDFOrientation,
  PDFResult,
} from "./PDFGenerator.ts";

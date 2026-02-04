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
export {
    FormAutomation,
    createFormAutomation,
} from "./FormAutomation.ts";
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
export {
    AuthenticationManager,
    createAuthenticationManager,
} from "./AuthenticationManager.ts";
export type {
    ApiKeyCredentials,
    AuthCredentials,
    AuthenticationType,
    AuthenticationResult,
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
export {
    WebScraper,
    createWebScraper,
} from "./WebScraper.ts";
export type {
    ExtractionRule,
    ScrapeConfig,
    ScrapeResult,
    TableConfig,
    ListConfig,
    ExtractedLink,
    ExtractedImage,
    PaginationConfig,
    PaginatedScrapeResult,
} from "./WebScraper.ts";

// Visual Tester API
export {
    VisualTester,
    createVisualTester,
} from "./VisualTester.ts";
export type {
    ScreenshotConfig,
    ScreenshotResult,
    ComparisonOptions,
    ComparisonResult,
    VisibilityResult,
    LayoutCheckResult,
    SnapshotMetadata,
} from "./VisualTester.ts";

// HAR Recorder API
export {
    HARRecorder,
    createHARRecorder,
    HAR_VERSION,
} from "./HARRecorder.ts";
export type {
    HAR,
    HARLog,
    HAREntry,
    HARPage,
    HARRequest,
    HARResponse,
    HARTimings,
    HARCache,
    HARContent,
    HARCookie,
    HARHeader,
    HARQueryString,
    HARPostData,
    HARCreator,
    HARBrowser,
    HARPageTiming,
    RecordingOptions,
    NetworkRequestEvent,
    NetworkResponseEvent,
} from "./HARRecorder.ts";

// HAR Player API
export {
    HARPlayer,
    THROTTLE_PRESETS,
} from "./HARPlayer.ts";
export type {
    MatchStrategy,
    ThrottlePreset,
    ThrottleConfig,
    RequestMatcher,
    RequestInfo,
    PlaybackOptions,
    RequestLogEntry,
    PlaybackStats,
    ReplayedResponse,
    ExtractedCookies,
    ExtractedAuth,
    PlaybackResult,
} from "./HARPlayer.ts";

// Performance Profiler API
export {
    PerformanceProfiler,
    createPerformanceProfiler,
} from "./PerformanceProfiler.ts";
export type {
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
} from "./PerformanceProfiler.ts";

// PDF Generator API
export {
    PDFGeneratorAPI,
    createPDFGenerator,
    PDFTemplate,
    createPDFTemplate,
    CommonTemplates,
    PAGE_DIMENSIONS,
} from "./PDFGenerator.ts";
export type {
    PDFFormat,
    PDFOrientation,
    PDFMargins,
    PDFOptions,
    PDFResult,
} from "./PDFGenerator.ts";

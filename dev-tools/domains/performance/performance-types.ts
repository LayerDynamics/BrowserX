/**
 * Performance Domain Types
 *
 * Types for performance metrics collection, profiling, navigation timing,
 * Web Vitals, rendering metrics, and performance scoring.
 * Maps closely to the Chrome DevTools Protocol Performance domain.
 */

import type {
    NavigationTiming,
    WebVitals,
    RenderingMetrics,
} from "../../../browser/src/api/PerformanceProfiler.ts";

// ---- Metrics ----

/**
 * A single performance metric name-value pair
 */
export interface PerformanceMetric {
    /** Metric name (e.g., "JSHeapUsedSize", "LayoutCount") */
    name: string;
    /** Metric value */
    value: number;
}

/**
 * Result of getMetrics method
 */
export interface GetMetricsResult {
    /** Array of collected performance metrics */
    metrics: PerformanceMetric[];
}

// ---- CPU Profiling ----

/**
 * Parameters for startProfiling / stopProfiling
 */
export interface ProfileParams {
    /** Sampling interval in microseconds (default: 1000) */
    samplingInterval?: number;
}

/**
 * A node in the CPU profile call tree
 */
export interface ProfileNode {
    /** Unique node ID */
    id: number;
    /** Call frame information */
    callFrame: {
        /** Function name */
        functionName: string;
        /** Script identifier */
        scriptId: string;
        /** Script URL */
        url: string;
        /** Line number (0-based) */
        lineNumber: number;
        /** Column number (0-based) */
        columnNumber: number;
    };
    /** Number of samples where this node was on top of the call stack */
    hitCount?: number;
    /** Child node IDs */
    children?: number[];
}

/**
 * Result of stopProfiling method - a complete CPU profile
 */
export interface ProfileResult {
    /** The collected CPU profile */
    profile: {
        /** Profile nodes forming the call tree */
        nodes: ProfileNode[];
        /** Profile start time in microseconds */
        startTime: number;
        /** Profile end time in microseconds */
        endTime: number;
        /** Sample node IDs (optional) */
        samples?: number[];
    };
}

// ---- Navigation Timing ----

/**
 * Navigation timing description for protocol transport.
 * Mirrors the fields from NavigationTiming in PerformanceProfiler.
 */
export interface NavigationTimingDescription {
    /** Start of navigation */
    navigationStart: number;
    /** DNS lookup start */
    domainLookupStart: number;
    /** DNS lookup end */
    domainLookupEnd: number;
    /** Connection start */
    connectStart: number;
    /** Connection end */
    connectEnd: number;
    /** TLS/SSL handshake start (0 if no TLS) */
    secureConnectionStart: number;
    /** Request start */
    requestStart: number;
    /** Response start (first byte) */
    responseStart: number;
    /** Response end */
    responseEnd: number;
    /** DOM parsing start */
    domParseStart: number;
    /** DOM parsing complete */
    domParseEnd: number;
    /** DOM content loaded event start */
    domContentLoadedEventStart: number;
    /** DOM content loaded event end */
    domContentLoadedEventEnd: number;
    /** Load event start */
    loadEventStart: number;
    /** Load event end */
    loadEventEnd: number;
}

/**
 * Result of getNavigationTiming method
 */
export interface GetNavigationTimingResult {
    /** Navigation timing breakdown */
    timing: NavigationTimingDescription;
}

// ---- Web Vitals ----

/**
 * Web Vitals description for protocol transport
 */
export interface WebVitalsDescription {
    /** Largest Contentful Paint (ms) */
    lcp: number | null;
    /** First Input Delay (ms) */
    fid: number | null;
    /** Cumulative Layout Shift */
    cls: number | null;
    /** First Contentful Paint (ms) */
    fcp: number | null;
    /** Time to First Byte (ms) */
    ttfb: number | null;
    /** Interaction to Next Paint (ms) */
    inp: number | null;
}

/**
 * Result of getWebVitals method
 */
export interface GetWebVitalsResult {
    /** Core Web Vitals metrics */
    vitals: WebVitalsDescription;
}

// ---- Rendering Metrics ----

/**
 * Rendering metrics description for protocol transport.
 * Mirrors the fields from RenderingMetrics in PerformanceProfiler.
 */
export interface RenderingMetricsDescription {
    /** HTML fetch time (ms) */
    htmlFetchMs: number;
    /** HTML parse time (ms) */
    htmlParseMs: number;
    /** CSS fetch time (ms) */
    cssFetchMs: number;
    /** CSS parse time (ms) */
    cssParseMs: number;
    /** Script execution time (ms) */
    scriptExecutionMs: number;
    /** Style resolution time (ms) */
    styleResolutionMs: number;
    /** Layout computation time (ms) */
    layoutComputationMs: number;
    /** Paint recording time (ms) */
    paintRecordingMs: number;
    /** Compositing time (ms) */
    compositingMs: number;
    /** Total render time (ms) */
    totalRenderMs: number;
}

/**
 * Result of getRenderingMetrics method
 */
export interface GetRenderingMetricsResult {
    /** Rendering metrics breakdown */
    metrics: RenderingMetricsDescription;
}

// ---- Performance Score ----

/**
 * Performance score description for protocol transport
 */
export interface PerformanceScoreDescription {
    /** Performance score (0-100) */
    performance: number;
    /** Accessibility score (0-100) */
    accessibility: number;
    /** Best practices score (0-100) */
    bestPractices: number;
    /** SEO score (0-100) */
    seo: number;
    /** Overall score (0-100) */
    overall: number;
}

/**
 * Result of getPerformanceScore method
 */
export interface GetPerformanceScoreResult {
    /** Performance score breakdown */
    score: PerformanceScoreDescription;
}

// ---- Re-exports for convenience ----

export type { NavigationTiming, WebVitals, RenderingMetrics };

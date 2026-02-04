/**
 * Performance Profiler API
 *
 * Provides performance metrics collection and analysis for browser operations.
 * Mirrors the Performance API with enhanced profiling capabilities.
 */

import type { BrowserPage } from "./BrowserPage.ts";
import type { RenderingTiming, ResourceInfo } from "../engine/RenderingPipeline.ts";

/**
 * Navigation timing metrics (similar to PerformanceNavigationTiming)
 */
export interface NavigationTiming {
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
    /** DOM content loaded */
    domContentLoadedEventStart: number;
    /** DOM content loaded event end */
    domContentLoadedEventEnd: number;
    /** Load event start */
    loadEventStart: number;
    /** Load event end */
    loadEventEnd: number;
}

/**
 * Resource timing entry (similar to PerformanceResourceTiming)
 */
export interface ResourceTiming {
    /** Resource URL */
    url: string;
    /** Resource type */
    resourceType: "html" | "css" | "script" | "image" | "font" | "other";
    /** Start time relative to navigation start */
    startTime: number;
    /** Response end time */
    responseEnd: number;
    /** Duration in milliseconds */
    duration: number;
    /** Transfer size in bytes */
    transferSize: number;
    /** Encoded body size */
    encodedBodySize: number;
    /** Decoded body size */
    decodedBodySize: number;
    /** Whether resource was cached */
    fromCache: boolean;
    /** Initiator type */
    initiatorType: "parser" | "script" | "link" | "css" | "other";
}

/**
 * Core Web Vitals metrics
 */
export interface WebVitals {
    /** Largest Contentful Paint - time to render largest content element */
    lcp: number | null;
    /** First Input Delay - time from first interaction to response */
    fid: number | null;
    /** Cumulative Layout Shift - measure of visual stability */
    cls: number | null;
    /** First Contentful Paint - time to first content render */
    fcp: number | null;
    /** Time to First Byte - server response time */
    ttfb: number | null;
    /** Interaction to Next Paint - responsiveness metric */
    inp: number | null;
}

/**
 * Paint timing metrics
 */
export interface PaintTiming {
    /** First paint timestamp */
    firstPaint: number | null;
    /** First contentful paint timestamp */
    firstContentfulPaint: number | null;
    /** Largest contentful paint timestamp */
    largestContentfulPaint: number | null;
}

/**
 * Memory usage information
 */
export interface MemoryInfo {
    /** JS heap size used (bytes) */
    usedJSHeapSize: number;
    /** Total JS heap size (bytes) */
    totalJSHeapSize: number;
    /** JS heap size limit (bytes) */
    jsHeapSizeLimit: number;
    /** DOM nodes count */
    domNodeCount: number;
    /** CSS rules count */
    cssRuleCount: number;
}

/**
 * Rendering performance metrics
 */
export interface RenderingMetrics {
    /** HTML fetch time */
    htmlFetchMs: number;
    /** HTML parse time */
    htmlParseMs: number;
    /** CSS fetch time */
    cssFetchMs: number;
    /** CSS parse time */
    cssParseMs: number;
    /** Script execution time */
    scriptExecutionMs: number;
    /** Style resolution time */
    styleResolutionMs: number;
    /** Layout computation time */
    layoutComputationMs: number;
    /** Paint recording time */
    paintRecordingMs: number;
    /** Compositing time */
    compositingMs: number;
    /** Total render time */
    totalRenderMs: number;
}

/**
 * Network performance summary
 */
export interface NetworkPerformance {
    /** Total requests made */
    totalRequests: number;
    /** Total bytes transferred */
    totalBytesTransferred: number;
    /** Total bytes from cache */
    totalBytesFromCache: number;
    /** Cache hit ratio (0-1) */
    cacheHitRatio: number;
    /** Average request time (ms) */
    averageRequestTimeMs: number;
    /** Slowest request time (ms) */
    slowestRequestTimeMs: number;
    /** Fastest request time (ms) */
    fastestRequestTimeMs: number;
    /** Requests by type */
    requestsByType: Record<string, number>;
}

/**
 * Complete performance profile
 */
export interface PerformanceProfile {
    /** Profile capture timestamp */
    timestamp: number;
    /** URL profiled */
    url: string;
    /** Navigation timing */
    navigationTiming: NavigationTiming;
    /** Resource timing entries */
    resourceTiming: ResourceTiming[];
    /** Core Web Vitals */
    webVitals: WebVitals;
    /** Paint timing */
    paintTiming: PaintTiming;
    /** Rendering metrics */
    renderingMetrics: RenderingMetrics;
    /** Network performance */
    networkPerformance: NetworkPerformance;
    /** Memory info */
    memoryInfo: MemoryInfo;
}

/**
 * Performance mark for custom timing
 */
export interface PerformanceMark {
    name: string;
    timestamp: number;
    detail?: unknown;
}

/**
 * Performance measure between marks
 */
export interface PerformanceMeasure {
    name: string;
    startMark: string;
    endMark: string;
    duration: number;
    startTime: number;
    endTime: number;
}

/**
 * Profiling options
 */
export interface ProfilingOptions {
    /** Capture resource timing */
    captureResourceTiming?: boolean;
    /** Capture memory info */
    captureMemoryInfo?: boolean;
    /** Calculate web vitals */
    calculateWebVitals?: boolean;
    /** Include detailed rendering metrics */
    includeRenderingMetrics?: boolean;
}

/**
 * Performance Profiler
 *
 * Collects and analyzes performance metrics for browser operations.
 */
export class PerformanceProfiler {
    private page: BrowserPage;
    private marks: Map<string, PerformanceMark> = new Map();
    private measures: PerformanceMeasure[] = [];
    private resourceTimings: ResourceTiming[] = [];
    private navigationStart: number = 0;
    private renderingTiming: RenderingTiming | null = null;
    private resources: ResourceInfo[] = [];

    constructor(page: BrowserPage) {
        this.page = page;
    }

    /**
     * Start profiling (call before navigation)
     */
    startProfiling(): void {
        this.navigationStart = performance.now();
        this.marks.clear();
        this.measures = [];
        this.resourceTimings = [];
        this.renderingTiming = null;
        this.resources = [];

        // Mark navigation start
        this.mark("navigationStart");
    }

    /**
     * Record rendering timing from render result
     */
    recordRenderingTiming(timing: RenderingTiming, resources: ResourceInfo[]): void {
        this.renderingTiming = timing;
        this.resources = resources;

        // Convert resources to resource timing entries
        let currentTime = 0;
        for (const resource of resources) {
            const entry: ResourceTiming = {
                url: resource.url,
                resourceType: resource.type,
                startTime: currentTime,
                responseEnd: currentTime + resource.fetchTime,
                duration: resource.fetchTime,
                transferSize: resource.cached ? 0 : resource.size,
                encodedBodySize: resource.size,
                decodedBodySize: resource.size,
                fromCache: resource.cached,
                initiatorType: this.getInitiatorType(resource.type),
            };
            this.resourceTimings.push(entry);
            currentTime += resource.fetchTime;
        }

        // Mark render complete
        this.mark("renderComplete");
    }

    /**
     * Get initiator type from resource type
     */
    private getInitiatorType(type: string): "parser" | "script" | "link" | "css" | "other" {
        switch (type) {
            case "html":
                return "parser";
            case "css":
                return "link";
            case "script":
                return "script";
            default:
                return "other";
        }
    }

    /**
     * Create a performance mark
     */
    mark(name: string, detail?: unknown): PerformanceMark {
        const mark: PerformanceMark = {
            name,
            timestamp: performance.now() - this.navigationStart,
            detail,
        };
        this.marks.set(name, mark);
        return mark;
    }

    /**
     * Create a performance measure between two marks
     */
    measure(name: string, startMark: string, endMark: string): PerformanceMeasure {
        const start = this.marks.get(startMark);
        const end = this.marks.get(endMark);

        if (!start) {
            throw new Error(`Start mark "${startMark}" not found`);
        }
        if (!end) {
            throw new Error(`End mark "${endMark}" not found`);
        }

        const measure: PerformanceMeasure = {
            name,
            startMark,
            endMark,
            duration: end.timestamp - start.timestamp,
            startTime: start.timestamp,
            endTime: end.timestamp,
        };
        this.measures.push(measure);
        return measure;
    }

    /**
     * Get all marks
     */
    getMarks(): PerformanceMark[] {
        return Array.from(this.marks.values());
    }

    /**
     * Get all measures
     */
    getMeasures(): PerformanceMeasure[] {
        return [...this.measures];
    }

    /**
     * Get navigation timing
     */
    getNavigationTiming(): NavigationTiming {
        const timing = this.renderingTiming || {
            htmlFetch: 0,
            htmlParse: 0,
            cssFetch: 0,
            cssParse: 0,
            scriptExecution: 0,
            styleResolution: 0,
            layoutComputation: 0,
            paintRecording: 0,
            compositing: 0,
            total: 0,
        };

        // Build navigation timing from rendering stages
        let currentTime = this.navigationStart;

        const navigationTiming: NavigationTiming = {
            navigationStart: this.navigationStart,
            domainLookupStart: currentTime,
            domainLookupEnd: currentTime + 5, // Approximate DNS time
            connectStart: currentTime + 5,
            connectEnd: currentTime + 15, // Approximate connection time
            secureConnectionStart: currentTime + 10, // Approximate TLS time
            requestStart: currentTime + 15,
            responseStart: currentTime + 15 + timing.htmlFetch * 0.1, // TTFB
            responseEnd: currentTime + timing.htmlFetch,
            domParseStart: currentTime + timing.htmlFetch,
            domParseEnd: currentTime + timing.htmlFetch + timing.htmlParse,
            domContentLoadedEventStart: currentTime + timing.htmlFetch + timing.htmlParse + timing.cssFetch + timing.cssParse,
            domContentLoadedEventEnd: currentTime + timing.htmlFetch + timing.htmlParse + timing.cssFetch + timing.cssParse + timing.scriptExecution,
            loadEventStart: currentTime + timing.total - timing.compositing,
            loadEventEnd: currentTime + timing.total,
        };

        return navigationTiming;
    }

    /**
     * Get resource timing entries
     */
    getResourceTiming(): ResourceTiming[] {
        return [...this.resourceTimings];
    }

    /**
     * Get Core Web Vitals
     */
    getWebVitals(): WebVitals {
        const timing = this.renderingTiming;

        if (!timing) {
            return {
                lcp: null,
                fid: null,
                cls: null,
                fcp: null,
                ttfb: null,
                inp: null,
            };
        }

        // Calculate approximations based on rendering timing
        const ttfb = timing.htmlFetch * 0.1; // Time to first byte is ~10% of fetch
        const fcp = timing.htmlFetch + timing.htmlParse + timing.styleResolution + timing.paintRecording * 0.5;
        const lcp = timing.total - timing.compositing; // LCP is typically just before compositing

        return {
            lcp,
            fid: null, // Cannot measure without user interaction
            cls: 0, // Assume no layout shift without real measurement
            fcp,
            ttfb,
            inp: null, // Cannot measure without user interaction
        };
    }

    /**
     * Get paint timing
     */
    getPaintTiming(): PaintTiming {
        const timing = this.renderingTiming;

        if (!timing) {
            return {
                firstPaint: null,
                firstContentfulPaint: null,
                largestContentfulPaint: null,
            };
        }

        const baseTime = timing.htmlFetch + timing.htmlParse + timing.cssFetch + timing.cssParse + timing.styleResolution;

        return {
            firstPaint: baseTime + timing.layoutComputation,
            firstContentfulPaint: baseTime + timing.layoutComputation + timing.paintRecording * 0.5,
            largestContentfulPaint: timing.total - timing.compositing,
        };
    }

    /**
     * Get rendering metrics
     */
    getRenderingMetrics(): RenderingMetrics {
        const timing = this.renderingTiming || {
            htmlFetch: 0,
            htmlParse: 0,
            cssFetch: 0,
            cssParse: 0,
            scriptExecution: 0,
            styleResolution: 0,
            layoutComputation: 0,
            paintRecording: 0,
            compositing: 0,
            total: 0,
        };

        return {
            htmlFetchMs: timing.htmlFetch,
            htmlParseMs: timing.htmlParse,
            cssFetchMs: timing.cssFetch,
            cssParseMs: timing.cssParse,
            scriptExecutionMs: timing.scriptExecution,
            styleResolutionMs: timing.styleResolution,
            layoutComputationMs: timing.layoutComputation,
            paintRecordingMs: timing.paintRecording,
            compositingMs: timing.compositing,
            totalRenderMs: timing.total,
        };
    }

    /**
     * Get network performance summary
     */
    getNetworkPerformance(): NetworkPerformance {
        const resources = this.resourceTimings;

        if (resources.length === 0) {
            return {
                totalRequests: 0,
                totalBytesTransferred: 0,
                totalBytesFromCache: 0,
                cacheHitRatio: 0,
                averageRequestTimeMs: 0,
                slowestRequestTimeMs: 0,
                fastestRequestTimeMs: 0,
                requestsByType: {},
            };
        }

        let totalBytesTransferred = 0;
        let totalBytesFromCache = 0;
        let totalTime = 0;
        let slowest = 0;
        let fastest = Infinity;
        const requestsByType: Record<string, number> = {};

        for (const resource of resources) {
            if (resource.fromCache) {
                totalBytesFromCache += resource.decodedBodySize;
            } else {
                totalBytesTransferred += resource.transferSize;
            }

            totalTime += resource.duration;
            slowest = Math.max(slowest, resource.duration);
            fastest = Math.min(fastest, resource.duration);

            const type = resource.resourceType;
            requestsByType[type] = (requestsByType[type] || 0) + 1;
        }

        const cachedCount = resources.filter(r => r.fromCache).length;

        return {
            totalRequests: resources.length,
            totalBytesTransferred,
            totalBytesFromCache,
            cacheHitRatio: resources.length > 0 ? cachedCount / resources.length : 0,
            averageRequestTimeMs: resources.length > 0 ? totalTime / resources.length : 0,
            slowestRequestTimeMs: slowest === 0 ? 0 : slowest,
            fastestRequestTimeMs: fastest === Infinity ? 0 : fastest,
            requestsByType,
        };
    }

    /**
     * Get memory info (approximate based on DOM/CSS stats)
     */
    async getMemoryInfo(): Promise<MemoryInfo> {
        // These would come from the rendering result in a full implementation
        // For now, provide estimates based on resources loaded
        const totalResourceSize = this.resources.reduce((sum, r) => sum + r.size, 0);

        return {
            usedJSHeapSize: totalResourceSize * 3, // Approximate expansion factor
            totalJSHeapSize: totalResourceSize * 5,
            jsHeapSizeLimit: 2147483648, // 2GB default limit
            domNodeCount: 0, // Would need DOM access
            cssRuleCount: 0, // Would need CSSOM access
        };
    }

    /**
     * Get complete performance profile
     */
    async getProfile(options: ProfilingOptions = {}): Promise<PerformanceProfile> {
        const url = this.page.getCurrentURL() || "unknown";

        const profile: PerformanceProfile = {
            timestamp: Date.now(),
            url,
            navigationTiming: this.getNavigationTiming(),
            resourceTiming: options.captureResourceTiming !== false ? this.getResourceTiming() : [],
            webVitals: options.calculateWebVitals !== false ? this.getWebVitals() : {
                lcp: null,
                fid: null,
                cls: null,
                fcp: null,
                ttfb: null,
                inp: null,
            },
            paintTiming: this.getPaintTiming(),
            renderingMetrics: options.includeRenderingMetrics !== false ? this.getRenderingMetrics() : {
                htmlFetchMs: 0,
                htmlParseMs: 0,
                cssFetchMs: 0,
                cssParseMs: 0,
                scriptExecutionMs: 0,
                styleResolutionMs: 0,
                layoutComputationMs: 0,
                paintRecordingMs: 0,
                compositingMs: 0,
                totalRenderMs: 0,
            },
            networkPerformance: this.getNetworkPerformance(),
            memoryInfo: options.captureMemoryInfo !== false ? await this.getMemoryInfo() : {
                usedJSHeapSize: 0,
                totalJSHeapSize: 0,
                jsHeapSizeLimit: 0,
                domNodeCount: 0,
                cssRuleCount: 0,
            },
        };

        return profile;
    }

    /**
     * Get performance score (0-100)
     */
    getPerformanceScore(): number {
        const vitals = this.getWebVitals();
        let score = 100;

        // Penalize based on Core Web Vitals thresholds
        if (vitals.lcp !== null) {
            if (vitals.lcp > 4000) score -= 30; // Poor
            else if (vitals.lcp > 2500) score -= 15; // Needs improvement
        }

        if (vitals.fcp !== null) {
            if (vitals.fcp > 3000) score -= 20; // Poor
            else if (vitals.fcp > 1800) score -= 10; // Needs improvement
        }

        if (vitals.ttfb !== null) {
            if (vitals.ttfb > 800) score -= 15; // Poor
            else if (vitals.ttfb > 200) score -= 5; // Needs improvement
        }

        if (vitals.cls !== null) {
            if (vitals.cls > 0.25) score -= 15; // Poor
            else if (vitals.cls > 0.1) score -= 5; // Needs improvement
        }

        // Bonus for cache hits
        const network = this.getNetworkPerformance();
        if (network.cacheHitRatio > 0.5) score += 5;

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Get performance summary
     */
    getSummary(): {
        score: number;
        grade: "A" | "B" | "C" | "D" | "F";
        recommendations: string[];
    } {
        const score = this.getPerformanceScore();
        const vitals = this.getWebVitals();
        const metrics = this.getRenderingMetrics();
        const network = this.getNetworkPerformance();

        const recommendations: string[] = [];

        // Generate recommendations based on metrics
        if (vitals.lcp && vitals.lcp > 2500) {
            recommendations.push("Optimize Largest Contentful Paint - consider lazy loading images and preloading critical resources");
        }

        if (vitals.fcp && vitals.fcp > 1800) {
            recommendations.push("Improve First Contentful Paint - reduce render-blocking resources");
        }

        if (vitals.ttfb && vitals.ttfb > 200) {
            recommendations.push("Reduce Time to First Byte - optimize server response time or use a CDN");
        }

        if (metrics.scriptExecutionMs > 500) {
            recommendations.push("Reduce JavaScript execution time - consider code splitting or deferring non-critical scripts");
        }

        if (metrics.layoutComputationMs > 100) {
            recommendations.push("Simplify layout - reduce DOM complexity and avoid forced synchronous layouts");
        }

        if (network.cacheHitRatio < 0.3) {
            recommendations.push("Improve caching - set appropriate cache headers and use service workers");
        }

        if (network.totalBytesTransferred > 1000000) {
            recommendations.push("Reduce page weight - compress images and minify resources");
        }

        // Determine grade
        let grade: "A" | "B" | "C" | "D" | "F";
        if (score >= 90) grade = "A";
        else if (score >= 80) grade = "B";
        else if (score >= 70) grade = "C";
        else if (score >= 60) grade = "D";
        else grade = "F";

        return { score, grade, recommendations };
    }

    /**
     * Clear all recorded data
     */
    clear(): void {
        this.marks.clear();
        this.measures = [];
        this.resourceTimings = [];
        this.renderingTiming = null;
        this.resources = [];
        this.navigationStart = 0;
    }
}

/**
 * Create a performance profiler instance
 */
export function createPerformanceProfiler(page: BrowserPage): PerformanceProfiler {
    return new PerformanceProfiler(page);
}

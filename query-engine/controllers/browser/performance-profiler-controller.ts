/**
 * Performance Profiler Controller
 *
 * Bridges the query engine with browser performance profiling capabilities.
 * Provides performance metrics collection and analysis for query execution.
 */

import type { BrowserPage } from "../../../browser/src/api/BrowserPage.ts";
import type { RenderingTiming, ResourceInfo } from "../../../browser/src/engine/RenderingPipeline.ts";
import {
    PerformanceProfiler,
    createPerformanceProfiler,
    type NavigationTiming,
    type ResourceTiming,
    type WebVitals,
    type PaintTiming,
    type MemoryInfo,
    type RenderingMetrics,
    type NetworkPerformance,
    type PerformanceProfile,
    type PerformanceMark,
    type PerformanceMeasure,
    type ProfilingOptions,
} from "../../../browser/src/api/PerformanceProfiler.ts";
import { getCurrentBrowserController } from "./browser-context.ts";

/**
 * Performance threshold configuration
 */
export interface PerformanceThresholds {
    /** Maximum LCP in ms */
    maxLCP?: number;
    /** Maximum FCP in ms */
    maxFCP?: number;
    /** Maximum TTFB in ms */
    maxTTFB?: number;
    /** Maximum CLS score */
    maxCLS?: number;
    /** Maximum total load time in ms */
    maxLoadTime?: number;
    /** Maximum script execution time in ms */
    maxScriptTime?: number;
    /** Maximum layout time in ms */
    maxLayoutTime?: number;
    /** Minimum cache hit ratio (0-1) */
    minCacheHitRatio?: number;
}

/**
 * Performance assertion result
 */
export interface PerformanceAssertionResult {
    passed: boolean;
    metric: string;
    expected: string;
    actual: string | number;
    threshold: number;
}

/**
 * Performance comparison result
 */
export interface PerformanceComparison {
    baseline: PerformanceProfile;
    current: PerformanceProfile;
    differences: {
        metric: string;
        baselineValue: number;
        currentValue: number;
        change: number;
        changePercent: number;
        improved: boolean;
    }[];
    overallImproved: boolean;
}

/**
 * Performance Profiler Controller for query engine integration
 */
export class PerformanceProfilerController {
    private profiler: PerformanceProfiler | null = null;
    private baselineProfile: PerformanceProfile | null = null;

    /**
     * Get or create PerformanceProfiler instance
     */
    private async getProfiler(): Promise<PerformanceProfiler> {
        if (this.profiler) {
            return this.profiler;
        }

        const browserController = getCurrentBrowserController();
        if (!browserController) {
            throw new Error("Browser context not initialized. Navigate to a page first.");
        }

        const page = browserController.getCurrentPage();
        if (!page) {
            throw new Error("No page available in browser context.");
        }

        this.profiler = createPerformanceProfiler(page as unknown as BrowserPage);
        return this.profiler;
    }

    /**
     * Start profiling
     */
    async startProfiling(): Promise<void> {
        const profiler = await this.getProfiler();
        profiler.startProfiling();
    }

    /**
     * Record rendering timing data
     */
    async recordRenderingTiming(timing: RenderingTiming, resources: ResourceInfo[]): Promise<void> {
        const profiler = await this.getProfiler();
        profiler.recordRenderingTiming(timing, resources);
    }

    /**
     * Create a performance mark
     */
    async mark(name: string, detail?: unknown): Promise<PerformanceMark> {
        const profiler = await this.getProfiler();
        return profiler.mark(name, detail);
    }

    /**
     * Create a performance measure
     */
    async measure(name: string, startMark: string, endMark: string): Promise<PerformanceMeasure> {
        const profiler = await this.getProfiler();
        return profiler.measure(name, startMark, endMark);
    }

    /**
     * Get all marks
     */
    async getMarks(): Promise<PerformanceMark[]> {
        const profiler = await this.getProfiler();
        return profiler.getMarks();
    }

    /**
     * Get all measures
     */
    async getMeasures(): Promise<PerformanceMeasure[]> {
        const profiler = await this.getProfiler();
        return profiler.getMeasures();
    }

    /**
     * Get navigation timing
     */
    async getNavigationTiming(): Promise<NavigationTiming> {
        const profiler = await this.getProfiler();
        return profiler.getNavigationTiming();
    }

    /**
     * Get resource timing entries
     */
    async getResourceTiming(): Promise<ResourceTiming[]> {
        const profiler = await this.getProfiler();
        return profiler.getResourceTiming();
    }

    /**
     * Get Core Web Vitals
     */
    async getWebVitals(): Promise<WebVitals> {
        const profiler = await this.getProfiler();
        return profiler.getWebVitals();
    }

    /**
     * Get paint timing
     */
    async getPaintTiming(): Promise<PaintTiming> {
        const profiler = await this.getProfiler();
        return profiler.getPaintTiming();
    }

    /**
     * Get rendering metrics
     */
    async getRenderingMetrics(): Promise<RenderingMetrics> {
        const profiler = await this.getProfiler();
        return profiler.getRenderingMetrics();
    }

    /**
     * Get network performance
     */
    async getNetworkPerformance(): Promise<NetworkPerformance> {
        const profiler = await this.getProfiler();
        return profiler.getNetworkPerformance();
    }

    /**
     * Get memory info
     */
    async getMemoryInfo(): Promise<MemoryInfo> {
        const profiler = await this.getProfiler();
        return profiler.getMemoryInfo();
    }

    /**
     * Get complete performance profile
     */
    async getProfile(options?: ProfilingOptions): Promise<PerformanceProfile> {
        const profiler = await this.getProfiler();
        return profiler.getProfile(options);
    }

    /**
     * Get performance score (0-100)
     */
    async getPerformanceScore(): Promise<number> {
        const profiler = await this.getProfiler();
        return profiler.getPerformanceScore();
    }

    /**
     * Get performance summary with grade and recommendations
     */
    async getSummary(): Promise<{
        score: number;
        grade: "A" | "B" | "C" | "D" | "F";
        recommendations: string[];
    }> {
        const profiler = await this.getProfiler();
        return profiler.getSummary();
    }

    /**
     * Save current profile as baseline for comparison
     */
    async saveBaseline(): Promise<void> {
        const profiler = await this.getProfiler();
        this.baselineProfile = await profiler.getProfile();
    }

    /**
     * Compare current profile with baseline
     */
    async compareWithBaseline(): Promise<PerformanceComparison | null> {
        if (!this.baselineProfile) {
            return null;
        }

        const profiler = await this.getProfiler();
        const current = await profiler.getProfile();

        return this.compareProfiles(this.baselineProfile, current);
    }

    /**
     * Compare two performance profiles
     */
    private compareProfiles(baseline: PerformanceProfile, current: PerformanceProfile): PerformanceComparison {
        const differences: PerformanceComparison["differences"] = [];

        // Compare rendering metrics
        const renderingMetrics = [
            { metric: "htmlFetchMs", baseline: baseline.renderingMetrics.htmlFetchMs, current: current.renderingMetrics.htmlFetchMs },
            { metric: "htmlParseMs", baseline: baseline.renderingMetrics.htmlParseMs, current: current.renderingMetrics.htmlParseMs },
            { metric: "cssFetchMs", baseline: baseline.renderingMetrics.cssFetchMs, current: current.renderingMetrics.cssFetchMs },
            { metric: "cssParseMs", baseline: baseline.renderingMetrics.cssParseMs, current: current.renderingMetrics.cssParseMs },
            { metric: "scriptExecutionMs", baseline: baseline.renderingMetrics.scriptExecutionMs, current: current.renderingMetrics.scriptExecutionMs },
            { metric: "layoutComputationMs", baseline: baseline.renderingMetrics.layoutComputationMs, current: current.renderingMetrics.layoutComputationMs },
            { metric: "paintRecordingMs", baseline: baseline.renderingMetrics.paintRecordingMs, current: current.renderingMetrics.paintRecordingMs },
            { metric: "totalRenderMs", baseline: baseline.renderingMetrics.totalRenderMs, current: current.renderingMetrics.totalRenderMs },
        ];

        for (const item of renderingMetrics) {
            const change = item.current - item.baseline;
            const changePercent = item.baseline > 0 ? (change / item.baseline) * 100 : 0;

            differences.push({
                metric: item.metric,
                baselineValue: item.baseline,
                currentValue: item.current,
                change,
                changePercent,
                improved: change < 0, // Lower is better for timing metrics
            });
        }

        // Compare Web Vitals
        const vitalsMetrics = [
            { metric: "lcp", baseline: baseline.webVitals.lcp, current: current.webVitals.lcp },
            { metric: "fcp", baseline: baseline.webVitals.fcp, current: current.webVitals.fcp },
            { metric: "ttfb", baseline: baseline.webVitals.ttfb, current: current.webVitals.ttfb },
        ];

        for (const item of vitalsMetrics) {
            if (item.baseline !== null && item.current !== null) {
                const change = item.current - item.baseline;
                const changePercent = item.baseline > 0 ? (change / item.baseline) * 100 : 0;

                differences.push({
                    metric: item.metric,
                    baselineValue: item.baseline,
                    currentValue: item.current,
                    change,
                    changePercent,
                    improved: change < 0,
                });
            }
        }

        // Compare network performance
        const networkChange = current.networkPerformance.totalBytesTransferred - baseline.networkPerformance.totalBytesTransferred;
        differences.push({
            metric: "totalBytesTransferred",
            baselineValue: baseline.networkPerformance.totalBytesTransferred,
            currentValue: current.networkPerformance.totalBytesTransferred,
            change: networkChange,
            changePercent: baseline.networkPerformance.totalBytesTransferred > 0
                ? (networkChange / baseline.networkPerformance.totalBytesTransferred) * 100
                : 0,
            improved: networkChange < 0,
        });

        // Calculate overall improvement
        const improvedCount = differences.filter(d => d.improved).length;
        const overallImproved = improvedCount > differences.length / 2;

        return {
            baseline,
            current,
            differences,
            overallImproved,
        };
    }

    /**
     * Assert performance metrics against thresholds
     */
    async assertPerformance(thresholds: PerformanceThresholds): Promise<{
        passed: boolean;
        results: PerformanceAssertionResult[];
    }> {
        const profiler = await this.getProfiler();
        const vitals = profiler.getWebVitals();
        const metrics = profiler.getRenderingMetrics();
        const network = profiler.getNetworkPerformance();

        const results: PerformanceAssertionResult[] = [];

        // Check LCP
        if (thresholds.maxLCP !== undefined && vitals.lcp !== null) {
            results.push({
                passed: vitals.lcp <= thresholds.maxLCP,
                metric: "LCP",
                expected: `<= ${thresholds.maxLCP}ms`,
                actual: vitals.lcp,
                threshold: thresholds.maxLCP,
            });
        }

        // Check FCP
        if (thresholds.maxFCP !== undefined && vitals.fcp !== null) {
            results.push({
                passed: vitals.fcp <= thresholds.maxFCP,
                metric: "FCP",
                expected: `<= ${thresholds.maxFCP}ms`,
                actual: vitals.fcp,
                threshold: thresholds.maxFCP,
            });
        }

        // Check TTFB
        if (thresholds.maxTTFB !== undefined && vitals.ttfb !== null) {
            results.push({
                passed: vitals.ttfb <= thresholds.maxTTFB,
                metric: "TTFB",
                expected: `<= ${thresholds.maxTTFB}ms`,
                actual: vitals.ttfb,
                threshold: thresholds.maxTTFB,
            });
        }

        // Check CLS
        if (thresholds.maxCLS !== undefined && vitals.cls !== null) {
            results.push({
                passed: vitals.cls <= thresholds.maxCLS,
                metric: "CLS",
                expected: `<= ${thresholds.maxCLS}`,
                actual: vitals.cls,
                threshold: thresholds.maxCLS,
            });
        }

        // Check total load time
        if (thresholds.maxLoadTime !== undefined) {
            results.push({
                passed: metrics.totalRenderMs <= thresholds.maxLoadTime,
                metric: "Total Load Time",
                expected: `<= ${thresholds.maxLoadTime}ms`,
                actual: metrics.totalRenderMs,
                threshold: thresholds.maxLoadTime,
            });
        }

        // Check script execution time
        if (thresholds.maxScriptTime !== undefined) {
            results.push({
                passed: metrics.scriptExecutionMs <= thresholds.maxScriptTime,
                metric: "Script Execution Time",
                expected: `<= ${thresholds.maxScriptTime}ms`,
                actual: metrics.scriptExecutionMs,
                threshold: thresholds.maxScriptTime,
            });
        }

        // Check layout time
        if (thresholds.maxLayoutTime !== undefined) {
            results.push({
                passed: metrics.layoutComputationMs <= thresholds.maxLayoutTime,
                metric: "Layout Time",
                expected: `<= ${thresholds.maxLayoutTime}ms`,
                actual: metrics.layoutComputationMs,
                threshold: thresholds.maxLayoutTime,
            });
        }

        // Check cache hit ratio
        if (thresholds.minCacheHitRatio !== undefined) {
            results.push({
                passed: network.cacheHitRatio >= thresholds.minCacheHitRatio,
                metric: "Cache Hit Ratio",
                expected: `>= ${thresholds.minCacheHitRatio}`,
                actual: network.cacheHitRatio,
                threshold: thresholds.minCacheHitRatio,
            });
        }

        const passed = results.every(r => r.passed);

        return { passed, results };
    }

    /**
     * Assert Web Vitals meet good thresholds
     */
    async assertGoodWebVitals(): Promise<{
        passed: boolean;
        results: PerformanceAssertionResult[];
    }> {
        // Google's "Good" thresholds for Core Web Vitals
        return this.assertPerformance({
            maxLCP: 2500,    // Good: < 2.5s
            maxFCP: 1800,    // Good: < 1.8s
            maxTTFB: 200,    // Good: < 200ms
            maxCLS: 0.1,     // Good: < 0.1
        });
    }

    /**
     * Get slowest resources
     */
    async getSlowestResources(count: number = 5): Promise<ResourceTiming[]> {
        const profiler = await this.getProfiler();
        const resources = profiler.getResourceTiming();

        return resources
            .sort((a, b) => b.duration - a.duration)
            .slice(0, count);
    }

    /**
     * Get largest resources
     */
    async getLargestResources(count: number = 5): Promise<ResourceTiming[]> {
        const profiler = await this.getProfiler();
        const resources = profiler.getResourceTiming();

        return resources
            .sort((a, b) => b.transferSize - a.transferSize)
            .slice(0, count);
    }

    /**
     * Get uncached resources
     */
    async getUncachedResources(): Promise<ResourceTiming[]> {
        const profiler = await this.getProfiler();
        const resources = profiler.getResourceTiming();

        return resources.filter(r => !r.fromCache);
    }

    /**
     * Clear all recorded data
     */
    async clear(): Promise<void> {
        const profiler = await this.getProfiler();
        profiler.clear();
    }

    /**
     * Clear the profiler instance (for cleanup)
     */
    clearController(): void {
        this.profiler = null;
        this.baselineProfile = null;
    }
}

// Singleton instance
let performanceProfilerControllerInstance: PerformanceProfilerController | null = null;

/**
 * Get the performance profiler controller instance
 */
export function getPerformanceProfilerController(): PerformanceProfilerController {
    if (!performanceProfilerControllerInstance) {
        performanceProfilerControllerInstance = new PerformanceProfilerController();
    }
    return performanceProfilerControllerInstance;
}

/**
 * Clear the performance profiler controller instance
 */
export function clearPerformanceProfilerController(): void {
    if (performanceProfilerControllerInstance) {
        performanceProfilerControllerInstance.clearController();
        performanceProfilerControllerInstance = null;
    }
}

// Re-export types for convenience
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
};

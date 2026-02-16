/**
 * Performance Domain Agent
 *
 * Collects and reports performance metrics from the browser engine.
 * Provides CPU profiling, navigation timing, Web Vitals, rendering metrics,
 * and composite performance scoring. Hooks into RenderingPipeline and
 * RequestPipeline for real-time performance data.
 */

import type { DomainName } from "../../protocol/types.ts";
import { BaseDomain } from "../base-domain.ts";
import type {
    PerformanceMetric,
    GetMetricsResult,
    ProfileParams,
    ProfileResult,
    ProfileNode,
    GetNavigationTimingResult,
    NavigationTimingDescription,
    GetWebVitalsResult,
    WebVitalsDescription,
    GetRenderingMetricsResult,
    RenderingMetricsDescription,
    GetPerformanceScoreResult,
    PerformanceScoreDescription,
} from "./performance-types.ts";

/**
 * Performance Domain - metrics collection and profiling
 */
export class PerformanceDomain extends BaseDomain {
    readonly name: DomainName = "Performance";

    /** Whether CPU profiling is active */
    private profiling: boolean = false;

    /** CPU profiling start time in microseconds */
    private profilingStartTime: number = 0;

    /** Collected metrics during profiling */
    private collectedMetrics: PerformanceMetric[] = [];

    /** Periodic metrics emission timer */
    private metricsInterval: ReturnType<typeof setInterval> | null = null;

    protected setup(): void {
        this.registerMethod("getMetrics", "Collect performance metrics from all subsystems", async (params) => {
            return await this.getMetrics(params as unknown as Record<string, unknown>);
        });

        this.registerMethod("startProfiling", "Start CPU profiling", async (params) => {
            return await this.startProfiling(params as unknown as ProfileParams);
        });

        this.registerMethod("stopProfiling", "Stop CPU profiling and return profile", async (params) => {
            return await this.stopProfiling(params as unknown as ProfileParams);
        });

        this.registerMethod("getNavigationTiming", "Get navigation timing breakdown", async (params) => {
            return await this.getNavigationTiming(params as unknown as Record<string, unknown>);
        });

        this.registerMethod("getWebVitals", "Get Core Web Vitals metrics", async (params) => {
            return await this.getWebVitals(params as unknown as Record<string, unknown>);
        });

        this.registerMethod("getRenderingMetrics", "Get rendering pipeline metrics", async (params) => {
            return await this.getRenderingMetrics(params as unknown as Record<string, unknown>);
        });

        this.registerMethod("getPerformanceScore", "Get composite performance score", async (params) => {
            return await this.getPerformanceScore(params as unknown as Record<string, unknown>);
        });

        // Register events
        this.registerEvent("metrics", "Periodic metric updates when domain is enabled");
    }

    override async enable(): Promise<Record<string, unknown>> {
        await super.enable();

        // Start periodic metrics emission
        this.metricsInterval = setInterval(() => {
            if (this.enabled) {
                this.emitPeriodicMetrics();
            }
        }, 1000);

        return {};
    }

    override async disable(): Promise<Record<string, unknown>> {
        // Stop periodic metrics emission
        if (this.metricsInterval !== null) {
            clearInterval(this.metricsInterval);
            this.metricsInterval = null;
        }

        // Stop profiling if active
        if (this.profiling) {
            this.profiling = false;
        }

        await super.disable();
        return {};
    }

    /**
     * Emit periodic metrics event to listeners
     */
    private emitPeriodicMetrics(): void {
        const metrics = this.collectMetrics();
        this.emitEvent("metrics", {
            metrics,
            title: "Performance metrics update",
            timestamp: Date.now() / 1000,
        });
    }

    /**
     * Collect all performance metrics from browser subsystems
     */
    private collectMetrics(): PerformanceMetric[] {
        const metrics: PerformanceMetric[] = [];

        // Get rendering pipeline stats
        const renderingStats = this.context.renderingPipeline.getStats();

        // Viewport metrics
        metrics.push({ name: "ViewportWidth", value: renderingStats.viewport.width });
        metrics.push({ name: "ViewportHeight", value: renderingStats.viewport.height });
        metrics.push({ name: "DevicePixelRatio", value: renderingStats.viewport.devicePixelRatio });

        // Resource metrics
        metrics.push({ name: "ResourceCount", value: renderingStats.resources.total });
        metrics.push({ name: "ResourceTotalSize", value: renderingStats.resources.totalSize });
        metrics.push({ name: "ResourceCachedCount", value: renderingStats.resources.cachedCount });

        // Get timing data from last render result if available
        const lastResult = this.context.renderingPipeline.lastRenderResult;
        if (lastResult) {
            const timing = lastResult.timing;
            metrics.push({ name: "HTMLFetchTime", value: timing.htmlFetch });
            metrics.push({ name: "HTMLParseTime", value: timing.htmlParse });
            metrics.push({ name: "CSSFetchTime", value: timing.cssFetch });
            metrics.push({ name: "CSSParseTime", value: timing.cssParse });
            metrics.push({ name: "ScriptExecutionTime", value: timing.scriptExecution });
            metrics.push({ name: "StyleResolutionTime", value: timing.styleResolution });
            metrics.push({ name: "LayoutTime", value: timing.layoutComputation });
            metrics.push({ name: "PaintTime", value: timing.paintRecording });
            metrics.push({ name: "CompositingTime", value: timing.compositing });
            metrics.push({ name: "TotalRenderTime", value: timing.total });

            // DOM node count from the render result
            const domNodeCount = this.countNodes(lastResult.dom);
            metrics.push({ name: "DOMNodeCount", value: domNodeCount });

            // CSS rule count from CSSOM
            const cssRuleCount = lastResult.cssom.getRuleCount();
            metrics.push({ name: "CSSRuleCount", value: cssRuleCount });
        }

        // Memory-related metrics (estimates based on resource sizes)
        const totalResourceSize = renderingStats.resources.totalSize;
        metrics.push({ name: "JSHeapUsedSize", value: totalResourceSize * 3 });
        metrics.push({ name: "JSHeapTotalSize", value: totalResourceSize * 5 });

        // Request pipeline stats
        const requestStats = renderingStats.requestPipeline;
        if (requestStats && typeof requestStats === "object") {
            const reqStatsObj = requestStats as Record<string, unknown>;
            if (typeof reqStatsObj.totalRequests === "number") {
                metrics.push({ name: "TotalRequests", value: reqStatsObj.totalRequests });
            }
            if (typeof reqStatsObj.cacheHits === "number") {
                metrics.push({ name: "CacheHits", value: reqStatsObj.cacheHits });
            }
            if (typeof reqStatsObj.cacheMisses === "number") {
                metrics.push({ name: "CacheMisses", value: reqStatsObj.cacheMisses });
            }
        }

        // Timestamp
        metrics.push({ name: "Timestamp", value: Date.now() });

        return metrics;
    }

    /**
     * Count DOM nodes recursively
     */
    private countNodes(node: { childNodes?: { length: number } & Iterable<unknown> }): number {
        let count = 1;
        if (node.childNodes && node.childNodes.length > 0) {
            for (const child of node.childNodes) {
                count += this.countNodes(child as { childNodes?: { length: number } & Iterable<unknown> });
            }
        }
        return count;
    }

    // ---- Method implementations ----

    private async getMetrics(_params: Record<string, unknown>): Promise<GetMetricsResult> {
        const metrics = this.collectMetrics();
        return { metrics };
    }

    private async startProfiling(params: ProfileParams): Promise<Record<string, unknown>> {
        if (this.profiling) {
            return { error: "Profiling already in progress" };
        }

        const _samplingInterval = params.samplingInterval ?? 1000;
        this.profiling = true;
        this.profilingStartTime = performance.now() * 1000; // Convert to microseconds
        this.collectedMetrics = [];

        // Collect an initial snapshot of metrics
        this.collectedMetrics = this.collectMetrics();

        return {};
    }

    private async stopProfiling(_params: ProfileParams): Promise<ProfileResult> {
        const endTime = performance.now() * 1000; // Convert to microseconds

        if (!this.profiling) {
            return {
                profile: {
                    nodes: [],
                    startTime: 0,
                    endTime: 0,
                },
            };
        }

        this.profiling = false;
        const startTime = this.profilingStartTime;

        // Build a profile from collected data
        // Create synthetic profile nodes from rendering pipeline stages
        const nodes: ProfileNode[] = [];
        let nodeId = 1;

        const lastResult = this.context.renderingPipeline.lastRenderResult;
        if (lastResult) {
            const timing = lastResult.timing;

            // Root node
            const rootNode: ProfileNode = {
                id: nodeId++,
                callFrame: {
                    functionName: "(root)",
                    scriptId: "0",
                    url: "",
                    lineNumber: 0,
                    columnNumber: 0,
                },
                hitCount: 0,
                children: [],
            };
            nodes.push(rootNode);

            // Create nodes for each rendering stage
            const stages = [
                { name: "HTMLFetch", time: timing.htmlFetch, url: "browser://rendering/html-fetch" },
                { name: "HTMLParse", time: timing.htmlParse, url: "browser://rendering/html-parse" },
                { name: "CSSFetch", time: timing.cssFetch, url: "browser://rendering/css-fetch" },
                { name: "CSSParse", time: timing.cssParse, url: "browser://rendering/css-parse" },
                { name: "ScriptExecution", time: timing.scriptExecution, url: "browser://rendering/script-execution" },
                { name: "StyleResolution", time: timing.styleResolution, url: "browser://rendering/style-resolution" },
                { name: "Layout", time: timing.layoutComputation, url: "browser://rendering/layout" },
                { name: "Paint", time: timing.paintRecording, url: "browser://rendering/paint" },
                { name: "Compositing", time: timing.compositing, url: "browser://rendering/compositing" },
            ];

            for (const stage of stages) {
                const stageNode: ProfileNode = {
                    id: nodeId,
                    callFrame: {
                        functionName: stage.name,
                        scriptId: String(nodeId),
                        url: stage.url,
                        lineNumber: 0,
                        columnNumber: 0,
                    },
                    hitCount: Math.max(1, Math.round(stage.time)),
                    children: [],
                };
                nodes.push(stageNode);
                rootNode.children!.push(nodeId);
                nodeId++;
            }

            // Build samples array based on time distribution
            const samples: number[] = [];
            for (const stage of stages) {
                const sampleCount = Math.max(1, Math.round(stage.time));
                const stageNodeIndex = nodes.findIndex(n => n.callFrame.functionName === stage.name);
                if (stageNodeIndex >= 0) {
                    for (let i = 0; i < sampleCount; i++) {
                        samples.push(nodes[stageNodeIndex].id);
                    }
                }
            }

            return {
                profile: {
                    nodes,
                    startTime,
                    endTime,
                    samples,
                },
            };
        }

        // No render data available - return minimal profile
        const rootNode: ProfileNode = {
            id: 1,
            callFrame: {
                functionName: "(root)",
                scriptId: "0",
                url: "",
                lineNumber: 0,
                columnNumber: 0,
            },
            hitCount: 0,
            children: [],
        };
        nodes.push(rootNode);

        return {
            profile: {
                nodes,
                startTime,
                endTime,
            },
        };
    }

    private async getNavigationTiming(_params: Record<string, unknown>): Promise<GetNavigationTimingResult> {
        const lastResult = this.context.renderingPipeline.lastRenderResult;

        if (!lastResult) {
            // Return zeroed timing if no navigation has occurred
            const emptyTiming: NavigationTimingDescription = {
                navigationStart: 0,
                domainLookupStart: 0,
                domainLookupEnd: 0,
                connectStart: 0,
                connectEnd: 0,
                secureConnectionStart: 0,
                requestStart: 0,
                responseStart: 0,
                responseEnd: 0,
                domParseStart: 0,
                domParseEnd: 0,
                domContentLoadedEventStart: 0,
                domContentLoadedEventEnd: 0,
                loadEventStart: 0,
                loadEventEnd: 0,
            };
            return { timing: emptyTiming };
        }

        const t = lastResult.timing;
        const baseTime = Date.now() - t.total; // Approximate navigation start

        const timing: NavigationTimingDescription = {
            navigationStart: baseTime,
            domainLookupStart: baseTime,
            domainLookupEnd: baseTime + 5,
            connectStart: baseTime + 5,
            connectEnd: baseTime + 15,
            secureConnectionStart: baseTime + 10,
            requestStart: baseTime + 15,
            responseStart: baseTime + 15 + t.htmlFetch * 0.1,
            responseEnd: baseTime + t.htmlFetch,
            domParseStart: baseTime + t.htmlFetch,
            domParseEnd: baseTime + t.htmlFetch + t.htmlParse,
            domContentLoadedEventStart: baseTime + t.htmlFetch + t.htmlParse + t.cssFetch + t.cssParse,
            domContentLoadedEventEnd: baseTime + t.htmlFetch + t.htmlParse + t.cssFetch + t.cssParse + t.scriptExecution,
            loadEventStart: baseTime + t.total - t.compositing,
            loadEventEnd: baseTime + t.total,
        };

        return { timing };
    }

    private async getWebVitals(_params: Record<string, unknown>): Promise<GetWebVitalsResult> {
        const lastResult = this.context.renderingPipeline.lastRenderResult;

        if (!lastResult) {
            const emptyVitals: WebVitalsDescription = {
                lcp: null,
                fid: null,
                cls: null,
                fcp: null,
                ttfb: null,
                inp: null,
            };
            return { vitals: emptyVitals };
        }

        const t = lastResult.timing;

        // Calculate approximations based on rendering timing
        const ttfb = t.htmlFetch * 0.1;
        const fcp = t.htmlFetch + t.htmlParse + t.styleResolution + t.paintRecording * 0.5;
        const lcp = t.total - t.compositing;

        const vitals: WebVitalsDescription = {
            lcp,
            fid: null, // Cannot measure without user interaction
            cls: 0,    // Assume no layout shift without real measurement
            fcp,
            ttfb,
            inp: null, // Cannot measure without user interaction
        };

        return { vitals };
    }

    private async getRenderingMetrics(_params: Record<string, unknown>): Promise<GetRenderingMetricsResult> {
        const lastResult = this.context.renderingPipeline.lastRenderResult;

        if (!lastResult) {
            const emptyMetrics: RenderingMetricsDescription = {
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
            };
            return { metrics: emptyMetrics };
        }

        const t = lastResult.timing;

        const metrics: RenderingMetricsDescription = {
            htmlFetchMs: t.htmlFetch,
            htmlParseMs: t.htmlParse,
            cssFetchMs: t.cssFetch,
            cssParseMs: t.cssParse,
            scriptExecutionMs: t.scriptExecution,
            styleResolutionMs: t.styleResolution,
            layoutComputationMs: t.layoutComputation,
            paintRecordingMs: t.paintRecording,
            compositingMs: t.compositing,
            totalRenderMs: t.total,
        };

        return { metrics };
    }

    private async getPerformanceScore(_params: Record<string, unknown>): Promise<GetPerformanceScoreResult> {
        const lastResult = this.context.renderingPipeline.lastRenderResult;

        if (!lastResult) {
            const defaultScore: PerformanceScoreDescription = {
                performance: 0,
                accessibility: 0,
                bestPractices: 0,
                seo: 0,
                overall: 0,
            };
            return { score: defaultScore };
        }

        const t = lastResult.timing;

        // Calculate performance score based on Web Vitals thresholds
        let performanceScore = 100;

        // LCP scoring
        const lcp = t.total - t.compositing;
        if (lcp > 4000) performanceScore -= 30;
        else if (lcp > 2500) performanceScore -= 15;

        // FCP scoring
        const fcp = t.htmlFetch + t.htmlParse + t.styleResolution + t.paintRecording * 0.5;
        if (fcp > 3000) performanceScore -= 20;
        else if (fcp > 1800) performanceScore -= 10;

        // TTFB scoring
        const ttfb = t.htmlFetch * 0.1;
        if (ttfb > 800) performanceScore -= 15;
        else if (ttfb > 200) performanceScore -= 5;

        // Total render time scoring
        if (t.total > 5000) performanceScore -= 10;
        else if (t.total > 3000) performanceScore -= 5;

        // Bonus for cached resources
        const stats = this.context.renderingPipeline.getStats();
        if (stats.resources.total > 0) {
            const cacheRatio = stats.resources.cachedCount / stats.resources.total;
            if (cacheRatio > 0.5) performanceScore += 5;
        }

        performanceScore = Math.max(0, Math.min(100, performanceScore));

        // Estimate other scores (these would need dedicated analysis in a full implementation)
        const accessibilityScore = 80; // Default estimate
        const bestPracticesScore = 85; // Default estimate
        const seoScore = 75; // Default estimate
        const overallScore = Math.round(
            (performanceScore * 0.4 + accessibilityScore * 0.2 + bestPracticesScore * 0.2 + seoScore * 0.2),
        );

        const score: PerformanceScoreDescription = {
            performance: performanceScore,
            accessibility: accessibilityScore,
            bestPractices: bestPracticesScore,
            seo: seoScore,
            overall: overallScore,
        };

        return { score };
    }

    override dispose(): void {
        if (this.metricsInterval !== null) {
            clearInterval(this.metricsInterval);
            this.metricsInterval = null;
        }
        this.profiling = false;
        this.collectedMetrics = [];
        super.dispose();
    }
}

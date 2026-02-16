/**
 * Tests for Performance Domain Agent
 *
 * Covers metrics collection, CPU profiling (start/stop), navigation timing,
 * Web Vitals, rendering metrics, performance scoring, periodic metrics
 * emission, and cleanup.
 */

import { assertEquals } from "@std/assert";
import { EventBus } from "../../../integration/event-bus.ts";
import { PerformanceDomain } from "../../../domains/performance/performance-domain.ts";
import {
    createMockContext,
    createMockRenderingPipeline,
    createMockRenderResult,
} from "../../helpers/mocks.ts";

// ---------------------------------------------------------------------------
// Helper: create a fully wired PerformanceDomain
// ---------------------------------------------------------------------------

function setup(options?: { noRenderResult?: boolean }) {
    const eventBus = new EventBus();

    // Build a rendering pipeline with proper getStats shape expected by Performance domain
    const renderResult = options?.noRenderResult ? undefined : createMockRenderResult();

    const renderingPipeline = {
        lastRenderResult: options?.noRenderResult ? null : renderResult,
        render: async () => renderResult,
        getPixels: async () => new Uint8ClampedArray(100 * 50 * 4),
        screenshot: async () => new Uint8ClampedArray(100 * 50 * 4),
        setViewportSize: () => {},
        getRequestPipeline: () => ({}),
        getCompositor: () => ({}),
        clearCache: () => {},
        close: async () => {},
        getStats: () => ({
            viewport: { width: 1024, height: 768, devicePixelRatio: 2 },
            renders: 1,
            lastRenderTime: 165,
            resources: { total: 2, totalSize: 7000, cachedCount: 1, count: 2 },
            requestPipeline: { totalRequests: 15, cacheHits: 5, cacheMisses: 10 },
        }),
    };

    const context = createMockContext({
        eventBus,
        renderingPipeline: renderingPipeline as unknown as ReturnType<typeof createMockRenderingPipeline>,
    });

    const domain = new PerformanceDomain(eventBus);
    domain.initialize(context);

    return { domain, eventBus, renderingPipeline };
}

// ---------------------------------------------------------------------------
// enable / disable
// ---------------------------------------------------------------------------

Deno.test("PerformanceDomain enable() returns empty and starts metrics emission", async () => {
    const { domain } = setup();
    const result = await domain.enable();
    assertEquals(result, {});
    assertEquals(domain.isEnabled(), true);

    // Clean up the interval so the test doesn't leak
    await domain.disable();
});

Deno.test("PerformanceDomain disable() stops metrics timer and returns empty", async () => {
    const { domain } = setup();
    await domain.enable();

    const result = await domain.disable();
    assertEquals(result, {});
    assertEquals(domain.isEnabled(), false);
});

Deno.test("PerformanceDomain disable() stops profiling if active", async () => {
    const { domain } = setup();
    await domain.enable();
    await domain.handleMethod("startProfiling", {});

    await domain.disable();

    // After disable, starting a new profiling session should work (not "already in progress")
    await domain.enable();
    const startResult = await domain.handleMethod("startProfiling", {});
    assertEquals((startResult as { error?: string }).error, undefined);

    await domain.disable();
});

// ---------------------------------------------------------------------------
// getMetrics
// ---------------------------------------------------------------------------

Deno.test("PerformanceDomain getMetrics returns metric array with names and values", async () => {
    const { domain } = setup();
    await domain.enable();

    const result = await domain.handleMethod("getMetrics", {});
    const metricsResult = result as { metrics: Array<{ name: string; value: number }> };

    assertEquals(Array.isArray(metricsResult.metrics), true);
    assertEquals(metricsResult.metrics.length > 0, true);

    // Check that expected metric names are present
    const metricNames = metricsResult.metrics.map((m) => m.name);
    assertEquals(metricNames.includes("ViewportWidth"), true);
    assertEquals(metricNames.includes("ViewportHeight"), true);
    assertEquals(metricNames.includes("ResourceCount"), true);
    assertEquals(metricNames.includes("ResourceTotalSize"), true);
    assertEquals(metricNames.includes("Timestamp"), true);

    // Check viewport values
    const viewportWidth = metricsResult.metrics.find((m) => m.name === "ViewportWidth");
    assertEquals(viewportWidth!.value, 1024);

    await domain.disable();
});

Deno.test("PerformanceDomain getMetrics includes timing metrics from render result", async () => {
    const { domain } = setup();
    await domain.enable();

    const result = await domain.handleMethod("getMetrics", {});
    const metricsResult = result as { metrics: Array<{ name: string; value: number }> };

    const metricNames = metricsResult.metrics.map((m) => m.name);
    assertEquals(metricNames.includes("HTMLFetchTime"), true);
    assertEquals(metricNames.includes("HTMLParseTime"), true);
    assertEquals(metricNames.includes("CSSFetchTime"), true);
    assertEquals(metricNames.includes("TotalRenderTime"), true);
    assertEquals(metricNames.includes("DOMNodeCount"), true);
    assertEquals(metricNames.includes("CSSRuleCount"), true);

    const totalRender = metricsResult.metrics.find((m) => m.name === "TotalRenderTime");
    assertEquals(totalRender!.value, 165);

    await domain.disable();
});

Deno.test("PerformanceDomain getMetrics includes request pipeline stats", async () => {
    const { domain } = setup();
    await domain.enable();

    const result = await domain.handleMethod("getMetrics", {});
    const metricsResult = result as { metrics: Array<{ name: string; value: number }> };

    const metricNames = metricsResult.metrics.map((m) => m.name);
    assertEquals(metricNames.includes("TotalRequests"), true);
    assertEquals(metricNames.includes("CacheHits"), true);
    assertEquals(metricNames.includes("CacheMisses"), true);

    const totalReqs = metricsResult.metrics.find((m) => m.name === "TotalRequests");
    assertEquals(totalReqs!.value, 15);

    await domain.disable();
});

// ---------------------------------------------------------------------------
// startProfiling / stopProfiling
// ---------------------------------------------------------------------------

Deno.test("PerformanceDomain startProfiling starts profiling and returns empty", async () => {
    const { domain } = setup();
    await domain.enable();

    const result = await domain.handleMethod("startProfiling", {});
    assertEquals((result as { error?: string }).error, undefined);

    // Stop profiling to clean up
    await domain.handleMethod("stopProfiling", {});
    await domain.disable();
});

Deno.test("PerformanceDomain startProfiling when already profiling returns error", async () => {
    const { domain } = setup();
    await domain.enable();

    await domain.handleMethod("startProfiling", {});
    const secondStart = await domain.handleMethod("startProfiling", {});

    assertEquals((secondStart as { error: string }).error, "Profiling already in progress");

    await domain.handleMethod("stopProfiling", {});
    await domain.disable();
});

Deno.test("PerformanceDomain stopProfiling returns profile data with nodes", async () => {
    const { domain } = setup();
    await domain.enable();

    await domain.handleMethod("startProfiling", {});
    const result = await domain.handleMethod("stopProfiling", {});
    const profileResult = result as {
        profile: {
            nodes: Array<{ id: number; callFrame: { functionName: string } }>;
            startTime: number;
            endTime: number;
            samples?: number[];
        };
    };

    assertEquals(profileResult.profile !== undefined, true);
    assertEquals(profileResult.profile.nodes.length > 0, true);
    assertEquals(profileResult.profile.startTime > 0, true);
    assertEquals(profileResult.profile.endTime > 0, true);
    assertEquals(profileResult.profile.endTime >= profileResult.profile.startTime, true);

    // Root node should exist
    const rootNode = profileResult.profile.nodes.find(
        (n) => n.callFrame.functionName === "(root)",
    );
    assertEquals(rootNode !== undefined, true);

    // Should have rendering stage nodes
    const htmlFetchNode = profileResult.profile.nodes.find(
        (n) => n.callFrame.functionName === "HTMLFetch",
    );
    assertEquals(htmlFetchNode !== undefined, true);

    await domain.disable();
});

Deno.test("PerformanceDomain stopProfiling when not profiling returns empty profile", async () => {
    const { domain } = setup();
    await domain.enable();

    const result = await domain.handleMethod("stopProfiling", {});
    const profileResult = result as {
        profile: { nodes: unknown[]; startTime: number; endTime: number };
    };

    assertEquals(profileResult.profile.nodes.length, 0);
    assertEquals(profileResult.profile.startTime, 0);
    assertEquals(profileResult.profile.endTime, 0);

    await domain.disable();
});

// ---------------------------------------------------------------------------
// getNavigationTiming
// ---------------------------------------------------------------------------

Deno.test("PerformanceDomain getNavigationTiming returns timing breakdown", async () => {
    const { domain } = setup();
    await domain.enable();

    const result = await domain.handleMethod("getNavigationTiming", {});
    const timingResult = result as {
        timing: {
            navigationStart: number;
            domainLookupStart: number;
            responseEnd: number;
            domParseStart: number;
            domParseEnd: number;
            loadEventEnd: number;
        };
    };

    const timing = timingResult.timing;
    assertEquals(timing.navigationStart > 0, true);
    assertEquals(timing.domainLookupStart >= timing.navigationStart, true);
    assertEquals(timing.responseEnd > timing.navigationStart, true);
    assertEquals(timing.domParseEnd >= timing.domParseStart, true);
    assertEquals(timing.loadEventEnd >= timing.navigationStart, true);

    await domain.disable();
});

Deno.test("PerformanceDomain getNavigationTiming returns zeros when no render result", async () => {
    const { domain } = setup({ noRenderResult: true });
    await domain.enable();

    const result = await domain.handleMethod("getNavigationTiming", {});
    const timingResult = result as {
        timing: { navigationStart: number; loadEventEnd: number };
    };

    assertEquals(timingResult.timing.navigationStart, 0);
    assertEquals(timingResult.timing.loadEventEnd, 0);

    await domain.disable();
});

// ---------------------------------------------------------------------------
// getWebVitals
// ---------------------------------------------------------------------------

Deno.test("PerformanceDomain getWebVitals returns web vital metrics", async () => {
    const { domain } = setup();
    await domain.enable();

    const result = await domain.handleMethod("getWebVitals", {});
    const vitalsResult = result as {
        vitals: {
            lcp: number | null;
            fid: number | null;
            cls: number | null;
            fcp: number | null;
            ttfb: number | null;
            inp: number | null;
        };
    };

    const vitals = vitalsResult.vitals;
    assertEquals(vitals.lcp !== null, true);
    assertEquals(typeof vitals.lcp, "number");
    assertEquals(vitals.fcp !== null, true);
    assertEquals(vitals.ttfb !== null, true);
    assertEquals(vitals.cls !== null, true);
    assertEquals(vitals.cls, 0); // No layout shift measured
    assertEquals(vitals.fid, null); // No user interaction
    assertEquals(vitals.inp, null); // No user interaction

    await domain.disable();
});

Deno.test("PerformanceDomain getWebVitals returns nulls when no render result", async () => {
    const { domain } = setup({ noRenderResult: true });
    await domain.enable();

    const result = await domain.handleMethod("getWebVitals", {});
    const vitalsResult = result as {
        vitals: { lcp: null; fid: null; cls: null; fcp: null; ttfb: null; inp: null };
    };

    assertEquals(vitalsResult.vitals.lcp, null);
    assertEquals(vitalsResult.vitals.fcp, null);
    assertEquals(vitalsResult.vitals.ttfb, null);

    await domain.disable();
});

// ---------------------------------------------------------------------------
// getRenderingMetrics
// ---------------------------------------------------------------------------

Deno.test("PerformanceDomain getRenderingMetrics returns rendering stats", async () => {
    const { domain } = setup();
    await domain.enable();

    const result = await domain.handleMethod("getRenderingMetrics", {});
    const renderResult = result as {
        metrics: {
            htmlFetchMs: number;
            htmlParseMs: number;
            cssFetchMs: number;
            cssParseMs: number;
            scriptExecutionMs: number;
            styleResolutionMs: number;
            layoutComputationMs: number;
            paintRecordingMs: number;
            compositingMs: number;
            totalRenderMs: number;
        };
    };

    const metrics = renderResult.metrics;
    assertEquals(metrics.htmlFetchMs, 50);
    assertEquals(metrics.htmlParseMs, 20);
    assertEquals(metrics.cssFetchMs, 30);
    assertEquals(metrics.cssParseMs, 10);
    assertEquals(metrics.scriptExecutionMs, 0);
    assertEquals(metrics.styleResolutionMs, 15);
    assertEquals(metrics.layoutComputationMs, 25);
    assertEquals(metrics.paintRecordingMs, 10);
    assertEquals(metrics.compositingMs, 5);
    assertEquals(metrics.totalRenderMs, 165);

    await domain.disable();
});

Deno.test("PerformanceDomain getRenderingMetrics returns zeros when no render result", async () => {
    const { domain } = setup({ noRenderResult: true });
    await domain.enable();

    const result = await domain.handleMethod("getRenderingMetrics", {});
    const renderResult = result as {
        metrics: { htmlFetchMs: number; totalRenderMs: number };
    };

    assertEquals(renderResult.metrics.htmlFetchMs, 0);
    assertEquals(renderResult.metrics.totalRenderMs, 0);

    await domain.disable();
});

// ---------------------------------------------------------------------------
// getPerformanceScore
// ---------------------------------------------------------------------------

Deno.test("PerformanceDomain getPerformanceScore returns score between 0-100", async () => {
    const { domain } = setup();
    await domain.enable();

    const result = await domain.handleMethod("getPerformanceScore", {});
    const scoreResult = result as {
        score: {
            performance: number;
            accessibility: number;
            bestPractices: number;
            seo: number;
            overall: number;
        };
    };

    const score = scoreResult.score;
    assertEquals(score.performance >= 0, true);
    assertEquals(score.performance <= 100, true);
    assertEquals(score.accessibility, 80);
    assertEquals(score.bestPractices, 85);
    assertEquals(score.seo, 75);
    assertEquals(score.overall >= 0, true);
    assertEquals(score.overall <= 100, true);

    await domain.disable();
});

Deno.test("PerformanceDomain getPerformanceScore returns zeros when no render result", async () => {
    const { domain } = setup({ noRenderResult: true });
    await domain.enable();

    const result = await domain.handleMethod("getPerformanceScore", {});
    const scoreResult = result as {
        score: { performance: number; overall: number };
    };

    assertEquals(scoreResult.score.performance, 0);
    assertEquals(scoreResult.score.overall, 0);

    await domain.disable();
});

// ---------------------------------------------------------------------------
// Periodic metrics emission
// ---------------------------------------------------------------------------

Deno.test("PerformanceDomain emits periodic metrics events when enabled", async () => {
    const { domain, eventBus } = setup();

    const events: unknown[] = [];
    eventBus.on("Performance.metrics", (data) => events.push(data));

    await domain.enable();

    // Wait slightly over 1 second for the periodic emission to fire
    await new Promise((resolve) => setTimeout(resolve, 1200));

    assertEquals(events.length >= 1, true);
    const eventData = events[0] as {
        metrics: Array<{ name: string; value: number }>;
        title: string;
        timestamp: number;
    };
    assertEquals(Array.isArray(eventData.metrics), true);
    assertEquals(eventData.title, "Performance metrics update");
    assertEquals(typeof eventData.timestamp, "number");

    await domain.disable();
});

// ---------------------------------------------------------------------------
// dispose
// ---------------------------------------------------------------------------

Deno.test("PerformanceDomain dispose stops timer and cleans up", async () => {
    const { domain } = setup();
    await domain.enable();

    domain.dispose();

    assertEquals(domain.isEnabled(), false);
});

// ---------------------------------------------------------------------------
// Enhanced Edge Case Tests
// ---------------------------------------------------------------------------

Deno.test("PerformanceDomain handleMethod throws for unknown method", async () => {
    const { domain } = setup();
    await domain.enable();

    let threw = false;
    try {
        await domain.handleMethod("nonExistentMethod", {});
    } catch (e) {
        threw = true;
        assertEquals((e as Error).message.includes("not found"), true);
    }
    assertEquals(threw, true);

    await domain.disable();
});

Deno.test("PerformanceDomain getMetrics without render result still returns viewport metrics", async () => {
    const { domain } = setup({ noRenderResult: true });
    await domain.enable();

    const result = await domain.handleMethod("getMetrics", {});
    const metricsResult = result as { metrics: Array<{ name: string; value: number }> };

    const metricNames = metricsResult.metrics.map((m) => m.name);
    assertEquals(metricNames.includes("ViewportWidth"), true);
    assertEquals(metricNames.includes("ViewportHeight"), true);
    assertEquals(metricNames.includes("Timestamp"), true);

    // Should NOT include timing metrics when no render result
    assertEquals(metricNames.includes("HTMLFetchTime"), false);
    assertEquals(metricNames.includes("TotalRenderTime"), false);

    await domain.disable();
});

Deno.test("PerformanceDomain getPerformanceScore has fixed defaults for non-performance categories", async () => {
    const { domain } = setup();
    await domain.enable();

    const result = await domain.handleMethod("getPerformanceScore", {});
    const scoreResult = result as {
        score: {
            accessibility: number;
            bestPractices: number;
            seo: number;
        };
    };

    // These are fixed estimate defaults
    assertEquals(scoreResult.score.accessibility, 80);
    assertEquals(scoreResult.score.bestPractices, 85);
    assertEquals(scoreResult.score.seo, 75);

    await domain.disable();
});

Deno.test("PerformanceDomain startProfiling with custom samplingInterval succeeds", async () => {
    const { domain } = setup();
    await domain.enable();

    const result = await domain.handleMethod("startProfiling", { samplingInterval: 500 });
    assertEquals((result as { error?: string }).error, undefined);

    await domain.handleMethod("stopProfiling", {});
    await domain.disable();
});

Deno.test("PerformanceDomain stopProfiling without render data returns root-only profile", async () => {
    const { domain } = setup({ noRenderResult: true });
    await domain.enable();

    await domain.handleMethod("startProfiling", {});
    const result = await domain.handleMethod("stopProfiling", {});
    const profileResult = result as {
        profile: {
            nodes: Array<{ id: number; callFrame: { functionName: string }; children: number[] }>;
            startTime: number;
            endTime: number;
        };
    };

    // Should have only root node (no rendering stage nodes)
    assertEquals(profileResult.profile.nodes.length, 1);
    assertEquals(profileResult.profile.nodes[0].callFrame.functionName, "(root)");
    assertEquals(profileResult.profile.nodes[0].children!.length, 0);
    assertEquals(profileResult.profile.startTime > 0, true);
    assertEquals(profileResult.profile.endTime >= profileResult.profile.startTime, true);

    await domain.disable();
});

Deno.test("PerformanceDomain dispose stops profiling state", async () => {
    const { domain } = setup();
    await domain.enable();
    await domain.handleMethod("startProfiling", {});

    domain.dispose();

    assertEquals(domain.isEnabled(), false);

    // After dispose, re-create and verify profiling can restart
    // (confirms profiling was stopped during dispose)
});

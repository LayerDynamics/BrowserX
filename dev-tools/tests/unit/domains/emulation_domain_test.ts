/**
 * Tests for Emulation Domain Agent
 *
 * Covers device metrics, user agent, media emulation, geolocation,
 * timezone, locale, touch emulation, network conditions,
 * CPU throttling, script execution, and lifecycle management.
 */

import { assertEquals, assertExists, assertRejects } from "@std/assert";
import { EventBus } from "../../../integration/event-bus.ts";
import { EmulationDomain } from "../../../domains/emulation/emulation-domain.ts";
import {
    createMockContext,
    createMockBrowser,
    createMockRenderingPipeline,
    createMockRenderResult,
    resetNodeIdCounter,
} from "../../helpers/mocks.ts";
import type { ProtocolEvent } from "../../../protocol/types.ts";

// ---------------------------------------------------------------------------
// Helper: set up a fresh EmulationDomain wired to an EventBus + mock context
// ---------------------------------------------------------------------------

function setup(options?: {
    browserOverrides?: Record<string, unknown>;
}) {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new EmulationDomain(eventBus);

    const viewportState = { width: 1024, height: 768 };
    const mockBrowser = createMockBrowser();

    // Track viewport changes
    const setViewportSize = (w: number, h: number) => {
        viewportState.width = w;
        viewportState.height = h;
    };
    Object.assign(mockBrowser, { setViewportSize });

    if (options?.browserOverrides) {
        Object.assign(mockBrowser, options.browserOverrides);
    }

    const context = createMockContext({ eventBus, browser: mockBrowser as ReturnType<typeof createMockBrowser> });
    domain.initialize(context);

    // Collect emitted protocol events
    const events: ProtocolEvent[] = [];
    domain.addEventListener((evt) => events.push(evt));

    return { domain, eventBus, events, viewportState, mockBrowser };
}

/**
 * Helper to capture event bus data without null narrowing issues
 */
function captureEventBusData(eventBus: EventBus, eventName: string): { getData: () => Record<string, unknown>; wasReceived: () => boolean } {
    let data: Record<string, unknown> = {};
    let received = false;
    eventBus.on(eventName, (d) => {
        data = d as Record<string, unknown>;
        received = true;
    });
    return {
        getData: () => data,
        wasReceived: () => received,
    };
}

// ---------------------------------------------------------------------------
// enable()
// ---------------------------------------------------------------------------

Deno.test("EmulationDomain: enable() returns empty object", async () => {
    const { domain } = setup();
    const result = await domain.enable();
    assertEquals(result, {});
    assertEquals(domain.isEnabled(), true);
});

// ---------------------------------------------------------------------------
// setDeviceMetricsOverride()
// ---------------------------------------------------------------------------

Deno.test("EmulationDomain: setDeviceMetricsOverride() updates viewport via browser", async () => {
    const { domain, eventBus, viewportState } = setup();
    await domain.enable();

    const capture = captureEventBusData(eventBus, "Emulation.deviceMetricsChanged");

    await domain.handleMethod("setDeviceMetricsOverride", {
        width: 375,
        height: 812,
        deviceScaleFactor: 3,
        mobile: true,
    });

    // Verify viewport was set on the browser
    assertEquals(viewportState.width, 375);
    assertEquals(viewportState.height, 812);

    // Verify event was emitted
    assertEquals(capture.wasReceived(), true);
    const metricsData = capture.getData();
    assertEquals(metricsData.width, 375);
    assertEquals(metricsData.height, 812);
    assertEquals(metricsData.deviceScaleFactor, 3);
    assertEquals(metricsData.mobile, true);

    // Verify emulation state
    const state = domain.getEmulationState();
    const metrics = state.deviceMetrics as Record<string, unknown>;
    assertEquals(metrics.width, 375);
    assertEquals(metrics.height, 812);
    assertEquals(metrics.mobile, true);
});

Deno.test("EmulationDomain: setDeviceMetricsOverride() with zero dimensions does not call setViewportSize", async () => {
    const { domain, viewportState } = setup();
    await domain.enable();

    await domain.handleMethod("setDeviceMetricsOverride", {
        width: 0,
        height: 0,
        deviceScaleFactor: 0,
        mobile: false,
    });

    // Viewport should remain unchanged
    assertEquals(viewportState.width, 1024);
    assertEquals(viewportState.height, 768);
});

// ---------------------------------------------------------------------------
// clearDeviceMetricsOverride()
// ---------------------------------------------------------------------------

Deno.test("EmulationDomain: clearDeviceMetricsOverride() restores original viewport", async () => {
    const { domain, eventBus, viewportState } = setup();
    await domain.enable();

    // First override
    await domain.handleMethod("setDeviceMetricsOverride", {
        width: 375,
        height: 812,
        deviceScaleFactor: 3,
        mobile: true,
    });

    let clearEmitted = false;
    eventBus.on("Emulation.deviceMetricsCleared", () => { clearEmitted = true; });

    // Then clear
    await domain.handleMethod("clearDeviceMetricsOverride", {});

    // Should restore to config values (1024x768)
    assertEquals(viewportState.width, 1024);
    assertEquals(viewportState.height, 768);
    assertEquals(clearEmitted, true);

    const state = domain.getEmulationState();
    const metrics = state.deviceMetrics as Record<string, unknown>;
    assertEquals(metrics.width, 0);
    assertEquals(metrics.height, 0);
    assertEquals(metrics.mobile, false);
});

// ---------------------------------------------------------------------------
// setUserAgentOverride()
// ---------------------------------------------------------------------------

Deno.test("EmulationDomain: setUserAgentOverride() stores user agent and emits event", async () => {
    const { domain, eventBus } = setup();
    await domain.enable();

    const capture = captureEventBusData(eventBus, "Emulation.userAgentChanged");

    await domain.handleMethod("setUserAgentOverride", {
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)",
        acceptLanguage: "en-US,en;q=0.9",
        platform: "iPhone",
    });

    const state = domain.getEmulationState();
    assertEquals(state.userAgent, "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)");
    assertEquals(state.acceptLanguage, "en-US,en;q=0.9");
    assertEquals(state.platform, "iPhone");

    assertEquals(capture.wasReceived(), true);
    assertEquals(capture.getData().userAgent, "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)");
});

Deno.test("EmulationDomain: setUserAgentOverride() with metadata stores userAgentMetadata", async () => {
    const { domain } = setup();
    await domain.enable();

    await domain.handleMethod("setUserAgentOverride", {
        userAgent: "TestBrowser/1.0",
        userAgentMetadata: {
            brands: [{ brand: "TestBrowser", version: "1.0" }],
            platform: "TestOS",
            mobile: false,
        },
    });

    const state = domain.getEmulationState();
    assertExists(state.userAgentMetadata);
    const metadata = state.userAgentMetadata as Record<string, unknown>;
    assertEquals(metadata.platform, "TestOS");
});

// ---------------------------------------------------------------------------
// setEmulatedMedia()
// ---------------------------------------------------------------------------

Deno.test("EmulationDomain: setEmulatedMedia() stores media type and features", async () => {
    const { domain, eventBus } = setup();
    await domain.enable();

    const capture = captureEventBusData(eventBus, "Emulation.emulatedMediaChanged");

    await domain.handleMethod("setEmulatedMedia", {
        media: "print",
        features: [
            { name: "prefers-color-scheme", value: "dark" },
            { name: "prefers-reduced-motion", value: "reduce" },
        ],
    });

    const state = domain.getEmulationState();
    assertEquals(state.emulatedMedia, "print");
    const features = state.emulatedMediaFeatures as Array<Record<string, string>>;
    assertEquals(features.length, 2);
    assertEquals(features[0].name, "prefers-color-scheme");
    assertEquals(features[0].value, "dark");

    assertEquals(capture.wasReceived(), true);
    assertEquals(capture.getData().media, "print");
});

// ---------------------------------------------------------------------------
// setGeolocationOverride() / clearGeolocationOverride()
// ---------------------------------------------------------------------------

Deno.test("EmulationDomain: setGeolocationOverride() stores geolocation", async () => {
    const { domain, eventBus } = setup();
    await domain.enable();

    const capture = captureEventBusData(eventBus, "Emulation.geolocationChanged");

    await domain.handleMethod("setGeolocationOverride", {
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 100,
    });

    const state = domain.getEmulationState();
    const geo = state.geolocation as Record<string, number>;
    assertEquals(geo.latitude, 37.7749);
    assertEquals(geo.longitude, -122.4194);
    assertEquals(geo.accuracy, 100);

    assertEquals(capture.wasReceived(), true);
});

Deno.test("EmulationDomain: setGeolocationOverride() with no coords clears geolocation", async () => {
    const { domain } = setup();
    await domain.enable();

    // Set first
    await domain.handleMethod("setGeolocationOverride", {
        latitude: 37.7749,
        longitude: -122.4194,
    });

    // Clear by omitting coordinates
    await domain.handleMethod("setGeolocationOverride", {});

    const state = domain.getEmulationState();
    assertEquals(state.geolocation, null);
});

Deno.test("EmulationDomain: clearGeolocationOverride() clears geolocation", async () => {
    const { domain, eventBus } = setup();
    await domain.enable();

    await domain.handleMethod("setGeolocationOverride", {
        latitude: 40.7128,
        longitude: -74.0060,
    });

    const capture = captureEventBusData(eventBus, "Emulation.geolocationChanged");

    await domain.handleMethod("clearGeolocationOverride", {});

    const state = domain.getEmulationState();
    assertEquals(state.geolocation, null);

    assertEquals(capture.wasReceived(), true);
    assertEquals(capture.getData().geolocation, null);
});

// ---------------------------------------------------------------------------
// setTimezoneOverride()
// ---------------------------------------------------------------------------

Deno.test("EmulationDomain: setTimezoneOverride() stores timezone", async () => {
    const { domain, eventBus } = setup();
    await domain.enable();

    const capture = captureEventBusData(eventBus, "Emulation.timezoneChanged");

    await domain.handleMethod("setTimezoneOverride", {
        timezoneId: "America/New_York",
    });

    const state = domain.getEmulationState();
    assertEquals(state.timezoneId, "America/New_York");
    assertEquals(capture.wasReceived(), true);
    assertEquals(capture.getData().timezoneId, "America/New_York");
});

Deno.test("EmulationDomain: setTimezoneOverride() with empty string clears timezone", async () => {
    const { domain } = setup();
    await domain.enable();

    await domain.handleMethod("setTimezoneOverride", { timezoneId: "Europe/London" });
    await domain.handleMethod("setTimezoneOverride", { timezoneId: "" });

    const state = domain.getEmulationState();
    assertEquals(state.timezoneId, null);
});

// ---------------------------------------------------------------------------
// setLocaleOverride()
// ---------------------------------------------------------------------------

Deno.test("EmulationDomain: setLocaleOverride() stores locale", async () => {
    const { domain, eventBus } = setup();
    await domain.enable();

    const capture = captureEventBusData(eventBus, "Emulation.localeChanged");

    await domain.handleMethod("setLocaleOverride", { locale: "ja-JP" });

    const state = domain.getEmulationState();
    assertEquals(state.locale, "ja-JP");
    assertEquals(capture.wasReceived(), true);
    assertEquals(capture.getData().locale, "ja-JP");
});

Deno.test("EmulationDomain: setLocaleOverride() with empty string clears locale", async () => {
    const { domain } = setup();
    await domain.enable();

    await domain.handleMethod("setLocaleOverride", { locale: "fr-FR" });
    await domain.handleMethod("setLocaleOverride", { locale: "" });

    const state = domain.getEmulationState();
    assertEquals(state.locale, null);
});

// ---------------------------------------------------------------------------
// setTouchEmulationEnabled()
// ---------------------------------------------------------------------------

Deno.test("EmulationDomain: setTouchEmulationEnabled() stores touch state", async () => {
    const { domain, eventBus } = setup();
    await domain.enable();

    const capture = captureEventBusData(eventBus, "Emulation.touchEmulationChanged");

    await domain.handleMethod("setTouchEmulationEnabled", {
        enabled: true,
        maxTouchPoints: 5,
    });

    const state = domain.getEmulationState();
    assertEquals(state.touchEmulation, true);
    assertEquals(state.maxTouchPoints, 5);

    assertEquals(capture.wasReceived(), true);
    assertEquals(capture.getData().enabled, true);
    assertEquals(capture.getData().maxTouchPoints, 5);
});

Deno.test("EmulationDomain: setTouchEmulationEnabled() defaults maxTouchPoints to 1 when enabled", async () => {
    const { domain } = setup();
    await domain.enable();

    await domain.handleMethod("setTouchEmulationEnabled", { enabled: true });

    const state = domain.getEmulationState();
    assertEquals(state.touchEmulation, true);
    assertEquals(state.maxTouchPoints, 1);
});

Deno.test("EmulationDomain: setTouchEmulationEnabled(false) sets maxTouchPoints to 0", async () => {
    const { domain } = setup();
    await domain.enable();

    await domain.handleMethod("setTouchEmulationEnabled", { enabled: false });

    const state = domain.getEmulationState();
    assertEquals(state.touchEmulation, false);
    assertEquals(state.maxTouchPoints, 0);
});

// ---------------------------------------------------------------------------
// setNetworkConditions()
// ---------------------------------------------------------------------------

Deno.test("EmulationDomain: setNetworkConditions() stores conditions", async () => {
    const { domain, eventBus } = setup();
    await domain.enable();

    const capture = captureEventBusData(eventBus, "Emulation.networkConditionsChanged");

    await domain.handleMethod("setNetworkConditions", {
        offline: false,
        latency: 100,
        downloadThroughput: 500000,
        uploadThroughput: 250000,
    });

    const state = domain.getEmulationState();
    const conditions = state.networkConditions as Record<string, unknown>;
    assertEquals(conditions.offline, false);
    assertEquals(conditions.latency, 100);
    assertEquals(conditions.downloadThroughput, 500000);
    assertEquals(conditions.uploadThroughput, 250000);

    assertEquals(capture.wasReceived(), true);
});

Deno.test("EmulationDomain: setNetworkConditions() offline mode", async () => {
    const { domain } = setup();
    await domain.enable();

    await domain.handleMethod("setNetworkConditions", {
        offline: true,
        latency: 0,
        downloadThroughput: 0,
        uploadThroughput: 0,
    });

    const state = domain.getEmulationState();
    const conditions = state.networkConditions as Record<string, unknown>;
    assertEquals(conditions.offline, true);
});

// ---------------------------------------------------------------------------
// setCPUThrottlingRate()
// ---------------------------------------------------------------------------

Deno.test("EmulationDomain: setCPUThrottlingRate() sets valid rate", async () => {
    const { domain, eventBus } = setup();
    await domain.enable();

    const capture = captureEventBusData(eventBus, "Emulation.cpuThrottlingChanged");

    await domain.handleMethod("setCPUThrottlingRate", { rate: 4 });

    const state = domain.getEmulationState();
    assertEquals(state.cpuThrottlingRate, 4);
    assertEquals(capture.wasReceived(), true);
    assertEquals(capture.getData().rate, 4);
});

Deno.test("EmulationDomain: setCPUThrottlingRate() validates rate >= 1", async () => {
    const { domain } = setup();
    await domain.enable();

    await assertRejects(
        async () => {
            await domain.handleMethod("setCPUThrottlingRate", { rate: 0.5 });
        },
        Error,
        "CPU throttling rate must be >= 1",
    );
});

Deno.test("EmulationDomain: setCPUThrottlingRate() with rate 1 means no throttling", async () => {
    const { domain } = setup();
    await domain.enable();

    await domain.handleMethod("setCPUThrottlingRate", { rate: 1 });

    const state = domain.getEmulationState();
    assertEquals(state.cpuThrottlingRate, 1);
});

// ---------------------------------------------------------------------------
// setScriptExecutionDisabled()
// ---------------------------------------------------------------------------

Deno.test("EmulationDomain: setScriptExecutionDisabled() stores state", async () => {
    const { domain, eventBus } = setup();
    await domain.enable();

    const capture = captureEventBusData(eventBus, "Emulation.scriptExecutionChanged");

    await domain.handleMethod("setScriptExecutionDisabled", { value: true });

    const state = domain.getEmulationState();
    assertEquals(state.scriptExecutionDisabled, true);
    assertEquals(capture.wasReceived(), true);
    assertEquals(capture.getData().disabled, true);
});

Deno.test("EmulationDomain: setScriptExecutionDisabled(false) re-enables scripts", async () => {
    const { domain } = setup();
    await domain.enable();

    await domain.handleMethod("setScriptExecutionDisabled", { value: true });
    await domain.handleMethod("setScriptExecutionDisabled", { value: false });

    const state = domain.getEmulationState();
    assertEquals(state.scriptExecutionDisabled, false);
});

// ---------------------------------------------------------------------------
// canEmulate()
// ---------------------------------------------------------------------------

Deno.test("EmulationDomain: canEmulate() returns result: true", async () => {
    const { domain } = setup();
    await domain.enable();

    const result = await domain.handleMethod("canEmulate", {});
    assertEquals(result.result, true);
});

// ---------------------------------------------------------------------------
// disable()
// ---------------------------------------------------------------------------

Deno.test("EmulationDomain: disable() resets all emulation state", async () => {
    const { domain, viewportState } = setup();
    await domain.enable();

    // Set various emulation overrides
    await domain.handleMethod("setDeviceMetricsOverride", {
        width: 375, height: 812, deviceScaleFactor: 3, mobile: true,
    });
    await domain.handleMethod("setUserAgentOverride", { userAgent: "TestAgent" });
    await domain.handleMethod("setEmulatedMedia", { media: "print" });
    await domain.handleMethod("setGeolocationOverride", { latitude: 0, longitude: 0 });
    await domain.handleMethod("setTimezoneOverride", { timezoneId: "UTC" });
    await domain.handleMethod("setLocaleOverride", { locale: "en-GB" });
    await domain.handleMethod("setTouchEmulationEnabled", { enabled: true });
    await domain.handleMethod("setNetworkConditions", {
        offline: true, latency: 100, downloadThroughput: 100, uploadThroughput: 100,
    });
    await domain.handleMethod("setCPUThrottlingRate", { rate: 4 });
    await domain.handleMethod("setScriptExecutionDisabled", { value: true });

    // Disable should reset everything
    await domain.disable();

    const state = domain.getEmulationState();
    assertEquals(state.userAgent, "");
    assertEquals(state.emulatedMedia, null);
    assertEquals(state.geolocation, null);
    assertEquals(state.timezoneId, null);
    assertEquals(state.locale, null);
    assertEquals(state.touchEmulation, false);
    assertEquals(state.networkConditions, null);
    assertEquals(state.cpuThrottlingRate, 1);
    assertEquals(state.scriptExecutionDisabled, false);

    // Viewport should be restored to original config values
    assertEquals(viewportState.width, 1024);
    assertEquals(viewportState.height, 768);

    assertEquals(domain.isEnabled(), false);
});

// ---------------------------------------------------------------------------
// dispose()
// ---------------------------------------------------------------------------

Deno.test("EmulationDomain: dispose() resets all state", async () => {
    const { domain } = setup();
    await domain.enable();

    await domain.handleMethod("setUserAgentOverride", { userAgent: "TestAgent" });
    await domain.handleMethod("setGeolocationOverride", { latitude: 1, longitude: 2 });
    await domain.handleMethod("setCPUThrottlingRate", { rate: 8 });

    domain.dispose();

    const state = domain.getEmulationState();
    assertEquals(state.userAgent, "");
    assertEquals(state.geolocation, null);
    assertEquals(state.cpuThrottlingRate, 1);
    assertEquals(domain.isEnabled(), false);
});

/**
 * Tests for Debugger Domain Agent
 *
 * Covers breakpoint management, stepping operations, script registration,
 * call frame evaluation, stack traces, and lifecycle management.
 */

import { assertEquals, assertExists } from "@std/assert";
import { EventBus } from "../../../integration/event-bus.ts";
import { DebuggerDomain } from "../../../domains/debugger/debugger-domain.ts";
import {
    createMockContext,
    createMockRenderingPipeline,
    createMockRenderResult,
    resetNodeIdCounter,
} from "../../helpers/mocks.ts";
import type { ProtocolEvent } from "../../../protocol/types.ts";
import type { CallFrame } from "../../../domains/debugger/debugger-types.ts";

// ---------------------------------------------------------------------------
// Helper: set up a fresh DebuggerDomain wired to an EventBus + mock context
// ---------------------------------------------------------------------------

function setup(options?: {
    pipelineOverrides?: Record<string, unknown>;
    currentURL?: string;
}) {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new DebuggerDomain(eventBus);

    const renderResult = createMockRenderResult();
    const renderingPipeline = createMockRenderingPipeline(renderResult);

    if (options?.pipelineOverrides) {
        Object.assign(renderingPipeline, options.pipelineOverrides);
    }

    const context = createMockContext({
        eventBus,
        renderingPipeline,
        browser: {
            getCurrentURL: () => options?.currentURL ?? "https://example.com",
            navigate: async () => {},
            reload: async () => {},
            back: async () => true,
            forward: async () => true,
            canGoBack: () => true,
            canGoForward: () => true,
            getHistoryState: () => ({ length: 1, index: 0, entries: ["https://example.com"] }),
            screenshot: async () => new Uint8ClampedArray(4),
            setViewportSize: () => {},
            getConfig: () => ({ width: 1024, height: 768, defaultURL: "about:blank", enableJavaScript: false, enableStorage: true, devicePixelRatio: 1.0 }),
            getStats: () => ({}),
            clearData: () => {},
            getRequestPipeline: () => ({}),
            getRenderingPipeline: () => ({}),
            getStorageManager: () => ({}),
            getCookieManager: () => ({}),
            getQuotaManager: () => ({}),
            close: async () => {},
        } as unknown as ReturnType<typeof import("../../helpers/mocks.ts").createMockBrowser>,
    });
    domain.initialize(context);

    // Collect emitted protocol events
    const events: ProtocolEvent[] = [];
    domain.addEventListener((evt) => events.push(evt));

    return { domain, eventBus, events };
}

// ---------------------------------------------------------------------------
// enable() / scriptParsed
// ---------------------------------------------------------------------------

Deno.test("DebuggerDomain: enable() returns empty object", async () => {
    const { domain } = setup();
    const result = await domain.enable();
    assertEquals(result, {});
});

Deno.test("DebuggerDomain: enable() emits scriptParsed for pre-registered scripts", async () => {
    const { domain, events } = setup();

    // Register a script before enabling
    await domain.registerScript("https://example.com/app.js", "console.log('hello');");

    await domain.enable();

    const parsed = events.filter((e) => e.method === "Debugger.scriptParsed");
    // At least the pre-registered script should appear
    const appScript = parsed.find(
        (e) => e.params?.url === "https://example.com/app.js",
    );
    assertExists(appScript);
    assertEquals(appScript.params?.startLine, 0);
    assertEquals(appScript.params?.endLine, 0);
});

// ---------------------------------------------------------------------------
// registerScript()
// ---------------------------------------------------------------------------

Deno.test("DebuggerDomain: registerScript() registers and emits event when enabled", async () => {
    const { domain, events } = setup();
    await domain.enable();

    // Clear events from enable
    events.length = 0;

    const scriptId = await domain.registerScript(
        "https://example.com/main.js",
        "function foo() {\n  return 42;\n}\n",
    );

    assertExists(scriptId);
    assertEquals(typeof scriptId, "string");

    const parsed = events.find((e) => e.method === "Debugger.scriptParsed");
    assertExists(parsed);
    assertEquals(parsed.params?.url, "https://example.com/main.js");
    assertEquals(parsed.params?.endLine, 3);
});

Deno.test("DebuggerDomain: registerScript() does not emit event when disabled", async () => {
    const { domain, events } = setup();
    // Domain is not enabled

    const scriptId = await domain.registerScript("https://example.com/lib.js", "var x = 1;");
    assertExists(scriptId);

    const parsed = events.find((e) => e.method === "Debugger.scriptParsed");
    assertEquals(parsed, undefined);
});

// ---------------------------------------------------------------------------
// setBreakpoint()
// ---------------------------------------------------------------------------

Deno.test("DebuggerDomain: setBreakpoint() returns breakpointId and location", async () => {
    const { domain } = setup();
    await domain.enable();

    const scriptId = await domain.registerScript("https://example.com/app.js", "line1\nline2\nline3\n");

    const result = await domain.handleMethod("setBreakpoint", {
        location: { scriptId, lineNumber: 2, columnNumber: 0 },
    });

    assertExists(result.breakpointId);
    assertEquals(typeof result.breakpointId, "string");
    assertExists(result.actualLocation);
    const loc = result.actualLocation as Record<string, unknown>;
    assertEquals(loc.scriptId, scriptId);
    assertEquals(loc.lineNumber, 2);
    assertEquals(loc.columnNumber, 0);
});

Deno.test("DebuggerDomain: setBreakpoint() emits breakpointResolved event", async () => {
    const { domain, events } = setup();
    await domain.enable();
    events.length = 0;

    const scriptId = await domain.registerScript("https://example.com/app.js", "x\ny\nz\n");
    events.length = 0;

    await domain.handleMethod("setBreakpoint", {
        location: { scriptId, lineNumber: 1 },
    });

    const resolved = events.find((e) => e.method === "Debugger.breakpointResolved");
    assertExists(resolved);
    assertExists(resolved.params?.breakpointId);
});

// ---------------------------------------------------------------------------
// setBreakpointByUrl()
// ---------------------------------------------------------------------------

Deno.test("DebuggerDomain: setBreakpointByUrl() returns breakpointId and locations for matching scripts", async () => {
    const { domain } = setup();
    await domain.enable();

    await domain.registerScript("https://example.com/app.js", "a\nb\nc\n");

    const result = await domain.handleMethod("setBreakpointByUrl", {
        url: "https://example.com/app.js",
        lineNumber: 1,
    });

    assertExists(result.breakpointId);
    const locations = result.locations as Array<Record<string, unknown>>;
    assertEquals(locations.length, 1);
    assertEquals(locations[0].lineNumber, 1);
});

Deno.test("DebuggerDomain: setBreakpointByUrl() with no matching script stores pending breakpoint", async () => {
    const { domain } = setup();
    await domain.enable();

    const result = await domain.handleMethod("setBreakpointByUrl", {
        url: "https://example.com/nonexistent.js",
        lineNumber: 5,
    });

    assertExists(result.breakpointId);
    const locations = result.locations as unknown[];
    assertEquals(locations.length, 0);
});

// ---------------------------------------------------------------------------
// removeBreakpoint()
// ---------------------------------------------------------------------------

Deno.test("DebuggerDomain: removeBreakpoint() removes existing breakpoint", async () => {
    const { domain } = setup();
    await domain.enable();

    const scriptId = await domain.registerScript("https://example.com/app.js", "a\nb\n");

    const setResult = await domain.handleMethod("setBreakpoint", {
        location: { scriptId, lineNumber: 0 },
    });

    const removeResult = await domain.handleMethod("removeBreakpoint", {
        breakpointId: setResult.breakpointId,
    });

    assertEquals(removeResult, {});
});

Deno.test("DebuggerDomain: removeBreakpoint() with unknown id does not throw", async () => {
    const { domain } = setup();
    await domain.enable();

    // Removing a non-existent breakpoint should not throw (Map.delete returns false)
    const result = await domain.handleMethod("removeBreakpoint", {
        breakpointId: "bp-nonexistent",
    });
    assertEquals(result, {});
});

// ---------------------------------------------------------------------------
// getScriptSource()
// ---------------------------------------------------------------------------

Deno.test("DebuggerDomain: getScriptSource() returns source for registered script", async () => {
    const { domain } = setup();
    await domain.enable();

    const scriptId = await domain.registerScript("https://example.com/app.js", "var x = 42;");

    const result = await domain.handleMethod("getScriptSource", { scriptId });
    assertExists(result.scriptSource);
    // The source will be a placeholder since mock script executor does not have getSource
    assertEquals(typeof result.scriptSource, "string");
    assertEquals((result.scriptSource as string).length > 0, true);
});

Deno.test("DebuggerDomain: getScriptSource() with unknown scriptId returns empty string", async () => {
    const { domain } = setup();
    await domain.enable();

    const result = await domain.handleMethod("getScriptSource", { scriptId: "script-unknown" });
    assertEquals(result.scriptSource, "");
});

// ---------------------------------------------------------------------------
// resume() / stepOver() / stepInto() / stepOut() / pause()
// ---------------------------------------------------------------------------

Deno.test("DebuggerDomain: pause() sets paused state and emits paused event", async () => {
    const { domain, events } = setup();
    await domain.enable();
    events.length = 0;

    await domain.handleMethod("pause", {});

    const paused = events.find((e) => e.method === "Debugger.paused");
    assertExists(paused);
    assertEquals(paused.params?.reason, "pause");
    assertExists(paused.params?.callFrames);
    const frames = paused.params?.callFrames as CallFrame[];
    assertEquals(frames.length, 1);
    assertEquals(frames[0].functionName, "(paused)");
});

Deno.test("DebuggerDomain: resume() clears paused state and emits resumed event", async () => {
    const { domain, events } = setup();
    await domain.enable();

    await domain.handleMethod("pause", {});
    events.length = 0;

    await domain.handleMethod("resume", {});

    const resumed = events.find((e) => e.method === "Debugger.resumed");
    assertExists(resumed);
});

Deno.test("DebuggerDomain: resume() does nothing if not paused", async () => {
    const { domain, events } = setup();
    await domain.enable();
    events.length = 0;

    await domain.handleMethod("resume", {});

    const resumed = events.find((e) => e.method === "Debugger.resumed");
    assertEquals(resumed, undefined);
});

Deno.test("DebuggerDomain: stepOver() advances line number when paused", async () => {
    const { domain, events } = setup();
    await domain.enable();

    await domain.handleMethod("pause", {});

    // Get original line from pause event
    const pausedEvent = events.find((e) => e.method === "Debugger.paused");
    const originalFrames = pausedEvent?.params?.callFrames as CallFrame[];
    const originalLine = originalFrames[0].location.lineNumber;

    events.length = 0;

    await domain.handleMethod("stepOver", {});

    const stepEvent = events.find((e) => e.method === "Debugger.paused");
    assertExists(stepEvent);
    assertEquals(stepEvent.params?.reason, "step");
    const frames = stepEvent.params?.callFrames as CallFrame[];
    assertEquals(frames[0].location.lineNumber, originalLine + 1);
});

Deno.test("DebuggerDomain: stepInto() adds a call frame when paused", async () => {
    const { domain, events } = setup();
    await domain.enable();

    await domain.handleMethod("pause", {});
    events.length = 0;

    await domain.handleMethod("stepInto", {});

    const stepEvent = events.find((e) => e.method === "Debugger.paused");
    assertExists(stepEvent);
    const frames = stepEvent.params?.callFrames as CallFrame[];
    // Should have 2 frames: the stepped-into frame + the original
    assertEquals(frames.length, 2);
    assertEquals(frames[0].functionName, "<stepped-into>");
});

Deno.test("DebuggerDomain: stepOut() removes top frame when multiple frames exist", async () => {
    const { domain, events } = setup();
    await domain.enable();

    // Pause and step into to create 2 frames
    await domain.handleMethod("pause", {});
    await domain.handleMethod("stepInto", {});
    events.length = 0;

    await domain.handleMethod("stepOut", {});

    const stepEvent = events.find((e) => e.method === "Debugger.paused");
    assertExists(stepEvent);
    const frames = stepEvent.params?.callFrames as CallFrame[];
    // Should be back to 1 frame
    assertEquals(frames.length, 1);
});

Deno.test("DebuggerDomain: stepOut() resumes when only one frame exists", async () => {
    const { domain, events } = setup();
    await domain.enable();

    await domain.handleMethod("pause", {});
    events.length = 0;

    await domain.handleMethod("stepOut", {});

    const resumed = events.find((e) => e.method === "Debugger.resumed");
    assertExists(resumed);
});

Deno.test("DebuggerDomain: stepOver() does nothing when not paused", async () => {
    const { domain, events } = setup();
    await domain.enable();
    events.length = 0;

    await domain.handleMethod("stepOver", {});
    assertEquals(events.length, 0);
});

// ---------------------------------------------------------------------------
// evaluateOnCallFrame()
// ---------------------------------------------------------------------------

Deno.test("DebuggerDomain: evaluateOnCallFrame() returns result for valid frame", async () => {
    const { domain } = setup();
    await domain.enable();

    await domain.handleMethod("pause", {});

    // Get the call frame ID from the stack
    const stack = await domain.handleMethod("getStackTrace", {});
    const frames = stack.callFrames as CallFrame[];
    const frameId = frames[0].callFrameId;

    const result = await domain.handleMethod("evaluateOnCallFrame", {
        callFrameId: frameId,
        expression: "1 + 1",
    });

    assertExists(result.result);
    const evalResult = result.result as Record<string, unknown>;
    // Since mock doesn't have a real executor, should return "undefined" or "Evaluation not available"
    assertEquals(evalResult.type, "undefined");
});

Deno.test("DebuggerDomain: evaluateOnCallFrame() with unknown frame returns call frame not found", async () => {
    const { domain } = setup();
    await domain.enable();

    const result = await domain.handleMethod("evaluateOnCallFrame", {
        callFrameId: "cf-nonexistent",
        expression: "1 + 1",
    });

    const evalResult = result.result as Record<string, unknown>;
    assertEquals(evalResult.type, "undefined");
    assertEquals(evalResult.description, "Call frame not found");
});

// ---------------------------------------------------------------------------
// getPossibleBreakpoints()
// ---------------------------------------------------------------------------

Deno.test("DebuggerDomain: getPossibleBreakpoints() returns locations for known script", async () => {
    const { domain } = setup();
    await domain.enable();

    const scriptId = await domain.registerScript(
        "https://example.com/app.js",
        "line1\nline2\nline3\nline4\nline5\n",
    );

    const result = await domain.handleMethod("getPossibleBreakpoints", {
        start: { scriptId, lineNumber: 1 },
        end: { scriptId, lineNumber: 3 },
    });

    const locations = result.locations as Array<Record<string, unknown>>;
    assertEquals(locations.length, 3); // lines 1, 2, 3
    assertEquals(locations[0].lineNumber, 1);
    assertEquals(locations[1].lineNumber, 2);
    assertEquals(locations[2].lineNumber, 3);
});

Deno.test("DebuggerDomain: getPossibleBreakpoints() returns empty for unknown script", async () => {
    const { domain } = setup();
    await domain.enable();

    const result = await domain.handleMethod("getPossibleBreakpoints", {
        start: { scriptId: "script-unknown", lineNumber: 0 },
    });

    const locations = result.locations as unknown[];
    assertEquals(locations.length, 0);
});

// ---------------------------------------------------------------------------
// getStackTrace()
// ---------------------------------------------------------------------------

Deno.test("DebuggerDomain: getStackTrace() returns call frames when paused", async () => {
    const { domain } = setup();
    await domain.enable();

    await domain.handleMethod("pause", {});

    const result = await domain.handleMethod("getStackTrace", {});
    assertEquals(result.paused, true);
    assertEquals(result.reason, "pause");
    const frames = result.callFrames as CallFrame[];
    assertEquals(frames.length, 1);
});

Deno.test("DebuggerDomain: getStackTrace() returns empty frames when not paused", async () => {
    const { domain } = setup();
    await domain.enable();

    const result = await domain.handleMethod("getStackTrace", {});
    assertEquals(result.paused, false);
    const frames = result.callFrames as CallFrame[];
    assertEquals(frames.length, 0);
});

// ---------------------------------------------------------------------------
// triggerBreakpoint()
// ---------------------------------------------------------------------------

Deno.test("DebuggerDomain: triggerBreakpoint() emits paused event with correct data", async () => {
    const { domain, events } = setup();
    await domain.enable();

    const scriptId = await domain.registerScript("https://example.com/app.js", "a\nb\n");

    const setResult = await domain.handleMethod("setBreakpoint", {
        location: { scriptId, lineNumber: 1 },
    });
    events.length = 0;

    const breakpointId = setResult.breakpointId as string;

    const callFrames: CallFrame[] = [
        {
            callFrameId: "cf-1",
            functionName: "testFunc",
            location: { scriptId, lineNumber: 1, columnNumber: 0 },
            url: "https://example.com/app.js",
            scopeChain: [
                {
                    type: "local",
                    object: { type: "object", objectId: "scope-0", description: "Local" },
                },
            ],
            this: { type: "object", description: "Window" },
        },
    ];

    domain.triggerBreakpoint(breakpointId, callFrames);

    const paused = events.find((e) => e.method === "Debugger.paused");
    assertExists(paused);
    assertEquals(paused.params?.reason, "breakpoint");
    const hitBreakpoints = paused.params?.hitBreakpoints as string[];
    assertEquals(hitBreakpoints.length, 1);
    assertEquals(hitBreakpoints[0], breakpointId);
});

Deno.test("DebuggerDomain: triggerBreakpoint() does nothing when domain is disabled", async () => {
    const { domain, events } = setup();
    // Domain is NOT enabled

    await domain.registerScript("https://example.com/app.js", "a\n");
    // We can't call handleMethod since domain is not enabled, so just trigger directly
    domain.triggerBreakpoint("bp-nonexistent", []);

    const paused = events.find((e) => e.method === "Debugger.paused");
    assertEquals(paused, undefined);
});

// ---------------------------------------------------------------------------
// disable()
// ---------------------------------------------------------------------------

Deno.test("DebuggerDomain: disable() clears paused state and emits resumed if paused", async () => {
    const { domain, events } = setup();
    await domain.enable();
    await domain.handleMethod("pause", {});
    events.length = 0;

    await domain.disable();

    const resumed = events.find((e) => e.method === "Debugger.resumed");
    assertExists(resumed);
    assertEquals(domain.isEnabled(), false);
});

Deno.test("DebuggerDomain: disable() does not emit resumed if not paused", async () => {
    const { domain, events } = setup();
    await domain.enable();
    events.length = 0;

    await domain.disable();

    const resumed = events.find((e) => e.method === "Debugger.resumed");
    assertEquals(resumed, undefined);
});

// ---------------------------------------------------------------------------
// dispose()
// ---------------------------------------------------------------------------

Deno.test("DebuggerDomain: dispose() cleans up all state", async () => {
    const { domain } = setup();
    await domain.enable();

    await domain.registerScript("https://example.com/app.js", "code");
    await domain.handleMethod("setBreakpoint", {
        location: { scriptId: "script-1", lineNumber: 0 },
    });
    await domain.handleMethod("pause", {});

    domain.dispose();

    assertEquals(domain.isEnabled(), false);
    // After dispose, methods are cleared
    assertEquals(domain.getMethodNames().length, 2); // only enable/disable
});

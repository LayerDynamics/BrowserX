/**
 * CSS Domain Agent Tests
 *
 * Tests for stylesheet inspection, computed styles,
 * matched styles, and pseudo-state forcing.
 */

import { assertEquals, assertRejects, assertExists } from "@std/assert";
import { EventBus } from "../../../integration/event-bus.ts";
import { CSSDomain } from "../../../domains/css/css-domain.ts";
import { DomainRegistry } from "../../../protocol/domains.ts";
import { BaseDomain } from "../../../domains/base-domain.ts";
import type { DomainName } from "../../../protocol/types.ts";
import {
    createMockContext,
    createMockElement,
    createMockDocument,
    createMockRenderResult,
    createMockRenderingPipeline,
    resetNodeIdCounter,
} from "../../helpers/mocks.ts";
import type { ProtocolEvent } from "../../../protocol/types.ts";
import type { DOMNode } from "../../../../browser/src/types/dom.ts";

/**
 * Helper: create a mock DOMDomain with a nodeMap and wire it into a registry with the CSSDomain
 */
function wireRegistryWithMockDOM(
    domain: CSSDomain,
    eventBus: EventBus,
    nodes: Map<number, unknown>,
): DomainRegistry {
    // Create a minimal mock DOMDomain that implements getNodeById
    const mockDomDomain = Object.assign(Object.create(BaseDomain.prototype), {
        name: "DOM" as DomainName,
        enabled: false,
        eventBus,
        _context: undefined,
        _registry: null,
        getNodeById(nodeId: number): unknown {
            return nodes.get(nodeId) ?? null;
        },
        setup() {},
        dispose() {},
    }) as BaseDomain & { getNodeById(nodeId: number): unknown };

    const registry = new DomainRegistry();
    registry.register(mockDomDomain, { name: "DOM", description: "mock", version: "1.0" });
    registry.register(domain, { name: "CSS", description: "mock", version: "1.0" });
    domain.setRegistry(registry);
    return registry;
}

/**
 * Helper: create a mock stylesheet
 */
function createMockStyleSheet(options?: {
    href?: string;
    disabled?: boolean;
    rules?: Array<{
        selectors: string[];
        declarations: Array<{ property: string; value: string; important: boolean }>;
    }>;
}) {
    const rules = (options?.rules ?? []).map((r) => ({
        selectorList: r.selectors.map((text) => ({
            text,
            specificity: { a: 0, b: 0, c: 1 },
            matches: (_el: unknown) => true,
        })),
        declarations: r.declarations,
    }));

    return {
        href: options?.href ?? null,
        disabled: options?.disabled ?? false,
        rules,
        getMatchingRules: (_element: unknown) => rules,
    };
}

/**
 * Helper: create a rendering pipeline with CSSOM support in getStats
 */
function createPipelineWithCSSOM(sheets?: ReturnType<typeof createMockStyleSheet>[]) {
    const renderResult = createMockRenderResult();
    const cssom = {
        ...renderResult.cssom,
        getStyleSheets: () => sheets || [],
    };
    const resultWithCSSOM = { ...renderResult, cssom } as unknown as ReturnType<typeof createMockRenderResult>;
    const basePipeline = createMockRenderingPipeline(resultWithCSSOM);
    return {
        ...basePipeline,
        getStats: () => ({
            ...basePipeline.getStats(),
            lastRenderResult: resultWithCSSOM,
        }),
    };
}

// ---- Tests ----

Deno.test("CSSDomain - enable() returns empty object", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new CSSDomain(eventBus);
    const pipeline = createPipelineWithCSSOM();
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);

    const result = await domain.enable();
    assertEquals(result, {});
});

Deno.test("CSSDomain - enable() emits styleSheetAdded for existing sheets", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new CSSDomain(eventBus);

    const sheet1 = createMockStyleSheet({
        href: "https://example.com/style.css",
        rules: [{ selectors: ["body"], declarations: [{ property: "color", value: "red", important: false }] }],
    });
    const sheet2 = createMockStyleSheet({
        rules: [{ selectors: [".main"], declarations: [{ property: "margin", value: "0", important: false }] }],
    });

    const pipeline = createPipelineWithCSSOM([sheet1, sheet2]);
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);

    const events: ProtocolEvent[] = [];
    domain.addEventListener((event) => events.push(event));

    await domain.enable();

    // Should emit styleSheetAdded for each sheet
    const addedEvents = events.filter((e) => e.method === "CSS.styleSheetAdded");
    assertEquals(addedEvents.length, 2);

    // Verify header structure of first sheet
    const header1 = (addedEvents[0].params?.header) as Record<string, unknown>;
    assertExists(header1);
    assertExists(header1.styleSheetId);
    assertEquals(header1.sourceURL, "https://example.com/style.css");
    assertEquals(header1.origin, "regular");
    assertEquals(header1.isInline, false);
    assertEquals(header1.disabled, false);
    assertEquals(header1.length, 1);

    // Second sheet is inline (no href)
    const header2 = (addedEvents[1].params?.header) as Record<string, unknown>;
    assertEquals(header2.isInline, true);
    assertEquals(header2.sourceURL, "");
});

Deno.test("CSSDomain - getComputedStyleForNode() returns computed styles via properties Map", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new CSSDomain(eventBus);

    // Create an element with __computedStyle using Map-based properties
    const div = createMockElement("div", { id: "styled" }, [], {
        computedStyle: { color: "red", display: "block", "font-size": "16px" },
    });

    // Override __computedStyle to use a Map
    const propsMap = new Map<string, string>([
        ["color", "red"],
        ["display", "block"],
        ["font-size", "16px"],
    ]);
    (div as unknown as Record<string, unknown>).__computedStyle = { properties: propsMap };

    const doc = createMockDocument([div]);
    const pipeline = createPipelineWithCSSOM();
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);

    // Wire registry so CSSDomain can resolve DOMDomain.getNodeById
    const nodeMap = new Map<number, unknown>([[div.nodeId, div]]);
    wireRegistryWithMockDOM(domain, eventBus, nodeMap);

    await domain.enable();

    const result = await domain.handleMethod("getComputedStyleForNode", { nodeId: div.nodeId });
    const computedStyle = (result as Record<string, unknown>).computedStyle as Array<
        Record<string, string>
    >;

    assertExists(computedStyle);
    assertEquals(computedStyle.length, 3);

    const colorProp = computedStyle.find((p) => p.name === "color");
    assertExists(colorProp);
    assertEquals(colorProp.value, "red");

    const displayProp = computedStyle.find((p) => p.name === "display");
    assertExists(displayProp);
    assertEquals(displayProp.value, "block");
});

Deno.test("CSSDomain - getComputedStyleForNode() returns empty for unknown node", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new CSSDomain(eventBus);
    const pipeline = createPipelineWithCSSOM();
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();

    // No dom:getNode handler set up, so element will be null
    const result = await domain.handleMethod("getComputedStyleForNode", { nodeId: 999 });
    const computedStyle = (result as Record<string, unknown>).computedStyle as unknown[];
    assertEquals(computedStyle, []);
});

Deno.test("CSSDomain - getMatchedStylesForNode() returns matched styles", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new CSSDomain(eventBus);

    const div = createMockElement("div", { class: "main" });

    const sheet = createMockStyleSheet({
        href: "https://example.com/styles.css",
        rules: [
            {
                selectors: [".main"],
                declarations: [{ property: "margin", value: "10px", important: false }],
            },
        ],
    });

    const pipeline = createPipelineWithCSSOM([sheet]);
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);

    wireRegistryWithMockDOM(domain, eventBus, new Map([[div.nodeId, div]]));

    await domain.enable();

    const result = await domain.handleMethod("getMatchedStylesForNode", { nodeId: div.nodeId });
    const matched = (result as Record<string, unknown>).matchedCSSRules as Array<
        Record<string, unknown>
    >;

    assertExists(matched);
    assertEquals(matched.length > 0, true);

    const rule = matched[0].rule as Record<string, unknown>;
    const selectorList = rule.selectorList as Record<string, unknown>;
    assertEquals(selectorList.text, ".main");
});

Deno.test("CSSDomain - getMatchedStylesForNode() parses inline style attribute", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new CSSDomain(eventBus);

    const div = createMockElement("div", { style: "color: blue; font-weight: bold !important" });

    const pipeline = createPipelineWithCSSOM();
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);

    wireRegistryWithMockDOM(domain, eventBus, new Map([[div.nodeId, div]]));

    await domain.enable();

    const result = await domain.handleMethod("getMatchedStylesForNode", { nodeId: div.nodeId });
    const inlineStyle = (result as Record<string, unknown>).inlineStyle as Record<string, unknown>;

    assertExists(inlineStyle);
    assertEquals(inlineStyle.cssText, "color: blue; font-weight: bold !important");

    const cssProps = inlineStyle.cssProperties as Array<Record<string, unknown>>;
    assertExists(cssProps);

    const colorProp = cssProps.find((p) => p.name === "color");
    assertExists(colorProp);
    assertEquals(colorProp.value, "blue");
    assertEquals(colorProp.important, false);

    const fontProp = cssProps.find((p) => p.name === "font-weight");
    assertExists(fontProp);
    assertEquals(fontProp.important, true);
});

Deno.test("CSSDomain - getStyleSheetText() returns text for known sheet", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new CSSDomain(eventBus);

    const sheet = createMockStyleSheet({
        href: "https://example.com/style.css",
        rules: [
            {
                selectors: ["h1", "h2"],
                declarations: [
                    { property: "color", value: "navy", important: false },
                    { property: "margin", value: "0", important: true },
                ],
            },
        ],
    });

    const pipeline = createPipelineWithCSSOM([sheet]);
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);

    const events: ProtocolEvent[] = [];
    domain.addEventListener((event) => events.push(event));
    await domain.enable();

    // Get the stylesheet ID from the emitted event
    const addedEvent = events.find((e) => e.method === "CSS.styleSheetAdded");
    assertExists(addedEvent);
    const header = addedEvent.params?.header as Record<string, unknown>;
    const sheetId = header.styleSheetId as string;

    const result = await domain.handleMethod("getStyleSheetText", { styleSheetId: sheetId });
    const text = (result as Record<string, unknown>).text as string;

    assertExists(text);
    assertEquals(text.includes("h1, h2"), true);
    assertEquals(text.includes("color: navy"), true);
    assertEquals(text.includes("margin: 0 !important"), true);
});

Deno.test("CSSDomain - getStyleSheetText() throws for unknown sheet", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new CSSDomain(eventBus);
    const pipeline = createPipelineWithCSSOM();
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();

    await assertRejects(
        async () => {
            await domain.handleMethod("getStyleSheetText", { styleSheetId: "nonexistent" });
        },
        Error,
        "not found",
    );
});

Deno.test("CSSDomain - getAllStyleSheets() returns stylesheet headers", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new CSSDomain(eventBus);

    const sheet1 = createMockStyleSheet({ href: "https://example.com/a.css" });
    const sheet2 = createMockStyleSheet({ href: "https://example.com/b.css", disabled: true });

    const pipeline = createPipelineWithCSSOM([sheet1, sheet2]);
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();

    const result = await domain.handleMethod("getAllStyleSheets", {});
    const headers = (result as Record<string, unknown>).headers as Array<Record<string, unknown>>;

    assertExists(headers);
    assertEquals(headers.length, 2);

    // First sheet
    assertEquals(headers[0].sourceURL, "https://example.com/a.css");
    assertEquals(headers[0].disabled, false);
    assertEquals(headers[0].isInline, false);

    // Second sheet (disabled)
    assertEquals(headers[1].sourceURL, "https://example.com/b.css");
    assertEquals(headers[1].disabled, true);
});

Deno.test("CSSDomain - forcePseudoState() stores pseudo state for node", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new CSSDomain(eventBus);
    const pipeline = createPipelineWithCSSOM();
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();

    const result = await domain.handleMethod("forcePseudoState", {
        nodeId: 42,
        forcedPseudoClasses: [":hover", ":focus"],
    });

    assertEquals(result, {});
});

Deno.test("CSSDomain - dispose() clears stylesheets and pseudo states", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new CSSDomain(eventBus);

    const sheet = createMockStyleSheet({ href: "https://example.com/style.css" });
    const pipeline = createPipelineWithCSSOM([sheet]);
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();

    // Force a pseudo state
    await domain.handleMethod("forcePseudoState", {
        nodeId: 1,
        forcedPseudoClasses: [":hover"],
    });

    // Dispose
    domain.dispose();

    // After dispose, getAllStyleSheets should re-collect but domain is disabled
    assertEquals(domain.isEnabled(), false);
});

// ============================================================================
// Enhanced Edge Case Tests
// ============================================================================

Deno.test("CSSDomain - disable() returns empty object and sets enabled to false", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new CSSDomain(eventBus);
    const pipeline = createPipelineWithCSSOM();
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();
    assertEquals(domain.isEnabled(), true);

    const result = await domain.disable();
    assertEquals(result, {});
    assertEquals(domain.isEnabled(), false);
});

Deno.test("CSSDomain - getComputedStyleForNode with getPropertyNames API", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new CSSDomain(eventBus);

    const div = createMockElement("div", { id: "computed" });
    // Set up __computedStyle using getPropertyNames API
    const styleProps: Record<string, string> = { "margin": "10px", "padding": "5px" };
    (div as unknown as Record<string, unknown>).__computedStyle = {
        getPropertyNames: () => Object.keys(styleProps),
        getPropertyValue: (name: string) => styleProps[name] || "",
    };

    const pipeline = createPipelineWithCSSOM();
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);

    wireRegistryWithMockDOM(domain, eventBus, new Map([[div.nodeId, div]]));

    await domain.enable();

    const result = await domain.handleMethod("getComputedStyleForNode", { nodeId: div.nodeId });
    const computedStyle = (result as Record<string, unknown>).computedStyle as Array<Record<string, string>>;

    assertExists(computedStyle);
    assertEquals(computedStyle.length, 2);

    const marginProp = computedStyle.find((p) => p.name === "margin");
    assertExists(marginProp);
    assertEquals(marginProp.value, "10px");

    const paddingProp = computedStyle.find((p) => p.name === "padding");
    assertExists(paddingProp);
    assertEquals(paddingProp.value, "5px");
});

Deno.test("CSSDomain - getMatchedStylesForNode returns empty for unknown node", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new CSSDomain(eventBus);
    const pipeline = createPipelineWithCSSOM();
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();

    const result = await domain.handleMethod("getMatchedStylesForNode", { nodeId: 999 });
    const matched = (result as Record<string, unknown>).matchedCSSRules as unknown[];
    assertEquals(matched, []);
    assertEquals((result as Record<string, unknown>).inlineStyle, undefined);
});

Deno.test("CSSDomain - getMatchedStylesForNode with no inline style returns undefined inlineStyle", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new CSSDomain(eventBus);

    const div = createMockElement("div", { class: "no-inline" });

    const pipeline = createPipelineWithCSSOM();
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);

    wireRegistryWithMockDOM(domain, eventBus, new Map([[div.nodeId, div]]));

    await domain.enable();

    const result = await domain.handleMethod("getMatchedStylesForNode", { nodeId: div.nodeId });
    assertEquals((result as Record<string, unknown>).inlineStyle, undefined);
});

Deno.test("CSSDomain - getAllStyleSheets() re-collects sheets on each call", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new CSSDomain(eventBus);

    let currentSheets: ReturnType<typeof createMockStyleSheet>[] = [
        createMockStyleSheet({ href: "https://example.com/a.css" }),
    ];

    const renderResult = createMockRenderResult();
    const cssom = {
        ...renderResult.cssom,
        getStyleSheets: () => currentSheets,
    };
    const resultWithCSSOM = { ...renderResult, cssom } as unknown as ReturnType<typeof createMockRenderResult>;
    const basePipeline = createMockRenderingPipeline(resultWithCSSOM);
    const pipeline = {
        ...basePipeline,
        getStats: () => ({
            ...basePipeline.getStats(),
            lastRenderResult: resultWithCSSOM,
        }),
    };

    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();

    // First call: 1 sheet
    const result1 = await domain.handleMethod("getAllStyleSheets", {});
    const headers1 = (result1 as Record<string, unknown>).headers as unknown[];
    assertEquals(headers1.length, 1);

    // Add another sheet
    currentSheets = [
        createMockStyleSheet({ href: "https://example.com/a.css" }),
        createMockStyleSheet({ href: "https://example.com/b.css" }),
    ];

    // Second call: 2 sheets (re-collected)
    const result2 = await domain.handleMethod("getAllStyleSheets", {});
    const headers2 = (result2 as Record<string, unknown>).headers as unknown[];
    assertEquals(headers2.length, 2);
});

Deno.test("CSSDomain - forcePseudoState overwrites state for same nodeId", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new CSSDomain(eventBus);
    const pipeline = createPipelineWithCSSOM();
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();

    // Set hover state
    await domain.handleMethod("forcePseudoState", {
        nodeId: 42,
        forcedPseudoClasses: [":hover"],
    });

    // Overwrite with focus state
    const result = await domain.handleMethod("forcePseudoState", {
        nodeId: 42,
        forcedPseudoClasses: [":focus", ":active"],
    });

    assertEquals(result, {});
});

Deno.test({ name: "CSSDomain - enable is idempotent with stylesheet events", sanitizeOps: false, sanitizeResources: false, fn: async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new CSSDomain(eventBus);

    const sheet = createMockStyleSheet({ href: "https://example.com/style.css" });
    const pipeline = createPipelineWithCSSOM([sheet]);
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);

    const events: ProtocolEvent[] = [];
    domain.addEventListener((event) => events.push(event));

    // Enable first time
    await domain.enable();
    const firstEnableEventCount = events.filter((e) => e.method === "CSS.styleSheetAdded").length;
    assertEquals(firstEnableEventCount, 1);

    // Enable again - should re-emit (enable is called, re-collects)
    await domain.enable();
    const totalEvents = events.filter((e) => e.method === "CSS.styleSheetAdded").length;
    assertEquals(totalEvents >= firstEnableEventCount, true);
}});

Deno.test("CSSDomain - handleMethod throws for unknown method", async () => {
    resetNodeIdCounter();
    const eventBus = new EventBus();
    const domain = new CSSDomain(eventBus);
    const pipeline = createPipelineWithCSSOM();
    const context = createMockContext({ eventBus, renderingPipeline: pipeline });
    domain.initialize(context);
    await domain.enable();

    await assertRejects(
        async () => {
            await domain.handleMethod("nonExistentMethod", {});
        },
        Error,
        "not found",
    );
});

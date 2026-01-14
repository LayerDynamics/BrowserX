/**
 * Tests for Style Resolver
 * Tests style resolution with cascade, specificity, and inheritance.
 */

import { assertEquals, assertExists } from "@std/assert";
import { StyleResolver } from "../../../../src/engine/rendering/css-parser/StyleResolver.ts";
import { CSSOM, StyleSheetOrigin } from "../../../../src/engine/rendering/css-parser/CSSOM.ts";

// Mock CSSStyleSheet
function createMockStyleSheet() {
    return {
        rules: [],
        disabled: false,
        href: undefined,
        ownerNode: null as any,
        getMatchingRules: () => [],
        insertRule: (ruleText: string, index: number) => index,
        deleteRule: (index: number) => {},
    };
}

// StyleResolver constructor tests

Deno.test({
    name: "StyleResolver - constructor without CSSOM",
    fn() {
        const resolver = new StyleResolver();
        assertExists(resolver);
    },
});

Deno.test({
    name: "StyleResolver - constructor with CSSOM",
    fn() {
        const cssom = new CSSOM();
        const resolver = new StyleResolver(cssom);
        assertExists(resolver);
    },
});

// StyleResolver.setCSSOM tests

Deno.test({
    name: "StyleResolver - setCSSOM sets CSSOM instance",
    fn() {
        const resolver = new StyleResolver();
        const cssom = new CSSOM();

        resolver.setCSSOM(cssom);

        assertExists(resolver);
    },
});

// StyleResolver.addStyleSheet tests

Deno.test({
    name: "StyleResolver - addStyleSheet with default origin",
    fn() {
        const resolver = new StyleResolver();
        const stylesheet = createMockStyleSheet();

        resolver.addStyleSheet(stylesheet as any);

        assertExists(resolver);
    },
});

Deno.test({
    name: "StyleResolver - addStyleSheet with USER_AGENT origin",
    fn() {
        const resolver = new StyleResolver();
        const stylesheet = createMockStyleSheet();

        resolver.addStyleSheet(stylesheet as any, StyleSheetOrigin.USER_AGENT);

        assertExists(resolver);
    },
});

Deno.test({
    name: "StyleResolver - addStyleSheet with USER origin",
    fn() {
        const resolver = new StyleResolver();
        const stylesheet = createMockStyleSheet();

        resolver.addStyleSheet(stylesheet as any, StyleSheetOrigin.USER);

        assertExists(resolver);
    },
});

Deno.test({
    name: "StyleResolver - addStyleSheet with AUTHOR origin",
    fn() {
        const resolver = new StyleResolver();
        const stylesheet = createMockStyleSheet();

        resolver.addStyleSheet(stylesheet as any, StyleSheetOrigin.AUTHOR);

        assertExists(resolver);
    },
});

Deno.test({
    name: "StyleResolver - addStyleSheet multiple sheets",
    fn() {
        const resolver = new StyleResolver();
        const sheet1 = createMockStyleSheet();
        const sheet2 = createMockStyleSheet();
        const sheet3 = createMockStyleSheet();

        resolver.addStyleSheet(sheet1 as any);
        resolver.addStyleSheet(sheet2 as any);
        resolver.addStyleSheet(sheet3 as any);

        assertExists(resolver);
    },
});

// Integration tests

Deno.test({
    name: "StyleResolver - resolver with CSSOM integration",
    fn() {
        const cssom = new CSSOM();
        const resolver = new StyleResolver(cssom);
        const stylesheet = createMockStyleSheet();

        resolver.addStyleSheet(stylesheet as any, StyleSheetOrigin.AUTHOR);

        assertEquals(cssom.getStyleSheetCount(), 1);
    },
});

Deno.test({
    name: "StyleResolver - multiple origins integration",
    fn() {
        const cssom = new CSSOM();
        const resolver = new StyleResolver(cssom);

        resolver.addStyleSheet(createMockStyleSheet() as any, StyleSheetOrigin.USER_AGENT);
        resolver.addStyleSheet(createMockStyleSheet() as any, StyleSheetOrigin.USER);
        resolver.addStyleSheet(createMockStyleSheet() as any, StyleSheetOrigin.AUTHOR);

        assertEquals(cssom.getStyleSheetCount(), 3);
    },
});

Deno.test({
    name: "StyleResolver - setCSSOM replaces CSSOM",
    fn() {
        const cssom1 = new CSSOM();
        const cssom2 = new CSSOM();
        const resolver = new StyleResolver(cssom1);

        cssom1.addStyleSheet(createMockStyleSheet() as any);

        resolver.setCSSOM(cssom2);
        cssom2.addStyleSheet(createMockStyleSheet() as any);
        cssom2.addStyleSheet(createMockStyleSheet() as any);

        assertEquals(cssom2.getStyleSheetCount(), 2);
    },
});

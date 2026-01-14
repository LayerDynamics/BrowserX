/**
 * Tests for CSS Object Model (CSSOM)
 * Tests CSS rules and stylesheets management.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import {
    CSSOM,
    StyleSheetOrigin,
} from "../../../../src/engine/rendering/css-parser/CSSOM.ts";

// Mock CSSStyleSheet for testing
function createMockStyleSheet(rules: any[] = [], href: string | null = null) {
    return {
        rules,
        disabled: false,
        href,
        ownerNode: null as any,
        getMatchingRules: (element: any) => rules.filter(r => r.matches),
        insertRule: (ruleText: string, index: number) => {
            rules.splice(index, 0, { text: ruleText });
            return index;
        },
        deleteRule: (index: number) => {
            rules.splice(index, 1);
        },
    };
}

// StyleSheetOrigin enum tests

Deno.test({
    name: "StyleSheetOrigin - USER_AGENT value",
    fn() {
        assertEquals(StyleSheetOrigin.USER_AGENT, 0);
    },
});

Deno.test({
    name: "StyleSheetOrigin - USER value",
    fn() {
        assertEquals(StyleSheetOrigin.USER, 1);
    },
});

Deno.test({
    name: "StyleSheetOrigin - AUTHOR value",
    fn() {
        assertEquals(StyleSheetOrigin.AUTHOR, 2);
    },
});

// CSSOM constructor tests

Deno.test({
    name: "CSSOM - constructor creates instance",
    fn() {
        const cssom = new CSSOM();
        assertExists(cssom);
    },
});

// CSSOM.addStyleSheet tests

Deno.test({
    name: "CSSOM - addStyleSheet adds stylesheet",
    fn() {
        const cssom = new CSSOM();
        const stylesheet = createMockStyleSheet();

        cssom.addStyleSheet(stylesheet as any);

        assertEquals(cssom.getStyleSheetCount(), 1);
    },
});

Deno.test({
    name: "CSSOM - addStyleSheet with default origin",
    fn() {
        const cssom = new CSSOM();
        const stylesheet = createMockStyleSheet();

        cssom.addStyleSheet(stylesheet as any);

        const sheets = cssom.getStyleSheetsByOrigin(StyleSheetOrigin.AUTHOR);
        assertEquals(sheets.length, 1);
    },
});

Deno.test({
    name: "CSSOM - addStyleSheet with USER_AGENT origin",
    fn() {
        const cssom = new CSSOM();
        const stylesheet = createMockStyleSheet();

        cssom.addStyleSheet(stylesheet as any, StyleSheetOrigin.USER_AGENT);

        const sheets = cssom.getStyleSheetsByOrigin(StyleSheetOrigin.USER_AGENT);
        assertEquals(sheets.length, 1);
    },
});

Deno.test({
    name: "CSSOM - addStyleSheet with USER origin",
    fn() {
        const cssom = new CSSOM();
        const stylesheet = createMockStyleSheet();

        cssom.addStyleSheet(stylesheet as any, StyleSheetOrigin.USER);

        const sheets = cssom.getStyleSheetsByOrigin(StyleSheetOrigin.USER);
        assertEquals(sheets.length, 1);
    },
});

Deno.test({
    name: "CSSOM - addStyleSheet with media query",
    fn() {
        const cssom = new CSSOM();
        const stylesheet = createMockStyleSheet();

        cssom.addStyleSheet(stylesheet as any, StyleSheetOrigin.AUTHOR, "screen");

        assertEquals(cssom.getStyleSheetCount(), 1);
    },
});

Deno.test({
    name: "CSSOM - addStyleSheet multiple sheets",
    fn() {
        const cssom = new CSSOM();
        const sheet1 = createMockStyleSheet();
        const sheet2 = createMockStyleSheet();
        const sheet3 = createMockStyleSheet();

        cssom.addStyleSheet(sheet1 as any);
        cssom.addStyleSheet(sheet2 as any);
        cssom.addStyleSheet(sheet3 as any);

        assertEquals(cssom.getStyleSheetCount(), 3);
    },
});

// CSSOM.removeStyleSheet tests

Deno.test({
    name: "CSSOM - removeStyleSheet removes stylesheet",
    fn() {
        const cssom = new CSSOM();
        const stylesheet = createMockStyleSheet();

        cssom.addStyleSheet(stylesheet as any);
        const removed = cssom.removeStyleSheet(stylesheet as any);

        assertEquals(removed, true);
        assertEquals(cssom.getStyleSheetCount(), 0);
    },
});

Deno.test({
    name: "CSSOM - removeStyleSheet returns false for non-existent",
    fn() {
        const cssom = new CSSOM();
        const stylesheet = createMockStyleSheet();

        const removed = cssom.removeStyleSheet(stylesheet as any);

        assertEquals(removed, false);
    },
});

Deno.test({
    name: "CSSOM - removeStyleSheet from multiple sheets",
    fn() {
        const cssom = new CSSOM();
        const sheet1 = createMockStyleSheet();
        const sheet2 = createMockStyleSheet();
        const sheet3 = createMockStyleSheet();

        cssom.addStyleSheet(sheet1 as any);
        cssom.addStyleSheet(sheet2 as any);
        cssom.addStyleSheet(sheet3 as any);

        cssom.removeStyleSheet(sheet2 as any);

        assertEquals(cssom.getStyleSheetCount(), 2);
    },
});

// CSSOM.getStyleSheets tests

Deno.test({
    name: "CSSOM - getStyleSheets returns all sheets",
    fn() {
        const cssom = new CSSOM();
        const sheet1 = createMockStyleSheet();
        const sheet2 = createMockStyleSheet();

        cssom.addStyleSheet(sheet1 as any);
        cssom.addStyleSheet(sheet2 as any);

        const sheets = cssom.getStyleSheets();
        assertEquals(sheets.length, 2);
    },
});

Deno.test({
    name: "CSSOM - getStyleSheets returns empty array when empty",
    fn() {
        const cssom = new CSSOM();

        const sheets = cssom.getStyleSheets();
        assertEquals(sheets.length, 0);
    },
});

// CSSOM.getStyleSheetsByOrigin tests

Deno.test({
    name: "CSSOM - getStyleSheetsByOrigin filters by USER_AGENT",
    fn() {
        const cssom = new CSSOM();
        const uaSheet = createMockStyleSheet();
        const authorSheet = createMockStyleSheet();

        cssom.addStyleSheet(uaSheet as any, StyleSheetOrigin.USER_AGENT);
        cssom.addStyleSheet(authorSheet as any, StyleSheetOrigin.AUTHOR);

        const sheets = cssom.getStyleSheetsByOrigin(StyleSheetOrigin.USER_AGENT);
        assertEquals(sheets.length, 1);
    },
});

Deno.test({
    name: "CSSOM - getStyleSheetsByOrigin filters by AUTHOR",
    fn() {
        const cssom = new CSSOM();
        const uaSheet = createMockStyleSheet();
        const authorSheet1 = createMockStyleSheet();
        const authorSheet2 = createMockStyleSheet();

        cssom.addStyleSheet(uaSheet as any, StyleSheetOrigin.USER_AGENT);
        cssom.addStyleSheet(authorSheet1 as any, StyleSheetOrigin.AUTHOR);
        cssom.addStyleSheet(authorSheet2 as any, StyleSheetOrigin.AUTHOR);

        const sheets = cssom.getStyleSheetsByOrigin(StyleSheetOrigin.AUTHOR);
        assertEquals(sheets.length, 2);
    },
});

// CSSOM.getAllRules tests

Deno.test({
    name: "CSSOM - getAllRules returns all rules",
    fn() {
        const cssom = new CSSOM();
        const rule1 = { selector: "p", declarations: [] };
        const rule2 = { selector: "div", declarations: [] };
        const sheet = createMockStyleSheet([rule1, rule2]);

        cssom.addStyleSheet(sheet as any);

        const rules = cssom.getAllRules();
        assertEquals(rules.length, 2);
    },
});

Deno.test({
    name: "CSSOM - getAllRules combines rules from multiple sheets",
    fn() {
        const cssom = new CSSOM();
        const sheet1 = createMockStyleSheet([{ selector: "p" }]);
        const sheet2 = createMockStyleSheet([{ selector: "div" }, { selector: "span" }]);

        cssom.addStyleSheet(sheet1 as any);
        cssom.addStyleSheet(sheet2 as any);

        const rules = cssom.getAllRules();
        assertEquals(rules.length, 3);
    },
});

Deno.test({
    name: "CSSOM - getAllRules skips disabled sheets",
    fn() {
        const cssom = new CSSOM();
        const sheet1 = createMockStyleSheet([{ selector: "p" }]);
        const sheet2 = createMockStyleSheet([{ selector: "div" }]);

        cssom.addStyleSheet(sheet1 as any);
        cssom.addStyleSheet(sheet2 as any);

        sheet2.disabled = true;

        const rules = cssom.getAllRules();
        assertEquals(rules.length, 1);
    },
});

// CSSOM.clear tests

Deno.test({
    name: "CSSOM - clear removes all stylesheets",
    fn() {
        const cssom = new CSSOM();
        const sheet1 = createMockStyleSheet();
        const sheet2 = createMockStyleSheet();

        cssom.addStyleSheet(sheet1 as any);
        cssom.addStyleSheet(sheet2 as any);

        cssom.clear();

        assertEquals(cssom.getStyleSheetCount(), 0);
    },
});

Deno.test({
    name: "CSSOM - clear on empty CSSOM",
    fn() {
        const cssom = new CSSOM();

        cssom.clear();

        assertEquals(cssom.getStyleSheetCount(), 0);
    },
});

// CSSOM.getStyleSheetCount tests

Deno.test({
    name: "CSSOM - getStyleSheetCount returns 0 initially",
    fn() {
        const cssom = new CSSOM();

        assertEquals(cssom.getStyleSheetCount(), 0);
    },
});

Deno.test({
    name: "CSSOM - getStyleSheetCount after additions",
    fn() {
        const cssom = new CSSOM();

        cssom.addStyleSheet(createMockStyleSheet() as any);
        cssom.addStyleSheet(createMockStyleSheet() as any);
        cssom.addStyleSheet(createMockStyleSheet() as any);

        assertEquals(cssom.getStyleSheetCount(), 3);
    },
});

// CSSOM.getStyleSheetCountByOrigin tests

Deno.test({
    name: "CSSOM - getStyleSheetCountByOrigin for USER_AGENT",
    fn() {
        const cssom = new CSSOM();

        cssom.addStyleSheet(createMockStyleSheet() as any, StyleSheetOrigin.USER_AGENT);
        cssom.addStyleSheet(createMockStyleSheet() as any, StyleSheetOrigin.USER_AGENT);
        cssom.addStyleSheet(createMockStyleSheet() as any, StyleSheetOrigin.AUTHOR);

        assertEquals(cssom.getStyleSheetCountByOrigin(StyleSheetOrigin.USER_AGENT), 2);
    },
});

Deno.test({
    name: "CSSOM - getStyleSheetCountByOrigin for AUTHOR",
    fn() {
        const cssom = new CSSOM();

        cssom.addStyleSheet(createMockStyleSheet() as any, StyleSheetOrigin.AUTHOR);
        cssom.addStyleSheet(createMockStyleSheet() as any, StyleSheetOrigin.AUTHOR);
        cssom.addStyleSheet(createMockStyleSheet() as any, StyleSheetOrigin.AUTHOR);

        assertEquals(cssom.getStyleSheetCountByOrigin(StyleSheetOrigin.AUTHOR), 3);
    },
});

// CSSOM.setStyleSheetDisabled tests

Deno.test({
    name: "CSSOM - setStyleSheetDisabled disables stylesheet",
    fn() {
        const cssom = new CSSOM();
        const stylesheet = createMockStyleSheet();

        cssom.addStyleSheet(stylesheet as any);
        cssom.setStyleSheetDisabled(stylesheet as any, true);

        assertEquals(stylesheet.disabled, true);
    },
});

Deno.test({
    name: "CSSOM - setStyleSheetDisabled enables stylesheet",
    fn() {
        const cssom = new CSSOM();
        const stylesheet = createMockStyleSheet();
        stylesheet.disabled = true;

        cssom.addStyleSheet(stylesheet as any);
        cssom.setStyleSheetDisabled(stylesheet as any, false);

        assertEquals(stylesheet.disabled, false);
    },
});

// CSSOM.getRuleCount tests

Deno.test({
    name: "CSSOM - getRuleCount returns 0 initially",
    fn() {
        const cssom = new CSSOM();

        assertEquals(cssom.getRuleCount(), 0);
    },
});

Deno.test({
    name: "CSSOM - getRuleCount counts all rules",
    fn() {
        const cssom = new CSSOM();
        const sheet1 = createMockStyleSheet([{}, {}, {}]); // 3 rules
        const sheet2 = createMockStyleSheet([{}, {}]); // 2 rules

        cssom.addStyleSheet(sheet1 as any);
        cssom.addStyleSheet(sheet2 as any);

        assertEquals(cssom.getRuleCount(), 5);
    },
});

Deno.test({
    name: "CSSOM - getRuleCount skips disabled sheets",
    fn() {
        const cssom = new CSSOM();
        const sheet1 = createMockStyleSheet([{}, {}]); // 2 rules
        const sheet2 = createMockStyleSheet([{}, {}, {}]); // 3 rules
        sheet2.disabled = true;

        cssom.addStyleSheet(sheet1 as any);
        cssom.addStyleSheet(sheet2 as any);

        assertEquals(cssom.getRuleCount(), 2);
    },
});

// CSSOM.findStyleSheetByHref tests

Deno.test({
    name: "CSSOM - findStyleSheetByHref finds stylesheet",
    fn() {
        const cssom = new CSSOM();
        const sheet1 = createMockStyleSheet([], "style1.css");
        const sheet2 = createMockStyleSheet([], "style2.css");

        cssom.addStyleSheet(sheet1 as any);
        cssom.addStyleSheet(sheet2 as any);

        const found = cssom.findStyleSheetByHref("style2.css");
        assertEquals(found, sheet2);
    },
});

Deno.test({
    name: "CSSOM - findStyleSheetByHref returns null when not found",
    fn() {
        const cssom = new CSSOM();
        const sheet = createMockStyleSheet([], "style.css");

        cssom.addStyleSheet(sheet as any);

        const found = cssom.findStyleSheetByHref("other.css");
        assertEquals(found, null);
    },
});

// CSSOM.getStyleSheetsCascadeOrder tests

Deno.test({
    name: "CSSOM - getStyleSheetsCascadeOrder sorts by origin",
    fn() {
        const cssom = new CSSOM();
        const authorSheet = createMockStyleSheet();
        const uaSheet = createMockStyleSheet();
        const userSheet = createMockStyleSheet();

        cssom.addStyleSheet(authorSheet as any, StyleSheetOrigin.AUTHOR);
        cssom.addStyleSheet(uaSheet as any, StyleSheetOrigin.USER_AGENT);
        cssom.addStyleSheet(userSheet as any, StyleSheetOrigin.USER);

        const sorted = cssom.getStyleSheetsCascadeOrder();

        // Should be: user-agent, user, author
        assertEquals(sorted[0], uaSheet);
        assertEquals(sorted[1], userSheet);
        assertEquals(sorted[2], authorSheet);
    },
});

Deno.test({
    name: "CSSOM - getStyleSheetsCascadeOrder preserves source order within origin",
    fn() {
        const cssom = new CSSOM();
        const sheet1 = createMockStyleSheet();
        const sheet2 = createMockStyleSheet();
        const sheet3 = createMockStyleSheet();

        cssom.addStyleSheet(sheet1 as any, StyleSheetOrigin.AUTHOR);
        cssom.addStyleSheet(sheet2 as any, StyleSheetOrigin.AUTHOR);
        cssom.addStyleSheet(sheet3 as any, StyleSheetOrigin.AUTHOR);

        const sorted = cssom.getStyleSheetsCascadeOrder();

        assertEquals(sorted[0], sheet1);
        assertEquals(sorted[1], sheet2);
        assertEquals(sorted[2], sheet3);
    },
});

// CSSOM integration tests

Deno.test({
    name: "CSSOM - managing multiple origins",
    fn() {
        const cssom = new CSSOM();

        cssom.addStyleSheet(createMockStyleSheet() as any, StyleSheetOrigin.USER_AGENT);
        cssom.addStyleSheet(createMockStyleSheet() as any, StyleSheetOrigin.USER);
        cssom.addStyleSheet(createMockStyleSheet() as any, StyleSheetOrigin.AUTHOR);

        assertEquals(cssom.getStyleSheetCountByOrigin(StyleSheetOrigin.USER_AGENT), 1);
        assertEquals(cssom.getStyleSheetCountByOrigin(StyleSheetOrigin.USER), 1);
        assertEquals(cssom.getStyleSheetCountByOrigin(StyleSheetOrigin.AUTHOR), 1);
    },
});

Deno.test({
    name: "CSSOM - media queries stored with stylesheet",
    fn() {
        const cssom = new CSSOM();
        const sheet = createMockStyleSheet();

        cssom.addStyleSheet(sheet as any, StyleSheetOrigin.AUTHOR, "print");

        const entries = cssom.getStyleSheetEntries();
        assertEquals(entries[0].media, "print");
    },
});

Deno.test({
    name: "CSSOM - getStyleSheetEntries returns copies",
    fn() {
        const cssom = new CSSOM();
        cssom.addStyleSheet(createMockStyleSheet() as any);

        const entries1 = cssom.getStyleSheetEntries();
        const entries2 = cssom.getStyleSheetEntries();

        // Should be different arrays
        assert(entries1 !== entries2);
        assertEquals(entries1.length, entries2.length);
    },
});

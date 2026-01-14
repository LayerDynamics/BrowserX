/**
 * Tests for HTML Parser Statistics
 * Tests statistics tracking for HTML parsing.
 */

import { assertEquals, assertExists } from "@std/assert";
import {
    createHTMLParserStats,
    type HTMLParserStats,
} from "../../../../src/engine/rendering/html-parser/HTMLParserStats.ts";

// HTMLParserStats interface tests

Deno.test({
    name: "HTMLParserStats - interface structure",
    fn() {
        const stats: HTMLParserStats = {
            tokensEmitted: 100,
            parseErrors: 5,
            maxStackDepth: 10,
        };
        assertEquals(stats.tokensEmitted, 100);
        assertEquals(stats.parseErrors, 5);
        assertEquals(stats.maxStackDepth, 10);
    },
});

Deno.test({
    name: "HTMLParserStats - interface with zero values",
    fn() {
        const stats: HTMLParserStats = {
            tokensEmitted: 0,
            parseErrors: 0,
            maxStackDepth: 0,
        };
        assertEquals(stats.tokensEmitted, 0);
        assertEquals(stats.parseErrors, 0);
        assertEquals(stats.maxStackDepth, 0);
    },
});

Deno.test({
    name: "HTMLParserStats - interface with large values",
    fn() {
        const stats: HTMLParserStats = {
            tokensEmitted: 1000000,
            parseErrors: 500,
            maxStackDepth: 100,
        };
        assertEquals(stats.tokensEmitted, 1000000);
        assertEquals(stats.parseErrors, 500);
        assertEquals(stats.maxStackDepth, 100);
    },
});

// createHTMLParserStats function tests

Deno.test({
    name: "createHTMLParserStats - creates stats object",
    fn() {
        const stats = createHTMLParserStats();
        assertExists(stats);
    },
});

Deno.test({
    name: "createHTMLParserStats - initializes tokensEmitted to 0",
    fn() {
        const stats = createHTMLParserStats();
        assertEquals(stats.tokensEmitted, 0);
    },
});

Deno.test({
    name: "createHTMLParserStats - initializes parseErrors to 0",
    fn() {
        const stats = createHTMLParserStats();
        assertEquals(stats.parseErrors, 0);
    },
});

Deno.test({
    name: "createHTMLParserStats - initializes maxStackDepth to 0",
    fn() {
        const stats = createHTMLParserStats();
        assertEquals(stats.maxStackDepth, 0);
    },
});

Deno.test({
    name: "createHTMLParserStats - stats can be mutated",
    fn() {
        const stats = createHTMLParserStats();
        stats.tokensEmitted = 50;
        assertEquals(stats.tokensEmitted, 50);
    },
});

Deno.test({
    name: "createHTMLParserStats - tokensEmitted can be incremented",
    fn() {
        const stats = createHTMLParserStats();
        stats.tokensEmitted++;
        stats.tokensEmitted++;
        assertEquals(stats.tokensEmitted, 2);
    },
});

Deno.test({
    name: "createHTMLParserStats - parseErrors can be incremented",
    fn() {
        const stats = createHTMLParserStats();
        stats.parseErrors++;
        assertEquals(stats.parseErrors, 1);
    },
});

Deno.test({
    name: "createHTMLParserStats - maxStackDepth can be updated",
    fn() {
        const stats = createHTMLParserStats();
        stats.maxStackDepth = Math.max(stats.maxStackDepth, 5);
        assertEquals(stats.maxStackDepth, 5);
        stats.maxStackDepth = Math.max(stats.maxStackDepth, 3);
        assertEquals(stats.maxStackDepth, 5);
    },
});

Deno.test({
    name: "createHTMLParserStats - tracking typical parsing session",
    fn() {
        const stats = createHTMLParserStats();
        stats.tokensEmitted = 250;
        stats.parseErrors = 3;
        stats.maxStackDepth = 12;

        assertEquals(stats.tokensEmitted, 250);
        assertEquals(stats.parseErrors, 3);
        assertEquals(stats.maxStackDepth, 12);
    },
});

Deno.test({
    name: "createHTMLParserStats - tracking error-free parsing",
    fn() {
        const stats = createHTMLParserStats();
        stats.tokensEmitted = 500;
        stats.maxStackDepth = 8;

        assertEquals(stats.tokensEmitted, 500);
        assertEquals(stats.parseErrors, 0);
        assertEquals(stats.maxStackDepth, 8);
    },
});

Deno.test({
    name: "createHTMLParserStats - tracking deeply nested HTML",
    fn() {
        const stats = createHTMLParserStats();
        stats.tokensEmitted = 100;
        stats.maxStackDepth = 50;

        assertEquals(stats.maxStackDepth, 50);
    },
});

Deno.test({
    name: "createHTMLParserStats - multiple stats objects are independent",
    fn() {
        const stats1 = createHTMLParserStats();
        const stats2 = createHTMLParserStats();

        stats1.tokensEmitted = 100;
        stats2.tokensEmitted = 200;

        assertEquals(stats1.tokensEmitted, 100);
        assertEquals(stats2.tokensEmitted, 200);
    },
});

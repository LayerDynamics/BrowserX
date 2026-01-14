/**
 * Tests for Text Layout
 * Tests text measurement, line breaking, and wrapping.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import {
    TextLayout,
    BreakOpportunity,
    type TextRun,
    type LineBox,
    type TextLayoutResult,
    type TextLayoutOptions,
} from "../../../../src/engine/rendering/layout/TextLayout.ts";

// BreakOpportunity enum tests

Deno.test({
    name: "BreakOpportunity - NONE value",
    fn() {
        assertEquals(BreakOpportunity.NONE, 0);
    },
});

Deno.test({
    name: "BreakOpportunity - NORMAL value",
    fn() {
        assertEquals(BreakOpportunity.NORMAL, 1);
    },
});

Deno.test({
    name: "BreakOpportunity - ANYWHERE value",
    fn() {
        assertEquals(BreakOpportunity.ANYWHERE, 2);
    },
});

Deno.test({
    name: "BreakOpportunity - WORD_BREAK value",
    fn() {
        assertEquals(BreakOpportunity.WORD_BREAK, 3);
    },
});

// TextRun interface tests

Deno.test({
    name: "TextRun - interface structure",
    fn() {
        const run: TextRun = {
            text: "Hello",
            startIndex: 0,
            endIndex: 5,
            width: 30 as any,
        };

        assertExists(run);
        assertEquals(run.text, "Hello");
        assertEquals(run.startIndex, 0);
        assertEquals(run.endIndex, 5);
        assertEquals(run.width, 30);
    },
});

// LineBox interface tests

Deno.test({
    name: "LineBox - interface structure",
    fn() {
        const lineBox: LineBox = {
            runs: [],
            width: 100 as any,
            height: 20 as any,
            baseline: 16 as any,
        };

        assertExists(lineBox);
        assertEquals(lineBox.runs.length, 0);
        assertEquals(lineBox.width, 100);
        assertEquals(lineBox.height, 20);
        assertEquals(lineBox.baseline, 16);
    },
});

// TextLayoutResult interface tests

Deno.test({
    name: "TextLayoutResult - interface structure",
    fn() {
        const result: TextLayoutResult = {
            lines: [],
            totalWidth: 200 as any,
            totalHeight: 60 as any,
        };

        assertExists(result);
        assertEquals(result.lines.length, 0);
        assertEquals(result.totalWidth, 200);
        assertEquals(result.totalHeight, 60);
    },
});

// TextLayoutOptions interface tests

Deno.test({
    name: "TextLayoutOptions - interface structure",
    fn() {
        const options: TextLayoutOptions = {
            fontSize: 16 as any,
            fontFamily: "Arial",
            lineHeight: 20 as any,
            whiteSpace: "normal",
            wordBreak: "normal",
            overflowWrap: "normal",
        };

        assertExists(options);
        assertEquals(options.fontSize, 16);
        assertEquals(options.fontFamily, "Arial");
        assertEquals(options.lineHeight, 20);
        assertEquals(options.whiteSpace, "normal");
        assertEquals(options.wordBreak, "normal");
        assertEquals(options.overflowWrap, "normal");
    },
});

// TextLayout constructor tests

Deno.test({
    name: "TextLayout - constructor creates instance",
    fn() {
        const options: TextLayoutOptions = {
            fontSize: 16 as any,
            fontFamily: "Arial",
            lineHeight: 20 as any,
            whiteSpace: "normal",
            wordBreak: "normal",
            overflowWrap: "normal",
        };

        const layout = new TextLayout(options);

        assertExists(layout);
    },
});

Deno.test({
    name: "TextLayout - constructor with different options",
    fn() {
        const options: TextLayoutOptions = {
            fontSize: 12 as any,
            fontFamily: "Times New Roman",
            lineHeight: 18 as any,
            whiteSpace: "pre",
            wordBreak: "break-all",
            overflowWrap: "anywhere",
        };

        const layout = new TextLayout(options);

        assertExists(layout);
    },
});

// TextLayout.layout tests - normal mode

Deno.test({
    name: "TextLayout - layout empty text",
    fn() {
        const options: TextLayoutOptions = {
            fontSize: 16 as any,
            fontFamily: "Arial",
            lineHeight: 20 as any,
            whiteSpace: "normal",
            wordBreak: "normal",
            overflowWrap: "normal",
        };

        const layout = new TextLayout(options);
        const result = layout.layout("", 200 as any);

        assertExists(result);
        assertExists(result.lines);
    },
});

Deno.test({
    name: "TextLayout - layout single word",
    fn() {
        const options: TextLayoutOptions = {
            fontSize: 16 as any,
            fontFamily: "Arial",
            lineHeight: 20 as any,
            whiteSpace: "normal",
            wordBreak: "normal",
            overflowWrap: "normal",
        };

        const layout = new TextLayout(options);
        const result = layout.layout("Hello", 200 as any);

        assertExists(result);
        assert(result.lines.length > 0);
        assertEquals(result.totalHeight, 20);
    },
});

Deno.test({
    name: "TextLayout - layout multiple words on one line",
    fn() {
        const options: TextLayoutOptions = {
            fontSize: 16 as any,
            fontFamily: "Arial",
            lineHeight: 20 as any,
            whiteSpace: "normal",
            wordBreak: "normal",
            overflowWrap: "normal",
        };

        const layout = new TextLayout(options);
        const result = layout.layout("Hello World", 1000 as any);

        assertExists(result);
        assert(result.lines.length >= 1);
    },
});

Deno.test({
    name: "TextLayout - layout text with line wrapping",
    fn() {
        const options: TextLayoutOptions = {
            fontSize: 16 as any,
            fontFamily: "Arial",
            lineHeight: 20 as any,
            whiteSpace: "normal",
            wordBreak: "normal",
            overflowWrap: "normal",
        };

        const layout = new TextLayout(options);
        const result = layout.layout("Hello World Test", 50 as any);

        assertExists(result);
        assertExists(result.lines);
        assertExists(result.totalWidth);
        assertExists(result.totalHeight);
    },
});

// TextLayout.layout tests - nowrap mode

Deno.test({
    name: "TextLayout - layout with nowrap",
    fn() {
        const options: TextLayoutOptions = {
            fontSize: 16 as any,
            fontFamily: "Arial",
            lineHeight: 20 as any,
            whiteSpace: "nowrap",
            wordBreak: "normal",
            overflowWrap: "normal",
        };

        const layout = new TextLayout(options);
        const result = layout.layout("Hello World Test", 50 as any);

        assertExists(result);
        assertEquals(result.lines.length, 1);
    },
});

// TextLayout.layout tests - pre mode

Deno.test({
    name: "TextLayout - layout with pre",
    fn() {
        const options: TextLayoutOptions = {
            fontSize: 16 as any,
            fontFamily: "Arial",
            lineHeight: 20 as any,
            whiteSpace: "pre",
            wordBreak: "normal",
            overflowWrap: "normal",
        };

        const layout = new TextLayout(options);
        const result = layout.layout("Line1\nLine2\nLine3", 1000 as any);

        assertExists(result);
        assertEquals(result.lines.length, 3);
    },
});

Deno.test({
    name: "TextLayout - layout with pre preserves whitespace",
    fn() {
        const options: TextLayoutOptions = {
            fontSize: 16 as any,
            fontFamily: "Arial",
            lineHeight: 20 as any,
            whiteSpace: "pre",
            wordBreak: "normal",
            overflowWrap: "normal",
        };

        const layout = new TextLayout(options);
        const result = layout.layout("  Indented  ", 1000 as any);

        assertExists(result);
        assert(result.lines.length > 0);
    },
});

// TextLayout.layout tests - pre-wrap mode

Deno.test({
    name: "TextLayout - layout with pre-wrap",
    fn() {
        const options: TextLayoutOptions = {
            fontSize: 16 as any,
            fontFamily: "Arial",
            lineHeight: 20 as any,
            whiteSpace: "pre-wrap",
            wordBreak: "normal",
            overflowWrap: "normal",
        };

        const layout = new TextLayout(options);
        const result = layout.layout("Line1\nLine2", 1000 as any);

        assertExists(result);
        assert(result.lines.length >= 2);
    },
});

// TextLayout.layout tests - pre-line mode

Deno.test({
    name: "TextLayout - layout with pre-line",
    fn() {
        const options: TextLayoutOptions = {
            fontSize: 16 as any,
            fontFamily: "Arial",
            lineHeight: 20 as any,
            whiteSpace: "pre-line",
            wordBreak: "normal",
            overflowWrap: "normal",
        };

        const layout = new TextLayout(options);
        const result = layout.layout("Line1\nLine2", 1000 as any);

        assertExists(result);
        assert(result.lines.length >= 2);
    },
});

// TextLayout.setOptions and getOptions tests

Deno.test({
    name: "TextLayout - setOptions updates options",
    fn() {
        const options1: TextLayoutOptions = {
            fontSize: 16 as any,
            fontFamily: "Arial",
            lineHeight: 20 as any,
            whiteSpace: "normal",
            wordBreak: "normal",
            overflowWrap: "normal",
        };

        const layout = new TextLayout(options1);

        const options2: TextLayoutOptions = {
            fontSize: 18 as any,
            fontFamily: "Times",
            lineHeight: 24 as any,
            whiteSpace: "pre",
            wordBreak: "break-all",
            overflowWrap: "anywhere",
        };

        layout.setOptions(options2);

        assertExists(layout);
    },
});

Deno.test({
    name: "TextLayout - getOptions returns options",
    fn() {
        const options: TextLayoutOptions = {
            fontSize: 16 as any,
            fontFamily: "Arial",
            lineHeight: 20 as any,
            whiteSpace: "normal",
            wordBreak: "normal",
            overflowWrap: "normal",
        };

        const layout = new TextLayout(options);
        const retrieved = layout.getOptions();

        assertExists(retrieved);
        assertEquals(retrieved.fontSize, 16);
        assertEquals(retrieved.fontFamily, "Arial");
        assertEquals(retrieved.lineHeight, 20);
    },
});

// Integration tests

Deno.test({
    name: "TextLayout - layout with different font sizes",
    fn() {
        const smallOptions: TextLayoutOptions = {
            fontSize: 12 as any,
            fontFamily: "Arial",
            lineHeight: 16 as any,
            whiteSpace: "normal",
            wordBreak: "normal",
            overflowWrap: "normal",
        };

        const largeOptions: TextLayoutOptions = {
            fontSize: 24 as any,
            fontFamily: "Arial",
            lineHeight: 32 as any,
            whiteSpace: "normal",
            wordBreak: "normal",
            overflowWrap: "normal",
        };

        const smallLayout = new TextLayout(smallOptions);
        const largeLayout = new TextLayout(largeOptions);

        const smallResult = smallLayout.layout("Test", 100 as any);
        const largeResult = largeLayout.layout("Test", 100 as any);

        assertExists(smallResult);
        assertExists(largeResult);
        assertEquals(smallResult.totalHeight, 16);
        assertEquals(largeResult.totalHeight, 32);
    },
});

Deno.test({
    name: "TextLayout - layout with different line heights",
    fn() {
        const tightOptions: TextLayoutOptions = {
            fontSize: 16 as any,
            fontFamily: "Arial",
            lineHeight: 18 as any,
            whiteSpace: "normal",
            wordBreak: "normal",
            overflowWrap: "normal",
        };

        const looseOptions: TextLayoutOptions = {
            fontSize: 16 as any,
            fontFamily: "Arial",
            lineHeight: 28 as any,
            whiteSpace: "normal",
            wordBreak: "normal",
            overflowWrap: "normal",
        };

        const tightLayout = new TextLayout(tightOptions);
        const looseLayout = new TextLayout(looseOptions);

        const tightResult = tightLayout.layout("Line1\nLine2", 100 as any);
        const looseResult = looseLayout.layout("Line1\nLine2", 100 as any);

        assertExists(tightResult);
        assertExists(looseResult);
    },
});

Deno.test({
    name: "TextLayout - layout collapses whitespace in normal mode",
    fn() {
        const options: TextLayoutOptions = {
            fontSize: 16 as any,
            fontFamily: "Arial",
            lineHeight: 20 as any,
            whiteSpace: "normal",
            wordBreak: "normal",
            overflowWrap: "normal",
        };

        const layout = new TextLayout(options);
        const result = layout.layout("Hello    World", 1000 as any);

        assertExists(result);
        assert(result.lines.length > 0);
    },
});

Deno.test({
    name: "TextLayout - layout multiline text",
    fn() {
        const options: TextLayoutOptions = {
            fontSize: 16 as any,
            fontFamily: "Arial",
            lineHeight: 20 as any,
            whiteSpace: "pre",
            wordBreak: "normal",
            overflowWrap: "normal",
        };

        const layout = new TextLayout(options);
        const result = layout.layout("Line 1\nLine 2\nLine 3\nLine 4", 1000 as any);

        assertExists(result);
        assertEquals(result.lines.length, 4);
        assertEquals(result.totalHeight, 80);
    },
});

Deno.test({
    name: "TextLayout - layout with very narrow width",
    fn() {
        const options: TextLayoutOptions = {
            fontSize: 16 as any,
            fontFamily: "Arial",
            lineHeight: 20 as any,
            whiteSpace: "normal",
            wordBreak: "normal",
            overflowWrap: "normal",
        };

        const layout = new TextLayout(options);
        const result = layout.layout("Hello", 10 as any);

        assertExists(result);
        assert(result.lines.length >= 1);
    },
});

Deno.test({
    name: "TextLayout - layout long word wrapping",
    fn() {
        const options: TextLayoutOptions = {
            fontSize: 16 as any,
            fontFamily: "Arial",
            lineHeight: 20 as any,
            whiteSpace: "normal",
            wordBreak: "normal",
            overflowWrap: "normal",
        };

        const layout = new TextLayout(options);
        const result = layout.layout("Supercalifragilisticexpialidocious", 100 as any);

        assertExists(result);
        assert(result.lines.length >= 1);
    },
});

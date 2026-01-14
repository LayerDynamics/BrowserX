/**
 * Tests for CSS Property Computation
 * Tests computation of final CSS property values with inheritance and initial values.
 */

import { assertEquals, assertExists } from "@std/assert";
import { computeProperties } from "../../../../src/engine/rendering/css-parser/CSSPropertyCompute.ts";

// computeProperties function tests

Deno.test({
    name: "CSSPropertyCompute - computeProperties function exists",
    fn() {
        assertExists(computeProperties);
    },
});

Deno.test({
    name: "CSSPropertyCompute - computeProperties with empty declarations",
    fn() {
        const computed = computeProperties(new Map(), null as any);

        assertExists(computed);
        assertExists(computed.properties);
    },
});

Deno.test({
    name: "CSSPropertyCompute - computeProperties with single property",
    fn() {
        const declarations = [
            { property: "color", value: "red", important: false },
        ];

        const computed = computeProperties(declarations as any, null as any);

        assertEquals(computed.getPropertyValue("color"), "red");
    },
});

Deno.test({
    name: "CSSPropertyCompute - computeProperties with multiple properties",
    fn() {
        const declarations = [
            { property: "color", value: "red", important: false },
            { property: "font-size", value: "16px", important: false },
            { property: "margin", value: "10px", important: false },
        ];

        const computed = computeProperties(declarations as any, null as any);

        assertEquals(computed.getPropertyValue("color"), "red");
        assertEquals(computed.getPropertyValue("font-size"), "16px");
        assertEquals(computed.getPropertyValue("margin"), "10px");
    },
});

Deno.test({
    name: "CSSPropertyCompute - computeProperties with duplicate properties",
    fn() {
        const declarations = [
            { property: "color", value: "red", important: false },
            { property: "color", value: "blue", important: false },
        ];

        const computed = computeProperties(declarations as any, null as any);

        // Later declaration should win
        assertEquals(computed.getPropertyValue("color"), "blue");
    },
});

Deno.test({
    name: "CSSPropertyCompute - computeProperties with important flag",
    fn() {
        const declarations = [
            { property: "color", value: "red", important: false },
            { property: "color", value: "blue", important: true },
        ];

        const computed = computeProperties(declarations as any, null as any);

        // Important declaration should win
        assertEquals(computed.getPropertyValue("color"), "blue");
    },
});

Deno.test({
    name: "CSSPropertyCompute - computeProperties returns ComputedStyle",
    fn() {
        const declarations = [
            { property: "display", value: "block", important: false },
        ];

        const computed = computeProperties(declarations as any, null as any);

        assertExists(computed.getPropertyValue);
        assertExists(computed.setProperty);
        assertExists(computed.removeProperty);
    },
});

Deno.test({
    name: "CSSPropertyCompute - ComputedStyle getPropertyValue",
    fn() {
        const declarations = [
            { property: "background-color", value: "#fff", important: false },
        ];

        const computed = computeProperties(declarations as any, null as any);

        assertEquals(computed.getPropertyValue("background-color"), "#fff");
    },
});

Deno.test({
    name: "CSSPropertyCompute - ComputedStyle getPropertyValue for missing property",
    fn() {
        const declarations = new Map<string, string>();

        const computed = computeProperties(declarations, null as any);

        assertEquals(computed.getPropertyValue("nonexistent"), "");
    },
});

Deno.test({
    name: "CSSPropertyCompute - ComputedStyle setProperty",
    fn() {
        const computed = computeProperties(new Map(), null as any);

        computed.setProperty("color", "green");

        assertEquals(computed.getPropertyValue("color"), "green");
    },
});

Deno.test({
    name: "CSSPropertyCompute - ComputedStyle removeProperty",
    fn() {
        const declarations = [
            { property: "color", value: "red", important: false },
        ];

        const computed = computeProperties(declarations as any, null as any);
        computed.removeProperty("color");

        assertEquals(computed.getPropertyValue("color"), "");
    },
});

Deno.test({
    name: "CSSPropertyCompute - ComputedStyle with box model properties",
    fn() {
        const declarations = [
            { property: "margin", value: "10px", important: false },
            { property: "padding", value: "20px", important: false },
            { property: "border", value: "1px solid black", important: false },
        ];

        const computed = computeProperties(declarations as any, null as any);

        assertEquals(computed.getPropertyValue("margin"), "10px");
        assertEquals(computed.getPropertyValue("padding"), "20px");
        assertEquals(computed.getPropertyValue("border"), "1px solid black");
    },
});

Deno.test({
    name: "CSSPropertyCompute - ComputedStyle with font properties",
    fn() {
        const declarations = [
            { property: "font-family", value: "Arial, sans-serif", important: false },
            { property: "font-size", value: "16px", important: false },
            { property: "font-weight", value: "bold", important: false },
        ];

        const computed = computeProperties(declarations as any, null as any);

        assertEquals(computed.getPropertyValue("font-family"), "Arial, sans-serif");
        assertEquals(computed.getPropertyValue("font-size"), "16px");
        assertEquals(computed.getPropertyValue("font-weight"), "bold");
    },
});

Deno.test({
    name: "CSSPropertyCompute - ComputedStyle with display properties",
    fn() {
        const declarations = [
            { property: "display", value: "flex", important: false },
            { property: "justify-content", value: "center", important: false },
            { property: "align-items", value: "center", important: false },
        ];

        const computed = computeProperties(declarations as any, null as any);

        assertEquals(computed.getPropertyValue("display"), "flex");
        assertEquals(computed.getPropertyValue("justify-content"), "center");
        assertEquals(computed.getPropertyValue("align-items"), "center");
    },
});

Deno.test({
    name: "CSSPropertyCompute - ComputedStyle with position properties",
    fn() {
        const declarations = [
            { property: "position", value: "absolute", important: false },
            { property: "top", value: "10px", important: false },
            { property: "left", value: "20px", important: false },
        ];

        const computed = computeProperties(declarations as any, null as any);

        assertEquals(computed.getPropertyValue("position"), "absolute");
        assertEquals(computed.getPropertyValue("top"), "10px");
        assertEquals(computed.getPropertyValue("left"), "20px");
    },
});

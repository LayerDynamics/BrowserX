/**
 * Tests for Layout Constraints
 * Tests layout constraint interface definition.
 */

import { assertEquals, assertExists } from "@std/assert";
import type { LayoutConstraints } from "../../../../src/engine/rendering/layout/LayoutConstraints.ts";

// LayoutConstraints interface tests

Deno.test({
    name: "LayoutConstraints - interface with all properties",
    fn() {
        const constraints: LayoutConstraints = {
            minWidth: 100,
            maxWidth: 500,
            minHeight: 50,
            maxHeight: 300,
        };

        assertExists(constraints);
        assertEquals(constraints.minWidth, 100);
        assertEquals(constraints.maxWidth, 500);
        assertEquals(constraints.minHeight, 50);
        assertEquals(constraints.maxHeight, 300);
    },
});

Deno.test({
    name: "LayoutConstraints - interface with optional minWidth",
    fn() {
        const constraints: LayoutConstraints = {
            maxWidth: 500,
            minHeight: 50,
            maxHeight: 300,
        };

        assertExists(constraints);
        assertEquals(constraints.minWidth, undefined);
        assertEquals(constraints.maxWidth, 500);
    },
});

Deno.test({
    name: "LayoutConstraints - interface with optional maxWidth",
    fn() {
        const constraints: LayoutConstraints = {
            minWidth: 100,
            minHeight: 50,
            maxHeight: 300,
        };

        assertExists(constraints);
        assertEquals(constraints.minWidth, 100);
        assertEquals(constraints.maxWidth, undefined);
    },
});

Deno.test({
    name: "LayoutConstraints - interface with optional minHeight",
    fn() {
        const constraints: LayoutConstraints = {
            minWidth: 100,
            maxWidth: 500,
            maxHeight: 300,
        };

        assertExists(constraints);
        assertEquals(constraints.minHeight, undefined);
        assertEquals(constraints.maxHeight, 300);
    },
});

Deno.test({
    name: "LayoutConstraints - interface with optional maxHeight",
    fn() {
        const constraints: LayoutConstraints = {
            minWidth: 100,
            maxWidth: 500,
            minHeight: 50,
        };

        assertExists(constraints);
        assertEquals(constraints.maxHeight, undefined);
        assertEquals(constraints.minHeight, 50);
    },
});

Deno.test({
    name: "LayoutConstraints - interface with no properties",
    fn() {
        const constraints: LayoutConstraints = {};

        assertExists(constraints);
        assertEquals(constraints.minWidth, undefined);
        assertEquals(constraints.maxWidth, undefined);
        assertEquals(constraints.minHeight, undefined);
        assertEquals(constraints.maxHeight, undefined);
    },
});

Deno.test({
    name: "LayoutConstraints - interface with zero values",
    fn() {
        const constraints: LayoutConstraints = {
            minWidth: 0,
            maxWidth: 0,
            minHeight: 0,
            maxHeight: 0,
        };

        assertExists(constraints);
        assertEquals(constraints.minWidth, 0);
        assertEquals(constraints.maxWidth, 0);
        assertEquals(constraints.minHeight, 0);
        assertEquals(constraints.maxHeight, 0);
    },
});

Deno.test({
    name: "LayoutConstraints - interface with large values",
    fn() {
        const constraints: LayoutConstraints = {
            minWidth: 0,
            maxWidth: Number.POSITIVE_INFINITY,
            minHeight: 0,
            maxHeight: Number.POSITIVE_INFINITY,
        };

        assertExists(constraints);
        assertEquals(constraints.maxWidth, Number.POSITIVE_INFINITY);
        assertEquals(constraints.maxHeight, Number.POSITIVE_INFINITY);
    },
});

Deno.test({
    name: "LayoutConstraints - interface with width only",
    fn() {
        const constraints: LayoutConstraints = {
            minWidth: 100,
            maxWidth: 500,
        };

        assertExists(constraints);
        assertEquals(constraints.minWidth, 100);
        assertEquals(constraints.maxWidth, 500);
        assertEquals(constraints.minHeight, undefined);
        assertEquals(constraints.maxHeight, undefined);
    },
});

Deno.test({
    name: "LayoutConstraints - interface with height only",
    fn() {
        const constraints: LayoutConstraints = {
            minHeight: 50,
            maxHeight: 300,
        };

        assertExists(constraints);
        assertEquals(constraints.minWidth, undefined);
        assertEquals(constraints.maxWidth, undefined);
        assertEquals(constraints.minHeight, 50);
        assertEquals(constraints.maxHeight, 300);
    },
});

/**
 * Tests for Layout Box
 * Tests layout box interface and factory function.
 */

import { assertEquals, assertExists } from "@std/assert";
import type { LayoutBox } from "../../../../src/engine/rendering/layout/LayoutBox.ts";
import { createLayoutBox } from "../../../../src/engine/rendering/layout/LayoutBox.ts";

// LayoutBox interface tests

Deno.test({
    name: "LayoutBox - interface with all properties",
    fn() {
        const box: LayoutBox = {
            x: 10,
            y: 20,
            width: 100,
            height: 50,
            marginTop: 5,
            marginRight: 10,
            marginBottom: 5,
            marginLeft: 10,
            paddingTop: 8,
            paddingRight: 12,
            paddingBottom: 8,
            paddingLeft: 12,
        };

        assertExists(box);
        assertEquals(box.x, 10);
        assertEquals(box.y, 20);
        assertEquals(box.width, 100);
        assertEquals(box.height, 50);
        assertEquals(box.marginTop, 5);
        assertEquals(box.marginRight, 10);
        assertEquals(box.marginBottom, 5);
        assertEquals(box.marginLeft, 10);
        assertEquals(box.paddingTop, 8);
        assertEquals(box.paddingRight, 12);
        assertEquals(box.paddingBottom, 8);
        assertEquals(box.paddingLeft, 12);
    },
});

// createLayoutBox function tests

Deno.test({
    name: "createLayoutBox - creates box with zero values",
    fn() {
        const box = createLayoutBox();

        assertExists(box);
        assertEquals(box.x, 0);
        assertEquals(box.y, 0);
        assertEquals(box.width, 0);
        assertEquals(box.height, 0);
        assertEquals(box.marginTop, 0);
        assertEquals(box.marginRight, 0);
        assertEquals(box.marginBottom, 0);
        assertEquals(box.marginLeft, 0);
        assertEquals(box.paddingTop, 0);
        assertEquals(box.paddingRight, 0);
        assertEquals(box.paddingBottom, 0);
        assertEquals(box.paddingLeft, 0);
    },
});

Deno.test({
    name: "createLayoutBox - returns new object each time",
    fn() {
        const box1 = createLayoutBox();
        const box2 = createLayoutBox();

        assertExists(box1);
        assertExists(box2);
        assertEquals(box1 !== box2, true);
    },
});

Deno.test({
    name: "createLayoutBox - can modify returned box",
    fn() {
        const box = createLayoutBox();

        box.x = 100;
        box.y = 200;
        box.width = 300;
        box.height = 150;

        assertEquals(box.x, 100);
        assertEquals(box.y, 200);
        assertEquals(box.width, 300);
        assertEquals(box.height, 150);
    },
});

Deno.test({
    name: "createLayoutBox - can set margin values",
    fn() {
        const box = createLayoutBox();

        box.marginTop = 10;
        box.marginRight = 20;
        box.marginBottom = 10;
        box.marginLeft = 20;

        assertEquals(box.marginTop, 10);
        assertEquals(box.marginRight, 20);
        assertEquals(box.marginBottom, 10);
        assertEquals(box.marginLeft, 20);
    },
});

Deno.test({
    name: "createLayoutBox - can set padding values",
    fn() {
        const box = createLayoutBox();

        box.paddingTop = 5;
        box.paddingRight = 15;
        box.paddingBottom = 5;
        box.paddingLeft = 15;

        assertEquals(box.paddingTop, 5);
        assertEquals(box.paddingRight, 15);
        assertEquals(box.paddingBottom, 5);
        assertEquals(box.paddingLeft, 15);
    },
});

Deno.test({
    name: "LayoutBox - position properties",
    fn() {
        const box = createLayoutBox();

        box.x = 50;
        box.y = 75;

        assertEquals(box.x, 50);
        assertEquals(box.y, 75);
    },
});

Deno.test({
    name: "LayoutBox - size properties",
    fn() {
        const box = createLayoutBox();

        box.width = 200;
        box.height = 100;

        assertEquals(box.width, 200);
        assertEquals(box.height, 100);
    },
});

Deno.test({
    name: "LayoutBox - asymmetric margins",
    fn() {
        const box = createLayoutBox();

        box.marginTop = 10;
        box.marginRight = 20;
        box.marginBottom = 30;
        box.marginLeft = 40;

        assertEquals(box.marginTop, 10);
        assertEquals(box.marginRight, 20);
        assertEquals(box.marginBottom, 30);
        assertEquals(box.marginLeft, 40);
    },
});

Deno.test({
    name: "LayoutBox - asymmetric padding",
    fn() {
        const box = createLayoutBox();

        box.paddingTop = 5;
        box.paddingRight = 10;
        box.paddingBottom = 15;
        box.paddingLeft = 20;

        assertEquals(box.paddingTop, 5);
        assertEquals(box.paddingRight, 10);
        assertEquals(box.paddingBottom, 15);
        assertEquals(box.paddingLeft, 20);
    },
});

Deno.test({
    name: "LayoutBox - complete box model",
    fn() {
        const box = createLayoutBox();

        box.x = 10;
        box.y = 10;
        box.width = 200;
        box.height = 100;
        box.marginTop = 20;
        box.marginRight = 20;
        box.marginBottom = 20;
        box.marginLeft = 20;
        box.paddingTop = 10;
        box.paddingRight = 10;
        box.paddingBottom = 10;
        box.paddingLeft = 10;

        // Verify all values
        assertEquals(box.x, 10);
        assertEquals(box.y, 10);
        assertEquals(box.width, 200);
        assertEquals(box.height, 100);
        assertEquals(box.marginTop, 20);
        assertEquals(box.marginRight, 20);
        assertEquals(box.marginBottom, 20);
        assertEquals(box.marginLeft, 20);
        assertEquals(box.paddingTop, 10);
        assertEquals(box.paddingRight, 10);
        assertEquals(box.paddingBottom, 10);
        assertEquals(box.paddingLeft, 10);
    },
});

/**
 * Tests for Paint Context
 * Tests paint command collection.
 */

import { assertEquals, assertExists } from "@std/assert";
import { PaintContext } from "../../../../src/engine/rendering/paint/PaintContext.ts";
import { PaintCommandType } from "../../../../src/types/rendering.ts";
import type { PaintCommand } from "../../../../src/types/rendering.ts";

// PaintContext constructor tests

Deno.test({
    name: "PaintContext - constructor creates context instance",
    fn() {
        const context = new PaintContext();
        assertExists(context);
    },
});

Deno.test({
    name: "PaintContext - constructor initializes empty commands array",
    fn() {
        const context = new PaintContext();
        assertEquals(context.commands.length, 0);
    },
});

// PaintContext.addCommand tests

Deno.test({
    name: "PaintContext - addCommand adds command to array",
    fn() {
        const context = new PaintContext();
        const command: PaintCommand = {
            type: PaintCommandType.SAVE,
            params: {}
        };

        context.addCommand(command);

        assertEquals(context.commands.length, 1);
        assertEquals(context.commands[0], command);
    },
});

Deno.test({
    name: "PaintContext - addCommand adds multiple commands",
    fn() {
        const context = new PaintContext();
        const command1: PaintCommand = {
            type: PaintCommandType.SAVE,
            params: {}
        };
        const command2: PaintCommand = {
            type: PaintCommandType.RESTORE,
            params: {}
        };

        context.addCommand(command1);
        context.addCommand(command2);

        assertEquals(context.commands.length, 2);
        assertEquals(context.commands[0], command1);
        assertEquals(context.commands[1], command2);
    },
});

Deno.test({
    name: "PaintContext - addCommand preserves command order",
    fn() {
        const context = new PaintContext();
        const commands: PaintCommand[] = [
            { type: PaintCommandType.SAVE, params: {} },
            { type: PaintCommandType.FILL_RECT, params: { x: 10, y: 20 } },
            { type: PaintCommandType.RESTORE, params: {} },
        ];

        for (const cmd of commands) {
            context.addCommand(cmd);
        }

        assertEquals(context.commands.length, 3);
        for (let i = 0; i < commands.length; i++) {
            assertEquals(context.commands[i], commands[i]);
        }
    },
});

// PaintContext.getCommands tests

Deno.test({
    name: "PaintContext - getCommands returns commands array",
    fn() {
        const context = new PaintContext();
        const commands = context.getCommands();

        assertExists(commands);
        assertEquals(commands, context.commands);
    },
});

Deno.test({
    name: "PaintContext - getCommands returns same reference",
    fn() {
        const context = new PaintContext();
        const commands1 = context.getCommands();
        const commands2 = context.getCommands();

        assertEquals(commands1, commands2);
    },
});

Deno.test({
    name: "PaintContext - getCommands reflects added commands",
    fn() {
        const context = new PaintContext();
        const command: PaintCommand = {
            type: PaintCommandType.SAVE,
            params: {}
        };

        context.addCommand(command);
        const commands = context.getCommands();

        assertEquals(commands.length, 1);
        assertEquals(commands[0], command);
    },
});

// PaintContext.fillRect tests

Deno.test({
    name: "PaintContext - fillRect creates FILL_RECT command",
    fn() {
        const context = new PaintContext();

        context.fillRect(10 as any, 20 as any, 100 as any, 50 as any, "red");

        assertEquals(context.commands.length, 1);
        assertEquals(context.commands[0].type, PaintCommandType.FILL_RECT);
    },
});

Deno.test({
    name: "PaintContext - fillRect stores correct parameters",
    fn() {
        const context = new PaintContext();

        context.fillRect(10 as any, 20 as any, 100 as any, 50 as any, "red");

        const params = context.commands[0].params as any;
        assertEquals(params.x, 10);
        assertEquals(params.y, 20);
        assertEquals(params.width, 100);
        assertEquals(params.height, 50);
        assertEquals(params.color, "red");
    },
});

Deno.test({
    name: "PaintContext - fillRect with different colors",
    fn() {
        const context = new PaintContext();

        context.fillRect(0 as any, 0 as any, 10 as any, 10 as any, "blue");
        context.fillRect(10 as any, 10 as any, 10 as any, 10 as any, "#FF0000");

        assertEquals(context.commands.length, 2);
        assertEquals((context.commands[0].params as any).color, "blue");
        assertEquals((context.commands[1].params as any).color, "#FF0000");
    },
});

// PaintContext.strokeRect tests

Deno.test({
    name: "PaintContext - strokeRect creates STROKE_RECT command",
    fn() {
        const context = new PaintContext();

        context.strokeRect(10 as any, 20 as any, 100 as any, 50 as any, "black", 2 as any);

        assertEquals(context.commands.length, 1);
        assertEquals(context.commands[0].type, PaintCommandType.STROKE_RECT);
    },
});

Deno.test({
    name: "PaintContext - strokeRect stores correct parameters",
    fn() {
        const context = new PaintContext();

        context.strokeRect(10 as any, 20 as any, 100 as any, 50 as any, "black", 2 as any);

        const params = context.commands[0].params as any;
        assertEquals(params.x, 10);
        assertEquals(params.y, 20);
        assertEquals(params.width, 100);
        assertEquals(params.height, 50);
        assertEquals(params.color, "black");
        assertEquals(params.lineWidth, 2);
    },
});

Deno.test({
    name: "PaintContext - strokeRect with different line widths",
    fn() {
        const context = new PaintContext();

        context.strokeRect(0 as any, 0 as any, 10 as any, 10 as any, "red", 1 as any);
        context.strokeRect(10 as any, 10 as any, 10 as any, 10 as any, "blue", 5 as any);

        assertEquals(context.commands.length, 2);
        assertEquals((context.commands[0].params as any).lineWidth, 1);
        assertEquals((context.commands[1].params as any).lineWidth, 5);
    },
});

// PaintContext.fillText tests

Deno.test({
    name: "PaintContext - fillText creates FILL_TEXT command",
    fn() {
        const context = new PaintContext();

        context.fillText("Hello", 10 as any, 20 as any, "black", 16, "Arial");

        assertEquals(context.commands.length, 1);
        assertEquals(context.commands[0].type, PaintCommandType.FILL_TEXT);
    },
});

Deno.test({
    name: "PaintContext - fillText stores correct parameters",
    fn() {
        const context = new PaintContext();

        context.fillText("Hello World", 10 as any, 20 as any, "black", 16, "Arial");

        const params = context.commands[0].params as any;
        assertEquals(params.text, "Hello World");
        assertEquals(params.x, 10);
        assertEquals(params.y, 20);
        assertEquals(params.color, "black");
        assertEquals(params.fontSize, 16);
        assertEquals(params.fontFamily, "Arial");
    },
});

Deno.test({
    name: "PaintContext - fillText with different fonts",
    fn() {
        const context = new PaintContext();

        context.fillText("Text 1", 0 as any, 0 as any, "black", 12, "Arial");
        context.fillText("Text 2", 0 as any, 0 as any, "red", 20, "Times New Roman");

        assertEquals(context.commands.length, 2);
        assertEquals((context.commands[0].params as any).fontSize, 12);
        assertEquals((context.commands[0].params as any).fontFamily, "Arial");
        assertEquals((context.commands[1].params as any).fontSize, 20);
        assertEquals((context.commands[1].params as any).fontFamily, "Times New Roman");
    },
});

Deno.test({
    name: "PaintContext - fillText with empty string",
    fn() {
        const context = new PaintContext();

        context.fillText("", 10 as any, 20 as any, "black", 16, "Arial");

        assertEquals(context.commands.length, 1);
        assertEquals((context.commands[0].params as any).text, "");
    },
});

// PaintContext.drawImage tests

Deno.test({
    name: "PaintContext - drawImage creates DRAW_IMAGE command",
    fn() {
        const context = new PaintContext();

        context.drawImage("image.png", 10 as any, 20 as any, 100 as any, 50 as any);

        assertEquals(context.commands.length, 1);
        assertEquals(context.commands[0].type, PaintCommandType.DRAW_IMAGE);
    },
});

Deno.test({
    name: "PaintContext - drawImage stores correct parameters",
    fn() {
        const context = new PaintContext();

        context.drawImage("logo.png", 10 as any, 20 as any, 100 as any, 50 as any);

        const params = context.commands[0].params as any;
        assertEquals(params.src, "logo.png");
        assertEquals(params.x, 10);
        assertEquals(params.y, 20);
        assertEquals(params.width, 100);
        assertEquals(params.height, 50);
    },
});

Deno.test({
    name: "PaintContext - drawImage with different sources",
    fn() {
        const context = new PaintContext();

        context.drawImage("image1.jpg", 0 as any, 0 as any, 50 as any, 50 as any);
        context.drawImage("image2.png", 50 as any, 50 as any, 100 as any, 100 as any);

        assertEquals(context.commands.length, 2);
        assertEquals((context.commands[0].params as any).src, "image1.jpg");
        assertEquals((context.commands[1].params as any).src, "image2.png");
    },
});

// PaintContext.save tests

Deno.test({
    name: "PaintContext - save creates SAVE command",
    fn() {
        const context = new PaintContext();

        context.save();

        assertEquals(context.commands.length, 1);
        assertEquals(context.commands[0].type, PaintCommandType.SAVE);
    },
});

Deno.test({
    name: "PaintContext - save creates command with empty params",
    fn() {
        const context = new PaintContext();

        context.save();

        const params = context.commands[0].params;
        assertExists(params);
        assertEquals(params, {});
    },
});

Deno.test({
    name: "PaintContext - multiple save commands",
    fn() {
        const context = new PaintContext();

        context.save();
        context.save();

        assertEquals(context.commands.length, 2);
        assertEquals(context.commands[0].type, PaintCommandType.SAVE);
        assertEquals(context.commands[1].type, PaintCommandType.SAVE);
    },
});

// PaintContext.restore tests

Deno.test({
    name: "PaintContext - restore creates RESTORE command",
    fn() {
        const context = new PaintContext();

        context.restore();

        assertEquals(context.commands.length, 1);
        assertEquals(context.commands[0].type, PaintCommandType.RESTORE);
    },
});

Deno.test({
    name: "PaintContext - restore creates command with empty params",
    fn() {
        const context = new PaintContext();

        context.restore();

        const params = context.commands[0].params;
        assertExists(params);
        assertEquals(params, {});
    },
});

Deno.test({
    name: "PaintContext - multiple restore commands",
    fn() {
        const context = new PaintContext();

        context.restore();
        context.restore();

        assertEquals(context.commands.length, 2);
        assertEquals(context.commands[0].type, PaintCommandType.RESTORE);
        assertEquals(context.commands[1].type, PaintCommandType.RESTORE);
    },
});

// PaintContext integration tests

Deno.test({
    name: "PaintContext - save/restore pair",
    fn() {
        const context = new PaintContext();

        context.save();
        context.fillRect(10 as any, 20 as any, 100 as any, 50 as any, "red");
        context.restore();

        assertEquals(context.commands.length, 3);
        assertEquals(context.commands[0].type, PaintCommandType.SAVE);
        assertEquals(context.commands[1].type, PaintCommandType.FILL_RECT);
        assertEquals(context.commands[2].type, PaintCommandType.RESTORE);
    },
});

Deno.test({
    name: "PaintContext - complex drawing sequence",
    fn() {
        const context = new PaintContext();

        context.save();
        context.fillRect(0 as any, 0 as any, 100 as any, 100 as any, "white");
        context.strokeRect(0 as any, 0 as any, 100 as any, 100 as any, "black", 2 as any);
        context.fillText("Title", 10 as any, 20 as any, "black", 16, "Arial");
        context.drawImage("icon.png", 50 as any, 50 as any, 20 as any, 20 as any);
        context.restore();

        assertEquals(context.commands.length, 6);
        assertEquals(context.commands[0].type, PaintCommandType.SAVE);
        assertEquals(context.commands[1].type, PaintCommandType.FILL_RECT);
        assertEquals(context.commands[2].type, PaintCommandType.STROKE_RECT);
        assertEquals(context.commands[3].type, PaintCommandType.FILL_TEXT);
        assertEquals(context.commands[4].type, PaintCommandType.DRAW_IMAGE);
        assertEquals(context.commands[5].type, PaintCommandType.RESTORE);
    },
});

Deno.test({
    name: "PaintContext - nested save/restore",
    fn() {
        const context = new PaintContext();

        context.save();
        context.fillRect(0 as any, 0 as any, 100 as any, 100 as any, "red");
        context.save();
        context.fillRect(10 as any, 10 as any, 80 as any, 80 as any, "blue");
        context.restore();
        context.restore();

        assertEquals(context.commands.length, 6);
        assertEquals(context.commands[0].type, PaintCommandType.SAVE);
        assertEquals(context.commands[1].type, PaintCommandType.FILL_RECT);
        assertEquals(context.commands[2].type, PaintCommandType.SAVE);
        assertEquals(context.commands[3].type, PaintCommandType.FILL_RECT);
        assertEquals(context.commands[4].type, PaintCommandType.RESTORE);
        assertEquals(context.commands[5].type, PaintCommandType.RESTORE);
    },
});

Deno.test({
    name: "PaintContext - command order is preserved",
    fn() {
        const context = new PaintContext();

        context.fillRect(0 as any, 0 as any, 10 as any, 10 as any, "red");
        context.strokeRect(10 as any, 10 as any, 10 as any, 10 as any, "blue", 1 as any);
        context.fillText("Test", 20 as any, 20 as any, "black", 12, "Arial");

        assertEquals(context.commands.length, 3);
        assertEquals(context.commands[0].type, PaintCommandType.FILL_RECT);
        assertEquals(context.commands[1].type, PaintCommandType.STROKE_RECT);
        assertEquals(context.commands[2].type, PaintCommandType.FILL_TEXT);
    },
});

Deno.test({
    name: "PaintContext - commands array is mutable",
    fn() {
        const context = new PaintContext();

        context.fillRect(0 as any, 0 as any, 10 as any, 10 as any, "red");
        assertEquals(context.commands.length, 1);

        context.commands = [];
        assertEquals(context.commands.length, 0);
    },
});

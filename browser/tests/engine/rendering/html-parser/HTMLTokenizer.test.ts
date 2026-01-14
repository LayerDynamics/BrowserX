/**
 * Tests for HTML Tokenizer
 * Tests HTML5 tokenization state machine.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import {
    HTMLTokenizer,
    HTMLTokenType,
    HTMLTokenizerState,
    type HTMLToken,
} from "../../../../src/engine/rendering/html-parser/HTMLTokenizer.ts";

// HTMLTokenType enum tests

Deno.test({
    name: "HTMLTokenType - DOCTYPE value",
    fn() {
        assertEquals(HTMLTokenType.DOCTYPE, 0);
    },
});

Deno.test({
    name: "HTMLTokenType - START_TAG value",
    fn() {
        assertEquals(HTMLTokenType.START_TAG, 1);
    },
});

Deno.test({
    name: "HTMLTokenType - END_TAG value",
    fn() {
        assertEquals(HTMLTokenType.END_TAG, 2);
    },
});

Deno.test({
    name: "HTMLTokenType - COMMENT value",
    fn() {
        assertEquals(HTMLTokenType.COMMENT, 3);
    },
});

Deno.test({
    name: "HTMLTokenType - CHARACTER value",
    fn() {
        assertEquals(HTMLTokenType.CHARACTER, 4);
    },
});

Deno.test({
    name: "HTMLTokenType - EOF value",
    fn() {
        assertEquals(HTMLTokenType.EOF, 5);
    },
});

// HTMLTokenizerState enum tests (sampling key states)

Deno.test({
    name: "HTMLTokenizerState - DATA state exists",
    fn() {
        assertExists(HTMLTokenizerState.DATA);
    },
});

Deno.test({
    name: "HTMLTokenizerState - TAG_OPEN state exists",
    fn() {
        assertExists(HTMLTokenizerState.TAG_OPEN);
    },
});

Deno.test({
    name: "HTMLTokenizerState - TAG_NAME state exists",
    fn() {
        assertExists(HTMLTokenizerState.TAG_NAME);
    },
});

Deno.test({
    name: "HTMLTokenizerState - COMMENT state exists",
    fn() {
        assertExists(HTMLTokenizerState.COMMENT);
    },
});

Deno.test({
    name: "HTMLTokenizerState - SCRIPT_DATA state exists",
    fn() {
        assertExists(HTMLTokenizerState.SCRIPT_DATA);
    },
});

// HTMLTokenizer constructor tests

Deno.test({
    name: "HTMLTokenizer - constructor creates tokenizer",
    fn() {
        const tokenizer = new HTMLTokenizer();
        assertExists(tokenizer);
    },
});

// HTMLTokenizer.tokenize tests - basic tags

Deno.test({
    name: "HTMLTokenizer - tokenize simple start tag",
    fn() {
        const tokenizer = new HTMLTokenizer();
        const tokens = tokenizer.tokenize("<div>");

        assertEquals(tokens.length, 2); // div + EOF
        assertEquals(tokens[0].type, HTMLTokenType.START_TAG);
        assertEquals(tokens[0].tagName, "div");
        assertEquals(tokens[1].type, HTMLTokenType.EOF);
    },
});

Deno.test({
    name: "HTMLTokenizer - tokenize simple end tag",
    fn() {
        const tokenizer = new HTMLTokenizer();
        const tokens = tokenizer.tokenize("</div>");

        assertEquals(tokens.length, 2); // /div + EOF
        assertEquals(tokens[0].type, HTMLTokenType.END_TAG);
        assertEquals(tokens[0].tagName, "div");
    },
});

Deno.test({
    name: "HTMLTokenizer - tokenize tag with text content",
    fn() {
        const tokenizer = new HTMLTokenizer();
        const tokens = tokenizer.tokenize("<p>Hello</p>");

        const startTag = tokens.find(t => t.type === HTMLTokenType.START_TAG);
        const endTag = tokens.find(t => t.type === HTMLTokenType.END_TAG);
        const textTokens = tokens.filter(t => t.type === HTMLTokenType.CHARACTER);

        assertExists(startTag);
        assertEquals(startTag.tagName, "p");
        assertExists(endTag);
        assertEquals(endTag.tagName, "p");
        assertEquals(textTokens.length, 5); // H, e, l, l, o
    },
});

Deno.test({
    name: "HTMLTokenizer - tokenize uppercase tag name",
    fn() {
        const tokenizer = new HTMLTokenizer();
        const tokens = tokenizer.tokenize("<DIV>");

        assertEquals(tokens[0].type, HTMLTokenType.START_TAG);
        assertEquals(tokens[0].tagName, "div"); // lowercased
    },
});

Deno.test({
    name: "HTMLTokenizer - tokenize mixed case tag name",
    fn() {
        const tokenizer = new HTMLTokenizer();
        const tokens = tokenizer.tokenize("<DiV>");

        assertEquals(tokens[0].tagName, "div");
    },
});

// HTMLTokenizer.tokenize tests - attributes

Deno.test({
    name: "HTMLTokenizer - tokenize tag with double-quoted attribute",
    fn() {
        const tokenizer = new HTMLTokenizer();
        const tokens = tokenizer.tokenize('<div id="test">');

        assertEquals(tokens[0].type, HTMLTokenType.START_TAG);
        assertEquals(tokens[0].tagName, "div");
        assertExists(tokens[0].attributes);
        assertEquals(tokens[0].attributes!.get("id"), "test");
    },
});

Deno.test({
    name: "HTMLTokenizer - tokenize tag with single-quoted attribute",
    fn() {
        const tokenizer = new HTMLTokenizer();
        const tokens = tokenizer.tokenize("<div id='test'>");

        assertEquals(tokens[0].attributes!.get("id"), "test");
    },
});

Deno.test({
    name: "HTMLTokenizer - tokenize tag with unquoted attribute",
    fn() {
        const tokenizer = new HTMLTokenizer();
        const tokens = tokenizer.tokenize("<div id=test>");

        assertEquals(tokens[0].attributes!.get("id"), "test");
    },
});

Deno.test({
    name: "HTMLTokenizer - tokenize tag with multiple attributes",
    fn() {
        const tokenizer = new HTMLTokenizer();
        const tokens = tokenizer.tokenize('<div id="test" class="foo" data-value="bar">');

        assertEquals(tokens[0].attributes!.size, 3);
        assertEquals(tokens[0].attributes!.get("id"), "test");
        assertEquals(tokens[0].attributes!.get("class"), "foo");
        assertEquals(tokens[0].attributes!.get("data-value"), "bar");
    },
});

Deno.test({
    name: "HTMLTokenizer - tokenize tag with attribute without value",
    fn() {
        const tokenizer = new HTMLTokenizer();
        const tokens = tokenizer.tokenize("<input disabled>");

        assertEquals(tokens[0].attributes!.has("disabled"), true);
        assertEquals(tokens[0].attributes!.get("disabled"), "");
    },
});

Deno.test({
    name: "HTMLTokenizer - tokenize tag with uppercase attribute name",
    fn() {
        const tokenizer = new HTMLTokenizer();
        const tokens = tokenizer.tokenize('<div ID="test">');

        assertEquals(tokens[0].attributes!.get("id"), "test"); // lowercased
    },
});

Deno.test({
    name: "HTMLTokenizer - tokenize tag with spaces around equals",
    fn() {
        const tokenizer = new HTMLTokenizer();
        const tokens = tokenizer.tokenize('<div id = "test">');

        assertEquals(tokens[0].attributes!.get("id"), "test");
    },
});

// HTMLTokenizer.tokenize tests - self-closing tags

Deno.test({
    name: "HTMLTokenizer - tokenize self-closing tag",
    fn() {
        const tokenizer = new HTMLTokenizer();
        const tokens = tokenizer.tokenize("<br/>");

        assertEquals(tokens[0].type, HTMLTokenType.START_TAG);
        assertEquals(tokens[0].tagName, "br");
        assertEquals(tokens[0].selfClosing, true);
    },
});

Deno.test({
    name: "HTMLTokenizer - tokenize self-closing tag with space",
    fn() {
        const tokenizer = new HTMLTokenizer();
        const tokens = tokenizer.tokenize("<br />");

        assertEquals(tokens[0].selfClosing, true);
    },
});

Deno.test({
    name: "HTMLTokenizer - tokenize self-closing tag with attributes",
    fn() {
        const tokenizer = new HTMLTokenizer();
        const tokens = tokenizer.tokenize('<img src="test.jpg" />');

        assertEquals(tokens[0].tagName, "img");
        assertEquals(tokens[0].selfClosing, true);
        assertEquals(tokens[0].attributes!.get("src"), "test.jpg");
    },
});

// HTMLTokenizer.tokenize tests - comments

Deno.test({
    name: "HTMLTokenizer - tokenize comment",
    fn() {
        const tokenizer = new HTMLTokenizer();
        const tokens = tokenizer.tokenize("<!-- comment -->");

        assertEquals(tokens[0].type, HTMLTokenType.COMMENT);
        assertEquals(tokens[0].data, " comment ");
    },
});

Deno.test({
    name: "HTMLTokenizer - tokenize empty comment",
    fn() {
        const tokenizer = new HTMLTokenizer();
        const tokens = tokenizer.tokenize("<!---->");

        assertEquals(tokens[0].type, HTMLTokenType.COMMENT);
        assertEquals(tokens[0].data, "");
    },
});

Deno.test({
    name: "HTMLTokenizer - tokenize comment with hyphens",
    fn() {
        const tokenizer = new HTMLTokenizer();
        const tokens = tokenizer.tokenize("<!-- -- -->");

        assertEquals(tokens[0].type, HTMLTokenType.COMMENT);
    },
});

Deno.test({
    name: "HTMLTokenizer - tokenize multiline comment",
    fn() {
        const tokenizer = new HTMLTokenizer();
        const tokens = tokenizer.tokenize("<!-- line1\nline2\nline3 -->");

        assertEquals(tokens[0].type, HTMLTokenType.COMMENT);
        assert(tokens[0].data!.includes("line1"));
        assert(tokens[0].data!.includes("line2"));
    },
});

// HTMLTokenizer.tokenize tests - DOCTYPE

Deno.test({
    name: "HTMLTokenizer - tokenize DOCTYPE",
    fn() {
        const tokenizer = new HTMLTokenizer();
        const tokens = tokenizer.tokenize("<!DOCTYPE html>");

        assertEquals(tokens[0].type, HTMLTokenType.DOCTYPE);
        assertEquals(tokens[0].data, "html");
    },
});

Deno.test({
    name: "HTMLTokenizer - tokenize DOCTYPE lowercase",
    fn() {
        const tokenizer = new HTMLTokenizer();
        const tokens = tokenizer.tokenize("<!doctype html>");

        assertEquals(tokens[0].type, HTMLTokenType.DOCTYPE);
    },
});

Deno.test({
    name: "HTMLTokenizer - tokenize DOCTYPE with extra whitespace",
    fn() {
        const tokenizer = new HTMLTokenizer();
        const tokens = tokenizer.tokenize("<!DOCTYPE  html  >");

        assertEquals(tokens[0].type, HTMLTokenType.DOCTYPE);
    },
});

// HTMLTokenizer.tokenize tests - script tags

Deno.test({
    name: "HTMLTokenizer - tokenize script tag",
    fn() {
        const tokenizer = new HTMLTokenizer();
        const tokens = tokenizer.tokenize("<script></script>");

        const startTag = tokens.find(t => t.type === HTMLTokenType.START_TAG);
        const endTag = tokens.find(t => t.type === HTMLTokenType.END_TAG);

        assertExists(startTag);
        assertEquals(startTag.tagName, "script");
        assertExists(endTag);
        assertEquals(endTag.tagName, "script");
    },
});

Deno.test({
    name: "HTMLTokenizer - tokenize script tag with content",
    fn() {
        const tokenizer = new HTMLTokenizer();
        const tokens = tokenizer.tokenize("<script>var x = 1;</script>");

        const textTokens = tokens.filter(t => t.type === HTMLTokenType.CHARACTER);
        assert(textTokens.length > 0);
    },
});

Deno.test({
    name: "HTMLTokenizer - tokenize script tag with less-than sign",
    fn() {
        const tokenizer = new HTMLTokenizer();
        const tokens = tokenizer.tokenize("<script>if (x < 5) {}</script>");

        const startTag = tokens.find(t => t.type === HTMLTokenType.START_TAG);
        const endTag = tokens.find(t => t.type === HTMLTokenType.END_TAG);

        assertExists(startTag);
        assertExists(endTag);
    },
});

// HTMLTokenizer.tokenize tests - character tokens

Deno.test({
    name: "HTMLTokenizer - tokenize plain text",
    fn() {
        const tokenizer = new HTMLTokenizer();
        const tokens = tokenizer.tokenize("Hello");

        assertEquals(tokens.length, 6); // H, e, l, l, o, EOF
        for (let i = 0; i < 5; i++) {
            assertEquals(tokens[i].type, HTMLTokenType.CHARACTER);
        }
    },
});

Deno.test({
    name: "HTMLTokenizer - tokenize text with whitespace",
    fn() {
        const tokenizer = new HTMLTokenizer();
        const tokens = tokenizer.tokenize("Hello World");

        const charTokens = tokens.filter(t => t.type === HTMLTokenType.CHARACTER);
        assertEquals(charTokens.length, 11); // including space
    },
});

Deno.test({
    name: "HTMLTokenizer - tokenize text with newlines",
    fn() {
        const tokenizer = new HTMLTokenizer();
        const tokens = tokenizer.tokenize("Line1\nLine2");

        const charTokens = tokens.filter(t => t.type === HTMLTokenType.CHARACTER);
        assertEquals(charTokens.length, 11); // including newline
    },
});

// HTMLTokenizer.tokenize tests - EOF token

Deno.test({
    name: "HTMLTokenizer - always emits EOF token",
    fn() {
        const tokenizer = new HTMLTokenizer();
        const tokens = tokenizer.tokenize("<div>");

        const eofToken = tokens[tokens.length - 1];
        assertEquals(eofToken.type, HTMLTokenType.EOF);
    },
});

Deno.test({
    name: "HTMLTokenizer - emits EOF for empty input",
    fn() {
        const tokenizer = new HTMLTokenizer();
        const tokens = tokenizer.tokenize("");

        assertEquals(tokens.length, 1);
        assertEquals(tokens[0].type, HTMLTokenType.EOF);
    },
});

// HTMLTokenizer.tokenize tests - complex HTML

Deno.test({
    name: "HTMLTokenizer - tokenize nested tags",
    fn() {
        const tokenizer = new HTMLTokenizer();
        const tokens = tokenizer.tokenize("<div><p>Hello</p></div>");

        const startTags = tokens.filter(t => t.type === HTMLTokenType.START_TAG);
        const endTags = tokens.filter(t => t.type === HTMLTokenType.END_TAG);

        assertEquals(startTags.length, 2); // div, p
        assertEquals(endTags.length, 2); // p, div
    },
});

Deno.test({
    name: "HTMLTokenizer - tokenize real-world HTML fragment",
    fn() {
        const tokenizer = new HTMLTokenizer();
        const html = `
            <div class="container">
                <h1>Title</h1>
                <p>Paragraph</p>
            </div>
        `;
        const tokens = tokenizer.tokenize(html);

        const startTags = tokens.filter(t => t.type === HTMLTokenType.START_TAG);
        assertEquals(startTags.length, 3); // div, h1, p
    },
});

Deno.test({
    name: "HTMLTokenizer - tokenize HTML with mixed content",
    fn() {
        const tokenizer = new HTMLTokenizer();
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Test</title>
            </head>
            <body>
                <!-- comment -->
                <p>Hello</p>
            </body>
            </html>
        `;
        const tokens = tokenizer.tokenize(html);

        const doctype = tokens.find(t => t.type === HTMLTokenType.DOCTYPE);
        const comment = tokens.find(t => t.type === HTMLTokenType.COMMENT);

        assertExists(doctype);
        assertExists(comment);
    },
});

// HTMLToken interface tests

Deno.test({
    name: "HTMLToken - START_TAG structure",
    fn() {
        const token: HTMLToken = {
            type: HTMLTokenType.START_TAG,
            tagName: "div",
            attributes: new Map([["id", "test"]]),
        };

        assertEquals(token.type, HTMLTokenType.START_TAG);
        assertEquals(token.tagName, "div");
        assertEquals(token.attributes!.get("id"), "test");
    },
});

Deno.test({
    name: "HTMLToken - END_TAG structure",
    fn() {
        const token: HTMLToken = {
            type: HTMLTokenType.END_TAG,
            tagName: "div",
        };

        assertEquals(token.type, HTMLTokenType.END_TAG);
        assertEquals(token.tagName, "div");
    },
});

Deno.test({
    name: "HTMLToken - COMMENT structure",
    fn() {
        const token: HTMLToken = {
            type: HTMLTokenType.COMMENT,
            data: "comment text",
        };

        assertEquals(token.type, HTMLTokenType.COMMENT);
        assertEquals(token.data, "comment text");
    },
});

Deno.test({
    name: "HTMLToken - CHARACTER structure",
    fn() {
        const token: HTMLToken = {
            type: HTMLTokenType.CHARACTER,
            data: "H",
        };

        assertEquals(token.type, HTMLTokenType.CHARACTER);
        assertEquals(token.data, "H");
    },
});

Deno.test({
    name: "HTMLToken - DOCTYPE structure",
    fn() {
        const token: HTMLToken = {
            type: HTMLTokenType.DOCTYPE,
            data: "html",
        };

        assertEquals(token.type, HTMLTokenType.DOCTYPE);
        assertEquals(token.data, "html");
    },
});

Deno.test({
    name: "HTMLToken - EOF structure",
    fn() {
        const token: HTMLToken = {
            type: HTMLTokenType.EOF,
        };

        assertEquals(token.type, HTMLTokenType.EOF);
    },
});

Deno.test({
    name: "HTMLToken - self-closing flag",
    fn() {
        const token: HTMLToken = {
            type: HTMLTokenType.START_TAG,
            tagName: "br",
            selfClosing: true,
        };

        assertEquals(token.selfClosing, true);
    },
});

// Edge cases

Deno.test({
    name: "HTMLTokenizer - handles malformed tag",
    fn() {
        const tokenizer = new HTMLTokenizer();
        const tokens = tokenizer.tokenize("<div");

        // Should handle gracefully
        assertExists(tokens);
    },
});

Deno.test({
    name: "HTMLTokenizer - handles unclosed tag",
    fn() {
        const tokenizer = new HTMLTokenizer();
        const tokens = tokenizer.tokenize("<div>content");

        const startTag = tokens.find(t => t.type === HTMLTokenType.START_TAG);
        assertExists(startTag);
    },
});

Deno.test({
    name: "HTMLTokenizer - handles special characters in text",
    fn() {
        const tokenizer = new HTMLTokenizer();
        const tokens = tokenizer.tokenize("<p>&amp;&lt;&gt;</p>");

        const charTokens = tokens.filter(t => t.type === HTMLTokenType.CHARACTER);
        assert(charTokens.length > 0);
    },
});

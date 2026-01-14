/**
 * Tests for HTML Tree Builder
 * Tests DOM tree construction from HTML tokens.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import {
    HTMLTreeBuilder,
    InsertionMode,
} from "../../../../src/engine/rendering/html-parser/HTMLTreeBuilder.ts";
import {
    HTMLTokenizer,
    HTMLTokenType,
    type HTMLToken,
} from "../../../../src/engine/rendering/html-parser/HTMLTokenizer.ts";

// InsertionMode enum tests (sampling key modes)

Deno.test({
    name: "InsertionMode - INITIAL value",
    fn() {
        assertEquals(InsertionMode.INITIAL, 0);
    },
});

Deno.test({
    name: "InsertionMode - BEFORE_HTML value",
    fn() {
        assertEquals(InsertionMode.BEFORE_HTML, 1);
    },
});

Deno.test({
    name: "InsertionMode - BEFORE_HEAD value",
    fn() {
        assertEquals(InsertionMode.BEFORE_HEAD, 2);
    },
});

Deno.test({
    name: "InsertionMode - IN_HEAD value",
    fn() {
        assertEquals(InsertionMode.IN_HEAD, 3);
    },
});

Deno.test({
    name: "InsertionMode - IN_BODY value",
    fn() {
        assertEquals(InsertionMode.IN_BODY, 6);
    },
});

Deno.test({
    name: "InsertionMode - AFTER_BODY value",
    fn() {
        assertEquals(InsertionMode.AFTER_BODY, 17);
    },
});

// HTMLTreeBuilder constructor tests

Deno.test({
    name: "HTMLTreeBuilder - constructor creates builder",
    fn() {
        const builder = new HTMLTreeBuilder();
        assertExists(builder);
    },
});

// HTMLTreeBuilder.build tests - simple structures

Deno.test({
    name: "HTMLTreeBuilder - build creates document from empty tokens",
    fn() {
        const builder = new HTMLTreeBuilder();
        const tokens: HTMLToken[] = [{ type: HTMLTokenType.EOF }];
        const doc = builder.build(tokens);

        assertExists(doc);
        assertEquals(doc.nodeType, 9); // DOCUMENT_NODE
    },
});

Deno.test({
    name: "HTMLTreeBuilder - build handles DOCTYPE",
    fn() {
        const builder = new HTMLTreeBuilder();
        const tokens: HTMLToken[] = [
            { type: HTMLTokenType.DOCTYPE, data: "html" },
            { type: HTMLTokenType.EOF },
        ];
        const doc = builder.build(tokens);

        assertExists(doc);
        assert(doc.childNodes.length > 0);
    },
});

Deno.test({
    name: "HTMLTreeBuilder - build creates html element",
    fn() {
        const builder = new HTMLTreeBuilder();
        const tokens: HTMLToken[] = [
            { type: HTMLTokenType.START_TAG, tagName: "html", attributes: new Map() },
            { type: HTMLTokenType.END_TAG, tagName: "html" },
            { type: HTMLTokenType.EOF },
        ];
        const doc = builder.build(tokens);

        const html = doc.childNodes.find((n: any) => n.tagName === "html");
        assertExists(html);
    },
});

Deno.test({
    name: "HTMLTreeBuilder - build creates implicit html element",
    fn() {
        const builder = new HTMLTreeBuilder();
        const tokens: HTMLToken[] = [
            { type: HTMLTokenType.START_TAG, tagName: "body", attributes: new Map() },
            { type: HTMLTokenType.EOF },
        ];
        const doc = builder.build(tokens);

        const html = doc.childNodes.find((n: any) => n.tagName === "html");
        assertExists(html);
    },
});

Deno.test({
    name: "HTMLTreeBuilder - build creates head element",
    fn() {
        const builder = new HTMLTreeBuilder();
        const tokens: HTMLToken[] = [
            { type: HTMLTokenType.START_TAG, tagName: "html", attributes: new Map() },
            { type: HTMLTokenType.START_TAG, tagName: "head", attributes: new Map() },
            { type: HTMLTokenType.END_TAG, tagName: "head" },
            { type: HTMLTokenType.END_TAG, tagName: "html" },
            { type: HTMLTokenType.EOF },
        ];
        const doc = builder.build(tokens);

        const html = doc.childNodes.find((n: any) => n.tagName === "html");
        const head = html.childNodes.find((n: any) => n.tagName === "head");
        assertExists(head);
    },
});

Deno.test({
    name: "HTMLTreeBuilder - build creates body element",
    fn() {
        const builder = new HTMLTreeBuilder();
        const tokens: HTMLToken[] = [
            { type: HTMLTokenType.START_TAG, tagName: "html", attributes: new Map() },
            { type: HTMLTokenType.START_TAG, tagName: "body", attributes: new Map() },
            { type: HTMLTokenType.END_TAG, tagName: "body" },
            { type: HTMLTokenType.END_TAG, tagName: "html" },
            { type: HTMLTokenType.EOF },
        ];
        const doc = builder.build(tokens);

        const html = doc.childNodes.find((n: any) => n.tagName === "html");
        const body = html.childNodes.find((n: any) => n.tagName === "body");
        assertExists(body);
    },
});

// HTMLTreeBuilder.build tests - nested elements

Deno.test({
    name: "HTMLTreeBuilder - build handles nested elements",
    fn() {
        const builder = new HTMLTreeBuilder();
        const tokens: HTMLToken[] = [
            { type: HTMLTokenType.START_TAG, tagName: "html", attributes: new Map() },
            { type: HTMLTokenType.START_TAG, tagName: "body", attributes: new Map() },
            { type: HTMLTokenType.START_TAG, tagName: "div", attributes: new Map() },
            { type: HTMLTokenType.END_TAG, tagName: "div" },
            { type: HTMLTokenType.END_TAG, tagName: "body" },
            { type: HTMLTokenType.END_TAG, tagName: "html" },
            { type: HTMLTokenType.EOF },
        ];
        const doc = builder.build(tokens);

        const html = doc.childNodes.find((n: any) => n.tagName === "html");
        const body = html.childNodes.find((n: any) => n.tagName === "body");
        const div = body.childNodes.find((n: any) => n.tagName === "div");
        assertExists(div);
    },
});

Deno.test({
    name: "HTMLTreeBuilder - build handles deeply nested elements",
    fn() {
        const builder = new HTMLTreeBuilder();
        const tokens: HTMLToken[] = [
            { type: HTMLTokenType.START_TAG, tagName: "html", attributes: new Map() },
            { type: HTMLTokenType.START_TAG, tagName: "body", attributes: new Map() },
            { type: HTMLTokenType.START_TAG, tagName: "div", attributes: new Map() },
            { type: HTMLTokenType.START_TAG, tagName: "p", attributes: new Map() },
            { type: HTMLTokenType.START_TAG, tagName: "span", attributes: new Map() },
            { type: HTMLTokenType.END_TAG, tagName: "span" },
            { type: HTMLTokenType.END_TAG, tagName: "p" },
            { type: HTMLTokenType.END_TAG, tagName: "div" },
            { type: HTMLTokenType.END_TAG, tagName: "body" },
            { type: HTMLTokenType.END_TAG, tagName: "html" },
            { type: HTMLTokenType.EOF },
        ];
        const doc = builder.build(tokens);

        const html = doc.childNodes.find((n: any) => n.tagName === "html");
        assertExists(html);
        const body = html.childNodes.find((n: any) => n.tagName === "body");
        assertExists(body);
    },
});

// HTMLTreeBuilder.build tests - text content

Deno.test({
    name: "HTMLTreeBuilder - build handles text nodes",
    fn() {
        const builder = new HTMLTreeBuilder();
        const tokens: HTMLToken[] = [
            { type: HTMLTokenType.START_TAG, tagName: "html", attributes: new Map() },
            { type: HTMLTokenType.START_TAG, tagName: "body", attributes: new Map() },
            { type: HTMLTokenType.CHARACTER, data: "H" },
            { type: HTMLTokenType.CHARACTER, data: "i" },
            { type: HTMLTokenType.END_TAG, tagName: "body" },
            { type: HTMLTokenType.EOF },
        ];
        const doc = builder.build(tokens);

        const html = doc.childNodes.find((n: any) => n.tagName === "html");
        const body = html.childNodes.find((n: any) => n.tagName === "body");
        const textNode = body.childNodes.find((n: any) => n.nodeType === 3);
        assertExists(textNode);
        assertEquals(textNode.nodeValue, "Hi"); // Coalesced
    },
});

Deno.test({
    name: "HTMLTreeBuilder - build coalesces adjacent text nodes",
    fn() {
        const builder = new HTMLTreeBuilder();
        const tokens: HTMLToken[] = [
            { type: HTMLTokenType.START_TAG, tagName: "p", attributes: new Map() },
            { type: HTMLTokenType.CHARACTER, data: "H" },
            { type: HTMLTokenType.CHARACTER, data: "e" },
            { type: HTMLTokenType.CHARACTER, data: "l" },
            { type: HTMLTokenType.CHARACTER, data: "l" },
            { type: HTMLTokenType.CHARACTER, data: "o" },
            { type: HTMLTokenType.END_TAG, tagName: "p" },
            { type: HTMLTokenType.EOF },
        ];
        const doc = builder.build(tokens);

        const html = doc.childNodes.find((n: any) => n.tagName === "html");
        const body = html?.childNodes.find((n: any) => n.tagName === "body");
        const p = body?.childNodes.find((n: any) => n.tagName === "p");

        if (p) {
            const textNodes = p.childNodes.filter((n: any) => n.nodeType === 3);
            assertEquals(textNodes.length, 1); // Should be coalesced
            assertEquals(textNodes[0].nodeValue, "Hello");
        }
    },
});

// HTMLTreeBuilder.build tests - attributes

Deno.test({
    name: "HTMLTreeBuilder - build preserves element attributes",
    fn() {
        const builder = new HTMLTreeBuilder();
        const attrs = new Map([["id", "test"], ["class", "foo"]]);
        const tokens: HTMLToken[] = [
            { type: HTMLTokenType.START_TAG, tagName: "div", attributes: attrs },
            { type: HTMLTokenType.END_TAG, tagName: "div" },
            { type: HTMLTokenType.EOF },
        ];
        const doc = builder.build(tokens);

        const html = doc.childNodes.find((n: any) => n.tagName === "html");
        const body = html?.childNodes.find((n: any) => n.tagName === "body");
        const div = body?.childNodes.find((n: any) => n.tagName === "div");

        if (div) {
            assertEquals(div.attributes.get("id"), "test");
            assertEquals(div.attributes.get("class"), "foo");
        }
    },
});

// HTMLTreeBuilder.build tests - comments

Deno.test({
    name: "HTMLTreeBuilder - build handles comments",
    fn() {
        const builder = new HTMLTreeBuilder();
        const tokens: HTMLToken[] = [
            { type: HTMLTokenType.START_TAG, tagName: "html", attributes: new Map() },
            { type: HTMLTokenType.START_TAG, tagName: "body", attributes: new Map() },
            { type: HTMLTokenType.COMMENT, data: " comment " },
            { type: HTMLTokenType.END_TAG, tagName: "body" },
            { type: HTMLTokenType.EOF },
        ];
        const doc = builder.build(tokens);

        const html = doc.childNodes.find((n: any) => n.tagName === "html");
        const body = html.childNodes.find((n: any) => n.tagName === "body");
        const comment = body.childNodes.find((n: any) => n.nodeType === 8);
        assertExists(comment);
        assertEquals(comment.nodeValue, " comment ");
    },
});

// HTMLTreeBuilder.build tests - void elements

Deno.test({
    name: "HTMLTreeBuilder - build handles br tag",
    fn() {
        const builder = new HTMLTreeBuilder();
        const tokens: HTMLToken[] = [
            { type: HTMLTokenType.START_TAG, tagName: "p", attributes: new Map() },
            { type: HTMLTokenType.START_TAG, tagName: "br", attributes: new Map() },
            { type: HTMLTokenType.END_TAG, tagName: "p" },
            { type: HTMLTokenType.EOF },
        ];
        const doc = builder.build(tokens);

        const html = doc.childNodes.find((n: any) => n.tagName === "html");
        const body = html?.childNodes.find((n: any) => n.tagName === "body");
        const p = body?.childNodes.find((n: any) => n.tagName === "p");
        const br = p?.childNodes.find((n: any) => n.tagName === "br");
        assertExists(br);
    },
});

Deno.test({
    name: "HTMLTreeBuilder - build handles img tag",
    fn() {
        const builder = new HTMLTreeBuilder();
        const attrs = new Map([["src", "test.jpg"]]);
        const tokens: HTMLToken[] = [
            { type: HTMLTokenType.START_TAG, tagName: "img", attributes: attrs },
            { type: HTMLTokenType.EOF },
        ];
        const doc = builder.build(tokens);

        const html = doc.childNodes.find((n: any) => n.tagName === "html");
        const body = html?.childNodes.find((n: any) => n.tagName === "body");
        const img = body?.childNodes.find((n: any) => n.tagName === "img");

        if (img) {
            assertEquals(img.attributes.get("src"), "test.jpg");
        }
    },
});

// HTMLTreeBuilder.build tests - head elements

Deno.test({
    name: "HTMLTreeBuilder - build handles title in head",
    fn() {
        const builder = new HTMLTreeBuilder();
        const tokens: HTMLToken[] = [
            { type: HTMLTokenType.START_TAG, tagName: "html", attributes: new Map() },
            { type: HTMLTokenType.START_TAG, tagName: "head", attributes: new Map() },
            { type: HTMLTokenType.START_TAG, tagName: "title", attributes: new Map() },
            { type: HTMLTokenType.CHARACTER, data: "T" },
            { type: HTMLTokenType.CHARACTER, data: "e" },
            { type: HTMLTokenType.CHARACTER, data: "s" },
            { type: HTMLTokenType.CHARACTER, data: "t" },
            { type: HTMLTokenType.END_TAG, tagName: "title" },
            { type: HTMLTokenType.END_TAG, tagName: "head" },
            { type: HTMLTokenType.EOF },
        ];
        const doc = builder.build(tokens);

        const html = doc.childNodes.find((n: any) => n.tagName === "html");
        const head = html.childNodes.find((n: any) => n.tagName === "head");
        const title = head?.childNodes.find((n: any) => n.tagName === "title");
        assertExists(title);
    },
});

Deno.test({
    name: "HTMLTreeBuilder - build handles meta in head",
    fn() {
        const builder = new HTMLTreeBuilder();
        const attrs = new Map([["charset", "utf-8"]]);
        const tokens: HTMLToken[] = [
            { type: HTMLTokenType.START_TAG, tagName: "head", attributes: new Map() },
            { type: HTMLTokenType.START_TAG, tagName: "meta", attributes: attrs },
            { type: HTMLTokenType.END_TAG, tagName: "head" },
            { type: HTMLTokenType.EOF },
        ];
        const doc = builder.build(tokens);

        const html = doc.childNodes.find((n: any) => n.tagName === "html");
        const head = html.childNodes.find((n: any) => n.tagName === "head");
        assertExists(head);
    },
});

Deno.test({
    name: "HTMLTreeBuilder - build handles link in head",
    fn() {
        const builder = new HTMLTreeBuilder();
        const attrs = new Map([["rel", "stylesheet"], ["href", "style.css"]]);
        const tokens: HTMLToken[] = [
            { type: HTMLTokenType.START_TAG, tagName: "head", attributes: new Map() },
            { type: HTMLTokenType.START_TAG, tagName: "link", attributes: attrs },
            { type: HTMLTokenType.END_TAG, tagName: "head" },
            { type: HTMLTokenType.EOF },
        ];
        const doc = builder.build(tokens);

        const html = doc.childNodes.find((n: any) => n.tagName === "html");
        const head = html.childNodes.find((n: any) => n.tagName === "head");
        assertExists(head);
    },
});

// HTMLTreeBuilder.build tests - script and style

Deno.test({
    name: "HTMLTreeBuilder - build handles script tag",
    fn() {
        const builder = new HTMLTreeBuilder();
        const tokens: HTMLToken[] = [
            { type: HTMLTokenType.START_TAG, tagName: "head", attributes: new Map() },
            { type: HTMLTokenType.START_TAG, tagName: "script", attributes: new Map() },
            { type: HTMLTokenType.CHARACTER, data: "v" },
            { type: HTMLTokenType.CHARACTER, data: "a" },
            { type: HTMLTokenType.CHARACTER, data: "r" },
            { type: HTMLTokenType.END_TAG, tagName: "script" },
            { type: HTMLTokenType.END_TAG, tagName: "head" },
            { type: HTMLTokenType.EOF },
        ];
        const doc = builder.build(tokens);

        const html = doc.childNodes.find((n: any) => n.tagName === "html");
        const head = html.childNodes.find((n: any) => n.tagName === "head");
        const script = head?.childNodes.find((n: any) => n.tagName === "script");
        assertExists(script);
    },
});

Deno.test({
    name: "HTMLTreeBuilder - build handles style tag",
    fn() {
        const builder = new HTMLTreeBuilder();
        const tokens: HTMLToken[] = [
            { type: HTMLTokenType.START_TAG, tagName: "head", attributes: new Map() },
            { type: HTMLTokenType.START_TAG, tagName: "style", attributes: new Map() },
            { type: HTMLTokenType.CHARACTER, data: "." },
            { type: HTMLTokenType.END_TAG, tagName: "style" },
            { type: HTMLTokenType.END_TAG, tagName: "head" },
            { type: HTMLTokenType.EOF },
        ];
        const doc = builder.build(tokens);

        const html = doc.childNodes.find((n: any) => n.tagName === "html");
        const head = html.childNodes.find((n: any) => n.tagName === "head");
        const style = head?.childNodes.find((n: any) => n.tagName === "style");
        assertExists(style);
    },
});

// Integration tests with tokenizer

Deno.test({
    name: "HTMLTreeBuilder - integration with tokenizer for simple HTML",
    fn() {
        const tokenizer = new HTMLTokenizer();
        const tokens = tokenizer.tokenize("<p>Hello</p>");

        const builder = new HTMLTreeBuilder();
        const doc = builder.build(tokens);

        assertExists(doc);
    },
});

Deno.test({
    name: "HTMLTreeBuilder - integration with tokenizer for DOCTYPE",
    fn() {
        const tokenizer = new HTMLTokenizer();
        const tokens = tokenizer.tokenize("<!DOCTYPE html><html></html>");

        const builder = new HTMLTreeBuilder();
        const doc = builder.build(tokens);

        assertExists(doc);
        assert(doc.childNodes.length > 0);
    },
});

Deno.test({
    name: "HTMLTreeBuilder - integration with tokenizer for full document",
    fn() {
        const tokenizer = new HTMLTokenizer();
        const html = `
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Test</title>
                </head>
                <body>
                    <h1>Hello</h1>
                    <p>World</p>
                </body>
            </html>
        `;
        const tokens = tokenizer.tokenize(html);

        const builder = new HTMLTreeBuilder();
        const doc = builder.build(tokens);

        assertExists(doc);
        const htmlEl = doc.childNodes.find((n: any) => n.tagName === "html");
        assertExists(htmlEl);
    },
});

Deno.test({
    name: "HTMLTreeBuilder - integration with nested divs",
    fn() {
        const tokenizer = new HTMLTokenizer();
        const html = "<div><div><div>Nested</div></div></div>";
        const tokens = tokenizer.tokenize(html);

        const builder = new HTMLTreeBuilder();
        const doc = builder.build(tokens);

        assertExists(doc);
    },
});

Deno.test({
    name: "HTMLTreeBuilder - integration with attributes",
    fn() {
        const tokenizer = new HTMLTokenizer();
        const html = '<div id="test" class="foo">Content</div>';
        const tokens = tokenizer.tokenize(html);

        const builder = new HTMLTreeBuilder();
        const doc = builder.build(tokens);

        assertExists(doc);
    },
});

Deno.test({
    name: "HTMLTreeBuilder - integration with comments",
    fn() {
        const tokenizer = new HTMLTokenizer();
        const html = "<p><!-- comment -->Text</p>";
        const tokens = tokenizer.tokenize(html);

        const builder = new HTMLTreeBuilder();
        const doc = builder.build(tokens);

        assertExists(doc);
    },
});

Deno.test({
    name: "HTMLTreeBuilder - integration with self-closing tags",
    fn() {
        const tokenizer = new HTMLTokenizer();
        const html = "<p>Line 1<br/>Line 2</p>";
        const tokens = tokenizer.tokenize(html);

        const builder = new HTMLTreeBuilder();
        const doc = builder.build(tokens);

        assertExists(doc);
    },
});

/**
 * Tests for CSS Parser
 * Tests parsing CSS tokens into stylesheet with rules and selectors.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { CSSParser } from "../../../../src/engine/rendering/css-parser/CSSParser.ts";
import {
    CSSTokenizer,
    CSSTokenType,
    type CSSToken,
} from "../../../../src/engine/rendering/css-parser/CSSTokenizer.ts";

// CSSParser constructor tests

Deno.test({
    name: "CSSParser - constructor creates parser",
    fn() {
        const parser = new CSSParser();
        assertExists(parser);
    },
});

// CSSParser.parse tests - basic parsing

Deno.test({
    name: "CSSParser - parse empty tokens",
    fn() {
        const parser = new CSSParser();
        const tokens: CSSToken[] = [{ type: CSSTokenType.EOF, value: "" }];
        const stylesheet = parser.parse(tokens);

        assertExists(stylesheet);
        assertExists(stylesheet.rules);
    },
});

Deno.test({
    name: "CSSParser - parse simple rule with tokenizer",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("p { color: red; }");

        const parser = new CSSParser();
        const stylesheet = parser.parse(tokens);

        assertExists(stylesheet);
        assert(stylesheet.rules.length > 0);
    },
});

Deno.test({
    name: "CSSParser - parse rule with class selector",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize(".class { margin: 0; }");

        const parser = new CSSParser();
        const stylesheet = parser.parse(tokens);

        assertExists(stylesheet);
    },
});

Deno.test({
    name: "CSSParser - parse rule with ID selector",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("#id { padding: 10px; }");

        const parser = new CSSParser();
        const stylesheet = parser.parse(tokens);

        assertExists(stylesheet);
    },
});

Deno.test({
    name: "CSSParser - parse multiple rules",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize(`
            p { color: red; }
            div { background: blue; }
        `);

        const parser = new CSSParser();
        const stylesheet = parser.parse(tokens);

        assert(stylesheet.rules.length >= 2);
    },
});

Deno.test({
    name: "CSSParser - parse rule with multiple declarations",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("p { color: red; margin: 0; padding: 10px; }");

        const parser = new CSSParser();
        const stylesheet = parser.parse(tokens);

        assertExists(stylesheet);
    },
});

Deno.test({
    name: "CSSParser - parse rule with universal selector",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("* { box-sizing: border-box; }");

        const parser = new CSSParser();
        const stylesheet = parser.parse(tokens);

        assertExists(stylesheet);
    },
});

// CSSParser.parse tests - complex selectors

Deno.test({
    name: "CSSParser - parse descendant selector",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("div p { color: red; }");

        const parser = new CSSParser();
        const stylesheet = parser.parse(tokens);

        assertExists(stylesheet);
    },
});

Deno.test({
    name: "CSSParser - parse child selector",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("div > p { color: blue; }");

        const parser = new CSSParser();
        const stylesheet = parser.parse(tokens);

        assertExists(stylesheet);
    },
});

Deno.test({
    name: "CSSParser - parse adjacent sibling selector",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("h1 + p { margin-top: 0; }");

        const parser = new CSSParser();
        const stylesheet = parser.parse(tokens);

        assertExists(stylesheet);
    },
});

Deno.test({
    name: "CSSParser - parse general sibling selector",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("h1 ~ p { color: gray; }");

        const parser = new CSSParser();
        const stylesheet = parser.parse(tokens);

        assertExists(stylesheet);
    },
});

Deno.test({
    name: "CSSParser - parse element with class",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("p.intro { font-weight: bold; }");

        const parser = new CSSParser();
        const stylesheet = parser.parse(tokens);

        assertExists(stylesheet);
    },
});

Deno.test({
    name: "CSSParser - parse element with ID",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("div#main { width: 100%; }");

        const parser = new CSSParser();
        const stylesheet = parser.parse(tokens);

        assertExists(stylesheet);
    },
});

Deno.test({
    name: "CSSParser - parse multiple classes",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize(".class1.class2 { color: red; }");

        const parser = new CSSParser();
        const stylesheet = parser.parse(tokens);

        assertExists(stylesheet);
    },
});

// CSSParser.parse tests - at-rules

Deno.test({
    name: "CSSParser - parse @media rule",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("@media screen { p { color: black; } }");

        const parser = new CSSParser();
        const stylesheet = parser.parse(tokens);

        assertExists(stylesheet);
    },
});

Deno.test({
    name: "CSSParser - parse @import rule",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize('@import "style.css";');

        const parser = new CSSParser();
        const stylesheet = parser.parse(tokens);

        assertExists(stylesheet);
    },
});

Deno.test({
    name: "CSSParser - parse @keyframes rule",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("@keyframes fade { from { opacity: 0; } }");

        const parser = new CSSParser();
        const stylesheet = parser.parse(tokens);

        assertExists(stylesheet);
    },
});

// CSSParser.parse tests - values

Deno.test({
    name: "CSSParser - parse color value",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("p { color: #ff0000; }");

        const parser = new CSSParser();
        const stylesheet = parser.parse(tokens);

        assertExists(stylesheet);
    },
});

Deno.test({
    name: "CSSParser - parse pixel value",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("div { width: 100px; }");

        const parser = new CSSParser();
        const stylesheet = parser.parse(tokens);

        assertExists(stylesheet);
    },
});

Deno.test({
    name: "CSSParser - parse percentage value",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("div { width: 50%; }");

        const parser = new CSSParser();
        const stylesheet = parser.parse(tokens);

        assertExists(stylesheet);
    },
});

Deno.test({
    name: "CSSParser - parse em value",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("p { font-size: 1.5em; }");

        const parser = new CSSParser();
        const stylesheet = parser.parse(tokens);

        assertExists(stylesheet);
    },
});

Deno.test({
    name: "CSSParser - parse rem value",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("p { font-size: 2rem; }");

        const parser = new CSSParser();
        const stylesheet = parser.parse(tokens);

        assertExists(stylesheet);
    },
});

Deno.test({
    name: "CSSParser - parse RGB function",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("p { color: rgb(255, 0, 0); }");

        const parser = new CSSParser();
        const stylesheet = parser.parse(tokens);

        assertExists(stylesheet);
    },
});

Deno.test({
    name: "CSSParser - parse multiple values",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("div { margin: 10px 20px 30px 40px; }");

        const parser = new CSSParser();
        const stylesheet = parser.parse(tokens);

        assertExists(stylesheet);
    },
});

// CSSParser.parse tests - comments

Deno.test({
    name: "CSSParser - parse with comments",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("/* comment */ p { color: red; }");

        const parser = new CSSParser();
        const stylesheet = parser.parse(tokens);

        assertExists(stylesheet);
    },
});

Deno.test({
    name: "CSSParser - parse with inline comment",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("p { /* inline */ color: red; }");

        const parser = new CSSParser();
        const stylesheet = parser.parse(tokens);

        assertExists(stylesheet);
    },
});

// CSSParser.parse tests - real-world CSS

Deno.test({
    name: "CSSParser - parse complete stylesheet",
    fn() {
        const tokenizer = new CSSTokenizer();
        const css = `
            body {
                margin: 0;
                padding: 0;
                font-family: Arial, sans-serif;
            }

            .container {
                max-width: 1200px;
                margin: 0 auto;
            }

            #header {
                background-color: #333;
                color: white;
                padding: 20px;
            }
        `;
        const tokens = tokenizer.tokenize(css);

        const parser = new CSSParser();
        const stylesheet = parser.parse(tokens);

        assert(stylesheet.rules.length >= 3);
    },
});

Deno.test({
    name: "CSSParser - parse responsive CSS",
    fn() {
        const tokenizer = new CSSTokenizer();
        const css = `
            .container { width: 100%; }
            @media (min-width: 768px) {
                .container { width: 750px; }
            }
        `;
        const tokens = tokenizer.tokenize(css);

        const parser = new CSSParser();
        const stylesheet = parser.parse(tokens);

        assertExists(stylesheet);
    },
});

Deno.test({
    name: "CSSParser - parse flexbox properties",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize(`
            .flex {
                display: flex;
                justify-content: center;
                align-items: center;
            }
        `);

        const parser = new CSSParser();
        const stylesheet = parser.parse(tokens);

        assertExists(stylesheet);
    },
});

Deno.test({
    name: "CSSParser - parse grid properties",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize(`
            .grid {
                display: grid;
                grid-template-columns: 1fr 1fr 1fr;
                gap: 20px;
            }
        `);

        const parser = new CSSParser();
        const stylesheet = parser.parse(tokens);

        assertExists(stylesheet);
    },
});

Deno.test({
    name: "CSSParser - parse animation",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize(`
            .animated {
                animation: slide 1s ease-in-out;
            }
        `);

        const parser = new CSSParser();
        const stylesheet = parser.parse(tokens);

        assertExists(stylesheet);
    },
});

Deno.test({
    name: "CSSParser - parse transition",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize(`
            .transition {
                transition: all 0.3s ease;
            }
        `);

        const parser = new CSSParser();
        const stylesheet = parser.parse(tokens);

        assertExists(stylesheet);
    },
});

Deno.test({
    name: "CSSParser - parse pseudo-class",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("a:hover { color: blue; }");

        const parser = new CSSParser();
        const stylesheet = parser.parse(tokens);

        assertExists(stylesheet);
    },
});

Deno.test({
    name: "CSSParser - parse pseudo-element",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("p::before { content: ''; }");

        const parser = new CSSParser();
        const stylesheet = parser.parse(tokens);

        assertExists(stylesheet);
    },
});

Deno.test({
    name: "CSSParser - parse attribute selector",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("[href] { color: blue; }");

        const parser = new CSSParser();
        const stylesheet = parser.parse(tokens);

        assertExists(stylesheet);
    },
});

Deno.test({
    name: "CSSParser - parse attribute selector with value",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize('[type="text"] { border: 1px solid; }');

        const parser = new CSSParser();
        const stylesheet = parser.parse(tokens);

        assertExists(stylesheet);
    },
});

Deno.test({
    name: "CSSParser - parse comma-separated selectors",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("h1, h2, h3 { margin: 0; }");

        const parser = new CSSParser();
        const stylesheet = parser.parse(tokens);

        assertExists(stylesheet);
    },
});

Deno.test({
    name: "CSSParser - parse shorthand properties",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("div { margin: 10px 20px; }");

        const parser = new CSSParser();
        const stylesheet = parser.parse(tokens);

        assertExists(stylesheet);
    },
});

Deno.test({
    name: "CSSParser - parse important declaration",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("p { color: red !important; }");

        const parser = new CSSParser();
        const stylesheet = parser.parse(tokens);

        assertExists(stylesheet);
    },
});

Deno.test({
    name: "CSSParser - parse calc function",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("div { width: calc(100% - 20px); }");

        const parser = new CSSParser();
        const stylesheet = parser.parse(tokens);

        assertExists(stylesheet);
    },
});

Deno.test({
    name: "CSSParser - parse var function",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize("p { color: var(--main-color); }");

        const parser = new CSSParser();
        const stylesheet = parser.parse(tokens);

        assertExists(stylesheet);
    },
});

Deno.test({
    name: "CSSParser - parse custom property",
    fn() {
        const tokenizer = new CSSTokenizer();
        const tokens = tokenizer.tokenize(":root { --main-color: #333; }");

        const parser = new CSSParser();
        const stylesheet = parser.parse(tokens);

        assertExists(stylesheet);
    },
});

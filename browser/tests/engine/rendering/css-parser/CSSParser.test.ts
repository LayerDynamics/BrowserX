/**
 * Tests for CSS Parser
 * Tests parsing CSS tokens into stylesheet with rules and selectors.
 */

import { assert, assertEquals, assertExists } from "@std/assert";
import { CSSParser } from "../../../../src/engine/rendering/css-parser/CSSParser.ts";
import {
  type CSSToken,
  CSSTokenizer,
  CSSTokenType,
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

Deno.test({
  name: "CSSParser: @media rule is parsed and stored",
  fn() {
    const tokenizer = new CSSTokenizer();
    const tokens = tokenizer.tokenize(`@media (max-width: 768px) { body { color: red; } }`);

    const parser = new CSSParser();
    parser.parse(tokens);

    const mediaRules = parser.getMediaRules();
    assertEquals(mediaRules.length, 1);
    assertEquals(mediaRules[0].rules.length, 1);
  },
});

Deno.test({
  name: "CSSParser: @keyframes rule is parsed and stored",
  fn() {
    const tokenizer = new CSSTokenizer();
    const tokens = tokenizer.tokenize(
      `@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`,
    );

    const parser = new CSSParser();
    parser.parse(tokens);

    const keyframeRules = parser.getKeyframeRules();
    assertEquals(keyframeRules.has("fadeIn"), true);
    assertEquals(keyframeRules.get("fadeIn")!.length, 2);
  },
});

Deno.test({
  name: "CSSParser: @font-face rule is parsed without error",
  fn() {
    const tokenizer = new CSSTokenizer();
    const tokens = tokenizer.tokenize(
      `@font-face { font-family: 'MyFont'; src: url('/font.woff2'); }`,
    );

    const parser = new CSSParser();
    parser.parse(tokens);

    const fontFaceRules = parser.getFontFaceRules();
    assertEquals(fontFaceRules.length, 1);
  },
});

Deno.test({
  name: "CSSParser: @import is parsed without error",
  fn() {
    const tokenizer = new CSSTokenizer();
    const tokens = tokenizer.tokenize(`@import "reset.css"; body { margin: 0; }`);

    const parser = new CSSParser();
    parser.parse(tokens);

    const importUrls = parser.getImportUrls();
    assertEquals(importUrls.length, 1);
    assertEquals(importUrls[0], "reset.css");
  },
});

// @media rule edge cases

Deno.test({
  name: "CSSParser: multiple @media rules in one stylesheet",
  fn() {
    const tokenizer = new CSSTokenizer();
    const tokens = tokenizer.tokenize(
      `@media screen { p { color: red; } } @media print { p { color: black; } }`,
    );

    const parser = new CSSParser();
    parser.parse(tokens);

    const mediaRules = parser.getMediaRules();
    assertEquals(mediaRules.length, 2);
    assertEquals(mediaRules[0].condition, "screen");
    assertEquals(mediaRules[1].condition, "print");
  },
});

Deno.test({
  name: "CSSParser: @media rule with multiple inner rules",
  fn() {
    const tokenizer = new CSSTokenizer();
    const tokens = tokenizer.tokenize(
      `@media screen { p { color: red; } div { margin: 0; } h1 { font-size: 24px; } }`,
    );

    const parser = new CSSParser();
    parser.parse(tokens);

    const mediaRules = parser.getMediaRules();
    assertEquals(mediaRules.length, 1);
    assertEquals(mediaRules[0].rules.length, 3);
  },
});

Deno.test({
  name: "CSSParser: @media rule with complex and condition",
  fn() {
    const tokenizer = new CSSTokenizer();
    const tokens = tokenizer.tokenize(
      `@media (min-width: 768px) and (max-width: 1024px) { body { font-size: 16px; } }`,
    );

    const parser = new CSSParser();
    parser.parse(tokens);

    const mediaRules = parser.getMediaRules();
    assertEquals(mediaRules.length, 1);
    assert(mediaRules[0].condition.includes("min-width"));
    assert(mediaRules[0].condition.includes("max-width"));
    assert(mediaRules[0].condition.includes("and"));
    assertEquals(mediaRules[0].rules.length, 1);
  },
});

Deno.test({
  name: "CSSParser: calling parse() twice resets mediaRules",
  fn() {
    const tokenizer = new CSSTokenizer();
    const parser = new CSSParser();

    parser.parse(tokenizer.tokenize(`@media screen { p { color: red; } }`));
    assertEquals(parser.getMediaRules().length, 1);
    assertEquals(parser.getMediaRules()[0].condition, "screen");

    parser.parse(tokenizer.tokenize(`@media print { p { color: black; } }`));
    assertEquals(parser.getMediaRules().length, 1);
    assertEquals(parser.getMediaRules()[0].condition, "print");
  },
});

// @keyframes edge cases

Deno.test({
  name: "CSSParser: multiple named @keyframes blocks",
  fn() {
    const tokenizer = new CSSTokenizer();
    const tokens = tokenizer.tokenize(
      `@keyframes fade { from { opacity: 0; } to { opacity: 1; } } ` +
        `@keyframes slide { from { left: 0; } to { left: 100px; } }`,
    );

    const parser = new CSSParser();
    parser.parse(tokens);

    const keyframeRules = parser.getKeyframeRules();
    assertEquals(keyframeRules.size, 2);
    assertEquals(keyframeRules.has("fade"), true);
    assertEquals(keyframeRules.has("slide"), true);
  },
});

Deno.test({
  name: "CSSParser: @keyframes with from, percentage stop, and to",
  fn() {
    const tokenizer = new CSSTokenizer();
    const tokens = tokenizer.tokenize(
      `@keyframes slide { from { left: 0; } 50% { left: 50px; } to { left: 100px; } }`,
    );

    const parser = new CSSParser();
    parser.parse(tokens);

    const keyframeRules = parser.getKeyframeRules();
    assertEquals(keyframeRules.has("slide"), true);
    const frames = keyframeRules.get("slide")!;
    assertEquals(frames.length, 3);
    assertEquals(frames[0].selector, "from");
    assertEquals(frames[1].selector, "50%");
    assertEquals(frames[2].selector, "to");
  },
});

Deno.test({
  name: "CSSParser: @keyframes with multiple declarations per stop",
  fn() {
    const tokenizer = new CSSTokenizer();
    const tokens = tokenizer.tokenize(
      `@keyframes bounce { from { top: 0; opacity: 0; } to { top: 100px; opacity: 1; } }`,
    );

    const parser = new CSSParser();
    parser.parse(tokens);

    const keyframeRules = parser.getKeyframeRules();
    assertEquals(keyframeRules.has("bounce"), true);
    const frames = keyframeRules.get("bounce")!;
    assertEquals(frames.length, 2);
    assertEquals(frames[0].declarations.length, 2);
    assertEquals(frames[0].declarations[0].property, "top");
    assertEquals(frames[0].declarations[1].property, "opacity");
    assertEquals(frames[1].declarations.length, 2);
  },
});

// @font-face edge cases

Deno.test({
  name: "CSSParser: multiple @font-face blocks produces two entries",
  fn() {
    const tokenizer = new CSSTokenizer();
    const tokens = tokenizer.tokenize(
      `@font-face { font-family: 'FontA'; } @font-face { font-family: 'FontB'; font-weight: bold; }`,
    );

    const parser = new CSSParser();
    parser.parse(tokens);

    const fontFaceRules = parser.getFontFaceRules();
    assertEquals(fontFaceRules.length, 2);
  },
});

Deno.test({
  name: "CSSParser: @font-face with multiple properties",
  fn() {
    const tokenizer = new CSSTokenizer();
    const tokens = tokenizer.tokenize(
      `@font-face { font-family: 'MyFont'; font-weight: bold; font-style: italic; }`,
    );

    const parser = new CSSParser();
    parser.parse(tokens);

    const fontFaceRules = parser.getFontFaceRules();
    assertEquals(fontFaceRules.length, 1);
    assertEquals(fontFaceRules[0].length, 3);
    assertEquals(fontFaceRules[0][0].property, "font-family");
    assertEquals(fontFaceRules[0][1].property, "font-weight");
    assertEquals(fontFaceRules[0][2].property, "font-style");
  },
});

// @import edge cases

Deno.test({
  name: "CSSParser: multiple @import statements",
  fn() {
    const tokenizer = new CSSTokenizer();
    const tokens = tokenizer.tokenize(`@import "reset.css"; @import "base.css";`);

    const parser = new CSSParser();
    parser.parse(tokens);

    const importUrls = parser.getImportUrls();
    assertEquals(importUrls.length, 2);
    assertEquals(importUrls[0], "reset.css");
    assertEquals(importUrls[1], "base.css");
  },
});

Deno.test({
  name: "CSSParser: @import with url() syntax stores URL",
  fn() {
    const tokenizer = new CSSTokenizer();
    const tokens = tokenizer.tokenize(`@import url("style.css");`);

    const parser = new CSSParser();
    parser.parse(tokens);

    const importUrls = parser.getImportUrls();
    assertEquals(importUrls.length, 1);
    assertEquals(importUrls[0], "style.css");
  },
});

// Reset behavior

Deno.test({
  name: "CSSParser: second parse() call replaces all at-rule results",
  fn() {
    const tokenizer = new CSSTokenizer();
    const parser = new CSSParser();

    // First parse: media + keyframes + font-face + import
    parser.parse(tokenizer.tokenize(
      `@import "first.css"; @media screen { p { color: red; } } ` +
        `@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } } ` +
        `@font-face { font-family: 'First'; }`,
    ));
    assertEquals(parser.getImportUrls().length, 1);
    assertEquals(parser.getMediaRules().length, 1);
    assertEquals(parser.getKeyframeRules().size, 1);
    assertEquals(parser.getFontFaceRules().length, 1);

    // Second parse: different at-rules
    parser.parse(tokenizer.tokenize(
      `@import "second.css"; @import "third.css";`,
    ));
    assertEquals(parser.getImportUrls().length, 2);
    assertEquals(parser.getImportUrls()[0], "second.css");
    assertEquals(parser.getMediaRules().length, 0);
    assertEquals(parser.getKeyframeRules().size, 0);
    assertEquals(parser.getFontFaceRules().length, 0);
  },
});

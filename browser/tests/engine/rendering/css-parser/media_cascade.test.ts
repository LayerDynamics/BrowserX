import { assertEquals } from "@std/assert";
import { CSSTokenizer } from "../../../../src/engine/rendering/css-parser/CSSTokenizer.ts";
import { CSSParser } from "../../../../src/engine/rendering/css-parser/CSSParser.ts";
import { CSSOM, StyleSheetOrigin } from "../../../../src/engine/rendering/css-parser/CSSOM.ts";
import { StyleResolver } from "../../../../src/engine/rendering/css-parser/StyleResolver.ts";
import type { DOMElement } from "../../../../src/types/dom.ts";

function parseSheet(css: string) {
  const tokenizer = new CSSTokenizer();
  const tokens = tokenizer.tokenize(css);
  const parser = new CSSParser();
  return parser.parse(tokens);
}

function makeElement(tag: string, id?: string, classes?: string[]): DOMElement {
  const attributes = new Map<string, string>();
  if (id) attributes.set("id", id);
  if (classes) attributes.set("class", classes.join(" "));
  return {
    nodeType: 1,
    nodeName: tag.toUpperCase(),
    tagName: tag.toUpperCase(),
    attributes,
    children: [],
    parentElement: null,
  } as unknown as DOMElement;
}

Deno.test("@media rules included in cascade when viewport matches", () => {
  const sheet = parseSheet(`
    body { color: black; }
    @media (min-width: 768px) {
      body { color: blue; }
    }
  `);

  const cssom = new CSSOM();
  cssom.setViewport(1024, 768);
  cssom.addStyleSheet(sheet, StyleSheetOrigin.AUTHOR);

  const resolver = new StyleResolver(cssom);
  const element = makeElement("body");
  const style = resolver.resolve(element);

  // @media matches at 1024px width, so blue should win (later in source order)
  assertEquals(style.getPropertyValue("color"), "blue");
});

Deno.test("@media rules excluded from cascade when viewport doesn't match", () => {
  const sheet = parseSheet(`
    body { color: black; }
    @media (min-width: 768px) {
      body { color: blue; }
    }
  `);

  const cssom = new CSSOM();
  cssom.setViewport(320, 480);
  cssom.addStyleSheet(sheet, StyleSheetOrigin.AUTHOR);

  const resolver = new StyleResolver(cssom);
  const element = makeElement("body");
  const style = resolver.resolve(element);

  assertEquals(style.getPropertyValue("color"), "black");
});

Deno.test("@media max-width excludes styles above breakpoint", () => {
  const sheet = parseSheet(`
    body { font-size: 16px; }
    @media (max-width: 600px) {
      body { font-size: 14px; }
    }
  `);

  const cssom = new CSSOM();
  cssom.setViewport(800, 600);
  cssom.addStyleSheet(sheet, StyleSheetOrigin.AUTHOR);

  const resolver = new StyleResolver(cssom);
  const element = makeElement("body");
  const style = resolver.resolve(element);

  assertEquals(style.getPropertyValue("font-size"), "16px");
});

Deno.test("@media max-width includes styles below breakpoint", () => {
  const sheet = parseSheet(`
    body { font-size: 16px; }
    @media (max-width: 600px) {
      body { font-size: 14px; }
    }
  `);

  const cssom = new CSSOM();
  cssom.setViewport(480, 320);
  cssom.addStyleSheet(sheet, StyleSheetOrigin.AUTHOR);

  const resolver = new StyleResolver(cssom);
  const element = makeElement("body");
  const style = resolver.resolve(element);

  assertEquals(style.getPropertyValue("font-size"), "14px");
});

Deno.test("@media rules with class selectors work", () => {
  const sheet = parseSheet(`
    .card { background-color: white; }
    @media (min-width: 1024px) {
      .card { background-color: lightgray; }
    }
  `);

  const cssom = new CSSOM();
  cssom.setViewport(1280, 720);
  cssom.addStyleSheet(sheet, StyleSheetOrigin.AUTHOR);

  const resolver = new StyleResolver(cssom);
  const element = makeElement("div", undefined, ["card"]);
  const style = resolver.resolve(element);

  assertEquals(style.getPropertyValue("background-color"), "lightgray");
});

Deno.test("mediaRules stored on stylesheet", () => {
  const sheet = parseSheet(`
    body { margin: 0; }
    @media screen and (min-width: 768px) {
      body { padding: 20px; }
    }
  `);

  assertEquals(sheet.mediaRules.length, 1);
  // Parser preserves whitespace inside condition — just check it contains the key parts
  assertEquals(sheet.mediaRules[0].condition.includes("min-width"), true);
  assertEquals(sheet.mediaRules[0].rules.length, 1);
});

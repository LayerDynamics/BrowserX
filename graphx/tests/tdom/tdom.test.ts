import { assertEquals, assert } from "@std/assert";
import { TDomNode, TDomRenderer } from "../../src/tdom/mod.ts";

Deno.test("TDomNode.text - creates text node and renders", () => {
  const node = TDomNode.text("hello");
  const lines = node.render();
  assertEquals(lines, ["hello"]);
  assertEquals(node.getWidth(), 5);
  assertEquals(node.getHeight(), 1);
});

Deno.test("TDomNode.box - single border", () => {
  const node = TDomNode.box([TDomNode.text("hi")], { border: "single" });
  const lines = node.render();
  assertEquals(lines[0], "┌──┐");
  assertEquals(lines[1], "│hi│");
  assertEquals(lines[2], "└──┘");
  assertEquals(lines.length, 3);
});

Deno.test("TDomNode.box - double border", () => {
  const node = TDomNode.box([TDomNode.text("ok")], { border: "double" });
  const lines = node.render();
  assertEquals(lines[0], "╔══╗");
  assertEquals(lines[1], "║ok║");
  assertEquals(lines[2], "╚══╝");
});

Deno.test("TDomNode.box - rounded border", () => {
  const node = TDomNode.box([TDomNode.text("yo")], { border: "rounded" });
  const lines = node.render();
  assertEquals(lines[0], "╭──╮");
  assertEquals(lines[1], "│yo│");
  assertEquals(lines[2], "╰──╯");
});

Deno.test("TDomNode.row - children side by side", () => {
  const node = TDomNode.row([TDomNode.text("AB"), TDomNode.text("CD")]);
  const lines = node.render();
  assertEquals(lines.length, 1);
  assertEquals(lines[0], "ABCD");
});

Deno.test("TDomNode.column - children stacked", () => {
  const node = TDomNode.column([TDomNode.text("AB"), TDomNode.text("CD")]);
  const lines = node.render();
  assertEquals(lines.length, 2);
  assertEquals(lines[0], "AB");
  assertEquals(lines[1], "CD");
});

Deno.test("ANSI color styling applied", () => {
  const node = TDomNode.text("red", { fg: "red", bold: true });
  const lines = node.render();
  assert(lines[0].includes("\x1b["));
  assert(lines[0].includes("1;31"));
  assert(lines[0].includes("\x1b[0m"));
});

Deno.test("Nested nodes - box containing row of texts", () => {
  const row = TDomNode.row([TDomNode.text("A"), TDomNode.text("B")]);
  const box = TDomNode.box([row], { border: "single" });
  const lines = box.render();
  assertEquals(lines[0], "┌──┐");
  assertEquals(lines[1], "│AB│");
  assertEquals(lines[2], "└──┘");
});

Deno.test("TDomRenderer.render - returns multi-line string", () => {
  const renderer = new TDomRenderer();
  const node = TDomNode.column([TDomNode.text("line1"), TDomNode.text("line2")]);
  const result = renderer.render(node);
  assertEquals(result, "line1\nline2");
});

Deno.test("TDomRenderer with color=false strips ANSI", () => {
  const renderer = new TDomRenderer();
  const node = TDomNode.text("hello", { fg: "green" });
  const withColor = renderer.render(node);
  assert(withColor.includes("\x1b["));
  const noColor = renderer.render(node, { color: false });
  assertEquals(noColor, "hello");
});

Deno.test("Padding support", () => {
  const node = TDomNode.box([TDomNode.text("X")], { border: "single", padding: 1 });
  const lines = node.render();
  // padding=1: 1 space each side around "X" = "   " (3 wide content area)
  // Then border wraps that
  assertEquals(lines.length, 5); // border top + pad top + content + pad bottom + border bottom
  assertEquals(lines[0], "┌───┐");
  assertEquals(lines[1], "│   │");
  assertEquals(lines[2], "│ X │");
  assertEquals(lines[3], "│   │");
  assertEquals(lines[4], "└───┘");
});

Deno.test("maxWidth truncation", () => {
  const node = TDomNode.text("abcdefghij");
  const lines = node.render(5);
  assertEquals(lines[0], "abcde");
});

Deno.test("getWidth and getHeight accuracy", () => {
  const node = TDomNode.box(
    [TDomNode.text("hello"), TDomNode.text("world!")],
    { border: "single" },
  );
  // Column layout: max child width = 6 ("world!"), + 2 border = 8
  assertEquals(node.getWidth(), 8);
  // Column layout: 2 children = 2 lines + 2 border = 4
  assertEquals(node.getHeight(), 4);
});

Deno.test("Row layout with different heights", () => {
  const col = TDomNode.column([TDomNode.text("A"), TDomNode.text("B")]);
  const single = TDomNode.text("X");
  const row = TDomNode.row([col, single]);
  const lines = row.render();
  assertEquals(lines.length, 2);
  assertEquals(lines[0], "AX");
  // second row: col has "B", single has nothing -> padded
  assertEquals(lines[1], "B ");
});

Deno.test("Column layout pads shorter lines to max width", () => {
  const node = TDomNode.column([TDomNode.text("AB"), TDomNode.text("CDEF")]);
  const lines = node.render();
  assertEquals(lines[0], "AB  ");
  assertEquals(lines[1], "CDEF");
});

Deno.test("dim styling", () => {
  const node = TDomNode.text("dim", { dim: true });
  const lines = node.render();
  assert(lines[0].includes("\x1b[2m"));
});

Deno.test("bg color styling", () => {
  const node = TDomNode.text("bg", { bg: "blue" });
  const lines = node.render();
  assert(lines[0].includes("\x1b[44m"));
});

import { assertEquals, assertRejects } from "@std/assert";
import { Window } from "../../../src/os/window/Window.ts";
import { WindowContext } from "../../../src/os/window/WindowContext.ts";

Deno.test("Window - open/close lifecycle", async () => {
  const win = new Window({ title: "Test", width: 800, height: 600 });
  assertEquals(win.isOpen(), false);
  await win.open();
  assertEquals(win.isOpen(), true);
  win.close();
  assertEquals(win.isOpen(), false);
});

Deno.test("Window - open is idempotent", async () => {
  const win = new Window({ title: "Test", width: 800, height: 600 });
  await win.open();
  await win.open(); // should not throw
  assertEquals(win.isOpen(), true);
  win.close();
});

Deno.test("Window - getDimensions returns config values", async () => {
  const win = new Window({ title: "Test", width: 1024, height: 768 });
  await win.open();
  const dims = win.getDimensions();
  assertEquals(dims.width, 1024);
  assertEquals(dims.height, 768);
  win.close();
});

Deno.test("Window - resize updates dimensions", async () => {
  const win = new Window({ title: "Test", width: 800, height: 600 });
  await win.open();
  win.resize(1920, 1080);
  assertEquals(win.getDimensions(), { width: 1920, height: 1080 });
  win.close();
});

Deno.test("Window - getTitle and setTitle", () => {
  const win = new Window({ title: "Original", width: 800, height: 600 });
  assertEquals(win.getTitle(), "Original");
  win.setTitle("Updated");
  assertEquals(win.getTitle(), "Updated");
});

Deno.test("Window - headless mode when pixpane unavailable", async () => {
  const win = new Window({ title: "Test", width: 800, height: 600 });
  await win.open();
  // In test environment, pixpane FFI is not available
  assertEquals(win.isHeadlessMode(), true);
  win.close();
});

Deno.test("WindowContext - throws if window not open", async () => {
  const win = new Window({ title: "Test", width: 800, height: 600 });
  const ctx = new WindowContext(win);
  await assertRejects(
    () => ctx.initialize(),
    Error,
    "window is not open",
  );
});

Deno.test("WindowContext - initialize/destroy lifecycle", async () => {
  const win = new Window({ title: "Test", width: 800, height: 600 });
  await win.open();
  const ctx = new WindowContext(win, { vsync: true, msaa: 4 });
  assertEquals(ctx.isActive(), false);
  await ctx.initialize();
  assertEquals(ctx.isActive(), true);
  assertEquals(ctx.getWindow(), win);
  ctx.destroy();
  assertEquals(ctx.isActive(), false);
  win.close();
});

Deno.test("WindowContext - present is no-op in headless mode", async () => {
  const win = new Window({ title: "Test", width: 800, height: 600 });
  await win.open();
  const ctx = new WindowContext(win);
  await ctx.initialize();
  ctx.present(); // should not throw
  ctx.destroy();
  win.close();
});

Deno.test("Window - getWindowId is 0n in headless mode", async () => {
  const win = new Window({ title: "Test", width: 800, height: 600 });
  await win.open();
  assertEquals(win.getWindowId(), 0n);
  win.close();
});

Deno.test("Window - getPixpane is null in headless mode", async () => {
  const win = new Window({ title: "Test", width: 800, height: 600 });
  await win.open();
  assertEquals(win.getPixpane(), null);
  win.close();
});

Deno.test("Window - pollEvents returns empty in headless", async () => {
  const win = new Window({ title: "Test", width: 800, height: 600 });
  await win.open();
  const events = await win.pollEvents();
  assertEquals(events.length, 0);
  win.close();
});

Deno.test("WindowContext - present with pixels in headless increments frameCount", async () => {
  const win = new Window({ title: "Test", width: 4, height: 4 });
  await win.open();
  const ctx = new WindowContext(win);
  await ctx.initialize();
  const pixels = new Uint8ClampedArray(4 * 4 * 4);
  ctx.present(pixels, 4, 4);
  ctx.present(pixels, 4, 4);
  assertEquals(ctx.getFrameCount(), 2);
  ctx.destroy();
  win.close();
});

Deno.test("WindowContext - getConfig returns copy", async () => {
  const win = new Window({ title: "Test", width: 800, height: 600 });
  await win.open();
  const ctx = new WindowContext(win, { vsync: false, msaa: 8 });
  await ctx.initialize();
  const cfg = ctx.getConfig();
  assertEquals(cfg.vsync, false);
  assertEquals(cfg.msaa, 8);
  ctx.destroy();
  win.close();
});

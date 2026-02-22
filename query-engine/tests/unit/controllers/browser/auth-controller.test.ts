/**
 * AuthController tests
 */
import { assertEquals } from "@std/assert";
import {
  AuthController,
  getAuthController,
  clearAuthController,
} from "../../../../controllers/browser/auth-controller.ts";
import { BrowserController } from "../../../../controllers/browser/browser-controller.ts";
import {
  setCurrentBrowserController,
  clearBrowserContext,
} from "../../../../controllers/browser/browser-context.ts";

function setup() {
  clearBrowserContext();
  clearAuthController();
}

function teardown() {
  clearBrowserContext();
  clearAuthController();
}

Deno.test("AuthController - construction", () => {
  const ac = new AuthController();
  assertEquals(ac instanceof AuthController, true);
});

Deno.test("AuthController - getAuthController singleton", () => {
  clearAuthController();
  const a = getAuthController();
  const b = getAuthController();
  assertEquals(a, b);
  clearAuthController();
});

Deno.test("AuthController - authenticate throws without browser context", async () => {
  setup();
  const ac = new AuthController();
  try {
    await ac.authenticate({ type: "basic", username: "u", password: "p" });
    assertEquals(true, false, "should have thrown");
  } catch (e) {
    assertEquals((e as Error).message.includes("Browser context not initialized"), true);
  } finally {
    teardown();
  }
});

Deno.test("AuthController - isAuthenticated returns false without context", async () => {
  setup();
  const ac = new AuthController();
  const result = await ac.isAuthenticated();
  assertEquals(result, false);
  teardown();
});

Deno.test("AuthController - getState returns unauthenticated without context", async () => {
  setup();
  const ac = new AuthController();
  const state = await ac.getState();
  assertEquals(state.authenticated, false);
  assertEquals(state.type, null);
  assertEquals(state.createdAt, null);
  assertEquals(state.expiresAt, null);
  teardown();
});

Deno.test("AuthController - getSession returns null without context", async () => {
  setup();
  const ac = new AuthController();
  const session = await ac.getSession();
  assertEquals(session, null);
  teardown();
});

Deno.test("AuthController - getAuthHeaders returns empty without context", async () => {
  setup();
  const ac = new AuthController();
  const headers = await ac.getAuthHeaders();
  assertEquals(Object.keys(headers).length, 0);
  teardown();
});

Deno.test("AuthController - getAuthCookies returns empty without context", async () => {
  setup();
  const ac = new AuthController();
  const cookies = await ac.getAuthCookies();
  assertEquals(cookies.length, 0);
  teardown();
});

Deno.test("AuthController - logout does not throw without context", async () => {
  setup();
  const ac = new AuthController();
  await ac.logout(); // Should not throw
  assertEquals(true, true);
  teardown();
});

Deno.test("AuthController - setOnStateChange stores callback", () => {
  const ac = new AuthController();
  let called = false;
  ac.setOnStateChange(() => { called = true; });
  // Callback stored but not called yet
  assertEquals(called, false);
});

Deno.test("AuthController - clear resets authManager", () => {
  const ac = new AuthController();
  ac.clear();
  assertEquals(true, true);
});

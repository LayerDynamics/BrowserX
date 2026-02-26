import "./setup.ts";
import { assertEquals, assertThrows, assert } from "@std/assert";
import { Permission } from "@browserx/query-engine";
import { PermissionGuard, PermissionEvent } from "../../security/permission-guard.ts";

Deno.test("PermissionGuard - READONLY allows read tools", () => {
  const guard = new PermissionGuard("READONLY");
  // These should not throw - READONLY has NAVIGATE_PUBLIC, DOM_QUERY, CACHE_RESPONSES
  guard.checkToolPermission("browser_navigate");
  guard.checkToolPermission("browser_query_dom");
  guard.checkToolPermission("proxy_cache_get");
});

Deno.test("PermissionGuard - READONLY blocks screenshot and pdf", () => {
  const guard = new PermissionGuard("READONLY");
  assertThrows(() => guard.checkToolPermission("browser_screenshot"), Error, "Permission denied");
  assertThrows(() => guard.checkToolPermission("browser_pdf"), Error, "Permission denied");
});

Deno.test("PermissionGuard - READONLY blocks write/automation tools", () => {
  const guard = new PermissionGuard("READONLY");
  assertThrows(() => guard.checkToolPermission("browser_click"), Error, "Permission denied");
  assertThrows(() => guard.checkToolPermission("browser_type"), Error, "Permission denied");
  assertThrows(() => guard.checkToolPermission("browser_evaluate"), Error, "Permission denied");
  assertThrows(() => guard.checkToolPermission("browser_pdf"), Error, "Permission denied");
});

Deno.test("PermissionGuard - READONLY blocks proxy interceptors", () => {
  const guard = new PermissionGuard("READONLY");
  assertThrows(() => guard.checkToolPermission("proxy_add_interceptor"), Error, "Permission denied");
  assertThrows(() => guard.checkToolPermission("proxy_remove_interceptor"), Error, "Permission denied");
});

Deno.test("PermissionGuard - AUTOMATION allows automation tools", () => {
  const guard = new PermissionGuard("AUTOMATION");
  guard.checkToolPermission("browser_navigate");
  guard.checkToolPermission("browser_click");
  guard.checkToolPermission("browser_type");
  guard.checkToolPermission("browser_screenshot");
  guard.checkToolPermission("browser_pdf");
  guard.checkToolPermission("browser_query_dom");
});

Deno.test("PermissionGuard - AUTOMATION blocks JS execution and interceptors", () => {
  const guard = new PermissionGuard("AUTOMATION");
  assertThrows(() => guard.checkToolPermission("browser_evaluate"), Error, "EXECUTE_JS");
  assertThrows(() => guard.checkToolPermission("proxy_add_interceptor"), Error, "INTERCEPT_TRAFFIC");
});

Deno.test("PermissionGuard - FULL allows everything", () => {
  const guard = new PermissionGuard("FULL");
  guard.checkToolPermission("browser_navigate");
  guard.checkToolPermission("browser_click");
  guard.checkToolPermission("browser_type");
  guard.checkToolPermission("browser_screenshot");
  guard.checkToolPermission("browser_pdf");
  guard.checkToolPermission("browser_evaluate");
  guard.checkToolPermission("browser_query_dom");
  guard.checkToolPermission("proxy_add_interceptor");
  guard.checkToolPermission("proxy_remove_interceptor");
  guard.checkToolPermission("proxy_cache_get");
  guard.checkToolPermission("proxy_cache_set");
  guard.checkToolPermission("proxy_cache_clear");
});

Deno.test("PermissionGuard - unknown tool denied by default", () => {
  const guard = new PermissionGuard("FULL");
  assertThrows(() => guard.checkToolPermission("unknown_tool"), Error, "Unknown tool");
});

Deno.test("PermissionGuard - unknown tool allowed when configured", () => {
  const guard = new PermissionGuard("FULL", { allowUnknownTools: true });
  // Should not throw
  guard.checkToolPermission("unknown_tool");
});

Deno.test("PermissionGuard - query tools require no permissions", () => {
  const guard = new PermissionGuard("READONLY");
  guard.checkToolPermission("browserx_query");
  guard.checkToolPermission("browserx_query_explain");
  guard.checkToolPermission("browserx_query_async");
  guard.checkToolPermission("browserx_query_status");
  guard.checkToolPermission("browserx_query_cancel");
});

Deno.test("PermissionGuard - no-permission tools always pass", () => {
  const guard = new PermissionGuard("READONLY");
  guard.checkToolPermission("browser_wait");
  guard.checkToolPermission("browser_close_session");
  guard.checkToolPermission("browser_list_sessions");
});

Deno.test("PermissionGuard - hasPermission checks individual permission", () => {
  const guard = new PermissionGuard("READONLY");
  assert(guard.hasPermission(Permission.NAVIGATE_PUBLIC));
  assert(guard.hasPermission(Permission.DOM_QUERY));
  assert(!guard.hasPermission(Permission.EXECUTE_JS));
  assert(!guard.hasPermission(Permission.CLICK));
});

Deno.test("PermissionGuard - hasAllPermissions", () => {
  const guard = new PermissionGuard("AUTOMATION");
  assert(guard.hasAllPermissions([Permission.CLICK, Permission.TYPE, Permission.SCREENSHOT]));
  assert(!guard.hasAllPermissions([Permission.CLICK, Permission.EXECUTE_JS]));
});

Deno.test("PermissionGuard - hasAnyPermission", () => {
  const guard = new PermissionGuard("READONLY");
  assert(guard.hasAnyPermission([Permission.EXECUTE_JS, Permission.DOM_QUERY]));
  assert(!guard.hasAnyPermission([Permission.EXECUTE_JS, Permission.CLICK]));
});

Deno.test("PermissionGuard - getGrantedPermissions returns correct set", () => {
  const guard = new PermissionGuard("READONLY");
  const perms = guard.getGrantedPermissions();
  assert(perms.includes(Permission.NAVIGATE_PUBLIC));
  assert(perms.includes(Permission.DOM_QUERY));
  assert(!perms.includes(Permission.EXECUTE_JS));
});

Deno.test("PermissionGuard - getPermissionSetName", () => {
  assertEquals(new PermissionGuard("READONLY").getPermissionSetName(), "READONLY");
  assertEquals(new PermissionGuard("AUTOMATION").getPermissionSetName(), "AUTOMATION");
  assertEquals(new PermissionGuard("FULL").getPermissionSetName(), "FULL");
});

Deno.test("PermissionGuard - static getToolPermissions", () => {
  const navPerms = PermissionGuard.getToolPermissions("browser_navigate");
  assertEquals(navPerms, [Permission.NAVIGATE_PUBLIC]);

  const interceptPerms = PermissionGuard.getToolPermissions("proxy_add_interceptor");
  assertEquals(interceptPerms, [Permission.INTERCEPT_TRAFFIC, Permission.MODIFY_REQUESTS]);

  const unknownPerms = PermissionGuard.getToolPermissions("nonexistent");
  assertEquals(unknownPerms, []);
});

Deno.test("PermissionGuard - permission event callback fires on allow", () => {
  const events: PermissionEvent[] = [];
  const guard = new PermissionGuard("FULL", { onPermissionEvent: (e) => events.push(e) });
  guard.checkToolPermission("browser_navigate");
  assertEquals(events.length, 1);
  assertEquals(events[0].type, "allowed");
  assertEquals(events[0].toolName, "browser_navigate");
});

Deno.test("PermissionGuard - permission event callback fires on deny", () => {
  const events: PermissionEvent[] = [];
  const guard = new PermissionGuard("READONLY", { onPermissionEvent: (e) => events.push(e) });
  try { guard.checkToolPermission("browser_click"); } catch { /* expected */ }
  assertEquals(events.length, 1);
  assertEquals(events[0].type, "denied");
});

Deno.test("PermissionGuard - permission event callback fires on unknown tool", () => {
  const events: PermissionEvent[] = [];
  const guard = new PermissionGuard("FULL", { onPermissionEvent: (e) => events.push(e) });
  try { guard.checkToolPermission("fake_tool"); } catch { /* expected */ }
  assertEquals(events.length, 1);
  assertEquals(events[0].type, "unknown_tool");
});

Deno.test("PermissionGuard - error message includes permission set name", () => {
  const guard = new PermissionGuard("READONLY");
  try {
    guard.checkToolPermission("browser_click");
    assert(false, "should have thrown");
  } catch (e) {
    assert((e as Error).message.includes("READONLY"));
  }
});

Deno.test("PermissionGuard - default permission set is AUTOMATION", () => {
  const guard = new PermissionGuard();
  assertEquals(guard.getPermissionSetName(), "AUTOMATION");
  // AUTOMATION has CLICK
  guard.checkToolPermission("browser_click");
});

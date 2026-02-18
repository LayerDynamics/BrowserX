/**
 * MiddlewareInterceptor Tests
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import {
  MiddlewareInterceptor,
  type Middleware,
} from "../../../gateway/middleware/middleware_interceptor.ts";

// ============================================================================
// Construction
// ============================================================================

Deno.test({
  name: "MiddlewareInterceptor - constructs with empty chain",
  fn() {
    const interceptor = new MiddlewareInterceptor();
    assertExists(interceptor);
    assertEquals(interceptor.count(), 0);
  },
});

// ============================================================================
// use() — Adding middleware
// ============================================================================

Deno.test({
  name: "MiddlewareInterceptor - use() increases count by 1",
  fn() {
    const interceptor = new MiddlewareInterceptor();
    const mw: Middleware = async (_ctx, next) => next();
    interceptor.use(mw);
    assertEquals(interceptor.count(), 1);
  },
});

Deno.test({
  name: "MiddlewareInterceptor - use() multiple times increases count",
  fn() {
    const interceptor = new MiddlewareInterceptor();
    interceptor.use(async (_ctx, next) => next());
    interceptor.use(async (_ctx, next) => next());
    interceptor.use(async (_ctx, next) => next());
    assertEquals(interceptor.count(), 3);
  },
});

// ============================================================================
// remove() — Removing middleware
// ============================================================================

Deno.test({
  name: "MiddlewareInterceptor - remove() returns true for existing middleware",
  fn() {
    const interceptor = new MiddlewareInterceptor();
    const mw: Middleware = async (_ctx, next) => next();
    interceptor.use(mw);
    const result = interceptor.remove(mw);
    assert(result === true);
    assertEquals(interceptor.count(), 0);
  },
});

Deno.test({
  name: "MiddlewareInterceptor - remove() returns false for non-existent middleware",
  fn() {
    const interceptor = new MiddlewareInterceptor();
    const mw: Middleware = async (_ctx, next) => next();
    const result = interceptor.remove(mw);
    assert(result === false);
  },
});

Deno.test({
  name: "MiddlewareInterceptor - remove() decreases count by 1",
  fn() {
    const interceptor = new MiddlewareInterceptor();
    const mw1: Middleware = async (_ctx, next) => next();
    const mw2: Middleware = async (_ctx, next) => next();
    interceptor.use(mw1);
    interceptor.use(mw2);
    interceptor.remove(mw1);
    assertEquals(interceptor.count(), 1);
  },
});

// ============================================================================
// execute() — Running the middleware chain
// ============================================================================

Deno.test({
  name: "MiddlewareInterceptor - execute() with empty chain returns context",
  async fn() {
    const interceptor = new MiddlewareInterceptor<{ value: number }>();
    const ctx = { value: 42 };
    const result = await interceptor.execute(ctx);
    assertEquals(result, ctx);
  },
});

Deno.test({
  name: "MiddlewareInterceptor - execute() calls middleware in order",
  async fn() {
    const interceptor = new MiddlewareInterceptor<{ order: number[] }>();
    const ctx = { order: [] as number[] };

    interceptor.use(async (c, next) => {
      (c as { order: number[] }).order.push(1);
      return next();
    });
    interceptor.use(async (c, next) => {
      (c as { order: number[] }).order.push(2);
      return next();
    });
    interceptor.use(async (c, next) => {
      (c as { order: number[] }).order.push(3);
      return next();
    });

    await interceptor.execute(ctx);
    assertEquals(ctx.order, [1, 2, 3]);
  },
});

Deno.test({
  name: "MiddlewareInterceptor - execute() pass-through middleware propagates context",
  async fn() {
    const interceptor = new MiddlewareInterceptor<{ modified: boolean }>();
    interceptor.use(async (ctx, next) => {
      (ctx as { modified: boolean }).modified = true;
      return next();
    });
    const ctx = { modified: false };
    await interceptor.execute(ctx);
    assert(ctx.modified);
  },
});

Deno.test({
  name: "MiddlewareInterceptor - execute() chain termination: middleware that does not call next stops chain",
  async fn() {
    const interceptor = new MiddlewareInterceptor<{ count: number }>();
    interceptor.use(async (ctx, _next) => {
      // Does NOT call next — chain stops here
      (ctx as { count: number }).count = 1;
      return ctx;
    });
    interceptor.use(async (ctx, next) => {
      (ctx as { count: number }).count = 99; // Should NOT be reached
      return next();
    });

    const ctx = { count: 0 };
    await interceptor.execute(ctx);
    assertEquals(ctx.count, 1);
  },
});

// ============================================================================
// clear()
// ============================================================================

Deno.test({
  name: "MiddlewareInterceptor - clear() removes all middleware",
  fn() {
    const interceptor = new MiddlewareInterceptor();
    interceptor.use(async (_ctx, next) => next());
    interceptor.use(async (_ctx, next) => next());
    interceptor.use(async (_ctx, next) => next());
    interceptor.clear();
    assertEquals(interceptor.count(), 0);
  },
});

Deno.test({
  name: "MiddlewareInterceptor - clear() allows new middleware to be added after",
  fn() {
    const interceptor = new MiddlewareInterceptor();
    interceptor.use(async (_ctx, next) => next());
    interceptor.clear();
    interceptor.use(async (_ctx, next) => next());
    assertEquals(interceptor.count(), 1);
  },
});

// ============================================================================
// count() getter
// ============================================================================

Deno.test({
  name: "MiddlewareInterceptor - count() is 0 initially",
  fn() {
    const interceptor = new MiddlewareInterceptor();
    assertEquals(interceptor.count(), 0);
  },
});

Deno.test({
  name: "MiddlewareInterceptor - count() tracks add and remove accurately",
  fn() {
    const interceptor = new MiddlewareInterceptor();
    const mw1: Middleware = async (_ctx, next) => next();
    const mw2: Middleware = async (_ctx, next) => next();
    interceptor.use(mw1);
    interceptor.use(mw2);
    assertEquals(interceptor.count(), 2);
    interceptor.remove(mw1);
    assertEquals(interceptor.count(), 1);
    interceptor.clear();
    assertEquals(interceptor.count(), 0);
  },
});

Deno.test({
  name: "MiddlewareInterceptor - execute() with single middleware returns result",
  async fn() {
    const interceptor = new MiddlewareInterceptor<string>();
    interceptor.use(async (_ctx, next) => {
      const result = await next();
      return result;
    });
    const result = await interceptor.execute("hello");
    assertEquals(result, "hello");
  },
});

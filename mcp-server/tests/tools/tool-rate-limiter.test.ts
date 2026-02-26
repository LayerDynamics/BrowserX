import { assertEquals, assertThrows } from "@std/assert";
import { ToolRateLimiter, RateLimitError } from "../../tools/ToolRateLimiter.ts";

Deno.test("ToolRateLimiter - allows requests under limit", () => {
  const limiter = new ToolRateLimiter({ maxRequests: 3, windowMs: 1000 });
  limiter.check("session-1");
  limiter.check("session-1");
  limiter.check("session-1");
  // No error thrown
  limiter.destroy();
});

Deno.test("ToolRateLimiter - blocks requests over limit", () => {
  const limiter = new ToolRateLimiter({ maxRequests: 2, windowMs: 1000 });
  limiter.check("session-1");
  limiter.check("session-1");
  assertThrows(
    () => limiter.check("session-1"),
    RateLimitError,
    "Rate limit exceeded for session session-1: 2 requests per 1000ms",
  );
  limiter.destroy();
});

Deno.test("ToolRateLimiter - isolates different sessions", () => {
  const limiter = new ToolRateLimiter({ maxRequests: 1, windowMs: 1000 });
  limiter.check("session-a");
  limiter.check("session-b");
  // Both succeed - different sessions
  assertThrows(() => limiter.check("session-a"), RateLimitError);
  assertThrows(() => limiter.check("session-b"), RateLimitError);
  limiter.destroy();
});

Deno.test("ToolRateLimiter - resets after window expires", async () => {
  const limiter = new ToolRateLimiter({ maxRequests: 1, windowMs: 50 });
  limiter.check("session-1");
  assertThrows(() => limiter.check("session-1"), RateLimitError);

  await new Promise((resolve) => setTimeout(resolve, 60));

  // Should succeed after window reset
  limiter.check("session-1");
  limiter.destroy();
});

Deno.test("ToolRateLimiter - cleanup removes expired entries", () => {
  const limiter = new ToolRateLimiter({ maxRequests: 10, windowMs: 0 });
  limiter.check("session-1");
  limiter.check("session-2");
  // windowMs=0 means all entries are immediately expired
  limiter.cleanup();
  // After cleanup, entries removed — next check starts fresh window
  limiter.check("session-1");
  limiter.destroy();
});

Deno.test("ToolRateLimiter - destroy clears interval and entries", () => {
  const limiter = new ToolRateLimiter({ maxRequests: 5, windowMs: 1000 });
  limiter.check("session-1");
  limiter.destroy();
  // After destroy, can still check (no crash) but interval is cleared
  limiter.check("session-1");
});

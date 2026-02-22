/**
 * Tests for VSync, FrameRateLimiter, and AdaptiveVSync
 *
 * Note: VSync.start() uses requestAnimationFrame which creates an infinite
 * microtask chain in the Deno shim, so we test the public API without
 * starting the loop, and use wait()/waitFrames() for frame-driven tests
 * since those self-terminate.
 */

import { assert, assertEquals } from "@std/assert";
import {
  AdaptiveVSync,
  FrameRateLimiter,
  VSync,
} from "../../../../src/engine/rendering/compositor/VSync.ts";
import type { FrameTiming, VSyncStats } from "../../../../src/engine/rendering/compositor/VSync.ts";

// ============================================================================
// VSync - Lifecycle
// ============================================================================

Deno.test("VSync - starts inactive by default", () => {
  const vsync = new VSync();
  assertEquals(vsync.isActive(), false);
});

Deno.test("VSync - start makes it active then stop deactivates", () => {
  const vsync = new VSync();
  vsync.start();
  assertEquals(vsync.isActive(), true);
  // Immediately stop to prevent infinite microtask loop
  vsync.stop();
  assertEquals(vsync.isActive(), false);
});

Deno.test("VSync - double start is idempotent", () => {
  const vsync = new VSync();
  vsync.start();
  vsync.start();
  assertEquals(vsync.isActive(), true);
  vsync.stop();
});

Deno.test("VSync - double stop is a no-op", () => {
  const vsync = new VSync();
  vsync.stop();
  vsync.stop();
  assertEquals(vsync.isActive(), false);
});

// ============================================================================
// VSync - Callbacks management
// ============================================================================

Deno.test("VSync - addCallback and removeCallback work without error", () => {
  const vsync = new VSync();
  const cb = (_t: FrameTiming) => {};
  vsync.addCallback(cb);
  vsync.removeCallback(cb);
});

Deno.test("VSync - removing non-existent callback is safe", () => {
  const vsync = new VSync();
  vsync.removeCallback(() => {});
});

// ============================================================================
// VSync - FPS getters/setters
// ============================================================================

Deno.test("VSync - default target FPS is 60", () => {
  const vsync = new VSync();
  assertEquals(vsync.getTargetFPS(), 60);
});

Deno.test("VSync - constructor accepts custom target FPS", () => {
  const vsync = new VSync(30);
  assertEquals(vsync.getTargetFPS(), 30);
});

Deno.test("VSync - setTargetFPS changes target", () => {
  const vsync = new VSync();
  vsync.setTargetFPS(120);
  assertEquals(vsync.getTargetFPS(), 120);
});

Deno.test("VSync - getCurrentFPS returns 0 before any frames", () => {
  const vsync = new VSync();
  assertEquals(vsync.getCurrentFPS(), 0);
});

Deno.test("VSync - getAverageFPS returns 0 before any frames", () => {
  const vsync = new VSync();
  assertEquals(vsync.getAverageFPS(), 0);
});

Deno.test("VSync - getFrameNumber starts at 0", () => {
  const vsync = new VSync();
  assertEquals(vsync.getFrameNumber(), 0);
});

// ============================================================================
// VSync - Stats
// ============================================================================

Deno.test("VSync - getStats returns zeroed stats before running", () => {
  const vsync = new VSync();
  const stats: VSyncStats = vsync.getStats();
  assertEquals(stats.averageFPS, 0);
  assertEquals(stats.minFPS, 0);
  assertEquals(stats.maxFPS, 0);
  assertEquals(stats.frameCount, 0);
  assertEquals(stats.droppedFrames, 0);
  assertEquals(stats.totalTime, 0);
});

Deno.test("VSync - resetStats clears counters", () => {
  const vsync = new VSync();
  vsync.resetStats();
  assertEquals(vsync.getFrameNumber(), 0);
  assertEquals(vsync.getAverageFPS(), 0);
  assertEquals(vsync.getCurrentFPS(), 0);
});

// ============================================================================
// VSync - wait() and waitFrames() (self-terminating)
// ============================================================================

Deno.test({
  name: "VSync - wait resolves with timing on next frame",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const vsync = new VSync();
    const timing = await vsync.wait();
    assert(timing.timestamp > 0, "timestamp should be positive");
    assertEquals(timing.frameNumber, 0);
    vsync.stop();
  },
});

Deno.test({
  name: "VSync - waitFrames resolves after N frames",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const vsync = new VSync();
    const timing = await vsync.waitFrames(3);
    assert(timing.frameNumber >= 2, "should have processed at least 3 frames (0-indexed last)");
    vsync.stop();
  },
});

Deno.test({
  name: "VSync - wait auto-starts if not running",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const vsync = new VSync();
    assertEquals(vsync.isActive(), false);
    await vsync.wait();
    assertEquals(vsync.isActive(), true);
    vsync.stop();
  },
});

Deno.test({
  name: "VSync - stats populated after waitFrames",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const vsync = new VSync();
    await vsync.waitFrames(3);
    const stats = vsync.getStats();
    assert(stats.frameCount >= 3, "frameCount should be >= 3");
    assert(stats.totalTime >= 0, "totalTime should be non-negative");
    vsync.stop();
  },
});

// ============================================================================
// FrameRateLimiter
// ============================================================================

Deno.test("FrameRateLimiter - getTargetFPS returns constructor value", () => {
  const limiter = new FrameRateLimiter(30);
  assertEquals(limiter.getTargetFPS(), 30);
});

Deno.test("FrameRateLimiter - setTargetFPS changes value", () => {
  const limiter = new FrameRateLimiter(30);
  limiter.setTargetFPS(60);
  assertEquals(limiter.getTargetFPS(), 60);
});

Deno.test({
  name: "FrameRateLimiter - wait resolves without error",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const limiter = new FrameRateLimiter(1000); // high FPS = minimal delay
    await limiter.wait();
  },
});

Deno.test({
  name: "FrameRateLimiter - consecutive waits both resolve",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const limiter = new FrameRateLimiter(1000);
    await limiter.wait();
    await limiter.wait();
  },
});

// ============================================================================
// AdaptiveVSync
// ============================================================================

Deno.test("AdaptiveVSync - default performance mode is balanced", () => {
  const avsync = new AdaptiveVSync();
  assertEquals(avsync.getPerformanceMode(), "balanced");
});

Deno.test("AdaptiveVSync - default adaptive target is 60", () => {
  const avsync = new AdaptiveVSync();
  assertEquals(avsync.getAdaptiveTargetFPS(), 60);
});

Deno.test("AdaptiveVSync - power-save mode sets 30fps target", () => {
  const avsync = new AdaptiveVSync();
  avsync.setPerformanceMode("power-save");
  assertEquals(avsync.getPerformanceMode(), "power-save");
  assertEquals(avsync.getAdaptiveTargetFPS(), 30);
  assertEquals(avsync.getTargetFPS(), 30);
});

Deno.test("AdaptiveVSync - high-quality mode sets 60fps target", () => {
  const avsync = new AdaptiveVSync();
  avsync.setPerformanceMode("high-quality");
  assertEquals(avsync.getAdaptiveTargetFPS(), 60);
  assertEquals(avsync.getTargetFPS(), 60);
});

Deno.test("AdaptiveVSync - inherits VSync start/stop", () => {
  const avsync = new AdaptiveVSync();
  avsync.start();
  assertEquals(avsync.isActive(), true);
  avsync.stop();
  assertEquals(avsync.isActive(), false);
});

Deno.test("AdaptiveVSync - updateAdaptiveSettings does not crash", () => {
  const avsync = new AdaptiveVSync();
  avsync.updateAdaptiveSettings(); // no frames, should not crash
});

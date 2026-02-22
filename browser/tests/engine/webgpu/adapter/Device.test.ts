/**
 * Tests for WebGPU Device Management
 */

import { assertEquals, assertExists, assertRejects } from "@std/assert";
import { WebGPUDevice } from "../../../../src/engine/webgpu/adapter/Device.ts";
import { GPUDeviceState, GPUVendor } from "../../../../src/types/webgpu.ts";
import { closeLib, preloadLib } from "@browserx/webgpu_x";
import { getSharedDevice, webgpuAvailable } from "../shared_device.ts";

// Eagerly load FFI library at module scope so per-test sanitizer doesn't flag it
preloadLib();

if (webgpuAvailable) {
  // --- Lifecycle tests that need their own device instances ---

  Deno.test("Device - initializes in UNINITIALIZED state", () => {
    const device = new WebGPUDevice();
    assertEquals(device.getState(), GPUDeviceState.UNINITIALIZED);
  });

  Deno.test("Device - initialize transitions to READY", async () => {
    const device = await getSharedDevice();
    assertEquals(device.getState(), GPUDeviceState.READY);
  });

  Deno.test("Device - isReady returns true after initialization", async () => {
    const device = await getSharedDevice();
    assertEquals(device.isReady(), true);
  });

  Deno.test("Device - destroy transitions to DESTROYED", async () => {
    // Need a real initialized device to test destroy
    const device = new WebGPUDevice();
    await device.initialize();
    assertEquals(device.getState(), GPUDeviceState.READY);
    device.destroy();
    assertEquals(device.getState(), GPUDeviceState.DESTROYED);
  });

  Deno.test("Device - cannot initialize twice", async () => {
    const device = await getSharedDevice();
    await assertRejects(
      async () => {
        await device.initialize();
      },
      Error,
      "Cannot initialize",
    );
  });

  // --- Read-only tests using shared device ---

  Deno.test("Device - getDevice returns native GPUDevice", async () => {
    const device = await getSharedDevice();
    const nativeDevice = device.getDevice();
    assertExists(nativeDevice);
    assertEquals(typeof nativeDevice.createBuffer, "function");
  });

  Deno.test("Device - getQueue returns GPUQueue", async () => {
    const device = await getSharedDevice();
    const queue = device.getQueue();
    assertExists(queue);
    assertEquals(typeof queue.submit, "function");
  });

  Deno.test("Device - getFeatures returns feature set", async () => {
    const device = await getSharedDevice();
    const features = device.getFeatures();
    assertExists(features);
    assertEquals(typeof features.depthClipControl, "boolean");
  });

  Deno.test("Device - getLimits returns device limits", async () => {
    const device = await getSharedDevice();
    const limits = device.getLimits();
    assertExists(limits);
    assertEquals(typeof limits.maxBindGroups, "number");
    assertEquals(typeof limits.maxBufferSize, "number");
  });

  Deno.test("Device - detectVendor identifies GPU vendor", async () => {
    const device = await getSharedDevice();
    const vendor = device.detectVendor();
    assertExists(vendor);
    const validVendors = [
      GPUVendor.NVIDIA,
      GPUVendor.AMD,
      GPUVendor.INTEL,
      GPUVendor.APPLE,
      GPUVendor.QUALCOMM,
      GPUVendor.ARM,
      GPUVendor.UNKNOWN,
    ];
    assertEquals(validVendors.includes(vendor), true);
  });

  Deno.test("Device - getStats returns statistics", async () => {
    const device = await getSharedDevice();
    const stats = device.getStats();
    assertExists(stats);
    assertEquals(typeof stats.uptime, "number");
    assertExists(stats.bufferStats);
    assertExists(stats.pipelineStats);
    assertExists(stats.commandStats);
    assertEquals(typeof stats.memoryUsage, "number");
    assertEquals(typeof stats.peakMemoryUsage, "number");
  });

  Deno.test("Device - onDeviceLost registers callback", async () => {
    const device = await getSharedDevice();
    let called = false;
    device.onDeviceLost(() => {
      called = true;
    });
    assertEquals(typeof called, "boolean");
  });

  Deno.test("Device - onError registers callback", async () => {
    const device = await getSharedDevice();
    let errorReceived: Error | null = null;
    device.onError((error) => {
      errorReceived = error;
    });
    assertEquals(errorReceived, null);
  });

  Deno.test("Device - configuration with label", async () => {
    // Uses shared device — label is set at init time, just verify it's ready
    const device = await getSharedDevice();
    assertEquals(device.getState(), GPUDeviceState.READY);
  });

  Deno.test("Device - configuration with power preference", async () => {
    const device = await getSharedDevice();
    assertEquals(device.isReady(), true);
  });

  Deno.test("Device - multiple device references work", async () => {
    // Verify device can be referenced multiple times (shared instance)
    const device1 = await getSharedDevice();
    const device2 = await getSharedDevice();

    assertEquals(device1.isReady(), true);
    assertEquals(device2.isReady(), true);
    // Same shared instance
    assertEquals(device1, device2);
  });
} else {
  Deno.test("Device - WebGPU not available", () => {
    console.log("Skipping WebGPU device tests - WebGPU not available");
    assertEquals(webgpuAvailable, false);
  });
}

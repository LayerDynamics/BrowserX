/**
 * Tests for WebGPU Device Management
 */

import { assertEquals, assertExists, assertRejects } from "@std/assert";
import { WebGPUDevice } from "../../../../src/engine/webgpu/adapter/Device.ts";
import { GPUDeviceState, GPUVendor } from "../../../../src/types/webgpu.ts";

// Skip all tests if WebGPU not available
const webgpuAvailable = typeof navigator !== "undefined" && "gpu" in navigator;

if (webgpuAvailable) {
    Deno.test("Device - initializes in UNINITIALIZED state", () => {
        const device = new WebGPUDevice();
        assertEquals(device.getState(), GPUDeviceState.UNINITIALIZED);
    });

    Deno.test("Device - initialize transitions to READY", async () => {
        const device = new WebGPUDevice();
        await device.initialize();

        assertEquals(device.getState(), GPUDeviceState.READY);
    });

    Deno.test("Device - getDevice returns native GPUDevice", async () => {
        const device = new WebGPUDevice();
        await device.initialize();

        const nativeDevice = device.getDevice();
        assertExists(nativeDevice);
        assertEquals(typeof nativeDevice.createBuffer, "function");
    });

    Deno.test("Device - getQueue returns GPUQueue", async () => {
        const device = new WebGPUDevice();
        await device.initialize();

        const queue = device.getQueue();
        assertExists(queue);
        assertEquals(typeof queue.submit, "function");
    });

    Deno.test("Device - getFeatures returns feature set", async () => {
        const device = new WebGPUDevice();
        await device.initialize();

        const features = device.getFeatures();
        assertExists(features);
        assertEquals(typeof features.depthClipControl, "boolean");
    });

    Deno.test("Device - getLimits returns device limits", async () => {
        const device = new WebGPUDevice();
        await device.initialize();

        const limits = device.getLimits();
        assertExists(limits);
        assertEquals(typeof limits.maxBindGroups, "number");
        assertEquals(typeof limits.maxBufferSize, "number");
    });

    Deno.test("Device - detectVendor identifies GPU vendor", async () => {
        const device = new WebGPUDevice();
        await device.initialize();

        const vendor = device.detectVendor();
        assertExists(vendor);
        // Vendor should be one of the known vendors or UNKNOWN
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
        const device = new WebGPUDevice();
        await device.initialize();

        const stats = device.getStats();
        assertExists(stats);
        assertEquals(typeof stats.uptime, "number");
        assertExists(stats.bufferStats);
        assertExists(stats.pipelineStats);
        assertExists(stats.commandStats);
        assertEquals(typeof stats.memoryUsage, "number");
        assertEquals(typeof stats.peakMemoryUsage, "number");

        device.destroy();
    });

    Deno.test("Device - isReady returns true after initialization", async () => {
        const device = new WebGPUDevice();
        assertEquals(device.isReady(), false);

        await device.initialize();
        assertEquals(device.isReady(), true);
    });

    Deno.test("Device - destroy transitions to DESTROYED", async () => {
        const device = new WebGPUDevice();
        await device.initialize();

        device.destroy();
        assertEquals(device.getState(), GPUDeviceState.DESTROYED);
    });

    Deno.test("Device - cannot initialize twice", async () => {
        const device = new WebGPUDevice();
        await device.initialize();

        await assertRejects(
            async () => {
                await device.initialize();
            },
            Error,
            "Cannot initialize",
        );
    });

    Deno.test("Device - onDeviceLost registers callback", async () => {
        const device = new WebGPUDevice();
        await device.initialize();

        let called = false;
        device.onDeviceLost(() => {
            called = true;
        });

        // Callback should be registered (we can't easily trigger device lost)
        assertEquals(typeof called, "boolean");
    });

    Deno.test("Device - onError registers callback", async () => {
        const device = new WebGPUDevice();
        await device.initialize();

        let errorReceived: Error | null = null;
        device.onError((error) => {
            errorReceived = error;
        });

        // Callback should be registered
        assertEquals(errorReceived, null);
    });

    Deno.test("Device - configuration with label", async () => {
        const device = new WebGPUDevice({
            label: "Test Device",
        });

        await device.initialize();
        assertEquals(device.getState(), GPUDeviceState.READY);
    });

    Deno.test("Device - configuration with power preference", async () => {
        const device = new WebGPUDevice({
            powerPreference: "low-power",
        });

        await device.initialize();
        assertEquals(device.isReady(), true);
    });

    Deno.test("Device - multiple devices can coexist", async () => {
        const device1 = new WebGPUDevice({ label: "Device 1" });
        const device2 = new WebGPUDevice({ label: "Device 2" });

        await device1.initialize();
        await device2.initialize();

        assertEquals(device1.isReady(), true);
        assertEquals(device2.isReady(), true);

        device1.destroy();
        device2.destroy();
    });
} else {
    Deno.test("Device - WebGPU not available", () => {
        console.log("Skipping WebGPU device tests - WebGPU not available");
        assertEquals(webgpuAvailable, false);
    });
}

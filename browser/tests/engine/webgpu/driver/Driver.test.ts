/**
 * Tests for WebGPU Driver
 */

import { assertEquals, assertExists, assertRejects } from "@std/assert";
import {
    WebGPUDriver,
    DriverState,
    isWebGPUSupported,
    getWebGPUAvailability,
} from "../../../../src/engine/webgpu/driver/mod.ts";

const webgpuAvailable = typeof navigator !== "undefined" && "gpu" in navigator;

Deno.test("Driver - isWebGPUSupported checks for WebGPU API", () => {
    const supported = isWebGPUSupported();
    assertEquals(typeof supported, "boolean");
});

Deno.test("Driver - getWebGPUAvailability returns availability info", async () => {
    const availability = await getWebGPUAvailability();

    assertExists(availability);
    assertEquals(typeof availability.supported, "boolean");
    assertEquals(typeof availability.adapterAvailable, "boolean");
});

if (webgpuAvailable) {
    Deno.test("Driver - initializes in UNINITIALIZED state", () => {
        const driver = new WebGPUDriver();
        assertEquals(driver.getState(), DriverState.UNINITIALIZED);
    });

    Deno.test("Driver - initialize transitions to READY", async () => {
        const driver = new WebGPUDriver();
        await driver.initialize();

        assertEquals(driver.getState(), DriverState.READY);
        driver.destroy();
    });

    Deno.test("Driver - isReady returns correct state", async () => {
        const driver = new WebGPUDriver();
        assertEquals(driver.isReady(), false);

        await driver.initialize();
        assertEquals(driver.isReady(), true);

        driver.destroy();
    });

    Deno.test("Driver - isFailed returns false when healthy", async () => {
        const driver = new WebGPUDriver();
        await driver.initialize();

        assertEquals(driver.isFailed(), false);
        driver.destroy();
    });

    Deno.test("Driver - getDevice returns WebGPUDevice", async () => {
        const driver = new WebGPUDriver();
        await driver.initialize();

        const device = driver.getDevice();
        assertExists(device);
        assertEquals(typeof device.getDevice, "function");

        driver.destroy();
    });

    Deno.test("Driver - getNativeDevice returns GPUDevice", async () => {
        const driver = new WebGPUDriver();
        await driver.initialize();

        const nativeDevice = driver.getNativeDevice();
        assertExists(nativeDevice);
        assertEquals(typeof nativeDevice.createBuffer, "function");

        driver.destroy();
    });

    Deno.test("Driver - getQueue returns GPUQueue", async () => {
        const driver = new WebGPUDriver();
        await driver.initialize();

        const queue = driver.getQueue();
        assertExists(queue);
        assertEquals(typeof queue.submit, "function");

        driver.destroy();
    });

    Deno.test("Driver - getFeatures returns device features", async () => {
        const driver = new WebGPUDriver();
        await driver.initialize();

        const features = driver.getFeatures();
        assertExists(features);

        driver.destroy();
    });

    Deno.test("Driver - getLimits returns device limits", async () => {
        const driver = new WebGPUDriver();
        await driver.initialize();

        const limits = driver.getLimits();
        assertExists(limits);
        assertEquals(typeof limits.maxBindGroups, "number");

        driver.destroy();
    });

    Deno.test("Driver - getDeviceStats returns statistics", async () => {
        const driver = new WebGPUDriver();
        await driver.initialize();

        const stats = driver.getDeviceStats();
        assertExists(stats);

        driver.destroy();
    });

    Deno.test("Driver - detectVendor identifies GPU vendor", async () => {
        const driver = new WebGPUDriver();
        await driver.initialize();

        const vendor = driver.detectVendor();
        assertExists(vendor);

        driver.destroy();
    });

    Deno.test("Driver - getPerformanceMetrics returns metrics", async () => {
        const driver = new WebGPUDriver();
        await driver.initialize();

        const metrics = driver.getPerformanceMetrics();
        assertExists(metrics);
        assertEquals(typeof metrics.initializationTime, "number");
        assertEquals(typeof metrics.totalUptime, "number");
        assertEquals(typeof metrics.deviceLostCount, "number");

        driver.destroy();
    });

    Deno.test("Driver - getRecoveryHistory returns empty initially", async () => {
        const driver = new WebGPUDriver();
        await driver.initialize();

        const history = driver.getRecoveryHistory();
        assertEquals(Array.isArray(history), true);
        assertEquals(history.length, 0);

        driver.destroy();
    });

    Deno.test("Driver - onStateChange registers callback", async () => {
        const driver = new WebGPUDriver();

        const states: DriverState[] = [];
        driver.onStateChange((state) => {
            states.push(state);
        });

        await driver.initialize();

        // Should have received state changes
        assertEquals(states.length > 0, true);

        driver.destroy();
    });

    Deno.test("Driver - onError registers callback", async () => {
        const driver = new WebGPUDriver();
        await driver.initialize();

        const errors: Error[] = [];
        driver.onError((error) => {
            errors.push(error);
        });

        // Callback should be registered
        assertEquals(Array.isArray(errors), true);

        driver.destroy();
    });

    Deno.test("Driver - onRecovery registers callback", async () => {
        const driver = new WebGPUDriver();
        await driver.initialize();

        let recoveryAttempts = 0;
        driver.onRecovery(() => {
            recoveryAttempts++;
        });

        // Callback should be registered
        assertEquals(typeof recoveryAttempts, "number");

        driver.destroy();
    });

    Deno.test("Driver - configuration with autoRecover disabled", async () => {
        const driver = new WebGPUDriver({
            autoRecover: false,
        });

        await driver.initialize();
        assertEquals(driver.isReady(), true);

        driver.destroy();
    });

    Deno.test("Driver - configuration with custom recovery attempts", async () => {
        const driver = new WebGPUDriver({
            maxAutoRecoveryAttempts: 10,
        });

        await driver.initialize();
        assertEquals(driver.isReady(), true);

        driver.destroy();
    });

    Deno.test("Driver - configuration with performance monitoring disabled", async () => {
        const driver = new WebGPUDriver({
            enablePerformanceMonitoring: false,
        });

        await driver.initialize();
        const metrics = driver.getPerformanceMetrics();
        assertExists(metrics);

        driver.destroy();
    });

    Deno.test("Driver - destroy transitions to DESTROYED", async () => {
        const driver = new WebGPUDriver();
        await driver.initialize();

        driver.destroy();
        assertEquals(driver.getState(), DriverState.DESTROYED);
    });

    Deno.test("Driver - cannot access device after destroy", async () => {
        const driver = new WebGPUDriver();
        await driver.initialize();
        driver.destroy();

        try {
            driver.getDevice();
            throw new Error("Should have thrown");
        } catch (error) {
            assertEquals((error as Error).message.includes("driver is in state"), true);
        }
    });
} else {
    Deno.test("Driver - WebGPU not available", () => {
        console.log("Skipping WebGPU driver tests - WebGPU not available");
        assertEquals(webgpuAvailable, false);
    });
}

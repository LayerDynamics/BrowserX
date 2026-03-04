import { assertEquals, assertRejects } from "@std/assert";

import { WebcamDevice } from "../../../src/os/devices/Webcam.ts";

Deno.test("WebcamDevice - isAvailable returns false", () => {
  assertEquals(WebcamDevice.isAvailable(), false);
});

Deno.test("WebcamDevice - listDevices returns empty array", async () => {
  const devices = await WebcamDevice.listDevices();
  assertEquals(devices.length, 0);
});

Deno.test("WebcamDevice - open throws not available", async () => {
  const cam = new WebcamDevice();
  await assertRejects(
    () => cam.open(),
    Error,
    "not available",
  );
});

Deno.test("WebcamDevice - startCapture throws not available", () => {
  const cam = new WebcamDevice();
  try {
    cam.startCapture();
    throw new Error("Should have thrown");
  } catch (e) {
    assertEquals((e as Error).message.includes("not available"), true);
  }
});

Deno.test("WebcamDevice - captureFrame returns null", () => {
  const cam = new WebcamDevice();
  assertEquals(cam.captureFrame(), null);
});

Deno.test("WebcamDevice - default state", () => {
  const cam = new WebcamDevice();
  assertEquals(cam.isCapturing, false);
  assertEquals(cam.deviceId, "");
});

Deno.test("WebcamDevice - close resets state", () => {
  const cam = new WebcamDevice();
  cam.close();
  assertEquals(cam.isCapturing, false);
  assertEquals(cam.deviceId, "");
});

import { assertEquals, assertRejects } from "@std/assert";

import { MicrophoneDevice } from "../../../src/os/devices/Microphone.ts";

Deno.test("MicrophoneDevice - isAvailable returns false", () => {
  assertEquals(MicrophoneDevice.isAvailable(), false);
});

Deno.test("MicrophoneDevice - listDevices returns empty array", async () => {
  const devices = await MicrophoneDevice.listDevices();
  assertEquals(devices.length, 0);
});

Deno.test("MicrophoneDevice - open throws not available", async () => {
  const mic = new MicrophoneDevice();
  await assertRejects(
    () => mic.open(),
    Error,
    "not available",
  );
});

Deno.test("MicrophoneDevice - startCapture throws not available", () => {
  const mic = new MicrophoneDevice();
  try {
    mic.startCapture();
    throw new Error("Should have thrown");
  } catch (e) {
    assertEquals((e as Error).message.includes("not available"), true);
  }
});

Deno.test("MicrophoneDevice - read returns null", () => {
  const mic = new MicrophoneDevice();
  assertEquals(mic.read(), null);
});

Deno.test("MicrophoneDevice - default state", () => {
  const mic = new MicrophoneDevice();
  assertEquals(mic.isCapturing, false);
  assertEquals(mic.deviceId, "");
});

Deno.test("MicrophoneDevice - close resets state", () => {
  const mic = new MicrophoneDevice();
  mic.close();
  assertEquals(mic.isCapturing, false);
  assertEquals(mic.deviceId, "");
});

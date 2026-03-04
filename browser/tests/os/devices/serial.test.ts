import { assertEquals, assertExists } from "@std/assert";

import { SerialDevice } from "../../../src/os/devices/Serial.ts";

Deno.test("SerialDevice - isAvailableSync returns boolean", () => {
  const available = SerialDevice.isAvailableSync();
  assertEquals(typeof available, "boolean");
});

Deno.test({ name: "SerialDevice - isAvailable returns boolean", sanitizeResources: false, fn: async () => {
  const available = await SerialDevice.isAvailable();
  assertEquals(typeof available, "boolean");
}});

Deno.test("SerialDevice - listPorts returns array", async () => {
  const ports = await SerialDevice.listPorts();
  assertExists(ports);
  assertEquals(Array.isArray(ports), true);
});

Deno.test("SerialDevice - new instance defaults", () => {
  const device = new SerialDevice();
  assertEquals(device.isOpen, false);
  assertEquals(device.name, "");
});

Deno.test("SerialDevice - write when not open returns -1", () => {
  const device = new SerialDevice();
  const result = device.write(new Uint8Array([1, 2, 3]));
  assertEquals(result, -1);
});

Deno.test("SerialDevice - read when not open returns empty", () => {
  const device = new SerialDevice();
  const result = device.read();
  assertEquals(result.length, 0);
});

Deno.test("SerialDevice - flush when not open returns false", () => {
  const device = new SerialDevice();
  assertEquals(device.flush(), false);
});

Deno.test("SerialDevice - bytesAvailable when not open returns -1", () => {
  const device = new SerialDevice();
  assertEquals(device.bytesAvailable(), -1);
});

Deno.test("SerialDevice - close when not open returns false", () => {
  const device = new SerialDevice();
  assertEquals(device.close(), false);
});

Deno.test("SerialDevice - configure when not open returns false", () => {
  const device = new SerialDevice();
  assertEquals(device.configure({ dataBits: 8 }), false);
});

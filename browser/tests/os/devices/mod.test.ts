import { assertExists } from "@std/assert";

import {
  SerialDevice,
  Printer,
  PrinterDiscovery,
  MicrophoneDevice,
  WebcamDevice,
} from "../../../src/os/devices/mod.ts";

import type {
  SerialPortInfo,
  SerialDeviceOptions,
  PrinterInfo,
  PrintJob,
  PrintResult,
  PrinterStatus,
  AudioInputDevice,
  AudioCaptureOptions,
  AudioBuffer,
  VideoInputDevice,
  VideoCaptureOptions,
  ImageFrame,
} from "../../../src/os/devices/mod.ts";

Deno.test("mod.ts - all classes exported", () => {
  assertExists(SerialDevice);
  assertExists(Printer);
  assertExists(PrinterDiscovery);
  assertExists(MicrophoneDevice);
  assertExists(WebcamDevice);
});

Deno.test("mod.ts - type exports resolve", () => {
  // Verify types can be used (compile-time check)
  const _portInfo: SerialPortInfo = {
    name: "test",
    portType: "USB",
    vid: null,
    pid: null,
    manufacturer: null,
    product: null,
    serialNumber: null,
  };
  assertExists(_portInfo);

  const _options: SerialDeviceOptions = { baudRate: 9600 };
  assertExists(_options);

  const _printerInfo: PrinterInfo = { name: "test", type: "os", port: null, status: "idle" };
  assertExists(_printerInfo);

  const _job: PrintJob = { content: "test", format: "text" };
  assertExists(_job);

  const _result: PrintResult = { success: true, message: "ok" };
  assertExists(_result);

  const _status: PrinterStatus = { connected: false, ready: false, paperPresent: true, error: null };
  assertExists(_status);

  const _audioDevice: AudioInputDevice = { id: "1", name: "mic", channels: 1, sampleRate: 44100, isDefault: true };
  assertExists(_audioDevice);

  const _audioOptions: AudioCaptureOptions = { sampleRate: 44100 };
  assertExists(_audioOptions);

  const _audioBuffer: AudioBuffer = { data: new Float32Array(0), sampleRate: 44100, channels: 1, duration: 0 };
  assertExists(_audioBuffer);

  const _videoDevice: VideoInputDevice = { id: "1", name: "cam", maxWidth: 1920, maxHeight: 1080, isDefault: true };
  assertExists(_videoDevice);

  const _videoOptions: VideoCaptureOptions = { width: 640 };
  assertExists(_videoOptions);

  const _frame: ImageFrame = { data: new Uint8Array(0), width: 0, height: 0, format: "rgba", timestamp: 0 };
  assertExists(_frame);
});

/**
 * Device Layer
 *
 * Hardware device access for serial ports, printers, microphones, and webcams.
 */

export {
  SerialDevice,
  type SerialPortInfo,
  type SerialDeviceOptions,
} from "./Serial.ts";

export {
  Printer,
  PrinterDiscovery,
  type PrinterInfo,
  type PrintJob,
  type PrintResult,
  type PrinterStatus,
} from "./Printer.ts";

export {
  MicrophoneDevice,
  type AudioInputDevice,
  type AudioCaptureOptions,
  type AudioBuffer,
} from "./Microphone.ts";

export {
  WebcamDevice,
  type VideoInputDevice,
  type VideoCaptureOptions,
  type ImageFrame,
} from "./Webcam.ts";

export { loadSerialx, isSerialxLoaded, getSerialxModule } from "./serialx-loader.ts";

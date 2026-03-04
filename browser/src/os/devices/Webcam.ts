/**
 * Webcam Device Layer
 *
 * Video input device abstraction. Currently not available in Deno runtime
 * (no native video capture API). Structure ready for future video FFI crate.
 */

/** Video input device information */
export interface VideoInputDevice {
  id: string;
  name: string;
  maxWidth: number;
  maxHeight: number;
  isDefault: boolean;
}

/** Video capture options */
export interface VideoCaptureOptions {
  width?: number;
  height?: number;
  frameRate?: number;
  pixelFormat?: "rgba" | "rgb" | "yuv420";
}

/** Single video frame */
export interface ImageFrame {
  data: Uint8Array;
  width: number;
  height: number;
  format: string;
  timestamp: number;
}

/**
 * Webcam device for video capture
 *
 * Currently unavailable in Deno runtime — all methods throw or return
 * unavailable status. Structure ready for a future video FFI crate.
 */
export class WebcamDevice {
  private _deviceId: string = "";
  private _isCapturing: boolean = false;

  /** Check if webcam support is available */
  static isAvailable(): boolean {
    return false;
  }

  /** List available video input devices */
  static async listDevices(): Promise<VideoInputDevice[]> {
    await Promise.resolve(); // async signature for future compatibility
    return [];
  }

  /** Open a video input device */
  async open(deviceId?: string, _options?: VideoCaptureOptions): Promise<boolean> {
    await Promise.resolve();
    this._deviceId = deviceId || "";
    throw new Error(
      "Webcam capture is not available in the current runtime. " +
      "Deno does not provide native video capture APIs. " +
      "A future video FFI crate will enable this functionality."
    );
  }

  /** Start capturing video frames */
  startCapture(): void {
    if (!this._isCapturing) {
      throw new Error("Webcam not available: no video capture API in Deno runtime");
    }
  }

  /** Stop capturing video frames */
  stopCapture(): void {
    this._isCapturing = false;
  }

  /** Capture a single frame */
  captureFrame(): ImageFrame | null {
    return null;
  }

  /** Close the video device */
  close(): void {
    this._isCapturing = false;
    this._deviceId = "";
  }

  /** Check if currently capturing */
  get isCapturing(): boolean {
    return this._isCapturing;
  }

  /** Get the device ID */
  get deviceId(): string {
    return this._deviceId;
  }
}

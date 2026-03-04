/**
 * Microphone Device Layer
 *
 * Audio input device abstraction. Currently not available in Deno runtime
 * (no native audio capture API). Structure ready for future audio FFI crate.
 */

/** Audio input device information */
export interface AudioInputDevice {
  id: string;
  name: string;
  channels: number;
  sampleRate: number;
  isDefault: boolean;
}

/** Audio capture options */
export interface AudioCaptureOptions {
  sampleRate?: number;
  channels?: number;
  bitsPerSample?: number;
  bufferSize?: number;
}

/** Audio buffer with PCM data */
export interface AudioBuffer {
  data: Float32Array;
  sampleRate: number;
  channels: number;
  duration: number;
}

/**
 * Microphone device for audio capture
 *
 * Currently unavailable in Deno runtime — all methods throw or return
 * unavailable status. Structure ready for a future audio FFI crate.
 */
export class MicrophoneDevice {
  private _deviceId: string = "";
  private _isCapturing: boolean = false;

  /** Check if microphone support is available */
  static isAvailable(): boolean {
    return false;
  }

  /** List available audio input devices */
  static async listDevices(): Promise<AudioInputDevice[]> {
    await Promise.resolve(); // async signature for future compatibility
    return [];
  }

  /** Open an audio input device */
  async open(deviceId?: string, _options?: AudioCaptureOptions): Promise<boolean> {
    await Promise.resolve();
    this._deviceId = deviceId || "";
    throw new Error(
      "Microphone capture is not available in the current runtime. " +
      "Deno does not provide native audio capture APIs. " +
      "A future audio FFI crate will enable this functionality."
    );
  }

  /** Start capturing audio */
  startCapture(): void {
    if (!this._isCapturing) {
      throw new Error("Microphone not available: no audio capture API in Deno runtime");
    }
  }

  /** Stop capturing audio */
  stopCapture(): void {
    this._isCapturing = false;
  }

  /** Read captured audio data */
  read(): AudioBuffer | null {
    return null;
  }

  /** Close the audio device */
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

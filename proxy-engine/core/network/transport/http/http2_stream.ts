/**
 * HTTP/2 Stream State Machine
 *
 * Implements stream lifecycle and state transitions
 */

import type { HTTP2ErrorCode, HTTP2Frame } from "./http2_frames.ts";
import { HTTP2FrameFlags, HTTP2FrameType } from "./http2_frames.ts";

/**
 * HTTP/2 stream state
 */
export enum HTTP2StreamState {
  IDLE = "idle",
  RESERVED_LOCAL = "reserved_local",
  RESERVED_REMOTE = "reserved_remote",
  OPEN = "open",
  HALF_CLOSED_LOCAL = "half_closed_local",
  HALF_CLOSED_REMOTE = "half_closed_remote",
  CLOSED = "closed",
}

/**
 * HTTP/2 stream priority
 */
export interface HTTP2StreamPriority {
  /**
   * Stream dependency
   */
  streamDependency: number;

  /**
   * Weight (1-256)
   */
  weight: number;

  /**
   * Exclusive flag
   */
  exclusive: boolean;
}

/**
 * HTTP/2 stream
 */
export class HTTP2Stream {
  private state: HTTP2StreamState = HTTP2StreamState.IDLE;
  private localWindowSize = 65535;
  private remoteWindowSize = 65535;
  private priority?: HTTP2StreamPriority;
  private receivedData: Uint8Array[] = [];
  private receivedHeaders: Map<string, string> = new Map();
  private headersComplete = false;

  // Statistics
  private stats = {
    bytesSent: 0,
    bytesReceived: 0,
    framesSent: 0,
    framesReceived: 0,
  };

  constructor(
    public readonly id: number,
    public readonly isLocal: boolean,
  ) {}

  /**
   * Get current state
   */
  getState(): HTTP2StreamState {
    return this.state;
  }

  /**
   * Transition to new state
   */
  private setState(newState: HTTP2StreamState): void {
    this.state = newState;
  }

  /**
   * Process incoming frame
   */
  processFrame(frame: HTTP2Frame): void {
    this.stats.framesReceived++;

    switch (frame.header.type) {
      case HTTP2FrameType.HEADERS:
        this.handleHeadersFrame(frame);
        break;

      case HTTP2FrameType.DATA:
        this.handleDataFrame(frame);
        break;

      case HTTP2FrameType.RST_STREAM:
        this.setState(HTTP2StreamState.CLOSED);
        break;

      case HTTP2FrameType.WINDOW_UPDATE:
        this.handleWindowUpdate(frame);
        break;

      case HTTP2FrameType.PRIORITY:
        this.handlePriorityFrame(frame);
        break;

      default:
        // Ignore unknown frame types
        break;
    }
  }

  /**
   * Handle HEADERS frame
   */
  private handleHeadersFrame(frame: HTTP2Frame): void {
    const endStream = !!(frame.header.flags & HTTP2FrameFlags.END_STREAM);
    const endHeaders = !!(frame.header.flags & HTTP2FrameFlags.END_HEADERS);

    // State transitions
    switch (this.state) {
      case HTTP2StreamState.IDLE:
        if (this.isLocal) {
          // Receiving headers on local stream (pushed)
          this.setState(HTTP2StreamState.RESERVED_REMOTE);
        } else {
          // Receiving headers on remote stream
          this.setState(endStream ? HTTP2StreamState.HALF_CLOSED_REMOTE : HTTP2StreamState.OPEN);
        }
        break;

      case HTTP2StreamState.RESERVED_REMOTE:
        this.setState(HTTP2StreamState.HALF_CLOSED_LOCAL);
        break;

      case HTTP2StreamState.OPEN:
        if (endStream) {
          this.setState(HTTP2StreamState.HALF_CLOSED_REMOTE);
        }
        break;

      case HTTP2StreamState.HALF_CLOSED_LOCAL:
        if (endStream) {
          this.setState(HTTP2StreamState.CLOSED);
        }
        break;

      default:
        // Invalid state for HEADERS
        break;
    }

    if (endHeaders) {
      this.headersComplete = true;
    }
  }

  /**
   * Handle DATA frame
   */
  private handleDataFrame(frame: HTTP2Frame): void {
    const endStream = !!(frame.header.flags & HTTP2FrameFlags.END_STREAM);

    // Update flow control window
    this.localWindowSize -= frame.payload.length;
    this.stats.bytesReceived += frame.payload.length;

    // Store data
    this.receivedData.push(frame.payload);

    // State transitions
    switch (this.state) {
      case HTTP2StreamState.OPEN:
        if (endStream) {
          this.setState(HTTP2StreamState.HALF_CLOSED_REMOTE);
        }
        break;

      case HTTP2StreamState.HALF_CLOSED_LOCAL:
        if (endStream) {
          this.setState(HTTP2StreamState.CLOSED);
        }
        break;

      default:
        // Invalid state for DATA
        break;
    }
  }

  /**
   * Handle WINDOW_UPDATE frame
   */
  private handleWindowUpdate(frame: HTTP2Frame): void {
    // Parse increment from payload
    const increment = (
      (frame.payload[0] << 24) |
      (frame.payload[1] << 16) |
      (frame.payload[2] << 8) |
      frame.payload[3]
    ) & 0x7fffffff;

    this.remoteWindowSize += increment;
  }

  /**
   * Handle PRIORITY frame
   */
  private handlePriorityFrame(frame: HTTP2Frame): void {
    const dependencyBytes = (frame.payload[0] << 24) |
      (frame.payload[1] << 16) |
      (frame.payload[2] << 8) |
      frame.payload[3];

    this.priority = {
      exclusive: !!(dependencyBytes & 0x80000000),
      streamDependency: dependencyBytes & 0x7fffffff,
      weight: frame.payload[4] + 1,
    };
  }

  /**
   * Send HEADERS frame
   */
  sendHeaders(endStream = false): void {
    // Update state
    switch (this.state) {
      case HTTP2StreamState.IDLE:
        this.setState(endStream ? HTTP2StreamState.HALF_CLOSED_LOCAL : HTTP2StreamState.OPEN);
        break;

      case HTTP2StreamState.RESERVED_LOCAL:
        this.setState(HTTP2StreamState.HALF_CLOSED_REMOTE);
        break;

      case HTTP2StreamState.OPEN:
        if (endStream) {
          this.setState(HTTP2StreamState.HALF_CLOSED_LOCAL);
        }
        break;

      default:
        throw new Error(`Cannot send HEADERS in state: ${this.state}`);
    }

    this.stats.framesSent++;
  }

  /**
   * Send DATA frame
   */
  sendData(length: number, endStream = false): void {
    // Check state
    if (
      this.state !== HTTP2StreamState.OPEN &&
      this.state !== HTTP2StreamState.HALF_CLOSED_REMOTE
    ) {
      throw new Error(`Cannot send DATA in state: ${this.state}`);
    }

    // Check flow control
    if (length > this.remoteWindowSize) {
      throw new Error("Flow control window exceeded");
    }

    // Update flow control
    this.remoteWindowSize -= length;
    this.stats.bytesSent += length;
    this.stats.framesSent++;

    // Update state
    if (endStream) {
      if (this.state === HTTP2StreamState.OPEN) {
        this.setState(HTTP2StreamState.HALF_CLOSED_LOCAL);
      } else if (this.state === HTTP2StreamState.HALF_CLOSED_REMOTE) {
        this.setState(HTTP2StreamState.CLOSED);
      }
    }
  }

  /**
   * Send RST_STREAM frame
   */
  sendReset(errorCode: HTTP2ErrorCode): void {
    this.setState(HTTP2StreamState.CLOSED);
    this.stats.framesSent++;
  }

  /**
   * Check if stream can receive data
   */
  canReceive(): boolean {
    return (
      this.state === HTTP2StreamState.OPEN ||
      this.state === HTTP2StreamState.HALF_CLOSED_LOCAL
    );
  }

  /**
   * Check if stream can send data
   */
  canSend(): boolean {
    return (
      this.state === HTTP2StreamState.OPEN ||
      this.state === HTTP2StreamState.HALF_CLOSED_REMOTE
    );
  }

  /**
   * Check if stream is closed
   */
  isClosed(): boolean {
    return this.state === HTTP2StreamState.CLOSED;
  }

  /**
   * Get received data
   */
  getReceivedData(): Uint8Array {
    if (this.receivedData.length === 0) {
      return new Uint8Array(0);
    }

    // Concatenate all received data
    const totalLength = this.receivedData.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;

    for (const chunk of this.receivedData) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  }

  /**
   * Get received headers
   */
  getReceivedHeaders(): Map<string, string> {
    return new Map(this.receivedHeaders);
  }

  /**
   * Set received headers
   */
  setReceivedHeaders(headers: Map<string, string>): void {
    this.receivedHeaders = headers;
  }

  /**
   * Check if headers are complete
   */
  areHeadersComplete(): boolean {
    return this.headersComplete;
  }

  /**
   * Get local window size
   */
  getLocalWindowSize(): number {
    return this.localWindowSize;
  }

  /**
   * Get remote window size
   */
  getRemoteWindowSize(): number {
    return this.remoteWindowSize;
  }

  /**
   * Update local window size
   */
  updateLocalWindow(increment: number): void {
    this.localWindowSize += increment;
  }

  /**
   * Get priority
   */
  getPriority(): HTTP2StreamPriority | undefined {
    return this.priority;
  }

  /**
   * Set priority
   */
  setPriority(priority: HTTP2StreamPriority): void {
    this.priority = priority;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      id: this.id,
      state: this.state,
      bytesSent: this.stats.bytesSent,
      bytesReceived: this.stats.bytesReceived,
      framesSent: this.stats.framesSent,
      framesReceived: this.stats.framesReceived,
      localWindowSize: this.localWindowSize,
      remoteWindowSize: this.remoteWindowSize,
      priority: this.priority,
    };
  }
}

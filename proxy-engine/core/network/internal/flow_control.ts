/**
 * Flow Control
 *
 * Window-based flow control for network streams
 */

/**
 * Flow control window
 */
export interface FlowWindow {
  size: number;
  used: number;
  available: number;
}

/**
 * Flow control state
 */
export interface FlowControlState {
  sendWindow: FlowWindow;
  receiveWindow: FlowWindow;
  paused: boolean;
}

/**
 * Flow Controller
 */
export class FlowController {
  private sendWindowSize: number;
  private receiveWindowSize: number;
  private sendWindowUsed: number = 0;
  private receiveWindowUsed: number = 0;
  private paused: boolean = false;
  private waiters: Array<() => void> = [];

  constructor(
    sendWindowSize: number = 65536,
    receiveWindowSize: number = 65536,
  ) {
    this.sendWindowSize = sendWindowSize;
    this.receiveWindowSize = receiveWindowSize;
  }

  /**
   * Try to consume send window
   */
  consumeSend(bytes: number): boolean {
    if (this.sendWindowUsed + bytes > this.sendWindowSize) {
      return false;
    }

    this.sendWindowUsed += bytes;
    return true;
  }

  /**
   * Wait for send window availability
   */
  async waitForSendWindow(bytes: number): Promise<void> {
    while (!this.consumeSend(bytes)) {
      await new Promise<void>((resolve) => {
        this.waiters.push(resolve);
      });
    }
  }

  /**
   * Release send window
   */
  releaseSend(bytes: number): void {
    this.sendWindowUsed = Math.max(0, this.sendWindowUsed - bytes);

    // Notify waiters
    const waiters = this.waiters.splice(0);
    for (const resolve of waiters) {
      resolve();
    }
  }

  /**
   * Consume receive window
   */
  consumeReceive(bytes: number): boolean {
    if (this.receiveWindowUsed + bytes > this.receiveWindowSize) {
      return false;
    }

    this.receiveWindowUsed += bytes;

    // Pause if window is full
    if (this.receiveWindowUsed >= this.receiveWindowSize) {
      this.pause();
    }

    return true;
  }

  /**
   * Release receive window
   */
  releaseReceive(bytes: number): void {
    this.receiveWindowUsed = Math.max(0, this.receiveWindowUsed - bytes);

    // Resume if window has space
    if (this.receiveWindowUsed < this.receiveWindowSize) {
      this.resume();
    }
  }

  /**
   * Pause flow
   */
  pause(): void {
    this.paused = true;
  }

  /**
   * Resume flow
   */
  resume(): void {
    this.paused = false;
  }

  /**
   * Check if paused
   */
  isPaused(): boolean {
    return this.paused;
  }

  /**
   * Update send window size
   */
  updateSendWindow(newSize: number): void {
    this.sendWindowSize = newSize;

    // Notify waiters if window increased
    if (newSize > this.sendWindowUsed) {
      const waiters = this.waiters.splice(0);
      for (const resolve of waiters) {
        resolve();
      }
    }
  }

  /**
   * Update receive window size
   */
  updateReceiveWindow(newSize: number): void {
    this.receiveWindowSize = newSize;

    // Resume if window has space
    if (this.receiveWindowUsed < this.receiveWindowSize) {
      this.resume();
    }
  }

  /**
   * Get send window info
   */
  getSendWindow(): FlowWindow {
    return {
      size: this.sendWindowSize,
      used: this.sendWindowUsed,
      available: this.sendWindowSize - this.sendWindowUsed,
    };
  }

  /**
   * Get receive window info
   */
  getReceiveWindow(): FlowWindow {
    return {
      size: this.receiveWindowSize,
      used: this.receiveWindowUsed,
      available: this.receiveWindowSize - this.receiveWindowUsed,
    };
  }

  /**
   * Get flow control state
   */
  getState(): FlowControlState {
    return {
      sendWindow: this.getSendWindow(),
      receiveWindow: this.getReceiveWindow(),
      paused: this.paused,
    };
  }

  /**
   * Reset flow control
   */
  reset(): void {
    this.sendWindowUsed = 0;
    this.receiveWindowUsed = 0;
    this.paused = false;

    const waiters = this.waiters.splice(0);
    for (const resolve of waiters) {
      resolve();
    }
  }
}

/**
 * Stream flow controller
 */
export class StreamFlowController {
  private controller: FlowController;
  private streamId: string;

  constructor(streamId: string, windowSize: number = 65536) {
    this.streamId = streamId;
    this.controller = new FlowController(windowSize, windowSize);
  }

  /**
   * Write data to stream (with flow control)
   */
  async write(data: Uint8Array): Promise<void> {
    await this.controller.waitForSendWindow(data.length);
    // Actual write would happen here
  }

  /**
   * Read data from stream (with flow control)
   */
  read(data: Uint8Array): boolean {
    return this.controller.consumeReceive(data.length);
  }

  /**
   * Acknowledge data consumption
   */
  ack(bytes: number): void {
    this.controller.releaseReceive(bytes);
  }

  /**
   * Get stream ID
   */
  get id(): string {
    return this.streamId;
  }

  /**
   * Get flow control state
   */
  getState(): FlowControlState {
    return this.controller.getState();
  }

  /**
   * Pause stream
   */
  pause(): void {
    this.controller.pause();
  }

  /**
   * Resume stream
   */
  resume(): void {
    this.controller.resume();
  }

  /**
   * Check if paused
   */
  isPaused(): boolean {
    return this.controller.isPaused();
  }
}

/**
 * Connection flow controller (manages multiple streams)
 */
export class ConnectionFlowController {
  private streams: Map<string, StreamFlowController> = new Map();
  private connectionController: FlowController;

  constructor(windowSize: number = 65536) {
    this.connectionController = new FlowController(windowSize, windowSize);
  }

  /**
   * Create stream
   */
  createStream(streamId: string, windowSize?: number): StreamFlowController {
    const stream = new StreamFlowController(
      streamId,
      windowSize || this.connectionController.getSendWindow().size,
    );
    this.streams.set(streamId, stream);
    return stream;
  }

  /**
   * Get stream
   */
  getStream(streamId: string): StreamFlowController | undefined {
    return this.streams.get(streamId);
  }

  /**
   * Remove stream
   */
  removeStream(streamId: string): boolean {
    return this.streams.delete(streamId);
  }

  /**
   * Get all streams
   */
  getAllStreams(): StreamFlowController[] {
    return Array.from(this.streams.values());
  }

  /**
   * Update connection window
   */
  updateConnectionWindow(newSize: number): void {
    this.connectionController.updateSendWindow(newSize);
    this.connectionController.updateReceiveWindow(newSize);
  }

  /**
   * Get connection state
   */
  getConnectionState(): FlowControlState {
    return this.connectionController.getState();
  }
}

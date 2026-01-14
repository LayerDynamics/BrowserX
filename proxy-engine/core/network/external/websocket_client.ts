/**
 * WebSocket Client
 *
 * Client for establishing and managing WebSocket connections
 */

import { HTTPHeaders } from "../utils/headers.ts";

/**
 * WebSocket frame opcode
 */
export enum WebSocketOpcode {
  CONTINUATION = 0x0,
  TEXT = 0x1,
  BINARY = 0x2,
  CLOSE = 0x8,
  PING = 0x9,
  PONG = 0xA,
}

/**
 * WebSocket frame
 */
export interface WebSocketFrame {
  fin: boolean;
  opcode: WebSocketOpcode;
  masked: boolean;
  payload: Uint8Array;
}

/**
 * WebSocket message
 */
export interface WebSocketMessage {
  type: "text" | "binary";
  data: string | Uint8Array;
}

/**
 * WebSocket event handler
 */
export type WebSocketEventHandler = (event: WebSocketEvent) => void;

/**
 * WebSocket event
 */
export type WebSocketEvent =
  | { type: "open" }
  | { type: "message"; message: WebSocketMessage }
  | { type: "close"; code: number; reason: string }
  | { type: "error"; error: Error };

/**
 * WebSocket client options
 */
export interface WebSocketClientOptions {
  protocols?: string[];
  headers?: HTTPHeaders;
  pingInterval?: number;
  pongTimeout?: number;
  autoReconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

/**
 * WebSocket client
 */
export class WebSocketClient {
  private ws?: WebSocket;
  private url: string;
  private options: WebSocketClientOptions;
  private handlers = new Map<string, Set<WebSocketEventHandler>>();
  private pingTimer?: number;
  private pongTimer?: number;
  private reconnectAttempts = 0;
  private shouldReconnect = true;

  constructor(url: string, options: WebSocketClientOptions = {}) {
    this.url = url;
    this.options = {
      pingInterval: 30000,
      pongTimeout: 5000,
      autoReconnect: true,
      reconnectDelay: 1000,
      maxReconnectAttempts: 5,
      ...options,
    };
  }

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url, this.options.protocols);

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          this.startPingPong();
          this.emit({ type: "open" });
          resolve();
        };

        this.ws.onmessage = (event) => {
          const message: WebSocketMessage = {
            type: typeof event.data === "string" ? "text" : "binary",
            data: event.data,
          };
          this.emit({ type: "message", message });
        };

        this.ws.onclose = (event) => {
          this.stopPingPong();
          this.emit({
            type: "close",
            code: event.code,
            reason: event.reason,
          });

          // Auto-reconnect if enabled
          if (this.options.autoReconnect && this.shouldReconnect) {
            this.attemptReconnect();
          }
        };

        this.ws.onerror = () => {
          const error = new Error("WebSocket connection error");
          this.emit({ type: "error", error });
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Send text message
   */
  sendText(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not connected");
    }
    this.ws.send(text);
  }

  /**
   * Send binary message
   */
  sendBinary(data: Uint8Array): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not connected");
    }
    this.ws.send(data);
  }

  /**
   * Send ping frame
   */
  ping(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    // WebSocket API doesn't expose ping/pong directly
    // Send empty text message as keepalive
    this.ws.send("");
  }

  /**
   * Close connection
   */
  close(code = 1000, reason = ""): void {
    this.shouldReconnect = false;
    this.stopPingPong();
    if (this.ws) {
      this.ws.close(code, reason);
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Add event handler
   */
  on(handler: WebSocketEventHandler): () => void {
    const key = "default";
    if (!this.handlers.has(key)) {
      this.handlers.set(key, new Set());
    }
    this.handlers.get(key)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.handlers.get(key)?.delete(handler);
    };
  }

  /**
   * Emit event to handlers
   */
  private emit(event: WebSocketEvent): void {
    const handlers = this.handlers.get("default");
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event);
        } catch (error) {
          console.error("Error in WebSocket event handler:", error);
        }
      }
    }
  }

  /**
   * Start ping/pong keep-alive
   */
  private startPingPong(): void {
    if (!this.options.pingInterval) return;

    this.pingTimer = setInterval(() => {
      this.ping();

      // Set timeout for pong
      if (this.options.pongTimeout) {
        this.pongTimer = setTimeout(() => {
          // No pong received, close connection
          this.close(1001, "Pong timeout");
        }, this.options.pongTimeout);
      }
    }, this.options.pingInterval);
  }

  /**
   * Stop ping/pong keep-alive
   */
  private stopPingPong(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = undefined;
    }
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = undefined;
    }
  }

  /**
   * Attempt to reconnect
   */
  private attemptReconnect(): void {
    if (!this.options.maxReconnectAttempts ||
      this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      return;
    }

    this.reconnectAttempts++;
    const delay = this.options.reconnectDelay! * Math.pow(2, this.reconnectAttempts - 1);

    setTimeout(() => {
      if (this.shouldReconnect) {
        this.connect().catch(() => {
          // Reconnection failed, will retry if attempts remaining
        });
      }
    }, delay);
  }
}

/**
 * WebSocket frame encoder
 */
export class WebSocketFrameEncoder {
  /**
   * Encode frame to bytes
   */
  encode(frame: WebSocketFrame): Uint8Array {
    const payloadLength = frame.payload.length;
    let headerSize = 2;

    // Determine header size based on payload length
    if (payloadLength > 65535) {
      headerSize += 8;
    } else if (payloadLength > 125) {
      headerSize += 2;
    }

    if (frame.masked) {
      headerSize += 4; // Masking key
    }

    const buffer = new Uint8Array(headerSize + payloadLength);
    let offset = 0;

    // Byte 0: FIN and opcode
    buffer[offset++] = (frame.fin ? 0x80 : 0x00) | (frame.opcode & 0x0F);

    // Byte 1: Mask and payload length
    let byte1 = frame.masked ? 0x80 : 0x00;

    if (payloadLength <= 125) {
      byte1 |= payloadLength;
      buffer[offset++] = byte1;
    } else if (payloadLength <= 65535) {
      byte1 |= 126;
      buffer[offset++] = byte1;
      buffer[offset++] = (payloadLength >> 8) & 0xFF;
      buffer[offset++] = payloadLength & 0xFF;
    } else {
      byte1 |= 127;
      buffer[offset++] = byte1;
      // 64-bit length (only using lower 32 bits)
      buffer[offset++] = 0;
      buffer[offset++] = 0;
      buffer[offset++] = 0;
      buffer[offset++] = 0;
      buffer[offset++] = (payloadLength >> 24) & 0xFF;
      buffer[offset++] = (payloadLength >> 16) & 0xFF;
      buffer[offset++] = (payloadLength >> 8) & 0xFF;
      buffer[offset++] = payloadLength & 0xFF;
    }

    // Masking key
    if (frame.masked) {
      const mask = new Uint8Array(4);
      crypto.getRandomValues(mask);
      buffer.set(mask, offset);
      offset += 4;

      // Apply mask to payload
      for (let i = 0; i < payloadLength; i++) {
        buffer[offset + i] = frame.payload[i] ^ mask[i % 4];
      }
    } else {
      buffer.set(frame.payload, offset);
    }

    return buffer;
  }
}

/**
 * WebSocket frame decoder
 */
export class WebSocketFrameDecoder {
  private buffer = new Uint8Array(0);

  /**
   * Decode frames from data
   */
  decode(data: Uint8Array): WebSocketFrame[] {
    // Append to buffer
    const newBuffer = new Uint8Array(this.buffer.length + data.length);
    newBuffer.set(this.buffer);
    newBuffer.set(data, this.buffer.length);
    this.buffer = newBuffer;

    const frames: WebSocketFrame[] = [];

    while (this.buffer.length >= 2) {
      // Parse header
      const byte0 = this.buffer[0];
      const byte1 = this.buffer[1];

      const fin = (byte0 & 0x80) !== 0;
      const opcode = byte0 & 0x0F;
      const masked = (byte1 & 0x80) !== 0;
      let payloadLength = byte1 & 0x7F;
      let offset = 2;

      // Extended payload length
      if (payloadLength === 126) {
        if (this.buffer.length < 4) break;
        payloadLength = (this.buffer[2] << 8) | this.buffer[3];
        offset = 4;
      } else if (payloadLength === 127) {
        if (this.buffer.length < 10) break;
        // Read only lower 32 bits
        payloadLength = (this.buffer[6] << 24) | (this.buffer[7] << 16) |
          (this.buffer[8] << 8) | this.buffer[9];
        offset = 10;
      }

      // Masking key
      let mask: Uint8Array | undefined;
      if (masked) {
        if (this.buffer.length < offset + 4) break;
        mask = this.buffer.subarray(offset, offset + 4);
        offset += 4;
      }

      // Check if we have full frame
      if (this.buffer.length < offset + payloadLength) break;

      // Extract payload
      let payload = this.buffer.subarray(offset, offset + payloadLength);

      // Unmask if needed
      if (masked && mask) {
        const unmasked = new Uint8Array(payloadLength);
        for (let i = 0; i < payloadLength; i++) {
          unmasked[i] = payload[i] ^ mask[i % 4];
        }
        payload = unmasked;
      }

      frames.push({
        fin,
        opcode,
        masked,
        payload,
      });

      // Remove frame from buffer
      this.buffer = this.buffer.subarray(offset + payloadLength);
    }

    return frames;
  }
}

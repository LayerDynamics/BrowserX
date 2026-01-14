/**
 * TCP Connection
 *
 * High-level TCP connection implementation using the state machine
 */

import { Socket, SocketState } from "../socket/socket.ts";
import { TCPSegment, TCPState, TCPStateMachine } from "./tcp_state.ts";
import { StreamReader } from "../../primitive/buffer/stream_reader.ts";
import { StreamWriter } from "../../primitive/buffer/stream_writer.ts";

/**
 * TCP connection configuration
 */
export interface TCPConnectionConfig {
  /**
   * Connection timeout (ms)
   */
  timeout?: number;

  /**
   * Enable TCP_NODELAY (Nagle's algorithm)
   */
  noDelay?: boolean;

  /**
   * Enable TCP_KEEPALIVE
   */
  keepAlive?: boolean;

  /**
   * Keep-alive interval (ms)
   */
  keepAliveInterval?: number;

  /**
   * Send buffer size
   */
  sendBufferSize?: number;

  /**
   * Receive buffer size
   */
  receiveBufferSize?: number;
}

/**
 * TCP connection statistics
 */
export interface TCPConnectionStats {
  /**
   * Current TCP state
   */
  state: TCPState;

  /**
   * Total bytes sent
   */
  bytesSent: number;

  /**
   * Total bytes received
   */
  bytesReceived: number;

  /**
   * Total segments sent
   */
  segmentsSent: number;

  /**
   * Total segments received
   */
  segmentsReceived: number;

  /**
   * Retransmissions
   */
  retransmissions: number;

  /**
   * Round-trip time (ms)
   */
  rtt: number;

  /**
   * Congestion window
   */
  cwnd: number;

  /**
   * Connection duration (ms)
   */
  duration: number;
}

/**
 * TCP connection implementation
 */
export class TCPConnection {
  private socket: Socket;
  private stateMachine: TCPStateMachine;
  private reader: StreamReader;
  private writer: StreamWriter;
  private connected = false;
  private startTime = 0;

  // Statistics
  private stats = {
    bytesSent: 0,
    bytesReceived: 0,
    segmentsSent: 0,
    segmentsReceived: 0,
    retransmissions: 0,
  };

  // Send queue for flow control
  private sendQueue: Uint8Array[] = [];
  private sending = false;

  constructor(
    socket: Socket,
    private config: TCPConnectionConfig = {},
  ) {
    this.socket = socket;
    this.stateMachine = new TCPStateMachine();
    this.reader = new StreamReader(socket);
    this.writer = new StreamWriter(socket);
  }

  /**
   * Connect to remote host (active open)
   */
  async connect(): Promise<void> {
    if (this.connected) {
      throw new Error("Already connected");
    }

    this.startTime = Date.now();

    // Perform TCP handshake
    await this.performHandshake();

    // Configure socket options
    if (this.config.noDelay !== undefined || this.config.keepAlive !== undefined) {
      await this.socket.setOptions({
        tcpNoDelay: this.config.noDelay,
        tcpKeepAlive: this.config.keepAlive,
      });
    }

    this.connected = true;
  }

  /**
   * Accept connection (passive open)
   */
  async accept(): Promise<void> {
    if (this.connected) {
      throw new Error("Already connected");
    }

    this.startTime = Date.now();

    // Transition to LISTEN
    this.stateMachine.processEvent({ type: "PASSIVE_OPEN" });

    // Wait for SYN from client (simulated - in practice handled by OS)
    // In a real implementation, this would wait for and process incoming SYN

    this.connected = true;
  }

  /**
   * Send data
   */
  async send(data: Uint8Array): Promise<void> {
    if (!this.connected) {
      throw new Error("Not connected");
    }

    if (this.stateMachine.getState() !== TCPState.ESTABLISHED) {
      throw new Error(`Cannot send data in state: ${this.stateMachine.getState()}`);
    }

    // Add to send queue
    this.sendQueue.push(data);

    // Process send queue
    await this.processSendQueue();
  }

  /**
   * Receive data
   */
  async receive(maxBytes?: number): Promise<Uint8Array> {
    if (!this.connected) {
      throw new Error("Not connected");
    }

    const data = await this.reader.read(maxBytes || 65536); // Default to 64KB

    if (data) {
      this.stats.bytesReceived += data.length;
      this.stats.segmentsReceived++;
    }

    return data || new Uint8Array(0);
  }

  /**
   * Close connection (active close)
   */
  async close(): Promise<void> {
    if (!this.connected) {
      return;
    }

    // Initiate TCP termination
    await this.performTermination();

    this.connected = false;
    this.socket.close();
  }

  /**
   * Abort connection (send RST)
   */
  abort(): void {
    this.stateMachine.processEvent({ type: "ABORT" });
    this.connected = false;
    this.socket.close();
  }

  /**
   * Check if connection is established
   */
  isEstablished(): boolean {
    return this.stateMachine.getState() === TCPState.ESTABLISHED;
  }

  /**
   * Get current TCP state
   */
  getState(): TCPState {
    return this.stateMachine.getState();
  }

  /**
   * Get connection statistics
   */
  getStats(): TCPConnectionStats {
    const duration = this.startTime > 0 ? Date.now() - this.startTime : 0;
    const machineStats = this.stateMachine.getStats();

    return {
      state: machineStats.state,
      bytesSent: this.stats.bytesSent,
      bytesReceived: this.stats.bytesReceived,
      segmentsSent: this.stats.segmentsSent,
      segmentsReceived: this.stats.segmentsReceived,
      retransmissions: this.stats.retransmissions,
      rtt: machineStats.smoothedRTT,
      cwnd: machineStats.cwnd,
      duration,
    };
  }

  /**
   * Perform TCP three-way handshake
   */
  private async performHandshake(): Promise<void> {
    const startTime = Date.now();

    // Send SYN
    const synSegment = this.stateMachine.processEvent({ type: "ACTIVE_OPEN" });
    if (synSegment) {
      await this.sendSegment(synSegment);
    }

    // Wait for SYN+ACK (simulated)
    // In practice, this would read from socket and parse TCP header
    const timeout = this.config.timeout || 30000;
    const synAckReceived = await this.waitForSegment(timeout);

    if (!synAckReceived) {
      throw new Error("Handshake timeout");
    }

    // Send ACK
    const ackSegment = this.stateMachine.processEvent({
      type: "RECEIVE",
      segment: synAckReceived,
    });

    if (ackSegment) {
      await this.sendSegment(ackSegment);
    }

    // Update RTT estimate
    const rtt = Date.now() - startTime;
    this.stateMachine.updateRTT(rtt);
  }

  /**
   * Perform TCP four-way termination
   */
  private async performTermination(): Promise<void> {
    // Send FIN
    const finSegment = this.stateMachine.processEvent({ type: "CLOSE" });
    if (finSegment) {
      await this.sendSegment(finSegment);
    }

    // Wait for ACK and FIN from remote
    // In practice, this would handle the full 4-way termination

    // For now, just wait a bit and close
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  /**
   * Process send queue with flow control
   */
  private async processSendQueue(): Promise<void> {
    if (this.sending || this.sendQueue.length === 0) {
      return;
    }

    this.sending = true;

    try {
      while (this.sendQueue.length > 0) {
        const data = this.sendQueue.shift()!;

        // Create data segment
        const segment = this.stateMachine.processEvent({
          type: "SEND",
          data,
        });

        if (segment) {
          await this.sendSegment(segment);
          this.stats.bytesSent += data.length;
        }
      }
    } finally {
      this.sending = false;
    }
  }

  /**
   * Send TCP segment
   */
  private async sendSegment(segment: TCPSegment): Promise<void> {
    // In a real implementation, this would:
    // 1. Build TCP header with flags, sequence numbers, etc.
    // 2. Calculate checksum
    // 3. Send raw bytes over socket

    // For now, just send the data portion if it exists
    if (segment.data.length > 0) {
      await this.writer.write(segment.data);
      await this.writer.flush();
    }

    this.stats.segmentsSent++;
  }

  /**
   * Wait for and parse TCP segment
   */
  private async waitForSegment(timeout: number): Promise<TCPSegment | null> {
    // In a real implementation, this would:
    // 1. Read TCP header from socket
    // 2. Parse flags, sequence numbers, etc.
    // 3. Verify checksum
    // 4. Return parsed segment

    // For now, simulate receiving SYN+ACK
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve(null);
      }, timeout);

      // Simulate SYN+ACK arrival
      setTimeout(() => {
        clearTimeout(timer);
        resolve({
          sourcePort: 0,
          destPort: 0,
          sequenceNumber: Math.floor(Math.random() * 0xffffffff),
          acknowledgmentNumber: 0,
          flags: {
            SYN: true,
            ACK: true,
            FIN: false,
            RST: false,
            PSH: false,
            URG: false,
          },
          windowSize: 65535,
          data: new Uint8Array(0),
        });
      }, 10);
    });
  }

  /**
   * Create TCP connection from existing socket
   */
  static fromSocket(socket: Socket, config?: TCPConnectionConfig): TCPConnection {
    return new TCPConnection(socket, config);
  }
}

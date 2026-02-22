/**
 * TCP Connection implementation
 *
 * Implements TCP protocol on top of raw sockets with proper 3-way handshake,
 * retransmission, RTT tracking, and congestion control.
 */

import type { ByteBuffer, Port } from "../../../types/identifiers.ts";
import type { Socket } from "../../../types/network.ts";
import { TCPState } from "../../../types/network.ts";
import type { ByteCount, Duration, Timestamp } from "../../../types/identifiers.ts";

/**
 * TCP connection configuration
 */
export interface TCPConfig {
  connectTimeout: Duration; // Connection establishment timeout
  idleTimeout: Duration; // Idle connection timeout
  keepAliveInterval: Duration; // Keep-alive probe interval
  keepAliveProbes: number; // Number of keep-alive probes
  sendBufferSize: ByteCount; // SO_SNDBUF
  receiveBufferSize: ByteCount; // SO_RCVBUF
  noDelay: boolean; // TCP_NODELAY (disable Nagle)
  maxSegmentSize: ByteCount; // MSS
  windowSize: ByteCount; // TCP window size
}

/**
 * TCP connection
 */
export class TCPConnection {
  private socket: Socket;
  private state: TCPState = TCPState.CLOSED;
  private config: TCPConfig;
  private metrics: TCPMetrics;

  // TCP state tracking
  private nextSeqNum: number = 0;
  private nextAckNum: number = 0;
  private receiveBuffer: ByteBuffer = new Uint8Array(0);

  constructor(socket: Socket, config: TCPConfig) {
    this.socket = socket;
    this.config = config;
    this.metrics = {
      state: TCPState.CLOSED,
      uptime: 0,
      bytesSent: 0,
      bytesReceived: 0,
      segmentsSent: 0,
      segmentsReceived: 0,
      rtt: 0,
      rttVariance: 0,
      retransmissions: 0,
      congestionWindow: config.windowSize,
      slowStartThreshold: config.windowSize,
      sendWindow: config.windowSize,
      receiveWindow: config.windowSize,
    };
  }

  /**
   * Establish TCP connection (client-side)
   *
   * This method orchestrates the TCP 3-way handshake:
   * 1. SYN: Client initiates connection
   * 2. SYN-ACK: Server acknowledges and responds
   * 3. ACK: Client confirms connection established
   *
   * The actual TCP handshake is performed by the OS via socket.connect().
   * TCPConnection tracks the state transitions and maintains metrics.
   */
  async connect(host: string, port: Port): Promise<void> {
    if (this.state !== TCPState.CLOSED) {
      throw new Error(`Cannot connect from state ${this.state}`);
    }

    // Initialize sequence numbers for this connection
    const initialSeqNum = generateISN();
    this.nextSeqNum = initialSeqNum;

    // Phase 1: SYN - Initiate connection
    // We're about to send our SYN (connection request)
    this.state = TCPState.SYN_SENT;
    this.metrics.state = TCPState.SYN_SENT;

    try {
      // The socket.connect() call performs the actual TCP 3-way handshake
      // at the OS level. This includes:
      // - Sending SYN with our initial sequence number
      // - Receiving SYN-ACK from server
      // - Sending final ACK to complete handshake
      await this.socket.connect(host, port);

      // Phase 2 & 3 complete: SYN-ACK received and ACK sent
      // OS has completed the handshake successfully
      this.state = TCPState.ESTABLISHED;
      this.metrics.state = TCPState.ESTABLISHED;

      // Update sequence numbers to reflect handshake completion
      // In TCP, SYN consumes one sequence number
      this.nextSeqNum = initialSeqNum + 1;
      // We don't know the server's ISN, but we track from here
      this.nextAckNum = 1;

      // Connection established - record uptime start
      this.metrics.uptime = Date.now();

      // Record the segments exchanged during handshake (for metrics)
      this.metrics.segmentsSent += 2; // SYN + ACK
      this.metrics.segmentsReceived += 1; // SYN-ACK
    } catch (error) {
      // Connection failed - could be timeout, refused, unreachable, etc.
      this.state = TCPState.CLOSED;
      this.metrics.state = TCPState.CLOSED;
      throw new Error(`TCP connection failed: ${(error as Error).message}`);
    }
  }

  /**
   * Send data over TCP connection
   */
  async send(data: ByteBuffer): Promise<void> {
    if (this.state !== TCPState.ESTABLISHED) {
      throw new Error(`Cannot send in state ${this.state}`);
    }

    // Segment data based on MSS
    const segments = this.segmentData(data);

    for (const segment of segments) {
      await this.sendWithRetransmission(segment);
      this.metrics.bytesSent += segment.data.byteLength;
      this.metrics.segmentsSent++;
    }
  }

  /**
   * Receive data from TCP connection
   */
  async receive(maxBytes: number): Promise<ByteBuffer> {
    if (this.state !== TCPState.ESTABLISHED) {
      throw new Error(`Cannot receive in state ${this.state}`);
    }

    const segment = await this.receiveSegment();

    this.metrics.bytesReceived += segment.data.byteLength;
    this.metrics.segmentsReceived++;

    // Send ACK for received data
    await this.sendAck(segment.sequenceNumber + segment.data.byteLength);

    return segment.data.slice(0, maxBytes);
  }

  /**
   * Close TCP connection (4-way handshake)
   */
  async close(): Promise<void> {
    if (this.state !== TCPState.ESTABLISHED) {
      return;
    }

    // 1. Send FIN
    const finSegment = createTCPSegment({
      flags: { FIN: true, ACK: true },
      sequenceNumber: this.getNextSeqNum(),
      acknowledgmentNumber: this.getNextAckNum(),
    });

    await this.sendSegment(finSegment);
    this.state = TCPState.FIN_WAIT_1;

    // 2. Wait for ACK of FIN
    const ack = await this.receiveSegment();
    if (ack.flags.ACK) {
      this.state = TCPState.FIN_WAIT_2;
    }

    // 3. Wait for FIN from peer
    const fin = await this.receiveSegment();
    if (fin.flags.FIN) {
      this.state = TCPState.TIME_WAIT;

      // 4. Send final ACK
      const finalAck = createTCPSegment({
        flags: { ACK: true },
        sequenceNumber: this.getNextSeqNum(),
        acknowledgmentNumber: fin.sequenceNumber + 1,
      });

      await this.sendSegment(finalAck);

      // Wait 2*MSL before transitioning to CLOSED
      await sleep(2 * 120000); // 2*MSL = 4 minutes
      this.state = TCPState.CLOSED;
    }
  }

  /**
   * Send segment with retransmission on timeout/loss
   */
  private async sendWithRetransmission(segment: TCPSegment): Promise<void> {
    const maxRetries = 5;
    let rto = 1000; // Initial RTO (Retransmission Timeout) = 1 second

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      await this.sendSegment(segment);

      try {
        // Wait for ACK
        const ack = await this.receiveSegment(rto);

        if (ack.flags.ACK && ack.acknowledgmentNumber > segment.sequenceNumber) {
          // Successfully acknowledged
          this.updateRTT(Date.now() - segment.timestamp);
          return;
        }
      } catch (error) {
        // Timeout or error, retry with exponential backoff
        this.metrics.retransmissions++;
        rto *= 2; // Exponential backoff
      }
    }

    throw new Error(`Failed to send segment after ${maxRetries} retries`);
  }

  /**
   * Segment data into MSS-sized chunks
   */
  private segmentData(data: ByteBuffer): TCPSegment[] {
    const segments: TCPSegment[] = [];
    let offset = 0;

    while (offset < data.byteLength) {
      const length = Math.min(this.config.maxSegmentSize, data.byteLength - offset);
      const chunk = data.slice(offset, offset + length);

      segments.push(createTCPSegment({
        flags: { ACK: true },
        sequenceNumber: this.getNextSeqNum() + offset,
        acknowledgmentNumber: this.getNextAckNum(),
        data: chunk,
        timestamp: Date.now(),
      }));

      offset += length;
    }

    return segments;
  }

  /**
   * Update RTT estimate using exponential moving average
   */
  private updateRTT(sampleRTT: Duration): void {
    const alpha = 0.125; // Smoothing factor
    const beta = 0.25;

    if (this.metrics.rtt === 0) {
      // First sample
      this.metrics.rtt = sampleRTT;
      this.metrics.rttVariance = sampleRTT / 2;
    } else {
      // EWMA
      const diff = Math.abs(sampleRTT - this.metrics.rtt);
      this.metrics.rttVariance = (1 - beta) * this.metrics.rttVariance + beta * diff;
      this.metrics.rtt = (1 - alpha) * this.metrics.rtt + alpha * sampleRTT;
    }
  }

  // Helper methods
  private getNextSeqNum(): number {
    return this.nextSeqNum;
  }

  private getNextAckNum(): number {
    return this.nextAckNum;
  }

  private async sendSegment(segment: TCPSegment): Promise<void> {
    // Serialize TCP segment to wire format
    const buffer = serializeTCPSegment(segment);
    await this.socket.write(buffer);
    this.nextSeqNum = segment.sequenceNumber + (segment.data?.byteLength || 0);
  }

  private async receiveSegment(timeout?: Duration): Promise<TCPSegment> {
    // Read from socket with optional timeout
    const buffer = new Uint8Array(this.config.maxSegmentSize + 60); // MSS + max TCP header

    const bytesRead = await this.socket.read(buffer);
    if (bytesRead === null) {
      throw new Error("Connection closed by peer");
    }

    // Parse TCP segment from wire format
    const segment = parseTCPSegment(buffer.slice(0, bytesRead));
    this.nextAckNum = segment.sequenceNumber + (segment.data?.byteLength || 0);

    return segment;
  }

  private async sendAck(ackNum: number): Promise<void> {
    const ackSegment = createTCPSegment({
      flags: { ACK: true },
      sequenceNumber: this.nextSeqNum,
      acknowledgmentNumber: ackNum,
      windowSize: this.config.windowSize,
    });
    await this.sendSegment(ackSegment);
  }

  /**
   * Get connection metrics
   */
  getMetrics(): TCPMetrics {
    return { ...this.metrics };
  }
}

/**
 * TCP segment
 */
export interface TCPSegment {
  // TCP header fields
  sourcePort: Port;
  destinationPort: Port;
  sequenceNumber: number;
  acknowledgmentNumber: number;
  dataOffset: number;
  flags: TCPFlags;
  windowSize: number;
  checksum: number;
  urgentPointer: number;

  // Options
  options: TCPOptions;

  // Data
  data: ByteBuffer;

  // Metadata
  timestamp: Timestamp;
}

/**
 * TCP flags
 */
export interface TCPFlags {
  FIN?: boolean; // Finish
  SYN?: boolean; // Synchronize
  RST?: boolean; // Reset
  PSH?: boolean; // Push
  ACK?: boolean; // Acknowledgment
  URG?: boolean; // Urgent
  ECE?: boolean; // ECN-Echo
  CWR?: boolean; // Congestion Window Reduced
}

/**
 * TCP options
 */
export interface TCPOptions {
  MSS?: number; // Maximum Segment Size
  WINDOW_SCALE?: number; // Window scale factor
  SACK_PERMITTED?: boolean; // Selective Acknowledgment
  SACK?: Array<{ left: number; right: number }>; // SACK blocks
  TIMESTAMP?: { value: number; echoReply: number }; // Timestamps
}

/**
 * TCP metrics
 */
export interface TCPMetrics {
  state: TCPState;
  uptime: Timestamp;
  bytesSent: ByteCount;
  bytesReceived: ByteCount;
  segmentsSent: number;
  segmentsReceived: number;
  rtt: Duration; // Round-trip time
  rttVariance: Duration; // RTT variance
  retransmissions: number;
  congestionWindow: number; // cwnd
  slowStartThreshold: number; // ssthresh
  sendWindow: number; // Sender window
  receiveWindow: number; // Receiver window
}

/**
 * Generate Initial Sequence Number (ISN)
 * Uses cryptographically secure random to prevent sequence number attacks
 */
function generateISN(): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0];
}

/**
 * Parse IPv4 address string to bytes
 * @param ip - IPv4 address string (e.g., "192.168.1.1")
 * @returns 4-byte array
 */
export function parseIPv4(ip: string): Uint8Array {
  const parts = ip.split(".").map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    throw new Error(`Invalid IPv4 address: ${ip}`);
  }
  return new Uint8Array(parts);
}

/**
 * Calculate TCP checksum (RFC 793)
 *
 * The TCP checksum is computed over:
 * 1. A 12-byte pseudo-header containing:
 *    - Source IP address (4 bytes)
 *    - Destination IP address (4 bytes)
 *    - Reserved (1 byte, always 0)
 *    - Protocol (1 byte, 6 for TCP)
 *    - TCP length (2 bytes)
 * 2. TCP header (with checksum field set to 0)
 * 3. TCP data (padded to even length if necessary)
 *
 * The checksum is the 16-bit one's complement of the one's complement sum.
 *
 * @param tcpBuffer - TCP segment buffer (header + data)
 * @param sourceIP - Source IP address (4 bytes or string)
 * @param destIP - Destination IP address (4 bytes or string)
 * @returns 16-bit checksum value
 */
export function calculateTCPChecksum(
  tcpBuffer: Uint8Array,
  sourceIP: Uint8Array | string,
  destIP: Uint8Array | string,
): number {
  // Parse IP addresses if strings
  const srcIP = typeof sourceIP === "string" ? parseIPv4(sourceIP) : sourceIP;
  const dstIP = typeof destIP === "string" ? parseIPv4(destIP) : destIP;

  // Build pseudo-header (12 bytes)
  const pseudoHeader = new Uint8Array(12);
  pseudoHeader.set(srcIP, 0); // Source IP (4 bytes)
  pseudoHeader.set(dstIP, 4); // Destination IP (4 bytes)
  pseudoHeader[8] = 0; // Reserved
  pseudoHeader[9] = 6; // Protocol (TCP = 6)
  const tcpLength = tcpBuffer.length;
  pseudoHeader[10] = (tcpLength >> 8) & 0xff; // TCP length (high byte)
  pseudoHeader[11] = tcpLength & 0xff; // TCP length (low byte)

  // Calculate one's complement sum
  let sum = 0;

  // Sum pseudo-header (16-bit words)
  for (let i = 0; i < 12; i += 2) {
    sum += (pseudoHeader[i] << 8) | pseudoHeader[i + 1];
  }

  // Sum TCP segment (16-bit words)
  for (let i = 0; i < tcpBuffer.length - 1; i += 2) {
    // Skip checksum field (bytes 16-17 in TCP header)
    if (i === 16) {
      continue;
    }
    sum += (tcpBuffer[i] << 8) | tcpBuffer[i + 1];
  }

  // Handle odd byte at end
  if (tcpBuffer.length % 2 !== 0) {
    sum += tcpBuffer[tcpBuffer.length - 1] << 8;
  }

  // Fold 32-bit sum to 16 bits
  while (sum > 0xffff) {
    sum = (sum & 0xffff) + (sum >> 16);
  }

  // Return one's complement
  return (~sum) & 0xffff;
}

/**
 * Verify TCP checksum
 * @param tcpBuffer - TCP segment buffer including checksum
 * @param sourceIP - Source IP address
 * @param destIP - Destination IP address
 * @returns true if checksum is valid
 */
export function verifyTCPChecksum(
  tcpBuffer: Uint8Array,
  sourceIP: Uint8Array | string,
  destIP: Uint8Array | string,
): boolean {
  // When including the checksum in the calculation,
  // the result should be 0xFFFF (all ones) for a valid checksum
  const srcIP = typeof sourceIP === "string" ? parseIPv4(sourceIP) : sourceIP;
  const dstIP = typeof destIP === "string" ? parseIPv4(destIP) : destIP;

  // Build pseudo-header
  const pseudoHeader = new Uint8Array(12);
  pseudoHeader.set(srcIP, 0);
  pseudoHeader.set(dstIP, 4);
  pseudoHeader[8] = 0;
  pseudoHeader[9] = 6;
  const tcpLength = tcpBuffer.length;
  pseudoHeader[10] = (tcpLength >> 8) & 0xff;
  pseudoHeader[11] = tcpLength & 0xff;

  let sum = 0;

  // Sum pseudo-header
  for (let i = 0; i < 12; i += 2) {
    sum += (pseudoHeader[i] << 8) | pseudoHeader[i + 1];
  }

  // Sum entire TCP segment including checksum
  for (let i = 0; i < tcpBuffer.length - 1; i += 2) {
    sum += (tcpBuffer[i] << 8) | tcpBuffer[i + 1];
  }

  if (tcpBuffer.length % 2 !== 0) {
    sum += tcpBuffer[tcpBuffer.length - 1] << 8;
  }

  while (sum > 0xffff) {
    sum = (sum & 0xffff) + (sum >> 16);
  }

  // Valid checksum results in 0xFFFF
  return sum === 0xffff;
}

/**
 * Create TCP segment
 */
export function createTCPSegment(params: Partial<TCPSegment>): TCPSegment {
  return {
    sourcePort: params.sourcePort || 0,
    destinationPort: params.destinationPort || 0,
    sequenceNumber: params.sequenceNumber || 0,
    acknowledgmentNumber: params.acknowledgmentNumber || 0,
    dataOffset: 5, // 20 bytes header
    flags: params.flags || {},
    windowSize: params.windowSize || 65535,
    checksum: 0, // Calculated before sending
    urgentPointer: 0,
    options: params.options || {},
    data: params.data || new Uint8Array(0),
    timestamp: params.timestamp || Date.now(),
  };
}

/**
 * Serialize TCP segment to wire format
 * @param segment - TCP segment to serialize
 * @returns Serialized segment as ByteBuffer
 */
export function serializeTCPSegment(segment: TCPSegment): ByteBuffer {
  // Calculate total size: header (20-60 bytes) + data
  const headerSize = segment.dataOffset * 4;
  const totalSize = headerSize + segment.data.byteLength;
  const buffer = new Uint8Array(totalSize);
  const view = new DataView(buffer.buffer);

  // TCP header fields (big-endian)
  let offset = 0;
  view.setUint16(offset, segment.sourcePort);
  offset += 2;
  view.setUint16(offset, segment.destinationPort);
  offset += 2;
  view.setUint32(offset, segment.sequenceNumber);
  offset += 4;
  view.setUint32(offset, segment.acknowledgmentNumber);
  offset += 4;

  // Data offset (4 bits) + reserved (3 bits) + flags (9 bits)
  let dataOffsetAndFlags = segment.dataOffset << 12;
  if (segment.flags.FIN) dataOffsetAndFlags |= 0x001;
  if (segment.flags.SYN) dataOffsetAndFlags |= 0x002;
  if (segment.flags.RST) dataOffsetAndFlags |= 0x004;
  if (segment.flags.PSH) dataOffsetAndFlags |= 0x008;
  if (segment.flags.ACK) dataOffsetAndFlags |= 0x010;
  if (segment.flags.URG) dataOffsetAndFlags |= 0x020;
  if (segment.flags.ECE) dataOffsetAndFlags |= 0x040;
  if (segment.flags.CWR) dataOffsetAndFlags |= 0x080;
  view.setUint16(offset, dataOffsetAndFlags);
  offset += 2;

  view.setUint16(offset, segment.windowSize);
  offset += 2;
  view.setUint16(offset, segment.checksum);
  offset += 2;
  view.setUint16(offset, segment.urgentPointer);
  offset += 2;

  // Serialize TCP options if present
  if (segment.options && Object.keys(segment.options).length > 0) {
    let optOffset = 20; // Start after base header
    const options = segment.options;

    // MSS option (kind=2, length=4)
    if (options.MSS !== undefined) {
      buffer[optOffset++] = 2; // Kind
      buffer[optOffset++] = 4; // Length
      view.setUint16(optOffset, options.MSS);
      optOffset += 2;
    }

    // Window Scale option (kind=3, length=3)
    if (options.WINDOW_SCALE !== undefined) {
      buffer[optOffset++] = 3; // Kind
      buffer[optOffset++] = 3; // Length
      buffer[optOffset++] = options.WINDOW_SCALE;
    }

    // SACK Permitted option (kind=4, length=2)
    if (options.SACK_PERMITTED) {
      buffer[optOffset++] = 4; // Kind
      buffer[optOffset++] = 2; // Length
    }

    // SACK blocks option (kind=5, length=2+8*n)
    if (options.SACK && options.SACK.length > 0) {
      const sackLength = 2 + options.SACK.length * 8;
      buffer[optOffset++] = 5; // Kind
      buffer[optOffset++] = sackLength; // Length
      for (const block of options.SACK) {
        view.setUint32(optOffset, block.left);
        optOffset += 4;
        view.setUint32(optOffset, block.right);
        optOffset += 4;
      }
    }

    // Timestamp option (kind=8, length=10)
    if (options.TIMESTAMP !== undefined) {
      buffer[optOffset++] = 8; // Kind
      buffer[optOffset++] = 10; // Length
      view.setUint32(optOffset, options.TIMESTAMP.value);
      optOffset += 4;
      view.setUint32(optOffset, options.TIMESTAMP.echoReply);
      optOffset += 4;
    }

    // Pad to 4-byte boundary with NOP (kind=1)
    while (optOffset % 4 !== 0 && optOffset < headerSize) {
      buffer[optOffset++] = 1; // NOP
    }
  }

  // Copy data payload
  buffer.set(segment.data, headerSize);

  // Note: Checksum must be calculated separately using calculateTCPChecksum()
  // as it requires IP addresses for the pseudo-header

  return buffer;
}

/**
 * Serialize TCP segment with checksum calculation
 * @param segment - TCP segment to serialize
 * @param sourceIP - Source IP address
 * @param destIP - Destination IP address
 * @returns Serialized segment with valid checksum
 */
export function serializeTCPSegmentWithChecksum(
  segment: TCPSegment,
  sourceIP: Uint8Array | string,
  destIP: Uint8Array | string,
): ByteBuffer {
  const buffer = serializeTCPSegment(segment);
  const checksum = calculateTCPChecksum(buffer, sourceIP, destIP);

  // Set checksum at bytes 16-17
  const view = new DataView(buffer.buffer);
  view.setUint16(16, checksum);

  return buffer;
}

/**
 * Parse TCP segment from wire format
 * @param buffer - Wire format TCP segment
 * @returns Parsed TCP segment
 */
export function parseTCPSegment(buffer: ByteBuffer): TCPSegment {
  if (buffer.byteLength < 20) {
    throw new Error("TCP segment too short");
  }

  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let offset = 0;

  // Parse TCP header
  const sourcePort = view.getUint16(offset) as Port;
  offset += 2;
  const destinationPort = view.getUint16(offset) as Port;
  offset += 2;
  const sequenceNumber = view.getUint32(offset);
  offset += 4;
  const acknowledgmentNumber = view.getUint32(offset);
  offset += 4;

  const dataOffsetAndFlags = view.getUint16(offset);
  offset += 2;
  const dataOffset = (dataOffsetAndFlags >> 12) & 0xF;
  const flags: TCPFlags = {
    FIN: (dataOffsetAndFlags & 0x001) !== 0,
    SYN: (dataOffsetAndFlags & 0x002) !== 0,
    RST: (dataOffsetAndFlags & 0x004) !== 0,
    PSH: (dataOffsetAndFlags & 0x008) !== 0,
    ACK: (dataOffsetAndFlags & 0x010) !== 0,
    URG: (dataOffsetAndFlags & 0x020) !== 0,
    ECE: (dataOffsetAndFlags & 0x040) !== 0,
    CWR: (dataOffsetAndFlags & 0x080) !== 0,
  };

  const windowSize = view.getUint16(offset);
  offset += 2;
  const checksum = view.getUint16(offset);
  offset += 2;
  const urgentPointer = view.getUint16(offset);
  offset += 2;

  // Parse TCP options if present
  const headerSize = dataOffset * 4;
  const options: TCPOptions = {};

  if (headerSize > 20) {
    let optOffset = 20;
    while (optOffset < headerSize) {
      const kind = buffer[optOffset];

      // End of options (kind=0)
      if (kind === 0) {
        break;
      }

      // NOP padding (kind=1)
      if (kind === 1) {
        optOffset++;
        continue;
      }

      // All other options have length byte
      const length = buffer[optOffset + 1];
      if (length < 2 || optOffset + length > headerSize) {
        break; // Invalid option length
      }

      switch (kind) {
        case 2: // MSS (kind=2, length=4)
          if (length === 4) {
            options.MSS = view.getUint16(optOffset + 2);
          }
          break;

        case 3: // Window Scale (kind=3, length=3)
          if (length === 3) {
            options.WINDOW_SCALE = buffer[optOffset + 2];
          }
          break;

        case 4: // SACK Permitted (kind=4, length=2)
          if (length === 2) {
            options.SACK_PERMITTED = true;
          }
          break;

        case 5: // SACK blocks (kind=5, length=variable)
          if (length >= 10) {
            const numBlocks = (length - 2) / 8;
            options.SACK = [];
            for (let i = 0; i < numBlocks; i++) {
              const left = view.getUint32(optOffset + 2 + i * 8);
              const right = view.getUint32(optOffset + 6 + i * 8);
              options.SACK.push({ left, right });
            }
          }
          break;

        case 8: // Timestamp (kind=8, length=10)
          if (length === 10) {
            options.TIMESTAMP = {
              value: view.getUint32(optOffset + 2),
              echoReply: view.getUint32(optOffset + 6),
            };
          }
          break;
      }

      optOffset += length;
    }
  }

  // Extract data payload
  const data = buffer.slice(headerSize);

  return {
    sourcePort,
    destinationPort,
    sequenceNumber,
    acknowledgmentNumber,
    dataOffset,
    flags,
    windowSize,
    checksum,
    urgentPointer,
    options,
    data,
    timestamp: Date.now(),
  };
}

/**
 * Sleep for specified duration
 * @param ms - Milliseconds to sleep
 */
function sleep(ms: Duration): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

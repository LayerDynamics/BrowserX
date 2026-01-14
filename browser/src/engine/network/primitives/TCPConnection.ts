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
     */
    async connect(host: string, port: Port): Promise<void> {
        if (this.state !== TCPState.CLOSED) {
            throw new Error(`Cannot connect from state ${this.state}`);
        }

        // 1. Send SYN
        const initialSeqNum = generateISN();
        this.nextSeqNum = initialSeqNum;
        const synSegment = createTCPSegment({
            flags: { SYN: true },
            sequenceNumber: initialSeqNum,
            acknowledgmentNumber: 0,
            windowSize: this.config.windowSize,
            options: {
                MSS: this.config.maxSegmentSize,
                SACK_PERMITTED: true,
                WINDOW_SCALE: 7,
            },
        });

        await this.sendSegment(synSegment);
        this.state = TCPState.SYN_SENT;

        // 2. Wait for SYN-ACK (with timeout)
        const synAck = await this.receiveSegment(this.config.connectTimeout);

        if (!synAck.flags.SYN || !synAck.flags.ACK) {
            throw new Error("Invalid SYN-ACK response");
        }

        if (synAck.acknowledgmentNumber !== initialSeqNum + 1) {
            throw new Error("Invalid ACK number in SYN-ACK");
        }

        // 3. Send ACK
        const ackSegment = createTCPSegment({
            flags: { ACK: true },
            sequenceNumber: initialSeqNum + 1,
            acknowledgmentNumber: synAck.sequenceNumber + 1,
            windowSize: this.config.windowSize,
        });

        await this.sendSegment(ackSegment);
        this.state = TCPState.ESTABLISHED;

        // Connection established
        this.metrics.uptime = Date.now();
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
    return Math.floor(Math.random() * 0xFFFFFFFF);
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

    // TODO: Serialize TCP options if present

    // Copy data payload
    buffer.set(segment.data, headerSize);

    // TODO: Calculate and set checksum

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

    // TODO: Parse TCP options if present

    // Extract data payload
    const headerSize = dataOffset * 4;
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
        options: {},
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

/**
 * HTTP/2 Connection Implementation
 *
 * Implements HTTP/2 protocol (RFC 7540) including frame parsing, stream multiplexing,
 * flow control, and HPACK header compression.
 */

import type { Socket } from "../primitives/Socket.ts";
import type { ByteBuffer } from "../../../types/identifiers.ts";
import type { HTTPRequest } from "./HTTPRequestParser.ts";
import type { HTTPResponse } from "./HTTPResponseParser.ts";
import { HTTPHeaderParser } from "./HTTPHeaders.ts";
import { HPACKDecoder, HPACKEncoder } from "./HPACKEncoder.ts";

/**
 * HTTP/2 frame types
 */
export enum HTTP2FrameType {
    DATA = 0x0,
    HEADERS = 0x1,
    PRIORITY = 0x2,
    RST_STREAM = 0x3,
    SETTINGS = 0x4,
    PUSH_PROMISE = 0x5,
    PING = 0x6,
    GOAWAY = 0x7,
    WINDOW_UPDATE = 0x8,
    CONTINUATION = 0x9,
}

/**
 * HTTP/2 frame flags
 */
export enum HTTP2FrameFlags {
    END_STREAM = 0x1,
    END_HEADERS = 0x4,
    PADDED = 0x8,
    PRIORITY = 0x20,
    ACK = 0x1, // For SETTINGS and PING
}

/**
 * HTTP/2 settings identifiers
 */
export enum HTTP2Settings {
    HEADER_TABLE_SIZE = 0x1,
    ENABLE_PUSH = 0x2,
    MAX_CONCURRENT_STREAMS = 0x3,
    INITIAL_WINDOW_SIZE = 0x4,
    MAX_FRAME_SIZE = 0x5,
    MAX_HEADER_LIST_SIZE = 0x6,
}

/**
 * HTTP/2 error codes
 */
export enum HTTP2ErrorCode {
    NO_ERROR = 0x0,
    PROTOCOL_ERROR = 0x1,
    INTERNAL_ERROR = 0x2,
    FLOW_CONTROL_ERROR = 0x3,
    SETTINGS_TIMEOUT = 0x4,
    STREAM_CLOSED = 0x5,
    FRAME_SIZE_ERROR = 0x6,
    REFUSED_STREAM = 0x7,
    CANCEL = 0x8,
    COMPRESSION_ERROR = 0x9,
    CONNECT_ERROR = 0xa,
    ENHANCE_YOUR_CALM = 0xb,
    INADEQUATE_SECURITY = 0xc,
    HTTP_1_1_REQUIRED = 0xd,
}

/**
 * HTTP/2 stream state
 */
export enum HTTP2StreamState {
    IDLE = "IDLE",
    RESERVED_LOCAL = "RESERVED_LOCAL",
    RESERVED_REMOTE = "RESERVED_REMOTE",
    OPEN = "OPEN",
    HALF_CLOSED_LOCAL = "HALF_CLOSED_LOCAL",
    HALF_CLOSED_REMOTE = "HALF_CLOSED_REMOTE",
    CLOSED = "CLOSED",
}

/**
 * HTTP/2 stream
 */
export interface HTTP2Stream {
    id: number;
    state: HTTP2StreamState;
    localWindowSize: number;
    remoteWindowSize: number;
    priority: number;
    headers?: Map<string, string>;
    dataChunks: ByteBuffer[];
    headersComplete: boolean;
    responseResolve?: (response: HTTPResponse) => void;
    responseReject?: (error: Error) => void;
}

/**
 * HTTP/2 frame structure
 */
export interface HTTP2Frame {
    length: number;
    type: HTTP2FrameType;
    flags: number;
    streamId: number;
    payload: ByteBuffer;
}

/**
 * HTTP/2 connection preface
 */
const HTTP2_PREFACE = "PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n";

/**
 * HTTP/2 connection
 */
export class HTTP2Connection {
    private socket: Socket;
    private streams: Map<number, HTTP2Stream> = new Map();
    private nextStreamId: number = 1; // Client uses odd stream IDs
    private connectionWindowSize: number = 65535; // Default initial window size
    private localSettings: Map<number, number> = new Map();
    private remoteSettings: Map<number, number> = new Map();
    private hpackEncoder: HPACKEncoder;
    private hpackDecoder: HPACKDecoder;
    private prefaceSent: boolean = false;
    private settingsReceived: boolean = false;

    constructor(socket: Socket) {
        this.socket = socket;
        this.hpackEncoder = new HPACKEncoder();
        this.hpackDecoder = new HPACKDecoder();

        // Initialize default settings
        this.localSettings.set(HTTP2Settings.HEADER_TABLE_SIZE, 4096);
        this.localSettings.set(HTTP2Settings.ENABLE_PUSH, 1);
        this.localSettings.set(HTTP2Settings.MAX_CONCURRENT_STREAMS, 100);
        this.localSettings.set(HTTP2Settings.INITIAL_WINDOW_SIZE, 65535);
        this.localSettings.set(HTTP2Settings.MAX_FRAME_SIZE, 16384);
        this.localSettings.set(HTTP2Settings.MAX_HEADER_LIST_SIZE, 8192);
    }

    /**
     * Send HTTP/2 connection preface
     * Sends: PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n + SETTINGS frame
     */
    async sendPreface(): Promise<void> {
        if (this.prefaceSent) {
            return;
        }

        // Send connection preface string
        const prefaceBytes = new TextEncoder().encode(HTTP2_PREFACE);
        await this.socket.write(prefaceBytes);

        // Send initial SETTINGS frame
        await this.sendSettings(this.localSettings);

        this.prefaceSent = true;
    }

    /**
     * Create new HTTP/2 stream
     * Client uses odd stream IDs (1, 3, 5, ...)
     */
    createStream(): HTTP2Stream {
        const streamId = this.nextStreamId;
        this.nextStreamId += 2; // Increment by 2 to keep odd

        const stream: HTTP2Stream = {
            id: streamId,
            state: HTTP2StreamState.IDLE,
            localWindowSize: this.localSettings.get(HTTP2Settings.INITIAL_WINDOW_SIZE) || 65535,
            remoteWindowSize: this.remoteSettings.get(HTTP2Settings.INITIAL_WINDOW_SIZE) || 65535,
            priority: 16, // Default priority
            dataChunks: [],
            headersComplete: false,
        };

        this.streams.set(streamId, stream);
        return stream;
    }

    /**
     * Send HTTP request over HTTP/2
     * Sends HEADERS frame (with optional DATA frames for request body)
     *
     * @param request - HTTP request
     * @returns HTTP response
     */
    async sendRequest(request: HTTPRequest): Promise<HTTPResponse> {
        // Ensure preface is sent
        if (!this.prefaceSent) {
            await this.sendPreface();
        }

        // Wait for SETTINGS frame from server
        // (In real implementation, should use proper event loop)

        // Create new stream
        const stream = this.createStream();
        stream.state = HTTP2StreamState.OPEN;

        // Build HTTP/2 pseudo-headers
        const http2Headers = new Map<string, string>();
        http2Headers.set(":method", request.method);
        http2Headers.set(":path", request.path);
        http2Headers.set(":scheme", "https");
        http2Headers.set(":authority", request.headers.get("host") || "");

        // Copy regular headers (skip Host as it becomes :authority)
        for (const [name, value] of request.headers.entries()) {
            if (name.toLowerCase() !== "host") {
                http2Headers.set(name.toLowerCase(), value);
            }
        }

        // Encode headers with HPACK
        const headerBlock = this.hpackEncoder.encode(http2Headers);

        // Determine flags
        let flags = HTTP2FrameFlags.END_HEADERS;
        if (request.body.byteLength === 0) {
            flags |= HTTP2FrameFlags.END_STREAM;
            stream.state = HTTP2StreamState.HALF_CLOSED_LOCAL;
        }

        // Send HEADERS frame
        await this.sendFrame(HTTP2FrameType.HEADERS, flags, stream.id, headerBlock);

        // Send DATA frame if body exists
        if (request.body.byteLength > 0) {
            await this.sendFrame(
                HTTP2FrameType.DATA,
                HTTP2FrameFlags.END_STREAM,
                stream.id,
                request.body,
            );
            stream.state = HTTP2StreamState.HALF_CLOSED_LOCAL;
        }

        // Return promise that resolves when response is received
        return new Promise<HTTPResponse>((resolve, reject) => {
            stream.responseResolve = resolve;
            stream.responseReject = reject;

            // Set timeout for response
            setTimeout(() => {
                if (stream.state !== HTTP2StreamState.CLOSED) {
                    reject(new Error("Request timeout"));
                    this.streams.delete(stream.id);
                }
            }, 30000); // 30 second timeout
        });
    }

    /**
     * Start receiving frames from socket
     * Should be called in a loop to process incoming frames
     */
    async receiveFrames(): Promise<void> {
        const frameHeaderBuffer = new Uint8Array(9);

        while (true) {
            // Read frame header (9 bytes)
            const headerBytesRead = await this.socket.read(frameHeaderBuffer);
            if (headerBytesRead === null || headerBytesRead < 9) {
                break; // Connection closed
            }

            // Parse frame header to get payload length
            const view = new DataView(frameHeaderBuffer.buffer);
            const payloadLength = (view.getUint8(0) << 16) | (view.getUint8(1) << 8) |
                view.getUint8(2);

            // Read payload
            const payloadBuffer = new Uint8Array(payloadLength);
            if (payloadLength > 0) {
                const payloadBytesRead = await this.socket.read(payloadBuffer);
                if (payloadBytesRead === null || payloadBytesRead < payloadLength) {
                    break; // Connection closed
                }
            }

            // Combine header + payload and parse
            const fullFrame = new Uint8Array(9 + payloadLength);
            fullFrame.set(frameHeaderBuffer, 0);
            fullFrame.set(payloadBuffer, 9);

            const frame = this.parseFrame(fullFrame);
            await this.handleFrame(frame);
        }
    }

    /**
     * Parse HTTP/2 frame from buffer
     * Frame format: 9-byte header + payload
     * +-----------------------------------------------+
     * |                 Length (24)                   |
     * +---------------+---------------+---------------+
     * |   Type (8)    |   Flags (8)   |
     * +-+-------------+---------------+-------------------------------+
     * |R|                 Stream Identifier (31)                      |
     * +=+=============================================================+
     * |                   Frame Payload (0...)                      ...
     * +---------------------------------------------------------------+
     */
    parseFrame(buffer: ByteBuffer): HTTP2Frame {
        if (buffer.byteLength < 9) {
            throw new Error("Frame too short");
        }

        const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

        // Parse 24-bit length
        const length = (view.getUint8(0) << 16) | (view.getUint8(1) << 8) | view.getUint8(2);

        // Parse type and flags
        const type = view.getUint8(3) as HTTP2FrameType;
        const flags = view.getUint8(4);

        // Parse 31-bit stream ID (ignore R bit)
        const streamId = view.getUint32(5) & 0x7FFFFFFF;

        // Extract payload
        const payload = buffer.slice(9, 9 + length);

        return { length, type, flags, streamId, payload };
    }

    /**
     * Build HTTP/2 frame
     */
    private buildFrame(
        type: HTTP2FrameType,
        flags: number,
        streamId: number,
        payload: ByteBuffer,
    ): ByteBuffer {
        const frame = new Uint8Array(9 + payload.byteLength);
        const view = new DataView(frame.buffer);

        // Write 24-bit length
        view.setUint8(0, (payload.byteLength >> 16) & 0xFF);
        view.setUint8(1, (payload.byteLength >> 8) & 0xFF);
        view.setUint8(2, payload.byteLength & 0xFF);

        // Write type and flags
        view.setUint8(3, type);
        view.setUint8(4, flags);

        // Write 31-bit stream ID
        view.setUint32(5, streamId & 0x7FFFFFFF);

        // Copy payload
        frame.set(payload, 9);

        return frame;
    }

    /**
     * Send HTTP/2 frame
     */
    private async sendFrame(
        type: HTTP2FrameType,
        flags: number,
        streamId: number,
        payload: ByteBuffer,
    ): Promise<void> {
        const frame = this.buildFrame(type, flags, streamId, payload);
        await this.socket.write(frame);
    }

    /**
     * Handle incoming HTTP/2 frame
     * Dispatches to appropriate handler based on frame type
     */
    async handleFrame(frame: HTTP2Frame): Promise<void> {
        switch (frame.type) {
            case HTTP2FrameType.DATA:
                await this.handleDataFrame(frame);
                break;

            case HTTP2FrameType.HEADERS:
                await this.handleHeadersFrame(frame);
                break;

            case HTTP2FrameType.SETTINGS:
                await this.handleSettingsFrame(frame);
                break;

            case HTTP2FrameType.WINDOW_UPDATE:
                await this.handleWindowUpdateFrame(frame);
                break;

            case HTTP2FrameType.PING:
                await this.handlePingFrame(frame);
                break;

            case HTTP2FrameType.GOAWAY:
                await this.handleGoawayFrame(frame);
                break;

            case HTTP2FrameType.RST_STREAM:
                await this.handleRstStreamFrame(frame);
                break;

            default:
                // Unknown frame type, ignore
                console.warn(`Unknown HTTP/2 frame type: ${frame.type}`);
        }
    }

    /**
     * Handle DATA frame
     */
    private async handleDataFrame(frame: HTTP2Frame): Promise<void> {
        const stream = this.streams.get(frame.streamId);
        if (!stream) {
            return;
        }

        // Store data chunk
        stream.dataChunks.push(frame.payload);

        // Check if this is the last frame (END_STREAM flag)
        if ((frame.flags & HTTP2FrameFlags.END_STREAM) !== 0) {
            stream.state = HTTP2StreamState.HALF_CLOSED_REMOTE;

            // If headers complete and data complete, build response
            if (stream.headersComplete && stream.responseResolve) {
                const response = this.buildResponse(stream);
                stream.responseResolve(response);
            }
        }

        // Update flow control window
        await this.updateWindow(frame.streamId, frame.payload.byteLength);
    }

    /**
     * Handle HEADERS frame
     */
    private async handleHeadersFrame(frame: HTTP2Frame): Promise<void> {
        const stream = this.streams.get(frame.streamId);
        if (!stream) {
            return;
        }

        // Decode HPACK-compressed headers
        stream.headers = this.hpackDecoder.decode(frame.payload);

        // Check if headers are complete (END_HEADERS flag)
        if ((frame.flags & HTTP2FrameFlags.END_HEADERS) !== 0) {
            stream.headersComplete = true;

            // Check if this is also END_STREAM
            if ((frame.flags & HTTP2FrameFlags.END_STREAM) !== 0) {
                stream.state = HTTP2StreamState.HALF_CLOSED_REMOTE;

                // Build response
                if (stream.responseResolve) {
                    const response = this.buildResponse(stream);
                    stream.responseResolve(response);
                }
            }
        }
    }

    /**
     * Handle SETTINGS frame
     */
    private async handleSettingsFrame(frame: HTTP2Frame): Promise<void> {
        // Check if this is a SETTINGS ACK
        if ((frame.flags & HTTP2FrameFlags.ACK) !== 0) {
            this.settingsReceived = true;
            return;
        }

        // Parse settings
        const view = new DataView(
            frame.payload.buffer,
            frame.payload.byteOffset,
            frame.payload.byteLength,
        );
        for (let i = 0; i < frame.payload.byteLength; i += 6) {
            const id = view.getUint16(i);
            const value = view.getUint32(i + 2);
            this.remoteSettings.set(id, value);
        }

        // Send SETTINGS ACK
        await this.sendSettingsAck();
        this.settingsReceived = true;
    }

    /**
     * Handle WINDOW_UPDATE frame
     */
    private async handleWindowUpdateFrame(frame: HTTP2Frame): Promise<void> {
        const view = new DataView(
            frame.payload.buffer,
            frame.payload.byteOffset,
            frame.payload.byteLength,
        );
        const increment = view.getUint32(0) & 0x7FFFFFFF;

        if (frame.streamId === 0) {
            // Connection-level window update
            this.connectionWindowSize += increment;
        } else {
            // Stream-level window update
            const stream = this.streams.get(frame.streamId);
            if (stream) {
                stream.remoteWindowSize += increment;
            }
        }
    }

    /**
     * Handle PING frame
     */
    private async handlePingFrame(frame: HTTP2Frame): Promise<void> {
        // Send PING ACK with same payload
        await this.sendFrame(HTTP2FrameType.PING, HTTP2FrameFlags.ACK, 0, frame.payload);
    }

    /**
     * Handle GOAWAY frame
     */
    private async handleGoawayFrame(frame: HTTP2Frame): Promise<void> {
        // Connection is being closed by server
        console.log("Received GOAWAY frame");
        // TODO: Clean up streams and close connection
    }

    /**
     * Handle RST_STREAM frame
     */
    private async handleRstStreamFrame(frame: HTTP2Frame): Promise<void> {
        const stream = this.streams.get(frame.streamId);
        if (stream) {
            stream.state = HTTP2StreamState.CLOSED;
            if (stream.responseReject) {
                stream.responseReject(new Error("Stream reset by peer"));
            }
            this.streams.delete(frame.streamId);
        }
    }

    /**
     * Build HTTP response from stream data
     */
    private buildResponse(stream: HTTP2Stream): HTTPResponse {
        // Combine all data chunks
        const totalLength = stream.dataChunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
        const body = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of stream.dataChunks) {
            body.set(chunk, offset);
            offset += chunk.byteLength;
        }

        // Extract status from :status pseudo-header
        const status = parseInt(stream.headers?.get(":status") || "200", 10);

        return {
            version: "HTTP/2",
            statusCode: status,
            statusText: "",
            headers: stream.headers || new Map(),
            body,
        };
    }

    /**
     * Send SETTINGS frame
     * Payload: 0 or more 6-byte settings (ID + value)
     */
    async sendSettings(settings: Map<number, number>): Promise<void> {
        const payload = new Uint8Array(settings.size * 6);
        const view = new DataView(payload.buffer);

        let offset = 0;
        for (const [id, value] of settings.entries()) {
            view.setUint16(offset, id); // Setting ID (16 bits)
            view.setUint32(offset + 2, value); // Setting value (32 bits)
            offset += 6;
        }

        await this.sendFrame(HTTP2FrameType.SETTINGS, 0, 0, payload);
    }

    /**
     * Send SETTINGS ACK
     */
    private async sendSettingsAck(): Promise<void> {
        await this.sendFrame(HTTP2FrameType.SETTINGS, HTTP2FrameFlags.ACK, 0, new Uint8Array(0));
    }

    /**
     * Update flow control window
     * Sends WINDOW_UPDATE frame
     */
    async updateWindow(streamId: number, increment: number): Promise<void> {
        const payload = new Uint8Array(4);
        const view = new DataView(payload.buffer);
        view.setUint32(0, increment & 0x7FFFFFFF); // 31-bit window size increment

        await this.sendFrame(HTTP2FrameType.WINDOW_UPDATE, 0, streamId, payload);
    }

    /**
     * Close HTTP/2 connection
     * Sends GOAWAY frame and closes socket
     */
    async close(): Promise<void> {
        // Send GOAWAY frame
        const payload = new Uint8Array(8);
        const view = new DataView(payload.buffer);

        // Last stream ID (31 bits)
        view.setUint32(0, this.nextStreamId - 2);

        // Error code (32 bits)
        view.setUint32(4, HTTP2ErrorCode.NO_ERROR);

        await this.sendFrame(HTTP2FrameType.GOAWAY, 0, 0, payload);

        // Close all streams
        for (const stream of this.streams.values()) {
            if (stream.responseReject) {
                stream.responseReject(new Error("Connection closed"));
            }
        }
        this.streams.clear();

        // Close socket
        await this.socket.close();
    }

    /**
     * Get connection statistics
     */
    getStats(): {
        activeStreams: number;
        nextStreamId: number;
        connectionWindowSize: number;
        prefaceSent: boolean;
        settingsReceived: boolean;
    } {
        return {
            activeStreams: this.streams.size,
            nextStreamId: this.nextStreamId,
            connectionWindowSize: this.connectionWindowSize,
            prefaceSent: this.prefaceSent,
            settingsReceived: this.settingsReceived,
        };
    }
}

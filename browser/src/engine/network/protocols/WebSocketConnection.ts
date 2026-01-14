/**
 * WebSocket Connection Implementation
 *
 * Implements WebSocket protocol (RFC 6455) including handshake,
 * framing, and bidirectional communication.
 */

import type { Socket } from "../primitives/Socket.ts";
import type { ByteBuffer } from "../../../types/identifiers.ts";

/**
 * WebSocket opcode
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
    payload: ByteBuffer;
}

/**
 * WebSocket connection state
 */
export enum WebSocketState {
    CONNECTING = "CONNECTING",
    OPEN = "OPEN",
    CLOSING = "CLOSING",
    CLOSED = "CLOSED",
}

/**
 * WebSocket connection
 */
export class WebSocketConnection {
    private socket: Socket;
    private state: WebSocketState = WebSocketState.CONNECTING;
    private url: URL | null = null;
    private lastPongReceived: number = Date.now();

    constructor(socket: Socket) {
        this.socket = socket;
    }

    /**
     * Perform WebSocket handshake per RFC 6455 Section 4
     *
     * @param url - WebSocket URL (ws:// or wss://)
     * @param protocols - Optional subprotocols
     */
    async handshake(url: string, protocols?: string[]): Promise<void> {
        this.state = WebSocketState.CONNECTING;
        this.url = new URL(url);

        try {
            // Generate WebSocket key (16 random bytes, base64 encoded)
            const keyBytes = new Uint8Array(16);
            crypto.getRandomValues(keyBytes);
            const key = btoa(String.fromCharCode(...keyBytes));

            // Build HTTP upgrade request
            const requestLines = [
                `GET ${this.url.pathname}${this.url.search || ""} HTTP/1.1`,
                `Host: ${this.url.host}`,
                "Upgrade: websocket",
                "Connection: Upgrade",
                `Sec-WebSocket-Key: ${key}`,
                "Sec-WebSocket-Version: 13",
            ];

            if (protocols && protocols.length > 0) {
                requestLines.push(`Sec-WebSocket-Protocol: ${protocols.join(", ")}`);
            }

            requestLines.push("\r\n");
            const request = requestLines.join("\r\n");

            // Send upgrade request
            await this.socket.write(new TextEncoder().encode(request));

            // Read upgrade response (up to 4KB for headers)
            const responseBuffer = new Uint8Array(4096);
            const bytesRead = await this.socket.read(responseBuffer);
            if (bytesRead === null) {
                throw new Error("WebSocket handshake failed: connection closed");
            }

            const response = new TextDecoder().decode(responseBuffer.slice(0, bytesRead));

            // Validate upgrade response
            if (!response.includes("HTTP/1.1 101")) {
                throw new Error("WebSocket upgrade failed: expected 101 Switching Protocols");
            }

            // Validate Sec-WebSocket-Accept header
            const expectedAccept = await this.computeAcceptKey(key);
            if (!response.toLowerCase().includes(`sec-websocket-accept: ${expectedAccept.toLowerCase()}`)) {
                throw new Error("WebSocket upgrade failed: invalid Sec-WebSocket-Accept");
            }

            this.state = WebSocketState.OPEN;
        } catch (error) {
            this.state = WebSocketState.CLOSED;
            throw error;
        }
    }

    /**
     * Compute Sec-WebSocket-Accept value per RFC 6455 Section 4.2.2
     */
    private async computeAcceptKey(key: string): Promise<string> {
        // RFC 6455: Sec-WebSocket-Accept = base64(SHA-1(key + GUID))
        const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
        const combined = key + GUID;

        // Use SHA-1 for WebSocket handshake (required by RFC, not for crypto security)
        const encoder = new TextEncoder();
        const data = encoder.encode(combined);

        // Compute SHA-1 hash using Web Crypto API
        const hash = await crypto.subtle.digest("SHA-1", data);
        return btoa(String.fromCharCode(...new Uint8Array(hash)));
    }

    /**
     * Parse WebSocket frame per RFC 6455 Section 5.2
     */
    parseFrame(data: ByteBuffer): WebSocketFrame {
        if (data.byteLength < 2) {
            throw new Error("Invalid WebSocket frame: too short");
        }

        let offset = 0;

        // Byte 0: FIN, RSV, opcode
        const byte0 = data[offset++];
        const fin = (byte0 & 0x80) !== 0;
        const rsv1 = (byte0 & 0x40) !== 0;
        const rsv2 = (byte0 & 0x20) !== 0;
        const rsv3 = (byte0 & 0x10) !== 0;
        const opcode = byte0 & 0x0f;

        // Validate reserved bits (must be 0 unless extension negotiated)
        if (rsv1 || rsv2 || rsv3) {
            throw new Error("Invalid WebSocket frame: RSV bits set without extension");
        }

        // Byte 1: MASK, payload length
        const byte1 = data[offset++];
        const masked = (byte1 & 0x80) !== 0;
        let payloadLength = byte1 & 0x7f;

        // Extended payload length
        if (payloadLength === 126) {
            if (data.byteLength < offset + 2) {
                throw new Error("Invalid WebSocket frame: incomplete extended length");
            }
            payloadLength = (data[offset] << 8) | data[offset + 1];
            offset += 2;
        } else if (payloadLength === 127) {
            if (data.byteLength < offset + 8) {
                throw new Error("Invalid WebSocket frame: incomplete extended length");
            }
            // Read 64-bit length (only use lower 32 bits for JavaScript)
            payloadLength =
                (data[offset + 4] << 24) |
                (data[offset + 5] << 16) |
                (data[offset + 6] << 8) |
                data[offset + 7];
            offset += 8;
        }

        // Masking key (if present)
        let maskingKey: ByteBuffer | undefined;
        if (masked) {
            if (data.byteLength < offset + 4) {
                throw new Error("Invalid WebSocket frame: incomplete masking key");
            }
            maskingKey = data.slice(offset, offset + 4);
            offset += 4;
        }

        // Payload data
        if (data.byteLength < offset + payloadLength) {
            throw new Error(
                `Invalid WebSocket frame: incomplete payload (expected ${payloadLength} bytes)`
            );
        }

        let payload = data.slice(offset, offset + payloadLength);

        // Unmask payload if needed
        if (masked && maskingKey) {
            payload = this.unmaskPayload(payload, maskingKey);
        }

        return {
            fin,
            opcode: opcode as WebSocketOpcode,
            masked,
            payload,
        };
    }

    /**
     * Unmask payload using masking key per RFC 6455 Section 5.3
     */
    private unmaskPayload(payload: ByteBuffer, maskingKey: ByteBuffer): ByteBuffer {
        const unmasked = new Uint8Array(payload.byteLength);
        for (let i = 0; i < payload.byteLength; i++) {
            unmasked[i] = payload[i] ^ maskingKey[i % 4];
        }
        return unmasked;
    }

    /**
     * Encode WebSocket frame with client-side masking per RFC 6455 Section 5.2
     */
    encodeFrame(opcode: WebSocketOpcode, payload: ByteBuffer, fin = true): ByteBuffer {
        // Calculate frame size
        let frameSize = 2 + payload.byteLength; // FIN/opcode + mask/length

        // Add extended length bytes
        if (payload.byteLength > 65535) {
            frameSize += 8;
        } else if (payload.byteLength > 125) {
            frameSize += 2;
        }

        // Client frames MUST be masked (RFC 6455 Section 5.1)
        const masked = true;
        if (masked) {
            frameSize += 4; // Masking key
        }

        const frame = new Uint8Array(frameSize);
        let offset = 0;

        // Byte 0: FIN and opcode
        frame[offset++] = (fin ? 0x80 : 0x00) | (opcode & 0x0f);

        // Byte 1: MASK and payload length
        let lengthByte = masked ? 0x80 : 0x00;

        if (payload.byteLength <= 125) {
            lengthByte |= payload.byteLength;
            frame[offset++] = lengthByte;
        } else if (payload.byteLength <= 65535) {
            lengthByte |= 126;
            frame[offset++] = lengthByte;
            frame[offset++] = (payload.byteLength >> 8) & 0xff;
            frame[offset++] = payload.byteLength & 0xff;
        } else {
            lengthByte |= 127;
            frame[offset++] = lengthByte;
            // 64-bit length (only set lower 32 bits)
            frame[offset++] = 0;
            frame[offset++] = 0;
            frame[offset++] = 0;
            frame[offset++] = 0;
            frame[offset++] = (payload.byteLength >> 24) & 0xff;
            frame[offset++] = (payload.byteLength >> 16) & 0xff;
            frame[offset++] = (payload.byteLength >> 8) & 0xff;
            frame[offset++] = payload.byteLength & 0xff;
        }

        // Masking key (if client)
        let maskingKey: ByteBuffer | undefined;
        if (masked) {
            maskingKey = new Uint8Array(4);
            crypto.getRandomValues(maskingKey);
            frame.set(maskingKey, offset);
            offset += 4;
        }

        // Payload (masked if client)
        if (masked && maskingKey) {
            const maskedPayload = this.unmaskPayload(payload, maskingKey); // Reuse unmask for mask
            frame.set(maskedPayload, offset);
        } else {
            frame.set(payload, offset);
        }

        return frame;
    }

    /**
     * Send WebSocket message (text or binary)
     */
    async send(data: string | ByteBuffer): Promise<void> {
        if (this.state !== WebSocketState.OPEN) {
            throw new Error(`Cannot send: WebSocket is ${this.state}`);
        }

        try {
            let payload: ByteBuffer;
            let opcode: WebSocketOpcode;

            if (typeof data === "string") {
                payload = new TextEncoder().encode(data);
                opcode = WebSocketOpcode.TEXT;
            } else {
                payload = data;
                opcode = WebSocketOpcode.BINARY;
            }

            // Encode frame
            const frame = this.encodeFrame(opcode, payload, true);

            // Send frame
            await this.socket.write(frame);
        } catch (error) {
            this.state = WebSocketState.CLOSED;
            throw error;
        }
    }

    /**
     * Receive WebSocket message with frame reassembly
     */
    async receive(): Promise<string | ByteBuffer> {
        if (this.state !== WebSocketState.OPEN) {
            throw new Error(`Cannot receive: WebSocket is ${this.state}`);
        }

        const fragments: ByteBuffer[] = [];
        let messageOpcode: WebSocketOpcode | null = null;

        while (true) {
            // Read frame from socket (read at least 2 bytes for header)
            const headerBuffer = new Uint8Array(14); // Max header size
            const headerBytes = await this.socket.read(headerBuffer);
            if (headerBytes === null) {
                throw new Error("WebSocket connection closed");
            }

            // Parse frame length to determine how much more to read
            let offset = 2;
            const byte1 = headerBuffer[1];
            let payloadLength = byte1 & 0x7f;

            if (payloadLength === 126) {
                offset += 2;
            } else if (payloadLength === 127) {
                offset += 8;
            }

            if ((byte1 & 0x80) !== 0) {
                offset += 4; // Masking key
            }

            // Read full frame
            const fullFrameSize = offset + payloadLength;
            const frameBuffer = new Uint8Array(fullFrameSize);
            frameBuffer.set(headerBuffer.slice(0, offset));

            if (payloadLength > 0) {
                const payloadBuffer = new Uint8Array(payloadLength);
                const payloadBytes = await this.socket.read(payloadBuffer);
                if (payloadBytes === null || payloadBytes < payloadLength) {
                    throw new Error("WebSocket connection closed during frame read");
                }
                frameBuffer.set(payloadBuffer, offset);
            }

            const frame = this.parseFrame(frameBuffer);

            // Handle control frames (opcodes >= 0x08)
            if (frame.opcode >= 0x08) {
                await this.handleControlFrame(frame);
                continue;
            }

            // Handle data frames
            if (messageOpcode === null) {
                // First frame of message
                messageOpcode = frame.opcode;
            } else if (frame.opcode !== WebSocketOpcode.CONTINUATION) {
                throw new Error("Expected continuation frame");
            }

            fragments.push(frame.payload);

            // If FIN bit is set, message is complete
            if (frame.fin) {
                break;
            }
        }

        // Reassemble fragments
        const totalLength = fragments.reduce((sum, frag) => sum + frag.byteLength, 0);
        const message = new Uint8Array(totalLength);
        let offset = 0;
        for (const fragment of fragments) {
            message.set(fragment, offset);
            offset += fragment.byteLength;
        }

        // Decode text messages
        if (messageOpcode === WebSocketOpcode.TEXT) {
            return new TextDecoder().decode(message);
        }

        return message;
    }

    /**
     * Handle control frames (PING, PONG, CLOSE)
     */
    private async handleControlFrame(frame: WebSocketFrame): Promise<void> {
        switch (frame.opcode) {
            case WebSocketOpcode.PING:
                // Respond with PONG
                const pongFrame = this.encodeFrame(
                    WebSocketOpcode.PONG,
                    frame.payload,
                    true
                );
                await this.socket.write(pongFrame);
                break;

            case WebSocketOpcode.PONG:
                // Update ping/pong tracking
                this.lastPongReceived = Date.now();
                break;

            case WebSocketOpcode.CLOSE:
                // Respond with close frame
                this.state = WebSocketState.CLOSING;
                const closeFrame = this.encodeFrame(
                    WebSocketOpcode.CLOSE,
                    new Uint8Array(0),
                    true
                );
                await this.socket.write(closeFrame);
                this.state = WebSocketState.CLOSED;
                await this.socket.close();
                break;

            default:
                throw new Error(`Unknown control frame opcode: ${frame.opcode}`);
        }
    }

    /**
     * Send ping frame
     */
    async ping(data?: ByteBuffer): Promise<void> {
        if (this.state !== WebSocketState.OPEN) {
            throw new Error(`Cannot ping: WebSocket is ${this.state}`);
        }

        const payload = data || new Uint8Array(0);

        if (payload.byteLength > 125) {
            throw new Error("Ping payload must be <= 125 bytes");
        }

        const frame = this.encodeFrame(WebSocketOpcode.PING, payload, true);
        await this.socket.write(frame);
    }

    /**
     * Close WebSocket connection with handshake per RFC 6455 Section 7.1.2
     *
     * @param code - Close status code (default 1000 = normal closure)
     * @param reason - Close reason string
     */
    async close(code = 1000, reason = ""): Promise<void> {
        if (
            this.state === WebSocketState.CLOSED ||
            this.state === WebSocketState.CLOSING
        ) {
            return;
        }

        this.state = WebSocketState.CLOSING;

        try {
            // Build close frame payload: 2-byte code + reason
            const reasonBytes = new TextEncoder().encode(reason);
            const payload = new Uint8Array(2 + reasonBytes.byteLength);
            payload[0] = (code >> 8) & 0xff;
            payload[1] = code & 0xff;
            payload.set(reasonBytes, 2);

            // Send close frame
            const frame = this.encodeFrame(WebSocketOpcode.CLOSE, payload, true);
            await this.socket.write(frame);

            // Wait for close frame response (with timeout)
            const timeout = setTimeout(() => {
                this.state = WebSocketState.CLOSED;
                this.socket.close();
            }, 5000);

            try {
                // Read close response
                const responseBuffer = new Uint8Array(1024);
                const bytesRead = await this.socket.read(responseBuffer);

                if (bytesRead !== null && bytesRead > 0) {
                    const responseFrame = this.parseFrame(
                        responseBuffer.slice(0, bytesRead)
                    );

                    if (responseFrame.opcode === WebSocketOpcode.CLOSE) {
                        clearTimeout(timeout);
                        this.state = WebSocketState.CLOSED;
                        await this.socket.close();
                    }
                }
            } catch (error) {
                clearTimeout(timeout);
                this.state = WebSocketState.CLOSED;
                await this.socket.close();
            }
        } catch (error) {
            this.state = WebSocketState.CLOSED;
            await this.socket.close();
            throw error;
        }
    }

    /**
     * Get current connection state
     */
    getState(): WebSocketState {
        return this.state;
    }
}

/**
 * Socket implementation using OS network stack
 */

import type { ByteBuffer, FileDescriptor, Port } from "../../../types/identifiers.ts";
import type { Socket, SocketState, SocketStats } from "../../../types/network.ts";
import { SocketState as SocketStateEnum } from "../../../types/network.ts";
import { NetworkStack, type OSSocket } from "../../../os/networking/NetworkStack.ts";
import * as SocketStatsUtil from "./SocketStats.ts";

// Re-export Socket type for external use
export type { Socket } from "../../../types/network.ts";

/**
 * Address family
 */
export enum AddressFamily {
    IPv4 = "IPv4",
    IPv6 = "IPv6",
}

/**
 * Socket type
 */
export enum SocketType {
    STREAM = "STREAM", // TCP
    DGRAM = "DGRAM", // UDP
}

/**
 * Socket options
 */
export interface SocketOptions {
    // TCP options
    TCP_NODELAY?: boolean; // Disable Nagle's algorithm
    TCP_KEEPALIVE?: boolean; // Enable TCP keep-alive
    TCP_KEEPIDLE?: number; // Seconds before sending keep-alive
    TCP_KEEPINTVL?: number; // Interval between keep-alive probes
    TCP_KEEPCNT?: number; // Number of keep-alive probes

    // General socket options
    SO_REUSEADDR?: boolean; // Allow reuse of local addresses
    SO_REUSEPORT?: boolean; // Allow reuse of local ports
    SO_RCVBUF?: number; // Receive buffer size
    SO_SNDBUF?: number; // Send buffer size
    SO_RCVTIMEO?: number; // Receive timeout (ms)
    SO_SNDTIMEO?: number; // Send timeout (ms)
    SO_LINGER?: { enabled: boolean; timeout: number }; // Linger on close
}

/**
 * Socket implementation using OS NetworkStack
 */
export class SocketImpl implements Socket {
    private static nextFd: number = 1;
    private osSocket: OSSocket | null = null;
    private networkStack: NetworkStack;
    private _fd: FileDescriptor;
    private _state: SocketState = SocketStateEnum.CLOSED;
    private _localAddress: string = "";
    private _localPort: Port = 0;
    private _remoteAddress: string = "";
    private _remotePort: Port = 0;
    private _stats: SocketStats;

    constructor(
        private addressFamily: AddressFamily,
        private socketType: SocketType,
    ) {
        this.networkStack = new NetworkStack();
        this._fd = SocketImpl.nextFd++ as FileDescriptor;
        this._stats = SocketStatsUtil.createSocketStats();
    }

    get fd(): FileDescriptor {
        return this._fd;
    }

    get state(): SocketState {
        return this._state;
    }

    get localAddress(): string {
        return this._localAddress;
    }

    get localPort(): Port {
        return this._localPort;
    }

    get remoteAddress(): string {
        return this._remoteAddress;
    }

    get remotePort(): Port {
        return this._remotePort;
    }

    /**
     * Connect to remote host
     */
    async connect(host: string, port: Port, _options?: SocketOptions): Promise<void> {
        if (this._state !== SocketStateEnum.CLOSED) {
            throw new Error(`Cannot connect from state ${this._state}`);
        }

        this._state = SocketStateEnum.OPENING;

        try {
            // Create OS socket
            const socketTypeStr = this.socketType === SocketType.STREAM ? "tcp" : "udp";
            this.osSocket = this.networkStack.createSocket(this.addressFamily, socketTypeStr);

            // Connect to remote host
            await this.networkStack.connect(this.osSocket, host, port);

            // Update state and addresses
            this._state = SocketStateEnum.OPEN;
            this._remoteAddress = host;
            this._remotePort = port;

            // Get local address (assigned by OS)
            if (this.osSocket.conn) {
                const localAddr = this.networkStack.getLocalAddress(this.osSocket);
                if (localAddr.transport === "tcp" || localAddr.transport === "udp") {
                    this._localAddress = localAddr.hostname;
                    this._localPort = localAddr.port;
                }
            }
        } catch (error) {
            this._state = SocketStateEnum.ERROR;
            SocketStatsUtil.recordError(this._stats);
            throw new SocketError(`Connection failed: ${(error as Error).message}`, error as Error);
        }
    }

    /**
     * Read data from socket
     */
    async read(buffer: ByteBuffer): Promise<number | null> {
        if (this._state !== SocketStateEnum.OPEN) {
            throw new Error(`Cannot read from socket in state ${this._state}`);
        }

        if (!this.osSocket) {
            throw new Error("Socket not initialized");
        }

        try {
            const bytesRead = await this.networkStack.read(this.osSocket, buffer);

            // EOF indicated by null
            if (bytesRead === null) {
                return null;
            }

            SocketStatsUtil.recordReadOperation(this._stats, bytesRead);
            return bytesRead;
        } catch (error) {
            this._state = SocketStateEnum.ERROR;
            SocketStatsUtil.recordError(this._stats);
            throw new SocketError(`Read failed: ${(error as Error).message}`, error as Error);
        }
    }

    /**
     * Write data to socket
     */
    async write(data: ByteBuffer): Promise<number> {
        if (this._state !== SocketStateEnum.OPEN) {
            throw new Error(`Cannot write to socket in state ${this._state}`);
        }

        if (!this.osSocket) {
            throw new Error("Socket not initialized");
        }

        try {
            const bytesWritten = await this.networkStack.write(this.osSocket, data);
            SocketStatsUtil.recordWriteOperation(this._stats, bytesWritten);
            return bytesWritten;
        } catch (error) {
            this._state = SocketStateEnum.ERROR;
            SocketStatsUtil.recordError(this._stats);
            throw new SocketError(`Write failed: ${(error as Error).message}`, error as Error);
        }
    }

    /**
     * Close socket
     */
    async close(): Promise<void> {
        if (this._state === SocketStateEnum.CLOSED || this._state === SocketStateEnum.CLOSING) {
            return;
        }

        this._state = SocketStateEnum.CLOSING;

        try {
            if (this.osSocket) {
                this.networkStack.close(this.osSocket);
            }
            this._state = SocketStateEnum.CLOSED;
        } catch (error) {
            this._state = SocketStateEnum.ERROR;
            throw new SocketError(`Close failed: ${(error as Error).message}`, error as Error);
        }
    }

    /**
     * Set socket options (stub for now)
     */
    setOptions(_options: SocketOptions): void {
        // TODO: Implement socket options via Deno APIs
        // Deno doesn't expose all socket options, so this is a stub
    }

    /**
     * Get socket statistics
     */
    getStats(): SocketStats {
        return { ...this._stats };
    }
}

/**
 * Socket error
 */
export class SocketError extends Error {
    constructor(message: string, public override cause?: Error) {
        super(message);
        this.name = "SocketError";
    }
}

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
 * Read options with optional abort signal
 */
export interface ReadOptions {
    signal?: AbortSignal;
}

/**
 * Write options with optional abort signal
 */
export interface WriteOptions {
    signal?: AbortSignal;
}

/**
 * Connect options with optional abort signal
 */
export interface ConnectOptions extends SocketOptions {
    signal?: AbortSignal;
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
    private _options: SocketOptions = {};

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
     *
     * Deno's socket APIs don't support AbortSignal natively.
     * We use Promise.race as a workaround to enable cancellation.
     */
    async connect(host: string, port: Port, options?: ConnectOptions): Promise<void> {
        // Check if already aborted
        if (options?.signal?.aborted) {
            throw options.signal.reason || new SocketError("Connect aborted");
        }

        if (this._state !== SocketStateEnum.CLOSED) {
            throw new Error(`Cannot connect from state ${this._state}`);
        }

        // Store socket options if provided (excluding signal)
        if (options) {
            const { signal: _signal, ...socketOptions } = options;
            if (Object.keys(socketOptions).length > 0) {
                this._options = { ...this._options, ...socketOptions };
            }
        }

        this._state = SocketStateEnum.OPENING;

        try {
            // Create OS socket
            const socketTypeStr = this.socketType === SocketType.STREAM ? "tcp" : "udp";
            this.osSocket = this.networkStack.createSocket(this.addressFamily, socketTypeStr);

            // Connect to remote host with optional abort
            const connectPromise = this.networkStack.connect(this.osSocket, host, port);

            if (options?.signal) {
                await Promise.race([
                    connectPromise,
                    new Promise<never>((_, reject) => {
                        options.signal!.addEventListener("abort", () => {
                            reject(options.signal!.reason || new SocketError("Connect aborted"));
                        }, { once: true });
                    }),
                ]);
            } else {
                await connectPromise;
            }

            // Update state and addresses
            this._state = SocketStateEnum.OPEN;
            this._remoteAddress = host;
            this._remotePort = port;

            // Get local address (assigned by OS)
            // For TCP, check conn; for UDP, check datagramConn
            if (this.osSocket.conn || this.osSocket.datagramConn) {
                const localAddr = this.networkStack.getLocalAddress(this.osSocket);
                if (localAddr.transport === "tcp" || localAddr.transport === "udp") {
                    this._localAddress = (localAddr as Deno.NetAddr).hostname;
                    this._localPort = (localAddr as Deno.NetAddr).port;
                }
            }

            // Apply stored socket options after connection is established
            if (Object.keys(this._options).length > 0) {
                this.setOptions(this._options);
            }
        } catch (error) {
            // Don't set error state for abort errors
            if (error instanceof SocketError && error.message === "Connect aborted") {
                this._state = SocketStateEnum.CLOSED;
                throw error;
            }
            this._state = SocketStateEnum.ERROR;
            SocketStatsUtil.recordError(this._stats);
            throw new SocketError(`Connection failed: ${(error as Error).message}`, error as Error);
        }
    }

    /**
     * Read data from socket
     *
     * Deno's socket APIs don't support AbortSignal natively.
     * We use Promise.race as a workaround to enable cancellation.
     */
    async read(buffer: ByteBuffer, options?: ReadOptions): Promise<number | null> {
        // Check if already aborted
        if (options?.signal?.aborted) {
            throw options.signal.reason || new SocketError("Read aborted");
        }

        if (this._state !== SocketStateEnum.OPEN) {
            throw new Error(`Cannot read from socket in state ${this._state}`);
        }

        if (!this.osSocket) {
            throw new Error("Socket not initialized");
        }

        try {
            const readPromise = this.networkStack.read(this.osSocket, buffer);

            // If signal provided, race with abort
            if (options?.signal) {
                const bytesRead = await Promise.race([
                    readPromise,
                    new Promise<never>((_, reject) => {
                        options.signal!.addEventListener("abort", () => {
                            reject(options.signal!.reason || new SocketError("Read aborted"));
                        }, { once: true });
                    }),
                ]);

                // EOF indicated by null
                if (bytesRead === null) {
                    return null;
                }

                SocketStatsUtil.recordReadOperation(this._stats, bytesRead);
                return bytesRead;
            }

            const bytesRead = await readPromise;

            // EOF indicated by null
            if (bytesRead === null) {
                return null;
            }

            SocketStatsUtil.recordReadOperation(this._stats, bytesRead);
            return bytesRead;
        } catch (error) {
            // Don't set error state for abort errors
            if (error instanceof SocketError && error.message === "Read aborted") {
                throw error;
            }
            this._state = SocketStateEnum.ERROR;
            SocketStatsUtil.recordError(this._stats);
            throw new SocketError(`Read failed: ${(error as Error).message}`, error as Error);
        }
    }

    /**
     * Write data to socket
     *
     * Deno's socket APIs don't support AbortSignal natively.
     * We use Promise.race as a workaround to enable cancellation.
     */
    async write(data: ByteBuffer, options?: WriteOptions): Promise<number> {
        // Check if already aborted
        if (options?.signal?.aborted) {
            throw options.signal.reason || new SocketError("Write aborted");
        }

        if (this._state !== SocketStateEnum.OPEN) {
            throw new Error(`Cannot write to socket in state ${this._state}`);
        }

        if (!this.osSocket) {
            throw new Error("Socket not initialized");
        }

        try {
            const writePromise = this.networkStack.write(this.osSocket, data);

            // If signal provided, race with abort
            if (options?.signal) {
                const bytesWritten = await Promise.race([
                    writePromise,
                    new Promise<never>((_, reject) => {
                        options.signal!.addEventListener("abort", () => {
                            reject(options.signal!.reason || new SocketError("Write aborted"));
                        }, { once: true });
                    }),
                ]);

                SocketStatsUtil.recordWriteOperation(this._stats, bytesWritten);
                return bytesWritten;
            }

            const bytesWritten = await writePromise;
            SocketStatsUtil.recordWriteOperation(this._stats, bytesWritten);
            return bytesWritten;
        } catch (error) {
            // Don't set error state for abort errors
            if (error instanceof SocketError && error.message === "Write aborted") {
                throw error;
            }
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
     * Set socket options
     *
     * Applies options to the underlying Deno connection where supported.
     * Options are also stored for potential future use.
     *
     * Supported by Deno:
     * - TCP_NODELAY: Disables Nagle's algorithm
     * - TCP_KEEPALIVE: Enables TCP keep-alive probes
     *
     * Stored but not directly applied (Deno limitations):
     * - TCP_KEEPIDLE, TCP_KEEPINTVL, TCP_KEEPCNT: Keep-alive parameters
     * - SO_REUSEADDR, SO_REUSEPORT: Address/port reuse
     * - SO_RCVBUF, SO_SNDBUF: Buffer sizes
     * - SO_RCVTIMEO, SO_SNDTIMEO: Timeouts
     * - SO_LINGER: Linger on close
     */
    setOptions(options: SocketOptions): void {
        // Store all options
        this._options = { ...this._options, ...options };

        // Apply options to connection if connected
        if (this.osSocket?.conn) {
            // Cast to TcpConn which has setNoDelay and setKeepAlive
            const conn = this.osSocket.conn as unknown as {
                setNoDelay?: (noDelay: boolean) => void;
                setKeepAlive?: (keepAlive: boolean) => void;
            };

            // TCP_NODELAY - Disable Nagle's algorithm
            if (options.TCP_NODELAY !== undefined && conn.setNoDelay) {
                try {
                    conn.setNoDelay(options.TCP_NODELAY);
                } catch {
                    // setNoDelay may not be available on all connections
                }
            }

            // TCP_KEEPALIVE - Enable TCP keep-alive
            if (options.TCP_KEEPALIVE !== undefined && conn.setKeepAlive) {
                try {
                    conn.setKeepAlive(options.TCP_KEEPALIVE);
                } catch {
                    // setKeepAlive may not be available on all connections
                }
            }
        }
    }

    /**
     * Get current socket options
     */
    getOptions(): SocketOptions {
        return { ...this._options };
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

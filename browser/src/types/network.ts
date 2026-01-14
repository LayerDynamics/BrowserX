// ============================================================================
// NETWORK TYPES
// ============================================================================

import type {
    ByteBuffer,
    ByteCount,
    ConnectionID,
    FileDescriptor,
    Host,
    Port,
    Timestamp,
} from "./identifiers.ts";

/**
 * Socket state
 */
export enum SocketState {
    CLOSED = "CLOSED",
    OPENING = "OPENING",
    OPEN = "OPEN",
    CLOSING = "CLOSING",
    ERROR = "ERROR",
}

/**
 * TCP connection state
 */
export enum TCPState {
    CLOSED = "CLOSED",
    LISTEN = "LISTEN",
    SYN_SENT = "SYN_SENT",
    SYN_RECEIVED = "SYN_RECEIVED",
    ESTABLISHED = "ESTABLISHED",
    FIN_WAIT_1 = "FIN_WAIT_1",
    FIN_WAIT_2 = "FIN_WAIT_2",
    CLOSE_WAIT = "CLOSE_WAIT",
    CLOSING = "CLOSING",
    LAST_ACK = "LAST_ACK",
    TIME_WAIT = "TIME_WAIT",
}

/**
 * TLS handshake state
 */
export enum TLSHandshakeState {
    NONE = "NONE",
    CLIENT_HELLO = "CLIENT_HELLO",
    SERVER_HELLO = "SERVER_HELLO",
    CERTIFICATE = "CERTIFICATE",
    KEY_EXCHANGE = "KEY_EXCHANGE",
    FINISHED = "FINISHED",
    ESTABLISHED = "ESTABLISHED",
    ERROR = "ERROR",
}

/**
 * TLS version (protocol wire format)
 */
export enum TLSVersion {
    TLS_1_0 = 0x0301,
    TLS_1_1 = 0x0302,
    TLS_1_2 = 0x0303,
    TLS_1_3 = 0x0304,
}

/**
 * Certificate
 */
export interface Certificate {
    version: number;
    serialNumber: string;
    issuer: string;
    subject: string;
    subjectAltNames: string[];
    notBefore: Date;
    notAfter: Date;
    publicKey: ByteBuffer;
    signature: ByteBuffer;
    signatureAlgorithm: string;
}

/**
 * Socket
 */
export interface Socket {
    readonly fd: FileDescriptor;
    readonly state: SocketState;
    readonly localAddress: string;
    readonly localPort: Port;
    readonly remoteAddress: string;
    readonly remotePort: Port;

    /**
     * Read from socket
     */
    read(buffer: ByteBuffer): Promise<number | null>;

    /**
     * Write to socket
     */
    write(data: ByteBuffer): Promise<number>;

    /**
     * Close socket
     */
    close(): Promise<void>;

    /**
     * Get socket statistics
     */
    getStats(): SocketStats;
}

/**
 * Socket statistics
 */
export interface SocketStats {
    bytesRead: ByteCount;
    bytesWritten: ByteCount;
    readOperations: number;
    writeOperations: number;
    errors: number;
    createdAt: Timestamp;
    lastActiveAt: Timestamp;
}

/**
 * Connection pool entry
 */
export interface PooledConnection {
    id: ConnectionID;
    socket: Socket;
    host: Host;
    port: Port;
    secure: boolean;
    state: ConnectionState;
    createdAt: Timestamp;
    lastUsedAt: Timestamp;
    useCount: number;
}

/**
 * Connection state
 */
export enum ConnectionState {
    IDLE = "IDLE",
    IN_USE = "IN_USE",
    CLOSING = "CLOSING",
    CLOSED = "CLOSED",
    ERROR = "ERROR",
}

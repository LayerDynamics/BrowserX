/**
 * TLS Socket Wrapper
 *
 * Wraps TLSConnection to implement the Socket interface for seamless
 * integration with ConnectionPool. All read/write operations go through
 * TLS encryption/decryption.
 */

import type { ByteBuffer, FileDescriptor, Port } from "../../../types/identifiers.ts";
import type { Socket, SocketState, SocketStats } from "../../../types/network.ts";
import { SocketState as SocketStateEnum, TLSHandshakeState } from "../../../types/network.ts";
import type { TLSConnection } from "./TLSConnection.ts";

/**
 * TLS Socket - implements Socket interface over TLSConnection
 *
 * This wrapper allows TLSConnection to be used wherever a Socket is expected,
 * ensuring that all data is encrypted/decrypted through the TLS layer.
 */
export class TLSSocket implements Socket {
  private tlsConnection: TLSConnection;
  private underlyingSocket: Socket;
  private _state: SocketState = SocketStateEnum.OPEN;

  constructor(tlsConnection: TLSConnection) {
    this.tlsConnection = tlsConnection;
    this.underlyingSocket = tlsConnection.getSocket();

    // Verify TLS handshake is established
    this.validateTLSHandshakeState();
  }

  /**
   * Validate that TLS handshake has completed successfully
   */
  private validateTLSHandshakeState(): void {
    const handshakeState = this.tlsConnection.getHandshakeState();

    // Verify handshake is in ESTABLISHED state
    if (handshakeState !== TLSHandshakeState.ESTABLISHED) {
      throw new Error(
        `TLSSocket requires established TLS connection, current state: ${handshakeState}`,
      );
    }

    const tlsInfo = this.tlsConnection.getInfo();
    // Certificate exists but not verified - potential security issue
    if (!tlsInfo.certificateVerified && tlsInfo.peerCertificate !== null) {
      console.warn("TLS certificate present but not verified");
    }
  }

  /**
   * Map TLS handshake state to socket state
   */
  private getTLSBasedState(): SocketState {
    const handshakeState = this.tlsConnection.getHandshakeState();

    switch (handshakeState) {
      case TLSHandshakeState.ESTABLISHED:
        return this._state;
      case TLSHandshakeState.NONE:
        return SocketStateEnum.CLOSED;
      case TLSHandshakeState.ERROR:
        return SocketStateEnum.ERROR;
      case TLSHandshakeState.CLIENT_HELLO:
      case TLSHandshakeState.SERVER_HELLO:
      case TLSHandshakeState.CERTIFICATE:
      case TLSHandshakeState.KEY_EXCHANGE:
      case TLSHandshakeState.FINISHED:
        // Still in handshake - treat as opening
        return SocketStateEnum.OPENING;
      default:
        return SocketStateEnum.ERROR;
    }
  }

  get fd(): FileDescriptor {
    return this.underlyingSocket.fd;
  }

  get state(): SocketState {
    // Combine socket state with TLS state validation
    if (this._state === SocketStateEnum.OPEN) {
      return this.getTLSBasedState();
    }
    return this._state;
  }

  get localAddress(): string {
    return this.underlyingSocket.localAddress;
  }

  get localPort(): Port {
    return this.underlyingSocket.localPort;
  }

  get remoteAddress(): string {
    return this.underlyingSocket.remoteAddress;
  }

  get remotePort(): Port {
    return this.underlyingSocket.remotePort;
  }

  /**
   * Connect - not applicable for TLSSocket as it wraps an already-connected TLSConnection
   */
  async connect(_host: string, _port: Port): Promise<void> {
    throw new Error("TLSSocket is already connected. Use TLSConnection.connect() before wrapping.");
  }

  /**
   * Read decrypted data from TLS connection
   */
  async read(buffer: ByteBuffer): Promise<number | null> {
    if (this._state !== SocketStateEnum.OPEN) {
      throw new Error(`Cannot read from TLS socket in state ${this._state}`);
    }

    try {
      return await this.tlsConnection.read(buffer);
    } catch (error) {
      this._state = SocketStateEnum.ERROR;
      throw error;
    }
  }

  /**
   * Write data through TLS encryption
   */
  async write(data: ByteBuffer): Promise<number> {
    if (this._state !== SocketStateEnum.OPEN) {
      throw new Error(`Cannot write to TLS socket in state ${this._state}`);
    }

    try {
      return await this.tlsConnection.write(data);
    } catch (error) {
      this._state = SocketStateEnum.ERROR;
      throw error;
    }
  }

  /**
   * Close TLS connection
   */
  async close(): Promise<void> {
    if (this._state === SocketStateEnum.CLOSED || this._state === SocketStateEnum.CLOSING) {
      return;
    }

    this._state = SocketStateEnum.CLOSING;

    try {
      await this.tlsConnection.close();
      this._state = SocketStateEnum.CLOSED;
    } catch (error) {
      this._state = SocketStateEnum.ERROR;
      throw error;
    }
  }

  /**
   * Get socket statistics from underlying socket
   */
  getStats(): SocketStats {
    return this.underlyingSocket.getStats();
  }

  /**
   * Get TLS connection info
   */
  getTLSInfo() {
    return this.tlsConnection.getInfo();
  }
}

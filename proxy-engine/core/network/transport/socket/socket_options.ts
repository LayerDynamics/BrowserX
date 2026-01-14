/**
 * Socket configuration options
 *
 * Controls TCP-level socket behavior
 */

/**
 * Socket options
 */
export interface SocketOptions {
  /**
   * TCP_NODELAY - Disable Nagle's algorithm
   * When true, sends data immediately without buffering
   * Default: true (lower latency for small writes)
   */
  tcpNoDelay?: boolean;

  /**
   * TCP_KEEPALIVE - Enable TCP keepalive
   * Sends periodic probes to detect dead connections
   * Default: true
   */
  tcpKeepAlive?: boolean;

  /**
   * SO_REUSEADDR - Allow address reuse
   * Allows binding to address in TIME_WAIT state
   * Default: true
   */
  reuseAddr?: boolean;

  /**
   * SO_RCVBUF - Receive buffer size in bytes
   * Default: OS default (typically 64KB-256KB)
   */
  recvBufferSize?: number;

  /**
   * SO_SNDBUF - Send buffer size in bytes
   * Default: OS default (typically 64KB-256KB)
   */
  sendBufferSize?: number;

  /**
   * Connection timeout in milliseconds
   * Default: 30000 (30 seconds)
   */
  connectTimeout?: number;

  /**
   * Read timeout in milliseconds
   * 0 means no timeout
   * Default: 0
   */
  readTimeout?: number;

  /**
   * Write timeout in milliseconds
   * 0 means no timeout
   * Default: 0
   */
  writeTimeout?: number;
}

/**
 * Default socket options
 */
export const DEFAULT_SOCKET_OPTIONS: Required<SocketOptions> = {
  tcpNoDelay: true,
  tcpKeepAlive: true,
  reuseAddr: true,
  recvBufferSize: 65536, // 64KB
  sendBufferSize: 65536, // 64KB
  connectTimeout: 30000, // 30 seconds
  readTimeout: 0, // No timeout
  writeTimeout: 0, // No timeout
};

/**
 * Merge socket options with defaults
 */
export function mergeSocketOptions(options: SocketOptions = {}): Required<SocketOptions> {
  return {
    ...DEFAULT_SOCKET_OPTIONS,
    ...options,
  };
}

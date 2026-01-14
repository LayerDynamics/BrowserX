/**
 * Socket layer module
 *
 * Provides TCP socket abstraction with statistics and configuration
 */

export { Socket, SocketState } from "./socket.ts";

export {
  DEFAULT_SOCKET_OPTIONS,
  mergeSocketOptions,
  type SocketOptions,
} from "./socket_options.ts";

export {
  createSocketStats,
  formatSocketStats,
  getAge,
  getAvgBytesPerRead,
  getAvgBytesPerWrite,
  getIdleTime,
  type SocketStats,
} from "./socket_stats.ts";

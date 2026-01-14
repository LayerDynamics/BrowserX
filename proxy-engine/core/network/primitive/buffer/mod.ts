/**
 * Buffer management module
 *
 * Provides buffer pools, stream readers, and stream writers for
 * efficient network I/O operations.
 */

export {
  acquireBuffer,
  BufferPool,
  type BufferPoolStats,
  getGlobalBufferPool,
  releaseBuffer,
  setGlobalBufferPool,
} from "./buffer_pool.ts";

export { StreamReader, type StreamReaderOptions } from "./stream_reader.ts";

export { StreamWriter, type StreamWriterOptions } from "./stream_writer.ts";

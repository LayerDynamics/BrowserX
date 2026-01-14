/**
 * Compression Middleware
 *
 * Response compression using gzip, deflate, or brotli
 */

import type { RequestContext, ResponseMiddleware } from "./types.ts";
import type { HTTPRequest, HTTPResponse } from "../../core/network/transport/http/http.ts";

/**
 * Compression encoding
 */
export type CompressionEncoding = "gzip" | "deflate" | "br" | "identity";

/**
 * Compression configuration
 */
export interface CompressionConfig {
  /**
   * Supported encodings (in preference order)
   */
  encodings?: CompressionEncoding[];

  /**
   * Minimum size to compress (bytes)
   */
  threshold?: number;

  /**
   * Compression level (0-9, higher = more compression, slower)
   */
  level?: number;

  /**
   * Content types to compress (regex patterns)
   */
  filter?: RegExp[];

  /**
   * Skip compression for certain requests
   */
  skip?: (request: HTTPRequest, response: HTTPResponse, context: RequestContext) => boolean;
}

/**
 * Compression middleware
 */
export class CompressionMiddleware implements ResponseMiddleware {
  readonly name = "compression";

  private config: Required<CompressionConfig>;

  constructor(config: CompressionConfig = {}) {
    this.config = {
      encodings: config.encodings || ["gzip", "deflate"],
      threshold: config.threshold || 1024, // 1KB
      level: config.level || 6,
      filter: config.filter || [
        /^text\//,
        /^application\/json/,
        /^application\/javascript/,
        /^application\/xml/,
        /\+json$/,
        /\+xml$/,
      ],
      skip: config.skip || (() => false),
    };
  }

  async processResponse(
    request: HTTPRequest,
    response: HTTPResponse,
    context: RequestContext,
  ): Promise<HTTPResponse> {
    // Skip if configured
    if (this.config.skip(request, response, context)) {
      return response;
    }

    // Check if response is already compressed
    if (response.headers["content-encoding"]) {
      return response;
    }

    // Check content type filter
    const contentType = response.headers["content-type"];
    if (contentType && !this.shouldCompress(contentType)) {
      return response;
    }

    // Check if body exists
    if (!response.body) {
      return response;
    }

    // Check size threshold
    if (response.body.length < this.config.threshold) {
      return response;
    }

    // Get accepted encodings from request
    const acceptEncoding = request.headers["accept-encoding"] || "";
    const encoding = this.selectEncoding(acceptEncoding);

    if (!encoding || encoding === "identity") {
      return response;
    }

    // Compress response body
    try {
      const compressed = await this.compress(response.body, encoding);

      // Only use compression if it actually reduces size
      if (compressed.length < response.body.length) {
        return {
          ...response,
          headers: {
            ...response.headers,
            "content-encoding": encoding,
            "content-length": compressed.length.toString(),
            "vary": this.addVaryHeader(response.headers["vary"]),
          },
          body: compressed,
        };
      }
    } catch (error) {
      console.error(`Compression failed:`, error);
    }

    return response;
  }

  /**
   * Check if content type should be compressed
   */
  private shouldCompress(contentType: string): boolean {
    for (const pattern of this.config.filter) {
      if (pattern.test(contentType)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Select best encoding from Accept-Encoding header
   */
  private selectEncoding(acceptEncoding: string): CompressionEncoding {
    const accepted = this.parseAcceptEncoding(acceptEncoding);

    // Find best match in preference order
    for (const encoding of this.config.encodings) {
      if (accepted[encoding] !== undefined && accepted[encoding] > 0) {
        return encoding;
      }
    }

    return "identity";
  }

  /**
   * Parse Accept-Encoding header
   */
  private parseAcceptEncoding(
    header: string,
  ): Record<string, number> {
    const encodings: Record<string, number> = {};

    const parts = header.split(",");
    for (const part of parts) {
      const [encoding, qValue] = part.trim().split(";q=");
      const quality = qValue ? parseFloat(qValue) : 1;

      if (encoding) {
        encodings[encoding.trim()] = quality;
      }
    }

    return encodings;
  }

  /**
   * Compress data using specified encoding
   */
  private async compress(
    data: Uint8Array,
    encoding: CompressionEncoding,
  ): Promise<Uint8Array> {
    switch (encoding) {
      case "gzip":
        return await this.compressGzip(data);

      case "deflate":
        return await this.compressDeflate(data);

      case "br":
        return await this.compressBrotli(data);

      case "identity":
        return data;

      default:
        throw new Error(`Unknown encoding: ${encoding}`);
    }
  }

  /**
   * Compress using gzip
   */
  private async compressGzip(data: Uint8Array): Promise<Uint8Array> {
    // Use Deno's built-in compression
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(data);
        controller.close();
      },
    });

    const compressed = stream.pipeThrough(new CompressionStream("gzip"));
    const chunks: Uint8Array[] = [];

    for await (const chunk of compressed) {
      chunks.push(chunk);
    }

    return this.concatChunks(chunks);
  }

  /**
   * Compress using deflate
   */
  private async compressDeflate(data: Uint8Array): Promise<Uint8Array> {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(data);
        controller.close();
      },
    });

    const compressed = stream.pipeThrough(new CompressionStream("deflate"));
    const chunks: Uint8Array[] = [];

    for await (const chunk of compressed) {
      chunks.push(chunk);
    }

    return this.concatChunks(chunks);
  }

  /**
   * Compress using brotli
   * Note: Brotli requires native implementation or wasm module
   */
  private async compressBrotli(data: Uint8Array): Promise<Uint8Array> {
    // Brotli is not natively supported in Deno's CompressionStream yet
    // Fall back to gzip
    return await this.compressGzip(data);
  }

  /**
   * Concatenate chunks into single Uint8Array
   */
  private concatChunks(chunks: Uint8Array[]): Uint8Array {
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);

    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  }

  /**
   * Add Accept-Encoding to Vary header
   */
  private addVaryHeader(existing?: string): string {
    if (!existing) {
      return "Accept-Encoding";
    }

    if (existing.includes("Accept-Encoding")) {
      return existing;
    }

    return `${existing}, Accept-Encoding`;
  }

  /**
   * Get configuration
   */
  getConfig(): Readonly<Required<CompressionConfig>> {
    return { ...this.config };
  }
}

/**
 * Content Encoding Utilities
 *
 * Handle gzip, deflate, and brotli compression/decompression
 */

/**
 * Supported encoding types
 */
export type Encoding = "gzip" | "deflate" | "br" | "identity";

/**
 * Compress data using gzip
 */
export async function gzipCompress(data: Uint8Array): Promise<Uint8Array> {
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

  return concatenateUint8Arrays(chunks);
}

/**
 * Decompress gzip data
 */
export async function gzipDecompress(data: Uint8Array): Promise<Uint8Array> {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });

  const decompressed = stream.pipeThrough(new DecompressionStream("gzip"));
  const chunks: Uint8Array[] = [];

  for await (const chunk of decompressed) {
    chunks.push(chunk);
  }

  return concatenateUint8Arrays(chunks);
}

/**
 * Compress data using deflate
 */
export async function deflateCompress(data: Uint8Array): Promise<Uint8Array> {
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

  return concatenateUint8Arrays(chunks);
}

/**
 * Decompress deflate data
 */
export async function deflateDecompress(
  data: Uint8Array,
): Promise<Uint8Array> {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });

  const decompressed = stream.pipeThrough(new DecompressionStream("deflate"));
  const chunks: Uint8Array[] = [];

  for await (const chunk of decompressed) {
    chunks.push(chunk);
  }

  return concatenateUint8Arrays(chunks);
}

/**
 * Compress data using brotli
 */
export async function brotliCompress(data: Uint8Array): Promise<Uint8Array> {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });

  const compressed = stream.pipeThrough(
    new CompressionStream("deflate-raw"),
  ); // Brotli not yet in Deno, use deflate-raw
  const chunks: Uint8Array[] = [];

  for await (const chunk of compressed) {
    chunks.push(chunk);
  }

  return concatenateUint8Arrays(chunks);
}

/**
 * Decompress brotli data
 */
export async function brotliDecompress(data: Uint8Array): Promise<Uint8Array> {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });

  const decompressed = stream.pipeThrough(
    new DecompressionStream("deflate-raw"),
  ); // Brotli not yet in Deno, use deflate-raw
  const chunks: Uint8Array[] = [];

  for await (const chunk of decompressed) {
    chunks.push(chunk);
  }

  return concatenateUint8Arrays(chunks);
}

/**
 * Compress data using specified encoding
 */
export async function compress(
  data: Uint8Array,
  encoding: Encoding,
): Promise<Uint8Array> {
  switch (encoding) {
    case "gzip":
      return gzipCompress(data);
    case "deflate":
      return deflateCompress(data);
    case "br":
      return brotliCompress(data);
    case "identity":
      return data;
    default:
      throw new Error(`Unsupported encoding: ${encoding}`);
  }
}

/**
 * Decompress data using specified encoding
 */
export async function decompress(
  data: Uint8Array,
  encoding: Encoding,
): Promise<Uint8Array> {
  switch (encoding) {
    case "gzip":
      return gzipDecompress(data);
    case "deflate":
      return deflateDecompress(data);
    case "br":
      return brotliDecompress(data);
    case "identity":
      return data;
    default:
      throw new Error(`Unsupported encoding: ${encoding}`);
  }
}

/**
 * Parse Content-Encoding header
 */
export function parseContentEncoding(value: string): Encoding[] {
  return value
    .split(",")
    .map((enc) => enc.trim() as Encoding)
    .filter((enc) =>
      enc === "gzip" || enc === "deflate" || enc === "br" || enc === "identity"
    );
}

/**
 * Decompress data based on Content-Encoding header
 */
export async function decompressResponse(
  data: Uint8Array,
  contentEncoding?: string,
): Promise<Uint8Array> {
  if (!contentEncoding) {
    return data;
  }

  const encodings = parseContentEncoding(contentEncoding);
  let result = data;

  // Apply decodings in reverse order (last encoding first)
  for (let i = encodings.length - 1; i >= 0; i--) {
    result = await decompress(result, encodings[i]);
  }

  return result;
}

/**
 * Compress data for request with given encoding
 */
export async function compressRequest(
  data: Uint8Array,
  encoding: Encoding,
): Promise<Uint8Array> {
  return compress(data, encoding);
}

/**
 * Get best encoding from Accept-Encoding header
 */
export function selectEncoding(acceptEncoding?: string): Encoding {
  if (!acceptEncoding) {
    return "identity";
  }

  const encodings = acceptEncoding
    .split(",")
    .map((enc) => {
      const [name, qValue] = enc.trim().split(";");
      const quality = qValue
        ? parseFloat(qValue.split("=")[1] || "1")
        : 1.0;
      return { name: name.trim() as Encoding, quality };
    })
    .sort((a, b) => b.quality - a.quality);

  for (const { name, quality } of encodings) {
    if (quality > 0 && (name === "gzip" || name === "deflate" || name === "br")) {
      return name;
    }
  }

  return "identity";
}

/**
 * Check if data is compressed
 */
export function isCompressed(data: Uint8Array): boolean {
  if (data.length < 2) {
    return false;
  }

  // Check for gzip magic number (0x1f 0x8b)
  if (data[0] === 0x1f && data[1] === 0x8b) {
    return true;
  }

  // Check for zlib/deflate magic number (0x78)
  if (data[0] === 0x78) {
    return true;
  }

  return false;
}

/**
 * Concatenate Uint8Arrays
 */
function concatenateUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }

  return result;
}

/**
 * Calculate compression ratio
 */
export function compressionRatio(
  original: Uint8Array,
  compressed: Uint8Array,
): number {
  if (original.length === 0) return 0;
  return (1 - compressed.length / original.length) * 100;
}

/**
 * Check if content type should be compressed
 */
export function shouldCompress(contentType: string, minSize = 1024): boolean {
  const compressibleTypes = [
    "text/",
    "application/json",
    "application/javascript",
    "application/xml",
    "application/x-javascript",
    "image/svg+xml",
  ];

  return compressibleTypes.some((type) =>
    contentType.toLowerCase().startsWith(type)
  );
}

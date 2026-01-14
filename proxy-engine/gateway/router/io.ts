/**
 * Router I/O Utilities
 *
 * Helper functions for reading and writing HTTP request/response data
 */

import type { IncomingRequest } from "./request_router.ts";

/**
 * Read full request body from incoming request
 */
export async function readRequestBody(
  request: Request
): Promise<Uint8Array> {
  const body = await request.arrayBuffer();
  return new Uint8Array(body);
}

/**
 * Read request body as text
 */
export async function readRequestBodyText(
  request: Request
): Promise<string> {
  return await request.text();
}

/**
 * Read request body as JSON
 */
export async function readRequestBodyJSON<T = unknown>(
  request: Request
): Promise<T> {
  return await request.json();
}

/**
 * Write response with body
 */
export function writeResponse(
  statusCode: number,
  headers: Record<string, string>,
  body?: Uint8Array | string
): Response {
  const responseHeaders = new Headers(headers);

  if (body) {
    if (typeof body === "string") {
      return new Response(body, {
        status: statusCode,
        headers: responseHeaders,
      });
    } else {
      // Create new Uint8Array to ensure correct buffer type
      const bodyBytes = new Uint8Array(body);
      return new Response(bodyBytes, {
        status: statusCode,
        headers: responseHeaders,
      });
    }
  }

  return new Response(null, {
    status: statusCode,
    headers: responseHeaders,
  });
}

/**
 * Write JSON response
 */
export function writeJSONResponse<T = unknown>(
  statusCode: number,
  data: T,
  additionalHeaders?: Record<string, string>
): Response {
  const headers = {
    "content-type": "application/json",
    ...additionalHeaders,
  };

  return new Response(JSON.stringify(data), {
    status: statusCode,
    headers,
  });
}

/**
 * Write error response
 */
export function writeErrorResponse(
  statusCode: number,
  message: string,
  details?: unknown
): Response {
  return writeJSONResponse(statusCode, {
    error: message,
    statusCode,
    details,
  });
}

/**
 * Convert Request to IncomingRequest format
 */
export async function requestToIncoming(
  request: Request,
  clientIP: string
): Promise<IncomingRequest> {
  const url = new URL(request.url);
  const headers: Record<string, string> = {};

  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  let body: Uint8Array | undefined;
  if (request.body && request.method !== "GET" && request.method !== "HEAD") {
    body = await readRequestBody(request);
  }

  return {
    method: request.method as import("../../core/network/primitive/header/request_line_parser.ts").HTTPMethod,
    url,
    headers,
    body,
    clientIP,
    metadata: {},
  };
}

/**
 * Stream response body in chunks
 */
export async function* streamResponseBody(
  response: Response,
  chunkSize = 16384
): AsyncGenerator<Uint8Array> {
  if (!response.body) {
    return;
  }

  const reader = response.body.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      if (value) {
        yield value;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Create streaming response from async generator
 */
export function createStreamingResponse(
  generator: AsyncGenerator<Uint8Array>,
  statusCode = 200,
  headers?: Record<string, string>
): Response {
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of generator) {
          controller.enqueue(chunk);
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    status: statusCode,
    headers: headers ? new Headers(headers) : undefined,
  });
}

/**
 * Copy headers from one Headers object to another
 */
export function copyHeaders(
  from: Headers,
  to: Headers,
  exclude?: string[]
): void {
  const excludeSet = new Set(exclude?.map((h) => h.toLowerCase()) || []);

  from.forEach((value, key) => {
    if (!excludeSet.has(key.toLowerCase())) {
      to.set(key, value);
    }
  });
}

/**
 * Merge multiple header objects
 */
export function mergeHeaders(
  ...headerObjects: Array<Record<string, string> | Headers>
): Headers {
  const merged = new Headers();

  for (const obj of headerObjects) {
    if (obj instanceof Headers) {
      obj.forEach((value, key) => {
        merged.set(key, value);
      });
    } else {
      Object.entries(obj).forEach(([key, value]) => {
        merged.set(key, value);
      });
    }
  }

  return merged;
}

/**
 * Convert Headers to plain object
 */
export function headersToObject(headers: Headers): Record<string, string> {
  const obj: Record<string, string> = {};

  headers.forEach((value, key) => {
    obj[key.toLowerCase()] = value;
  });

  return obj;
}

/**
 * Check if request has body
 */
export function requestHasBody(request: Request): boolean {
  const method = request.method.toUpperCase();
  return method === "POST" || method === "PUT" || method === "PATCH";
}

/**
 * Get content length from headers
 */
export function getContentLength(headers: Headers): number | null {
  const contentLength = headers.get("content-length");
  if (!contentLength) {
    return null;
  }

  const length = parseInt(contentLength, 10);
  return isNaN(length) ? null : length;
}

/**
 * Check if response is chunked transfer encoding
 */
export function isChunkedEncoding(headers: Headers): boolean {
  const transferEncoding = headers.get("transfer-encoding");
  return transferEncoding?.toLowerCase().includes("chunked") || false;
}

/**
 * Network Functions
 * Functions that interact with network requests/responses
 */

import type { DataType, FunctionImplementation } from "../types.ts";
import { FunctionCategory } from "../types.ts";

/**
 * HEADER - Get request/response header value
 */
export const HEADER: FunctionImplementation = {
  signature: {
    name: "HEADER",
    category: FunctionCategory.NETWORK,
    minArgs: 2,
    maxArgs: 2,
    argTypes: [["object" as DataType, "string" as DataType]],
    returnType: "string" as DataType,
    description: "Get header value from request or response object",
    examples: ['HEADER(response, "content-type") → "text/html"'],
    isAsync: false,
  },
  implementation: (obj: unknown, headerName: unknown): string | null => {
    if (!obj || typeof obj !== "object") {
      throw new TypeError(
        "HEADER function requires an object with headers (request or response object)",
      );
    }

    const headers = (obj as any).headers;

    if (!headers || typeof headers !== "object") {
      throw new TypeError(
        "HEADER function requires an object with a 'headers' property",
      );
    }

    // Headers are case-insensitive
    const name = String(headerName).toLowerCase();

    // Handle Map
    if (headers instanceof Map) {
      return headers.get(name) || null;
    }

    // Handle plain object
    return headers[name] || null;
  },
};

/**
 * STATUS - Get response status code
 */
export const STATUS: FunctionImplementation = {
  signature: {
    name: "STATUS",
    category: FunctionCategory.NETWORK,
    minArgs: 1,
    maxArgs: 1,
    argTypes: [["object" as DataType]],
    returnType: "number" as DataType,
    description: "Get HTTP status code from response object",
    examples: ["STATUS(response) → 200"],
    isAsync: false,
  },
  implementation: (response: unknown): number | null => {
    if (!response || typeof response !== "object") {
      throw new TypeError(
        "STATUS function requires a response object",
      );
    }

    const statusCode = (response as any).statusCode || (response as any).status;

    if (statusCode === undefined) {
      throw new TypeError(
        "STATUS function requires a response object with 'status' or 'statusCode' property",
      );
    }

    return Number(statusCode);
  },
};

/**
 * BODY - Get response body as string
 */
export const BODY: FunctionImplementation = {
  signature: {
    name: "BODY",
    category: FunctionCategory.NETWORK,
    minArgs: 1,
    maxArgs: 1,
    argTypes: [["object" as DataType]],
    returnType: "string" as DataType,
    description: "Get response body as string",
    examples: ['BODY(response) → "<!DOCTYPE html>..."'],
    isAsync: false,
  },
  implementation: (response: unknown): string | null => {
    if (!response || typeof response !== "object") {
      throw new TypeError(
        "BODY function requires a response object",
      );
    }

    const body = (response as any).body;

    if (body === undefined || body === null) {
      // Return empty string for missing body instead of null
      return "";
    }

    // Handle Uint8Array
    if (body instanceof Uint8Array) {
      return new TextDecoder().decode(body);
    }

    // Handle string
    if (typeof body === "string") {
      return body;
    }

    // Convert to string
    return String(body);
  },
};

/**
 * CACHED - Check if response was served from cache
 */
export const CACHED: FunctionImplementation = {
  signature: {
    name: "CACHED",
    category: FunctionCategory.NETWORK,
    minArgs: 1,
    maxArgs: 1,
    argTypes: [["object" as DataType]],
    returnType: "boolean" as DataType,
    description: "Check if response was served from cache",
    examples: ["CACHED(response) → true"],
    isAsync: false,
  },
  implementation: (response: unknown): boolean => {
    if (!response || typeof response !== "object") {
      return false;
    }

    const fromCache = (response as any).fromCache || (response as any).cached;

    return Boolean(fromCache);
  },
};

/**
 * All network functions
 */
export const NETWORK_FUNCTIONS: FunctionImplementation[] = [
  HEADER,
  STATUS,
  BODY,
  CACHED,
];

/**
 * Primitive type definitions for the Query Engine
 */

/**
 * Unique identifier types
 */
export type QueryID = string;
export type RequestID = string;
export type ConnectionID = string;
export type NodeID = string;
export type RenderObjectID = string;
export type LayerID = string;
export type ProcessID = number;
export type ThreadID = number;
export type TabID = string;
export type FrameID = string;
export type TraceID = string;
export type SpanID = string;
export type SessionID = string;
export type StepID = string;

/**
 * Basic value types
 */
export type URLString = string;
export type CSSSelector = string;
export type XPathExpression = string;
export type RegexPattern = string;
export type Timestamp = number; // Unix timestamp in milliseconds
export type DurationMs = number;
export type Bytes = number;
export type Pixels = number;

/**
 * Data types supported by the query language
 */
export enum DataType {
  STRING = "String",
  NUMBER = "Number",
  BOOLEAN = "Boolean",
  NULL = "Null",
  URL = "URL",
  ARRAY = "Array",
  OBJECT = "Object",
  SET = "Set",
  ELEMENT = "Element",
  NODE_LIST = "NodeList",
  DOCUMENT = "Document",
  REQUEST = "Request",
  RESPONSE = "Response",
  HEADERS = "Headers",
  COOKIE = "Cookie",
  SELECTOR = "Selector",
  XPATH = "XPath",
  REGEX = "Regex",
  DURATION = "Duration",
  BYTES = "Bytes",
  UNKNOWN = "Unknown",
}

/**
 * HTTP method types
 */
export type HTTPMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "DELETE"
  | "PATCH"
  | "HEAD"
  | "OPTIONS"
  | "CONNECT"
  | "TRACE";

/**
 * HTTP version types
 */
export type HTTPVersion = "1.0" | "1.1" | "2.0" | "3.0";

/**
 * HTTP status code type
 */
export type HTTPStatusCode = number;

/**
 * Byte buffer type
 */
export type ByteBuffer = Uint8Array;

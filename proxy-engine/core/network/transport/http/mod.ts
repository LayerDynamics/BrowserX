/**
 * HTTP Module
 *
 * Exports HTTP/1.1, HTTPS, and HTTP/2 implementations
 */

// HTTP/1.1
export { HTTP11Client, HTTP11Server, makeHTTPRequest } from "./http.ts";
export type {
  HTTPClientConfig,
  HTTPMethod,
  HTTPRequest,
  HTTPResponse,
  HTTPServerConfig,
  HTTPStatusCode,
  HTTPVersion,
} from "./http.ts";

// HTTPS
export { HTTPSClient, makeRequest as makeHTTPSRequest } from "./https.ts";
export type { HTTPSClientConfig } from "./https.ts";

// HTTP/2 - Frames
export {
  HTTP2_DEFAULT_SETTINGS,
  HTTP2_PREFACE,
  HTTP2ErrorCode,
  HTTP2FrameFlags,
  HTTP2FrameParser,
  HTTP2FrameType,
  HTTP2SettingsParameter,
} from "./http2_frames.ts";
export type {
  HTTP2DataFrame,
  HTTP2Frame,
  HTTP2FrameHeader,
  HTTP2GoAwayFrame,
  HTTP2HeadersFrame,
  HTTP2PingFrame,
  HTTP2PriorityFrame,
  HTTP2PushPromiseFrame,
  HTTP2RstStreamFrame,
  HTTP2SettingsFrame,
  HTTP2WindowUpdateFrame,
} from "./http2_frames.ts";

// HTTP/2 - Streams
export { HTTP2Stream, HTTP2StreamState } from "./http2_stream.ts";
export type { HTTP2StreamPriority } from "./http2_stream.ts";

// HTTP/2 - HPACK
export { HPACKCodec } from "./http2_hpack.ts";

// HTTP/2 - Client/Server
export {
  createHTTP2Client,
  createHTTP2Server,
  HTTP2Client,
  HTTP2Connection,
  HTTP2Server,
} from "./http2.ts";
export type { HTTP2ConnectionConfig, HTTP2ConnectionStats } from "./http2.ts";

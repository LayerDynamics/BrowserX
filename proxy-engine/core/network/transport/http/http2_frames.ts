/**
 * HTTP/2 Frame Types and Structures
 *
 * Implements the binary framing layer as defined in RFC 7540
 */

/**
 * HTTP/2 frame types
 */
export enum HTTP2FrameType {
  DATA = 0x0,
  HEADERS = 0x1,
  PRIORITY = 0x2,
  RST_STREAM = 0x3,
  SETTINGS = 0x4,
  PUSH_PROMISE = 0x5,
  PING = 0x6,
  GOAWAY = 0x7,
  WINDOW_UPDATE = 0x8,
  CONTINUATION = 0x9,
}

/**
 * HTTP/2 frame flags
 */
export enum HTTP2FrameFlags {
  NONE = 0x0,
  END_STREAM = 0x1,
  END_HEADERS = 0x4,
  PADDED = 0x8,
  PRIORITY = 0x20,
  ACK = 0x1, // For SETTINGS and PING
}

/**
 * HTTP/2 error codes
 */
export enum HTTP2ErrorCode {
  NO_ERROR = 0x0,
  PROTOCOL_ERROR = 0x1,
  INTERNAL_ERROR = 0x2,
  FLOW_CONTROL_ERROR = 0x3,
  SETTINGS_TIMEOUT = 0x4,
  STREAM_CLOSED = 0x5,
  FRAME_SIZE_ERROR = 0x6,
  REFUSED_STREAM = 0x7,
  CANCEL = 0x8,
  COMPRESSION_ERROR = 0x9,
  CONNECT_ERROR = 0xa,
  ENHANCE_YOUR_CALM = 0xb,
  INADEQUATE_SECURITY = 0xc,
  HTTP_1_1_REQUIRED = 0xd,
}

/**
 * HTTP/2 settings parameters
 */
export enum HTTP2SettingsParameter {
  HEADER_TABLE_SIZE = 0x1,
  ENABLE_PUSH = 0x2,
  MAX_CONCURRENT_STREAMS = 0x3,
  INITIAL_WINDOW_SIZE = 0x4,
  MAX_FRAME_SIZE = 0x5,
  MAX_HEADER_LIST_SIZE = 0x6,
}

/**
 * HTTP/2 frame header (9 bytes)
 */
export interface HTTP2FrameHeader {
  /**
   * Payload length (24 bits)
   */
  length: number;

  /**
   * Frame type (8 bits)
   */
  type: HTTP2FrameType;

  /**
   * Flags (8 bits)
   */
  flags: number;

  /**
   * Stream identifier (31 bits, 1 bit reserved)
   */
  streamId: number;
}

/**
 * HTTP/2 frame
 */
export interface HTTP2Frame {
  /**
   * Frame header
   */
  header: HTTP2FrameHeader;

  /**
   * Frame payload
   */
  payload: Uint8Array;
}

/**
 * DATA frame
 */
export interface HTTP2DataFrame extends HTTP2Frame {
  /**
   * Padding length (if PADDED flag set)
   */
  padLength?: number;

  /**
   * Data
   */
  data: Uint8Array;
}

/**
 * HEADERS frame
 */
export interface HTTP2HeadersFrame extends HTTP2Frame {
  /**
   * Padding length (if PADDED flag set)
   */
  padLength?: number;

  /**
   * Stream dependency (if PRIORITY flag set)
   */
  streamDependency?: number;

  /**
   * Weight (if PRIORITY flag set)
   */
  weight?: number;

  /**
   * Exclusive flag (if PRIORITY flag set)
   */
  exclusive?: boolean;

  /**
   * Header block fragment
   */
  headerBlockFragment: Uint8Array;
}

/**
 * PRIORITY frame
 */
export interface HTTP2PriorityFrame extends HTTP2Frame {
  /**
   * Stream dependency
   */
  streamDependency: number;

  /**
   * Weight (1-256)
   */
  weight: number;

  /**
   * Exclusive flag
   */
  exclusive: boolean;
}

/**
 * RST_STREAM frame
 */
export interface HTTP2RstStreamFrame extends HTTP2Frame {
  /**
   * Error code
   */
  errorCode: HTTP2ErrorCode;
}

/**
 * SETTINGS frame
 */
export interface HTTP2SettingsFrame extends HTTP2Frame {
  /**
   * Settings
   */
  settings: Map<HTTP2SettingsParameter, number>;
}

/**
 * PUSH_PROMISE frame
 */
export interface HTTP2PushPromiseFrame extends HTTP2Frame {
  /**
   * Padding length (if PADDED flag set)
   */
  padLength?: number;

  /**
   * Promised stream ID
   */
  promisedStreamId: number;

  /**
   * Header block fragment
   */
  headerBlockFragment: Uint8Array;
}

/**
 * PING frame
 */
export interface HTTP2PingFrame extends HTTP2Frame {
  /**
   * Opaque data (8 bytes)
   */
  opaqueData: Uint8Array;
}

/**
 * GOAWAY frame
 */
export interface HTTP2GoAwayFrame extends HTTP2Frame {
  /**
   * Last stream ID
   */
  lastStreamId: number;

  /**
   * Error code
   */
  errorCode: HTTP2ErrorCode;

  /**
   * Additional debug data
   */
  debugData: Uint8Array;
}

/**
 * WINDOW_UPDATE frame
 */
export interface HTTP2WindowUpdateFrame extends HTTP2Frame {
  /**
   * Window size increment
   */
  windowSizeIncrement: number;
}

/**
 * HTTP/2 frame parser
 */
export class HTTP2FrameParser {
  /**
   * Parse frame header from buffer
   */
  static parseFrameHeader(buffer: Uint8Array): HTTP2FrameHeader {
    if (buffer.length < 9) {
      throw new Error("Invalid frame header: too short");
    }

    const length = (buffer[0] << 16) | (buffer[1] << 8) | buffer[2];
    const type = buffer[3];
    const flags = buffer[4];
    const streamId = ((buffer[5] & 0x7f) << 24) | (buffer[6] << 16) | (buffer[7] << 8) | buffer[8];

    return { length, type, flags, streamId };
  }

  /**
   * Serialize frame header to buffer
   */
  static serializeFrameHeader(header: HTTP2FrameHeader): Uint8Array {
    const buffer = new Uint8Array(9);

    buffer[0] = (header.length >> 16) & 0xff;
    buffer[1] = (header.length >> 8) & 0xff;
    buffer[2] = header.length & 0xff;
    buffer[3] = header.type;
    buffer[4] = header.flags;
    buffer[5] = (header.streamId >> 24) & 0x7f; // Clear reserved bit
    buffer[6] = (header.streamId >> 16) & 0xff;
    buffer[7] = (header.streamId >> 8) & 0xff;
    buffer[8] = header.streamId & 0xff;

    return buffer;
  }

  /**
   * Parse DATA frame
   */
  static parseDataFrame(frame: HTTP2Frame): HTTP2DataFrame {
    let offset = 0;
    let padLength: number | undefined;

    if (frame.header.flags & HTTP2FrameFlags.PADDED) {
      padLength = frame.payload[offset];
      offset++;
    }

    const dataLength = frame.payload.length - offset - (padLength || 0);
    const data = frame.payload.slice(offset, offset + dataLength);

    return {
      ...frame,
      padLength,
      data,
    };
  }

  /**
   * Parse HEADERS frame
   */
  static parseHeadersFrame(frame: HTTP2Frame): HTTP2HeadersFrame {
    let offset = 0;
    let padLength: number | undefined;
    let streamDependency: number | undefined;
    let weight: number | undefined;
    let exclusive: boolean | undefined;

    if (frame.header.flags & HTTP2FrameFlags.PADDED) {
      padLength = frame.payload[offset];
      offset++;
    }

    if (frame.header.flags & HTTP2FrameFlags.PRIORITY) {
      const dependencyBytes = (frame.payload[offset] << 24) |
        (frame.payload[offset + 1] << 16) |
        (frame.payload[offset + 2] << 8) |
        frame.payload[offset + 3];
      exclusive = !!(dependencyBytes & 0x80000000);
      streamDependency = dependencyBytes & 0x7fffffff;
      weight = frame.payload[offset + 4] + 1; // Weight is 0-255, represents 1-256
      offset += 5;
    }

    const headerBlockLength = frame.payload.length - offset - (padLength || 0);
    const headerBlockFragment = frame.payload.slice(offset, offset + headerBlockLength);

    return {
      ...frame,
      padLength,
      streamDependency,
      weight,
      exclusive,
      headerBlockFragment,
    };
  }

  /**
   * Parse SETTINGS frame
   */
  static parseSettingsFrame(frame: HTTP2Frame): HTTP2SettingsFrame {
    const settings = new Map<HTTP2SettingsParameter, number>();

    for (let i = 0; i < frame.payload.length; i += 6) {
      const id = (frame.payload[i] << 8) | frame.payload[i + 1];
      const value = (frame.payload[i + 2] << 24) |
        (frame.payload[i + 3] << 16) |
        (frame.payload[i + 4] << 8) |
        frame.payload[i + 5];
      settings.set(id, value);
    }

    return {
      ...frame,
      settings,
    };
  }

  /**
   * Parse WINDOW_UPDATE frame
   */
  static parseWindowUpdateFrame(frame: HTTP2Frame): HTTP2WindowUpdateFrame {
    const windowSizeIncrement = (
      (frame.payload[0] << 24) |
      (frame.payload[1] << 16) |
      (frame.payload[2] << 8) |
      frame.payload[3]
    ) & 0x7fffffff; // Clear reserved bit

    return {
      ...frame,
      windowSizeIncrement,
    };
  }

  /**
   * Create DATA frame
   */
  static createDataFrame(
    streamId: number,
    data: Uint8Array,
    endStream = false,
  ): HTTP2DataFrame {
    const flags = endStream ? HTTP2FrameFlags.END_STREAM : HTTP2FrameFlags.NONE;

    return {
      header: {
        length: data.length,
        type: HTTP2FrameType.DATA,
        flags,
        streamId,
      },
      payload: data,
      data,
    };
  }

  /**
   * Create HEADERS frame
   */
  static createHeadersFrame(
    streamId: number,
    headerBlock: Uint8Array,
    endStream = false,
    endHeaders = true,
  ): HTTP2HeadersFrame {
    let flags = HTTP2FrameFlags.NONE;
    if (endStream) flags |= HTTP2FrameFlags.END_STREAM;
    if (endHeaders) flags |= HTTP2FrameFlags.END_HEADERS;

    return {
      header: {
        length: headerBlock.length,
        type: HTTP2FrameType.HEADERS,
        flags,
        streamId,
      },
      payload: headerBlock,
      headerBlockFragment: headerBlock,
    };
  }

  /**
   * Create SETTINGS frame
   */
  static createSettingsFrame(
    settings: Map<HTTP2SettingsParameter, number>,
    ack = false,
  ): HTTP2SettingsFrame {
    const payload = new Uint8Array(settings.size * 6);
    let offset = 0;

    for (const [id, value] of settings.entries()) {
      payload[offset] = (id >> 8) & 0xff;
      payload[offset + 1] = id & 0xff;
      payload[offset + 2] = (value >> 24) & 0xff;
      payload[offset + 3] = (value >> 16) & 0xff;
      payload[offset + 4] = (value >> 8) & 0xff;
      payload[offset + 5] = value & 0xff;
      offset += 6;
    }

    return {
      header: {
        length: payload.length,
        type: HTTP2FrameType.SETTINGS,
        flags: ack ? HTTP2FrameFlags.ACK : HTTP2FrameFlags.NONE,
        streamId: 0, // SETTINGS is always on stream 0
      },
      payload,
      settings,
    };
  }

  /**
   * Create WINDOW_UPDATE frame
   */
  static createWindowUpdateFrame(
    streamId: number,
    increment: number,
  ): HTTP2WindowUpdateFrame {
    const payload = new Uint8Array(4);
    payload[0] = (increment >> 24) & 0x7f; // Clear reserved bit
    payload[1] = (increment >> 16) & 0xff;
    payload[2] = (increment >> 8) & 0xff;
    payload[3] = increment & 0xff;

    return {
      header: {
        length: 4,
        type: HTTP2FrameType.WINDOW_UPDATE,
        flags: HTTP2FrameFlags.NONE,
        streamId,
      },
      payload,
      windowSizeIncrement: increment,
    };
  }

  /**
   * Create RST_STREAM frame
   */
  static createRstStreamFrame(
    streamId: number,
    errorCode: HTTP2ErrorCode,
  ): HTTP2RstStreamFrame {
    const payload = new Uint8Array(4);
    payload[0] = (errorCode >> 24) & 0xff;
    payload[1] = (errorCode >> 16) & 0xff;
    payload[2] = (errorCode >> 8) & 0xff;
    payload[3] = errorCode & 0xff;

    return {
      header: {
        length: 4,
        type: HTTP2FrameType.RST_STREAM,
        flags: HTTP2FrameFlags.NONE,
        streamId,
      },
      payload,
      errorCode,
    };
  }

  /**
   * Serialize frame to bytes
   */
  static serializeFrame(frame: HTTP2Frame): Uint8Array {
    const header = this.serializeFrameHeader(frame.header);
    const result = new Uint8Array(header.length + frame.payload.length);
    result.set(header, 0);
    result.set(frame.payload, header.length);
    return result;
  }
}

/**
 * HTTP/2 connection preface
 */
export const HTTP2_PREFACE = new TextEncoder().encode("PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n");

/**
 * Default HTTP/2 settings
 */
export const HTTP2_DEFAULT_SETTINGS = new Map<HTTP2SettingsParameter, number>([
  [HTTP2SettingsParameter.HEADER_TABLE_SIZE, 4096],
  [HTTP2SettingsParameter.ENABLE_PUSH, 1],
  [HTTP2SettingsParameter.MAX_CONCURRENT_STREAMS, 100],
  [HTTP2SettingsParameter.INITIAL_WINDOW_SIZE, 65535],
  [HTTP2SettingsParameter.MAX_FRAME_SIZE, 16384],
  [HTTP2SettingsParameter.MAX_HEADER_LIST_SIZE, 8192],
]);

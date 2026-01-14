// ============================================================================
// IDENTIFIERS
// ============================================================================

/**
 * Unique request identifier for tracking HTTP requests
 */
export type RequestID = string;

/**
 * Connection identifier within connection pool
 */
export type ConnectionID = string;

/**
 * Process identifier
 */
export type ProcessID = number;

/**
 * Thread identifier
 */
export type ThreadID = number;

/**
 * Tab identifier
 */
export type TabID = string;

/**
 * Frame identifier (for iframes)
 */
export type FrameID = string;

/**
 * Node identifier in DOM tree
 */
export type NodeID = number;

/**
 * Render object identifier
 */
export type RenderObjectID = string;

/**
 * Layer identifier for compositor
 */
export type LayerID = string;

/**
 * Trace identifier for distributed tracing
 */
export type TraceID = string;

/**
 * Span identifier for tracing
 */
export type SpanID = string;

// ============================================================================
// PRIMITIVE TYPES
// ============================================================================

/**
 * Milliseconds since epoch
 */
export type Timestamp = number;

/**
 * Duration in milliseconds
 */
export type Duration = number;

/**
 * Duration in nanoseconds (for GPU timing)
 */
export type Nanoseconds = number;

/**
 * Byte count
 */
export type ByteCount = number;

/**
 * Network port number (1-65535)
 */
export type Port = number;

/**
 * Hostname or IP address
 */
export type Host = string;

/**
 * File descriptor
 */
export type FileDescriptor = number;

/**
 * Pixel dimension
 */
export type Pixels = number;

/**
 * Percentage (0-100)
 */
export type Percentage = number;

/**
 * Raw byte buffer
 */
export type ByteBuffer = Uint8Array<ArrayBuffer>;

/**
 * URL string
 */
export type URLString = string;

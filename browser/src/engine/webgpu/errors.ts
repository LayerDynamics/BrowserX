/**
 * WebGPU Error Classes
 *
 * Comprehensive error hierarchy for WebGPU operations with context information
 * for debugging and error recovery.
 */

import type {
    GPUDeviceID,
    GPUBufferID,
    GPUTextureID,
    GPURenderPipelineID,
    GPUComputePipelineID,
    GPUDeviceState,
    GPUBufferState,
    GPUPipelineState,
} from "../../types/webgpu.ts";

// ============================================================================
// Base WebGPU Error
// ============================================================================

/**
 * Base error class for all WebGPU-related errors.
 * Provides common context and recovery information.
 */
export class WebGPUError extends Error {
    /** Whether this error is potentially recoverable */
    public readonly recoverable: boolean;

    /** Error code for programmatic handling */
    public readonly code: string;

    /** Additional context for debugging */
    public readonly context?: Record<string, unknown>;

    /** Timestamp when error occurred */
    public readonly timestamp: number;

    constructor(
        message: string,
        options: {
            recoverable?: boolean;
            code?: string;
            context?: Record<string, unknown>;
            cause?: Error;
        } = {}
    ) {
        super(message);
        this.name = "WebGPUError";
        this.recoverable = options.recoverable ?? false;
        this.code = options.code ?? "WEBGPU_ERROR";
        this.context = options.context;
        this.timestamp = Date.now();

        if (options.cause) {
            this.cause = options.cause;
        }

        // Maintain proper stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

// ============================================================================
// Device Errors
// ============================================================================

/**
 * Error related to GPU device operations.
 * Includes device state and recovery information.
 */
export class GPUDeviceError extends WebGPUError {
    /** ID of the device that encountered the error */
    public readonly deviceId?: GPUDeviceID;

    /** Current device state when error occurred */
    public readonly deviceState?: GPUDeviceState;

    /** Whether device was lost */
    public readonly deviceLost: boolean;

    constructor(
        message: string,
        options: {
            deviceId?: GPUDeviceID;
            deviceState?: GPUDeviceState;
            deviceLost?: boolean;
            recoverable?: boolean;
            code?: string;
            context?: Record<string, unknown>;
            cause?: Error;
        } = {}
    ) {
        super(message, {
            recoverable: options.recoverable ?? options.deviceLost === true, // Lost devices may be recoverable
            code: options.code ?? "GPU_DEVICE_ERROR",
            context: {
                ...options.context,
                deviceId: options.deviceId,
                deviceState: options.deviceState,
                deviceLost: options.deviceLost,
            },
            cause: options.cause,
        });
        this.name = "GPUDeviceError";
        this.deviceId = options.deviceId;
        this.deviceState = options.deviceState;
        this.deviceLost = options.deviceLost ?? false;
    }
}

/**
 * Error thrown when device initialization fails.
 */
export class GPUDeviceInitializationError extends GPUDeviceError {
    constructor(message: string, context?: Record<string, unknown>) {
        super(message, {
            code: "GPU_DEVICE_INITIALIZATION_FAILED",
            recoverable: false, // Initialization failures are typically not recoverable
            context,
        });
        this.name = "GPUDeviceInitializationError";
    }
}

/**
 * Error thrown when device is lost and cannot recover.
 */
export class GPUDeviceLostError extends GPUDeviceError {
    /** Reason for device loss */
    public readonly reason: "unknown" | "destroyed";

    constructor(
        reason: "unknown" | "destroyed",
        deviceId?: GPUDeviceID,
        context?: Record<string, unknown>
    ) {
        super(`GPU device lost: ${reason}`, {
            deviceId,
            deviceLost: true,
            recoverable: reason === "unknown", // Unknown losses may be recoverable
            code: "GPU_DEVICE_LOST",
            context: { ...context, reason },
        });
        this.name = "GPUDeviceLostError";
        this.reason = reason;
    }
}

// ============================================================================
// Buffer Errors
// ============================================================================

/**
 * Error related to GPU buffer operations.
 * Includes buffer state and operation context.
 */
export class GPUBufferError extends WebGPUError {
    /** ID of the buffer that encountered the error */
    public readonly bufferId?: GPUBufferID;

    /** Current buffer state when error occurred */
    public readonly bufferState?: GPUBufferState;

    /** Buffer size in bytes */
    public readonly size?: number;

    /** Buffer usage flags */
    public readonly usage?: number;

    constructor(
        message: string,
        options: {
            bufferId?: GPUBufferID;
            bufferState?: GPUBufferState;
            size?: number;
            usage?: number;
            recoverable?: boolean;
            code?: string;
            context?: Record<string, unknown>;
            cause?: Error;
        } = {}
    ) {
        super(message, {
            recoverable: options.recoverable ?? false,
            code: options.code ?? "GPU_BUFFER_ERROR",
            context: {
                ...options.context,
                bufferId: options.bufferId,
                bufferState: options.bufferState,
                size: options.size,
                usage: options.usage,
            },
            cause: options.cause,
        });
        this.name = "GPUBufferError";
        this.bufferId = options.bufferId;
        this.bufferState = options.bufferState;
        this.size = options.size;
        this.usage = options.usage;
    }
}

/**
 * Error thrown when buffer mapping fails.
 */
export class GPUBufferMapError extends GPUBufferError {
    constructor(
        bufferId: GPUBufferID,
        mode: "READ" | "WRITE",
        context?: Record<string, unknown>
    ) {
        super(`Failed to map buffer for ${mode}`, {
            bufferId,
            code: "GPU_BUFFER_MAP_FAILED",
            recoverable: true, // Mapping failures can be retried
            context: { ...context, mode },
        });
        this.name = "GPUBufferMapError";
    }
}

/**
 * Error thrown when buffer usage is invalid for an operation.
 */
export class GPUBufferUsageError extends GPUBufferError {
    /** Required usage flags */
    public readonly requiredUsage: number;

    /** Actual usage flags */
    public readonly actualUsage: number;

    constructor(
        bufferId: GPUBufferID,
        requiredUsage: number,
        actualUsage: number,
        operation: string,
        context?: Record<string, unknown>
    ) {
        super(
            `Buffer ${bufferId} missing required usage flags for ${operation}. ` +
            `Required: ${requiredUsage}, Actual: ${actualUsage}`,
            {
                bufferId,
                usage: actualUsage,
                code: "GPU_BUFFER_INVALID_USAGE",
                recoverable: false, // Usage errors require buffer recreation
                context: { ...context, operation, requiredUsage, actualUsage },
            }
        );
        this.name = "GPUBufferUsageError";
        this.requiredUsage = requiredUsage;
        this.actualUsage = actualUsage;
    }
}

/**
 * Error thrown when buffer is in invalid state for an operation
 */
export class GPUBufferStateError extends GPUBufferError {
    /** Expected state */
    public readonly expectedState: GPUBufferState;

    /** Actual state */
    public readonly actualState: GPUBufferState;

    constructor(
        bufferId: GPUBufferID,
        operation: string,
        actualState: GPUBufferState,
        expectedState: GPUBufferState,
        context?: Record<string, unknown>
    ) {
        super(
            `Buffer ${bufferId} is in ${actualState} state but ${operation} requires ${expectedState}`,
            {
                bufferId,
                bufferState: actualState,
                code: "GPU_BUFFER_INVALID_STATE",
                recoverable: false,
                context: { ...context, operation, actualState, expectedState },
            }
        );
        this.name = "GPUBufferStateError";
        this.expectedState = expectedState;
        this.actualState = actualState;
    }
}

// ============================================================================
// Pipeline Errors
// ============================================================================

/**
 * Error related to render or compute pipeline operations.
 */
export class GPUPipelineError extends WebGPUError {
    /** ID of the pipeline that encountered the error */
    public readonly pipelineId?: GPURenderPipelineID | GPUComputePipelineID;

    /** Pipeline type */
    public readonly pipelineType?: "render" | "compute";

    /** Current pipeline state when error occurred */
    public readonly pipelineState?: GPUPipelineState;

    constructor(
        message: string,
        options: {
            pipelineId?: GPURenderPipelineID | GPUComputePipelineID;
            pipelineType?: "render" | "compute";
            pipelineState?: GPUPipelineState;
            recoverable?: boolean;
            code?: string;
            context?: Record<string, unknown>;
            cause?: Error;
        } = {}
    ) {
        super(message, {
            recoverable: options.recoverable ?? false,
            code: options.code ?? "GPU_PIPELINE_ERROR",
            context: {
                ...options.context,
                pipelineId: options.pipelineId,
                pipelineType: options.pipelineType,
                pipelineState: options.pipelineState,
            },
            cause: options.cause,
        });
        this.name = "GPUPipelineError";
        this.pipelineId = options.pipelineId;
        this.pipelineType = options.pipelineType;
        this.pipelineState = options.pipelineState;
    }
}

/**
 * Error thrown when pipeline compilation fails.
 */
export class GPUPipelineCompilationError extends GPUPipelineError {
    constructor(
        pipelineType: "render" | "compute",
        reason: string,
        context?: Record<string, unknown>
    ) {
        super(`${pipelineType} pipeline compilation failed: ${reason}`, {
            pipelineType,
            code: "GPU_PIPELINE_COMPILATION_FAILED",
            recoverable: false, // Compilation failures require code changes
            context,
        });
        this.name = "GPUPipelineCompilationError";
    }
}

// ============================================================================
// Shader Errors
// ============================================================================

/**
 * Error related to shader compilation or execution.
 */
export class GPUShaderError extends WebGPUError {
    /** Shader source code that failed */
    public readonly shaderCode?: string;

    /** Shader stage (vertex, fragment, compute) */
    public readonly shaderStage?: "vertex" | "fragment" | "compute";

    /** Line number where error occurred */
    public readonly line?: number;

    /** Column number where error occurred */
    public readonly column?: number;

    /** Compilation error messages */
    public readonly messages?: string[];

    constructor(
        message: string,
        options: {
            shaderCode?: string;
            shaderStage?: "vertex" | "fragment" | "compute";
            line?: number;
            column?: number;
            messages?: string[];
            recoverable?: boolean;
            code?: string;
            context?: Record<string, unknown>;
            cause?: Error;
        } = {}
    ) {
        super(message, {
            recoverable: options.recoverable ?? false,
            code: options.code ?? "GPU_SHADER_ERROR",
            context: {
                ...options.context,
                shaderStage: options.shaderStage,
                line: options.line,
                column: options.column,
                messages: options.messages,
            },
            cause: options.cause,
        });
        this.name = "GPUShaderError";
        this.shaderCode = options.shaderCode;
        this.shaderStage = options.shaderStage;
        this.line = options.line;
        this.column = options.column;
        this.messages = options.messages;
    }
}

/**
 * Error thrown when WGSL shader compilation fails.
 */
export class WGSLCompilationError extends GPUShaderError {
    constructor(
        shaderStage: "vertex" | "fragment" | "compute",
        messages: string[],
        shaderCode?: string,
        context?: Record<string, unknown>
    ) {
        const errorMessage = messages.length > 0
            ? `WGSL compilation failed:\n${messages.join("\n")}`
            : "WGSL compilation failed";

        super(errorMessage, {
            shaderCode,
            shaderStage,
            messages,
            code: "WGSL_COMPILATION_FAILED",
            recoverable: false, // Shader compilation failures require code fixes
            context,
        });
        this.name = "WGSLCompilationError";
    }
}

// ============================================================================
// Validation Errors
// ============================================================================

/**
 * Error thrown when WebGPU validation fails.
 * These are typically programming errors that should be fixed.
 */
export class GPUValidationError extends WebGPUError {
    /** The operation that failed validation */
    public readonly operation?: string;

    /** Validation rules that were violated */
    public readonly violations?: string[];

    constructor(
        message: string,
        options: {
            operation?: string;
            violations?: string[];
            context?: Record<string, unknown>;
            cause?: Error;
        } = {}
    ) {
        super(message, {
            recoverable: false, // Validation errors are programming errors
            code: "GPU_VALIDATION_ERROR",
            context: {
                ...options.context,
                operation: options.operation,
                violations: options.violations,
            },
            cause: options.cause,
        });
        this.name = "GPUValidationError";
        this.operation = options.operation;
        this.violations = options.violations;
    }
}

/**
 * Error thrown when texture operations fail validation.
 */
export class GPUTextureError extends WebGPUError {
    /** ID of the texture that encountered the error */
    public readonly textureId?: GPUTextureID;

    /** Texture format */
    public readonly format?: string;

    /** Texture dimensions */
    public readonly dimensions?: { width: number; height: number; depth?: number };

    constructor(
        message: string,
        options: {
            textureId?: GPUTextureID;
            format?: string;
            dimensions?: { width: number; height: number; depth?: number };
            recoverable?: boolean;
            code?: string;
            context?: Record<string, unknown>;
            cause?: Error;
        } = {}
    ) {
        super(message, {
            recoverable: options.recoverable ?? false,
            code: options.code ?? "GPU_TEXTURE_ERROR",
            context: {
                ...options.context,
                textureId: options.textureId,
                format: options.format,
                dimensions: options.dimensions,
            },
            cause: options.cause,
        });
        this.name = "GPUTextureError";
        this.textureId = options.textureId;
        this.format = options.format;
        this.dimensions = options.dimensions;
    }
}

/**
 * Error thrown when memory allocation fails.
 */
export class GPUOutOfMemoryError extends WebGPUError {
    /** Requested allocation size in bytes */
    public readonly requestedSize?: number;

    /** Available memory in bytes (if known) */
    public readonly availableMemory?: number;

    constructor(
        message: string,
        requestedSize?: number,
        availableMemory?: number,
        context?: Record<string, unknown>
    ) {
        super(message, {
            recoverable: true, // Out of memory may be recoverable by freeing resources
            code: "GPU_OUT_OF_MEMORY",
            context: {
                ...context,
                requestedSize,
                availableMemory,
            },
        });
        this.name = "GPUOutOfMemoryError";
        this.requestedSize = requestedSize;
        this.availableMemory = availableMemory;
    }
}

/**
 * Memory allocation and management errors
 */
export class GPUMemoryError extends WebGPUError {
    constructor(message: string, context?: Record<string, unknown>) {
        super(message, {
            recoverable: true,
            code: "GPU_MEMORY_ERROR",
            context,
        });
        this.name = "GPUMemoryError";
    }
}

// ============================================================================
// Command Encoder Errors
// ============================================================================

/**
 * Error related to command encoder operations.
 */
export class GPUEncoderError extends WebGPUError {
    /** ID of the encoder that encountered the error */
    public readonly encoderId?: string;

    /** Current encoder state when error occurred */
    public readonly encoderState?: string;

    constructor(
        message: string,
        options: {
            encoderId?: string;
            encoderState?: string;
            recoverable?: boolean;
            code?: string;
            context?: Record<string, unknown>;
            cause?: Error;
        } = {}
    ) {
        super(message, {
            recoverable: options.recoverable ?? false,
            code: options.code ?? "GPU_ENCODER_ERROR",
            context: {
                ...options.context,
                encoderId: options.encoderId,
                encoderState: options.encoderState,
            },
            cause: options.cause,
        });
        this.name = "GPUEncoderError";
        this.encoderId = options.encoderId;
        this.encoderState = options.encoderState;
    }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if an error is a WebGPU error.
 */
export function isWebGPUError(error: unknown): error is WebGPUError {
    return error instanceof WebGPUError;
}

/**
 * Check if an error is recoverable.
 */
export function isRecoverableError(error: unknown): boolean {
    return isWebGPUError(error) && error.recoverable;
}

/**
 * Format error for logging with full context.
 */
export function formatWebGPUError(error: WebGPUError): string {
    const parts: string[] = [
        `[${error.name}] ${error.message}`,
        `Code: ${error.code}`,
        `Recoverable: ${error.recoverable}`,
        `Timestamp: ${new Date(error.timestamp).toISOString()}`,
    ];

    if (error.context && Object.keys(error.context).length > 0) {
        parts.push(`Context: ${JSON.stringify(error.context, null, 2)}`);
    }

    if (error.stack) {
        parts.push(`Stack: ${error.stack}`);
    }

    return parts.join("\n");
}

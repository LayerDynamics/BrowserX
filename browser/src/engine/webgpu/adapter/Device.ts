/**
 * WebGPU Device Management
 *
 * Manages GPU device lifecycle with state machine, feature detection,
 * error recovery, and statistics tracking.
 */

import {
    GPUDeviceState,
    GPUVendor,
} from "../../../types/webgpu.ts";

import type {
    GPUDeviceID,
    GPUDeviceDescriptor,
    GPUDeviceStats,
    GPUDeviceFeatures,
    GPUDeviceLimits,
    Timestamp,
    Duration,
    ByteCount,
} from "../../../types/webgpu.ts";

import {
    GPUDeviceError,
    GPUDeviceInitializationError,
    GPUDeviceLostError,
    GPUValidationError,
} from "../errors.ts";

// ============================================================================
// Device Configuration
// ============================================================================

/**
 * Configuration for device creation
 */
export interface DeviceConfig {
    /** Preferred GPU adapter (high-performance or low-power) */
    powerPreference?: "low-power" | "high-performance";

    /** Required features (will fail if not available) */
    requiredFeatures?: GPUFeatureName[];

    /** Optional features (will use if available) */
    optionalFeatures?: GPUFeatureName[];

    /** Required limits (will fail if not met) */
    requiredLimits?: Record<string, number>;

    /** Enable debug validation */
    enableValidation?: boolean;

    /** Enable device lost recovery */
    enableRecovery?: boolean;

    /** Maximum recovery attempts */
    maxRecoveryAttempts?: number;

    /** Label for debugging */
    label?: string;
}

/**
 * Default device configuration
 */
const DEFAULT_CONFIG: Required<DeviceConfig> = {
    powerPreference: "high-performance",
    requiredFeatures: [],
    optionalFeatures: [],
    requiredLimits: {},
    enableValidation: true,
    enableRecovery: true,
    maxRecoveryAttempts: 3,
    label: "BrowserX WebGPU Device",
};

// ============================================================================
// Device Lost Handling
// ============================================================================

/**
 * Information about device loss event
 */
interface DeviceLostInfo {
    reason: "unknown" | "destroyed";
    message: string;
    timestamp: Timestamp;
    recoveryAttempts: number;
}

// ============================================================================
// WebGPU Device Manager
// ============================================================================

/**
 * WebGPUDevice - Manages GPU device lifecycle with state machine
 *
 * State transitions:
 * UNINITIALIZED → REQUESTING → READY → LOST → (recovery) → REQUESTING → READY
 *                             ↓
 *                         DESTROYED (terminal)
 */
export class WebGPUDevice {
    /** Unique device identifier */
    public readonly id: GPUDeviceID;

    /** Current device state */
    private state: GPUDeviceState;

    /** Configuration */
    private config: Required<DeviceConfig>;

    /** Native WebGPU adapter */
    private adapter: GPUAdapter | null = null;

    /** Native WebGPU device */
    private device: GPUDevice | null = null;

    /** Device features */
    private features: GPUDeviceFeatures | null = null;

    /** Device limits */
    private limits: GPUDeviceLimits | null = null;

    /** Device lost information */
    private lostInfo: DeviceLostInfo | null = null;

    /** Statistics */
    private stats: {
        createdAt: Timestamp;
        readyAt: Timestamp | null;
        lastLostAt: Timestamp | null;
        totalRecoveries: number;
        bufferCount: number;
        textureCount: number;
        pipelineCount: number;
        commandsSubmitted: number;
        memoryUsed: number;
        peakMemoryUsed: number;
    };

    /** Registered device lost callbacks */
    private lostCallbacks: Array<(info: DeviceLostInfo) => void> = [];

    /** Registered error callbacks */
    private errorCallbacks: Array<(error: GPUDeviceError) => void> = [];

    /** Recovery promise (for preventing concurrent recoveries) */
    private recoveryPromise: Promise<void> | null = null;

    constructor(config: DeviceConfig = {}) {
        this.id = crypto.randomUUID() as GPUDeviceID;
        this.state = GPUDeviceState.UNINITIALIZED;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.stats = {
            createdAt: Date.now(),
            readyAt: null,
            lastLostAt: null,
            totalRecoveries: 0,
            bufferCount: 0,
            textureCount: 0,
            pipelineCount: 0,
            commandsSubmitted: 0,
            memoryUsed: 0,
            peakMemoryUsed: 0,
        };
    }

    // ========================================================================
    // Initialization
    // ========================================================================

    /**
     * Initialize the GPU device
     * @throws {GPUDeviceInitializationError} If initialization fails
     */
    async initialize(): Promise<void> {
        if (this.state !== GPUDeviceState.UNINITIALIZED) {
            throw new GPUDeviceInitializationError(
                `Cannot initialize device in state ${this.state}`,
                { deviceId: this.id, deviceState: this.state }
            );
        }

        this.transitionState(GPUDeviceState.REQUESTING);

        try {
            // Check WebGPU availability
            if (!navigator.gpu) {
                throw new GPUDeviceInitializationError(
                    "WebGPU is not supported in this environment",
                    { userAgent: navigator.userAgent }
                );
            }

            // Request adapter
            this.adapter = await this.requestAdapter();
            if (!this.adapter) {
                throw new GPUDeviceInitializationError(
                    "No suitable GPU adapter found",
                    { powerPreference: this.config.powerPreference }
                );
            }

            // Request device
            this.device = await this.requestDevice(this.adapter);
            if (!this.device) {
                throw new GPUDeviceInitializationError(
                    "Failed to request GPU device",
                    { adapterId: this.adapter }
                );
            }

            // Extract features and limits
            this.extractFeatures();
            this.extractLimits();

            // Setup device lost handling
            this.setupDeviceLostHandler();

            // Setup error handling
            this.setupErrorHandler();

            // Transition to ready
            this.transitionState(GPUDeviceState.READY);
            this.stats.readyAt = Date.now();

        } catch (error) {
            this.transitionState(GPUDeviceState.UNINITIALIZED);
            if (error instanceof GPUDeviceError) {
                throw error;
            }
            throw new GPUDeviceInitializationError(
                `Device initialization failed: ${error instanceof Error ? error.message : String(error)}`,
                { originalError: error }
            );
        }
    }

    /**
     * Request GPU adapter with preferred options
     */
    private async requestAdapter(): Promise<GPUAdapter | null> {
        const options: GPURequestAdapterOptions = {
            powerPreference: this.config.powerPreference,
        };

        const adapter = await navigator.gpu.requestAdapter(options);
        return adapter;
    }

    /**
     * Request GPU device with required features and limits
     */
    private async requestDevice(adapter: GPUAdapter): Promise<GPUDevice> {
        // Determine which features to request
        const requestedFeatures: GPUFeatureName[] = [];

        // Add required features
        for (const feature of this.config.requiredFeatures) {
            if (!adapter.features.has(feature)) {
                throw new GPUDeviceInitializationError(
                    `Required feature '${feature}' is not supported by this adapter`,
                    { feature, availableFeatures: Array.from(adapter.features) }
                );
            }
            requestedFeatures.push(feature);
        }

        // Add optional features if available
        for (const feature of this.config.optionalFeatures) {
            if (adapter.features.has(feature)) {
                requestedFeatures.push(feature);
            }
        }

        // Validate required limits
        for (const [limitName, requiredValue] of Object.entries(this.config.requiredLimits)) {
            const actualValue = (adapter.limits as any)[limitName];
            if (actualValue === undefined) {
                throw new GPUDeviceInitializationError(
                    `Unknown limit '${limitName}'`,
                    { limitName }
                );
            }
            if (actualValue < requiredValue) {
                throw new GPUDeviceInitializationError(
                    `Required limit '${limitName}' (${requiredValue}) exceeds adapter limit (${actualValue})`,
                    { limitName, requiredValue, actualValue }
                );
            }
        }

        // Create device descriptor
        // Note: Using any due to Deno's incomplete WebGPU types
        const descriptor: any = {};

        // Only set requiredFeatures if there are features to request
        // Some WebGPU implementations don't accept empty arrays
        if (requestedFeatures.length > 0) {
            descriptor.requiredFeatures = requestedFeatures;
        }

        // Only set requiredLimits if there are limits to enforce
        if (Object.keys(this.config.requiredLimits).length > 0) {
            descriptor.requiredLimits = this.config.requiredLimits;
        }

        const device = await adapter.requestDevice(descriptor);
        return device;
    }

    /**
     * Extract and store device features
     */
    private extractFeatures(): void {
        if (!this.device) return;

        this.features = {
            depthClipControl: this.device.features.has("depth-clip-control"),
            depth32floatStencil8: this.device.features.has("depth32float-stencil8"),
            textureCompressionBC: this.device.features.has("texture-compression-bc"),
            textureCompressionETC2: this.device.features.has("texture-compression-etc2"),
            textureCompressionASTC: this.device.features.has("texture-compression-astc"),
            timestampQuery: this.device.features.has("timestamp-query"),
            indirectFirstInstance: this.device.features.has("indirect-first-instance"),
            shaderF16: this.device.features.has("shader-f16"),
            rg11b10ufloatRenderable: this.device.features.has("rg11b10ufloat-renderable"),
            bgra8unormStorage: this.device.features.has("bgra8unorm-storage"),
            float32Filterable: this.device.features.has("float32-filterable"),
        };
    }

    /**
     * Extract and store device limits
     */
    private extractLimits(): void {
        if (!this.device) return;

        const nativeLimits = this.device.limits;
        this.limits = {
            maxTextureDimension1D: nativeLimits.maxTextureDimension1D,
            maxTextureDimension2D: nativeLimits.maxTextureDimension2D,
            maxTextureDimension3D: nativeLimits.maxTextureDimension3D,
            maxTextureArrayLayers: nativeLimits.maxTextureArrayLayers,
            maxBindGroups: nativeLimits.maxBindGroups,
            maxBindingsPerBindGroup: nativeLimits.maxBindingsPerBindGroup || 0,
            maxDynamicUniformBuffersPerPipelineLayout: nativeLimits.maxDynamicUniformBuffersPerPipelineLayout || 0,
            maxDynamicStorageBuffersPerPipelineLayout: nativeLimits.maxDynamicStorageBuffersPerPipelineLayout || 0,
            maxSampledTexturesPerShaderStage: nativeLimits.maxSampledTexturesPerShaderStage || 0,
            maxSamplersPerShaderStage: nativeLimits.maxSamplersPerShaderStage || 0,
            maxStorageBuffersPerShaderStage: nativeLimits.maxStorageBuffersPerShaderStage || 0,
            maxStorageTexturesPerShaderStage: nativeLimits.maxStorageTexturesPerShaderStage || 0,
            maxUniformBuffersPerShaderStage: nativeLimits.maxUniformBuffersPerShaderStage || 0,
            maxUniformBufferBindingSize: nativeLimits.maxUniformBufferBindingSize,
            maxStorageBufferBindingSize: nativeLimits.maxStorageBufferBindingSize,
            maxBufferSize: nativeLimits.maxBufferSize,
            maxVertexBuffers: nativeLimits.maxVertexBuffers || 0,
            maxVertexAttributes: nativeLimits.maxVertexAttributes || 0,
            maxVertexBufferArrayStride: nativeLimits.maxVertexBufferArrayStride || 0,
            maxComputeWorkgroupStorageSize: nativeLimits.maxComputeWorkgroupStorageSize || 0,
            maxComputeInvocationsPerWorkgroup: nativeLimits.maxComputeInvocationsPerWorkgroup,
            maxComputeWorkgroupSizeX: nativeLimits.maxComputeWorkgroupSizeX,
            maxComputeWorkgroupSizeY: nativeLimits.maxComputeWorkgroupSizeY,
            maxComputeWorkgroupSizeZ: nativeLimits.maxComputeWorkgroupSizeZ,
            maxComputeWorkgroupsPerDimension: nativeLimits.maxComputeWorkgroupsPerDimension || 0,
        };
    }

    /**
     * Setup device lost event handler
     */
    private setupDeviceLostHandler(): void {
        if (!this.device) return;

        this.device.lost.then((info) => {
            const lostInfo: DeviceLostInfo = {
                reason: info.reason as "unknown" | "destroyed",
                message: info.message,
                timestamp: Date.now(),
                recoveryAttempts: this.stats.totalRecoveries,
            };

            this.lostInfo = lostInfo;
            this.stats.lastLostAt = lostInfo.timestamp;

            // Don't transition if already destroyed
            if (this.state !== GPUDeviceState.DESTROYED) {
                this.transitionState(GPUDeviceState.LOST);
            }

            // Notify callbacks
            for (const callback of this.lostCallbacks) {
                try {
                    callback(lostInfo);
                } catch (error) {
                    console.error("Error in device lost callback:", error);
                }
            }

            // Attempt recovery if enabled
            if (this.config.enableRecovery && lostInfo.reason === "unknown") {
                this.attemptRecovery();
            }
        });
    }

    /**
     * Setup error event handler
     */
    private setupErrorHandler(): void {
        if (!this.device) return;

        this.device.addEventListener("uncapturederror", (event) => {
            const gpuError = (event as GPUUncapturedErrorEvent).error;

            let error: GPUDeviceError;
            if (gpuError instanceof globalThis.GPUValidationError) {
                // Wrap validation error in device error
                error = new GPUDeviceError(
                    `GPU validation error: ${gpuError.message}`,
                    {
                        deviceId: this.id,
                        deviceState: this.state,
                        code: "GPU_VALIDATION_ERROR",
                        recoverable: false,
                    }
                );
            } else if (gpuError instanceof globalThis.GPUOutOfMemoryError) {
                error = new GPUDeviceError(
                    "GPU out of memory: " + gpuError.message,
                    {
                        deviceId: this.id,
                        deviceState: this.state,
                        code: "GPU_OUT_OF_MEMORY",
                        recoverable: true,
                    }
                );
            } else {
                error = new GPUDeviceError(
                    `Uncaptured GPU error: ${gpuError.message}`,
                    {
                        deviceId: this.id,
                        deviceState: this.state,
                    }
                );
            }

            // Notify error callbacks
            for (const callback of this.errorCallbacks) {
                try {
                    callback(error);
                } catch (err) {
                    console.error("Error in error callback:", err);
                }
            }
        });
    }

    // ========================================================================
    // Recovery
    // ========================================================================

    /**
     * Attempt to recover from device loss
     */
    private async attemptRecovery(): Promise<void> {
        // Prevent concurrent recovery attempts
        if (this.recoveryPromise) {
            return this.recoveryPromise;
        }

        this.recoveryPromise = this.performRecovery();
        try {
            await this.recoveryPromise;
        } finally {
            this.recoveryPromise = null;
        }
    }

    /**
     * Perform device recovery
     */
    private async performRecovery(): Promise<void> {
        if (this.stats.totalRecoveries >= this.config.maxRecoveryAttempts) {
            console.error(
                `Maximum recovery attempts (${this.config.maxRecoveryAttempts}) exceeded`
            );
            return;
        }

        this.stats.totalRecoveries++;

        try {
            // Clear old device references
            this.adapter = null;
            this.device = null;
            this.features = null;
            this.limits = null;

            // Transition to uninitialized
            this.transitionState(GPUDeviceState.UNINITIALIZED);

            // Re-initialize
            await this.initialize();

            console.log(`Device recovery successful (attempt ${this.stats.totalRecoveries})`);
        } catch (error) {
            console.error(`Device recovery failed:`, error);
            throw error;
        }
    }

    // ========================================================================
    // State Management
    // ========================================================================

    /**
     * Transition device state
     */
    private transitionState(newState: GPUDeviceState): void {
        const oldState = this.state;

        // Validate state transition
        if (!this.isValidTransition(oldState, newState)) {
            throw new GPUDeviceError(
                `Invalid state transition: ${oldState} → ${newState}`,
                {
                    deviceId: this.id,
                    deviceState: oldState,
                    context: { oldState, newState },
                }
            );
        }

        this.state = newState;
    }

    /**
     * Check if state transition is valid
     */
    private isValidTransition(from: GPUDeviceState, to: GPUDeviceState): boolean {
        const validTransitions: Record<GPUDeviceState, GPUDeviceState[]> = {
            [GPUDeviceState.UNINITIALIZED]: [GPUDeviceState.REQUESTING],
            [GPUDeviceState.REQUESTING]: [GPUDeviceState.READY, GPUDeviceState.UNINITIALIZED],
            [GPUDeviceState.READY]: [GPUDeviceState.LOST, GPUDeviceState.DESTROYED],
            [GPUDeviceState.LOST]: [GPUDeviceState.UNINITIALIZED, GPUDeviceState.DESTROYED],
            [GPUDeviceState.DESTROYED]: [], // Terminal state
        };

        return validTransitions[from]?.includes(to) ?? false;
    }

    /**
     * Get current device state
     */
    getState(): GPUDeviceState {
        return this.state;
    }

    /**
     * Check if device is ready
     */
    isReady(): boolean {
        return this.state === GPUDeviceState.READY;
    }

    /**
     * Check if device is lost
     */
    isLost(): boolean {
        return this.state === GPUDeviceState.LOST;
    }

    // ========================================================================
    // Device Access
    // ========================================================================

    /**
     * Get native GPU device
     * @throws {GPUDeviceError} If device is not ready
     */
    getDevice(): GPUDevice {
        if (!this.device || this.state !== GPUDeviceState.READY) {
            throw new GPUDeviceError(
                `Cannot access device in state ${this.state}`,
                {
                    deviceId: this.id,
                    deviceState: this.state,
                }
            );
        }
        return this.device;
    }

    /**
     * Get native GPU adapter
     */
    getAdapter(): GPUAdapter | null {
        return this.adapter;
    }

    /**
     * Get device queue
     */
    getQueue(): GPUQueue {
        return this.getDevice().queue;
    }

    // ========================================================================
    // Features and Limits
    // ========================================================================

    /**
     * Get device features
     */
    getFeatures(): GPUDeviceFeatures {
        if (!this.features) {
            throw new GPUDeviceError(
                "Features not available - device not initialized",
                { deviceId: this.id, deviceState: this.state }
            );
        }
        return { ...this.features };
    }

    /**
     * Get device limits
     */
    getLimits(): GPUDeviceLimits {
        if (!this.limits) {
            throw new GPUDeviceError(
                "Limits not available - device not initialized",
                { deviceId: this.id, deviceState: this.state }
            );
        }
        return { ...this.limits };
    }

    /**
     * Check if feature is supported
     */
    hasFeature(feature: keyof GPUDeviceFeatures): boolean {
        return this.features?.[feature] ?? false;
    }

    // ========================================================================
    // Hardware Detection
    // ========================================================================

    /**
     * Detect GPU vendor from adapter info
     */
    detectVendor(): GPUVendor {
        if (!this.adapter) return GPUVendor.UNKNOWN;

        // Try to get adapter info (may require feature flag)
        const info = (this.adapter as any).info;
        if (!info) return GPUVendor.UNKNOWN;

        const vendor = info.vendor?.toLowerCase() || "";
        const description = info.description?.toLowerCase() || "";

        if (vendor.includes("nvidia") || description.includes("nvidia")) {
            return GPUVendor.NVIDIA;
        }
        if (vendor.includes("amd") || description.includes("amd") || description.includes("radeon")) {
            return GPUVendor.AMD;
        }
        if (vendor.includes("intel") || description.includes("intel")) {
            return GPUVendor.INTEL;
        }
        if (vendor.includes("apple") || description.includes("apple") || description.includes("m1") || description.includes("m2")) {
            return GPUVendor.APPLE;
        }
        if (vendor.includes("qualcomm") || description.includes("qualcomm") || description.includes("adreno")) {
            return GPUVendor.QUALCOMM;
        }
        if (vendor.includes("arm") || description.includes("mali")) {
            return GPUVendor.ARM;
        }

        return GPUVendor.UNKNOWN;
    }

    // ========================================================================
    // Statistics
    // ========================================================================

    /**
     * Get device statistics
     */
    getStats(): GPUDeviceStats {
        const uptime = this.stats.readyAt ? Date.now() - this.stats.readyAt : 0;

        return {
            uptime: uptime as Duration,
            bufferStats: {
                totalAllocated: this.stats.bufferCount,
                totalDeallocated: 0, // Would be tracked separately
                currentInUse: this.stats.bufferCount,
                totalBytes: this.stats.memoryUsed as ByteCount,
                peakBytes: this.stats.peakMemoryUsed as ByteCount,
                mapOperations: 0,
                unmapOperations: 0,
                writeOperations: 0,
                readOperations: 0,
            },
            pipelineStats: {
                renderPipelinesCreated: this.stats.pipelineCount,
                computePipelinesCreated: 0,
                renderPipelinesCached: 0,
                computePipelinesCached: 0,
                averageCompilationTime: 0 as Duration,
                totalCompilationTime: 0 as Duration,
            },
            commandStats: {
                commandBuffersCreated: this.stats.commandsSubmitted,
                commandBuffersSubmitted: this.stats.commandsSubmitted,
                renderPassesEncoded: 0,
                computePassesEncoded: 0,
                drawCalls: 0,
                dispatchCalls: 0,
                totalGPUTime: undefined,
            },
            memoryUsage: this.stats.memoryUsed as ByteCount,
            peakMemoryUsage: this.stats.peakMemoryUsed as ByteCount,
        };
    }

    /**
     * Track buffer creation
     */
    trackBufferCreated(size: number): void {
        this.stats.bufferCount++;
        this.stats.memoryUsed += size;
        this.stats.peakMemoryUsed = Math.max(this.stats.peakMemoryUsed, this.stats.memoryUsed);
    }

    /**
     * Track buffer destruction
     */
    trackBufferDestroyed(size: number): void {
        this.stats.bufferCount--;
        this.stats.memoryUsed -= size;
    }

    /**
     * Track pipeline creation
     */
    trackPipelineCreated(): void {
        this.stats.pipelineCount++;
    }

    /**
     * Track command submission
     */
    trackCommandSubmitted(): void {
        this.stats.commandsSubmitted++;
    }

    // ========================================================================
    // Event Listeners
    // ========================================================================

    /**
     * Register device lost callback
     */
    onDeviceLost(callback: (info: DeviceLostInfo) => void): void {
        this.lostCallbacks.push(callback);
    }

    /**
     * Register error callback
     */
    onError(callback: (error: GPUDeviceError) => void): void {
        this.errorCallbacks.push(callback);
    }

    // ========================================================================
    // Cleanup
    // ========================================================================

    /**
     * Destroy the device and release resources
     */
    destroy(): void {
        if (this.state === GPUDeviceState.DESTROYED) {
            return;
        }

        if (this.device) {
            this.device.destroy();
        }

        this.adapter = null;
        this.device = null;
        this.features = null;
        this.limits = null;
        this.lostCallbacks = [];
        this.errorCallbacks = [];

        this.transitionState(GPUDeviceState.DESTROYED);
    }
}

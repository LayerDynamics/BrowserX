/**
 * WebGPU Driver Abstraction
 *
 * High-level driver interface providing device management, error recovery,
 * and automatic device restoration on loss.
 */

import { WebGPUDevice, type DeviceConfig } from "../adapter/Device.ts";
import {
    GPUDeviceState,
    GPUVendor,
} from "../../../types/webgpu.ts";
import type {
    GPUDeviceID,
    GPUDeviceStats,
    GPUDeviceFeatures,
    GPUDeviceLimits,
    Timestamp,
} from "../../../types/webgpu.ts";
import {
    GPUDeviceError,
    GPUDeviceLostError,
    isRecoverableError,
} from "../errors.ts";

// ============================================================================
// Driver Configuration
// ============================================================================

/**
 * Configuration for WebGPU driver
 */
export interface DriverConfig extends DeviceConfig {
    /** Enable automatic device recovery on loss */
    autoRecover?: boolean;

    /** Maximum number of automatic recovery attempts */
    maxAutoRecoveryAttempts?: number;

    /** Delay between recovery attempts (ms) */
    recoveryDelayMs?: number;

    /** Enable performance monitoring */
    enablePerformanceMonitoring?: boolean;

    /** Enable detailed error logging */
    enableErrorLogging?: boolean;
}

/**
 * Default driver configuration
 */
const DEFAULT_DRIVER_CONFIG: Required<DriverConfig> = {
    powerPreference: "high-performance",
    requiredFeatures: [],
    optionalFeatures: [],
    requiredLimits: {},
    enableValidation: true,
    enableRecovery: true,
    maxRecoveryAttempts: 3,
    label: "BrowserX WebGPU Driver",
    autoRecover: true,
    maxAutoRecoveryAttempts: 5,
    recoveryDelayMs: 1000,
    enablePerformanceMonitoring: true,
    enableErrorLogging: true,
};

// ============================================================================
// Driver State
// ============================================================================

/**
 * Driver operational state
 */
export enum DriverState {
    UNINITIALIZED = "UNINITIALIZED",
    INITIALIZING = "INITIALIZING",
    READY = "READY",
    RECOVERING = "RECOVERING",
    FAILED = "FAILED",
    DESTROYED = "DESTROYED",
}

/**
 * Recovery attempt information
 */
interface RecoveryAttempt {
    timestamp: Timestamp;
    attemptNumber: number;
    reason: string;
    success: boolean;
    error?: Error;
}

// ============================================================================
// WebGPU Driver
// ============================================================================

/**
 * WebGPUDriver - High-level driver abstraction
 *
 * Provides:
 * - Automatic device initialization
 * - Error recovery with exponential backoff
 * - Device lost handling with automatic recovery
 * - Performance monitoring
 * - Error logging and diagnostics
 */
export class WebGPUDriver {
    /** Driver configuration */
    private config: Required<DriverConfig>;

    /** Current driver state */
    private state: DriverState;

    /** Underlying GPU device */
    private device: WebGPUDevice | null = null;

    /** Recovery attempt history */
    private recoveryHistory: RecoveryAttempt[] = [];

    /** Total recovery attempts */
    private totalRecoveryAttempts = 0;

    /** Registered state change callbacks */
    private stateCallbacks: Array<(state: DriverState) => void> = [];

    /** Registered error callbacks */
    private errorCallbacks: Array<(error: Error) => void> = [];

    /** Registered recovery callbacks */
    private recoveryCallbacks: Array<(attempt: RecoveryAttempt) => void> = [];

    /** Performance metrics */
    private performanceMetrics: {
        initializationTime: number;
        lastRecoveryTime: number;
        totalUptime: number;
        deviceLostCount: number;
        successfulRecoveries: number;
        failedRecoveries: number;
    };

    /** Initialization timestamp */
    private initTimestamp: Timestamp | null = null;

    /** Recovery in progress flag */
    private isRecovering = false;

    /** Recovery timeout handle */
    private recoveryTimeout: number | null = null;

    constructor(config: DriverConfig = {}) {
        this.config = { ...DEFAULT_DRIVER_CONFIG, ...config };
        this.state = DriverState.UNINITIALIZED;
        this.performanceMetrics = {
            initializationTime: 0,
            lastRecoveryTime: 0,
            totalUptime: 0,
            deviceLostCount: 0,
            successfulRecoveries: 0,
            failedRecoveries: 0,
        };
    }

    // ========================================================================
    // Initialization
    // ========================================================================

    /**
     * Initialize the driver and underlying device
     */
    async initialize(): Promise<void> {
        if (this.state !== DriverState.UNINITIALIZED) {
            throw new Error(`Cannot initialize driver in state ${this.state}`);
        }

        this.transitionState(DriverState.INITIALIZING);
        const startTime = Date.now();
        this.initTimestamp = startTime;

        try {
            // Create device with configuration
            this.device = new WebGPUDevice({
                powerPreference: this.config.powerPreference,
                requiredFeatures: this.config.requiredFeatures,
                optionalFeatures: this.config.optionalFeatures,
                requiredLimits: this.config.requiredLimits,
                enableValidation: this.config.enableValidation,
                enableRecovery: false, // Driver handles recovery
                label: this.config.label,
            });

            // Setup device event listeners
            this.setupDeviceListeners();

            // Initialize device
            await this.device.initialize();

            // Record initialization time
            this.performanceMetrics.initializationTime = Date.now() - startTime;

            // Transition to ready
            this.transitionState(DriverState.READY);

            this.log(`Driver initialized successfully in ${this.performanceMetrics.initializationTime}ms`);
        } catch (error) {
            this.transitionState(DriverState.FAILED);
            this.handleError(error as Error);
            throw error;
        }
    }

    /**
     * Setup device event listeners
     */
    private setupDeviceListeners(): void {
        if (!this.device) return;

        // Listen for device lost events
        this.device.onDeviceLost((info) => {
            this.performanceMetrics.deviceLostCount++;
            this.log(`Device lost: ${info.reason} - ${info.message}`);

            // Attempt automatic recovery if enabled
            if (this.config.autoRecover && info.reason === "unknown") {
                this.scheduleRecovery(info.reason);
            } else {
                this.transitionState(DriverState.FAILED);
            }
        });

        // Listen for device errors
        this.device.onError((error) => {
            this.handleError(error);

            // Attempt recovery for recoverable errors
            if (isRecoverableError(error) && this.config.autoRecover) {
                this.scheduleRecovery(error.message);
            }
        });
    }

    // ========================================================================
    // Recovery
    // ========================================================================

    /**
     * Schedule automatic recovery attempt
     */
    private scheduleRecovery(reason: string): void {
        if (this.isRecovering) {
            return; // Recovery already in progress
        }

        if (this.totalRecoveryAttempts >= this.config.maxAutoRecoveryAttempts) {
            this.log(`Maximum recovery attempts (${this.config.maxAutoRecoveryAttempts}) exceeded`);
            this.transitionState(DriverState.FAILED);
            return;
        }

        // Calculate exponential backoff delay
        const baseDelay = this.config.recoveryDelayMs;
        const exponentialDelay = baseDelay * Math.pow(2, this.totalRecoveryAttempts);
        const maxDelay = 30000; // Max 30 seconds
        const delay = Math.min(exponentialDelay, maxDelay);

        this.log(`Scheduling recovery attempt ${this.totalRecoveryAttempts + 1} in ${delay}ms`);

        this.recoveryTimeout = setTimeout(() => {
            this.attemptRecovery(reason);
        }, delay) as unknown as number;
    }

    /**
     * Attempt device recovery
     */
    private async attemptRecovery(reason: string): Promise<void> {
        if (this.isRecovering) {
            return;
        }

        this.isRecovering = true;
        this.totalRecoveryAttempts++;
        this.transitionState(DriverState.RECOVERING);

        const startTime = Date.now();
        const attempt: RecoveryAttempt = {
            timestamp: startTime,
            attemptNumber: this.totalRecoveryAttempts,
            reason,
            success: false,
        };

        try {
            this.log(`Recovery attempt ${attempt.attemptNumber} started`);

            // Destroy old device
            if (this.device) {
                this.device.destroy();
                this.device = null;
            }

            // Create new device
            this.device = new WebGPUDevice({
                powerPreference: this.config.powerPreference,
                requiredFeatures: this.config.requiredFeatures,
                optionalFeatures: this.config.optionalFeatures,
                requiredLimits: this.config.requiredLimits,
                enableValidation: this.config.enableValidation,
                enableRecovery: false,
                label: this.config.label,
            });

            // Setup listeners
            this.setupDeviceListeners();

            // Initialize device
            await this.device.initialize();

            // Recovery successful
            attempt.success = true;
            this.performanceMetrics.successfulRecoveries++;
            this.performanceMetrics.lastRecoveryTime = Date.now() - startTime;

            this.log(`Recovery successful in ${this.performanceMetrics.lastRecoveryTime}ms`);

            // Transition back to ready
            this.transitionState(DriverState.READY);

        } catch (error) {
            attempt.success = false;
            attempt.error = error as Error;
            this.performanceMetrics.failedRecoveries++;

            this.log(`Recovery attempt ${attempt.attemptNumber} failed: ${(error as Error).message}`);

            // Schedule next attempt or fail
            if (this.totalRecoveryAttempts < this.config.maxAutoRecoveryAttempts) {
                this.scheduleRecovery(reason);
            } else {
                this.transitionState(DriverState.FAILED);
            }
        } finally {
            this.isRecovering = false;
            this.recoveryHistory.push(attempt);

            // Notify recovery callbacks
            for (const callback of this.recoveryCallbacks) {
                try {
                    callback(attempt);
                } catch (err) {
                    console.error("Error in recovery callback:", err);
                }
            }
        }
    }

    /**
     * Manually trigger device recovery
     */
    async recover(): Promise<void> {
        if (this.isRecovering) {
            throw new Error("Recovery already in progress");
        }

        // Cancel any scheduled recovery
        if (this.recoveryTimeout !== null) {
            clearTimeout(this.recoveryTimeout);
            this.recoveryTimeout = null;
        }

        await this.attemptRecovery("manual recovery");
    }

    // ========================================================================
    // State Management
    // ========================================================================

    /**
     * Transition driver state
     */
    private transitionState(newState: DriverState): void {
        const oldState = this.state;
        this.state = newState;

        this.log(`State transition: ${oldState} → ${newState}`);

        // Notify state callbacks
        for (const callback of this.stateCallbacks) {
            try {
                callback(newState);
            } catch (error) {
                console.error("Error in state callback:", error);
            }
        }
    }

    /**
     * Get current driver state
     */
    getState(): DriverState {
        return this.state;
    }

    /**
     * Check if driver is ready
     */
    isReady(): boolean {
        return this.state === DriverState.READY;
    }

    /**
     * Check if driver is failed
     */
    isFailed(): boolean {
        return this.state === DriverState.FAILED;
    }

    // ========================================================================
    // Device Access
    // ========================================================================

    /**
     * Get underlying GPU device
     * @throws {Error} If driver is not ready
     */
    getDevice(): WebGPUDevice {
        if (!this.device || !this.isReady()) {
            throw new Error(`Cannot access device - driver is in state ${this.state}`);
        }
        return this.device;
    }

    /**
     * Get native WebGPU device
     */
    getNativeDevice(): GPUDevice {
        return this.getDevice().getDevice();
    }

    /**
     * Get device queue
     */
    getQueue(): GPUQueue {
        return this.getDevice().getQueue();
    }

    /**
     * Get device features
     */
    getFeatures(): GPUDeviceFeatures {
        return this.getDevice().getFeatures();
    }

    /**
     * Get device limits
     */
    getLimits(): GPUDeviceLimits {
        return this.getDevice().getLimits();
    }

    /**
     * Get device statistics
     */
    getDeviceStats(): GPUDeviceStats {
        return this.getDevice().getStats();
    }

    /**
     * Detect GPU vendor
     */
    detectVendor(): GPUVendor {
        if (!this.device) return GPUVendor.UNKNOWN;
        return this.device.detectVendor();
    }

    // ========================================================================
    // Performance Monitoring
    // ========================================================================

    /**
     * Get driver performance metrics
     */
    getPerformanceMetrics() {
        const uptime = this.initTimestamp ? Date.now() - this.initTimestamp : 0;

        return {
            ...this.performanceMetrics,
            totalUptime: uptime,
            recoverySuccessRate: this.totalRecoveryAttempts > 0
                ? (this.performanceMetrics.successfulRecoveries / this.totalRecoveryAttempts) * 100
                : 0,
        };
    }

    /**
     * Get recovery history
     */
    getRecoveryHistory(): readonly RecoveryAttempt[] {
        return [...this.recoveryHistory];
    }

    // ========================================================================
    // Event Listeners
    // ========================================================================

    /**
     * Register state change callback
     */
    onStateChange(callback: (state: DriverState) => void): void {
        this.stateCallbacks.push(callback);
    }

    /**
     * Register error callback
     */
    onError(callback: (error: Error) => void): void {
        this.errorCallbacks.push(callback);
    }

    /**
     * Register recovery callback
     */
    onRecovery(callback: (attempt: RecoveryAttempt) => void): void {
        this.recoveryCallbacks.push(callback);
    }

    // ========================================================================
    // Error Handling
    // ========================================================================

    /**
     * Handle error
     */
    private handleError(error: Error): void {
        if (this.config.enableErrorLogging) {
            console.error("[WebGPUDriver] Error:", error);
        }

        // Notify error callbacks
        for (const callback of this.errorCallbacks) {
            try {
                callback(error);
            } catch (err) {
                console.error("Error in error callback:", err);
            }
        }
    }

    /**
     * Log message
     */
    private log(message: string): void {
        if (this.config.enableErrorLogging) {
            console.log(`[WebGPUDriver] ${message}`);
        }
    }

    // ========================================================================
    // Cleanup
    // ========================================================================

    /**
     * Destroy the driver and release resources
     */
    destroy(): void {
        if (this.state === DriverState.DESTROYED) {
            return;
        }

        // Cancel any pending recovery
        if (this.recoveryTimeout !== null) {
            clearTimeout(this.recoveryTimeout);
            this.recoveryTimeout = null;
        }

        // Destroy device
        if (this.device) {
            this.device.destroy();
            this.device = null;
        }

        // Clear callbacks
        this.stateCallbacks = [];
        this.errorCallbacks = [];
        this.recoveryCallbacks = [];

        this.transitionState(DriverState.DESTROYED);
    }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if WebGPU is supported in the current environment
 */
export function isWebGPUSupported(): boolean {
    return typeof navigator !== "undefined" && "gpu" in navigator;
}

/**
 * Get WebGPU availability information
 */
export async function getWebGPUAvailability(): Promise<{
    supported: boolean;
    adapterAvailable: boolean;
    error?: string;
}> {
    if (!isWebGPUSupported()) {
        return {
            supported: false,
            adapterAvailable: false,
            error: "WebGPU API not available",
        };
    }

    try {
        const adapter = await navigator.gpu.requestAdapter();
        return {
            supported: true,
            adapterAvailable: adapter !== null,
            error: adapter === null ? "No suitable GPU adapter found" : undefined,
        };
    } catch (error) {
        return {
            supported: true,
            adapterAvailable: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

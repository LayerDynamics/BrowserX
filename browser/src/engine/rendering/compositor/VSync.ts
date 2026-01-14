/**
 * VSync - 60fps frame synchronization
 *
 * Coordinates rendering with the display's refresh rate to ensure smooth
 * animation and prevent tearing. Uses requestAnimationFrame for vsync and
 * provides frame timing information.
 */

import { cancelAnimationFrame, requestAnimationFrame } from "../../../types/dom.ts";

/**
 * Frame timing information
 */
export interface FrameTiming {
    timestamp: number;
    delta: number;
    fps: number;
    frameNumber: number;
}

/**
 * VSync callback
 */
export type VSyncCallback = (timing: FrameTiming) => void;

/**
 * VSync statistics
 */
export interface VSyncStats {
    averageFPS: number;
    minFPS: number;
    maxFPS: number;
    frameCount: number;
    droppedFrames: number;
    totalTime: number;
}

/**
 * VSync
 * Manages frame synchronization with display refresh
 */
export class VSync {
    private isRunning: boolean = false;
    private animationFrameId: number | null = null;
    private lastTimestamp: number = 0;
    private frameNumber: number = 0;
    private callbacks: Set<VSyncCallback> = new Set();
    private targetFPS: number = 60;
    private frameHistory: number[] = [];
    private historySize: number = 60; // Track last 60 frames
    private droppedFrames: number = 0;
    private startTime: number = 0;

    constructor(targetFPS: number = 60) {
        this.targetFPS = targetFPS;
    }

    /**
     * Start VSync loop
     */
    start(): void {
        if (this.isRunning) {
            return;
        }

        this.isRunning = true;
        this.startTime = performance.now();
        this.lastTimestamp = this.startTime;
        this.frameNumber = 0;
        this.droppedFrames = 0;
        this.frameHistory = [];

        this.scheduleFrame();
    }

    /**
     * Stop VSync loop
     */
    stop(): void {
        if (!this.isRunning) {
            return;
        }

        this.isRunning = false;

        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    /**
     * Schedule next frame
     */
    private scheduleFrame(): void {
        if (!this.isRunning) {
            return;
        }

        this.animationFrameId = requestAnimationFrame((timestamp: number) => {
            this.handleFrame(timestamp);
        });
    }

    /**
     * Handle frame callback
     */
    private handleFrame(timestamp: number): void {
        const delta = timestamp - this.lastTimestamp;
        const fps = delta > 0 ? 1000 / delta : 0;

        // Detect dropped frames
        const targetFrameTime = 1000 / this.targetFPS;
        const expectedFrames = Math.round(delta / targetFrameTime);
        if (expectedFrames > 1) {
            this.droppedFrames += expectedFrames - 1;
        }

        // Update frame history
        this.frameHistory.push(delta);
        if (this.frameHistory.length > this.historySize) {
            this.frameHistory.shift();
        }

        // Create timing info
        const timing: FrameTiming = {
            timestamp,
            delta,
            fps,
            frameNumber: this.frameNumber,
        };

        // Call all registered callbacks
        for (const callback of this.callbacks) {
            try {
                callback(timing);
            } catch (error) {
                console.error("VSync callback error:", error);
            }
        }

        this.lastTimestamp = timestamp;
        this.frameNumber++;

        // Schedule next frame
        this.scheduleFrame();
    }

    /**
     * Wait for next vsync
     * Returns a promise that resolves on the next frame
     */
    async wait(): Promise<FrameTiming> {
        return new Promise((resolve) => {
            const callback = (timing: FrameTiming) => {
                this.removeCallback(callback);
                resolve(timing);
            };

            this.addCallback(callback);

            // Start VSync if not running
            if (!this.isRunning) {
                this.start();
            }
        });
    }

    /**
     * Wait for specific number of frames
     */
    async waitFrames(count: number): Promise<FrameTiming> {
        let remaining = count;

        return new Promise((resolve) => {
            const callback = (timing: FrameTiming) => {
                remaining--;

                if (remaining <= 0) {
                    this.removeCallback(callback);
                    resolve(timing);
                }
            };

            this.addCallback(callback);

            if (!this.isRunning) {
                this.start();
            }
        });
    }

    /**
     * Add frame callback
     */
    addCallback(callback: VSyncCallback): void {
        this.callbacks.add(callback);
    }

    /**
     * Remove frame callback
     */
    removeCallback(callback: VSyncCallback): void {
        this.callbacks.delete(callback);
    }

    /**
     * Get current FPS
     */
    getCurrentFPS(): number {
        if (this.frameHistory.length === 0) {
            return 0;
        }

        const recentDelta = this.frameHistory[this.frameHistory.length - 1];
        return recentDelta > 0 ? 1000 / recentDelta : 0;
    }

    /**
     * Get average FPS
     */
    getAverageFPS(): number {
        if (this.frameHistory.length === 0) {
            return 0;
        }

        const avgDelta = this.frameHistory.reduce((a, b) => a + b, 0) / this.frameHistory.length;
        return avgDelta > 0 ? 1000 / avgDelta : 0;
    }

    /**
     * Get statistics
     */
    getStats(): VSyncStats {
        if (this.frameHistory.length === 0) {
            return {
                averageFPS: 0,
                minFPS: 0,
                maxFPS: 0,
                frameCount: this.frameNumber,
                droppedFrames: this.droppedFrames,
                totalTime: 0,
            };
        }

        const minDelta = Math.min(...this.frameHistory);
        const maxDelta = Math.max(...this.frameHistory);
        const avgDelta = this.frameHistory.reduce((a, b) => a + b, 0) / this.frameHistory.length;

        return {
            averageFPS: avgDelta > 0 ? 1000 / avgDelta : 0,
            minFPS: maxDelta > 0 ? 1000 / maxDelta : 0,
            maxFPS: minDelta > 0 ? 1000 / minDelta : 0,
            frameCount: this.frameNumber,
            droppedFrames: this.droppedFrames,
            totalTime: performance.now() - this.startTime,
        };
    }

    /**
     * Reset statistics
     */
    resetStats(): void {
        this.frameNumber = 0;
        this.droppedFrames = 0;
        this.frameHistory = [];
        this.startTime = performance.now();
    }

    /**
     * Check if VSync is running
     */
    isActive(): boolean {
        return this.isRunning;
    }

    /**
     * Get target FPS
     */
    getTargetFPS(): number {
        return this.targetFPS;
    }

    /**
     * Set target FPS
     */
    setTargetFPS(fps: number): void {
        this.targetFPS = fps;
    }

    /**
     * Get current frame number
     */
    getFrameNumber(): number {
        return this.frameNumber;
    }
}

/**
 * Frame rate limiter
 * Limits frame rate to a specific target (useful for testing or power saving)
 */
export class FrameRateLimiter {
    private targetFPS: number;
    private lastFrameTime: number = 0;

    constructor(targetFPS: number) {
        this.targetFPS = targetFPS;
    }

    /**
     * Wait until next frame should be rendered
     */
    async wait(): Promise<void> {
        const now = performance.now();
        const targetFrameTime = 1000 / this.targetFPS;
        const elapsed = now - this.lastFrameTime;

        if (elapsed < targetFrameTime) {
            const delay = targetFrameTime - elapsed;
            await this.sleep(delay);
        }

        this.lastFrameTime = performance.now();
    }

    /**
     * Sleep for specified milliseconds
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Get target FPS
     */
    getTargetFPS(): number {
        return this.targetFPS;
    }

    /**
     * Set target FPS
     */
    setTargetFPS(fps: number): void {
        this.targetFPS = fps;
    }
}

/**
 * Adaptive VSync
 * Dynamically adjusts rendering based on performance
 */
export class AdaptiveVSync extends VSync {
    private performanceMode: "high-quality" | "balanced" | "power-save" = "balanced";
    private adaptiveTargetFPS: number;

    constructor() {
        super(60);
        this.adaptiveTargetFPS = 60;
    }

    /**
     * Update adaptive settings based on performance
     */
    updateAdaptiveSettings(): void {
        const stats = this.getStats();

        switch (this.performanceMode) {
            case "high-quality":
                // Always aim for 60fps
                this.adaptiveTargetFPS = 60;
                break;

            case "balanced":
                // Reduce target if dropping frames
                if (stats.averageFPS < 55 && stats.droppedFrames > 5) {
                    this.adaptiveTargetFPS = 30;
                } else if (stats.averageFPS >= 58) {
                    this.adaptiveTargetFPS = 60;
                }
                break;

            case "power-save":
                // Use 30fps to save power
                this.adaptiveTargetFPS = 30;
                break;
        }

        this.setTargetFPS(this.adaptiveTargetFPS);
    }

    /**
     * Set performance mode
     */
    setPerformanceMode(mode: "high-quality" | "balanced" | "power-save"): void {
        this.performanceMode = mode;
        this.updateAdaptiveSettings();
    }

    /**
     * Get performance mode
     */
    getPerformanceMode(): "high-quality" | "balanced" | "power-save" {
        return this.performanceMode;
    }

    /**
     * Get adaptive target FPS
     */
    getAdaptiveTargetFPS(): number {
        return this.adaptiveTargetFPS;
    }
}

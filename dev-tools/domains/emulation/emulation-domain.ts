/**
 * Emulation Domain Agent
 *
 * Provides device and environment emulation capabilities.
 * Allows overriding viewport dimensions, user agent, geolocation,
 * timezone, locale, network conditions, CPU throttling, and more.
 *
 * Emulation is purely command-driven (no protocol events).
 * Changes are broadcast on the EventBus so other domains can react.
 */

import type { DomainName } from "../../protocol/types.ts";
import { BaseDomain } from "../base-domain.ts";
import type {
    NetworkConditions,
    DeviceMetricsParams,
    SetUserAgentOverrideParams,
    SetEmulatedMediaParams,
    SetGeolocationOverrideParams,
    SetTimezoneOverrideParams,
    SetLocaleOverrideParams,
    SetTouchEmulationEnabledParams,
    SetNetworkConditionsParams,
    SetCPUThrottlingRateParams,
    SetScriptExecutionDisabledParams,
    ScreenOrientation,
    DisplayFeature,
    MediaFeature,
    UserAgentMetadata,
} from "./emulation-types.ts";

/**
 * Emulation Domain - device and environment emulation
 */
export class EmulationDomain extends BaseDomain {
    readonly name: DomainName = "Emulation";

    /** Current device metrics override */
    private deviceMetrics: {
        width: number;
        height: number;
        deviceScaleFactor: number;
        mobile: boolean;
        screenOrientation?: ScreenOrientation;
        screenWidth?: number;
        screenHeight?: number;
        displayFeature?: DisplayFeature;
    } = {
        width: 0,
        height: 0,
        deviceScaleFactor: 0,
        mobile: false,
    };

    /** User agent override */
    private userAgent: string = "";

    /** Accept-Language override */
    private acceptLanguage: string = "";

    /** Navigator.platform override */
    private platform: string = "";

    /** User agent metadata for Client Hints */
    private userAgentMetadata: UserAgentMetadata | null = null;

    /** Emulated media type (e.g. "print", "screen") */
    private emulatedMedia: string | null = null;

    /** Emulated media features */
    private emulatedMediaFeatures: MediaFeature[] = [];

    /** Geolocation override */
    private geolocation: { latitude: number; longitude: number; accuracy: number } | null = null;

    /** Timezone override */
    private timezoneId: string | null = null;

    /** Locale override */
    private locale: string | null = null;

    /** Whether touch emulation is active */
    private touchEmulation: boolean = false;

    /** Maximum touch points for touch emulation */
    private maxTouchPoints: number = 1;

    /** Network condition overrides */
    private networkConditions: NetworkConditions | null = null;

    /** CPU throttling rate (1 = no throttle) */
    private cpuThrottlingRate: number = 1;

    /** Whether script execution is disabled */
    private scriptExecutionDisabled: boolean = false;

    protected setup(): void {
        // Register methods
        this.registerMethod("setDeviceMetricsOverride", "Override device metrics (viewport, scale, mobile)", async (params) => {
            return this.setDeviceMetricsOverride(params as unknown as DeviceMetricsParams);
        });

        this.registerMethod("clearDeviceMetricsOverride", "Clear device metrics override", async () => {
            return this.clearDeviceMetricsOverride();
        });

        this.registerMethod("setUserAgentOverride", "Override the user agent string", async (params) => {
            return this.setUserAgentOverride(params as unknown as SetUserAgentOverrideParams);
        });

        this.registerMethod("setEmulatedMedia", "Override CSS media type and features", async (params) => {
            return this.setEmulatedMedia(params as unknown as SetEmulatedMediaParams);
        });

        this.registerMethod("setGeolocationOverride", "Override geolocation position", async (params) => {
            return this.setGeolocationOverride(params as unknown as SetGeolocationOverrideParams);
        });

        this.registerMethod("clearGeolocationOverride", "Clear geolocation override", async () => {
            return this.clearGeolocationOverride();
        });

        this.registerMethod("setTimezoneOverride", "Override timezone", async (params) => {
            return this.setTimezoneOverride(params as unknown as SetTimezoneOverrideParams);
        });

        this.registerMethod("setLocaleOverride", "Override locale", async (params) => {
            return this.setLocaleOverride(params as unknown as SetLocaleOverrideParams);
        });

        this.registerMethod("setTouchEmulationEnabled", "Enable or disable touch emulation", async (params) => {
            return this.setTouchEmulationEnabled(params as unknown as SetTouchEmulationEnabledParams);
        });

        this.registerMethod("setNetworkConditions", "Set network throttling conditions", async (params) => {
            return this.setNetworkConditions(params as unknown as SetNetworkConditionsParams);
        });

        this.registerMethod("setCPUThrottlingRate", "Set CPU throttling rate", async (params) => {
            return this.setCPUThrottlingRate(params as unknown as SetCPUThrottlingRateParams);
        });

        this.registerMethod("setScriptExecutionDisabled", "Disable or enable script execution", async (params) => {
            return this.setScriptExecutionDisabled(params as unknown as SetScriptExecutionDisabledParams);
        });

        this.registerMethod("canEmulate", "Check if emulation is supported", async () => {
            return this.canEmulate();
        });
    }

    override async disable(): Promise<Record<string, unknown>> {
        // Reset all emulation state when domain is disabled
        this.resetAllEmulationState();
        await super.disable();
        return {};
    }

    // ---- Method implementations ----

    /**
     * Override device metrics (viewport, scale factor, mobile flag)
     */
    private setDeviceMetricsOverride(params: DeviceMetricsParams): Record<string, unknown> {
        this.deviceMetrics = {
            width: params.width,
            height: params.height,
            deviceScaleFactor: params.deviceScaleFactor,
            mobile: params.mobile,
            screenOrientation: params.screenOrientation,
            screenWidth: params.screenWidth,
            screenHeight: params.screenHeight,
            displayFeature: params.displayFeature,
        };

        // Apply viewport size to the browser if dimensions are non-zero
        if (params.width > 0 && params.height > 0) {
            try {
                this.context.browser.setViewportSize(params.width, params.height);
            } catch (_error) {
                // setViewportSize may not be available in all contexts
                console.warn("Emulation: Could not set viewport size on browser instance");
            }
        }

        this.eventBus.emit("Emulation.deviceMetricsChanged", {
            width: params.width,
            height: params.height,
            deviceScaleFactor: params.deviceScaleFactor,
            mobile: params.mobile,
            screenOrientation: params.screenOrientation,
            screenWidth: params.screenWidth,
            screenHeight: params.screenHeight,
            displayFeature: params.displayFeature,
        });

        return {};
    }

    /**
     * Clear device metrics override, restoring original values
     */
    private clearDeviceMetricsOverride(): Record<string, unknown> {
        this.deviceMetrics = {
            width: 0,
            height: 0,
            deviceScaleFactor: 0,
            mobile: false,
        };

        // Restore the browser's original viewport from config
        try {
            const config = this.context.browser.getConfig();
            this.context.browser.setViewportSize(config.width, config.height);
        } catch (_error) {
            console.warn("Emulation: Could not restore original viewport size");
        }

        this.eventBus.emit("Emulation.deviceMetricsCleared", {});

        return {};
    }

    /**
     * Override the user agent string
     */
    private setUserAgentOverride(params: SetUserAgentOverrideParams): Record<string, unknown> {
        this.userAgent = params.userAgent;
        this.acceptLanguage = params.acceptLanguage ?? "";
        this.platform = params.platform ?? "";
        this.userAgentMetadata = params.userAgentMetadata ?? null;

        this.eventBus.emit("Emulation.userAgentChanged", {
            userAgent: params.userAgent,
            acceptLanguage: params.acceptLanguage,
            platform: params.platform,
            userAgentMetadata: params.userAgentMetadata,
        });

        return {};
    }

    /**
     * Override CSS media type and/or media features
     */
    private setEmulatedMedia(params: SetEmulatedMediaParams): Record<string, unknown> {
        this.emulatedMedia = params.media ?? null;
        this.emulatedMediaFeatures = params.features ?? [];

        this.eventBus.emit("Emulation.emulatedMediaChanged", {
            media: this.emulatedMedia,
            features: this.emulatedMediaFeatures,
        });

        return {};
    }

    /**
     * Override the geolocation position
     */
    private setGeolocationOverride(params: SetGeolocationOverrideParams): Record<string, unknown> {
        if (params.latitude !== undefined && params.longitude !== undefined) {
            this.geolocation = {
                latitude: params.latitude,
                longitude: params.longitude,
                accuracy: params.accuracy ?? 1,
            };
        } else {
            // If no coordinates are provided, clear the override
            this.geolocation = null;
        }

        this.eventBus.emit("Emulation.geolocationChanged", {
            geolocation: this.geolocation,
        });

        return {};
    }

    /**
     * Clear the geolocation override
     */
    private clearGeolocationOverride(): Record<string, unknown> {
        this.geolocation = null;

        this.eventBus.emit("Emulation.geolocationChanged", {
            geolocation: null,
        });

        return {};
    }

    /**
     * Override the timezone
     */
    private setTimezoneOverride(params: SetTimezoneOverrideParams): Record<string, unknown> {
        if (params.timezoneId === "") {
            this.timezoneId = null;
        } else {
            this.timezoneId = params.timezoneId;
        }

        this.eventBus.emit("Emulation.timezoneChanged", {
            timezoneId: this.timezoneId,
        });

        return {};
    }

    /**
     * Override the locale
     */
    private setLocaleOverride(params: SetLocaleOverrideParams): Record<string, unknown> {
        if (!params.locale || params.locale === "") {
            this.locale = null;
        } else {
            this.locale = params.locale;
        }

        this.eventBus.emit("Emulation.localeChanged", {
            locale: this.locale,
        });

        return {};
    }

    /**
     * Enable or disable touch emulation
     */
    private setTouchEmulationEnabled(params: SetTouchEmulationEnabledParams): Record<string, unknown> {
        this.touchEmulation = params.enabled;
        this.maxTouchPoints = params.maxTouchPoints ?? (params.enabled ? 1 : 0);

        this.eventBus.emit("Emulation.touchEmulationChanged", {
            enabled: this.touchEmulation,
            maxTouchPoints: this.maxTouchPoints,
        });

        return {};
    }

    /**
     * Set network throttling conditions
     */
    private setNetworkConditions(params: SetNetworkConditionsParams): Record<string, unknown> {
        this.networkConditions = {
            offline: params.offline,
            latency: params.latency,
            downloadThroughput: params.downloadThroughput,
            uploadThroughput: params.uploadThroughput,
        };

        this.eventBus.emit("Emulation.networkConditionsChanged", {
            networkConditions: this.networkConditions,
        });

        return {};
    }

    /**
     * Set CPU throttling rate
     */
    private setCPUThrottlingRate(params: SetCPUThrottlingRateParams): Record<string, unknown> {
        if (params.rate < 1) {
            throw new Error("CPU throttling rate must be >= 1");
        }

        this.cpuThrottlingRate = params.rate;

        this.eventBus.emit("Emulation.cpuThrottlingChanged", {
            rate: this.cpuThrottlingRate,
        });

        return {};
    }

    /**
     * Enable or disable script execution
     */
    private setScriptExecutionDisabled(params: SetScriptExecutionDisabledParams): Record<string, unknown> {
        this.scriptExecutionDisabled = params.value;

        this.eventBus.emit("Emulation.scriptExecutionChanged", {
            disabled: this.scriptExecutionDisabled,
        });

        return {};
    }

    /**
     * Check if the browser supports emulation
     */
    private canEmulate(): Record<string, unknown> {
        return { result: true };
    }

    // ---- Private helpers ----

    /**
     * Reset all emulation state to defaults
     */
    private resetAllEmulationState(): void {
        this.deviceMetrics = {
            width: 0,
            height: 0,
            deviceScaleFactor: 0,
            mobile: false,
        };
        this.userAgent = "";
        this.acceptLanguage = "";
        this.platform = "";
        this.userAgentMetadata = null;
        this.emulatedMedia = null;
        this.emulatedMediaFeatures = [];
        this.geolocation = null;
        this.timezoneId = null;
        this.locale = null;
        this.touchEmulation = false;
        this.maxTouchPoints = 1;
        this.networkConditions = null;
        this.cpuThrottlingRate = 1;
        this.scriptExecutionDisabled = false;

        // Restore original viewport
        try {
            const config = this.context.browser.getConfig();
            this.context.browser.setViewportSize(config.width, config.height);
        } catch (_error) {
            // Browser may not be available during disposal
        }
    }

    /**
     * Get the current emulation state for debugging and inspection
     */
    getEmulationState(): Record<string, unknown> {
        return {
            deviceMetrics: this.deviceMetrics,
            userAgent: this.userAgent,
            acceptLanguage: this.acceptLanguage,
            platform: this.platform,
            userAgentMetadata: this.userAgentMetadata,
            emulatedMedia: this.emulatedMedia,
            emulatedMediaFeatures: this.emulatedMediaFeatures,
            geolocation: this.geolocation,
            timezoneId: this.timezoneId,
            locale: this.locale,
            touchEmulation: this.touchEmulation,
            maxTouchPoints: this.maxTouchPoints,
            networkConditions: this.networkConditions,
            cpuThrottlingRate: this.cpuThrottlingRate,
            scriptExecutionDisabled: this.scriptExecutionDisabled,
        };
    }

    override dispose(): void {
        this.resetAllEmulationState();
        super.dispose();
    }
}

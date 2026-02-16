/**
 * Emulation Domain Types
 *
 * Types for device and environment emulation in the DevTools.
 * Supports viewport emulation, user agent overrides, geolocation,
 * network conditioning, CPU throttling, and media emulation.
 */

/**
 * Screen orientation descriptor
 */
export interface ScreenOrientation {
    type: "portraitPrimary" | "portraitSecondary" | "landscapePrimary" | "landscapeSecondary";
    angle: number;
}

/**
 * Display feature for foldable/dual-screen devices
 */
export interface DisplayFeature {
    /** Whether the fold runs vertically or horizontally */
    orientation: "vertical" | "horizontal";
    /** Offset of the display feature in CSS pixels */
    offset: number;
    /** Length of the mask segment in CSS pixels */
    maskLength: number;
}

/**
 * CSS media feature override
 */
export interface MediaFeature {
    name: string;
    value: string;
}

/**
 * User agent metadata for Client Hints
 */
export interface UserAgentMetadata {
    /** Brand/version pairs for the Sec-CH-UA header */
    brands?: Array<{ brand: string; version: string }>;
    /** Full browser version string */
    fullVersion?: string;
    /** Platform name (e.g. "Windows", "macOS", "Android") */
    platform?: string;
    /** Platform version */
    platformVersion?: string;
    /** CPU architecture (e.g. "x86", "arm") */
    architecture?: string;
    /** Device model (e.g. "Pixel 5") */
    model?: string;
    /** Whether the device is mobile */
    mobile?: boolean;
}

/**
 * Parameters for setting device metrics override
 */
export interface DeviceMetricsParams {
    /** Viewport width in CSS pixels (0 disables override) */
    width: number;
    /** Viewport height in CSS pixels (0 disables override) */
    height: number;
    /** Device scale factor (0 disables override) */
    deviceScaleFactor: number;
    /** Whether to emulate a mobile device */
    mobile: boolean;
    /** Screen orientation override */
    screenOrientation?: ScreenOrientation;
    /** Physical screen width */
    screenWidth?: number;
    /** Physical screen height */
    screenHeight?: number;
    /** Display feature for foldable devices */
    displayFeature?: DisplayFeature;
}

/**
 * Parameters for setting user agent override
 */
export interface SetUserAgentOverrideParams {
    /** User agent string to use */
    userAgent: string;
    /** Accept-Language header value */
    acceptLanguage?: string;
    /** Navigator.platform value */
    platform?: string;
    /** User agent metadata for Client Hints */
    userAgentMetadata?: UserAgentMetadata;
}

/**
 * Parameters for setting emulated media
 */
export interface SetEmulatedMediaParams {
    /** Media type to emulate (e.g. "print", "screen", empty to reset) */
    media?: string;
    /** CSS media feature overrides */
    features?: MediaFeature[];
}

/**
 * Parameters for setting geolocation override
 */
export interface SetGeolocationOverrideParams {
    /** Latitude (omit all three to clear) */
    latitude?: number;
    /** Longitude */
    longitude?: number;
    /** Accuracy in meters */
    accuracy?: number;
}

/**
 * Parameters for setting timezone override
 */
export interface SetTimezoneOverrideParams {
    /** IANA timezone identifier (e.g. "America/New_York", empty to clear) */
    timezoneId: string;
}

/**
 * Parameters for setting locale override
 */
export interface SetLocaleOverrideParams {
    /** BCP 47 locale string (e.g. "en-US", empty to clear) */
    locale?: string;
}

/**
 * Parameters for toggling touch emulation
 */
export interface SetTouchEmulationEnabledParams {
    /** Whether to enable touch emulation */
    enabled: boolean;
    /** Maximum number of touch points (default: 1) */
    maxTouchPoints?: number;
}

/**
 * Network condition parameters for throttling
 */
export interface NetworkConditions {
    /** Whether to simulate offline mode */
    offline: boolean;
    /** Minimum latency in milliseconds */
    latency: number;
    /** Download throughput in bytes per second (-1 disables throttling) */
    downloadThroughput: number;
    /** Upload throughput in bytes per second (-1 disables throttling) */
    uploadThroughput: number;
}

/**
 * Parameters for setting network conditions
 */
export type SetNetworkConditionsParams = NetworkConditions;

/**
 * Parameters for setting CPU throttling rate
 */
export interface SetCPUThrottlingRateParams {
    /** Throttling rate (1 is no throttle, 2 is 2x slowdown, etc.) */
    rate: number;
}

/**
 * Parameters for disabling script execution
 */
export interface SetScriptExecutionDisabledParams {
    /** Whether to disable script execution */
    value: boolean;
}

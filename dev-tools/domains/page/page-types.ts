/**
 * Page Domain Types
 *
 * Types for page navigation, lifecycle events, and screenshots.
 */

/**
 * Frame information
 */
export interface FrameInfo {
    id: string;
    url: string;
    securityOrigin: string;
    mimeType: string;
}

/**
 * Frame tree
 */
export interface FrameTree {
    frame: FrameInfo;
    childFrames?: FrameTree[];
}

/**
 * Screenshot parameters
 */
export interface ScreenshotParams {
    format?: "jpeg" | "png" | "webp";
    quality?: number;
    clip?: {
        x: number;
        y: number;
        width: number;
        height: number;
        scale: number;
    };
    fromSurface?: boolean;
}

/**
 * Screenshot result
 */
export interface ScreenshotResult {
    data: string;
}

export interface NavigateParams {
    url: string;
    referrer?: string;
    transitionType?: string;
}

export interface NavigateResult {
    frameId: string;
    loaderId?: string;
    errorText?: string;
}

export interface ReloadParams {
    ignoreCache?: boolean;
    scriptToEvaluateOnLoad?: string;
}

export interface GetNavigationHistoryResult {
    currentIndex: number;
    entries: Array<{
        id: number;
        url: string;
        title: string;
        transitionType: string;
    }>;
}

export interface GetFrameTreeResult {
    frameTree: FrameTree;
}

export interface LifecycleEventParams {
    frameId: string;
    loaderId: string;
    name: string;
    timestamp: number;
}

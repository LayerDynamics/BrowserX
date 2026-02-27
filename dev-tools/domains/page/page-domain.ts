/**
 * Page Domain Agent
 *
 * Provides page navigation, lifecycle events, and screenshots.
 * Hooks directly into the Browser class for navigation and history.
 */

import type { DomainName } from "../../protocol/types.ts";
import { BaseDomain } from "../base-domain.ts";
import type {
    NavigateParams,
    NavigateResult,
    ReloadParams,
    GetNavigationHistoryResult,
    GetFrameTreeResult,
    ScreenshotParams,
    ScreenshotResult,
} from "./page-types.ts";
import { validateParams } from "../../protocol/validate-params.ts";
import { validateNavigateParams, validateReloadParams, validateScreenshotParams } from "./page-validators.ts";

/**
 * Page Domain - navigation, lifecycle, screenshots
 */
export class PageDomain extends BaseDomain {
    readonly name: DomainName = "Page";

    private frameId: string = "main-frame";
    private loaderId: string = "loader-0";
    private loaderCounter: number = 0;

    protected setup(): void {
        this.registerMethod("navigate", "Navigate to URL", async (params) => {
            return await this.navigate(validateParams(params, validateNavigateParams) as NavigateParams);
        });

        this.registerMethod("reload", "Reload current page", async (params) => {
            return await this.reload(validateParams(params, validateReloadParams) as ReloadParams);
        });

        this.registerMethod("goBack", "Navigate back in history", async () => {
            return await this.goBack();
        });

        this.registerMethod("goForward", "Navigate forward in history", async () => {
            return await this.goForward();
        });

        this.registerMethod("getNavigationHistory", "Get navigation history", async () => {
            return await this.getNavigationHistory();
        });

        this.registerMethod("getFrameTree", "Get frame tree", async () => {
            return await this.getFrameTree();
        });

        this.registerMethod("captureScreenshot", "Capture page screenshot", async (params) => {
            return await this.captureScreenshot(validateParams(params, validateScreenshotParams) as ScreenshotParams);
        });

        this.registerMethod("getResourceTree", "Get resource tree", async () => {
            return await this.getResourceTree();
        });

        // Register events
        this.registerEvent("lifecycleEvent", "Page lifecycle event");
        this.registerEvent("frameNavigated", "Frame navigated to new URL");
        this.registerEvent("loadEventFired", "Load event fired");
        this.registerEvent("domContentEventFired", "DOMContentLoaded event fired");
        this.registerEvent("frameStartedLoading", "Frame started loading");
        this.registerEvent("frameStoppedLoading", "Frame stopped loading");
    }

    override async enable(): Promise<Record<string, unknown>> {
        await super.enable();
        this.emitEvent("lifecycleEvent", {
            frameId: this.frameId,
            loaderId: this.loaderId,
            name: "init",
            timestamp: Date.now() / 1000,
        });
        return {};
    }

    private async navigate(params: NavigateParams): Promise<NavigateResult> {
        this.loaderCounter++;
        this.loaderId = `loader-${this.loaderCounter}`;

        if (this.enabled) {
            this.emitEvent("frameStartedLoading", { frameId: this.frameId });
        }

        const startTime = Date.now();
        try {
            await this.context.browser.navigate(params.url);

            const navigationDuration = Date.now() - startTime;

            if (this.enabled) {
                this.emitEvent("domContentEventFired", {
                    timestamp: Date.now() / 1000,
                });

                this.emitEvent("lifecycleEvent", {
                    frameId: this.frameId,
                    loaderId: this.loaderId,
                    name: "DOMContentLoaded",
                    timestamp: Date.now() / 1000,
                });

                this.emitEvent("frameNavigated", {
                    frame: {
                        id: this.frameId,
                        url: params.url,
                        securityOrigin: new URL(params.url).origin,
                        mimeType: "text/html",
                        navigationDuration,
                    },
                });

                this.emitEvent("loadEventFired", {
                    timestamp: Date.now() / 1000,
                });

                this.emitEvent("lifecycleEvent", {
                    frameId: this.frameId,
                    loaderId: this.loaderId,
                    name: "load",
                    timestamp: Date.now() / 1000,
                });

                this.emitEvent("frameStoppedLoading", { frameId: this.frameId });
            }

            return { frameId: this.frameId, loaderId: this.loaderId };
        } catch (error) {
            if (this.enabled) {
                this.emitEvent("frameStoppedLoading", { frameId: this.frameId });
            }
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                frameId: this.frameId,
                loaderId: this.loaderId,
                errorText: errorMessage,
            };
        }
    }

    private async reload(_params: ReloadParams): Promise<Record<string, unknown>> {
        await this.context.browser.reload();
        return {};
    }

    private async goBack(): Promise<Record<string, unknown>> {
        const success = await this.context.browser.back();
        return { success };
    }

    private async goForward(): Promise<Record<string, unknown>> {
        const success = await this.context.browser.forward();
        return { success };
    }

    private async getNavigationHistory(): Promise<GetNavigationHistoryResult> {
        const state = this.context.browser.getHistoryState();
        return {
            currentIndex: state.index,
            entries: state.entries.map((url, i) => ({
                id: i,
                url,
                title: url,
                transitionType: "typed",
            })),
        };
    }

    private async getFrameTree(): Promise<GetFrameTreeResult> {
        const url = this.context.browser.getCurrentURL() || "about:blank";
        return {
            frameTree: {
                frame: {
                    id: this.frameId,
                    url,
                    securityOrigin: url.startsWith("http") ? new URL(url).origin : "",
                    mimeType: "text/html",
                },
            },
        };
    }

    private async captureScreenshot(params: ScreenshotParams): Promise<ScreenshotResult> {
        // Log requested format/quality/clip for future codec support
        const _format = params.format ?? "png";
        const _quality = params.quality ?? (_format === "jpeg" ? 80 : 100);
        const _clip = params.clip;

        const pixels = await this.context.browser.screenshot();

        // Encode pixel data as base64
        // Note: format/quality/clip params are acknowledged but output is currently
        // always raw RGBA pixels. Full PNG/JPEG/WebP encoding requires image codecs.
        const bytes = new Uint8Array(pixels.buffer);
        const binary = Array.from(bytes).map((b) => String.fromCharCode(b)).join("");
        const data = btoa(binary);
        return { data };
    }

    private async getResourceTree(): Promise<Record<string, unknown>> {
        const url = this.context.browser.getCurrentURL() || "about:blank";
        return {
            frameTree: {
                frame: {
                    id: this.frameId,
                    url,
                    securityOrigin: url.startsWith("http") ? new URL(url).origin : "",
                    mimeType: "text/html",
                },
                resources: [],
            },
        };
    }
}

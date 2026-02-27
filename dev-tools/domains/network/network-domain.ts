/**
 * Network Domain Agent
 *
 * Monitors HTTP requests and responses with timing data.
 * Hooks into RequestPipeline for network activity tracking.
 */

import type { DomainName } from "../../protocol/types.ts";
import { BaseDomain } from "../base-domain.ts";
import type { RequestID } from "../../../browser/src/types/identifiers.ts";
import type {
    TrackedRequest,
    GetResponseBodyParams,
    GetResponseBodyResult,
    GetCookiesParams,
    SetCookieParams,
    SetCookieResult,
    GetRequestStatsResult,
    NetworkRequestDescription,
    NetworkResponseDescription,
    ResourceType,
} from "./network-types.ts";
import { validateParams } from "../../protocol/validate-params.ts";
import { validateGetResponseBodyParams, validateGetCookiesParams, validateSetCookieParams } from "./network-validators.ts";

/**
 * Network Domain - HTTP request/response monitoring
 */
export class NetworkDomain extends BaseDomain {
    readonly name: DomainName = "Network";

    /** Maximum number of tracked requests before eviction */
    private static readonly MAX_TRACKED_REQUESTS = 1000;

    /** Tracked requests by ID */
    private trackedRequests: Map<RequestID, TrackedRequest> = new Map();
    private requestCounter: number = 0;
    private cacheDisabled: boolean = false;

    protected setup(): void {
        this.registerMethod("getResponseBody", "Get response body for a request", async (params) => {
            return await this.getResponseBody(validateParams(params, validateGetResponseBodyParams) as GetResponseBodyParams);
        });

        this.registerMethod("getCookies", "Get cookies for URLs", async (params) => {
            return await this.getCookies(validateParams(params, validateGetCookiesParams) as GetCookiesParams);
        });

        this.registerMethod("setCookie", "Set a cookie", async (params) => {
            return await this.setCookie(validateParams(params, validateSetCookieParams) as SetCookieParams);
        });

        this.registerMethod("clearBrowserCache", "Clear browser cache", async () => {
            return await this.clearBrowserCache();
        });

        this.registerMethod("clearBrowserCookies", "Clear browser cookies", async () => {
            return await this.clearBrowserCookies();
        });

        this.registerMethod("setCacheDisabled", "Disable/enable cache", async (params) => {
            this.cacheDisabled = params.cacheDisabled as boolean ?? false;
            return {};
        });

        this.registerMethod("getRequestStats", "Get request statistics", async () => {
            return await this.getRequestStats();
        });

        // Register events
        this.registerEvent("requestWillBeSent", "Request about to be sent");
        this.registerEvent("responseReceived", "Response headers received");
        this.registerEvent("loadingFinished", "Request completed");
        this.registerEvent("loadingFailed", "Request failed");
        this.registerEvent("dataReceived", "Data chunk received");
        this.registerEvent("requestServedFromCache", "Served from cache");
    }

    /**
     * Track a new request (called by integration layer)
     */
    trackRequest(
        url: string,
        method: string,
        headers: Record<string, string>,
        resourceType: ResourceType = "Other",
        initiatorType: "parser" | "script" | "preload" | "other" = "other",
    ): RequestID {
        const requestId = `req-${++this.requestCounter}`;
        const timestamp = Date.now() / 1000;

        const request: NetworkRequestDescription = {
            requestId,
            url,
            method: method as NetworkRequestDescription["method"],
            headers,
            timestamp,
            initiator: { type: initiatorType },
        };

        this.trackedRequests.set(requestId, {
            request,
            resourceType,
            startTime: Date.now(),
        });

        if (this.enabled) {
            this.emitEvent("requestWillBeSent", {
                requestId,
                request,
                timestamp,
                type: resourceType,
            });
        }

        this.evictIfNeeded();

        return requestId;
    }

    /**
     * Evict oldest completed requests when map exceeds capacity.
     * Completed requests (those with endTime set) are evicted first, oldest first.
     * If still over limit, oldest in-flight requests are evicted.
     */
    private evictIfNeeded(): void {
        if (this.trackedRequests.size <= NetworkDomain.MAX_TRACKED_REQUESTS) {
            return;
        }

        const toEvict = this.trackedRequests.size - NetworkDomain.MAX_TRACKED_REQUESTS;

        // Collect completed requests sorted by endTime (oldest first)
        const completed: RequestID[] = [];
        for (const [id, tracked] of this.trackedRequests) {
            if (tracked.endTime !== undefined) {
                completed.push(id);
            }
        }
        // Map iteration order is insertion order, so completed is already oldest-first

        let evicted = 0;
        for (const id of completed) {
            if (evicted >= toEvict) break;
            this.trackedRequests.delete(id);
            evicted++;
        }

        // If still over limit, evict oldest in-flight requests
        if (evicted < toEvict) {
            for (const id of [...this.trackedRequests.keys()]) {
                if (evicted >= toEvict) break;
                this.trackedRequests.delete(id);
                evicted++;
            }
        }
    }

    /**
     * Track a response for a request
     */
    trackResponse(
        requestId: RequestID,
        status: number,
        statusText: string,
        headers: Record<string, string>,
        body?: string,
        fromCache: boolean = false,
    ): void {
        const tracked = this.trackedRequests.get(requestId);
        if (!tracked) return;

        const now = Date.now();
        const response: NetworkResponseDescription = {
            requestId,
            url: tracked.request.url,
            status,
            statusText,
            headers,
            mimeType: headers["content-type"] || "application/octet-stream",
            connectionReused: false,
            connectionId: "0",
            encodedDataLength: body?.length ?? 0,
            fromCache,
            fromServiceWorker: false,
            timing: {
                requestTime: tracked.startTime / 1000,
                dnsStart: 0,
                dnsEnd: 0,
                connectStart: 0,
                connectEnd: 0,
                sslStart: 0,
                sslEnd: 0,
                sendStart: 0,
                sendEnd: 0,
                receiveHeadersStart: (now - tracked.startTime) / 1000,
                receiveHeadersEnd: (now - tracked.startTime) / 1000,
            },
            protocol: "1.1",
            securityState: tracked.request.url.startsWith("https") ? "secure" : "neutral",
        };

        tracked.response = response;
        tracked.body = body;
        tracked.endTime = now;

        if (this.enabled) {
            if (fromCache) {
                this.emitEvent("requestServedFromCache", { requestId });
            }
            this.emitEvent("responseReceived", {
                requestId,
                response,
                timestamp: now / 1000,
                type: tracked.resourceType,
            });
            this.emitEvent("loadingFinished", {
                requestId,
                timestamp: now / 1000,
                encodedDataLength: body?.length ?? 0,
            });
        }
    }

    /**
     * Track a failed request
     */
    trackFailure(requestId: RequestID, errorText: string): void {
        const tracked = this.trackedRequests.get(requestId);
        if (!tracked) return;

        const now = Date.now();
        tracked.endTime = now;

        if (this.enabled) {
            this.emitEvent("loadingFailed", {
                requestId,
                timestamp: now / 1000,
                type: tracked.resourceType,
                errorText,
                canceled: false,
            });
        }
    }

    private async getResponseBody(params: GetResponseBodyParams): Promise<GetResponseBodyResult> {
        const tracked = this.trackedRequests.get(params.requestId);
        if (!tracked) {
            throw new Error(`Request ${params.requestId} not found`);
        }
        return {
            body: tracked.body || "",
            base64Encoded: false,
        };
    }

    private async getCookies(params: GetCookiesParams): Promise<Record<string, unknown>> {
        const urls = params.urls || [];
        const allCookies: unknown[] = [];
        const cookieManager = this.context.cookieManager;

        if (urls.length > 0) {
            for (const url of urls) {
                const cookies = cookieManager.getCookies(url);
                allCookies.push(...cookies);
            }
        }

        return { cookies: allCookies };
    }

    private async setCookie(params: SetCookieParams): Promise<SetCookieResult> {
        try {
            this.context.cookieManager.setCookie(
                {
                    name: params.name,
                    value: params.value,
                    domain: params.domain,
                    path: params.path || "/",
                    secure: params.secure,
                    httpOnly: params.httpOnly,
                    sameSite: params.sameSite,
                },
                params.url || `https://${params.domain || "localhost"}/`,
            );
            return { success: true };
        } catch {
            return { success: false };
        }
    }

    private async clearBrowserCache(): Promise<Record<string, unknown>> {
        this.context.renderingPipeline.clearCache();
        return {};
    }

    private async clearBrowserCookies(): Promise<Record<string, unknown>> {
        this.context.cookieManager.clearAll();
        return {};
    }

    private async getRequestStats(): Promise<GetRequestStatsResult> {
        let totalBytes = 0;
        let cachedRequests = 0;

        for (const tracked of this.trackedRequests.values()) {
            if (tracked.body) {
                totalBytes += tracked.body.length;
            }
            if (tracked.response?.fromCache) {
                cachedRequests++;
            }
        }

        return {
            totalRequests: this.trackedRequests.size,
            cachedRequests,
            totalBytes,
            activeConnections: 0,
        };
    }

    override dispose(): void {
        this.trackedRequests.clear();
        super.dispose();
    }
}

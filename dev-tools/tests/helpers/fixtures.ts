/**
 * Test Fixtures for BrowserX DevTools Tests
 *
 * Provides sample CDP requests, responses, events, and test data
 * for comprehensive testing of the DevTools protocol implementation.
 */

import type {
    ProtocolRequest,
    ProtocolResponse,
    ProtocolEvent,
    ProtocolError,
    DomainName,
    ProtocolMethod,
} from "../../protocol/types.ts";
import { ProtocolErrorCode } from "../../protocol/types.ts";

// ============================================================================
// CDP Request Fixtures
// ============================================================================

/**
 * Sample CDP requests for all 14 domains
 */
export const CDP_REQUESTS: Record<string, ProtocolRequest> = {
    // DOM Domain
    "DOM.getDocument": {
        id: 1,
        method: "DOM.getDocument" as ProtocolMethod,
        params: { depth: 2 },
    },
    "DOM.querySelector": {
        id: 2,
        method: "DOM.querySelector" as ProtocolMethod,
        params: { nodeId: 1, selector: "#main" },
    },
    "DOM.querySelectorAll": {
        id: 3,
        method: "DOM.querySelectorAll" as ProtocolMethod,
        params: { nodeId: 1, selector: ".item" },
    },
    "DOM.setAttributeValue": {
        id: 4,
        method: "DOM.setAttributeValue" as ProtocolMethod,
        params: { nodeId: 2, name: "class", value: "highlight" },
    },
    "DOM.removeAttribute": {
        id: 5,
        method: "DOM.removeAttribute" as ProtocolMethod,
        params: { nodeId: 2, name: "class" },
    },
    "DOM.removeNode": {
        id: 6,
        method: "DOM.removeNode" as ProtocolMethod,
        params: { nodeId: 3 },
    },
    "DOM.getOuterHTML": {
        id: 7,
        method: "DOM.getOuterHTML" as ProtocolMethod,
        params: { nodeId: 2 },
    },
    "DOM.getBoxModel": {
        id: 8,
        method: "DOM.getBoxModel" as ProtocolMethod,
        params: { nodeId: 2 },
    },
    "DOM.enable": {
        id: 9,
        method: "DOM.enable" as ProtocolMethod,
    },
    "DOM.disable": {
        id: 10,
        method: "DOM.disable" as ProtocolMethod,
    },
    "DOM.performSearch": {
        id: 11,
        method: "DOM.performSearch" as ProtocolMethod,
        params: { query: "test" },
    },
    "DOM.requestChildNodes": {
        id: 12,
        method: "DOM.requestChildNodes" as ProtocolMethod,
        params: { nodeId: 1, depth: 1 },
    },

    // Page Domain
    "Page.enable": {
        id: 20,
        method: "Page.enable" as ProtocolMethod,
    },
    "Page.disable": {
        id: 21,
        method: "Page.disable" as ProtocolMethod,
    },
    "Page.navigate": {
        id: 22,
        method: "Page.navigate" as ProtocolMethod,
        params: { url: "https://example.com" },
    },
    "Page.reload": {
        id: 23,
        method: "Page.reload" as ProtocolMethod,
        params: { ignoreCache: false },
    },
    "Page.captureScreenshot": {
        id: 24,
        method: "Page.captureScreenshot" as ProtocolMethod,
        params: { format: "png", quality: 100 },
    },
    "Page.getNavigationHistory": {
        id: 25,
        method: "Page.getNavigationHistory" as ProtocolMethod,
    },

    // Network Domain
    "Network.enable": {
        id: 30,
        method: "Network.enable" as ProtocolMethod,
    },
    "Network.disable": {
        id: 31,
        method: "Network.disable" as ProtocolMethod,
    },
    "Network.getCookies": {
        id: 32,
        method: "Network.getCookies" as ProtocolMethod,
        params: { urls: ["https://example.com"] },
    },
    "Network.setCookie": {
        id: 33,
        method: "Network.setCookie" as ProtocolMethod,
        params: {
            name: "session",
            value: "abc123",
            domain: "example.com",
            path: "/",
        },
    },
    "Network.deleteCookies": {
        id: 34,
        method: "Network.deleteCookies" as ProtocolMethod,
        params: { name: "session", domain: "example.com" },
    },
    "Network.getResponseBody": {
        id: 35,
        method: "Network.getResponseBody" as ProtocolMethod,
        params: { requestId: "req-1" },
    },
    "Network.emulateNetworkConditions": {
        id: 36,
        method: "Network.emulateNetworkConditions" as ProtocolMethod,
        params: { offline: false, latency: 100, downloadThroughput: 1000000, uploadThroughput: 500000 },
    },

    // CSS Domain
    "CSS.enable": {
        id: 40,
        method: "CSS.enable" as ProtocolMethod,
    },
    "CSS.disable": {
        id: 41,
        method: "CSS.disable" as ProtocolMethod,
    },
    "CSS.getMatchedStylesForNode": {
        id: 42,
        method: "CSS.getMatchedStylesForNode" as ProtocolMethod,
        params: { nodeId: 2 },
    },
    "CSS.getComputedStyleForNode": {
        id: 43,
        method: "CSS.getComputedStyleForNode" as ProtocolMethod,
        params: { nodeId: 2 },
    },
    "CSS.getInlineStylesForNode": {
        id: 44,
        method: "CSS.getInlineStylesForNode" as ProtocolMethod,
        params: { nodeId: 2 },
    },
    "CSS.setStyleTexts": {
        id: 45,
        method: "CSS.setStyleTexts" as ProtocolMethod,
        params: { edits: [{ styleSheetId: "ss1", range: { startLine: 1, startColumn: 0, endLine: 1, endColumn: 10 }, text: "color: red" }] },
    },

    // Runtime Domain
    "Runtime.enable": {
        id: 50,
        method: "Runtime.enable" as ProtocolMethod,
    },
    "Runtime.disable": {
        id: 51,
        method: "Runtime.disable" as ProtocolMethod,
    },
    "Runtime.evaluate": {
        id: 52,
        method: "Runtime.evaluate" as ProtocolMethod,
        params: { expression: "1 + 1", returnByValue: true },
    },
    "Runtime.callFunctionOn": {
        id: 53,
        method: "Runtime.callFunctionOn" as ProtocolMethod,
        params: {
            functionDeclaration: "function() { return this.value; }",
            objectId: "obj-1",
        },
    },
    "Runtime.getProperties": {
        id: 54,
        method: "Runtime.getProperties" as ProtocolMethod,
        params: { objectId: "obj-1", ownProperties: true },
    },

    // Console Domain
    "Console.enable": {
        id: 60,
        method: "Console.enable" as ProtocolMethod,
    },
    "Console.disable": {
        id: 61,
        method: "Console.disable" as ProtocolMethod,
    },
    "Console.clearMessages": {
        id: 62,
        method: "Console.clearMessages" as ProtocolMethod,
    },

    // Storage Domain
    "Storage.enable": {
        id: 70,
        method: "Storage.enable" as ProtocolMethod,
    },
    "Storage.disable": {
        id: 71,
        method: "Storage.disable" as ProtocolMethod,
    },
    "Storage.getCookies": {
        id: 72,
        method: "Storage.getCookies" as ProtocolMethod,
        params: { browserContextId: "ctx-1" },
    },
    "Storage.clearDataForOrigin": {
        id: 73,
        method: "Storage.clearDataForOrigin" as ProtocolMethod,
        params: { origin: "https://example.com", storageTypes: "all" },
    },
    "Storage.getUsageAndQuota": {
        id: 74,
        method: "Storage.getUsageAndQuota" as ProtocolMethod,
        params: { origin: "https://example.com" },
    },

    // Security Domain
    "Security.enable": {
        id: 80,
        method: "Security.enable" as ProtocolMethod,
    },
    "Security.disable": {
        id: 81,
        method: "Security.disable" as ProtocolMethod,
    },
    "Security.setIgnoreCertificateErrors": {
        id: 82,
        method: "Security.setIgnoreCertificateErrors" as ProtocolMethod,
        params: { ignore: true },
    },

    // Performance Domain
    "Performance.enable": {
        id: 90,
        method: "Performance.enable" as ProtocolMethod,
    },
    "Performance.disable": {
        id: 91,
        method: "Performance.disable" as ProtocolMethod,
    },
    "Performance.getMetrics": {
        id: 92,
        method: "Performance.getMetrics" as ProtocolMethod,
    },

    // Memory Domain
    "Memory.enable": {
        id: 100,
        method: "Memory.enable" as ProtocolMethod,
    },
    "Memory.disable": {
        id: 101,
        method: "Memory.disable" as ProtocolMethod,
    },
    "Memory.getDOMCounters": {
        id: 102,
        method: "Memory.getDOMCounters" as ProtocolMethod,
    },
    "Memory.forciblyPurgeJavaScriptMemory": {
        id: 103,
        method: "Memory.forciblyPurgeJavaScriptMemory" as ProtocolMethod,
    },

    // Rendering Domain
    "Rendering.enable": {
        id: 110,
        method: "Rendering.enable" as ProtocolMethod,
    },
    "Rendering.disable": {
        id: 111,
        method: "Rendering.disable" as ProtocolMethod,
    },
    "Rendering.setShowPaintRects": {
        id: 112,
        method: "Rendering.setShowPaintRects" as ProtocolMethod,
        params: { result: true },
    },
    "Rendering.setShowLayoutShiftRegions": {
        id: 113,
        method: "Rendering.setShowLayoutShiftRegions" as ProtocolMethod,
        params: { result: true },
    },

    // Debugger Domain
    "Debugger.enable": {
        id: 120,
        method: "Debugger.enable" as ProtocolMethod,
    },
    "Debugger.disable": {
        id: 121,
        method: "Debugger.disable" as ProtocolMethod,
    },
    "Debugger.setBreakpoint": {
        id: 122,
        method: "Debugger.setBreakpoint" as ProtocolMethod,
        params: { location: { scriptId: "script-1", lineNumber: 10, columnNumber: 0 } },
    },
    "Debugger.removeBreakpoint": {
        id: 123,
        method: "Debugger.removeBreakpoint" as ProtocolMethod,
        params: { breakpointId: "bp-1" },
    },
    "Debugger.pause": {
        id: 124,
        method: "Debugger.pause" as ProtocolMethod,
    },
    "Debugger.resume": {
        id: 125,
        method: "Debugger.resume" as ProtocolMethod,
    },
    "Debugger.stepOver": {
        id: 126,
        method: "Debugger.stepOver" as ProtocolMethod,
    },
    "Debugger.stepInto": {
        id: 127,
        method: "Debugger.stepInto" as ProtocolMethod,
    },
    "Debugger.stepOut": {
        id: 128,
        method: "Debugger.stepOut" as ProtocolMethod,
    },

    // Overlay Domain
    "Overlay.enable": {
        id: 130,
        method: "Overlay.enable" as ProtocolMethod,
    },
    "Overlay.disable": {
        id: 131,
        method: "Overlay.disable" as ProtocolMethod,
    },
    "Overlay.highlightNode": {
        id: 132,
        method: "Overlay.highlightNode" as ProtocolMethod,
        params: {
            nodeId: 2,
            highlightConfig: {
                showInfo: true,
                contentColor: { r: 111, g: 168, b: 220, a: 0.66 },
                paddingColor: { r: 147, g: 196, b: 125, a: 0.55 },
            },
        },
    },
    "Overlay.hideHighlight": {
        id: 133,
        method: "Overlay.hideHighlight" as ProtocolMethod,
    },
    "Overlay.setInspectMode": {
        id: 134,
        method: "Overlay.setInspectMode" as ProtocolMethod,
        params: { mode: "searchForNode", highlightConfig: { showInfo: true } },
    },

    // Emulation Domain
    "Emulation.enable": {
        id: 140,
        method: "Emulation.enable" as ProtocolMethod,
    },
    "Emulation.disable": {
        id: 141,
        method: "Emulation.disable" as ProtocolMethod,
    },
    "Emulation.setDeviceMetricsOverride": {
        id: 142,
        method: "Emulation.setDeviceMetricsOverride" as ProtocolMethod,
        params: {
            width: 375,
            height: 812,
            deviceScaleFactor: 3,
            mobile: true,
        },
    },
    "Emulation.clearDeviceMetricsOverride": {
        id: 143,
        method: "Emulation.clearDeviceMetricsOverride" as ProtocolMethod,
    },
    "Emulation.setUserAgentOverride": {
        id: 144,
        method: "Emulation.setUserAgentOverride" as ProtocolMethod,
        params: { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)" },
    },
    "Emulation.setGeolocationOverride": {
        id: 145,
        method: "Emulation.setGeolocationOverride" as ProtocolMethod,
        params: { latitude: 37.7749, longitude: -122.4194, accuracy: 100 },
    },
};

// ============================================================================
// CDP Response Fixtures
// ============================================================================

/**
 * Sample CDP success responses
 */
export const CDP_RESPONSES: Record<string, ProtocolResponse> = {
    empty: {
        id: 1,
        result: {},
    },
    "DOM.getDocument": {
        id: 1,
        result: {
            root: {
                nodeId: 1,
                backendNodeId: 1,
                nodeType: 9,
                nodeName: "#document",
                childNodeCount: 1,
                children: [
                    {
                        nodeId: 2,
                        backendNodeId: 2,
                        nodeType: 1,
                        nodeName: "HTML",
                        localName: "html",
                        childNodeCount: 2,
                    },
                ],
            },
        },
    },
    "DOM.querySelector": {
        id: 2,
        result: { nodeId: 5 },
    },
    "DOM.querySelectorAll": {
        id: 3,
        result: { nodeIds: [5, 6, 7] },
    },
    "DOM.getOuterHTML": {
        id: 7,
        result: { outerHTML: '<div id="main" class="container">Hello</div>' },
    },
    "DOM.getBoxModel": {
        id: 8,
        result: {
            model: {
                content: [10, 20, 110, 20, 110, 70, 10, 70],
                padding: [5, 15, 115, 15, 115, 75, 5, 75],
                border: [3, 13, 117, 13, 117, 77, 3, 77],
                margin: [0, 10, 120, 10, 120, 80, 0, 80],
                width: 100,
                height: 50,
            },
        },
    },
    "Page.navigate": {
        id: 22,
        result: { frameId: "frame-1", loaderId: "loader-1" },
    },
    "Page.captureScreenshot": {
        id: 24,
        result: { data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" },
    },
    "Network.getCookies": {
        id: 32,
        result: {
            cookies: [
                {
                    name: "session",
                    value: "abc123",
                    domain: "example.com",
                    path: "/",
                    expires: -1,
                    size: 16,
                    httpOnly: false,
                    secure: false,
                    session: true,
                },
            ],
        },
    },
    "Runtime.evaluate": {
        id: 52,
        result: {
            result: {
                type: "number",
                value: 2,
                description: "2",
            },
        },
    },
    "Performance.getMetrics": {
        id: 92,
        result: {
            metrics: [
                { name: "Documents", value: 1 },
                { name: "Frames", value: 1 },
                { name: "JSEventListeners", value: 10 },
                { name: "Nodes", value: 150 },
                { name: "LayoutCount", value: 5 },
            ],
        },
    },
};

/**
 * Sample CDP error responses
 */
export const CDP_ERROR_RESPONSES: Record<string, ProtocolResponse> = {
    methodNotFound: {
        id: 1,
        error: {
            code: ProtocolErrorCode.METHOD_NOT_FOUND,
            message: 'Method "Unknown.method" not found',
        },
    },
    domainNotEnabled: {
        id: 2,
        error: {
            code: ProtocolErrorCode.DOMAIN_NOT_ENABLED,
            message: 'Domain "DOM" is not enabled. Call DOM.enable first.',
        },
    },
    invalidParams: {
        id: 3,
        error: {
            code: ProtocolErrorCode.INVALID_PARAMS,
            message: "Invalid parameters: nodeId is required",
        },
    },
    nodeNotFound: {
        id: 4,
        error: {
            code: ProtocolErrorCode.NODE_NOT_FOUND,
            message: "Node with id 999 not found",
        },
    },
    parseError: {
        id: 0,
        error: {
            code: ProtocolErrorCode.PARSE_ERROR,
            message: "Failed to parse JSON message",
        },
    },
    invalidRequest: {
        id: 0,
        error: {
            code: ProtocolErrorCode.INVALID_REQUEST,
            message: 'Message must contain a numeric "id" field',
        },
    },
    internalError: {
        id: 5,
        error: {
            code: ProtocolErrorCode.INTERNAL_ERROR,
            message: "Internal server error",
        },
    },
};

// ============================================================================
// CDP Event Fixtures
// ============================================================================

/**
 * Sample CDP events for all domains
 */
export const CDP_EVENTS: Record<string, ProtocolEvent> = {
    // DOM Events
    "DOM.documentUpdated": {
        method: "DOM.documentUpdated" as ProtocolMethod,
    },
    "DOM.setChildNodes": {
        method: "DOM.setChildNodes" as ProtocolMethod,
        params: {
            parentId: 1,
            nodes: [
                { nodeId: 2, nodeType: 1, nodeName: "DIV", localName: "div" },
                { nodeId: 3, nodeType: 1, nodeName: "SPAN", localName: "span" },
            ],
        },
    },
    "DOM.attributeModified": {
        method: "DOM.attributeModified" as ProtocolMethod,
        params: { nodeId: 2, name: "class", value: "highlight" },
    },
    "DOM.attributeRemoved": {
        method: "DOM.attributeRemoved" as ProtocolMethod,
        params: { nodeId: 2, name: "class" },
    },
    "DOM.childNodeRemoved": {
        method: "DOM.childNodeRemoved" as ProtocolMethod,
        params: { parentNodeId: 1, nodeId: 3 },
    },
    "DOM.childNodeInserted": {
        method: "DOM.childNodeInserted" as ProtocolMethod,
        params: { parentNodeId: 1, previousNodeId: 2, node: { nodeId: 4, nodeType: 1, nodeName: "P" } },
    },

    // Page Events
    "Page.loadEventFired": {
        method: "Page.loadEventFired" as ProtocolMethod,
        params: { timestamp: 1234567890.123 },
    },
    "Page.domContentEventFired": {
        method: "Page.domContentEventFired" as ProtocolMethod,
        params: { timestamp: 1234567890.100 },
    },
    "Page.frameNavigated": {
        method: "Page.frameNavigated" as ProtocolMethod,
        params: {
            frame: {
                id: "frame-1",
                loaderId: "loader-1",
                url: "https://example.com",
                securityOrigin: "https://example.com",
                mimeType: "text/html",
            },
        },
    },
    "Page.frameStartedLoading": {
        method: "Page.frameStartedLoading" as ProtocolMethod,
        params: { frameId: "frame-1" },
    },
    "Page.frameStoppedLoading": {
        method: "Page.frameStoppedLoading" as ProtocolMethod,
        params: { frameId: "frame-1" },
    },

    // Network Events
    "Network.requestWillBeSent": {
        method: "Network.requestWillBeSent" as ProtocolMethod,
        params: {
            requestId: "req-1",
            loaderId: "loader-1",
            documentURL: "https://example.com",
            request: {
                url: "https://api.example.com/data",
                method: "GET",
                headers: { "User-Agent": "BrowserX" },
            },
            timestamp: 1234567890.123,
            wallTime: 1234567890123,
            initiator: { type: "script" },
            type: "XHR",
        },
    },
    "Network.responseReceived": {
        method: "Network.responseReceived" as ProtocolMethod,
        params: {
            requestId: "req-1",
            loaderId: "loader-1",
            timestamp: 1234567890.200,
            type: "XHR",
            response: {
                url: "https://api.example.com/data",
                status: 200,
                statusText: "OK",
                headers: { "Content-Type": "application/json" },
                mimeType: "application/json",
            },
        },
    },
    "Network.loadingFinished": {
        method: "Network.loadingFinished" as ProtocolMethod,
        params: {
            requestId: "req-1",
            timestamp: 1234567890.250,
            encodedDataLength: 1024,
        },
    },
    "Network.loadingFailed": {
        method: "Network.loadingFailed" as ProtocolMethod,
        params: {
            requestId: "req-2",
            timestamp: 1234567890.300,
            type: "XHR",
            errorText: "net::ERR_CONNECTION_REFUSED",
            canceled: false,
        },
    },

    // CSS Events
    "CSS.styleSheetAdded": {
        method: "CSS.styleSheetAdded" as ProtocolMethod,
        params: {
            header: {
                styleSheetId: "ss-1",
                frameId: "frame-1",
                sourceURL: "https://example.com/style.css",
                origin: "regular",
                title: "",
                disabled: false,
                isInline: false,
                startLine: 0,
                startColumn: 0,
                length: 500,
            },
        },
    },
    "CSS.styleSheetChanged": {
        method: "CSS.styleSheetChanged" as ProtocolMethod,
        params: { styleSheetId: "ss-1" },
    },
    "CSS.styleSheetRemoved": {
        method: "CSS.styleSheetRemoved" as ProtocolMethod,
        params: { styleSheetId: "ss-1" },
    },

    // Runtime Events
    "Runtime.executionContextCreated": {
        method: "Runtime.executionContextCreated" as ProtocolMethod,
        params: {
            context: {
                id: 1,
                origin: "https://example.com",
                name: "example.com",
                uniqueId: "ctx-1",
            },
        },
    },
    "Runtime.executionContextDestroyed": {
        method: "Runtime.executionContextDestroyed" as ProtocolMethod,
        params: { executionContextId: 1 },
    },
    "Runtime.consoleAPICalled": {
        method: "Runtime.consoleAPICalled" as ProtocolMethod,
        params: {
            type: "log",
            args: [{ type: "string", value: "Hello, world!" }],
            executionContextId: 1,
            timestamp: 1234567890.123,
        },
    },
    "Runtime.exceptionThrown": {
        method: "Runtime.exceptionThrown" as ProtocolMethod,
        params: {
            timestamp: 1234567890.123,
            exceptionDetails: {
                exceptionId: 1,
                text: "Uncaught TypeError",
                lineNumber: 10,
                columnNumber: 5,
                scriptId: "script-1",
            },
        },
    },

    // Console Events
    "Console.messageAdded": {
        method: "Console.messageAdded" as ProtocolMethod,
        params: {
            message: {
                source: "javascript",
                level: "log",
                text: "Hello from console",
                timestamp: 1234567890.123,
            },
        },
    },

    // Debugger Events
    "Debugger.scriptParsed": {
        method: "Debugger.scriptParsed" as ProtocolMethod,
        params: {
            scriptId: "script-1",
            url: "https://example.com/app.js",
            startLine: 0,
            startColumn: 0,
            endLine: 100,
            endColumn: 0,
            executionContextId: 1,
            hash: "abc123",
            isModule: false,
            length: 5000,
        },
    },
    "Debugger.paused": {
        method: "Debugger.paused" as ProtocolMethod,
        params: {
            callFrames: [
                {
                    callFrameId: "cf-1",
                    functionName: "onClick",
                    location: { scriptId: "script-1", lineNumber: 10, columnNumber: 5 },
                    scopeChain: [],
                    this: { type: "object", objectId: "obj-1" },
                },
            ],
            reason: "breakpoint",
            hitBreakpoints: ["bp-1"],
        },
    },
    "Debugger.resumed": {
        method: "Debugger.resumed" as ProtocolMethod,
    },
    "Debugger.breakpointResolved": {
        method: "Debugger.breakpointResolved" as ProtocolMethod,
        params: {
            breakpointId: "bp-1",
            location: { scriptId: "script-1", lineNumber: 10, columnNumber: 0 },
        },
    },

    // Security Events
    "Security.securityStateChanged": {
        method: "Security.securityStateChanged" as ProtocolMethod,
        params: {
            securityState: "secure",
            schemeIsCryptographic: true,
            explanations: [],
            summary: "This page is secure (valid HTTPS).",
        },
    },

    // Performance Events
    "Performance.metrics": {
        method: "Performance.metrics" as ProtocolMethod,
        params: {
            metrics: [
                { name: "TaskDuration", value: 0.5 },
                { name: "JSHeapUsedSize", value: 10000000 },
            ],
            title: "Performance metrics",
        },
    },

    // Overlay Events
    "Overlay.inspectNodeRequested": {
        method: "Overlay.inspectNodeRequested" as ProtocolMethod,
        params: { backendNodeId: 5 },
    },
    "Overlay.nodeHighlightRequested": {
        method: "Overlay.nodeHighlightRequested" as ProtocolMethod,
        params: { nodeId: 5 },
    },
};

// ============================================================================
// Protocol Error Constants
// ============================================================================

/**
 * Standard protocol error codes and messages
 */
export const PROTOCOL_ERRORS = {
    // Error code constants for direct comparison
    PARSE_ERROR: ProtocolErrorCode.PARSE_ERROR,
    INVALID_REQUEST: ProtocolErrorCode.INVALID_REQUEST,
    METHOD_NOT_FOUND: ProtocolErrorCode.METHOD_NOT_FOUND,
    INVALID_PARAMS: ProtocolErrorCode.INVALID_PARAMS,
    INTERNAL_ERROR: ProtocolErrorCode.INTERNAL_ERROR,
    SERVER_ERROR: ProtocolErrorCode.SERVER_ERROR,
    DOMAIN_NOT_ENABLED: ProtocolErrorCode.DOMAIN_NOT_ENABLED,
    NODE_NOT_FOUND: ProtocolErrorCode.NODE_NOT_FOUND,
    STYLESHEET_NOT_FOUND: ProtocolErrorCode.STYLESHEET_NOT_FOUND,
    BREAKPOINT_NOT_FOUND: ProtocolErrorCode.BREAKPOINT_NOT_FOUND,
    OBJECT_NOT_FOUND: ProtocolErrorCode.OBJECT_NOT_FOUND,
    SESSION_NOT_FOUND: ProtocolErrorCode.SESSION_NOT_FOUND,
    TARGET_NOT_FOUND: ProtocolErrorCode.TARGET_NOT_FOUND,

    // Full error objects for responses
    parseError: {
        code: ProtocolErrorCode.PARSE_ERROR,
        message: "Failed to parse JSON message",
    } as ProtocolError,
    invalidRequest: {
        code: ProtocolErrorCode.INVALID_REQUEST,
        message: "Invalid request",
    } as ProtocolError,
    methodNotFound: {
        code: ProtocolErrorCode.METHOD_NOT_FOUND,
        message: "Method not found",
    } as ProtocolError,
    invalidParams: {
        code: ProtocolErrorCode.INVALID_PARAMS,
        message: "Invalid params",
    } as ProtocolError,
    internalError: {
        code: ProtocolErrorCode.INTERNAL_ERROR,
        message: "Internal error",
    } as ProtocolError,
    serverError: {
        code: ProtocolErrorCode.SERVER_ERROR,
        message: "Server error",
    } as ProtocolError,
    domainNotEnabled: {
        code: ProtocolErrorCode.DOMAIN_NOT_ENABLED,
        message: "Domain not enabled",
    } as ProtocolError,
    nodeNotFound: {
        code: ProtocolErrorCode.NODE_NOT_FOUND,
        message: "Node not found",
    } as ProtocolError,
    stylesheetNotFound: {
        code: ProtocolErrorCode.STYLESHEET_NOT_FOUND,
        message: "Stylesheet not found",
    } as ProtocolError,
    breakpointNotFound: {
        code: ProtocolErrorCode.BREAKPOINT_NOT_FOUND,
        message: "Breakpoint not found",
    } as ProtocolError,
    objectNotFound: {
        code: ProtocolErrorCode.OBJECT_NOT_FOUND,
        message: "Object not found",
    } as ProtocolError,
    sessionNotFound: {
        code: ProtocolErrorCode.SESSION_NOT_FOUND,
        message: "Session not found",
    } as ProtocolError,
    targetNotFound: {
        code: ProtocolErrorCode.TARGET_NOT_FOUND,
        message: "Target not found",
    } as ProtocolError,
};

// ============================================================================
// Invalid Message Fixtures
// ============================================================================

/**
 * Malformed messages for error testing
 */
export const INVALID_MESSAGES = {
    notJson: "this is not json",
    emptyObject: "{}",
    noId: '{"method": "DOM.getDocument"}',
    noMethod: '{"id": 1}',
    stringId: '{"id": "1", "method": "DOM.getDocument"}',
    nullId: '{"id": null, "method": "DOM.getDocument"}',
    invalidMethodFormat: '{"id": 1, "method": "getDocument"}',
    methodWithoutDot: '{"id": 1, "method": "DOMgetDocument"}',
    arrayParams: '{"id": 1, "method": "DOM.getDocument", "params": []}',
    stringParams: '{"id": 1, "method": "DOM.getDocument", "params": "invalid"}',
    nullParams: '{"id": 1, "method": "DOM.getDocument", "params": null}',
    oversized: '{"id": 1, "method": "DOM.getDocument", "params": {"data": "' + "x".repeat(100000) + '"}}',
    nested: '{"id": 1, "method": "DOM.getDocument", "inner": {"id": 2}}',
    unicodeInvalid: '{"id": 1, "method": "DOM.\uD800getDocument"}',
    incompleteJson: '{"id": 1, "method": "DOM.getDocument"',
    trailingComma: '{"id": 1, "method": "DOM.getDocument",}',
    extraFields: '{"id": 1, "method": "DOM.getDocument", "extra": true, "another": 123}',
};

// ============================================================================
// Server Configuration Fixtures
// ============================================================================

/**
 * Sample server configurations
 */
export const SERVER_CONFIGS = {
    default: {
        port: 9222,
        host: "127.0.0.1",
    },
    customPort: {
        port: 9333,
        host: "127.0.0.1",
    },
    allInterfaces: {
        port: 9222,
        host: "0.0.0.0",
    },
    localhost: {
        port: 9222,
        host: "localhost",
    },
};

// ============================================================================
// Target Info Fixtures
// ============================================================================

/**
 * Sample target discovery information
 */
export const TARGET_INFO_SAMPLES = {
    page: {
        targetId: "page-1",
        type: "page" as const,
        title: "Example Page",
        url: "https://example.com",
        attached: false,
    },
    attachedPage: {
        targetId: "page-2",
        type: "page" as const,
        title: "Active Page",
        url: "https://example.com/active",
        attached: true,
    },
    browser: {
        targetId: "browser-1",
        type: "browser" as const,
        title: "BrowserX",
        url: "",
        attached: false,
    },
    serviceWorker: {
        targetId: "sw-1",
        type: "service_worker" as const,
        title: "Service Worker",
        url: "https://example.com/sw.js",
        attached: false,
    },
};

// ============================================================================
// Sample DOM Node Structures
// ============================================================================

/**
 * Sample DOM node structures for testing
 */
export const SAMPLE_DOM_NODES = {
    document: {
        nodeId: 1,
        backendNodeId: 1,
        nodeType: 9,
        nodeName: "#document",
        childNodeCount: 1,
    },
    html: {
        nodeId: 2,
        backendNodeId: 2,
        nodeType: 1,
        nodeName: "HTML",
        localName: "html",
        attributes: [],
        childNodeCount: 2,
    },
    body: {
        nodeId: 3,
        backendNodeId: 3,
        nodeType: 1,
        nodeName: "BODY",
        localName: "body",
        attributes: [],
        childNodeCount: 1,
    },
    divWithId: {
        nodeId: 4,
        backendNodeId: 4,
        nodeType: 1,
        nodeName: "DIV",
        localName: "div",
        attributes: ["id", "main", "class", "container"],
        childNodeCount: 2,
    },
    text: {
        nodeId: 5,
        backendNodeId: 5,
        nodeType: 3,
        nodeName: "#text",
        nodeValue: "Hello, World!",
    },
    comment: {
        nodeId: 6,
        backendNodeId: 6,
        nodeType: 8,
        nodeName: "#comment",
        nodeValue: "This is a comment",
    },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a CDP request with specified parameters
 */
export function createCDPRequest(
    id: number,
    method: string,
    params?: Record<string, unknown>,
    sessionId?: string,
): ProtocolRequest {
    const request: ProtocolRequest = {
        id,
        method: method as ProtocolMethod,
    };
    if (params) {
        request.params = params;
    }
    if (sessionId) {
        request.sessionId = sessionId;
    }
    return request;
}

/**
 * Create a CDP response with specified result
 */
export function createCDPResponse(
    id: number,
    result?: Record<string, unknown>,
    error?: ProtocolError,
    sessionId?: string,
): ProtocolResponse {
    const response: ProtocolResponse = { id };
    if (result) {
        response.result = result;
    }
    if (error) {
        response.error = error;
    }
    if (sessionId) {
        response.sessionId = sessionId;
    }
    return response;
}

/**
 * Create a CDP event with specified parameters
 */
export function createCDPEvent(
    method: string,
    params?: Record<string, unknown>,
    sessionId?: string,
): ProtocolEvent {
    const event: ProtocolEvent = {
        method: method as ProtocolMethod,
    };
    if (params) {
        event.params = params;
    }
    if (sessionId) {
        event.sessionId = sessionId;
    }
    return event;
}

/**
 * Create a CDP error
 */
export function createCDPError(
    code: ProtocolErrorCode,
    message: string,
    data?: unknown,
): ProtocolError {
    const error: ProtocolError = { code, message };
    if (data !== undefined) {
        error.data = data;
    }
    return error;
}

/**
 * Get all domain names
 */
export function getAllDomainNames(): DomainName[] {
    return [
        "DOM",
        "CSS",
        "Network",
        "Runtime",
        "Debugger",
        "Performance",
        "Memory",
        "Storage",
        "Security",
        "Page",
        "Rendering",
        "Console",
        "Overlay",
        "Emulation",
    ];
}

/**
 * Generate a sequence of CDP requests for testing
 */
export function generateRequestSequence(count: number, domain: DomainName = "DOM"): ProtocolRequest[] {
    return Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        method: `${domain}.enable` as ProtocolMethod,
    }));
}

/**
 * Create a mock session ID
 */
export function createSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a mock target ID
 */
export function createTargetId(): string {
    return `page-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

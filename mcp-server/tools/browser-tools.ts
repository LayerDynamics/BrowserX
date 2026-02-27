/**
 * Browser Automation Tools for MCP Server
 * Direct browser control with enhanced feedback
 *
 * Browser tools use lazy initialization - SessionManager is only
 * initialized on first browser tool call, not at server startup.
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { encodeBase64 } from "@std/encoding";
import type { MCPServerContext } from "../server/mcp-server.ts";
import {
  validateUrl,
  validateSelector,
  validateScript,
} from "../security/input-validator.ts";
import {
  withFeedback,
  withErrorHandling,
  PROGRESS_STAGES,
  WARNING_CODES,
} from "../feedback/mod.ts";
import { ToolRateLimiter } from "./ToolRateLimiter.ts";

export const evaluateRateLimiter = new ToolRateLimiter({ maxRequests: 100, windowMs: 60000 });
export const toolRateLimiter = new ToolRateLimiter({ maxRequests: 200, windowMs: 60000 });

/**
 * Register browser automation tools with the MCP server
 */
export function registerBrowserTools(
  server: McpServer,
  context: MCPServerContext,
): void {
  // Navigate to URL (LONG tier - full page load)
  server.tool(
    "browser_navigate",
    "Navigate to a URL in a browser session. Creates a new session if sessionId is not provided.",
    {
      url: z.string().url().describe("URL to navigate to. Must be a valid HTTP/HTTPS URL."),
      sessionId: z.string().optional().describe(
        "Session ID from a previous browser_navigate call. If omitted, creates a NEW session. " +
        "Pass sessionId to maintain cookies, localStorage, and navigation history across calls."
      ),
      waitUntil: z
        .enum(["load", "domcontentloaded", "networkidle"])
        .optional()
        .describe(
          "When to consider navigation complete. 'domcontentloaded' is fastest (HTML parsed). " +
          "'load' waits for all resources. 'networkidle' waits for network quiet (best for SPAs). Default: 'load'"
        ),
      timeout: z.number().optional().describe(
        "Navigation timeout in milliseconds. Default: 30000. Increase for slow-loading pages."
      ),
    },
    withFeedback(
      server,
      "browser_navigate",
      async ({ url, sessionId, waitUntil, timeout, signal }, ctx) => {
        context.permissionGuard.checkToolPermission("browser_navigate");
        toolRateLimiter.check(sessionId as string || "__anonymous__");

        // Track operation
        const opId = context.visibilityService.operationTracker.startOperation(
          "navigate",
          `Navigate to ${url as string}`,
          sessionId as string | undefined,
        );

        try {
          validateUrl(url as string);
          await ctx.progress.stage("STARTING", PROGRESS_STAGES.NAVIGATE.STARTING);

          // Get session manager (lazy init)
          const sessionManager = await context.getSessionManager();

          // Get or create session
          let session;
          let newSession = false;
          const sessionStart = Date.now();

          if (sessionId && sessionManager.hasSession(sessionId as string)) {
            session = sessionManager.getSession(sessionId as string);
          } else {
            await ctx.progress.stage("SESSION", PROGRESS_STAGES.SESSION.CREATING);
            const newSessionId = await sessionManager.createSession(
              context.permissionGuard.getGrantedPermissions(),
            );
            session = sessionManager.getSession(newSessionId);
            newSession = true;
          }
          ctx.recordTiming("session", Date.now() - sessionStart);

          // Navigate with AbortSignal for proper timeout cancellation
          // Signal comes from wrapWithTimeout
          await ctx.progress.stage("NAVIGATING", PROGRESS_STAGES.NAVIGATE.REQUESTING);
          const navStart = Date.now();
          const page = await sessionManager.getSessionPage(session.id);
          const effectiveTimeout = (timeout as number) ?? 30000;
          await page.navigate(url as string, {
            waitFor: (waitUntil as string) ?? "load",
            timeout: effectiveTimeout,
            signal: signal as AbortSignal | undefined,
          });
          ctx.recordTiming("navigation", Date.now() - navStart);

          await ctx.progress.stage("COMPLETE", PROGRESS_STAGES.NAVIGATE.COMPLETE);
          sessionManager.updateSessionUrl(session.id, url);

          // Check for redirects
          const currentUrl = page.getCurrentURL();
          if (currentUrl !== url) {
            ctx.addWarning(
              WARNING_CODES.URL_REDIRECTED,
              `Redirected from ${url} to ${currentUrl}`,
              "The final URL differs from requested due to redirects",
            );
          }

          context.visibilityService.operationTracker.completeOperation(opId);

          return {
            data: {
              sessionId: session.id,
              newSession,
              url,
              currentUrl,
            },
          };
        } catch (error) {
          context.visibilityService.operationTracker.completeOperation(opId, error as Error);
          throw error;
        }
      },
      { timeoutConfig: context.timeoutConfig },
    ),
  );

  // Click element (SHORT tier)
  server.tool(
    "browser_click",
    "Click an element in the current page.",
    {
      sessionId: z.string().describe(
        "Session ID from browser_navigate. Required - all browser operations need a session."
      ),
      selector: z.string().describe(
        "CSS selector or XPath of element to click. Use browser_query_dom first to verify " +
        "the selector exists. Examples: '#submit-btn', '.btn-primary', '//button[@type=\"submit\"]'"
      ),
      selectorType: z.enum(["css", "xpath"]).optional().describe(
        "Selector type. 'css' for CSS selectors (default), 'xpath' for XPath expressions."
      ),
      timeout: z.number().optional().describe(
        "Timeout in milliseconds waiting for element. Default: 5000."
      ),
    },
    withFeedback(
      server,
      "browser_click",
      async ({ sessionId, selector, selectorType, signal }, _ctx) => {
        context.permissionGuard.checkToolPermission("browser_click");
        toolRateLimiter.check(sessionId as string);

        const opId = context.visibilityService.operationTracker.startOperation(
          "click",
          `Click ${selector}`,
          sessionId as string,
        );

        try {
          validateSelector(selector as string);
          const sessionManager = await context.getSessionManager();
          const page = await sessionManager.getSessionPage(sessionId as string);
          await page.click(selector as string, (selectorType as "css" | "xpath") ?? "css", {
            signal: signal as AbortSignal | undefined,
          });

          context.visibilityService.operationTracker.completeOperation(opId);

          return {
            data: {
              sessionId,
              action: "click",
              selector,
            },
          };
        } catch (error) {
          context.visibilityService.operationTracker.completeOperation(opId, error as Error);
          throw error;
        }
      },
      { enableProgress: false, timeoutConfig: context.timeoutConfig },
    ),
  );

  // Type text (SHORT tier)
  server.tool(
    "browser_type",
    "Type text into an input element.",
    {
      sessionId: z.string().describe(
        "Session ID from browser_navigate. Required for all browser operations."
      ),
      selector: z.string().describe(
        "CSS selector of input element (input, textarea, or contenteditable). " +
        "Examples: '#email', 'input[name=\"username\"]', '.form-control'"
      ),
      text: z.string().describe("Text to type into the element."),
      clear: z.boolean().optional().describe(
        "Clear existing text before typing. Set to true when replacing field content " +
        "(e.g., editing a form). Default: false (appends to existing text)."
      ),
      delay: z.number().optional().describe(
        "Delay between keystrokes in milliseconds. Useful for sites that validate on each keystroke. Default: 0."
      ),
      timeout: z.number().optional().describe("Timeout in milliseconds. Default: 5000."),
    },
    withFeedback(
      server,
      "browser_type",
      async ({ sessionId, selector, text, clear, delay, signal }, _ctx) => {
        context.permissionGuard.checkToolPermission("browser_type");
        toolRateLimiter.check(sessionId as string);

        const opId = context.visibilityService.operationTracker.startOperation(
          "type",
          `Type into ${selector}`,
          sessionId as string,
        );

        try {
          validateSelector(selector as string);
          const sessionManager = await context.getSessionManager();
          const page = await sessionManager.getSessionPage(sessionId as string);
          await page.type(selector as string, text as string, {
            clear: clear as boolean | undefined,
            delay: delay as number | undefined,
            signal: signal as AbortSignal | undefined,
          });

          context.visibilityService.operationTracker.completeOperation(opId);

          return {
            data: {
              sessionId,
              action: "type",
              selector,
              textLength: (text as string).length,
            },
          };
        } catch (error) {
          context.visibilityService.operationTracker.completeOperation(opId, error as Error);
          throw error;
        }
      },
      { enableProgress: false, timeoutConfig: context.timeoutConfig },
    ),
  );

  // Take screenshot (LONG tier)
  server.tool(
    "browser_screenshot",
    "Take a screenshot of the current page or a specific element.",
    {
      sessionId: z.string().describe(
        "Session ID from browser_navigate. Required for all browser operations."
      ),
      fullPage: z.boolean().optional().describe(
        "Capture entire scrollable page, not just viewport. Set true for pages with " +
        "content below the fold. Default: false (viewport only)."
      ),
      selector: z.string().optional().describe(
        "CSS selector to screenshot a specific element instead of the page. " +
        "Useful for capturing forms, modals, or specific components."
      ),
      format: z.enum(["png", "jpeg"]).optional().describe(
        "Image format. 'png' for lossless quality (default), 'jpeg' for smaller file size."
      ),
      quality: z.number().min(0).max(100).optional().describe(
        "JPEG quality 0-100. Only applies when format is 'jpeg'. Higher = better quality, larger file."
      ),
      timeout: z.number().optional().describe("Timeout in milliseconds. Default: 30000."),
    },
    withFeedback(
      server,
      "browser_screenshot",
      async ({ sessionId, fullPage, selector, format, quality, signal }, ctx) => {
        context.permissionGuard.checkToolPermission("browser_screenshot");
        toolRateLimiter.check(sessionId as string);

        const opId = context.visibilityService.operationTracker.startOperation(
          "screenshot",
          `Screenshot ${(selector as string | undefined) ?? "page"}`,
          sessionId as string,
        );

        try {
          if (selector) validateSelector(selector as string);

          await ctx.progress.stage("PREPARING", PROGRESS_STAGES.SCREENSHOT.PREPARING);
          const sessionManager = await context.getSessionManager();
          const page = await sessionManager.getSessionPage(sessionId as string);

          await ctx.progress.stage("CAPTURING", PROGRESS_STAGES.SCREENSHOT.CAPTURING);
          const screenshot = await page.screenshot({
            fullPage: fullPage as boolean | undefined,
            selector: selector as string | undefined,
            format: ((format as string | undefined) ?? "png") as "png" | "jpeg",
            quality: quality as number | undefined,
            signal: signal as AbortSignal | undefined,
          });

          await ctx.progress.stage("ENCODING", PROGRESS_STAGES.SCREENSHOT.ENCODING);
          const base64Image = encodeBase64(screenshot);

          // Save screenshot to persistent storage
          await ctx.progress.stage("SAVING", "Saving to disk");
          const currentUrl = page.getCurrentURL() ?? "unknown";
          // Use session's default viewport from config
          const defaultViewport = context.config.sessionConfig?.defaultViewport ?? { width: 1280, height: 720 };
          const filePath = await context.activityTracker.saveScreenshot(
            sessionId as string,
            currentUrl,
            base64Image,
            defaultViewport.width,
            defaultViewport.height
          );

          context.visibilityService.operationTracker.completeOperation(opId);

          // Return image in special format
          return {
            data: {
              sessionId,
              format: format ?? "png",
              size: screenshot.length,
              filePath, // Include the saved file path
              _image: {
                data: base64Image,
                mimeType: format === "jpeg" ? "image/jpeg" : "image/png",
              },
            },
          };
        } catch (error) {
          context.visibilityService.operationTracker.completeOperation(opId, error as Error);
          throw error;
        }
      },
      { timeoutConfig: context.timeoutConfig },
    ),
  );

  // Generate PDF (LONG tier)
  server.tool(
    "browser_pdf",
    "Generate a PDF of the current page.",
    {
      sessionId: z.string().describe("Browser session ID"),
      format: z.enum(["A4", "Letter", "Legal", "A3"]).optional().describe("Page format"),
      landscape: z.boolean().optional().describe("Landscape orientation"),
      timeout: z.number().optional().describe("Timeout in milliseconds"),
    },
    withFeedback(
      server,
      "browser_pdf",
      async ({ sessionId, format, landscape, signal }, ctx) => {
        context.permissionGuard.checkToolPermission("browser_pdf");
        toolRateLimiter.check(sessionId as string);

        const opId = context.visibilityService.operationTracker.startOperation(
          "pdf",
          "Generate PDF",
          sessionId as string,
        );

        try {
          await ctx.progress.stage("PREPARING", PROGRESS_STAGES.PDF.PREPARING);
          const sessionManager = await context.getSessionManager();
          const page = await sessionManager.getSessionPage(sessionId as string);

          await ctx.progress.stage("GENERATING", PROGRESS_STAGES.PDF.GENERATING);
          const pdf = await page.pdf({
            format: ((format as string | undefined) ?? "A4") as "A4" | "Letter" | "Legal" | "A3",
            orientation: (landscape as boolean | undefined) ? "landscape" : "portrait",
            signal: signal as AbortSignal | undefined,
          });

          await ctx.progress.stage("ENCODING", PROGRESS_STAGES.PDF.ENCODING);
          const base64Pdf = encodeBase64(pdf);

          context.visibilityService.operationTracker.completeOperation(opId);

          return {
            data: {
              sessionId,
              format: format ?? "A4",
              size: pdf.length,
              _resource: {
                uri: `pdf://${sessionId}/document.pdf`,
                mimeType: "application/pdf",
                blob: base64Pdf,
              },
            },
          };
        } catch (error) {
          context.visibilityService.operationTracker.completeOperation(opId, error as Error);
          throw error;
        }
      },
      { timeoutConfig: context.timeoutConfig },
    ),
  );

  // Execute JavaScript (LONG tier)
  server.tool(
    "browser_evaluate",
    "Execute JavaScript in the page context and return the result.",
    {
      sessionId: z.string().describe(
        "Session ID from browser_navigate. Required for all browser operations."
      ),
      script: z.string().describe(
        "JavaScript code to execute in the page context. Has access to 'document', 'window', etc. " +
        "Return a value to get it back. Example: 'return document.title'"
      ),
      args: z.array(z.unknown()).optional().describe(
        "Arguments passed to the script. Access them as function parameters. " +
        "Example: script='return arguments[0] + arguments[1]', args=[1, 2] returns 3."
      ),
      timeout: z.number().optional().describe("Timeout in milliseconds. Default: 30000."),
    },
    withFeedback(
      server,
      "browser_evaluate",
      async ({ sessionId, script, args, signal }, _ctx) => {
        context.permissionGuard.checkToolPermission("browser_evaluate");
        toolRateLimiter.check(sessionId as string);

        const opId = context.visibilityService.operationTracker.startOperation(
          "evaluate",
          "Execute JavaScript",
          sessionId as string,
        );

        try {
          evaluateRateLimiter.check(sessionId as string);
          validateScript(script as string);
          const sessionManager = await context.getSessionManager();
          const page = await sessionManager.getSessionPage(sessionId as string);
          const result = await page.evaluate(script as string, args as unknown[] | undefined, {
            signal: signal as AbortSignal | undefined,
          });

          context.visibilityService.operationTracker.completeOperation(opId);

          return {
            data: {
              sessionId,
              result,
            },
          };
        } catch (error) {
          context.visibilityService.operationTracker.completeOperation(opId, error as Error);
          throw error;
        }
      },
      { enableProgress: false, timeoutConfig: context.timeoutConfig },
    ),
  );

  // Query DOM (SHORT tier)
  server.tool(
    "browser_query_dom",
    "Query DOM elements and extract data.",
    {
      sessionId: z.string().describe(
        "Session ID from browser_navigate. Required for all browser operations."
      ),
      selector: z.string().describe(
        "CSS selector or XPath to find elements. Returns array of matching elements. " +
        "Examples: '.product-card', '#main-content a', '//div[@class=\"item\"]'"
      ),
      selectorType: z.enum(["css", "xpath"]).optional().describe(
        "Selector type. 'css' (default) or 'xpath' for XPath expressions."
      ),
      extract: z
        .array(
          z.object({
            name: z.string().describe("Key name for this extracted value in the result object."),
            attribute: z.string().optional().describe(
              "Extract an HTML attribute. Example: 'href', 'src', 'data-id'"
            ),
            property: z.string().optional().describe(
              "Extract a DOM property. Example: 'value', 'checked', 'innerHTML'"
            ),
            getText: z.boolean().optional().describe(
              "Extract visible text content. Set to true for text extraction."
            ),
            getHtml: z.boolean().optional().describe(
              "Extract inner HTML. Set to true to get raw HTML content."
            ),
          }),
        )
        .describe(
          "Array of fields to extract from each element. Each field specifies what to extract " +
          "and what to name it. Example: [{name: 'title', getText: true}, {name: 'link', attribute: 'href'}]"
        ),
      limit: z.number().optional().describe(
        "Maximum number of elements to return. Useful for large result sets. Default: all elements."
      ),
      timeout: z.number().optional().describe("Timeout in milliseconds. Default: 5000."),
    },
    withFeedback(
      server,
      "browser_query_dom",
      async ({ sessionId, selector, selectorType, extract, limit, signal }, ctx) => {
        context.permissionGuard.checkToolPermission("browser_query_dom");

        const opId = context.visibilityService.operationTracker.startOperation(
          "query_dom",
          `Query ${selector}`,
          sessionId as string,
        );

        try {
          validateSelector(selector as string);
          const sessionManager = await context.getSessionManager();
          const page = await sessionManager.getSessionPage(sessionId as string);
          const elements = await page.query(
            selector as string,
            (selectorType as "css" | "xpath" | undefined) ?? "css",
            { signal: signal as AbortSignal | undefined },
          );
          const limitedElements = (limit as number | undefined)
            ? elements.slice(0, limit as number)
            : elements;

          if (limitedElements.length < elements.length) {
            ctx.addWarning(
              WARNING_CODES.MULTIPLE_MATCHES,
              `Found ${elements.length} elements, limited to ${limitedElements.length}`,
            );
          }

          const results = await Promise.all(
            limitedElements.map(async (element) => {
              const data: Record<string, unknown> = {};
              for (const field of extract as Array<{
                name: string;
                attribute?: string;
                property?: string;
                getText?: boolean;
                getHtml?: boolean;
              }>) {
                if (field.attribute) {
                  data[field.name] = await element.getAttribute(field.attribute);
                } else if (field.property) {
                  data[field.name] = await element.getProperty(field.property);
                } else if (field.getText) {
                  data[field.name] = await element.getText();
                } else if (field.getHtml) {
                  data[field.name] = await element.getProperty("innerHTML");
                }
              }
              return data;
            }),
          );

          context.visibilityService.operationTracker.completeOperation(opId);

          return {
            data: {
              sessionId,
              selector,
              count: results.length,
              elements: results,
            },
          };
        } catch (error) {
          context.visibilityService.operationTracker.completeOperation(opId, error as Error);
          throw error;
        }
      },
      { enableProgress: false, timeoutConfig: context.timeoutConfig },
    ),
  );

  // Wait for condition (LONG tier)
  server.tool(
    "browser_wait",
    "Wait for a condition to be met.",
    {
      sessionId: z.string().describe(
        "Session ID from browser_navigate. Required for all browser operations."
      ),
      type: z.enum(["time", "selector", "function"]).describe(
        "Wait type. 'selector' (RECOMMENDED) waits for element to appear. 'function' waits for " +
        "JavaScript condition. 'time' (AVOID) is fixed delay - unreliable and slow."
      ),
      duration: z.number().optional().describe(
        "Duration in milliseconds. Only used when type='time'. Avoid time waits - use selector waits."
      ),
      selector: z.string().optional().describe(
        "CSS selector to wait for. Used when type='selector'. Waits until element exists in DOM. " +
        "Example: '.data-loaded', '#submit-success'"
      ),
      condition: z.string().optional().describe(
        "JavaScript expression that returns truthy when condition is met. Used when type='function'. " +
        "Example: 'window.dataLoaded === true', '!document.querySelector(\".loading\")'"
      ),
      timeout: z.number().optional().describe(
        "Maximum wait time in milliseconds. Default: 30000. Throws error if condition not met."
      ),
    },
    withFeedback(
      server,
      "browser_wait",
      async ({ sessionId, type, duration, selector, condition, timeout, signal }, ctx) => {
        context.permissionGuard.checkToolPermission("browser_wait");
        toolRateLimiter.check(sessionId as string);

        const opId = context.visibilityService.operationTracker.startOperation(
          "wait",
          `Wait for ${type as string}`,
          sessionId as string | undefined,
        );

        try {
          if (selector) validateSelector(selector as string);
          if (condition) validateScript(condition as string);

          await ctx.progress.stage("STARTING", PROGRESS_STAGES.WAIT.STARTING);
          const sessionManager = await context.getSessionManager();
          const page = await sessionManager.getSessionPage(sessionId as string);

          await ctx.progress.stage("WAITING", PROGRESS_STAGES.WAIT.POLLING);
          const effectiveTimeout = (timeout as number) ?? 30000;
          await page.wait({
            type: type as "time" | "selector" | "function",
            duration: duration as number | undefined,
            selector: selector as string | undefined,
            condition: condition as string | undefined,
            timeout: effectiveTimeout,
            signal: signal as AbortSignal | undefined,
          });

          await ctx.progress.stage("COMPLETE", PROGRESS_STAGES.WAIT.SATISFIED);
          context.visibilityService.operationTracker.completeOperation(opId);

          return {
            data: {
              sessionId,
              waitType: type,
              message: "Wait condition satisfied",
            },
          };
        } catch (error) {
          context.visibilityService.operationTracker.completeOperation(opId, error as Error);
          throw error;
        }
      },
      { timeoutConfig: context.timeoutConfig },
    ),
  );

  // Close session (SHORT tier)
  server.tool(
    "browser_close_session",
    "Close a browser session and release resources.",
    {
      sessionId: z.string().describe(
        "Session ID to close. IMPORTANT: Always close sessions when done to free resources. " +
        "Unclosed sessions count toward MCP_MAX_SESSIONS limit."
      ),
      timeout: z.number().optional().describe("Timeout in milliseconds. Default: 5000."),
    },
    withFeedback(
      server,
      "browser_close_session",
      async ({ sessionId }, _ctx) => {
        context.permissionGuard.checkToolPermission("browser_close_session");

        const sid = sessionId as string;
        const opId = context.visibilityService.operationTracker.startOperation(
          "session_close",
          "Close session",
          sid,
        );

        try {
          const sessionManager = await context.getSessionManager();
          await sessionManager.closeSession(sid);
          context.visibilityService.operationTracker.completeOperation(opId);

          return {
            data: {
              sessionId,
              message: "Session closed successfully",
            },
          };
        } catch (error) {
          context.visibilityService.operationTracker.completeOperation(opId, error as Error);
          throw error;
        }
      },
      { enableProgress: false, timeoutConfig: context.timeoutConfig },
    ),
  );

  // List active sessions (INSTANT tier)
  server.tool(
    "browser_list_sessions",
    "List all active browser sessions.",
    {},
    withErrorHandling(
      "browser_list_sessions",
      async () => {
        // If session manager not initialized, return empty
        if (!context.serviceInitializer.isSessionManagerReady()) {
          return {
            activeSessions: 0,
            maxSessions: context.config.maxSessions ?? 10,
            sessions: [],
            note: "Session manager not yet initialized (no browser tools called)",
          };
        }

        const sessionManager = await context.getSessionManager();
        const stats = sessionManager.getPoolStats();
        return {
          activeSessions: stats.activeSessions,
          maxSessions: stats.maxSessions,
          sessions: stats.sessions,
        };
      },
      { timeoutConfig: context.timeoutConfig },
    ),
  );
}

/**
 * Browser Automation Tools for MCP Server
 * Direct browser control without query syntax
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { encodeBase64 } from "@std/encoding";
import type { MCPServerContext } from "../server/mcp-server.ts";
import { validateUrl, validateSelector, validateScript, sanitizeForLogging } from "../security/input-validator.ts";

/**
 * Register browser automation tools with the MCP server
 */
export function registerBrowserTools(
  server: McpServer,
  context: MCPServerContext,
): void {
  // Navigate to URL
  server.tool(
    "browser_navigate",
    "Navigate to a URL in a browser session. Creates a new session if sessionId is not provided.",
    {
      url: z.string().url().describe("URL to navigate to"),
      sessionId: z.string().optional().describe("Existing session ID to reuse"),
      waitUntil: z
        .enum(["load", "domcontentloaded", "networkidle"])
        .optional()
        .describe("Wait condition before returning (default: load)"),
      timeout: z.number().optional().describe("Navigation timeout in milliseconds"),
    },
    async ({ url, sessionId, waitUntil, timeout }) => {
      context.permissionGuard.checkToolPermission("browser_navigate");

      try {
        // Validate URL
        validateUrl(url);

        // Get or create session
        let session;
        let newSession = false;

        if (sessionId && context.sessionManager.hasSession(sessionId)) {
          session = context.sessionManager.getSession(sessionId);
        } else {
          const newSessionId = await context.sessionManager.createSession(
            context.permissionGuard.getGrantedPermissions(),
          );
          session = context.sessionManager.getSession(newSessionId);
          newSession = true;
        }

        // Get or create page and navigate
        const page = await context.sessionManager.getSessionPage(session.id);
        await page.navigate(url, {
          waitFor: waitUntil ?? "load",
          timeout: timeout ?? 30000,
        });

        // Update session URL
        context.sessionManager.updateSessionUrl(session.id, url);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  sessionId: session.id,
                  newSession,
                  url,
                  currentUrl: page.getCurrentURL(),
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: false,
                  error: sanitizeForLogging(error instanceof Error ? error.message : String(error)),
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Click element
  server.tool(
    "browser_click",
    "Click an element in the current page.",
    {
      sessionId: z.string().describe("Browser session ID"),
      selector: z.string().describe("CSS selector or XPath of element to click"),
      selectorType: z.enum(["css", "xpath"]).optional().describe("Selector type (default: css)"),
    },
    async ({ sessionId, selector, selectorType }) => {
      context.permissionGuard.checkToolPermission("browser_click");

      try {
        validateSelector(selector);

        const page = await context.sessionManager.getSessionPage(sessionId);

        await page.click(selector, selectorType ?? "css");

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  sessionId,
                  action: "click",
                  selector,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: false,
                  error: sanitizeForLogging(error instanceof Error ? error.message : String(error)),
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Type text
  server.tool(
    "browser_type",
    "Type text into an input element.",
    {
      sessionId: z.string().describe("Browser session ID"),
      selector: z.string().describe("CSS selector of input element"),
      text: z.string().describe("Text to type"),
      clear: z.boolean().optional().describe("Clear existing text before typing"),
      delay: z.number().optional().describe("Delay between keystrokes in milliseconds"),
    },
    async ({ sessionId, selector, text, clear, delay }) => {
      context.permissionGuard.checkToolPermission("browser_type");

      try {
        validateSelector(selector);

        const page = await context.sessionManager.getSessionPage(sessionId);

        await page.type(selector, text, { clear, delay });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  sessionId,
                  action: "type",
                  selector,
                  textLength: text.length,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: false,
                  error: sanitizeForLogging(error instanceof Error ? error.message : String(error)),
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Take screenshot
  server.tool(
    "browser_screenshot",
    "Take a screenshot of the current page or a specific element.",
    {
      sessionId: z.string().describe("Browser session ID"),
      fullPage: z.boolean().optional().describe("Capture full page (default: false)"),
      selector: z.string().optional().describe("CSS selector to screenshot specific element"),
      format: z.enum(["png", "jpeg"]).optional().describe("Image format (default: png)"),
      quality: z.number().min(0).max(100).optional().describe("JPEG quality 0-100"),
    },
    async ({ sessionId, fullPage, selector, format, quality }) => {
      context.permissionGuard.checkToolPermission("browser_screenshot");

      try {
        if (selector) {
          validateSelector(selector);
        }

        const page = await context.sessionManager.getSessionPage(sessionId);

        const screenshot = await page.screenshot({
          fullPage,
          selector,
          format: format ?? "png",
          quality,
        });

        const base64Image = encodeBase64(screenshot);

        return {
          content: [
            {
              type: "image",
              data: base64Image,
              mimeType: format === "jpeg" ? "image/jpeg" : "image/png",
            },
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  sessionId,
                  format: format ?? "png",
                  size: screenshot.length,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: false,
                  error: sanitizeForLogging(error instanceof Error ? error.message : String(error)),
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Generate PDF
  server.tool(
    "browser_pdf",
    "Generate a PDF of the current page.",
    {
      sessionId: z.string().describe("Browser session ID"),
      format: z.enum(["A4", "Letter", "Legal", "A3"]).optional().describe("Page format"),
      landscape: z.boolean().optional().describe("Landscape orientation"),
    },
    async ({ sessionId, format, landscape }) => {
      context.permissionGuard.checkToolPermission("browser_pdf");

      try {
        const page = await context.sessionManager.getSessionPage(sessionId);

        const pdf = await page.pdf({
          format: format ?? "A4",
          orientation: landscape ? "landscape" : "portrait",
        });

        const base64Pdf = encodeBase64(pdf);

        return {
          content: [
            {
              type: "resource",
              resource: {
                uri: `pdf://${sessionId}/document.pdf`,
                mimeType: "application/pdf",
                blob: base64Pdf,
              },
            },
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  sessionId,
                  format: format ?? "A4",
                  size: pdf.length,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: false,
                  error: sanitizeForLogging(error instanceof Error ? error.message : String(error)),
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Execute JavaScript
  server.tool(
    "browser_evaluate",
    "Execute JavaScript in the page context and return the result.",
    {
      sessionId: z.string().describe("Browser session ID"),
      script: z.string().describe("JavaScript code to execute"),
      args: z.array(z.unknown()).optional().describe("Arguments to pass to the script"),
    },
    async ({ sessionId, script, args }) => {
      context.permissionGuard.checkToolPermission("browser_evaluate");

      try {
        // Validate script for dangerous patterns
        validateScript(script);

        const page = await context.sessionManager.getSessionPage(sessionId);

        const result = await page.evaluate(script, args);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  sessionId,
                  result,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: false,
                  error: sanitizeForLogging(error instanceof Error ? error.message : String(error)),
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Query DOM
  server.tool(
    "browser_query_dom",
    "Query DOM elements and extract data.",
    {
      sessionId: z.string().describe("Browser session ID"),
      selector: z.string().describe("CSS selector or XPath"),
      selectorType: z.enum(["css", "xpath"]).optional().describe("Selector type (default: css)"),
      extract: z
        .array(
          z.object({
            name: z.string().describe("Name for the extracted value"),
            attribute: z.string().optional().describe("Attribute to extract"),
            property: z.string().optional().describe("Property to extract"),
            getText: z.boolean().optional().describe("Extract text content"),
            getHtml: z.boolean().optional().describe("Extract inner HTML"),
          }),
        )
        .describe("What to extract from each element"),
      limit: z.number().optional().describe("Maximum number of elements to return"),
    },
    async ({ sessionId, selector, selectorType, extract, limit }) => {
      context.permissionGuard.checkToolPermission("browser_query_dom");

      try {
        validateSelector(selector);

        // Use the session's existing page to preserve navigation state
        const page = await context.sessionManager.getSessionPage(sessionId);

        const elements = await page.query(selector, selectorType ?? "css");
        const limitedElements = limit ? elements.slice(0, limit) : elements;

        const results = await Promise.all(
          limitedElements.map(async (element) => {
            const data: Record<string, unknown> = {};

            for (const field of extract) {
              if (field.attribute) {
                data[field.name] = await element.getAttribute(field.attribute);
              } else if (field.property) {
                data[field.name] = await element.getProperty(field.property);
              } else if (field.getText) {
                data[field.name] = await element.getText();
              } else if (field.getHtml) {
                // Get innerHTML via property
                data[field.name] = await element.getProperty("innerHTML");
              }
            }

            return data;
          }),
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  sessionId,
                  selector,
                  count: results.length,
                  elements: results,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: false,
                  error: sanitizeForLogging(error instanceof Error ? error.message : String(error)),
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Wait for condition
  server.tool(
    "browser_wait",
    "Wait for a condition to be met.",
    {
      sessionId: z.string().describe("Browser session ID"),
      type: z.enum(["time", "selector", "function"]).describe("Wait type"),
      duration: z.number().optional().describe("Duration in milliseconds (for time wait)"),
      selector: z.string().optional().describe("CSS selector to wait for"),
      condition: z.string().optional().describe("JavaScript condition to evaluate"),
      timeout: z.number().optional().describe("Maximum wait time in milliseconds"),
    },
    async ({ sessionId, type, duration, selector, condition, timeout }) => {
      context.permissionGuard.checkToolPermission("browser_wait");

      try {
        if (selector) {
          validateSelector(selector);
        }
        if (condition) {
          validateScript(condition);
        }

        const page = await context.sessionManager.getSessionPage(sessionId);

        await page.wait({
          type,
          duration,
          selector,
          condition,
          timeout: timeout ?? 30000,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  sessionId,
                  waitType: type,
                  message: "Wait condition satisfied",
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: false,
                  error: sanitizeForLogging(error instanceof Error ? error.message : String(error)),
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Close session
  server.tool(
    "browser_close_session",
    "Close a browser session and release resources.",
    {
      sessionId: z.string().describe("Browser session ID to close"),
    },
    async ({ sessionId }) => {
      context.permissionGuard.checkToolPermission("browser_close_session");

      try {
        await context.sessionManager.closeSession(sessionId);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  sessionId,
                  message: "Session closed successfully",
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: false,
                  error: sanitizeForLogging(error instanceof Error ? error.message : String(error)),
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }
    },
  );

  // List active sessions
  server.tool(
    "browser_list_sessions",
    "List all active browser sessions.",
    {},
    async () => {
      const stats = context.sessionManager.getPoolStats();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                activeSessions: stats.activeSessions,
                maxSessions: stats.maxSessions,
                sessions: stats.sessions,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}

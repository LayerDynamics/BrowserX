/**
 * Page Resources for MCP Server
 * Exposes page content, DOM, and screenshots as MCP resources
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { encodeBase64 } from "@std/encoding";
import type { MCPServerContext } from "../server/mcp-server.ts";

/**
 * Register page-related resources with the MCP server
 */
export function registerPageResources(
  server: McpServer,
  context: MCPServerContext,
): void {
  // List available page resources
  server.resource(
    "page-content",
    "page://{sessionId}/content",
    async (uri) => {
      const sessionId = extractSessionId(uri.href);

      if (!sessionId || !context.sessionManager.hasSession(sessionId)) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: `Session not found: ${sessionId}`,
            },
          ],
        };
      }

      try {
        // Use session's existing page instead of creating a new one
        const page = await context.sessionManager.getSessionPage(sessionId);

        // Get page HTML via evaluate
        const html = await page.evaluate("document.documentElement.outerHTML");

        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/html",
              text: String(html),
            },
          ],
        };
      } catch (error) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    },
  );

  // Page screenshot resource
  server.resource(
    "page-screenshot",
    "page://{sessionId}/screenshot",
    async (uri) => {
      const sessionId = extractSessionId(uri.href);

      if (!sessionId || !context.sessionManager.hasSession(sessionId)) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: `Session not found: ${sessionId}`,
            },
          ],
        };
      }

      try {
        // Use session's existing page instead of creating a new one
        const page = await context.sessionManager.getSessionPage(sessionId);

        const screenshot = await page.screenshot({ format: "png" });
        const base64 = encodeBase64(screenshot);

        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "image/png",
              blob: base64,
            },
          ],
        };
      } catch (error) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    },
  );

  // Page title resource
  server.resource(
    "page-title",
    "page://{sessionId}/title",
    async (uri) => {
      const sessionId = extractSessionId(uri.href);

      if (!sessionId || !context.sessionManager.hasSession(sessionId)) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: `Session not found: ${sessionId}`,
            },
          ],
        };
      }

      try {
        // Use session's existing page instead of creating a new one
        const page = await context.sessionManager.getSessionPage(sessionId);

        const title = await page.evaluate("document.title");

        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: String(title),
            },
          ],
        };
      } catch (error) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    },
  );

  // Page URL resource
  server.resource(
    "page-url",
    "page://{sessionId}/url",
    async (uri) => {
      const sessionId = extractSessionId(uri.href);

      if (!sessionId || !context.sessionManager.hasSession(sessionId)) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: `Session not found: ${sessionId}`,
            },
          ],
        };
      }

      try {
        // Use session's existing page instead of creating a new one
        const page = await context.sessionManager.getSessionPage(sessionId);

        const currentUrl = page.getCurrentURL() ?? "about:blank";

        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: currentUrl,
            },
          ],
        };
      } catch (error) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    },
  );
}

/**
 * Extract session ID from resource URI
 */
function extractSessionId(uri: string): string | null {
  const match = uri.match(/page:\/\/([^/]+)/);
  return match ? match[1] : null;
}

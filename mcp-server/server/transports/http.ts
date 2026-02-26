/**
 * HTTP Transport for MCP Server
 * Enables communication via HTTP/SSE for remote access
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { calculateEffectiveTimeout } from "../../timeout/mod.ts";

/**
 * HTTP server configuration
 */
export interface HttpServerConfig {
  port?: number;
  hostname?: string;
  corsOrigins?: string[];
  /** Disable bearer token auth (for tests only) */
  disableAuth?: boolean;
}

/**
 * Pending request waiting for response
 */
interface PendingRequest {
  resolve: (message: unknown) => void;
  reject: (error: Error) => void;
  timeout: number;
}

/**
 * Active session with linked transports for MCP communication
 */
interface HttpSession {
  serverTransport: InstanceType<typeof InMemoryTransport>;
  clientTransport: InstanceType<typeof InMemoryTransport>;
  lastActivity: number;
  sseController?: ReadableStreamDefaultController<Uint8Array>;
  sseEncoder?: TextEncoder;
  pendingRequests: Map<unknown, PendingRequest>;
}

/**
 * Start the MCP server with HTTP transport
 * Uses Deno's native HTTP server with SSE for streaming
 */
/**
 * Check if a request origin matches the allowed CORS patterns
 * Supports wildcard patterns like "http://localhost:*"
 */
function isOriginAllowed(origin: string | null, allowedPatterns: string[]): boolean {
  if (!origin) return false;

  for (const pattern of allowedPatterns) {
    if (pattern === "*") return true;

    // Convert pattern with wildcards to regex
    // e.g., "http://localhost:*" -> /^http:\/\/localhost:[^/]+$/
    const regexPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape regex special chars
      .replace(/\*/g, '[^/]+'); // Replace * with non-slash match
    const regex = new RegExp(`^${regexPattern}$`);

    if (regex.test(origin)) return true;
  }

  return false;
}

export async function startHttpServer(
  server: McpServer,
  config: HttpServerConfig = {},
): Promise<Deno.HttpServer> {
  const port = config.port ?? 3000;
  const hostname = config.hostname ?? "localhost";
  // Default to localhost origins only for security
  const corsOrigins = config.corsOrigins ?? ["http://localhost:*", "http://127.0.0.1:*"];

  // Bearer token authentication
  const authToken = config.disableAuth ? null : crypto.randomUUID();
  if (authToken) {
    // Write token to file instead of logging it to stderr (avoid leaking secrets in logs)
    const tokenDir = ".browserx";
    const tokenPath = `${tokenDir}/auth-token`;
    try {
      await Deno.mkdir(tokenDir, { recursive: true });
      await Deno.writeTextFile(tokenPath, authToken);
    } catch {
      // Fall back to stderr if file write fails (e.g., read-only filesystem)
      console.error(`[MCP HTTP] Auth token: ${authToken}`);
    }
    console.error(`[MCP HTTP] Auth token written to ${tokenPath}`);
  }

  // Warn if CORS wildcard is used with auth enabled (browsers won't send credentials with wildcard origin)
  if (!config.disableAuth && corsOrigins.includes("*")) {
    console.error(
      "[MCP HTTP] WARNING: CORS origin '*' is incompatible with Bearer auth from browser-based clients. " +
      "Browsers will not send credentials (Authorization header) when Access-Control-Allow-Origin is '*'. " +
      "Specify explicit origins instead, or use disableAuth for testing."
    );
  }

  // Session storage for stateful connections with proper MCP routing
  const sessions = new Map<string, HttpSession>();

  /**
   * Set up message handler for a session's client transport
   * Routes responses to pending requests and notifications to SSE
   */
  function setupMessageHandler(session: HttpSession): void {
    session.clientTransport.onmessage = (message) => {
      const msg = message as { id?: unknown };

      // Check if this is a response to a pending request
      if (msg.id !== undefined && session.pendingRequests.has(msg.id)) {
        const pending = session.pendingRequests.get(msg.id)!;
        clearTimeout(pending.timeout);
        session.pendingRequests.delete(msg.id);
        pending.resolve(message);
        return;
      }

      // Otherwise, it's a notification - forward to SSE if connected
      if (session.sseController && session.sseEncoder) {
        try {
          session.sseController.enqueue(
            session.sseEncoder.encode(`data: ${JSON.stringify(message)}\n\n`)
          );
        } catch {
          // Controller closed, ignore
        }
      }
    };
  }

  const httpServer = Deno.serve({ port, hostname }, async (req) => {
    const url = new URL(req.url);
    const requestOrigin = req.headers.get("Origin");

    // Validate origin against allowed patterns
    const originAllowed = isOriginAllowed(requestOrigin, corsOrigins);

    // CORS headers - only include allowed origin, not the pattern list
    const corsHeaders: Record<string, string> = {
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Session-ID",
    };

    // Only set Allow-Origin if the origin is allowed
    if (originAllowed && requestOrigin) {
      corsHeaders["Access-Control-Allow-Origin"] = requestOrigin;
      corsHeaders["Vary"] = "Origin";
    } else if (corsOrigins.includes("*")) {
      // Wildcard mode - allow any origin
      corsHeaders["Access-Control-Allow-Origin"] = "*";
    }

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Block cross-origin requests if origin is not allowed
    if (requestOrigin && !originAllowed) {
      return new Response(
        JSON.stringify({ error: "Origin not allowed", origin: requestOrigin }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // Bearer token authentication (skip health check)
    if (authToken && url.pathname !== "/health") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader || authHeader !== `Bearer ${authToken}`) {
        return new Response(
          JSON.stringify({ error: "Unauthorized. Provide Authorization: Bearer <token>" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Health check endpoint
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // MCP endpoint
    if (url.pathname === "/mcp") {
      if (req.method === "POST") {
        try {
          const body = await req.json();
          const clientSessionId = req.headers.get("X-Session-ID");

          let sessionId: string;
          let session: HttpSession | undefined;

          if (clientSessionId) {
            // Client supplied a session ID — only use it for LOOKUP, never create with client-supplied ID
            session = sessions.get(clientSessionId);
            if (!session) {
              return new Response(
                JSON.stringify({ error: "Session not found", sessionId: clientSessionId }),
                { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
            sessionId = clientSessionId;
          } else {
            // No session ID provided — create a new session with server-generated ID
            sessionId = crypto.randomUUID();

            // Create linked in-memory transports for MCP communication
            const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

            // Connect server to this transport
            await server.connect(serverTransport);

            session = {
              serverTransport,
              clientTransport,
              lastActivity: Date.now(),
              pendingRequests: new Map(),
            };

            // Set up the message handler for this session
            setupMessageHandler(session);

            sessions.set(sessionId, session);
          }

          session.lastActivity = Date.now();

          // Determine timeout based on tool tier (for tools/call requests)
          let requestTimeout = 30000; // Default fallback
          if (body.method === "tools/call" && body.params?.name) {
            const toolName = body.params.name as string;
            const userTimeout = body.params.arguments?.timeout as number | undefined;
            const timeoutInfo = calculateEffectiveTimeout(toolName, userTimeout);
            requestTimeout = timeoutInfo.timeout;
          }

          // Wait for response with tier-appropriate timeout
          const responsePromise = new Promise<unknown>((resolve, reject) => {
            const timeoutId = setTimeout(() => {
              session!.pendingRequests.delete(body.id);
              reject(new Error(`Request timeout after ${requestTimeout}ms`));
            }, requestTimeout);

            // Register this request as pending
            session!.pendingRequests.set(body.id, {
              resolve,
              reject,
              timeout: timeoutId,
            });
          });

          // Send the request through the transport
          await session.clientTransport.send(body);

          // Wait for response
          const response = await responsePromise;

          return new Response(JSON.stringify(response), {
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
              "X-Session-ID": sessionId,
            },
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return new Response(
            JSON.stringify({
              jsonrpc: "2.0",
              error: {
                code: -32603,
                message: errorMessage,
              },
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
      }

      // SSE endpoint for server-to-client messages
      if (req.method === "GET") {
        const sessionId = url.searchParams.get("sessionId") || req.headers.get("X-Session-ID");

        if (!sessionId) {
          return new Response("Session ID required", { status: 400 });
        }

        const session = sessions.get(sessionId);
        if (!session) {
          return new Response("Session not found", { status: 404 });
        }

        // Create SSE stream
        const stream = new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            session.sseController = controller;
            session.sseEncoder = encoder;

            // Send keepalive every 30 seconds
            const keepalive = setInterval(() => {
              try {
                controller.enqueue(encoder.encode(": keepalive\n\n"));
              } catch {
                clearInterval(keepalive);
              }
            }, 30000);

            // Clean up on close
            req.signal.addEventListener("abort", () => {
              clearInterval(keepalive);
              session.sseController = undefined;
              session.sseEncoder = undefined;
              controller.close();
            });
          },
        });

        return new Response(stream, {
          headers: {
            ...corsHeaders,
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
          },
        });
      }
    }

    // 404 for unknown routes
    return new Response("Not Found", {
      status: 404,
      headers: corsHeaders,
    });
  });

  console.error(`BrowserX MCP Server running on http://${hostname}:${port}/mcp`);

  // Cleanup old sessions periodically
  const sessionCleanupInterval = setInterval(() => {
    const now = Date.now();
    const timeout = 30 * 60 * 1000; // 30 minutes

    for (const [sessionId, session] of sessions.entries()) {
      if (now - session.lastActivity > timeout) {
        // Cancel pending requests
        for (const [_id, pending] of session.pendingRequests.entries()) {
          clearTimeout(pending.timeout);
          pending.reject(new Error("Session timeout"));
        }
        session.pendingRequests.clear();

        // Close transports before removing session
        try {
          session.clientTransport.close();
          session.serverTransport.close();
        } catch {
          // Ignore close errors
        }
        sessions.delete(sessionId);
      }
    }
  }, 60 * 1000);

  // Clear session cleanup interval when server shuts down
  httpServer.finished.then(() => {
    clearInterval(sessionCleanupInterval);
  });

  return httpServer;
}

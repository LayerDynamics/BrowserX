/**
 * BrowserX API Service
 *
 * Deno HTTP server wrapping the BrowserX query engine for Docker deployment.
 * Exposes:
 *   GET  /health   — liveness probe
 *   POST /execute  — run a BrowserX query
 *   POST /validate — check query syntax without executing
 *
 * Port: BROWSERX_API_PORT env var (default 8080)
 */
import { QueryEngine } from "../../query-engine/mod.ts";
import { Lexer } from "../../query-engine/lexer/mod.ts";
import { Parser } from "../../query-engine/parser/mod.ts";

const PORT = parseInt(Deno.env.get("BROWSERX_API_PORT") ?? "8080", 10);

// Single shared engine instance — browser init is expensive
const engine = new QueryEngine({
  browser: { headless: true },
  proxy: { enabled: false },
});

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ── /execute ─────────────────────────────────────────────────────────────────

async function handleExecute(req: Request): Promise<Response> {
  let body: { query?: string; options?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(
      { error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } },
      400,
    );
  }

  if (!body.query || typeof body.query !== "string" || body.query.trim() === "") {
    return jsonResponse(
      { error: { code: "INVALID_REQUEST_BODY", message: "Missing required field: query" } },
      400,
    );
  }

  try {
    const result = await engine.execute(body.query, body.options as never);
    return jsonResponse({ results: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown execution error";
    return jsonResponse(
      { error: { code: "QUERY_EXECUTION_ERROR", message } },
      500,
    );
  }
}

// ── /validate ────────────────────────────────────────────────────────────────

async function handleValidate(req: Request): Promise<Response> {
  let body: { query?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(
      { error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } },
      400,
    );
  }

  if (!body.query || typeof body.query !== "string") {
    return jsonResponse(
      { valid: false, errors: [{ message: "Missing query field" }] },
      400,
    );
  }

  const query = body.query.trim();
  if (query === "") {
    return jsonResponse(
      { valid: false, errors: [{ message: "Query cannot be empty" }] },
      400,
    );
  }

  try {
    const lexer = new Lexer(query);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const statementCount = Array.isArray((ast as { statements?: unknown[] }).statements)
      ? (ast as { statements: unknown[] }).statements.length
      : 1;
    return jsonResponse({ valid: true, statements: statementCount });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Parse error";
    return jsonResponse({ valid: false, errors: [{ message }] });
  }
}

// ── Router ───────────────────────────────────────────────────────────────────

Deno.serve({ port: PORT }, async (req: Request): Promise<Response> => {
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname === "/health") {
    return jsonResponse({ status: "ok" });
  }

  if (req.method === "POST" && url.pathname === "/execute") {
    return await handleExecute(req);
  }

  if (req.method === "POST" && url.pathname === "/validate") {
    return await handleValidate(req);
  }

  return new Response("Not Found", { status: 404 });
});

console.log(`BrowserX API service running on port ${PORT}`);

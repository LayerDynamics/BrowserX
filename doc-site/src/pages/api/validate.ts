/**
 * BrowserX Query Validation API
 *
 * Validates query syntax without executing the query.
 * Used by the Playground for real-time syntax checking.
 *
 * NOTE: BrowserX integration limitation
 *
 * The BrowserX query engine (@browserx/query-engine) is Deno-based
 * and cannot be directly imported in Astro's Node.js/npm environment.
 *
 * For now, this API provides basic syntax validation by checking for
 * common patterns and keywords. For full validation, queries should
 * be sent to a separate BrowserX service.
 */

import type { APIRoute } from 'astro';

interface ValidationRequest {
  query: string;
}

interface ValidationError {
  line: number;
  column: number;
  message: string;
  type: 'syntax' | 'semantic';
}

interface ValidationSuccessResponse {
  valid: true;
  ast?: Record<string, unknown>;
}

interface ValidationErrorResponse {
  valid: false;
  errors: ValidationError[];
}

type ValidationResponse = ValidationSuccessResponse | ValidationErrorResponse;

/**
 * Basic query validation (simplified)
 * Returns errors if obvious syntax issues are found
 */
function validateQueryBasic(query: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const lines = query.split('\n');

  // Check for unclosed strings
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const doubleQuoteCount = (line.match(/(?<!\\)"/g) || []).length;
    const singleQuoteCount = (line.match(/(?<!\\)'/g) || []).length;

    if (doubleQuoteCount % 2 !== 0) {
      errors.push({
        line: i + 1,
        column: line.lastIndexOf('"') + 1,
        message: 'Unclosed string literal (double quote)',
        type: 'syntax',
      });
    }

    if (singleQuoteCount % 2 !== 0) {
      errors.push({
        line: i + 1,
        column: line.lastIndexOf("'") + 1,
        message: 'Unclosed string literal (single quote)',
        type: 'syntax',
      });
    }
  }

  // Check for unmatched brackets/braces/parens
  const stack: Array<{ char: string; line: number; column: number }> = [];
  const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
  const closingChars = new Set([')', ']', '}']);

  let inString: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (let j = 0; j < line.length; j++) {
      const char = line[j];

      // Track string state
      if ((char === '"' || char === "'") && (j === 0 || line[j - 1] !== '\\')) {
        if (inString === null) {
          inString = char;
          continue;
        } else if (inString === char) {
          inString = null;
          continue;
        }
      }
      if (inString !== null) continue;

      if (char in pairs) {
        stack.push({ char, line: i + 1, column: j + 1 });
      } else if (closingChars.has(char)) {
        if (stack.length === 0) {
          errors.push({
            line: i + 1,
            column: j + 1,
            message: `Unexpected closing ${char}`,
            type: 'syntax',
          });
        } else {
          const last = stack.pop()!;
          if (pairs[last.char] !== char) {
            errors.push({
              line: i + 1,
              column: j + 1,
              message: `Mismatched brackets: expected ${pairs[last.char]}, got ${char}`,
              type: 'syntax',
            });
          }
        }
      }
    }
    // Reset inString at end of line (strings don't span lines in BrowserX query)
    inString = null;
  }

  // Check for unclosed brackets/braces/parens
  for (const item of stack) {
    errors.push({
      line: item.line,
      column: item.column,
      message: `Unclosed ${item.char}`,
      type: 'syntax',
    });
  }

  // Check if query starts with a valid statement keyword
  const trimmed = query.trim();
  if (trimmed) {
    const firstWord = trimmed.split(/\s+/)[0].toUpperCase();
    const validStarters = ['SELECT', 'NAVIGATE', 'SET', 'SHOW', 'FOR', 'IF', 'INSERT', 'UPDATE', 'DELETE', 'WITH', 'CLICK', 'WAIT', 'SCREENSHOT', 'PDF'];

    if (!validStarters.includes(firstWord)) {
      errors.push({
        line: 1,
        column: 1,
        message: `Query must start with a valid statement keyword (got '${firstWord}')`,
        type: 'semantic',
      });
    }
  }

  return errors;
}

// Mark this route as server-rendered (not statically prerendered)
export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    // Check Content-Type
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return new Response(JSON.stringify({
        valid: false,
        errors: [{
          line: 0,
          column: 0,
          message: 'Content-Type must be application/json.',
          type: 'semantic' as const,
        }],
      } satisfies ValidationErrorResponse), {
        status: 415,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const body = await request.json() as ValidationRequest;

    // Validate request body
    if (typeof body !== 'object' || body === null || typeof (body as any).query !== 'string') {
      return new Response(
        JSON.stringify({
          valid: false,
          errors: [{
            line: 0,
            column: 0,
            message: 'Request body must contain a "query" string',
            type: 'semantic' as const,
          }],
        } satisfies ValidationErrorResponse),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Proxy to BrowserX API service if available
    const apiUrl = import.meta.env.BROWSERX_API_URL;
    if (apiUrl) {
      try {
        const upstream = await fetch(`${apiUrl}/validate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: body.query }),
          signal: AbortSignal.timeout(5000),
        });
        if (upstream.ok) {
          return new Response(await upstream.text(), {
            status: upstream.status,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      } catch {
        // Fall through to local validation
      }
    }

    const { query } = body;

    // Empty query is technically valid (will produce empty result)
    if (query.trim() === '') {
      return new Response(
        JSON.stringify({
          valid: true,
        } satisfies ValidationSuccessResponse),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Run basic validation
    const errors = validateQueryBasic(query);

    if (errors.length > 0) {
      return new Response(
        JSON.stringify({
          valid: false,
          errors,
        } satisfies ValidationErrorResponse),
        {
          status: 200, // Return 200 even for invalid queries
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Query passed basic validation
    return new Response(
      JSON.stringify({
        valid: true,
      } satisfies ValidationSuccessResponse),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    // Handle unexpected errors (malformed JSON, etc.)
    console.error('Validation API error:', error);

    return new Response(
      JSON.stringify({
        valid: false,
        errors: [{
          line: 0,
          column: 0,
          message: 'Internal server error',
          type: 'semantic' as const,
        }],
      } satisfies ValidationErrorResponse),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

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
  ast?: any;
}

interface ValidationErrorResponse {
  valid: false;
  errors: ValidationError[];
}

type ValidationResponse = ValidationSuccessResponse | ValidationErrorResponse;

/**
 * Basic syntax validation rules
 */
const VALID_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'ORDER', 'BY', 'LIMIT', 'OFFSET',
  'NAVIGATE', 'TO', 'WITH', 'CAPTURE', 'SET', 'SHOW',
  'FOR', 'EACH', 'IN', 'IF', 'THEN', 'ELSE', 'DO', 'END',
  'INSERT', 'INTO', 'UPDATE', 'DELETE', 'AS',
  'AND', 'OR', 'NOT', 'LIKE', 'EXISTS', 'BETWEEN',
  'CLICK', 'WAIT', 'SCREENSHOT', 'PDF', 'TYPE',
  'CACHE', 'CACHED', 'HEADERS', 'COOKIES', 'PROXY', 'TIMEOUT',
];

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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (let j = 0; j < line.length; j++) {
      const char = line[j];

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
// Note: Commented out for static builds. Uncomment when deploying with an adapter.
// export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    // Parse request body
    const body = await request.json() as ValidationRequest;

    // Validate request body
    if (!body || typeof body.query !== 'string') {
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
          message: error instanceof Error ? error.message : 'Internal server error',
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

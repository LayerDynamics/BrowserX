/**
 * HTML Parse Errors
 * Error recovery for malformed HTML.
 */

export interface HTMLParseError {
    code: string;
    message: string;
    line: number;
    column: number;
}

export function createParseError(code: string, message: string): HTMLParseError {
    return { code, message, line: 0, column: 0 };
}

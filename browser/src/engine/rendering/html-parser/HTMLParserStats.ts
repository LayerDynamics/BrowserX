/**
 * HTML Parser Statistics
 */

export interface HTMLParserStats {
    tokensEmitted: number;
    parseErrors: number;
    maxStackDepth: number;
}

export function createHTMLParserStats(): HTMLParserStats {
    return { tokensEmitted: 0, parseErrors: 0, maxStackDepth: 0 };
}

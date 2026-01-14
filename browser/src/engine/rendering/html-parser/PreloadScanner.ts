/**
 * Preload Scanner
 * Speculatively discovers resources for early fetching.
 *
 * Scans HTML to find resources (stylesheets, scripts, images) that can be
 * preloaded before full HTML parsing completes, improving page load performance.
 */

export interface PreloadResource {
    url: string;
    type: "stylesheet" | "script" | "image" | "font" | "fetch";
    as?: string;
}

export class PreloadScanner {
    /**
     * Scan HTML for resources to preload
     */
    scan(html: string): PreloadResource[] {
        const resources: PreloadResource[] = [];

        // Find <link rel="stylesheet"> tags
        const stylesheetMatches = html.matchAll(/<link[^>]+rel\s*=\s*["']stylesheet["'][^>]*>/gi);
        for (const match of stylesheetMatches) {
            const href = this.extractAttribute(match[0], "href");
            if (href) {
                resources.push({ url: href, type: "stylesheet" });
            }
        }

        // Find <link rel="preload"> tags
        const preloadMatches = html.matchAll(/<link[^>]+rel\s*=\s*["']preload["'][^>]*>/gi);
        for (const match of preloadMatches) {
            const href = this.extractAttribute(match[0], "href");
            const as = this.extractAttribute(match[0], "as");
            if (href && as) {
                resources.push({
                    url: href,
                    type: this.mapAsToType(as),
                    as,
                });
            }
        }

        // Find <script src> tags
        const scriptMatches = html.matchAll(/<script[^>]+src\s*=\s*["']([^"']+)["'][^>]*>/gi);
        for (const match of scriptMatches) {
            const src = match[1];
            if (src && !this.isInlineScript(src)) {
                resources.push({ url: src, type: "script" });
            }
        }

        // Find <img src> tags
        const imgMatches = html.matchAll(/<img[^>]+src\s*=\s*["']([^"']+)["'][^>]*>/gi);
        for (const match of imgMatches) {
            const src = match[1];
            if (src && !this.isDataUrl(src)) {
                resources.push({ url: src, type: "image" });
            }
        }

        // Find <link rel="preconnect"> for DNS/connection prewarming
        // (not returned as resources, but could be tracked separately)

        return resources;
    }

    /**
     * Get URLs only (for backward compatibility)
     */
    scanUrls(html: string): string[] {
        return this.scan(html).map((r) => r.url);
    }

    /**
     * Extract attribute value from tag string
     */
    private extractAttribute(tag: string, attrName: string): string | null {
        const regex = new RegExp(`${attrName}\\s*=\\s*["']([^"']+)["']`, "i");
        const match = tag.match(regex);
        return match ? match[1] : null;
    }

    /**
     * Map "as" attribute to resource type
     */
    private mapAsToType(as: string): PreloadResource["type"] {
        switch (as.toLowerCase()) {
            case "style":
                return "stylesheet";
            case "script":
                return "script";
            case "image":
                return "image";
            case "font":
                return "font";
            case "fetch":
                return "fetch";
            default:
                return "fetch";
        }
    }

    /**
     * Check if script is inline
     */
    private isInlineScript(src: string): boolean {
        return src.startsWith("javascript:") || src.startsWith("data:");
    }

    /**
     * Check if URL is data URL
     */
    private isDataUrl(url: string): boolean {
        return url.startsWith("data:");
    }
}

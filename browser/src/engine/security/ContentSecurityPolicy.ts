/**
 * Content Security Policy (CSP) Level 3 Implementation
 *
 * Parses and enforces CSP headers to control which resources
 * can be loaded and executed on a page.
 */

export type CSPDirective =
  | "default-src"
  | "script-src"
  | "style-src"
  | "img-src"
  | "connect-src"
  | "font-src"
  | "media-src"
  | "object-src"
  | "frame-src"
  | "frame-ancestors"
  | "base-uri"
  | "form-action"
  | "sandbox"
  | "report-uri"
  | "report-to"
  | "plugin-types"
  | "worker-src"
  | "manifest-src"
  | "navigate-to";

export type CSPSourceExpression =
  | "'self'"
  | "'none'"
  | "'unsafe-inline'"
  | "'unsafe-eval'"
  | "'strict-dynamic'"
  | `nonce-${string}`
  | `sha256-${string}`
  | `sha384-${string}`
  | `sha512-${string}`
  | string; // scheme-source or host-source

export class CSPViolation {
  constructor(
    public directive: CSPDirective,
    public blockedURI: string,
    public message: string,
    public reportOnly: boolean,
  ) {}
}

export class ContentSecurityPolicy {
  private directives = new Map<CSPDirective, CSPSourceExpression[]>();
  private reportOnly: boolean;
  private violations: CSPViolation[] = [];

  constructor(headerValue: string, reportOnly = false) {
    this.reportOnly = reportOnly;
    this.parse(headerValue);
  }

  private parse(header: string): void {
    for (const part of header.split(";")) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const [directive, ...sources] = trimmed.split(/\s+/);
      this.directives.set(directive as CSPDirective, sources as CSPSourceExpression[]);
    }
  }

  /** Check if a source is allowed for a given directive */
  allows(directive: CSPDirective, source: string, pageOrigin: string): boolean {
    const sources = this.directives.get(directive) ??
      this.directives.get("default-src");
    if (!sources) return true; // No policy = allow all

    for (const expr of sources) {
      if (expr === "'none'") {
        const violation = new CSPViolation(
          directive,
          source,
          `Refused to load '${source}' because it violates the Content Security Policy directive: "${directive} ${
            sources.join(" ")
          }"`,
          this.reportOnly,
        );
        this.violations.push(violation);
        return this.reportOnly;
      }
      if (expr === "'self'" && this.isSameOrigin(source, pageOrigin)) return true;
      if (expr === "*") return true;
      if (this.matchesHostSource(source, expr)) return true;
      // scheme-source: "https:" matches any https URL
      if (expr.endsWith(":") && source.startsWith(expr)) return true;
    }

    // Record violation
    const violation = new CSPViolation(
      directive,
      source,
      `Refused to load '${source}' because it violates the Content Security Policy directive: "${directive} ${
        sources.join(" ")
      }"`,
      this.reportOnly,
    );
    this.violations.push(violation);

    return this.reportOnly; // report-only mode still allows
  }

  /** Check if inline script is allowed (by nonce or hash) */
  allowsInlineScript(nonce?: string, hash?: string): boolean {
    const sources = this.directives.get("script-src") ??
      this.directives.get("default-src");
    if (!sources) return true;

    for (const expr of sources) {
      if (expr === "'unsafe-inline'") return true;
      if (nonce && expr === `'nonce-${nonce}'`) return true;
      if (
        hash &&
        (expr === `'sha256-${hash}'` || expr === `'sha384-${hash}'` || expr === `'sha512-${hash}'`)
      ) return true;
    }

    const violation = new CSPViolation(
      "script-src",
      "inline",
      `Refused to execute inline script because it violates the Content Security Policy directive: "script-src ${
        sources.join(" ")
      }"`,
      this.reportOnly,
    );
    this.violations.push(violation);
    return this.reportOnly;
  }

  /** Check if eval is allowed */
  allowsEval(): boolean {
    const sources = this.directives.get("script-src") ??
      this.directives.get("default-src");
    if (!sources) return true;
    if (sources.includes("'unsafe-eval'" as CSPSourceExpression)) return true;

    const violation = new CSPViolation(
      "script-src",
      "eval",
      `Refused to evaluate a string as JavaScript because 'unsafe-eval' is not an allowed source.`,
      this.reportOnly,
    );
    this.violations.push(violation);
    return this.reportOnly;
  }

  /** Check if inline style is allowed */
  allowsInlineStyle(nonce?: string, hash?: string): boolean {
    const sources = this.directives.get("style-src") ??
      this.directives.get("default-src");
    if (!sources) return true;

    for (const expr of sources) {
      if (expr === "'unsafe-inline'") return true;
      if (nonce && expr === `'nonce-${nonce}'`) return true;
      if (
        hash &&
        (expr === `'sha256-${hash}'` || expr === `'sha384-${hash}'` || expr === `'sha512-${hash}'`)
      ) return true;
    }

    const violation = new CSPViolation(
      "style-src",
      "inline",
      `Refused to apply inline style because it violates the Content Security Policy directive: "style-src ${
        sources.join(" ")
      }"`,
      this.reportOnly,
    );
    this.violations.push(violation);
    return this.reportOnly;
  }

  getViolations(): CSPViolation[] {
    return [...this.violations];
  }
  clearViolations(): void {
    this.violations = [];
  }
  isReportOnly(): boolean {
    return this.reportOnly;
  }
  getReportUri(): string | undefined {
    return this.directives.get("report-uri")?.[0];
  }
  getDirectives(): Map<CSPDirective, CSPSourceExpression[]> {
    return new Map(this.directives);
  }

  private isSameOrigin(source: string, pageOrigin: string): boolean {
    try {
      return new URL(source).origin === pageOrigin;
    } catch {
      return false;
    }
  }

  private matchesHostSource(source: string, hostExpr: string): boolean {
    try {
      const url = new URL(source);
      // Handle wildcard subdomains: *.example.com
      if (hostExpr.startsWith("*.")) {
        const domain = hostExpr.slice(2);
        return url.hostname.endsWith(`.${domain}`) || url.hostname === domain;
      }
      // Exact host match (with optional scheme)
      if (hostExpr.includes("://")) {
        const exprUrl = new URL(hostExpr);
        return url.origin === exprUrl.origin;
      }
      return url.hostname === hostExpr;
    } catch {
      return false;
    }
  }
}

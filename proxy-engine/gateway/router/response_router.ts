// response_router.ts - Response routing and transformation

/**
 * Response transformation rule
 */
export interface ResponseRule {
  id: string;
  pattern: string | RegExp;
  transform: (response: unknown) => unknown;
  priority: number;
}

/**
 * Response router for transforming responses
 */
export class ResponseRouter {
  private rules: ResponseRule[];

  constructor() {
    this.rules = [];
  }

  /**
   * Add a response transformation rule
   */
  addRule(rule: ResponseRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Remove a rule by ID
   */
  removeRule(id: string): boolean {
    const index = this.rules.findIndex(r => r.id === id);
    if (index !== -1) {
      this.rules.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Match response against rules
   */
  matchRules(path: string): ResponseRule[] {
    return this.rules.filter(rule => {
      if (typeof rule.pattern === 'string') {
        return path.includes(rule.pattern);
      } else {
        return rule.pattern.test(path);
      }
    });
  }

  /**
   * Transform response using matched rules
   */
  transform(path: string, response: unknown): unknown {
    const rules = this.matchRules(path);
    
    let transformed = response;
    for (const rule of rules) {
      transformed = rule.transform(transformed);
    }
    
    return transformed;
  }

  /**
   * Clear all rules
   */
  clear(): void {
    this.rules = [];
  }

  /**
   * Get all rules
   */
  getRules(): ResponseRule[] {
    return [...this.rules];
  }
}

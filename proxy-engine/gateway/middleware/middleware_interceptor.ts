// middleware_interceptor.ts - Middleware pipeline for request/response interception

/**
 * Middleware function type
 */
export type Middleware<T = unknown> = (
  context: T,
  next: () => Promise<unknown>
) => Promise<unknown>;

/**
 * Middleware interceptor for executing middleware chains
 */
export class MiddlewareInterceptor<T = unknown> {
  private middlewares: Middleware<T>[];

  constructor() {
    this.middlewares = [];
  }

  /**
   * Add middleware to the chain
   */
  use(middleware: Middleware<T>): void {
    this.middlewares.push(middleware);
  }

  /**
   * Remove middleware from the chain
   */
  remove(middleware: Middleware<T>): boolean {
    const index = this.middlewares.indexOf(middleware);
    if (index !== -1) {
      this.middlewares.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Execute middleware chain
   */
  async execute(context: T): Promise<unknown> {
    let index = 0;

    const next = async (): Promise<unknown> => {
      if (index >= this.middlewares.length) {
        return context;
      }

      const middleware = this.middlewares[index++];
      return await middleware(context, next);
    };

    return await next();
  }

  /**
   * Clear all middleware
   */
  clear(): void {
    this.middlewares = [];
  }

  /**
   * Get middleware count
   */
  count(): number {
    return this.middlewares.length;
  }
}

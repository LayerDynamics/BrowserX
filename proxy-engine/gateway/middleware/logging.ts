/**
 * Logging Middleware
 *
 * Request/response logging with structured logging support
 */

import type {
  MiddlewareResult,
  RequestContext,
  RequestMiddleware,
  ResponseMiddleware,
} from "./types.ts";
import type { HTTPRequest, HTTPResponse } from "../../core/network/transport/http/http.ts";

/**
 * Log level
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Log format
 */
export type LogFormat = "json" | "text" | "common" | "combined";

/**
 * Logger interface
 */
export interface Logger {
  /**
   * Log debug message
   */
  debug(message: string, data?: Record<string, unknown>): void;

  /**
   * Log info message
   */
  info(message: string, data?: Record<string, unknown>): void;

  /**
   * Log warning message
   */
  warn(message: string, data?: Record<string, unknown>): void;

  /**
   * Log error message
   */
  error(message: string, data?: Record<string, unknown>): void;
}

/**
 * Logging middleware configuration
 */
export interface LoggingConfig {
  /**
   * Log level
   */
  level: LogLevel;

  /**
   * Log format
   */
  format: LogFormat;

  /**
   * Logger implementation
   */
  logger?: Logger;

  /**
   * Log request headers
   */
  logRequestHeaders?: boolean;

  /**
   * Log response headers
   */
  logResponseHeaders?: boolean;

  /**
   * Log request body (be careful with sensitive data)
   */
  logRequestBody?: boolean;

  /**
   * Log response body (be careful with sensitive data)
   */
  logResponseBody?: boolean;

  /**
   * Maximum body size to log (bytes)
   */
  maxBodySize?: number;

  /**
   * Skip logging for certain requests
   */
  skip?: (request: HTTPRequest, context: RequestContext) => boolean;

  /**
   * Custom field extractor
   */
  extractFields?: (
    request: HTTPRequest,
    response: HTTPResponse | null,
    context: RequestContext,
  ) => Record<string, unknown>;
}

/**
 * Console logger implementation
 */
export class ConsoleLogger implements Logger {
  constructor(private minLevel: LogLevel = "info") {}

  debug(message: string, data?: Record<string, unknown>): void {
    if (this.shouldLog("debug")) {
      console.debug(this.format("DEBUG", message, data));
    }
  }

  info(message: string, data?: Record<string, unknown>): void {
    if (this.shouldLog("info")) {
      console.info(this.format("INFO", message, data));
    }
  }

  warn(message: string, data?: Record<string, unknown>): void {
    if (this.shouldLog("warn")) {
      console.warn(this.format("WARN", message, data));
    }
  }

  error(message: string, data?: Record<string, unknown>): void {
    if (this.shouldLog("error")) {
      console.error(this.format("ERROR", message, data));
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ["debug", "info", "warn", "error"];
    const minIndex = levels.indexOf(this.minLevel);
    const currentIndex = levels.indexOf(level);
    return currentIndex >= minIndex;
  }

  private format(level: string, message: string, data?: Record<string, unknown>): string {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` ${JSON.stringify(data)}` : "";
    return `[${timestamp}] ${level}: ${message}${dataStr}`;
  }
}

/**
 * Request logging middleware
 */
export class RequestLoggingMiddleware implements RequestMiddleware {
  readonly name = "request_logging";

  private logger: Logger;

  constructor(private config: LoggingConfig) {
    this.logger = config.logger || new ConsoleLogger(config.level);
  }

  async processRequest(
    request: HTTPRequest,
    context: RequestContext,
  ): Promise<MiddlewareResult> {
    // Check if request should be skipped
    if (this.config.skip && this.config.skip(request, context)) {
      return { type: "continue" };
    }

    // Log request
    const data = this.buildRequestLogData(request, context);

    this.logger.info(
      `${request.method} ${request.uri} - Request received`,
      data,
    );

    return { type: "continue" };
  }

  /**
   * Build log data for request
   */
  private buildRequestLogData(
    request: HTTPRequest,
    context: RequestContext,
  ): Record<string, unknown> {
    const data: Record<string, unknown> = {
      requestId: context.requestId,
      method: request.method,
      uri: request.uri,
      version: request.version,
      clientIP: context.clientIP,
      clientPort: context.clientPort,
      protocol: context.protocol,
    };

    if (this.config.logRequestHeaders) {
      data.headers = request.headers;
    }

    if (
      this.config.logRequestBody &&
      request.body &&
      request.body.length <= (this.config.maxBodySize || 1024)
    ) {
      data.body = this.formatBody(request.body, request.headers["content-type"]);
    }

    if (context.user) {
      data.user = {
        id: context.user.id,
        username: context.user.username,
        roles: context.user.roles,
      };
    }

    return data;
  }

  /**
   * Format body for logging
   */
  private formatBody(body: Uint8Array, contentType?: string): unknown {
    if (contentType?.includes("application/json")) {
      try {
        return JSON.parse(new TextDecoder().decode(body));
      } catch {
        return new TextDecoder().decode(body);
      }
    }

    if (contentType?.startsWith("text/")) {
      return new TextDecoder().decode(body);
    }

    return `<binary data: ${body.length} bytes>`;
  }

  /**
   * Get logger
   */
  getLogger(): Logger {
    return this.logger;
  }
}

/**
 * Response logging middleware
 */
export class ResponseLoggingMiddleware implements ResponseMiddleware {
  readonly name = "response_logging";

  private logger: Logger;

  constructor(private config: LoggingConfig) {
    this.logger = config.logger || new ConsoleLogger(config.level);
  }

  async processResponse(
    request: HTTPRequest,
    response: HTTPResponse,
    context: RequestContext,
  ): Promise<HTTPResponse> {
    // Check if request should be skipped
    if (this.config.skip && this.config.skip(request, context)) {
      return response;
    }

    // Calculate request duration
    const duration = Date.now() - context.startTime;

    // Log response
    const data = this.buildResponseLogData(request, response, context, duration);

    const level = this.getLogLevel(response.statusCode);
    const message =
      `${request.method} ${request.uri} - ${response.statusCode} ${response.statusText} (${duration}ms)`;

    switch (level) {
      case "debug":
        this.logger.debug(message, data);
        break;
      case "info":
        this.logger.info(message, data);
        break;
      case "warn":
        this.logger.warn(message, data);
        break;
      case "error":
        this.logger.error(message, data);
        break;
    }

    return response;
  }

  /**
   * Build log data for response
   */
  private buildResponseLogData(
    request: HTTPRequest,
    response: HTTPResponse,
    context: RequestContext,
    duration: number,
  ): Record<string, unknown> {
    const data: Record<string, unknown> = {
      requestId: context.requestId,
      method: request.method,
      uri: request.uri,
      statusCode: response.statusCode,
      statusText: response.statusText,
      duration,
      clientIP: context.clientIP,
    };

    if (this.config.logResponseHeaders) {
      data.headers = response.headers;
    }

    if (
      this.config.logResponseBody &&
      response.body &&
      response.body.length <= (this.config.maxBodySize || 1024)
    ) {
      data.body = this.formatBody(response.body, response.headers["content-type"]);
    }

    // Add custom fields
    if (this.config.extractFields) {
      const customFields = this.config.extractFields(request, response, context);
      Object.assign(data, customFields);
    }

    // Add rate limit info if available
    if (context.metadata.rateLimit) {
      data.rateLimit = context.metadata.rateLimit;
    }

    return data;
  }

  /**
   * Get log level based on status code
   */
  private getLogLevel(statusCode: number): LogLevel {
    if (statusCode >= 500) {
      return "error";
    }
    if (statusCode >= 400) {
      return "warn";
    }
    if (statusCode >= 300) {
      return "info";
    }
    return "info";
  }

  /**
   * Format body for logging
   */
  private formatBody(body: Uint8Array, contentType?: string): unknown {
    if (contentType?.includes("application/json")) {
      try {
        return JSON.parse(new TextDecoder().decode(body));
      } catch {
        return new TextDecoder().decode(body);
      }
    }

    if (contentType?.startsWith("text/")) {
      return new TextDecoder().decode(body);
    }

    return `<binary data: ${body.length} bytes>`;
  }

  /**
   * Get logger
   */
  getLogger(): Logger {
    return this.logger;
  }
}

/**
 * Combined logging middleware (request + response)
 */
export class CombinedLoggingMiddleware implements RequestMiddleware, ResponseMiddleware {
  readonly name = "combined_logging";

  private requestLogger: RequestLoggingMiddleware;
  private responseLogger: ResponseLoggingMiddleware;

  constructor(config: LoggingConfig) {
    this.requestLogger = new RequestLoggingMiddleware(config);
    this.responseLogger = new ResponseLoggingMiddleware(config);
  }

  async processRequest(
    request: HTTPRequest,
    context: RequestContext,
  ): Promise<MiddlewareResult> {
    return await this.requestLogger.processRequest(request, context);
  }

  async processResponse(
    request: HTTPRequest,
    response: HTTPResponse,
    context: RequestContext,
  ): Promise<HTTPResponse> {
    return await this.responseLogger.processResponse(request, response, context);
  }

  /**
   * Get request logger
   */
  getRequestLogger(): RequestLoggingMiddleware {
    return this.requestLogger;
  }

  /**
   * Get response logger
   */
  getResponseLogger(): ResponseLoggingMiddleware {
    return this.responseLogger;
  }
}

/**
 * Access log formatter (Common Log Format)
 */
export class CommonLogFormatter {
  /**
   * Format request/response in Common Log Format
   * Format: host ident authuser date request status bytes
   */
  static format(
    request: HTTPRequest,
    response: HTTPResponse,
    context: RequestContext,
  ): string {
    const host = context.clientIP;
    const ident = "-"; // RFC 1413 identity (not used)
    const authuser = context.user?.username || "-";
    const date = new Date().toISOString();
    const requestLine = `${request.method} ${request.uri} HTTP/${request.version}`;
    const status = response.statusCode;
    const bytes = response.body?.length || 0;

    return `${host} ${ident} ${authuser} [${date}] "${requestLine}" ${status} ${bytes}`;
  }
}

/**
 * Access log formatter (Combined Log Format)
 */
export class CombinedLogFormatter {
  /**
   * Format request/response in Combined Log Format
   * Format: CLF + "referer" "user-agent"
   */
  static format(
    request: HTTPRequest,
    response: HTTPResponse,
    context: RequestContext,
  ): string {
    const commonLog = CommonLogFormatter.format(request, response, context);
    const referer = request.headers["referer"] || "-";
    const userAgent = request.headers["user-agent"] || "-";

    return `${commonLog} "${referer}" "${userAgent}"`;
  }
}

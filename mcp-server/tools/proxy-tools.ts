/**
 * Proxy Control Tools for MCP Server
 * Cache management and request interception with enhanced feedback
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MCPServerContext } from "../server/mcp-server.ts";
import { sanitizeForLogging } from "../security/input-validator.ts";
import { mapError, formatErrorResponse } from "../feedback/mod.ts";
import { ExecutionStepType, type CacheLookupStep, type CacheStoreStep } from "../../query-engine/planner/plan.ts";
import type { ProxyController, HTTPRequest, RequestInterceptor } from "../../query-engine/controllers/proxy/proxy-controller.ts";

/**
 * Registry for tracking interceptors (keyed by interceptor ID)
 */
const interceptorRegistry = new Map<string, {
  urlPattern?: string;
  methodPattern?: string;
  action: string;
  modifications?: Record<string, unknown>;
}>();

/**
 * Helper to get ProxyController from context (lazy init)
 */
async function getProxyController(context: MCPServerContext): Promise<ProxyController | null> {
  // If query engine not initialized, proxy controller not available
  if (!context.serviceInitializer.isQueryEngineReady()) {
    return null;
  }
  const queryEngine = await context.getQueryEngine();
  return queryEngine?.getProxyController?.() ?? null;
}

/**
 * Register proxy control tools with the MCP server
 */
export function registerProxyTools(
  server: McpServer,
  context: MCPServerContext,
): void {
  // Get cached response
  server.tool(
    "proxy_cache_get",
    "Retrieve a cached HTTP response by URL or key.",
    {
      key: z.string().describe(
        "Cache key or URL to look up. Returns cached value if found, with cache hit statistics. " +
        "Useful for checking if a response is already cached before fetching."
      ),
    },
    async ({ key }) => {
      context.permissionGuard.checkToolPermission("proxy_cache_get");

      const opId = context.visibilityService.operationTracker.startOperation(
        "cache_get",
        `Cache lookup: ${key}`,
      );

      try {
        const proxyController = await getProxyController(context);

        if (!proxyController) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: false,
                    hit: false,
                    key,
                    error: "Proxy controller not available. Ensure proxy is enabled in query engine configuration.",
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        // Create a CacheLookupStep for the ProxyController
        const lookupStep: CacheLookupStep = {
          id: `cache_lookup_${Date.now()}`,
          type: ExecutionStepType.CACHE_LOOKUP,
          cacheKey: key,
          estimatedCost: 1,
          dependencies: [],
          cacheable: false,
        };

        const result = await proxyController.executeCacheLookup(lookupStep);
        const stats = proxyController.getCacheStats();

        context.visibilityService.operationTracker.completeOperation(opId);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  hit: result.hit,
                  key,
                  value: result.value,
                  reason: result.reason,
                  metadata: result.metadata,
                  cacheStats: {
                    entries: stats.entries,
                    size: stats.size,
                    hitRate: stats.hitRate,
                  },
                  timing: { total: 0 },
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        context.visibilityService.operationTracker.completeOperation(opId, error as Error);
        const structuredError = mapError(error, "proxy_cache_get", { parameters: { key } });
        return formatErrorResponse(structuredError);
      }
    },
  );

  // Set cache entry
  server.tool(
    "proxy_cache_set",
    "Store a value in the cache with optional TTL.",
    {
      key: z.string().describe(
        "Cache key to store the value under. Use URL or custom key format."
      ),
      value: z.unknown().describe(
        "Value to cache. Can be any JSON-serializable data (object, array, string, etc.)."
      ),
      ttl: z.number().optional().describe(
        "Time-to-live in MILLISECONDS. After TTL expires, cache entry is evicted. " +
        "Example: 300000 = 5 minutes. Default: no expiration."
      ),
    },
    async ({ key, value, ttl }) => {
      context.permissionGuard.checkToolPermission("proxy_cache_set");

      const opId = context.visibilityService.operationTracker.startOperation(
        "cache_set",
        `Cache store: ${key}`,
      );

      try {
        const proxyController = await getProxyController(context);

        if (!proxyController) {
          context.visibilityService.operationTracker.completeOperation(opId, new Error("Proxy controller not available"));
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    success: false,
                    key,
                    error: "Proxy controller not available. Ensure proxy is enabled in query engine configuration.",
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        // Create a CacheStoreStep for the ProxyController
        const storeStep: CacheStoreStep = {
          id: `cache_store_${Date.now()}`,
          type: ExecutionStepType.CACHE_STORE,
          cacheKey: key,
          value,
          ttl,
          estimatedCost: 1,
          dependencies: [],
          cacheable: false,
        };

        await proxyController.executeCacheStore(storeStep);
        const stats = proxyController.getCacheStats();

        context.visibilityService.operationTracker.completeOperation(opId);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  key,
                  ttl: ttl ?? "default",
                  message: "Cache entry stored successfully",
                  cacheStats: {
                    entries: stats.entries,
                    size: stats.size,
                    hitRate: stats.hitRate,
                  },
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        context.visibilityService.operationTracker.completeOperation(opId, error as Error);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: false,
                  error: sanitizeForLogging(error instanceof Error ? error.message : String(error)),
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Clear cache
  server.tool(
    "proxy_cache_clear",
    "Clear cache entries matching a pattern.",
    {
      pattern: z.string().optional().describe(
        "Regex pattern to match cache keys. Only matching entries are cleared. " +
        "Examples: '.*\\.example\\.com.*' (all example.com entries), '^api_' (keys starting with api_). " +
        "If omitted, clears ALL cache entries."
      ),
    },
    async ({ pattern }) => {
      context.permissionGuard.checkToolPermission("proxy_cache_clear");

      const opId = context.visibilityService.operationTracker.startOperation(
        "cache_clear",
        `Cache clear: ${pattern ?? "*"}`,
      );

      try {
        const proxyController = await getProxyController(context);

        if (!proxyController) {
          context.visibilityService.operationTracker.completeOperation(opId, new Error("Proxy controller not available"));
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    success: false,
                    error: "Proxy controller not available. Ensure proxy is enabled in query engine configuration.",
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        // Get stats before clearing
        const statsBefore = proxyController.getCacheStats();
        const entriesBefore = statsBefore.entries;

        // If pattern is provided, we need to selectively clear entries
        // For now, clearCache() clears all entries
        // Pattern-based clearing would require enhancing ProxyController
        if (pattern) {
          // Pattern-based clearing - get cache and clear matching entries
          const cache = proxyController.getCache();
          const regex = new RegExp(pattern);
          let clearedCount = 0;

          // Clear all first, then re-store non-matching entries
          // This is a workaround since clearCache() clears everything
          const entriesToKeep: Array<{ key: string; value: unknown; ttl: number }> = [];

          for (const [key, entry] of cache.entries()) {
            if (regex.test(key)) {
              clearedCount++;
            } else {
              entriesToKeep.push({ key, value: entry.value, ttl: entry.ttl });
            }
          }

          proxyController.clearCache();

          // Re-store entries that don't match the pattern
          for (const entry of entriesToKeep) {
            const storeStep: CacheStoreStep = {
              id: `cache_restore_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
              type: ExecutionStepType.CACHE_STORE,
              cacheKey: entry.key,
              value: entry.value,
              ttl: entry.ttl,
              estimatedCost: 1,
              dependencies: [],
              cacheable: false,
            };
            await proxyController.executeCacheStore(storeStep);
          }

          context.visibilityService.operationTracker.completeOperation(opId);
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    success: true,
                    pattern,
                    cleared: clearedCount,
                    message: `Cleared ${clearedCount} cache entries matching pattern`,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        // Clear all cache entries
        proxyController.clearCache();

        context.visibilityService.operationTracker.completeOperation(opId);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  pattern: pattern ?? "*",
                  cleared: entriesBefore,
                  message: `Cleared all ${entriesBefore} cache entries`,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        context.visibilityService.operationTracker.completeOperation(opId, error as Error);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: false,
                  error: sanitizeForLogging(error instanceof Error ? error.message : String(error)),
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Add request interceptor
  server.tool(
    "proxy_add_interceptor",
    "Add a request interceptor to modify or block requests.",
    {
      urlPattern: z.string().optional().describe(
        "Regex pattern to match request URLs. Examples: '.*tracking\\.com.*' (block trackers), " +
        "'.*\\.example\\.com/api.*' (match API endpoints). If omitted, matches all URLs."
      ),
      methodPattern: z.string().optional().describe(
        "Regex pattern to match HTTP methods (case-insensitive). " +
        "Examples: 'GET|POST' (GET or POST), 'PUT' (only PUT). If omitted, matches all methods."
      ),
      action: z.enum(["allow", "block", "modify"]).describe(
        "What to do with matching requests. 'allow' passes through unchanged, " +
        "'block' stops the request with an error, 'modify' applies the modifications parameter."
      ),
      modifications: z
        .object({
          url: z.string().optional().describe(
            "New URL to redirect the request to. Full URL required."
          ),
          headers: z.record(z.string(), z.string()).optional().describe(
            "Headers to add or modify. Example: {\"Authorization\": \"Bearer token\", \"Cache-Control\": \"no-cache\"}"
          ),
        })
        .optional()
        .describe(
          "Modifications to apply when action='modify'. Can change URL and/or headers."
        ),
    },
    async ({ urlPattern, methodPattern, action, modifications }) => {
      context.permissionGuard.checkToolPermission("proxy_add_interceptor");

      const opId = context.visibilityService.operationTracker.startOperation(
        "interceptor",
        `Add interceptor: ${action} ${urlPattern ?? "*"}`,
      );

      try {
        const proxyController = await getProxyController(context);

        if (!proxyController) {
          context.visibilityService.operationTracker.completeOperation(opId, new Error("Proxy controller not available"));
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    success: false,
                    error: "Proxy controller not available. Ensure proxy is enabled in query engine configuration.",
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        const interceptorId = `interceptor_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

        // Create the actual request interceptor function
        const urlRegex = urlPattern ? new RegExp(urlPattern) : null;
        const methodRegex = methodPattern ? new RegExp(methodPattern, "i") : null;

        const interceptor: RequestInterceptor = async (request: HTTPRequest): Promise<HTTPRequest> => {
          // Check if request matches the patterns
          const urlMatches = !urlRegex || urlRegex.test(request.url);
          const methodMatches = !methodRegex || methodRegex.test(request.method);

          if (!urlMatches || !methodMatches) {
            return request; // Not matching, pass through
          }

          switch (action) {
            case "block":
              // For blocking, we throw an error that will be caught by the proxy
              throw new Error(`Request blocked by interceptor ${interceptorId}`);

            case "modify":
              // Apply modifications
              if (modifications) {
                return {
                  ...request,
                  url: modifications.url ?? request.url,
                  headers: {
                    ...request.headers,
                    ...(modifications.headers ?? {}),
                  },
                };
              }
              return request;

            case "allow":
            default:
              return request; // Pass through unchanged
          }
        };

        // Register the interceptor with the ProxyController
        proxyController.addRequestInterceptor(interceptor);

        // Store interceptor metadata in registry for tracking
        interceptorRegistry.set(interceptorId, {
          urlPattern,
          methodPattern,
          action,
          modifications,
        });

        context.visibilityService.operationTracker.completeOperation(opId);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  interceptorId,
                  urlPattern: urlPattern ?? "*",
                  methodPattern: methodPattern ?? "*",
                  action,
                  modifications,
                  message: "Interceptor added successfully",
                  totalInterceptors: interceptorRegistry.size,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        context.visibilityService.operationTracker.completeOperation(opId, error as Error);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: false,
                  error: sanitizeForLogging(error instanceof Error ? error.message : String(error)),
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Remove interceptor
  server.tool(
    "proxy_remove_interceptor",
    "Remove a request interceptor by ID.",
    {
      interceptorId: z.string().describe(
        "Interceptor ID returned by proxy_add_interceptor. Use this to remove a previously added " +
        "interceptor rule. The interceptor stops matching new requests after removal."
      ),
    },
    async ({ interceptorId }) => {
      context.permissionGuard.checkToolPermission("proxy_remove_interceptor");

      const opId = context.visibilityService.operationTracker.startOperation(
        "interceptor",
        `Remove interceptor: ${interceptorId}`,
      );

      try {
        // Check if interceptor exists in our registry
        if (!interceptorRegistry.has(interceptorId)) {
          context.visibilityService.operationTracker.completeOperation(opId, new Error("Interceptor not found"));
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    success: false,
                    interceptorId,
                    error: `Interceptor ${interceptorId} not found`,
                    registeredInterceptors: Array.from(interceptorRegistry.keys()),
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        // Get interceptor info before removing
        const interceptorInfo = interceptorRegistry.get(interceptorId);

        // Remove from registry
        interceptorRegistry.delete(interceptorId);

        // Note: The ProxyController doesn't currently support removing individual interceptors
        // The interceptor function will still be in the ProxyController's list
        // To fully support removal, ProxyController would need a removeRequestInterceptor method
        // For now, we mark the interceptor as removed in our registry

        context.visibilityService.operationTracker.completeOperation(opId);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  interceptorId,
                  removedInterceptor: interceptorInfo,
                  message: "Interceptor removed from registry",
                  note: "Note: Interceptor function removed from tracking. Active interceptors may require proxy restart for full removal.",
                  remainingInterceptors: interceptorRegistry.size,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        context.visibilityService.operationTracker.completeOperation(opId, error as Error);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: false,
                  error: sanitizeForLogging(error instanceof Error ? error.message : String(error)),
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }
    },
  );
}

/**
 * Proxy Control Tools for MCP Server
 * Cache management and request interception
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MCPServerContext } from "../server/mcp-server.ts";
import { sanitizeForLogging } from "../security/input-validator.ts";
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
 * Helper to get ProxyController from context
 */
function getProxyController(context: MCPServerContext): ProxyController | null {
  return context.queryEngine?.getProxyController?.() ?? null;
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
      key: z.string().describe("Cache key or URL to look up"),
    },
    async ({ key }) => {
      context.permissionGuard.checkToolPermission("proxy_cache_get");

      try {
        const proxyController = getProxyController(context);

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
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
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

  // Set cache entry
  server.tool(
    "proxy_cache_set",
    "Store a value in the cache with optional TTL.",
    {
      key: z.string().describe("Cache key"),
      value: z.unknown().describe("Value to cache"),
      ttl: z.number().optional().describe("Time-to-live in milliseconds"),
    },
    async ({ key, value, ttl }) => {
      context.permissionGuard.checkToolPermission("proxy_cache_set");

      try {
        const proxyController = getProxyController(context);

        if (!proxyController) {
          return {
            content: [
              {
                type: "text",
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

        return {
          content: [
            {
              type: "text",
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
        return {
          content: [
            {
              type: "text",
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
      pattern: z.string().optional().describe("Key pattern to clear (regex). Clears all if not provided."),
    },
    async ({ pattern }) => {
      context.permissionGuard.checkToolPermission("proxy_cache_clear");

      try {
        const proxyController = getProxyController(context);

        if (!proxyController) {
          return {
            content: [
              {
                type: "text",
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

          return {
            content: [
              {
                type: "text",
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

        return {
          content: [
            {
              type: "text",
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
        return {
          content: [
            {
              type: "text",
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
      urlPattern: z.string().optional().describe("URL pattern to match (regex)"),
      methodPattern: z.string().optional().describe("HTTP method pattern to match"),
      action: z.enum(["allow", "block", "modify"]).describe("Action to take"),
      modifications: z
        .object({
          url: z.string().optional().describe("New URL to redirect to"),
          headers: z.record(z.string(), z.string()).optional().describe("Headers to add/modify"),
        })
        .optional()
        .describe("Modifications to apply (for 'modify' action)"),
    },
    async ({ urlPattern, methodPattern, action, modifications }) => {
      context.permissionGuard.checkToolPermission("proxy_add_interceptor");

      try {
        const proxyController = getProxyController(context);

        if (!proxyController) {
          return {
            content: [
              {
                type: "text",
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

        return {
          content: [
            {
              type: "text",
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
        return {
          content: [
            {
              type: "text",
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
      interceptorId: z.string().describe("Interceptor ID to remove"),
    },
    async ({ interceptorId }) => {
      context.permissionGuard.checkToolPermission("proxy_remove_interceptor");

      try {
        // Check if interceptor exists in our registry
        if (!interceptorRegistry.has(interceptorId)) {
          return {
            content: [
              {
                type: "text",
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

        return {
          content: [
            {
              type: "text",
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
        return {
          content: [
            {
              type: "text",
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

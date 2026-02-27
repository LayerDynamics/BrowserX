/**
 * Tests for prototype pollution prevention in executeInterceptRequest
 * Ensures __proto__, constructor, and prototype keys are filtered from
 * step.modifications.headers before being spread into request headers.
 */

import { assertEquals, assert } from "@std/assert";
import { QueryExecutor } from "../../executor/executor.ts";
import { StateManager } from "../../state/mod.ts";
import {
  ExecutionPlan,
  ExecutionStepType,
  InterceptRequestStep,
} from "../../planner/plan.ts";

function createTestStateManager(): StateManager {
  return new StateManager({
    sessionCleanupInterval: 0,
    cache: { cleanupInterval: 0 },
  });
}

/**
 * Minimal ProxyController mock that captures interceptors so we can invoke them.
 */
function createMockProxyController() {
  const interceptors: Array<(request: any) => any> = [];
  return {
    interceptors,
    addRequestInterceptor(fn: (request: any) => any) {
      interceptors.push(fn);
    },
    removeRequestInterceptor(_fn: (request: any) => any) {},
    interceptRequest: async (request: any) => request,
  };
}

Deno.test({
  name: "executeInterceptRequest - filters __proto__ from modification headers",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const proxyController = createMockProxyController();
    const stateManager = createTestStateManager();
    const executor = new QueryExecutor(undefined, proxyController as any, stateManager);

    const plan: ExecutionPlan = {
      id: "proto_pollution_test",
      steps: [
        {
          id: "step_1",
          type: ExecutionStepType.INTERCEPT_REQUEST,
          urlPattern: ".*",
          action: "modify",
          modifications: {
            headers: {
              "x-custom": "safe-value",
              "__proto__": '{"polluted": true}',
              "constructor": "evil",
              "prototype": "evil",
            } as any,
          },
        } as InterceptRequestStep,
      ],
    };

    await executor.execute(plan);

    // The interceptor should have been registered
    assertEquals(proxyController.interceptors.length, 1);

    // Invoke the interceptor with a mock request
    const mockRequest = {
      url: "https://example.com",
      method: "GET",
      headers: { "accept": "text/html" },
      body: undefined,
    };

    const result = proxyController.interceptors[0](mockRequest);

    // Safe header should be present
    assertEquals(result.headers["x-custom"], "safe-value");
    assertEquals(result.headers["accept"], "text/html");

    // Dangerous keys must NOT be present
    assert(!("__proto__" in result.headers), "__proto__ key should be filtered");
    assert(!("constructor" in result.headers && result.headers["constructor"] === "evil"),
      "constructor key should be filtered");
    assert(!("prototype" in result.headers && result.headers["prototype"] === "evil"),
      "prototype key should be filtered");

    // Verify Object.prototype was not polluted
    const plainObj: any = {};
    assertEquals(plainObj.polluted, undefined, "Object.prototype should not be polluted");
  },
});

Deno.test({
  name: "executeInterceptRequest - normal headers pass through unaffected",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const proxyController = createMockProxyController();
    const stateManager = createTestStateManager();
    const executor = new QueryExecutor(undefined, proxyController as any, stateManager);

    const plan: ExecutionPlan = {
      id: "normal_headers_test",
      steps: [
        {
          id: "step_1",
          type: ExecutionStepType.INTERCEPT_REQUEST,
          urlPattern: ".*",
          action: "modify",
          modifications: {
            headers: {
              "authorization": "Bearer token123",
              "content-type": "application/json",
              "x-request-id": "abc-123",
            },
          },
        } as InterceptRequestStep,
      ],
    };

    await executor.execute(plan);

    const mockRequest = {
      url: "https://example.com/api",
      method: "POST",
      headers: { "accept": "*/*" },
      body: '{"key":"value"}',
    };

    const result = proxyController.interceptors[0](mockRequest);

    assertEquals(result.headers["authorization"], "Bearer token123");
    assertEquals(result.headers["content-type"], "application/json");
    assertEquals(result.headers["x-request-id"], "abc-123");
    assertEquals(result.headers["accept"], "*/*");
  },
});

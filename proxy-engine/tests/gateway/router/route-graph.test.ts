import { assertEquals } from "@std/assert";
import { assertStringIncludes } from "@std/assert/string-includes";
import { buildRouteGraph, renderRouteGraphAsSvg } from "../../../gateway/router/route-graph.ts";
import type { Route } from "../../../gateway/router/request_router.ts";

function mockRoute(id: string, pattern: string, servers: { id: string; host: string; port: number }[], enabled = true): Route {
  return {
    id,
    pattern,
    methods: ["GET"] as Route["methods"],
    priority: 1,
    enabled,
    upstream: {
      servers: servers.map((s) => ({
        ...s,
        weight: 1,
        enabled: true,
        protocol: "http" as const,
      })),
      loadBalancingStrategy: "round-robin" as const,
      timeout: 30000,
    },
  };
}

Deno.test("buildRouteGraph creates gateway + route + server nodes", () => {
  const routes = [
    mockRoute("api", "/api/:path", [{ id: "s1", host: "localhost", port: 8080 }]),
  ];
  const graph = buildRouteGraph(routes);

  // gateway + 1 route + 1 server = 3 nodes
  assertEquals(graph.nodeCount, 3);
  // gateway->route + route->server = 2 edges
  assertEquals(graph.edgeCount, 2);
});

Deno.test("buildRouteGraph skips disabled routes", () => {
  const routes = [
    mockRoute("api", "/api", [{ id: "s1", host: "localhost", port: 8080 }], false),
  ];
  const graph = buildRouteGraph(routes);

  // Only gateway node
  assertEquals(graph.nodeCount, 1);
  assertEquals(graph.edgeCount, 0);
});

Deno.test("buildRouteGraph handles multiple routes with shared servers", () => {
  const server = { id: "s1", host: "localhost", port: 8080 };
  const routes = [
    mockRoute("api", "/api", [server]),
    mockRoute("web", "/web", [server]),
  ];
  const graph = buildRouteGraph(routes);

  // gateway + 2 routes + 1 shared server = 4 nodes
  assertEquals(graph.nodeCount, 4);
  // gateway->route1 + gateway->route2 + route1->server + route2->server = 4 edges
  assertEquals(graph.edgeCount, 4);
});

Deno.test("buildRouteGraph handles route with multiple servers", () => {
  const routes = [
    mockRoute("api", "/api", [
      { id: "s1", host: "host1", port: 8080 },
      { id: "s2", host: "host2", port: 8081 },
    ]),
  ];
  const graph = buildRouteGraph(routes);

  // gateway + 1 route + 2 servers = 4 nodes
  assertEquals(graph.nodeCount, 4);
  // gateway->route + route->s1 + route->s2 = 3 edges
  assertEquals(graph.edgeCount, 3);
});

Deno.test("renderRouteGraphAsSvg returns valid SVG", () => {
  const routes = [
    mockRoute("api", "/api/:id", [{ id: "s1", host: "localhost", port: 8080 }]),
  ];
  const svg = renderRouteGraphAsSvg(routes);

  assertStringIncludes(svg, "<svg");
  assertStringIncludes(svg, "</svg>");
  assertStringIncludes(svg, "Gateway");
  assertStringIncludes(svg, "/api/:id");
  assertStringIncludes(svg, "localhost:8080");
});

Deno.test("buildRouteGraph handles empty routes array", () => {
  const graph = buildRouteGraph([]);

  // Only gateway node
  assertEquals(graph.nodeCount, 1);
  assertEquals(graph.edgeCount, 0);
});

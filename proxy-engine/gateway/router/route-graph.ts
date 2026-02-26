/**
 * Proxy Route Topology Visualizer
 *
 * Builds a GraphX DiGraph showing the topology:
 * Gateway -> Route -> Upstream Servers
 */

import { DiGraph, GraphNode, GraphEdge, hierarchical, render, DEFAULT_LIGHT_THEME } from "@browserx/graphx";
import type { LayoutResult, SVGRenderOptions } from "@browserx/graphx";
import type { Route } from "./request_router.ts";

/**
 * Build a DiGraph from an array of routes.
 * Creates a gateway node, route nodes for enabled routes,
 * and upstream server nodes with edges connecting them.
 */
export function buildRouteGraph(routes: Route[]): DiGraph {
  const graph = new DiGraph();
  let edgeCounter = 0;

  // Gateway root node
  const gatewayNode = new GraphNode("gateway", { type: "gateway" }, "Gateway");
  graph.addNode(gatewayNode);

  for (const route of routes) {
    // Skip disabled routes
    if (!route.enabled) {
      continue;
    }

    const routeId = `route:${route.id}`;
    const pattern = typeof route.pattern === "string" ? route.pattern : route.pattern.source;
    const routeLabel = `${route.id} (${pattern})`;
    const routeNode = new GraphNode(routeId, {
      type: "route",
      pattern,
      methods: route.methods,
      priority: route.priority,
    }, routeLabel);
    graph.addNode(routeNode);

    // Edge from gateway to route
    const gwEdge = new GraphEdge(`e${edgeCounter++}`, "gateway", routeId);
    graph.addEdge(gwEdge);

    // Upstream server nodes
    for (const server of route.upstream.servers) {
      const serverId = `server:${server.id}`;
      // Only add server node if not already present (servers can be shared)
      if (!graph.getNode(serverId)) {
        const serverLabel = `${server.host}:${server.port}`;
        const serverNode = new GraphNode(serverId, {
          type: "server",
          host: server.host,
          port: server.port,
          weight: server.weight,
          enabled: server.enabled,
        }, serverLabel);
        graph.addNode(serverNode);
      }

      const serverEdge = new GraphEdge(`e${edgeCounter++}`, routeId, serverId);
      graph.addEdge(serverEdge);
    }
  }

  return graph;
}

/**
 * Render a route topology as an SVG string using hierarchical LR layout.
 */
export function renderRouteGraphAsSvg(routes: Route[]): string {
  const graph = buildRouteGraph(routes);
  const layout: LayoutResult = hierarchical(graph, { direction: "LR" });
  const svgOptions: SVGRenderOptions = {
    directed: true,
    showLabels: true,
    theme: DEFAULT_LIGHT_THEME,
  };
  return render(graph, layout, svgOptions);
}

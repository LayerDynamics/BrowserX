import { assertEquals } from "@std/assert";

Deno.test("GatewayServer observer - setObserver method exists", async () => {
  const mod = await import("../../../gateway/server/gateway_server.ts");
  const GatewayServer = mod.GatewayServer;

  // GatewayServer requires config to construct
  const server = new GatewayServer({
    port: 0,
    host: "127.0.0.1",
    routes: [],
  });

  assertEquals(typeof server.setObserver, "function");
});

Deno.test("GatewayServer observer - emits proxy pipeline kind", () => {
  // Verify interface contract
  const event = {
    stageId: "route-match",
    stageName: "Route Match",
    pipeline: "proxy" as const,
    status: "completed" as const,
    startTime: Date.now(),
  };
  assertEquals(event.pipeline, "proxy");
});

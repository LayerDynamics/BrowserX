import { assertEquals, assertExists } from "@std/assert";

import { registerDeviceTools } from "../tools/device-tools.ts";

Deno.test("registerDeviceTools - is a function", () => {
  assertExists(registerDeviceTools);
  assertEquals(typeof registerDeviceTools, "function");
});

Deno.test("registerDeviceTools - registers tools on mock server", () => {
  const registeredTools: string[] = [];

  const mockServer = {
    tool: (name: string, _desc: string, _schema: unknown, _handler: unknown) => {
      registeredTools.push(name);
    },
  };

  const mockContext = {
    permissionGuard: { checkToolPermission: () => {} },
    visibilityService: { operationTracker: { startOperation: () => "op1", completeOperation: () => {} } },
    getSessionManager: async () => ({ getSession: () => null }),
    activityLogger: { logActivity: () => {} },
    metadata: {},
  };

  // deno-lint-ignore no-explicit-any
  registerDeviceTools(mockServer as any, mockContext as any);

  // Verify all expected tools are registered
  const expectedTools = [
    "device_list_serial_ports",
    "device_list_printers",
    "device_serial_open",
    "device_serial_write",
    "device_serial_read",
    "device_serial_close",
    "device_print",
    "device_print_pdf",
    "device_get_trace_log",
    "device_clear_trace_log",
  ];

  for (const tool of expectedTools) {
    assertEquals(registeredTools.includes(tool), true, `Missing tool: ${tool}`);
  }

  assertEquals(registeredTools.length, expectedTools.length);
});

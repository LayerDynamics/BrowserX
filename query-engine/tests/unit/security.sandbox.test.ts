/**
 * Sandbox Security Tests
 * Tests for the QuerySandbox class with Deno.Worker isolation
 */

import { assert, assertEquals, assertRejects } from "@std/assert";
import {
  QuerySandbox,
  type SandboxContext,
} from "../../security/sandbox.ts";
import { DataType } from "../../types/primitives.ts";

Deno.test("QuerySandbox - basic initialization", () => {
  const sandbox = new QuerySandbox();
  const config = sandbox.getConfig();

  assertEquals(config.enabled, true);
  assertEquals(config.timeout, 30000);
  assertEquals(config.workerPoolSize, 2);

  sandbox.destroy();
});

Deno.test("QuerySandbox - custom configuration", () => {
  const sandbox = new QuerySandbox({
    enabled: true,
    timeout: 5000,
    memoryLimit: 50 * 1024 * 1024,
    workerPoolSize: 4,
  });
  const config = sandbox.getConfig();

  assertEquals(config.timeout, 5000);
  assertEquals(config.memoryLimit, 50 * 1024 * 1024);
  assertEquals(config.workerPoolSize, 4);

  sandbox.destroy();
});

Deno.test("QuerySandbox - code validation detects dangerous patterns", () => {
  const sandbox = new QuerySandbox();

  // Test dangerous patterns
  const dangerousCodes = [
    'require("fs")',
    'import fs from "fs"',
    'eval("malicious")',
    'new Function("return this")',
    "process.exit()",
    "Deno.readFile()",
    "console.log(__dirname)",
    "console.log(__filename)",
  ];

  for (const code of dangerousCodes) {
    const result = sandbox.validate(code);
    assertEquals(result.valid, false, `Should detect: ${code}`);
    assert(result.errors.length > 0, `Should have errors for: ${code}`);
  }

  sandbox.destroy();
});

Deno.test("QuerySandbox - code validation accepts safe code", () => {
  const sandbox = new QuerySandbox();

  const safeCodes = [
    'return "hello world"',
    "return 1 + 2",
    "return Math.sqrt(16)",
    "return [1, 2, 3].map(x => x * 2)",
    'return JSON.stringify({ a: 1 })',
  ];

  for (const code of safeCodes) {
    const result = sandbox.validate(code);
    assertEquals(result.valid, true, `Should accept: ${code}`);
    assertEquals(result.errors.length, 0, `Should have no errors for: ${code}`);
  }

  sandbox.destroy();
});

Deno.test("QuerySandbox - code validation rejects oversized code", () => {
  const sandbox = new QuerySandbox();

  const oversizedCode = "x".repeat(100001);
  const result = sandbox.validate(oversizedCode);

  assertEquals(result.valid, false);
  assert(result.errors.some((e) => e.includes("maximum length")));

  sandbox.destroy();
});

Deno.test("QuerySandbox - execute simple expression", async () => {
  const sandbox = new QuerySandbox({ timeout: 5000 });
  const context: SandboxContext = {
    globals: { x: 10, y: 20 },
    apis: {},
  };

  const result = await sandbox.execute<number>("return x + y", context);
  assertEquals(result, 30);

  sandbox.destroy();
});

Deno.test("QuerySandbox - execute with context globals", async () => {
  const sandbox = new QuerySandbox({ timeout: 5000 });
  const context: SandboxContext = {
    globals: {
      items: [1, 2, 3, 4, 5],
      multiplier: 2,
    },
    apis: {},
  };

  const result = await sandbox.execute<number[]>(
    "return items.map(i => i * multiplier)",
    context,
  );
  assertEquals(result, [2, 4, 6, 8, 10]);

  sandbox.destroy();
});

Deno.test("QuerySandbox - execute with serialized functions", async () => {
  const sandbox = new QuerySandbox({ timeout: 5000 });
  const context: SandboxContext = {
    globals: {
      data: [1, 2, 3],
    },
    apis: {
      double: (x: number) => x * 2,
    },
  };

  const result = await sandbox.execute<number[]>(
    "return data.map(double)",
    context,
  );
  assertEquals(result, [2, 4, 6]);

  sandbox.destroy();
});

Deno.test("QuerySandbox - execute async code", async () => {
  const sandbox = new QuerySandbox({ timeout: 5000 });
  const context: SandboxContext = {
    globals: {},
    apis: {},
  };

  const result = await sandbox.execute<string>(
    `
    return new Promise(resolve => {
      setTimeout(() => resolve("async result"), 10);
    });
  `,
    context,
  );
  assertEquals(result, "async result");

  sandbox.destroy();
});

Deno.test("QuerySandbox - timeout on infinite loop", async () => {
  const sandbox = new QuerySandbox({ timeout: 100 });
  const context: SandboxContext = {
    globals: {},
    apis: {},
  };

  await assertRejects(
    () =>
      sandbox.execute(
        `
      while(true) {}
      return "never";
    `,
        context,
      ),
    Error,
    "timeout",
  );

  sandbox.destroy();
});

Deno.test("QuerySandbox - error handling in sandboxed code", async () => {
  const sandbox = new QuerySandbox({ timeout: 5000 });
  const context: SandboxContext = {
    globals: {},
    apis: {},
  };

  await assertRejects(
    () =>
      sandbox.execute(
        `
      throw new Error("test error");
    `,
        context,
      ),
    Error,
    "test error",
  );

  sandbox.destroy();
});

Deno.test("QuerySandbox - dangerous globals are undefined", async () => {
  const sandbox = new QuerySandbox({ timeout: 5000 });
  const context: SandboxContext = {
    globals: {},
    apis: {},
  };

  const result = await sandbox.execute<Record<string, unknown>>(
    `
    return {
      hasEval: typeof eval !== 'undefined',
      hasFunction: typeof Function !== 'undefined',
      hasDeno: typeof Deno !== 'undefined',
      hasFetch: typeof fetch !== 'undefined',
      hasProcess: typeof process !== 'undefined',
      hasRequire: typeof require !== 'undefined',
    };
  `,
    context,
  );

  // All dangerous globals should be undefined in the sandbox
  assertEquals(result.hasEval, false);
  assertEquals(result.hasFunction, false);
  assertEquals(result.hasDeno, false);
  assertEquals(result.hasFetch, false);
  assertEquals(result.hasProcess, false);
  assertEquals(result.hasRequire, false);

  sandbox.destroy();
});

Deno.test("QuerySandbox - safe builtins are available", async () => {
  const sandbox = new QuerySandbox({ timeout: 5000 });
  const context: SandboxContext = {
    globals: {},
    apis: {},
  };

  const result = await sandbox.execute<Record<string, unknown>>(
    `
    return {
      hasMath: typeof Math !== 'undefined',
      hasJSON: typeof JSON !== 'undefined',
      hasArray: typeof Array !== 'undefined',
      hasObject: typeof Object !== 'undefined',
      hasPromise: typeof Promise !== 'undefined',
      hasDate: typeof Date !== 'undefined',
    };
  `,
    context,
  );

  assertEquals(result.hasMath, true);
  assertEquals(result.hasJSON, true);
  assertEquals(result.hasArray, true);
  assertEquals(result.hasObject, true);
  assertEquals(result.hasPromise, true);
  assertEquals(result.hasDate, true);

  sandbox.destroy();
});

Deno.test("QuerySandbox - worker pool statistics", async () => {
  const sandbox = new QuerySandbox({ workerPoolSize: 2, timeout: 5000 });
  const context: SandboxContext = {
    globals: {},
    apis: {},
  };

  // Execute a few requests to populate the pool
  await sandbox.execute<number>("return 1", context);
  await sandbox.execute<number>("return 2", context);

  const stats = sandbox.getPoolStats();
  assert(stats.totalWorkers > 0);
  assert(stats.totalWorkers <= 2);
  assertEquals(stats.busyWorkers, 0); // All should be idle after completion
  assert(stats.totalRequests >= 2);

  sandbox.destroy();
});

Deno.test("QuerySandbox - coerceResult STRING", () => {
  const sandbox = new QuerySandbox();

  assertEquals(sandbox.coerceResult(123, DataType.STRING), "123");
  assertEquals(sandbox.coerceResult(true, DataType.STRING), "true");
  assertEquals(sandbox.coerceResult({ a: 1 }, DataType.STRING), "[object Object]");

  sandbox.destroy();
});

Deno.test("QuerySandbox - coerceResult NUMBER", () => {
  const sandbox = new QuerySandbox();

  assertEquals(sandbox.coerceResult("42", DataType.NUMBER), 42);
  assertEquals(sandbox.coerceResult("3.14", DataType.NUMBER), 3.14);
  assertEquals(sandbox.coerceResult("invalid", DataType.NUMBER), null);

  sandbox.destroy();
});

Deno.test("QuerySandbox - coerceResult BOOLEAN", () => {
  const sandbox = new QuerySandbox();

  assertEquals(sandbox.coerceResult("true", DataType.BOOLEAN), true);
  assertEquals(sandbox.coerceResult("false", DataType.BOOLEAN), false);
  assertEquals(sandbox.coerceResult("1", DataType.BOOLEAN), true);
  assertEquals(sandbox.coerceResult(1, DataType.BOOLEAN), true);
  assertEquals(sandbox.coerceResult(0, DataType.BOOLEAN), false);

  sandbox.destroy();
});

Deno.test("QuerySandbox - coerceResult ARRAY", () => {
  const sandbox = new QuerySandbox();

  assertEquals(sandbox.coerceResult([1, 2, 3], DataType.ARRAY), [1, 2, 3]);
  assertEquals(sandbox.coerceResult("single", DataType.ARRAY), ["single"]);

  sandbox.destroy();
});

Deno.test("QuerySandbox - coerceResult OBJECT", () => {
  const sandbox = new QuerySandbox();

  assertEquals(sandbox.coerceResult({ a: 1 }, DataType.OBJECT), { a: 1 });
  assertEquals(sandbox.coerceResult("primitive", DataType.OBJECT), {
    value: "primitive",
  });

  sandbox.destroy();
});

Deno.test("QuerySandbox - coerceResult NULL", () => {
  const sandbox = new QuerySandbox();

  assertEquals(sandbox.coerceResult("anything", DataType.NULL), null);
  assertEquals(sandbox.coerceResult(123, DataType.NULL), null);

  sandbox.destroy();
});

Deno.test("QuerySandbox - config update", () => {
  const sandbox = new QuerySandbox({ timeout: 1000 });
  assertEquals(sandbox.getConfig().timeout, 1000);

  sandbox.updateConfig({ timeout: 5000 });
  assertEquals(sandbox.getConfig().timeout, 5000);

  sandbox.destroy();
});

Deno.test("QuerySandbox - destroy cleans up workers", async () => {
  const sandbox = new QuerySandbox({ workerPoolSize: 2, timeout: 5000 });
  const context: SandboxContext = {
    globals: {},
    apis: {},
  };

  // Create workers by executing
  await sandbox.execute<number>("return 1", context);

  // Verify workers exist
  const statsBefore = sandbox.getPoolStats();
  assert(statsBefore.totalWorkers > 0);

  // Destroy
  sandbox.destroy();

  // Verify cleanup
  const statsAfter = sandbox.getPoolStats();
  assertEquals(statsAfter.totalWorkers, 0);
  assertEquals(statsAfter.pendingRequests, 0);
});

Deno.test("QuerySandbox - unsandboxed execution (disabled sandbox)", async () => {
  const sandbox = new QuerySandbox({
    enabled: false,
    timeout: 5000,
    environment: "development",
    allowUnsandboxedExecution: "I_UNDERSTAND_THE_SECURITY_RISKS",
  });
  const context: SandboxContext = {
    globals: { value: 42 },
    apis: {},
  };

  // This should work but log a warning (requires explicit acknowledgment)
  const result = await sandbox.execute<number>("return value * 2", context);
  assertEquals(result, 84);

  sandbox.destroy();
});

Deno.test("QuerySandbox - unsandboxed execution blocked without acknowledgment", async () => {
  const sandbox = new QuerySandbox({
    enabled: false,
    timeout: 5000,
    environment: "development",
    // Missing: allowUnsandboxedExecution
  });
  const context: SandboxContext = {
    globals: { value: 42 },
    apis: {},
  };

  // This should throw because acknowledgment is missing
  await assertRejects(
    async () => {
      await sandbox.execute<number>("return value * 2", context);
    },
    Error,
    "SECURITY ERROR: Unsandboxed code execution requires explicit acknowledgment",
  );

  sandbox.destroy();
});

Deno.test("QuerySandbox - unsandboxed execution blocked in production", async () => {
  const sandbox = new QuerySandbox({
    enabled: false,
    timeout: 5000,
    environment: "production",
    allowUnsandboxedExecution: "I_UNDERSTAND_THE_SECURITY_RISKS",
  });
  const context: SandboxContext = {
    globals: { value: 42 },
    apis: {},
  };

  // This should throw even with acknowledgment because environment is production
  await assertRejects(
    async () => {
      await sandbox.execute<number>("return value * 2", context);
    },
    Error,
    "SECURITY ERROR: Unsandboxed code execution is BLOCKED in production",
  );

  sandbox.destroy();
});

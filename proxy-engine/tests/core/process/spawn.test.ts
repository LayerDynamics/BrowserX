/**
 * ProcessSpawn Tests
 * Comprehensive tests for process spawning utilities
 */

import { assertEquals, assertExists, assert, assertRejects } from "@std/assert";
import {
  spawn,
  spawnAndWait,
  spawnWithStreaming,
  killProcess,
  waitForExit,
  isProcessRunning,
  exec,
  execShell,
  type ProcessConfig,
  type SpawnedProcess,
  type ProcessOutput,
} from "../../../core/process/spawn.ts";

// ============================================================================
// Helper Functions
// ============================================================================

function createEchoConfig(message: string): ProcessConfig {
  return {
    cmd: ["echo", message],
    stdout: "piped",
    stderr: "piped",
  };
}

function createSleepConfig(seconds: number): ProcessConfig {
  return {
    cmd: ["sleep", seconds.toString()],
  };
}

// ============================================================================
// spawn Tests
// ============================================================================

Deno.test({
  name: "spawn - spawns a simple process",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const config = createEchoConfig("hello");
    const process = await spawn(config);

    assertExists(process);
    assertExists(process.id);
    assertExists(process.child);
    assertExists(process.pid);
    assertExists(process.startedAt);
    assertExists(process.config);

    assertEquals(typeof process.pid, "number");
    assert(process.pid > 0);

    // Wait for process to complete to clean up
    await process.child.status;
  },
});

Deno.test({
  name: "spawn - process id follows expected format",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const config = createEchoConfig("test");
    const process = await spawn(config);

    // ID should be like "proc-{pid}-{timestamp}"
    assert(process.id.startsWith("proc-"));
    const parts = process.id.split("-");
    assertEquals(parts.length, 3);
    assertEquals(parts[0], "proc");
    assertEquals(parseInt(parts[1]), process.pid);

    await process.child.status;
  },
});

Deno.test({
  name: "spawn - sets startedAt to current time",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const before = new Date();
    const process = await spawn(createEchoConfig("time"));
    const after = new Date();

    assert(process.startedAt >= before);
    assert(process.startedAt <= after);

    await process.child.status;
  },
});

Deno.test({
  name: "spawn - preserves config in spawned process",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const config: ProcessConfig = {
      cmd: ["echo", "config-test"],
      stdout: "piped",
      stderr: "piped",
    };
    const process = await spawn(config);

    assertEquals(process.config.cmd, config.cmd);
    assertEquals(process.config.stdout, config.stdout);
    assertEquals(process.config.stderr, config.stderr);

    await process.child.status;
  },
});

// ============================================================================
// spawnAndWait Tests
// ============================================================================

Deno.test({
  name: "spawnAndWait - waits for process completion and returns output",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const config = createEchoConfig("hello world");
    const output = await spawnAndWait(config);

    assertExists(output);
    assertEquals(output.success, true);
    assertEquals(output.code, 0);
    assertEquals(output.signal, null);

    const decoder = new TextDecoder();
    const stdout = decoder.decode(output.stdout).trim();
    assertEquals(stdout, "hello world");
  },
});

Deno.test({
  name: "spawnAndWait - captures stderr",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    // Use a command that writes to stderr
    const output = await spawnAndWait({
      cmd: ["sh", "-c", "echo error >&2"],
      stdout: "piped",
      stderr: "piped",
    });

    const decoder = new TextDecoder();
    const stderr = decoder.decode(output.stderr).trim();
    assertEquals(stderr, "error");
  },
});

Deno.test({
  name: "spawnAndWait - returns non-zero exit code for failed command",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const output = await spawnAndWait({
      cmd: ["sh", "-c", "exit 42"],
    });

    assertEquals(output.success, false);
    assertEquals(output.code, 42);
  },
});

// ============================================================================
// spawnWithStreaming Tests
// ============================================================================

Deno.test({
  name: "spawnWithStreaming - streams stdout chunks",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const chunks: Uint8Array[] = [];

    const output = await spawnWithStreaming(
      createEchoConfig("streaming test"),
      (chunk) => chunks.push(chunk),
    );

    assertEquals(output.success, true);
    assert(chunks.length > 0);

    // Verify all chunks combined equal final stdout
    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
    assertEquals(totalLength, output.stdout.length);
  },
});

Deno.test({
  name: "spawnWithStreaming - streams stderr chunks",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const stderrChunks: Uint8Array[] = [];

    const output = await spawnWithStreaming(
      {
        cmd: ["sh", "-c", "echo stderr-test >&2"],
      },
      undefined,
      (chunk) => stderrChunks.push(chunk),
    );

    assertEquals(output.success, true);
    assert(stderrChunks.length > 0);
  },
});

Deno.test({
  name: "spawnWithStreaming - works without callbacks",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const output = await spawnWithStreaming(createEchoConfig("no callbacks"));

    assertEquals(output.success, true);

    const decoder = new TextDecoder();
    assertEquals(decoder.decode(output.stdout).trim(), "no callbacks");
  },
});

// ============================================================================
// killProcess Tests
// ============================================================================

Deno.test({
  name: "killProcess - terminates running process",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    // Start a long-running process
    const process = await spawn(createSleepConfig(60));

    // Verify it's running
    assert(isProcessRunning(process.pid));

    // Kill it
    killProcess(process);

    // Wait a bit for termination
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Should no longer be running
    assertEquals(isProcessRunning(process.pid), false);
  },
});

Deno.test({
  name: "killProcess - handles already exited process gracefully",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const process = await spawn(createEchoConfig("quick"));

    // Wait for it to exit naturally
    await process.child.status;

    // Should not throw when killing already-exited process
    killProcess(process);
    // No assertion needed - just verify no exception thrown
  },
});

Deno.test({
  name: "killProcess - can use different signals",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const process = await spawn(createSleepConfig(60));

    // Kill with SIGKILL
    killProcess(process, "SIGKILL");

    await new Promise((resolve) => setTimeout(resolve, 100));
    assertEquals(isProcessRunning(process.pid), false);
  },
});

// ============================================================================
// waitForExit Tests
// ============================================================================

Deno.test({
  name: "waitForExit - returns exit info when process completes",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const process = await spawn(createEchoConfig("wait test"));

    const exit = await waitForExit(process, 5000);

    assertExists(exit);
    assertEquals(exit.pid, process.pid);
    assertEquals(exit.success, true);
    assertEquals(exit.code, 0);
    assertEquals(exit.signal, null);
    assertExists(exit.exitedAt);
  },
});

Deno.test({
  name: "waitForExit - captures exit code",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const process = await spawn({
      cmd: ["sh", "-c", "exit 7"],
    });

    const exit = await waitForExit(process, 5000);

    assertEquals(exit.success, false);
    assertEquals(exit.code, 7);
  },
});

Deno.test({
  name: "waitForExit - times out for long-running process",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const process = await spawn(createSleepConfig(60));

    await assertRejects(
      async () => {
        await waitForExit(process, 100); // 100ms timeout
      },
      Error,
      "did not exit",
    );

    // Process should have been killed after timeout
    await new Promise((resolve) => setTimeout(resolve, 100));
    assertEquals(isProcessRunning(process.pid), false);
  },
});

// ============================================================================
// isProcessRunning Tests
// ============================================================================

Deno.test({
  name: "isProcessRunning - returns true for running process",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const process = await spawn(createSleepConfig(60));

    assertEquals(isProcessRunning(process.pid), true);

    killProcess(process);
    await new Promise((resolve) => setTimeout(resolve, 100));
  },
});

Deno.test({
  name: "isProcessRunning - returns false for non-existent process",
  fn() {
    // Use a very high PID that shouldn't exist
    assertEquals(isProcessRunning(999999), false);
  },
});

Deno.test({
  name: "isProcessRunning - returns false after process exits",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const process = await spawn(createEchoConfig("quick"));

    // Wait for process to complete
    await process.child.status;

    assertEquals(isProcessRunning(process.pid), false);
  },
});

// ============================================================================
// exec Tests
// ============================================================================

Deno.test({
  name: "exec - executes command and returns string output",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const result = await exec(["echo", "exec test"]);

    assertEquals(result.success, true);
    assertEquals(result.code, 0);
    assertEquals(result.stdout.trim(), "exec test");
    assertEquals(result.stderr, "");
  },
});

Deno.test({
  name: "exec - captures stderr as string",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const result = await exec(["sh", "-c", "echo stderr-message >&2"]);

    assertEquals(result.stderr.trim(), "stderr-message");
  },
});

Deno.test({
  name: "exec - returns exit code for failed commands",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const result = await exec(["sh", "-c", "exit 123"]);

    assertEquals(result.success, false);
    assertEquals(result.code, 123);
  },
});

Deno.test({
  name: "exec - accepts options",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const result = await exec(["pwd"], { cwd: "/tmp" });

    assertEquals(result.success, true);
    // On macOS, /tmp is often a symlink to /private/tmp
    assert(
      result.stdout.trim() === "/tmp" ||
        result.stdout.trim() === "/private/tmp",
    );
  },
});

// ============================================================================
// execShell Tests
// ============================================================================

Deno.test({
  name: "execShell - executes shell command",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const result = await execShell('echo "shell test"');

    assertEquals(result.success, true);
    assertEquals(result.stdout.trim(), "shell test");
  },
});

Deno.test({
  name: "execShell - supports pipes",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const result = await execShell("echo hello | tr h H");

    assertEquals(result.success, true);
    assertEquals(result.stdout.trim(), "Hello");
  },
});

Deno.test({
  name: "execShell - supports command chaining",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const result = await execShell("echo one && echo two");

    assertEquals(result.success, true);
    assert(result.stdout.includes("one"));
    assert(result.stdout.includes("two"));
  },
});

Deno.test({
  name: "execShell - supports environment variables",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const result = await execShell("echo $HOME");

    assertEquals(result.success, true);
    assert(result.stdout.trim().length > 0);
  },
});

// ============================================================================
// ProcessConfig Tests
// ============================================================================

Deno.test({
  name: "ProcessConfig - supports cwd option",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const output = await spawnAndWait({
      cmd: ["pwd"],
      cwd: "/tmp",
      stdout: "piped",
    });

    const decoder = new TextDecoder();
    const pwd = decoder.decode(output.stdout).trim();

    // /tmp may be a symlink on macOS
    assert(pwd === "/tmp" || pwd === "/private/tmp");
  },
});

Deno.test({
  name: "ProcessConfig - supports env option",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const output = await spawnAndWait({
      cmd: ["sh", "-c", "echo $MY_TEST_VAR"],
      env: { MY_TEST_VAR: "custom_value" },
      stdout: "piped",
    });

    const decoder = new TextDecoder();
    assertEquals(decoder.decode(output.stdout).trim(), "custom_value");
  },
});

// ============================================================================
// ProcessOutput Tests
// ============================================================================

Deno.test({
  name: "ProcessOutput - has correct structure",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const output = await spawnAndWait(createEchoConfig("structure"));

    assertExists(output.stdout);
    assertExists(output.stderr);
    assert(typeof output.success === "boolean");
    assert(typeof output.code === "number");
    assert(output.signal === null || typeof output.signal === "string");

    assert(output.stdout instanceof Uint8Array);
    assert(output.stderr instanceof Uint8Array);
  },
});

// ============================================================================
// Edge Cases and Integration Tests
// ============================================================================

Deno.test({
  name: "spawn - multiple processes can run concurrently",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const processes: SpawnedProcess[] = [];

    for (let i = 0; i < 5; i++) {
      const process = await spawn(createEchoConfig(`process-${i}`));
      processes.push(process);
    }

    // All should have unique PIDs
    const pids = new Set(processes.map((p) => p.pid));
    assertEquals(pids.size, 5);

    // Wait for all to complete
    await Promise.all(processes.map((p) => p.child.status));
  },
});

Deno.test({
  name: "spawn - handles empty command output",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const output = await spawnAndWait({
      cmd: ["true"], // Returns 0 with no output
      stdout: "piped",
      stderr: "piped",
    });

    assertEquals(output.success, true);
    assertEquals(output.code, 0);
    assertEquals(output.stdout.length, 0);
    assertEquals(output.stderr.length, 0);
  },
});

Deno.test({
  name: "spawn - handles large output",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    // Generate a lot of output
    const output = await spawnAndWait({
      cmd: ["seq", "1", "10000"],
      stdout: "piped",
    });

    assertEquals(output.success, true);

    // Should have captured all numbers
    const decoder = new TextDecoder();
    const lines = decoder.decode(output.stdout).trim().split("\n");
    assertEquals(lines.length, 10000);
    assertEquals(lines[0], "1");
    assertEquals(lines[9999], "10000");
  },
});

Deno.test({
  name: "spawn - handles both stdout and stderr simultaneously",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const output = await spawnAndWait({
      cmd: ["sh", "-c", "echo stdout; echo stderr >&2"],
      stdout: "piped",
      stderr: "piped",
    });

    const decoder = new TextDecoder();
    assertEquals(decoder.decode(output.stdout).trim(), "stdout");
    assertEquals(decoder.decode(output.stderr).trim(), "stderr");
  },
});

Deno.test({
  name: "exec - handles multi-line output",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const result = await exec(["sh", "-c", "echo line1; echo line2; echo line3"]);

    assertEquals(result.success, true);
    const lines = result.stdout.trim().split("\n");
    assertEquals(lines.length, 3);
    assertEquals(lines[0], "line1");
    assertEquals(lines[1], "line2");
    assertEquals(lines[2], "line3");
  },
});

Deno.test({
  name: "spawn - process id contains pid",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const process = await spawn(createEchoConfig("id-test"));

    // The ID should contain the actual PID
    assert(process.id.includes(process.pid.toString()));

    await process.child.status;
  },
});

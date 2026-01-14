/**
 * Process Spawning
 *
 * Utilities for spawning and managing child processes
 */

import { type ProcessID } from "./pid.ts";

/**
 * Process configuration
 */
export interface ProcessConfig {
  cmd: string[];
  cwd?: string;
  env?: Record<string, string>;
  stdin?: "piped" | "inherit" | "null";
  stdout?: "piped" | "inherit" | "null";
  stderr?: "piped" | "inherit" | "null";
  uid?: number;
  gid?: number;
  clearEnv?: boolean;
}

/**
 * Spawned process information
 */
export interface SpawnedProcess {
  id: ProcessID;
  command: Deno.Command;
  child: Deno.ChildProcess;
  pid: number;
  startedAt: Date;
  config: ProcessConfig;
}

/**
 * Process exit information
 */
export interface ProcessExit {
  pid: number;
  code: number;
  success: boolean;
  signal: Deno.Signal | null;
  exitedAt: Date;
}

/**
 * Process output
 */
export interface ProcessOutput {
  stdout: Uint8Array;
  stderr: Uint8Array;
  success: boolean;
  code: number;
  signal: Deno.Signal | null;
}

/**
 * Spawn a child process
 */
export async function spawn(config: ProcessConfig): Promise<SpawnedProcess> {
  const command = new Deno.Command(config.cmd[0], {
    args: config.cmd.slice(1),
    cwd: config.cwd,
    env: config.env,
    stdin: config.stdin || "null",
    stdout: config.stdout || "piped",
    stderr: config.stderr || "piped",
    uid: config.uid,
    gid: config.gid,
    clearEnv: config.clearEnv,
  });

  const child = command.spawn();
  const pid = child.pid;

  const processId = `proc-${pid}-${Date.now()}`;

  return {
    id: processId as ProcessID,
    command,
    child,
    pid,
    startedAt: new Date(),
    config,
  };
}

/**
 * Spawn and wait for process to complete
 */
export async function spawnAndWait(config: ProcessConfig): Promise<ProcessOutput> {
  const spawned = await spawn(config);

  const status = await spawned.child.status;

  let stdout = new Uint8Array(0);
  let stderr = new Uint8Array(0);

  if (spawned.child.stdout) {
    stdout = new Uint8Array(await readAll(spawned.child.stdout));
  }

  if (spawned.child.stderr) {
    stderr = new Uint8Array(await readAll(spawned.child.stderr));
  }

  return {
    stdout,
    stderr,
    success: status.success,
    code: status.code,
    signal: status.signal || null,
  };
}

/**
 * Spawn and stream output
 */
export async function spawnWithStreaming(
  config: ProcessConfig,
  onStdout?: (chunk: Uint8Array) => void,
  onStderr?: (chunk: Uint8Array) => void,
): Promise<ProcessOutput> {
  const spawned = await spawn({
    ...config,
    stdout: "piped",
    stderr: "piped",
  });

  const stdoutChunks: Uint8Array[] = [];
  const stderrChunks: Uint8Array[] = [];

  // Stream stdout
  const stdoutPromise = (async () => {
    if (!spawned.child.stdout) return;
    for await (const chunk of spawned.child.stdout) {
      stdoutChunks.push(chunk);
      if (onStdout) {
        onStdout(chunk);
      }
    }
  })();

  // Stream stderr
  const stderrPromise = (async () => {
    if (!spawned.child.stderr) return;
    for await (const chunk of spawned.child.stderr) {
      stderrChunks.push(chunk);
      if (onStderr) {
        onStderr(chunk);
      }
    }
  })();

  // Wait for process and streams
  const [status] = await Promise.all([
    spawned.child.status,
    stdoutPromise,
    stderrPromise,
  ]);

  // Concatenate chunks
  const stdout = concatenate(stdoutChunks);
  const stderr = concatenate(stderrChunks);

  return {
    stdout,
    stderr,
    success: status.success,
    code: status.code,
    signal: status.signal || null,
  };
}

/**
 * Kill a process
 */
export function killProcess(process: SpawnedProcess, signal: Deno.Signal = "SIGTERM"): void {
  try {
    process.child.kill(signal);
  } catch (_error) {
    // Process may have already exited
  }
}

/**
 * Wait for process to exit with timeout
 */
export async function waitForExit(
  process: SpawnedProcess,
  timeoutMs: number = 30000,
): Promise<ProcessExit> {
  const startTime = Date.now();

  const statusPromise = process.child.status;
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("Process exit timeout")), timeoutMs);
  });

  try {
    const status = await Promise.race([statusPromise, timeoutPromise]);

    return {
      pid: process.pid,
      code: status.code,
      success: status.success,
      signal: status.signal || null,
      exitedAt: new Date(),
    };
  } catch (error) {
    // Timeout - kill process
    killProcess(process, "SIGKILL");

    const elapsed = Date.now() - startTime;
    throw new Error(`Process ${process.pid} did not exit after ${elapsed}ms`);
  }
}

/**
 * Check if process is running
 */
export function isProcessRunning(pid: number): boolean {
  try {
    Deno.kill(pid, "SIGCONT"); // Non-destructive signal
    return true;
  } catch (_error) {
    return false;
  }
}

/**
 * Read all bytes from a reader
 */
async function readAll(reader: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];

  for await (const chunk of reader) {
    chunks.push(chunk);
  }

  return concatenate(chunks);
}

/**
 * Concatenate byte arrays
 */
function concatenate(arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);

  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }

  return result;
}

/**
 * Execute command and get output as string
 */
export async function exec(cmd: string[], options?: Partial<ProcessConfig>): Promise<{
  stdout: string;
  stderr: string;
  success: boolean;
  code: number;
}> {
  const config: ProcessConfig = {
    cmd,
    ...options,
    stdout: "piped",
    stderr: "piped",
  };

  const output = await spawnAndWait(config);
  const decoder = new TextDecoder();

  return {
    stdout: decoder.decode(output.stdout),
    stderr: decoder.decode(output.stderr),
    success: output.success,
    code: output.code,
  };
}

/**
 * Execute command with shell
 */
export async function execShell(command: string, options?: Partial<ProcessConfig>): Promise<{
  stdout: string;
  stderr: string;
  success: boolean;
  code: number;
}> {
  const shell = Deno.build.os === "windows" ? "cmd" : "sh";
  const shellArg = Deno.build.os === "windows" ? "/c" : "-c";

  return await exec([shell, shellArg, command], options);
}

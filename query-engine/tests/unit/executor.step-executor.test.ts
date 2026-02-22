/**
 * StepExecutor Tests
 */

import { assertEquals, assert, assertRejects } from "@std/assert";
import { StepExecutor } from "../../executor/step-executor.ts";
import { ExecutionContext } from "../../executor/execution-context.ts";

function makeStep(id: string, type: string, result: unknown) {
  return { id, type, execute: async (_ctx: ExecutionContext) => result };
}

function makeFailStep(id: string, msg: string) {
  return { id, type: "fail", execute: async (_ctx: ExecutionContext) => { throw new Error(msg); } };
}

Deno.test("StepExecutor - constructor", () => {
  assert(new StepExecutor() instanceof StepExecutor);
});

Deno.test("StepExecutor - executeStep returns result", async () => {
  const exec = new StepExecutor();
  const ctx = new ExecutionContext();
  const result = await exec.executeStep(makeStep("s1", "test", 42), ctx);
  assertEquals(result, 42);
});

Deno.test("StepExecutor - executeStep wraps errors", async () => {
  const exec = new StepExecutor();
  const ctx = new ExecutionContext();
  await assertRejects(() => exec.executeStep(makeFailStep("s1", "boom"), ctx), Error, "Step execution failed: boom");
});

Deno.test("StepExecutor - executeSteps sequential", async () => {
  const exec = new StepExecutor();
  const ctx = new ExecutionContext();
  const results = await exec.executeSteps([makeStep("s1", "t", "a"), makeStep("s2", "t", "b")], ctx);
  assertEquals(results, ["a", "b"]);
});

Deno.test("StepExecutor - executeSteps empty array", async () => {
  const exec = new StepExecutor();
  const ctx = new ExecutionContext();
  const results = await exec.executeSteps([], ctx);
  assertEquals(results, []);
});

Deno.test("StepExecutor - executeStepsParallel", async () => {
  const exec = new StepExecutor();
  const ctx = new ExecutionContext();
  const results = await exec.executeStepsParallel([makeStep("s1", "t", 1), makeStep("s2", "t", 2)], ctx);
  assertEquals(results, [1, 2]);
});

Deno.test("StepExecutor - executeStepsParallel empty array", async () => {
  const exec = new StepExecutor();
  const ctx = new ExecutionContext();
  const results = await exec.executeStepsParallel([], ctx);
  assertEquals(results, []);
});

Deno.test("StepExecutor - executeStep with null result", async () => {
  const exec = new StepExecutor();
  const ctx = new ExecutionContext();
  const result = await exec.executeStep(makeStep("s1", "t", null), ctx);
  assertEquals(result, null);
});

Deno.test("StepExecutor - executeStep with undefined result", async () => {
  const exec = new StepExecutor();
  const ctx = new ExecutionContext();
  const result = await exec.executeStep(makeStep("s1", "t", undefined), ctx);
  assertEquals(result, undefined);
});

Deno.test("StepExecutor - executeSteps stops on error", async () => {
  const exec = new StepExecutor();
  const ctx = new ExecutionContext();
  await assertRejects(() => exec.executeSteps([makeStep("s1", "t", "ok"), makeFailStep("s2", "fail")], ctx), Error);
});

Deno.test("StepExecutor - executeStepsParallel rejects on any error", async () => {
  const exec = new StepExecutor();
  const ctx = new ExecutionContext();
  await assertRejects(() => exec.executeStepsParallel([makeStep("s1", "t", "ok"), makeFailStep("s2", "fail")], ctx), Error);
});

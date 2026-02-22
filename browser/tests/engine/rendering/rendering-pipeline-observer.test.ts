import { assert, assertEquals } from "@std/assert";
import { RenderingPipeline } from "../../../src/engine/RenderingPipeline.ts";
import type { PipelineObserver, PipelineStageEvent } from "../../../src/engine/PipelineObserver.ts";

const sanitize = { sanitizeOps: false, sanitizeResources: false };

Deno.test({
  name: "PipelineObserver receives all stage events for about:blank render",
  ...sanitize,
  fn: async () => {
    const events: PipelineStageEvent[] = [];

    const observer: PipelineObserver = {
      onStage(event: PipelineStageEvent): void {
        events.push(event);
      },
    };

    const pipeline = new RenderingPipeline();
    pipeline.setObserver(observer);

    await pipeline.render("about:blank");
    await pipeline.close();

    // 9 stages x 2 events each (running + completed) = 18 events
    assertEquals(
      events.length,
      18,
      `Expected 18 events but got ${events.length}: ${
        events.map((e) => `${e.stageId}:${e.status}`).join(", ")
      }`,
    );

    // Verify all events have pipeline = "rendering"
    for (const event of events) {
      assertEquals(event.pipeline, "rendering");
    }

    // Expected stage order
    const expectedStages = [
      "html-fetch",
      "html-parse",
      "css-fetch",
      "css-parse",
      "script-execution",
      "style-resolution",
      "layout",
      "paint",
      "composite",
    ];

    // Verify running/completed pairs in order
    for (let i = 0; i < expectedStages.length; i++) {
      const runningEvent = events[i * 2];
      const completedEvent = events[i * 2 + 1];

      assertEquals(runningEvent.stageId, expectedStages[i], `Running event ${i} stageId mismatch`);
      assertEquals(runningEvent.status, "running", `Event ${i * 2} should be running`);

      assertEquals(
        completedEvent.stageId,
        expectedStages[i],
        `Completed event ${i} stageId mismatch`,
      );
      assertEquals(completedEvent.status, "completed", `Event ${i * 2 + 1} should be completed`);

      assert(
        completedEvent.endTime !== undefined,
        `Completed event ${expectedStages[i]} missing endTime`,
      );
      assert(
        completedEvent.duration !== undefined,
        `Completed event ${expectedStages[i]} missing duration`,
      );
    }
  },
});

Deno.test({
  name: "PipelineObserver completed events carry artifacts",
  ...sanitize,
  fn: async () => {
    const events: PipelineStageEvent[] = [];

    const observer: PipelineObserver = {
      onStage(event: PipelineStageEvent): void {
        events.push(event);
      },
    };

    const pipeline = new RenderingPipeline();
    pipeline.setObserver(observer);

    await pipeline.render("about:blank");
    await pipeline.close();

    const completed = events.filter((e) => e.status === "completed");

    const htmlFetch = completed.find((e) => e.stageId === "html-fetch");
    assert(htmlFetch?.artifact !== undefined, "html-fetch should have artifact");

    const htmlParse = completed.find((e) => e.stageId === "html-parse");
    assert(htmlParse?.artifact !== undefined, "html-parse should have artifact");

    const cssParse = completed.find((e) => e.stageId === "css-parse");
    assert(cssParse?.artifact !== undefined, "css-parse should have artifact");
  },
});

Deno.test({
  name: "PipelineObserver not set does not throw",
  ...sanitize,
  fn: async () => {
    const pipeline = new RenderingPipeline();
    await pipeline.render("about:blank");
    await pipeline.close();
  },
});

Deno.test({
  name: "getLastRenderArtifacts returns artifacts after render",
  ...sanitize,
  fn: async () => {
    const pipeline = new RenderingPipeline();

    assertEquals(pipeline.getLastRenderArtifacts(), undefined, "Should be undefined before render");

    await pipeline.render("about:blank");

    const artifacts = pipeline.getLastRenderArtifacts();
    assert(artifacts !== undefined, "Should have artifacts after render");
    assert(artifacts!.dom !== undefined, "Should have dom");
    assert(artifacts!.cssom !== undefined, "Should have cssom");
    assert(artifacts!.renderTree !== undefined, "Should have renderTree");
    assert(artifacts!.layoutTree !== undefined, "Should have layoutTree");
    assert(artifacts!.displayList !== undefined, "Should have displayList");

    await pipeline.close();
  },
});

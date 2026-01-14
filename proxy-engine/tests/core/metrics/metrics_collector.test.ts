/**
 * MetricsCollector Tests
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import * as mod from "../../../core/metrics/metrics_collector.ts";

Deno.test({
  name: "MetricsCollector - module exports",
  fn() {
    assertExists(mod);
  },
});

/**
 * Metrics Tests
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import * as mod from "../../../core/metrics/metrics.ts";

Deno.test({
  name: "Metrics - module exports",
  fn() {
    assertExists(mod);
  },
});

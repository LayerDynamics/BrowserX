/**
 * Tracing Tests
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import * as mod from "../../../core/metrics/tracing.ts";

Deno.test({
  name: "Tracing - module exports",
  fn() {
    assertExists(mod);
  },
});

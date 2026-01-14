/**
 * ExecutorMod Tests
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import * as mod from "../../executor/mod.ts";

Deno.test({
  name: "ExecutorMod - module exports",
  fn() {
    assertExists(mod);
  },
});

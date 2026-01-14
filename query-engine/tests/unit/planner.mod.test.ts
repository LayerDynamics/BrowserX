/**
 * PlannerMod Tests
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import * as mod from "../../planner/mod.ts";

Deno.test({
  name: "PlannerMod - module exports",
  fn() {
    assertExists(mod);
  },
});

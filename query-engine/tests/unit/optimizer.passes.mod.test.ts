/**
 * OptimizerPassesMod Tests
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import * as mod from "../../optimizer/passes/mod.ts";

Deno.test({
  name: "OptimizerPassesMod - module exports",
  fn() {
    assertExists(mod);
  },
});

/**
 * OptimizerMod Tests
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import * as mod from "../../optimizer/mod.ts";

Deno.test({
  name: "OptimizerMod - module exports",
  fn() {
    assertExists(mod);
  },
});

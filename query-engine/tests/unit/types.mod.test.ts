/**
 * TypesMod Tests
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import * as mod from "../../types/mod.ts";

Deno.test({
  name: "TypesMod - module exports",
  fn() {
    assertExists(mod);
  },
});

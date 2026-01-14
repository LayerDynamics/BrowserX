/**
 * PrimitiveMod Tests
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import * as mod from "../../../../core/network/primitive/mod.ts";

Deno.test({
  name: "PrimitiveMod - module exports",
  fn() {
    assertExists(mod);
  },
});

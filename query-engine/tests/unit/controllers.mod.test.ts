/**
 * ControllersMod Tests
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import * as mod from "../../controllers/mod.ts";

Deno.test({
  name: "ControllersMod - module exports",
  fn() {
    assertExists(mod);
  },
});

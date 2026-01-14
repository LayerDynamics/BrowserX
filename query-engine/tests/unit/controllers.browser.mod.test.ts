/**
 * BrowserControllerMod Tests
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import * as mod from "../../controllers/browser/mod.ts";

Deno.test({
  name: "BrowserControllerMod - module exports",
  fn() {
    assertExists(mod);
  },
});

/**
 * ProxyControllerMod Tests
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import * as mod from "../../controllers/proxy/mod.ts";

Deno.test({
  name: "ProxyControllerMod - module exports",
  fn() {
    assertExists(mod);
  },
});

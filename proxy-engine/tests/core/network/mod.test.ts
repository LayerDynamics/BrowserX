/**
 * NetworkMod Tests
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import * as mod from "../../../core/network/mod.ts";

Deno.test({
  name: "NetworkMod - module exports",
  fn() {
    assertExists(mod);
  },
});

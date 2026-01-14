/**
 * TransportMod Tests
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import * as mod from "../../../../core/network/transport/mod.ts";

Deno.test({
  name: "TransportMod - module exports",
  fn() {
    assertExists(mod);
  },
});

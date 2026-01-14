/**
 * TCPMod Tests
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import * as mod from "../../../../../core/network/transport/tcp/mod.ts";

Deno.test({
  name: "TCPMod - module exports",
  fn() {
    assertExists(mod);
  },
});

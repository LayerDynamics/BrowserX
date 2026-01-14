/**
 * SocketMod Tests
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import * as mod from "../../../../../core/network/transport/socket/mod.ts";

Deno.test({
  name: "SocketMod - module exports",
  fn() {
    assertExists(mod);
  },
});

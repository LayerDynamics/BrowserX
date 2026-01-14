/**
 * TLSMod Tests
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import * as mod from "../../../../../core/network/transport/tls/mod.ts";

Deno.test({
  name: "TLSMod - module exports",
  fn() {
    assertExists(mod);
  },
});

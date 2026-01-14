/**
 * HTTPMod Tests
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import * as mod from "../../../../../core/network/transport/http/mod.ts";

Deno.test({
  name: "HTTPMod - module exports",
  fn() {
    assertExists(mod);
  },
});

/**
 * ConnectionPool Tests
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import * as mod from "../../../core/connection/connection_pool.ts";

Deno.test({
  name: "ConnectionPool - module exports",
  fn() {
    assertExists(mod);
  },
});

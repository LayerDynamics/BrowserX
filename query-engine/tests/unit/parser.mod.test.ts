/**
 * ParserMod Tests
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import * as mod from "../../parser/mod.ts";

Deno.test({
  name: "ParserMod - module exports",
  fn() {
    assertExists(mod);
  },
});

/**
 * FormatterMod Tests
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import * as mod from "../../formatter/mod.ts";

Deno.test({
  name: "FormatterMod - module exports",
  fn() {
    assertExists(mod);
  },
});

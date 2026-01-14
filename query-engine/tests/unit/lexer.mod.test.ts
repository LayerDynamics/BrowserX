/**
 * LexerMod Tests
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import * as mod from "../../lexer/mod.ts";

Deno.test({
  name: "LexerMod - module exports",
  fn() {
    assertExists(mod);
  },
});

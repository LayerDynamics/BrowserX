/**
 * AnalyzerMod Tests
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import * as mod from "../../analyzer/mod.ts";

Deno.test({
  name: "AnalyzerMod - module exports",
  fn() {
    assertExists(mod);
  },
});

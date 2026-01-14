/**
 * Event Tests
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import * as mod from "../../../core/event/event.ts";

Deno.test({
  name: "Event - module exports",
  fn() {
    assertExists(mod);
  },
});

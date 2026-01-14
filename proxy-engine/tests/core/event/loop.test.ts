/**
 * EventLoop Tests
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import * as mod from "../../../core/event/loop.ts";

Deno.test({
  name: "EventLoop - module exports",
  fn() {
    assertExists(mod);
  },
});

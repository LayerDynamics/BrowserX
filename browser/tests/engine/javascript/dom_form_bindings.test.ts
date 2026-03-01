/**
 * Tests for form element DOM bindings
 * Verifies HTMLInputElement, HTMLSelectElement, HTMLTextAreaElement,
 * HTMLFormElement, and HTMLButtonElement property bindings.
 */

import { assertEquals, assertExists } from "@std/assert";
import { DOMBindings } from "../../../src/engine/javascript/DOMBindings.ts";
import { V8Context } from "../../../src/engine/javascript/V8Context.ts";
import {
  getProperty,
  setProperty,
  isBoolean,
  isFunction,
  isString,
  createBoolean,
  createString,
  toString,
  type JSValue,
} from "../../../src/engine/javascript/JSValue.ts";
import { DOMNodeType } from "../../../src/types/dom.ts";
import type { DOMElement, DOMNode } from "../../../src/types/dom.ts";

// Helper to create a V8Context and DOMBindings
function setup() {
  const context = new V8Context();
  const bindings = new DOMBindings(context);
  bindings.install();
  return { context, bindings };
}

// Helper to create an element with attributes and wrap it
function createAndWrap(
  bindings: DOMBindings,
  tagName: string,
  attrs: Record<string, string> = {},
  children: DOMNode[] = [],
): JSValue {
  const el = bindings.createElementNative(tagName);
  const synth = el as unknown as { setAttribute(n: string, v: string): void };
  for (const [k, v] of Object.entries(attrs)) {
    synth.setAttribute(k, v);
  }
  for (const child of children) {
    bindings.appendChildNative(el, child);
  }
  return bindings.wrapNodeAsJSValue(el);
}

// =========================================================================
// HTMLInputElement
// =========================================================================

Deno.test("input: value getter reads from attribute", () => {
  const { bindings } = setup();
  const input = createAndWrap(bindings, "input", { value: "hello" });
  const val = getProperty(input, "value");
  assertEquals(val.type, "string");
  assertEquals((val as { value: string }).value, "hello");
});

Deno.test("input: value setter overrides attribute (programmatic)", () => {
  const { bindings } = setup();
  const input = createAndWrap(bindings, "input", { value: "initial" });
  setProperty(input, "value", createString("updated"));
  const val = getProperty(input, "value");
  assertEquals((val as { value: string }).value, "updated");
});

Deno.test("input: value defaults to empty string", () => {
  const { bindings } = setup();
  const input = createAndWrap(bindings, "input");
  const val = getProperty(input, "value");
  assertEquals((val as { value: string }).value, "");
});

Deno.test("input: type defaults to text", () => {
  const { bindings } = setup();
  const input = createAndWrap(bindings, "input");
  const type = getProperty(input, "type");
  assertEquals((type as { value: string }).value, "text");
});

Deno.test("input: type reads from attribute", () => {
  const { bindings } = setup();
  const input = createAndWrap(bindings, "input", { type: "password" });
  const type = getProperty(input, "type");
  assertEquals((type as { value: string }).value, "password");
});

Deno.test("input: checked getter/setter", () => {
  const { bindings } = setup();
  const input = createAndWrap(bindings, "input", { type: "checkbox", checked: "" });
  const checked = getProperty(input, "checked");
  assertEquals(checked.type, "boolean");
  assertEquals((checked as { value: boolean }).value, true);

  // Uncheck
  setProperty(input, "checked", createBoolean(false));
  const unchecked = getProperty(input, "checked");
  assertEquals((unchecked as { value: boolean }).value, false);
});

Deno.test("input: disabled getter/setter", () => {
  const { bindings } = setup();
  const input = createAndWrap(bindings, "input");
  const disabled = getProperty(input, "disabled");
  assertEquals((disabled as { value: boolean }).value, false);

  // Enable disabled
  setProperty(input, "disabled", createBoolean(true));
  const nowDisabled = getProperty(input, "disabled");
  assertEquals((nowDisabled as { value: boolean }).value, true);
});

Deno.test("input: name getter/setter", () => {
  const { bindings } = setup();
  const input = createAndWrap(bindings, "input", { name: "email" });
  const name = getProperty(input, "name");
  assertEquals((name as { value: string }).value, "email");
});

Deno.test("input: placeholder getter", () => {
  const { bindings } = setup();
  const input = createAndWrap(bindings, "input", { placeholder: "Enter email" });
  const ph = getProperty(input, "placeholder");
  assertEquals((ph as { value: string }).value, "Enter email");
});

Deno.test("input: readOnly getter/setter", () => {
  const { bindings } = setup();
  const input = createAndWrap(bindings, "input", { readonly: "" });
  const ro = getProperty(input, "readOnly");
  assertEquals((ro as { value: boolean }).value, true);
});

Deno.test("input: required getter", () => {
  const { bindings } = setup();
  const input = createAndWrap(bindings, "input", { required: "" });
  const req = getProperty(input, "required");
  assertEquals((req as { value: boolean }).value, true);
});

Deno.test("input: focus/blur/select are callable no-ops", () => {
  const { bindings } = setup();
  const input = createAndWrap(bindings, "input");
  const focus = getProperty(input, "focus");
  assertEquals(focus.type, "function");
  const blur = getProperty(input, "blur");
  assertEquals(blur.type, "function");
  const select = getProperty(input, "select");
  assertEquals(select.type, "function");
});

Deno.test("input: form getter returns null when not in form", () => {
  const { bindings } = setup();
  const input = createAndWrap(bindings, "input");
  const form = getProperty(input, "form");
  assertEquals(form.type, "null");
});

// =========================================================================
// HTMLSelectElement
// =========================================================================

Deno.test("select: value returns first option value by default", () => {
  const { bindings } = setup();
  const opt1 = bindings.createElementNative("option");
  (opt1 as unknown as { setAttribute(n: string, v: string): void }).setAttribute("value", "a");
  const opt2 = bindings.createElementNative("option");
  (opt2 as unknown as { setAttribute(n: string, v: string): void }).setAttribute("value", "b");
  const sel = createAndWrap(bindings, "select", {}, [opt1, opt2]);

  const value = getProperty(sel, "value");
  assertEquals((value as { value: string }).value, "a");
});

Deno.test("select: selectedIndex defaults to 0 when options exist", () => {
  const { bindings } = setup();
  const opt = bindings.createElementNative("option");
  (opt as unknown as { setAttribute(n: string, v: string): void }).setAttribute("value", "x");
  const sel = createAndWrap(bindings, "select", {}, [opt]);

  const idx = getProperty(sel, "selectedIndex");
  assertEquals((idx as { value: number }).value, 0);
});

Deno.test("select: selectedIndex is -1 with no options", () => {
  const { bindings } = setup();
  const sel = createAndWrap(bindings, "select");
  const idx = getProperty(sel, "selectedIndex");
  assertEquals((idx as { value: number }).value, -1);
});

Deno.test("select: value setter changes selectedIndex", () => {
  const { bindings } = setup();
  const opt1 = bindings.createElementNative("option");
  (opt1 as unknown as { setAttribute(n: string, v: string): void }).setAttribute("value", "a");
  const opt2 = bindings.createElementNative("option");
  (opt2 as unknown as { setAttribute(n: string, v: string): void }).setAttribute("value", "b");
  const sel = createAndWrap(bindings, "select", {}, [opt1, opt2]);

  // Set value to "b"
  setProperty(sel, "value", createString("b"));

  const idx = getProperty(sel, "selectedIndex");
  assertEquals((idx as { value: number }).value, 1);
});

Deno.test("select: options returns array-like", () => {
  const { bindings } = setup();
  const opt1 = bindings.createElementNative("option");
  const opt2 = bindings.createElementNative("option");
  const sel = createAndWrap(bindings, "select", {}, [opt1, opt2]);
  const options = getProperty(sel, "options");
  const len = getProperty(options, "length");
  assertEquals((len as { value: number }).value, 2);
});

Deno.test("select: name getter", () => {
  const { bindings } = setup();
  const sel = createAndWrap(bindings, "select", { name: "country" });
  const name = getProperty(sel, "name");
  assertEquals((name as { value: string }).value, "country");
});

// =========================================================================
// HTMLTextAreaElement
// =========================================================================

Deno.test("textarea: value from text content", () => {
  const { bindings } = setup();
  const textarea = bindings.createElementNative("textarea");
  const textNode = bindings.createTextNodeNative("Hello world");
  bindings.appendChildNative(textarea, textNode);
  const wrapped = bindings.wrapNodeAsJSValue(textarea);
  const val = getProperty(wrapped, "value");
  assertEquals((val as { value: string }).value, "Hello world");
});

Deno.test("textarea: value setter overrides text content", () => {
  const { bindings } = setup();
  const textarea = bindings.createElementNative("textarea");
  const textNode = bindings.createTextNodeNative("original");
  bindings.appendChildNative(textarea, textNode);
  const wrapped = bindings.wrapNodeAsJSValue(textarea);

  setProperty(wrapped, "value", createString("updated"));
  const val = getProperty(wrapped, "value");
  assertEquals((val as { value: string }).value, "updated");
});

Deno.test("textarea: rows/cols default values", () => {
  const { bindings } = setup();
  const wrapped = createAndWrap(bindings, "textarea");
  const rows = getProperty(wrapped, "rows");
  assertEquals((rows as { value: number }).value, 2);
  const cols = getProperty(wrapped, "cols");
  assertEquals((cols as { value: number }).value, 20);
});

Deno.test("textarea: rows/cols from attributes", () => {
  const { bindings } = setup();
  const wrapped = createAndWrap(bindings, "textarea", { rows: "10", cols: "50" });
  assertEquals((getProperty(wrapped, "rows") as { value: number }).value, 10);
  assertEquals((getProperty(wrapped, "cols") as { value: number }).value, 50);
});

Deno.test("textarea: disabled/readOnly/required", () => {
  const { bindings } = setup();
  const wrapped = createAndWrap(bindings, "textarea", { disabled: "", readonly: "", required: "" });
  assertEquals((getProperty(wrapped, "disabled") as { value: boolean }).value, true);
  assertEquals((getProperty(wrapped, "readOnly") as { value: boolean }).value, true);
  assertEquals((getProperty(wrapped, "required") as { value: boolean }).value, true);
});

// =========================================================================
// HTMLFormElement
// =========================================================================

Deno.test("form: method defaults to get", () => {
  const { bindings } = setup();
  const form = createAndWrap(bindings, "form");
  const method = getProperty(form, "method");
  assertEquals((method as { value: string }).value, "get");
});

Deno.test("form: method reads from attribute", () => {
  const { bindings } = setup();
  const form = createAndWrap(bindings, "form", { method: "POST" });
  const method = getProperty(form, "method");
  assertEquals((method as { value: string }).value, "post");
});

Deno.test("form: action getter/setter", () => {
  const { bindings } = setup();
  const form = createAndWrap(bindings, "form", { action: "/login" });
  assertEquals((getProperty(form, "action") as { value: string }).value, "/login");
});

Deno.test("form: elements returns descendant form controls", () => {
  const { bindings } = setup();
  const formEl = bindings.createElementNative("form");
  const input = bindings.createElementNative("input");
  const select = bindings.createElementNative("select");
  const button = bindings.createElementNative("button");
  bindings.appendChildNative(formEl, input);
  bindings.appendChildNative(formEl, select);
  bindings.appendChildNative(formEl, button);
  const wrapped = bindings.wrapNodeAsJSValue(formEl);

  const elements = getProperty(wrapped, "elements");
  const len = getProperty(elements, "length");
  assertEquals((len as { value: number }).value, 3);
});

Deno.test("form: length matches elements count", () => {
  const { bindings } = setup();
  const formEl = bindings.createElementNative("form");
  const input = bindings.createElementNative("input");
  bindings.appendChildNative(formEl, input);
  const wrapped = bindings.wrapNodeAsJSValue(formEl);
  const len = getProperty(wrapped, "length");
  assertEquals((len as { value: number }).value, 1);
});

Deno.test("form: submit() is callable", () => {
  const { bindings } = setup();
  const form = createAndWrap(bindings, "form");
  const submit = getProperty(form, "submit");
  assertEquals(submit.type, "function");
});

Deno.test("form: reset() is callable", () => {
  const { bindings } = setup();
  const form = createAndWrap(bindings, "form");
  const reset = getProperty(form, "reset");
  assertEquals(reset.type, "function");
});

Deno.test("form: submit() dispatches submit event", () => {
  const { bindings } = setup();
  const form = createAndWrap(bindings, "form");
  let eventFired = false;

  // Add event listener
  const addListener = getProperty(form, "addEventListener");
  if (isFunction(addListener) && addListener.value.nativeImpl) {
    const callback = {
      type: "function" as const,
      value: {
        name: "onSubmit",
        params: [],
        code: null,
        isNative: true,
        nativeImpl: (_evt: JSValue) => {
          eventFired = true;
          return { type: "undefined" as const, value: undefined };
        },
      },
      __getters: undefined,
      __setters: undefined,
    };
    addListener.value.nativeImpl(createString("submit"), callback);
  }

  // Call submit
  const submitFn = getProperty(form, "submit");
  if (isFunction(submitFn) && submitFn.value.nativeImpl) {
    submitFn.value.nativeImpl();
  }
  assertEquals(eventFired, true);
});

// =========================================================================
// HTMLButtonElement
// =========================================================================

Deno.test("button: type defaults to submit", () => {
  const { bindings } = setup();
  const btn = createAndWrap(bindings, "button");
  const type = getProperty(btn, "type");
  assertEquals((type as { value: string }).value, "submit");
});

Deno.test("button: type reads from attribute", () => {
  const { bindings } = setup();
  const btn = createAndWrap(bindings, "button", { type: "button" });
  assertEquals((getProperty(btn, "type") as { value: string }).value, "button");
});

Deno.test("button: disabled getter", () => {
  const { bindings } = setup();
  const btn = createAndWrap(bindings, "button", { disabled: "" });
  assertEquals((getProperty(btn, "disabled") as { value: boolean }).value, true);
});

Deno.test("button: name/value getters", () => {
  const { bindings } = setup();
  const btn = createAndWrap(bindings, "button", { name: "action", value: "delete" });
  assertEquals((getProperty(btn, "name") as { value: string }).value, "action");
  assertEquals((getProperty(btn, "value") as { value: string }).value, "delete");
});

Deno.test("button: form getter returns null without ancestor form", () => {
  const { bindings } = setup();
  const btn = createAndWrap(bindings, "button");
  assertEquals(getProperty(btn, "form").type, "null");
});

// =========================================================================
// form ancestor traversal
// =========================================================================

Deno.test("input inside form: form getter returns form element", () => {
  const { bindings } = setup();
  const formEl = bindings.createElementNative("form");
  (formEl as unknown as { setAttribute(n: string, v: string): void }).setAttribute("id", "myform");
  const inputEl = bindings.createElementNative("input");
  bindings.appendChildNative(formEl, inputEl);

  const wrappedInput = bindings.wrapNodeAsJSValue(inputEl);
  const form = getProperty(wrappedInput, "form");
  assertEquals(form.type, "object");
  const formTag = getProperty(form, "tagName");
  assertEquals((formTag as { value: string }).value, "FORM");
});

// =========================================================================
// Non-form elements are unaffected
// =========================================================================

Deno.test("div: no form bindings added", () => {
  const { bindings } = setup();
  const div = createAndWrap(bindings, "div");
  // value should not be defined as a getter
  const val = getProperty(div, "value");
  assertEquals(val.type, "undefined");
});

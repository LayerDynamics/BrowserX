/**
 * FormAutomation Unit Tests
 *
 * Tests for the FormAutomation API including field type mapping,
 * form scoring, file validation, MIME type inference, and auto-fill.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import {
  FormAutomation,
  FormFieldType,
  FormField,
  DetectedForm,
} from "../../src/api/FormAutomation.ts";
import { BrowserPage, DOMElement } from "../../src/api/BrowserPage.ts";

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Create a mock BrowserPage for testing
 */
function createMockPage(overrides: Partial<BrowserPage> = {}): BrowserPage {
  return {
    query: async (_selector: string) => [],
    click: async (_selector: string) => {},
    type: async (_selector: string, _text: string, _options?: { delay?: number }) => {},
    evaluate: async (_script: string) => ({}),
    getCurrentURL: () => "https://example.com",
    wait: async (_options: { type: string; selector?: string; timeout?: number }) => {},
    ...overrides,
  } as BrowserPage;
}

/**
 * Create a mock DOMElement
 */
function createMockElement(attributes: Record<string, string | null> = {}, properties: Record<string, unknown> = {}): DOMElement {
  return {
    getAttribute: async (name: string) => attributes[name] ?? null,
    getProperty: async (name: string) => properties[name] ?? null,
    getText: async () => properties.textContent as string || "",
  } as DOMElement;
}

/**
 * Type for accessing private methods in FormAutomation for testing
 * Uses `any` to bypass TypeScript's private member checks
 */
interface TestableFormAutomation {
  mapInputType: (inputType: string) => FormFieldType;
  scoreForm: (form: DetectedForm) => number;
  validateFileType: (mimeType: string, fileName: string, acceptAttr: string) => boolean;
  inferMimeType: (fileName: string) => string;
  inferFieldValue: (field: FormField, data: Record<string, string>) => string | undefined;
}

/**
 * Create a FormAutomation instance with access to private methods for testing
 */
function createTestableFormAutomation(page: BrowserPage): TestableFormAutomation {
  // deno-lint-ignore no-explicit-any
  return new FormAutomation(page) as any;
}

/**
 * Create a minimal FormField for testing
 */
function createTestField(overrides: Partial<FormField> = {}): FormField {
  return {
    name: "test",
    id: "test-id",
    type: "text",
    label: null,
    placeholder: null,
    required: false,
    disabled: false,
    readonly: false,
    value: "",
    pattern: null,
    min: null,
    max: null,
    step: null,
    options: [],
    selector: "#test",
    validationMessage: null,
    ...overrides,
  };
}

/**
 * Create a minimal DetectedForm for testing
 */
function createTestForm(overrides: Partial<DetectedForm> = {}): DetectedForm {
  return {
    id: null,
    name: null,
    action: "",
    method: "GET",
    enctype: "application/x-www-form-urlencoded",
    hasFileUpload: false,
    hasCaptcha: false,
    captchaType: null,
    fields: [],
    selector: "form",
    ...overrides,
  };
}

// ============================================================================
// mapInputType() Tests
// ============================================================================

Deno.test({
  name: "FormAutomation - mapInputType maps text input type",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);
    assertEquals(automation.mapInputType("text"), "text");
  },
});

Deno.test({
  name: "FormAutomation - mapInputType maps email input type",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);
    assertEquals(automation.mapInputType("email"), "email");
  },
});

Deno.test({
  name: "FormAutomation - mapInputType maps password input type",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);
    assertEquals(automation.mapInputType("password"), "password");
  },
});

Deno.test({
  name: "FormAutomation - mapInputType maps number input type",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);
    assertEquals(automation.mapInputType("number"), "number");
  },
});

Deno.test({
  name: "FormAutomation - mapInputType maps tel input type",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);
    assertEquals(automation.mapInputType("tel"), "tel");
  },
});

Deno.test({
  name: "FormAutomation - mapInputType maps url input type",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);
    assertEquals(automation.mapInputType("url"), "url");
  },
});

Deno.test({
  name: "FormAutomation - mapInputType maps search input type",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);
    assertEquals(automation.mapInputType("search"), "search");
  },
});

Deno.test({
  name: "FormAutomation - mapInputType maps date input type",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);
    assertEquals(automation.mapInputType("date"), "date");
  },
});

Deno.test({
  name: "FormAutomation - mapInputType maps datetime-local input type",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);
    assertEquals(automation.mapInputType("datetime-local"), "datetime-local");
  },
});

Deno.test({
  name: "FormAutomation - mapInputType maps time input type",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);
    assertEquals(automation.mapInputType("time"), "time");
  },
});

Deno.test({
  name: "FormAutomation - mapInputType maps month input type",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);
    assertEquals(automation.mapInputType("month"), "month");
  },
});

Deno.test({
  name: "FormAutomation - mapInputType maps week input type",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);
    assertEquals(automation.mapInputType("week"), "week");
  },
});

Deno.test({
  name: "FormAutomation - mapInputType maps color input type",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);
    assertEquals(automation.mapInputType("color"), "color");
  },
});

Deno.test({
  name: "FormAutomation - mapInputType maps checkbox input type",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);
    assertEquals(automation.mapInputType("checkbox"), "checkbox");
  },
});

Deno.test({
  name: "FormAutomation - mapInputType maps radio input type",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);
    assertEquals(automation.mapInputType("radio"), "radio");
  },
});

Deno.test({
  name: "FormAutomation - mapInputType maps file input type",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);
    assertEquals(automation.mapInputType("file"), "file");
  },
});

Deno.test({
  name: "FormAutomation - mapInputType maps hidden input type",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);
    assertEquals(automation.mapInputType("hidden"), "hidden");
  },
});

Deno.test({
  name: "FormAutomation - mapInputType returns unknown for unrecognized types",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);
    assertEquals(automation.mapInputType("custom"), "unknown");
    assertEquals(automation.mapInputType("nonexistent"), "unknown");
    assertEquals(automation.mapInputType(""), "unknown");
  },
});

// ============================================================================
// scoreForm() Tests
// ============================================================================

Deno.test({
  name: "FormAutomation - scoreForm gives base score for fields (10 per field)",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);

    const form = createTestForm({
      fields: [
        createTestField({ name: "field1", type: "text" }),
        createTestField({ name: "field2", type: "text" }),
        createTestField({ name: "field3", type: "text" }),
      ],
    });

    const score = automation.scoreForm(form);
    // 3 fields * 10 = 30
    assertEquals(score, 30);
  },
});

Deno.test({
  name: "FormAutomation - scoreForm adds 5 points per required field",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);

    const form = createTestForm({
      fields: [
        createTestField({ name: "field1", type: "text", required: true }),
        createTestField({ name: "field2", type: "text", required: true }),
        createTestField({ name: "field3", type: "text", required: false }),
      ],
    });

    const score = automation.scoreForm(form);
    // 3 fields * 10 = 30, 2 required * 5 = 10, total = 40
    assertEquals(score, 40);
  },
});

Deno.test({
  name: "FormAutomation - scoreForm adds 20 points for password field",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);

    const form = createTestForm({
      fields: [
        createTestField({ name: "username", type: "text" }),
        createTestField({ name: "password", type: "password" }),
      ],
    });

    const score = automation.scoreForm(form);
    // 2 fields * 10 = 20, password bonus = 20, total = 40
    assertEquals(score, 40);
  },
});

Deno.test({
  name: "FormAutomation - scoreForm adds 15 points for email field",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);

    const form = createTestForm({
      fields: [
        createTestField({ name: "email", type: "email" }),
      ],
    });

    const score = automation.scoreForm(form);
    // 1 field * 10 = 10, email bonus = 15, total = 25
    assertEquals(score, 25);
  },
});

Deno.test({
  name: "FormAutomation - scoreForm adds 10 points for form with action",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);

    const form = createTestForm({
      action: "/submit",
      fields: [
        createTestField({ name: "field1", type: "text" }),
      ],
    });

    const score = automation.scoreForm(form);
    // 1 field * 10 = 10, action bonus = 10, total = 20
    assertEquals(score, 20);
  },
});

Deno.test({
  name: "FormAutomation - scoreForm adds 10 points for POST method",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);

    const form = createTestForm({
      method: "POST",
      fields: [
        createTestField({ name: "field1", type: "text" }),
      ],
    });

    const score = automation.scoreForm(form);
    // 1 field * 10 = 10, POST bonus = 10, total = 20
    assertEquals(score, 20);
  },
});

Deno.test({
  name: "FormAutomation - scoreForm penalizes forms with only hidden fields (-50)",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);

    const form = createTestForm({
      fields: [
        createTestField({ name: "csrf_token", type: "hidden" }),
        createTestField({ name: "session_id", type: "hidden" }),
      ],
    });

    const score = automation.scoreForm(form);
    // 2 fields * 10 = 20, only hidden penalty = -50, total = -30
    assertEquals(score, -30);
  },
});

Deno.test({
  name: "FormAutomation - scoreForm calculates complex form score correctly",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);

    const form = createTestForm({
      action: "/login",
      method: "POST",
      fields: [
        createTestField({ name: "email", type: "email", required: true }),
        createTestField({ name: "password", type: "password", required: true }),
        createTestField({ name: "remember", type: "checkbox" }),
        createTestField({ name: "csrf", type: "hidden" }),
      ],
    });

    const score = automation.scoreForm(form);
    // 4 fields * 10 = 40
    // 2 required * 5 = 10
    // password bonus = 20
    // email bonus = 15
    // action bonus = 10
    // POST bonus = 10
    // Not only hidden (has visible fields)
    // Total = 40 + 10 + 20 + 15 + 10 + 10 = 105
    assertEquals(score, 105);
  },
});

Deno.test({
  name: "FormAutomation - scoreForm returns -50 for empty form (no visible fields penalty)",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);

    const form = createTestForm({
      fields: [],
    });

    const score = automation.scoreForm(form);
    // No fields = 0 visible fields, penalty of -50
    assertEquals(score, -50);
  },
});

// ============================================================================
// validateFileType() Tests
// ============================================================================

Deno.test({
  name: "FormAutomation - validateFileType accepts wildcard MIME type (image/*)",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);

    assert(automation.validateFileType("image/png", "photo.png", "image/*"));
    assert(automation.validateFileType("image/jpeg", "photo.jpg", "image/*"));
    assert(automation.validateFileType("image/gif", "animation.gif", "image/*"));
    assert(automation.validateFileType("image/webp", "modern.webp", "image/*"));
  },
});

Deno.test({
  name: "FormAutomation - validateFileType rejects non-matching wildcard MIME type",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);

    assert(!automation.validateFileType("application/pdf", "doc.pdf", "image/*"));
    assert(!automation.validateFileType("text/plain", "file.txt", "image/*"));
    assert(!automation.validateFileType("video/mp4", "video.mp4", "image/*"));
  },
});

Deno.test({
  name: "FormAutomation - validateFileType accepts extension match (.pdf)",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);

    assert(automation.validateFileType("application/pdf", "document.pdf", ".pdf"));
    assert(automation.validateFileType("application/pdf", "report.PDF", ".pdf"));
  },
});

Deno.test({
  name: "FormAutomation - validateFileType rejects non-matching extension",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);

    assert(!automation.validateFileType("image/png", "photo.png", ".pdf"));
    assert(!automation.validateFileType("application/pdf", "document.pdf", ".doc"));
  },
});

Deno.test({
  name: "FormAutomation - validateFileType accepts exact MIME type match",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);

    assert(automation.validateFileType("application/pdf", "doc.pdf", "application/pdf"));
    assert(automation.validateFileType("text/plain", "readme.txt", "text/plain"));
    assert(automation.validateFileType("application/json", "config.json", "application/json"));
  },
});

Deno.test({
  name: "FormAutomation - validateFileType handles multiple accept values",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);

    const acceptAttr = "image/png, image/jpeg, .gif, application/pdf";

    assert(automation.validateFileType("image/png", "photo.png", acceptAttr));
    assert(automation.validateFileType("image/jpeg", "photo.jpg", acceptAttr));
    assert(automation.validateFileType("image/gif", "animation.gif", acceptAttr));
    assert(automation.validateFileType("application/pdf", "doc.pdf", acceptAttr));
  },
});

Deno.test({
  name: "FormAutomation - validateFileType rejects when no match in multiple values",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);

    const acceptAttr = "image/png, image/jpeg, .gif";

    assert(!automation.validateFileType("application/pdf", "doc.pdf", acceptAttr));
    assert(!automation.validateFileType("video/mp4", "video.mp4", acceptAttr));
  },
});

Deno.test({
  name: "FormAutomation - validateFileType is case-insensitive for MIME types",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);

    assert(automation.validateFileType("IMAGE/PNG", "photo.png", "image/png"));
    assert(automation.validateFileType("image/png", "photo.png", "IMAGE/PNG"));
    assert(automation.validateFileType("Application/PDF", "doc.pdf", "application/pdf"));
  },
});

Deno.test({
  name: "FormAutomation - validateFileType handles application/* wildcard",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);

    assert(automation.validateFileType("application/pdf", "doc.pdf", "application/*"));
    assert(automation.validateFileType("application/json", "config.json", "application/*"));
    assert(automation.validateFileType("application/zip", "archive.zip", "application/*"));
  },
});

Deno.test({
  name: "FormAutomation - validateFileType handles video/* wildcard",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);

    assert(automation.validateFileType("video/mp4", "video.mp4", "video/*"));
    assert(automation.validateFileType("video/webm", "video.webm", "video/*"));
    assert(!automation.validateFileType("audio/mp3", "song.mp3", "video/*"));
  },
});

Deno.test({
  name: "FormAutomation - validateFileType handles audio/* wildcard",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);

    assert(automation.validateFileType("audio/mp3", "song.mp3", "audio/*"));
    assert(automation.validateFileType("audio/wav", "sound.wav", "audio/*"));
    assert(!automation.validateFileType("video/mp4", "video.mp4", "audio/*"));
  },
});

// ============================================================================
// inferMimeType() Tests
// ============================================================================

Deno.test({
  name: "FormAutomation - inferMimeType maps image extensions correctly",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);

    assertEquals(automation.inferMimeType("photo.png"), "image/png");
    assertEquals(automation.inferMimeType("photo.jpg"), "image/jpeg");
    assertEquals(automation.inferMimeType("photo.jpeg"), "image/jpeg");
    assertEquals(automation.inferMimeType("animation.gif"), "image/gif");
    assertEquals(automation.inferMimeType("modern.webp"), "image/webp");
    assertEquals(automation.inferMimeType("vector.svg"), "image/svg+xml");
    assertEquals(automation.inferMimeType("favicon.ico"), "image/x-icon");
    assertEquals(automation.inferMimeType("image.bmp"), "image/bmp");
    assertEquals(automation.inferMimeType("photo.tiff"), "image/tiff");
    assertEquals(automation.inferMimeType("photo.tif"), "image/tiff");
  },
});

Deno.test({
  name: "FormAutomation - inferMimeType maps document extensions correctly",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);

    assertEquals(automation.inferMimeType("document.pdf"), "application/pdf");
    assertEquals(automation.inferMimeType("document.doc"), "application/msword");
    assertEquals(automation.inferMimeType("document.docx"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    assertEquals(automation.inferMimeType("spreadsheet.xls"), "application/vnd.ms-excel");
    assertEquals(automation.inferMimeType("spreadsheet.xlsx"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    assertEquals(automation.inferMimeType("presentation.ppt"), "application/vnd.ms-powerpoint");
    assertEquals(automation.inferMimeType("presentation.pptx"), "application/vnd.openxmlformats-officedocument.presentationml.presentation");
    assertEquals(automation.inferMimeType("document.odt"), "application/vnd.oasis.opendocument.text");
    assertEquals(automation.inferMimeType("spreadsheet.ods"), "application/vnd.oasis.opendocument.spreadsheet");
  },
});

Deno.test({
  name: "FormAutomation - inferMimeType maps text extensions correctly",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);

    assertEquals(automation.inferMimeType("readme.txt"), "text/plain");
    assertEquals(automation.inferMimeType("data.csv"), "text/csv");
    assertEquals(automation.inferMimeType("config.json"), "application/json");
    assertEquals(automation.inferMimeType("data.xml"), "application/xml");
    assertEquals(automation.inferMimeType("page.html"), "text/html");
    assertEquals(automation.inferMimeType("page.htm"), "text/html");
    assertEquals(automation.inferMimeType("styles.css"), "text/css");
    assertEquals(automation.inferMimeType("script.js"), "application/javascript");
    assertEquals(automation.inferMimeType("module.ts"), "application/typescript");
    assertEquals(automation.inferMimeType("readme.md"), "text/markdown");
  },
});

Deno.test({
  name: "FormAutomation - inferMimeType maps archive extensions correctly",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);

    assertEquals(automation.inferMimeType("archive.zip"), "application/zip");
    assertEquals(automation.inferMimeType("archive.rar"), "application/vnd.rar");
    assertEquals(automation.inferMimeType("archive.7z"), "application/x-7z-compressed");
    assertEquals(automation.inferMimeType("archive.tar"), "application/x-tar");
    assertEquals(automation.inferMimeType("archive.gz"), "application/gzip");
  },
});

Deno.test({
  name: "FormAutomation - inferMimeType maps audio extensions correctly",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);

    assertEquals(automation.inferMimeType("song.mp3"), "audio/mpeg");
    assertEquals(automation.inferMimeType("sound.wav"), "audio/wav");
    assertEquals(automation.inferMimeType("audio.ogg"), "audio/ogg");
    assertEquals(automation.inferMimeType("music.flac"), "audio/flac");
    assertEquals(automation.inferMimeType("audio.aac"), "audio/aac");
  },
});

Deno.test({
  name: "FormAutomation - inferMimeType maps video extensions correctly",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);

    assertEquals(automation.inferMimeType("video.mp4"), "video/mp4");
    assertEquals(automation.inferMimeType("video.webm"), "video/webm");
    assertEquals(automation.inferMimeType("video.avi"), "video/x-msvideo");
    assertEquals(automation.inferMimeType("video.mov"), "video/quicktime");
    assertEquals(automation.inferMimeType("video.mkv"), "video/x-matroska");
  },
});

Deno.test({
  name: "FormAutomation - inferMimeType maps other extensions correctly",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);

    assertEquals(automation.inferMimeType("program.exe"), "application/x-msdownload");
    assertEquals(automation.inferMimeType("installer.dmg"), "application/x-apple-diskimage");
    assertEquals(automation.inferMimeType("disk.iso"), "application/x-iso9660-image");
  },
});

Deno.test({
  name: "FormAutomation - inferMimeType returns octet-stream for unknown extensions",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);

    assertEquals(automation.inferMimeType("file.xyz"), "application/octet-stream");
    assertEquals(automation.inferMimeType("file.unknown"), "application/octet-stream");
    assertEquals(automation.inferMimeType("noextension"), "application/octet-stream");
    assertEquals(automation.inferMimeType(""), "application/octet-stream");
  },
});

Deno.test({
  name: "FormAutomation - inferMimeType handles case-insensitive extensions",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);

    assertEquals(automation.inferMimeType("photo.PNG"), "image/png");
    assertEquals(automation.inferMimeType("photo.JPG"), "image/jpeg");
    assertEquals(automation.inferMimeType("document.PDF"), "application/pdf");
  },
});

Deno.test({
  name: "FormAutomation - inferMimeType handles files with multiple dots",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);

    assertEquals(automation.inferMimeType("file.backup.pdf"), "application/pdf");
    assertEquals(automation.inferMimeType("photo.2024.01.png"), "image/png");
    assertEquals(automation.inferMimeType("archive.tar.gz"), "application/gzip");
  },
});

// ============================================================================
// inferFieldValue() Tests
// ============================================================================

Deno.test({
  name: "FormAutomation - inferFieldValue matches email patterns",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);

    const data = { email: "test@example.com" };

    // Match by field name patterns
    assertEquals(automation.inferFieldValue(createTestField({ name: "email" }), data), "test@example.com");
    assertEquals(automation.inferFieldValue(createTestField({ name: "e-mail" }), data), "test@example.com");
    assertEquals(automation.inferFieldValue(createTestField({ name: "user_email" }), data), "test@example.com");
    assertEquals(automation.inferFieldValue(createTestField({ name: "mail" }), data), "test@example.com");
  },
});

Deno.test({
  name: "FormAutomation - inferFieldValue matches firstName patterns",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);

    const data = { firstName: "John" };

    assertEquals(automation.inferFieldValue(createTestField({ name: "firstname" }), data), "John");
    assertEquals(automation.inferFieldValue(createTestField({ name: "first_name" }), data), "John");
    assertEquals(automation.inferFieldValue(createTestField({ name: "first-name" }), data), "John");
    assertEquals(automation.inferFieldValue(createTestField({ name: "fname" }), data), "John");
    assertEquals(automation.inferFieldValue(createTestField({ name: "given_name" }), data), "John");
  },
});

Deno.test({
  name: "FormAutomation - inferFieldValue matches lastName patterns",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);

    const data = { lastName: "Doe" };

    assertEquals(automation.inferFieldValue(createTestField({ name: "lastname" }), data), "Doe");
    assertEquals(automation.inferFieldValue(createTestField({ name: "last_name" }), data), "Doe");
    assertEquals(automation.inferFieldValue(createTestField({ name: "last-name" }), data), "Doe");
    assertEquals(automation.inferFieldValue(createTestField({ name: "lname" }), data), "Doe");
    assertEquals(automation.inferFieldValue(createTestField({ name: "family_name" }), data), "Doe");
  },
});

Deno.test({
  name: "FormAutomation - inferFieldValue matches phone patterns",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);

    const data = { phone: "555-1234" };

    assertEquals(automation.inferFieldValue(createTestField({ name: "phone" }), data), "555-1234");
    assertEquals(automation.inferFieldValue(createTestField({ name: "tel" }), data), "555-1234");
    assertEquals(automation.inferFieldValue(createTestField({ name: "telephone" }), data), "555-1234");
    assertEquals(automation.inferFieldValue(createTestField({ name: "mobile" }), data), "555-1234");
    assertEquals(automation.inferFieldValue(createTestField({ name: "cell" }), data), "555-1234");
  },
});

Deno.test({
  name: "FormAutomation - inferFieldValue matches address patterns",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);

    const data = { address: "123 Main St" };

    assertEquals(automation.inferFieldValue(createTestField({ name: "address" }), data), "123 Main St");
    assertEquals(automation.inferFieldValue(createTestField({ name: "street" }), data), "123 Main St");
    assertEquals(automation.inferFieldValue(createTestField({ name: "street_address" }), data), "123 Main St");
  },
});

Deno.test({
  name: "FormAutomation - inferFieldValue matches city patterns",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);

    const data = { city: "New York" };

    assertEquals(automation.inferFieldValue(createTestField({ name: "city" }), data), "New York");
    assertEquals(automation.inferFieldValue(createTestField({ name: "town" }), data), "New York");
  },
});

Deno.test({
  name: "FormAutomation - inferFieldValue matches state patterns",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);

    const data = { state: "NY" };

    assertEquals(automation.inferFieldValue(createTestField({ name: "state" }), data), "NY");
    assertEquals(automation.inferFieldValue(createTestField({ name: "province" }), data), "NY");
    assertEquals(automation.inferFieldValue(createTestField({ name: "region" }), data), "NY");
  },
});

Deno.test({
  name: "FormAutomation - inferFieldValue matches zip patterns",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);

    const data = { zip: "10001" };

    assertEquals(automation.inferFieldValue(createTestField({ name: "zip" }), data), "10001");
    assertEquals(automation.inferFieldValue(createTestField({ name: "zipcode" }), data), "10001");
    assertEquals(automation.inferFieldValue(createTestField({ name: "postal" }), data), "10001");
    assertEquals(automation.inferFieldValue(createTestField({ name: "postcode" }), data), "10001");
  },
});

Deno.test({
  name: "FormAutomation - inferFieldValue matches country patterns",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);

    const data = { country: "USA" };

    assertEquals(automation.inferFieldValue(createTestField({ name: "country" }), data), "USA");
    assertEquals(automation.inferFieldValue(createTestField({ name: "nation" }), data), "USA");
  },
});

Deno.test({
  name: "FormAutomation - inferFieldValue matches company patterns",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);

    const data = { company: "Acme Inc" };

    assertEquals(automation.inferFieldValue(createTestField({ name: "company" }), data), "Acme Inc");
    assertEquals(automation.inferFieldValue(createTestField({ name: "organization" }), data), "Acme Inc");
    assertEquals(automation.inferFieldValue(createTestField({ name: "org" }), data), "Acme Inc");
  },
});

Deno.test({
  name: "FormAutomation - inferFieldValue matches username patterns",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);

    const data = { username: "johndoe" };

    assertEquals(automation.inferFieldValue(createTestField({ name: "username" }), data), "johndoe");
    assertEquals(automation.inferFieldValue(createTestField({ name: "user" }), data), "johndoe");
    assertEquals(automation.inferFieldValue(createTestField({ name: "login" }), data), "johndoe");
  },
});

Deno.test({
  name: "FormAutomation - inferFieldValue matches password patterns",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);

    const data = { password: "secret123" };

    assertEquals(automation.inferFieldValue(createTestField({ name: "password" }), data), "secret123");
    assertEquals(automation.inferFieldValue(createTestField({ name: "pass" }), data), "secret123");
    assertEquals(automation.inferFieldValue(createTestField({ name: "pwd" }), data), "secret123");
  },
});

Deno.test({
  name: "FormAutomation - inferFieldValue infers by field type for email",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);

    const data = { email: "test@example.com" };

    // Even if field name doesn't match, type email should work
    assertEquals(automation.inferFieldValue(createTestField({ name: "contact", type: "email" }), data), "test@example.com");
  },
});

Deno.test({
  name: "FormAutomation - inferFieldValue infers by field type for tel",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);

    const data = { phone: "555-1234", tel: "555-5678" };

    // Field type tel should match phone or tel data
    const field = createTestField({ name: "contact_number", type: "tel" });
    const result = automation.inferFieldValue(field, data);
    // Should return phone or tel
    assert(result === "555-1234" || result === "555-5678");
  },
});

Deno.test({
  name: "FormAutomation - inferFieldValue infers by field type for url",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);

    const data = { url: "https://example.com", website: "https://website.com" };

    const field = createTestField({ name: "homepage", type: "url" });
    const result = automation.inferFieldValue(field, data);
    // Should return url or website
    assert(result === "https://example.com" || result === "https://website.com");
  },
});

Deno.test({
  name: "FormAutomation - inferFieldValue returns undefined when no match",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);

    const data = { email: "test@example.com" };

    assertEquals(automation.inferFieldValue(createTestField({ name: "custom_field" }), data), undefined);
    assertEquals(automation.inferFieldValue(createTestField({ name: "unknown" }), data), undefined);
  },
});

Deno.test({
  name: "FormAutomation - inferFieldValue uses label when name is empty",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);

    const data = { email: "test@example.com" };

    // When name is empty, label is used for matching
    // Label "Your Email Address" contains "email" pattern
    assertEquals(automation.inferFieldValue(createTestField({ name: "", label: "Your Email Address" }), data), "test@example.com");
  },
});

Deno.test({
  name: "FormAutomation - inferFieldValue prioritizes name over label",
  fn() {
    const page = createMockPage();
    const automation = createTestableFormAutomation(page);

    const data = { email: "test@example.com" };

    // When name exists, it takes priority over label
    // Name "field1" doesn't match email pattern, so no match
    assertEquals(automation.inferFieldValue(createTestField({ name: "field1", label: "Your Email Address" }), data), undefined);
  },
});

// ============================================================================
// detectCaptcha() Integration Tests (via detectPrimaryForm)
// ============================================================================

Deno.test({
  name: "FormAutomation - detectPrimaryForm returns null when no forms",
  async fn() {
    const page = createMockPage({
      query: async (_selector: string) => [],
    });
    const automation = new FormAutomation(page);

    const result = await automation.detectPrimaryForm();
    assertEquals(result, null);
  },
});

Deno.test({
  name: "FormAutomation - detectForms returns empty array when no forms",
  async fn() {
    const page = createMockPage({
      query: async (_selector: string) => [],
    });
    const automation = new FormAutomation(page);

    const result = await automation.detectForms();
    assertEquals(result, []);
  },
});

// ============================================================================
// FormAutomation Constructor Tests
// ============================================================================

Deno.test({
  name: "FormAutomation - constructor creates instance",
  fn() {
    const page = createMockPage();
    const automation = new FormAutomation(page);
    assertExists(automation);
  },
});

// ============================================================================
// validateForm() Tests
// ============================================================================

Deno.test({
  name: "FormAutomation - validateForm returns empty object when no errors",
  async fn() {
    const page = createMockPage({
      query: async (_selector: string) => [],
    });
    const automation = new FormAutomation(page);

    const errors = await automation.validateForm("form#test");
    assertEquals(errors, {});
  },
});

// ============================================================================
// fillForm() Error Handling Tests
// ============================================================================

Deno.test({
  name: "FormAutomation - fillForm handles missing fields gracefully",
  async fn() {
    const page = createMockPage({
      query: async (_selector: string) => [],
    });
    const automation = new FormAutomation(page);

    // Should not throw, just warn
    await automation.fillForm("form#test", { nonexistent: "value" });
  },
});

// ============================================================================
// submitForm() Tests
// ============================================================================

Deno.test({
  name: "FormAutomation - submitForm returns success when no submit button found",
  async fn() {
    let evaluateCalled = false;
    const page = createMockPage({
      query: async (_selector: string) => [],
      evaluate: async (_script: string) => {
        evaluateCalled = true;
        return {};
      },
      getCurrentURL: () => "https://example.com/success",
    });
    const automation = new FormAutomation(page);

    const result = await automation.submitForm("form#test", { waitForNavigation: false });
    assert(evaluateCalled);
    assertEquals(result.success, true);
    assertEquals(result.finalUrl, "https://example.com/success");
  },
});

Deno.test({
  name: "FormAutomation - submitForm matches success URL pattern",
  async fn() {
    const page = createMockPage({
      query: async (_selector: string) => [],
      evaluate: async (_script: string) => ({}),
      getCurrentURL: () => "https://example.com/thank-you",
    });
    const automation = new FormAutomation(page);

    const result = await automation.submitForm("form#test", {
      waitForNavigation: false,
      successUrlPattern: /thank-you/,
    });
    assertEquals(result.success, true);
  },
});

Deno.test({
  name: "FormAutomation - submitForm handles error on exception",
  async fn() {
    const page = createMockPage({
      query: async (_selector: string) => {
        throw new Error("Query failed");
      },
      getCurrentURL: () => "https://example.com",
    });
    const automation = new FormAutomation(page);

    const result = await automation.submitForm("form#test");
    assertEquals(result.success, false);
    assertExists(result.error);
  },
});

// ============================================================================
// uploadFile() Tests
// ============================================================================

Deno.test({
  name: "FormAutomation - uploadFile throws when field not found",
  async fn() {
    const page = createMockPage({
      query: async (_selector: string) => [],
    });
    const automation = new FormAutomation(page);

    try {
      await automation.uploadFile("#file-input", {
        fieldName: "file",
        fileName: "test.txt",
        content: new Uint8Array([1, 2, 3]),
        mimeType: "text/plain",
      });
      assert(false, "Should have thrown");
    } catch (error) {
      assert(error instanceof Error);
      assert(error.message.includes("File input not found"));
    }
  },
});

Deno.test({
  name: "FormAutomation - uploadFile throws when element is not file input",
  async fn() {
    const page = createMockPage({
      query: async (_selector: string) => [
        createMockElement({ type: "text" }),
      ],
    });
    const automation = new FormAutomation(page);

    try {
      await automation.uploadFile("#file-input", {
        fieldName: "file",
        fileName: "test.txt",
        content: new Uint8Array([1, 2, 3]),
        mimeType: "text/plain",
      });
      assert(false, "Should have thrown");
    } catch (error) {
      assert(error instanceof Error);
      assert(error.message.includes("not a file input"));
    }
  },
});

Deno.test({
  name: "FormAutomation - uploadFile throws when neither filePath nor content provided",
  async fn() {
    const page = createMockPage({
      query: async (_selector: string) => [
        createMockElement({ type: "file" }),
      ],
    });
    const automation = new FormAutomation(page);

    try {
      await automation.uploadFile("#file-input", {
        fieldName: "file",
        fileName: "test.txt",
        mimeType: "text/plain",
      });
      assert(false, "Should have thrown");
    } catch (error) {
      assert(error instanceof Error);
      assert(error.message.includes("Either filePath or content must be provided"));
    }
  },
});

// ============================================================================
// uploadMultipleFiles() Tests
// ============================================================================

Deno.test({
  name: "FormAutomation - uploadMultipleFiles throws when no files provided",
  async fn() {
    const page = createMockPage();
    const automation = new FormAutomation(page);

    try {
      await automation.uploadMultipleFiles("#file-input", []);
      assert(false, "Should have thrown");
    } catch (error) {
      assert(error instanceof Error);
      assert(error.message.includes("No files provided"));
    }
  },
});

Deno.test({
  name: "FormAutomation - uploadMultipleFiles throws when field not found",
  async fn() {
    const page = createMockPage({
      query: async (_selector: string) => [],
    });
    const automation = new FormAutomation(page);

    try {
      await automation.uploadMultipleFiles("#file-input", [{
        fieldName: "files",
        fileName: "test.txt",
        content: new Uint8Array([1, 2, 3]),
        mimeType: "text/plain",
      }]);
      assert(false, "Should have thrown");
    } catch (error) {
      assert(error instanceof Error);
      assert(error.message.includes("File input not found"));
    }
  },
});

Deno.test({
  name: "FormAutomation - uploadMultipleFiles throws when multiple not supported",
  async fn() {
    const page = createMockPage({
      query: async (_selector: string) => [
        createMockElement({ type: "file", multiple: null }),
      ],
    });
    const automation = new FormAutomation(page);

    try {
      await automation.uploadMultipleFiles("#file-input", [
        { fieldName: "files", fileName: "test1.txt", content: new Uint8Array([1]), mimeType: "text/plain" },
        { fieldName: "files", fileName: "test2.txt", content: new Uint8Array([2]), mimeType: "text/plain" },
      ]);
      assert(false, "Should have thrown");
    } catch (error) {
      assert(error instanceof Error);
      assert(error.message.includes("does not support multiple files"));
    }
  },
});

// ============================================================================
// autoFill() Tests
// ============================================================================

Deno.test({
  name: "FormAutomation - autoFill returns filled and skipped arrays",
  async fn() {
    const page = createMockPage({
      query: async (_selector: string) => [],
    });
    const automation = new FormAutomation(page);

    const result = await automation.autoFill("form#test", { email: "test@example.com" });
    assertExists(result.filled);
    assertExists(result.skipped);
    assertEquals(Array.isArray(result.filled), true);
    assertEquals(Array.isArray(result.skipped), true);
  },
});

// ============================================================================
// executeMultiStepForm() Tests
// ============================================================================

Deno.test({
  name: "FormAutomation - executeMultiStepForm returns success for empty steps",
  async fn() {
    const page = createMockPage({
      query: async (_selector: string) => [],
      getCurrentURL: () => "https://example.com/done",
    });
    const automation = new FormAutomation(page);

    const result = await automation.executeMultiStepForm("form#test", {
      steps: [],
    });
    assertEquals(result.success, true);
    assertEquals(result.finalUrl, "https://example.com/done");
  },
});

Deno.test({
  name: "FormAutomation - executeMultiStepForm handles max steps exceeded",
  async fn() {
    const page = createMockPage({
      query: async (_selector: string) => [],
      click: async (_selector: string) => {},
      getCurrentURL: () => "https://example.com",
    });
    const automation = new FormAutomation(page);

    // Create more steps than allowed
    const steps = [];
    for (let i = 0; i < 15; i++) {
      steps.push({ fillData: { [`field${i}`]: `value${i}` } });
    }

    const result = await automation.executeMultiStepForm("form#test", {
      steps,
      maxSteps: 10,
    });
    assertEquals(result.success, false);
    assertExists(result.error);
    assert(result.error!.includes("Maximum steps"));
  },
});

Deno.test({
  name: "FormAutomation - executeMultiStepForm handles validation failure",
  async fn() {
    const page = createMockPage({
      query: async (_selector: string) => [],
      getCurrentURL: () => "https://example.com",
    });
    const automation = new FormAutomation(page);

    const result = await automation.executeMultiStepForm("form#test", {
      steps: [{
        fillData: { field1: "value1" },
        validate: async (_page: BrowserPage) => false,
      }],
    });
    assertEquals(result.success, false);
    assertExists(result.error);
    assert(result.error!.includes("Validation failed"));
  },
});

/**
 * Form Automation API
 *
 * Provides high-level form detection, field handling, and submission capabilities.
 * Supports various field types, validation, file uploads, and multi-step workflows.
 */

import { BrowserPage, DOMElement } from "./BrowserPage.ts";
import { FileSystem } from "../os/filesystem/FileSystem.ts";

/**
 * Field types that can be detected and handled
 */
export type FormFieldType =
  | "text"
  | "email"
  | "password"
  | "number"
  | "tel"
  | "url"
  | "search"
  | "date"
  | "datetime-local"
  | "time"
  | "month"
  | "week"
  | "color"
  | "select"
  | "select-multiple"
  | "checkbox"
  | "radio"
  | "file"
  | "hidden"
  | "textarea"
  | "unknown";

/**
 * Detected form field information
 */
export interface FormField {
  /** Field name attribute */
  name: string;
  /** Field ID attribute */
  id: string;
  /** Detected field type */
  type: FormFieldType;
  /** Field label (if found) */
  label: string | null;
  /** Field placeholder text */
  placeholder: string | null;
  /** Whether field is required */
  required: boolean;
  /** Whether field is disabled */
  disabled: boolean;
  /** Whether field is readonly */
  readonly: boolean;
  /** Current field value */
  value: string;
  /** Validation pattern (if any) */
  pattern: string | null;
  /** Min value/length (for number/text) */
  min: string | null;
  /** Max value/length (for number/text) */
  max: string | null;
  /** Step value (for number/date) */
  step: string | null;
  /** Options (for select/radio/checkbox groups) */
  options: FormFieldOption[];
  /** CSS selector to target this field */
  selector: string;
  /** Validation error message (if any) */
  validationMessage: string | null;
}

/**
 * Option for select, radio, or checkbox fields
 */
export interface FormFieldOption {
  /** Option value */
  value: string;
  /** Option display text */
  label: string;
  /** Whether option is selected */
  selected: boolean;
  /** Whether option is disabled */
  disabled: boolean;
}

/**
 * Detected form information
 */
export interface DetectedForm {
  /** Form ID attribute */
  id: string | null;
  /** Form name attribute */
  name: string | null;
  /** Form action URL */
  action: string;
  /** Form method (GET/POST) */
  method: string;
  /** Form encoding type */
  enctype: string;
  /** Whether form has file upload fields */
  hasFileUpload: boolean;
  /** Whether CAPTCHA is detected */
  hasCaptcha: boolean;
  /** Type of CAPTCHA detected */
  captchaType: "recaptcha" | "hcaptcha" | "turnstile" | "custom" | null;
  /** All form fields */
  fields: FormField[];
  /** CSS selector to target this form */
  selector: string;
}

/**
 * Form fill data - maps field name/id to value
 */
export type FormFillData = Record<
  string,
  string | string[] | boolean | File | FileUploadInfo | FileUploadInfo[]
>;

/**
 * Form fill options
 */
export interface FormFillOptions {
  /** Clear existing values before filling */
  clearFirst?: boolean;
  /** Delay between field fills (ms) */
  delay?: number;
  /** Validate fields after filling */
  validate?: boolean;
  /** Skip disabled fields */
  skipDisabled?: boolean;
  /** Skip readonly fields */
  skipReadonly?: boolean;
}

/**
 * Form submission options
 */
export interface FormSubmitOptions {
  /** Wait for navigation after submit */
  waitForNavigation?: boolean;
  /** Navigation timeout (ms) */
  timeout?: number;
  /** Success URL pattern (regex) */
  successUrlPattern?: RegExp;
  /** Success selector (element present on success page) */
  successSelector?: string;
  /** Error selector (element present on error) */
  errorSelector?: string;
}

/**
 * Form submission result
 */
export interface FormSubmitResult {
  /** Whether submission was successful */
  success: boolean;
  /** Final URL after submission */
  finalUrl: string;
  /** HTTP status code (if available) */
  statusCode?: number;
  /** Error message (if failed) */
  error?: string;
  /** Validation errors (field name -> error message) */
  validationErrors?: Record<string, string>;
}

/**
 * File upload information
 */
export interface FileUploadInfo {
  /** File field name */
  fieldName: string;
  /** File path (for local files) */
  filePath?: string;
  /** File content (for in-memory files) */
  content?: Uint8Array;
  /** File name */
  fileName: string;
  /** MIME type */
  mimeType: string;
}

/**
 * Multi-step form configuration
 */
export interface MultiStepFormConfig {
  /** Steps configuration */
  steps: MultiStepFormStep[];
  /** Next button selector (default: looks for common patterns) */
  nextButtonSelector?: string;
  /** Previous button selector */
  prevButtonSelector?: string;
  /** Submit button selector */
  submitButtonSelector?: string;
  /** Maximum steps allowed */
  maxSteps?: number;
  /** Timeout per step (ms) */
  stepTimeout?: number;
}

/**
 * Single step in multi-step form
 */
export interface MultiStepFormStep {
  /** Step identifier (for tracking) */
  id?: string;
  /** Data to fill for this step */
  fillData: FormFillData;
  /** Custom validation function */
  validate?: (page: BrowserPage) => Promise<boolean>;
  /** Wait condition after step */
  waitFor?: string;
}

/**
 * Form Automation class
 */
export class FormAutomation {
  private page: BrowserPage;
  private fileSystem: FileSystem;

  constructor(page: BrowserPage) {
    this.page = page;
    this.fileSystem = new FileSystem();
  }

  /**
   * Detect all forms on the current page
   */
  async detectForms(): Promise<DetectedForm[]> {
    const forms: DetectedForm[] = [];
    const formElements = await this.page.query("form");

    for (let i = 0; i < formElements.length; i++) {
      const formElement = formElements[i];
      const form = await this.analyzeForm(formElement, i);
      forms.push(form);
    }

    return forms;
  }

  /**
   * Detect the primary form on the page (usually the most prominent one)
   */
  async detectPrimaryForm(): Promise<DetectedForm | null> {
    const forms = await this.detectForms();

    if (forms.length === 0) {
      return null;
    }

    // Prioritize forms with more fields, submit button, and visible fields
    const scored = forms.map((form) => ({
      form,
      score: this.scoreForm(form),
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored[0].form;
  }

  /**
   * Analyze a form element and extract field information
   */
  private async analyzeForm(formElement: DOMElement, index: number): Promise<DetectedForm> {
    const id = await formElement.getAttribute("id");
    const name = await formElement.getAttribute("name");
    const action = await formElement.getAttribute("action") || "";
    const method = (await formElement.getAttribute("method") || "GET").toUpperCase();
    const enctype = await formElement.getAttribute("enctype") ||
      "application/x-www-form-urlencoded";

    const selector = id ? `form#${id}` : `form:nth-of-type(${index + 1})`;

    // Detect fields
    const fields = await this.detectFields(selector);

    // Check for file uploads
    const hasFileUpload = fields.some((f) => f.type === "file");

    // Detect CAPTCHA
    const { hasCaptcha, captchaType } = await this.detectCaptcha(selector);

    return {
      id,
      name,
      action,
      method,
      enctype,
      hasFileUpload,
      hasCaptcha,
      captchaType,
      fields,
      selector,
    };
  }

  /**
   * Detect all fields within a form
   */
  private async detectFields(formSelector: string): Promise<FormField[]> {
    const fields: FormField[] = [];

    // Input fields
    const inputSelectors = [
      `${formSelector} input`,
      `${formSelector} select`,
      `${formSelector} textarea`,
    ];

    for (const selector of inputSelectors) {
      const elements = await this.page.query(selector);

      for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        const field = await this.analyzeField(element, `${selector}:nth-of-type(${i + 1})`);
        if (field) {
          fields.push(field);
        }
      }
    }

    return fields;
  }

  /**
   * Analyze a single field element
   */
  private async analyzeField(
    element: DOMElement,
    fallbackSelector: string,
  ): Promise<FormField | null> {
    const tagName = (await element.getProperty("tagName") as string || "").toLowerCase();
    const inputType = (await element.getAttribute("type") || "text").toLowerCase();
    const name = await element.getAttribute("name") || "";
    const id = await element.getAttribute("id") || "";

    // Skip submit/reset/button inputs
    if (["submit", "reset", "button", "image"].includes(inputType)) {
      return null;
    }

    // Determine field type
    let type: FormFieldType;
    if (tagName === "select") {
      const multiple = await element.getAttribute("multiple");
      type = multiple !== null ? "select-multiple" : "select";
    } else if (tagName === "textarea") {
      type = "textarea";
    } else {
      type = this.mapInputType(inputType);
    }

    // Find label
    const label = await this.findFieldLabel(element, id);

    // Build selector
    const selector = id ? `#${id}` : (name ? `[name="${name}"]` : fallbackSelector);

    // Get options for select/radio/checkbox
    const options = await this.getFieldOptions(element, type, name);

    return {
      name,
      id,
      type,
      label,
      placeholder: await element.getAttribute("placeholder"),
      required: (await element.getAttribute("required")) !== null,
      disabled: (await element.getAttribute("disabled")) !== null,
      readonly: (await element.getAttribute("readonly")) !== null,
      value: await element.getProperty("value") as string || "",
      pattern: await element.getAttribute("pattern"),
      min: await element.getAttribute("min"),
      max: await element.getAttribute("max"),
      step: await element.getAttribute("step"),
      options,
      selector,
      validationMessage: await element.getProperty("validationMessage") as string || null,
    };
  }

  /**
   * Map HTML input type to FormFieldType
   */
  private mapInputType(inputType: string): FormFieldType {
    const typeMap: Record<string, FormFieldType> = {
      text: "text",
      email: "email",
      password: "password",
      number: "number",
      tel: "tel",
      url: "url",
      search: "search",
      date: "date",
      "datetime-local": "datetime-local",
      time: "time",
      month: "month",
      week: "week",
      color: "color",
      checkbox: "checkbox",
      radio: "radio",
      file: "file",
      hidden: "hidden",
    };

    return typeMap[inputType] || "unknown";
  }

  /**
   * Find the label for a field
   */
  private async findFieldLabel(_element: DOMElement, id: string): Promise<string | null> {
    // Try finding label by "for" attribute
    if (id) {
      try {
        const labelElements = await this.page.query(`label[for="${id}"]`);
        if (labelElements.length > 0) {
          return await labelElements[0].getText();
        }
      } catch {
        // Label not found
      }
    }

    // Try finding parent label
    // This is a simplification - in real implementation, you'd walk up the DOM tree
    return null;
  }

  /**
   * Get options for select, radio, or checkbox fields
   */
  private async getFieldOptions(
    _element: DOMElement,
    type: FormFieldType,
    name: string,
  ): Promise<FormFieldOption[]> {
    const options: FormFieldOption[] = [];

    if (type === "select" || type === "select-multiple") {
      // Get select options
      try {
        const optionElements = await this.page.query(`select[name="${name}"] option`);
        for (const opt of optionElements) {
          options.push({
            value: await opt.getAttribute("value") || "",
            label: await opt.getText(),
            selected: (await opt.getAttribute("selected")) !== null,
            disabled: (await opt.getAttribute("disabled")) !== null,
          });
        }
      } catch {
        // Options not found
      }
    } else if (type === "radio" || type === "checkbox") {
      // Get radio/checkbox group options
      try {
        const groupElements = await this.page.query(`input[name="${name}"]`);
        for (const opt of groupElements) {
          const value = await opt.getAttribute("value") || "";
          const label = await this.findFieldLabel(opt, await opt.getAttribute("id") || "");
          options.push({
            value,
            label: label || value,
            selected: (await opt.getAttribute("checked")) !== null,
            disabled: (await opt.getAttribute("disabled")) !== null,
          });
        }
      } catch {
        // Options not found
      }
    }

    return options;
  }

  /**
   * Detect CAPTCHA on the form
   */
  private async detectCaptcha(formSelector: string): Promise<{
    hasCaptcha: boolean;
    captchaType: "recaptcha" | "hcaptcha" | "turnstile" | "custom" | null;
  }> {
    // Check for reCAPTCHA
    try {
      const recaptchaElements = await this.page.query(
        `${formSelector} .g-recaptcha, ${formSelector} [data-sitekey]`,
      );
      if (recaptchaElements.length > 0) {
        return { hasCaptcha: true, captchaType: "recaptcha" };
      }
    } catch {
      // Not found
    }

    // Check for hCaptcha
    try {
      const hcaptchaElements = await this.page.query(`${formSelector} .h-captcha`);
      if (hcaptchaElements.length > 0) {
        return { hasCaptcha: true, captchaType: "hcaptcha" };
      }
    } catch {
      // Not found
    }

    // Check for Cloudflare Turnstile
    try {
      const turnstileElements = await this.page.query(`${formSelector} .cf-turnstile`);
      if (turnstileElements.length > 0) {
        return { hasCaptcha: true, captchaType: "turnstile" };
      }
    } catch {
      // Not found
    }

    // Check for generic CAPTCHA patterns
    try {
      const genericCaptchaElements = await this.page.query(
        `${formSelector} [class*="captcha"], ${formSelector} [id*="captcha"]`,
      );
      if (genericCaptchaElements.length > 0) {
        return { hasCaptcha: true, captchaType: "custom" };
      }
    } catch {
      // Not found
    }

    return { hasCaptcha: false, captchaType: null };
  }

  /**
   * Score a form for primary form detection
   */
  private scoreForm(form: DetectedForm): number {
    let score = 0;

    // More fields = higher score
    score += form.fields.length * 10;

    // Required fields indicate importance
    score += form.fields.filter((f) => f.required).length * 5;

    // Password field suggests login/registration
    if (form.fields.some((f) => f.type === "password")) {
      score += 20;
    }

    // Email field is common in important forms
    if (form.fields.some((f) => f.type === "email")) {
      score += 15;
    }

    // Forms with actions are more likely to be functional
    if (form.action) {
      score += 10;
    }

    // POST forms are usually more important
    if (form.method === "POST") {
      score += 10;
    }

    // Penalize forms with only hidden fields
    const visibleFields = form.fields.filter((f) => f.type !== "hidden");
    if (visibleFields.length === 0) {
      score -= 50;
    }

    return score;
  }

  /**
   * Fill a form with the provided data
   */
  async fillForm(
    formSelector: string,
    data: FormFillData,
    options: FormFillOptions = {},
  ): Promise<void> {
    const {
      clearFirst = true,
      delay = 50,
      validate = false,
      skipDisabled = true,
      skipReadonly = true,
    } = options;

    for (const [fieldName, value] of Object.entries(data)) {
      // Find the field by name or id
      const fieldSelector = `${formSelector} [name="${fieldName}"], ${formSelector} #${fieldName}`;

      try {
        const fields = await this.page.query(fieldSelector);
        if (fields.length === 0) {
          console.warn(`Field not found: ${fieldName}`);
          continue;
        }
        const field = fields[0];

        // Check if field should be skipped
        if (skipDisabled && (await field.getAttribute("disabled")) !== null) {
          continue;
        }
        if (skipReadonly && (await field.getAttribute("readonly")) !== null) {
          continue;
        }

        // Fill based on field type
        const tagName = (await field.getProperty("tagName") as string || "").toLowerCase();
        const inputType = (await field.getAttribute("type") || "text").toLowerCase();

        if (tagName === "select") {
          await this.fillSelectField(fieldSelector, value as string | string[]);
        } else if (inputType === "checkbox") {
          await this.fillCheckboxField(fieldSelector, value as boolean | string | string[]);
        } else if (inputType === "radio") {
          await this.fillRadioField(formSelector, fieldName, value as string);
        } else if (inputType === "file") {
          // Handle file uploads using uploadFile method
          // Value can be a file path string, a FileUploadInfo object, or array for multiple files
          if (typeof value === "string") {
            // Single file path - extract filename from path
            const extractedFileName = value.split("/").pop() || value.split("\\").pop() || "file";
            await this.uploadFile(fieldSelector, {
              fieldName,
              fileName: extractedFileName,
              filePath: value,
              mimeType: this.inferMimeType(extractedFileName),
            });
          } else if (Array.isArray(value)) {
            // Multiple files
            const files: FileUploadInfo[] = value.map((v: string | FileUploadInfo) => {
              if (typeof v === "string") {
                const extractedFileName = v.split("/").pop() || v.split("\\").pop() || "file";
                return {
                  fieldName,
                  fileName: extractedFileName,
                  filePath: v,
                  mimeType: this.inferMimeType(extractedFileName),
                };
              }
              // Ensure fieldName is set if not present
              const fileInfo = v as FileUploadInfo;
              if (!fileInfo.fieldName) {
                fileInfo.fieldName = fieldName;
              }
              return fileInfo;
            });
            await this.uploadMultipleFiles(fieldSelector, files);
          } else if (typeof value === "object" && value !== null) {
            // Single FileUploadInfo object - ensure fieldName is set
            const fileInfo = value as FileUploadInfo;
            if (!fileInfo.fieldName) {
              fileInfo.fieldName = fieldName;
            }
            await this.uploadFile(fieldSelector, fileInfo);
          } else {
            console.warn(
              `Invalid file upload value for ${fieldName}: expected string, array, or FileUploadInfo`,
            );
          }
        } else {
          // Text-like inputs and textarea
          if (clearFirst) {
            await this.page.type(fieldSelector, "");
          }
          await this.page.type(fieldSelector, String(value), { delay });
        }
      } catch (error) {
        console.error(`Error filling field ${fieldName}:`, error);
      }
    }

    // Validate if requested
    if (validate) {
      await this.validateForm(formSelector);
    }
  }

  /**
   * Fill a select field
   */
  private async fillSelectField(selector: string, value: string | string[]): Promise<void> {
    const values = Array.isArray(value) ? value : [value];

    // For each value, find and select the option
    for (const val of values) {
      try {
        await this.page.click(`${selector} option[value="${val}"]`);
      } catch {
        // Try selecting by text content
        // This is a simplification - real implementation would need more robust option selection
      }
    }
  }

  /**
   * Fill a checkbox field
   */
  private async fillCheckboxField(
    selector: string,
    value: boolean | string | string[],
  ): Promise<void> {
    const elements = await this.page.query(selector);
    if (elements.length === 0) return;

    const element = elements[0];
    const isChecked = (await element.getAttribute("checked")) !== null;
    const shouldCheck = typeof value === "boolean" ? value : Boolean(value);

    if (isChecked !== shouldCheck) {
      await this.page.click(selector);
    }
  }

  /**
   * Fill a radio field group
   */
  private async fillRadioField(
    formSelector: string,
    fieldName: string,
    value: string,
  ): Promise<void> {
    const radioSelector =
      `${formSelector} input[type="radio"][name="${fieldName}"][value="${value}"]`;
    await this.page.click(radioSelector);
  }

  /**
   * Validate form fields
   */
  async validateForm(formSelector: string): Promise<Record<string, string>> {
    const errors: Record<string, string> = {};

    // Get all form fields
    const fields = await this.detectFields(formSelector);

    for (const field of fields) {
      if (field.validationMessage) {
        errors[field.name || field.id] = field.validationMessage;
      }
    }

    return errors;
  }

  /**
   * Submit a form
   */
  async submitForm(
    formSelector: string,
    options: FormSubmitOptions = {},
  ): Promise<FormSubmitResult> {
    const {
      waitForNavigation = true,
      timeout = 30000,
      successUrlPattern,
      successSelector,
      errorSelector,
    } = options;

    try {
      // Find submit button
      const submitButtonSelector =
        `${formSelector} button[type="submit"], ${formSelector} input[type="submit"], ${formSelector} button:not([type])`;

      const submitButtons = await this.page.query(submitButtonSelector);

      if (submitButtons.length > 0) {
        // Click submit button
        if (waitForNavigation) {
          await Promise.all([
            this.page.click(submitButtonSelector),
            this.waitForNavigationOrTimeout(timeout),
          ]);
        } else {
          await this.page.click(submitButtonSelector);
        }
      } else {
        // Try form.submit() via JavaScript
        await this.page.evaluate(`document.querySelector('${formSelector}').submit()`);

        if (waitForNavigation) {
          await this.waitForNavigationOrTimeout(timeout);
        }
      }

      // Get final URL
      const finalUrl = this.page.getCurrentURL() || "";

      // Check for success/error conditions
      if (successUrlPattern && successUrlPattern.test(finalUrl)) {
        return { success: true, finalUrl };
      }

      if (successSelector) {
        try {
          const successElements = await this.page.query(successSelector);
          if (successElements.length > 0) {
            return { success: true, finalUrl };
          }
        } catch {
          // Success selector not found
        }
      }

      if (errorSelector) {
        try {
          const errorElements = await this.page.query(errorSelector);
          if (errorElements.length > 0) {
            const errorMessage = await errorElements[0].getText();
            return { success: false, finalUrl, error: errorMessage };
          }
        } catch {
          // Error selector not found
        }
      }

      // Default to success if no explicit conditions
      return { success: true, finalUrl };
    } catch (error) {
      return {
        success: false,
        finalUrl: this.page.getCurrentURL() || "",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Wait for navigation or timeout
   */
  private async waitForNavigationOrTimeout(timeout: number): Promise<void> {
    // Simplified - in real implementation, would use page navigation events
    await new Promise((resolve) => setTimeout(resolve, Math.min(timeout, 1000)));
  }

  /**
   * Handle file upload
   *
   * Supports multiple upload methods:
   * - Direct file path (for local files)
   * - In-memory content (Uint8Array)
   * - Drag-and-drop simulation
   */
  async uploadFile(
    fieldSelector: string,
    fileInfo: FileUploadInfo,
  ): Promise<void> {
    // Find the file input element
    const fileInputs = await this.page.query(fieldSelector);
    if (fileInputs.length === 0) {
      throw new Error(`File input not found for selector: ${fieldSelector}`);
    }

    const fileInput = fileInputs[0];
    const inputType = await fileInput.getAttribute("type");

    // Verify it's a file input
    if (inputType?.toLowerCase() !== "file") {
      throw new Error(`Element is not a file input: ${fieldSelector}`);
    }

    // Get file content
    let fileContent: Uint8Array;

    if (fileInfo.content) {
      // Use provided content directly
      fileContent = fileInfo.content;
    } else if (fileInfo.filePath) {
      // Read file from disk using FileSystem
      try {
        fileContent = await this.fileSystem.readFile(fileInfo.filePath);
      } catch (error) {
        throw new Error(
          `Failed to read file: ${fileInfo.filePath}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    } else {
      throw new Error("Either filePath or content must be provided for file upload");
    }

    // Create a File-like object representation for the upload
    const fileData = {
      name: fileInfo.fileName,
      type: fileInfo.mimeType,
      size: fileContent.byteLength,
      content: fileContent,
      lastModified: Date.now(),
    };

    // Validate file against input accept attribute if present
    const acceptAttr = await fileInput.getAttribute("accept");
    if (acceptAttr) {
      const isAccepted = this.validateFileType(fileData.type, fileData.name, acceptAttr);
      if (!isAccepted) {
        throw new Error(
          `File type '${fileData.type}' (${fileData.name}) is not accepted. Allowed types: ${acceptAttr}`,
        );
      }
    }

    // Check multiple attribute for multi-file support
    const multipleAttr = await fileInput.getAttribute("multiple");
    const supportsMultiple = multipleAttr !== null;

    // Perform the upload using JavaScript injection
    // This creates a synthetic File object and sets it on the input
    const uploadScript = `
      (function() {
        const input = document.querySelector('${this.escapeSelector(fieldSelector)}');
        if (!input) return { success: false, error: 'Input not found' };

        // Create a DataTransfer to hold the file
        const dataTransfer = new DataTransfer();

        // Create a File object from the provided data
        const fileContent = new Uint8Array([${Array.from(fileContent).join(",")}]);
        const file = new File([fileContent], '${this.escapeString(fileData.name)}', {
          type: '${this.escapeString(fileData.type)}',
          lastModified: ${fileData.lastModified}
        });

        dataTransfer.items.add(file);

        // Set the files on the input element
        input.files = dataTransfer.files;

        // Dispatch change event to notify the form
        const changeEvent = new Event('change', { bubbles: true });
        input.dispatchEvent(changeEvent);

        // Also dispatch input event for better compatibility
        const inputEvent = new Event('input', { bubbles: true });
        input.dispatchEvent(inputEvent);

        return { success: true, fileName: file.name, fileSize: file.size };
      })()
    `;

    try {
      const result = await this.page.evaluate(uploadScript) as {
        success: boolean;
        error?: string;
        fileName?: string;
        fileSize?: number;
      };

      if (!result.success) {
        throw new Error(result.error || "File upload failed");
      }

      // Log success (useful for debugging multi-file support)
      if (supportsMultiple) {
        console.log(
          `Uploaded file: ${result.fileName} (${result.fileSize} bytes) to multi-file input`,
        );
      }
    } catch (error) {
      throw new Error(
        `File upload failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Upload multiple files to a file input
   */
  async uploadMultipleFiles(
    fieldSelector: string,
    files: FileUploadInfo[],
  ): Promise<void> {
    if (files.length === 0) {
      throw new Error("No files provided for upload");
    }

    // Find the file input element
    const fileInputs = await this.page.query(fieldSelector);
    if (fileInputs.length === 0) {
      throw new Error(`File input not found for selector: ${fieldSelector}`);
    }

    const fileInput = fileInputs[0];

    // Check if multiple files are supported
    const multipleAttr = await fileInput.getAttribute("multiple");
    if (multipleAttr === null && files.length > 1) {
      throw new Error(
        `File input does not support multiple files. Use uploadFile() for single file upload.`,
      );
    }

    // Prepare all file contents
    const fileDataArray: Array<{
      name: string;
      type: string;
      content: Uint8Array;
      lastModified: number;
    }> = [];

    for (const fileInfo of files) {
      let fileContent: Uint8Array;

      if (fileInfo.content) {
        fileContent = fileInfo.content;
      } else if (fileInfo.filePath) {
        try {
          fileContent = await this.fileSystem.readFile(fileInfo.filePath);
        } catch (error) {
          throw new Error(
            `Failed to read file: ${fileInfo.filePath}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      } else {
        throw new Error(
          `Either filePath or content must be provided for file: ${fileInfo.fileName}`,
        );
      }

      fileDataArray.push({
        name: fileInfo.fileName,
        type: fileInfo.mimeType,
        content: fileContent,
        lastModified: Date.now(),
      });
    }

    // Build the upload script for multiple files
    const filesJson = fileDataArray.map((fd) => ({
      name: fd.name,
      type: fd.type,
      content: Array.from(fd.content),
      lastModified: fd.lastModified,
    }));

    const uploadScript = `
      (function() {
        const input = document.querySelector('${this.escapeSelector(fieldSelector)}');
        if (!input) return { success: false, error: 'Input not found' };

        const filesData = ${JSON.stringify(filesJson)};
        const dataTransfer = new DataTransfer();

        for (const fileData of filesData) {
          const fileContent = new Uint8Array(fileData.content);
          const file = new File([fileContent], fileData.name, {
            type: fileData.type,
            lastModified: fileData.lastModified
          });
          dataTransfer.items.add(file);
        }

        input.files = dataTransfer.files;

        const changeEvent = new Event('change', { bubbles: true });
        input.dispatchEvent(changeEvent);

        const inputEvent = new Event('input', { bubbles: true });
        input.dispatchEvent(inputEvent);

        return {
          success: true,
          fileCount: dataTransfer.files.length,
          files: Array.from(dataTransfer.files).map(f => ({ name: f.name, size: f.size }))
        };
      })()
    `;

    try {
      const result = await this.page.evaluate(uploadScript) as {
        success: boolean;
        error?: string;
        fileCount?: number;
        files?: Array<{ name: string; size: number }>;
      };

      if (!result.success) {
        throw new Error(result.error || "Multiple file upload failed");
      }
    } catch (error) {
      throw new Error(
        `Multiple file upload failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Validate file type against accept attribute
   */
  private validateFileType(mimeType: string, fileName: string, acceptAttr: string): boolean {
    const acceptedTypes = acceptAttr.split(",").map((t) => t.trim().toLowerCase());

    for (const accepted of acceptedTypes) {
      // Check for wildcard MIME type (e.g., "image/*")
      if (accepted.endsWith("/*")) {
        const prefix = accepted.slice(0, -2);
        if (mimeType.toLowerCase().startsWith(prefix)) {
          return true;
        }
      } // Check for exact MIME type match
      else if (accepted.startsWith(".")) {
        // Extension match (e.g., ".pdf")
        const extension = accepted;
        if (fileName.toLowerCase().endsWith(extension)) {
          return true;
        }
      } // Check for exact MIME type
      else if (mimeType.toLowerCase() === accepted) {
        return true;
      }
    }

    return false;
  }

  /**
   * Escape selector string for use in JavaScript
   */
  private escapeSelector(selector: string): string {
    return selector.replace(/'/g, "\\'").replace(/"/g, '\\"');
  }

  /**
   * Escape string for use in JavaScript
   */
  private escapeString(str: string): string {
    return str
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r");
  }

  /**
   * Infer MIME type from file extension
   */
  private inferMimeType(fileName: string): string {
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    const mimeTypes: Record<string, string> = {
      // Images
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml",
      ico: "image/x-icon",
      bmp: "image/bmp",
      tiff: "image/tiff",
      tif: "image/tiff",
      // Documents
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ppt: "application/vnd.ms-powerpoint",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      odt: "application/vnd.oasis.opendocument.text",
      ods: "application/vnd.oasis.opendocument.spreadsheet",
      // Text
      txt: "text/plain",
      csv: "text/csv",
      json: "application/json",
      xml: "application/xml",
      html: "text/html",
      htm: "text/html",
      css: "text/css",
      js: "application/javascript",
      ts: "application/typescript",
      md: "text/markdown",
      // Archives
      zip: "application/zip",
      rar: "application/vnd.rar",
      "7z": "application/x-7z-compressed",
      tar: "application/x-tar",
      gz: "application/gzip",
      // Audio
      mp3: "audio/mpeg",
      wav: "audio/wav",
      ogg: "audio/ogg",
      flac: "audio/flac",
      aac: "audio/aac",
      // Video
      mp4: "video/mp4",
      webm: "video/webm",
      avi: "video/x-msvideo",
      mov: "video/quicktime",
      mkv: "video/x-matroska",
      // Other
      exe: "application/x-msdownload",
      dmg: "application/x-apple-diskimage",
      iso: "application/x-iso9660-image",
    };

    return mimeTypes[ext] || "application/octet-stream";
  }

  /**
   * Execute a multi-step form workflow
   */
  async executeMultiStepForm(
    initialFormSelector: string,
    config: MultiStepFormConfig,
  ): Promise<FormSubmitResult> {
    const {
      steps,
      nextButtonSelector =
        'button:contains("Next"), button:contains("Continue"), [type="submit"]:contains("Next")',
      maxSteps = 10,
      stepTimeout = 30000,
    } = config;

    let currentStep = 0;

    for (const step of steps) {
      if (currentStep >= maxSteps) {
        return {
          success: false,
          finalUrl: this.page.getCurrentURL() || "",
          error: `Maximum steps (${maxSteps}) exceeded`,
        };
      }

      try {
        // Fill the current step
        await this.fillForm(initialFormSelector, step.fillData);

        // Run custom validation if provided
        if (step.validate) {
          const isValid = await step.validate(this.page);
          if (!isValid) {
            return {
              success: false,
              finalUrl: this.page.getCurrentURL() || "",
              error: `Validation failed at step ${currentStep + 1}`,
            };
          }
        }

        // Determine if this is the last step
        const isLastStep = currentStep === steps.length - 1;

        if (isLastStep) {
          // Submit the form
          return await this.submitForm(initialFormSelector, {
            waitForNavigation: true,
            timeout: stepTimeout,
          });
        } else {
          // Click next button
          try {
            await this.page.click(nextButtonSelector);
          } catch {
            // Try finding a visible next/continue button
            console.warn("Next button not found, attempting to continue...");
          }

          // Wait for step transition
          if (step.waitFor) {
            await this.page.wait({
              type: "selector",
              selector: step.waitFor,
              timeout: stepTimeout,
            });
          } else {
            // Default wait
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }

        currentStep++;
      } catch (error) {
        return {
          success: false,
          finalUrl: this.page.getCurrentURL() || "",
          error: `Step ${currentStep + 1} failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        };
      }
    }

    return {
      success: true,
      finalUrl: this.page.getCurrentURL() || "",
    };
  }

  /**
   * Auto-fill a form based on field types and provided data
   */
  async autoFill(
    formSelector: string,
    data: Record<string, string>,
    options: FormFillOptions = {},
  ): Promise<{ filled: string[]; skipped: string[] }> {
    const filled: string[] = [];
    const skipped: string[] = [];

    // Detect form fields
    const fields = await this.detectFields(formSelector);

    for (const field of fields) {
      // Skip hidden, disabled, readonly fields
      if (field.type === "hidden") {
        skipped.push(field.name);
        continue;
      }
      if (options.skipDisabled && field.disabled) {
        skipped.push(field.name);
        continue;
      }
      if (options.skipReadonly && field.readonly) {
        skipped.push(field.name);
        continue;
      }

      // Try to find matching data
      const value = data[field.name] || data[field.id] || this.inferFieldValue(field, data);

      if (value !== undefined) {
        try {
          await this.fillForm(formSelector, { [field.name || field.id]: value }, options);
          filled.push(field.name || field.id);
        } catch {
          skipped.push(field.name || field.id);
        }
      } else {
        skipped.push(field.name || field.id);
      }
    }

    return { filled, skipped };
  }

  /**
   * Infer field value based on field type and common patterns
   */
  private inferFieldValue(field: FormField, data: Record<string, string>): string | undefined {
    const fieldName = (field.name || field.label || "").toLowerCase();

    // Try to match by common field name patterns
    const patterns: Record<string, string[]> = {
      email: ["email", "e-mail", "mail"],
      name: ["name", "fullname", "full_name", "full-name"],
      firstName: ["firstname", "first_name", "first-name", "fname", "given_name"],
      lastName: ["lastname", "last_name", "last-name", "lname", "family_name"],
      phone: ["phone", "tel", "telephone", "mobile", "cell"],
      address: ["address", "street", "addr"],
      city: ["city", "town"],
      state: ["state", "province", "region"],
      zip: ["zip", "zipcode", "postal", "postcode"],
      country: ["country", "nation"],
      company: ["company", "organization", "org"],
      username: ["username", "user", "login"],
      password: ["password", "pass", "pwd"],
    };

    for (const [key, fieldPatterns] of Object.entries(patterns)) {
      if (fieldPatterns.some((p) => fieldName.includes(p)) && data[key]) {
        return data[key];
      }
    }

    // Check by field type
    if (field.type === "email" && data.email) {
      return data.email;
    }
    if (field.type === "tel" && (data.phone || data.tel)) {
      return data.phone || data.tel;
    }
    if (field.type === "url" && (data.url || data.website)) {
      return data.url || data.website;
    }

    return undefined;
  }
}

/**
 * Create a FormAutomation instance for a page
 */
export function createFormAutomation(page: BrowserPage): FormAutomation {
  return new FormAutomation(page);
}

/**
 * Form Controller
 *
 * Bridges the query engine with browser form automation capabilities.
 * Provides form detection, filling, and submission for query execution.
 */

import type { BrowserPage } from "@browserx/browser";
import {
  FormAutomation,
  createFormAutomation,
  type DetectedForm,
  type FormField,
  type FormFillData,
  type FormFillOptions,
  type FormSubmitOptions,
  type FormSubmitResult,
  type MultiStepFormConfig,
  type FileUploadInfo,
} from "@browserx/browser";
import { getCurrentBrowserController } from "./browser-context.ts";

/**
 * Form detection result
 */
export interface FormDetectionResult {
  /** All detected forms */
  forms: DetectedForm[];
  /** The primary/most important form */
  primaryForm: DetectedForm | null;
  /** Total number of forms found */
  count: number;
}

/**
 * Form fill result
 */
export interface FormFillResult {
  /** Whether fill was successful */
  success: boolean;
  /** Fields that were filled */
  filledFields: string[];
  /** Fields that were skipped */
  skippedFields: string[];
  /** Validation errors */
  validationErrors: Record<string, string>;
}

/**
 * Form Controller for query engine integration
 */
export class FormController {
  private formAutomation: FormAutomation | null = null;

  /**
   * Get or create FormAutomation instance
   */
  private async getFormAutomation(): Promise<FormAutomation> {
    if (this.formAutomation) {
      return this.formAutomation;
    }

    const browserController = getCurrentBrowserController();
    if (!browserController) {
      throw new Error("Browser context not initialized. Navigate to a page first.");
    }

    const page = browserController.getCurrentPage();
    if (!page) {
      throw new Error("No page available in browser context.");
    }

    this.formAutomation = createFormAutomation(page as unknown as BrowserPage);
    return this.formAutomation;
  }

  /**
   * Detect all forms on the current page
   */
  async detectForms(): Promise<FormDetectionResult> {
    const automation = await this.getFormAutomation();
    const forms = await automation.detectForms();
    const primaryForm = await automation.detectPrimaryForm();

    return {
      forms,
      primaryForm,
      count: forms.length,
    };
  }

  /**
   * Get fields for a specific form
   */
  async getFormFields(formSelector?: string): Promise<FormField[]> {
    const automation = await this.getFormAutomation();

    if (formSelector) {
      const forms = await automation.detectForms();
      const targetForm = forms.find(f => f.selector === formSelector);
      return targetForm?.fields || [];
    }

    // Get fields from primary form
    const primaryForm = await automation.detectPrimaryForm();
    return primaryForm?.fields || [];
  }

  /**
   * Fill a form with provided data
   */
  async fillForm(
    data: FormFillData,
    formSelector?: string,
    options: FormFillOptions = {}
  ): Promise<FormFillResult> {
    const automation = await this.getFormAutomation();

    // Determine form selector
    let selector = formSelector;
    if (!selector) {
      const primaryForm = await automation.detectPrimaryForm();
      if (!primaryForm) {
        return {
          success: false,
          filledFields: [],
          skippedFields: Object.keys(data),
          validationErrors: { _form: "No form found on page" },
        };
      }
      selector = primaryForm.selector;
    }

    try {
      await automation.fillForm(selector, data, options);

      // Validate after fill
      const validationErrors = options.validate
        ? await automation.validateForm(selector)
        : {};

      return {
        success: Object.keys(validationErrors).length === 0,
        filledFields: Object.keys(data),
        skippedFields: [],
        validationErrors,
      };
    } catch (error) {
      return {
        success: false,
        filledFields: [],
        skippedFields: Object.keys(data),
        validationErrors: {
          _error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Auto-fill a form based on field type inference
   */
  async autoFillForm(
    data: Record<string, string>,
    formSelector?: string,
    options: FormFillOptions = {}
  ): Promise<FormFillResult> {
    const automation = await this.getFormAutomation();

    // Determine form selector
    let selector = formSelector;
    if (!selector) {
      const primaryForm = await automation.detectPrimaryForm();
      if (!primaryForm) {
        return {
          success: false,
          filledFields: [],
          skippedFields: Object.keys(data),
          validationErrors: { _form: "No form found on page" },
        };
      }
      selector = primaryForm.selector;
    }

    try {
      const result = await automation.autoFill(selector, data, options);

      // Validate after fill
      const validationErrors = options.validate
        ? await automation.validateForm(selector)
        : {};

      return {
        success: result.filled.length > 0 && Object.keys(validationErrors).length === 0,
        filledFields: result.filled,
        skippedFields: result.skipped,
        validationErrors,
      };
    } catch (error) {
      return {
        success: false,
        filledFields: [],
        skippedFields: Object.keys(data),
        validationErrors: {
          _error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Submit a form
   */
  async submitForm(
    formSelector?: string,
    options: FormSubmitOptions = {}
  ): Promise<FormSubmitResult> {
    const automation = await this.getFormAutomation();

    // Determine form selector
    let selector = formSelector;
    if (!selector) {
      const primaryForm = await automation.detectPrimaryForm();
      if (!primaryForm) {
        return {
          success: false,
          finalUrl: "",
          error: "No form found on page",
        };
      }
      selector = primaryForm.selector;
    }

    return await automation.submitForm(selector, options);
  }

  /**
   * Fill and submit a form in one operation
   */
  async fillAndSubmit(
    data: FormFillData,
    formSelector?: string,
    fillOptions: FormFillOptions = {},
    submitOptions: FormSubmitOptions = {}
  ): Promise<FormSubmitResult> {
    // Fill the form
    const fillResult = await this.fillForm(data, formSelector, fillOptions);

    if (!fillResult.success && fillOptions.validate) {
      return {
        success: false,
        finalUrl: "",
        error: "Form validation failed",
        validationErrors: fillResult.validationErrors,
      };
    }

    // Submit the form
    return await this.submitForm(formSelector, submitOptions);
  }

  /**
   * Execute a multi-step form workflow
   */
  async executeMultiStepForm(
    config: MultiStepFormConfig,
    initialFormSelector?: string
  ): Promise<FormSubmitResult> {
    const automation = await this.getFormAutomation();

    // Determine form selector
    let selector = initialFormSelector;
    if (!selector) {
      const primaryForm = await automation.detectPrimaryForm();
      if (!primaryForm) {
        return {
          success: false,
          finalUrl: "",
          error: "No form found on page",
        };
      }
      selector = primaryForm.selector;
    }

    return await automation.executeMultiStepForm(selector, config);
  }

  /**
   * Upload a file to a file input field
   */
  async uploadFile(
    fieldSelector: string,
    fileInfo: FileUploadInfo
  ): Promise<boolean> {
    const automation = await this.getFormAutomation();

    try {
      await automation.uploadFile(fieldSelector, fileInfo);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a form has CAPTCHA
   */
  async hasCaptcha(formSelector?: string): Promise<{
    hasCaptcha: boolean;
    captchaType: "recaptcha" | "hcaptcha" | "turnstile" | "custom" | null;
  }> {
    const automation = await this.getFormAutomation();

    // Determine form selector
    let selector = formSelector;
    if (!selector) {
      const primaryForm = await automation.detectPrimaryForm();
      if (!primaryForm) {
        return { hasCaptcha: false, captchaType: null };
      }
      selector = primaryForm.selector;
    }

    const forms = await automation.detectForms();
    const targetForm = forms.find(f => f.selector === selector);

    if (!targetForm) {
      return { hasCaptcha: false, captchaType: null };
    }

    return {
      hasCaptcha: targetForm.hasCaptcha,
      captchaType: targetForm.captchaType,
    };
  }

  /**
   * Validate form fields without submitting
   */
  async validateForm(formSelector?: string): Promise<Record<string, string>> {
    const automation = await this.getFormAutomation();

    // Determine form selector
    let selector = formSelector;
    if (!selector) {
      const primaryForm = await automation.detectPrimaryForm();
      if (!primaryForm) {
        return { _form: "No form found on page" };
      }
      selector = primaryForm.selector;
    }

    return await automation.validateForm(selector);
  }

  /**
   * Get field value by selector
   */
  async getFieldValue(fieldSelector: string): Promise<string | null> {
    const browserController = getCurrentBrowserController();
    if (!browserController) {
      return null;
    }

    const page = browserController.getCurrentPage();
    if (!page) {
      return null;
    }

    try {
      const elements = await page.query(fieldSelector);
      if (elements.length === 0) {
        return null;
      }
      return await elements[0].getProperty("value") as string;
    } catch {
      return null;
    }
  }

  /**
   * Set field value by selector
   */
  async setFieldValue(
    fieldSelector: string,
    value: string,
    options: { clear?: boolean; delay?: number } = {}
  ): Promise<boolean> {
    const browserController = getCurrentBrowserController();
    if (!browserController) {
      return false;
    }

    const page = browserController.getCurrentPage();
    if (!page) {
      return false;
    }

    try {
      if (options.clear) {
        // Clear the field first
        await page.click(fieldSelector);
        await page.type(fieldSelector, "", { clear: true });
      }
      await page.type(fieldSelector, value, { delay: options.delay });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Click a button or element
   */
  async clickElement(selector: string): Promise<boolean> {
    const browserController = getCurrentBrowserController();
    if (!browserController) {
      return false;
    }

    const page = browserController.getCurrentPage();
    if (!page) {
      return false;
    }

    try {
      await page.click(selector);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clear form automation instance (for cleanup)
   */
  clear(): void {
    this.formAutomation = null;
  }
}

// Singleton instance
let formControllerInstance: FormController | null = null;

/**
 * Get the form controller instance
 */
export function getFormController(): FormController {
  if (!formControllerInstance) {
    formControllerInstance = new FormController();
  }
  return formControllerInstance;
}

/**
 * Clear the form controller instance
 */
export function clearFormController(): void {
  if (formControllerInstance) {
    formControllerInstance.clear();
    formControllerInstance = null;
  }
}

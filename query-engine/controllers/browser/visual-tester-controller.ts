/**
 * Visual Tester Controller
 *
 * Bridges the query engine with browser visual testing capabilities.
 * Provides screenshot capture, comparison, and layout verification for query execution.
 */

import type { BrowserPage } from "@browserx/browser";
import {
  VisualTester,
  createVisualTester,
  type ScreenshotConfig,
  type ScreenshotResult,
  type ComparisonOptions,
  type ComparisonResult,
  type VisibilityResult,
  type LayoutCheckResult,
  type SnapshotMetadata,
} from "@browserx/browser";
import { getCurrentBrowserController } from "./browser-context.ts";

/**
 * Visual assertion result
 */
export interface VisualAssertionResult {
  /** Whether the assertion passed */
  passed: boolean;
  /** Assertion type */
  assertionType: string;
  /** Description of what was checked */
  description: string;
  /** Details about the result */
  details: Record<string, unknown>;
  /** Error message if failed */
  error?: string;
  /** Screenshot data if captured */
  screenshot?: string;
}

/**
 * Visual Tester Controller for query engine integration
 */
export class VisualTesterController {
  private visualTester: VisualTester | null = null;

  /**
   * Get or create VisualTester instance
   */
  private async getVisualTester(): Promise<VisualTester> {
    if (this.visualTester) {
      return this.visualTester;
    }

    const browserController = getCurrentBrowserController();
    if (!browserController) {
      throw new Error("Browser context not initialized. Navigate to a page first.");
    }

    const page = browserController.getCurrentPage();
    if (!page) {
      throw new Error("No page available in browser context.");
    }

    this.visualTester = createVisualTester(page as unknown as BrowserPage);
    return this.visualTester;
  }

  /**
   * Take a screenshot of the current page
   */
  async screenshot(config: ScreenshotConfig = {}): Promise<ScreenshotResult> {
    const tester = await this.getVisualTester();
    return tester.screenshot(config);
  }

  /**
   * Take a screenshot of a specific element
   */
  async screenshotElement(selector: string, config: Omit<ScreenshotConfig, "selector"> = {}): Promise<ScreenshotResult> {
    const tester = await this.getVisualTester();
    return tester.screenshotElement(selector, config);
  }

  /**
   * Compare two images
   */
  async compare(
    image1: string | Uint8Array,
    image2: string | Uint8Array,
    options: ComparisonOptions = {}
  ): Promise<ComparisonResult> {
    const tester = await this.getVisualTester();
    return tester.compare(image1, image2, options);
  }

  /**
   * Compare current page with a baseline
   */
  async compareWithBaseline(
    baselineName: string,
    config: ScreenshotConfig = {},
    options: ComparisonOptions = {}
  ): Promise<ComparisonResult & { baselineExists: boolean }> {
    const tester = await this.getVisualTester();
    return tester.compareWithBaseline(baselineName, config, options);
  }

  /**
   * Save current page as a baseline snapshot
   */
  async saveBaseline(
    name: string,
    config: ScreenshotConfig = {},
    metadata?: Record<string, unknown>
  ): Promise<SnapshotMetadata> {
    const tester = await this.getVisualTester();
    return tester.saveBaseline(name, config, metadata);
  }

  /**
   * Get a stored baseline
   */
  async getBaseline(name: string): Promise<{ data: string; metadata: SnapshotMetadata } | null> {
    const tester = await this.getVisualTester();
    return tester.getBaseline(name);
  }

  /**
   * Delete a stored baseline
   */
  async deleteBaseline(name: string): Promise<boolean> {
    const tester = await this.getVisualTester();
    return tester.deleteBaseline(name);
  }

  /**
   * List all stored baselines
   */
  async listBaselines(): Promise<SnapshotMetadata[]> {
    const tester = await this.getVisualTester();
    return tester.listBaselines();
  }

  /**
   * Check element visibility
   */
  async checkVisibility(selector: string): Promise<VisibilityResult> {
    const tester = await this.getVisualTester();
    return tester.checkVisibility(selector);
  }

  /**
   * Check if element is visible
   */
  async isVisible(selector: string): Promise<boolean> {
    const result = await this.checkVisibility(selector);
    return result.visible;
  }

  /**
   * Check if element exists
   */
  async exists(selector: string): Promise<boolean> {
    const result = await this.checkVisibility(selector);
    return result.exists;
  }

  /**
   * Check if element is in viewport
   */
  async isInViewport(selector: string): Promise<boolean> {
    const result = await this.checkVisibility(selector);
    return result.inViewport;
  }

  /**
   * Verify element layout
   */
  async verifyLayout(
    selector: string,
    expected: {
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      minWidth?: number;
      maxWidth?: number;
      minHeight?: number;
      maxHeight?: number;
    },
    tolerance?: number
  ): Promise<LayoutCheckResult> {
    const tester = await this.getVisualTester();
    return tester.verifyLayout(selector, expected, tolerance);
  }

  /**
   * Verify relative positioning of two elements
   */
  async verifyRelativePosition(
    selector1: string,
    selector2: string,
    relationship: "above" | "below" | "left" | "right" | "overlapping" | "adjacent",
    tolerance?: number
  ): Promise<{ passed: boolean; details: string }> {
    const tester = await this.getVisualTester();
    return tester.verifyRelativePosition(selector1, selector2, relationship, tolerance);
  }

  /**
   * Wait for visual stability
   */
  async waitForVisualStability(timeout?: number, checkInterval?: number): Promise<boolean> {
    const tester = await this.getVisualTester();
    return tester.waitForVisualStability(timeout, checkInterval);
  }

  /**
   * Assert that element is visible
   */
  async assertVisible(selector: string): Promise<VisualAssertionResult> {
    const result = await this.checkVisibility(selector);

    return {
      passed: result.visible,
      assertionType: "visible",
      description: `Element ${selector} should be visible`,
      details: result as unknown as Record<string, unknown>,
      error: result.visible ? undefined : `Element ${selector} is not visible`,
    };
  }

  /**
   * Assert that element is not visible
   */
  async assertNotVisible(selector: string): Promise<VisualAssertionResult> {
    const result = await this.checkVisibility(selector);

    return {
      passed: !result.visible,
      assertionType: "notVisible",
      description: `Element ${selector} should not be visible`,
      details: result as unknown as Record<string, unknown>,
      error: !result.visible ? undefined : `Element ${selector} is visible`,
    };
  }

  /**
   * Assert that element exists
   */
  async assertExists(selector: string): Promise<VisualAssertionResult> {
    const result = await this.checkVisibility(selector);

    return {
      passed: result.exists,
      assertionType: "exists",
      description: `Element ${selector} should exist`,
      details: result as unknown as Record<string, unknown>,
      error: result.exists ? undefined : `Element ${selector} does not exist`,
    };
  }

  /**
   * Assert that screenshot matches baseline
   */
  async assertMatchesBaseline(
    baselineName: string,
    config: ScreenshotConfig = {},
    options: ComparisonOptions = {}
  ): Promise<VisualAssertionResult> {
    const result = await this.compareWithBaseline(baselineName, config, options);

    if (!result.baselineExists) {
      return {
        passed: false,
        assertionType: "matchesBaseline",
        description: `Screenshot should match baseline "${baselineName}"`,
        details: { baselineExists: false },
        error: `Baseline "${baselineName}" does not exist`,
      };
    }

    return {
      passed: result.match,
      assertionType: "matchesBaseline",
      description: `Screenshot should match baseline "${baselineName}"`,
      details: {
        match: result.match,
        diffPercentage: result.diffPercentage,
        diffPixelCount: result.diffPixelCount,
      },
      error: result.match
        ? undefined
        : `Screenshot differs from baseline by ${result.diffPercentage.toFixed(2)}%`,
      screenshot: result.diffImage,
    };
  }

  /**
   * Assert element layout matches expectations
   */
  async assertLayout(
    selector: string,
    expected: {
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      minWidth?: number;
      maxWidth?: number;
      minHeight?: number;
      maxHeight?: number;
    },
    tolerance?: number
  ): Promise<VisualAssertionResult> {
    const result = await this.verifyLayout(selector, expected, tolerance);

    return {
      passed: result.passed,
      assertionType: "layout",
      description: `Element ${selector} should match expected layout`,
      details: {
        actual: result.actual,
        expected: result.expected,
        differences: result.differences,
      },
      error: result.passed
        ? undefined
        : `Layout mismatch: ${result.differences.join("; ")}`,
    };
  }

  /**
   * Assert relative positioning of elements
   */
  async assertRelativePosition(
    selector1: string,
    selector2: string,
    relationship: "above" | "below" | "left" | "right" | "overlapping" | "adjacent",
    tolerance?: number
  ): Promise<VisualAssertionResult> {
    const result = await this.verifyRelativePosition(selector1, selector2, relationship, tolerance);

    return {
      passed: result.passed,
      assertionType: "relativePosition",
      description: `Element ${selector1} should be ${relationship} ${selector2}`,
      details: { relationship, details: result.details },
      error: result.passed ? undefined : result.details,
    };
  }

  /**
   * Run multiple visual assertions
   */
  async runAssertions(
    assertions: Array<{
      type: "visible" | "notVisible" | "exists" | "matchesBaseline" | "layout" | "relativePosition";
      selector?: string;
      selector2?: string;
      baselineName?: string;
      expected?: Record<string, unknown>;
      relationship?: "above" | "below" | "left" | "right" | "overlapping" | "adjacent";
      tolerance?: number;
      options?: ComparisonOptions;
      config?: ScreenshotConfig;
    }>
  ): Promise<{
    passed: boolean;
    results: VisualAssertionResult[];
    passedCount: number;
    failedCount: number;
  }> {
    const results: VisualAssertionResult[] = [];

    for (const assertion of assertions) {
      let result: VisualAssertionResult;

      switch (assertion.type) {
        case "visible":
          result = await this.assertVisible(assertion.selector!);
          break;
        case "notVisible":
          result = await this.assertNotVisible(assertion.selector!);
          break;
        case "exists":
          result = await this.assertExists(assertion.selector!);
          break;
        case "matchesBaseline":
          result = await this.assertMatchesBaseline(
            assertion.baselineName!,
            assertion.config,
            assertion.options
          );
          break;
        case "layout":
          result = await this.assertLayout(
            assertion.selector!,
            assertion.expected as { width?: number; height?: number },
            assertion.tolerance
          );
          break;
        case "relativePosition":
          result = await this.assertRelativePosition(
            assertion.selector!,
            assertion.selector2!,
            assertion.relationship!,
            assertion.tolerance
          );
          break;
        default:
          result = {
            passed: false,
            assertionType: "unknown",
            description: "Unknown assertion type",
            details: {},
            error: `Unknown assertion type: ${assertion.type}`,
          };
      }

      results.push(result);
    }

    const passedCount = results.filter(r => r.passed).length;
    const failedCount = results.filter(r => !r.passed).length;

    return {
      passed: failedCount === 0,
      results,
      passedCount,
      failedCount,
    };
  }

  /**
   * Clear the visual tester instance (for cleanup)
   */
  clear(): void {
    this.visualTester = null;
  }
}

// Singleton instance
let visualTesterControllerInstance: VisualTesterController | null = null;

/**
 * Get the visual tester controller instance
 */
export function getVisualTesterController(): VisualTesterController {
  if (!visualTesterControllerInstance) {
    visualTesterControllerInstance = new VisualTesterController();
  }
  return visualTesterControllerInstance;
}

/**
 * Clear the visual tester controller instance
 */
export function clearVisualTesterController(): void {
  if (visualTesterControllerInstance) {
    visualTesterControllerInstance.clear();
    visualTesterControllerInstance = null;
  }
}

// Re-export types for convenience
export type {
  ScreenshotConfig,
  ScreenshotResult,
  ComparisonOptions,
  ComparisonResult,
  VisibilityResult,
  LayoutCheckResult,
  SnapshotMetadata,
};

/**
 * Execution planner
 * Converts optimized AST into executable plan
 */

import {
  ArrayExpression,
  BinaryExpression,
  BinaryOperator,
  CallExpression,
  ClickStatement,
  DeleteStatement,
  Expression,
  ForStatement,
  Identifier,
  IfStatement,
  InsertStatement,
  Literal,
  MemberExpression,
  NavigateStatement,
  ObjectExpression,
  PdfStatement,
  ScreenshotStatement,
  SelectStatement,
  SetStatement,
  ShowStatement,
  Statement,
  UnaryExpression,
  UpdateStatement,
  WaitStatement,
} from "../types/ast.ts";
import { QueryID } from "../types/primitives.ts";
import {
  AssignStep,
  BranchStep,
  ClickStep,
  DOMQueryStep,
  EvaluateJSStep,
  ExecutionPlan,
  ExecutionStep,
  ExecutionStepType,
  FilterStep,
  LimitStep,
  LoopStep,
  NavigateStep,
  ParallelStep,
  PDFStep,
  ReadVariableStep,
  ResourceRequirements,
  ScreenshotStep,
  SortStep,
  TypeStep,
  WaitStep,
} from "./plan.ts";
import { DependencyGraphBuilder } from "./dependency-graph.ts";
import { escapeSelector } from "../utils/string-utils.ts";

/**
 * Escape a string for safe use in JavaScript string literals
 * Prevents injection attacks by escaping special characters
 */
function escapeJsString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')  // Escape backslashes first
    .replace(/'/g, "\\'")    // Escape single quotes
    .replace(/"/g, '\\"')    // Escape double quotes
    .replace(/\n/g, '\\n')   // Escape newlines
    .replace(/\r/g, '\\r')   // Escape carriage returns
    .replace(/\t/g, '\\t')   // Escape tabs
    .replace(/\x00/g, '\\0') // Escape null bytes
    .replace(/\u2028/g, '\\u2028') // Escape line separator
    .replace(/\u2029/g, '\\u2029'); // Escape paragraph separator
}

/**
 * Validate and sanitize a CSS selector to prevent injection
 */
function sanitizeSelector(selector: string): string {
  // Check for null bytes (can be used for injection attacks)
  if (selector.includes('\x00')) {
    throw new Error('Invalid selector: contains null bytes');
  }

  // Check for XSS patterns (script tags, javascript: URLs, event handlers)
  const xssPatterns = /<script|javascript:|on\w+=/gi;
  if (xssPatterns.test(selector)) {
    throw new Error('Invalid selector: contains dangerous XSS content');
  }

  // Check for code execution patterns in attribute selectors
  // Prevents [attr=eval(...)] or [attr=Function(...)] style attacks
  const codePatterns = /\[\s*[^\]]*(?:eval|function|constructor|__proto__|prototype)\s*[^\]]*\]/gi;
  if (codePatterns.test(selector)) {
    throw new Error('Invalid selector: contains code execution patterns');
  }

  // Validate balanced brackets to prevent escape attacks
  let bracketCount = 0;
  for (const char of selector) {
    if (char === '[') bracketCount++;
    if (char === ']') bracketCount--;
    if (bracketCount < 0) {
      throw new Error('Invalid selector: unbalanced brackets');
    }
  }
  if (bracketCount !== 0) {
    throw new Error('Invalid selector: unbalanced brackets');
  }

  return escapeSelector(selector);
}

/**
 * Validate and sanitize a property name
 */
function sanitizePropertyName(property: string): string {
  // Property names should only contain valid identifier characters
  if (!/^[a-zA-Z_$][a-zA-Z0-9_$-]*$/.test(property)) {
    throw new Error(`Invalid property name: ${property}`);
  }
  return escapeJsString(property);
}

/**
 * Convert SQL LIKE pattern to JavaScript regex pattern
 * % -> .* (match any characters)
 * _ -> . (match single character)
 * Escape special regex characters
 */
function likePatternToRegex(pattern: string): string {
  // Escape special regex characters first (except % and _)
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Convert SQL wildcards to regex
  const regexPattern = escaped
    .replace(/%/g, '.*')
    .replace(/_/g, '.');
  return `^${regexPattern}$`;
}

/**
 * Execution planner
 */
export class ExecutionPlanner {
  private dependencyGraphBuilder: DependencyGraphBuilder;
  private stepCounter: number;
  private currentSteps: ExecutionStep[];

  constructor() {
    this.dependencyGraphBuilder = new DependencyGraphBuilder();
    this.stepCounter = 0;
    this.currentSteps = [];
  }

  /**
   * Create execution plan from statement
   */
  plan(stmt: Statement, metadata?: {
    optimizationApplied: boolean;
    appliedPasses: string[];
    estimatedImprovement: number;
  }): ExecutionPlan {
    // Reset state
    this.stepCounter = 0;
    this.currentSteps = [];

    // Generate steps from statement
    this.generateSteps(stmt);

    // Build dependency graph
    const dependencies = this.dependencyGraphBuilder.build(this.currentSteps);

    // Find parallel execution opportunities
    const parallelGroups = this.dependencyGraphBuilder.findParallelGroups(dependencies);

    // Wrap multi-step parallel groups as ParallelStep nodes for the executor
    for (const group of parallelGroups) {
      if (group.length > 1) {
        const groupSteps = group
          .map((id: string) => this.currentSteps.find((s) => s.id === id))
          .filter((s): s is ExecutionStep => s !== undefined);
        if (groupSteps.length > 1) {
          const pStep = this.createParallelStep(groupSteps, []);
          // Replace the individual steps with the parallel wrapper
          const firstIdx = this.currentSteps.indexOf(groupSteps[0]);
          if (firstIdx >= 0) {
            // Remove individual steps and insert parallel wrapper at first position
            for (const gs of groupSteps) {
              const idx = this.currentSteps.indexOf(gs);
              if (idx >= 0) this.currentSteps.splice(idx, 1);
            }
            this.currentSteps.splice(firstIdx, 0, pStep);
          }
        }
      }
    }

    const estimatedCost = this.estimateTotalCost(this.currentSteps, dependencies);

    // Calculate resource requirements
    const resources = this.calculateResourceRequirements(this.currentSteps);

    // Find cacheable steps
    const cacheableSteps = this.currentSteps
      .filter((step) => step.cacheable)
      .map((step) => step.id);

    const plan: ExecutionPlan = {
      id: this.generatePlanId(),
      query: stmt,
      steps: this.currentSteps,
      estimatedCost,
      resources,
      dependencies,
      cacheableSteps,
      parallelGroups,
      metadata: metadata || {
        optimizationApplied: false,
        appliedPasses: [],
        estimatedImprovement: 0,
      },
    };

    return plan;
  }

  /**
   * Generate execution steps from a statement
   */
  private generateSteps(stmt: Statement, dependencies: string[] = []): string {
    switch (stmt.type) {
      case "SELECT":
        return this.generateSelectSteps(stmt as SelectStatement, dependencies);

      case "NAVIGATE":
        return this.generateNavigateSteps(stmt as NavigateStatement, dependencies);

      case "SET":
        return this.generateSetSteps(stmt as SetStatement, dependencies);

      case "FOR":
        return this.generateForSteps(stmt as ForStatement, dependencies);

      case "IF":
        return this.generateIfSteps(stmt as IfStatement, dependencies);

      case "INSERT":
        return this.generateInsertSteps(stmt as InsertStatement, dependencies);

      case "UPDATE":
        return this.generateUpdateSteps(stmt as UpdateStatement, dependencies);

      case "DELETE":
        return this.generateDeleteSteps(stmt as DeleteStatement, dependencies);

      case "SHOW":
        return this.generateShowSteps(stmt as ShowStatement, dependencies);

      case "CLICK":
        return this.generateClickSteps(stmt as ClickStatement, dependencies);

      case "WAIT":
        return this.generateWaitSteps(stmt as WaitStatement, dependencies);

      case "SCREENSHOT":
        return this.generateScreenshotSteps(stmt as ScreenshotStatement, dependencies);

      case "PDF":
        return this.generatePdfSteps(stmt as PdfStatement, dependencies);

      default:
        // Return a no-op step ID
        return "";
    }
  }

  /**
   * Generate steps for SELECT statement
   */
  private generateSelectSteps(stmt: SelectStatement, dependencies: string[]): string {
    const steps: string[] = [...dependencies];

    // If source is a URL, navigate first (unless it's actually a CSS selector)
    let cssSelectorSource: string | null = null;
    if (stmt.source.type === "URL") {
      const sourceValue = stmt.source.value as string;
      if (this.isCSSSelector(sourceValue)) {
        // CSS selector source — skip NAVIGATE, use selector directly in DOM_QUERY
        cssSelectorSource = sourceValue;
      } else {
        const navStep: NavigateStep = {
          id: this.generateStepId(),
          type: ExecutionStepType.NAVIGATE,
          url: sourceValue,
          estimatedCost: 500,
          dependencies: [...steps],  // Copy to avoid circular reference when steps is mutated
          cacheable: true,
          cacheKey: `nav:${sourceValue}`,
        };
        this.currentSteps.push(navStep);
        steps.push(navStep.id);
      }
    } else if (stmt.source.type === "SUBQUERY") {
      // Execute subquery first
      const subqueryStepId = this.generateSteps(stmt.source.value as Statement, steps);
      if (subqueryStepId) {
        steps.push(subqueryStepId);
      }
    }

    // DOM query step
    const domQueryStep: DOMQueryStep = {
      id: this.generateStepId(),
      type: ExecutionStepType.DOM_QUERY,
      selector: cssSelectorSource || this.extractSelector(stmt),
      selectorType: "css",
      extractFields: stmt.fields.map((f) => ({
        name: f.alias || f.name,
        expression: f.expression || {
          type: "IDENTIFIER",
          name: f.name,
        },
      })),
      filter: stmt.where,
      estimatedCost: 10,
      dependencies: [...steps],  // Copy to avoid circular reference
      cacheable: false,
    };
    this.currentSteps.push(domQueryStep);
    steps.push(domQueryStep.id);

    // Filter step if WHERE clause exists
    if (stmt.where) {
      const filterStep: FilterStep = {
        id: this.generateStepId(),
        type: ExecutionStepType.FILTER,
        predicate: stmt.where,
        inputVariable: "__query_result",
        outputVariable: "__filtered_result",
        estimatedCost: 5,
        dependencies: [domQueryStep.id],
        cacheable: false,
      };
      this.currentSteps.push(filterStep);
      steps.push(filterStep.id);
    }

    // Sort step if ORDER BY exists
    if (stmt.orderBy && stmt.orderBy.length > 0) {
      const sortStep: SortStep = {
        id: this.generateStepId(),
        type: ExecutionStepType.SORT,
        fields: stmt.orderBy.map((o) => ({
          field: o.field,
          direction: o.direction,
        })),
        inputVariable: "__filtered_result",
        outputVariable: "__sorted_result",
        estimatedCost: 10,
        dependencies: [...steps],  // Copy to avoid circular reference
        cacheable: false,
      };
      this.currentSteps.push(sortStep);
      steps.push(sortStep.id);
    }

    // Limit step if LIMIT exists
    if (stmt.limit) {
      const limitStep: LimitStep = {
        id: this.generateStepId(),
        type: ExecutionStepType.LIMIT,
        limit: stmt.limit.count,
        offset: stmt.limit.offset,
        inputVariable: "__sorted_result",
        outputVariable: "__final_result",
        estimatedCost: 1,
        dependencies: [...steps],  // Copy to avoid circular reference
        cacheable: false,
      };
      this.currentSteps.push(limitStep);
      return limitStep.id;
    }

    return steps[steps.length - 1];
  }

  /**
   * Generate steps for NAVIGATE statement
   */
  private generateNavigateSteps(stmt: NavigateStatement, dependencies: string[]): string {
    // Extract URL - can be a literal or an expression
    let url = "";
    if (stmt.url.type === "LITERAL") {
      url = stmt.url.value as string;
    }

    const navStep: NavigateStep = {
      id: this.generateStepId(),
      type: ExecutionStepType.NAVIGATE,
      url,
      urlExpression: stmt.url, // Store the expression for runtime evaluation
      options: stmt.options
        ? {
          waitFor: stmt.options.waitUntil,
          timeout: stmt.options.timeout,
          proxy: stmt.options.proxy
            ? {
              enabled: !!stmt.options.proxy.cache,
              cache: !!stmt.options.proxy.cache,
            }
            : undefined,
        }
        : undefined,
      estimatedCost: 500,
      dependencies,
      cacheable: url !== "", // Only cacheable if URL is known at compile time
      cacheKey: url ? `nav:${url}` : undefined,
    };

    this.currentSteps.push(navStep);

    // If capture clause exists, add DOM query
    if (stmt.capture) {
      const domQueryStep: DOMQueryStep = {
        id: this.generateStepId(),
        type: ExecutionStepType.DOM_QUERY,
        selector: "body", // Default selector
        selectorType: "css",
        extractFields: stmt.capture.fields.map((f) => ({
          name: f.alias || f.name,
          expression: f.expression || {
            type: "IDENTIFIER",
            name: f.name,
          },
        })),
        estimatedCost: 10,
        dependencies: [navStep.id],
        cacheable: false,
      };
      this.currentSteps.push(domQueryStep);
      return domQueryStep.id;
    }

    return navStep.id;
  }

  /**
   * Generate steps for SET statement
   */
  private generateSetSteps(stmt: SetStatement, dependencies: string[]): string {
    const assignStep: AssignStep = {
      id: this.generateStepId(),
      type: ExecutionStepType.ASSIGN,
      variable: stmt.path.join("."), // Convert path array to dot-separated string
      value: stmt.value,
      estimatedCost: 1,
      dependencies,
      cacheable: false,
    };

    this.currentSteps.push(assignStep);
    return assignStep.id;
  }

  /**
   * Generate steps for FOR loop
   */
  private generateForSteps(stmt: ForStatement, dependencies: string[]): string {
    // Generate body steps (will be wrapped in loop)
    const bodyStepIds: string[] = [];
    const savedSteps = this.currentSteps.length;

    // Temporarily generate body steps
    this.generateSteps(stmt.body, []);

    // Extract body steps and track their IDs
    const bodySteps = this.currentSteps.splice(savedSteps);
    for (const step of bodySteps) {
      bodyStepIds.push(step.id);
    }

    const loopStep: LoopStep = {
      id: this.generateStepId(),
      type: ExecutionStepType.LOOP,
      iteratorVariable: stmt.variable,
      collectionVariable: "__collection",
      collectionExpression: stmt.collection, // Store the expression for runtime evaluation
      bodySteps,
      estimatedCost: bodySteps.reduce((sum, s) => sum + s.estimatedCost, 0) * 10, // Assume 10 iterations
      dependencies,
      cacheable: false,
      parallel: false, // Conservative: no cross-iteration parallelism by default (bodyStepIds tracked for future optimization)
    };

    this.currentSteps.push(loopStep);
    return loopStep.id;
  }

  /**
   * Generate steps for IF statement
   */
  private generateIfSteps(stmt: IfStatement, dependencies: string[]): string {
    // Generate then branch steps
    const savedSteps = this.currentSteps.length;
    this.generateSteps(stmt.then, []);
    const thenSteps = this.currentSteps.splice(savedSteps);

    // Generate else branch steps
    let elseSteps: ExecutionStep[] = [];
    if (stmt.else) {
      const savedSteps2 = this.currentSteps.length;
      this.generateSteps(stmt.else, []);
      elseSteps = this.currentSteps.splice(savedSteps2);
    }

    const branchStep: BranchStep = {
      id: this.generateStepId(),
      type: ExecutionStepType.BRANCH,
      condition: stmt.condition,
      thenSteps,
      elseSteps: elseSteps.length > 0 ? elseSteps : undefined,
      estimatedCost: Math.max(
        thenSteps.reduce((sum, s) => sum + s.estimatedCost, 0),
        elseSteps.reduce((sum, s) => sum + s.estimatedCost, 0),
      ) / 2, // Average of both branches
      dependencies,
      cacheable: false,
    };

    this.currentSteps.push(branchStep);
    return branchStep.id;
  }

  /**
   * Generate steps for INSERT statement
   */
  private generateInsertSteps(stmt: InsertStatement, dependencies: string[]): string {
    const steps: string[] = [...dependencies];

    // Type step to input text
    const typeStep: TypeStep = {
      id: this.generateStepId(),
      type: ExecutionStepType.TYPE,
      selector: this.extractSelectorFromExpression(stmt.target) || "body",
      selectorType: "css",
      text: String(stmt.value.type === "LITERAL" ? (stmt.value as Literal).value : ""),
      clear: false,
      delay: 50, // Delay between keystrokes
      estimatedCost: 20,
      dependencies: [...steps],  // Copy for consistency with other steps
      cacheable: false,
    };

    this.currentSteps.push(typeStep);
    return typeStep.id;
  }

  /**
   * Generate steps for UPDATE statement
   */
  private generateUpdateSteps(stmt: UpdateStatement, dependencies: string[]): string {
    const steps: string[] = [...dependencies];

    // Evaluate JS to modify element properties
    const selector = this.extractSelectorFromExpression(stmt.target) || "body";

    for (const assignment of stmt.assignments) {
      const evalStep: EvaluateJSStep = {
        id: this.generateStepId(),
        type: ExecutionStepType.EVALUATE_JS,
        script: this.buildUpdateScript(selector, assignment.property, assignment.value),
        args: [],
        estimatedCost: 15,
        dependencies: [...steps],  // Copy to avoid circular reference when steps is mutated
        cacheable: false,
      };

      this.currentSteps.push(evalStep);
      steps.push(evalStep.id);
    }

    return steps[steps.length - 1];
  }

  /**
   * Generate steps for DELETE statement
   */
  private generateDeleteSteps(stmt: DeleteStatement, dependencies: string[]): string {
    const selector = this.extractSelectorFromExpression(stmt.target) || "body";

    // Sanitize selector to prevent injection
    const safeSelector = sanitizeSelector(selector);

    const evalStep: EvaluateJSStep = {
      id: this.generateStepId(),
      type: ExecutionStepType.EVALUATE_JS,
      script: `
      const elements = document.querySelectorAll('${safeSelector}');
      elements.forEach(el => el.remove());
      return elements.length;  // Return count of deleted elements
    `,
      args: [],
      estimatedCost: 10,
      dependencies,
      cacheable: false,
    };

    this.currentSteps.push(evalStep);
    return evalStep.id;
  }

  /**
   * Generate steps for SHOW statement
   */
  private generateShowSteps(stmt: ShowStatement, dependencies: string[]): string {
    // SHOW statements query engine state
    const readStep: ReadVariableStep = {
      id: this.generateStepId(),
      type: ExecutionStepType.READ_VARIABLE,
      variable: `__state_${stmt.target.toLowerCase()}`, // e.g., __state_cache, __state_cookies
      outputVariable: `__show_${stmt.target.toLowerCase()}_result`,
      estimatedCost: 1,
      dependencies,
      cacheable: false,
    };

    this.currentSteps.push(readStep);
    return readStep.id;
  }

  /**
   * Generate steps for CLICK statement
   */
  private generateClickSteps(stmt: ClickStatement, dependencies: string[]): string {
    const selector = this.extractSelectorFromExpression(stmt.selector) || "body";

    const clickStep: ClickStep = {
      id: this.generateStepId(),
      type: ExecutionStepType.CLICK,
      selector,
      selectorType: "css",
      waitForNavigation: stmt.options?.waitForNavigation,
      estimatedCost: 15,
      dependencies,
      cacheable: false,
    };

    this.currentSteps.push(clickStep);
    return clickStep.id;
  }

  /**
   * Generate steps for WAIT statement
   */
  private generateWaitSteps(stmt: WaitStatement, dependencies: string[]): string {
    const waitStep: WaitStep = {
      id: this.generateStepId(),
      type: ExecutionStepType.WAIT,
      waitType: stmt.waitType,
      duration: stmt.waitType === "time" && stmt.value.type === "LITERAL"
        ? (stmt.value as Literal).value as number
        : undefined,
      selector: stmt.waitType === "selector" && stmt.value.type === "LITERAL"
        ? String((stmt.value as Literal).value)
        : undefined,
      condition: stmt.waitType === "function" && stmt.value.type === "LITERAL"
        ? String((stmt.value as Literal).value)
        : undefined,
      estimatedCost: stmt.waitType === "time"
        ? (stmt.value.type === "LITERAL" ? (stmt.value as Literal).value as number : 1000)
        : 50,
      dependencies,
      cacheable: false,
    };

    this.currentSteps.push(waitStep);
    return waitStep.id;
  }

  /**
   * Generate steps for SCREENSHOT statement
   */
  private generateScreenshotSteps(stmt: ScreenshotStatement, dependencies: string[]): string {
    const screenshotStep: ScreenshotStep = {
      id: this.generateStepId(),
      type: ExecutionStepType.SCREENSHOT,
      fullPage: stmt.options?.fullPage,
      selector: stmt.options?.selector
        ? this.extractSelectorFromExpression(stmt.options.selector) || undefined
        : undefined,
      format: stmt.options?.format,
      quality: stmt.options?.quality,
      estimatedCost: 100,
      dependencies,
      cacheable: false,
    };

    this.currentSteps.push(screenshotStep);
    return screenshotStep.id;
  }

  /**
   * Generate steps for PDF statement
   */
  private generatePdfSteps(stmt: PdfStatement, dependencies: string[]): string {
    // Map format to supported PDFStep formats (A4 | Letter)
    const format = stmt.options?.format;
    const mappedFormat: "A4" | "Letter" | undefined =
      format === "A4" || format === "Letter" ? format :
      format === "Legal" || format === "A3" ? "Letter" : // Fallback for unsupported formats
      undefined;

    const pdfStep: PDFStep = {
      id: this.generateStepId(),
      type: ExecutionStepType.PDF,
      format: mappedFormat,
      landscape: stmt.options?.landscape,
      estimatedCost: 200,
      dependencies,
      cacheable: false,
    };

    this.currentSteps.push(pdfStep);
    return pdfStep.id;
  }

  /**
   * Convert an Expression AST node to JavaScript code string
   */
  private expressionToJavaScript(expr: Expression): string {
    switch (expr.type) {
      case "LITERAL": {
        const lit = expr as Literal;
        return JSON.stringify(lit.value);
      }

      case "IDENTIFIER": {
        const ident = expr as Identifier;
        // Sanitize identifier name to prevent injection
        const safeName = ident.name.replace(/[^a-zA-Z0-9_$]/g, "");
        // Block dangerous identifiers that could enable prototype pollution
        const dangerousIdentifiers = ["__proto__", "constructor", "prototype"];
        if (dangerousIdentifiers.includes(safeName)) {
          throw new Error(`Dangerous identifier not allowed: ${safeName}`);
        }
        return safeName;
      }

      case "BINARY": {
        const binary = expr as BinaryExpression;
        const left = this.expressionToJavaScript(binary.left);
        const right = this.expressionToJavaScript(binary.right);

        // Handle operators that require special JavaScript expressions
        switch (binary.operator) {
          case "LIKE": {
            // Convert LIKE pattern to regex and test
            if (binary.right.type === "LITERAL") {
              const pattern = String((binary.right as Literal).value);
              const regexPattern = likePatternToRegex(pattern);
              return `(new RegExp(${JSON.stringify(regexPattern)}, 'i').test(String(${left})))`;
            }
            // For dynamic patterns, use runtime conversion
            return "((function(text, pattern) {" +
              "var escaped = String(pattern).replace(/[.*+?^${}()|[\\\\]\\\\\\\\]/g, '\\\\$&');" +
              "var regexPattern = '^' + escaped.replace(/%/g, '.*').replace(/_/g, '.') + '$';" +
              "return new RegExp(regexPattern, 'i').test(String(text));" +
              "})(" + left + ", " + right + "))";
          }

          case "NOT LIKE": {
            if (binary.right.type === "LITERAL") {
              const pattern = String((binary.right as Literal).value);
              const regexPattern = likePatternToRegex(pattern);
              return `(!new RegExp(${JSON.stringify(regexPattern)}, 'i').test(String(${left})))`;
            }
            return "((function(text, pattern) {" +
              "var escaped = String(pattern).replace(/[.*+?^${}()|[\\\\]\\\\\\\\]/g, '\\\\$&');" +
              "var regexPattern = '^' + escaped.replace(/%/g, '.*').replace(/_/g, '.') + '$';" +
              "return !new RegExp(regexPattern, 'i').test(String(text));" +
              "})(" + left + ", " + right + "))";
          }

          case "MATCHES": {
            // MATCHES uses regex directly
            if (binary.right.type === "LITERAL") {
              const pattern = String((binary.right as Literal).value);
              return `(new RegExp(${JSON.stringify(pattern)}).test(String(${left})))`;
            }
            return `(new RegExp(${right}).test(String(${left})))`;
          }

          case "CONTAINS": {
            return `(String(${left}).includes(String(${right})))`;
          }

          case "IN": {
            // IN requires array check with proper semantics
            return `(Array.isArray(${right}) ? ${right}.some(item => item === ${left}) : false)`;
          }

          case "NOT IN": {
            // NOT IN requires negated array check
            return `(Array.isArray(${right}) ? !${right}.some(item => item === ${left}) : true)`;
          }

          default: {
            const op = this.binaryOperatorToJS(binary.operator);
            return `(${left} ${op} ${right})`;
          }
        }
      }

      case "UNARY": {
        const unary = expr as UnaryExpression;
        const operand = this.expressionToJavaScript(unary.operand);
        const op = unary.operator === "NOT" ? "!" : unary.operator;
        return `(${op}${operand})`;
      }

      case "CALL": {
        const call = expr as CallExpression;
        const args = call.arguments.map((arg) => this.expressionToJavaScript(arg)).join(", ");
        // Map query function names to JavaScript equivalents
        const funcName = this.mapFunctionToJS(call.callee);
        return `${funcName}(${args})`;
      }

      case "MEMBER": {
        const member = expr as MemberExpression;

        // Protect against prototype pollution attacks
        const dangerousProps = ["__proto__", "constructor", "prototype"];
        if (dangerousProps.includes(member.property)) {
          throw new Error(`Dangerous property access: ${member.property}`);
        }

        const obj = this.expressionToJavaScript(member.object);
        if (member.computed) {
          // For computed access, still check property value if it's a literal
          return `${obj}[${JSON.stringify(member.property)}]`;
        }
        // Sanitize property name
        const safeProp = member.property.replace(/[^a-zA-Z0-9_$]/g, "");
        return `${obj}.${safeProp}`;
      }

      case "ARRAY": {
        const arr = expr as ArrayExpression;
        const elements = arr.elements.map((el) => this.expressionToJavaScript(el)).join(", ");
        return `[${elements}]`;
      }

      case "OBJECT": {
        const obj = expr as ObjectExpression;
        const props = obj.properties.map((prop) => {
          const key = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(prop.key)
            ? prop.key
            : JSON.stringify(prop.key);
          const value = this.expressionToJavaScript(prop.value);
          return `${key}: ${value}`;
        }).join(", ");
        return `{${props}}`;
      }

      default:
        // Fallback for unknown expression types
        return JSON.stringify(String(expr));
    }
  }

  /**
   * Convert binary operator to JavaScript operator
   * Note: LIKE, NOT LIKE, MATCHES, CONTAINS, IN, NOT IN are handled
   * specially in expressionToJavaScript() and should not reach here
   */
  private binaryOperatorToJS(op: BinaryOperator): string {
    switch (op) {
      case "=": return "===";
      case "!=": return "!==";
      case "AND": return "&&";
      case "OR": return "||";
      case "||": return "+"; // String concatenation maps to +
      // These operators are handled in expressionToJavaScript BINARY case
      case "IN":
      case "NOT IN":
      case "LIKE":
      case "NOT LIKE":
      case "MATCHES":
      case "CONTAINS":
        throw new Error(`Operator ${op} should be handled in expressionToJavaScript(), not binaryOperatorToJS()`);
      default: return op; // +, -, *, /, %, >, >=, <, <= work as-is
    }
  }

  /**
   * Map query function names to JavaScript equivalents
   */
  private mapFunctionToJS(funcName: string): string {
    const mapping: Record<string, string> = {
      // String functions
      "UPPER": "String.prototype.toUpperCase.call",
      "LOWER": "String.prototype.toLowerCase.call",
      "TRIM": "String.prototype.trim.call",
      "LENGTH": "(s => s.length)",
      "CONCAT": "((...args) => args.join(''))",
      "SUBSTRING": "String.prototype.substring.call",
      "REPLACE": "String.prototype.replace.call",

      // Math functions
      "ABS": "Math.abs",
      "ROUND": "Math.round",
      "FLOOR": "Math.floor",
      "CEIL": "Math.ceil",
      "MIN": "Math.min",
      "MAX": "Math.max",
      "POW": "Math.pow",
      "SQRT": "Math.sqrt",

      // Array functions
      "COUNT": "(arr => Array.isArray(arr) ? arr.length : 0)",
      "SUM": "(arr => Array.isArray(arr) ? arr.reduce((a,b) => a+b, 0) : 0)",
      "AVG": "(arr => Array.isArray(arr) && arr.length ? arr.reduce((a,b) => a+b, 0) / arr.length : 0)",

      // Type conversion
      "TO_STRING": "String",
      "TO_NUMBER": "Number",
      "TO_BOOLEAN": "Boolean",
      "PARSE_JSON": "JSON.parse",
      "TO_JSON": "JSON.stringify",
    };

    return mapping[funcName.toUpperCase()] || funcName.toLowerCase();
  }

  /**
   * Build JavaScript for UPDATE
   * Uses sanitization to prevent injection attacks
   */
  private buildUpdateScript(selector: string, property: string, value: Expression): string {
    // Sanitize inputs to prevent JavaScript injection
    const safeSelector = sanitizeSelector(selector);
    const safeProperty = sanitizePropertyName(property);
    const valueStr = this.expressionToJavaScript(value);

    return `
    const elements = document.querySelectorAll('${safeSelector}');
    elements.forEach(el => {
      if ('${safeProperty}' in el) {
        el['${safeProperty}'] = ${valueStr};
      } else {
        el.setAttribute('${safeProperty}', ${valueStr});
      }
    });
  `;
  }

  /**
   * Extract selector from SELECT statement
   */
  /**
   * Check if a string looks like a CSS selector rather than a URL
   */
  private isCSSSelector(value: string): boolean {
    // CSS selectors start with ., #, or [
    if (value.includes("://")) return false;
    if (value.startsWith(".") || value.startsWith("#") || value.startsWith("[")) return true;
    // Common HTML tag names (used as selectors)
    const tagNames = [
      "div", "span", "p", "a", "ul", "ol", "li", "table", "tr", "td", "th",
      "h1", "h2", "h3", "h4", "h5", "h6", "section", "article", "nav",
      "header", "footer", "main", "form", "input", "button", "select",
      "textarea", "img", "body",
    ];
    const firstToken = value.split(/[\s>+~]/, 1)[0].toLowerCase();
    return tagNames.includes(firstToken);
  }

  private extractSelector(stmt: SelectStatement): string {
    // Priority 1: Check if source contains selector hint
    if (stmt.source.type === "URL" && typeof stmt.source.value === "string") {
      const url = stmt.source.value;
      // Check if URL has fragment identifier (e.g., "https://example.com#selector")
      const hashIndex = url.indexOf("#");
      if (hashIndex !== -1) {
        const fragment = url.slice(hashIndex + 1);
        if (fragment && fragment.length > 0) {
          return fragment; // Use fragment as selector
        }
      }
    }

    // Priority 2: Check if fields contain selector information
    for (const field of stmt.fields) {
      if (field.expression && field.expression.type === "IDENTIFIER") {
        const name = (field.expression as Identifier).name;

        // If field name looks like a CSS selector, use it
        if (
          name.startsWith(".") || name.startsWith("#") ||
          name.includes("[") || name.includes(">")
        ) {
          return name;
        }
      }

      // Check if field name suggests a specific selector
      if (field.name.startsWith("css:")) {
        return field.name.slice(4); // Extract selector after "css:"
      }
      if (field.name.startsWith("xpath:")) {
        return field.name.slice(6); // Extract selector after "xpath:"
      }
    }

    // Priority 3: Check WHERE clause for selector hints
    if (stmt.where) {
      // Look for selector-like patterns in WHERE expressions
      const selectorHint = this.extractSelectorFromExpression(stmt.where);
      if (selectorHint) {
        return selectorHint;
      }
    }

    // Default: Use 'body' to query entire document
    return "body";
  }

  /**
   * Helper to extract selector from expression
   */
  private extractSelectorFromExpression(expr: Expression): string | null {
    if (expr.type === "BINARY") {
      const binaryExpr = expr as BinaryExpression;
      // Look for patterns like: selector = ".myclass"
      if (binaryExpr.operator === "=") {
        if (
          binaryExpr.left.type === "IDENTIFIER" &&
          (binaryExpr.left as Identifier).name.toLowerCase() === "selector" &&
          binaryExpr.right.type === "LITERAL"
        ) {
          return String((binaryExpr.right as Literal).value);
        }
      }
      // Recursively check nested expressions
      return this.extractSelectorFromExpression(binaryExpr.left) ||
        this.extractSelectorFromExpression(binaryExpr.right);
    }

    return null;
  }

  /**
   * Create a parallel execution step wrapping a group of independent steps
   */
  private createParallelStep(stepGroup: ExecutionStep[], dependencies: string[]): ParallelStep {
    return {
      id: this.generateStepId(),
      type: ExecutionStepType.PARALLEL,
      steps: stepGroup,
      estimatedCost: Math.max(...stepGroup.map((s) => s.estimatedCost)),
      dependencies,
      cacheable: false,
    };
  }

  /**
   * Estimate total execution cost
   */
  private estimateTotalCost(
    steps: ExecutionStep[],
    _dependencies: any,
  ): number {
    // Use parallel execution time if available, fall back to sum of step costs
    const parallelEstimate = this.dependencyGraphBuilder.estimateParallelExecutionTime(_dependencies);
    if (parallelEstimate > 0) {
      return parallelEstimate;
    }
    // Fallback: sum individual step estimated costs
    return steps.reduce((total, step) => total + (step.estimatedCost || 1), 0);
  }

  /**
   * Calculate resource requirements
   */
  private calculateResourceRequirements(steps: ExecutionStep[]): ResourceRequirements {
    let browsers = 0;
    let pages = 0;
    let connections = 0;
    let memory = 0;
    let cpu = 0;

    for (const step of steps) {
      switch (step.type) {
        case ExecutionStepType.NAVIGATE:
          browsers = Math.max(browsers, 1);
          pages++;
          connections++;
          memory += 100; // MB per page
          cpu = Math.max(cpu, 30);
          break;

        case ExecutionStepType.DOM_QUERY:
          cpu = Math.max(cpu, 20);
          memory += 10;
          break;

        case ExecutionStepType.SCREENSHOT:
        case ExecutionStepType.PDF:
          memory += 50;
          cpu = Math.max(cpu, 40);
          break;
      }
    }

    return {
      browsers,
      pages,
      connections,
      memory,
      cpu,
    };
  }

  /**
   * Generate unique step ID
   */
  private generateStepId(): string {
    return `step_${++this.stepCounter}`;
  }

  /**
   * Generate unique plan ID
   */
  private generatePlanId(): QueryID {
    return `plan_${Date.now()}_${crypto.randomUUID().slice(0, 9)}`;
  }

  /**
   * Get dependency graph builder
   */
  getDependencyGraphBuilder(): DependencyGraphBuilder {
    return this.dependencyGraphBuilder;
  }

  /**
   * Get step counter (for debugging)
   */
  getStepCounter(): number {
    return this.stepCounter;
  }

  /**
   * Get current steps (returns copy)
   */
  getCurrentSteps(): ExecutionStep[] {
    return [...this.currentSteps];
  }
}

/**
 * Alias for ExecutionPlanner for backward compatibility
 */
export const Planner = ExecutionPlanner;

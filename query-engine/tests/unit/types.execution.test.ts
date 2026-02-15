/**
 * Execution Types Tests
 * Comprehensive tests for execution-related type definitions
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import {
  QueryExecutionState,
  StepExecutionState,
  Permission,
  type QueryResult,
  type QueryTiming,
  type QueryMetadata,
  type QueryOptions,
  type QueryStatus,
  type OutputFormat,
} from "../../types/execution.ts";
import { DataType } from "../../types/primitives.ts";

// ============================================================================
// QueryExecutionState Enum Tests
// ============================================================================

Deno.test("QueryExecutionState - contains all pipeline states", () => {
  assertEquals(QueryExecutionState.PENDING, "PENDING");
  assertEquals(QueryExecutionState.LEXING, "LEXING");
  assertEquals(QueryExecutionState.PARSING, "PARSING");
  assertEquals(QueryExecutionState.ANALYZING, "ANALYZING");
  assertEquals(QueryExecutionState.OPTIMIZING, "OPTIMIZING");
  assertEquals(QueryExecutionState.PLANNING, "PLANNING");
  assertEquals(QueryExecutionState.EXECUTING, "EXECUTING");
  assertEquals(QueryExecutionState.FORMATTING, "FORMATTING");
  assertEquals(QueryExecutionState.COMPLETED, "COMPLETED");
});

Deno.test("QueryExecutionState - contains error states", () => {
  assertEquals(QueryExecutionState.FAILED, "FAILED");
  assertEquals(QueryExecutionState.CANCELLED, "CANCELLED");
  assertEquals(QueryExecutionState.TIMEOUT, "TIMEOUT");
});

Deno.test("QueryExecutionState - has 12 states total", () => {
  const states = Object.keys(QueryExecutionState);
  assertEquals(states.length, 12);
});

Deno.test("QueryExecutionState - all values are unique", () => {
  const values = Object.values(QueryExecutionState);
  const uniqueValues = new Set(values);
  assertEquals(values.length, uniqueValues.size);
});

Deno.test("QueryExecutionState - can be used in switch statements", () => {
  function getState(): QueryExecutionState { return QueryExecutionState.EXECUTING; }
  const state = getState();
  let result = "";

  switch (state) {
    case QueryExecutionState.PENDING:
      result = "waiting";
      break;
    case QueryExecutionState.EXECUTING:
      result = "running";
      break;
    case QueryExecutionState.COMPLETED:
      result = "done";
      break;
    default:
      result = "other";
  }

  assertEquals(result, "running");
});

Deno.test("QueryExecutionState - pipeline order is correct", () => {
  const pipelineOrder = [
    QueryExecutionState.PENDING,
    QueryExecutionState.LEXING,
    QueryExecutionState.PARSING,
    QueryExecutionState.ANALYZING,
    QueryExecutionState.OPTIMIZING,
    QueryExecutionState.PLANNING,
    QueryExecutionState.EXECUTING,
    QueryExecutionState.FORMATTING,
    QueryExecutionState.COMPLETED,
  ];

  assertEquals(pipelineOrder.length, 9);
  assertEquals(pipelineOrder[0], "PENDING");
  assertEquals(pipelineOrder[pipelineOrder.length - 1], "COMPLETED");
});

// ============================================================================
// StepExecutionState Enum Tests
// ============================================================================

Deno.test("StepExecutionState - contains all states", () => {
  assertEquals(StepExecutionState.PENDING, "PENDING");
  assertEquals(StepExecutionState.READY, "READY");
  assertEquals(StepExecutionState.EXECUTING, "EXECUTING");
  assertEquals(StepExecutionState.COMPLETED, "COMPLETED");
  assertEquals(StepExecutionState.FAILED, "FAILED");
  assertEquals(StepExecutionState.SKIPPED, "SKIPPED");
  assertEquals(StepExecutionState.RETRYING, "RETRYING");
});

Deno.test("StepExecutionState - has 7 states total", () => {
  const states = Object.keys(StepExecutionState);
  assertEquals(states.length, 7);
});

Deno.test("StepExecutionState - all values are unique", () => {
  const values = Object.values(StepExecutionState);
  const uniqueValues = new Set(values);
  assertEquals(values.length, uniqueValues.size);
});

Deno.test("StepExecutionState - state transitions", () => {
  // Valid state transitions
  const validTransitions: Record<StepExecutionState, StepExecutionState[]> = {
    [StepExecutionState.PENDING]: [StepExecutionState.READY, StepExecutionState.SKIPPED],
    [StepExecutionState.READY]: [StepExecutionState.EXECUTING],
    [StepExecutionState.EXECUTING]: [
      StepExecutionState.COMPLETED,
      StepExecutionState.FAILED,
      StepExecutionState.RETRYING,
    ],
    [StepExecutionState.COMPLETED]: [],
    [StepExecutionState.FAILED]: [],
    [StepExecutionState.SKIPPED]: [],
    [StepExecutionState.RETRYING]: [StepExecutionState.EXECUTING, StepExecutionState.FAILED],
  };

  // Verify structure
  assertExists(validTransitions[StepExecutionState.PENDING]);
  assert(validTransitions[StepExecutionState.PENDING].includes(StepExecutionState.READY));
});

// ============================================================================
// Permission Enum Tests
// ============================================================================

Deno.test("Permission - contains navigation permissions", () => {
  assertEquals(Permission.NAVIGATE_PUBLIC, "NAVIGATE_PUBLIC");
  assertEquals(Permission.NAVIGATE_PRIVATE, "NAVIGATE_PRIVATE");
});

Deno.test("Permission - contains cookie permissions", () => {
  assertEquals(Permission.READ_COOKIES, "READ_COOKIES");
  assertEquals(Permission.WRITE_COOKIES, "WRITE_COOKIES");
});

Deno.test("Permission - contains storage permissions", () => {
  assertEquals(Permission.READ_STORAGE, "READ_STORAGE");
  assertEquals(Permission.WRITE_STORAGE, "WRITE_STORAGE");
});

Deno.test("Permission - contains traffic permissions", () => {
  assertEquals(Permission.INTERCEPT_TRAFFIC, "INTERCEPT_TRAFFIC");
  assertEquals(Permission.MODIFY_REQUESTS, "MODIFY_REQUESTS");
});

Deno.test("Permission - contains DOM interaction permissions", () => {
  assertEquals(Permission.DOM_QUERY, "DOM_QUERY");
  assertEquals(Permission.CLICK, "CLICK");
  assertEquals(Permission.TYPE, "TYPE");
});

Deno.test("Permission - contains file permissions", () => {
  assertEquals(Permission.FILE_DOWNLOAD, "FILE_DOWNLOAD");
  assertEquals(Permission.FILE_UPLOAD, "FILE_UPLOAD");
});

Deno.test("Permission - contains capture permissions", () => {
  assertEquals(Permission.SCREENSHOT, "SCREENSHOT");
  assertEquals(Permission.PDF, "PDF");
});

Deno.test("Permission - contains other permissions", () => {
  assertEquals(Permission.EXECUTE_JS, "EXECUTE_JS");
  assertEquals(Permission.CACHE_RESPONSES, "CACHE_RESPONSES");
});

Deno.test("Permission - has 17 permissions total", () => {
  const permissions = Object.keys(Permission);
  assertEquals(permissions.length, 17);
});

Deno.test("Permission - all values are unique", () => {
  const values = Object.values(Permission);
  const uniqueValues = new Set(values);
  assertEquals(values.length, uniqueValues.size);
});

Deno.test("Permission - can be used in arrays", () => {
  const permissions: Permission[] = [
    Permission.NAVIGATE_PUBLIC,
    Permission.DOM_QUERY,
    Permission.SCREENSHOT,
  ];

  assertEquals(permissions.length, 3);
  assert(permissions.includes(Permission.NAVIGATE_PUBLIC));
});

// ============================================================================
// OutputFormat Type Tests
// ============================================================================

Deno.test("OutputFormat - JSON is valid", () => {
  const format: OutputFormat = "JSON";
  assertEquals(format, "JSON");
});

Deno.test("OutputFormat - TABLE is valid", () => {
  const format: OutputFormat = "TABLE";
  assertEquals(format, "TABLE");
});

Deno.test("OutputFormat - CSV is valid", () => {
  const format: OutputFormat = "CSV";
  assertEquals(format, "CSV");
});

Deno.test("OutputFormat - HTML is valid", () => {
  const format: OutputFormat = "HTML";
  assertEquals(format, "HTML");
});

Deno.test("OutputFormat - XML is valid", () => {
  const format: OutputFormat = "XML";
  assertEquals(format, "XML");
});

Deno.test("OutputFormat - YAML is valid", () => {
  const format: OutputFormat = "YAML";
  assertEquals(format, "YAML");
});

Deno.test("OutputFormat - STREAM is valid", () => {
  const format: OutputFormat = "STREAM";
  assertEquals(format, "STREAM");
});

Deno.test("OutputFormat - can be used in switch", () => {
  function getFormat(): OutputFormat { return "JSON"; }
  const format = getFormat();
  let result = "";

  switch (format) {
    case "JSON":
      result = "json";
      break;
    case "TABLE":
      result = "table";
      break;
    case "CSV":
      result = "csv";
      break;
    default:
      result = "other";
  }

  assertEquals(result, "json");
});

// ============================================================================
// QueryTiming Interface Tests
// ============================================================================

Deno.test("QueryTiming - has all required fields", () => {
  const timing: QueryTiming = {
    lexerTime: 5,
    parserTime: 10,
    semanticAnalysisTime: 8,
    optimizationTime: 3,
    planningTime: 2,
    executionTime: 100,
    formattingTime: 1,
    totalTime: 129,
  };

  assertEquals(timing.lexerTime, 5);
  assertEquals(timing.parserTime, 10);
  assertEquals(timing.semanticAnalysisTime, 8);
  assertEquals(timing.optimizationTime, 3);
  assertEquals(timing.planningTime, 2);
  assertEquals(timing.executionTime, 100);
  assertEquals(timing.formattingTime, 1);
  assertEquals(timing.totalTime, 129);
});

Deno.test("QueryTiming - total matches sum of phases", () => {
  const timing: QueryTiming = {
    lexerTime: 5,
    parserTime: 10,
    semanticAnalysisTime: 8,
    optimizationTime: 3,
    planningTime: 2,
    executionTime: 100,
    formattingTime: 1,
    totalTime: 129,
  };

  const sum =
    timing.lexerTime +
    timing.parserTime +
    timing.semanticAnalysisTime +
    timing.optimizationTime +
    timing.planningTime +
    timing.executionTime +
    timing.formattingTime;

  assertEquals(sum, timing.totalTime);
});

Deno.test("QueryTiming - all times can be zero", () => {
  const timing: QueryTiming = {
    lexerTime: 0,
    parserTime: 0,
    semanticAnalysisTime: 0,
    optimizationTime: 0,
    planningTime: 0,
    executionTime: 0,
    formattingTime: 0,
    totalTime: 0,
  };

  assertEquals(timing.totalTime, 0);
});

Deno.test("QueryTiming - can represent long operations", () => {
  const timing: QueryTiming = {
    lexerTime: 100,
    parserTime: 200,
    semanticAnalysisTime: 150,
    optimizationTime: 50,
    planningTime: 30,
    executionTime: 30000, // 30 seconds
    formattingTime: 500,
    totalTime: 31030,
  };

  assertEquals(timing.executionTime, 30000);
});

// ============================================================================
// QueryMetadata Interface Tests
// ============================================================================

Deno.test("QueryMetadata - minimal metadata", () => {
  const metadata: QueryMetadata = {
    query: "SELECT title FROM 'https://example.com'",
    stepsExecuted: 0,
    estimatedCost: 0,
    actualCost: 0,
    browserNavigations: 0,
    cacheHits: 0,
    cacheMisses: 0,
  };

  assertEquals(metadata.query, "SELECT title FROM 'https://example.com'");
  assertEquals(metadata.stepsExecuted, 0);
});

Deno.test("QueryMetadata - with execution data", () => {
  const metadata: QueryMetadata = {
    query: "SELECT title FROM 'https://example.com'",
    stepsExecuted: 5,
    estimatedCost: 1000,
    actualCost: 1200,
    browserNavigations: 2,
    cacheHits: 3,
    cacheMisses: 1,
  };

  assertEquals(metadata.stepsExecuted, 5);
  assertEquals(metadata.estimatedCost, 1000);
  assertEquals(metadata.actualCost, 1200);
  assertEquals(metadata.browserNavigations, 2);
  assertEquals(metadata.cacheHits, 3);
  assertEquals(metadata.cacheMisses, 1);
});

Deno.test("QueryMetadata - cache hit ratio calculation", () => {
  const metadata: QueryMetadata = {
    query: "SELECT * FROM 'https://example.com'",
    stepsExecuted: 10,
    estimatedCost: 500,
    actualCost: 300,
    browserNavigations: 1,
    cacheHits: 7,
    cacheMisses: 3,
  };

  const hitRatio = metadata.cacheHits / (metadata.cacheHits + metadata.cacheMisses);
  assertEquals(hitRatio, 0.7);
});

Deno.test("QueryMetadata - actual cost can exceed estimated", () => {
  const metadata: QueryMetadata = {
    query: "SELECT * FROM 'https://slow-site.com'",
    stepsExecuted: 1,
    estimatedCost: 500,
    actualCost: 5000, // 10x slower than expected
    browserNavigations: 1,
    cacheHits: 0,
    cacheMisses: 1,
  };

  assert(metadata.actualCost > metadata.estimatedCost);
});

// ============================================================================
// QueryOptions Interface Tests
// ============================================================================

Deno.test("QueryOptions - empty options", () => {
  const options: QueryOptions = {};

  assertEquals(options.timeout, undefined);
  assertEquals(options.permissions, undefined);
  assertEquals(options.format, undefined);
  assertEquals(options.stream, undefined);
  assertEquals(options.trace, undefined);
  assertEquals(options.profile, undefined);
});

Deno.test("QueryOptions - with timeout", () => {
  const options: QueryOptions = {
    timeout: 30000,
  };

  assertEquals(options.timeout, 30000);
});

Deno.test("QueryOptions - with permissions", () => {
  const options: QueryOptions = {
    permissions: [Permission.NAVIGATE_PUBLIC, Permission.DOM_QUERY, Permission.SCREENSHOT],
  };

  assertExists(options.permissions);
  assertEquals(options.permissions!.length, 3);
  assert(options.permissions!.includes(Permission.NAVIGATE_PUBLIC));
});

Deno.test("QueryOptions - with format", () => {
  const options: QueryOptions = {
    format: "JSON",
  };

  assertEquals(options.format, "JSON");
});

Deno.test("QueryOptions - with streaming", () => {
  const options: QueryOptions = {
    stream: true,
    format: "STREAM",
  };

  assertEquals(options.stream, true);
  assertEquals(options.format, "STREAM");
});

Deno.test("QueryOptions - with tracing", () => {
  const options: QueryOptions = {
    trace: true,
    profile: true,
  };

  assertEquals(options.trace, true);
  assertEquals(options.profile, true);
});

Deno.test("QueryOptions - full options", () => {
  const options: QueryOptions = {
    timeout: 60000,
    permissions: [
      Permission.NAVIGATE_PUBLIC,
      Permission.DOM_QUERY,
      Permission.EXECUTE_JS,
      Permission.SCREENSHOT,
    ],
    format: "JSON",
    stream: false,
    trace: true,
    profile: true,
  };

  assertEquals(options.timeout, 60000);
  assertEquals(options.permissions!.length, 4);
  assertEquals(options.format, "JSON");
  assertEquals(options.stream, false);
  assertEquals(options.trace, true);
  assertEquals(options.profile, true);
});

// ============================================================================
// QueryResult Interface Tests
// ============================================================================

Deno.test("QueryResult - simple result", () => {
  const result: QueryResult = {
    queryId: "query-123",
    data: { title: "Example Page" },
    timing: {
      lexerTime: 1,
      parserTime: 2,
      semanticAnalysisTime: 1,
      optimizationTime: 1,
      planningTime: 1,
      executionTime: 50,
      formattingTime: 1,
      totalTime: 57,
    },
    metadata: {
      query: "SELECT title FROM 'https://example.com'",
      stepsExecuted: 2,
      estimatedCost: 60,
      actualCost: 57,
      browserNavigations: 1,
      cacheHits: 0,
      cacheMisses: 1,
    },
  };

  assertEquals(result.queryId, "query-123");
  assertEquals((result.data as any).title, "Example Page");
  assertEquals(result.timing.totalTime, 57);
});

Deno.test("QueryResult - with trace ID", () => {
  const result: QueryResult = {
    queryId: "query-456",
    data: [],
    timing: {
      lexerTime: 0,
      parserTime: 0,
      semanticAnalysisTime: 0,
      optimizationTime: 0,
      planningTime: 0,
      executionTime: 0,
      formattingTime: 0,
      totalTime: 0,
    },
    metadata: {
      query: "SHOW COOKIES",
      stepsExecuted: 1,
      estimatedCost: 0,
      actualCost: 0,
      browserNavigations: 0,
      cacheHits: 0,
      cacheMisses: 0,
    },
    traceId: "trace-abc-123",
  };

  assertEquals(result.traceId, "trace-abc-123");
});

Deno.test("QueryResult - data can be array", () => {
  const result: QueryResult = {
    queryId: "query-789",
    data: [
      { title: "Page 1", url: "https://example.com/1" },
      { title: "Page 2", url: "https://example.com/2" },
    ],
    timing: {
      lexerTime: 2,
      parserTime: 3,
      semanticAnalysisTime: 2,
      optimizationTime: 1,
      planningTime: 2,
      executionTime: 200,
      formattingTime: 5,
      totalTime: 215,
    },
    metadata: {
      query: "SELECT title, url FROM $urls",
      stepsExecuted: 4,
      estimatedCost: 200,
      actualCost: 215,
      browserNavigations: 2,
      cacheHits: 0,
      cacheMisses: 2,
    },
  };

  assert(Array.isArray(result.data));
  assertEquals((result.data as any[]).length, 2);
});

Deno.test("QueryResult - data can be null", () => {
  const result: QueryResult = {
    queryId: "query-null",
    data: null,
    timing: {
      lexerTime: 1,
      parserTime: 1,
      semanticAnalysisTime: 1,
      optimizationTime: 0,
      planningTime: 1,
      executionTime: 10,
      formattingTime: 0,
      totalTime: 14,
    },
    metadata: {
      query: "SELECT title FROM 'https://empty.com'",
      stepsExecuted: 1,
      estimatedCost: 20,
      actualCost: 14,
      browserNavigations: 1,
      cacheHits: 0,
      cacheMisses: 1,
    },
  };

  assertEquals(result.data, null);
});

// ============================================================================
// QueryStatus Interface Tests
// ============================================================================

Deno.test("QueryStatus - pending status", () => {
  const status: QueryStatus = {
    queryId: "query-pending",
    state: QueryExecutionState.PENDING,
    progress: 0,
    stepsCompleted: 0,
    stepsTotal: 5,
  };

  assertEquals(status.queryId, "query-pending");
  assertEquals(status.state, QueryExecutionState.PENDING);
  assertEquals(status.progress, 0);
  assertEquals(status.stepsCompleted, 0);
  assertEquals(status.stepsTotal, 5);
});

Deno.test("QueryStatus - executing status", () => {
  const status: QueryStatus = {
    queryId: "query-running",
    state: QueryExecutionState.EXECUTING,
    progress: 40,
    currentStep: "step-2",
    stepsCompleted: 2,
    stepsTotal: 5,
  };

  assertEquals(status.state, QueryExecutionState.EXECUTING);
  assertEquals(status.progress, 40);
  assertEquals(status.currentStep, "step-2");
  assertEquals(status.stepsCompleted, 2);
});

Deno.test("QueryStatus - completed status", () => {
  const status: QueryStatus = {
    queryId: "query-done",
    state: QueryExecutionState.COMPLETED,
    progress: 100,
    stepsCompleted: 5,
    stepsTotal: 5,
  };

  assertEquals(status.state, QueryExecutionState.COMPLETED);
  assertEquals(status.progress, 100);
  assertEquals(status.stepsCompleted, status.stepsTotal);
});

Deno.test("QueryStatus - failed status with error", () => {
  const status: QueryStatus = {
    queryId: "query-failed",
    state: QueryExecutionState.FAILED,
    progress: 60,
    currentStep: "step-3",
    stepsCompleted: 3,
    stepsTotal: 5,
    error: new Error("Network timeout"),
  };

  assertEquals(status.state, QueryExecutionState.FAILED);
  assertExists(status.error);
  assertEquals(status.error!.message, "Network timeout");
});

Deno.test("QueryStatus - cancelled status", () => {
  const status: QueryStatus = {
    queryId: "query-cancelled",
    state: QueryExecutionState.CANCELLED,
    progress: 25,
    currentStep: "step-1",
    stepsCompleted: 1,
    stepsTotal: 4,
  };

  assertEquals(status.state, QueryExecutionState.CANCELLED);
});

Deno.test("QueryStatus - timeout status", () => {
  const status: QueryStatus = {
    queryId: "query-timeout",
    state: QueryExecutionState.TIMEOUT,
    progress: 80,
    currentStep: "step-4",
    stepsCompleted: 4,
    stepsTotal: 5,
    error: new Error("Query exceeded timeout of 30000ms"),
  };

  assertEquals(status.state, QueryExecutionState.TIMEOUT);
  assertExists(status.error);
});

Deno.test("QueryStatus - progress calculation", () => {
  const status: QueryStatus = {
    queryId: "query-progress",
    state: QueryExecutionState.EXECUTING,
    progress: 60,
    currentStep: "step-3",
    stepsCompleted: 3,
    stepsTotal: 5,
  };

  const calculatedProgress = (status.stepsCompleted / status.stepsTotal) * 100;
  assertEquals(calculatedProgress, 60);
});

// ============================================================================
// Type Compatibility Tests
// ============================================================================

Deno.test("QueryExecutionState can be serialized to JSON", () => {
  const state = QueryExecutionState.EXECUTING;
  const json = JSON.stringify(state);
  assertEquals(json, '"EXECUTING"');
});

Deno.test("Permission array can be serialized", () => {
  const permissions = [Permission.NAVIGATE_PUBLIC, Permission.DOM_QUERY];
  const json = JSON.stringify(permissions);
  assertEquals(json, '["NAVIGATE_PUBLIC","DOM_QUERY"]');
});

Deno.test("QueryTiming can be used with Object.entries", () => {
  const timing: QueryTiming = {
    lexerTime: 1,
    parserTime: 2,
    semanticAnalysisTime: 3,
    optimizationTime: 4,
    planningTime: 5,
    executionTime: 6,
    formattingTime: 7,
    totalTime: 28,
  };

  const entries = Object.entries(timing);
  assertEquals(entries.length, 8);
});

Deno.test("QueryStatus readonly queryId enforcement", () => {
  const status: QueryStatus = {
    queryId: "query-readonly",
    state: QueryExecutionState.PENDING,
    progress: 0,
    stepsCompleted: 0,
    stepsTotal: 1,
  };

  // queryId is readonly - attempting to change would be a compile error
  assertEquals(status.queryId, "query-readonly");
});

// ============================================================================
// Edge Cases
// ============================================================================

Deno.test("QueryTiming - sub-millisecond times as 0", () => {
  const timing: QueryTiming = {
    lexerTime: 0,
    parserTime: 0,
    semanticAnalysisTime: 0,
    optimizationTime: 0,
    planningTime: 0,
    executionTime: 1, // Only execution has measurable time
    formattingTime: 0,
    totalTime: 1,
  };

  assertEquals(timing.totalTime, 1);
});

Deno.test("QueryMetadata - zero navigations for cached query", () => {
  const metadata: QueryMetadata = {
    query: "SELECT * FROM cached_data",
    stepsExecuted: 1,
    estimatedCost: 10,
    actualCost: 5,
    browserNavigations: 0,
    cacheHits: 1,
    cacheMisses: 0,
  };

  assertEquals(metadata.browserNavigations, 0);
  assertEquals(metadata.cacheHits, 1);
});

Deno.test("QueryOptions - no permissions means restricted", () => {
  const options: QueryOptions = {
    permissions: [],
  };

  assertEquals(options.permissions!.length, 0);
});

Deno.test("QueryStatus - progress can be 0-100", () => {
  const statusMin: QueryStatus = {
    queryId: "q1",
    state: QueryExecutionState.PENDING,
    progress: 0,
    stepsCompleted: 0,
    stepsTotal: 10,
  };

  const statusMax: QueryStatus = {
    queryId: "q2",
    state: QueryExecutionState.COMPLETED,
    progress: 100,
    stepsCompleted: 10,
    stepsTotal: 10,
  };

  assertEquals(statusMin.progress, 0);
  assertEquals(statusMax.progress, 100);
});

/**
 * CostEstimator Tests
 */

import { assertEquals, assert } from "@std/assert";
import { CostEstimator, CostEstimate } from "../../optimizer/cost-estimator.ts";

Deno.test("CostEstimator - constructor creates instance", () => {
  const estimator = new CostEstimator();
  assert(estimator instanceof CostEstimator);
});

Deno.test("CostEstimator - estimateQueryCost returns default costs", () => {
  const estimator = new CostEstimator();
  const cost = estimator.estimateQueryCost({});
  assertEquals(cost.cpuCost, 100);
  assertEquals(cost.memoryCost, 50);
  assertEquals(cost.networkCost, 200);
  assertEquals(cost.ioCost, 150);
  assertEquals(cost.totalCost, 500);
});

Deno.test("CostEstimator - estimateQueryCost with null query", () => {
  const estimator = new CostEstimator();
  const cost = estimator.estimateQueryCost(null);
  assertEquals(cost.totalCost, 500);
});

Deno.test("CostEstimator - estimateScanCost scales with row count", () => {
  const estimator = new CostEstimator();
  const cost = estimator.estimateScanCost(1000);
  assertEquals(cost.cpuCost, 100);
  assertEquals(cost.memoryCost, 10);
  assertEquals(cost.networkCost, 0);
  assertEquals(cost.ioCost, 500);
  assertEquals(cost.totalCost, 600);
});

Deno.test("CostEstimator - estimateScanCost with zero rows", () => {
  const estimator = new CostEstimator();
  const cost = estimator.estimateScanCost(0);
  assertEquals(cost.cpuCost, 0);
  assertEquals(cost.memoryCost, 0);
  assertEquals(cost.ioCost, 0);
  assertEquals(cost.totalCost, 0);
});

Deno.test("CostEstimator - estimateJoinCost scales with product of rows", () => {
  const estimator = new CostEstimator();
  const cost = estimator.estimateJoinCost(100, 200);
  assertEquals(cost.cpuCost, 200);
  assertEquals(cost.memoryCost, 30);
  assertEquals(cost.networkCost, 0);
  assertEquals(cost.ioCost, 0);
  assertEquals(cost.totalCost, 200);
});

Deno.test("CostEstimator - estimateJoinCost with zero rows on one side", () => {
  const estimator = new CostEstimator();
  const cost = estimator.estimateJoinCost(0, 500);
  assertEquals(cost.cpuCost, 0);
  assertEquals(cost.totalCost, 0);
});

Deno.test("CostEstimator - compareCosts returns negative when first is cheaper", () => {
  const estimator = new CostEstimator();
  const cheap: CostEstimate = { cpuCost: 1, memoryCost: 1, networkCost: 1, ioCost: 1, totalCost: 10 };
  const expensive: CostEstimate = { cpuCost: 5, memoryCost: 5, networkCost: 5, ioCost: 5, totalCost: 100 };
  assert(estimator.compareCosts(cheap, expensive) < 0);
});

Deno.test("CostEstimator - compareCosts returns positive when first is more expensive", () => {
  const estimator = new CostEstimator();
  const cheap: CostEstimate = { cpuCost: 1, memoryCost: 1, networkCost: 1, ioCost: 1, totalCost: 10 };
  const expensive: CostEstimate = { cpuCost: 5, memoryCost: 5, networkCost: 5, ioCost: 5, totalCost: 100 };
  assert(estimator.compareCosts(expensive, cheap) > 0);
});

Deno.test("CostEstimator - compareCosts returns zero for equal costs", () => {
  const estimator = new CostEstimator();
  const cost: CostEstimate = { cpuCost: 1, memoryCost: 1, networkCost: 1, ioCost: 1, totalCost: 50 };
  assertEquals(estimator.compareCosts(cost, cost), 0);
});

Deno.test("CostEstimator - selectCheaper returns the cheaper estimate", () => {
  const estimator = new CostEstimator();
  const cheap: CostEstimate = { cpuCost: 1, memoryCost: 1, networkCost: 1, ioCost: 1, totalCost: 10 };
  const expensive: CostEstimate = { cpuCost: 5, memoryCost: 5, networkCost: 5, ioCost: 5, totalCost: 100 };
  assertEquals(estimator.selectCheaper(cheap, expensive), cheap);
  assertEquals(estimator.selectCheaper(expensive, cheap), cheap);
});

Deno.test("CostEstimator - selectCheaper returns first when equal", () => {
  const estimator = new CostEstimator();
  const a: CostEstimate = { cpuCost: 1, memoryCost: 1, networkCost: 1, ioCost: 1, totalCost: 50 };
  const b: CostEstimate = { cpuCost: 2, memoryCost: 2, networkCost: 2, ioCost: 2, totalCost: 50 };
  assertEquals(estimator.selectCheaper(a, b), a);
});

Deno.test("CostEstimator - estimateScanCost with large row count", () => {
  const estimator = new CostEstimator();
  const cost = estimator.estimateScanCost(1_000_000);
  assertEquals(cost.cpuCost, 100000);
  assertEquals(cost.ioCost, 500000);
  assertEquals(cost.totalCost, 600000);
});

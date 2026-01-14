/**
 * Array utility functions
 * Comprehensive array manipulation, sorting, grouping, and topological sort
 */

/**
 * Dependency graph for topological sort
 */
export interface DependencyGraph {
  nodes: string[];
  edges: Map<string, string[]>; // node -> dependencies
}

/**
 * Flatten nested arrays
 */
export function flatten<T>(arr: (T | T[])[]): T[] {
  return arr.reduce<T[]>((acc, item) => {
    if (Array.isArray(item)) {
      acc.push(...flatten(item));
    } else {
      acc.push(item);
    }
    return acc;
  }, []);
}

/**
 * Flatten nested arrays to specified depth
 */
export function flattenDepth<T>(arr: any[], depth: number = 1): T[] {
  if (depth <= 0) return arr.slice();

  return arr.reduce<T[]>((acc, item) => {
    if (Array.isArray(item) && depth > 1) {
      acc.push(...(flattenDepth(item, depth - 1) as T[]));
    } else if (Array.isArray(item)) {
      acc.push(...item);
    } else {
      acc.push(item);
    }
    return acc;
  }, []);
}

/**
 * Remove duplicate values
 */
export function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

/**
 * Remove duplicates using custom key function
 */
export function uniqueBy<T, K>(arr: T[], keyFn: (item: T) => K): T[] {
  const seen = new Set<K>();
  return arr.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * Group array elements by key
 */
export function groupBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return arr.reduce((groups, item) => {
    const key = keyFn(item);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
    return groups;
  }, {} as Record<string, T[]>);
}

/**
 * Partition array into two arrays based on predicate
 */
export function partition<T>(
  arr: T[],
  predicate: (item: T) => boolean,
): [T[], T[]] {
  const truthy: T[] = [];
  const falsy: T[] = [];

  for (const item of arr) {
    if (predicate(item)) {
      truthy.push(item);
    } else {
      falsy.push(item);
    }
  }

  return [truthy, falsy];
}

/**
 * Chunk array into smaller arrays of specified size
 */
export function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) throw new Error("Chunk size must be positive");

  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * Sort array by key function
 */
export function sortBy<T>(
  arr: T[],
  keyFn: (item: T) => number | string,
  direction: "asc" | "desc" = "asc",
): T[] {
  return arr.slice().sort((a, b) => {
    const keyA = keyFn(a);
    const keyB = keyFn(b);

    if (keyA < keyB) return direction === "asc" ? -1 : 1;
    if (keyA > keyB) return direction === "asc" ? 1 : -1;
    return 0;
  });
}

/**
 * Sort array by multiple keys
 */
export function sortByMultiple<T>(
  arr: T[],
  keyFns: Array<(item: T) => number | string>,
  directions: Array<"asc" | "desc"> = [],
): T[] {
  return arr.slice().sort((a, b) => {
    for (let i = 0; i < keyFns.length; i++) {
      const keyFn = keyFns[i];
      const direction = directions[i] || "asc";

      const keyA = keyFn(a);
      const keyB = keyFn(b);

      if (keyA < keyB) return direction === "asc" ? -1 : 1;
      if (keyA > keyB) return direction === "asc" ? 1 : -1;
    }
    return 0;
  });
}

/**
 * Find index of element using binary search (array must be sorted)
 */
export function binarySearch<T>(
  arr: T[],
  target: T,
  compareFn?: (a: T, b: T) => number,
): number {
  const compare = compareFn || ((a, b) => a < b ? -1 : a > b ? 1 : 0);

  let left = 0;
  let right = arr.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const comparison = compare(arr[mid], target);

    if (comparison === 0) {
      return mid;
    } else if (comparison < 0) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return -1;
}

/**
 * Shuffle array randomly (Fisher-Yates algorithm)
 */
export function shuffle<T>(arr: T[]): T[] {
  const result = arr.slice();

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

/**
 * Sample n random elements from array
 */
export function sample<T>(arr: T[], n: number): T[] {
  if (n >= arr.length) return shuffle(arr);

  const result: T[] = [];
  const indices = new Set<number>();

  while (result.length < n) {
    const index = Math.floor(Math.random() * arr.length);
    if (!indices.has(index)) {
      indices.add(index);
      result.push(arr[index]);
    }
  }

  return result;
}

/**
 * Zip multiple arrays together
 */
export function zip<T>(...arrays: T[][]): T[][] {
  const maxLength = Math.max(...arrays.map((arr) => arr.length));
  const result: T[][] = [];

  for (let i = 0; i < maxLength; i++) {
    result.push(arrays.map((arr) => arr[i]));
  }

  return result;
}

/**
 * Unzip array of tuples
 */
export function unzip<T>(arr: T[][]): T[][] {
  if (arr.length === 0) return [];

  const result: T[][] = [];
  const maxLength = Math.max(...arr.map((tuple) => tuple.length));

  for (let i = 0; i < maxLength; i++) {
    result.push(arr.map((tuple) => tuple[i]));
  }

  return result;
}

/**
 * Intersection of multiple arrays
 */
export function intersection<T>(...arrays: T[][]): T[] {
  if (arrays.length === 0) return [];
  if (arrays.length === 1) return arrays[0].slice();

  const first = new Set(arrays[0]);
  const result: T[] = [];

  for (const item of first) {
    if (arrays.slice(1).every((arr) => arr.includes(item))) {
      result.push(item);
    }
  }

  return result;
}

/**
 * Union of multiple arrays (unique elements)
 */
export function union<T>(...arrays: T[][]): T[] {
  const set = new Set<T>();
  for (const arr of arrays) {
    for (const item of arr) {
      set.add(item);
    }
  }
  return Array.from(set);
}

/**
 * Difference of two arrays (elements in first but not in second)
 */
export function difference<T>(arr1: T[], arr2: T[]): T[] {
  const set2 = new Set(arr2);
  return arr1.filter((item) => !set2.has(item));
}

/**
 * Symmetric difference (elements in either array but not both)
 */
export function symmetricDifference<T>(arr1: T[], arr2: T[]): T[] {
  const set1 = new Set(arr1);
  const set2 = new Set(arr2);

  const result: T[] = [];

  for (const item of arr1) {
    if (!set2.has(item)) {
      result.push(item);
    }
  }

  for (const item of arr2) {
    if (!set1.has(item)) {
      result.push(item);
    }
  }

  return result;
}

/**
 * Cartesian product of arrays
 */
export function cartesianProduct<T>(...arrays: T[][]): T[][] {
  if (arrays.length === 0) return [];
  if (arrays.length === 1) return arrays[0].map((item) => [item]);

  return arrays.reduce<T[][]>(
    (acc, arr) => {
      const result: T[][] = [];
      for (const item1 of acc) {
        for (const item2 of arr) {
          result.push([...item1, item2]);
        }
      }
      return result;
    },
    [[]] as T[][],
  );
}

/**
 * Take first n elements
 */
export function take<T>(arr: T[], n: number): T[] {
  return arr.slice(0, Math.max(0, n));
}

/**
 * Take last n elements
 */
export function takeLast<T>(arr: T[], n: number): T[] {
  return arr.slice(Math.max(0, arr.length - n));
}

/**
 * Drop first n elements
 */
export function drop<T>(arr: T[], n: number): T[] {
  return arr.slice(Math.max(0, n));
}

/**
 * Drop last n elements
 */
export function dropLast<T>(arr: T[], n: number): T[] {
  return arr.slice(0, Math.max(0, arr.length - n));
}

/**
 * Rotate array by n positions
 */
export function rotate<T>(arr: T[], n: number): T[] {
  if (arr.length === 0) return [];

  const len = arr.length;
  n = ((n % len) + len) % len; // Handle negative rotation

  return [...arr.slice(n), ...arr.slice(0, n)];
}

/**
 * Count occurrences of each element
 */
export function countBy<T>(arr: T[]): Map<T, number> {
  const counts = new Map<T, number>();

  for (const item of arr) {
    counts.set(item, (counts.get(item) || 0) + 1);
  }

  return counts;
}

/**
 * Find all indices where element appears
 */
export function findIndices<T>(arr: T[], predicate: (item: T) => boolean): number[] {
  const indices: number[] = [];

  for (let i = 0; i < arr.length; i++) {
    if (predicate(arr[i])) {
      indices.push(i);
    }
  }

  return indices;
}

/**
 * Check if arrays are equal (shallow comparison)
 */
export function arraysEqual<T>(arr1: T[], arr2: T[]): boolean {
  if (arr1.length !== arr2.length) return false;

  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i] !== arr2[i]) {
      return false;
    }
  }

  return true;
}

/**
 * Compact array (remove null, undefined, false, 0, NaN, '')
 */
export function compact<T>(arr: (T | null | undefined | false | 0 | "")[]): T[] {
  return arr.filter((item) => item) as T[];
}

/**
 * Transpose 2D array (swap rows and columns)
 */
export function transpose<T>(matrix: T[][]): T[][] {
  if (matrix.length === 0) return [];

  const rows = matrix.length;
  const cols = Math.max(...matrix.map((row) => row.length));
  const result: T[][] = [];

  for (let col = 0; col < cols; col++) {
    const row: T[] = [];
    for (let rowIdx = 0; rowIdx < rows; rowIdx++) {
      row.push(matrix[rowIdx][col]);
    }
    result.push(row);
  }

  return result;
}

/**
 * Topological sort - order nodes by dependencies
 * Used by executor to order execution steps
 *
 * Returns nodes in order such that all dependencies come before dependents
 * Throws error if circular dependency detected
 */
export function topologicalSort(graph: DependencyGraph): string[] {
  const { nodes, edges } = graph;

  // Track nodes with no incoming edges
  const inDegree = new Map<string, number>();
  for (const node of nodes) {
    inDegree.set(node, 0);
  }

  // Calculate in-degrees
  for (const [node, deps] of edges) {
    for (const dep of deps) {
      inDegree.set(node, (inDegree.get(node) || 0) + 1);
    }
  }

  // Queue of nodes with no dependencies
  const queue: string[] = [];
  for (const [node, degree] of inDegree) {
    if (degree === 0) {
      queue.push(node);
    }
  }

  const result: string[] = [];

  // Process nodes
  while (queue.length > 0) {
    const node = queue.shift()!;
    result.push(node);

    // Find all nodes that depend on current node
    for (const [dependent, deps] of edges) {
      if (deps.includes(node)) {
        const newDegree = (inDegree.get(dependent) || 0) - 1;
        inDegree.set(dependent, newDegree);

        if (newDegree === 0) {
          queue.push(dependent);
        }
      }
    }
  }

  // Check for cycles
  if (result.length !== nodes.length) {
    const remaining = nodes.filter((n) => !result.includes(n));
    throw new Error(`Circular dependency detected involving: ${remaining.join(", ")}`);
  }

  return result;
}

/**
 * Build dependency graph from nodes and dependency map
 */
export function buildDependencyGraph(
  nodes: string[],
  getDependencies: (node: string) => string[],
): DependencyGraph {
  const edges = new Map<string, string[]>();

  for (const node of nodes) {
    const deps = getDependencies(node);
    if (deps.length > 0) {
      edges.set(node, deps);
    }
  }

  return { nodes, edges };
}

/**
 * Detect cycles in dependency graph
 */
export function hasCycle(graph: DependencyGraph): boolean {
  try {
    topologicalSort(graph);
    return false;
  } catch {
    return true;
  }
}

/**
 * Range - create array of numbers from start to end
 */
export function range(start: number, end?: number, step: number = 1): number[] {
  if (end === undefined) {
    end = start;
    start = 0;
  }

  if (step === 0) throw new Error("Step cannot be zero");

  const result: number[] = [];
  if (step > 0) {
    for (let i = start; i < end; i += step) {
      result.push(i);
    }
  } else {
    for (let i = start; i > end; i += step) {
      result.push(i);
    }
  }

  return result;
}

/**
 * Sum of array elements
 */
export function sum(arr: number[]): number {
  return arr.reduce((acc, val) => acc + val, 0);
}

/**
 * Average of array elements
 */
export function average(arr: number[]): number {
  if (arr.length === 0) return 0;
  return sum(arr) / arr.length;
}

/**
 * Median of array elements
 */
export function median(arr: number[]): number {
  if (arr.length === 0) return 0;

  const sorted = arr.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  return sorted[mid];
}

/**
 * Mode (most frequent value) of array elements
 */
export function mode<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined;

  const counts = countBy(arr);
  let maxCount = 0;
  let modeValue: T | undefined;

  for (const [value, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      modeValue = value;
    }
  }

  return modeValue;
}

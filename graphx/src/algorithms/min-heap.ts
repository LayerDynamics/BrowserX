/**
 * Binary min-heap (priority queue) for Dijkstra's algorithm.
 * Supports O(log n) insert and extractMin, and O(n) decreaseKey.
 */
export class MinHeap<T> {
  private heap: { key: T; priority: number }[] = [];
  private index: Map<T, number> = new Map();

  get size(): number {
    return this.heap.length;
  }

  insert(key: T, priority: number): void {
    const entry = { key, priority };
    this.heap.push(entry);
    const idx = this.heap.length - 1;
    this.index.set(key, idx);
    this.bubbleUp(idx);
  }

  extractMin(): { key: T; priority: number } | undefined {
    if (this.heap.length === 0) return undefined;

    const min = this.heap[0];
    this.index.delete(min.key);

    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.index.set(last.key, 0);
      this.sinkDown(0);
    }

    return min;
  }

  decreaseKey(key: T, newPriority: number): void {
    const idx = this.index.get(key);
    if (idx === undefined) return;
    if (newPriority >= this.heap[idx].priority) return;
    this.heap[idx].priority = newPriority;
    this.bubbleUp(idx);
  }

  has(key: T): boolean {
    return this.index.has(key);
  }

  private bubbleUp(idx: number): void {
    while (idx > 0) {
      const parent = (idx - 1) >> 1;
      if (this.heap[idx].priority >= this.heap[parent].priority) break;
      this.swap(idx, parent);
      idx = parent;
    }
  }

  private sinkDown(idx: number): void {
    const length = this.heap.length;
    while (true) {
      let smallest = idx;
      const left = 2 * idx + 1;
      const right = 2 * idx + 2;

      if (left < length && this.heap[left].priority < this.heap[smallest].priority) {
        smallest = left;
      }
      if (right < length && this.heap[right].priority < this.heap[smallest].priority) {
        smallest = right;
      }
      if (smallest === idx) break;
      this.swap(idx, smallest);
      idx = smallest;
    }
  }

  private swap(i: number, j: number): void {
    const a = this.heap[i];
    const b = this.heap[j];
    this.heap[i] = b;
    this.heap[j] = a;
    this.index.set(a.key, j);
    this.index.set(b.key, i);
  }
}

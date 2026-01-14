// worker_proxy.ts - Multi-worker proxy

// Main process
const workerCount = navigator.hardwareConcurrency || 4;
console.log(`=== Multi-Worker Proxy ===`);
console.log(`Spawning ${workerCount} worker threads...\n`);

const workers: Worker[] = [];

for (let i = 0; i < workerCount; i++) {
  const worker = new Worker(new URL("./proxy_worker.ts", import.meta.url).href, {
    type: "module",
  });

  worker.onmessage = (event) => {
    console.log(`[Worker ${i}] ${event.data}`);
  };

  worker.onerror = (error) => {
    console.error(`[Worker ${i}] Error:`, error.message);
  };

  workers.push(worker);
  console.log(`[Main] Worker ${i} spawned`);
}

// Distribute connections across workers (round-robin)
let currentWorker = 0;

// Simulated connection distribution
setInterval(() => {
  const worker = workers[currentWorker];
  worker.postMessage({ type: "handle_connection", connId: Math.random().toString(36) });

  currentWorker = (currentWorker + 1) % workerCount;
}, 1000);

console.log("\n=== Key Benefits ===");
console.log("✓ Utilizes all CPU cores");
console.log("✓ True parallel processing");
console.log("✓ Worker isolation (crash in one does not affect others)");
console.log("✓ Scales with hardware");

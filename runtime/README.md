# BrowserX Runtime

Unified runtime coordinator for the BrowserX system. Provides lifecycle management, event loop coordination, and cross-layer resource management for the browser, proxy, and query engines.

## Quick Start

```typescript
import { createRuntime, BrowserXRuntime } from "@browserx/runtime";

// Create with default configuration
const runtime = createRuntime();

// Or with custom options
const runtime = new BrowserXRuntime({
  config: {
    browser: {
      maxInstances: 5,
      idleTimeout: 60000,
    },
    eventLoop: {
      tickInterval: 10,
    },
  },
});

// Initialize and start
await runtime.initialize();

// Get runtime stats
const stats = runtime.getStats();
console.log(stats);

// Graceful shutdown
await runtime.shutdown();
```

## Features

### Lifecycle Management

- **Initialization Sequence**: Ordered startup of all components
- **Shutdown Sequence**: Graceful shutdown with configurable timeouts
- **Component State Tracking**: Monitor state of each subsystem

### Event Coordination

- **Proxy Event Loop**: Manages proxy engine async operations
- **Browser Event Loops**: Per-instance event loops for browser tabs
- **Cross-Component Events**: Unified event bus for system events

### Resource Management

- **Browser Pool**: Pool of browser instances with lifecycle management
- **Connection Pooling**: Reuse HTTP connections across requests
- **Memory Management**: Track and limit memory usage

### Signal Handling

- **SIGINT/SIGTERM**: Graceful shutdown on termination signals
- **Custom Signal Handlers**: Register callbacks for signal events

### Metrics & Health

- **Unified Metrics**: Collect metrics from all components
- **Health Checks**: Monitor component health status
- **Export Formats**: Prometheus, JSON

## Configuration

```typescript
interface BrowserXRuntimeConfig {
  browser: {
    maxInstances: number;      // Max browser instances (default: 5)
    minInstances: number;      // Min warm instances (default: 0)
    idleTimeout: number;       // Instance idle timeout ms (default: 60000)
    launchTimeout: number;     // Launch timeout ms (default: 30000)
  };
  eventLoop: {
    tickInterval: number;      // Event loop tick interval ms (default: 10)
    maxTickDuration: number;   // Max tick duration ms (default: 100)
  };
  shutdown: {
    timeout: number;           // Total shutdown timeout ms (default: 30000)
    drainTimeout: number;      // Connection drain timeout ms (default: 5000)
    forceExitOnTimeout: boolean; // Force exit on timeout (default: true)
  };
  signals: {
    handleSIGINT: boolean;     // Handle SIGINT (default: true)
    handleSIGTERM: boolean;    // Handle SIGTERM (default: true)
  };
  metrics: {
    enabled: boolean;          // Enable metrics (default: true)
    exportFormat: string;      // "prometheus" | "json"
  };
}
```

### Preset Configurations

```typescript
import {
  createDefaultConfig,
  createDevelopmentConfig,
  createTestConfig,
  mergeConfig,
} from "@browserx/runtime";

// Production defaults
const prodConfig = createDefaultConfig();

// Development (more logging, faster timeouts)
const devConfig = createDevelopmentConfig();

// Testing (minimal resources, fast timeouts)
const testConfig = createTestConfig();

// Merge custom options with defaults
const customConfig = mergeConfig({
  browser: { maxInstances: 10 },
});
```

## API Reference

### BrowserXRuntime

```typescript
class BrowserXRuntime {
  // Lifecycle
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  getState(): RuntimeState;

  // Stats & Health
  getStats(): RuntimeStats;
  checkHealth(): Promise<HealthCheckResult>;

  // Events
  addEventListener(listener: RuntimeEventListener): void;
  removeEventListener(listener: RuntimeEventListener): void;

  // Subsystems (public access)
  eventCoordinator: EventCoordinator;
  browserPool: BrowserPool;
  signalHandler: SignalHandler;
  metricsCollector: UnifiedMetricsCollector;
  healthChecker: HealthChecker;
}
```

### RuntimeStats

```typescript
interface RuntimeStats {
  state: RuntimeState;
  uptime: number;
  eventLoops: {
    proxyLoopRunning: boolean;
    browserLoopsActive: number;
  };
  resources: {
    browserInstances: number;
    activeSessions: number;
    memoryUsage: number;
  };
  queries: {
    total: number;
    successful: number;
    failed: number;
    averageExecutionTime: number;
  };
}
```

## Development

```bash
# Type check
deno task runtime:check

# Run tests
deno task runtime:test

# Watch mode
deno task runtime:check:watch
```

## Architecture

```text
Runtime
├── src/
│   ├── BrowserXRuntime.ts   # Main runtime class
│   ├── types.ts             # Type definitions
│   ├── config/              # Configuration presets
│   ├── lifecycle/           # Init/shutdown sequences
│   ├── events/              # Event coordination
│   ├── resources/           # Browser pool
│   ├── signals/             # Signal handling
│   └── metrics/             # Metrics & health
└── tests/
```

## Integration

The runtime is used by the MCP server and can be used directly for programmatic control:

```typescript
import { createRuntime } from "@browserx/runtime";
import { QueryEngine } from "@browserx/query-engine";

const runtime = createRuntime();
await runtime.initialize();

// Create query engine with runtime
const queryEngine = new QueryEngine({
  runtime,
  browser: { headless: true },
});

// Execute queries...
const result = await queryEngine.execute(
  'SELECT title FROM "https://example.com"'
);

await runtime.shutdown();
```

# Browser Engine Examples

Practical examples demonstrating how to use the BrowserX Browser Engine.

## Overview

This directory contains runnable code examples showing real-world usage of the browser engine components.

## Available Examples

### Basic Usage

- **01-simple-request.ts** - Making HTTP requests with RequestPipeline
- **02-html-parsing.ts** - Parsing HTML and accessing the DOM
- **03-css-styling.ts** - CSS parsing and style computation
- **04-layout-rendering.ts** - Layout calculation and rendering

### Advanced Features

- **05-javascript-execution.ts** - Running JavaScript with V8
- **06-webgpu-rendering.ts** - GPU-accelerated rendering
- **07-storage-apis.ts** - Using localStorage, cookies, IndexedDB
- **08-connection-pooling.ts** - Efficient connection reuse

### Composition Patterns

- **09-custom-pipeline.ts** - Building custom request/rendering pipelines
- **10-middleware.ts** - Adding custom middleware
- **11-subsystem-access.ts** - Direct subsystem usage

## Running Examples

```bash
cd browser

# Basic example with network access
deno run --allow-net docs/examples/01-simple-request.ts

# Example requiring all permissions
deno run --allow-all docs/examples/06-webgpu-rendering.ts
```

## Example Structure

Each example follows this pattern:

```typescript
/**
 * Example: [Name]
 *
 * Description of what this example demonstrates.
 */

import { ... } from "../../mod.ts";

// Setup
const config = { ... };

// Usage
async function main() {
  // Example code with comments
}

// Run
if (import.meta.main) {
  await main();
}
```

## Status

🚧 **In Progress** - Examples are being added as components are implemented.

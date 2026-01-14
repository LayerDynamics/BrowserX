# Browser Engine API Reference

API documentation for the BrowserX Browser Engine.

## Overview

This directory contains detailed API documentation for all public interfaces and classes in the browser engine.

## Contents

### Core Classes

- **Browser** - Main browser orchestration class
- **RequestPipeline** - HTTP networking stack
- **RenderingPipeline** - HTML/CSS parsing and rendering
- **ScriptExecutor** - JavaScript execution engine
- **WebGPUEngine** - GPU-accelerated rendering

### Network Layer

- **DNSResolver** - DNS resolution with caching
- **ConnectionPool** - TCP/TLS connection pooling
- **HTTPRequest** / **HTTPResponse** - HTTP protocol types
- **TLSConnection** - TLS/SSL security layer

### Rendering Layer

- **HTMLParser** - HTML tokenization and tree building
- **CSSParser** - CSS parsing and CSSOM construction
- **StyleResolver** - CSS cascade and inheritance
- **LayoutEngine** - Box model and layout algorithms
- **PaintEngine** - Display list generation
- **Compositor** - Layer composition and GPU upload

### JavaScript Layer

- **V8Isolate** - V8 execution environment
- **V8Context** - JavaScript execution context
- **EventLoop** - Async task scheduling
- **WindowObject** - DOM Window API

### Storage Layer

- **StorageManager** - localStorage and sessionStorage
- **CookieManager** - HTTP cookie management
- **IndexedDB** - Object store database
- **CacheAPI** - HTTP response caching
- **QuotaManager** - Storage quota enforcement

## Usage

Each API document includes:
- Class/interface definition
- Constructor parameters
- Public methods with parameters and return types
- Usage examples
- Type definitions

## Status

🚧 **In Progress** - API documentation is being written as components are implemented.

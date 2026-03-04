/**
 * Domain Agents Module
 *
 * Exports all 14 DevTools domain agents and the base domain class.
 * Each domain hooks into a specific BrowserX subsystem to provide
 * Chrome DevTools Protocol-compatible inspection and debugging.
 */

// Base domain (abstract class and context type)
export { BaseDomain, type DomainInitContext } from "./base-domain.ts";

// Core domains
export { DOMDomain } from "./dom/dom-domain.ts";
export { PageDomain } from "./page/page-domain.ts";
export { NetworkDomain } from "./network/network-domain.ts";
export { CSSDomain } from "./css/css-domain.ts";
export { RuntimeDomain } from "./runtime/runtime-domain.ts";
export { ConsoleDomain } from "./console/console-domain.ts";

// Advanced domains
export { StorageDomain } from "./storage/storage-domain.ts";
export { SecurityDomain } from "./security/security-domain.ts";
export { PerformanceDomain } from "./performance/performance-domain.ts";
export { MemoryDomain } from "./memory/memory-domain.ts";
export { RenderingDomain } from "./rendering/rendering-domain.ts";
export { DebuggerDomain } from "./debugger/debugger-domain.ts";
export { OverlayDomain } from "./overlay/overlay-domain.ts";
export { EmulationDomain } from "./emulation/emulation-domain.ts";

// Device domains
export { SerialDomain } from "./serial/serial-domain.ts";

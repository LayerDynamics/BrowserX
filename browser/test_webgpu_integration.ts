/**
 * Test webgpu_x integration with browser WebGPU module
 */

import {
    detectGPUVendor,
    getVendorName,
    isNVIDIA,
    getOptimalWorkgroupSize,
    detectPlatform,
    Platform,
    isAppleSilicon,
    getSystemInfo,
} from "./src/engine/webgpu/mod.ts";

console.log("=== WebGPU Integration Test ===\n");

// Test GPU vendor detection
console.log("GPU Vendor Detection:");
const nvidiaId = 0x10DE;
const vendor = detectGPUVendor(nvidiaId);
console.log(`  Vendor ID ${nvidiaId.toString(16)} -> ${getVendorName(nvidiaId)}`);
console.log(`  Is NVIDIA? ${isNVIDIA(nvidiaId)}`);
console.log();

// Test optimal workgroup size
console.log("Optimal Workgroup Size:");
const optimal = getOptimalWorkgroupSize(1024 * 1024, 256, nvidiaId);
console.log(`  For problem size 1M, max 256 -> ${optimal}`);
console.log();

// Test platform detection
console.log("Platform Detection:");
const platform = detectPlatform();
console.log(`  Platform: ${platform}`);
if (platform === Platform.Darwin) {
    console.log(`  Apple Silicon: ${isAppleSilicon()}`);
}
console.log();

// Test system info
console.log("System Info:");
const systemInfo = getSystemInfo();
console.log(`  Platform: ${systemInfo.platform}`);
console.log(`  Version: ${systemInfo.version}`);
if (systemInfo.preferredBackend) {
    console.log(`  Preferred Backend: ${systemInfo.preferredBackend}`);
}
if (systemInfo.memoryStrategy) {
    console.log(`  Memory Strategy: ${systemInfo.memoryStrategy}`);
}
console.log();

console.log("✅ WebGPU integration test completed successfully!");

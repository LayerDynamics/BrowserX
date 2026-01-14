#!/usr/bin/env -S deno test --allow-ffi --unstable-ffi

import { assert, assertEquals, assertExists } from "jsr:@std/assert";
import { WebGPUX, GPUVendor, MetalFamily, ROCmArchitecture } from "./webgpu_x.ts";

Deno.test("WebGPUX - Initialization", () => {
  const webgpuX = new WebGPUX();
  assertExists(webgpuX);
  console.log(`✓ WebGPUX initialized, version: ${webgpuX.version}`);
});

Deno.test("WebGPUX - Version info", () => {
  const webgpuX = new WebGPUX();
  const version = webgpuX.version;
  assertExists(version);
  assertEquals(typeof version, "string");
  console.log(`✓ Version: ${version}`);
});

Deno.test("GPU Detection - NVIDIA", () => {
  const webgpuX = new WebGPUX();
  const vendor = webgpuX.detectVendor(0x10DE);
  assertEquals(vendor, GPUVendor.NVIDIA);
  assertEquals(webgpuX.getVendorName(0x10DE), "NVIDIA");
  console.log(`✓ Detected NVIDIA (0x10DE) -> ${GPUVendor[vendor]}`);
});

Deno.test("GPU Detection - AMD", () => {
  const webgpuX = new WebGPUX();
  const vendor = webgpuX.detectVendor(0x1002);
  assertEquals(vendor, GPUVendor.AMD);
  assertEquals(webgpuX.getVendorName(0x1002), "AMD");
  console.log(`✓ Detected AMD (0x1002) -> ${GPUVendor[vendor]}`);
});

Deno.test("GPU Detection - Intel", () => {
  const webgpuX = new WebGPUX();
  const vendor = webgpuX.detectVendor(0x8086);
  assertEquals(vendor, GPUVendor.Intel);
  assertEquals(webgpuX.getVendorName(0x8086), "Intel");
  console.log(`✓ Detected Intel (0x8086) -> ${GPUVendor[vendor]}`);
});

Deno.test("GPU Detection - Apple", () => {
  const webgpuX = new WebGPUX();
  const vendor = webgpuX.detectVendor(0x106B);
  assertEquals(vendor, GPUVendor.Apple);
  assertEquals(webgpuX.getVendorName(0x106B), "Apple");
  console.log(`✓ Detected Apple (0x106B) -> ${GPUVendor[vendor]}`);
});

Deno.test("GPU Detection - Unknown vendor", () => {
  const webgpuX = new WebGPUX();
  const vendor = webgpuX.detectVendor(0xFFFF);
  assertEquals(vendor, GPUVendor.Unknown);
  console.log(`✓ Unknown vendor (0xFFFF) -> ${GPUVendor[vendor]}`);
});

Deno.test("Optimal Workgroup Size - NVIDIA", () => {
  const webgpuX = new WebGPUX();
  const size = webgpuX.getOptimalWorkgroupSize(1024, 1024, GPUVendor.NVIDIA);
  assertEquals(typeof size, "number");
  assertEquals(size > 0, true);
  console.log(`✓ NVIDIA optimal workgroup size: ${size}`);
});

Deno.test("Optimal Workgroup Size - AMD", () => {
  const webgpuX = new WebGPUX();
  const size = webgpuX.getOptimalWorkgroupSize(1024, 1024, GPUVendor.AMD);
  assertEquals(typeof size, "number");
  assertEquals(size > 0, true);
  console.log(`✓ AMD optimal workgroup size: ${size}`);
});

Deno.test("Optimal Workgroup Size - Intel", () => {
  const webgpuX = new WebGPUX();
  const size = webgpuX.getOptimalWorkgroupSize(1024, 1024, GPUVendor.Intel);
  assertEquals(typeof size, "number");
  assertEquals(size > 0, true);
  console.log(`✓ Intel optimal workgroup size: ${size}`);
});

Deno.test("Buffer Pool - Basic operations", () => {
  const webgpuX = new WebGPUX();

  // Clear pool first
  webgpuX.clearBufferPool();

  // Try to acquire (should fail since pool is empty and we're not creating real GPU buffers)
  const handle = webgpuX.acquireBuffer(1024n, 0x80); // STORAGE usage
  console.log(`✓ Buffer acquire returned handle: ${handle}`);

  // Test pool management functions exist
  webgpuX.evictBuffers();
  console.log(`✓ Buffer pool eviction completed`);
});

Deno.test("Platform Detection - Darwin/macOS", { ignore: Deno.build.os !== "darwin" }, () => {
  const webgpuX = new WebGPUX();

  const isAppleSilicon = webgpuX.isAppleSilicon();
  assertEquals(typeof isAppleSilicon, "boolean");
  console.log(`✓ Is Apple Silicon: ${isAppleSilicon}`);

  const backend = webgpuX.darwinPreferredBackend();
  assertExists(backend);
  console.log(`✓ Preferred backend: ${backend}`);

  const memStrategy = webgpuX.darwinRecommendedMemoryStrategy();
  assertExists(memStrategy);
  console.log(`✓ Memory strategy: ${memStrategy}`);
});

Deno.test("Platform Detection - Linux", { ignore: Deno.build.os !== "linux" }, () => {
  const webgpuX = new WebGPUX();

  const isArm = webgpuX.linuxIsArm();
  assertEquals(typeof isArm, "boolean");
  console.log(`✓ Is ARM: ${isArm}`);

  const cpuCount = webgpuX.linuxGetCpuCount();
  assertEquals(typeof cpuCount, "number");
  assertEquals(cpuCount > 0, true);
  console.log(`✓ CPU count: ${cpuCount}`);

  const pageSize = webgpuX.linuxGetPageSize();
  assertEquals(typeof pageSize, "bigint");
  assertEquals(pageSize > 0n, true);
  console.log(`✓ Page size: ${pageSize} bytes`);

  const totalMem = webgpuX.linuxGetTotalMemory();
  assertEquals(typeof totalMem, "bigint");
  assertEquals(totalMem > 0n, true);
  console.log(`✓ Total memory: ${totalMem} bytes (${Number(totalMem) / 1024 / 1024 / 1024} GB)`);

  const hasNvidia = webgpuX.linuxHasNvidiaDriver();
  assertEquals(typeof hasNvidia, "boolean");
  console.log(`✓ Has NVIDIA driver: ${hasNvidia}`);

  const hasRocm = webgpuX.linuxHasRocmDriver();
  assertEquals(typeof hasRocm, "boolean");
  console.log(`✓ Has ROCm driver: ${hasRocm}`);

  const hasIntel = webgpuX.linuxHasIntelGpu();
  assertEquals(typeof hasIntel, "boolean");
  console.log(`✓ Has Intel GPU: ${hasIntel}`);

  const backend = webgpuX.linuxPreferredBackend();
  assertExists(backend);
  console.log(`✓ Preferred backend: ${backend}`);

  const memStrategy = webgpuX.linuxRecommendedMemoryStrategy();
  assertExists(memStrategy);
  console.log(`✓ Memory strategy: ${memStrategy}`);
});

Deno.test("Platform Detection - Windows", { ignore: Deno.build.os !== "windows" }, () => {
  const webgpuX = new WebGPUX();

  const isArm = webgpuX.windowsIsArm();
  assertEquals(typeof isArm, "boolean");
  console.log(`✓ Is ARM: ${isArm}`);

  const procCount = webgpuX.windowsGetLogicalProcessorCount();
  assertEquals(typeof procCount, "number");
  assertEquals(procCount > 0, true);
  console.log(`✓ Logical processor count: ${procCount}`);

  const pageSize = webgpuX.windowsGetPageSize();
  assertEquals(typeof pageSize, "bigint");
  assertEquals(pageSize > 0n, true);
  console.log(`✓ Page size: ${pageSize} bytes`);

  const hasNvidia = webgpuX.windowsHasNvidiaDriver();
  assertEquals(typeof hasNvidia, "boolean");
  console.log(`✓ Has NVIDIA driver: ${hasNvidia}`);

  const hasAmd = webgpuX.windowsHasAmdDriver();
  assertEquals(typeof hasAmd, "boolean");
  console.log(`✓ Has AMD driver: ${hasAmd}`);

  const hasIntel = webgpuX.windowsHasIntelDriver();
  assertEquals(typeof hasIntel, "boolean");
  console.log(`✓ Has Intel driver: ${hasIntel}`);

  const hasDx12 = webgpuX.windowsHasDx12();
  assertEquals(typeof hasDx12, "boolean");
  console.log(`✓ Has DX12: ${hasDx12}`);

  const backend = webgpuX.windowsPreferredBackend();
  assertExists(backend);
  console.log(`✓ Preferred backend: ${backend}`);

  const memStrategy = webgpuX.windowsRecommendedMemoryStrategy();
  assertExists(memStrategy);
  console.log(`✓ Memory strategy: ${memStrategy}`);
});

Deno.test("Metal - GPU capabilities", () => {
  const webgpuX = new WebGPUX();

  // Test with Apple7 family (typical modern M-series chip)
  const family = MetalFamily.Apple7;

  const workgroupSize = webgpuX.metalOptimalWorkgroupSize(family);
  assertEquals(typeof workgroupSize, "number");
  assertEquals(workgroupSize > 0, true);
  console.log(`✓ Metal Apple7 optimal workgroup size: ${workgroupSize}`);

  const simdSize = webgpuX.metalSimdGroupSize(family);
  assertEquals(typeof simdSize, "number");
  assertEquals(simdSize > 0, true);
  console.log(`✓ Metal Apple7 SIMD group size: ${simdSize}`);

  const threadgroupMem = webgpuX.metalMaxThreadgroupMemory(family);
  assertEquals(typeof threadgroupMem, "bigint");
  assertEquals(threadgroupMem > 0n, true);
  console.log(`✓ Metal Apple7 max threadgroup memory: ${threadgroupMem} bytes`);

  const supportsRaytracing = webgpuX.metalSupportsRaytracing(family);
  assertEquals(typeof supportsRaytracing, "boolean");
  console.log(`✓ Metal Apple7 supports raytracing: ${supportsRaytracing}`);

  const supportsTier2Args = webgpuX.metalSupportsTier2ArgumentBuffers(family);
  assertEquals(typeof supportsTier2Args, "boolean");
  console.log(`✓ Metal Apple7 supports tier 2 argument buffers: ${supportsTier2Args}`);
});

Deno.test("ROCm - GPU capabilities", () => {
  const webgpuX = new WebGPUX();

  // Test with RDNA2 architecture
  const arch = ROCmArchitecture.RDNA2;

  const workgroupSize = webgpuX.rocmOptimalWorkgroupSize(arch);
  assertEquals(typeof workgroupSize, "number");
  assertEquals(workgroupSize > 0, true);
  console.log(`✓ ROCm RDNA2 optimal workgroup size: ${workgroupSize}`);

  const wavefrontSize = webgpuX.rocmWavefrontSize(arch);
  assertEquals(typeof wavefrontSize, "number");
  assertEquals(wavefrontSize > 0, true);
  console.log(`✓ ROCm RDNA2 wavefront size: ${wavefrontSize}`);

  const ldsSize = webgpuX.rocmLdsSizePerCu(arch);
  assertEquals(typeof ldsSize, "bigint");
  assertEquals(ldsSize > 0n, true);
  console.log(`✓ ROCm RDNA2 LDS size per CU: ${ldsSize} bytes`);

  const hasMatrixCores = webgpuX.rocmHasMatrixCores(arch);
  assertEquals(typeof hasMatrixCores, "boolean");
  console.log(`✓ ROCm RDNA2 has matrix cores: ${hasMatrixCores}`);

  const supportsFp64 = webgpuX.rocmSupportsFp64(arch);
  assertEquals(typeof supportsFp64, "boolean");
  console.log(`✓ ROCm RDNA2 supports FP64: ${supportsFp64}`);

  const occupancy = webgpuX.rocmCalculateOccupancy(256, 16384n, arch);
  assertEquals(typeof occupancy, "number");
  assertEquals(occupancy >= 0 && occupancy <= 1, true);
  console.log(`✓ ROCm RDNA2 occupancy (256 threads, 16KB shared): ${(occupancy * 100).toFixed(1)}%`);
});

Deno.test("CUDA - GPU capabilities", () => {
  const webgpuX = new WebGPUX();

  // Test with compute capability 8.6 (RTX 3000 series)
  const computeMajor = 8;
  const computeMinor = 6;

  const workgroupSize = webgpuX.cudaOptimalWorkgroupSize(computeMajor, computeMinor);
  assertEquals(typeof workgroupSize, "number");
  assertEquals(workgroupSize > 0, true);
  console.log(`✓ CUDA 8.6 optimal workgroup size: ${workgroupSize}`);

  const bankSize = webgpuX.cudaSharedMemoryBankSize(computeMajor);
  assertEquals(typeof bankSize, "number");
  assertEquals(bankSize > 0, true);
  console.log(`✓ CUDA 8.6 shared memory bank size: ${bankSize} bytes`);

  const hasTensorCores = webgpuX.cudaHasTensorCores(computeMajor, computeMinor);
  assertEquals(typeof hasTensorCores, "boolean");
  console.log(`✓ CUDA 8.6 has tensor cores: ${hasTensorCores}`);

  const occupancy = webgpuX.cudaCalculateOccupancy(256, 16384n, computeMajor);
  assertEquals(typeof occupancy, "number");
  assertEquals(occupancy >= 0 && occupancy <= 1, true);
  console.log(`✓ CUDA 8.6 occupancy (256 threads, 16KB shared): ${(occupancy * 100).toFixed(1)}%`);
});

Deno.test("Vulkan - GPU capabilities", () => {
  const webgpuX = new WebGPUX();

  // Test with NVIDIA vendor/device
  const vendorId = 0x10DE;
  const deviceId = 0x2684; // RTX 4090

  const workgroupSize = webgpuX.vulkanOptimalWorkgroupSize(vendorId, deviceId);
  assertEquals(typeof workgroupSize, "number");
  assertEquals(workgroupSize > 0, true);
  console.log(`✓ Vulkan optimal workgroup size: ${workgroupSize}`);

  const supportsVulkan13 = webgpuX.vulkanSupportsVersion(vendorId, deviceId, 1, 3);
  assertEquals(typeof supportsVulkan13, "boolean");
  console.log(`✓ Vulkan 1.3 supported: ${supportsVulkan13}`);

  const supportsRaytracing = webgpuX.vulkanSupportsRaytracing(vendorId, deviceId);
  assertEquals(typeof supportsRaytracing, "boolean");
  console.log(`✓ Vulkan raytracing supported: ${supportsRaytracing}`);

  const descriptorSets = webgpuX.vulkanRecommendedDescriptorSets();
  assertEquals(typeof descriptorSets, "number");
  assertEquals(descriptorSets > 0, true);
  console.log(`✓ Vulkan recommended descriptor sets: ${descriptorSets}`);
});

Deno.test("OpenCL - GPU capabilities", () => {
  const webgpuX = new WebGPUX();

  // Test with NVIDIA vendor
  const vendorId = 0x10DE;
  const deviceId = 0x2684;

  const workgroupSize = webgpuX.openclOptimalWorkgroupSize(vendorId, 1024n);
  assertEquals(typeof workgroupSize, "bigint");
  assertEquals(workgroupSize > 0n, true);
  console.log(`✓ OpenCL optimal workgroup size: ${workgroupSize}`);

  const supportsOpenCL30 = webgpuX.openclSupportsVersion(vendorId, deviceId, 3, 0);
  assertEquals(typeof supportsOpenCL30, "boolean");
  console.log(`✓ OpenCL 3.0 supported: ${supportsOpenCL30}`);

  const supportsFp64 = webgpuX.openclSupportsFp64(vendorId, deviceId);
  assertEquals(typeof supportsFp64, "boolean");
  console.log(`✓ OpenCL FP64 supported: ${supportsFp64}`);
});

Deno.test("Error Handling - Last error", () => {
  const webgpuX = new WebGPUX();
  const lastError = webgpuX.getLastError();
  assertEquals(typeof lastError, "string");
  console.log(`✓ Last error: "${lastError}" (empty is normal)`);
});

// ============================================================================
// Additional Comprehensive Tests
// ============================================================================

Deno.test("GPU Detection - All vendor IDs", () => {
  const webgpuX = new WebGPUX();

  const vendors = [
    { id: 0x10DE, expected: GPUVendor.NVIDIA, name: "NVIDIA" },
    { id: 0x1002, expected: GPUVendor.AMD, name: "AMD (0x1002)" },
    { id: 0x1022, expected: GPUVendor.AMD, name: "AMD (0x1022)" },
    { id: 0x8086, expected: GPUVendor.Intel, name: "Intel (0x8086)" },
    { id: 0x8087, expected: GPUVendor.Intel, name: "Intel (0x8087)" },
    { id: 0x106B, expected: GPUVendor.Apple, name: "Apple" },
    { id: 0x5143, expected: GPUVendor.Qualcomm, name: "Qualcomm" },
    { id: 0x13B5, expected: GPUVendor.ARM, name: "ARM" },
  ];

  for (const { id, expected, name } of vendors) {
    const vendor = webgpuX.detectVendor(id);
    assertEquals(vendor, expected, `Failed for ${name}`);
    console.log(`  ✓ ${name} (0x${id.toString(16).toUpperCase()}) -> ${GPUVendor[vendor]}`);
  }
});

Deno.test("GPU Detection - Edge cases", () => {
  const webgpuX = new WebGPUX();

  // Test boundary values
  assertEquals(webgpuX.detectVendor(0x0000), GPUVendor.Unknown, "0x0000 should be Unknown");
  assertEquals(webgpuX.detectVendor(0xFFFF), GPUVendor.Unknown, "0xFFFF should be Unknown");
  assertEquals(webgpuX.detectVendor(0x1234), GPUVendor.Unknown, "Random ID should be Unknown");

  console.log(`✓ Edge case vendor IDs handled correctly`);
});

Deno.test("Optimal Workgroup Size - All vendors", () => {
  const webgpuX = new WebGPUX();

  const testCases = [
    { vendor: GPUVendor.NVIDIA, expectedSize: 256, name: "NVIDIA" },
    { vendor: GPUVendor.AMD, expectedSize: 256, name: "AMD" },
    { vendor: GPUVendor.Intel, expectedSize: 128, name: "Intel" },
    { vendor: GPUVendor.Apple, expectedSize: 256, name: "Apple" },
    { vendor: GPUVendor.Qualcomm, expectedSize: 64, name: "Qualcomm" },
    { vendor: GPUVendor.ARM, expectedSize: 64, name: "ARM" },
    { vendor: GPUVendor.Unknown, expectedSize: 64, name: "Unknown" },
  ];

  for (const { vendor, expectedSize, name } of testCases) {
    const size = webgpuX.getOptimalWorkgroupSize(1024, 1024, vendor);
    assertEquals(size, expectedSize, `Failed for ${name}`);
    console.log(`  ✓ ${name}: ${size}`);
  }
});

Deno.test("Optimal Workgroup Size - Different problem sizes", () => {
  const webgpuX = new WebGPUX();

  const problemSizes = [64, 256, 1024, 4096, 16384, 65536, 1048576];

  for (const problemSize of problemSizes) {
    const size = webgpuX.getOptimalWorkgroupSize(problemSize, 1024, GPUVendor.NVIDIA);
    assertEquals(typeof size, "number");
    assertEquals(size > 0, true);
    assertEquals(size <= 1024, true, "Should not exceed max workgroup size");
    console.log(`  ✓ Problem size ${problemSize}: workgroup ${size}`);
  }
});

Deno.test("Optimal Workgroup Size - Max workgroup size limits", () => {
  const webgpuX = new WebGPUX();

  const maxSizes = [64, 128, 256, 512, 1024];

  for (const maxSize of maxSizes) {
    const size = webgpuX.getOptimalWorkgroupSize(1024, maxSize, GPUVendor.NVIDIA);
    assertEquals(size <= maxSize, true, `Should not exceed max size ${maxSize}`);
    console.log(`  ✓ Max size ${maxSize}: optimal ${size}`);
  }
});

Deno.test("Buffer Pool - Multiple acquire/release cycles", () => {
  const webgpuX = new WebGPUX();

  webgpuX.clearBufferPool();

  // Simulate multiple acquire/release cycles
  const handles: bigint[] = [];

  for (let i = 0; i < 10; i++) {
    const handle = webgpuX.acquireBuffer(BigInt(1024 * (i + 1)), 0x80);
    handles.push(handle);
  }

  // Release all
  for (const handle of handles) {
    if (handle !== 0n) {
      webgpuX.releaseBuffer(handle);
    }
  }

  console.log(`✓ Completed ${handles.length} acquire/release cycles`);
});

Deno.test("Buffer Pool - Different sizes", () => {
  const webgpuX = new WebGPUX();

  webgpuX.clearBufferPool();

  const sizes = [1024n, 2048n, 4096n, 8192n, 16384n, 32768n, 65536n];

  for (const size of sizes) {
    const handle = webgpuX.acquireBuffer(size, 0x80);
    console.log(`  ✓ Acquired buffer of size ${size}: handle ${handle}`);
  }
});

Deno.test("Buffer Pool - Add and remove operations", () => {
  const webgpuX = new WebGPUX();

  webgpuX.clearBufferPool();

  // Simulate adding buffers to pool
  const testHandle = 123n;
  webgpuX.addBuffer(testHandle, 4096n, 0x80);
  console.log(`✓ Added buffer ${testHandle} to pool`);

  // Remove it
  webgpuX.removeBuffer(testHandle);
  console.log(`✓ Removed buffer ${testHandle} from pool`);

  // Clear pool
  webgpuX.clearBufferPool();
  console.log(`✓ Cleared buffer pool`);

  // Evict old buffers
  webgpuX.evictBuffers();
  console.log(`✓ Evicted old buffers`);
});

Deno.test("Metal - All GPU families", () => {
  const webgpuX = new WebGPUX();

  const families = [
    { family: MetalFamily.Apple1, name: "Apple1" },
    { family: MetalFamily.Apple2, name: "Apple2" },
    { family: MetalFamily.Apple3, name: "Apple3" },
    { family: MetalFamily.Apple4, name: "Apple4" },
    { family: MetalFamily.Apple5, name: "Apple5" },
    { family: MetalFamily.Apple6, name: "Apple6" },
    { family: MetalFamily.Apple7, name: "Apple7" },
    { family: MetalFamily.Apple8, name: "Apple8" },
    { family: MetalFamily.Apple9, name: "Apple9" },
    { family: MetalFamily.Mac1, name: "Mac1" },
    { family: MetalFamily.Mac2, name: "Mac2" },
    { family: MetalFamily.Unknown, name: "Unknown" },
  ];

  for (const { family, name } of families) {
    const workgroupSize = webgpuX.metalOptimalWorkgroupSize(family);
    const simdSize = webgpuX.metalSimdGroupSize(family);
    const threadgroupMem = webgpuX.metalMaxThreadgroupMemory(family);
    const supportsRT = webgpuX.metalSupportsRaytracing(family);
    const supportsTier2 = webgpuX.metalSupportsTier2ArgumentBuffers(family);

    assertEquals(typeof workgroupSize, "number");
    assertEquals(typeof simdSize, "number");
    assertEquals(typeof threadgroupMem, "bigint");
    assertEquals(typeof supportsRT, "boolean");
    assertEquals(typeof supportsTier2, "boolean");

    console.log(`  ✓ ${name}: WG=${workgroupSize}, SIMD=${simdSize}, TG=${threadgroupMem}, RT=${supportsRT}, T2=${supportsTier2}`);
  }
});

Deno.test("ROCm - All architectures", () => {
  const webgpuX = new WebGPUX();

  const architectures = [
    { arch: ROCmArchitecture.GCN, name: "GCN" },
    { arch: ROCmArchitecture.RDNA, name: "RDNA" },
    { arch: ROCmArchitecture.RDNA2, name: "RDNA2" },
    { arch: ROCmArchitecture.RDNA3, name: "RDNA3" },
    { arch: ROCmArchitecture.CDNA, name: "CDNA" },
    { arch: ROCmArchitecture.CDNA2, name: "CDNA2" },
    { arch: ROCmArchitecture.CDNA3, name: "CDNA3" },
    { arch: ROCmArchitecture.Unknown, name: "Unknown" },
  ];

  for (const { arch, name } of architectures) {
    const workgroupSize = webgpuX.rocmOptimalWorkgroupSize(arch);
    const wavefrontSize = webgpuX.rocmWavefrontSize(arch);
    const ldsSize = webgpuX.rocmLdsSizePerCu(arch);
    const hasMatrixCores = webgpuX.rocmHasMatrixCores(arch);
    const supportsFp64 = webgpuX.rocmSupportsFp64(arch);
    const occupancy = webgpuX.rocmCalculateOccupancy(256, 16384n, arch);

    assertEquals(typeof workgroupSize, "number");
    assertEquals(typeof wavefrontSize, "number");
    assertEquals(typeof ldsSize, "bigint");
    assertEquals(typeof hasMatrixCores, "boolean");
    assertEquals(typeof supportsFp64, "boolean");
    assertEquals(typeof occupancy, "number");

    console.log(`  ✓ ${name}: WG=${workgroupSize}, WF=${wavefrontSize}, LDS=${ldsSize}, MC=${hasMatrixCores}, FP64=${supportsFp64}, Occ=${(occupancy * 100).toFixed(1)}%`);
  }
});

Deno.test("ROCm - Occupancy with different configurations", () => {
  const webgpuX = new WebGPUX();

  const configs = [
    { threads: 64, sharedMem: 0n },
    { threads: 128, sharedMem: 4096n },
    { threads: 256, sharedMem: 16384n },
    { threads: 512, sharedMem: 32768n },
    { threads: 1024, sharedMem: 49152n },
  ];

  for (const { threads, sharedMem } of configs) {
    const occupancy = webgpuX.rocmCalculateOccupancy(threads, sharedMem, ROCmArchitecture.RDNA2);
    assertEquals(typeof occupancy, "number");
    assertEquals(occupancy >= 0 && occupancy <= 1, true);
    console.log(`  ✓ Threads=${threads}, SharedMem=${sharedMem}: ${(occupancy * 100).toFixed(1)}% occupancy`);
  }
});

Deno.test("CUDA - Different compute capabilities", () => {
  const webgpuX = new WebGPUX();

  const capabilities = [
    { major: 6, minor: 0, name: "Pascal (GTX 1000)" },
    { major: 6, minor: 1, name: "Pascal (GTX 1000)" },
    { major: 7, minor: 0, name: "Volta (V100)" },
    { major: 7, minor: 5, name: "Turing (RTX 2000)" },
    { major: 8, minor: 0, name: "Ampere (A100)" },
    { major: 8, minor: 6, name: "Ampere (RTX 3000)" },
    { major: 8, minor: 9, name: "Ada Lovelace (RTX 4000)" },
    { major: 9, minor: 0, name: "Hopper (H100)" },
  ];

  for (const { major, minor, name } of capabilities) {
    const workgroupSize = webgpuX.cudaOptimalWorkgroupSize(major, minor);
    const bankSize = webgpuX.cudaSharedMemoryBankSize(major);
    const hasTensorCores = webgpuX.cudaHasTensorCores(major, minor);
    const occupancy = webgpuX.cudaCalculateOccupancy(256, 16384n, major);

    assertEquals(typeof workgroupSize, "number");
    assertEquals(typeof bankSize, "number");
    assertEquals(typeof hasTensorCores, "boolean");
    assertEquals(typeof occupancy, "number");

    console.log(`  ✓ ${name} (${major}.${minor}): WG=${workgroupSize}, Bank=${bankSize}B, TC=${hasTensorCores}, Occ=${(occupancy * 100).toFixed(1)}%`);
  }
});

Deno.test("CUDA - Occupancy with different configurations", () => {
  const webgpuX = new WebGPUX();

  const configs = [
    { threads: 64, sharedMem: 0n },
    { threads: 128, sharedMem: 4096n },
    { threads: 256, sharedMem: 16384n },
    { threads: 512, sharedMem: 32768n },
    { threads: 1024, sharedMem: 49152n },
  ];

  for (const { threads, sharedMem } of configs) {
    const occupancy = webgpuX.cudaCalculateOccupancy(threads, sharedMem, 8);
    assertEquals(typeof occupancy, "number");
    assertEquals(occupancy >= 0 && occupancy <= 1, true);
    console.log(`  ✓ Threads=${threads}, SharedMem=${sharedMem}: ${(occupancy * 100).toFixed(1)}% occupancy`);
  }
});

Deno.test("Vulkan - Different vendor/device combinations", () => {
  const webgpuX = new WebGPUX();

  const devices = [
    { vendorId: 0x10DE, deviceId: 0x2684, name: "NVIDIA RTX 4090" },
    { vendorId: 0x10DE, deviceId: 0x2204, name: "NVIDIA RTX 3090" },
    { vendorId: 0x1002, deviceId: 0x73BF, name: "AMD RX 6900 XT" },
    { vendorId: 0x1002, deviceId: 0x744C, name: "AMD RX 7900 XTX" },
    { vendorId: 0x8086, deviceId: 0x5690, name: "Intel Arc A770" },
  ];

  for (const { vendorId, deviceId, name } of devices) {
    const workgroupSize = webgpuX.vulkanOptimalWorkgroupSize(vendorId, deviceId);
    const supportsVk13 = webgpuX.vulkanSupportsVersion(vendorId, deviceId, 1, 3);
    const supportsVk12 = webgpuX.vulkanSupportsVersion(vendorId, deviceId, 1, 2);
    const supportsRT = webgpuX.vulkanSupportsRaytracing(vendorId, deviceId);

    assertEquals(typeof workgroupSize, "number");
    assertEquals(typeof supportsVk13, "boolean");
    assertEquals(typeof supportsVk12, "boolean");
    assertEquals(typeof supportsRT, "boolean");

    console.log(`  ✓ ${name}: WG=${workgroupSize}, VK1.3=${supportsVk13}, VK1.2=${supportsVk12}, RT=${supportsRT}`);
  }
});

Deno.test("Vulkan - Version support matrix", () => {
  const webgpuX = new WebGPUX();

  const versions = [
    { major: 1, minor: 0, name: "Vulkan 1.0" },
    { major: 1, minor: 1, name: "Vulkan 1.1" },
    { major: 1, minor: 2, name: "Vulkan 1.2" },
    { major: 1, minor: 3, name: "Vulkan 1.3" },
  ];

  const vendorId = 0x10DE; // NVIDIA
  const deviceId = 0x2684; // RTX 4090

  for (const { major, minor, name } of versions) {
    const supported = webgpuX.vulkanSupportsVersion(vendorId, deviceId, major, minor);
    assertEquals(typeof supported, "boolean");
    console.log(`  ✓ ${name}: ${supported ? "Supported" : "Not supported"}`);
  }
});

Deno.test("OpenCL - Different max workgroup sizes", () => {
  const webgpuX = new WebGPUX();

  const maxSizes = [64n, 128n, 256n, 512n, 1024n, 2048n];
  const vendorId = 0x10DE; // NVIDIA

  for (const maxSize of maxSizes) {
    const optimalSize = webgpuX.openclOptimalWorkgroupSize(vendorId, maxSize);
    assertEquals(typeof optimalSize, "bigint");
    assertEquals(optimalSize > 0n, true);
    assertEquals(optimalSize <= maxSize, true);
    console.log(`  ✓ Max size ${maxSize}: optimal ${optimalSize}`);
  }
});

Deno.test("OpenCL - Version support matrix", () => {
  const webgpuX = new WebGPUX();

  const versions = [
    { major: 1, minor: 0, name: "OpenCL 1.0" },
    { major: 1, minor: 1, name: "OpenCL 1.1" },
    { major: 1, minor: 2, name: "OpenCL 1.2" },
    { major: 2, minor: 0, name: "OpenCL 2.0" },
    { major: 2, minor: 1, name: "OpenCL 2.1" },
    { major: 3, minor: 0, name: "OpenCL 3.0" },
  ];

  const vendorId = 0x10DE; // NVIDIA
  const deviceId = 0x2684; // RTX 4090

  for (const { major, minor, name } of versions) {
    const supported = webgpuX.openclSupportsVersion(vendorId, deviceId, major, minor);
    assertEquals(typeof supported, "boolean");
    console.log(`  ✓ ${name}: ${supported ? "Supported" : "Not supported"}`);
  }
});

Deno.test("OpenCL - FP64 support by vendor", () => {
  const webgpuX = new WebGPUX();

  const vendors = [
    { vendorId: 0x10DE, deviceId: 0x2684, name: "NVIDIA RTX 4090" },
    { vendorId: 0x1002, deviceId: 0x73BF, name: "AMD RX 6900 XT" },
    { vendorId: 0x8086, deviceId: 0x5690, name: "Intel Arc A770" },
  ];

  for (const { vendorId, deviceId, name } of vendors) {
    const supportsFp64 = webgpuX.openclSupportsFp64(vendorId, deviceId);
    assertEquals(typeof supportsFp64, "boolean");
    console.log(`  ✓ ${name}: FP64 ${supportsFp64 ? "Supported" : "Not supported"}`);
  }
});

Deno.test("Integration - Complete GPU profile", () => {
  const webgpuX = new WebGPUX();

  console.log("\n=== Complete GPU Profile ===");

  // Detect vendor
  const vendorId = 0x10DE; // NVIDIA RTX 4090
  const deviceId = 0x2684;
  const vendor = webgpuX.detectVendor(vendorId);
  const vendorName = webgpuX.getVendorName(vendorId);

  console.log(`\nVendor: ${vendorName} (0x${vendorId.toString(16).toUpperCase()})`);

  // Optimal workgroup size
  const workgroupSize = webgpuX.getOptimalWorkgroupSize(1024 * 1024, 1024, vendor);
  console.log(`Optimal Workgroup Size: ${workgroupSize}`);

  // CUDA capabilities
  const cudaMajor = 8;
  const cudaMinor = 9;
  const cudaWorkgroup = webgpuX.cudaOptimalWorkgroupSize(cudaMajor, cudaMinor);
  const cudaBankSize = webgpuX.cudaSharedMemoryBankSize(cudaMajor);
  const cudaTensorCores = webgpuX.cudaHasTensorCores(cudaMajor, cudaMinor);
  const cudaOccupancy = webgpuX.cudaCalculateOccupancy(256, 16384n, cudaMajor);

  console.log(`\nCUDA ${cudaMajor}.${cudaMinor}:`);
  console.log(`  Workgroup: ${cudaWorkgroup}`);
  console.log(`  Bank Size: ${cudaBankSize} bytes`);
  console.log(`  Tensor Cores: ${cudaTensorCores}`);
  console.log(`  Occupancy: ${(cudaOccupancy * 100).toFixed(1)}%`);

  // Vulkan capabilities
  const vulkanWorkgroup = webgpuX.vulkanOptimalWorkgroupSize(vendorId, deviceId);
  const vulkanVk13 = webgpuX.vulkanSupportsVersion(vendorId, deviceId, 1, 3);
  const vulkanRT = webgpuX.vulkanSupportsRaytracing(vendorId, deviceId);
  const vulkanDescSets = webgpuX.vulkanRecommendedDescriptorSets();

  console.log(`\nVulkan:`);
  console.log(`  Workgroup: ${vulkanWorkgroup}`);
  console.log(`  Vulkan 1.3: ${vulkanVk13}`);
  console.log(`  Raytracing: ${vulkanRT}`);
  console.log(`  Descriptor Sets: ${vulkanDescSets}`);

  // OpenCL capabilities
  const openclWorkgroup = webgpuX.openclOptimalWorkgroupSize(vendorId, 1024n);
  const openclCL30 = webgpuX.openclSupportsVersion(vendorId, deviceId, 3, 0);
  const openclFp64 = webgpuX.openclSupportsFp64(vendorId, deviceId);

  console.log(`\nOpenCL:`);
  console.log(`  Workgroup: ${openclWorkgroup}`);
  console.log(`  OpenCL 3.0: ${openclCL30}`);
  console.log(`  FP64: ${openclFp64}`);

  console.log("\n=========================\n");
});

Deno.test("Integration - Platform-specific workflow", { ignore: Deno.build.os !== "darwin" }, () => {
  const webgpuX = new WebGPUX();

  console.log("\n=== macOS Platform Workflow ===");

  // Check if Apple Silicon
  const isAppleSilicon = webgpuX.isAppleSilicon();
  console.log(`\nApple Silicon: ${isAppleSilicon}`);

  if (isAppleSilicon) {
    // Get Metal capabilities for modern M-series chip
    const family = MetalFamily.Apple7; // M1 Pro/Max/Ultra or later

    const workgroupSize = webgpuX.metalOptimalWorkgroupSize(family);
    const simdSize = webgpuX.metalSimdGroupSize(family);
    const threadgroupMem = webgpuX.metalMaxThreadgroupMemory(family);
    const supportsRT = webgpuX.metalSupportsRaytracing(family);
    const supportsTier2 = webgpuX.metalSupportsTier2ArgumentBuffers(family);

    console.log(`\nMetal Apple7 Capabilities:`);
    console.log(`  Workgroup Size: ${workgroupSize}`);
    console.log(`  SIMD Size: ${simdSize}`);
    console.log(`  Threadgroup Memory: ${threadgroupMem} bytes (${Number(threadgroupMem) / 1024} KB)`);
    console.log(`  Raytracing: ${supportsRT}`);
    console.log(`  Tier 2 Argument Buffers: ${supportsTier2}`);
  }

  // Platform recommendations
  const backend = webgpuX.darwinPreferredBackend();
  const memStrategy = webgpuX.darwinRecommendedMemoryStrategy();

  console.log(`\nPlatform Recommendations:`);
  console.log(`  Preferred Backend: ${backend}`);
  console.log(`  Memory Strategy: ${memStrategy}`);

  console.log("\n==============================\n");
});

// ============================================================================
// PHASE 1 TESTS: Staging Belt and Buffer Initialization
// ============================================================================

Deno.test("Phase 1 - Staging Belt: Basic operations", () => {
  const webgpuX = new WebGPUX();

  // Create a staging belt with 1MB chunks
  const belt = webgpuX.createStagingBelt(1024n * 1024n);
  assert(belt > 0n, "Belt handle should be valid");
  console.log(`✓ Created staging belt with handle: ${belt}`);

  // Write data to staging buffer
  const write1 = webgpuX.stagingBeltWrite(belt, 512n);
  assertEquals(write1.size, 512);
  assertEquals(write1.offset, 0);
  assert(write1.buffer_handle > 0);
  console.log(`✓ Write 1: buffer=${write1.buffer_handle}, offset=${write1.offset}, size=${write1.size}`);

  // Write more data (should use same chunk)
  const write2 = webgpuX.stagingBeltWrite(belt, 256n);
  assertEquals(write2.size, 256);
  assertEquals(write2.offset, 512); // Continues from previous write
  assertEquals(write2.buffer_handle, write1.buffer_handle); // Same chunk
  console.log(`✓ Write 2: buffer=${write2.buffer_handle}, offset=${write2.offset}, size=${write2.size}`);

  // Get stats
  const stats = webgpuX.stagingBeltStats(belt);
  assertEquals(stats.active_chunks, 1);
  assertEquals(stats.chunk_size, 1024 * 1024);
  console.log(`✓ Stats: ${stats.active_chunks} active chunks, ${stats.free_chunks} free chunks, ${Number(stats.total_allocated) / 1024 / 1024} MB allocated`);

  // Finish frame
  webgpuX.stagingBeltFinish(belt);
  console.log(`✓ Finished frame`);

  // Check stats after finish
  const statsAfterFinish = webgpuX.stagingBeltStats(belt);
  assertEquals(statsAfterFinish.active_chunks, 0); // Should be moved to free list
  console.log(`✓ After finish: ${statsAfterFinish.active_chunks} active chunks, ${statsAfterFinish.free_chunks} free chunks`);

  // Destroy belt
  webgpuX.destroyStagingBelt(belt);
  console.log(`✓ Destroyed staging belt`);
});

Deno.test("Phase 1 - Staging Belt: Multiple chunks", () => {
  const webgpuX = new WebGPUX();

  // Create a small staging belt (1KB chunks)
  const belt = webgpuX.createStagingBelt(1024n);
  console.log(`✓ Created staging belt with 1KB chunks`);

  // Write data that fills first chunk
  const write1 = webgpuX.stagingBeltWrite(belt, 1024n);
  console.log(`✓ Write 1 (1KB): buffer=${write1.buffer_handle}, offset=${write1.offset}`);

  // Write more data (should allocate a new chunk)
  const write2 = webgpuX.stagingBeltWrite(belt, 512n);
  assert(write2.buffer_handle !== write1.buffer_handle, "Should use different chunk");
  assertEquals(write2.offset, 0); // New chunk starts at 0
  console.log(`✓ Write 2 (512B): buffer=${write2.buffer_handle}, offset=${write2.offset} (new chunk)`);

  // Check stats
  const stats = webgpuX.stagingBeltStats(belt);
  assertEquals(stats.active_chunks, 2);
  console.log(`✓ Stats: ${stats.active_chunks} active chunks, ${Number(stats.total_allocated) / 1024} KB allocated`);

  webgpuX.destroyStagingBelt(belt);
});

Deno.test("Phase 1 - Staging Belt: Chunk reuse after finish", () => {
  const webgpuX = new WebGPUX();

  const belt = webgpuX.createStagingBelt(1024n);
  console.log(`✓ Created staging belt`);

  // First frame
  const write1 = webgpuX.stagingBeltWrite(belt, 512n);
  const buffer1 = write1.buffer_handle;
  console.log(`✓ Frame 1: buffer=${buffer1}`);

  webgpuX.stagingBeltFinish(belt);
  console.log(`✓ Finished frame 1`);

  // Second frame (should reuse chunk)
  const write2 = webgpuX.stagingBeltWrite(belt, 512n);
  const buffer2 = write2.buffer_handle;
  assertEquals(buffer2, buffer1, "Should reuse the same buffer after finish");
  console.log(`✓ Frame 2: buffer=${buffer2} (reused)`);

  webgpuX.destroyStagingBelt(belt);
});

Deno.test("Phase 1 - Buffer Initialization: Aligned size calculation", () => {
  const webgpuX = new WebGPUX();

  // Test 4-byte alignment
  assertEquals(webgpuX.bufferCalculateAlignedSize(100n, 4n), 100n);
  assertEquals(webgpuX.bufferCalculateAlignedSize(101n, 4n), 104n);
  assertEquals(webgpuX.bufferCalculateAlignedSize(102n, 4n), 104n);
  assertEquals(webgpuX.bufferCalculateAlignedSize(103n, 4n), 104n);
  assertEquals(webgpuX.bufferCalculateAlignedSize(104n, 4n), 104n);
  assertEquals(webgpuX.bufferCalculateAlignedSize(105n, 4n), 108n);
  console.log(`✓ 4-byte alignment: 100→100, 101→104, 105→108`);

  // Test 256-byte alignment
  assertEquals(webgpuX.bufferCalculateAlignedSize(100n, 256n), 256n);
  assertEquals(webgpuX.bufferCalculateAlignedSize(256n, 256n), 256n);
  assertEquals(webgpuX.bufferCalculateAlignedSize(257n, 256n), 512n);
  assertEquals(webgpuX.bufferCalculateAlignedSize(300n, 256n), 512n);
  console.log(`✓ 256-byte alignment: 100→256, 256→256, 257→512`);
});

Deno.test("Phase 1 - Buffer Initialization: Buffer alignment requirements", () => {
  const webgpuX = new WebGPUX();

  const UNIFORM = 0x0040;
  const STORAGE = 0x0080;
  const VERTEX = 0x0020;
  const INDEX = 0x0010;
  const COPY_DST = 0x0008;

  // Uniform and storage buffers need 256-byte alignment
  assertEquals(webgpuX.bufferGetAlignment(UNIFORM), 256n);
  assertEquals(webgpuX.bufferGetAlignment(STORAGE), 256n);
  assertEquals(webgpuX.bufferGetAlignment(UNIFORM | STORAGE), 256n);
  console.log(`✓ Uniform/Storage buffers: 256-byte alignment`);

  // Other buffers need 4-byte alignment
  assertEquals(webgpuX.bufferGetAlignment(VERTEX), 4n);
  assertEquals(webgpuX.bufferGetAlignment(INDEX), 4n);
  assertEquals(webgpuX.bufferGetAlignment(COPY_DST), 4n);
  console.log(`✓ Vertex/Index/CopyDst buffers: 4-byte alignment`);
});

Deno.test("Phase 1 - Buffer Initialization: Texture row padding", () => {
  const webgpuX = new WebGPUX();

  // Row padding for texture copies (256-byte alignment)
  assertEquals(webgpuX.bufferGetRowPadding(100n), 156n); // 100 + 156 = 256
  assertEquals(webgpuX.bufferGetRowPadding(256n), 0n);   // Already aligned
  assertEquals(webgpuX.bufferGetRowPadding(300n), 212n); // 300 + 212 = 512
  console.log(`✓ Row padding: 100→156, 256→0, 300→212`);

  // Padded row size
  assertEquals(webgpuX.bufferGetPaddedRowSize(100n), 256n);
  assertEquals(webgpuX.bufferGetPaddedRowSize(256n), 256n);
  assertEquals(webgpuX.bufferGetPaddedRowSize(300n), 512n);
  console.log(`✓ Padded row size: 100→256, 256→256, 300→512`);
});

Deno.test("Phase 1 - Buffer Initialization: Texture buffer size calculation", () => {
  const webgpuX = new WebGPUX();

  // 100x100 RGBA8 texture (4 bytes per pixel)
  // Row size: 100 * 4 = 400 bytes
  // Padded row: 512 bytes (next multiple of 256)
  // Total: 512 * 100 = 51200 bytes
  const size1 = webgpuX.bufferCalculateTextureBufferSize(100, 100, 4);
  assertEquals(size1, 51200n);
  console.log(`✓ 100x100 RGBA8: ${size1} bytes (${Number(size1) / 1024} KB)`);

  // 64x64 RGBA8 texture
  // Row size: 64 * 4 = 256 bytes (already aligned)
  // Total: 256 * 64 = 16384 bytes
  const size2 = webgpuX.bufferCalculateTextureBufferSize(64, 64, 4);
  assertEquals(size2, 16384n);
  console.log(`✓ 64x64 RGBA8: ${size2} bytes (${Number(size2) / 1024} KB)`);

  // 1024x1024 RGBA8 texture
  // Row size: 1024 * 4 = 4096 bytes (aligned)
  // Total: 4096 * 1024 = 4194304 bytes (4 MB)
  const size3 = webgpuX.bufferCalculateTextureBufferSize(1024, 1024, 4);
  assertEquals(size3, 4194304n);
  console.log(`✓ 1024x1024 RGBA8: ${size3} bytes (${Number(size3) / 1024 / 1024} MB)`);

  // 1920x1080 RGBA8 texture (Full HD)
  const size4 = webgpuX.bufferCalculateTextureBufferSize(1920, 1080, 4);
  console.log(`✓ 1920x1080 RGBA8 (Full HD): ${size4} bytes (${Number(size4) / 1024 / 1024} MB)`);
});

Deno.test("Phase 1 - Integration: Staging belt for texture uploads", () => {
  const webgpuX = new WebGPUX();

  console.log("\n=== Texture Upload Workflow ===");

  // Calculate texture buffer size
  const width = 512;
  const height = 512;
  const bytesPerPixel = 4; // RGBA8
  const textureSize = webgpuX.bufferCalculateTextureBufferSize(width, height, bytesPerPixel);
  console.log(`\nTexture: ${width}x${height} RGBA8`);
  console.log(`Buffer size needed: ${Number(textureSize) / 1024} KB`);

  // Create staging belt for uploads
  const belt = webgpuX.createStagingBelt(1024n * 1024n); // 1MB chunks
  console.log(`\nCreated staging belt with 1MB chunks`);

  // Simulate uploading texture data
  const write = webgpuX.stagingBeltWrite(belt, textureSize);
  console.log(`\nStaging write:`);
  console.log(`  Buffer handle: ${write.buffer_handle}`);
  console.log(`  Offset: ${write.offset}`);
  console.log(`  Size: ${Number(write.size) / 1024} KB`);

  // Check alignment
  const alignment = webgpuX.bufferGetAlignment(0x0008); // COPY_DST
  const alignedSize = webgpuX.bufferCalculateAlignedSize(textureSize, alignment);
  console.log(`\nAlignment check:`);
  console.log(`  Required alignment: ${alignment} bytes`);
  console.log(`  Aligned size: ${Number(alignedSize) / 1024} KB`);

  // Finish frame and recover buffer
  webgpuX.stagingBeltFinish(belt);

  const stats = webgpuX.stagingBeltStats(belt);
  console.log(`\nAfter finish:`);
  console.log(`  Active chunks: ${stats.active_chunks}`);
  console.log(`  Free chunks: ${stats.free_chunks}`);
  console.log(`  Total allocated: ${Number(stats.total_allocated) / 1024 / 1024} MB`);

  webgpuX.destroyStagingBelt(belt);
  console.log(`\n===============================\n`);
});

// ============================================================================
// Phase 2 - Texture Utilities Tests
// ============================================================================

Deno.test("Phase 2 - Texture Utilities: Mipmap level calculation", () => {
  const webgpuX = new WebGPUX();

  // Test square power-of-2 textures
  const levels1024 = webgpuX.textureCalculateMipLevels(1024, 1024);
  assertEquals(levels1024, 11); // log2(1024) + 1
  console.log(`✓ 1024x1024 texture: ${levels1024} mip levels`);

  const levels512 = webgpuX.textureCalculateMipLevels(512, 512);
  assertEquals(levels512, 10); // log2(512) + 1
  console.log(`✓ 512x512 texture: ${levels512} mip levels`);

  // Test non-square textures (uses max dimension)
  const levels256x128 = webgpuX.textureCalculateMipLevels(256, 128);
  assertEquals(levels256x128, 9); // log2(256) + 1
  console.log(`✓ 256x128 texture: ${levels256x128} mip levels (uses max dimension)`);

  // Edge cases
  const levels1x1 = webgpuX.textureCalculateMipLevels(1, 1);
  assertEquals(levels1x1, 1);
  console.log(`✓ 1x1 texture: ${levels1x1} mip level`);

  const levels0x0 = webgpuX.textureCalculateMipLevels(0, 0);
  assertEquals(levels0x0, 1);
  console.log(`✓ 0x0 texture: ${levels0x0} mip level (edge case)`);
});

Deno.test("Phase 2 - Texture Utilities: Mip level size calculation", () => {
  const webgpuX = new WebGPUX();

  // Test 1024x1024 texture at different mip levels
  const mip0 = webgpuX.textureGetMipSize(1024, 1024, 0);
  assertEquals(mip0.width, 1024);
  assertEquals(mip0.height, 1024);
  console.log(`✓ 1024x1024 mip 0: ${mip0.width}x${mip0.height}`);

  const mip1 = webgpuX.textureGetMipSize(1024, 1024, 1);
  assertEquals(mip1.width, 512);
  assertEquals(mip1.height, 512);
  console.log(`✓ 1024x1024 mip 1: ${mip1.width}x${mip1.height}`);

  const mip10 = webgpuX.textureGetMipSize(1024, 1024, 10);
  assertEquals(mip10.width, 1);
  assertEquals(mip10.height, 1);
  console.log(`✓ 1024x1024 mip 10: ${mip10.width}x${mip10.height}`);

  // Test non-square texture
  const mipNonSquare0 = webgpuX.textureGetMipSize(512, 256, 0);
  assertEquals(mipNonSquare0.width, 512);
  assertEquals(mipNonSquare0.height, 256);
  console.log(`✓ 512x256 mip 0: ${mipNonSquare0.width}x${mipNonSquare0.height}`);

  const mipNonSquare1 = webgpuX.textureGetMipSize(512, 256, 1);
  assertEquals(mipNonSquare1.width, 256);
  assertEquals(mipNonSquare1.height, 128);
  console.log(`✓ 512x256 mip 1: ${mipNonSquare1.width}x${mipNonSquare1.height}`);

  const mipNonSquare8 = webgpuX.textureGetMipSize(512, 256, 8);
  assertEquals(mipNonSquare8.width, 2);
  assertEquals(mipNonSquare8.height, 1);
  console.log(`✓ 512x256 mip 8: ${mipNonSquare8.width}x${mipNonSquare8.height}`);

  const mipNonSquare9 = webgpuX.textureGetMipSize(512, 256, 9);
  assertEquals(mipNonSquare9.width, 1);
  assertEquals(mipNonSquare9.height, 1);
  console.log(`✓ 512x256 mip 9: ${mipNonSquare9.width}x${mipNonSquare9.height}`);
});

Deno.test("Phase 2 - Texture Utilities: 3D texture mip levels", () => {
  const webgpuX = new WebGPUX();

  // Test 3D texture mip levels
  const mip0 = webgpuX.textureGetMipSize3D(256, 256, 256, 0);
  assertEquals(mip0.width, 256);
  assertEquals(mip0.height, 256);
  assertEquals(mip0.depth, 256);
  console.log(`✓ 256x256x256 mip 0: ${mip0.width}x${mip0.height}x${mip0.depth}`);

  const mip1 = webgpuX.textureGetMipSize3D(256, 256, 256, 1);
  assertEquals(mip1.width, 128);
  assertEquals(mip1.height, 128);
  assertEquals(mip1.depth, 128);
  console.log(`✓ 256x256x256 mip 1: ${mip1.width}x${mip1.height}x${mip1.depth}`);

  const mip8 = webgpuX.textureGetMipSize3D(256, 256, 256, 8);
  assertEquals(mip8.width, 1);
  assertEquals(mip8.height, 1);
  assertEquals(mip8.depth, 1);
  console.log(`✓ 256x256x256 mip 8: ${mip8.width}x${mip8.height}x${mip8.depth}`);

  // Test non-uniform 3D texture
  const mipNonUniform0 = webgpuX.textureGetMipSize3D(512, 256, 128, 0);
  assertEquals(mipNonUniform0.width, 512);
  assertEquals(mipNonUniform0.height, 256);
  assertEquals(mipNonUniform0.depth, 128);
  console.log(`✓ 512x256x128 mip 0: ${mipNonUniform0.width}x${mipNonUniform0.height}x${mipNonUniform0.depth}`);

  const mipNonUniform7 = webgpuX.textureGetMipSize3D(512, 256, 128, 7);
  assertEquals(mipNonUniform7.width, 4);
  assertEquals(mipNonUniform7.height, 2);
  assertEquals(mipNonUniform7.depth, 1);
  console.log(`✓ 512x256x128 mip 7: ${mipNonUniform7.width}x${mipNonUniform7.height}x${mipNonUniform7.depth}`);
});

Deno.test("Phase 2 - Integration: Texture mipmap generation workflow", () => {
  const webgpuX = new WebGPUX();

  console.log(`\n=== Texture Mipmap Workflow ===\n`);

  const width = 2048;
  const height = 2048;

  // Calculate mip levels
  const mipLevels = webgpuX.textureCalculateMipLevels(width, height);
  console.log(`Texture: ${width}x${height}`);
  console.log(`Mip levels: ${mipLevels}\n`);

  // Show mip chain with memory requirements
  let totalMemory = 0;
  for (let level = 0; level < mipLevels; level++) {
    const size = webgpuX.textureGetMipSize(width, height, level);
    const bytesPerPixel = 4; // RGBA8
    const levelMemory = size.width * size.height * bytesPerPixel;
    totalMemory += levelMemory;

    console.log(
      `Mip ${level}: ${size.width}x${size.height} (${(levelMemory / 1024).toFixed(2)} KB)`,
    );
  }

  console.log(
    `\nTotal memory (all mips): ${(totalMemory / 1024 / 1024).toFixed(2)} MB`,
  );
  console.log(`Base level only: ${((width * height * 4) / 1024 / 1024).toFixed(2)} MB`);
  console.log(
    `Mipmap overhead: ${(((totalMemory - (width * height * 4)) / (width * height * 4)) * 100).toFixed(2)}%`,
  );

  // Verify mip chain integrity
  assertEquals(mipLevels, 12); // 2048 -> log2(2048) + 1 = 12
  const lastMip = webgpuX.textureGetMipSize(width, height, mipLevels - 1);
  assertEquals(lastMip.width, 1);
  assertEquals(lastMip.height, 1);

  console.log(`\n✓ Mipmap chain verified\n`);
  console.log(`===============================\n`);
});

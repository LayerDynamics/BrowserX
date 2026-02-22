/**
 * Descriptor Sanitizer
 *
 * Provides utilities for sanitizing WebGPU descriptors to work around
 * Deno's FFI serialization issues with empty arrays and sequences.
 *
 * The Deno WebGPU FFI has known issues converting JavaScript empty arrays []
 * to WebIDL sequences. This module provides wrapper functions that handle
 * these edge cases properly.
 *
 * @module webgpu/utils/DescriptorSanitizer
 */

// WebGPU types are available globally in Deno with --unstable-webgpu flag
// deno-lint-ignore-file no-explicit-any

// ============================================================================
// Types
// ============================================================================

/**
 * Sanitized bind group layout descriptor
 */
export interface SanitizedBindGroupLayoutDescriptor {
  label?: string;
  entries: GPUBindGroupLayoutEntry[];
}

/**
 * Sanitized pipeline layout descriptor
 */
export interface SanitizedPipelineLayoutDescriptor {
  label?: string;
  bindGroupLayouts: GPUBindGroupLayout[];
}

/**
 * Sanitized texture descriptor
 */
export interface SanitizedTextureDescriptor extends Omit<GPUTextureDescriptor, "viewFormats"> {
  viewFormats?: GPUTextureFormat[];
}

// ============================================================================
// Core Sanitization Functions
// ============================================================================

/**
 * Ensures an array is properly formatted for Deno's WebGPU FFI.
 * Creates a new array with explicit iteration to ensure WebIDL compatibility.
 *
 * @param arr - The array to sanitize
 * @returns A properly formatted array or undefined if empty
 */
export function sanitizeArray<T>(arr: T[] | undefined): T[] | undefined {
  if (!arr || arr.length === 0) {
    return undefined;
  }
  // Create new array through explicit mapping to ensure proper structure
  return arr.map((item) => item);
}

/**
 * Ensures an array is properly formatted, returning empty array instead of undefined.
 * Uses Array.from() to create a proper array object.
 *
 * @param arr - The array to sanitize
 * @returns A properly formatted array
 */
export function sanitizeArrayRequired<T>(arr: T[] | undefined): T[] {
  if (!arr || arr.length === 0) {
    // Return a newly constructed array - this sometimes helps with FFI
    return Array.from<T>([]);
  }
  return Array.from(arr);
}

// ============================================================================
// Bind Group Layout Helpers
// ============================================================================

/**
 * Creates a bind group layout with proper descriptor sanitization.
 * Handles the Deno FFI issue with empty entries arrays.
 *
 * WORKAROUND: Deno's WebGPU FFI cannot serialize empty JavaScript arrays []
 * to WebIDL sequences. The fix is to OMIT the property entirely when empty,
 * as Deno treats missing properties as empty sequences.
 *
 * @param device - GPU device
 * @param descriptor - Bind group layout descriptor
 * @returns Created bind group layout
 */
export function createBindGroupLayout(
  device: GPUDevice,
  descriptor: GPUBindGroupLayoutDescriptor,
): GPUBindGroupLayout {
  // WORKAROUND: Omit entries entirely when empty - Deno FFI can't serialize []
  // but treats missing properties as empty sequences
  if (descriptor.entries && descriptor.entries.length > 0) {
    return device.createBindGroupLayout({
      label: descriptor.label,
      entries: Array.from(descriptor.entries),
    });
  }

  // When entries is empty or undefined, omit the property entirely
  return device.createBindGroupLayout({
    label: descriptor.label,
  } as GPUBindGroupLayoutDescriptor);
}

/**
 * Creates a pipeline layout with proper descriptor sanitization.
 *
 * WORKAROUND: Deno's WebGPU FFI cannot serialize empty JavaScript arrays []
 * to WebIDL sequences. The fix is to OMIT the property entirely when empty,
 * as Deno treats missing properties as empty sequences.
 *
 * @param device - GPU device
 * @param descriptor - Pipeline layout descriptor
 * @returns Created pipeline layout
 */
export function createPipelineLayout(
  device: GPUDevice,
  descriptor: GPUPipelineLayoutDescriptor,
): GPUPipelineLayout {
  // WORKAROUND: Omit bindGroupLayouts entirely when empty - Deno FFI can't serialize []
  // but treats missing properties as empty sequences
  if (descriptor.bindGroupLayouts && descriptor.bindGroupLayouts.length > 0) {
    return device.createPipelineLayout({
      label: descriptor.label,
      bindGroupLayouts: Array.from(descriptor.bindGroupLayouts as Iterable<GPUBindGroupLayout>),
    });
  }

  // When bindGroupLayouts is empty or undefined, omit the property entirely
  return device.createPipelineLayout({
    label: descriptor.label,
  } as GPUPipelineLayoutDescriptor);
}

// ============================================================================
// Texture Descriptor Helpers
// ============================================================================

/**
 * Sanitizes a texture descriptor for Deno's WebGPU FFI.
 * Removes viewFormats if empty to avoid serialization issues.
 *
 * @param descriptor - The texture descriptor to sanitize
 * @returns Sanitized texture descriptor
 */
export function sanitizeTextureDescriptor(
  descriptor: GPUTextureDescriptor,
): GPUTextureDescriptor {
  const {
    viewFormats,
    ...rest
  } = descriptor;

  // Only include viewFormats if non-empty
  if (viewFormats && viewFormats.length > 0) {
    return {
      ...rest,
      viewFormats: Array.from(viewFormats),
    };
  }

  return rest;
}

/**
 * Creates a texture with proper descriptor sanitization.
 *
 * @param device - GPU device
 * @param descriptor - Texture descriptor
 * @returns Created texture
 */
export function createTexture(
  device: GPUDevice,
  descriptor: GPUTextureDescriptor,
): GPUTexture {
  return device.createTexture(sanitizeTextureDescriptor(descriptor));
}

// ============================================================================
// Render Pipeline Descriptor Helpers
// ============================================================================

/**
 * Sanitizes fragment state targets for Deno's WebGPU FFI.
 *
 * WORKAROUND: Deno's WebGPU FFI cannot serialize empty JavaScript arrays []
 * to WebIDL sequences. For fragment targets, an empty array is typically an error
 * condition since fragment shaders require at least one render target.
 * We return undefined to signal this should be omitted from the descriptor.
 *
 * @param targets - Color target states
 * @returns Sanitized targets array or undefined if empty
 */
export function sanitizeFragmentTargets(
  targets: (GPUColorTargetState | null)[] | undefined,
): (GPUColorTargetState | null)[] | undefined {
  if (!targets || targets.length === 0) {
    // Return undefined to omit from descriptor - empty targets is an error condition
    return undefined;
  }
  return Array.from(targets);
}

/**
 * Sanitizes a render pipeline descriptor for Deno's WebGPU FFI.
 *
 * WORKAROUND: Deno's WebGPU FFI cannot serialize empty JavaScript arrays []
 * to WebIDL sequences. This function omits empty array properties entirely.
 *
 * @param descriptor - Render pipeline descriptor
 * @returns Sanitized descriptor
 */
export function sanitizeRenderPipelineDescriptor(
  descriptor: GPURenderPipelineDescriptor,
): GPURenderPipelineDescriptor {
  const result: GPURenderPipelineDescriptor = {
    ...descriptor,
    vertex: {
      ...descriptor.vertex,
      // Sanitize vertex buffers - omit if empty
      ...(descriptor.vertex.buffers && descriptor.vertex.buffers.length > 0
        ? { buffers: Array.from(descriptor.vertex.buffers) }
        : {}),
    },
  };

  // Sanitize fragment targets if present
  if (descriptor.fragment) {
    const sanitizedTargets = sanitizeFragmentTargets(descriptor.fragment.targets);
    if (sanitizedTargets) {
      result.fragment = {
        ...descriptor.fragment,
        targets: sanitizedTargets,
      };
    } else {
      // If targets is empty, this is likely an error - but we still need to set fragment
      // Omit targets entirely and let WebGPU report the error
      const { targets: _targets, ...restFragment } = descriptor.fragment;
      result.fragment = restFragment as GPUFragmentState;
    }
  }

  return result;
}

/**
 * Creates a render pipeline with proper descriptor sanitization.
 *
 * @param device - GPU device
 * @param descriptor - Render pipeline descriptor
 * @returns Created render pipeline
 */
export function createRenderPipeline(
  device: GPUDevice,
  descriptor: GPURenderPipelineDescriptor,
): GPURenderPipeline {
  return device.createRenderPipeline(sanitizeRenderPipelineDescriptor(descriptor));
}

/**
 * Creates a render pipeline asynchronously with proper descriptor sanitization.
 *
 * @param device - GPU device
 * @param descriptor - Render pipeline descriptor
 * @returns Promise resolving to created render pipeline
 */
export async function createRenderPipelineAsync(
  device: GPUDevice,
  descriptor: GPURenderPipelineDescriptor,
): Promise<GPURenderPipeline> {
  return await device.createRenderPipelineAsync(sanitizeRenderPipelineDescriptor(descriptor));
}

// ============================================================================
// Compute Pipeline Descriptor Helpers
// ============================================================================

/**
 * Sanitizes a compute pipeline descriptor for Deno's WebGPU FFI.
 *
 * @param descriptor - Compute pipeline descriptor
 * @returns Sanitized descriptor
 */
export function sanitizeComputePipelineDescriptor(
  descriptor: GPUComputePipelineDescriptor,
): GPUComputePipelineDescriptor {
  return {
    ...descriptor,
    compute: {
      ...descriptor.compute,
      // Constants object doesn't need array sanitization
    },
  };
}

/**
 * Creates a compute pipeline with proper descriptor sanitization.
 *
 * @param device - GPU device
 * @param descriptor - Compute pipeline descriptor
 * @returns Created compute pipeline
 */
export function createComputePipeline(
  device: GPUDevice,
  descriptor: GPUComputePipelineDescriptor,
): GPUComputePipeline {
  return device.createComputePipeline(sanitizeComputePipelineDescriptor(descriptor));
}

// ============================================================================
// Bind Group Helpers
// ============================================================================

/**
 * Sanitizes a bind group descriptor for Deno's WebGPU FFI.
 *
 * WORKAROUND: Deno's WebGPU FFI cannot serialize empty JavaScript arrays []
 * to WebIDL sequences. This function omits entries when empty.
 *
 * @param descriptor - Bind group descriptor
 * @returns Sanitized descriptor
 */
export function sanitizeBindGroupDescriptor(
  descriptor: GPUBindGroupDescriptor,
): GPUBindGroupDescriptor {
  // Omit entries entirely when empty - Deno FFI can't serialize []
  if (descriptor.entries && descriptor.entries.length > 0) {
    return {
      ...descriptor,
      entries: Array.from(descriptor.entries),
    };
  }

  // Omit entries property when empty
  const { entries: _entries, ...rest } = descriptor;
  return rest as GPUBindGroupDescriptor;
}

/**
 * Creates a bind group with proper descriptor sanitization.
 *
 * @param device - GPU device
 * @param descriptor - Bind group descriptor
 * @returns Created bind group
 */
export function createBindGroup(
  device: GPUDevice,
  descriptor: GPUBindGroupDescriptor,
): GPUBindGroup {
  return device.createBindGroup(sanitizeBindGroupDescriptor(descriptor));
}

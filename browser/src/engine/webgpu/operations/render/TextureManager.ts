/**
 * WebGPU Texture Manager
 *
 * Manages texture creation, bitmap uploads, samplers, and texture resources:
 * - Texture creation with various formats
 * - Bitmap uploads from multiple sources
 * - Sampler creation and caching
 * - Texture atlas management
 * - Mipmapping support
 * - Resource pooling and lifecycle
 *
 * @module operations/render
 */

import type {
    Pixels,
    GPUTextureID,
    HTMLImageElement,
    HTMLCanvasElement,
    OffscreenCanvas,
} from "../../../../types/webgpu.ts";
import { WebGPUDevice } from "../../adapter/Device.ts";
import { GPUTextureError, WebGPUError } from "../../errors.ts";

// ============================================================================
// Types
// ============================================================================

/**
 * Texture creation descriptor
 */
export interface TextureDescriptor {
    /** Texture dimensions */
    width: Pixels;
    height: Pixels;
    depth?: number;

    /** Texture format */
    format: GPUTextureFormat;

    /** Usage flags */
    usage: GPUTextureUsageFlags;

    /** Mip level count */
    mipLevelCount?: number;

    /** Sample count for multisampling */
    sampleCount?: number;

    /** Texture dimension type */
    dimension?: GPUTextureDimension;

    /** View formats */
    viewFormats?: GPUTextureFormat[];

    /** Label for debugging */
    label?: string;
}

/**
 * Bitmap source types
 */
export type BitmapSource =
    | ImageBitmap
    | ImageData
    | HTMLImageElement
    | HTMLCanvasElement
    | OffscreenCanvas
    | Uint8Array;

/**
 * Bitmap upload descriptor
 */
export interface BitmapUploadDescriptor {
    /** Source bitmap */
    source: BitmapSource;

    /** Target texture */
    texture: GPUTexture;

    /** Mip level to upload to */
    mipLevel?: number;

    /** Destination origin */
    origin?: GPUOrigin3D;

    /** Premultiply alpha */
    premultiplyAlpha?: boolean;

    /** Flip Y axis */
    flipY?: boolean;

    /** Color space conversion */
    colorSpace?: PredefinedColorSpace;
}

/**
 * Sampler descriptor with caching key
 */
export interface SamplerDescriptor {
    /** Address mode for U coordinate */
    addressModeU?: GPUAddressMode;

    /** Address mode for V coordinate */
    addressModeV?: GPUAddressMode;

    /** Address mode for W coordinate */
    addressModeW?: GPUAddressMode;

    /** Magnification filter */
    magFilter?: GPUFilterMode;

    /** Minification filter */
    minFilter?: GPUFilterMode;

    /** Mipmap filter */
    mipmapFilter?: GPUMipmapFilterMode;

    /** LOD min clamp */
    lodMinClamp?: number;

    /** LOD max clamp */
    lodMaxClamp?: number;

    /** Comparison function for depth textures */
    compare?: GPUCompareFunction;

    /** Max anisotropy */
    maxAnisotropy?: number;

    /** Label for debugging */
    label?: string;
}

/**
 * Texture atlas entry
 */
export interface TextureAtlasEntry {
    /** Atlas texture ID */
    atlasId: GPUTextureID;

    /** Region in atlas (normalized 0-1) */
    region: {
        x: number;
        y: number;
        width: number;
        height: number;
    };

    /** Original texture dimensions */
    originalWidth: Pixels;
    originalHeight: Pixels;
}

/**
 * Texture statistics
 */
export interface TextureStatistics {
    /** Total textures created */
    texturesCreated: number;

    /** Active textures */
    activeTextures: number;

    /** Total memory used (bytes) */
    memoryUsed: number;

    /** Samplers created */
    samplersCreated: number;

    /** Cached samplers */
    cachedSamplers: number;

    /** Bitmap uploads */
    bitmapUploads: number;

    /** Mipmap generations */
    mipmapGenerations: number;

    /** Atlas textures */
    atlasTextures: number;
}

// ============================================================================
// Texture Manager
// ============================================================================

/**
 * Manages WebGPU textures, samplers, and texture resources
 */
export class WebGPUTextureManager {
    private readonly device: WebGPUDevice;

    // Texture tracking
    private textures: Map<GPUTextureID, GPUTexture> = new Map();
    private textureDescriptors: Map<GPUTextureID, TextureDescriptor> = new Map();
    private nextTextureId = 1;

    // Sampler cache
    private samplers: Map<string, GPUSampler> = new Map();

    // Texture atlas management
    private atlases: Map<GPUTextureID, GPUTexture> = new Map();
    private atlasEntries: Map<string, TextureAtlasEntry> = new Map();

    // Statistics
    private stats: TextureStatistics = {
        texturesCreated: 0,
        activeTextures: 0,
        memoryUsed: 0,
        samplersCreated: 0,
        cachedSamplers: 0,
        bitmapUploads: 0,
        mipmapGenerations: 0,
        atlasTextures: 0,
    };

    constructor(device: WebGPUDevice) {
        this.device = device;
    }

    // ========================================================================
    // Texture Creation
    // ========================================================================

    /**
     * Create a new texture
     */
    createTexture(descriptor: TextureDescriptor): GPUTextureID {
        const id = `texture-${this.nextTextureId++}` as GPUTextureID;

        try {
            const gpuDescriptor: GPUTextureDescriptor = {
                size: {
                    width: descriptor.width,
                    height: descriptor.height,
                    depthOrArrayLayers: descriptor.depth || 1,
                },
                format: descriptor.format,
                usage: descriptor.usage,
                mipLevelCount: descriptor.mipLevelCount || 1,
                sampleCount: descriptor.sampleCount || 1,
                dimension: descriptor.dimension || "2d",
                viewFormats: descriptor.viewFormats || [],
                label: descriptor.label || id,
            };

            const texture = this.device.getDevice().createTexture(gpuDescriptor);

            this.textures.set(id, texture);
            this.textureDescriptors.set(id, descriptor);

            // Update statistics
            this.stats.texturesCreated++;
            this.stats.activeTextures++;
            this.stats.memoryUsed += this.calculateTextureMemory(descriptor);

            return id;
        } catch (error) {
            throw new GPUTextureError(
                `Failed to create texture: ${error instanceof Error ? error.message : String(error)}`,
                {
                    format: descriptor.format,
                    dimensions: {
                        width: descriptor.width,
                        height: descriptor.height,
                        depth: descriptor.depth,
                    },
                    context: { descriptor },
                    cause: error instanceof Error ? error : undefined,
                }
            );
        }
    }

    /**
     * Create a texture from bitmap
     */
    async createTextureFromBitmap(
        source: BitmapSource,
        descriptor?: Partial<TextureDescriptor>
    ): Promise<GPUTextureID> {
        const { width, height } = this.getBitmapDimensions(source);

        const fullDescriptor: TextureDescriptor = {
            width: width as Pixels,
            height: height as Pixels,
            format: descriptor?.format || "rgba8unorm",
            usage: descriptor?.usage || (
                GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.COPY_DST |
                GPUTextureUsage.RENDER_ATTACHMENT
            ),
            mipLevelCount: descriptor?.mipLevelCount || 1,
            ...descriptor,
        };

        const textureId = this.createTexture(fullDescriptor);
        const texture = this.getTexture(textureId);

        if (!texture) {
            throw new GPUTextureError("Failed to get created texture");
        }

        await this.uploadBitmap({
            source,
            texture,
            premultiplyAlpha: true,
        });

        // Generate mipmaps if requested
        if (fullDescriptor.mipLevelCount && fullDescriptor.mipLevelCount > 1) {
            this.generateMipmaps(textureId);
        }

        return textureId;
    }

    /**
     * Get texture by ID
     */
    getTexture(id: GPUTextureID): GPUTexture | null {
        return this.textures.get(id) || null;
    }

    /**
     * Get texture descriptor
     */
    getTextureDescriptor(id: GPUTextureID): TextureDescriptor | null {
        return this.textureDescriptors.get(id) || null;
    }

    /**
     * Check if texture exists
     */
    hasTexture(id: GPUTextureID): boolean {
        return this.textures.has(id);
    }

    /**
     * Destroy texture
     */
    destroyTexture(id: GPUTextureID): void {
        const texture = this.textures.get(id);
        const descriptor = this.textureDescriptors.get(id);

        if (texture) {
            texture.destroy();
            this.textures.delete(id);

            if (descriptor) {
                this.stats.memoryUsed -= this.calculateTextureMemory(descriptor);
                this.textureDescriptors.delete(id);
            }

            this.stats.activeTextures--;
        }
    }

    // ========================================================================
    // Bitmap Upload
    // ========================================================================

    /**
     * Upload bitmap to texture
     */
    async uploadBitmap(descriptor: BitmapUploadDescriptor): Promise<void> {
        const { source, texture, mipLevel = 0, origin } = descriptor;

        try {
            // Convert source to pixel data
            const { width, height } = this.getBitmapDimensions(source);
            const pixelData = await this.bitmapToPixelData(source);

            // Upload to GPU using writeTexture
            this.device.getDevice().queue.writeTexture(
                {
                    texture,
                    mipLevel,
                    origin: origin || { x: 0, y: 0, z: 0 },
                },
                pixelData as BufferSource,
                {
                    bytesPerRow: width * 4, // RGBA format
                    rowsPerImage: height,
                },
                {
                    width,
                    height,
                    depthOrArrayLayers: 1,
                }
            );

            this.stats.bitmapUploads++;
        } catch (error) {
            throw new GPUTextureError(
                `Failed to upload bitmap: ${error instanceof Error ? error.message : String(error)}`,
                {
                    context: { descriptor },
                    cause: error instanceof Error ? error : undefined,
                }
            );
        }
    }

    /**
     * Upload raw pixel data to texture
     */
    uploadPixelData(
        texture: GPUTexture,
        data: Uint8Array,
        width: Pixels,
        height: Pixels,
        options?: {
            mipLevel?: number;
            origin?: GPUOrigin3D;
            bytesPerRow?: number;
        }
    ): void {
        const bytesPerRow = options?.bytesPerRow || width * 4;

        this.device.getDevice().queue.writeTexture(
            {
                texture,
                mipLevel: options?.mipLevel || 0,
                origin: options?.origin || { x: 0, y: 0, z: 0 },
            },
            data as BufferSource,
            {
                bytesPerRow,
                rowsPerImage: height,
            },
            {
                width,
                height,
                depthOrArrayLayers: 1,
            }
        );

        this.stats.bitmapUploads++;
    }

    /**
     * Convert bitmap source to pixel data
     */
    private async bitmapToPixelData(source: BitmapSource): Promise<Uint8Array> {
        // If already Uint8Array, return directly
        if (source instanceof Uint8Array) {
            return source;
        }

        // If ImageData, extract pixel data
        if (typeof ImageData !== "undefined" && source instanceof ImageData) {
            return new Uint8Array(source.data.buffer);
        }

        // If ImageBitmap, need to extract pixels via canvas
        if (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap) {
            // Create temporary canvas to extract pixels
            // Note: In browser engine, we'd implement this differently
            throw new WebGPUError("ImageBitmap conversion requires canvas context");
        }

        // For HTML elements, we need canvas context to extract pixels
        // This is a browser-specific operation
        throw new WebGPUError("HTML element conversion requires canvas rendering context");
    }

    /**
     * Get dimensions from bitmap source
     */
    private getBitmapDimensions(source: BitmapSource): { width: number; height: number } {
        if (source instanceof Uint8Array) {
            throw new WebGPUError("Cannot determine dimensions from Uint8Array");
        }

        if (typeof ImageData !== "undefined" && source instanceof ImageData) {
            return { width: source.width, height: source.height };
        }

        if (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap) {
            return { width: source.width, height: source.height };
        }

        // Type guard for HTMLImageElement
        if (this.isHTMLImageElement(source)) {
            return { width: source.naturalWidth, height: source.naturalHeight };
        }

        // Type guard for HTMLCanvasElement or OffscreenCanvas
        if (this.isCanvasLike(source)) {
            return { width: source.width, height: source.height };
        }

        throw new WebGPUError("Unsupported bitmap source type");
    }

    /**
     * Type guard for HTMLImageElement
     */
    private isHTMLImageElement(source: unknown): source is HTMLImageElement {
        return (
            typeof source === "object" &&
            source !== null &&
            "naturalWidth" in source &&
            "naturalHeight" in source
        );
    }

    /**
     * Type guard for canvas-like objects
     */
    private isCanvasLike(source: unknown): source is HTMLCanvasElement | OffscreenCanvas {
        return (
            typeof source === "object" &&
            source !== null &&
            "width" in source &&
            "height" in source &&
            "getContext" in source
        );
    }

    // ========================================================================
    // Mipmapping
    // ========================================================================

    /**
     * Generate mipmaps for texture
     */
    generateMipmaps(textureId: GPUTextureID): void {
        const texture = this.getTexture(textureId);
        const descriptor = this.getTextureDescriptor(textureId);

        if (!texture || !descriptor) {
            throw new GPUTextureError("Texture not found", { textureId });
        }

        const mipLevelCount = descriptor.mipLevelCount || 1;

        if (mipLevelCount <= 1) {
            return; // No mipmaps to generate
        }

        // Create command encoder for mipmap generation
        const encoder = this.device.getDevice().createCommandEncoder({
            label: "mipmap-generation",
        });

        // Generate each mip level by rendering the previous level
        for (let mipLevel = 1; mipLevel < mipLevelCount; mipLevel++) {
            const mipWidth = Math.max(1, descriptor.width >> mipLevel);
            const mipHeight = Math.max(1, descriptor.height >> mipLevel);

            // Create views for source and destination
            const srcView = texture.createView({
                baseMipLevel: mipLevel - 1,
                mipLevelCount: 1,
            });

            const dstView = texture.createView({
                baseMipLevel: mipLevel,
                mipLevelCount: 1,
            });

            // Render pass to downsample
            const passEncoder = encoder.beginRenderPass({
                colorAttachments: [{
                    view: dstView,
                    loadOp: "clear",
                    storeOp: "store",
                    clearValue: { r: 0, g: 0, b: 0, a: 0 },
                }],
            });

            // TODO: Set pipeline and bind group for downsampling
            // This requires a blit pipeline which we'll implement in the compositor

            passEncoder.end();
        }

        // Submit commands
        this.device.getDevice().queue.submit([encoder.finish()]);

        this.stats.mipmapGenerations++;
    }

    // ========================================================================
    // Sampler Management
    // ========================================================================

    /**
     * Create or get cached sampler
     */
    getSampler(descriptor: SamplerDescriptor): GPUSampler {
        const key = this.getSamplerCacheKey(descriptor);

        let sampler = this.samplers.get(key);

        if (!sampler) {
            sampler = this.createSampler(descriptor);
            this.samplers.set(key, sampler);
            this.stats.samplersCreated++;
        }

        this.stats.cachedSamplers = this.samplers.size;

        return sampler;
    }

    /**
     * Create a new sampler
     */
    private createSampler(descriptor: SamplerDescriptor): GPUSampler {
        const gpuDescriptor: GPUSamplerDescriptor = {
            addressModeU: descriptor.addressModeU || "clamp-to-edge",
            addressModeV: descriptor.addressModeV || "clamp-to-edge",
            addressModeW: descriptor.addressModeW || "clamp-to-edge",
            magFilter: descriptor.magFilter || "linear",
            minFilter: descriptor.minFilter || "linear",
            mipmapFilter: descriptor.mipmapFilter || "linear",
            lodMinClamp: descriptor.lodMinClamp || 0,
            lodMaxClamp: descriptor.lodMaxClamp || 32,
            compare: descriptor.compare,
            maxAnisotropy: descriptor.maxAnisotropy || 1,
            label: descriptor.label,
        };

        return this.device.getDevice().createSampler(gpuDescriptor);
    }

    /**
     * Generate cache key for sampler
     */
    private getSamplerCacheKey(descriptor: SamplerDescriptor): string {
        return JSON.stringify({
            u: descriptor.addressModeU || "clamp-to-edge",
            v: descriptor.addressModeV || "clamp-to-edge",
            w: descriptor.addressModeW || "clamp-to-edge",
            mag: descriptor.magFilter || "linear",
            min: descriptor.minFilter || "linear",
            mip: descriptor.mipmapFilter || "linear",
            lodMin: descriptor.lodMinClamp || 0,
            lodMax: descriptor.lodMaxClamp || 32,
            cmp: descriptor.compare || null,
            aniso: descriptor.maxAnisotropy || 1,
        });
    }

    /**
     * Clear sampler cache
     */
    clearSamplerCache(): void {
        this.samplers.clear();
        this.stats.cachedSamplers = 0;
    }

    // ========================================================================
    // Utility Functions
    // ========================================================================

    /**
     * Calculate memory usage for texture
     */
    private calculateTextureMemory(descriptor: TextureDescriptor): number {
        const bytesPerPixel = this.getBytesPerPixel(descriptor.format);
        let totalBytes = descriptor.width * descriptor.height * bytesPerPixel;

        // Account for depth/array layers
        if (descriptor.depth) {
            totalBytes *= descriptor.depth;
        }

        // Account for mipmaps (adds ~33% more memory)
        if (descriptor.mipLevelCount && descriptor.mipLevelCount > 1) {
            totalBytes *= 1.33;
        }

        // Account for multisampling
        if (descriptor.sampleCount && descriptor.sampleCount > 1) {
            totalBytes *= descriptor.sampleCount;
        }

        return totalBytes;
    }

    /**
     * Get bytes per pixel for format
     */
    private getBytesPerPixel(format: GPUTextureFormat): number {
        // Common formats
        const formatSizes: Record<string, number> = {
            "r8unorm": 1,
            "r8snorm": 1,
            "r8uint": 1,
            "r8sint": 1,
            "r16uint": 2,
            "r16sint": 2,
            "r16float": 2,
            "rg8unorm": 2,
            "rg8snorm": 2,
            "rg8uint": 2,
            "rg8sint": 2,
            "r32uint": 4,
            "r32sint": 4,
            "r32float": 4,
            "rg16uint": 4,
            "rg16sint": 4,
            "rg16float": 4,
            "rgba8unorm": 4,
            "rgba8unorm-srgb": 4,
            "rgba8snorm": 4,
            "rgba8uint": 4,
            "rgba8sint": 4,
            "bgra8unorm": 4,
            "bgra8unorm-srgb": 4,
            "rgb10a2unorm": 4,
            "rg11b10ufloat": 4,
            "rgb9e5ufloat": 4,
            "rg32uint": 8,
            "rg32sint": 8,
            "rg32float": 8,
            "rgba16uint": 8,
            "rgba16sint": 8,
            "rgba16float": 8,
            "rgba32uint": 16,
            "rgba32sint": 16,
            "rgba32float": 16,
            "depth16unorm": 2,
            "depth24plus": 4,
            "depth24plus-stencil8": 4,
            "depth32float": 4,
            "depth32float-stencil8": 8,
        };

        return formatSizes[format] || 4; // Default to 4 bytes
    }

    /**
     * Get statistics
     */
    getStatistics(): TextureStatistics {
        return { ...this.stats };
    }

    // ========================================================================
    // Cleanup
    // ========================================================================

    /**
     * Destroy all textures and clear cache
     */
    destroy(): void {
        // Destroy all textures
        for (const [id, texture] of this.textures.entries()) {
            texture.destroy();
        }

        this.textures.clear();
        this.textureDescriptors.clear();
        this.samplers.clear();
        this.atlases.clear();
        this.atlasEntries.clear();

        // Reset statistics
        this.stats = {
            texturesCreated: 0,
            activeTextures: 0,
            memoryUsed: 0,
            samplersCreated: 0,
            cachedSamplers: 0,
            bitmapUploads: 0,
            mipmapGenerations: 0,
            atlasTextures: 0,
        };
    }
}

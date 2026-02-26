/**
 * GPU Interface
 *
 * OS-level GPU operations for compositing using WebGPU.
 * This provides hardware-accelerated graphics for the browser compositor.
 */

/**
 * GPU texture handle
 */
export interface GPUTextureHandle {
  id: string;
  width: number;
  height: number;
  format: string;
  // WebGPU texture reference (when available)
  texture?: GPUTexture;
}

/**
 * GPU compositor layer for hardware rendering
 */
export interface GPUCompositorLayer {
  textureId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  zIndex: number;
}

/**
 * GPU - Hardware-accelerated graphics operations
 */
export class GPU {
  private device?: GPUDevice;
  private context?: GPUCanvasContext;
  private textures: Map<string, GPUTextureHandle> = new Map();
  private nextTextureId = 0;
  private compositePipeline?: GPURenderPipeline;
  private sampler?: GPUSampler;
  private bindGroupLayout?: GPUBindGroupLayout;

  /**
   * Initialize GPU device
   * Requests access to WebGPU for hardware acceleration
   */
  async initialize(): Promise<void> {
    if (typeof navigator === "undefined" || !navigator.gpu) {
      console.warn("WebGPU not available, GPU operations will be stubbed");
      return;
    }

    try {
      // Request GPU adapter
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        throw new Error("No GPU adapter available");
      }

      // Request GPU device
      this.device = await adapter.requestDevice();
    } catch (error) {
      console.error("Failed to initialize GPU:", error);
    }
  }

  /**
   * Upload texture data to GPU memory
   * @param data - Raw pixel data (RGBA format)
   * @param width - Texture width in pixels
   * @param height - Texture height in pixels
   * @param format - Pixel format (default: "rgba8unorm")
   * @returns Texture handle
   */
  uploadTexture(
    data: Uint8Array,
    width: number,
    height: number,
    format: string = "rgba8unorm",
  ): GPUTextureHandle {
    const id = `texture_${this.nextTextureId++}`;

    if (!this.device) {
      // GPU not available, return stub handle
      const handle: GPUTextureHandle = { id, width, height, format };
      this.textures.set(id, handle);
      return handle;
    }

    // Create GPU texture
    const texture = this.device.createTexture({
      size: { width, height },
      format: format as GPUTextureFormat,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });

    // Write texture data
    this.device.queue.writeTexture(
      { texture },
      data as BufferSource,
      { bytesPerRow: width * 4, rowsPerImage: height },
      { width, height },
    );

    const handle: GPUTextureHandle = { id, width, height, format, texture };
    this.textures.set(id, handle);
    return handle;
  }

  /**
   * Delete texture from GPU memory
   * @param handle - Texture handle to delete
   */
  deleteTexture(handle: GPUTextureHandle): void {
    if (handle.texture) {
      handle.texture.destroy();
    }
    this.textures.delete(handle.id);
  }

  /**
   * Get texture by ID
   * @param id - Texture ID
   * @returns Texture handle or undefined
   */
  getTexture(id: string): GPUTextureHandle | undefined {
    return this.textures.get(id);
  }

  /**
   * Composite layers to output
   * Renders all compositor layers in z-order to the output
   * @param layers - Layers to composite (sorted by z-index)
   */
  composite(layers: GPUCompositorLayer[]): void {
    if (!this.device || !this.context) {
      // GPU not available (headless mode), skip compositing
      return;
    }

    if (layers.length === 0) {
      return;
    }

    // Sort layers by z-index ascending
    const sorted = [...layers].sort((a, b) => a.zIndex - b.zIndex);

    // Get the current texture to render into
    const currentTexture = this.context.getCurrentTexture();
    const textureView = currentTexture.createView();

    // Create command encoder
    const encoder = this.device.createCommandEncoder();

    // Begin render pass with clear
    const renderPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r: 1.0, g: 1.0, b: 1.0, a: 1.0 },
          loadOp: "clear" as GPULoadOp,
          storeOp: "store" as GPUStoreOp,
        },
      ],
    });

    // Iterate layers and bind textures
    for (const layer of sorted) {
      // Skip fully transparent layers
      if (layer.opacity <= 0) {
        continue;
      }

      // Look up the texture handle for this layer
      const handle = this.textures.get(layer.textureId);
      if (!handle || !handle.texture) {
        continue;
      }

      // Ensure composite pipeline exists
      if (!this.compositePipeline) {
        this.initCompositePipeline(currentTexture.format);
      }

      // Create bind group for this layer's texture
      const bindGroup = this.device.createBindGroup({
        layout: this.bindGroupLayout!,
        entries: [
          { binding: 0, resource: this.sampler! },
          { binding: 1, resource: handle.texture.createView() },
        ],
      });

      renderPass.setPipeline(this.compositePipeline!);
      renderPass.setBindGroup(0, bindGroup);
      renderPass.draw(6); // fullscreen quad (2 triangles)
    }

    // End render pass and submit
    renderPass.end();
    const commandBuffer = encoder.finish();
    this.device.queue.submit([commandBuffer]);
  }

  /**
   * Get GPU device
   * @returns GPU device (if available)
   */
  getDevice(): GPUDevice | undefined {
    return this.device;
  }

  /**
   * Initialize the composite render pipeline for layer blitting
   */
  private initCompositePipeline(format: GPUTextureFormat): void {
    if (!this.device) return;

    const shaderCode = `
      @group(0) @binding(0) var texSampler: sampler;
      @group(0) @binding(1) var texLayer: texture_2d<f32>;

      struct VSOut {
        @builtin(position) pos: vec4f,
        @location(0) uv: vec2f,
      };

      @vertex fn vs(@builtin(vertex_index) vi: u32) -> VSOut {
        var positions = array<vec2f, 6>(
          vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0),
          vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0),
        );
        var uvs = array<vec2f, 6>(
          vec2f(0.0, 1.0), vec2f(1.0, 1.0), vec2f(0.0, 0.0),
          vec2f(0.0, 0.0), vec2f(1.0, 1.0), vec2f(1.0, 0.0),
        );
        var out: VSOut;
        out.pos = vec4f(positions[vi], 0.0, 1.0);
        out.uv = uvs[vi];
        return out;
      }

      @fragment fn fs(input: VSOut) -> @location(0) vec4f {
        return textureSample(texLayer, texSampler, input.uv);
      }
    `;

    const shaderModule = this.device.createShaderModule({ code: shaderCode });

    this.sampler = this.device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
    });

    this.bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      ],
    });

    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [this.bindGroupLayout],
    });

    this.compositePipeline = this.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: { module: shaderModule, entryPoint: "vs" },
      fragment: {
        module: shaderModule,
        entryPoint: "fs",
        targets: [{
          format,
          blend: {
            color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
            alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
          },
        }],
      },
      primitive: { topology: "triangle-list" },
    });
  }

  /**
   * Check if GPU is available
   * @returns true if GPU is initialized
   */
  isAvailable(): boolean {
    return this.device !== undefined;
  }
}

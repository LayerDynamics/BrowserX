/**
 * Example 4: WebGPU Engine - Complete GPU Rendering Workflow
 *
 * This example demonstrates comprehensive usage of the WebGPU engine,
 * including buffer management, texture operations, pipeline creation,
 * rendering, and memory management.
 */

import { WebGPUEngine } from "../src/engine/webgpu/WebGPU.ts";
import type { Pixels } from "../src/types/identifiers.ts";

console.log("=".repeat(60));
console.log("Example 4: WebGPU Engine - Complete Rendering Workflow");
console.log("=".repeat(60));

try {
    // Mock canvas for demonstration
    const canvas = {
        width: 1024,
        height: 768,
        getContext: (_type: string) => null,
    } as any;

    console.log("\n1. Creating and initializing WebGPU engine...");
    const engine = new WebGPUEngine({ canvas });

    try {
        await engine.initialize();
        console.log("✓ Engine initialized");

        // Access all major subsystems
        const device = engine.getDevice();
        const gpuDevice = engine.getGPUDevice();
        const driver = engine.getDriver();
        const memoryManager = engine.getMemoryManager();
        const bufferPool = engine.getBufferPool();
        const stagingPool = engine.getStagingPool();
        const pipelineManager = engine.getPipelineManager();
        const textureManager = engine.getTextureManager();
        const compositor = engine.getCompositor();
        const canvasContext = engine.getCanvasContext();

        // 2. Buffer Operations
        console.log("\n2. Creating various GPU buffers...");

        // Vertex buffer
        const vertices = new Float32Array([
            // Triangle 1
            -0.5, -0.5, 0.0, 1.0,  1.0, 0.0, 0.0, 1.0,  // pos + color
            0.5, -0.5, 0.0, 1.0,   0.0, 1.0, 0.0, 1.0,
            0.0, 0.5, 0.0, 1.0,    0.0, 0.0, 1.0, 1.0,
        ]);

        const vertexBuffer = engine.createBuffer({
            size: vertices.byteLength as any,
            usage: 0x0020 | 0x0008, // VERTEX | COPY_DST
            label: "vertex-buffer",
        });
        engine.writeBuffer(vertexBuffer, 0, vertices);
        console.log(`✓ Created vertex buffer (${vertices.byteLength} bytes)`);

        // Index buffer
        const indices = new Uint16Array([0, 1, 2]);
        const indexBuffer = engine.createBuffer({
            size: indices.byteLength as any,
            usage: 0x0040 | 0x0008, // INDEX | COPY_DST
            label: "index-buffer",
        });
        engine.writeBuffer(indexBuffer, 0, indices);
        console.log(`✓ Created index buffer (${indices.byteLength} bytes)`);

        // Uniform buffer
        const uniformData = new Float32Array([
            1.0, 0.0, 0.0, 0.0, // transform matrix row 1
            0.0, 1.0, 0.0, 0.0, // transform matrix row 2
            0.0, 0.0, 1.0, 0.0, // transform matrix row 3
            0.0, 0.0, 0.0, 1.0, // transform matrix row 4
        ]);
        const uniformBuffer = engine.createBuffer({
            size: uniformData.byteLength as any,
            usage: 0x0040 | 0x0008, // UNIFORM | COPY_DST
            label: "uniform-buffer",
        });
        engine.writeBuffer(uniformBuffer, 0, uniformData);
        console.log(`✓ Created uniform buffer (${uniformData.byteLength} bytes)`);

        // 3. Buffer Pool Operations
        console.log("\n3. Using buffer pool for efficient reuse...");
        const pooledBuffers = [];
        for (let i = 0; i < 5; i++) {
            const buffer = bufferPool.acquire((1024 * (i + 1)) as any, 0x0020 as any);
            pooledBuffers.push(buffer);
        }
        console.log(`✓ Acquired ${pooledBuffers.length} buffers from pool`);

        const poolStats1 = bufferPool.getStatistics();
        console.log(`  Allocated: ${poolStats1.allocated}, Available: ${poolStats1.available}`);
        console.log(`  Hits: ${poolStats1.hits}, Misses: ${poolStats1.misses}`);

        for (const buffer of pooledBuffers) {
            bufferPool.release(buffer);
        }
        console.log(`✓ Released buffers back to pool`);

        const poolStats2 = bufferPool.getStatistics();
        console.log(`  After release - Available: ${poolStats2.available}`);

        // Trim unused buffers
        bufferPool.trim();
        console.log(`✓ Trimmed unused buffers from pool`);

        // 4. Staging Buffer Operations
        console.log("\n4. Using staging buffers for data upload...");
        const stagingBuffer1 = stagingPool.acquire(8192 as any);
        const stagingBuffer2 = stagingPool.acquire(4096 as any);
        console.log(`✓ Acquired staging buffers`);

        stagingPool.release(stagingBuffer1);
        stagingPool.release(stagingBuffer2);
        console.log(`✓ Released staging buffers`);

        // 5. Texture Operations
        console.log("\n5. Creating and managing textures...");

        // Color texture
        const colorTextureId = textureManager.createTexture({
            width: 512 as Pixels,
            height: 512 as Pixels,
            format: "rgba8unorm",
            usage: 0x04 | 0x01 | 0x10, // TEXTURE_BINDING | COPY_DST | RENDER_ATTACHMENT
            label: "color-texture",
        });
        console.log(`✓ Created color texture: ${colorTextureId}`);

        // Upload texture data
        const textureData = new Uint8Array(512 * 512 * 4);
        for (let i = 0; i < textureData.length; i += 4) {
            const x = (i / 4) % 512;
            const y = Math.floor((i / 4) / 512);
            textureData[i] = (x / 512) * 255;     // R: gradient X
            textureData[i + 1] = (y / 512) * 255; // G: gradient Y
            textureData[i + 2] = 128;              // B: constant
            textureData[i + 3] = 255;              // A: opaque
        }
        textureManager.uploadPixels(colorTextureId, textureData, 512 as Pixels, 512 as Pixels);
        console.log(`✓ Uploaded pixel data to color texture`);

        // Depth texture
        const depthTextureId = textureManager.createTexture({
            width: 1024 as Pixels,
            height: 768 as Pixels,
            format: "depth24plus",
            usage: 0x10, // RENDER_ATTACHMENT
            label: "depth-texture",
        });
        console.log(`✓ Created depth texture: ${depthTextureId}`);

        // Normal map texture
        const normalTextureId = textureManager.createTexture({
            width: 256 as Pixels,
            height: 256 as Pixels,
            format: "rgba8unorm",
            usage: 0x04 | 0x01, // TEXTURE_BINDING | COPY_DST
            label: "normal-map",
        });
        console.log(`✓ Created normal map texture: ${normalTextureId}`);

        // Get textures
        const colorTexture = textureManager.getTexture(colorTextureId);
        const depthTexture = textureManager.getTexture(depthTextureId);
        console.log(`✓ Retrieved texture objects`);

        // Create sampler
        const sampler = textureManager.createSampler({
            magFilter: "linear",
            minFilter: "linear",
            addressModeU: "repeat",
            addressModeV: "repeat",
        });
        console.log(`✓ Created texture sampler`);

        // Texture statistics
        const texStats = textureManager.getStatistics();
        console.log(`Texture statistics:`);
        console.log(`  Active textures: ${texStats.activeTextures}`);
        console.log(`  Total memory: ${texStats.totalMemory} bytes`);
        console.log(`  Sampler count: ${texStats.samplerCount}`);

        // 6. Pipeline Operations
        console.log("\n6. Working with render and compute pipelines...");

        const renderPipelineManager = pipelineManager.getRenderPipelineManager();
        const computePipelineManager = pipelineManager.getComputePipelineManager();
        console.log(`✓ Got pipeline managers`);

        // Get pipeline statistics
        const pipelineStats = pipelineManager.getStats();
        console.log(`Pipeline statistics:`);
        console.log(`  Render pipelines: ${JSON.stringify(pipelineStats.renderPipelines)}`);
        console.log(`  Compute pipelines: ${JSON.stringify(pipelineStats.computePipelines)}`);

        // 7. Memory Management
        console.log("\n7. Comprehensive memory management...");

        const memStats = memoryManager.getStatistics();
        console.log(`Memory statistics:`);
        console.log(`  Buffer pool:`);
        console.log(`    Total memory: ${memStats.bufferPool.totalMemory} bytes`);
        console.log(`    Allocated: ${memStats.bufferPool.allocated}`);
        console.log(`    Available: ${memStats.bufferPool.available}`);
        console.log(`    Peak usage: ${memStats.bufferPool.peakUsage}`);
        console.log(`    Hit rate: ${(memStats.bufferPool.hits / (memStats.bufferPool.hits + memStats.bufferPool.misses) * 100).toFixed(2)}%`);
        console.log(`  Staging pool:`);
        console.log(`    Pool size: ${memStats.staging.poolSize}`);
        console.log(`    Allocated: ${memStats.staging.allocated}`);
        console.log(`    Available: ${memStats.staging.available}`);

        // 8. Rendering Operations
        console.log("\n8. Performing render operations...");

        // Begin frame
        const commandEncoder = engine.beginFrame();
        console.log(`✓ Began frame with command encoder`);

        // Create render pass descriptor
        const renderPassDescriptor = {
            colorAttachments: [{
                view: colorTexture.createView(),
                clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1.0 },
                loadOp: 'clear' as const,
                storeOp: 'store' as const,
            }],
            depthStencilAttachment: {
                view: depthTexture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear' as const,
                depthStoreOp: 'store' as const,
            },
        };

        const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);
        console.log(`✓ Created render pass`);

        // Set buffers (would set pipeline first in real usage)
        renderPass.setVertexBuffer(0, vertexBuffer);
        renderPass.setIndexBuffer(indexBuffer, "uint16");
        console.log(`✓ Set vertex and index buffers`);

        // Draw indexed
        renderPass.drawIndexed(3, 1, 0, 0, 0);
        console.log(`✓ Recorded draw call`);

        renderPass.end();
        console.log(`✓ Ended render pass`);

        // End frame
        engine.endFrame(commandEncoder);
        console.log(`✓ Ended frame and submitted commands`);

        // 9. Compositor Operations
        console.log("\n9. Working with compositor...");

        const compositorStats = compositor.getStats();
        console.log(`Compositor statistics:`, compositorStats);

        // Resize compositor
        compositor.resize(800, 600);
        console.log(`✓ Resized compositor to 800x600`);

        // Composite frame
        compositor.composite();
        console.log(`✓ Composited frame`);

        // 10. Additional Buffer Operations
        console.log("\n10. Advanced buffer operations...");

        // Read buffer (async)
        const readBuffer = engine.createBuffer({
            size: 256 as any,
            usage: 0x0002 | 0x0001, // MAP_READ | COPY_DST
            label: "read-buffer",
        });
        console.log(`✓ Created read buffer`);

        // Copy buffer to buffer
        const copyEncoder = device.createCommandEncoder();
        copyEncoder.copyBufferToBuffer(vertexBuffer, 0, readBuffer, 0, 256);
        device.queue.submit([copyEncoder.finish()]);
        console.log(`✓ Copied buffer data`);

        // 11. Cleanup and Final Statistics
        console.log("\n11. Cleanup and final statistics...");

        // Destroy buffers
        vertexBuffer.destroy();
        indexBuffer.destroy();
        uniformBuffer.destroy();
        readBuffer.destroy();
        console.log(`✓ Destroyed all buffers`);

        // Destroy textures
        textureManager.destroyTexture(colorTextureId);
        textureManager.destroyTexture(depthTextureId);
        textureManager.destroyTexture(normalTextureId);
        console.log(`✓ Destroyed all textures`);

        // Final memory statistics
        const finalMemStats = memoryManager.getStatistics();
        console.log(`Final memory statistics:`);
        console.log(`  Buffer pool total: ${finalMemStats.bufferPool.totalMemory} bytes`);
        console.log(`  Staging pool size: ${finalMemStats.staging.poolSize}`);

        // Final texture statistics
        const finalTexStats = textureManager.getStatistics();
        console.log(`Final texture statistics:`);
        console.log(`  Active textures: ${finalTexStats.activeTextures}`);
        console.log(`  Total memory: ${finalTexStats.totalMemory} bytes`);

        // Destroy engine
        engine.destroy();
        console.log(`✓ Destroyed engine`);

    } catch (initError) {
        console.error("⚠️  WebGPU initialization failed:", initError);
        console.log("\nThis is expected if WebGPU is not available.");
        console.log("The example demonstrates the complete API surface.");
    }
} catch (error) {
    console.error("Error:", error);
}

console.log("\n" + "=".repeat(60));
console.log("Example complete!");
console.log("Demonstrated: buffers, textures, samplers, pipelines,");
console.log("rendering, memory management, and compositor operations.");
console.log("=".repeat(60));

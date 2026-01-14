/**
 * Compositor Layer - GPU texture management
 *
 * Compositor layers are GPU-backed textures that can be efficiently
 * composited together. They manage:
 * - WebGL texture upload and management
 * - Transform matrices for positioning
 * - Opacity and blending
 * - Tile management for large layers
 */

import type { Pixels } from "../../../types/identifiers.ts";
import type {
    HTMLCanvasElement,
    ImageBitmap,
    WebGLProgram,
    WebGLRenderingContext,
    WebGLTexture,
} from "../../../types/dom.ts";
import { document } from "../../../types/dom.ts";
import type { BoundingBox } from "../paint/DisplayList.ts";
import { CompositingMode, PaintLayer, type Transform } from "../paint/PaintLayer.ts";
import { Tile, TileGrid, type TileID } from "./Tile.ts";

/**
 * Compositor layer ID
 */
export type CompositorLayerID = string & { __brand: "CompositorLayerID" };

/**
 * WebGL texture handle
 */
export interface GLTexture {
    texture: WebGLTexture;
    width: number;
    height: number;
}

/**
 * Compositor layer state
 */
export enum CompositorLayerState {
    PENDING_UPLOAD = "pending_upload",
    UPLOADED = "uploaded",
    INVALID = "invalid",
}

/**
 * Compositor layer statistics
 */
export interface CompositorLayerStats {
    textureMemory: number;
    uploadTime: number;
    tileCount: number;
    uploadedTiles: number;
}

/**
 * CompositorLayer
 * Manages GPU textures and compositing for a paint layer
 */
export class CompositorLayer {
    readonly id: CompositorLayerID;
    private paintLayer: PaintLayer;
    private tileGrid: TileGrid | null = null;
    private glTextures: Map<TileID, GLTexture> = new Map();
    private state: CompositorLayerState;
    private transform: Transform;
    private opacity: number;
    private compositingMode: CompositingMode;
    private gl: WebGLRenderingContext | null = null;
    private uploadTime: number = 0;
    private useTiling: boolean;

    constructor(
        id: CompositorLayerID,
        paintLayer: PaintLayer,
        useTiling: boolean = true,
    ) {
        this.id = id;
        this.paintLayer = paintLayer;
        this.state = CompositorLayerState.PENDING_UPLOAD;
        this.transform = paintLayer.getTransform();
        this.opacity = paintLayer.getOpacity();
        this.compositingMode = paintLayer.getCompositingMode();
        this.useTiling = useTiling;
    }

    /**
     * Initialize with WebGL context
     */
    initialize(gl: WebGLRenderingContext): void {
        this.gl = gl;

        if (this.useTiling) {
            // Create tile grid for layer
            const bounds = this.paintLayer.getBounds();
            const displayList = this.paintLayer.getDisplayList();

            this.tileGrid = new TileGrid(256 as Pixels, 1.0);
            this.tileGrid.createTilesForBounds(bounds, displayList);
        }
    }

    /**
     * Upload texture to GPU
     * Uploads paint layer content as WebGL texture
     */
    async uploadTexture(): Promise<void> {
        if (!this.gl) {
            throw new Error("WebGL context not initialized");
        }

        if (this.state === CompositorLayerState.UPLOADED && !this.paintLayer.isDirty()) {
            return; // Already uploaded and clean
        }

        const startTime = performance.now();

        try {
            if (this.useTiling && this.tileGrid) {
                // Upload tiles
                await this.uploadTiles();
            } else {
                // Upload single texture
                await this.uploadSingleTexture();
            }

            this.state = CompositorLayerState.UPLOADED;
            this.uploadTime = performance.now() - startTime;
        } catch (error) {
            console.error(`Failed to upload compositor layer ${this.id}:`, error);
            this.state = CompositorLayerState.INVALID;
        }
    }

    /**
     * Upload layer as single texture
     */
    private async uploadSingleTexture(): Promise<void> {
        if (!this.gl) {
            return;
        }

        const displayList = this.paintLayer.getDisplayList();
        const bounds = this.paintLayer.getBounds();

        // Create canvas and render display list
        const canvas = document.createElement("canvas");
        canvas.width = bounds.width;
        canvas.height = bounds.height;

        const context = canvas.getContext("2d");
        if (!context) {
            throw new Error("Failed to get 2D context");
        }

        displayList.replay(context);

        // Create image bitmap
        const bitmap = await createImageBitmap(canvas as unknown as ImageBitmapSource);

        // Upload to GPU
        const texture = this.createGLTexture(bitmap, bounds.width, bounds.height);

        // Store texture with dummy tile ID
        this.glTextures.set("single" as TileID, texture);

        bitmap.close();
    }

    /**
     * Upload tiles to GPU
     */
    private async uploadTiles(): Promise<void> {
        if (!this.gl || !this.tileGrid) {
            return;
        }

        const tiles = this.tileGrid.getAllTiles();

        // Rasterize and upload all tiles
        for (const tile of tiles) {
            if (!tile.isReady() || tile.getState() === "invalid") {
                await tile.rasterize();
            }

            const tileData = tile.getData();
            if (!tileData || !tileData.bitmap) {
                continue;
            }

            // Upload tile texture
            const texture = this.createGLTexture(
                tileData.bitmap,
                tileData.width,
                tileData.height,
            );

            this.glTextures.set(tile.id, texture);
        }
    }

    /**
     * Create WebGL texture from bitmap
     */
    private createGLTexture(
        source: ImageBitmap | HTMLCanvasElement,
        width: number,
        height: number,
    ): GLTexture {
        if (!this.gl) {
            throw new Error("WebGL context not initialized");
        }

        const texture = this.gl.createTexture();
        if (!texture) {
            throw new Error("Failed to create WebGL texture");
        }

        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

        // Upload texture data
        this.gl.texImage2D(
            this.gl.TEXTURE_2D,
            0,
            this.gl.RGBA,
            this.gl.RGBA,
            this.gl.UNSIGNED_BYTE,
            source,
        );

        // Set texture parameters
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);

        this.gl.bindTexture(this.gl.TEXTURE_2D, null);

        return {
            texture,
            width,
            height,
        };
    }

    /**
     * Composite layer to target
     * Draws layer textures with transform and opacity
     */
    composite(gl: WebGLRenderingContext, program: WebGLProgram, viewport: BoundingBox): void {
        if (this.state !== CompositorLayerState.UPLOADED) {
            return;
        }

        if (this.useTiling && this.tileGrid) {
            this.compositeTiles(gl, program, viewport);
        } else {
            this.compositeSingle(gl, program);
        }
    }

    /**
     * Composite single texture
     */
    private compositeSingle(gl: WebGLRenderingContext, program: WebGLProgram): void {
        const texture = this.glTextures.get("single" as TileID);
        if (!texture) {
            return;
        }

        const bounds = this.paintLayer.getBounds();

        // Set uniforms for transform, opacity, etc.
        this.setUniforms(gl, program);

        // Bind texture
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture.texture);

        // Draw quad for this layer
        this.drawQuad(gl, bounds);
    }

    /**
     * Composite tiles
     */
    private compositeTiles(
        gl: WebGLRenderingContext,
        program: WebGLProgram,
        viewport: BoundingBox,
    ): void {
        if (!this.tileGrid) {
            return;
        }

        // Get visible tiles
        const visibleTiles = this.tileGrid.getTilesInViewport(viewport);

        // Set uniforms
        this.setUniforms(gl, program);

        // Draw each tile
        for (const tile of visibleTiles) {
            if (!tile.isReady()) {
                continue;
            }

            const texture = this.glTextures.get(tile.id);
            if (!texture) {
                continue;
            }

            // Bind tile texture
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, texture.texture);

            // Draw quad for this tile
            this.drawQuad(gl, tile.bounds);
        }
    }

    /**
     * Set shader uniforms for compositing
     */
    private setUniforms(gl: WebGLRenderingContext, program: WebGLProgram): void {
        // Set transform matrix
        const transformLoc = gl.getUniformLocation(program, "u_transform");
        if (transformLoc) {
            const matrix = this.createTransformMatrix();
            gl.uniformMatrix4fv(transformLoc, false, matrix);
        }

        // Set opacity
        const opacityLoc = gl.getUniformLocation(program, "u_opacity");
        if (opacityLoc) {
            gl.uniform1f(opacityLoc, this.opacity);
        }

        // Set texture sampler
        const textureLoc = gl.getUniformLocation(program, "u_texture");
        if (textureLoc) {
            gl.uniform1i(textureLoc, 0);
        }
    }

    /**
     * Create 4x4 transform matrix from layer transform
     */
    private createTransformMatrix(): Float32Array {
        const t = this.transform;
        const matrix = new Float32Array(16);

        // Identity matrix
        matrix[0] = 1;
        matrix[5] = 1;
        matrix[10] = 1;
        matrix[15] = 1;

        // Apply transform
        // Simplified - real implementation would properly compose transforms
        matrix[12] = t.translateX;
        matrix[13] = t.translateY;
        matrix[0] = t.scaleX;
        matrix[5] = t.scaleY;

        return matrix;
    }

    /**
     * Draw textured quad
     */
    private drawQuad(gl: WebGLRenderingContext, bounds: BoundingBox): void {
        // Create vertex buffer for quad
        const vertices = new Float32Array([
            bounds.x,
            bounds.y,
            0,
            0,
            bounds.x + bounds.width,
            bounds.y,
            1,
            0,
            bounds.x,
            bounds.y + bounds.height,
            0,
            1,
            bounds.x + bounds.width,
            bounds.y + bounds.height,
            1,
            1,
        ]);

        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        // Set up vertex attributes (position + texcoord)
        const positionLoc = gl.getAttribLocation(
            gl.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram,
            "a_position",
        );
        const texcoordLoc = gl.getAttribLocation(
            gl.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram,
            "a_texcoord",
        );

        if (positionLoc >= 0) {
            gl.enableVertexAttribArray(positionLoc);
            gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 16, 0);
        }

        if (texcoordLoc >= 0) {
            gl.enableVertexAttribArray(texcoordLoc);
            gl.vertexAttribPointer(texcoordLoc, 2, gl.FLOAT, false, 16, 8);
        }

        // Draw
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        // Cleanup
        gl.deleteBuffer(buffer);
    }

    /**
     * Invalidate layer textures
     */
    invalidate(): void {
        this.state = CompositorLayerState.PENDING_UPLOAD;

        // Delete GL textures
        if (this.gl) {
            for (const glTexture of this.glTextures.values()) {
                this.gl.deleteTexture(glTexture.texture);
            }
        }
        this.glTextures.clear();

        // Invalidate tiles
        if (this.tileGrid) {
            this.tileGrid.invalidateAll();
        }
    }

    /**
     * Update from paint layer
     */
    updateFromPaintLayer(): void {
        this.transform = this.paintLayer.getTransform();
        this.opacity = this.paintLayer.getOpacity();
        this.compositingMode = this.paintLayer.getCompositingMode();

        if (this.paintLayer.isDirty()) {
            this.invalidate();
        }
    }

    /**
     * Get layer state
     */
    getState(): CompositorLayerState {
        return this.state;
    }

    /**
     * Get paint layer
     */
    getPaintLayer(): PaintLayer {
        return this.paintLayer;
    }

    /**
     * Get statistics
     */
    getStats(): CompositorLayerStats {
        let textureMemory = 0;
        for (const texture of this.glTextures.values()) {
            textureMemory += texture.width * texture.height * 4; // RGBA
        }

        return {
            textureMemory,
            uploadTime: this.uploadTime,
            tileCount: this.tileGrid?.getAllTiles().length ?? 0,
            uploadedTiles: this.glTextures.size,
        };
    }

    /**
     * Dispose layer resources
     */
    dispose(): void {
        if (this.gl) {
            for (const glTexture of this.glTextures.values()) {
                this.gl.deleteTexture(glTexture.texture);
            }
        }
        this.glTextures.clear();

        if (this.tileGrid) {
            this.tileGrid.dispose();
            this.tileGrid = null;
        }

        this.state = CompositorLayerState.INVALID;
    }
}

/**
 * Compositor layer manager
 * Manages all compositor layers
 */
export class CompositorLayerManager {
    private layers: Map<CompositorLayerID, CompositorLayer> = new Map();
    private gl: WebGLRenderingContext | null = null;
    private nextLayerId = 0;

    /**
     * Initialize with WebGL context
     */
    initialize(gl: WebGLRenderingContext): void {
        this.gl = gl;
    }

    /**
     * Create compositor layer from paint layer
     */
    createLayer(paintLayer: PaintLayer, useTiling: boolean = true): CompositorLayer {
        const id = this.generateLayerId();
        const layer = new CompositorLayer(id, paintLayer, useTiling);

        if (this.gl) {
            layer.initialize(this.gl);
        }

        this.layers.set(id, layer);
        return layer;
    }

    /**
     * Generate unique layer ID
     */
    private generateLayerId(): CompositorLayerID {
        return `compositor-layer-${this.nextLayerId++}` as CompositorLayerID;
    }

    /**
     * Get layer by ID
     */
    getLayer(id: CompositorLayerID): CompositorLayer | undefined {
        return this.layers.get(id);
    }

    /**
     * Get all layers
     */
    getAllLayers(): CompositorLayer[] {
        return Array.from(this.layers.values());
    }

    /**
     * Upload all pending layers
     */
    async uploadPendingLayers(): Promise<void> {
        const pending = this.getAllLayers().filter(
            (layer) => layer.getState() === CompositorLayerState.PENDING_UPLOAD,
        );

        await Promise.all(pending.map((layer) => layer.uploadTexture()));
    }

    /**
     * Update layers from paint layers
     */
    updateLayers(): void {
        for (const layer of this.layers.values()) {
            layer.updateFromPaintLayer();
        }
    }

    /**
     * Dispose layer
     */
    disposeLayer(id: CompositorLayerID): void {
        const layer = this.layers.get(id);
        if (layer) {
            layer.dispose();
            this.layers.delete(id);
        }
    }

    /**
     * Dispose all layers
     */
    disposeAll(): void {
        for (const layer of this.layers.values()) {
            layer.dispose();
        }
        this.layers.clear();
    }

    /**
     * Get total texture memory
     */
    getTotalTextureMemory(): number {
        let total = 0;
        for (const layer of this.layers.values()) {
            total += layer.getStats().textureMemory;
        }
        return total;
    }

    /**
     * Cleanup all resources
     */
    cleanup(): void {
        this.disposeAll();
        this.gl = null;
    }
}

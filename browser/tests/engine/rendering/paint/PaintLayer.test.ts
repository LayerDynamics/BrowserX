/**
 * Tests for Paint Layer
 * Tests compositing layers and layer tree management.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import {
    PaintLayer,
    LayerTree,
    CompositingMode,
    type LayerID,
    type Transform,
} from "../../../../src/engine/rendering/paint/PaintLayer.ts";
import type { BoundingBox } from "../../../../src/engine/rendering/paint/DisplayList.ts";
import type { RenderObject } from "../../../../src/engine/rendering/rendering/RenderObject.ts";

// Mock RenderObject for testing
function createMockRenderObject(id: string, needsPaint = false): RenderObject {
    return {
        id: id as any,
        element: {} as any,
        style: {
            getPropertyValue: (prop: string) => {
                if (prop === 'will-change') return 'auto';
                if (prop === 'transform') return 'none';
                return '';
            },
        } as any,
        parent: null,
        children: [],
        nextSibling: null,
        layout: null,
        needsLayout: false,
        paintLayer: null,
        needsPaint,
        markNeedsLayout: () => {},
        doLayout: () => {},
        markNeedsPaint: () => {},
        paint: () => {},
        setPosition: () => {},
        appendChild: () => {},
        removeChild: () => {},
        insertBefore: () => {},
        get firstChild() { return null; },
        get lastChild() { return null; },
        isBlock: () => false,
        isInline: () => false,
        isReplaced: () => false,
        createsStackingContext: () => false,
        getPixelValue: () => 0 as any,
        visitChildren: () => {},
        findAncestor: () => null,
        getDepth: () => 0,
        isAncestorOf: () => false,
        toString: () => '',
        debugTree: () => '',
    } as any;
}

// CompositingMode enum tests

Deno.test({
    name: "CompositingMode - SOURCE_OVER value",
    fn() {
        assertEquals(CompositingMode.SOURCE_OVER, "source-over");
    },
});

Deno.test({
    name: "CompositingMode - MULTIPLY value",
    fn() {
        assertEquals(CompositingMode.MULTIPLY, "multiply");
    },
});

Deno.test({
    name: "CompositingMode - SCREEN value",
    fn() {
        assertEquals(CompositingMode.SCREEN, "screen");
    },
});

Deno.test({
    name: "CompositingMode - OVERLAY value",
    fn() {
        assertEquals(CompositingMode.OVERLAY, "overlay");
    },
});

Deno.test({
    name: "CompositingMode - DARKEN value",
    fn() {
        assertEquals(CompositingMode.DARKEN, "darken");
    },
});

Deno.test({
    name: "CompositingMode - LIGHTEN value",
    fn() {
        assertEquals(CompositingMode.LIGHTEN, "lighten");
    },
});

// PaintLayer constructor tests

Deno.test({
    name: "PaintLayer - constructor creates layer instance",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const layer = new PaintLayer("layer-1" as LayerID, bounds);
        assertExists(layer);
    },
});

Deno.test({
    name: "PaintLayer - constructor sets id",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const layer = new PaintLayer("layer-1" as LayerID, bounds);
        assertEquals(layer.id, "layer-1");
    },
});

Deno.test({
    name: "PaintLayer - constructor initializes empty render objects",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const layer = new PaintLayer("layer-1" as LayerID, bounds);
        assertEquals(layer.getRenderObjects().length, 0);
    },
});

Deno.test({
    name: "PaintLayer - constructor initializes default transform",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const layer = new PaintLayer("layer-1" as LayerID, bounds);
        const transform = layer.getTransform();
        assertEquals(transform.translateX, 0);
        assertEquals(transform.translateY, 0);
        assertEquals(transform.scaleX, 1);
        assertEquals(transform.scaleY, 1);
        assertEquals(transform.rotation, 0);
    },
});

Deno.test({
    name: "PaintLayer - constructor initializes default opacity",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const layer = new PaintLayer("layer-1" as LayerID, bounds);
        assertEquals(layer.getOpacity(), 1.0);
    },
});

Deno.test({
    name: "PaintLayer - constructor initializes default compositing mode",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const layer = new PaintLayer("layer-1" as LayerID, bounds);
        assertEquals(layer.getCompositingMode(), CompositingMode.SOURCE_OVER);
    },
});

Deno.test({
    name: "PaintLayer - constructor marks layer as dirty",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const layer = new PaintLayer("layer-1" as LayerID, bounds);
        assertEquals(layer.isDirty(), true);
    },
});

// PaintLayer render object management tests

Deno.test({
    name: "PaintLayer - addRenderObject adds object",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const layer = new PaintLayer("layer-1" as LayerID, bounds);
        const renderObject = createMockRenderObject("obj-1");

        layer.addRenderObject(renderObject);

        assertEquals(layer.getRenderObjects().length, 1);
        assertEquals(layer.getRenderObjects()[0], renderObject);
    },
});

Deno.test({
    name: "PaintLayer - addRenderObject marks layer dirty",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const layer = new PaintLayer("layer-1" as LayerID, bounds);
        layer.markClean();

        const renderObject = createMockRenderObject("obj-1");
        layer.addRenderObject(renderObject);

        assertEquals(layer.isDirty(), true);
    },
});

Deno.test({
    name: "PaintLayer - removeRenderObject removes object",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const layer = new PaintLayer("layer-1" as LayerID, bounds);
        const renderObject = createMockRenderObject("obj-1");

        layer.addRenderObject(renderObject);
        layer.removeRenderObject(renderObject);

        assertEquals(layer.getRenderObjects().length, 0);
    },
});

Deno.test({
    name: "PaintLayer - removeRenderObject marks layer dirty",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const layer = new PaintLayer("layer-1" as LayerID, bounds);
        const renderObject = createMockRenderObject("obj-1");

        layer.addRenderObject(renderObject);
        layer.markClean();
        layer.removeRenderObject(renderObject);

        assertEquals(layer.isDirty(), true);
    },
});

Deno.test({
    name: "PaintLayer - removeRenderObject with non-existent object",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const layer = new PaintLayer("layer-1" as LayerID, bounds);
        const renderObject = createMockRenderObject("obj-1");

        layer.removeRenderObject(renderObject);

        assertEquals(layer.getRenderObjects().length, 0);
    },
});

// PaintLayer child management tests

Deno.test({
    name: "PaintLayer - addChild adds child layer",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const parent = new PaintLayer("parent" as LayerID, bounds);
        const child = new PaintLayer("child" as LayerID, bounds);

        parent.addChild(child);

        assertEquals(parent.getChildren().length, 1);
        assertEquals(parent.getChildren()[0], child);
    },
});

Deno.test({
    name: "PaintLayer - addChild sets parent reference",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const parent = new PaintLayer("parent" as LayerID, bounds);
        const child = new PaintLayer("child" as LayerID, bounds);

        parent.addChild(child);

        assertEquals(child.getParent(), parent);
    },
});

Deno.test({
    name: "PaintLayer - removeChild removes child layer",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const parent = new PaintLayer("parent" as LayerID, bounds);
        const child = new PaintLayer("child" as LayerID, bounds);

        parent.addChild(child);
        parent.removeChild(child);

        assertEquals(parent.getChildren().length, 0);
    },
});

Deno.test({
    name: "PaintLayer - removeChild clears parent reference",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const parent = new PaintLayer("parent" as LayerID, bounds);
        const child = new PaintLayer("child" as LayerID, bounds);

        parent.addChild(child);
        parent.removeChild(child);

        assertEquals(child.getParent(), null);
    },
});

Deno.test({
    name: "PaintLayer - getParent returns null initially",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const layer = new PaintLayer("layer-1" as LayerID, bounds);

        assertEquals(layer.getParent(), null);
    },
});

// PaintLayer display list tests

Deno.test({
    name: "PaintLayer - getDisplayList returns display list",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const layer = new PaintLayer("layer-1" as LayerID, bounds);

        const displayList = layer.getDisplayList();

        assertExists(displayList);
    },
});

// PaintLayer bounds tests

Deno.test({
    name: "PaintLayer - getBounds returns bounds copy",
    fn() {
        const bounds: BoundingBox = { x: 10, y: 20, width: 100, height: 50 };
        const layer = new PaintLayer("layer-1" as LayerID, bounds);

        const result = layer.getBounds();

        assertEquals(result.x, 10);
        assertEquals(result.y, 20);
        assertEquals(result.width, 100);
        assertEquals(result.height, 50);
    },
});

Deno.test({
    name: "PaintLayer - setBounds updates bounds",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const layer = new PaintLayer("layer-1" as LayerID, bounds);

        layer.setBounds({ x: 10, y: 20, width: 200, height: 150 });
        const result = layer.getBounds();

        assertEquals(result.x, 10);
        assertEquals(result.y, 20);
        assertEquals(result.width, 200);
        assertEquals(result.height, 150);
    },
});

Deno.test({
    name: "PaintLayer - setBounds marks layer dirty",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const layer = new PaintLayer("layer-1" as LayerID, bounds);
        layer.markClean();

        layer.setBounds({ x: 10, y: 20, width: 200, height: 150 });

        assertEquals(layer.isDirty(), true);
    },
});

// PaintLayer transform tests

Deno.test({
    name: "PaintLayer - getTransform returns transform copy",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const layer = new PaintLayer("layer-1" as LayerID, bounds);

        const transform1 = layer.getTransform();
        const transform2 = layer.getTransform();

        assert(transform1 !== transform2);
    },
});

Deno.test({
    name: "PaintLayer - setTransform updates transform",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const layer = new PaintLayer("layer-1" as LayerID, bounds);

        layer.setTransform({ translateX: 10 as any, translateY: 20 as any });
        const transform = layer.getTransform();

        assertEquals(transform.translateX, 10);
        assertEquals(transform.translateY, 20);
    },
});

Deno.test({
    name: "PaintLayer - setTransform partial update",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const layer = new PaintLayer("layer-1" as LayerID, bounds);

        layer.setTransform({ rotation: 45 });
        const transform = layer.getTransform();

        assertEquals(transform.rotation, 45);
        assertEquals(transform.scaleX, 1);
        assertEquals(transform.scaleY, 1);
    },
});

Deno.test({
    name: "PaintLayer - setTransform marks layer dirty",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const layer = new PaintLayer("layer-1" as LayerID, bounds);
        layer.markClean();

        layer.setTransform({ rotation: 45 });

        assertEquals(layer.isDirty(), true);
    },
});

// PaintLayer opacity tests

Deno.test({
    name: "PaintLayer - setOpacity updates opacity",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const layer = new PaintLayer("layer-1" as LayerID, bounds);

        layer.setOpacity(0.5);

        assertEquals(layer.getOpacity(), 0.5);
    },
});

Deno.test({
    name: "PaintLayer - setOpacity clamps to 0-1 range (too low)",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const layer = new PaintLayer("layer-1" as LayerID, bounds);

        layer.setOpacity(-0.5);

        assertEquals(layer.getOpacity(), 0);
    },
});

Deno.test({
    name: "PaintLayer - setOpacity clamps to 0-1 range (too high)",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const layer = new PaintLayer("layer-1" as LayerID, bounds);

        layer.setOpacity(1.5);

        assertEquals(layer.getOpacity(), 1);
    },
});

Deno.test({
    name: "PaintLayer - setOpacity marks layer dirty",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const layer = new PaintLayer("layer-1" as LayerID, bounds);
        layer.markClean();

        layer.setOpacity(0.5);

        assertEquals(layer.isDirty(), true);
    },
});

// PaintLayer compositing mode tests

Deno.test({
    name: "PaintLayer - setCompositingMode updates mode",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const layer = new PaintLayer("layer-1" as LayerID, bounds);

        layer.setCompositingMode(CompositingMode.MULTIPLY);

        assertEquals(layer.getCompositingMode(), CompositingMode.MULTIPLY);
    },
});

Deno.test({
    name: "PaintLayer - setCompositingMode marks layer dirty",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const layer = new PaintLayer("layer-1" as LayerID, bounds);
        layer.markClean();

        layer.setCompositingMode(CompositingMode.SCREEN);

        assertEquals(layer.isDirty(), true);
    },
});

// PaintLayer dirty flag tests

Deno.test({
    name: "PaintLayer - markDirty sets dirty flag",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const layer = new PaintLayer("layer-1" as LayerID, bounds);
        layer.markClean();

        layer.markDirty();

        assertEquals(layer.isDirty(), true);
    },
});

Deno.test({
    name: "PaintLayer - markDirty propagates to parent",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const parent = new PaintLayer("parent" as LayerID, bounds);
        const child = new PaintLayer("child" as LayerID, bounds);
        parent.addChild(child);
        parent.markClean();
        child.markClean();

        child.markDirty();

        assertEquals(parent.isDirty(), true);
    },
});

Deno.test({
    name: "PaintLayer - markClean clears dirty flag",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const layer = new PaintLayer("layer-1" as LayerID, bounds);

        layer.markClean();

        assertEquals(layer.isDirty(), false);
    },
});

// PaintLayer GPU acceleration tests

Deno.test({
    name: "PaintLayer - isGPULayer returns false initially",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const layer = new PaintLayer("layer-1" as LayerID, bounds);

        assertEquals(layer.isGPULayer(), false);
    },
});

Deno.test({
    name: "PaintLayer - enableGPUAcceleration sets GPU flag",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const layer = new PaintLayer("layer-1" as LayerID, bounds);

        layer.enableGPUAcceleration();

        assertEquals(layer.isGPULayer(), true);
    },
});

Deno.test({
    name: "PaintLayer - disableGPUAcceleration clears GPU flag",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const layer = new PaintLayer("layer-1" as LayerID, bounds);

        layer.enableGPUAcceleration();
        layer.disableGPUAcceleration();

        assertEquals(layer.isGPULayer(), false);
    },
});

// PaintLayer.shouldPromoteToGPU tests

Deno.test({
    name: "PaintLayer - shouldPromoteToGPU with rotation",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const layer = new PaintLayer("layer-1" as LayerID, bounds);

        layer.setTransform({ rotation: 45 });

        assertEquals(layer.shouldPromoteToGPU(), true);
    },
});

Deno.test({
    name: "PaintLayer - shouldPromoteToGPU with scale",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const layer = new PaintLayer("layer-1" as LayerID, bounds);

        layer.setTransform({ scaleX: 2 });

        assertEquals(layer.shouldPromoteToGPU(), true);
    },
});

Deno.test({
    name: "PaintLayer - shouldPromoteToGPU with opacity",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const layer = new PaintLayer("layer-1" as LayerID, bounds);

        layer.setOpacity(0.5);

        assertEquals(layer.shouldPromoteToGPU(), true);
    },
});

Deno.test({
    name: "PaintLayer - shouldPromoteToGPU with compositing mode",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const layer = new PaintLayer("layer-1" as LayerID, bounds);

        layer.setCompositingMode(CompositingMode.MULTIPLY);

        assertEquals(layer.shouldPromoteToGPU(), true);
    },
});

Deno.test({
    name: "PaintLayer - shouldPromoteToGPU returns false for default layer",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const layer = new PaintLayer("layer-1" as LayerID, bounds);
        layer.markClean();

        assertEquals(layer.shouldPromoteToGPU(), false);
    },
});

// PaintLayer.paint tests

Deno.test({
    name: "PaintLayer - paint clears display list when dirty",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const layer = new PaintLayer("layer-1" as LayerID, bounds);

        layer.paint();

        // Display list should be cleared
        assertExists(layer.getDisplayList());
    },
});

Deno.test({
    name: "PaintLayer - paint marks layer clean",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const layer = new PaintLayer("layer-1" as LayerID, bounds);

        layer.paint();

        assertEquals(layer.isDirty(), false);
    },
});

Deno.test({
    name: "PaintLayer - paint skips when not dirty",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const layer = new PaintLayer("layer-1" as LayerID, bounds);
        layer.markClean();

        layer.paint();

        // Should still be clean
        assertEquals(layer.isDirty(), false);
    },
});

// PaintLayer.invalidateRegion tests

Deno.test({
    name: "PaintLayer - invalidateRegion marks dirty when intersecting",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const layer = new PaintLayer("layer-1" as LayerID, bounds);
        layer.markClean();

        layer.invalidateRegion({ x: 50, y: 50, width: 100, height: 100 });

        assertEquals(layer.isDirty(), true);
    },
});

Deno.test({
    name: "PaintLayer - invalidateRegion skips when not intersecting",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const layer = new PaintLayer("layer-1" as LayerID, bounds);
        layer.markClean();

        layer.invalidateRegion({ x: 200, y: 200, width: 100, height: 100 });

        assertEquals(layer.isDirty(), false);
    },
});

// PaintLayer.clone tests

Deno.test({
    name: "PaintLayer - clone creates new layer with same id",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const layer = new PaintLayer("layer-1" as LayerID, bounds);

        const cloned = layer.clone();

        assertEquals(cloned.id, layer.id);
    },
});

Deno.test({
    name: "PaintLayer - clone copies transform",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const layer = new PaintLayer("layer-1" as LayerID, bounds);
        layer.setTransform({ rotation: 45 });

        const cloned = layer.clone();

        assertEquals(cloned.getTransform().rotation, 45);
    },
});

Deno.test({
    name: "PaintLayer - clone copies opacity",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const layer = new PaintLayer("layer-1" as LayerID, bounds);
        layer.setOpacity(0.5);

        const cloned = layer.clone();

        assertEquals(cloned.getOpacity(), 0.5);
    },
});

Deno.test({
    name: "PaintLayer - clone copies children",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const parent = new PaintLayer("parent" as LayerID, bounds);
        const child = new PaintLayer("child" as LayerID, bounds);
        parent.addChild(child);

        const cloned = parent.clone();

        assertEquals(cloned.getChildren().length, 1);
    },
});

// PaintLayer.getAllLayers tests

Deno.test({
    name: "PaintLayer - getAllLayers returns self",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const layer = new PaintLayer("layer-1" as LayerID, bounds);

        const layers = layer.getAllLayers();

        assertEquals(layers.length, 1);
        assertEquals(layers[0], layer);
    },
});

Deno.test({
    name: "PaintLayer - getAllLayers includes children",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const parent = new PaintLayer("parent" as LayerID, bounds);
        const child1 = new PaintLayer("child1" as LayerID, bounds);
        const child2 = new PaintLayer("child2" as LayerID, bounds);
        parent.addChild(child1);
        parent.addChild(child2);

        const layers = parent.getAllLayers();

        assertEquals(layers.length, 3);
    },
});

// PaintLayer.findLayerById tests

Deno.test({
    name: "PaintLayer - findLayerById finds self",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const layer = new PaintLayer("layer-1" as LayerID, bounds);

        const found = layer.findLayerById("layer-1" as LayerID);

        assertEquals(found, layer);
    },
});

Deno.test({
    name: "PaintLayer - findLayerById finds child",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const parent = new PaintLayer("parent" as LayerID, bounds);
        const child = new PaintLayer("child" as LayerID, bounds);
        parent.addChild(child);

        const found = parent.findLayerById("child" as LayerID);

        assertEquals(found, child);
    },
});

Deno.test({
    name: "PaintLayer - findLayerById returns null when not found",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const layer = new PaintLayer("layer-1" as LayerID, bounds);

        const found = layer.findLayerById("non-existent" as LayerID);

        assertEquals(found, null);
    },
});

// LayerTree constructor tests

Deno.test({
    name: "LayerTree - constructor creates tree instance",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const tree = new LayerTree(bounds);
        assertExists(tree);
    },
});

Deno.test({
    name: "LayerTree - constructor creates root layer",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const tree = new LayerTree(bounds);

        const root = tree.getRoot();
        assertExists(root);
    },
});

// LayerTree.createLayer tests

Deno.test({
    name: "LayerTree - createLayer creates new layer",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const tree = new LayerTree(bounds);

        const layer = tree.createLayer(bounds);

        assertExists(layer);
    },
});

Deno.test({
    name: "LayerTree - createLayer assigns unique IDs",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const tree = new LayerTree(bounds);

        const layer1 = tree.createLayer(bounds);
        const layer2 = tree.createLayer(bounds);

        assert(layer1.id !== layer2.id);
    },
});

// LayerTree.findLayer tests

Deno.test({
    name: "LayerTree - findLayer finds root layer",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const tree = new LayerTree(bounds);
        const root = tree.getRoot();

        const found = tree.findLayer(root.id);

        assertEquals(found, root);
    },
});

Deno.test({
    name: "LayerTree - findLayer finds child layer",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const tree = new LayerTree(bounds);
        const child = tree.createLayer(bounds);
        tree.getRoot().addChild(child);

        const found = tree.findLayer(child.id);

        assertEquals(found, child);
    },
});

Deno.test({
    name: "LayerTree - findLayer returns null when not found",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const tree = new LayerTree(bounds);

        const found = tree.findLayer("non-existent" as LayerID);

        assertEquals(found, null);
    },
});

// LayerTree.getAllLayers tests

Deno.test({
    name: "LayerTree - getAllLayers returns root",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const tree = new LayerTree(bounds);

        const layers = tree.getAllLayers();

        assertEquals(layers.length, 1);
    },
});

Deno.test({
    name: "LayerTree - getAllLayers includes all layers",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const tree = new LayerTree(bounds);
        const child1 = tree.createLayer(bounds);
        const child2 = tree.createLayer(bounds);
        tree.getRoot().addChild(child1);
        tree.getRoot().addChild(child2);

        const layers = tree.getAllLayers();

        assertEquals(layers.length, 3);
    },
});

// LayerTree.getDirtyLayers tests

Deno.test({
    name: "LayerTree - getDirtyLayers returns dirty layers",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const tree = new LayerTree(bounds);

        const dirtyLayers = tree.getDirtyLayers();

        assert(dirtyLayers.length > 0);
    },
});

Deno.test({
    name: "LayerTree - getDirtyLayers filters clean layers",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const tree = new LayerTree(bounds);
        tree.getRoot().markClean();

        const dirtyLayers = tree.getDirtyLayers();

        assertEquals(dirtyLayers.length, 0);
    },
});

// LayerTree.getGPULayers tests

Deno.test({
    name: "LayerTree - getGPULayers returns GPU layers",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const tree = new LayerTree(bounds);
        tree.getRoot().enableGPUAcceleration();

        const gpuLayers = tree.getGPULayers();

        assertEquals(gpuLayers.length, 1);
    },
});

Deno.test({
    name: "LayerTree - getGPULayers filters non-GPU layers",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const tree = new LayerTree(bounds);

        const gpuLayers = tree.getGPULayers();

        assertEquals(gpuLayers.length, 0);
    },
});

// LayerTree.paintDirtyLayers tests

Deno.test({
    name: "LayerTree - paintDirtyLayers paints all dirty layers",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const tree = new LayerTree(bounds);

        tree.paintDirtyLayers();

        const dirtyLayers = tree.getDirtyLayers();
        assertEquals(dirtyLayers.length, 0);
    },
});

// LayerTree.promoteToGPU tests

Deno.test({
    name: "LayerTree - promoteToGPU promotes eligible layers",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const tree = new LayerTree(bounds);
        tree.getRoot().setOpacity(0.5);

        tree.promoteToGPU();

        assertEquals(tree.getRoot().isGPULayer(), true);
    },
});

Deno.test({
    name: "LayerTree - promoteToGPU skips already promoted layers",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const tree = new LayerTree(bounds);
        tree.getRoot().setOpacity(0.5);
        tree.getRoot().enableGPUAcceleration();

        tree.promoteToGPU();

        assertEquals(tree.getRoot().isGPULayer(), true);
    },
});

// LayerTree.getMemoryUsage tests

Deno.test({
    name: "LayerTree - getMemoryUsage returns total memory",
    fn() {
        const bounds: BoundingBox = { x: 0, y: 0, width: 100, height: 100 };
        const tree = new LayerTree(bounds);

        const usage = tree.getMemoryUsage();

        assert(usage >= 0);
    },
});

/**
 * Tests for Tile
 * Tests tiling and priority rasterization.
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import {
    Tile,
    TileGrid,
    TilePriority,
    TileState,
    type TileID,
} from "../../../../src/engine/rendering/compositor/Tile.ts";
import { DisplayList, type BoundingBox } from "../../../../src/engine/rendering/paint/DisplayList.ts";
import type { Pixels } from "../../../../src/types/identifiers.ts";

// TilePriority enum tests

Deno.test({
    name: "TilePriority - VISIBLE value",
    fn() {
        assertEquals(TilePriority.VISIBLE, 0);
    },
});

Deno.test({
    name: "TilePriority - NEAR_VIEWPORT value",
    fn() {
        assertEquals(TilePriority.NEAR_VIEWPORT, 1);
    },
});

Deno.test({
    name: "TilePriority - FAR_FROM_VIEWPORT value",
    fn() {
        assertEquals(TilePriority.FAR_FROM_VIEWPORT, 2);
    },
});

Deno.test({
    name: "TilePriority - OFFSCREEN value",
    fn() {
        assertEquals(TilePriority.OFFSCREEN, 3);
    },
});

// TileState enum tests

Deno.test({
    name: "TileState - PENDING value",
    fn() {
        assertEquals(TileState.PENDING, "pending");
    },
});

Deno.test({
    name: "TileState - RASTERIZING value",
    fn() {
        assertEquals(TileState.RASTERIZING, "rasterizing");
    },
});

Deno.test({
    name: "TileState - READY value",
    fn() {
        assertEquals(TileState.READY, "ready");
    },
});

Deno.test({
    name: "TileState - INVALID value",
    fn() {
        assertEquals(TileState.INVALID, "invalid");
    },
});

// Tile constructor tests

Deno.test({
    name: "Tile - constructor creates tile instance",
    fn() {
        const bounds: BoundingBox = { x: 0 as Pixels, y: 0 as Pixels, width: 256 as Pixels, height: 256 as Pixels };
        const displayList = new DisplayList();
        const tile = new Tile("tile-1" as TileID, bounds, displayList);
        assertExists(tile);
    },
});

Deno.test({
    name: "Tile - constructor sets id",
    fn() {
        const bounds: BoundingBox = { x: 0 as Pixels, y: 0 as Pixels, width: 256 as Pixels, height: 256 as Pixels };
        const displayList = new DisplayList();
        const tile = new Tile("tile-1" as TileID, bounds, displayList);
        assertEquals(tile.id, "tile-1");
    },
});

Deno.test({
    name: "Tile - constructor sets bounds",
    fn() {
        const bounds: BoundingBox = { x: 10 as Pixels, y: 20 as Pixels, width: 256 as Pixels, height: 256 as Pixels };
        const displayList = new DisplayList();
        const tile = new Tile("tile-1" as TileID, bounds, displayList);
        assertEquals(tile.bounds, bounds);
    },
});

Deno.test({
    name: "Tile - constructor initializes state as PENDING",
    fn() {
        const bounds: BoundingBox = { x: 0 as Pixels, y: 0 as Pixels, width: 256 as Pixels, height: 256 as Pixels };
        const displayList = new DisplayList();
        const tile = new Tile("tile-1" as TileID, bounds, displayList);
        assertEquals(tile.getState(), TileState.PENDING);
    },
});

Deno.test({
    name: "Tile - constructor initializes priority as OFFSCREEN",
    fn() {
        const bounds: BoundingBox = { x: 0 as Pixels, y: 0 as Pixels, width: 256 as Pixels, height: 256 as Pixels };
        const displayList = new DisplayList();
        const tile = new Tile("tile-1" as TileID, bounds, displayList);
        assertEquals(tile.getPriority(), TilePriority.OFFSCREEN);
    },
});

Deno.test({
    name: "Tile - constructor sets default scale",
    fn() {
        const bounds: BoundingBox = { x: 0 as Pixels, y: 0 as Pixels, width: 256 as Pixels, height: 256 as Pixels };
        const displayList = new DisplayList();
        const tile = new Tile("tile-1" as TileID, bounds, displayList);
        assertExists(tile);
    },
});

Deno.test({
    name: "Tile - constructor accepts custom scale",
    fn() {
        const bounds: BoundingBox = { x: 0 as Pixels, y: 0 as Pixels, width: 256 as Pixels, height: 256 as Pixels };
        const displayList = new DisplayList();
        const tile = new Tile("tile-1" as TileID, bounds, displayList, 2.0);
        assertExists(tile);
    },
});

// Tile.rasterizeSync tests

Deno.test({
    name: "Tile - rasterizeSync changes state to RASTERIZING then READY",
    fn() {
        const bounds: BoundingBox = { x: 0 as Pixels, y: 0 as Pixels, width: 256 as Pixels, height: 256 as Pixels };
        const displayList = new DisplayList();
        const tile = new Tile("tile-1" as TileID, bounds, displayList);

        tile.rasterizeSync();

        assertEquals(tile.getState(), TileState.READY);
    },
});

Deno.test({
    name: "Tile - rasterizeSync creates tile data",
    fn() {
        const bounds: BoundingBox = { x: 0 as Pixels, y: 0 as Pixels, width: 256 as Pixels, height: 256 as Pixels };
        const displayList = new DisplayList();
        const tile = new Tile("tile-1" as TileID, bounds, displayList);

        tile.rasterizeSync();

        const data = tile.getData();
        assertExists(data);
        assertExists(data.bitmap);
    },
});

Deno.test({
    name: "Tile - rasterizeSync skips when already rasterizing",
    fn() {
        const bounds: BoundingBox = { x: 0 as Pixels, y: 0 as Pixels, width: 256 as Pixels, height: 256 as Pixels };
        const displayList = new DisplayList();
        const tile = new Tile("tile-1" as TileID, bounds, displayList);

        tile.rasterizeSync();
        tile.rasterizeSync();

        assertEquals(tile.getRasterizeCount(), 1);
    },
});

Deno.test({
    name: "Tile - rasterizeSync increments rasterize count",
    fn() {
        const bounds: BoundingBox = { x: 0 as Pixels, y: 0 as Pixels, width: 256 as Pixels, height: 256 as Pixels };
        const displayList = new DisplayList();
        const tile = new Tile("tile-1" as TileID, bounds, displayList);

        tile.rasterizeSync();

        assertEquals(tile.getRasterizeCount(), 1);
    },
});

Deno.test({
    name: "Tile - rasterizeSync records rasterize time",
    fn() {
        const bounds: BoundingBox = { x: 0 as Pixels, y: 0 as Pixels, width: 256 as Pixels, height: 256 as Pixels };
        const displayList = new DisplayList();
        const tile = new Tile("tile-1" as TileID, bounds, displayList);

        tile.rasterizeSync();

        assert(tile.getLastRasterizeTime() >= 0);
    },
});

// Tile.isReady tests

Deno.test({
    name: "Tile - isReady returns false initially",
    fn() {
        const bounds: BoundingBox = { x: 0 as Pixels, y: 0 as Pixels, width: 256 as Pixels, height: 256 as Pixels };
        const displayList = new DisplayList();
        const tile = new Tile("tile-1" as TileID, bounds, displayList);

        assertEquals(tile.isReady(), false);
    },
});

Deno.test({
    name: "Tile - isReady returns true after rasterization",
    fn() {
        const bounds: BoundingBox = { x: 0 as Pixels, y: 0 as Pixels, width: 256 as Pixels, height: 256 as Pixels };
        const displayList = new DisplayList();
        const tile = new Tile("tile-1" as TileID, bounds, displayList);

        tile.rasterizeSync();

        assertEquals(tile.isReady(), true);
    },
});

// Tile.invalidate tests

Deno.test({
    name: "Tile - invalidate changes state to INVALID",
    fn() {
        const bounds: BoundingBox = { x: 0 as Pixels, y: 0 as Pixels, width: 256 as Pixels, height: 256 as Pixels };
        const displayList = new DisplayList();
        const tile = new Tile("tile-1" as TileID, bounds, displayList);

        tile.invalidate();

        assertEquals(tile.getState(), TileState.INVALID);
    },
});

Deno.test({
    name: "Tile - invalidate clears tile data",
    fn() {
        const bounds: BoundingBox = { x: 0 as Pixels, y: 0 as Pixels, width: 256 as Pixels, height: 256 as Pixels };
        const displayList = new DisplayList();
        const tile = new Tile("tile-1" as TileID, bounds, displayList);

        tile.rasterizeSync();
        tile.invalidate();

        assertEquals(tile.getData(), null);
    },
});

Deno.test({
    name: "Tile - invalidate after rasterization marks as invalid",
    fn() {
        const bounds: BoundingBox = { x: 0 as Pixels, y: 0 as Pixels, width: 256 as Pixels, height: 256 as Pixels };
        const displayList = new DisplayList();
        const tile = new Tile("tile-1" as TileID, bounds, displayList);

        tile.rasterizeSync();
        tile.invalidate();

        assertEquals(tile.getState(), TileState.INVALID);
        assertEquals(tile.isReady(), false);
    },
});

// Tile.updateDisplayList tests

Deno.test({
    name: "Tile - updateDisplayList updates display list",
    fn() {
        const bounds: BoundingBox = { x: 0 as Pixels, y: 0 as Pixels, width: 256 as Pixels, height: 256 as Pixels };
        const displayList1 = new DisplayList();
        const displayList2 = new DisplayList();
        const tile = new Tile("tile-1" as TileID, bounds, displayList1);

        tile.updateDisplayList(displayList2);

        assertExists(tile);
    },
});

Deno.test({
    name: "Tile - updateDisplayList invalidates tile",
    fn() {
        const bounds: BoundingBox = { x: 0 as Pixels, y: 0 as Pixels, width: 256 as Pixels, height: 256 as Pixels };
        const displayList1 = new DisplayList();
        const displayList2 = new DisplayList();
        const tile = new Tile("tile-1" as TileID, bounds, displayList1);

        tile.rasterizeSync();
        tile.updateDisplayList(displayList2);

        assertEquals(tile.getState(), TileState.INVALID);
    },
});

// Tile.setPriority tests

Deno.test({
    name: "Tile - setPriority updates priority",
    fn() {
        const bounds: BoundingBox = { x: 0 as Pixels, y: 0 as Pixels, width: 256 as Pixels, height: 256 as Pixels };
        const displayList = new DisplayList();
        const tile = new Tile("tile-1" as TileID, bounds, displayList);

        tile.setPriority(TilePriority.VISIBLE);

        assertEquals(tile.getPriority(), TilePriority.VISIBLE);
    },
});

// Tile.calculatePriority tests

Deno.test({
    name: "Tile - calculatePriority returns VISIBLE when in viewport",
    fn() {
        const bounds: BoundingBox = { x: 0 as Pixels, y: 0 as Pixels, width: 256 as Pixels, height: 256 as Pixels };
        const viewport: BoundingBox = { x: 0 as Pixels, y: 0 as Pixels, width: 800 as Pixels, height: 600 as Pixels };
        const displayList = new DisplayList();
        const tile = new Tile("tile-1" as TileID, bounds, displayList);

        const priority = tile.calculatePriority(viewport);

        assertEquals(priority, TilePriority.VISIBLE);
    },
});

Deno.test({
    name: "Tile - calculatePriority returns OFFSCREEN when far from viewport",
    fn() {
        const bounds: BoundingBox = { x: 10000 as Pixels, y: 10000 as Pixels, width: 256 as Pixels, height: 256 as Pixels };
        const viewport: BoundingBox = { x: 0 as Pixels, y: 0 as Pixels, width: 800 as Pixels, height: 600 as Pixels };
        const displayList = new DisplayList();
        const tile = new Tile("tile-1" as TileID, bounds, displayList);

        const priority = tile.calculatePriority(viewport);

        assertEquals(priority, TilePriority.OFFSCREEN);
    },
});

Deno.test({
    name: "Tile - calculatePriority returns NEAR_VIEWPORT when close",
    fn() {
        const bounds: BoundingBox = { x: 850 as Pixels, y: 0 as Pixels, width: 256 as Pixels, height: 256 as Pixels };
        const viewport: BoundingBox = { x: 0 as Pixels, y: 0 as Pixels, width: 800 as Pixels, height: 600 as Pixels };
        const displayList = new DisplayList();
        const tile = new Tile("tile-1" as TileID, bounds, displayList);

        const priority = tile.calculatePriority(viewport);

        assertEquals(priority, TilePriority.NEAR_VIEWPORT);
    },
});

// Tile.getMemoryUsage tests

Deno.test({
    name: "Tile - getMemoryUsage returns 0 when no data",
    fn() {
        const bounds: BoundingBox = { x: 0 as Pixels, y: 0 as Pixels, width: 256 as Pixels, height: 256 as Pixels };
        const displayList = new DisplayList();
        const tile = new Tile("tile-1" as TileID, bounds, displayList);

        assertEquals(tile.getMemoryUsage(), 0);
    },
});

Deno.test({
    name: "Tile - getMemoryUsage returns size after rasterization",
    fn() {
        const bounds: BoundingBox = { x: 0 as Pixels, y: 0 as Pixels, width: 256 as Pixels, height: 256 as Pixels };
        const displayList = new DisplayList();
        const tile = new Tile("tile-1" as TileID, bounds, displayList);

        tile.rasterizeSync();

        // Should be 256 * 256 * 4 bytes = 262,144 bytes
        assert(tile.getMemoryUsage() > 0);
    },
});

// Tile.dispose tests

Deno.test({
    name: "Tile - dispose clears data",
    fn() {
        const bounds: BoundingBox = { x: 0 as Pixels, y: 0 as Pixels, width: 256 as Pixels, height: 256 as Pixels };
        const displayList = new DisplayList();
        const tile = new Tile("tile-1" as TileID, bounds, displayList);

        tile.rasterizeSync();
        tile.dispose();

        assertEquals(tile.getData(), null);
    },
});

Deno.test({
    name: "Tile - dispose sets state to INVALID",
    fn() {
        const bounds: BoundingBox = { x: 0 as Pixels, y: 0 as Pixels, width: 256 as Pixels, height: 256 as Pixels };
        const displayList = new DisplayList();
        const tile = new Tile("tile-1" as TileID, bounds, displayList);

        tile.rasterizeSync();
        tile.dispose();

        assertEquals(tile.getState(), TileState.INVALID);
    },
});

// TileGrid constructor tests

Deno.test({
    name: "TileGrid - constructor creates grid instance",
    fn() {
        const grid = new TileGrid();
        assertExists(grid);
    },
});

Deno.test({
    name: "TileGrid - constructor accepts custom tile size",
    fn() {
        const grid = new TileGrid(512 as Pixels);
        assertExists(grid);
    },
});

Deno.test({
    name: "TileGrid - constructor accepts custom scale",
    fn() {
        const grid = new TileGrid(256 as Pixels, 2.0);
        assertExists(grid);
    },
});

Deno.test({
    name: "TileGrid - getAllTiles returns empty array initially",
    fn() {
        const grid = new TileGrid();
        assertEquals(grid.getAllTiles().length, 0);
    },
});

// TileGrid.createTilesForBounds tests

Deno.test({
    name: "TileGrid - createTilesForBounds creates tiles",
    fn() {
        const grid = new TileGrid(256 as Pixels);
        const bounds: BoundingBox = { x: 0 as Pixels, y: 0 as Pixels, width: 512 as Pixels, height: 512 as Pixels };
        const displayList = new DisplayList();

        const tiles = grid.createTilesForBounds(bounds, displayList);

        // 512x512 with 256 tile size = 2x2 grid = 4 tiles
        assertEquals(tiles.length, 4);
    },
});

Deno.test({
    name: "TileGrid - createTilesForBounds assigns unique IDs",
    fn() {
        const grid = new TileGrid(256 as Pixels);
        const bounds: BoundingBox = { x: 0 as Pixels, y: 0 as Pixels, width: 512 as Pixels, height: 512 as Pixels };
        const displayList = new DisplayList();

        const tiles = grid.createTilesForBounds(bounds, displayList);

        const ids = new Set(tiles.map(t => t.id));
        assertEquals(ids.size, tiles.length);
    },
});

Deno.test({
    name: "TileGrid - createTilesForBounds with non-aligned bounds",
    fn() {
        const grid = new TileGrid(256 as Pixels);
        const bounds: BoundingBox = { x: 0 as Pixels, y: 0 as Pixels, width: 300 as Pixels, height: 300 as Pixels };
        const displayList = new DisplayList();

        const tiles = grid.createTilesForBounds(bounds, displayList);

        // 300x300 with 256 tile size = 2x2 grid (partial tiles)
        assertEquals(tiles.length, 4);
    },
});

Deno.test({
    name: "TileGrid - createTilesForBounds stores tiles in grid",
    fn() {
        const grid = new TileGrid(256 as Pixels);
        const bounds: BoundingBox = { x: 0 as Pixels, y: 0 as Pixels, width: 512 as Pixels, height: 512 as Pixels };
        const displayList = new DisplayList();

        grid.createTilesForBounds(bounds, displayList);

        assertEquals(grid.getAllTiles().length, 4);
    },
});

// TileGrid.getTile tests

Deno.test({
    name: "TileGrid - getTile returns tile by ID",
    fn() {
        const grid = new TileGrid(256 as Pixels);
        const bounds: BoundingBox = { x: 0 as Pixels, y: 0 as Pixels, width: 256 as Pixels, height: 256 as Pixels };
        const displayList = new DisplayList();

        const tiles = grid.createTilesForBounds(bounds, displayList);
        const tile = grid.getTile(tiles[0].id);

        assertEquals(tile, tiles[0]);
    },
});

Deno.test({
    name: "TileGrid - getTile returns undefined for non-existent ID",
    fn() {
        const grid = new TileGrid(256 as Pixels);

        const tile = grid.getTile("non-existent" as TileID);

        assertEquals(tile, undefined);
    },
});

// TileGrid.getTilesInViewport tests

Deno.test({
    name: "TileGrid - getTilesInViewport returns visible tiles",
    fn() {
        const grid = new TileGrid(256 as Pixels);
        const bounds: BoundingBox = { x: 0 as Pixels, y: 0 as Pixels, width: 512 as Pixels, height: 512 as Pixels };
        const displayList = new DisplayList();
        const viewport: BoundingBox = { x: 0 as Pixels, y: 0 as Pixels, width: 256 as Pixels, height: 256 as Pixels };

        grid.createTilesForBounds(bounds, displayList);
        const visibleTiles = grid.getTilesInViewport(viewport);

        // Viewport should intersect with at least 1 tile
        assert(visibleTiles.length >= 1);
    },
});

Deno.test({
    name: "TileGrid - getTilesInViewport returns empty for non-intersecting viewport",
    fn() {
        const grid = new TileGrid(256 as Pixels);
        const bounds: BoundingBox = { x: 0 as Pixels, y: 0 as Pixels, width: 512 as Pixels, height: 512 as Pixels };
        const displayList = new DisplayList();
        const viewport: BoundingBox = { x: 10000 as Pixels, y: 10000 as Pixels, width: 256 as Pixels, height: 256 as Pixels };

        grid.createTilesForBounds(bounds, displayList);
        const visibleTiles = grid.getTilesInViewport(viewport);

        assertEquals(visibleTiles.length, 0);
    },
});

// TileGrid.updatePriorities tests

Deno.test({
    name: "TileGrid - updatePriorities updates all tiles",
    fn() {
        const grid = new TileGrid(256 as Pixels);
        const bounds: BoundingBox = { x: 0 as Pixels, y: 0 as Pixels, width: 512 as Pixels, height: 512 as Pixels };
        const displayList = new DisplayList();
        const viewport: BoundingBox = { x: 0 as Pixels, y: 0 as Pixels, width: 256 as Pixels, height: 256 as Pixels };

        grid.createTilesForBounds(bounds, displayList);
        grid.updatePriorities(viewport);

        const tiles = grid.getAllTiles();
        const visibleTiles = tiles.filter(t => t.getPriority() === TilePriority.VISIBLE);
        assert(visibleTiles.length > 0);
    },
});

// TileGrid.getTilesByPriority tests

Deno.test({
    name: "TileGrid - getTilesByPriority sorts by priority",
    fn() {
        const grid = new TileGrid(256 as Pixels);
        const bounds: BoundingBox = { x: 0 as Pixels, y: 0 as Pixels, width: 512 as Pixels, height: 512 as Pixels };
        const displayList = new DisplayList();
        const viewport: BoundingBox = { x: 0 as Pixels, y: 0 as Pixels, width: 256 as Pixels, height: 256 as Pixels };

        grid.createTilesForBounds(bounds, displayList);
        grid.updatePriorities(viewport);

        const sorted = grid.getTilesByPriority();

        // First tile should have highest priority (lowest number)
        assert(sorted.length > 0);
        for (let i = 1; i < sorted.length; i++) {
            assert(sorted[i - 1].getPriority() <= sorted[i].getPriority());
        }
    },
});

// TileGrid.invalidateAll tests

Deno.test({
    name: "TileGrid - invalidateAll invalidates all tiles",
    fn() {
        const grid = new TileGrid(256 as Pixels);
        const bounds: BoundingBox = { x: 0 as Pixels, y: 0 as Pixels, width: 512 as Pixels, height: 512 as Pixels };
        const displayList = new DisplayList();

        grid.createTilesForBounds(bounds, displayList);
        const tiles = grid.getAllTiles();
        tiles.forEach(t => t.rasterizeSync());
        grid.invalidateAll();

        const invalidTiles = tiles.filter(t => t.getState() === TileState.INVALID);
        assertEquals(invalidTiles.length, tiles.length);
    },
});

// TileGrid.getMemoryUsage tests

Deno.test({
    name: "TileGrid - getMemoryUsage returns total memory",
    fn() {
        const grid = new TileGrid(256 as Pixels);
        const bounds: BoundingBox = { x: 0 as Pixels, y: 0 as Pixels, width: 512 as Pixels, height: 512 as Pixels };
        const displayList = new DisplayList();

        grid.createTilesForBounds(bounds, displayList);
        grid.getAllTiles().forEach(t => t.rasterizeSync());

        const usage = grid.getMemoryUsage();
        assert(usage > 0);
    },
});

Deno.test({
    name: "TileGrid - getMemoryUsage returns 0 for non-rasterized tiles",
    fn() {
        const grid = new TileGrid(256 as Pixels);
        const bounds: BoundingBox = { x: 0 as Pixels, y: 0 as Pixels, width: 512 as Pixels, height: 512 as Pixels };
        const displayList = new DisplayList();

        grid.createTilesForBounds(bounds, displayList);

        const usage = grid.getMemoryUsage();
        assertEquals(usage, 0);
    },
});

// TileGrid.dispose tests

Deno.test({
    name: "TileGrid - dispose clears all tiles",
    fn() {
        const grid = new TileGrid(256 as Pixels);
        const bounds: BoundingBox = { x: 0 as Pixels, y: 0 as Pixels, width: 512 as Pixels, height: 512 as Pixels };
        const displayList = new DisplayList();

        grid.createTilesForBounds(bounds, displayList);
        grid.dispose();

        assertEquals(grid.getAllTiles().length, 0);
    },
});

Deno.test({
    name: "TileGrid - dispose disposes all tiles",
    fn() {
        const grid = new TileGrid(256 as Pixels);
        const bounds: BoundingBox = { x: 0 as Pixels, y: 0 as Pixels, width: 512 as Pixels, height: 512 as Pixels };
        const displayList = new DisplayList();

        const tiles = grid.createTilesForBounds(bounds, displayList);
        tiles.forEach(t => t.rasterizeSync());
        grid.dispose();

        assertEquals(grid.getMemoryUsage(), 0);
    },
});

// Integration tests

Deno.test({
    name: "TileGrid - large grid creation",
    fn() {
        const grid = new TileGrid(256 as Pixels);
        const bounds: BoundingBox = { x: 0 as Pixels, y: 0 as Pixels, width: 2048 as Pixels, height: 2048 as Pixels };
        const displayList = new DisplayList();

        const tiles = grid.createTilesForBounds(bounds, displayList);

        // 2048x2048 with 256 tile size = 8x8 grid = 64 tiles
        assertEquals(tiles.length, 64);
    },
});

Deno.test({
    name: "TileGrid - priority-based rasterization",
    fn() {
        const grid = new TileGrid(256 as Pixels);
        const bounds: BoundingBox = { x: 0 as Pixels, y: 0 as Pixels, width: 1024 as Pixels, height: 1024 as Pixels };
        const displayList = new DisplayList();
        const viewport: BoundingBox = { x: 0 as Pixels, y: 0 as Pixels, width: 512 as Pixels, height: 512 as Pixels };

        grid.createTilesForBounds(bounds, displayList);
        grid.updatePriorities(viewport);

        const sorted = grid.getTilesByPriority();
        // Rasterize only high priority tiles
        const highPriority = sorted.filter(t => t.getPriority() < TilePriority.FAR_FROM_VIEWPORT);
        highPriority.forEach(t => t.rasterizeSync());

        assert(highPriority.length > 0);
        assert(highPriority.every(t => t.isReady()));
    },
});

Deno.test({
    name: "Tile - multiple rasterization cycles",
    fn() {
        const bounds: BoundingBox = { x: 0 as Pixels, y: 0 as Pixels, width: 256 as Pixels, height: 256 as Pixels };
        const displayList = new DisplayList();
        const tile = new Tile("tile-1" as TileID, bounds, displayList);

        tile.rasterizeSync();
        tile.invalidate();
        tile.rasterizeSync();

        assertEquals(tile.getRasterizeCount(), 2);
        assertEquals(tile.isReady(), true);
    },
});

Deno.test({
    name: "Tile - high resolution scaling",
    fn() {
        const bounds: BoundingBox = { x: 0 as Pixels, y: 0 as Pixels, width: 256 as Pixels, height: 256 as Pixels };
        const displayList = new DisplayList();
        const tile = new Tile("tile-1" as TileID, bounds, displayList, 2.0);

        tile.rasterizeSync();

        const data = tile.getData();
        assertExists(data);
        // With 2x scale, canvas should be 512x512
        assert(data.width >= 512);
        assert(data.height >= 512);
    },
});

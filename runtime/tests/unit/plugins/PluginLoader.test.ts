/**
 * PluginLoader Unit Tests
 *
 * Tests for plugin loading from filesystem paths, manifest validation,
 * module extraction, and directory scanning.
 */

import {
  assertEquals,
  assertExists,
} from "@std/assert";
import { PluginLoader } from "../../../src/plugins/PluginLoader.ts";

// ============================================================================
// Module Resolution Tests
// ============================================================================

Deno.test("PluginLoader - instantiation", () => {
  const loader = new PluginLoader();
  assertExists(loader);
});

Deno.test("PluginLoader - load returns error for nonexistent path", async () => {
  const loader = new PluginLoader();
  const result = await loader.load("/nonexistent/path/plugin.ts");

  assertEquals(result.success, false);
  assertExists(result.error);
  assertEquals(result.path, "/nonexistent/path/plugin.ts");
});

Deno.test("PluginLoader - load returns error for invalid module", async () => {
  // Create a temporary file that doesn't export a valid Plugin
  const tempDir = await Deno.makeTempDir();
  const tempFile = `${tempDir}/bad-plugin.ts`;
  await Deno.writeTextFile(tempFile, `export const foo = "bar";`);

  const loader = new PluginLoader();
  const result = await loader.load(tempFile);

  assertEquals(result.success, false);
  assertExists(result.error);
  assertEquals(result.error.message.includes("does not export a valid Plugin"), true);

  // Cleanup
  await Deno.remove(tempDir, { recursive: true });
});

Deno.test("PluginLoader - load succeeds with valid default export class", async () => {
  const tempDir = await Deno.makeTempDir();
  const tempFile = `${tempDir}/good-plugin.ts`;
  await Deno.writeTextFile(tempFile, `
export default class TestPlugin {
  id = "test-loader-plugin";
  name = "Test Loader Plugin";
  version = "1.0.0";

  async activate() {}
  async deactivate() {}
}
`);

  const loader = new PluginLoader();
  const result = await loader.load(tempFile);

  assertEquals(result.success, true);
  assertExists(result.plugin);
  assertEquals(result.plugin.id, "test-loader-plugin");
  assertEquals(result.plugin.name, "Test Loader Plugin");
  assertEquals(result.plugin.version, "1.0.0");

  // Cleanup
  await Deno.remove(tempDir, { recursive: true });
});

Deno.test("PluginLoader - load succeeds with valid default export instance", async () => {
  const tempDir = await Deno.makeTempDir();
  const tempFile = `${tempDir}/instance-plugin.ts`;
  await Deno.writeTextFile(tempFile, `
export default {
  id: "instance-plugin",
  name: "Instance Plugin",
  version: "2.0.0",
  activate: async () => {},
  deactivate: async () => {},
};
`);

  const loader = new PluginLoader();
  const result = await loader.load(tempFile);

  assertEquals(result.success, true);
  assertExists(result.plugin);
  assertEquals(result.plugin.id, "instance-plugin");
  assertEquals(result.plugin.version, "2.0.0");

  // Cleanup
  await Deno.remove(tempDir, { recursive: true });
});

Deno.test("PluginLoader - load succeeds with named 'plugin' export", async () => {
  const tempDir = await Deno.makeTempDir();
  const tempFile = `${tempDir}/named-plugin.ts`;
  await Deno.writeTextFile(tempFile, `
export const plugin = {
  id: "named-plugin",
  name: "Named Plugin",
  version: "3.0.0",
  activate: async () => {},
  deactivate: async () => {},
};
`);

  const loader = new PluginLoader();
  const result = await loader.load(tempFile);

  assertEquals(result.success, true);
  assertExists(result.plugin);
  assertEquals(result.plugin.id, "named-plugin");

  // Cleanup
  await Deno.remove(tempDir, { recursive: true });
});

// ============================================================================
// Manifest Loading Tests
// ============================================================================

Deno.test("PluginLoader - loadManifest returns null for missing manifest", async () => {
  const tempDir = await Deno.makeTempDir();

  const loader = new PluginLoader();
  const manifest = await loader.loadManifest(tempDir);

  assertEquals(manifest, null);

  // Cleanup
  await Deno.remove(tempDir, { recursive: true });
});

Deno.test("PluginLoader - loadManifest reads plugin.json", async () => {
  const tempDir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${tempDir}/plugin.json`, JSON.stringify({
    id: "manifest-plugin",
    name: "Manifest Plugin",
    version: "1.0.0",
    main: "mod.ts",
    description: "A plugin with manifest",
  }));

  const loader = new PluginLoader();
  const manifest = await loader.loadManifest(tempDir);

  assertExists(manifest);
  assertEquals(manifest.id, "manifest-plugin");
  assertEquals(manifest.main, "mod.ts");

  // Cleanup
  await Deno.remove(tempDir, { recursive: true });
});

Deno.test("PluginLoader - loadManifest reads manifest.json as fallback", async () => {
  const tempDir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${tempDir}/manifest.json`, JSON.stringify({
    id: "fallback-plugin",
    name: "Fallback Plugin",
    version: "2.0.0",
    main: "index.ts",
  }));

  const loader = new PluginLoader();
  const manifest = await loader.loadManifest(tempDir);

  assertExists(manifest);
  assertEquals(manifest.id, "fallback-plugin");

  // Cleanup
  await Deno.remove(tempDir, { recursive: true });
});

Deno.test("PluginLoader - loadManifest rejects invalid manifest", async () => {
  const tempDir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${tempDir}/plugin.json`, JSON.stringify({
    name: "No ID Plugin",
    version: "1.0.0",
    main: "mod.ts",
    // Missing 'id' field
  }));

  const loader = new PluginLoader();
  const manifest = await loader.loadManifest(tempDir);

  // Should return null since the manifest is invalid
  assertEquals(manifest, null);

  // Cleanup
  await Deno.remove(tempDir, { recursive: true });
});

// ============================================================================
// Directory Scanning Tests
// ============================================================================

Deno.test("PluginLoader - scanDirectory returns empty for empty directory", async () => {
  const tempDir = await Deno.makeTempDir();

  const loader = new PluginLoader();
  const results = await loader.scanDirectory(tempDir);

  assertEquals(results.length, 0);

  // Cleanup
  await Deno.remove(tempDir, { recursive: true });
});

Deno.test("PluginLoader - scanDirectory finds plugins in subdirectories", async () => {
  const tempDir = await Deno.makeTempDir();
  const pluginDir = `${tempDir}/my-plugin`;
  await Deno.mkdir(pluginDir);
  await Deno.writeTextFile(`${pluginDir}/mod.ts`, `
export default class MyPlugin {
  id = "scanned-plugin";
  name = "Scanned Plugin";
  version = "1.0.0";
  async activate() {}
  async deactivate() {}
}
`);

  const loader = new PluginLoader();
  const results = await loader.scanDirectory(tempDir);

  assertEquals(results.length, 1);
  assertEquals(results[0].success, true);
  assertExists(results[0].plugin);
  assertEquals(results[0].plugin.id, "scanned-plugin");

  // Cleanup
  await Deno.remove(tempDir, { recursive: true });
});

Deno.test("PluginLoader - scanDirectory uses manifest main entry", async () => {
  const tempDir = await Deno.makeTempDir();
  const pluginDir = `${tempDir}/custom-entry`;
  await Deno.mkdir(pluginDir);

  await Deno.writeTextFile(`${pluginDir}/plugin.json`, JSON.stringify({
    id: "custom-entry-plugin",
    name: "Custom Entry Plugin",
    version: "1.0.0",
    main: "src/plugin.ts",
  }));

  await Deno.mkdir(`${pluginDir}/src`);
  await Deno.writeTextFile(`${pluginDir}/src/plugin.ts`, `
export default {
  id: "custom-entry-plugin",
  name: "Custom Entry Plugin",
  version: "1.0.0",
  activate: async () => {},
  deactivate: async () => {},
};
`);

  const loader = new PluginLoader();
  const results = await loader.scanDirectory(tempDir);

  assertEquals(results.length, 1);
  assertEquals(results[0].success, true);
  assertEquals(results[0].plugin?.id, "custom-entry-plugin");
  assertExists(results[0].manifest);
  assertEquals(results[0].manifest?.main, "src/plugin.ts");

  // Cleanup
  await Deno.remove(tempDir, { recursive: true });
});

Deno.test("PluginLoader - scanDirectory skips files (non-directories)", async () => {
  const tempDir = await Deno.makeTempDir();

  // Create a file (not a directory) in the scan path
  await Deno.writeTextFile(`${tempDir}/not-a-plugin.ts`, `export default {};`);

  const loader = new PluginLoader();
  const results = await loader.scanDirectory(tempDir);

  assertEquals(results.length, 0);

  // Cleanup
  await Deno.remove(tempDir, { recursive: true });
});

Deno.test("PluginLoader - scanDirectory handles nonexistent directory gracefully", async () => {
  const loader = new PluginLoader();
  const results = await loader.scanDirectory("/nonexistent/directory");

  assertEquals(results.length, 0);
});

// ============================================================================
// Plugin Validation Tests
// ============================================================================

Deno.test("PluginLoader - rejects plugin with empty id", async () => {
  const tempDir = await Deno.makeTempDir();
  const tempFile = `${tempDir}/empty-id.ts`;
  await Deno.writeTextFile(tempFile, `
export default {
  id: "",
  name: "No ID",
  version: "1.0.0",
  activate: async () => {},
  deactivate: async () => {},
};
`);

  const loader = new PluginLoader();
  const result = await loader.load(tempFile);

  assertEquals(result.success, false);
  assertExists(result.error);
  assertEquals(result.error.message.includes("non-empty string"), true);

  // Cleanup
  await Deno.remove(tempDir, { recursive: true });
});

Deno.test("PluginLoader - rejects plugin with missing activate", async () => {
  const tempDir = await Deno.makeTempDir();
  const tempFile = `${tempDir}/no-activate.ts`;
  await Deno.writeTextFile(tempFile, `
export default {
  id: "no-activate",
  name: "No Activate",
  version: "1.0.0",
  deactivate: async () => {},
};
`);

  const loader = new PluginLoader();
  const result = await loader.load(tempFile);

  assertEquals(result.success, false);
  assertExists(result.error);

  // Cleanup
  await Deno.remove(tempDir, { recursive: true });
});

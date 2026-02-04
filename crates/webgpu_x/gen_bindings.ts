#!/usr/bin/env -S deno run --allow-all

import { ensureDir } from "https://deno.land/std@0.132.0/fs/ensure_dir.ts";
import { codegen } from "https://deno.land/x/deno_bindgen@0.8.1/codegen.ts";

// Find the bindings.json file
const findBindingsJson = async () => {
  // Check both possible locations
  const locations = [
    "../target/release/build",
    "../../target/release/build",
  ];

  for (const base of locations) {
    try {
      for await (const entry of Deno.readDir(base)) {
        if (entry.isDirectory && entry.name.startsWith("webgpu_x-")) {
          const jsonPath = `${base}/${entry.name}/out/bindings.json`;
          try {
            await Deno.stat(jsonPath);
            return jsonPath;
          } catch {
            // Not in this directory, try next
          }
        }
      }
    } catch {
      // Directory doesn't exist, try next location
    }
  }
  throw new Error("bindings.json not found");
};

try {
  console.log("Finding bindings.json...");
  const bindingsPath = await findBindingsJson();
  console.log(`Found: ${bindingsPath}`);

  console.log("Reading bindings.json...");
  const conf = JSON.parse(await Deno.readTextFile(bindingsPath));
  console.log(`Package: ${conf.name}`);
  console.log(`Symbols: ${Object.keys(conf.symbols).length}`);
  console.log(`Types: ${Object.keys(conf.typeDefs || {}).length}`);

  console.log("Generating TypeScript bindings...");
  const fetchPrefix = "../../target/release";
  let source = "// Auto-generated with deno_bindgen\n// @ts-nocheck - generated FFI bindings have known type issues\n" + codegen(
    fetchPrefix,
    conf.name,
    conf.typeDefs,
    conf.tsTypes,
    conf.symbols,
    {
      le: conf.littleEndian,
      release: true,
      releaseURL: undefined,
    },
  );

  // Post-process to fix TypeScript issues with the generated code
  console.log("Post-processing bindings...");

  // Fix the libPaths object to include android and use proper typing
  source = source.replace(
    /const \{ symbols \} = Deno\.dlopen\(\s*\{([^}]+)\}\[Deno\.build\.os\],/,
    `const libPaths: Record<string, string> = {$1  android: uri + "libwebgpu_x.so",
};
const { symbols } = Deno.dlopen(
  libPaths[Deno.build.os] ?? libPaths.linux,`
  );

  // Fix BufferSource type issues by casting to BufferSource
  source = source.replace(
    /(\w+_buf) as BufferSource/g,
    "$1 as unknown as BufferSource"
  );

  console.log("Writing bindings/bindings.ts...");
  await ensureDir("bindings");
  await Deno.writeTextFile("bindings/bindings.ts", source);

  console.log("✓ Successfully generated bindings/bindings.ts");
  console.log(`  Size: ${source.length} bytes`);
} catch (error) {
  console.error("✗ Error:", error.message);
  Deno.exit(1);
}

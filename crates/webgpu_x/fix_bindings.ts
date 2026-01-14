#!/usr/bin/env -S deno run --allow-read --allow-write

/**
 * Post-processing script to fix TypeScript errors in generated bindings.ts
 * Run this after gen_bindings.ts to make bindings type-safe
 */

const bindingsPath = "./bindings/bindings.ts";

console.log("Reading generated bindings.ts...");
let content = await Deno.readTextFile(bindingsPath);

// Fix 1: Add android to OS type (handle missing android key)
const dlopenMatch = content.match(/const \{ symbols \} = Deno\.dlopen\(\s*\{[^}]+\}\[Deno\.build\.os\]/s);
if (dlopenMatch) {
  content = content.replace(
    /const \{ symbols \} = Deno\.dlopen\(\s*(\{[^}]+\})\[Deno\.build\.os\]/s,
    (match, libPaths) => {
      return `const libPaths = ${libPaths} as Record<typeof Deno.build.os, string>;
const { symbols } = Deno.dlopen(libPaths[Deno.build.os]!`;
    }
  );
  console.log("✓ Fixed dlopen OS type safety");
}

// Fix 2: Convert byteLength to BigInt for usize FFI parameters
// Pattern: a0_buf.byteLength or a1_buf.byteLength in FFI calls
content = content.replace(
  /(\w+_buf)\.byteLength(?=\s*[,)])/g,
  'BigInt($1.byteLength)'
);

console.log("✓ Fixed byteLength to BigInt conversion for FFI calls");

// Fix 3: Add type assertions for buffer parameters to fix ArrayBufferLike vs BufferSource
// Pattern: Find buffer parameters passed to FFI and add "as BufferSource"
content = content.replace(
  /symbols\.(\w+)\(/g,
  (match, funcName) => {
    return match; // Keep the opening intact, we'll fix parameters
  }
);

// More specific: add type assertion to buffer variables when passed to FFI
content = content.replace(
  /\b(a\d+_buf)(?=\s*,)/g,
  '$1 as BufferSource'
);

console.log("✓ Fixed buffer type assertions for FFI calls");

console.log("Writing fixed bindings.ts...");
await Deno.writeTextFile(bindingsPath, content);

console.log("✅ Successfully fixed all TypeScript errors in bindings.ts");
console.log("\nYou can now run: deno check bindings/bindings.ts");

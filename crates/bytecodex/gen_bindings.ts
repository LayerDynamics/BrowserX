#!/usr/bin/env -S deno run --allow-all

import { ensureDir } from "https://deno.land/std@0.132.0/fs/ensure_dir.ts";
import { codegen } from "https://deno.land/x/deno_bindgen@0.8.1/codegen.ts";

// Find the bindings.json file
const findBindingsJson = async () => {
  const locations = [
    "../target/release/build",
    "../../target/release/build",
  ];

  for (const base of locations) {
    try {
      for await (const entry of Deno.readDir(base)) {
        if (entry.isDirectory && entry.name.startsWith("bytecodex-")) {
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

  // Wrap Deno.dlopen in a lazy loader
  const ffiSectionStartMatch = source.match(/\nconst\s+url\s*=\s*new\s+URL\s*\(/);
  const ffiSectionStart = ffiSectionStartMatch?.index ?? -1;

  let ffiSectionEnd = -1;
  const exportTypeMatch = source.match(/\nexport\s+type\s+/);
  ffiSectionEnd = exportTypeMatch?.index ?? -1;
  if (ffiSectionEnd === -1) {
    const exportFunctionMatch = source.match(/\nexport\s+function\s+/);
    ffiSectionEnd = exportFunctionMatch?.index ?? -1;
  }

  if (ffiSectionStart !== -1 && ffiSectionEnd !== -1 && ffiSectionStart < ffiSectionEnd) {
    let ffiSection = source.slice(ffiSectionStart + 1, ffiSectionEnd);

    ffiSection = ffiSection
      .split('\n')
      .map((line) => (line.trim() ? '  ' + line : ''))
      .join('\n');

    ffiSection = ffiSection.replace(
      /\s+const \{ symbols \} = Deno\.dlopen\(/,
      '\n  _lib = Deno.dlopen('
    );

    ffiSection = ffiSection.replace(/^(\s+\))\s*$/m, (match, paren) =>
      paren.endsWith(';') ? match : paren + ';'
    );

    const lazyBlock = [
      '',
      '// ── Lazy FFI loader ─────────────────────────────────────────────────────────',
      'let _lib: Deno.DynamicLibrary<Record<string, Deno.ForeignFunction>> | null = null;',
      '',
      'function _loadLib() {',
      '  if (_lib !== null) return _lib;',
      ffiSection,
      '  return _lib;',
      '}',
      '',
      '// Proxy that triggers lazy load on first property access',
      'const symbols = new Proxy({} as ReturnType<typeof _loadLib>["symbols"], {',
      '  get(_target, prop: string | symbol) {',
      '    return Reflect.get(_loadLib().symbols, prop);',
      '  },',
      '});',
    ].join('\n');

    source = source.slice(0, ffiSectionStart) + lazyBlock + source.slice(ffiSectionEnd);
    console.log("  Applied lazy FFI loader transformation");
  }

  source += `
/**
 * Pre-load the FFI library.
 */
export function preloadLib(): void {
  _loadLib();
}

/**
 * Close the FFI library and release native resources.
 */
export function closeLib(): void {
  if (_lib !== null) {
    _lib.close();
    _lib = null;
  }
}
`;

  console.log("Writing bindings/bindings.ts...");
  await ensureDir("bindings");
  await Deno.writeTextFile("bindings/bindings.ts", source);

  console.log("✓ Successfully generated bindings/bindings.ts");
  console.log(`  Size: ${source.length} bytes`);
} catch (error) {
  console.error("✗ Error:", error instanceof Error ? error.message : String(error));
  Deno.exit(1);
}

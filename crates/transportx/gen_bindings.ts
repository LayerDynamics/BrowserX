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
        if (entry.isDirectory && entry.name.startsWith("transportx-")) {
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
  const fetchPrefix = "../../../target/release";
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
    `const libPaths: Record<string, string> = {$1  android: uri + "libtransportx.so",
};
const { symbols } = Deno.dlopen(
  libPaths[Deno.build.os] ?? libPaths.linux,`
  );

  // Fix BufferSource type issues by casting to BufferSource
  source = source.replace(
    /(\w+_buf) as BufferSource/g,
    "$1 as unknown as BufferSource"
  );

  // Wrap Deno.dlopen in a lazy loader so `deno cache` doesn't execute it at
  // module load time (required for Docker builds where the .so isn't present
  // during the cache step).
  const ffiSectionStartMatch = source.match(/\nconst\s+url\s*=\s*new\s+URL\s*\(/);
  const ffiSectionStart = ffiSectionStartMatch?.index ?? -1;

  // Find the end of the Deno.dlopen() call (the closing `);` on its own line)
  // We want to wrap ONLY the dlopen section, not type exports that follow
  const dlopenMatch = source.match(/Deno\.dlopen\(/);
  let ffiSectionEnd = -1;
  if (dlopenMatch && dlopenMatch.index !== undefined) {
    // Find the closing `);` after dlopen - it's the first `);` on its own line after dlopen
    const afterDlopen = source.indexOf(dlopenMatch[0], dlopenMatch.index);
    // Walk forward to find the matching close: track parens depth
    let depth = 0;
    let inDlopen = false;
    for (let i = afterDlopen; i < source.length; i++) {
      if (source[i] === '(') { depth++; inDlopen = true; }
      if (source[i] === ')') { depth--; }
      if (inDlopen && depth === 0) {
        // Found end of dlopen(...) — advance past the semicolon
        let j = i + 1;
        while (j < source.length && (source[j] === ';' || source[j] === '\n' || source[j] === ' ')) j++;
        ffiSectionEnd = j - 1;
        // Back up to include the newline
        while (ffiSectionEnd > i && source[ffiSectionEnd] === '\n') ffiSectionEnd--;
        ffiSectionEnd++; // point after last char
        break;
      }
    }
  }
  // Fallback: try type/function exports
  if (ffiSectionEnd === -1) {
    const typeExportsMatch = source.match(/\n\/\/\s*──\s*Type exports/);
    ffiSectionEnd = typeExportsMatch?.index ?? -1;
  }
  if (ffiSectionEnd === -1) {
    const exportFunctionMatch = source.match(/\nexport\s+function\s+/);
    ffiSectionEnd = exportFunctionMatch?.index ?? -1;
  }
  if (ffiSectionEnd === -1) {
    const exportTypeMatch = source.match(/\nexport\s+type\s+/);
    ffiSectionEnd = exportTypeMatch?.index ?? -1;
  }

  if (ffiSectionStart === -1 || ffiSectionEnd === -1 || ffiSectionStart >= ffiSectionEnd) {
    throw new Error(
      `Failed to locate FFI section for lazy dlopen transform ` +
        `(ffiSectionStart=${ffiSectionStart}, ffiSectionEnd=${ffiSectionEnd}). ` +
        `The generator relies on finding the 'const url = new URL(...)' declaration ` +
        `and the first type export/export function/export type. Please update the ` +
        `FFI section detection logic if the bindings layout has changed.`
    );
  }

  {
    let ffiSection = source.slice(ffiSectionStart + 1, ffiSectionEnd);

    // Indent every non-empty line by 2 spaces
    ffiSection = ffiSection
      .split('\n')
      .map((line) => (line.trim() ? '  ' + line : ''))
      .join('\n');

    // Replace the destructured const assignment with a plain _lib assignment
    ffiSection = ffiSection.replace(
      /\s+const \{ symbols \} = Deno\.dlopen\(/,
      '\n  _lib = Deno.dlopen('
    );

    // Ensure the closing paren of Deno.dlopen ends with a semicolon
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

  console.log("Writing bindings/bindings.ts...");
  await ensureDir("bindings");
  await Deno.writeTextFile("bindings/bindings.ts", source);

  console.log("Successfully generated bindings/bindings.ts");
  console.log(`  Size: ${source.length} bytes`);
} catch (error) {
  console.error("Error:", error instanceof Error ? error.message : String(error));
  Deno.exit(1);
}

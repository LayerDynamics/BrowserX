import { join } from "https://deno.land/std@0.132.0/path/mod.ts";
import { relative } from "https://deno.land/std@0.132.0/path/mod.ts";

async function findRelativeTarget() {
  const p = new Deno.Command("cargo", {
    args: ["metadata", "--format-version", "1"],
    stdout: "piped",
  });
  const output = await p.output();
  const metadata = JSON.parse(new TextDecoder().decode(output.stdout));
  return relative(Deno.cwd(), metadata.target_directory);
}

const outDir = Deno.env.get("OUT_DIR");
const target = await findRelativeTarget();
const metafile = join(outDir || target, "bindings.json");

console.log("OUT_DIR:", outDir);
console.log("findRelativeTarget():", target);
console.log("metafile path:", metafile);
console.log("metafile exists:", await Deno.stat(metafile).then(() => true).catch(() => false));

const actualPath = "/Users/ryanoboyle/geoprox/crates/target/release/build/pixpane-4daaef1c2e149c86/out/bindings.json";
console.log("\nActual bindings.json path:", actualPath);
console.log("Actual exists:", await Deno.stat(actualPath).then(() => true).catch(() => false));

import { RenderingPipeline } from "./src/engine/RenderingPipeline.ts";

const url = Deno.args[0] || "https://news.ycombinator.com";
const html = await (await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } })).text();
console.log(`Fetched ${html.length} bytes from ${url}`);

const ac = new AbortController();
const server = Deno.serve(
  { port: 9940, hostname: "127.0.0.1", signal: ac.signal, onListen: () => {} },
  () => new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Connection": "close" } }),
);

const pipeline = new RenderingPipeline({ width: 1024, height: 768 });

try {
  const result = await pipeline.render("http://127.0.0.1:9940");

  const root = result.renderTree?.getRoot?.() ?? result.renderTree;
  let nodeCount = 0, textNodes = 0;
  const texts: string[] = [];
  function walk(node: any) {
    nodeCount++;
    if (node.textContent) { textNodes++; if (texts.length < 15) texts.push(node.textContent.trim().slice(0,60)); }
    for (const c of (node.children || [])) walk(c);
  }
  walk(root);

  console.log(`Render tree: ${nodeCount} nodes, ${textNodes} text nodes`);
  console.log(`Display list: ${result.displayList.getCommands().length} commands`);
  console.log(`\nSample text:`);
  for (const t of texts) console.log(`  "${t}"`);

  const pixels = await pipeline.getPixels();
  let nw = 0;
  for (let i = 0; i < pixels.length; i += 4) if (pixels[i] < 250 || pixels[i+1] < 250 || pixels[i+2] < 250) nw++;
  console.log(`\nPixels: ${nw}/${1024*768} non-white (${(nw/(1024*768)*100).toFixed(1)}%)`);

  // Write raw PPM (no external deps)
  const w = 1024, h = 768;
  const header = `P6\n${w} ${h}\n255\n`;
  const headerBytes = new TextEncoder().encode(header);
  const rgb = new Uint8Array(w * h * 3);
  for (let i = 0, j = 0; i < pixels.length; i += 4, j += 3) {
    rgb[j] = pixels[i]; rgb[j+1] = pixels[i+1]; rgb[j+2] = pixels[i+2];
  }
  const ppm = new Uint8Array(headerBytes.length + rgb.length);
  ppm.set(headerBytes); ppm.set(rgb, headerBytes.length);
  const safeName = new URL(url).hostname.replace(/\./g, "_");
  const outPath = `/tmp/browserx-${safeName}.ppm`;
  await Deno.writeFile(outPath, ppm);
  console.log(`Screenshot: ${outPath}`);
} catch (e) {
  console.error("Error:", e);
} finally {
  await pipeline.close();
  ac.abort();
  await server.finished;
}

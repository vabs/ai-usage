// Builds browser assets into dist/ and writes dist/manifest.json,
// which the server uses to resolve "app.js" -> "app-HASH.js".
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import * as esbuild from "esbuild";

const watch = process.argv.includes("--watch");
const outdir = "dist";

/** Writes { "app.js": "app-X1Y2.js", "app.css": "app-Z3.css" } after each build. */
const manifestPlugin = {
  name: "manifest",
  setup(build) {
    build.onEnd(async (result) => {
      if (result.errors.length || !result.metafile) return;
      const manifest = {};
      for (const [file, meta] of Object.entries(result.metafile.outputs)) {
        if (!meta.entryPoint) continue;
        const ext = path.extname(file);
        manifest[path.basename(meta.entryPoint, path.extname(meta.entryPoint)) + ext] = path.relative(outdir, file);
      }
      await writeFile(path.join(outdir, "manifest.json"), JSON.stringify(manifest, null, 2));
    });
  },
};

/** @type {import("esbuild").BuildOptions} */
const options = {
  entryPoints: ["src/app.ts", "src/app.css"],
  outdir,
  bundle: true,
  format: "iife",
  target: ["es2022"],
  // Hashed names in production for long-term caching; stable names while watching.
  entryNames: watch ? "[name]" : "[name]-[hash]",
  minify: !watch,
  sourcemap: true,
  metafile: true,
  logLevel: "info",
  plugins: [manifestPlugin],
};

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
} else {
  await esbuild.build(options);
}

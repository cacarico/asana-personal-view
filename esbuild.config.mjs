import { build, context } from "esbuild";
import { cpSync, mkdirSync } from "fs";

const isWatch = process.argv.includes("--watch");
const isMinify = process.argv.includes("--minify");

const targets = ["firefox", "chrome"];

const sharedOptions = {
  bundle: true,
  format: "iife",
  minify: isMinify,
  sourcemap: !isMinify,
};

for (const target of targets) {
  const outdir = `dist/${target}`;
  mkdirSync(`${outdir}/popup`, { recursive: true });

  const browserTarget =
    target === "firefox" ? ["firefox109"] : ["chrome110"];

  const entries = [
    {
      entryPoints: ["src/content/content.ts"],
      outfile: `${outdir}/content.js`,
    },
    {
      entryPoints: ["src/background/background.ts"],
      outfile: `${outdir}/background.js`,
    },
    {
      entryPoints: ["src/popup/popup.ts"],
      outfile: `${outdir}/popup/popup.js`,
    },
  ];

  if (isWatch) {
    for (const entry of entries) {
      const ctx = await context({
        ...sharedOptions,
        ...entry,
        target: browserTarget,
      });
      await ctx.watch();
    }
  } else {
    for (const entry of entries) {
      await build({ ...sharedOptions, ...entry, target: browserTarget });
    }
  }

  // Copy static assets
  cpSync(`static/manifest.${target}.json`, `${outdir}/manifest.json`);
  cpSync("static/icons", `${outdir}/icons`, { recursive: true });
  cpSync("static/popup/popup.html", `${outdir}/popup/popup.html`);
  cpSync("static/popup/popup.css", `${outdir}/popup/popup.css`);
}

console.log(isWatch ? "Watching for changes..." : "Build complete: dist/");

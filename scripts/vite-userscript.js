/**
 * Vite plugin: builds the userscript bundle + copies DBD data on production build.
 *
 * - In dev mode (vite): builds userscript once, then watches src/ for changes.
 *   Serves wiki-pali-dpd.user.js at the dev server for easy installation.
 * - In build mode (vite build): builds userscript after the landing page,
 *   then copies dpd-web.db.gz from exporter/share/ if present.
 */
import * as esbuild from "esbuild";
import {
  readFileSync,
  writeFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { resolve } from "node:path";

export default function userscriptPlugin() {
  const root = process.cwd();
  const distDir = resolve(root, "dist");
  const srcDir = resolve(root, "src");
  const metaFile = resolve(srcDir, "meta.js");
  const entryFile = resolve(srcDir, "main.js");
  const outFile = resolve(distDir, "wiki-pali-dpd.user.js");
  const dbSource = resolve(root, "data", "dpd-web.db.gz");
  const dbDest = resolve(distDir, "dpd-web.db.gz");

  const esbuildOpts = {
    entryPoints: [entryFile],
    bundle: true,
    format: "iife",
    outfile: outFile,
    platform: "browser",
    globalName: "WikiPaliDPD",
    treeShaking: true,
    minify: false,
    legalComments: "none",
    logLevel: "warning",
  };

  let isDev = false;
  /** @type {import('esbuild').BuildContext|null} */
  let watchCtx = null;

  return {
    name: "userscript",

    config(_, { command }) {
      isDev = command === "serve";
    },

    configureServer(server) {
      // Build userscript initially
      buildUserscript().then(() => {
        // Start watching for changes
        esbuild.context(esbuildOpts).then((ctx) => {
          watchCtx = ctx;
          ctx.watch();
          console.log("[userscript] watching src/ for changes...");
        });
      });

      // Serve the built .user.js at the dev server
      server.middlewares.use((req, res, next) => {
        const url = req.url.replace(/\?.*$/, "");
        if (url === "/wiki-pali-dpd.user.js") {
          if (existsSync(outFile)) {
            const content = readFileSync(outFile, "utf-8");
            res.setHeader("Content-Type", "text/plain; charset=utf-8");
            res.end(content);
          } else {
            res.statusCode = 404;
            res.end("wiki-pali-dpd.user.js not built yet");
          }
        } else {
          next();
        }
      });
    },

    async closeBundle() {
      // closeBundle only fires during production build, not dev serve
      if (isDev) return;
      await buildUserscript();
      copyDbData();
      await writeVersionJson();
    },

    async buildEnd(error) {
      // Cleanup watch context when the build fails
      if (error && watchCtx) {
        await watchCtx.dispose();
        watchCtx = null;
      }
    },
  };

  async function writeVersionJson() {
    const versionPath = resolve(srcDir, "version.js");
    if (!existsSync(versionPath)) {
      console.log("[userscript] version.js not found, skipping version.json");
      return;
    }
    try {
      const mod = await import(versionPath + "?t=" + Date.now());
      const data = mod.default || mod;
      var sizeMb = 0;
      if (existsSync(dbDest)) {
        sizeMb = Math.round((readFileSync(dbDest).length / (1024 * 1024)) * 10) / 10;
      }
      const out = {
        script: data.script || "",
        data: data.data || "",
        dataUrl: data.dataUrl || "",
        dataSizeMb: sizeMb,
      };
      const jsonPath = resolve(distDir, "version.json");
      writeFileSync(jsonPath, JSON.stringify(out, null, 2), "utf-8");
      console.log(`[userscript] version.json -> ${jsonPath} (data ${sizeMb} MB)`);
    } catch (err) {
      console.error("[userscript] failed to write version.json:", err.message);
    }
  }

  // ── helpers ──────────────────────────────────────────────────────

  function copyDbData() {
    if (!existsSync(dbSource)) {
      console.log(
        `[userscript] DB data not found at ${dbSource}, skipping copy`,
      );
      return;
    }
    mkdirSync(distDir, { recursive: true });
    copyFileSync(dbSource, dbDest);
    const sizeMb = (readFileSync(dbDest).length / (1024 * 1024)).toFixed(1);
    console.log(`[userscript] DB data copied -> ${dbDest} (${sizeMb} MB)`);
  }

  async function buildUserscript() {
    if (!existsSync(entryFile)) {
      console.error(`[userscript] entry not found: ${entryFile}`);
      return;
    }

    const result = await esbuild.build(esbuildOpts);

    if (result.errors.length > 0) {
      console.error("[userscript] build errors:", result.errors);
      return;
    }

    // Prepend userscript metadata block
    const metaBlock = readFileSync(metaFile, "utf-8").trimEnd();
    const bundle = readFileSync(outFile, "utf-8");
    const final = metaBlock + "\n\n" + bundle;
    writeFileSync(outFile, final, "utf-8");

    const sizeKb = (Buffer.byteLength(final, "utf-8") / 1024).toFixed(1);
    console.log(`[userscript] built -> ${outFile} (${sizeKb} KB)`);
  }
}

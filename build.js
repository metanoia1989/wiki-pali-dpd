/**
 * esbuild build script for wiki-pali-dpd userscript.
 *
 * Bundles src/ modules into a single dist/wiki-pali-dpd.user.js file.
 * The metadata block from src/meta.js is prepended to the output.
 */
import * as esbuild from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const DIST = resolve(__dirname, "dist");
const ENTRY = resolve(__dirname, "src", "main.js");
const META = resolve(__dirname, "src", "meta.js");
const OUTFILE = resolve(DIST, "wiki-pali-dpd.user.js");

async function build(watch = false) {
    const result = await esbuild.build({
        entryPoints: [ENTRY],
        bundle: true,
        format: "iife",
        outfile: OUTFILE,
        platform: "browser",
        globalName: "WikiPaliDPD",
        treeShaking: true,
        minify: false,
        legalComments: "none",
        metafile: false,
    });

    if (result.errors.length > 0) {
        console.error("[build] errors:", result.errors);
        process.exit(1);
    }

    // Prepend userscript metadata header
    const metaBlock = readFileSync(META, "utf-8").trimEnd();
    const bundle = readFileSync(OUTFILE, "utf-8");

    // Remove the leading IIFE that wraps the whole bundle
    // esbuild's IIFE output starts with (() => { ... })();
    // Keep it as-is but put metadata before it
    const final = metaBlock + "\n\n" + bundle;
    writeFileSync(OUTFILE, final, "utf-8");

    const sizeKb = (Buffer.byteLength(final, "utf-8") / 1024).toFixed(1);
    console.log(`[build] done -> ${OUTFILE} (${sizeKb} KB)`);

    if (watch) {
        // For watch mode, we'd need esbuild.context() + rebuild
        console.log("[build] watch mode not supported in this version");
    }
}

const watchMode = process.argv.includes("--watch");
build(watchMode).catch((e) => {
    console.error("[build] failed:", e);
    process.exit(1);
});

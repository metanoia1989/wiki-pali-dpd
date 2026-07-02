import { defineConfig } from "vite";
import userscriptPlugin from "./scripts/vite-userscript.js";

export default defineConfig({
  plugins: [userscriptPlugin()],
  build: {
    outDir: "dist",
  },
});

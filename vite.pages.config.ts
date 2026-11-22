import { defineConfig } from "vite";

// The site published on GitHub Pages: the landing page, the demo and the minimal example, built from this repo's own sources.
// `base: "./"` makes every link relative, so it works under https://<user>.github.io/<repo>/ without knowing the name.
export default defineConfig({
  base: "./",
  build: {
    outDir: "pages-dist", emptyOutDir: true, target: "es2022",
    rollupOptions: { input: { index: "index.html", demo: "demo/index.html", minimal: "examples/minimal/index.html" } },
  },
});

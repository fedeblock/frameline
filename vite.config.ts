import { defineConfig } from "vite";

// The library build: one ES module, no dependencies. (The demo has its own root, `demo/`.)
export default defineConfig({
  build: {
    lib: { entry: "src/index.ts", formats: ["es"], fileName: () => "frameline.js" },
    target: "es2022", minify: "esbuild", sourcemap: true, emptyOutDir: true,
  },
});

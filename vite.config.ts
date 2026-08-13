import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/Epoch/" : "/",
  build: {
    // Epoch targets modern WebGPU browsers; top-level asset initialization
    // keeps generated geometry out of the main JavaScript bundle.
    target: "esnext",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        creaturePreview: resolve(__dirname, "creature-preview.html"),
      },
    },
  },
  server: {
    port: 5173,
  },
}));

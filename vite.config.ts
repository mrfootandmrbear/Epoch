import { defineConfig } from "vite";

export default defineConfig({
  build: {
    // Epoch targets modern WebGPU browsers; top-level asset initialization
    // keeps generated geometry out of the main JavaScript bundle.
    target: "esnext",
  },
  server: {
    port: 5173,
  },
});

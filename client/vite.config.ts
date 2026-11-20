import { defineConfig } from "vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  base: "./",
  root: rootDir,
  resolve: {
    alias: {
      "@shared": resolve(rootDir, "../shared"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": { target: "http://localhost:2567", changeOrigin: true },
      "/colyseus": { target: "ws://localhost:2567", ws: true, changeOrigin: true },
      "/health": { target: "http://localhost:2567", changeOrigin: true },
    },
  },
  build: {
    outDir: resolve(rootDir, "../dist/client"),
    emptyOutDir: true,
    sourcemap: false,
    target: "es2022",
    chunkSizeWarningLimit: 2200,
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || "development"),
  },
});

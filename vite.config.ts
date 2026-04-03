import { fileURLToPath, URL } from "node:url";
import { readFile } from "node:fs/promises";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;
const BROKEN_RADIX_SOURCE_MAP_FILTER =
  /@radix-ui\/react-(direction|roving-focus)\/dist\/index\.mjs$/;

function stripBrokenRadixSourceMaps() {
  return {
    name: "strip-broken-radix-source-maps",
    setup(build: {
      onLoad: (
        options: { filter: RegExp },
        callback: (args: { path: string }) => Promise<{ contents: string; loader: "js" }>,
      ) => void;
    }) {
      build.onLoad({ filter: BROKEN_RADIX_SOURCE_MAP_FILTER }, async (args) => {
        const contents = await readFile(args.path, "utf8");

        return {
          contents: contents.replace(/\n\/\/# sourceMappingURL=.*$/m, ""),
          loader: "js",
        };
      });
    },
  };
}

export default defineConfig(async () => ({
  plugins: [react()],
  clearScreen: false,
  optimizeDeps: {
    esbuildOptions: {
      plugins: [stripBrokenRadixSourceMaps()],
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));

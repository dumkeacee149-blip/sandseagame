import { defineConfig } from "vite";

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: {
        // 生产构建出游戏本体 + 官网落地页；asset-viewer 是开发工具，
        // dev server 仍可直接访问 /asset-viewer.html
        game: "index.html",
        landing: "landing.html",
      },
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/three/")) return "three-vendor";
        },
      },
    },
  },
});

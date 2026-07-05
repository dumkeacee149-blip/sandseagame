import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        // 生产构建只出游戏本体；asset-viewer 是开发工具，
        // dev server 仍可直接访问 /asset-viewer.html
        game: "index.html",
      },
    },
  },
});

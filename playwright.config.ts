import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 45_000,
  use: {
    baseURL: "http://127.0.0.1:5199",
    viewport: { width: 1280, height: 800 },
  },
  webServer: [
    {
      command: "npm run dev -- --port 5199",
      port: 5199,
      reuseExistingServer: true,
    },
    {
      // 多人测试用的本地 presence 服务器（与线上 Worker 共用 presence-core 逻辑）
      command: "node scripts/presence-test-server.mjs",
      port: 8790,
      reuseExistingServer: true,
    },
  ],
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 45_000,
  use: {
    baseURL: "http://127.0.0.1:5199",
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: "npm run dev -- --port 5199",
    port: 5199,
    reuseExistingServer: true,
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});

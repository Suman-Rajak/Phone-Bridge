import { defineConfig } from "@playwright/test";

const baseURL = "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL,
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    trace: "retain-on-failure",
  },
  webServer: {
    cwd: "./apps/web",
    env: { PHONEBRIDGE_E2E: "1" },
    command:
      "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173 --strictPort",
    url: baseURL,
  },
});

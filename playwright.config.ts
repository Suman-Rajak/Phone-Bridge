import { defineConfig } from "@playwright/test";

const baseURL = "http://127.0.0.1:4173";
const signalPort = 8788;

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL,
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      cwd: "./apps/web",
      env: {
        PHONEBRIDGE_E2E: "1",
        VITE_SIGNAL_URL: `http://127.0.0.1:${signalPort}`,
      },
      command:
        "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173 --strictPort",
      url: baseURL,
    },
    {
      cwd: "./apps/signal",
      command: `node node_modules/wrangler/bin/wrangler.js dev --local --ip 127.0.0.1 --port ${signalPort} --log-level warn --persist-to .wrangler/e2e-state --var ALLOWED_ORIGINS:${baseURL}`,
      port: signalPort,
    },
  ],
});

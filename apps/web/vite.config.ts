import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";

export default defineConfig(({ command, isPreview }) => {
  const config = { plugins: [react(), tailwindcss()] };
  if (command !== "serve" || isPreview) return config;

  // Dependency discovery during browser tests must not reload another test's page.
  const server = { hmr: process.env.PHONEBRIDGE_E2E !== "1" };
  const { PHONEBRIDGE_DEV_TLS_KEY: key, PHONEBRIDGE_DEV_TLS_CERT: cert } =
    process.env;
  if (!key && !cert) return { ...config, server };
  if (!key || !cert) {
    throw new Error(
      "Set both PHONEBRIDGE_DEV_TLS_KEY and PHONEBRIDGE_DEV_TLS_CERT for local HTTPS.",
    );
  }

  return {
    ...config,
    server: {
      ...server,
      https: { key: readFileSync(key), cert: readFileSync(cert) },
    },
  };
});

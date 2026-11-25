import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";

export default defineConfig(({ command, isPreview }) => {
  const config = { plugins: [react(), tailwindcss()] };
  if (command !== "serve" || isPreview) return config;

  const { PHONEBRIDGE_DEV_TLS_KEY: key, PHONEBRIDGE_DEV_TLS_CERT: cert } =
    process.env;
  if (!key && !cert) return config;
  if (!key || !cert) {
    throw new Error(
      "Set both PHONEBRIDGE_DEV_TLS_KEY and PHONEBRIDGE_DEV_TLS_CERT for local HTTPS.",
    );
  }

  return {
    ...config,
    server: { https: { key: readFileSync(key), cert: readFileSync(cert) } },
  };
});

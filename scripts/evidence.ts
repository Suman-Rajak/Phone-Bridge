import { execFileSync } from "node:child_process";

const trailers = execFileSync(
  "git",
  [
    "log",
    "--format=%(trailers:key=Codex-Stage,key=Codex-Surface,key=Codex-Model,key=Codex-Effort,key=Codex-Why,key=Codex-Capabilities,key=Codex-Escalated-From)",
  ],
  { encoding: "utf8" },
).trim();

process.stdout.write(
  trailers ? `${trailers}\n` : "No Codex commit trailers found.\n",
);

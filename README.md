# PhoneBridge

PhoneBridge is a browser app in development that aims to turn a phone into a scanner, document camera, presentation clicker, drawing tablet, and clipboard for a laptop after one QR scan. The current app has laptop and phone interfaces ready for pairing integration.

## Setup

Install Node.js 24 and pnpm 11.25.0, then run these commands from the repository root.

```sh
pnpm install
pnpm dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

Run the checks before opening a pull request.

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
```

In development, open `/ui` to preview the shared components in light and dark themes.

Build the web app with `pnpm --filter @phonebridge/web build`. Run `pnpm evidence` to print Codex trailers from the local Git history.

See the [roadmap](docs/ROADMAP.md) for feature milestones.

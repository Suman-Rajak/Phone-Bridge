# PhoneBridge

PhoneBridge is a browser app in development that aims to turn a phone into a scanner, document camera, presentation clicker, drawing tablet, and clipboard for a laptop after one QR scan. The laptop and phone can already pair over WebRTC and display a shared verification code.

## Setup

Install Node.js 24 and pnpm 11.25.0, then run these commands from the repository root.

```sh
pnpm install
pnpm dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

`pnpm dev` also starts the local signaling Worker at `http://127.0.0.1:8787`. Run `pnpm dev:web` or `pnpm dev:signal` to start either service independently.

For a local pairing check on one machine, open the pairing link in a second browser tab and compare the four digits shown on both pages. Select the Connected status to see the connection type and the three data channels.

On a paired phone, choose **Scan** and **Start camera**. A green outline marks a detected page. An amber outline means the detector is estimating the boundary. Leave Scan or choose **Stop camera** to release the camera.

Hold a sharp page steady to capture it automatically, or tap **Capture page**. The laptop shows the received scan after verifying it. Toggle **Auto capture** off to take scans only with the shutter.

On the laptop, select a page to change its appearance, rotate it, or adjust its corners. Drag thumbnails to reorder pages or use the arrow buttons. Choose **Retake** to open Scan on the phone and capture a replacement.

Run the checks before opening a pull request.

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
```

In development, open `/ui` to preview the shared components in light and dark themes.

Open `/diagnostics` to check browser features. To pair a phone, serve the web app and its signaling endpoint over HTTPS. [HTTPS development guide](docs/ship/dev-https.md)

To benchmark document detection, install FFmpeg and tar, then run `pnpm bench:vision`. The [SmartDoc setup guide](docs/understand/datasets.md) includes a manual download option.

Build the web app with `pnpm --filter @phonebridge/web build`. Run `pnpm evidence` to print Codex trailers from the local Git history.

See the [roadmap](docs/ROADMAP.md) for feature milestones.

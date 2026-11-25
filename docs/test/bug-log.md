# Bug log

## T02 · Lint after a Windows checkout

- Symptom — `pnpm lint` flags unchanged files on Windows after switching branches.
- Reproduction — Check out the merged foundation with `core.autocrlf=true`, then run `pnpm lint`.
- Cause — Git materializes CRLF in the working tree while Prettier defaults to LF.
- Fix — Let Prettier follow each file’s line endings while still checking its formatting.
- PR — [#3](https://github.com/Suman-Rajak/Phone-Bridge/pull/3).

## T02 · Diagnostics table at 360 px

- Symptom — Hosted Chromium reported a 390 px document after resizing the diagnostics page to 360 px.
- Reproduction — Run the diagnostics phone test in the [first hosted CI run](https://github.com/Suman-Rajak/Phone-Bridge/actions/runs/45612508903/job/139199404617).
- Cause — The table relied on intrinsic column widths and the test sampled layout immediately after resizing.
- Fix — Constrain the table columns, let long labels wrap, and check layout once the viewport resize is reflected in the page.
- PR — [#3](https://github.com/Suman-Rajak/Phone-Bridge/pull/3).

## T04 · Chromium gallery reload during worker startup

- Symptom — The gallery’s axe scan loses its page context while the vision worker test is running.
- Reproduction — Run the full Playwright suite with a cold Vite dependency cache and the default parallel workers.
- Cause — Vite discovers the worker’s OpenCV dependency and reloads active development pages.
- Fix — Disable Vite hot updates on the Playwright-owned server.
- PR — [#5](https://github.com/Suman-Rajak/Phone-Bridge/pull/5).

## T06 · Lint includes Wrangler bundles

- Symptom — `pnpm lint` reports unused variables and empty blocks in generated Worker code.
- Reproduction — Run the pairing browser tests, then run `pnpm lint` with the generated Wrangler directory present.
- Cause — ESLint and Prettier traversed Wrangler’s local build output.
- Fix — Exclude Wrangler’s generated directories from source checks.
- PR — [#8](https://github.com/Suman-Rajak/Phone-Bridge/pull/8).

## T11 · Tray assertion timed out during a corner edit

- Symptom — The full suite timed out after five seconds with the previous image still visible after Save corners.
- Reproduction — Run all Chromium tests with four Playwright workers while the source checks are also running. Inspect the retained tray trace.
- Cause — The trace shows Straightening page after the drawer closed. The browser test exhausted its five-second assertion while the worker was processing the new image.
- Fix — Give the corner-edit assertion the same 30-second window as the other worker-dependent steps and continue requiring a new image.
- PR — [#13](https://github.com/Suman-Rajak/Phone-Bridge/pull/13).

## T11 · Tray briefly showed the deleted page

- Symptom — Hosted Chromium read the deleted page’s old preview before the remaining page became visible.
- Reproduction — Delete the selected page in the two-page tray and inspect the preview immediately, as in the hosted disconnect-retention test.
- Cause — The Blob URL hook returned its previous URL for one render after the selected Blob changed.
- Fix — Associate each URL with its Blob and display it only for the current selection. Check that the remaining page’s preview is active before disconnecting.
- PR — [#13](https://github.com/Suman-Rajak/Phone-Bridge/pull/13).

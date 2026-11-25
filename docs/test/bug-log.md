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

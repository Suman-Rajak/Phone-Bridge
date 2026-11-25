# Bug log

## T02 · Lint after a Windows checkout

- Symptom — `pnpm lint` flags unchanged files on Windows after switching branches.
- Reproduction — Check out the merged foundation with `core.autocrlf=true`, then run `pnpm lint`.
- Cause — Git materializes CRLF in the working tree while Prettier defaults to LF.
- Fix — Let Prettier follow each file’s line endings while still checking its formatting.
- PR — Pending publication.

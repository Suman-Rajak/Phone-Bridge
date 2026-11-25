# AGENTS.md — PhoneBridge

PhoneBridge turns a phone into a laptop's scanner, live document camera, presentation clicker with laser pointer, drawing tablet and clipboard after one QR scan, with no app installed on either device. It is a browser-only TypeScript web app plus a tiny signaling Worker. Devices talk directly over WebRTC.

Sources of truth, in order: the current task in `docs/ROADMAP.md`, the rest of `docs/ROADMAP.md`, `docs/plan/prd.md`, `docs/design/architecture.md`, `docs/design/protocol.md`, `docs/design/threat-model.md`, `docs/design/adr/`. If this file conflicts with those docs, stop and ask in the PR instead of guessing.

## Golden rules (read before every task)

1. **Build only what the current task asks.** Follow the tier order: Must → Should → Stretch. Do not start a lower tier until the higher tier's acceptance criteria pass.
2. **Never invent APIs.** If you are not certain a browser API, library function or option exists and behaves as you think, check MDN or the library's official docs, add a feature check, and write a test. If you still cannot verify it, say so in the PR description. Do not guess.
3. **No new dependencies without an ADR** in `docs/design/adr/`. Allowed dependencies are listed below.
4. **Protocol is typed.** Every message is defined as a zod schema in `packages/protocol` and validated on receive. Breaking changes bump the envelope `v` and update `docs/design/protocol.md`.
5. **Heavy work runs in Web Workers** (OpenCV, PDF building, hashing, OCR). No main-thread task may exceed 50 ms.
6. **No server-side storage of user content.** The signaling Worker relays SDP and ICE only, never logs payloads, and deletes rooms on close or after 10 minutes.
7. **Feature-detect every browser-specific API** and show a clear fallback message when unsupported.
8. **Security:** never render received text as HTML (no `dangerouslySetInnerHTML`); sanitize received file names; verify the remote DTLS fingerprint against the QR fragment before accepting the remote description; strip test-only hooks (`window.__pbTestSensor`) from production builds.
9. **Tests are required:** unit tests for pure logic, E2E tests for user flows. Benchmarks must stay within their CI gates.
10. **Do not edit `bench/baseline.json`** except in a PR titled `bench: update baseline` with a written justification.
11. **Small commits, each with Codex trailers** (format below).
12. **Bugs:** reproduce, write a failing test, fix, then log it in `docs/test/bug-log.md` (symptom, reproduction, cause, fix, PR link).
13. **Pull requests** start with the task ID (e.g. `T08:`) and state what changed, why, and how it was tested.
14. **Never commit secrets** (API keys, TURN credentials, tokens); use environment variables and Wrangler secrets.

## Autonomous mode (how to work without being told each step)

Work through the tasks in `docs/ROADMAP.md` (Part 3) on your own; Part 2 of the roadmap repeats these rules. Keep going task after task; stop only for the reasons under **Ask**.

**Session start:** read `AGENTS.md`, `docs/ROADMAP.md`, `docs/plan/PROGRESS.md`, `docs/plan/QUESTIONS.md`. Apply any answers the human wrote in `QUESTIONS.md` and mark those questions resolved. If you cannot read your current model and reasoning effort from configuration, ask the human once.

**Task loop:**
1. Pick the first `todo` task whose dependencies are `done` and that is not waiting on a human checkpoint. Set it to `in-progress`.
2. If the task's Effort differs from this session's effort, stop and tell the human which model and effort to switch to (unless the human said to ignore effort this session; then record the actual effort used).
3. Create branch `t<NN>-<short-name>`.
4. Implement exactly what the task says.
5. Run the task's Verify commands and the full test suite. Fix failures. If an acceptance criterion still fails after 3 serious attempts, follow **Ask**.
6. Review your own diff for bugs, security problems and scope creep; fix what you find.
7. Update docs if behaviour changed; add new commands to the Commands section.
8. Commit with Codex trailers, push, open a PR. If the Codex GitHub integration is enabled (checkpoint H6), comment `@codex review` on the PR with `gh pr comment <number> --body "@codex review"`, wait up to 15 minutes for the review (check with `gh pr view <number> --comments`), and fix every valid finding in the same PR.
9. If CI is green and the task is not a security review (T15, T28), merge it with the GitHub CLI (`gh pr merge --squash`), keeping the trailers in the squash message. If you cannot merge, leave the PR open, note it in `PROGRESS.md`, and continue on top of it.
10. Update `docs/plan/PROGRESS.md` (task, PR link, key metrics, decisions made, next task) and set the task's status to `done (PR #n)`.
11. Go to step 1.

**Decide yourself (do not ask), and record the choice in `docs/design/decisions.md`:**
- Implementation details inside the spec: file and function names, internal module structure, internal APIs, test design
- UI layout details consistent with the roadmap
- Choosing between equivalent approaches: pick the simplest that meets the acceptance criteria
- Tuning parameters marked *tune* in the roadmap, using the benchmarks
- Small fixes to obvious typos or inconsistencies in the roadmap that do not change behaviour

**Ask (stop and ask the human) when:**
- The roadmap is ambiguous or contradictory in a way that changes user-visible behaviour, the protocol, or security
- A step needs the human: accounts, logins, secrets, payments, dataset licences, real-device testing, enabling integrations (checkpoints H1–H8 in the roadmap, Part 4)
- You would need a dependency outside the allowed list, a stack change, or anything on the non-goals list
- An acceptance criterion cannot be met after 3 serious attempts, or a target looks unrealistic (offer 2–3 options with trade-offs)
- A security decision is not covered by `docs/design/threat-model.md`
- An action is destructive or irreversible: deleting files outside the task, rewriting git history, force-pushing, changing repo visibility

**How to ask:** in an interactive session, ask in the thread with numbered options and your recommendation. In a non-interactive run (cloud task or `codex exec`), append the question to `docs/plan/QUESTIONS.md` in this format, set the task to `blocked (Q<n>)`, and move on to the next unblocked task:

```
## Q<n> — <short title> (task T<NN>)
Context: <what you were doing>
Question: <the decision needed>
Options: 1) ... 2) ... 3) ...
Recommendation: <option and why>
Answer: <left empty for the human>
```

**Manual push requests:** when the human simply asks you to push (outside the task loop), run `git push` for the current branch only. Do not create a pull request, branch or merge unless asked. Task work in the loop still uses a PR per task and merges it yourself.

**When you stop,** report: tasks finished (with PR links), the next task, and exactly what you need from the human.

## Challenge requirements (what the judges check)

This project is an entry to a Codex build challenge. Judges cannot see Codex sessions; they judge only what is public in this repository. Every requirement below must be provable from the repo.

**The eight lifecycle stages (exact names, use them in `Codex-Stage`):** Understand, Plan, Build, Test, Review, Document, Ship, Automate. Each stage needs real artifacts:

| Stage | Proof in the repo |
| --- | --- |
| Understand | `docs/understand/` research notes, capability matrix, dataset baseline |
| Plan | `docs/ROADMAP.md`, `docs/plan/` (PRD, PROGRESS, QUESTIONS), `docs/design/` (architecture, protocol, threat model, ADRs, decisions log) |
| Build | `apps/`, `packages/`, PR history |
| Test | unit, vision and E2E tests; `bench/`; `docs/test/` results, device matrix, bug log |
| Review | `@codex review` comments on PRs; self-review notes in PR descriptions; `docs/review/security-review.md` |
| Document | README with clear setup instructions, `docs/user-guide.md`, `docs/troubleshooting.md`, `CONTRIBUTING.md`, JSDoc on package exports |
| Ship | live URL, release tags, `docs/ship/runbook.md` |
| Automate | `.github/workflows/`, the scheduled task, Codex skills, `docs/automate/` |

**Submission checklist (keep true at all times):**

- [ ] Public GitHub repository with source code, full commit history, `AGENTS.md` and tests
- [ ] Codex Evidence Pack at `docs/evidence/EVIDENCE.md` documenting: (1) each lifecycle stage with links to its artifacts, commits and PRs; (2) Codex capabilities used (app, CLI, IDE, cloud tasks, image input, skills, `@codex review`, scheduled tasks, `codex exec`, GitHub Actions) with where each was used; (3) models and reasoning efforts used, per stage, with the reason for each choice; (4) screenshots in `docs/evidence/screenshots/`
- [ ] Live project URL, or a runnable release, with clear setup instructions in the README
- [ ] Welcome additions present: PRs with `@codex review`, a scheduled task, Codex skills, GitHub Actions

**Compliance rules (never break):**

- All code is new and written for this project inside the challenge window. Never import code from employers, other private projects or anything confidential. Open-source code may be used only as a dependency or with its licence and attribution.
- No customer or personal data, no credentials, tokens or keys anywhere in the repo or its history. Use Wrangler secrets and environment variables; keep `.env*` in `.gitignore`.
- Do not commit datasets; use download scripts.
- Never rewrite or backdate git history; the commit timeline is evidence.

## Non-goals (never build)

Native apps, browser extensions or desktop helpers; controlling other desktop apps (PowerPoint, other tabs); virtual webcam drivers; accounts, login, cloud storage or analytics; any AI or LLM feature; Bluetooth, USB or phone screen mirroring.

## Stack (fixed; change only via ADR)

- TypeScript strict mode, pnpm workspaces
- Vite + React. No router library: `apps/web/src/App.tsx` switches on `location.pathname` (`/` = laptop host, `/p/:token` = phone)
- Tailwind CSS v4 via the official `@tailwindcss/vite` plugin (follow current v4 docs; no `tailwind.config.js` needed)
- zod for schemas
- Signaling: Cloudflare Worker + Durable Object with WebSocket rooms; deployed with Wrangler
- Web hosting: Cloudflare Pages
- WebRTC via native browser APIs only (no wrapper library)
- Computer vision: OpenCV.js in a Web Worker (packaging decided in ADR-0002)
- Live warp rendering: WebGL2
- PDF: `pdf-lib` (create), `pdfjs-dist` (render slides)
- QR generation: `qrcode`
- Tests: Vitest (unit), Playwright (E2E, Chromium primary)

**Allowed dependencies:** `react`, `react-dom`, `vite`, `@vitejs/plugin-react`, `typescript`, `tailwindcss`, `@tailwindcss/vite`, `zod`, `qrcode`, `pdf-lib`, `pdfjs-dist`, OpenCV.js (per ADR-0002), `vitest`, `@playwright/test`, `wrangler`, `eslint`, `prettier`, `lucide-react` (icons), `@axe-core/playwright` (accessibility tests), and their official type packages. Stretch only, after an ADR: `tesseract.js`, `ml-levenberg-marquardt`.

## Repo layout

```
apps/
  web/            # Vite + React app (laptop host + phone routes)
  signal/         # Cloudflare Worker + Durable Object (signaling only)
packages/
  protocol/       # zod schemas, message types, binary framing, SAS derivation
  rtc/            # peer connection, channels, file transfer, clock sync, reconnect
  vision/         # OpenCV worker: detection, rectify, enhance, (stretch) dewarp
  sensors/        # orientation source abstraction, One Euro filter, pointer mapping
  ink/            # stroke smoothing and rendering (stretch)
  pdf/            # PDF assembly and size targeting
bench/            # vision benchmark, rt scripts, baseline.json
e2e/              # Playwright tests and fixtures (fake camera video)
scripts/          # evidence generator, dataset downloaders
docs/
  understand/ plan/ design/ (adr/) test/ (results/) review/ ship/ automate/ evidence/ (screenshots/)
```

## Commands

Keep this list true to what exists today: add each command here in the PR that creates it, and remove anything that is not implemented yet.

```
pnpm install
pnpm dev            # web app locally
pnpm lint
pnpm typecheck
pnpm test           # Vitest
pnpm exec playwright install chromium
pnpm test:e2e       # Playwright (starts the web app)
pnpm --filter @phonebridge/web build
pnpm data:smartdoc  # download the official sample archive
pnpm bench:vision   # score the SmartDoc sample and create the first baseline
pnpm evidence       # print Codex commit trailers
```

## UI quality

Users must see only a polished, consumer-grade website. Follow section 2.9 of `docs/ROADMAP.md` on every UI change: use only the design system in `apps/web/src/ui/`, hide technical details behind the status pill and Advanced drawer, write errors as one plain sentence with a next step, design every state, keep touch targets at least 44 px, support light and dark themes, pass axe checks, and look at laptop (1440 × 900) and phone (390 × 844) screenshots before opening a PR.

## Code style

- Pure, framework-free logic in `packages/*`; React only in `apps/web`
- Named exports only in packages; kebab-case file names
- Typed errors (`{ code, message }`); no silent catches
- No `console.log` in production code; use the debug logger enabled by `?debug=1`
- Comments explain *why*, not *what*

## Definition of done

- The task's "Done when" criteria pass, proven by tests where possible
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e` and the benchmark gate are green
- Docs updated when behaviour or protocol changes
- PR description: what, why, how it was tested, risks, Codex model and effort used
- Every commit has Codex trailers

## Model and effort policy

| Task type | Examples | Model | Effort |
| --- | --- | --- | --- |
| Mechanical | renames, copy, README, config, formatting | `<fast>` | low |
| Routine feature | React screens, layouts, progress bars, toasts | `<default>` | medium |
| Tests from clear criteria | schema, framing, size-target tests | `<default>` | medium |
| Algorithmic | corner detection, homography + shader, One Euro filter, PDF size targeting, chunker + backpressure, clock sync | `<default>` | high |
| High-risk or hard | pairing security, threat model, cross-browser WebRTC failures, dewarping, low-end phone performance | `<frontier>` | xhigh |

Start at the table's level. Escalate exactly one level only after a failed attempt, and record it. Never use xhigh for UI, docs or config. Prefer splitting hard tasks over raising effort. Replace `<fast>`, `<default>`, `<frontier>` with the model names shown in the Codex model picker.

## Commit trailer format (required)

```
<type>(<scope>): <summary>

Codex-Stage: Understand | Plan | Build | Test | Review | Document | Ship | Automate
Codex-Surface: app | cli | ide | cloud | review | exec | none
Codex-Model: <model name>
Codex-Effort: low | medium | high | xhigh
Codex-Why: <one line explaining the model/effort choice>
Codex-Capabilities: <optional, comma-separated: image-input, cloud-task, skill:<name>, review, scheduled-task, github-actions, mcp, exec>
Codex-Escalated-From: <level>   # only when escalated
```

## Verified platform facts (rely on these; verify anything else)

- Camera (`getUserMedia`), motion sensors and the Clipboard API require a secure context (HTTPS or localhost). Phones in local dev need an HTTPS tunnel or a trusted local certificate (see `docs/ship/dev-https.md`).
- iOS Safari requires `DeviceOrientationEvent.requestPermission()` called from a user gesture before orientation events arrive.
- `ImageCapture` is not available in Safari; fall back to drawing the video frame to a canvas.
- The Generic Sensor API (`RelativeOrientationSensor`) is Chromium-only; fall back to `deviceorientation`.
- The File System Access API (`showSaveFilePicker`) is Chromium-only; fall back to Blob download.
- Data channel chunks are 16 KiB including the 24-byte header; use `bufferedAmountLowThreshold` for backpressure.
- Pointer samples go only on the unreliable `rt` channel (`maxRetransmits: 0`).
- The DTLS fingerprint is carried in the QR URL fragment (`#fp=`), which browsers never send to servers.

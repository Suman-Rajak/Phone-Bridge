# PhoneBridge — Roadmap for Codex

> **For the human:** put this file in the repo at `docs/ROADMAP.md` (and `AGENTS.md` at the root). In Codex, say: **"Read docs/ROADMAP.md and follow it."** Repeat that same sentence at the start of every session. Codex works through the tasks one by one and only stops when it needs you.

---

## Part 1 — What we are building

PhoneBridge turns any phone into a laptop's **scanner, live document camera, presentation clicker with laser pointer, drawing tablet, and clipboard/file bridge** after one QR scan, with **no app installed** on either device. It is a browser-only web app: the laptop opens the site, the phone scans the QR with its normal camera, and the two connect directly over WebRTC. A tiny signaling Worker introduces them and stores nothing.

**Why:** Mac + iPhone users get Continuity (scan into Mac, sketch from iPhone, universal clipboard). Windows + Android users get nothing built in and must install apps on both devices.

**Judge flow (must work in under 60 seconds):** open the live URL on a laptop → scan the QR with a phone → pages scanned on the phone appear flattened on the laptop → switch to Document Camera (live, flattened) → switch to Clicker (tilt for laser over sample slides).

**Quality bar:** users see only a polished, consumer-grade website, never the plumbing. It should feel like a finished product (think a clean, modern app), with technical details (connection type, diagnostics, error codes) hidden behind small status indicators and an "Advanced" drawer. Rules are in 2.9; the design system is built in T01D.

**Tiers (build in this order; never start a lower tier before the higher tier is done):**

| Tier | Features |
| --- | --- |
| Must | QR pairing + WebRTC; Scanner (detect, auto-capture, rectify, enhance); multi-page PDF with exact size target; file drop both ways; text clipboard both ways; live Document Camera with real-time flattening; connection doctor |
| Should | Presenter (PDF slides, phone clicker, gyroscope laser); TURN relay for cross-network pairing; image clipboard |
| Stretch | Drawing tablet; curved-page dewarping; OCR text layer |

**Non-goals (never build):** native apps, extensions or desktop helpers; controlling other desktop apps (presenter works only inside the PhoneBridge tab); virtual webcam drivers; accounts, login, cloud storage or analytics; any AI/LLM feature; Bluetooth, USB or phone screen mirroring.

**Target metrics (measure and report; they are goals, not promises):**

| Metric | Target |
| --- | --- |
| Corner detection, SmartDoc subset | mean IoU ≥ 0.90 |
| Scan arrival, same Wi-Fi | ≤ 3 s capture → laptop |
| File transfer, same Wi-Fi | ≥ 5 MB/s |
| Doc-cam render rate | ≥ 24 fps on a real laptop |
| Laser jitter at rest | ≤ 2 px RMS |
| Pointer latency, same Wi-Fi | p95 ≤ 60 ms |
| PDF size target | ≤ target and ≥ 90% of it |

---

## Part 2 — How Codex works through this roadmap

### 2.1 Every session

1. Read `AGENTS.md`, this file, `docs/plan/PROGRESS.md` and `docs/plan/QUESTIONS.md` (create the last two in T01 if missing).
2. Apply any answers the human wrote in `QUESTIONS.md`; mark those questions resolved.
3. If you cannot read your current model and reasoning effort from configuration, ask the human once.
4. Run the task loop below until you must stop.

### 2.2 Task loop

1. Pick the first task in Part 3 whose status is `todo`, whose dependencies are `done`, and which is not waiting on a human checkpoint (Part 4). Set it to `in-progress` in this file.
2. If the task's effort differs from this session's effort, stop and tell the human which model/effort to switch to (unless the human said to ignore effort this session; then record the actual effort).
3. Create branch `t<NN>-<short-name>`.
4. Implement exactly what the task says.
5. Run the task's verify commands and the full test suite. Fix failures. After 3 serious failed attempts on one criterion, follow 2.4.
6. Review your own diff for bugs, security problems and scope creep; fix them.
7. Update docs that the change affects (README setup steps, `docs/design/*`, Commands in `AGENTS.md`).
8. Write the task's evidence (2.6).
9. Commit with trailers (2.5), push, open a PR titled `T<NN>: <title>` describing what changed, why, how it was tested, and linking the evidence files.
10. If the Codex GitHub integration is enabled (H6), comment `@codex review` with `gh pr comment <n> --body "@codex review"`, wait up to 15 minutes (`gh pr view <n> --comments`), and fix valid findings in the same PR.
11. If CI is green and the task is not a security review (T15, T28), merge with `gh pr merge --squash`, keeping the trailers in the squash message. If you cannot merge, leave it open, note it in `PROGRESS.md`, and continue on top of it.
12. Set the task status to `done (PR #n)`, add a line to `docs/plan/PROGRESS.md` (task, PR, key metrics, decisions, next task), then go to step 1.

**Manual push requests:** when the human simply asks you to push (outside the task loop), run `git push` for the current branch only. Do not create a pull request, branch or merge unless asked. Task work in the loop still uses a PR per task and merges it yourself.

### 2.3 Decide yourself (do not ask); log the choice in `docs/design/decisions.md`

- Implementation details inside the spec: names, module structure, internal APIs, test design
- UI layout details consistent with this roadmap
- Choosing between equivalent approaches: pick the simplest that meets the criteria
- Tuning any parameter marked *tune*, using the benchmarks
- Fixing obvious typos or inconsistencies in this roadmap that do not change behaviour

### 2.4 Stop and ask the human when

- This roadmap is ambiguous or contradictory in a way that changes user-visible behaviour, the protocol or security
- A step needs the human (Part 4 checkpoints: accounts, secrets, real devices, integrations)
- You would need a dependency outside the allowed list, a stack change, or a non-goal
- A criterion still fails after 3 serious attempts, or a target looks unrealistic (offer 2–3 options with a recommendation)
- A security decision is not covered by `docs/design/threat-model.md`
- An action is destructive: deleting files outside the task, rewriting git history, force-pushing, changing repo visibility

**How to ask:** in an interactive session, ask in the thread with numbered options and your recommendation. In a non-interactive run, append to `docs/plan/QUESTIONS.md`:

```
## Q<n> — <title> (task T<NN>)
Context: ...
Question: ...
Options: 1) ... 2) ... 3) ...
Recommendation: ...
Answer:
```

then set the task to `blocked (Q<n>)` and continue with the next unblocked task. **When you stop,** report: tasks finished (PR links), next task, and exactly what you need from the human.

### 2.5 Commit trailers (required on every commit)

```
T08: add phone preview detection

Codex-Stage: Build
Codex-Surface: app
Codex-Model: <model name>
Codex-Effort: high
Codex-Why: geometry + timing logic with edge cases
Codex-Capabilities: image-input, skill:vision-bench
Codex-Escalated-From: medium
```

- `Codex-Stage`: Understand | Plan | Build | Test | Review | Document | Ship | Automate
- `Codex-Surface`: app | cli | ide | cloud | review | exec | none
- `Codex-Effort`: low | medium | high | xhigh
- `Codex-Capabilities` optional (image-input, cloud-task, skill:<name>, review, scheduled-task, github-actions, mcp, exec); `Codex-Escalated-From` only when escalated

**Effort policy:** low = renames, copy, docs, config · medium = routine UI, layouts, tests from clear criteria · high = algorithms (detection, homography, filters, size targeting, chunking, clock sync) · xhigh = pairing security, threat model, cross-browser WebRTC failures, dewarping, low-end phone performance. Never xhigh for UI/docs/config. Prefer splitting hard tasks over raising effort.

### 2.6 Evidence for every task

1. Write `docs/evidence/sessions/T<NN>.md`: task, stage, date, model and effort, surface and capabilities used, the main prompt, what was built, test results, PR link, decisions or escalations.
2. If anything visible changed, capture Playwright screenshots (fake camera where needed) to `docs/evidence/screenshots/app/T<NN>-<name>.png`.

### 2.7 Challenge requirements (judges only see the public repo)

- Public GitHub repo with source code, full commit history, `AGENTS.md`, and tests
- Codex Evidence Pack at `docs/evidence/EVIDENCE.md` covering the eight stages (Understand, Plan, Build, Test, Review, Document, Ship, Automate) with links; Codex capabilities used; models and efforts per stage with reasons; screenshots
- Live URL with clear setup instructions in the README
- Welcome additions: `@codex review` on PRs, a scheduled task, Codex skills, GitHub Actions
- All code new and written for this project; no confidential code, personal data or credentials anywhere in the repo or history; never commit datasets; never rewrite or backdate history

### 2.8 Fixed stack and allowed dependencies

TypeScript strict · pnpm workspaces · Vite + React (no router library: `App.tsx` switches on `location.pathname`: `/` = laptop, `/p/:token` = phone, `/diagnostics`, `/built-with-codex`) · Tailwind CSS v4 via `@tailwindcss/vite` (no config file) · zod · Cloudflare Worker + Durable Object for signaling (Wrangler) · Cloudflare Pages hosting · native WebRTC (no wrapper) · OpenCV.js in a Web Worker · WebGL2 for live warp · `pdf-lib`, `pdfjs-dist` · `qrcode` · Vitest · Playwright.

Allowed dependencies: `react`, `react-dom`, `vite`, `@vitejs/plugin-react`, `typescript`, `tailwindcss`, `@tailwindcss/vite`, `zod`, `qrcode`, `pdf-lib`, `pdfjs-dist`, OpenCV.js (per ADR-0002), `vitest`, `@playwright/test`, `wrangler`, `eslint`, `prettier`, `lucide-react` (icons), `@axe-core/playwright` (accessibility tests), official type packages. Stretch only, with an ADR: `tesseract.js`, `ml-levenberg-marquardt`. Anything else: ask.

**Repo layout:**

```
apps/web        Vite + React app
apps/signal     Cloudflare Worker + Durable Object (signaling only)
packages/protocol  zod schemas, framing, SAS
packages/rtc       peer connection, channels, file transfer, clock sync, reconnect
packages/vision    OpenCV worker: detect, rectify, enhance, (stretch) dewarp
packages/sensors   orientation sources, One Euro filter, pointer mapping
packages/ink       stroke smoothing (stretch)
packages/pdf       PDF assembly, size targeting
bench/  e2e/  scripts/
docs/   understand/ plan/ design/(adr/) test/(results/) review/ ship/ automate/ evidence/(sessions/, screenshots/)
```

**Platform facts to rely on (verify anything else in official docs):** camera, motion sensors and the Clipboard API need HTTPS or localhost · iOS needs `DeviceOrientationEvent.requestPermission()` from a tap · Safari has no `ImageCapture` (draw the video frame instead) · `RelativeOrientationSensor` is Chromium-only (fall back to `deviceorientation`) · `showSaveFilePicker` is Chromium-only (fall back to Blob download) · keep heavy work in Web Workers (no main-thread task over 50 ms) · never render received text as HTML.

### 2.9 UI and polish rules (every UI task)

- **One design system.** Use only the tokens and components from T01D (`apps/web/src/ui/`). No one-off colours, fonts or spacing.
- **Look:** clean and modern; generous whitespace; one accent colour; system font stack or one web font chosen in T01D; rounded cards; subtle shadows; light and dark themes following the OS setting.
- **Phone first on the phone route:** full-screen camera views, a bottom mode bar, touch targets at least 44 × 44 px, controls reachable with one thumb, no horizontal scrolling at 360 px width.
- **Laptop route:** a calm home screen with a large QR card and three-step "how it works"; after pairing, a clear workspace for the active mode.
- **Hide the plumbing:** never show raw JSON, IDs, SDP, stack traces or error codes. Errors are one plain sentence plus what to do next ("Your phone lost connection. Keep this tab open and scan the new code."). The connection doctor lives behind a small status pill ("Connected · same Wi-Fi") that opens an Advanced drawer.
- **Every state designed:** loading (skeletons or progress), empty, success, error and permission-denied states for each screen.
- **Motion:** short CSS transitions (150–250 ms) for mode switches, captures and arrivals (e.g. a scanned page sliding into the tray); respect `prefers-reduced-motion`.
- **Accessibility:** keyboard reachable, visible focus, labelled controls, WCAG AA contrast; `@axe-core/playwright` checks with zero serious or critical violations.
- **Visual check before every UI PR:** capture Playwright screenshots at 1440 × 900 (laptop) and 390 × 844 (phone), look at them (image input), compare with `docs/design/ui.md`, and fix anything misaligned, cramped or inconsistent before opening the PR. Attach the screenshots to the PR.

---

## Part 3 — Tasks (do them in order)

### Phase 1 — Foundation (week 1)

#### T01 · Repo foundation
- Stage: Build · Effort: medium · Depends: — · Status: done (PR #1)
- Build: pnpm monorepo with the layout in 2.8; TypeScript strict; ESLint + Prettier; Vitest with one sample test; minimal Vite + React app in `apps/web` showing "PhoneBridge"; Tailwind v4; GitHub Actions running lint, typecheck, unit tests on every PR; `scripts/evidence.ts` stub that prints commit trailers; create `docs/plan/PROGRESS.md`, `docs/plan/QUESTIONS.md`, `docs/design/decisions.md`, `docs/test/bug-log.md`, and `README.md` with a Setup section that every later task keeps accurate.
- Done when: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm dev` all work; CI passes on the PR.
- Verify: `pnpm install && pnpm lint && pnpm typecheck && pnpm test`

#### T01D · Design system and app shell
- Stage: Build · Effort: medium · Depends: T01 · Status: done (PR #2)
- Build: `docs/design/ui.md` defining the visual language (colour tokens for light and dark, type scale, spacing scale, radii, shadows, motion durations, icon style with `lucide-react`) and a short description of each main screen; implement tokens as Tailwind v4 theme variables; components in `apps/web/src/ui/`: Button (primary, secondary, ghost, sizes), Card, Sheet/Drawer, Modal, Toast, Progress bar, Spinner/Skeleton, Tabs, Segmented control, Status pill, Empty state, Error state; app shells for laptop (`/`) and phone (`/p/:token`, with bottom mode bar); a dev-only `/ui` gallery route showing every component in light and dark (excluded from production builds).
- Done when: the gallery renders every component in both themes; axe checks pass on the gallery; screenshots at both viewports are attached to the PR and look consistent.
- Verify: `pnpm test && pnpm test:e2e -- ui-gallery`

#### T02 · Capability diagnostics + HTTPS dev guide
- Stage: Understand · Effort: medium · Depends: T01 · Status: done (PR #3)
- Build: `/diagnostics` page that feature-detects camera, `ImageCapture`, `RelativeOrientationSensor`, `deviceorientation`, Clipboard read/write, File System Access, WebGL2, WebGPU, Document Picture-in-Picture, shown as a table. Write `docs/ship/dev-https.md`: step-by-step for making the dev server reachable over HTTPS from a phone (tunnel or locally trusted certificate). Write `docs/understand/browser-capabilities.md` (expected support; confirmed later by H3).
- Done when: unit tests for each detector with mocked globals; page renders in Playwright Chromium.
- Verify: `pnpm test && pnpm test:e2e -- diagnostics`

#### T03 · Vision research, OpenCV packaging, detection, baseline
- Stage: Understand · Effort: high · Depends: T01 · Human: H5 for the dataset · Status: done (PR #4)
- Build:
  - ADR-0002: OpenCV.js packaging (official build vendored in `packages/vision/vendor/`, or `@techstark/opencv-js`). Load it in a Web Worker (browser) and in Node (tests).
  - `packages/vision` document detection, exactly:
    1. downscale so the longest side is 320 px (preview) or 1000 px (refine); grayscale; Gaussian blur 5×5
    2. Canny with automatic thresholds: lower = 0.67 × median intensity, upper = 1.33 × median
    3. dilate 3×3 once; `findContours` (external only)
    4. for the 5 largest contours: `approxPolyDP` with epsilon = 2% of perimeter; keep convex 4-point polygons covering ≥ 20% of the frame
    5. pick the best by area × rectangularity (polygon area ÷ its min-area rotated rect area); order corners TL, TR, BR, BL
    6. fallback when none: `minAreaRect` of the largest contour, flagged `fallback: true`
  - Synthetic test generator: text page warped by random known homographies plus blur, noise and shadow gradients.
  - `scripts/download-smartdoc.ts` (SmartDoc 2015 Challenge 1; never commit the dataset; record its licence in `docs/understand/datasets.md`) and `bench/vision` computing polygon IoU against ground truth.
  - `docs/understand/document-detection.md` explaining the method.
- Done when: synthetic tests recover corners within 2 px at 1000 px; if the dataset is available, `pnpm bench:vision` prints mean IoU and writes `bench/baseline.json`. If not, set only the benchmark part `blocked (H5)` and finish the rest.
- Benchmark: blocked (H5), pending access to the official sample archive.
- Verify: `pnpm test -- vision && pnpm bench:vision`

#### T04 · Plan, design docs, protocol package
- Stage: Plan · Effort: high (xhigh for the threat model) · Depends: T01 · Status: done (PR #5)
- Build: `docs/plan/prd.md`; `docs/design/architecture.md` with an SVG diagram; `docs/design/protocol.md`; `docs/design/threat-model.md`; ADR-0001 (signaling host: Cloudflare Worker + Durable Object, fallback Node + `ws`), ADR-0003 (WebGL2 first). Implement `packages/protocol`:
  - **Envelope:** `{ v: 1, id: uuid, t: senderMs, type, ...payload }`; on `v` mismatch reply `error {code: "version_mismatch"}`.
  - **Messages (zod schema each, validated on receive):**
    - `hello` (both): `device: "laptop"|"phone"`, `caps: string[]`
    - `ping`/`pong` (both): `seq`; pong echoes sender time and adds receive/reply times
    - `mode.set` (phone→laptop): `"scan"|"doccam"|"clicker"|"ink"|"clipboard"`
    - `surface.info` (laptop→phone): `aspect` (width ÷ height of slide/whiteboard area)
    - `scan.meta` (phone→laptop): `scanId, width, height, mime: "image/jpeg", bytes, corners?` (4 normalized [x,y], TL TR BR BL), `capturedAt`
    - `file.offer` (both): `transferId, name, size, mime, kind: "file"|"scan"|"clip-image"`; `file.accept`/`file.reject` (`reason?`); `file.done` (`sha256` hex); `file.cancel`
    - `clip.text` (both): `text` ≤ 1 MB UTF-8
    - `pointer.sample` (phone→laptop, `rt` only): `seq, dx, dy` (filtered degrees from last recenter), `t`; `pointer.recenter`; `laser.set {on}`
    - `slide.next` / `slide.prev` / `slide.goto {page}`
    - `ink.begin {strokeId, color, baseWidth}`; `ink.points {strokeId, pts: [x,y,t,pressure][]}` (x,y in 0–1); `ink.end {strokeId}`; `ink.undo`; `ink.clear`
    - `doccam.state {active, facingMode: "environment"|"user"}`
    - `error {code, message}`
  - **Binary framing for `bulk`:** bytes 0–15 transferId (UUID raw), 16–19 chunk index (uint32 BE), 20–23 total chunks (uint32 BE), 24–end payload; total chunk size 16 KiB.
  - **SAS:** 4 digits derived from SHA-256 of both DTLS fingerprints (sorted, concatenated).
- Done when: unit tests for every message (valid and invalid), framing round-trip, SAS determinism.
- Verify: `pnpm test -- protocol && pnpm typecheck`

#### T04S · Codex skills
- Stage: Automate · Effort: medium · Depends: T04 · Status: blocked (H5)
- Build: check the official Codex docs for how repo-level skills are defined and where they live, then create: (1) `add-protocol-message` (schema + tests + `docs/design/protocol.md`); (2) `vision-bench` (run benchmark, compare with baseline, summarise); (3) `bug-fix` (reproduce → failing test → fix → log in `docs/test/bug-log.md`). Document them in `docs/automate/skills.md`. Use them in later tasks and tag each use with `Codex-Capabilities: skill:<name>`.
- Done when: the skills exist in the documented location and each ran once successfully. If skills are unsupported in this Codex, ask (2.4) and keep them as Markdown playbooks in `docs/automate/`.

#### T05 · Signaling Worker
- Stage: Build · Effort: high · Depends: T04 · Human: H1 only if `wrangler dev` needs login · Status: done (PR #7)
- Build: `apps/signal`: create room with a 128-bit random token (base64url, 22 chars, `crypto.getRandomValues`); WebSocket messages `join {role: "host"|"phone", room}`, `peer-joined`, `sdp {description}`, `ice {candidate}`, `peer-left`, `error {code}`; relay `sdp`/`ice` between the two sockets only; one phone per room (second gets `room_full`); room expires 10 minutes after creation if unjoined (Durable Object alarm) and immediately when either side leaves; never log SDP, ICE or message contents.
- Done when: unit tests with mocked sockets and time cover join, relay, room_full, expiry; runs with `wrangler dev`.
- Verify: `pnpm test -- signal`

#### T06 · Pairing, channels, clock sync, connection doctor
- Stage: Build · Effort: xhigh · Depends: T05, T01D · Status: done (PR #8)
- Build:
  - Laptop `/`: create `RTCPeerConnection`, read its DTLS fingerprint from local SDP, get a room, show a QR for `https://<site>/p/<token>#fp=<fingerprint>` (fingerprint in the fragment so no server sees it), status line Waiting → Connecting → Connected.
  - Phone `/p/:token`: join, exchange SDP/ICE via the Worker. **Before accepting the laptop's description, compare its `a=fingerprint` with `fp` from the fragment; on mismatch abort with "Pairing not secure".**
  - Both show the SAS digits.
  - Channels: `control` (reliable, ordered, JSON), `bulk` (reliable, ordered, binary), `rt` (unordered, `maxRetransmits: 0`, pointer samples only).
  - Clock sync: 8 pings at start and every 30 s; offset = ((t2−t1)+(t3−t4))/2, RTT = (t4−t1)−(t3−t2); use the lowest-RTT sample.
  - Connection doctor (both sides), hidden behind a status pill ("Connected · same Wi-Fi") that opens an Advanced drawer: connection type from `getStats()` succeeded candidate pair (host = same network, srflx = through NAT, relay = TURN), RTT, outgoing bitrate, channel states, "Copy diagnostics".
  - Reconnect: ICE `disconnected` > 5 s → `restartIce()`; after 3 failures show "Reconnect" with a fresh QR.
  - STUN: a public STUN server (e.g. `stun:stun.l.google.com:19302`).
- Done when: Playwright with two contexts against `wrangler dev` reaches Connected with all three channels in < 5 s; tampered fingerprint aborts; second phone gets `room_full`.
- Verify: `pnpm test && pnpm test:e2e -- pairing`

#### T07 · Real-device pairing check
- Stage: Test · Effort: low · Depends: T06 · Human: H2, H3 · Status: blocked (H2, H3)
- Build: test steps for the human in `docs/test/device-matrix.md` (same Wi-Fi; laptop on phone hotspot); after results come back, fix failures with the bug-fix flow and record results.
- Done when: both rows pass.

### Phase 2 — Scanner, PDF, files, clipboard (week 2)

#### T08 · Phone preview detection
- Stage: Build · Effort: high · Depends: T03, T06 · Status: done (PR #10)
- Build: rear camera `getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } } })`; torch toggle when `track.getCapabilities().torch` exists; load OpenCV lazily in a worker when Scan mode opens (progress bar; HTTP caching); run T03 detection at ~15 fps on 320 px frames; smooth each corner with EMA α = 0.4 (*tune*); overlay green when locked, amber for fallback; fps counter with `?debug=1`. Create `e2e/fixtures/page.y4m` (short video of a document) and launch the phone context with `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream --use-file-for-fake-video-capture=e2e/fixtures/page.y4m`.
- Done when: E2E with the fake camera shows a detected quadrilateral; no main-thread task > 50 ms.
- Verify: `pnpm test:e2e -- scan-detect`

#### T09 · Capture and send
- Stage: Build · Effort: high · Depends: T08 · Status: done (PR #11)
- Build: auto-capture when for 500 ms (a) no corner moved more than 1.5% of the frame diagonal and (b) variance of the Laplacian of the 320 px grayscale frame ≥ 100 (*tune*); manual shutter always works; full-res capture via `ImageCapture.takePhoto()` where available, else draw the current frame at full track resolution; JPEG quality 0.92; send `scan.meta` (with normalized corners) + bulk transfer with SHA-256 check.
- Done when: E2E capture arrives on the laptop with a matching hash.
- Verify: `pnpm test:e2e -- scan-capture`

#### T10 · Rectify, enhance, page tray
- Stage: Build · Effort: high · Depends: T09 · Status: done (PR #12)
- Build (laptop, Web Worker):
  1. Refine: rerun detection at 1000 px; use it if within 3% of the phone's corners, else keep the phone's.
  2. Rectify: width = max(|TR−TL|, |BR−BL|), height = max(|BL−TL|, |BR−TR|); if height ÷ width is within 5% of 1.414 snap to A4; cap 2480 × 3508; `getPerspectiveTransform` + `warpPerspective` (cubic).
  3. Modes (per page, default Clean colour): Original; Clean colour (blur a 25%-scale copy with σ = 2% of its width, upsample, divide image by it, rescale 0–255, then gray-world white balance); Grayscale (Clean colour → gray); Black & white (Clean colour → gray → `adaptiveThreshold` Gaussian, block = nearest odd to 1.5% of width, C = 10, *tune*).
  4. Page tray: thumbnails, drag reorder, rotate 90°, delete, retake (phone returns to Scan), 4-handle corner editing that re-rectifies.
- Done when: synthetic tests within 2 px; golden images per mode; tray actions covered by E2E.
- Verify: `pnpm test -- vision && pnpm test:e2e -- tray`

#### T11 · PDF export with exact size target
- Stage: Build · Effort: high · Depends: T10 · Status: done (PR #13)
- Build (`packages/pdf`, Web Worker, `pdf-lib`): page size A4 when snapped, else pixels at 200 DPI. Size target algorithm: (1) encode each page at JPEG 0.8, its size = weight; (2) page budget = (target − 4 KB × pages) × weight ÷ total weight; (3) per page, binary search quality in [0.35, 0.95] for 8 steps for the largest size ≤ budget; if 0.35 is still too big, downscale × 0.85 and repeat; (4) assemble; if over target, cut the largest page's budget by 10% and redo it. Show the exact final size.
- Done when: 5 fixture pages at a 500 KB target → 450–500 KB; impossible-at-0.35 case downscales and meets target; output opens in `pdfjs-dist` with correct order.
- Verify: `pnpm test -- pdf`

#### T12 · Vision benchmark gate in CI
- Stage: Automate · Effort: medium · Depends: T03 · Human: H5 · Status: blocked (H5)
- Build: CI caches the SmartDoc subset and fails a PR if mean IoU drops more than 0.02 below `bench/baseline.json`. Only a PR titled `bench: update baseline` with a justification may change the baseline.
- Done when: a temporary breaking commit makes CI fail; reverting makes it pass.

#### T13 · File drop
- Stage: Build · Effort: high · Depends: T06 · Status: done (PR #14)
- Build: laptop drop zone + picker; phone `<input type="file" multiple>`; `file.offer` → auto-accept ≤ 50 MB, ask above → 16 KiB chunks on `bulk` with `bufferedAmountLowThreshold` = 1 MiB, pause above 8 MiB `bufferedAmount`, resume on `bufferedamountlow` → `file.done` with SHA-256 (`crypto.subtle.digest`) checked by the receiver; limit 500 MB; save with `showSaveFilePicker` where available else Blob download; progress with MB/s and cancel on both sides; sanitize received file names.
- Done when: 100 MB both ways with matching hashes; cancel frees memory; throughput logged.
- Verify: `pnpm test:e2e -- files`

#### T14 · Text clipboard
- Stage: Build · Effort: medium · Depends: T06 · Status: in-progress
- Build: phone text box + "Paste from phone" (`navigator.clipboard.readText()` on tap) + Send; laptop writes with `navigator.clipboard.writeText()` if focused, else toast with a Copy button; laptop → phone the same way (phone shows text with a Copy button). Render as text, never HTML.
- Done when: Hindi + emoji round-trip E2E; no-focus path shows the Copy button.
- Verify: `pnpm test:e2e -- clipboard`

#### T15 · Security review 1
- Stage: Review · Effort: xhigh · Depends: T06, T13, T14 · Human: H6 for `@codex review` · Status: todo
- Build: review pairing, fingerprint check, schema validation, file names, rendering of received text, permission prompts; write `docs/review/security-review.md`; fix findings in separate PRs. Do not auto-merge this PR.
- Done when: every finding is fixed or accepted with a written reason.

### Phase 3 — Document camera, presenter, TURN (week 3)

#### T16 · Doc-cam stream and WebGL2 warp
- Stage: Build · Effort: xhigh · Depends: T06, T03 · Status: todo
- Build: phone sends the rear camera as a video track (ideal 1920×1080, 30 fps) with torch toggle; laptop uploads each frame to a WebGL2 texture; fragment shader maps each output pixel through the inverse homography to the source (bilinear) with optional contrast/brightness; homography maths in TypeScript, unit-tested against OpenCV.
- Done when: fake-camera E2E renders a rectified output; homography tests pass.
- Verify: `pnpm test && pnpm test:e2e -- doccam`

#### T17 · Doc-cam tracking, lock, pop-out
- Stage: Build · Effort: high · Depends: T16 · Status: todo
- Build: every 200 ms copy a 480 px frame to an `OffscreenCanvas` → vision worker → corners; EMA α = 0.3 (*tune*); keep last good corners on failure; "Lock page" from the phone freezes corners; "Pop out" via Document Picture-in-Picture where supported, else a normal window, so the user can share it in Meet/Zoom; fps counter.
- Done when: fake-camera E2E corners within 2% of expected; still-page jitter < 1% of diagonal.

#### T18 · Adaptive quality
- Stage: Build · Effort: high · Depends: T16 · Status: todo
- Build: phone reads `getStats()` every 2 s; if `qualityLimitationReason` is `bandwidth` or packet loss > 5%, raise `scaleResolutionDownBy` 1 → 1.5 → 2 via `RTCRtpSender.setParameters`; step back up after 10 s of good conditions.
- Done when: with CDP network throttling in E2E, the stream continues at lower resolution and recovers.

#### T19 · Presenter: slides and clicker
- Stage: Build · Effort: medium · Depends: T06 · Status: todo
- Build: laptop "Present a PDF" with `pdfjs-dist`, fit-to-screen, fullscreen, keyboard arrows; overlays: laser dot (10 px radius, glow, 150 ms fading trail) and ink layer; phone: large Next/Previous buttons and a "Hold for laser" button (press = recenter + `laser.set {on: true}`, release = off).
- Done when: E2E: PDF loads; Next/Previous work from phone and keyboard; fullscreen works.

#### T20 · Sensor pipeline and laser
- Stage: Build · Effort: high · Depends: T19 · Status: todo
- Build (`packages/sensors`): source = `RelativeOrientationSensor({ frequency: 60, referenceFrame: "screen" })` → quaternion → yaw/pitch; fallback `deviceorientation` alpha/beta with 0/360 wrap; iOS permission only from a tap; injectable test source via `window.__pbTestSensor` (stripped from production); dx, dy = angles minus recenter values; One Euro filter per axis (minCutoff 1.0 Hz, beta 0.007, dCutoff 1.0 Hz, *tune*); send `pointer.sample` at 60 Hz on `rt` only. Laptop: x = centre + gain × dx, y = centre − gain × dy, gain = screen width ÷ 30°, clamp, interpolate per animation frame. Add `bench/rt` scripts for jitter (10 s at rest, RMS px) and latency (clock-synced, p50/p95).
- Done when: One Euro tests (constant stays constant; step converges; jitter on a recorded noisy trace drops ≥ 70%); samples only on `rt`.
- Verify: `pnpm test -- sensors`

#### T21 · Real-device measurements
- Stage: Test · Effort: low · Depends: T17, T20 · Human: H3 · Status: todo
- Build: the human runs `bench/rt` and the doc-cam fps check; commit results with device names to `docs/test/results/`; any missed target becomes a bug-fix task.

#### T22 · TURN and cross-network pairing
- Stage: Build · Effort: high · Depends: T06 · Human: H4 · Status: todo
- Build: ADR-0004 provider choice (check current free tiers, e.g. Cloudflare Realtime TURN, Metered); the Worker issues short-lived TURN credentials from Wrangler secrets; connection doctor shows `relay`.
- Done when: unit tests for credential issuing; the human confirms phone-on-mobile-data pairs with laptop-on-Wi-Fi.

#### T23 · Image clipboard
- Stage: Build · Effort: medium · Depends: T13, T14 · Status: todo
- Build: images sent as `file.offer` with `kind: "clip-image"`; written with `ClipboardItem` where supported, else offered as a download.

### Phase 4 — Stretch, freeze, automation (week 4)

#### T24 · Drawing tablet (Stretch)
- Stage: Build · Effort: high · Depends: T19 · Only if all Must and Should tasks are done · Status: todo
- Build: laptop sends `surface.info`; phone full-screen canvas at that aspect; Pointer Events with `getCoalescedEvents()`, batches every 16 ms into `ink.points`; laptop renders Catmull-Rom → cubic Bézier, width = baseWidth × clamp(1.4 − speed ÷ 2.0, 0.5, 1.4) (speed in normalized units/s, *tune*), × pressure for pen; colours, undo, clear; over the current slide or a blank whiteboard.
- Done when: golden stroke images from recorded points; undo restores the previous image exactly.

#### T25 · Dewarping or OCR (Stretch, ask the human which)
- Stage: Build · Effort: xhigh · Depends: T10 · Only if T24 is done or skipped and before T26 · Status: todo
- Dewarping: a "Book page" toggle porting the `page_dewarp` method (Matt Zucker; check its licence): detect text lines, sample points, fit a cubic-sheet page model + pose by Levenberg–Marquardt, remap. Done when MS-SSIM improves over planar rectification on a DocUNet subset.
- OCR: Tesseract.js (English + Hindi) in a worker; draw recognised words into the PDF as fully transparent text at their boxes. Done when Ctrl+F in Chrome's PDF viewer finds a known word.

#### T26 · Judge flow and landing page (feature freeze after this task)
- Stage: Build · Effort: medium · Depends: T11, T14, T17 · Status: todo
- Build: landing page with a 60-second guided demo, sample slide PDF, printable sample page; a full polish pass over every screen against 2.9 and `docs/design/ui.md` (consistent spacing, every state designed, plain-language errors, smooth transitions, dark mode); favicon, app icon and social preview image.
- Done when: Lighthouse scores ≥ 90 for Performance, Accessibility and Best Practices on the landing page (record them in `docs/test/results/`); axe checks show zero serious or critical violations on every route; a person who has never seen the app completes the judge flow without help.

#### T27 · Automation and Evidence Pack generator
- Stage: Automate · Effort: medium · Depends: T12 · Status: todo
- Build: nightly benchmark workflow (results committed to `docs/test/results/`); Firefox/WebKit best-effort E2E; release-on-tag workflow (production deploy + GitHub Release); PR preview deploys; a nightly scheduled task (a Codex scheduled task if available, otherwise a GitHub Actions cron) that checks benchmarks and dependency updates and opens an issue on regression; full `scripts/evidence.ts` reading trailers via `git log --format` with `%(trailers:key=...,valueonly)` and writing `docs/evidence/EVIDENCE.md` (per-stage sections with links, capabilities used, model/effort by stage with reasons, escalations, PRs with Codex reviews) and `evidence.json`; `/built-with-codex` page rendering it; `docs/automate/automations.md`.
- Done when: every workflow has a green run; the Evidence Pack is generated from real history.

#### T27E · Automated evidence screenshots
- Stage: Automate · Effort: medium · Depends: T27 · Status: todo
- Build: `scripts/capture-evidence.ts` (Playwright) saving to `docs/evidence/screenshots/`: **app/** every mode (pairing + QR, doctor, scanner overlay and tray, PDF export, doc-cam, presenter with laser, clipboard/files, `/diagnostics`, `/built-with-codex`; fake camera and test sensor where needed); **github/** this repo's public pages (commit history, PR list, ≥ 3 PRs with `@codex review` comments, Actions runs, the scheduled workflow's history, README); **codex/** try to capture the Codex interface (model/effort picker, cloud tasks, skills, scheduled-task settings) if this environment can take screenshots, otherwise raise checkpoint H8; plus `docs/evidence/screenshots/README.md` indexing every image with a caption and date. Add a weekly Actions job that refreshes `app/` and `github/`.
- Done when: ≥ 15 screenshots across `app/` and `github/`; index complete; EVIDENCE.md links to it.
- Verify: `pnpm evidence:screenshots`

#### T28 · Security review 2
- Stage: Review · Effort: xhigh · Depends: T26 · Status: todo
- Build: repeat T15 over all code added since; update `docs/review/security-review.md`. Do not auto-merge.

### Phase 5 — Ship and document

#### T29 · Production deploy and device matrix
- Stage: Ship · Effort: medium · Depends: T26, T27 · Human: H1, H3 · Status: todo
- Build: production deploy of Pages + Worker; `docs/ship/runbook.md` (deploy and rollback); live URL in README; the human runs the full device matrix in `docs/test/device-matrix.md`: Android Chrome + Windows Chrome on same Wi-Fi; Android + Windows Edge with laptop on phone hotspot; phone on mobile data + laptop on Wi-Fi (TURN); an iPhone on Safari if available.

#### T30 · Documentation set
- Stage: Document · Effort: low · Depends: T29 · Status: todo
- Build: README written like a product page first and a developer guide second, in this order: (1) name, one-line pitch, prominent **Try it live** link, demo GIF; (2) "Use it in 30 seconds": three plain steps for normal users; (3) Features: each mode with a screenshot; (4) How it works: architecture diagram and a privacy line (nothing uploaded or stored); (5) Results: benchmark table; (6) Browser support and limitations; (7) Built with Codex: link to the Evidence Pack; (8) "Run it yourself": **clear setup instructions** from a fresh clone (prerequisites, install, run locally, HTTPS on phone, tests, deploy); (9) Contributing and licence. Keep developer detail out of sections 1–7; `docs/user-guide.md` per mode; `docs/troubleshooting.md`; `CONTRIBUTING.md`; JSDoc on every exported function in `packages/*`; `docs/design/*` matching the final code.
- Done when: following the README in a fresh directory works exactly as written; every doc link resolves.

#### T31 · Evidence Pack and submission check
- Stage: Document · Effort: low · Depends: T30, T27E · Human: H7, H8 (only if Codex could not capture its own interface) · Status: todo
- Build: re-run screenshots against the live URL; check every task has `docs/evidence/sessions/T<NN>.md`; regenerate and finish `docs/evidence/EVIDENCE.md`; verify every item in 2.7 with a link to its proof; scan the repo and history for secrets, personal data and confidential code; confirm the repo is public (ask the human to change it if not).
- Done when: every 2.7 item is ticked with a link.

---

## Part 4 — Human checkpoints (only the human can do these)

When a task needs one that is not done: set the task `blocked (H#)`, write exact instructions in `docs/plan/QUESTIONS.md`, and continue with the next unblocked task.

| ID | What the human does | Needed for |
| --- | --- | --- |
| H1 | Create a Cloudflare account and run `wrangler login` | T29 (T05 only if local dev requires it) |
| H2 | Make the dev server reachable over HTTPS from the phone, following `docs/ship/dev-https.md` | T07 |
| H3 | Run real-device tests and paste the results back | T07, T21, T29 |
| H4 | Sign up for a TURN provider and add credentials as Wrangler secrets | T22 |
| H5 | Accept dataset licences / download the dataset if registration is required | T03 benchmark, T12 |
| H6 | Enable the Codex GitHub integration (code review) on the repo | `@codex review` from T15 on |
| H7 | Record the 3-minute demo video | T31 |
| H8 | Screenshots of the Codex interface, only if Codex cannot capture them | T31 |

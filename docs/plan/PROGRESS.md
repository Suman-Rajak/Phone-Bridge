# Progress

## T01 · Repo foundation

Merged in [PR #1](https://github.com/Suman-Rajak/Phone-Bridge/pull/1) with [passing CI](https://github.com/Suman-Rajak/Phone-Bridge/actions/runs/45605684064/job/139175814338). Frozen-lockfile install, lint, typecheck, one Vitest test, the production build, and a Chromium browser check passed locally.

The workspace uses Node.js 24 and pnpm 11.25.0. See the [session evidence](../evidence/sessions/T01.md) and [decisions](../design/decisions.md).

## T01D · Design system and app shell

Delivered in [PR #2](https://github.com/Suman-Rajak/Phone-Bridge/pull/2). Two Vitest and three Chromium tests passed, with zero serious or critical axe violations. The phone mode bar fits at 360 px, and the gallery is excluded from production assets. See the [UI specification](../design/ui.md) and [session evidence](../evidence/sessions/T01D.md).

## T02 · Capability diagnostics and HTTPS development guide

Delivered in [PR #3](https://github.com/Suman-Rajak/Phone-Bridge/pull/3). The diagnostics route checks ten capabilities. Twenty-six unit tests and six Chromium tests passed locally, with zero serious or critical axe findings. Local HTTPS and the tunnel hostname configuration passed server checks. See the [browser capability matrix](../understand/browser-capabilities.md), [HTTPS development guide](../ship/dev-https.md), and [session evidence](../evidence/sessions/T02.md).

## T03 · Vision research and document detection

Delivered the OpenCV package, worker, detector, and SmartDoc benchmark runner in [PR #4](https://github.com/Suman-Rajak/Phone-Bridge/pull/4). Maximum refine corner error was 1.452 px across six synthetic pages. The SmartDoc baseline is blocked on [H5](QUESTIONS.md#h5--smartdoc-sample-access-t03-benchmark). See the [session evidence](../evidence/sessions/T03.md).

## T04 · Plan, design docs, and protocol package

Delivered the product requirements, architecture, threat model, and versioned protocol package in [PR #5](https://github.com/Suman-Rajak/Phone-Bridge/pull/5). Local verification passed with 69 unit tests and seven Chromium tests. See the [session evidence](../evidence/sessions/T04.md).

## T04S · Repository skills

Authored and discovered all three repository skills in [PR #6](https://github.com/Suman-Rajak/Phone-Bridge/pull/6). The protocol and bug-fix workflows passed isolated exercises. The live vision benchmark exercise is blocked on [H5](QUESTIONS.md#h5--smartdoc-sample-access-t03-benchmark). See the [session evidence](../evidence/sessions/T04S.md).

## T05 · Signaling Worker

Delivered the local Wrangler Worker, typed signaling contract, and Durable Object rooms in [PR #7](https://github.com/Suman-Rajak/Phone-Bridge/pull/7). Verified real loopback WebSocket relay and cleanup. Local Wrangler required no Cloudflare login. See the [session evidence](../evidence/sessions/T05.md).

## T06 · WebRTC pairing

Delivered QR pairing, the pinned DTLS fingerprint, all three data channels, clock sync, and the connection diagnostics drawer in [PR #8](https://github.com/Suman-Rajak/Phone-Bridge/pull/8). Local verification passed with 91 unit tests and nine browser tests. Separate browser contexts connected within five seconds after QR setup. See the [session evidence](../evidence/sessions/T06.md).

## T07 · Real-device pairing

The [device test matrix](../test/device-matrix.md) is ready for the Wi-Fi and phone-hotspot checks. T07 remains blocked on [H2 and H3 results](QUESTIONS.md#h2-and-h3--real-device-pairing-t07).

## T08 · Phone scanner preview

Added rear-camera preview and document detection on the paired phone in [PR #10](https://github.com/Suman-Rajak/Phone-Bridge/pull/10). The Chromium fixture showed four detected corners, roughly 15 fps, and zero main-thread tasks over 50 ms during startup and detection. The laptop and dark phone passed axe with no serious or critical findings. The SmartDoc benchmark remains blocked on H5. See the [session evidence](../evidence/sessions/T08.md).

## T09 · Scan capture and delivery

Delivered automatic and manual capture and verified scan delivery in [PR #11](https://github.com/Suman-Rajak/Phone-Bridge/pull/11). Local verification passed with 97 unit tests and eleven browser tests. The phone and laptop reported matching JPEG dimensions and SHA-256, and a digest mismatch preserved the previous scan. See the [session evidence](../evidence/sessions/T09.md).

## T10 · Page rectification and tray

Delivered page straightening, four appearance modes, and tray editing in [PR #12](https://github.com/Suman-Rajak/Phone-Bridge/pull/12). Four synthetic landmarks landed within two pixels. All four appearance goldens matched, and 106 unit tests and twelve Chromium tests passed locally. The tray preserves verified pages during a disconnect. See the [session evidence](../evidence/sessions/T10.md).

## T11 · Size-targeted PDF export

Delivered ordered PDF export in [PR #13](https://github.com/Suman-Rajak/Phone-Bridge/pull/13). The browser exported five pages into 479,236 bytes against a 500,000-byte target, and PDF.js verified their order. Local verification passed with 109 unit tests and fourteen browser tests. See the [session evidence](../evidence/sessions/T11.md).

T12 is waiting on the SmartDoc archive and baseline in [H5](QUESTIONS.md#h5--smartdoc-sample-access-t03-benchmark).

## T13 · Bidirectional file transfer

Delivered file pickers, laptop drag and drop, confirmation, progress, verified saving, and cancellation in [PR #14](https://github.com/Suman-Rajak/Phone-Bridge/pull/14). Chromium transferred and downloaded 100 MB each way with matching SHA-256. The optimized focused loopback run measured 2.70 MB/s laptop to phone and 2.97 MB/s in reverse. The same-Wi-Fi goal still needs a physical-device run. See the [session evidence](../evidence/sessions/T13.md).

## T14 · Text clipboard

Delivered two-way text sharing in [PR #15](https://github.com/Suman-Rajak/Phone-Bridge/pull/15). The browser test round-tripped Hindi, emoji, and literal markup over WebRTC. It verified automatic copy when focused, an explicit Copy action when unfocused, and manual selection on permission denial. All 114 unit tests and sixteen browser tests passed locally. See the [session evidence](../evidence/sessions/T14.md).

T15 is blocked on [H6](QUESTIONS.md#h6--codex-github-code-review-t15).

## T16 · Live document camera

The phone streams its camera to the laptop, which flattens the page and offers contrast and brightness controls. The pixel check, OpenCV matrix comparison and graphics-loss fallback passed. Next is T17, live page tracking, lock and pop-out. [PR #16](https://github.com/Suman-Rajak/Phone-Bridge/pull/16) · [Session evidence](../evidence/sessions/T16.md)

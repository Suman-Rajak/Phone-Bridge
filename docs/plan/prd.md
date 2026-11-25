# PhoneBridge product requirements

## Goal

Turn a phone into tools for a laptop after one QR scan. Both devices use their existing browser. The primary users are people who need to scan a document, show it live in a meeting, or pass a file between devices without installing companion software.

## Experience

The laptop opens PhoneBridge and shows a pairing QR code. The phone scans with its camera and opens the pairing link. Both devices show connection status and the same four-digit verification code. The phone can then switch modes, while the laptop shows the corresponding workspace. The demo goal is pairing, scanning a page, switching to the document camera, and using the laser pointer in under 60 seconds.

| Priority | Requirement                                                      | Acceptance signal                                                      |
| -------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Must     | Pair with one QR scan and display the connection state           | The laptop and phone show Connected and provide connection diagnostics |
| Must     | Detect, capture, rectify, and clean document pages               | Flattened pages appear in a reorderable laptop tray                    |
| Must     | Export a multi-page PDF at a chosen size                         | The result opens in order and is between 90% and 100% of the target    |
| Must     | Send files and text clipboard contents in either direction       | Files arrive with matching hashes, and multilingual text round-trips   |
| Must     | Share a live, flattened document camera                          | The laptop displays the live rectified page                            |
| Should   | Present PDF slides using the phone as a clicker and laser        | Phone controls advance slides and move the pointer in the laptop tab   |
| Should   | Pair across networks and support image clipboard                 | Relay appears in diagnostics, and images paste or download             |
| Stretch  | Draw from the phone, dewarp curved paper, or add searchable text | Follow the corresponding roadmap acceptance test                       |

## Targets and constraints

Track mean corner IoU ≥ 0.90, scan arrival ≤ 3 s on the same Wi-Fi, file throughput ≥ 5 MB/s, live rectification ≥ 24 fps, laser jitter ≤ 2 px RMS, and pointer latency p95 ≤ 60 ms. Publish measured results with test setup and device details. The [roadmap](../ROADMAP.md) defines the verification steps and checkpoints.

Keep content in the browsers and send it over WebRTC. Place expensive image, PDF, and hashing work in workers. Keep the UI usable with touch and keyboard and provide fallbacks when an API is unavailable. PhoneBridge has no accounts, native apps, analytics, cloud file storage, or control of other apps or tabs. See the [UI specification](../design/ui.md) and [architecture](../design/architecture.md).

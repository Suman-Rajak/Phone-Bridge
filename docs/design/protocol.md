# PhoneBridge protocol v1

The peers exchange JSON over `control` and `rt`, and binary frames over `bulk`. The signaling WebSocket is separate and carries room membership plus SDP and ICE negotiation. PhoneBridge validates data channel traffic in `@phonebridge/protocol`. [Architecture](architecture.md) · [Zod schema reference](https://zod.dev/api)

| Channel   | Reliability and payload                                                  |
| --------- | ------------------------------------------------------------------------ |
| `control` | Reliable, ordered JSON. All JSON messages except pointer samples.        |
| `bulk`    | Reliable, ordered binary chunks.                                         |
| `rt`      | Unordered and unreliable with `maxRetransmits: 0`. Only pointer samples. |

## Signaling

`POST /rooms` creates a room and returns `201` with `{ "room": "<token>" }`. The Worker encodes 16 cryptographically random bytes as 22 unpadded base64url characters. `GET /rooms/:token` upgrades an existing room connection to WebSocket. Browser origins must match the Worker’s comma-separated `ALLOWED_ORIGINS`. Local development allows the Vite loopback origins on port 5173.

| Type          | Direction                     | Payload                                                                                                                                                                           |
| ------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `join`        | Client → Worker               | `role` is `host` or `phone`. `room` is the token for that WebSocket.                                                                                                              |
| `peer-joined` | Worker → Both                 | Both roles have joined.                                                                                                                                                           |
| `sdp`         | Between joined peers          | `description` contains an `offer` or `answer` type and an SDP string.                                                                                                             |
| `ice`         | Between joined peers          | `candidate` is an ICE candidate JSON object or `null` for end-of-candidates. The candidate object has `candidate` and optional `sdpMid`, `sdpMLineIndex`, and `usernameFragment`. |
| `peer-left`   | Worker → Remaining connection | A joined peer left and the room is closing.                                                                                                                                       |
| `error`       | Worker → Client               | `code` is `room_full`, `room_missing`, `room_expired`, `invalid_message`, `join_required`, or `peer_missing`.                                                                     |

Signaling uses strict JSON objects without the data channel envelope. The Worker forwards SDP and ICE only after both roles join. A second phone receives `room_full`. An unpaired room expires after 10 minutes. Departing members close the room and clear its stored metadata. The Worker bounds signaling text frames at 128 Ki UTF-16 code units, SDP at 64 Ki code units, and the candidate string at 4 Ki code units. The Worker does not log or persist SDP, ICE, or message payloads.

## Data channel JSON envelope

Each message is a flat object with `v: 1`, `id` as a UUID, `t` as the sender timestamp in milliseconds, and a `type` discriminator. Payload fields sit beside the envelope fields. Unknown fields and unknown types are invalid. Timestamps are finite and nonnegative. A receiver supplies the actual channel and known peer role when validating a frame.

For an unsupported integer version, the receiver sends the returned `error` payload once over `control` with its own v1 envelope and ends the incompatible session. It drops incompatible error frames without replying. A malformed message or a message on the wrong channel or from the wrong role is rejected without inspecting its contents in the application. Bump the version and update this document for a breaking wire change.

| Type                       | Sender | Payload                                                                                                                                                                                                                                                                               |
| -------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hello`                    | Either | `device` is `laptop` or `phone` and matches the sender. `caps` is an array of strings.                                                                                                                                                                                                |
| `ping`                     | Either | `seq` is an unsigned 32-bit sequence number. `t` is the sender’s ping time.                                                                                                                                                                                                           |
| `pong`                     | Either | `seq` and `sentAt` echo the ping sequence and timestamp. `receivedAt` and `repliedAt` use the replying peer’s clock.                                                                                                                                                                  |
| `mode.set`                 | Phone  | `mode` is `scan`, `doccam`, `clicker`, `ink`, or `clipboard`.                                                                                                                                                                                                                         |
| `surface.info`             | Laptop | `aspect` is positive width divided by height.                                                                                                                                                                                                                                         |
| `scan.meta`                | Phone  | `scanId` is a UUID. `width`, `height`, and `bytes` are positive integers. `mime` is `image/jpeg`. `capturedAt` uses the phone’s clock. Optional `corners` contains four normalized `[x, y]` pairs in TL, TR, BR, BL order. Optional `replacesScanId` names a laptop-requested retake. |
| `scan.retake`              | Laptop | `scanId` is the UUID of the page to replace. The phone opens Scan and sets `replacesScanId` on its next capture for this request.                                                                                                                                                     |
| `file.offer`               | Either | `transferId` is a UUID. `name` is a nonempty untrusted string. `size` is a nonnegative byte count. `mime` is a string and `kind` is `file`, `scan`, or `clip-image`.                                                                                                                  |
| `file.accept`              | Either | `transferId` references the offer.                                                                                                                                                                                                                                                    |
| `file.reject`              | Either | `transferId` references the offer. `reason` is optional text.                                                                                                                                                                                                                         |
| `file.done`                | Either | `transferId` and `sha256`, a 64-character hex digest of the complete file.                                                                                                                                                                                                            |
| `file.cancel`              | Either | `transferId` references the offer.                                                                                                                                                                                                                                                    |
| `clip.text`                | Either | `text` is UTF-8 text up to 1,000,000 bytes.                                                                                                                                                                                                                                           |
| `pointer.sample`           | Phone  | `seq` is an unsigned 32-bit sequence number. `dx` and `dy` are filtered degree offsets. Envelope `t` is the sample timestamp.                                                                                                                                                         |
| `pointer.recenter`         | Phone  | No payload.                                                                                                                                                                                                                                                                           |
| `laser.set`                | Phone  | `on` is boolean.                                                                                                                                                                                                                                                                      |
| `slide.next`, `slide.prev` | Phone  | No payload.                                                                                                                                                                                                                                                                           |
| `slide.goto`               | Phone  | `page` is a positive one-based page index.                                                                                                                                                                                                                                            |
| `ink.begin`                | Phone  | `strokeId` is a UUID. `color` is `#RRGGBB`. `baseWidth` is positive.                                                                                                                                                                                                                  |
| `ink.points`               | Phone  | `strokeId` and a batch of 1–256 `[x, y, t, pressure]` tuples. Coordinates and pressure are normalized from 0 to 1.                                                                                                                                                                    |
| `ink.end`                  | Phone  | `strokeId` references an active stroke.                                                                                                                                                                                                                                               |
| `ink.undo`, `ink.clear`    | Phone  | No payload.                                                                                                                                                                                                                                                                           |
| `doccam.state`             | Phone  | `active` is boolean. `facingMode` is `environment` or `user`.                                                                                                                                                                                                                         |
| `error`                    | Either | `code` and `message` are nonempty strings.                                                                                                                                                                                                                                            |

The schema verifies a message’s shape. The application must verify transfer or stroke state, enforce feature-level limits, sanitize file names, and keep raw content out of logs. [Threat model](threat-model.md)

## Binary bulk frames

| Byte offsets | Field                                                      |
| ------------ | ---------------------------------------------------------- |
| 0–15         | UUID bytes in standard textual UUID order, without hyphens |
| 16–19        | Zero-based chunk index as uint32 big-endian                |
| 20–23        | Total chunks as uint32 big-endian                          |
| 24–end       | Chunk payload, 1–16,360 bytes                              |

The header is 24 bytes and the total is at most 16 KiB. The index must be smaller than the total. Zero-byte files use their transfer messages without binary chunks. The receiver verifies the announced size and SHA-256 before making a completed file available.

### Scan transfer

The phone sends `scan.meta` on `control`. Use its `scanId` for the bulk chunk UUID and each transfer message’s `transferId`. The laptop accepts one scan at a time and rejects JPEGs above 32 MiB or 64 megapixels.

1. The laptop sends `file.accept` once it has reserved the receiver. The phone waits for acceptance before sending on `bulk` so early frames cannot arrive ahead of the metadata.
2. The phone sends the ordered chunks and its `file.done` with the SHA-256. The laptop waits for both the digest and every declared byte because the two channels deliver independently.
3. The laptop validates the JPEG dimensions and SHA-256 in a worker. It displays the scan and replies with `file.done` containing the verified digest. The phone shows success after receiving that reply. A failed check sends `file.reject`. A canceled or interrupted transfer releases its buffers.

Scan transfer uses the existing version 1 schemas.

The phone adds `replacesScanId` only after receiving `scan.retake`. The laptop accepts a replacement only for a pending request and keeps the previous scan until the new JPEG passes verification. Existing capture messages keep their version 1 format.

### File transfer

Either peer sends `file.offer` with `kind: "file"`. The receiver accepts up to 50,000,000 bytes automatically, asks the user above that size, and declines files over 500,000,000 bytes. The receiver treats the offered name as untrusted text and sanitizes it before display or saving.

After `file.accept`, the sender streams 16 KiB frames on `bulk`, pauses at 8 MiB queued, and resumes at the 1 MiB low-buffer threshold. The sender announces the SHA-256 with `file.done`. Once the complete byte sequence matches, the receiver makes the file available and replies with `file.done` carrying the same digest. The receiving worker hashes an empty file without any bulk frames.

Either peer may send `file.cancel` during a transfer. Both peers stop the active job and release its buffers. An interruption or stalled transfer also releases temporary data. The signaling Worker stays outside the file flow.

### Text clipboard

Either peer sends `clip.text` on `control` after the user selects Send. The existing version 1 validator allows up to 1,000,000 UTF-8 bytes. The receiving interface displays the text in a plain-text field and provides a Copy action when browser permissions or focus prevent an automatic laptop write.

## Short authentication string

Normalize both SHA-256 DTLS fingerprints to lowercase 64-character hex, sort them lexicographically, concatenate them as UTF-8, and hash with SHA-256. Take the first four digest bytes as an unsigned big-endian integer, reduce modulo 10,000, and left-pad to four digits. The all-zero fingerprint and the all-`ff` fingerprint produce `8846` in either input order. This code supports human comparison. The phone independently pins the laptop fingerprint from the QR before accepting the remote description. [Web Crypto digest](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest)

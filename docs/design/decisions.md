# Decisions

## T01 · Workspace and checks

- Use Node.js 24 for local development and CI. The evidence script runs directly with Node.js and reads Git trailers with `git log`.
- Use ESLint for JavaScript, strict TypeScript with unused-code checks for TypeScript, and Prettier for formatting. This keeps the initial setup within the roadmap's dependency list.
- Render the React component to static markup in Vitest to check the starter heading without a browser runtime. Use Playwright for the browser screenshot.

Followed the official [Tailwind Vite installation guide](https://tailwindcss.com/docs/installation/using-vite) and [ESLint parser configuration](https://eslint.org/docs/latest/use/configure/parser).

## T01D · Design system and app shell

- Use semantic Tailwind theme colors with system light and dark values. The gallery previews an explicit theme without changing the application preference.
- Use native dialogs for both overlays so supporting browsers manage focus and Escape consistently. Keep the same close control in the basic fallback.
- Keep shell mode selection local until pairing is implemented. The laptop pairing card uses a decorative icon and tells the user that pairing is unavailable.
- Load the gallery through Vite’s development flag. Playwright tests both themes, the overlays, keyboard interaction, and the phone shell at 360 px.

See the [UI specification](ui.md), [Tailwind theme variables](https://tailwindcss.com/docs/theme), [Vite environment flags](https://vite.dev/guide/env-and-mode), and [Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing).

## T02 · Browser diagnostics and local HTTPS

- Separate browser feature checks from React and test them with supplied browser globals. Check API availability without invoking protected APIs. WebGL2 is the exception because context creation can fail even when the interface exists.
- Display secure-context failures separately from missing APIs. Use separate rows for clipboard read and write because support can differ.
- Keep Vite’s default HTTP development startup. Enable HTTPS when both certificate paths are provided and use Vite’s exact hostname allowlist when running behind a tunnel. [Vite server options](https://vite.dev/config/server-options)

## T03 · Vision research and detector

- Pin the same OpenCV.js build in Node and the browser. Keep browser detection in a dedicated worker so scanner integration can load it independently of the main application. [ADR 0002](adr/0002-opencv-js.md)
- Return source-image pixels. The preview resize rounds dimensions independently, so convert each axis back with its own scale.
- Sample three positions per annotated SmartDoc sequence and count misses as zero. Preserve any existing baseline to keep follow-up benchmark runs reproducible. [SmartDoc setup](../understand/datasets.md)

## T04 · Protocol and design

- Use strict, flat versioned JSON objects. Validate expected sender and channel at the receive boundary.
- Use UTF-8 byte length for clipboard limits and explicit UUID byte ordering for binary frames.
- Canonicalize both fingerprints before sorting and hashing so the four-digit comparison code is stable across formatting and peer order. [Wire protocol](protocol.md)

## T05 · Signaling

- Validate signaling separately from the peer data channel. Use the same schemas for client and Worker parsing. [Wire protocol](protocol.md#signaling)
- Persist only the deadline or paired marker and each socket’s role. The local room logic accepts injected sockets and time so expiry and relay rules can be verified without waiting for alarms.
- Accept browser requests from explicit configured origins. The room token still controls access to the specific room.
- Allow the exact locked esbuild and workerd binary setup hooks needed by Wrangler. [pnpm build settings](https://pnpm.io/settings/build#allowbuilds)

## T06 · WebRTC pairing

- Check the effective SHA-256 fingerprint across SDP media sections before applying a remote description. The phone pins the laptop fingerprint from the QR fragment. Once the host accepts the first phone fingerprint, reuse that pin on later negotiations. Both devices display the existing four-digit SAS for comparison. [Pairing threat model](threat-model.md) · [WebRTC security architecture](https://www.rfc-editor.org/rfc/rfc8827.html)
- Create the three channels on the laptop. Mark both interfaces Connected only after DTLS connects, all three channels open, and the SAS is available. Use the host as the impolite peer to resolve simultaneous offers on ICE restart. [WebRTC perfect negotiation](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation)
- Use monotonic clocks for the eight-sample sync and a selected ICE pair for diagnostics. Copy the same status fields shown in the drawer so the report contains no room data or network addresses. [WebRTC statistics](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/getStats)

## T08 · Phone scanner preview

- Ask for camera access when the user chooses Start camera in Scan. Run the detector on one frame at a time at up to 15 fps. Cap the preview’s longer side at 320 px and transfer resized bitmaps to the worker for pixel readback. Use a small canvas to supply RGBA data when the browser cannot transfer resized bitmaps. [Browser bitmap API](https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap)
- Keep OpenCV in the lazily loaded worker bundle. Vite names the production worker asset by content hash, so the browser can reuse a cached copy until it changes. The progress bar advances as the camera, worker runtime, and first detection result become available.
- Smooth normalized corners with alpha 0.4 and reset the smoother when detection switches between a page lock and fallback. The preview stops the track and terminates the worker when leaving Scan.

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

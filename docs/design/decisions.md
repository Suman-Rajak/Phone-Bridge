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

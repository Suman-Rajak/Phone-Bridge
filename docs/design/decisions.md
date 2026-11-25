# Decisions

## T01 · Workspace and checks

- Use Node.js 24 for local development and CI. The evidence script runs directly with Node.js and reads Git trailers with `git log`.
- Use ESLint for JavaScript, strict TypeScript with unused-code checks for TypeScript, and Prettier for formatting. This keeps the initial setup within the roadmap's dependency list.
- Render the React component to static markup in Vitest to check the starter heading without a browser runtime. Use Playwright for the browser screenshot.

Followed the official [Tailwind Vite installation guide](https://tailwindcss.com/docs/installation/using-vite) and [ESLint parser configuration](https://eslint.org/docs/latest/use/configure/parser).

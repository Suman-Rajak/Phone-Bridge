export default [
  {
    ignores: [
      ".pnpm-store/",
      "**/dist/",
      "**/.wrangler/",
      "coverage/",
      "playwright-report/",
      "test-results/",
    ],
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    rules: {
      "no-duplicate-imports": "error",
      "no-empty": "error",
      "no-unreachable": "error",
      "no-unused-vars": "error",
      "prefer-const": "error",
    },
  },
];

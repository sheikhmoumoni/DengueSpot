import js from "@eslint/js";
import ts from "typescript-eslint";
export default ts.config(
  {
    files: ["apps/web/public/sw.js"],
    languageOptions: {
      globals: {
        self: "readonly",
        caches: "readonly",
        fetch: "readonly",
        URL: "readonly",
        Response: "readonly",
      },
    },
  },
  {
    ignores: [
      "**/.next/**",
      "**/node_modules/**",
      "**/.data/**",
      "test-results/**",
      "playwright-report/**",
      "**/next-env.d.ts",
      "artifacts/**",
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    files: ["**/*.mjs"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        URL: "readonly",
        fetch: "readonly",
        AbortSignal: "readonly",
      },
    },
  },
);

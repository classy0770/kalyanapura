import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default defineConfig([
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ["scripts/**/*.cjs"],
    languageOptions: {
      globals: Object.fromEntries(["require", "module", "__dirname", "process", "console", "URL", "Request", "fetch", "document", "window"].map((name) => [name, "readonly"])),
    },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "@next/next": nextPlugin, "react-hooks": reactHooks },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      ...reactHooks.configs.recommended.rules,
    },
    settings: { next: { rootDir: "." } },
  },
  globalIgnores([".next/**", "out/**", "coverage/**", "next-env.d.ts"]),
]);

import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * Path aliases from tsconfig.json, sorted as their own import group. `\b` (rather than `$`)
 * also matches type imports, which simple-import-sort suffixes with \u0000.
 */
const aliases = "^@(/|(app|assets|components|ui|db|hooks|i18n|lib|models|services|stores)\\b)";

export default tseslint.config(
  { ignores: ["dist", "src-tauri", "src/db/migrations"] },

  {
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: { react: { version: "19.2" } },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],

      // Project rule: one component per file.
      "react/no-multi-comp": ["error", { ignoreStateless: false }],
      "react/jsx-key": "error",
      "react/self-closing-comp": "error",
      "react/jsx-no-useless-fragment": "error",
      "react/jsx-boolean-value": "error",
      "react/jsx-curly-brace-presence": ["error", { props: "never", children: "never" }],

      // Project rule: imports go through path aliases; relative imports stay inside a folder.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../*"],
              message: "Import through a path alias (@components/…, @hooks, …) instead.",
            },
          ],
        },
      ],
      "simple-import-sort/imports": [
        "error",
        { groups: [["^\\u0000"], ["^node:"], ["^@?\\w"], [aliases], ["^\\."]] },
      ],
      "simple-import-sort/exports": "error",

      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "@typescript-eslint/no-import-type-side-effects": "error",
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      eqeqeq: ["error", "smart"],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "prefer-const": "error",
      "object-shorthand": "error",
    },
  },

  // Node scripts and config files.
  {
    files: ["scripts/**/*.ts", "*.config.{js,ts}"],
    languageOptions: { globals: globals.node },
    rules: { "no-restricted-imports": "off", "no-console": "off" },
  },
  {
    files: ["**/*.js"],
    extends: [tseslint.configs.disableTypeChecked],
  },

  // Must stay last: turns off rules that conflict with Prettier.
  prettier,
);

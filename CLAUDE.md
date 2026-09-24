# leari

Minimalistic open source multi-account mail client (Google/Workspace, Outlook/365, IMAP, POP3).
Tauri 2 + React 19 + TypeScript. Tray / menu bar app only: no dock icon (macOS `ActivationPolicy::Accessory`),
closing the window hides it.

## Conventions (must follow)

- **One component per `.tsx` file.** Enforced by ESLint `react/no-multi-comp`.
- **Folders by category** under `src/components/<category>/`, each with an `index.ts` barrel.
  The same applies to `hooks/`, `stores/`, `services/`.
- **Always import through path aliases**, never deep relative paths across categories:
  `@components/<category>`, `@ui`, `@hooks`, `@stores`, `@services`, `@db`, `@models`, `@lib`, `@i18n`, `@app`, `@assets/*`.
  Aliases live in `tsconfig.json` `paths` (Vite reads them via `resolve.tsconfigPaths`). Add new ones there.
  Siblings inside the same category folder import each other relatively (`./X`).
- **shadcn/ui**: add components with `pnpm ui:add <name>`. It runs `scripts/split-ui.ts`, which splits the generated
  file into `src/components/ui/<name>/<Component>.tsx` + `index.ts`. Never keep multi-component shadcn files.
- **All user-facing text goes through i18next.** Add keys to every locale in `src/i18n/locales/*` (en, pt-BR).
  Namespaces: common, mail, accounts, settings. Keys are type-checked.
- **Data**: Drizzle schema in `src/db/schema`. After changing it run `pnpm db:generate`. Migrations are applied at startup by
  `src/db/migrate.ts`. Queries live in `src/services`; components use TanStack Query hooks from `@hooks`, never `db` directly.
- **State**: server/DB data → TanStack Query; UI state → Zustand stores in `@stores`.
- **Styling**: Tailwind 4 + theme tokens in `src/styles/globals.css`. The palette comes from the Lear's macaw
  (cobalt/indigo primary, yellow `highlight`/`star` accent). Use tokens, not raw colors. Font: Roboto.
- Secrets (passwords, OAuth tokens) must never be stored in SQLite. Use the OS keychain.

## Commands

- `pnpm app`: run the app (tauri dev)
- `pnpm typecheck && pnpm lint`: run before finishing a change
- `pnpm format`: Prettier (with tailwind class sorting)

## Brand

Icon sources: `assets/brand/gen_icon.py` generates `app-icon.svg`, `tray-icon.svg` and `src/assets/logo-mark.svg`
(a Lear's macaw with open wings). Rasterize to PNG, then run `pnpm tauri icon assets/brand/app-icon.png`.
The tray PNG is `src-tauri/icons/tray-icon.png` (macOS template image, black + alpha).

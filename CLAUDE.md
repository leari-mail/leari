# leari

Minimalistic open source multi-account mail client (Google/Workspace, Outlook/365, IMAP, POP3).
Tauri 2 + React 19 + TypeScript. Tray / menu bar app: no dock icon by default (macOS `ActivationPolicy::Accessory`;
the "Show in Dock / taskbar" setting switches it at runtime), closing the window hides it.

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
- Secrets (passwords, OAuth tokens) must never be stored in SQLite. Use the OS keychain (`src-tauri/src/credentials.rs`).
- **Sync engine (Rust)**: `src-tauri/src/mail` (IMAP client, parsing, persistence) and `src-tauri/src/sync` (scheduler, events).
  Rust writes rows into the Drizzle-owned schema with raw SQL (`mail/store.rs`), so schema changes must be mirrored there.
  UI mutations never talk to the server: they update SQLite and queue a `pending_operations` row, then call `syncService.push`.
- OAuth (`src-tauri/src/oauth`): PKCE + loopback redirect; tokens never go to the webview (the UI gets an opaque
  handle and calls `oauth_attach`). Client ids are build-time env (`.env.local`, CI secrets); see `.env.example`.
- Git: work on feature branches off `main` (`feat/...`, `fix/...`, `chore/...`), merged through pull requests.
  Add user-facing changes to `CHANGELOG.md` under **Unreleased**.
- Relative imports may not leave their folder (`../` is a lint error); use aliases. Rust: no `unwrap()` outside tests.
- Releases: `pnpm release <alpha|beta|rc|stable|patch|minor|major>` on `main`, then `git push --follow-tags`.
  The version lives in `package.json` (Tauri reads it; the script syncs `Cargo.toml`). Currently in alpha.

## Commands

- `pnpm app`: run the app (tauri dev)
- `pnpm check`: run before finishing a change (types, ESLint, Prettier, Vitest, rustfmt, clippy `-D warnings`, Rust tests)
- `pnpm lint:fix`: autofix, including import sorting (packages → aliases → relative)
- `pnpm format`: Prettier (with tailwind class sorting)
- `pnpm test`: frontend unit tests (Vitest, `src/**/*.test.ts`).
- `pnpm screenshots [name…]`: regenerate `docs/screenshots/*` (macOS) from the fictional demo data in `src/db/seed.ts`,
  in a separate app profile; never capture real mail for docs. Each shot is a scene staged by
  `src/hooks/app/useScreenshotMode.ts` (reader, composer, selection, drag, folders); add new ones there and in the script.
- `pnpm test:rust`: Rust unit tests. The IMAP end-to-end test is ignored by default (see README, "Testing IMAP sync locally")

## Brand

Icon sources: `assets/brand/gen_icon.py` generates `app-icon.svg`, `tray-icon.svg` and `src/assets/logo-mark.svg`
(a Lear's macaw perched with raised wings, traced from a reference photo). Rasterize to PNG (app icon 1024 px, tray 44 px),
then run `pnpm tauri icon assets/brand/app-icon.png` (delete the android/ and ios/ folders it creates).
The tray PNG is `src-tauri/icons/tray-icon.png` (macOS template image, black + alpha).
The installer window background comes from `assets/brand/gen_dmg_background.py` (660x400): it redraws the icon's scene
(imported from `gen_icon.py`) exactly where Finder shows the icon and extends its sky and branch. Render it
at 660 and 1320 px, then `tiffutil -cathidpicheck bg.png bg@2x.png -out src-tauri/icons/dmg-background.tiff`.
Its icon positions must match `bundle.macOS.dmg` in `tauri.conf.json`.

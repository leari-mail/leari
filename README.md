<p align="center">
  <img src="assets/brand/app-icon.png" width="128" alt="leari" />
</p>

<h1 align="center">leari</h1>

<p align="center">A minimalistic, open source, multi-account mail client that lives in your menu bar.</p>

---

**leari** is named after the Lear's macaw (_Anodorhynchus leari_), an indigo-blue macaw
found only in Bahia, Brazil. The name is also a nod to Parrot, an earlier mail client.
The macaw's cobalt plumage and yellow eye-ring are the basis of leari's colors and icon.

## Features

- **Multi-account:** Google / Workspace, Outlook / Microsoft 365, and any IMAP or POP3 server
- **Unified folders:** All Inboxes, Starred, Sent, Drafts, Archive and Trash across every account
- **Menu bar / tray app:** no dock icon; closing the window hides it
- **Three-pane layout:** resizable sidebar, message list and reader
- **Keyboard friendly:** `↑`/`↓` or `j`/`k` to navigate, `⌘N` to compose, `⌘,` for settings
- **Light and dark themes**, following the system by default
- **Languages:** English and Português (Brasil)

### Roadmap

- [x] App shell: tray / menu bar, window behavior, single instance
- [x] Local database with migrations
- [x] Mail UI: sidebar, message list, reader, composer, settings
- [x] Add account flow (provider presets for Google and Microsoft)
- [ ] IMAP sync (Rust)
- [ ] POP3 download
- [ ] SMTP sending
- [ ] OAuth 2 sign-in for Google and Microsoft
- [ ] Credentials in the OS keychain
- [ ] Attachments
- [ ] Notifications and unread badge on the tray icon
- [ ] Threaded conversations

## Platform notes

| Platform | Where leari lives                 | Notes                                      |
| -------- | --------------------------------- | ------------------------------------------ |
| macOS    | Menu bar (no dock icon)           | Translucent sidebar, hidden title bar      |
| Windows  | System tray (hidden from taskbar) |                                            |
| Linux    | System tray                       | Clicking the tray icon only opens its menu |

Left-click the tray icon to show or hide the window. The tray menu has **Open**, **New Message**
and **Quit**.

## Stack

| Layer    | Tech                                                                  |
| -------- | --------------------------------------------------------------------- |
| Shell    | [Tauri 2](https://tauri.app) (Rust)                                   |
| UI       | React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Lucide icons, Roboto |
| State    | TanStack Query (data), Zustand (UI state)                             |
| Database | SQLite via `tauri-plugin-sql` + Drizzle ORM                           |
| i18n     | i18next / react-i18next                                               |

## Development

Prerequisites: [Tauri prerequisites](https://tauri.app/start/prerequisites/), Node 24+, pnpm 10+.

```sh
pnpm install
pnpm app            # run the desktop app (tauri dev)
```

In development, an empty database is seeded with demo accounts and messages.
The database lives in the app data directory. On macOS that is
`~/Library/Application Support/com.leari.mail/leari.db`. Delete it to start fresh.

| Script               | What it does                                                 |
| -------------------- | ------------------------------------------------------------ |
| `pnpm app`           | Run the app with hot reload                                  |
| `pnpm tauri build`   | Build installers                                             |
| `pnpm typecheck`     | TypeScript check                                             |
| `pnpm lint`          | ESLint                                                       |
| `pnpm format`        | Prettier (with Tailwind class sorting)                       |
| `pnpm db:generate`   | Generate a migration after changing `src/db/schema`          |
| `pnpm ui:add <name>` | Add a shadcn/ui component, split into one file per component |

## Project structure

```
src/
  app/          App root, providers, query client
  components/   One folder per category, one component per file, index.ts barrels
    ui/         shadcn/ui primitives (split by scripts/split-ui.ts)
  db/           Drizzle schema, migrations, client, dev seed
  hooks/        TanStack Query hooks and app-level hooks
  i18n/         i18next setup and locales
  lib/          Pure helpers
  models/       Domain types
  services/     Data access (Drizzle queries)
  stores/       Zustand stores
  styles/       Tailwind entry and theme tokens
src-tauri/      Rust: tray, window behavior, plugins
assets/brand/   Icon sources (gen_icon.py generates the SVGs)
scripts/        Tooling (shadcn splitter)
```

## Contributing

Conventions (see also [CLAUDE.md](CLAUDE.md)):

- **One component per `.tsx` file**, enforced by ESLint (`react/no-multi-comp`).
- **Group by category.** Components live in `src/components/<category>/`, each folder with an
  `index.ts` barrel. The same goes for hooks, stores and services.
- **Use path aliases for imports:** `@components/<category>`, `@ui`, `@hooks`, `@stores`,
  `@services`, `@db`, `@models`, `@lib`, `@i18n`, `@app`, `@assets/*`. They are defined in
  `tsconfig.json`.
- **Components never query the database directly.** They use TanStack Query hooks from `@hooks`,
  which call `@services`.
- **Every user-facing string goes through i18next**, with keys added to every locale.
- **Use theme tokens** from `src/styles/globals.css` instead of raw colors.
- Run `pnpm typecheck && pnpm lint` before opening a pull request.

### Adding a language

1. Copy `src/i18n/locales/en` to `src/i18n/locales/<code>` and translate the JSON files.
2. Register it in `src/i18n/resources.ts` and `src/i18n/languages.ts`.
3. Add its `date-fns` locale in `src/lib/format.ts`.

## License

[MIT](LICENSE)

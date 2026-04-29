# TECH_DESIGN_V2.md - Folio (macOS + Windows Desktop ePub Reader)

> Generated from PRD v1 plus the explicit V2 directive to add Windows desktop support. This document supersedes `TECH_DESIGN.md` for V2 implementation. Unless explicitly changed below, Folio keeps the currently shipped feature scope and interaction model; the separate PRD V2 backlog items (collections, in-book search, reading statistics, sync, dictionary lookup, reading goals) are still out of scope for this platform-expansion spec.

---

## 0. Locked Decisions

1. **Folio V2 is desktop-only and supports exactly two operating systems: macOS and Windows.** Linux, iOS, Android, and web are out of scope.
2. **The Windows release targets feature parity with the current macOS app.** Windows support does not introduce new reader, library, translation, or sync features by itself.
3. **Folio remains a managed-library app.** On import, each `.epub` is copied into a Folio-owned per-user app data directory, and the reader always opens that managed copy.
4. **Managed storage paths are platform-specific but product-stable.** The canonical data roots are:
   - macOS: `~/Library/Application Support/Folio`
   - Windows: `%LOCALAPPDATA%\Folio`
   The Rust backend resolves these paths; no renderer code hardcodes them.
5. **The SQLite schema remains shared across both platforms.** There is one schema, one migration chain, and no platform-specific tables or columns.
6. **OpenRouter remains the only translation provider.** There is still no provider abstraction, provider picker, or custom base URL surface.
7. **Translation stays paragraph-addressed in storage and rendering, but request transport remains chunked.** The worker still sends 10-20 consecutive paragraphs per OpenRouter request and persists one row per paragraph.
8. **The renderer never receives the saved API key.** V2 continues the Rust-only secret boundary, but storage is now described as native secure storage rather than macOS Keychain only.
9. **Secure secret storage uses the platform-native backend through `keyring`.** macOS uses Keychain, Windows uses Credential Manager. The V2 error code is `SECURE_STORAGE_ERROR`.
10. **All macOS-only implementation shortcuts are removed.** V2 must not depend on `sips`, `/dev/urandom`, Finder-specific copy, or any other Apple-only runtime tool.
11. **Native titlebars remain on both platforms.** There is no custom titlebar, no frameless shell, and no platform-specific chrome redesign.
12. **Windows installers bundle WebView2 bootstrapper support.** V2 ships signed Windows installers with `webviewInstallMode = embedBootstrapper`.

---

## 1. Technology Stack

### Frontend (Renderer Process - Webview)

| Layer | Choice | Version | Reason |
|---|---|---|---|
| UI Framework | React | 18.3 | Existing renderer architecture stays intact across both desktop platforms |
| Language | TypeScript | 5.5 | Typed IPC boundaries remain critical as platform logic grows |
| Bundler | Vite | 5.4 | Keeps the current renderer build pipeline unchanged |
| Component Library | shadcn/ui | CLI-generated | Existing primitive layer remains sufficient; no Windows-only component library fork |
| CSS | Tailwind CSS | 3.4 | Single shared styling system across platforms |
| Global State | Zustand | 4.5 | Keeps transient reader/library UI state local and lightweight |
| Async Data / Cache | TanStack Query | 5.59 | No change to query/mutation and invalidation patterns |
| Forms | React Hook Form | 7.53 | Existing settings/forms architecture stays intact |
| Validation | Zod | 3.23 | Shared schema source for renderer form validation |
| ePub Renderer | epub.js | 0.3.93 | Reader rendering model is unchanged |
| Routing | React Router | 6.26 | Multi-window route tree remains unchanged |

### Backend (Rust - Tauri Process)

| Layer | Choice | Version | Reason |
|---|---|---|---|
| Desktop Framework | Tauri | 2.10 | Existing app shell remains, but now targets macOS and Windows |
| Database Driver | rusqlite | 0.31 | Embedded SQLite remains the only database |
| Migrations | rusqlite_migration | 1.2 | Same startup migration approach across platforms |
| HTTP Client (LLM) | reqwest | 0.12 | OpenRouter calls stay in Rust |
| Async Runtime | tokio | 1.40 | Same async runtime for Tauri commands and translation worker |
| Serialization | serde + serde_json | 1.0 | Shared IPC/event serialization |
| Hashing | sha2 | 0.10 | Duplicate detection and paragraph validation remain unchanged |
| ZIP / ePub Assembly | zip | 2.3 | Same import/export archive handling |
| Secure Storage | keyring | 3.3 | Uses Keychain on macOS and Credential Manager on Windows via one crate |
| ePub Metadata Parse | minidom + quick-xml | 0.15 / 0.36 | Existing OPF/NCX/Nav parsing remains unchanged |
| Cover Image Decode/Encode | image | 0.25 | Replaces macOS-only `sips` with cross-platform cover normalization |
| UUID Generation | uuid | 1.x | Replaces `/dev/urandom` helpers with cross-platform UUID v4 generation |

### Database

| Layer | Choice | Reason |
|---|---|---|
| Engine | SQLite 3 (embedded via rusqlite) | Local-only desktop app; same schema on both platforms |

### Infrastructure / Distribution

| Layer | Choice | Reason |
|---|---|---|
| Build | Tauri CLI 2.x (`tauri build`) | Keeps one shared build system for both targets |
| macOS Targets | arm64 + x86_64 universal binary | Preserve the current macOS distribution target |
| Windows Target | x86_64 | First Windows release ships one stable architecture; ARM64 is deferred |
| macOS Bundles | `.app` + `.dmg` | Same release format as V1 |
| Windows Bundles | `nsis` + `msi` | Consumer installer plus enterprise-friendly installer |
| Windows WebView Runtime | `embedBootstrapper` | Avoids fragile first-run install failures on machines missing WebView2 |
| Signing | Apple Developer ID + Authenticode code signing | Required to reduce trust warnings on both desktop platforms |

### Auth

None. Folio remains a single-user local desktop app with no authentication layer.

---

## 2. Project Structure

```text
/
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/
│   │   └── default.json
│   └── src/
│       ├── main.rs
│       ├── lib.rs                    <- Tauri builder, command registration, window lifecycle wiring
│       ├── platform/
│       │   ├── mod.rs
│       │   ├── menu.rs               <- macOS vs Windows native menu construction
│       │   ├── paths.rs              <- resolve app data root, Books/, Covers/, Desktop, DB path
│       │   └── windows.rs            <- clamp/restore persisted bounds to visible monitor work area
│       ├── db/
│       │   ├── mod.rs
│       │   ├── schema.rs
│       │   └── migrations.rs
│       ├── commands/
│       │   ├── books.rs
│       │   ├── highlights.rs
│       │   ├── notes.rs
│       │   ├── reader.rs
│       │   ├── translations.rs
│       │   ├── export.rs
│       │   └── settings.rs
│       ├── epub/
│       │   ├── mod.rs
│       │   ├── importer.rs           <- import pipeline; uses `image` crate for cover normalization
│       │   └── exporter.rs
│       ├── llm/
│       │   ├── mod.rs
│       │   ├── client.rs
│       │   └── worker.rs
│       └── secure_store.rs           <- thin wrapper over `keyring`; replaces `keychain.rs`
│
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── windows/
│   │   ├── LibraryWindow.tsx
│   │   ├── ReaderWindow.tsx
│   │   └── SettingsWindow.tsx
│   ├── components/
│   │   ├── ui/
│   │   ├── library/
│   │   ├── reader/
│   │   └── settings/
│   ├── hooks/
│   ├── store/
│   ├── lib/
│   │   ├── tauri-commands.ts
│   │   ├── epub-bridge.ts
│   │   ├── quote-canvas.ts
│   │   └── utils.ts
│   ├── types/
│   └── styles/
│
├── PRD.md
├── TECH_DESIGN.md
├── TECH_DESIGN_V2.md
└── tasks.md
```

**Folder rules:**
- `src-tauri/src/platform/` is the only place allowed to contain OS branches (`#[cfg(target_os = ...)]`) for menu, path, and window-restoration behavior.
- `src-tauri/src/secure_store.rs` is the only place allowed to call `keyring`.
- `src-tauri/src/db/mod.rs`, `src-tauri/src/epub/importer.rs`, `src-tauri/src/commands/export.rs`, and any save-dialog default logic must resolve paths through `platform::paths`, never by hardcoding `Library/Application Support`.
- `src/components/ui/` remains shadcn output only.
- `src/lib/tauri-commands.ts` remains the only renderer file that calls `invoke()`.
- Renderer code must not branch on operating system for layout. Platform differences are limited to copy, menu entry points, and error text where required.

---

## 3. Data Model and Persistence

### 3a. Schema Compatibility

The V2 Windows support release does **not** add or remove tables. The following tables remain unchanged from V1:

| Table | Purpose | Change in V2 |
|---|---|---|
| `books` | Managed library metadata, file paths, last position, progress | No column change |
| `highlights` | Paragraph / range highlights | No column change |
| `notes` | Note bodies and linked highlights | No column change |
| `translations` | Paragraph-level bilingual translation fragments | No column change |
| `translation_jobs` | Long-running translation job status | No column change |
| `reading_settings` | Per-book reader display preferences | No column change |
| `app_settings` | Global settings and persisted window bounds | No column change |

### 3b. Persisted Paths

V2 keeps absolute managed file paths in SQLite, but the root now resolves through one platform helper:

| Artifact | macOS | Windows |
|---|---|---|
| App data root | `~/Library/Application Support/Folio` | `%LOCALAPPDATA%\Folio` |
| Database | `.../folio.db` | `.../folio.db` |
| Managed books | `.../Books/{book_id}.epub` | `...\\Books\\{book_id}.epub` |
| Extracted covers | `.../Covers/{book_id}.png` | `...\\Covers\\{book_id}.png` |
| Default export dir | Desktop resolved via path API | Desktop resolved via path API |

### 3c. `app_settings` Keys

The following keys remain the canonical persisted app settings:

- `llm_model`
- `window_state_library`
- `window_state_settings`
- `window_state_{book_id}`

No platform suffixes are added to window-state keys. The database is per-machine and per-user; cross-platform sharing is not a requirement.

### 3d. Native Secure Storage

Secrets are not stored in SQLite. The OpenRouter API key is stored under:

- service: `"com.folio.app"`
- account: `"llm_api_key"`

Backends:

- macOS: Keychain
- Windows: Credential Manager

---

## 4. Frontend Architecture

### 4a. Design System

**Overall aesthetic:** Preserve the existing Folio look on both platforms: dark library chrome, large book covers, minimal reader chrome, and a Books-inspired reading experience. V2 does **not** redesign the app into WinUI or platform-native themed shells.

**Shell theme:** Dark-only shell UI remains unchanged. Reader content themes (Light / Sepia / Dark) continue to affect only the epub.js content area.

**Typography and spacing:** Reuse the existing tokens and Tailwind utility patterns from `src/styles/globals.css`. No separate Windows token set is introduced.

**Platform-neutral copy rules:**

- Do not mention Finder, Keychain, traffic lights, or any macOS-only term in renderer UI copy.
- Use neutral copy such as "Import Book", "drag .epub files here", "secure storage", and "Open file location" only if a new action is explicitly added.
- Shortcut strings displayed inside the renderer must use `CmdOrCtrl`-aware text helpers if added in the future. Hardcoded `Cmd` labels are not allowed.

### 4b. Responsive Breakpoints

Breakpoints remain unchanged:

| Breakpoint | Width | Layout Behavior |
|---|---|---|
| compact | < 700px | Sidebar hidden; 2-column book grid |
| standard | 700-999px | Sidebar collapsible; 3-column grid |
| full | >= 1000px | Sidebar always visible; 4+ column grid |

Reader-specific:

- `>= 800px`: horizontal margins 80px
- `< 800px`: horizontal margins 40px
- Minimum reader window size: `600 x 500`

### 4c. Page-to-Component Mapping

The window and component map stays the same as V1:

```text
src/windows/LibraryWindow.tsx
  ├── Sidebar
  ├── LibraryToolbar
  ├── BookGrid
  ├── BookContextMenu
  ├── BookInfoSheet
  ├── EmptyState
  ├── DropZone
  └── DuplicateBanner

src/windows/ReaderWindow.tsx
  ├── ReaderToolbar
  ├── EpubViewer
  ├── PageChevrons
  ├── ProgressBar
  ├── SelectionPopup
  ├── NoteEditor
  ├── TocDrawer
  ├── AnnotationsDrawer
  ├── DisplaySettingsPopover
  ├── TranslationBanner
  ├── TranslationSheet
  └── QuoteCoverModal

src/windows/SettingsWindow.tsx
  └── Tabs
      ├── GeneralTab
      └── TranslationTab
```

V2-specific UI adjustments:

- `TranslationTab` and any translation error copy must say "secure storage" instead of "macOS Keychain".
- Any path display component must wrap correctly for Windows paths containing backslashes and longer drive-prefixed roots.
- The Library empty/import states must remain wording-neutral across both OSes.

### 4d. Frontend Data Fetching Rules

No architecture change:

- TanStack Query remains the query/mutation layer.
- All IPC calls still go through `src/lib/tauri-commands.ts`.
- Hooks remain the only place where components consume backend data.
- Loading skeleton, inline retry, and invalidation patterns remain unchanged.

### 4e. Navigation and Routing

**Router:** React Router 6.26 (`BrowserRouter`)

Route map:

```text
/          -> LibraryWindow
/reader    -> ReaderWindow?bookId=
/settings  -> SettingsWindow
```

**Multi-window behavior:**

- `open_reader_window` still creates or focuses `reader-{bookId}`.
- `settings` remains a separate non-resizable window.
- Main window label remains `main`.
- Reader window titles remain `"{Book Title} - Folio"`.

**Native settings entry point:**

- macOS: app menu `Folio > Settings...` with accelerator `Cmd+,`
- Windows: `File > Settings` with accelerator `Ctrl+,`

There is no renderer-only settings button in V2; the current layout is preserved.

### 4f. Animation and Interaction Rules

The current animation rules remain intact:

- Reader page navigation remains paginated, not scroll-mode.
- Existing book-card entrance and reader entrance animations remain allowed.
- Reader keyboard navigation remains ArrowLeft/ArrowRight/ArrowUp/ArrowDown.
- Dropdowns, skeletons, and button states keep the current implementation rules.

No platform-specific animation fork is introduced.

---

## 5. API Design (Tauri IPC Commands)

### 5a. Command Stability

The V2 Windows-support release keeps the existing IPC surface stable wherever possible:

- No command names change
- No argument names change
- No event payload shapes change
- No new tables or foreign keys are introduced

This is intentional so the renderer migration stays focused on platform cleanup rather than API churn.

### 5b. Commands with Changed Semantics

**`import_book`**

- Still accepts `{ file_paths: string[] }`
- Still returns imported books, duplicates, and per-file errors
- V2 side effect change: the managed copy is written under the platform-resolved Folio data root, not a macOS-only hardcoded path
- Cover extraction and PNG normalization must be fully cross-platform

**`delete_book`**

- Still deletes the managed `.epub`, cover PNG, and all dependent rows
- Path cleanup must work for both POSIX and Windows file paths

**`save_api_key` / `has_api_key` / `clear_api_key` / `test_openrouter_connection`**

- Command shapes remain unchanged
- Backend terminology changes from Keychain-specific to secure-storage-specific
- Thrown error code changes from `KEYCHAIN_ERROR` to `SECURE_STORAGE_ERROR`

**`export_bilingual_epub` / `export_highlights`**

- Save dialogs still choose the destination
- Default folder becomes "Desktop resolved through the path API", not a macOS string path assumption
- Save-path validation must be correct on Windows case-insensitive filesystems

### 5c. Tauri Events

Translation and export events remain unchanged:

```text
translation:progress
translation:complete
translation:error
translation:paused
export:progress
```

No new frontend event bus is introduced for platform support.

---

## 6. Key Implementation Rules

1. **All `invoke()` calls stay in `src/lib/tauri-commands.ts` only.**
2. **All forms still use React Hook Form + Zod.**
3. **Tailwind remains the only renderer styling mechanism except for dynamic inline positioning values.**
4. **Every async Tauri wrapper must continue to throw typed `FolioError` objects with a `code` field.**
5. **OS branching is centralized.** `#[cfg(target_os = ...)]` is allowed only in `src-tauri/src/platform/` and `src-tauri/src/secure_store.rs`.
6. **All managed paths must resolve through `platform::paths`.** No code is allowed to call `home_dir().join("Library").join("Application Support")` directly.
7. **UUIDs must use the `uuid` crate.** No code may read `/dev/urandom` or generate UUID-like strings manually.
8. **Cover normalization must use the `image` crate.** No code may shell out to `sips` or any other external OS image utility.
9. **epub.js must still be initialized exactly once per `ReaderWindow` in `src/lib/epub-bridge.ts`.**
10. **All OpenRouter calls remain Rust-only.** The API key is read inside Rust from `secure_store.rs` and never serialized into renderer payloads.
11. **Highlights must still use the epub.js annotation API pattern already established in V1.**
12. **Bilingual injection must still happen through `rendition.hooks.content.register()` using `spine_item_href + paragraph_index` locators.**
13. **Reading-position saves stay debounced to at most once every 2 seconds.**
14. **SQLite remains a `Mutex<Connection>` inside app state.** There is still no connection pool.
15. **The CSP remains locked down.** V2 keeps the same script/style/connect rules; only managed asset scope paths expand to cover both supported data roots.
16. **Managed asset scope must be explicit.** `tauri.conf.json` must allow only:
    - `$HOME/Library/Application Support/Folio/**`
    - `$LOCALDATA/Folio/**`
    No broader home-directory asset scope is allowed.
17. **Window restoration must be monitor-safe.** Before showing any restored window, clamp its saved bounds into a currently visible monitor work area. Detached-monitor coordinates must never reopen windows off-screen.
18. **Renderer copy must be OS-neutral unless the UI element itself is OS-specific.**
19. **The secure-storage error code is `SECURE_STORAGE_ERROR`.** Frontend code must not ship macOS-specific Keychain wording after the V2 migration lands.
20. **Windows bundles must set `bundle.windows.webviewInstallMode.type = "embedBootstrapper"`.**

---

## 7. Component and Shell Patterns

### 7a. Window Root Pattern

The V1 window-root pattern remains valid. The only V2 shell additions are:

- settings window opening is native-menu driven on both OSes
- platform-specific shell behavior stays outside the React window roots

### 7b. Error Copy Pattern

Renderer error copy must be platform-neutral:

```ts
function getSecureStorageErrorMessage(error: unknown): string {
  if (error instanceof FolioError && error.code === "SECURE_STORAGE_ERROR") {
    return "Unable to access secure storage. Please try again."
  }
  return "Settings are temporarily unavailable. Please try again."
}
```

### 7c. Tauri Wrapper Pattern

`src/lib/tauri-commands.ts` keeps the current wrapper pattern, but migration code must normalize secure-storage failures to the new code:

```ts
function normalizeErrorCode(code: string): string {
  if (code === "KEYCHAIN_ERROR") {
    return "SECURE_STORAGE_ERROR"
  }
  return code
}
```

This alias exists only to smooth migration. New Rust code must emit `SECURE_STORAGE_ERROR` directly.

---

## 8. Technical Risks and Mitigations

**Risk: hardcoded macOS storage paths break Windows support**

Current code resolves app storage by manually joining `~/Library/Application Support/Folio`.

**Mitigation:** Introduce `platform::paths` and route all DB, import, export, and asset-path creation through it before any Windows work starts.

---

**Risk: current cover conversion is macOS-only**

`sips` does not exist on Windows, so cover extraction/import fails immediately.

**Mitigation:** Normalize cover images in-process with the `image` crate and always write PNG output into the managed `Covers/` directory.

---

**Risk: current UUID generation is POSIX-only**

Reading `/dev/urandom` fails on Windows.

**Mitigation:** Replace every manual UUID helper with `uuid::Uuid::new_v4()`.

---

**Risk: saved windows reopen off-screen on Windows multi-monitor setups**

Monitor topologies and DPI scaling change frequently on laptops with external displays.

**Mitigation:** Before showing a window with persisted bounds, clamp its rectangle into the closest visible monitor work area. If no saved rectangle fits, fall back to centered defaults.

---

**Risk: WebView2 runtime availability causes Windows installation failures**

Some Windows machines will not have WebView2 fully available at install time.

**Mitigation:** Ship Windows installers with `embedBootstrapper` and verify install/startup behavior on fresh Windows VMs.

---

**Risk: path comparisons behave differently on Windows**

Windows paths are case-insensitive and use drive prefixes plus backslashes; naive string comparisons can allow invalid export targets or false mismatches.

**Mitigation:** Centralize path normalization in Rust and compare normalized paths, not raw strings, whenever validating save destinations against managed files.

---

**Risk: secure-store failures now happen on two OS backends instead of one**

macOS Keychain and Windows Credential Manager fail differently.

**Mitigation:** Keep one backend wrapper (`secure_store.rs`) that maps all platform-specific failures to `SECURE_STORAGE_ERROR`, and keep the renderer blind to backend-specific details.

---

**Risk: asset protocol scope becomes too broad**

A sloppy scope update can accidentally expose more of the user's filesystem on Windows.

**Mitigation:** Expand asset scope only to the two managed Folio roots listed in Section 6. Do not allow `$HOME/**`, `$LOCALDATA/**`, or `$APPLOCALDATA/**` wholesale.

---

**Risk: existing epub.js and translation risks still apply**

Windows support does not remove iframe-injection, CFI drift, rate-limit, or HTML-sanitization risk.

**Mitigation:** All V1 mitigations for epub.js hooks, CFI restore fallback, chunk retry logic, and Rust HTML sanitization remain mandatory.

---

## 9. Third-Party Services and Platform Dependencies

### epub.js

- Used for: ePub parsing, rendering, pagination, CFI generation, annotation overlays
- Version: `0.3.93`
- No platform-specific change in V2

### OpenRouter API

- Used for: full-book translation only
- Endpoint: `POST https://openrouter.ai/api/v1/chat/completions`
- Model setting remains stored in SQLite under `llm_model`
- All request/response behavior remains unchanged from V1

### Native Secure Storage via `keyring`

- Used for: OpenRouter API key storage only
- Crate: `keyring`
- Required features:
  - `apple-native`
  - `windows-native`
- Service: `"com.folio.app"`
- Account: `"llm_api_key"`

### Tauri

- Used for: desktop shell, multi-window management, IPC, dialogs, bundling
- macOS webview backend: WebKit
- Windows webview backend: WebView2
- Windows installers must be built with `embedBootstrapper`

### Additional Rust crates introduced by V2

- `image`: cross-platform cover image decode/encode
- `uuid`: cross-platform UUID v4 generation

---

## 10. Verification Matrix

| Flow | Expected Result |
|---|---|
| Upgrade existing macOS install to V2 | Existing `~/Library/Application Support/Folio/folio.db` and managed books remain readable with no schema fork |
| Fresh Windows install imports first book | `%LOCALAPPDATA%\Folio\folio.db` is created; managed `.epub` lands in `%LOCALAPPDATA%\Folio\Books\` |
| Import book with JPEG cover on Windows | Cover is converted to managed PNG without calling external tools; library cover renders normally |
| Save API key on macOS | Key is written to Keychain; renderer only sees configured/not-configured state |
| Save API key on Windows | Key is written to Credential Manager; renderer only sees configured/not-configured state |
| Secure storage is unavailable | Backend throws `SECURE_STORAGE_ERROR`; Settings UI shows neutral secure-storage copy |
| Open same book twice on Windows | Existing `reader-{bookId}` window focuses instead of opening a duplicate |
| Press `Cmd+,` on macOS | Settings window opens or focuses |
| Press `Ctrl+,` on Windows | Settings window opens or focuses |
| Close a monitor and relaunch app | Persisted windows reopen inside a visible display area instead of off-screen |
| Export bilingual ePub on Windows Desktop | Save dialog defaults to Desktop; export path validation rejects the managed source path |
| Reader loads managed `.epub` via asset protocol on both OSes | `convertFileSrc` resolves only files under the approved Folio managed roots |

---

## 11. Migration Worklist

The V2 implementation must touch these areas in this order:

1. **Platform foundations**
   - Add `src-tauri/src/platform/paths.rs`
   - Move menu construction into `src-tauri/src/platform/menu.rs`
   - Move monitor-safe window restore helpers into `src-tauri/src/platform/windows.rs`

2. **Secure storage rename**
   - Replace `src-tauri/src/keychain.rs` with `src-tauri/src/secure_store.rs`
   - Update settings and translation commands to emit `SECURE_STORAGE_ERROR`
   - Update renderer copy and error handling in settings/translation UI

3. **Cross-platform file and ID generation**
   - Replace every `/dev/urandom` helper with `uuid`
   - Replace `sips` cover conversion with `image`

4. **Storage-path cleanup**
   - Update `db/mod.rs`
   - Update `epub/importer.rs`
   - Update any save/export path resolution
   - Expand `tauri.conf.json` asset scope to both managed roots

5. **Windows shell and bundle support**
   - Add Windows menu definition in platform menu module
   - Update `tauri.conf.json` Windows bundle config
   - Ensure `icon.ico` remains in the bundle list

6. **Regression pass**
   - Re-run the current macOS verification matrix
   - Run the new Windows matrix above on a clean machine or VM

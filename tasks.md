
| Task | Name                                              | Dependencies | Est. Complexity |
| ---- | ------------------------------------------------- | ------------ | --------------- |
| 1    | Project Bootstrap & Locked Stack Configuration    | None         | Medium          |
| 2    | SQLite Schema, Migrations & AppState              | 1            | Medium          |
| 3    | Multi-Window Routing & Native Shell Skeleton      | 2            | Medium          |
| 4    | Design Tokens & Base UI Foundation                | 3            | Medium          |
| 5    | Books Backend Commands & Import Pipeline          | 4            | High            |
| 6    | Reader Backend Commands & Window Persistence      | 5            | Medium          |
| 7    | Annotations Backend Commands                      | 6            | Medium          |
| 8    | Settings Backend Commands & Keychain              | 7            | Medium          |
| 9    | Translation Backend Worker & IPC                  | 8            | High            |
| 10   | Bilingual Export Backend                          | 9            | High            |
| 11   | Library Window Data Shell                         | 10           | Medium          |
| 12   | Library Import, Search & Book Actions             | 11           | High            |
| 13   | Reader Window Core Renderer & TOC                 | 12           | High            |
| 14   | Reader Display Preferences & Position Persistence | 13           | Medium          |
| 15   | Reader Selection Popup & Highlights UI            | 14           | High            |
| 16   | Reader Notes & Annotations Drawer UI              | 15           | High            |
| 17   | Reader Translation UI & Bilingual Mode            | 16           | High            |
| 18   | Quote Cover Generator UI & Save Flow              | 17           | Medium          |
| 19   | Settings Window UI                                | 18           | Medium          |
| 20   | MVP Loading, Empty & Error State Pass             | 19           | High            |
| 21   | MVP Integration Hardening & Verification          | 20           | High            |
| 22   | [V2] Collections / Bookshelves                    | 21           | Medium          |
| 23   | [V2] In-Book Full-Text Search                     | 22           | Medium          |
| 24   | [V2] Reading Statistics                           | 23           | Medium          |
| 25   | [V2] iCloud Sync                                  | 24           | High            |
| 26   | [V2] Export Annotations                           | 25           | Medium          |
| 27   | [V2] Dictionary / Wikipedia Lookup                | 26           | Medium          |
| 28   | [V2] Reading Goals                                | 27           | Medium          |


---

## Task 1: Project Bootstrap & Locked Stack Configuration

**Status:** [x] Finished

### Scope

Create the buildable frontend/backend application skeleton with the locked stack, repo-level config, and no feature logic.

### PRD References

- [Section name]: PRD.md Section 1 — core user journey and window entry points
- [Wireframe]: PRD.md Section 5b — "Library Window — Default State (macOS Books style)"
- [States]: PRD.md Section 7 — global loading / empty / error inventory to preserve while scaffolding

### TECH_DESIGN References

- [Stack]: TECH_DESIGN.md Section 1 — React, TypeScript, Vite, Tailwind, shadcn/ui, Tauri, rusqlite, reqwest, tokio
- [Structure]: TECH_DESIGN.md Section 2 — root file layout, renderer/backend split, and allowed folders
- [Schema]: TECH_DESIGN.md Section 3 — app-wide model names and future settings keys to align types with
- [API]: TECH_DESIGN.md Section 5 — command registration surface only; do not implement domain logic yet
- [Frontend]: TECH_DESIGN.md Section 4e — BrowserRouter route map for `/`, `/reader`, and `/settings`
- [Pattern]: TECH_DESIGN.md Section 6 — rules 1, 3, 12, and 13 for `invoke()`, styling, CSP, and window persistence boundaries

### Files

Create:

- `src/main.tsx` — renderer entrypoint with the shared app providers
- `src/App.tsx` — top-level app shell that will later host the route tree
- `src/lib/tauri-commands.ts` — typed IPC wrapper module stub that will own all future `invoke()` calls
- `src-tauri/src/main.rs` — backend entrypoint forwarding into `lib.rs`
- `src-tauri/src/lib.rs` — Tauri builder skeleton, plugin registration, and future command mount points

Modify:

- `package.json` — add the locked renderer dependencies and scripts
- `vite.config.ts` — set up Vite for the Tauri renderer and repo path aliases
- `tailwind.config.ts` — enable Tailwind for the documented content roots
- `tsconfig.json` — align compiler options and aliases with the renderer structure
- `index.html` — set the Vite mount point for the renderer
- `src-tauri/Cargo.toml` — add the locked Rust dependencies
- `src-tauri/tauri.conf.json` — apply minimum window sizing and CSP defaults
- `src-tauri/capabilities/default.json` — scope Tauri capabilities to the documented desktop surface

Do NOT touch:

- `src/components/ui/` — shadcn files are introduced in the design-system task, not during bootstrap

### Acceptance Criteria

- The repo builds with the locked stack from TECH_DESIGN.md Section 1 and no substitute libraries
- The renderer/bootstrap shell is ready for the three-window route structure defined in TECH_DESIGN.md Section 4e
- No domain IPC logic is implemented outside `src/lib/tauri-commands.ts` and `src-tauri/src/lib.rs`
- Window sizing and CSP defaults align with the constraints referenced in PRD.md Section 8 and TECH_DESIGN.md Section 6
- The shell follows the folder and styling constraints from TECH_DESIGN.md Sections 2 and 6
- No files outside the "Files" section above were modified

### Dependencies

- Requires: None (reason: starting point for the roadmap)
- Blocks: Task 2 (reason: database and app state need the runtime/config foundation)

### ⚠️ Risks & Conflicts

## None. PRD.md Section 2.1 and TECH_DESIGN.md Section 1 both explicitly confirm there is no auth surface in MVP.

## Task 2: SQLite Schema, Migrations & AppState

**Status:** [x] Finished

### Scope

Produce the SQLite schema, migration runner, and Rust app-state container that all later backend tasks depend on.

### PRD References

- [Section name]: PRD.md Section 6.1 — persisted data tables, keys, and storage locations
- [Wireframe]: PRD.md Section 5b — "Library Window — Default State (macOS Books style)"
- [States]: PRD.md Section 7 — "SQLite write failure" and persistence-sensitive states that rely on stable storage

### TECH_DESIGN References

- [Stack]: TECH_DESIGN.md Section 1 — SQLite 3 via rusqlite and rusqlite_migration
- [Structure]: TECH_DESIGN.md Section 2 — `src-tauri/src/db/` ownership and `AppState` connection storage
- [Schema]: TECH_DESIGN.md Section 3 — `books`, `highlights`, `notes`, `translations`, `translation_jobs`, `reading_settings`, and `app_settings`
- [API]: TECH_DESIGN.md Section 5 — storage-backed command contracts that assume the schema exists
- [Frontend]: TECH_DESIGN.md Section 4d — query/mutation flows that depend on stable cache keys and persisted rows
- [Pattern]: TECH_DESIGN.md Section 6 — rules 10, 11, and 13 for debounced saves, `Mutex<Connection>`, and window-state persistence

### Files

Create:

- `src-tauri/src/db/mod.rs` — database connection initialization and shared type exports
- `src-tauri/src/db/schema.rs` — SQL schema constants for all MVP tables and indexes
- `src-tauri/src/db/migrations.rs` — ordered migration list executed on startup

Modify:

- `src-tauri/src/lib.rs` — initialize the shared database state before any command is served
- `src-tauri/src/main.rs` — boot the app through the migration-aware runtime path

Do NOT touch:

- `src/` — renderer feature work starts after the database contract exists

### Acceptance Criteria

- All persisted models and indexes from TECH_DESIGN.md Section 3 exist without extra tables or columns
- Startup runs migrations before command registration and stores the SQLite connection behind the required mutex
- WAL mode and the App Support database location align with PRD.md Section 6.1 and TECH_DESIGN.md Section 8
- No frontend behavior is added before the persistence layer is stable
- The implementation follows the database and app-state rules from TECH_DESIGN.md Section 6
- No files outside the "Files" section above were modified

### Dependencies

- Requires: Task 1 to be complete (reason: backend runtime, config, and dependency manifests must exist first)
- Blocks: Task 3 (reason: the window shell and later commands rely on initialized app state)

### ⚠️ Risks & Conflicts

## None identified between PRD.md and TECH_DESIGN.md for the persisted MVP schema.

## Task 3: Multi-Window Routing & Native Shell Skeleton

**Status:** [x] Finished

### Scope

Create the empty Library, Reader, and Settings window shells plus the native menu/window scaffolding around them.

### PRD References

- [Section name]: PRD.md Section 5 — Page 1, Page 2, and Page 3 window responsibilities
- [Wireframe]: PRD.md Section 5b — "Library Window — Default State (macOS Books style)", "Reader Window — Clean (no toolbar, macOS Books style)", and "Settings Window — Translation Tab"
- [States]: PRD.md Section 7 — "Opening book (epub.js loading)" and window-level load boundaries

### TECH_DESIGN References

- [Stack]: TECH_DESIGN.md Section 1 — React Router 6.26 and Tauri 2.1
- [Structure]: TECH_DESIGN.md Section 2 — `src/windows/` root components and backend window responsibilities in `lib.rs`
- [Schema]: TECH_DESIGN.md Section 3 — `app_settings` window-state keys that later shell work will depend on
- [API]: TECH_DESIGN.md Section 5 — `open_reader_window` as the reader-window entry command surface
- [Frontend]: TECH_DESIGN.md Section 4e — route map, window labels, and settings-window constraints
- [Pattern]: TECH_DESIGN.md Section 7 — page component template and full-screen load/error boundaries

### Files

Create:

- `src/windows/LibraryWindow.tsx` — placeholder library window root following the page template
- `src/windows/ReaderWindow.tsx` — placeholder reader window root that reads `?bookId`
- `src/windows/SettingsWindow.tsx` — placeholder settings window root

Modify:

- `src/App.tsx` — mount the three route roots
- `src/main.tsx` — wire the router into the renderer bootstrap
- `src-tauri/src/lib.rs` — register the native settings menu item and window shell behavior
- `src-tauri/tauri.conf.json` — align settings-window size and reader minimum size with the spec

Do NOT touch:

- `src/components/library/`, `src/components/reader/`, and `src/components/settings/` — feature components come after the shell is in place

### Acceptance Criteria

- The route tree and native window shell match the three-window structure from TECH_DESIGN.md Section 4e
- Reader and Settings windows have only shell-level behavior, with no feature logic embedded in the roots
- Window sizing and menu affordances align with PRD.md Features 3 and 14
- Load boundaries exist at the page-root level, ready for later query wiring
- The shell follows the page-component pattern from TECH_DESIGN.md Section 7
- No files outside the "Files" section above were modified

### Dependencies

- Requires: Task 2 to be complete (reason: window shell work depends on initialized backend state and route bootstrap)
- Blocks: Task 4 (reason: visual tokens and primitives should be layered onto the shell, not invented before it)

### ⚠️ Risks & Conflicts

## PRD.md Section 5b shows the reader toolbar with controls that are later marked out of scope or moved to V2 elsewhere in the PRD; keep this task limited to structural shells and defer control conflicts to the reader-feature tasks.

## Task 4: Design Tokens & Base UI Foundation

**Status:** [x] Finished

### Scope

Define the shared visual tokens, Tailwind theme hooks, and generated UI primitives used by all later page work.

### PRD References

- [Section name]: PRD.md Section 5b — global macOS Books-style visual language across Library, Reader, and Settings
- [Wireframe]: PRD.md Section 5b — "Library Window — Default State (macOS Books style)"
- [States]: PRD.md Section 7 — skeletons, inline retry errors, and loading button treatments that must match later UI

### TECH_DESIGN References

- [Stack]: TECH_DESIGN.md Section 1 — Tailwind CSS 3.4 and shadcn/ui
- [Structure]: TECH_DESIGN.md Section 2 — `src/styles/`, `src/components/ui/`, and `src/lib/utils.ts`
- [Schema]: TECH_DESIGN.md Section 3 — no schema change in this task; design tokens must not imply new data
- [API]: TECH_DESIGN.md Section 5 — no new IPC surface in this task
- [Frontend]: TECH_DESIGN.md Section 4a, 4b, and 4f — color tokens, breakpoints, typography, spacing, and animation rules
- [Pattern]: TECH_DESIGN.md Section 7 — loading/error/form primitives the pages will reuse

### Files

Create:

- `src/styles/globals.css` — Tailwind directives and app-chrome CSS custom properties
- `src/styles/reader-themes.css` — the three reader-theme classes injected into epub.js content
- `src/lib/utils.ts` — shared UI helpers referenced across page components
- `src/components/ui/`* — CLI-generated shadcn primitives required by later tasks

Modify:

- `tailwind.config.ts` — expose the documented tokens and content roots
- `package.json` — add any missing design-system-side packages required by the locked stack
- `src/main.tsx` — load the global style entrypoints

Do NOT touch:

- `src/components/library/`, `src/components/reader/`, and `src/components/settings/` — page-specific composition starts after the foundation exists

### Acceptance Criteria

- The color, typography, spacing, radius, and shadow tokens match TECH_DESIGN.md Section 4a
- Breakpoint behavior and motion defaults align with TECH_DESIGN.md Sections 4b and 4f
- Only generated files are added under `src/components/ui/`
- The foundation provides the skeleton, error, and form styling needed by PRD.md Section 7
- No ad hoc CSS modules or inline-style patterns are introduced outside the documented exception
- No files outside the "Files" section above were modified

### Dependencies

- Requires: Task 3 to be complete (reason: token work should target the real shell structure and route roots)
- Blocks: Task 5 (reason: backend and frontend feature work now have the shared visual/styling foundation)

### ⚠️ Risks & Conflicts

## Resolved by human review: use `#2C2C2E` for the reader Dark theme background.

## Task 5: Books Backend Commands & Import Pipeline

**Status:** [x] Finished

### Scope

Implement the managed-library books backend surface for import, list, detail, and deletion behavior.

### PRD References

- [Section name]: PRD.md Section 3 — Feature 1 "Library & Bookshelf" and Feature 2 "Import Books"
- [Wireframe]: PRD.md Section 5b — "Library Window — Default State (macOS Books style)", "Library Window — Empty State", and "Library Window — Context Menu (Right-click on book)"
- [States]: PRD.md Section 7 — empty library, large-import loading, invalid ePub import, and managed-file-missing error states

### TECH_DESIGN References

- [Stack]: TECH_DESIGN.md Section 1 — sha2, minidom, quick-xml, rusqlite, and Tauri event emission
- [Structure]: TECH_DESIGN.md Section 2 — `src-tauri/src/commands/books.rs`, `src-tauri/src/epub/importer.rs`, and `src/types/book.ts`
- [Schema]: TECH_DESIGN.md Section 3 — `books` and related cascade targets in `reading_settings`, `highlights`, `notes`, `translations`, and `translation_jobs`
- [API]: TECH_DESIGN.md Section 5 — `import_book`, `get_books`, `get_book`, and `delete_book`
- [Frontend]: TECH_DESIGN.md Section 4d — library query invalidation and import progress expectations
- [Pattern]: TECH_DESIGN.md Section 6 — rules 1, 4, and 11 for wrappers, typed errors, and serialized DB access

### Files

Create:

- `src-tauri/src/commands/books.rs` — IPC command handlers for the books domain
- `src-tauri/src/epub/importer.rs` — managed-copy import pipeline, hashing, metadata parsing, and cover extraction
- `src-tauri/src/epub/mod.rs` — public re-exports for the ePub import/export module
- `src/types/book.ts` — shared book payload types for the library and reader surfaces

Modify:

- `src-tauri/src/commands/mod.rs` — register the books command set
- `src-tauri/src/lib.rs` — mount books commands and import progress events
- `src/lib/tauri-commands.ts` — add typed wrappers for the books command contracts

Do NOT touch:

- `src/components/reader/` — reader UI work is scheduled after the books backend exists

### Acceptance Criteria

- The managed import pipeline matches PRD.md Feature 2 and the file-location rules from TECH_DESIGN.md Section 0
- Duplicate detection, metadata fallback, and delete semantics use the exact contracts from TECH_DESIGN.md Section 5
- No extra command names, payload fields, or persistence columns are introduced
- Errors and partial-import results support the UI states listed in PRD.md Section 7 without changing the API surface
- The backend follows the command-wrapper and SQLite access rules from TECH_DESIGN.md Section 6
- No files outside the "Files" section above were modified

### Dependencies

- Requires: Task 4 to be complete (reason: wrappers, types, and shell conventions must already exist)
- Blocks: Task 6 (reason: reader-window behavior depends on books existing and opening correctly)

### ⚠️ Risks & Conflicts

## PRD.md Feature 1 requires a "Library file missing" overlay on book cards, but TECH_DESIGN.md Sections 3 and 5 do not define a `Book` field or separate command that exposes managed-file health without inventing new API/schema surface.

## Task 6: Reader Backend Commands & Window Persistence

**Status:** [x] Finished

### Scope

Implement the backend reader command surface for window open/focus, reading position saves, per-book display settings, and persisted window bounds.

### PRD References

- [Section name]: PRD.md Section 3 — Feature 3 "Open Book in New Window", Feature 5 "Auto-Save Reading Position", and Feature 13 "Font & Display Settings"
- [Wireframe]: PRD.md Section 5b — "Reader Window — Clean (no toolbar, macOS Books style)" and "Reader Window — Display Settings Popover (AA button)"
- [States]: PRD.md Section 7 — opening-book loading and invalid-CFI recovery banner behavior

### TECH_DESIGN References

- [Stack]: TECH_DESIGN.md Section 1 — Tauri, rusqlite, and React/reader settings persistence expectations
- [Structure]: TECH_DESIGN.md Section 2 — `src-tauri/src/commands/reader.rs`, `src/hooks/useReadingSettings.ts`, and `src/hooks/useWindowState.ts`
- [Schema]: TECH_DESIGN.md Section 3 — `books`, `reading_settings`, and `app_settings`
- [API]: TECH_DESIGN.md Section 5 — `open_reader_window`, `save_reading_position`, `get_reading_settings`, and `update_reading_settings`
- [Frontend]: TECH_DESIGN.md Section 4e — reader window labels and focus behavior
- [Pattern]: TECH_DESIGN.md Section 6 — rules 10 and 13 for debounced saves and Rust-owned window persistence

### Files

Create:

- `src-tauri/src/commands/reader.rs` — IPC command handlers for reader window/state behavior
- `src/types/settings.ts` — shared reading-settings and app-settings payload types

Modify:

- `src-tauri/src/commands/mod.rs` — register the reader command set
- `src-tauri/src/lib.rs` — wire reader-window creation/focus and persisted window-state listeners
- `src/lib/tauri-commands.ts` — add typed wrappers for the reader command contracts

Do NOT touch:

- `src-tauri/src/llm/` — translation worker behavior is a later task

### Acceptance Criteria

- Reader-window open/focus behavior matches PRD.md Feature 3 and TECH_DESIGN.md Section 4e
- Per-book reading settings and debounced position saves use the exact command contracts from TECH_DESIGN.md Section 5
- Window bounds are persisted in Rust using the `app_settings` keys defined in TECH_DESIGN.md Section 3
- No reader UI logic is embedded into the command layer
- The implementation follows the persistence rules from TECH_DESIGN.md Section 6
- No files outside the "Files" section above were modified

### Dependencies

- Requires: Task 5 to be complete (reason: reader windows need books and book IDs to exist first)
- Blocks: Task 7 (reason: annotation persistence builds on the reader/open-book foundation)

### ⚠️ Risks & Conflicts

## PRD.md Section 8.3 says macOS system dark mode maps automatically to the reader Dark theme, while PRD.md Feature 4 and TECH_DESIGN.md Sections 3 and 4a set the default reader theme to Light with per-book overrides.

## Task 7: Annotations Backend Commands

**Status:** [x] Finished

### Scope

Implement the highlights and notes backend commands, validations, and persistence rules used by reader annotations.

### PRD References

- [Section name]: PRD.md Section 3 — Feature 7 "Highlighting", Feature 8 "Notes", and Feature 9 "Annotations Panel"
- [Wireframe]: PRD.md Section 5b — "Reader Window — Text Selection Popup Bar", "Reader Window — Note Editor Panel", and "Reader Window — Annotations Drawer (slides in from right)"
- [States]: PRD.md Section 7 — empty annotation tabs and "SQLite write failure"

### TECH_DESIGN References

- [Stack]: TECH_DESIGN.md Section 1 — rusqlite and typed IPC serialization for annotation records
- [Structure]: TECH_DESIGN.md Section 2 — `src-tauri/src/commands/highlights.rs`, `src-tauri/src/commands/notes.rs`, and `src/types/annotation.ts`
- [Schema]: TECH_DESIGN.md Section 3 — `highlights` and `notes`
- [API]: TECH_DESIGN.md Section 5 — `get_highlights`, `add_highlight`, `update_highlight`, `delete_highlight`, `get_notes`, `save_note`, `update_note`, and `delete_note`
- [Frontend]: TECH_DESIGN.md Section 4d — annotation query invalidation rules
- [Pattern]: TECH_DESIGN.md Section 6 — rules 4, 7, and 11 plus the form pattern in TECH_DESIGN.md Section 7

### Files

Create:

- `src-tauri/src/commands/highlights.rs` — highlight CRUD commands and color validation
- `src-tauri/src/commands/notes.rs` — note CRUD commands and empty-body behavior
- `src/types/annotation.ts` — shared annotation payload types for later frontend hooks

Modify:

- `src-tauri/src/commands/mod.rs` — register highlights and notes commands
- `src/lib/tauri-commands.ts` — add typed wrappers for highlights and notes

Do NOT touch:

- `src-tauri/src/llm/` — no translation logic belongs in the annotations backend

### Acceptance Criteria

- Highlight and note persistence uses the exact schemas and command shapes from TECH_DESIGN.md Sections 3 and 5
- Validation/error codes align with the documented MVP behavior for invalid color, empty note, and missing records
- Delete semantics preserve the note/highlight relationships exactly as specified
- Returned data shapes are sufficient for the annotation UI without inventing undocumented fields
- The implementation follows the typed-wrapper and SQLite access rules from TECH_DESIGN.md Section 6
- No files outside the "Files" section above were modified

### Dependencies

- Requires: Task 6 to be complete (reason: annotations are anchored to reader/book state and per-book persistence)
- Blocks: Task 8 (reason: global settings and translation work should land after core reader persistence is stable)

### ⚠️ Risks & Conflicts

## None identified between PRD.md and TECH_DESIGN.md for the MVP annotation backend contracts.

## Task 8: Settings Backend Commands & Keychain

**Status:** [x] Finished

### Scope

Implement the backend settings surface for app settings, API-key status/save/clear, and OpenRouter connection testing.

### PRD References

- [Section name]: PRD.md Section 3 — Feature 14 "Settings Window (App-Wide)"
- [Wireframe]: PRD.md Section 5b — "Settings Window — Translation Tab", "Settings Window — Translation Tab (No Key Saved)", and "Settings Window — Validation / Connection Errors"
- [States]: PRD.md Section 7 — testing connection loading, auth failure, and key-required validation

### TECH_DESIGN References

- [Stack]: TECH_DESIGN.md Section 1 — keyring, reqwest, rusqlite, and serde
- [Structure]: TECH_DESIGN.md Section 2 — `src-tauri/src/commands/settings.rs` and `src-tauri/src/keychain.rs`
- [Schema]: TECH_DESIGN.md Section 3 — `app_settings` and the Keychain service/account contract
- [API]: TECH_DESIGN.md Section 5 — `get_app_settings`, `save_app_settings`, `save_api_key`, `has_api_key`, `clear_api_key`, and `test_openrouter_connection`
- [Frontend]: TECH_DESIGN.md Section 4c — `TranslationTab` data requirements and `GeneralTab` placeholder boundary
- [Pattern]: TECH_DESIGN.md Section 6 — rules 4 and 6 plus the form pattern in TECH_DESIGN.md Section 7

### Files

Create:

- `src-tauri/src/commands/settings.rs` — settings and API-key command handlers
- `src-tauri/src/keychain.rs` — thin Keychain wrapper for the OpenRouter key

Modify:

- `src-tauri/src/commands/mod.rs` — register the settings command set
- `src-tauri/src/lib.rs` — mount the settings commands
- `src/lib/tauri-commands.ts` — add typed wrappers for the settings contracts
- `src/types/settings.ts` — extend shared types for app settings and API-key status payloads

Do NOT touch:

- `src/components/reader/` — reader UI integration happens after the backend contracts are stable

### Acceptance Criteria

- API-key storage and status visibility follow the Keychain-only boundary from PRD.md Section 8.2 and TECH_DESIGN.md Section 0
- Connection testing uses the exact backend contract from TECH_DESIGN.md Section 5 without persisting unsaved values
- App-setting persistence only covers the documented `llm_model` surface in MVP
- The implementation does not leak secrets to the renderer beyond the allowed configured/not-configured status
- The backend follows the typed-error and Keychain rules from TECH_DESIGN.md Section 6
- No files outside the "Files" section above were modified

### Dependencies

- Requires: Task 7 to be complete (reason: settings/UI contracts should build on the established command/wrapper patterns)
- Blocks: Task 9 (reason: translation backend depends on saved-model and API-key contracts existing)

### ⚠️ Risks & Conflicts

## PRD.md Section 5b draws editable controls in the General tab, but PRD.md Feature 14 and TECH_DESIGN.md Sections 2 and 4c define `GeneralTab` as placeholder-only for MVP.

## Task 9: Translation Backend Worker & IPC

**Status:** [x] Finished

### Scope

Implement the OpenRouter translation client, job worker, storage writes, and Tauri event contracts for bilingual translation.

### PRD References

- [Section name]: PRD.md Section 3 — Feature 10 "Full-Book LLM Translation (Bilingual Mode)"
- [Wireframe]: PRD.md Section 5b — "Reader Window — Bilingual Mode Active", "Reader Window — Translation In Progress Banner", and "Reader Window — Translation Language Sheet (modal)"
- [States]: PRD.md Section 7 — paragraph-level LLM error, auth failure, rate-limit pause, and network-offline pause behaviors

### TECH_DESIGN References

- [Stack]: TECH_DESIGN.md Section 1 — reqwest, tokio, serde, sha2, and Keychain-backed OpenRouter access
- [Structure]: TECH_DESIGN.md Section 2 — `src-tauri/src/llm/client.rs`, `src-tauri/src/llm/worker.rs`, and `src-tauri/src/commands/translations.rs`
- [Schema]: TECH_DESIGN.md Section 3 — `translations` and `translation_jobs`
- [API]: TECH_DESIGN.md Section 5 — `start_translation`, `pause_translation`, `resume_translation`, `cancel_translation`, `get_translations`, `get_translation_job`, `retry_failed_paragraphs`, and translation events
- [Frontend]: TECH_DESIGN.md Section 4c — `TranslationBanner`, `TranslationSheet`, and `useTranslation.ts`
- [Pattern]: TECH_DESIGN.md Section 6 — rules 6, 8, 9, and 11 plus the mitigations in TECH_DESIGN.md Section 8

### Files

Create:

- `src-tauri/src/llm/mod.rs` — translation module exports and shared types
- `src-tauri/src/llm/client.rs` — OpenRouter request/response handling and translation sanitization entrypoint
- `src-tauri/src/llm/worker.rs` — background paragraph translation worker and event emission
- `src-tauri/src/commands/translations.rs` — translation job command handlers
- `src/types/translation.ts` — frontend translation/job payload types
- `src/types/events.ts` — typed Tauri event payloads for translation progress and pauses

Modify:

- `src-tauri/src/commands/mod.rs` — register the translation command set
- `src-tauri/src/lib.rs` — mount translation commands and startup pause normalization
- `src/lib/tauri-commands.ts` — add typed wrappers for translation commands

Do NOT touch:

- `src/components/settings/` — settings UI is a separate frontend task

### Acceptance Criteria

- Translation is paragraph-based and keyed by `spine_item_href + paragraph_index` exactly as locked in TECH_DESIGN.md Section 0
- Job lifecycle, progress events, pause reasons, and retry behavior use the exact contracts from TECH_DESIGN.md Section 5
- Sanitization and secret-handling rules follow TECH_DESIGN.md Sections 6, 8, and 9
- No renderer-visible payload exposes the stored API key or invents undocumented translation metadata
- The implementation follows the worker and OpenRouter patterns from TECH_DESIGN.md Section 9
- No files outside the "Files" section above were modified

### Dependencies

- Requires: Task 8 to be complete (reason: translation depends on the settings/model/API-key backend contract)
- Blocks: Task 10 (reason: bilingual export needs completed translation storage and jobs)

### ⚠️ Risks & Conflicts

## None identified between PRD.md Feature 10 and the TECH_DESIGN.md translation backend contract.

## Task 10: Bilingual Export Backend

**Status:** [x] Finished

### Scope

Implement the backend bilingual ePub export command and ZIP assembly pipeline using completed translation data.

### PRD References

- [Section name]: PRD.md Section 3 — Feature 10 "Full-Book LLM Translation (Bilingual Mode)" export behavior
- [Wireframe]: PRD.md Section 5b — "Reader Window — Bilingual Mode Active"
- [States]: PRD.md Section 7 — "Exporting bilingual epub" progress state and completion gating

### TECH_DESIGN References

- [Stack]: TECH_DESIGN.md Section 1 — ZIP/ePub assembly with `zip`
- [Structure]: TECH_DESIGN.md Section 2 — `src-tauri/src/commands/export.rs` and `src-tauri/src/epub/exporter.rs`
- [Schema]: TECH_DESIGN.md Section 3 — `translations` and `translation_jobs`
- [API]: TECH_DESIGN.md Section 5 — `export_bilingual_epub` and `export:progress`
- [Frontend]: TECH_DESIGN.md Section 4c — reader export affordance dependency in the translation flow
- [Pattern]: TECH_DESIGN.md Section 6 — sanitized translation HTML and strict IPC wrapper boundaries

### Files

Create:

- `src-tauri/src/commands/export.rs` — export command handler and save-path validation
- `src-tauri/src/epub/exporter.rs` — bilingual ePub assembly using the translation locators

Modify:

- `src-tauri/src/commands/mod.rs` — register the export command
- `src-tauri/src/epub/mod.rs` — expose the export module
- `src-tauri/src/lib.rs` — mount export progress events
- `src/lib/tauri-commands.ts` — add the typed export wrapper

Do NOT touch:

- `src/components/library/` — export belongs to the reader/translation workflow only

### Acceptance Criteria

- Export is blocked until translation is complete, matching PRD.md Feature 10 and TECH_DESIGN.md Section 5
- The generated ePub assembly uses translation rows keyed by paragraph location and does not alter the source managed file
- Progress reporting follows the documented event contract without adding extra export endpoints
- Error handling aligns with the documented `TRANSLATION_INCOMPLETE` and `WRITE_ERROR` cases
- The implementation respects the backend ownership and sanitization rules from TECH_DESIGN.md Sections 2 and 6
- No files outside the "Files" section above were modified

### Dependencies

- Requires: Task 9 to be complete (reason: export depends on translation data, job completion, and event infrastructure)
- Blocks: Task 11 (reason: frontend work can now bind to the full books/reader/settings backend surface)

### ⚠️ Risks & Conflicts

## PRD.md Section 7.2 requires an export progress dialog with a Cancel button, but TECH_DESIGN.md Section 5 defines progress events only and no export-cancel command or cancellation contract.

## Task 11: Library Window Data Shell

**Status:** [x] Finished

### Scope

Build the Library window structure with real books queries, responsive layout, and no advanced interactions beyond display.

### PRD References

- [Section name]: PRD.md Section 3 — Feature 1 "Library & Bookshelf"
- [Wireframe]: PRD.md Section 5b — "Library Window — Default State (macOS Books style)" and "Library Window — Empty State"
- [States]: PRD.md Section 7 — library empty state and book-grid loading shape

### TECH_DESIGN References

- [Stack]: TECH_DESIGN.md Section 1 — React, Tailwind, Zustand, and TanStack Query
- [Structure]: TECH_DESIGN.md Section 2 — `src/components/library/`, `src/hooks/useBooks.ts`, and `src/store/libraryStore.ts`
- [Schema]: TECH_DESIGN.md Section 3 — `books`
- [API]: TECH_DESIGN.md Section 5 — `get_books` and `get_book`
- [Frontend]: TECH_DESIGN.md Section 4c and 4d — LibraryWindow component map, responsive grid, and data-fetching rules
- [Pattern]: TECH_DESIGN.md Section 7 — page template and loading/error state pattern

### Files

Create:

- `src/components/library/Sidebar.tsx` — Library / Recently Read sidebar shell and counts display
- `src/components/library/LibraryToolbar.tsx` — top toolbar shell with the import affordance placeholder
- `src/components/library/BookGrid.tsx` — responsive grid layout for book cards
- `src/components/library/BookCard.tsx` — book-cover tile rendering with progress/new badges
- `src/components/library/EmptyState.tsx` — centered empty-library state
- `src/hooks/useBooks.ts` — books query and basic invalidation entrypoint
- `src/store/libraryStore.ts` — transient library filter and toolbar UI state

Modify:

- `src/windows/LibraryWindow.tsx` — compose the Library window from the mapped components
- `src/lib/tauri-commands.ts` — extend the books wrappers if the UI surface needs helper overloads
- `src/types/book.ts` — fill any remaining book-facing renderer types required by the library shell

Do NOT touch:

- `src/components/reader/` — reader page work starts after the library is stable

### Acceptance Criteria

- The Library window structure matches the page/component map in TECH_DESIGN.md Section 4c
- The default and empty states match the PRD.md Section 5b wireframes at the documented breakpoints
- Book display is driven by the books query, not hardcoded data or direct component-level fetching
- Skeleton and inline retry handling follow TECH_DESIGN.md Sections 4d and 7
- The library shell follows the component/styling rules from TECH_DESIGN.md Section 6
- No files outside the "Files" section above were modified

### Dependencies

- Requires: Task 10 to be complete (reason: the full backend contract is now available for real query wiring)
- Blocks: Task 12 (reason: import/search/context actions layer onto the rendered library shell)

### ⚠️ Risks & Conflicts

## The "Library file missing" overlay required by PRD.md Feature 1 still depends on a missing health signal in TECH_DESIGN.md Sections 3 and 5.

## Task 12: Library Import, Search & Book Actions

**Status:** [x] Finished

### Scope

Add Library-window interactions for importing, drag-and-drop, searching, duplicate feedback, context menu actions, and removal.

### PRD References

- [Section name]: PRD.md Section 3 — Feature 2 "Import Books", Feature 12 "Search Library", and the actionable parts of Feature 1
- [Wireframe]: PRD.md Section 5b — "Library Window — Search Active State", "Library Window — Search No Results", and "Library Window — Context Menu (Right-click on book)"
- [States]: PRD.md Section 7 — large-import loading, invalid ePub alert, duplicate-banner behavior, and search-empty state

### TECH_DESIGN References

- [Stack]: TECH_DESIGN.md Section 1 — TanStack Query, Zustand, and Tauri dialogs/events
- [Structure]: TECH_DESIGN.md Section 2 — `BookContextMenu.tsx`, `BookInfoSheet.tsx`, `DropZone.tsx`, `DuplicateBanner.tsx`, `useBook.ts`, and `useLibraryFilter.ts`
- [Schema]: TECH_DESIGN.md Section 3 — `books`
- [API]: TECH_DESIGN.md Section 5 — `import_book`, `get_book`, `delete_book`, `get_books`, and `open_reader_window`
- [Frontend]: TECH_DESIGN.md Section 4c and 4d — library interaction component map, debounced search, drop zone, and mutation invalidation
- [Pattern]: TECH_DESIGN.md Section 7 — inline loading/error handling and mutation feedback

### Files

Create:

- `src/components/library/BookContextMenu.tsx` — contextual book actions surface
- `src/components/library/BookInfoSheet.tsx` — read-only metadata sheet
- `src/components/library/DropZone.tsx` — drag-and-drop overlay for `.epub` import
- `src/components/library/DuplicateBanner.tsx` — auto-dismissing duplicate import banner
- `src/hooks/useBook.ts` — detail query used by the info sheet and open-book flows
- `src/hooks/useLibraryFilter.ts` — debounced client-side search and section selection logic

Modify:

- `src/components/library/LibraryToolbar.tsx` — wire import and search controls to real state
- `src/components/library/BookGrid.tsx` — connect double-click/open and right-click/context handling
- `src/windows/LibraryWindow.tsx` — compose interaction overlays and mutation/error flows
- `src/lib/tauri-commands.ts` — expose any remaining books-reader helper wrappers required by the library

Do NOT touch:

- `src-tauri/src/llm/` — library interactions must not introduce translation logic

### Acceptance Criteria

- Import, search, context actions, and duplicate feedback use the exact backend contracts from TECH_DESIGN.md Section 5
- Search behavior, result-count display, and no-results handling match PRD.md Feature 12 and its wireframes
- Library actions do not bypass the custom hooks or typed IPC wrapper layer
- Loading/error/empty states for import and search match PRD.md Section 7 and TECH_DESIGN.md Section 4d
- The interaction flow follows the library component map from TECH_DESIGN.md Section 4c
- No files outside the "Files" section above were modified

### Dependencies

- Requires: Task 11 to be complete (reason: interaction logic depends on the rendered library shell and query/store base)
- Blocks: Task 13 (reason: the reader UI should be entered from the real library/open-book flow)

### ⚠️ Risks & Conflicts

## TECH_DESIGN.md Section 5 does not define a distinct backend surface for the managed-file-missing alert beyond `get_book`/open-book errors, so the library/book-open UX must stay within the documented command/error codes.

## Task 13: Reader Window Core Renderer & TOC

**Status:** [x] Finished

### Scope

Build the core Reader window with epub.js mounting, page navigation, progress UI, toolbar shell, and TOC floating-dropdown behavior.

### PRD References

- [Section name]: PRD.md Section 3 — Feature 3 "Open Book in New Window", Feature 4 "Reading — Core Renderer", and Feature 15 "Table of Contents Navigation"
- [Wireframe]: PRD.md Section 5b — "Reader Window — Clean (no toolbar, macOS Books style)", "Reader Window — Toolbar Visible (on hover/click)", and "Reader Window — Contents Dropdown Menu"
- [States]: PRD.md Section 7 — opening-book loading spinner, DRM error, and "This book has no table of contents."

### TECH_DESIGN References

- [Stack]: TECH_DESIGN.md Section 1 — epub.js 0.3.93, React, Zustand, and Tauri
- [Structure]: TECH_DESIGN.md Section 2 — `ReaderToolbar.tsx`, `EpubViewer.tsx`, `TocDrawer.tsx`, `PageChevrons.tsx`, `ProgressBar.tsx`, and `src/lib/epub-bridge.ts`
- [Schema]: TECH_DESIGN.md Section 3 — `books`
- [API]: TECH_DESIGN.md Section 5 — `get_book` and `open_reader_window`
- [Frontend]: TECH_DESIGN.md Section 4b, 4c, and 4f — reader margins, component map, toolbar fade timing, and hover chevrons
- [Pattern]: TECH_DESIGN.md Section 6 — rule 5 for epub initialization plus the page/loading pattern in TECH_DESIGN.md Section 7

### Files

Create:

- `src/components/reader/ReaderToolbar.tsx` — toolbar shell and button layout
- `src/components/reader/EpubViewer.tsx` — reader content mount and first-page render boundary
- `src/components/reader/TocDrawer.tsx` — table-of-contents floating dropdown shell and list rendering
- `src/components/reader/PageChevrons.tsx` — hover-reveal page navigation controls
- `src/components/reader/ProgressBar.tsx` — chapter/progress footer bar
- `src/lib/epub-bridge.ts` — single-reader epub.js initialization and helper surface

Modify:

- `src/windows/ReaderWindow.tsx` — wire the reader page root to book loading and the core layout
- `src/types/book.ts` — extend reader-facing book metadata types if required by the core UI

Do NOT touch:

- `src/components/settings/` — settings-page work is later

### Acceptance Criteria

- The Reader window layout matches the PRD.md wireframes for clean, visible-toolbar, and TOC states
- epub.js is initialized only through `src/lib/epub-bridge.ts` and not directly from unrelated components
- Toolbar visibility, page navigation, TOC behavior, and progress display align with TECH_DESIGN.md Sections 4c and 4f
- Loading and error boundaries cover first render, DRM rejection, and missing TOC per PRD.md Section 7
- The reader root follows the page-component pattern from TECH_DESIGN.md Section 7
- No files outside the "Files" section above were modified

### Dependencies

- Requires: Task 12 to be complete (reason: the reader should now open from the real library/book-entry flow)
- Blocks: Task 14 (reason: reading settings and persistence layer onto the working reader shell)

### ⚠️ Risks & Conflicts

## PRD.md Section 5b includes an in-book search button in the reader toolbar, but PRD.md Sections 4 and 9 mark in-book search as V2 and TECH_DESIGN.md Section 4c does not include it in the MVP component map.

## Task 14: Reader Display Preferences & Position Persistence

**Status:** [x] Finished

### Scope

Wire per-book reading settings, instant theme/font changes, and debounced reading-position restore/save into the Reader window.

### PRD References

- [Section name]: PRD.md Section 3 — Feature 5 "Auto-Save Reading Position" and Feature 13 "Font & Display Settings"
- [Wireframe]: PRD.md Section 5b — "Reader Window — Display Settings Popover (AA button)"
- [States]: PRD.md Section 7 — invalid-CFI restore banner and persisted reading-position behavior

### TECH_DESIGN References

- [Stack]: TECH_DESIGN.md Section 1 — Zustand, TanStack Query, and epub.js reader themes
- [Structure]: TECH_DESIGN.md Section 2 — `DisplaySettingsPopover.tsx`, `useReadingSettings.ts`, `readerStore.ts`, and `useWindowState.ts`
- [Schema]: TECH_DESIGN.md Section 3 — `reading_settings`, `books.last_position_cfi`, and `app_settings`
- [API]: TECH_DESIGN.md Section 5 — `get_reading_settings`, `update_reading_settings`, and `save_reading_position`
- [Frontend]: TECH_DESIGN.md Section 4c — reader settings popover and state ownership
- [Pattern]: TECH_DESIGN.md Section 6 — rules 3, 5, and 10 for styling exceptions, epub ownership, and 2-second save debounce

### Files

Create:

- `src/components/reader/DisplaySettingsPopover.tsx` — the AA popover for font/theme controls
- `src/hooks/useReadingSettings.ts` — query/mutation hook for per-book reading settings
- `src/store/readerStore.ts` — transient reader UI state, current CFI, and drawer/popup flags
- `src/hooks/useWindowState.ts` — renderer-facing window-state helper bounded to the documented window API usage

Modify:

- `src/components/reader/EpubViewer.tsx` — apply settings and debounced relocation saves
- `src/components/reader/ReaderToolbar.tsx` — attach the display-settings entrypoint
- `src/windows/ReaderWindow.tsx` — coordinate restore-on-open and invalid-CFI fallback UI
- `src/lib/epub-bridge.ts` — expose the helper surface needed for settings and relocation handling

Do NOT touch:

- `src/components/library/` — library UI is already in place and should not be restyled here

### Acceptance Criteria

- Display settings UI matches the PRD.md Section 5b popover and the TECH_DESIGN.md Section 4c mapping
- Reading settings are persisted per book and applied instantly without reloading the reader window
- Position save/restore respects the 2-second debounce rule and the invalid-CFI fallback behavior
- All state flows go through the documented hooks/store/epub bridge instead of direct component-level mutations
- The implementation follows the reader-state and wrapper rules from TECH_DESIGN.md Section 6
- No files outside the "Files" section above were modified

### Dependencies

- Requires: Task 13 to be complete (reason: settings and persistence depend on a working reader shell and epub bridge)
- Blocks: Task 15 (reason: the selection/highlight workflow needs the settled reader store and bridge)

### ⚠️ Risks & Conflicts

## PRD.md Section 8.3 says macOS system dark mode maps automatically to the reader Dark theme, while PRD.md Feature 4 and TECH_DESIGN.md Sections 3 and 4a specify Light as the default reader theme until the user changes it.

## Task 15: Reader Selection Popup & Highlights UI

**Status:** [x] Finished

### Scope

Add selection tracking, the reader popup bar, and highlight create/update/delete behavior inside the Reader window.

### PRD References

- [Section name]: PRD.md Section 3 — Feature 6 "Text Selection Popup Bar" and Feature 7 "Highlighting"
- [Wireframe]: PRD.md Section 5b — "Reader Window — Text Selection Popup Bar"
- [States]: PRD.md Section 7 — selection/popup dismissal expectations and highlight-related save errors

### TECH_DESIGN References

- [Stack]: TECH_DESIGN.md Section 1 — epub.js, Zustand, and TanStack Query
- [Structure]: TECH_DESIGN.md Section 2 — `SelectionPopup.tsx`, `useEpubSelection.ts`, `useHighlights.ts`, and `readerStore.ts`
- [Schema]: TECH_DESIGN.md Section 3 — `highlights`
- [API]: TECH_DESIGN.md Section 5 — highlight CRUD commands
- [Frontend]: TECH_DESIGN.md Section 4c — popup ownership inside the reader window
- [Pattern]: TECH_DESIGN.md Section 6 — rules 3, 5, and 7 for inline positioning, reader ownership, and highlight annotation rendering

### Files

Create:

- `src/components/reader/SelectionPopup.tsx` — popup action bar for selected text and existing highlights
- `src/hooks/useEpubSelection.ts` — epub.js selection listener hook and popup-state bridge
- `src/hooks/useHighlights.ts` — highlights query/mutation hook

Modify:

- `src/components/reader/EpubViewer.tsx` — connect selection, highlight rendering, and highlight-click affordances
- `src/windows/ReaderWindow.tsx` — mount the selection popup within the reader page
- `src/lib/epub-bridge.ts` — expose helpers needed by selection/highlight state
- `src/store/readerStore.ts` — store popup visibility, selected text, and selected annotation state

Do NOT touch:

- `src/components/settings/` — no settings-page work belongs in the selection/highlight task

### Acceptance Criteria

- Popup size, placement, dismissal behavior, and action ordering match the PRD.md wireframe exactly
- Highlight create/update/delete flows use the documented commands and annotation-rendering pattern from TECH_DESIGN.md Section 6
- Selection state flows through the epub bridge and reader store, not arbitrary DOM access from unrelated components
- Existing-highlight editing behavior stays within the MVP popup contract
- The implementation follows the inline-positioning and highlight rules from TECH_DESIGN.md Section 6
- No files outside the "Files" section above were modified

### Dependencies

- Requires: Task 14 to be complete (reason: selection/highlight behavior depends on the settled reader state and bridge)
- Blocks: Task 16 (reason: note creation/editing layers onto the popup and highlight flow)

### ⚠️ Risks & Conflicts

## PRD.md Open Assumption A4 says the popup Translate button is present but not implemented in MVP, while PRD.md Feature 6 presents it as a normal action and TECH_DESIGN.md Section 5 defines no selection-translation IPC surface.

## Task 16: Reader Notes & Annotations Drawer UI

**Status:** [x] Finished

### Scope

Implement note editing plus the annotations floating dropdown for browsing, jumping to, deleting, and exporting highlights.

### PRD References

- [Section name]: PRD.md Section 3 — Feature 8 "Notes" and Feature 9 "Annotations Panel"
- [Wireframe]: PRD.md Section 5b — "Reader Window — Note Editor Panel", "Reader Window — Note Editor, Validation Error", and "Reader Window — Annotations Dropdown Menu"
- [States]: PRD.md Section 7 — empty highlights/notes tabs and note validation error behavior

### TECH_DESIGN References

- [Stack]: TECH_DESIGN.md Section 1 — React Hook Form, Zod, TanStack Query, and Zustand
- [Structure]: TECH_DESIGN.md Section 2 — `NoteEditor.tsx`, `AnnotationsDrawer.tsx`, and `useNotes.ts`
- [Schema]: TECH_DESIGN.md Section 3 — `notes` and `highlights`
- [API]: TECH_DESIGN.md Section 5 — notes CRUD commands plus highlight reads for the drawer
- [Frontend]: TECH_DESIGN.md Section 4c and 4d — annotations drawer mapping and mutation invalidation rules
- [Pattern]: TECH_DESIGN.md Section 7 — form pattern and loading/error state pattern

### Files

Create:

- `src/components/reader/NoteEditor.tsx` — floating note editor panel with create/edit/delete paths
- `src/components/reader/AnnotationsDrawer.tsx` — highlights/notes floating dropdown with tabbed lists and export action
- `src/hooks/useNotes.ts` — notes query/mutation hook

Modify:

- `src/components/reader/SelectionPopup.tsx` — launch note creation/editing from the popup
- `src/components/reader/EpubViewer.tsx` — anchor note indicators and navigation hooks
- `src/windows/ReaderWindow.tsx` — compose the note editor and annotations dropdown
- `src/store/readerStore.ts` — track note-editor and dropdown state

Do NOT touch:

- `src/components/library/` — annotation work must stay isolated to the reader page

### Acceptance Criteria

- The note editor and annotations dropdown match the PRD.md Section 5b wireframes and empty/error states
- Highlight export is available from the annotations dropdown using the documented export command contract
- Form handling uses React Hook Form + Zod per TECH_DESIGN.md Sections 1, 6, and 7
- Annotation-list navigation, delete confirmation, and invalidation flows use the documented hooks and commands
- Note deletion-on-whitespace behavior is respected without inventing new note states
- The implementation follows the component and loading/error patterns from TECH_DESIGN.md Sections 4d and 7
- No files outside the "Files" section above were modified

### Dependencies

- Requires: Task 15 to be complete (reason: notes depend on the popup selection flow and highlight anchors)
- Blocks: Task 17 (reason: translation UI must layer onto the fully interactive reader)

### ⚠️ Risks & Conflicts

## None identified between PRD.md and TECH_DESIGN.md for the MVP notes/annotations UI surface.

## Task 17: Reader Translation UI & Bilingual Mode

**Status:** [x] Finished

### Scope

Implement the reader-side translation controls, progress UI, bilingual paragraph rendering, retry/resume flows, and export visibility.

### PRD References

- [Section name]: PRD.md Section 3 — Feature 10 "Full-Book LLM Translation (Bilingual Mode)"
- [Wireframe]: PRD.md Section 5b — "Reader Window — Bilingual Mode Active", "Reader Window — Translation In Progress Banner", and "Reader Window — Translation Language Sheet (modal)"
- [States]: PRD.md Section 7 — paragraph error warning, auth failure, rate-limit pause, network pause, and export progress

### TECH_DESIGN References

- [Stack]: TECH_DESIGN.md Section 1 — TanStack Query, Zustand, epub.js, and Tauri event subscriptions
- [Structure]: TECH_DESIGN.md Section 2 — `TranslationBanner.tsx`, `TranslationSheet.tsx`, `useTranslation.ts`, `readerStore.ts`, and `EpubViewer.tsx`
- [Schema]: TECH_DESIGN.md Section 3 — `translations`, `translation_jobs`, and `app_settings`
- [API]: TECH_DESIGN.md Section 5 — translation commands/events plus `export_bilingual_epub`
- [Frontend]: TECH_DESIGN.md Section 4c and 4d — translation UI mapping and event-driven query refresh
- [Pattern]: TECH_DESIGN.md Section 6 — rules 5, 8, and 9 for reader ownership, translation injection, and sanitized HTML expectations

### Files

Create:

- `src/components/reader/TranslationBanner.tsx` — top-of-reader translation progress and retry surface
- `src/components/reader/TranslationSheet.tsx` — language-selection modal and re-translate gating UI
- `src/hooks/useTranslation.ts` — translation query/mutation/event-subscription hook

Modify:

- `src/components/reader/EpubViewer.tsx` — inject bilingual paragraphs via the documented rendition hook
- `src/components/reader/ReaderToolbar.tsx` — add translate/bilingual/export affordances
- `src/windows/ReaderWindow.tsx` — compose translation controls, prompts, and banner states
- `src/store/readerStore.ts` — track bilingual mode and translation UI state
- `src/lib/tauri-commands.ts` — expose any remaining translation/export wrapper helpers the UI needs

Do NOT touch:

- `src/components/library/` — translation remains isolated to the reader feature set

### Acceptance Criteria

- Translation controls, banner states, and bilingual rendering match the PRD.md wireframes and Feature 10 flow
- Translation progress is event-driven through `useTranslation.ts`, not via polling or direct component-level event handling
- Bilingual paragraph injection uses the documented epub.js hook pattern and deterministic paragraph locators
- Retry/resume/cancel/export gating uses the exact backend contracts from TECH_DESIGN.md Section 5
- Loading/error handling follows PRD.md Section 7 and TECH_DESIGN.md Sections 4d, 6, and 7
- No files outside the "Files" section above were modified

### Dependencies

- Requires: Task 16 to be complete (reason: translation UI must integrate into the fully interactive reader shell)
- Blocks: Task 18 (reason: quote cover generation also starts from the reader selection flow)

### ⚠️ Risks & Conflicts

## PRD.md Feature 10 and the Page 2 inventory include an export affordance in the reader toolbar, but TECH_DESIGN.md Section 4c’s ReaderToolbar summary omits that control from the MVP component map.

## Task 18: Quote Cover Generator UI & Save Flow

**Status:** [x] Finished

### Scope

Implement the quote-cover modal, live preview rendering, and image-save flow for selected passages.

### PRD References

- [Section name]: PRD.md Section 3 — Feature 11 "Quote Cover Generator"
- [Wireframe]: PRD.md Section 5b — "Quote Cover Creator Modal" and "Quote Cover Creator — Long Text Warning"
- [States]: PRD.md Section 7 — quote-cover render loading and canvas failure alert

### TECH_DESIGN References

- [Stack]: TECH_DESIGN.md Section 1 — Canvas API usage inside the renderer and Tauri desktop APIs
- [Structure]: TECH_DESIGN.md Section 2 — `QuoteCoverModal.tsx` and `src/lib/quote-canvas.ts`
- [Schema]: TECH_DESIGN.md Section 3 — `books` data used by the quote cover (title, author, cover path)
- [API]: TECH_DESIGN.md Section 5 — no dedicated quote-cover IPC command is defined for MVP
- [Frontend]: TECH_DESIGN.md Section 4c — QuoteCoverModal ownership inside the Reader window
- [Pattern]: TECH_DESIGN.md Section 4f and TECH_DESIGN.md Section 8 — loading-button behavior and quote-canvas risk mitigation

### Files

Create:

- `src/components/reader/QuoteCoverModal.tsx` — modal UI for theme selection, quote editing, and preview
- `src/lib/quote-canvas.ts` — canvas render helper for 1080×1080 quote image generation

Modify:

- `src/components/reader/SelectionPopup.tsx` — launch the quote-cover flow from the popup action bar
- `src/windows/ReaderWindow.tsx` — mount the modal into the reader page
- `src/types/book.ts` — ensure the modal receives the book metadata it needs

Do NOT touch:

- `src-tauri/src/llm/` — quote-cover generation must stay separate from translation logic

### Acceptance Criteria

- The modal layout, theme choices, live preview, and warning state match PRD.md Feature 11 and its wireframes
- Canvas rendering follows the mitigation described in TECH_DESIGN.md Section 8 and does not taint the canvas with the cover image
- Quote-save loading and failure behavior match PRD.md Section 7 without inventing new backend commands
- Quote-cover rendering remains isolated to `src/lib/quote-canvas.ts`
- The implementation follows the styling and loading-button patterns from TECH_DESIGN.md Sections 4f and 6
- No files outside the "Files" section above were modified

### Dependencies

- Requires: Task 17 to be complete (reason: the reader selection flow and modal infrastructure must already exist)
- Blocks: Task 19 (reason: the remaining window surface is the app-wide Settings UI)

### ⚠️ Risks & Conflicts

## TECH_DESIGN.md Section 5 defines no dedicated quote-cover IPC surface, so save-path selection must remain within approved Tauri frontend APIs unless the spec is expanded.

## Task 19: Settings Window UI

**Status:** [ ] Not Started

### Scope

Implement the Settings window tabs and translation settings form against the real backend settings commands.

### PRD References

- [Section name]: PRD.md Section 3 — Feature 14 "Settings Window (App-Wide)"
- [Wireframe]: PRD.md Section 5b — "Settings Window — General Tab", "Settings Window — Translation Tab", "Settings Window — Translation Tab (No Key Saved)", and "Settings Window — Validation / Connection Errors"
- [States]: PRD.md Section 7 — testing connection loading, key-required validation, and auth error presentation

### TECH_DESIGN References

- [Stack]: TECH_DESIGN.md Section 1 — React Hook Form, Zod, TanStack Query, and Tauri IPC wrappers
- [Structure]: TECH_DESIGN.md Section 2 — `SettingsWindow.tsx`, `GeneralTab.tsx`, `TranslationTab.tsx`, `useAppSettings.ts`, and `useApiKeyStatus.ts`
- [Schema]: TECH_DESIGN.md Section 3 — `app_settings` and Keychain status only
- [API]: TECH_DESIGN.md Section 5 — settings and API-key commands
- [Frontend]: TECH_DESIGN.md Section 4c — tabs and TranslationTab surface, plus the placeholder GeneralTab requirement
- [Pattern]: TECH_DESIGN.md Section 7 — form pattern and loading/error state pattern

### Files

Create:

- `src/components/settings/GeneralTab.tsx` — placeholder-only General tab for MVP
- `src/components/settings/TranslationTab.tsx` — translation settings form and inline test/save/clear feedback
- `src/hooks/useAppSettings.ts` — app-settings query/mutation hook
- `src/hooks/useApiKeyStatus.ts` — API-key status/save/clear/test hook

Modify:

- `src/windows/SettingsWindow.tsx` — compose the tab shell and settings hooks
- `src/lib/tauri-commands.ts` — add any remaining settings wrapper helpers the UI needs
- `src/types/settings.ts` — finalize shared app-settings/UI payload types

Do NOT touch:

- `src/components/ui/` — shadcn primitives remain generated-only

### Acceptance Criteria

- The Translation tab form, status, test flow, and inline errors match PRD.md Section 5b and Feature 14
- General tab behavior stays within the MVP placeholder contract from TECH_DESIGN.md Section 4c
- Form handling uses React Hook Form + Zod and the typed settings hooks instead of ad hoc local validation
- Secrets stay within the documented Keychain boundary and only configured-state reaches the renderer
- Loading/error handling follows PRD.md Section 7 and TECH_DESIGN.md Sections 6 and 7
- No files outside the "Files" section above were modified

### Dependencies

- Requires: Task 18 to be complete (reason: the reader feature set is complete enough to finish the remaining window surface)
- Blocks: Task 20 (reason: the full MVP surface now exists for the dedicated states pass)

### ⚠️ Risks & Conflicts

## PRD.md Section 5b draws editable General-tab defaults, but PRD.md Feature 14 and TECH_DESIGN.md Sections 2 and 4c require `GeneralTab` to show placeholder text only.

## Task 20: MVP Loading, Empty & Error State Pass

**Status:** [ ] Not Started

### Scope

Apply every PRD-defined loading, empty, and error state across Library, Reader, and Settings without changing the underlying feature contracts.

### PRD References

- [Section name]: PRD.md Section 7 — 7.1 Empty States, 7.2 Loading States, and 7.3 Error States
- [Wireframe]: PRD.md Section 5b — "Library Window — Empty State", "Library Window — Search No Results", "Reader Window — Translation In Progress Banner", and "Settings Window — Validation / Connection Errors"
- [States]: PRD.md Section 7 — all MVP loading / empty / error states

### TECH_DESIGN References

- [Stack]: TECH_DESIGN.md Section 1 — TanStack Query, shadcn/ui, and renderer/backend event surfaces already in use
- [Structure]: TECH_DESIGN.md Section 2 — window roots, hooks, and page-specific component folders
- [Schema]: TECH_DESIGN.md Section 3 — no schema changes in this task; use existing fields and errors only
- [API]: TECH_DESIGN.md Section 5 — existing books, reader, annotation, translation, export, and settings commands only
- [Frontend]: TECH_DESIGN.md Section 4d and 4f — skeleton rules, retry behavior, button-loading states, and toasts
- [Pattern]: TECH_DESIGN.md Section 7 — loading/error state pattern and form pattern

### Files

Create:

- none — this is a refinement pass over the implemented MVP surface

Modify:

- `src/windows/LibraryWindow.tsx` — finalize library-level empty/loading/error handling
- `src/windows/ReaderWindow.tsx` — finalize reader-level loading/banner/error handling
- `src/windows/SettingsWindow.tsx` — finalize settings-window state handling
- `src/components/library/BookGrid.tsx` — add skeletons and inline retry/no-results handling where needed
- `src/components/library/LibraryToolbar.tsx` — add import/search loading and feedback states
- `src/components/reader/TranslationBanner.tsx` — cover all documented translation pause/error variants
- `src/components/reader/AnnotationsDrawer.tsx` — add empty/list-error states for highlights and notes
- `src/components/settings/TranslationTab.tsx` — finalize validation/test/save/clear inline states

Do NOT touch:

- `src-tauri/src/db/` — schema work is out of scope for the UI-state pass

### Acceptance Criteria

- Every empty/loading/error state listed in PRD.md Section 7 appears on the correct surface with the documented wording/behavior
- Skeletons replace generic blank regions, and inline Retry actions call the existing refetch/mutation paths
- No new IPC commands, event types, or schema fields are introduced to support state rendering
- Existing page/component mappings from TECH_DESIGN.md Section 4c remain intact while states are added
- The pass follows the loading/error/button-state patterns from TECH_DESIGN.md Sections 4d, 4f, and 7
- No files outside the "Files" section above were modified

### Dependencies

- Requires: Task 19 to be complete (reason: all MVP windows and flows must exist before a complete states sweep)
- Blocks: Task 21 (reason: integration hardening should start from the final MVP state surface)

### ⚠️ Risks & Conflicts

## Previously flagged conflicts remain open here, especially the missing managed-file health signal and the undefined export-cancel contract.

## Task 21: MVP Integration Hardening & Verification

**Status:** [ ] Not Started

### Scope

Polish cross-window behavior, event wiring, and verification-matrix cases so the full MVP behaves coherently end to end.

### PRD References

- [Section name]: PRD.md Section 1 — end-to-end core user journey, plus PRD.md Section 6.3 data flow between pages
- [Wireframe]: PRD.md Section 5b — "Library Window — Default State (macOS Books style)" and "Reader Window — Bilingual Mode Active"
- [States]: PRD.md Section 7 — final regression pass across all documented edge states

### TECH_DESIGN References

- [Stack]: TECH_DESIGN.md Section 1 — full MVP stack as already established
- [Structure]: TECH_DESIGN.md Section 2 — cross-cutting hooks, stores, command modules, and the epub bridge
- [Schema]: TECH_DESIGN.md Section 3 — no schema additions; validate against existing persistence contracts
- [API]: TECH_DESIGN.md Section 5 — all MVP IPC commands and translation/export events
- [Frontend]: TECH_DESIGN.md Section 4d and 4e — refetch-on-focus, multi-window behavior, and route/window coordination
- [Pattern]: TECH_DESIGN.md Sections 6, 8, and 10 — implementation rules, risks/mitigations, and the verification matrix

### Files

Create:

- none — this task validates and hardens the completed MVP implementation

Modify:

- `src/lib/tauri-commands.ts` — normalize any remaining typed error handling across domains
- `src/lib/epub-bridge.ts` — harden reader lifecycle edge handling called out in the mitigation notes
- `src/hooks/useBooks.ts` — ensure library refresh behavior matches the documented cross-window data flow
- `src/hooks/useTranslation.ts` — finalize event cleanup, resume handling, and retry state coordination
- `src/store/readerStore.ts` — trim or stabilize transient reader state used across interactive surfaces
- `src-tauri/src/lib.rs` — finalize startup normalization and window-wide integration hooks
- `src-tauri/src/llm/worker.rs` — finalize pause/resume/retry edge handling from the risk matrix

Do NOT touch:

- `PRD.md` and `TECH_DESIGN.md` — unresolved spec issues require human authorship, not implementation drift

### Acceptance Criteria

- The end-to-end MVP flow passes against PRD.md Section 1 and TECH_DESIGN.md Section 10 without undocumented behavior changes
- Cross-window refresh, translation resume, duplicate handling, and missing-file/open-book edge cases behave coherently
- Integration fixes stay within the existing API/schema/component contracts
- Any remaining gaps are documented as spec conflicts rather than patched around with new surface area
- The hardening pass follows the risk mitigations and implementation rules from TECH_DESIGN.md Sections 6 and 8
- No files outside the "Files" section above were modified

### Dependencies

- Requires: Task 20 to be complete (reason: the states pass must be finished before final integration hardening)
- Blocks: Task 22 (reason: V2 work should not start until the MVP baseline is stable)

### ⚠️ Risks & Conflicts

## This task is blocked from true completion until human review resolves the previously flagged conflicts: managed-file health exposure, popup translate-action scope, reader toolbar control inventory, General-tab content, theme-default behavior, and export cancellation.

## Task 22: [V2] Collections / Bookshelves

**Status:** [ ] Not Started

### Scope

Add named book collections to the library once the V2 product and technical spec surface is defined.

### PRD References

- [Section name]: PRD.md Section 4 — V2-Feature 1 "Collections / Bookshelves"
- [Wireframe]: PRD.md Section 5b — no V2 wireframe provided for collections; do not infer layout beyond the existing Library window shell
- [States]: PRD.md Section 7 — no V2-specific collection states are defined yet

### TECH_DESIGN References

- [Stack]: TECH_DESIGN.md Section 1 — reuse the locked MVP stack only
- [Structure]: TECH_DESIGN.md Section 2 — likely impacts `src/components/library/`, `src/hooks/`, and `src-tauri/src/commands/`
- [Schema]: TECH_DESIGN.md Section 3 — no collections schema exists yet
- [API]: TECH_DESIGN.md Section 5 — no collections IPC contract exists yet
- [Frontend]: TECH_DESIGN.md Section 4c — no collections component mapping exists yet
- [Pattern]: TECH_DESIGN.md Section 6 — existing implementation rules still apply once the V2 spec exists

### Files

Create:

- none — blocked until PRD and TECH_DESIGN are extended for V2 collections

Modify:

- none — blocked until PRD and TECH_DESIGN are extended for V2 collections

Do NOT touch:

- `src/` — blocked until PRD and TECH_DESIGN define the V2 collections surface
- `src-tauri/` — blocked until PRD and TECH_DESIGN define the V2 collections surface

### Acceptance Criteria

- Work does not begin until PRD wireframes and TECH_DESIGN schema/API/component mappings exist for collections
- The eventual implementation reuses the locked MVP stack without introducing new libraries
- No undocumented schema or IPC surface is invented from the V2 one-line description alone
- MVP library behavior remains unchanged until the V2 spec is approved
- The future implementation must still follow TECH_DESIGN.md Section 6 rules
- No files outside the "Files" section above were modified

### Dependencies

- Requires: Task 21 to be complete (reason: V2 work starts only after the MVP baseline is stable)
- Blocks: Task 23 (reason: V2 work is sequenced after the first post-MVP feature)

### ⚠️ Risks & Conflicts

## TECH_DESIGN.md has no Section 3, 4, or 5 coverage for collections, so this task is a blocked placeholder until the spec is expanded.

## Task 23: [V2] In-Book Full-Text Search

**Status:** [ ] Not Started

### Scope

Add Reader-window full-text search only after a dedicated V2 technical design defines its UI, indexing strategy, and IPC surface.

### PRD References

- [Section name]: PRD.md Section 4 — V2-Feature 2 "Full-Text Search Within a Book"
- [Wireframe]: PRD.md Section 5b — no V2 full-text-search wireframe is provided; do not infer from the MVP toolbar icon mismatch
- [States]: PRD.md Section 7 — no V2-specific search-within-book states are defined

### TECH_DESIGN References

- [Stack]: TECH_DESIGN.md Section 1 — reuse the locked MVP stack only
- [Structure]: TECH_DESIGN.md Section 2 — would likely impact reader components, hooks, and backend commands
- [Schema]: TECH_DESIGN.md Section 3 — no search index or match model exists yet
- [API]: TECH_DESIGN.md Section 5 — no search-within-book command surface exists yet
- [Frontend]: TECH_DESIGN.md Section 4c — no reader-search component mapping exists yet
- [Pattern]: TECH_DESIGN.md Section 6 — existing reader ownership and wrapper rules still apply once designed

### Files

Create:

- none — blocked until PRD and TECH_DESIGN are extended for in-book search

Modify:

- none — blocked until PRD and TECH_DESIGN are extended for in-book search

Do NOT touch:

- `src/components/reader/` — the toolbar icon mismatch does not authorize implementing V2 behavior early
- `src-tauri/src/commands/` — no V2 reader-search IPC surface exists yet

### Acceptance Criteria

- Work does not begin until PRD wireframes and TECH_DESIGN schema/API/component mappings exist for in-book search
- The future search flow stays within the locked stack and reader ownership rules
- No undocumented search index, match state, or command surface is invented
- MVP reader toolbar behavior remains unchanged until the V2 spec is approved
- The future implementation must still follow TECH_DESIGN.md Section 6 rules
- No files outside the "Files" section above were modified

### Dependencies

- Requires: Task 22 to be complete (reason: V2 work is being sequenced linearly after MVP)
- Blocks: Task 24 (reason: keep post-MVP work strictly sequential)

### ⚠️ Risks & Conflicts

## This feature is explicitly V2/out of scope in PRD.md Section 9, while the PRD.md reader toolbar wireframe shows a search icon; TECH_DESIGN.md intentionally omits the feature from the MVP component map.

## Task 24: [V2] Reading Statistics

**Status:** [ ] Not Started

### Scope

Add reading-time and pacing tracking after the V2 metrics model, storage plan, and UI surfaces are specified.

### PRD References

- [Section name]: PRD.md Section 4 — V2-Feature 3 "Reading Statistics"
- [Wireframe]: PRD.md Section 5b — no reading-statistics wireframe is provided
- [States]: PRD.md Section 7 — no V2-specific reading-statistics states are defined

### TECH_DESIGN References

- [Stack]: TECH_DESIGN.md Section 1 — reuse the locked MVP stack only
- [Structure]: TECH_DESIGN.md Section 2 — would likely impact reader hooks, stores, and possibly settings or new reader components
- [Schema]: TECH_DESIGN.md Section 3 — no reading-statistics table or event model exists yet
- [API]: TECH_DESIGN.md Section 5 — no reading-statistics command surface exists yet
- [Frontend]: TECH_DESIGN.md Section 4c — no reading-statistics component mapping exists yet
- [Pattern]: TECH_DESIGN.md Section 6 — existing persistence and reader-state rules still apply once designed

### Files

Create:

- none — blocked until PRD and TECH_DESIGN are extended for reading statistics

Modify:

- none — blocked until PRD and TECH_DESIGN are extended for reading statistics

Do NOT touch:

- `src-tauri/src/db/` — no reading-statistics schema exists yet
- `src/components/reader/` — statistics UI cannot be inferred from the one-line V2 summary

### Acceptance Criteria

- Work does not begin until PRD wireframes and TECH_DESIGN schema/API/component mappings exist for reading statistics
- The future implementation stays within the locked MVP stack and persistence rules
- No undocumented metrics storage, timers, or UI surface is invented
- MVP reader behavior remains unchanged until the V2 spec is approved
- The future implementation must still follow TECH_DESIGN.md Section 6 rules
- No files outside the "Files" section above were modified

### Dependencies

- Requires: Task 23 to be complete (reason: V2 sequencing remains strictly linear)
- Blocks: Task 25 (reason: keep post-MVP work ordered and dependency-safe)

### ⚠️ Risks & Conflicts

## TECH_DESIGN.md has no data, API, or component design for reading statistics, so this task is blocked until the V2 spec is written.

## Task 25: [V2] iCloud Sync

**Status:** [ ] Not Started

### Scope

Add multi-device sync only after a V2 design defines the storage model, conflict strategy, and macOS/iCloud integration boundaries.

### PRD References

- [Section name]: PRD.md Section 4 — V2-Feature 4 "iCloud Sync"
- [Wireframe]: PRD.md Section 5b — no iCloud-sync wireframe is provided
- [States]: PRD.md Section 7 — no V2-specific sync loading/error/conflict states are defined

### TECH_DESIGN References

- [Stack]: TECH_DESIGN.md Section 1 — current MVP stack is local-only and has no sync technology in scope
- [Structure]: TECH_DESIGN.md Section 2 — no sync module or cloud boundary exists
- [Schema]: TECH_DESIGN.md Section 3 — no sync metadata, tombstones, or conflict fields exist
- [API]: TECH_DESIGN.md Section 5 — no sync IPC surface exists
- [Frontend]: TECH_DESIGN.md Section 4c — no sync UI/component mapping exists
- [Pattern]: TECH_DESIGN.md Section 6 — current rules are built around local-only persistence and would need explicit extension

### Files

Create:

- none — blocked until PRD and TECH_DESIGN are extended for iCloud sync

Modify:

- none — blocked until PRD and TECH_DESIGN are extended for iCloud sync

Do NOT touch:

- `src-tauri/src/db/` — current persistence is MVP local-only and must not be changed without a new spec
- `src/` — sync UI/state cannot be inferred without approved architecture

### Acceptance Criteria

- Work does not begin until PRD wireframes and TECH_DESIGN schema/API/infrastructure coverage exist for iCloud sync
- No cloud persistence, auth, or conflict-resolution surface is invented from the V2 bullet alone
- MVP local-only guarantees remain unchanged until the V2 spec is approved
- Any future sync design explicitly addresses the current local-only assumptions before code starts
- The future implementation must still follow TECH_DESIGN.md Section 6 rules where applicable
- No files outside the "Files" section above were modified

### Dependencies

- Requires: Task 24 to be complete (reason: V2 sequencing remains linear and MVP-first)
- Blocks: Task 26 (reason: keep post-MVP work ordered)

### ⚠️ Risks & Conflicts

## PRD.md Section 2.1 and Section 9 make the MVP local-only with no auth or sync, while TECH_DESIGN.md is entirely built around that assumption; V2 sync requires a fresh spec, not incremental inference.

## Task 26: [V2] Export Annotations

**Status:** [ ] Not Started

### Scope

Legacy note: this task was superseded once PRD.md and TECH_DESIGN.md promoted highlight export into the current reader scope.

### PRD References

- [Section name]: PRD.md Section 3 — Feature 16 "Export Highlights"
- [Wireframe]: PRD.md Section 5b — "Reader Window — Annotations Dropdown Menu"
- [States]: PRD.md Section 7 — export write failure is handled inline in the annotations dropdown

### TECH_DESIGN References

- [Stack]: TECH_DESIGN.md Section 1 — reuse the locked MVP stack only
- [Structure]: TECH_DESIGN.md Section 2 — would likely impact reader components, hooks, and backend export commands
- [Schema]: TECH_DESIGN.md Section 3 — existing `highlights` table is the export source
- [API]: TECH_DESIGN.md Section 5 — `export_highlights`
- [Frontend]: TECH_DESIGN.md Section 4c — annotations dropdown includes the export action
- [Pattern]: TECH_DESIGN.md Section 6 — existing wrapper and export-boundary rules still apply once specified

### Files

Create:

- none — scope now lives in the main reader/annotations implementation path

Modify:

- none — blocked until PRD and TECH_DESIGN are extended for annotation export

Do NOT touch:

- `src/components/reader/AnnotationsDrawer.tsx` — MVP annotation UI must remain unchanged until V2 is specified
- `src-tauri/src/commands/export.rs` — bilingual export is the only approved export command in MVP

### Acceptance Criteria

- Work does not begin until PRD wireframes and TECH_DESIGN schema/API/component mappings exist for annotation export
- No undocumented file format, save flow, or IPC contract is invented
- MVP annotations behavior remains unchanged until the V2 spec is approved
- The future implementation stays within the locked stack and export-boundary rules
- The future implementation must still follow TECH_DESIGN.md Section 6 rules
- No files outside the "Files" section above were modified

### Dependencies

- Requires: Task 25 to be complete (reason: V2 sequencing remains strictly ordered)
- Blocks: Task 27 (reason: keep post-MVP work ordered)

### ⚠️ Risks & Conflicts

## PRD.md Section 9 explicitly excludes annotation export from MVP, and TECH_DESIGN.md defines only bilingual-ePub export in the backend/export surface.

## Task 27: [V2] Dictionary / Wikipedia Lookup

**Status:** [ ] Not Started

### Scope

Add lookup actions for selected words only after a V2 design defines providers, permissions, and popup/UI behavior.

### PRD References

- [Section name]: PRD.md Section 4 — V2-Feature 6 "Dictionary / Wikipedia Lookup"
- [Wireframe]: PRD.md Section 5b — no lookup wireframe is provided
- [States]: PRD.md Section 7 — no V2-specific lookup states are defined

### TECH_DESIGN References

- [Stack]: TECH_DESIGN.md Section 1 — current MVP stack defines no dictionary/Wikipedia integration
- [Structure]: TECH_DESIGN.md Section 2 — would likely impact reader popup components and new backend or shell integrations
- [Schema]: TECH_DESIGN.md Section 3 — no lookup cache/state model exists
- [API]: TECH_DESIGN.md Section 5 — no lookup command surface exists
- [Frontend]: TECH_DESIGN.md Section 4c — no lookup component mapping exists
- [Pattern]: TECH_DESIGN.md Section 6 — existing popup ownership and IPC wrapper rules still apply once specified

### Files

Create:

- none — blocked until PRD and TECH_DESIGN are extended for lookup behavior

Modify:

- none — blocked until PRD and TECH_DESIGN are extended for lookup behavior

Do NOT touch:

- `src/components/reader/SelectionPopup.tsx` — lookup cannot be inferred into the MVP popup early
- `src-tauri/src/commands/` — no lookup IPC surface exists yet

### Acceptance Criteria

- Work does not begin until PRD wireframes and TECH_DESIGN schema/API/component mappings exist for lookup behavior
- No undocumented external integration, cache layer, or popup state is invented
- MVP selection-popup behavior remains unchanged until the V2 spec is approved
- The future implementation stays within the locked stack or explicitly updates the stack section first
- The future implementation must still follow TECH_DESIGN.md Section 6 rules
- No files outside the "Files" section above were modified

### Dependencies

- Requires: Task 26 to be complete (reason: V2 sequencing remains strictly ordered)
- Blocks: Task 28 (reason: keep the post-MVP queue linear)

### ⚠️ Risks & Conflicts

## PRD.md Section 9 explicitly excludes dictionary/Wikipedia lookup from MVP, and TECH_DESIGN.md has no provider or UI design for it yet.

## Task 28: [V2] Reading Goals

**Status:** [ ] Not Started

### Scope

Add daily reading-goal tracking only after V2 wireframes, persistence, and reminder/state behavior are defined.

### PRD References

- [Section name]: PRD.md Section 4 — V2-Feature 7 "Reading Goals"
- [Wireframe]: PRD.md Section 5b — no reading-goals wireframe is provided
- [States]: PRD.md Section 7 — no V2-specific reading-goals states are defined

### TECH_DESIGN References

- [Stack]: TECH_DESIGN.md Section 1 — reuse the locked MVP stack only
- [Structure]: TECH_DESIGN.md Section 2 — would likely impact reader/settings surfaces and new persistence hooks
- [Schema]: TECH_DESIGN.md Section 3 — no reading-goals data model exists yet
- [API]: TECH_DESIGN.md Section 5 — no reading-goals command surface exists yet
- [Frontend]: TECH_DESIGN.md Section 4c — no reading-goals component mapping exists yet
- [Pattern]: TECH_DESIGN.md Section 6 — existing persistence and form rules still apply once V2 is specified

### Files

Create:

- none — blocked until PRD and TECH_DESIGN are extended for reading goals

Modify:

- none — blocked until PRD and TECH_DESIGN are extended for reading goals

Do NOT touch:

- `src/components/reader/` — no reading-goals UI is specified yet
- `src/components/settings/` — no reading-goals settings surface is specified yet

### Acceptance Criteria

- Work does not begin until PRD wireframes and TECH_DESIGN schema/API/component mappings exist for reading goals
- No undocumented persistence model, notifications, or UI surface is invented
- MVP reader/settings behavior remains unchanged until the V2 spec is approved
- The future implementation stays within the locked stack and existing form/persistence rules
- The future implementation must still follow TECH_DESIGN.md Section 6 rules
- No files outside the "Files" section above were modified

### Dependencies

- Requires: Task 27 to be complete (reason: final V2 item in the linear roadmap)
- Blocks: None (reason: final task in the current roadmap)

### ⚠️ Risks & Conflicts

TECH_DESIGN.md has no schema, API, or component design for reading goals, so this task is a blocked V2 placeholder until the spec is extended.

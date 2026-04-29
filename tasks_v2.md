| Task | Name                                                     | Dependencies | Est. Complexity |
| ---- | -------------------------------------------------------- | ------------ | --------------- |
| 1    | V2 Platform Foundations & Config                         | None         | Medium          |
| 2    | Native Secure Storage Migration                          | 1            | Medium          |
| 3    | Cross-Platform Managed Paths & Import Pipeline           | 2            | High            |
| 4    | Windows Shell, Menu, and Window Restoration              | 3            | Medium          |
| 5    | Renderer Cross-Platform Copy & Settings Neutralization   | 4            | Medium          |
| 6    | Cross-Platform Verification, Packaging & Release Harden  | 5            | High            |

---

## Task 1: V2 Platform Foundations & Config

**Status:** [ ] Not Started

### Scope

Lay down the cross-platform Tauri and Rust foundations required for Folio V2 so the existing app can build and run on macOS and Windows without changing product functionality.

### PRD References

- [Section name]: PRD.md Section 1 — desktop app now targets macOS and Windows
- [Section name]: PRD.md Section 2.1 — still single-user, local-only, no auth
- [Section name]: PRD.md Feature 2, Feature 3, and Feature 14 — import, multi-window reading, and settings entry must all work on both OSes
- [States]: PRD.md Section 7 — no loading/error state regressions are allowed during the platform migration
- [NFR]: PRD.md Section 8.2 and 8.3 — native secure storage, native titlebar, and desktop responsive targets

### TECH_DESIGN References

- [Locked]: TECH_DESIGN_V2.md Section 0 — desktop-only, macOS + Windows only, no new feature scope
- [Stack]: TECH_DESIGN_V2.md Section 1 — add `image` and `uuid`, support Windows x86_64, WebView2 bootstrapper
- [Structure]: TECH_DESIGN_V2.md Section 2 — introduce `src-tauri/src/platform/`
- [Rules]: TECH_DESIGN_V2.md Section 6 — centralized OS branching, explicit asset scope, no hardcoded macOS paths

### Files

Create:

- `src-tauri/src/platform/mod.rs` — platform module entrypoint
- `src-tauri/src/platform/paths.rs` — app data root and Desktop resolution
- `src-tauri/src/platform/menu.rs` — native menu construction by OS
- `src-tauri/src/platform/windows.rs` — monitor-safe window bounds helpers

Modify:

- `src-tauri/Cargo.toml` — add `image` and `uuid`; ensure native secure-storage support stays enabled
- `src-tauri/tauri.conf.json` — add Windows bundle settings and explicit asset scopes for macOS + Windows managed roots
- `src-tauri/src/lib.rs` — route menu and window helper logic through the new platform module

Do NOT touch:

- `src/components/` — no renderer UI or behavior changes in this foundation task
- `src/hooks/` — query/mutation surfaces stay unchanged in this task

### Acceptance Criteria

- The Rust backend has a dedicated platform module for paths, menu construction, and window restoration
- `Cargo.toml` and `tauri.conf.json` reflect the V2 stack and Windows bundle requirements from TECH_DESIGN_V2.md
- Asset protocol scope is explicit and limited to the managed Folio roots on macOS and Windows
- No macOS-only path logic remains in shared configuration code
- No product functionality or UI copy changes ship in this task
- No files outside the "Files" section above were modified

### Dependencies

- Requires: None
- Blocks: Task 2 (reason: secure storage migration should build on the V2 platform/config baseline)

### ⚠️ Risks & Conflicts

## This task must not widen filesystem access beyond the managed Folio roots documented in TECH_DESIGN_V2.md Section 6.

## Task 2: Native Secure Storage Migration

**Status:** [ ] Not Started

### Scope

Replace macOS-Keychain-specific backend and renderer assumptions with the V2 native secure-storage boundary while keeping the API-key surface functionally identical.

### PRD References

- [Section name]: PRD.md Feature 14 — API key save/clear/test flows remain unchanged in behavior
- [Section name]: PRD.md Section 6.1 — API key stays outside SQLite
- [States]: PRD.md Section 7.3 — connection and secure-storage failures must remain user-visible and retryable
- [Security]: PRD.md Section 8.2 — API key never reaches SQLite, logs, or renderer payloads

### TECH_DESIGN References

- [Locked]: TECH_DESIGN_V2.md Section 0 — renderer never receives the saved API key; secure-storage error code is `SECURE_STORAGE_ERROR`
- [Structure]: TECH_DESIGN_V2.md Section 2 — `src-tauri/src/secure_store.rs`
- [API]: TECH_DESIGN_V2.md Section 5 — settings IPC surface is stable; semantics shift from Keychain-specific to secure-storage-specific
- [Rules]: TECH_DESIGN_V2.md Section 6 — secure-storage wrapper is the only allowed `keyring` call site

### Files

Create:

- `src-tauri/src/secure_store.rs` — shared secure-storage wrapper over `keyring`

Modify:

- `src-tauri/src/lib.rs` — register the renamed module
- `src-tauri/src/commands/settings.rs` — use secure-store wrapper and `SECURE_STORAGE_ERROR`
- `src-tauri/src/commands/translations.rs` — use secure-store wrapper and `SECURE_STORAGE_ERROR`
- `src/lib/tauri-commands.ts` — normalize/propagate the new backend error code cleanly

Do NOT touch:

- `src/windows/` — no window-layout changes belong in this backend migration task
- `src/components/library/` — library surface is unaffected

### Acceptance Criteria

- No Rust module is named or described as macOS-only keychain storage anymore
- All backend secure-storage failures surface as `SECURE_STORAGE_ERROR`
- The renderer still cannot read the saved API key value
- Settings save, clear, status, and test-connection flows remain behaviorally unchanged
- No files outside the "Files" section above were modified

### Dependencies

- Requires: Task 1 to be complete
- Blocks: Task 3 (reason: path/import work also depends on the finalized V2 backend module structure)

### ⚠️ Risks & Conflicts

## Do not introduce any plaintext fallback file, environment variable, or SQLite storage for API keys.

## Task 3: Cross-Platform Managed Paths & Import Pipeline

**Status:** [ ] Not Started

### Scope

Make all managed data paths, UUID generation, cover-image normalization, and save-path validation fully cross-platform while preserving the current data model and import/export behavior.

### PRD References

- [Section name]: PRD.md Feature 2 — imports land in the platform-specific managed Folio directory
- [Section name]: PRD.md Feature 10 and Feature 11 — exports and image saves default to the Desktop via native dialogs
- [Section name]: PRD.md Section 6.1 — `books.file_path` and `cover_image_path` remain absolute managed paths
- [Security]: PRD.md Section 8.2 — managed files stay inside Folio's per-user data directory

### TECH_DESIGN References

- [Locked]: TECH_DESIGN_V2.md Section 0 — managed-library behavior and path roots are fixed
- [Stack]: TECH_DESIGN_V2.md Section 1 — `image` replaces `sips`; `uuid` replaces `/dev/urandom`
- [Structure]: TECH_DESIGN_V2.md Section 2 — `platform::paths`
- [Rules]: TECH_DESIGN_V2.md Section 6 — no hardcoded `Library/Application Support`, no shelling out to OS image tools, no manual UUID generation
- [Risks]: TECH_DESIGN_V2.md Section 8 — Windows path normalization and asset-scope strictness

### Files

Modify:

- `src-tauri/src/db/mod.rs` — resolve DB path through platform helpers
- `src-tauri/src/epub/importer.rs` — resolve managed paths cross-platform; use `image` for PNG normalization; use `uuid`
- `src-tauri/src/epub/exporter.rs` — keep archive/export behavior consistent with normalized paths
- `src-tauri/src/commands/books.rs` — ensure file deletion and path handling work for Windows paths
- `src-tauri/src/commands/export.rs` — validate save paths correctly on case-insensitive Windows filesystems
- `src-tauri/src/commands/highlights.rs` — replace any manual UUID generation
- `src-tauri/src/commands/notes.rs` — replace any manual UUID generation
- `src-tauri/src/llm/mod.rs` — replace any manual UUID generation

Do NOT touch:

- `src/components/settings/` — no renderer settings UI changes in this task
- `src/components/reader/` — no reader interaction changes in this task

### Acceptance Criteria

- No code path depends on `/dev/urandom`
- No code path shells out to `sips`
- Import, cover extraction, delete-book cleanup, and export path validation work with both POSIX and Windows paths
- SQLite path storage remains absolute and managed under the Folio data root
- No schema change is introduced
- No files outside the "Files" section above were modified

### Dependencies

- Requires: Task 2 to be complete
- Blocks: Task 4 (reason: shell/window work should land after the core cross-platform file and path model is stable)

### ⚠️ Risks & Conflicts

## This task must preserve the managed-library boundary exactly; it must not fall back to reading source files in place after import.

## Task 4: Windows Shell, Menu, and Window Restoration

**Status:** [ ] Not Started

### Scope

Implement the Windows-native shell behaviors required by V2: settings menu entry point, native menu shape, and monitor-safe window restoration for library, settings, and reader windows.

### PRD References

- [Section name]: PRD.md Feature 3 — one window per book, focus existing window if already open
- [Section name]: PRD.md Feature 14 — settings opens from the native app menu on both platforms
- [Wireframe]: PRD.md Section 5b — native window controls stay native; no custom titlebar is introduced
- [Responsive]: PRD.md Section 8.3 — native OS window controls preserved, no custom titlebar

### TECH_DESIGN References

- [Structure]: TECH_DESIGN_V2.md Section 2 — `platform/menu.rs` and `platform/windows.rs`
- [Frontend]: TECH_DESIGN_V2.md Section 4e — settings menu accelerator differs by OS, renderer routes stay unchanged
- [Rules]: TECH_DESIGN_V2.md Section 6 — monitor-safe window restoration, native titlebars remain
- [Risks]: TECH_DESIGN_V2.md Section 8 — detached monitors must not reopen windows off-screen

### Files

Modify:

- `src-tauri/src/lib.rs` — use platform menu module and monitor-safe restore helpers
- `src-tauri/src/commands/reader.rs` — preserve open/focus behavior with restored bounds
- `src-tauri/src/platform/menu.rs` — implement macOS and Windows menu variants
- `src-tauri/src/platform/windows.rs` — clamp persisted bounds into visible monitor work areas

Do NOT touch:

- `src/App.tsx` — route structure stays unchanged
- `src/windows/LibraryWindow.tsx` — no renderer menu/settings button should be invented here

### Acceptance Criteria

- macOS keeps `Folio > Settings…` with `⌘,`
- Windows gets `File > Settings` with `Ctrl+,`
- Reader windows still focus instead of duplicating
- Persisted window bounds reopen on-screen after display topology changes
- No custom titlebar or renderer-side settings entry point is added
- No files outside the "Files" section above were modified

### Dependencies

- Requires: Task 3 to be complete
- Blocks: Task 5 (reason: renderer copy and settings messaging should land after the shell behavior is fixed)

### ⚠️ Risks & Conflicts

## Do not move menu responsibility into the renderer; TECH_DESIGN_V2.md keeps settings entry as native shell behavior.

## Task 5: Renderer Cross-Platform Copy & Settings Neutralization

**Status:** [ ] Not Started

### Scope

Update renderer copy, settings error text, path display handling, and font labels so the existing UI reads correctly on both macOS and Windows without changing layout or feature behavior.

### PRD References

- [Section name]: PRD.md Feature 12, Feature 13, and Feature 14 — search, reader display settings, and settings wording are now platform-neutral
- [Wireframe]: PRD.md Section 5b — same visual layout, but native window controls are abstract placeholders only
- [States]: PRD.md Section 7 — error/loading copy remains present and actionable

### TECH_DESIGN References

- [Design]: TECH_DESIGN_V2.md Section 4a — renderer copy must not mention Finder, Keychain, or traffic lights
- [Frontend]: TECH_DESIGN_V2.md Section 4c — no new UI components or layout branches
- [Rules]: TECH_DESIGN_V2.md Section 6 — renderer copy must be OS-neutral unless the UI element itself is OS-specific
- [Patterns]: TECH_DESIGN_V2.md Section 7 — secure-storage error copy pattern

### Files

Modify:

- `src/components/settings/TranslationTab.tsx` — secure-storage wording, no Keychain-specific copy
- `src/hooks/useTranslation.ts` — secure-storage error wording
- `src/windows/ReaderWindow.tsx` — any inline alert copy that still says macOS Keychain
- `src/components/library/BookInfoSheet.tsx` — ensure long Windows paths wrap correctly
- `src/components/reader/DisplaySettingsPopover.tsx` — font labels align with PRD language (`System Sans`, `Monospace`) without changing actual behavior unexpectedly

Do NOT touch:

- `src/components/ui/` — shadcn output remains untouched
- `src/styles/` — no design-token rewrite in this copy/neutralization task

### Acceptance Criteria

- No user-visible renderer copy mentions Finder, Keychain, or macOS-only window controls
- Settings and translation errors use neutral secure-storage wording
- Long Windows file paths do not break layout in the info sheet
- No layout changes beyond text wrapping and copy updates are introduced
- No files outside the "Files" section above were modified

### Dependencies

- Requires: Task 4 to be complete
- Blocks: Task 6 (reason: release verification should run after user-facing copy and settings flows are finalized)

### ⚠️ Risks & Conflicts

## This task must not redesign the app for Windows; the requirement is copy and compatibility neutrality, not a new visual language.

## Task 6: Cross-Platform Verification, Packaging & Release Hardening

**Status:** [ ] Not Started

### Scope

Run the macOS regression pass and the new Windows verification matrix, then harden packaging/release configuration so Folio V2 is ready to ship on both supported desktop platforms.

### PRD References

- [Section name]: PRD.md Section 3 — all existing features must remain behaviorally intact
- [States]: PRD.md Section 7 — loading/error/empty states must still match spec after the platform work
- [NFR]: PRD.md Section 8 — performance, security, and responsive desktop requirements must hold on both platforms

### TECH_DESIGN References

- [Infrastructure]: TECH_DESIGN_V2.md Section 1 — macOS bundles, Windows NSIS/MSI, WebView2 bootstrapper, signing
- [Rules]: TECH_DESIGN_V2.md Section 6 — explicit asset scope, native titlebars, secure-storage error code
- [Verification]: TECH_DESIGN_V2.md Section 10 — required cross-platform test matrix
- [Migration]: TECH_DESIGN_V2.md Section 11 — final regression and release pass

### Files

Modify:

- `src-tauri/tauri.conf.json` — finalize Windows bundle settings if any gaps remain after earlier tasks
- `TECH_DESIGN_V2.md` — update only if implementation exposes any spec mismatch that needs human resolution

Create:

- none required; verification output belongs in PRs or release notes, not permanent repo files unless explicitly requested

Do NOT touch:

- `PRD.md` — do not change product scope during verification
- `src/` and `src-tauri/src/` — no opportunistic refactors unrelated to verification and release hardening

### Acceptance Criteria

- The full TECH_DESIGN_V2.md Section 10 verification matrix has been executed
- macOS existing flows still pass after the V2 platform work
- Windows install/startup works on a clean machine or VM with WebView2 bootstrapper flow covered
- Import, reading, translation, export, quote save, settings save/clear, and multi-window restore are validated on Windows
- Packaging configuration is ready for signed macOS and Windows releases
- No files outside the "Files" section above were modified

### Dependencies

- Requires: Task 5 to be complete
- Blocks: None

### ⚠️ Risks & Conflicts

## Verification must not silently rewrite the spec. If implementation reveals a mismatch with PRD.md or TECH_DESIGN_V2.md, stop and escalate instead of normalizing it in code.

## Project Overview
Folio is a macOS-only Tauri desktop ePub reader that manages a local library, opens each book in its own reader window, supports highlights and notes, performs paragraph-level OpenRouter bilingual translation, and generates quote-cover images while preserving a macOS Books-style reading experience. The stack is fixed: the renderer in `src/` uses React 18.3, TypeScript 5.5, Vite 5.4, Tailwind CSS 3.4, shadcn/ui, Zustand, TanStack Query, React Hook Form, Zod, epub.js, and React Router; the native backend in `src-tauri/` uses Tauri 2.1, Rust, rusqlite, reqwest, tokio, serde, sha2, zip, keyring, minidom, and quick-xml, with the repo root organized around those two app roots plus top-level build/config files.

## Source of Truth Hierarchy
When implementing anything, consult documents in this exact order:
1. PRD.md — what to build and how it should look/behave. NEVER deviate.
2. TECH_DESIGN.md — how to build it. NEVER choose a different pattern or library.
3. tasks.md — scope boundary only. Tasks point to the spec, they are not the spec.

If a task description conflicts with PRD.md or TECH_DESIGN.md, the task is WRONG.
Follow PRD.md and TECH_DESIGN.md. Do not use your own judgment to fill gaps —
stop and ask instead.

## Before Writing Any Code
Re-read these every time, without exception:
- The relevant wireframe in PRD.md Section 5b
- The relevant error/empty/loading states in PRD.md Section 7
- The component map in TECH_DESIGN.md Section 4c
- The key implementation rules in TECH_DESIGN.md Section 6 and the component patterns in TECH_DESIGN.md Section 7

## Tech Stack (non-negotiable)
- React 18.3 for the renderer UI framework
- TypeScript 5.5 for frontend code
- Vite 5.4 for frontend bundling
- shadcn/ui (CLI-generated) for component primitives
- Tailwind CSS 3.4 for all app styling
- Zustand 4.5 for transient UI state
- TanStack Query 5.59 for async data fetching and cache management
- React Hook Form 7.53 for forms
- Zod 3.23 for validation and schema typing
- epub.js 0.3.93 for ePub rendering, pagination, CFI, and annotations
- React Router 6.26 for window route trees
- Tauri 2.1 for the desktop shell and Rust IPC boundary
- rusqlite 0.32 for SQLite access
- rusqlite_migration 1.2 for startup migrations
- reqwest 0.12 for OpenRouter HTTP calls
- tokio 1.40 for async runtime
- serde + serde_json 1.0 for IPC serialization
- sha2 0.10 for SHA-256 hashing
- zip 2.2 for bilingual ePub assembly
- keyring 3.3 for macOS Keychain storage
- minidom 0.4 + quick-xml 0.36 for ePub metadata parsing
- SQLite 3 (embedded via rusqlite) as the only database
- Tauri CLI 2.x for build output
- macOS arm64 + x86_64 universal binary as the only target
- Apple Developer ID signing in production
- No authentication layer of any kind

## Folder Structure Rules
- `src/` contains the React renderer only. Do not place Rust code, SQL, or native-only logic here.
- `src/windows/` contains only the three window root components: Library, Reader, and Settings. Do not put shared business logic here.
- `src/components/ui/` contains CLI-generated shadcn/ui files only. Do not manually edit these files.
- `src/components/library/` contains components used only by `LibraryWindow`. Do not place reader or settings concerns here.
- `src/components/reader/` contains components used only by `ReaderWindow`. Do not place library or settings concerns here.
- `src/components/settings/` contains components used only by `SettingsWindow`. Do not place reader or library concerns here.
- `src/hooks/` contains one hook per data domain. Put fetching, mutation, invalidation, and UI-facing data logic here, not inside JSX components.
- `src/store/` contains transient UI state only. Do not persist long-term data here; persisted state must go through hooks and Tauri commands.
- `src/lib/tauri-commands.ts` is the only place allowed to call `invoke()`. Do not call `invoke()` anywhere else.
- `src/lib/epub-bridge.ts` owns epub.js initialization and typed bridge helpers. Do not initialize epub.js from arbitrary components.
- `src/lib/quote-canvas.ts` contains quote-cover rendering logic only. Do not mix unrelated UI or persistence logic into it.
- `src/types/` contains types and interfaces only. Do not add implementation code here.
- `src/styles/` contains global Tailwind directives, CSS custom properties, and reader theme CSS only. Do not create CSS modules or ad hoc style files.
- `src-tauri/` contains the Rust backend only. Do not place frontend code here.
- `src-tauri/src/commands/` contains one file per feature domain exporting only `#[tauri::command]` functions. Do not put unrelated helpers or UI logic here.
- `src-tauri/src/db/` contains schema and migration SQL definitions only. Do not place business logic, HTTP code, or translation logic here.
- `src-tauri/src/epub/` contains managed-library import/export ePub file operations only. Do not place LLM or UI concerns here.
- `src-tauri/src/llm/` contains all OpenRouter interaction and translation worker logic. Do not put database access here; communicate results back through Tauri events.
- `src-tauri/src/keychain.rs` is the thin macOS Keychain wrapper. Do not expose API key material to the renderer.

## Coding Standards
- All implementation must follow TECH_DESIGN.md Section 6 exactly; these rules are not optional.
- Call `invoke()` only from `src/lib/tauri-commands.ts`, and expose typed wrapper functions to hooks/components.
- Every async Tauri wrapper must use `try/catch` and rethrow typed `FolioError` values with a `code` field.
- All forms must use React Hook Form plus Zod, with the schema defined first and TypeScript types inferred from it.
- Use Tailwind utility classes for styling. Do not use inline styles except for dynamically computed positioning values such as popup coordinates.
- Initialize epub.js once per `ReaderWindow` through `src/lib/epub-bridge.ts`, and access reader state through Zustand rather than touching epub.js directly from unrelated components.
- Keep all OpenRouter calls in Rust only, with the API key read from macOS Keychain in Rust and never serialized into frontend payloads or events.
- Apply highlights with the exact epub.js annotation pattern defined in TECH_DESIGN.md Section 6.
- Inject bilingual translations through `rendition.hooks.content.register()` using deterministic `spine_item_href + paragraph_index` paragraph locations.
- Sanitize translated HTML in Rust before writing it to SQLite; if sanitization breaks structure, fail the paragraph instead of rendering unsafe or invalid HTML.
- Debounce reading-position saves to at most once every 2 seconds.
- Use the shared SQLite `Mutex<Connection>` in Tauri app state. Do not share raw SQLite connections across threads.
- Preserve the Tauri CSP defined in TECH_DESIGN.md Section 6. Do not loosen it or add unapproved origins.
- Preserve Rust-owned window size and position persistence for library, settings, and per-book reader windows.
- Use loading skeletons, inline retryable errors, and mutation invalidation patterns exactly as described in TECH_DESIGN.md Section 4d and Section 7.

## Forbidden Behaviors
- ❌ Do NOT invent UI layout not shown in the ASCII wireframes in PRD.md Section 5b
- ❌ Do NOT use any library not listed in TECH_DESIGN.md Section 1
- ❌ Do NOT add fields or endpoints not defined in TECH_DESIGN.md Section 3 and Section 5
- ❌ Do NOT skip loading, error, or empty states defined in PRD.md Section 7
- ❌ Do NOT modify files outside the scope of the current task
- ❌ Do NOT resolve conflicts between documents — flag them and stop

## Self-Check Before Marking Any Task Done
Run through this checklist. Do not say "done" until all pass:
- [ ] UI matches the ASCII wireframe in PRD.md Section 5b (compared line by line)
- [ ] Component structure matches TECH_DESIGN.md Section 4c for this page
- [ ] All IPC calls use the exact command names, args, and event contracts from TECH_DESIGN.md Section 5
- [ ] Loading / error / empty states implemented per PRD.md Section 7
- [ ] Component follows the implementation and component patterns in TECH_DESIGN.md Sections 6 and 7
- [ ] No files outside the current task's file list were modified

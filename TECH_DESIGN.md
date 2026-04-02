# TECH_DESIGN.md — Folio (macOS ePub Reader)

> Generated from PRD v1. Every decision below is final — no alternatives listed. A coding agent should be able to start writing code from this document with zero ambiguity.

---

## 0. Locked Decisions

1. **OpenRouter is the only translation provider in MVP.** There is no provider abstraction, provider dropdown, or custom base URL in the product surface.
2. **Folio is a managed library.** On import, the `.epub` is copied into `~/Library/Application Support/Folio/Books/`, and that managed copy is the only file the reader opens.
3. **Translation is done in paragraph units.** One paragraph maps to one translation request, one translation record, and one export insertion point.
4. **Translated paragraphs are identified by location, not by hash alone.** The primary key is `spine_item_href + paragraph_index`; `paragraph_hash` is retained only for validation and retry bookkeeping.
5. **The renderer never receives the saved API key.** It can only ask whether a key exists, save a replacement key, clear the saved key, or request a Rust-side connection test.

---

## 1. Technology Stack

### Frontend (Renderer Process — Webview)

| Layer | Choice | Version | Reason |
|---|---|---|---|
| UI Framework | React | 18.3 | Component model maps cleanly to Tauri's single-page webview per window |
| Language | TypeScript | 5.5 | Type safety across Tauri IPC boundaries where payload shapes must be exact |
| Bundler | Vite | 5.4 | Tauri's default; fastest HMR for local development |
| Component Library | shadcn/ui | latest (CLI-generated) | Unstyled primitives give full control over macOS Books-matching dark aesthetics |
| CSS | Tailwind CSS | 3.4 | Utility-first; co-located styles; no CSS file sprawl for a single-app product |
| Global State | Zustand | 4.5 | Lightweight store for UI state (active drawers, selection, translation status); no boilerplate |
| Async Data / Cache | TanStack Query | 5.59 | Caches Tauri IPC responses, handles loading/error states, auto-refetch on window focus |
| Forms | React Hook Form | 7.53 | Uncontrolled inputs for perf; pairs with Zod for schema validation |
| Validation | Zod | 3.23 | Single source of truth for form schemas and IPC payload types |
| ePub Renderer | epub.js | 0.3.93 | PRD explicitly specifies epub.js; handles CFI, pagination, and annotation APIs |
| Routing | React Router | 6.26 | Multi-window app; each window is a separate React tree rooted at a route |

### Backend (Rust — Tauri Process)

| Layer | Choice | Version | Reason |
|---|---|---|---|
| Desktop Framework | Tauri | 2.1 | macOS-only requirement; smallest bundle size; IPC to Rust for security-sensitive ops |
| Database Driver | rusqlite | 0.32 | Embedded SQLite; no external DB process; all data local per PRD |
| Migrations | rusqlite_migration | 1.2 | Lightweight migration runner; runs on startup before any DB access |
| HTTP Client (LLM) | reqwest | 0.12 | Async HTTP with TLS; OpenRouter calls stay in Rust so the API key never touches the renderer |
| Async Runtime | tokio | 1.40 | Required by reqwest and Tauri's async command system |
| Serialization | serde + serde_json | 1.0 | Tauri's IPC serialization layer requires Serialize/Deserialize on all payload types |
| Hashing | sha2 | 0.10 | SHA-256 file hash for duplicate detection and paragraph_hash for translations |
| ZIP / ePub Assembly | zip | 2.2 | ePub is a ZIP archive; used for bilingual ePub export (A8) |
| Keychain | keyring | 3.3 | macOS Keychain read/write; wraps `security-framework` under the hood |
| ePub Metadata Parse | minidom + quick-xml | 0.4 / 0.36 | Parse OPF/NCX/Nav documents to extract title, author, cover on import |

### Database

| Layer | Choice | Reason |
|---|---|---|
| Engine | SQLite 3 (embedded via rusqlite) | Local-only app; no server; zero-config; matches PRD requirement for `~/Library/Application Support/Folio/folio.db` |

### Infrastructure / Distribution

| Layer | Choice | Reason |
|---|---|---|
| Build | Tauri CLI 2.x (`tauri build`) | Produces signed `.app` bundle and `.dmg` installer |
| Target | macOS arm64 + x86_64 (universal binary) | PRD targets macOS; universal binary covers Apple Silicon and Intel |
| Signing | Apple Developer ID (ad-hoc for dev) | Required for Gatekeeper; Keychain access requires a signed bundle in production |

### Auth

None — PRD §2.1 explicitly states single local user, no authentication.

---

## 2. Project Structure

```
/
├── src-tauri/                    ← Rust backend (Tauri process)
│   ├── Cargo.toml
│   ├── tauri.conf.json           ← Window definitions, permissions, bundle config
│   ├── capabilities/
│   │   └── default.json          ← Tauri v2 capability file (fs, shell, dialog scopes)
│   └── src/
│       ├── main.rs               ← Entry point; calls lib::run()
│       ├── lib.rs                ← Tauri builder, plugin registration, command registration
│       ├── db/
│       │   ├── mod.rs            ← DbConn type alias; connection pool init (Mutex<Connection>)
│       │   ├── schema.rs         ← CREATE TABLE statements as &str constants
│       │   └── migrations.rs     ← Migration list; runs rusqlite_migration on startup
│       ├── commands/
│       │   ├── mod.rs            ← Re-exports all #[tauri::command] fns
│       │   ├── books.rs          ← import_book, get_books, get_book, delete_book
│       │   ├── highlights.rs     ← add_highlight, update_highlight, delete_highlight, get_highlights
│       │   ├── notes.rs          ← save_note, update_note, delete_note, get_notes
│       │   ├── reader.rs         ← save_reading_position, get_reading_settings, update_reading_settings, open_reader_window
│       │   ├── translations.rs   ← start_translation, pause_translation, resume_translation, cancel_translation, get_translations, retry_failed_paragraphs
│       │   ├── export.rs         ← export_bilingual_epub
│       │   └── settings.rs       ← get_app_settings, save_app_settings, save_api_key, has_api_key, clear_api_key, test_openrouter_connection
│       ├── epub/
│       │   ├── mod.rs            ← Public API for epub module
│       │   ├── importer.rs       ← Copy file to App Support, extract metadata, compute SHA-256
│       │   └── exporter.rs       ← Assemble bilingual ePub ZIP from translations table using spine_item_href + paragraph_index locators
│       ├── llm/
│       │   ├── mod.rs            ← Re-exports; LlmClient struct definition
│       │   ├── client.rs         ← reqwest client; builds OpenRouter request, sanitizes response; single `translate_paragraph(html, lang, model) -> String` fn
│       │   └── worker.rs         ← Translation job runner; spawned as tokio task; paragraph loop by spine_item_href + paragraph_index; pause/resume via Arc<AtomicBool>; emits Tauri events per paragraph
│       └── keychain.rs           ← Thin wrapper around `keyring` crate for service "com.folio.app"
│
├── src/                          ← React frontend (renderer process)
│   ├── main.tsx                  ← ReactDOM.createRoot; wraps App in QueryClientProvider
│   ├── App.tsx                   ← BrowserRouter; route tree for all three window types
│   ├── windows/
│   │   ├── LibraryWindow.tsx     ← Root component for tauri://localhost/ route
│   │   ├── ReaderWindow.tsx      ← Root component for tauri://localhost/reader route; reads ?bookId
│   │   └── SettingsWindow.tsx    ← Root component for tauri://localhost/settings route
│   ├── components/
│   │   ├── ui/                   ← shadcn/ui generated files ONLY — never edit manually
│   │   │   └── (button, dialog, dropdown-menu, input, popover, tabs, textarea, toast, …)
│   │   ├── library/              ← Components used only in LibraryWindow
│   │   │   ├── BookGrid.tsx      ← Responsive CSS grid of BookCard components
│   │   │   ├── BookCard.tsx      ← Cover image, title, author, progress badge, "managed file missing" overlay
│   │   │   ├── BookContextMenu.tsx ← Right-click context menu (Open / Book Info / Remove)
│   │   │   ├── BookInfoSheet.tsx ← Read-only metadata sheet
│   │   │   ├── Sidebar.tsx       ← Library / Recently Read section nav + counts
│   │   │   ├── LibraryToolbar.tsx ← Search bar, Import button
│   │   │   ├── EmptyState.tsx    ← Empty library illustration + CTA
│   │   │   ├── DuplicateBanner.tsx ← Auto-dismissing top banner
│   │   │   └── DropZone.tsx      ← Drag-and-drop overlay; listens for dragover/drop on window
│   │   ├── reader/               ← Components used only in ReaderWindow
│   │   │   ├── ReaderToolbar.tsx ← TOC / Annotations / Aa / Theme / Translate / Bilingual buttons
│   │   │   ├── EpubViewer.tsx    ← Mounts epub.js Rendition into a div; owns the Book instance
│   │   │   ├── SelectionPopup.tsx ← Floating 320×44px bar above selection; color swatches + action buttons
│   │   │   ├── NoteEditor.tsx    ← Floating panel for create/edit/delete notes
│   │   │   ├── TocDrawer.tsx     ← Left drawer (280px) with chapter list
│   │   │   ├── AnnotationsDrawer.tsx ← Right drawer (280px); Highlights / Notes tabs
│   │   │   ├── DisplaySettingsPopover.tsx ← Aa popover: font size, family, line height, theme
│   │   │   ├── TranslationBanner.tsx ← Fixed top banner during translation; Pause / Cancel
│   │   │   ├── TranslationSheet.tsx ← Modal: language dropdown + Start Translation
│   │   │   ├── QuoteCoverModal.tsx ← 800×600 modal; canvas preview + controls
│   │   │   ├── PageChevrons.tsx  ← < > nav buttons, appear on hover
│   │   │   └── ProgressBar.tsx   ← Bottom bar: "{Chapter Title} · {X}%"
│   │   └── settings/             ← Components used only in SettingsWindow
│   │       ├── GeneralTab.tsx    ← Placeholder only: "No general settings yet."
│   │       └── TranslationTab.tsx ← OpenRouter API key status, API key input, model, Test Connection, Clear Saved Key
│   ├── hooks/
│   │   ├── useBooks.ts           ← useQuery wrapper for get_books; useImportBooks mutation
│   │   ├── useBook.ts            ← useQuery wrapper for get_book by id
│   │   ├── useHighlights.ts      ← useQuery + mutations for highlights CRUD
│   │   ├── useNotes.ts           ← useQuery + mutations for notes CRUD
│   │   ├── useTranslation.ts     ← useQuery for get_translations; mutation for start/pause/resume/cancel; Tauri event subscription
│   │   ├── useReadingSettings.ts ← useQuery + mutation for per-book display prefs
│   │   ├── useAppSettings.ts     ← useQuery + mutation for global app settings
│   │   ├── useApiKeyStatus.ts    ← has_api_key + save_api_key + clear_api_key + test_openrouter_connection
│   │   ├── useEpubSelection.ts   ← Listens to epub.js 'selected' event; exposes selectedCfi + selectedText
│   │   ├── useLibraryFilter.ts   ← Debounced search query + sidebar filter state
│   │   └── useWindowState.ts     ← Reads/writes window size+position via Tauri window API
│   ├── store/
│   │   ├── readerStore.ts        ← Zustand: currentCfi, theme, bilingual mode active, open drawers, popup state
│   │   └── libraryStore.ts       ← Zustand: search query, sidebar section, import spinner state
│   ├── lib/
│   │   ├── tauri-commands.ts     ← One typed wrapper function per Tauri command; ALL invoke() calls live here
│   │   ├── epub-bridge.ts        ← Initializes epub.js Book + Rendition; exports typed event helpers
│   │   ├── quote-canvas.ts       ← Renders quote cover to offscreen HTMLCanvasElement; returns Blob
│   │   └── utils.ts              ← cn() for class merging, pluralize(), formatPercent(), hashStringToColor()
│   ├── types/
│   │   ├── book.ts               ← Book, BookSummary, LibraryFilter interfaces
│   │   ├── annotation.ts         ← Highlight, Note interfaces
│   │   ├── translation.ts        ← Translation, TranslationJob, TranslationProgress interfaces
│   │   ├── settings.ts           ← ReadingSettings, AppSettings interfaces
│   │   └── events.ts             ← Tauri event payload types (TranslationProgressEvent, etc.)
│   └── styles/
│       ├── globals.css           ← Tailwind directives (@tailwind base/components/utilities); CSS custom properties
│       └── reader-themes.css     ← Light / Sepia / Dark theme classes injected into epub.js iframe
│
├── index.html                    ← Vite entry HTML
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

**Folder rules:**
- `src/components/ui/` — shadcn output only; generated by `npx shadcn@latest add`; never edit manually
- `src/components/library/` — only components rendered inside LibraryWindow; no reader concerns allowed here
- `src/components/reader/` — only components rendered inside ReaderWindow; no library concerns
- `src/hooks/` — one hook per data domain; no business logic in components, only in hooks
- `src/lib/tauri-commands.ts` — the ONLY file that calls `invoke()`; nowhere else
- `src/store/` — only transient UI state that is NOT persisted to SQLite; persisted state always goes through hooks → Tauri commands
- `src/types/` — interfaces and types only; no implementation code
- `src-tauri/src/commands/` — one file per feature domain; each file exports only `#[tauri::command]` functions
- `src-tauri/src/db/` — all SQL statements; no business logic; no HTTP calls
- `src-tauri/src/llm/` — all LLM API interaction; no DB access; communicates results back via Tauri events

---

## 3. Data Models

### `books`

| Field | Type | Constraints |
|---|---|---|
| id | TEXT | PRIMARY KEY, UUID v4 generated in Rust |
| title | TEXT | NOT NULL |
| author | TEXT | NOT NULL, default "Unknown Author" |
| file_path | TEXT | NOT NULL, absolute path within App Support/Books/ |
| cover_image_path | TEXT | nullable, absolute path to extracted PNG inside App Support |
| added_at | INTEGER | NOT NULL, Unix timestamp (seconds) |
| last_read_at | INTEGER | nullable, Unix timestamp |
| last_position_cfi | TEXT | nullable, epub.js CFI string |
| file_hash | TEXT | NOT NULL, SHA-256 hex string, UNIQUE |
| reading_progress | REAL | NOT NULL DEFAULT 0.0, 0.0–1.0 percentage for badge display |

Indexes: `CREATE UNIQUE INDEX idx_books_file_hash ON books(file_hash)` | `CREATE INDEX idx_books_last_read_at ON books(last_read_at)`

---

### `highlights`

| Field | Type | Constraints |
|---|---|---|
| id | TEXT | PRIMARY KEY, UUID v4 |
| book_id | TEXT | NOT NULL, FK → books.id ON DELETE CASCADE |
| cfi_range | TEXT | NOT NULL, epub.js CFI range string |
| color | TEXT | NOT NULL, one of: `#FFD60A`, `#30D158`, `#0A84FF`, `#FF375F`, `#BF5AF2` |
| text_excerpt | TEXT | NOT NULL, plain text of selection |
| created_at | INTEGER | NOT NULL, Unix timestamp |

Indexes: `CREATE INDEX idx_highlights_book_id ON highlights(book_id)`

Relationships: Highlight belongs to Book via `book_id`. Note optionally belongs to Highlight via `notes.highlight_id`.

---

### `notes`

| Field | Type | Constraints |
|---|---|---|
| id | TEXT | PRIMARY KEY, UUID v4 |
| book_id | TEXT | NOT NULL, FK → books.id ON DELETE CASCADE |
| highlight_id | TEXT | nullable, FK → highlights.id ON DELETE SET NULL |
| cfi | TEXT | NOT NULL, anchor CFI (start of selection) |
| text_excerpt | TEXT | NOT NULL, selected text at creation time |
| body | TEXT | NOT NULL |
| created_at | INTEGER | NOT NULL, Unix timestamp |
| updated_at | INTEGER | NOT NULL, Unix timestamp |

Indexes: `CREATE INDEX idx_notes_book_id ON notes(book_id)`

---

### `translations`

| Field | Type | Constraints |
|---|---|---|
| id | TEXT | PRIMARY KEY, UUID v4 |
| book_id | TEXT | NOT NULL, FK → books.id ON DELETE CASCADE |
| spine_item_href | TEXT | NOT NULL, relative href of the chapter/xhtml file inside the ePub spine |
| paragraph_index | INTEGER | NOT NULL, zero-based paragraph ordinal within that spine item |
| paragraph_hash | TEXT | NOT NULL, SHA-256 of original paragraph HTML |
| original_html | TEXT | NOT NULL |
| translated_html | TEXT | NOT NULL, sanitized HTML fragment |
| target_language | TEXT | NOT NULL, e.g. `"Chinese (Simplified)"` |
| created_at | INTEGER | NOT NULL, Unix timestamp |

Unique constraint: `UNIQUE(book_id, target_language, spine_item_href, paragraph_index)` — one translation record per paragraph location.

Indexes: `CREATE INDEX idx_translations_book_lang ON translations(book_id, target_language)` | `CREATE INDEX idx_translations_book_lang_spine ON translations(book_id, target_language, spine_item_href)`

---

### `translation_jobs`

| Field | Type | Constraints |
|---|---|---|
| id | TEXT | PRIMARY KEY, UUID v4 |
| book_id | TEXT | NOT NULL, FK → books.id ON DELETE CASCADE |
| target_language | TEXT | NOT NULL |
| status | TEXT | NOT NULL, CHECK(status IN ('in_progress','paused','complete','cancelled','failed')) |
| total_paragraphs | INTEGER | NOT NULL DEFAULT 0 |
| completed_paragraphs | INTEGER | NOT NULL DEFAULT 0 |
| failed_paragraph_locators | TEXT | NOT NULL DEFAULT '[]', JSON array of `{spine_item_href, paragraph_index}` |
| pause_reason | TEXT | nullable, CHECK(pause_reason IN ('manual','rate_limit','network','app_restart')) |
| created_at | INTEGER | NOT NULL, Unix timestamp |
| updated_at | INTEGER | NOT NULL, Unix timestamp |

Unique constraint: `UNIQUE(book_id, target_language)` — one active job per book+language.

---

### `reading_settings`

| Field | Type | Constraints |
|---|---|---|
| book_id | TEXT | PRIMARY KEY, FK → books.id ON DELETE CASCADE |
| font_size | INTEGER | NOT NULL DEFAULT 18, CHECK(font_size BETWEEN 12 AND 32) |
| font_family | TEXT | NOT NULL DEFAULT 'Georgia', CHECK(font_family IN ('Georgia','system-ui','Palatino','Menlo')) |
| line_height | REAL | NOT NULL DEFAULT 1.6, CHECK(line_height IN (1.4, 1.6, 1.9)) |
| theme | TEXT | NOT NULL DEFAULT 'light', CHECK(theme IN ('light','sepia','dark')) |

---

### `app_settings`

| Field | Type | Constraints |
|---|---|---|
| key | TEXT | PRIMARY KEY |
| value | TEXT | NOT NULL, JSON-encoded value |

Predefined keys: `llm_model` (string), `window_state_library` (JSON `{x,y,width,height}`), `window_state_settings` (JSON `{x,y,width,height}`), `window_state_{book_id}` (JSON `{x,y,width,height}`)

macOS Keychain: service = `"com.folio.app"`, account = `"llm_api_key"`.

---

## 4. Frontend Architecture

### 4a. Design System

**Component library:** shadcn/ui (Tailwind-based primitives)
**CSS approach:** Tailwind CSS utility classes only; no inline styles; no CSS modules
**Overall aesthetic:** Matches macOS Books dark mode as shown in design reference screenshots — near-black window, minimal chrome, large cover thumbnails, muted sidebar text with white active labels.

**The app is dark-mode only.** No light mode toggle for the shell UI. The three reader themes (Light / Sepia / Dark) only affect the epub.js reading area, not the surrounding app chrome.

**Color tokens (defined as CSS custom properties in `src/styles/globals.css`):**

```css
/* ── App Chrome (Library, Sidebar, Toolbars) ── */
--color-bg-window:       #161618   /* outermost window background — near-black */
--color-bg-sidebar:      #1C1C1E   /* sidebar panel background */
--color-bg-content:      #1C1C1E   /* library grid content area */
--color-bg-surface:      #2C2C2E   /* popovers, sheets, context menus, modals */
--color-bg-elevated:     #3A3A3C   /* hover states, input backgrounds */

/* ── Text ── */
--color-text-primary:    #FFFFFF   /* main labels, headings, active sidebar items */
--color-text-secondary:  #EBEBF5CC /* 80% white — secondary labels, book titles below grid */
--color-text-muted:      #8E8E93   /* captions, progress %, inactive sidebar items */
--color-text-section:    #636366   /* sidebar section headers ("LIBRARY") */

/* ── Interactive ── */
--color-primary:         #0A84FF   /* CTAs, "NEW" badge, active indicator, links */
--color-primary-hover:   #0A7AE0   /* primary button hover */
--color-destructive:     #FF453A   /* delete actions, error states */
--color-success:         #30D158   /* success states */

/* ── Borders & Dividers ── */
--color-border:          rgba(255,255,255,0.08)   /* subtle dividers, card separators */
--color-border-strong:   rgba(255,255,255,0.15)   /* input borders, popover outlines */

/* ── Sidebar Active State ── */
--color-sidebar-active-bg:   rgba(255,255,255,0.10)  /* selected sidebar item fill */
--color-sidebar-active-text: #FFFFFF

/* ── Reader Themes (epub.js content area only) ── */
/* Light:  bg #FFFFFF, text #1A1A1A */
/* Sepia:  bg #F5F0E8, text #3B2F2F */
/* Dark:   bg #2C2C2E, text #E5E5EA  ← matches reader screenshot */

/* ── Highlight colors (per PRD) ── */
--color-hl-yellow:  #FFD60A
--color-hl-green:   #30D158
--color-hl-blue:    #0A84FF
--color-hl-pink:    #FF375F
--color-hl-purple:  #BF5AF2
```

**Typography scale:**

| Token | Font | Size | Weight | Line Height | Usage |
|---|---|---|---|---|---|
| `page-title` | system-ui | 28px | 700 | 1.2 | "All", "Recently Read" page heading |
| `sidebar-section` | system-ui | 11px | 600 | 1.3 | "LIBRARY" — ALL CAPS, letter-spacing 0.06em |
| `sidebar-item` | system-ui | 14px | 400 | 1.4 | Nav items in sidebar |
| `sidebar-item-active` | system-ui | 14px | 500 | 1.4 | Active nav item |
| `body` | system-ui | 13px | 400 | 1.5 | General UI text |
| `caption` | system-ui | 12px | 400 | 1.4 | Progress %, timestamps, secondary info |
| `badge` | system-ui | 11px | 600 | 1.0 | "NEW" pill text |
| `reader-body` | Georgia | 18px (configurable 12–32px) | 400 | 1.7 | ePub content — generous line height per screenshot |
| `reader-translation` | Georgia | 16px | 400 | 1.7 | Bilingual translated paragraph |
| `reader-title` | system-ui | 13px | 300 | 1.0 | Book title in reader window title bar — thin, muted |

**Spacing unit:** 4px base. Use multiples: 4, 8, 12, 16, 20, 24, 32, 48, 64.

**Border radius:**
- `sm`: 4px (inputs, tags)
- `md`: 8px (context menus, popovers)
- `lg`: 12px (popup bar, note editor, sheets)
- `xl`: 20px (modals)
- `full`: 9999px (sidebar active pill, "NEW" badge, search bar)

**Shadow scale (dark context — lighter shadows stand out less):**
- `sm`: `0 1px 4px rgba(0,0,0,0.40)`
- `md`: `0 4px 12px rgba(0,0,0,0.50)`
- `popup`: `0 8px 24px rgba(0,0,0,0.60)` — floating popups on dark bg

**Book card anatomy (matches screenshot):**
- No card background or border — just the cover image floating on the dark grid bg
- Cover image: ~160px wide, ~220px tall, no border-radius (rectangular, like physical books)
- Below cover (8px gap): progress text left-aligned (`--color-text-muted`, 12px), "…" button right-aligned
- "NEW" badge: `#0A84FF` pill (4px vertical padding, 8px horizontal), white 11px bold text, positioned below cover left-aligned (replaces progress % when book never opened)
- No hover card lift/shadow — macOS Books style shows the cover directly

**Sidebar anatomy:**
- Width: 210px, fixed
- Single section header: "LIBRARY" in 11px ALL CAPS, `--color-text-section`, 16px top margin
- Section items: "All" and "Recently Read"; icon + label, 36px row height, full-width pill active state
- No extra store links, collection groups, or user profile block in MVP
- Active item background: `rgba(255,255,255,0.10)` with `border-radius: 8px`, inset 4px each side

---

### 4b. Responsive Breakpoints

| Breakpoint | Width | Layout Behavior |
|---|---|---|
| compact | < 700px | Sidebar hidden; 2-column book grid; toolbar icons only (no text labels) |
| standard | 700–999px | Sidebar collapsible (hidden by default, ☰ toggle); 3-column grid |
| full | ≥ 1000px | Sidebar always visible (220px); 4+ column grid (reflows to 8 max) |

Reader-specific:
- ≥ 800px: horizontal margins 80px
- < 800px: horizontal margins 40px
- Minimum window size: 600×500px (enforced in `tauri.conf.json`)

---

### 4c. Page-to-Component Mapping

```
src/windows/LibraryWindow.tsx
  └── <LibraryToolbar>          ← search bar (debounced 150ms), Import button, import spinner
        ├── <Sidebar>           ← Library / Recently Read counts; compact breakpoint: hidden
        ├── <BookGrid>          ← CSS grid, 2–8 columns, drag-and-drop accepts .epub files
        │     └── <BookCard>    × N  ← cover 160×220, title 2-line truncate, author 1-line, progress badge
        ├── <BookContextMenu>   ← portal rendered on right-click; Open / Book Info / Remove
        ├── <BookInfoSheet>     ← shadcn Sheet; title/author/added date/file size/path
        ├── <EmptyState>        ← shown when books.length === 0 AND no active search
        ├── <DropZone>          ← full-window dragover overlay; calls import_book on drop
        └── <DuplicateBanner>   ← top-fixed, auto-dismisses after 4s via setTimeout

src/windows/ReaderWindow.tsx    ← reads ?bookId from URL
  └── <ReaderToolbar>           ← appears on mousemove, fades after 2s idle
        ├── <EpubViewer>        ← div#epub-container; epub.js Book + Rendition mounted here
        ├── <PageChevrons>      ← < > hover-reveal buttons; 40px hit area
        ├── <ProgressBar>       ← bottom bar: chapter title + percentage
        ├── <SelectionPopup>    ← portal; 320×44px; positioned above selection midpoint
        ├── <NoteEditor>        ← portal; floating panel; conditional on Note action
        ├── <TocDrawer>         ← shadcn Sheet, side="left", 280px; chapter list
        ├── <AnnotationsDrawer> ← shadcn Sheet, side="right", 280px; Highlights/Notes tabs
        ├── <DisplaySettingsPopover> ← shadcn Popover anchored to Aa button
        ├── <TranslationBanner> ← fixed top strip; shown when job status = 'in_progress'|'paused'
        ├── <TranslationSheet>  ← shadcn Dialog; language dropdown + Start Translation
        └── <QuoteCoverModal>   ← shadcn Dialog 800px; left preview / right controls

src/windows/SettingsWindow.tsx
  └── <shadcn/Tabs>
        ├── <GeneralTab>        ← placeholder text only: "No general settings yet."
        └── <TranslationTab>    ← OpenRouter API key status/API key/model/Test Connection/Clear Saved Key/Save
```

---

### 4d. Frontend Data Fetching Rules

- **Library:** TanStack Query v5 (`useQuery`, `useMutation`)
- All query functions defined in: `src/hooks/use[Entity].ts` (see hooks list in §2)
- All IPC calls go through: `src/lib/tauri-commands.ts` — no direct `invoke()` anywhere else
- **Loading state:** always show a skeleton that matches the real content shape (e.g., BookCard skeleton for grid items, list-item skeletons in drawers). Never a blank area, never a generic spinner except for full-screen initial loads.
- **Error state:** always show an inline error message with a "Retry" button that calls `refetch()`
- Never fetch data directly inside a JSX component — always through a custom hook
- Mutations must invalidate the relevant query key after success (e.g., `addHighlight` mutation invalidates `['highlights', bookId]`)

---

### 4e. Navigation & Routing

**Router:** React Router 6.26 (`BrowserRouter`)

Route map:
```
/                  → src/windows/LibraryWindow.tsx    (main Tauri window)
/reader            → src/windows/ReaderWindow.tsx     (new WebviewWindow per book; reads ?bookId=)
/settings          → src/windows/SettingsWindow.tsx   (Settings WebviewWindow; non-resizable)
```

Multi-window management:
- `open_reader_window` Tauri command creates a `WebviewWindow` with label `reader-{bookId}` and URL `/reader?bookId={bookId}`
- If window with that label already exists, call `.setFocus()` — not a new window
- Settings window: opened by Rust via macOS `⌘,` menu item; label `settings`; 560×400, `resizable: false`

Active nav state: Sidebar items compare current `SidebarSection` enum value from `libraryStore`; active item gets `bg-[--color-primary]/10 text-[--color-primary]` classes.

---

### 4f. Animation & Interaction Rules

- **Page transitions:** none — Tauri windows are native; transitions inside the reader are instant page flips
- **Reader toolbar:** CSS `transition: opacity 200ms ease`; appears on `mousemove`, fades after 2000ms idle
- **Drawers (TOC / Annotations):** shadcn Sheet default slide animation, 200ms
- **Loading skeletons:** `animate-pulse` Tailwind class; BookCard skeleton = 160×220 rounded rect + two text bars
- **Button states:**
  - default: base color
  - hover: 8% darker (Tailwind `hover:brightness-90`)
  - active: 15% darker
  - disabled: 40% opacity, `cursor-not-allowed`
  - loading: spinner (16px, `animate-spin`) replaces label text; button width locked to prevent layout shift
- **Form feedback:** show Zod validation errors on `onBlur`, not on submit; error text appears below the field in `text-[--color-error] text-xs`
- **Toast notifications:** shadcn/ui `useToast`; position `bottom-right`; auto-dismiss 4000ms; stacks vertically
- **Duplicate banner:** fixed top (below toolbar); auto-dismiss 4000ms via `useEffect` + `setTimeout`

---

## 5. API Design (Tauri IPC Commands)

All commands are invoked via `src/lib/tauri-commands.ts` using `invoke<ReturnType>('command_name', args)`.

---

### Books

**`import_book`**
```
Args:    { file_paths: string[] }
Returns: { books: Book[], duplicates: { title: string }[], errors: { filename: string }[] }
Events:  Emits "import:progress" { filename: string, status: "copying"|"parsing"|"done" }
Errors:  —  (errors returned in response body, not thrown)
```

**`get_books`**
```
Args:    { filter: "all" | "recent" }   // "recent" = last_read_at within 30 days
Returns: Book[]
Errors:  —
```

**`get_book`**
```
Args:    { book_id: string }
Returns: Book
Errors:  404 equivalent → throws "BOOK_NOT_FOUND"
```

**`delete_book`**
```
Args:    { book_id: string }
Returns: void
Side effect: Removes the managed `.epub` from App Support, deletes the extracted cover image if present, and removes book record + highlights + notes + translations + translation_jobs + reading_settings (CASCADE); does NOT delete the original source file outside App Support
Errors:  throws "BOOK_NOT_FOUND"
```

---

### Reader

**`open_reader_window`**
```
Args:    { book_id: string }
Returns: void
Side effect: Creates or focuses WebviewWindow with label "reader-{book_id}"
```

**`save_reading_position`**
```
Args:    { book_id: string, cfi: string, progress: number }   // progress 0.0–1.0
Returns: void
```

**`get_reading_settings`**
```
Args:    { book_id: string }
Returns: ReadingSettings   // with defaults if no row exists
```

**`update_reading_settings`**
```
Args:    { book_id: string, settings: Partial<ReadingSettings> }
Returns: ReadingSettings
```

---

### Highlights

**`get_highlights`**
```
Args:    { book_id: string }
Returns: Highlight[]   // sorted by created_at ASC
```

**`add_highlight`**
```
Args:    { book_id: string, cfi_range: string, color: string, text_excerpt: string }
Returns: Highlight
Errors:  throws "INVALID_COLOR" if color not in allowed set
```

**`update_highlight`**
```
Args:    { id: string, color: string }
Returns: Highlight
Errors:  throws "HIGHLIGHT_NOT_FOUND"
```

**`delete_highlight`**
```
Args:    { id: string }
Returns: void
Side effect: Sets notes.highlight_id = NULL for any linked notes (not deletion)
```

---

### Notes

**`get_notes`**
```
Args:    { book_id: string }
Returns: Note[]   // sorted by created_at ASC
```

**`save_note`**
```
Args:    { book_id: string, highlight_id: string | null, cfi: string, text_excerpt: string, body: string }
Returns: Note
Errors:  throws "EMPTY_BODY" if body.trim() === ""
```

**`update_note`**
```
Args:    { id: string, body: string }
Returns: Note | null   // null means the note was deleted because body.trim() === ""
Errors:  throws "NOTE_NOT_FOUND"
```

**`delete_note`**
```
Args:    { id: string }
Returns: void
```

---

### Translation

**`start_translation`**
```
Args:    { book_id: string, target_language: string, replace_existing?: boolean }
Returns: TranslationJob
Side effect: Spawns tokio task running translation worker; emits translation:progress events. If `replace_existing` is true, existing translations for that book/language are deleted before the new job starts.
Errors:  throws "NO_API_KEY" | "JOB_ALREADY_EXISTS" | "TRANSLATION_ALREADY_COMPLETE"
```

**`pause_translation`**
```
Args:    { job_id: string }
Returns: TranslationJob   // status: "paused"
```

**`resume_translation`**
```
Args:    { job_id: string }
Returns: TranslationJob   // status: "in_progress"
Side effect: Restarts tokio task from last completed paragraph
```

**`cancel_translation`**
```
Args:    { job_id: string }
Returns: void   // already-translated paragraphs remain in DB
```

**`get_translations`**
```
Args:    { book_id: string, target_language: string }
Returns: Translation[]   // keyed by spine_item_href + paragraph_index for O(1) lookup in EpubViewer
```

**`get_translation_job`**
```
Args:    { book_id: string, target_language: string }
Returns: TranslationJob | null
```

**`retry_failed_paragraphs`**
```
Args:    { job_id: string }
Returns: TranslationJob
Side effect: Re-enqueues only paragraphs in failed_paragraph_locators
```

**Tauri Events emitted by translation worker (Rust → Frontend):**
```
"translation:progress"  payload: { job_id, completed, total, latest_spine_item_href, latest_paragraph_index }
"translation:complete"  payload: { job_id }
"translation:error"     payload: { job_id, spine_item_href, paragraph_index, error_message }
"translation:paused"    payload: { job_id, reason: "rate_limit"|"network"|"manual", retry_after_secs?: number }
```

---

### Export

**`export_bilingual_epub`**
```
Args:    { book_id: string, target_language: string, save_path: string }
Returns: void
Side effect: Writes .epub file to save_path; emits "export:progress" { percent: number }
Errors:  throws "TRANSLATION_INCOMPLETE" if job not 100% complete | "WRITE_ERROR"
```

---

### Settings

**`get_app_settings`**
```
Args:    —
Returns: AppSettings { llm_model: string }
```

**`save_app_settings`**
```
Args:    { settings: Partial<AppSettings> }
Returns: AppSettings
```

**`save_api_key`**
```
Args:    { api_key: string }
Returns: void
Side effect: Writes to macOS Keychain via keyring crate; never touches SQLite
Errors:  throws "KEYCHAIN_ERROR" on OS-level failure
```

**`has_api_key`**
```
Args:    —
Returns: { configured: boolean }
```

**`clear_api_key`**
```
Args:    —
Returns: void
Side effect: Removes the saved API key from macOS Keychain
Errors:  throws "KEYCHAIN_ERROR" on OS-level failure
```

**`test_openrouter_connection`**
```
Args:    { api_key: string | null, model: string }   // if api_key is null, use the already-saved key
Returns: { success: true } | { success: false, error: string }
Side effect: Sends one OpenRouter translate "Hello" → "English" request; does NOT save anything
```

---

## 6. Key Implementation Rules

1. **All `invoke()` calls are in `src/lib/tauri-commands.ts` only.** Components and hooks import typed wrapper functions from that file. Never call `invoke()` directly from a component or hook.

2. **All forms use React Hook Form + Zod schema validation.** Define the Zod schema first; infer the TypeScript type from it with `z.infer<typeof Schema>`.

3. **No inline styles anywhere in the React codebase.** Use Tailwind utility classes exclusively. Exception: dynamically computed values (e.g., popup position top/left from `getBoundingClientRect()`) must use `style={{ top: px, left: px }}` as the only allowed inline style usage.

4. **Every async Tauri command wrapper in `tauri-commands.ts` is wrapped in try/catch.** Errors are rethrown as typed `FolioError` objects with a `code: string` field so the UI can pattern-match on error codes.

5. **epub.js is initialized once per ReaderWindow in `src/lib/epub-bridge.ts`.** The `EpubViewer` component mounts it and stores the `Rendition` instance in a React ref. All other reader components access epub.js state through the `readerStore` (Zustand), not directly.

6. **All OpenRouter calls happen exclusively in Rust (`src-tauri/src/llm/client.rs`).** The API key is read from Keychain in Rust and set as `Authorization: Bearer {key}` on the reqwest request. The key is never serialized into any Tauri event payload or IPC response. The only renderer-visible secret state is `has_api_key() -> { configured: boolean }`.

7. **Highlights are applied to epub.js using `rendition.annotations.add('highlight', cfiRange, {}, id, 'hl', {fill: color, 'fill-opacity': '0.35'})`.** This is called inside a `rendition.hooks.content.register()` callback so highlights re-render on every page turn.

8. **Translation injection into epub.js content uses `rendition.hooks.content.register()`** to intercept each rendered page's `document`, enumerate translatable paragraphs in DOM order within the current spine item, assign each one a deterministic `paragraph_index`, and insert `<p class="folio-translation">` elements immediately after the matching `spine_item_href + paragraph_index` location.

9. **Every translated HTML fragment is sanitized in Rust before it is written to SQLite.** Allow only the inline tags already present in the source paragraph plus a fixed safe subset (`em`, `strong`, `b`, `i`, `u`, `span`, `br`, `sup`, `sub`, `code`). Strip scripts, styles, event handlers, external URLs, and block-level elements. If sanitization changes the structure in a way that breaks tag balance, mark the paragraph as failed instead of rendering it.

10. **Debounce reading position saves to at most once per 2 seconds.** Implement with `useRef` storing a `setTimeout` handle; clear and reset on every `rendition.on('relocated')` event.

11. **SQLite connection is a `Mutex<Connection>` stored in Tauri `AppState`.** All DB operations acquire the lock, execute synchronously (rusqlite is synchronous), and release. Never share the raw Connection across threads.

12. **The `tauri.conf.json` Content Security Policy for all windows:** `"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' asset: data: blob:; connect-src 'self' ipc: http://ipc.localhost"`. `unsafe-inline` for style is required by epub.js for theme injection.

13. **Window position persistence is handled in Rust for every window type.** Tauri window `Moved`/`Resized` events write `window_state_library`, `window_state_settings`, or `window_state_{bookId}` directly into `app_settings`. On window creation, Rust restores size/position before showing the window.

---

## 7. Component Patterns

### Page (Window Root) Component Template

```tsx
// src/windows/ReaderWindow.tsx
import { useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useBook } from '@/hooks/useBook'

export default function ReaderWindow() {
  const [searchParams] = useSearchParams()
  const bookId = searchParams.get('bookId')!

  const { data: book, isLoading, error } = useBook(bookId)

  if (isLoading) return <FullScreenSpinner />
  if (error)     return <FullScreenError message={error.message} />
  if (!book)     return null

  return (
    <div className="flex flex-col h-screen bg-[--color-background]">
      <ReaderToolbar book={book} />
      <EpubViewer book={book} />
      <ProgressBar />
    </div>
  )
}
```

### Loading / Error State Pattern

```tsx
// Inside any component that consumes a hook:
const { data, isLoading, error, refetch } = useHighlights(bookId)

if (isLoading) return <AnnotationsSkeletonList count={5} />
if (error) return (
  <div className="flex flex-col items-center gap-2 p-4 text-[--color-error]">
    <p className="text-sm">Failed to load annotations.</p>
    <button onClick={() => refetch()} className="text-xs underline">Retry</button>
  </div>
)
```

### Form Pattern

```tsx
// Example: Note Editor
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const NoteSchema = z.object({
  body: z.string(),
})
type NoteForm = z.infer<typeof NoteSchema>

function NoteEditor({ initialBody, onSave, onCancel }: Props) {
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<NoteForm>({
    resolver: zodResolver(NoteSchema),
    defaultValues: { body: initialBody },
  })

  const onSubmit = async (data: NoteForm) => {
    const body = data.body.trim()
    if (!body && !initialBody) {
      setError('body', { type: 'manual', message: 'Note cannot be empty.' })
      return
    }
    await onSave(body)   // caller handles create/update/delete branching
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <textarea {...register('body')} className="w-full resize-none min-h-[80px] max-h-[200px]" />
      {errors.body && <p className="text-xs text-[--color-error] mt-1">{errors.body.message}</p>}
      <div className="flex justify-end gap-2 mt-3">
        <button type="button" onClick={onCancel}>Cancel</button>
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Spinner size={16} /> : 'Save'}
        </button>
      </div>
    </form>
  )
}
```

### Tauri Command Wrapper Pattern

```ts
// src/lib/tauri-commands.ts
import { invoke } from '@tauri-apps/api/core'
import type { Highlight } from '@/types/annotation'

export class FolioError extends Error {
  constructor(public code: string, message: string) {
    super(message)
  }
}

export async function addHighlight(
  bookId: string, cfiRange: string, color: string, textExcerpt: string
): Promise<Highlight> {
  try {
    return await invoke<Highlight>('add_highlight', {
      book_id: bookId, cfi_range: cfiRange, color, text_excerpt: textExcerpt,
    })
  } catch (e) {
    throw new FolioError(e as string, `Failed to save highlight: ${e}`)
  }
}
```

---

## 8. Technical Risks & Mitigations

⚠️ **Risk: epub.js iframe DOM access for bilingual translation injection**
Content rendered by epub.js lives inside a sandboxed `<iframe>`. Direct DOM manipulation from the parent frame is blocked by same-origin policy in some configurations.
**Mitigation:** Use `rendition.hooks.content.register(contents => { ... })` which gives access to the iframe's `document` directly within epub.js's rendering pipeline. Always inject via this hook, never via `iframe.contentDocument` from outside.

---

⚠️ **Risk: epub.js CFI stability across ePub versions**
If the user replaces an ePub file with a different edition, stored CFIs become invalid, crashing navigation.
**Mitigation:** Wrap all `rendition.display(cfi)` calls in a try/catch. On failure, display from the beginning and show the "reading position could not be restored" banner. The `file_hash` in `books` table catches wholesale file replacements; the banner handles subtler CFI drift.

---

⚠️ **Risk: SQLite lock contention from concurrent Tauri command calls**
Tauri commands run on a tokio thread pool. Multiple simultaneous commands each acquiring `Mutex<Connection>` can cause command queuing and UI lag, especially during translation (many DB writes).
**Mitigation:** Use `rusqlite` in WAL (Write-Ahead Logging) mode: execute `PRAGMA journal_mode=WAL` on connection open. This allows concurrent reads. Writes still serialize via the Mutex but are fast (single paragraph insert ≈ microseconds). The translation worker batches DB writes in chunks of 10 paragraphs.

---

⚠️ **Risk: LLM API rate limits stalling translation**
OpenRouter imposes per-minute rate limits. Paragraph-by-paragraph reqwest calls can hit these quickly for large books.
**Mitigation:** In `llm/worker.rs`, inspect the HTTP response status. On 429, read the `Retry-After` response header (default 30s if absent), set the pause `AtomicBool`, emit a `translation:paused { reason: "rate_limit", retry_after_secs }` Tauri event, sleep via `tokio::time::sleep`, then resume automatically. Per-request timeout enforced via `reqwest::ClientBuilder::timeout(Duration::from_secs(30))`. One automatic retry per paragraph before marking as failed.

---

⚠️ **Risk: Quote cover Canvas rendering fails due to cross-origin cover image**
The book cover image is an `asset://` URL. Drawing it to a Canvas element may throw a CORS security error if the Canvas becomes tainted.
**Mitigation:** In `src/lib/quote-canvas.ts`, load the cover via `fetch()` (which works for `asset://` URLs within Tauri's webview), convert to a Blob URL with `URL.createObjectURL()`, then draw to Canvas. This avoids cross-origin tainting.

---

⚠️ **Risk: epub.js does not support all ePub 3 features**
Some ePub 3 books use JavaScript, multimedia, or complex fixed-layout that epub.js 0.3.x renders incorrectly.
**Mitigation:** This is explicitly accepted scope. The app targets reflowable ePub 2 and 3. DRM-protected books are rejected at open time (detect by attempting to parse the OPF; if encrypted `encryption.xml` exists → show error). No mitigation for complex fixed-layout — it's not a stated requirement.

---

⚠️ **Risk: translated HTML can inject unsafe markup into the reader iframe**
OpenRouter returns model-generated HTML fragments. If these are inserted directly, malformed or unsafe markup can break rendering or create an XSS surface inside the webview.
**Mitigation:** Sanitize every translation fragment in Rust before it is persisted. Allow only the safe inline tag subset listed in §6, strip all attributes except a constrained `class` allowlist when needed, and reject the paragraph if the sanitized fragment does not remain a valid inline HTML fragment.

---

⚠️ **Risk: Tauri macOS Keychain access fails in development (unsigned app)**
`keyring` crate on macOS uses the Keychain, which requires a signed application or explicit user approval. In dev, the app may be unsigned.
**Mitigation:** There is no plaintext fallback. If Keychain access fails, return `KEYCHAIN_ERROR` and require the developer to run a signed dev build or grant Keychain access explicitly. This preserves the PRD requirement that the API key is stored only in Keychain.

---

## 9. Third-Party Services

### epub.js
- **Used for:** ePub parsing, rendering, pagination, CFI generation, annotation overlays
- **Installed via:** `npm install epubjs@0.3.93`
- **Env vars:** none
- **Reference docs:** https://github.com/futurepress/epub.js/blob/master/documentation/md/API.md

---

### OpenRouter API (LLM translation)
- **Used for:** All full-book paragraph translation; called from Rust backend via reqwest
- **Endpoint:** `POST https://openrouter.ai/api/v1/chat/completions`
- **Model:** `google/gemini-2.5-flash-lite-preview`
- **Env vars:** None at build time. OpenRouter API key stored in macOS Keychain (service `"com.folio.app"`, account `"llm_api_key"`); read by Rust at translation time.
- **Settings stored in SQLite `app_settings`:** `llm_model` (default `"google/gemini-2.5-flash-lite-preview"`)

**Request shape (in `src-tauri/src/llm/client.rs`):**
```rust
// POST https://openrouter.ai/api/v1/chat/completions
// Headers:
//   Authorization: Bearer {api_key}
//   Content-Type: application/json
//   HTTP-Referer: https://folio.app   (required by OpenRouter)
//   X-Title: Folio                    (required by OpenRouter)
{
  "model": "google/gemini-2.5-flash-lite-preview",
  "messages": [
    {
      "role": "user",
      "content": "Translate the following text to {target_language}. Preserve only the existing inline HTML formatting tags. Return only the translated HTML fragment, no explanation.\n\n{paragraph_html}"
    }
  ],
  "max_tokens": 2048
}
```

**Response:** standard OpenRouter chat completion; extract `choices[0].message.content`, sanitize it, then persist the sanitized fragment as `translated_html`.

**Translation worker (`src-tauri/src/llm/worker.rs`):**
- Spawned as a `tokio::task::spawn` from `start_translation` command
- Iterates paragraphs by `spine_item_href + paragraph_index`; calls `client::translate_paragraph()` per paragraph
- After each success: writes to `translations` table, increments `translation_jobs.completed_paragraphs`, emits `translation:progress` Tauri event
- Pause/resume: checks `Arc<AtomicBool> pause_flag` before each call; sleeps in a `tokio::time::sleep` loop when paused
- Cancel: checks `Arc<AtomicBool> cancel_flag`; breaks loop, sets job status `"cancelled"`
- On app restart: `lib.rs` converts any `status = 'in_progress'` jobs to `status = 'paused'` with `pause_reason = 'app_restart'`; when the user next opens that book, the reader prompts whether to resume or stop

- **Reference docs:** https://openrouter.ai/docs/api-reference/chat-completions

---

### macOS Keychain (via `keyring` crate)
- **Used for:** Secure storage of LLM API key
- **Crate:** `keyring = "3.3"` in `Cargo.toml`
- **Service name:** `"com.folio.app"`, account: `"llm_api_key"`
- **Env vars:** none
- **Reference docs:** https://docs.rs/keyring/latest/keyring/

---

### Tauri
- **Used for:** Desktop app shell, native window management, IPC, file system access, macOS menu bar, dialog boxes
- **Version:** `tauri = "2.1"` (backend), `@tauri-apps/api@2.x` (frontend)
- **Env vars:** None at runtime. Build env: `TAURI_SIGNING_PRIVATE_KEY` for code signing.
- **Reference docs:** https://v2.tauri.app/reference/

---

## 10. Verification Matrix

| Flow | Expected Result |
|---|---|
| Import duplicate `.epub` twice | Second import is skipped by `file_hash`; duplicate banner appears; no second `books` row is created |
| Delete imported book | Managed `.epub` and extracted cover are removed from App Support; source file outside App Support remains untouched |
| Restart during translation | `translation_jobs.status` becomes `paused` with `pause_reason = 'app_restart'`; next open of the book prompts Continue/Stop |
| Translate book with repeated identical paragraphs | Each location gets its own translation row because lookup is by `spine_item_href + paragraph_index`, not by hash alone |
| Receive unsafe translated HTML | Rust sanitizer strips/rejects unsafe markup; failed paragraph is recorded without injecting unsafe DOM |
| Save existing note as whitespace-only | Backend deletes the note and returns `null`; UI removes the note indicator |
| Open book whose managed library file is missing | Reader refuses to open, shows managed-file-missing error, and does not offer external file relinking |
| Save API key in dev build with Keychain unavailable | Command returns `KEYCHAIN_ERROR`; no plaintext fallback file is created |

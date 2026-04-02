# PRD: Folio — macOS ePub Reader (Tauri)

---

## 1. Product Overview

Folio is a native macOS desktop application built with Tauri that lets users read ePub books from a personal local library. It solves the limitations of the default macOS Books app by adding LLM-powered bilingual translation, rich text annotation (highlights + notes), and a quote-cover image generator — while preserving the clean, familiar Books aesthetic. The target user is a heavy reader who consumes foreign-language or English books and wants annotation and translation tools inside a polished native reader.

**Core user journey:**
1. User launches app → sees Library window (bookshelf grid)
2. User imports an `.epub` file via drag-and-drop or toolbar button → book appears on shelf
3. User double-clicks a book → new Reader window opens at the last-read position
4. User reads, selects text → popup bar appears → user highlights, adds a note, translates, or creates a quote cover
5. User optionally enables full-book LLM translation → bilingual view renders progressively as translation completes
6. User closes Reader window → position is auto-saved → next open resumes at exact position

---

## 2. User Roles & Permissions

### 2.1 Single User (Local, No Auth)
There is exactly one role. The app has no authentication, no cloud sync, and no multi-user concept. All data is local to the macOS user account.

| Capability | Allowed |
|---|---|
| Import ePub files | ✓ |
| Read books | ✓ |
| Highlight text (5 colors) | ✓ |
| Add/edit/delete notes | ✓ |
| Trigger LLM translation | ✓ (requires API key configured in Settings) |
| View bilingual text while translation is in progress | ✓ |
| Export bilingual ePub | ✓ |
| Create and save quote cover images | ✓ |
| Delete books from library | ✓ |
| Configure OpenRouter API key and model | ✓ |
| Access another user's library | ✗ (no such concept) |

---

## 3. Feature List (MVP)

---

### Feature 1: Library & Bookshelf

**User story:** As a user, I can see all my imported ePub books displayed as a grid of covers so that I can browse and open them quickly.

**Acceptance criteria:**
- ✓ Library window opens on app launch at position/size it was last closed (default: 1100×720, centered)
- ✓ Books are displayed as cover thumbnails in a grid; 4 columns at default window width, reflows as window resizes (minimum 2 columns, maximum 8)
- ✓ Each book card shows: cover image (160×220 px), title (truncated at 2 lines, 13px), author (truncated at 1 line, 11px, gray)
- ✓ If ePub has no embedded cover image, a generated placeholder shows the first letter of the title on a solid color background (color deterministically derived from title string hash)
- ✓ Books are sorted by "Date Added" descending by default
- ✓ User can right-click a book card to open context menu: "Open", "Book Info", "Remove from Library" (removes Folio's managed copy and metadata, but never deletes the original source file that was imported)
- ✓ "Remove from Library" triggers a confirmation dialog before deletion
- ✓ Sidebar shows sections: "Library" (all books count) and "Recently Read" (books opened in last 30 days)
- ✓ Clicking "Library" shows all books; clicking "Recently Read" filters to books with a `lastReadAt` within 30 days

**Edge cases:**
- Managed library file is missing or corrupted (for example, the App Support folder was manually modified) → book card shows a gray overlay with icon "⚠ Library file missing"; double-clicking shows an alert: "This book's managed library file is missing or corrupted. Re-import the book to read it again."
- Library is empty → show empty state (see Section 7)

---

### Feature 2: Import Books

**User story:** As a user, I can import ePub files into my library so that I can read them in Folio.

**Acceptance criteria:**
- ✓ Toolbar button "Import Book" opens macOS native file picker filtered to `.epub` files; supports multi-select
- ✓ User can drag one or more `.epub` files from Finder onto the library window to import
- ✓ On import: Folio copies the file to `~/Library/Application Support/Folio/Books/{book_id}.epub`, extracts metadata (title, author, cover image) from the ePub manifest, and stores metadata in local SQLite database
- ✓ Duplicate detection: if a file with identical SHA-256 hash already exists in the library, import is skipped and a non-blocking banner appears at top of Library: "'{title}' is already in your library." (auto-dismisses after 4 seconds)
- ✓ After import, newly added book(s) appear at the top of the grid immediately (no reload required)
- ✓ A progress indicator (indeterminate spinner in toolbar) shows during import of large files (>20 MB)

**Edge cases:**
- File is not a valid ePub → alert: "'{filename}' could not be imported. The file may be corrupted or is not a valid ePub."
- ePub metadata is missing title → use filename (without `.epub` extension) as title; author shown as "Unknown Author"

---

### Feature 3: Open Book in New Window

**User story:** As a user, I can open each book in its own dedicated window so that I can read multiple books side by side.

**Acceptance criteria:**
- ✓ Double-clicking a book card opens a new macOS window (separate `WebviewWindow` in Tauri) for that book
- ✓ If a Reader window for that book is already open, it is brought to front (not opened again)
- ✓ Each Reader window is independently resizable (minimum 600×500)
- ✓ Reader window title bar shows: "{Book Title} — Folio"
- ✓ Reader window remembers its own size and position per book; restored on next open

**Edge cases:**
- User opens more than 5 books simultaneously → allowed, no cap; performance is user's concern

---

### Feature 4: Reading — Core Renderer

**User story:** As a user, I can read ePub content rendered correctly so that text, images, and formatting display as intended.

**Acceptance criteria:**
- ✓ ePub content rendered via `epub.js` embedded in the Tauri webview
- ✓ Default reading settings: font size 18px, font family "Georgia", line height 1.6, horizontal margins 80px (desktop), theme Light (white background, #1a1a1a text)
- ✓ Three themes available: Light, Sepia (background #f5f0e8, text #3b2f2f), Dark (background #1c1c1e, text #e5e5ea) — selectable from toolbar
- ✓ Paginated layout (not scroll): content fills the viewport and user navigates page by page
- ✓ Left/right arrow keys navigate pages; clicking left 25% / right 25% of viewport navigates pages; swipe gestures on trackpad navigate pages
- ✓ On-screen left/right chevron buttons (< >) appear on hover near screen edges, 40px hit area
- ✓ Bottom progress bar shows reading progress as percentage (0–100%), formatted as "{chapter title} · {X}%"
- ✓ Table of Contents (TOC) accessible from toolbar button; slides in as a left drawer showing all chapters as a list; clicking a chapter navigates to it

**Edge cases:**
- ePub has DRM → display error: "This book is DRM-protected and cannot be opened in Folio."
- Chapter with only images (e.g., a comic page) → rendered as-is; no text selection available on that page

---

### Feature 5: Auto-Save Reading Position

**User story:** As a user, I can close and reopen a book and have it resume exactly where I left off so that I never lose my place.

**Acceptance criteria:**
- ✓ Current reading position is stored as an epub CFI string in the SQLite database, updated every time the user navigates to a new page (debounced: writes at most once per 2 seconds)
- ✓ On opening a book, if a saved CFI exists, the renderer navigates to that CFI before displaying content (user never sees page 1 flash)
- ✓ `lastReadAt` timestamp updated on every open

**Edge cases:**
- Saved CFI is invalid (e.g., ePub was replaced with a different version) → open at beginning of book; show non-blocking banner: "Your reading position could not be restored."

---

### Feature 6: Text Selection Popup Bar

**User story:** As a user, I can select text in the reader and see a popup bar with actions so that I can quickly highlight, annotate, translate a passage, or create a quote cover without navigating away.

**Acceptance criteria:**
- ✓ When user releases mouse button after selecting text in the reader, a floating popup bar appears 12px above the selection midpoint
- ✓ Popup bar contains (left to right): five color swatches (Yellow `#FFD60A`, Green `#30D158`, Blue `#0A84FF`, Pink `#FF375F`, Purple `#BF5AF2`), a divider, a "Note" button (pencil icon), a divider, a "Translate" button (globe icon), a divider, a "Quote" button (image icon)
- ✓ Popup bar is 320px wide, 44px tall, rounded corners (12px radius), white background with 1px border `#E5E5EA`, shadow `0 4px 16px rgba(0,0,0,0.15)` in Light/Sepia theme; dark variant in Dark theme
- ✓ Clicking anywhere outside the popup or the selection dismisses the popup without action
- ✓ Pressing Escape dismisses the popup without action

**Edge cases:**
- Selection spans a page break → popup still appears; the CFI range covers both pages; highlight is stored and renders correctly across the break
- Selection is fewer than 1 character (accidental click) → popup does not appear

---

### Feature 7: Highlighting

**User story:** As a user, I can highlight selected text in one of five colors so that I can visually mark important passages.

**Acceptance criteria:**
- ✓ Clicking a color swatch in the popup bar applies a highlight of that color to the selected CFI range and dismisses the popup
- ✓ Highlight is rendered as a semi-transparent background over the text (opacity 0.35)
- ✓ Highlight persists across sessions (stored in SQLite)
- ✓ Clicking an existing highlight opens the popup bar pre-filled with that highlight's current color and the "Remove Highlight" option (trash icon) appended to the bar
- ✓ Clicking a different color swatch when an existing highlight is selected updates the highlight color
- ✓ Clicking "Remove Highlight" deletes the highlight record and removes the visual highlight; shows no confirmation dialog
- ✓ All highlights for a book are listed in the Annotations panel (see Feature 8)

**Edge cases:**
- Two highlights overlap → both are rendered; the one applied later renders on top; clicking in the overlap opens the popup for the most recently applied highlight

---

### Feature 8: Notes

**User story:** As a user, I can attach a text note to a selection so that I can record my thoughts about a passage.

**Acceptance criteria:**
- ✓ Clicking the "Note" button (pencil icon) in the popup bar opens a Note Editor panel: a floating panel 320px wide, positioned 12px above the selection, containing:
  - Quoted selected text (italic, gray, max 3 lines with ellipsis, non-editable)
  - A `<textarea>` labeled "Note" (minimum 80px tall, auto-expands to max 200px, then scrolls)
  - A "Save" button (blue, primary) and a "Cancel" button (gray, secondary), right-aligned at panel bottom
- ✓ Clicking "Save" stores the note in SQLite linked to the book and CFI; applies a yellow highlight to the selection (if not already highlighted); dismisses the panel; renders a small dot indicator (same color as highlight) on the highlighted text
- ✓ Clicking "Cancel" or pressing Escape dismisses the panel without saving
- ✓ Clicking an existing note indicator opens the Note Editor pre-filled with the existing note text
- ✓ The Note Editor has a "Delete Note" link (red, small) at the bottom-left; clicking it shows a confirmation: "Delete this note?" [Delete] [Cancel]
- ✓ Notes are listed in the Annotations panel with their associated text excerpt

**Edge cases:**
- User saves an empty note (whitespace only) → treated as note deletion if note already existed; if new, shows inline error below textarea: "Note cannot be empty."

---

### Feature 9: Annotations Panel

**User story:** As a user, I can view all my highlights and notes for a book in one panel so that I can review my annotations without scrolling through the whole book.

**Acceptance criteria:**
- ✓ Annotations panel accessed via toolbar button (bookmark icon); slides in as a right drawer (280px wide)
- ✓ Panel shows two tabs: "Highlights" and "Notes"
- ✓ Highlights tab: chronological list (oldest first) of all highlights; each row shows: color dot, excerpt (max 2 lines), page position percentage
- ✓ Notes tab: chronological list; each row shows: excerpt (max 2 lines), first 60 characters of note text, position percentage
- ✓ Clicking any row navigates the reader to that CFI and closes the panel
- ✓ Each row has a delete icon (trash, appears on hover) that deletes the highlight/note after confirmation

**Edge cases:**
- No annotations → show: "No highlights yet. Select text to highlight." / "No notes yet."

---

### Feature 10: Full-Book LLM Translation (Bilingual Mode)

**User story:** As a user, I can translate an entire book using an LLM and read the bilingual version (original + translation interleaved paragraph by paragraph) so that I can understand foreign-language books.

**Acceptance criteria:**
- ✓ Translation triggered via toolbar button "Translate Book" (globe icon); only available if LLM API key is configured in Settings
- ✓ On click, a sheet/dialog appears: "Translate to:" [DROPDOWN: language list — English, Chinese (Simplified), Chinese (Traditional), Japanese, Korean, Spanish, French, German, Portuguese, Arabic, Russian], a "Start Translation" [BUTTON] and "Cancel" [BUTTON]
- ✓ Translation is processed in paragraph units; each paragraph is sent to OpenRouter as an individual API call with context: "Translate the following text to {language}. Preserve the existing inline HTML formatting tags. Return only the translated HTML fragment, no explanation."
- ✓ As each paragraph is translated, it is saved to the `translations` table in SQLite (keyed by `book_id + spine_item_href + paragraph_index + target_language`, with `paragraph_hash` stored for validation/retry) and immediately rendered in the reader
- ✓ In bilingual mode: each original paragraph is displayed, followed immediately by the translated paragraph in a slightly smaller font (16px vs 18px), same font family, color `#6e6e73` (Light/Sepia) or `#8e8e93` (Dark), separated by 4px margin
- ✓ A progress banner fixed at top of reader shows: "Translating · {X} of {N} paragraphs complete · [BUTTON: Pause] [BUTTON: Cancel]"
- ✓ User can read the book normally while translation is in progress; translated paragraphs display as they complete; untranslated paragraphs show only original text
- ✓ Pausing stops new API calls; resuming continues from where it stopped
- ✓ Canceling stops translation; already-translated paragraphs remain in the database and display in bilingual mode
- ✓ Translation state persists across app restarts: if translation was in progress when the app quit, the job is restored in a paused state; on the next open of that book, the reader prompts: "Continue translating '{title}'?" [Continue] [Stop]
- ✓ Toolbar shows "Bilingual: ON" toggle when translation data exists; toggling switches between original-only and bilingual display (translation data is not deleted)
- ✓ "Export Bilingual ePub" button in toolbar (only shown when translation is 100% complete): generates a new `.epub` file with interleaved paragraphs, opens macOS Save dialog defaulting to `~/Desktop/{title}_bilingual.epub`

**Edge cases:**
- LLM API returns an error for a paragraph → that paragraph is skipped (original only shown); a small warning icon appears in the progress banner: "3 paragraphs could not be translated. [LINK: Retry Failed]"
- LLM API key is invalid → translation immediately fails; alert: "Translation failed: Invalid API key. Please check your API key in Settings."
- Book is already fully translated to the selected language → sheet shows: "This book has already been translated to {language}. [BUTTON: Re-translate] [BUTTON: Cancel]"
- Network is offline mid-translation → translation pauses automatically; banner updates to "Translation paused (no internet connection)"; resumes automatically when connectivity is restored

---

### Feature 11: Quote Cover Generator

**User story:** As a user, I can select a passage and generate a shareable quote cover image so that I can share beautiful quotes from my books on social media or save them as mementos.

**Acceptance criteria:**
- ✓ Clicking the "Quote" button (image icon) in the popup bar opens the Quote Cover Creator modal (800×600px, centered on the reader window), passing the selected text
- ✓ Modal contains:
  - Left panel (400px): live preview of the quote cover
  - Right panel (400px): controls
- ✓ Quote cover (1080×1080px output, previewed at 400×400px) contains:
  - Background: one of 5 preset color themes (user selects via color swatches in right panel): Warm (#f5f0e8 bg, #3b2f2f text), Midnight (#1c1c1e bg, #e5e5ea text), Ocean (#0a3d62 bg, #e8f4f8 text), Rose (#fff0f3 bg, #3d0014 text), Forest (#1a2e1a bg, #d4edda text)
  - Book cover image (if available): displayed as a rounded rectangle (80×110px) in the bottom-left corner, with a subtle drop shadow
  - Selected quote text: centered in the cover, font Georgia, size auto-scaled to fit within 80% of cover width, maximum 3 lines; quotes wrapped in `"` `"` typographic quote characters
  - Book title: displayed below the quote text, small caps, 14px, 60% opacity
  - Author name: displayed below book title, italic, 12px, 50% opacity
  - Folio watermark: "Made with Folio" in bottom-right, 10px, 30% opacity
- ✓ Right panel controls: theme swatches (5 colors), a "Quote Text" editable textarea (pre-filled with selected text, user can edit), and a "Save Image" button (blue primary, full width at bottom)
- ✓ Clicking "Save Image" renders the cover to a 1080×1080 PNG using an offscreen HTML5 Canvas, opens macOS Save dialog defaulting to `~/Desktop/{book_title}_quote.png`
- ✓ A "Cancel" button (gray, secondary) closes the modal without saving
- ✓ Live preview updates in real time as user edits the quote text or changes the theme

**Edge cases:**
- Selected text is longer than 280 characters → the Quote text textarea is pre-filled but a warning appears below it: "Long quotes may not display well. Consider shortening." (non-blocking, still allows saving)
- Book has no cover image → the cover area shows only the title initial letter on a colored square (same placeholder logic as library)
- Canvas rendering fails (rare memory error) → alert: "Could not generate image. Please try again."

---

### Feature 12: Search Library

**User story:** As a user, I can search my library by title or author so that I can quickly find a specific book.

**Acceptance criteria:**
- ✓ Search bar is always visible at the top of the Library window (macOS-style, pill-shaped, 220px wide)
- ✓ Search filters the book grid in real time as user types (no submit required), with 150ms debounce
- ✓ Search matches title (substring, case-insensitive) and author (substring, case-insensitive)
- ✓ Matching is client-side (SQLite query on local metadata)
- ✓ While search query is active, grid shows only matching books; sidebar selection is ignored
- ✓ Clearing the search field (via × button or backspace) restores the full library grid
- ✓ Result count shown below search bar: "3 books" or "1 book"

**Edge cases:**
- Search returns 0 results → show: "No books match '{query}'." with a "Clear Search" link

---

### Feature 13: Font & Display Settings

**User story:** As a user, I can adjust font size, font family, line height, and theme in the reader so that reading is comfortable for my preferences.

**Acceptance criteria:**
- ✓ Settings popover accessed via "Aa" toolbar button in reader; opens as a popover (not a modal, does not block reading) positioned below the button
- ✓ Controls in popover:
  - Font Size: "A−" [BUTTON] · {size}px · "A+" [BUTTON]; range 12–32px, step 2px
  - Font: [DROPDOWN] Georgia (serif) | San Francisco (sans-serif) | Palatino (serif) | Menlo (monospace)
  - Line Height: [DROPDOWN] Compact (1.4) | Normal (1.6) | Relaxed (1.9)
  - Theme: three swatches — Light, Sepia, Dark
- ✓ Changes apply instantly to the current page without page reload
- ✓ Settings saved per-book in SQLite (each book remembers its own display preferences)

**Edge cases:**
- none beyond the ranges defined

---

### Feature 14: Settings Window (App-Wide)

**User story:** As a user, I can configure my OpenRouter API key and translation model so that bilingual translation features work.

**Acceptance criteria:**
- ✓ Settings window opened via macOS menu "Folio > Settings…" (⌘,); opens as a standard macOS settings window (separate `WebviewWindow`, 560×400px, not resizable)
- ✓ Settings window has two tabs: "General" and "Translation"
- ✓ General tab: (reserved for future use; shows "No general settings yet.")
- ✓ Translation tab:
  - A read-only status row shows either "API key saved" or "No API key saved"
  - "OpenRouter API Key" [INPUT, password masked] with "Show" toggle; the field is blank on open, and entering a value replaces the stored key
  - "Model" [INPUT text]: pre-filled with `google/gemini-2.5-flash-lite-preview`
  - "Test Connection" [BUTTON, secondary]: sends a minimal OpenRouter test request (translate "Hello" to English) using the current unsaved API key value if present, otherwise the already-saved key; shows "✓ Connection successful" or "✗ Error: {message}" inline
  - "Save" [BUTTON, blue primary] saves the API key to macOS Keychain (if a new value was entered) and saves the selected model to SQLite
  - "Clear Saved Key" [LINK] removes the stored API key from macOS Keychain after confirmation
- ✓ API key is stored in macOS Keychain, not in SQLite
- ✓ The selected OpenRouter model is stored in the `app_settings` table in SQLite

**Edge cases:**
- User leaves API key blank and clicks Save when no key is already stored → error inline: "API key is required for translation."

---

### Feature 15: Table of Contents Navigation

**User story:** As a user, I can view and navigate the book's table of contents so that I can jump directly to any chapter.

**Acceptance criteria:**
- ✓ TOC drawer opened via list-icon button in reader toolbar; slides in from the left (280px wide), overlapping the content area, with a semi-transparent backdrop
- ✓ TOC lists all chapters from the ePub NCX/Nav document as a flat list (nested items indented 16px per level, max 3 levels)
- ✓ Current chapter row is highlighted (blue tint background)
- ✓ Clicking a chapter navigates the reader and closes the drawer
- ✓ Drawer closed by clicking the backdrop or clicking the toolbar button again

**Edge cases:**
- ePub has no TOC document → drawer shows: "This book has no table of contents."

---

## 4. Feature List (V2 — Post-MVP)

---

### V2-Feature 1: Collections / Bookshelves

**User story:** As a user, I can create named collections and add books to them so that I can organize my library by topic, series, or reading list.
- Acceptance criteria: create/rename/delete collections; drag books onto collection name in sidebar; a book can belong to multiple collections; collections shown in sidebar below "Recently Read"
- Excluded from MVP: sidebar shows only "Library" and "Recently Read"

---

### V2-Feature 2: Full-Text Search Within a Book

**User story:** As a user, I can search for a word or phrase within a book so that I can find specific passages.
- Acceptance criteria: Cmd+F opens search bar within reader; matches highlighted; navigate between matches with arrows; match count shown
- Excluded from MVP: search only covers library metadata (title/author)

---

### V2-Feature 3: Reading Statistics

**User story:** As a user, I can see how long I've spent reading each book and my reading pace so that I can track my progress.
- Acceptance criteria: track reading session duration; show "Reading Stats" panel per book with total time, average pages/session, daily reading streak

---

### V2-Feature 4: iCloud Sync

**User story:** As a user, I can sync my library, highlights, and notes across multiple Macs via iCloud so that my data follows me.
- Excluded from MVP: all data is local-only

---

### V2-Feature 5: Export Annotations

**User story:** As a user, I can export all my highlights and notes for a book as a Markdown or CSV file.

---

### V2-Feature 6: Dictionary / Wikipedia Lookup

**User story:** As a user, I can select a word and look it up in the system dictionary or Wikipedia so that I can understand unfamiliar vocabulary.

---

### V2-Feature 7: Reading Goals

**User story:** As a user, I can set a daily reading time goal and see my progress.

---

## 5. Page & Component Inventory

---

### Page 1: Library Window
**URL path:** `tauri://localhost/` (main window)
**Purpose:** Display and manage the user's book collection.

| Component | Data Displayed | Actions Supported |
|---|---|---|
| Top Toolbar | App name "Folio", search bar, import button | Import books, search |
| Sidebar | Section labels, book counts | Navigate to Library / Recently Read |
| Book Grid | Cover images, titles, authors, "Library file missing" overlay | Double-click to open, right-click for context menu |
| Import Drop Zone | Highlighted border when file dragged over window | Drop .epub files |
| Context Menu | "Open", "Book Info", "Remove from Library" | Trigger actions on selected book |
| Book Info Sheet | Title, author, added date, file size, file path | View only (read-only) |
| Empty State | Illustration + instructional text | Click "Import Book" or drag files |
| Duplicate Banner | Book title | Auto-dismiss after 4s |

---

### Page 2: Reader Window
**URL path:** `tauri://localhost/reader` (new window per book, param: `bookId`)
**Purpose:** Display and interact with a single ePub book.

| Component | Data Displayed | Actions Supported |
|---|---|---|
| Reader Toolbar | Book title, chapter title, TOC icon, Annotations icon, "Aa" settings, theme icons, Translate icon, Bilingual toggle, Export icon | Open panels, change settings, trigger translation |
| Reading Area | ePub content (text, images) | Select text, navigate via click/keyboard |
| Page Navigation Chevrons | < > arrows | Previous/next page |
| Progress Bar | Chapter title, percentage | Visual only |
| Text Selection Popup | Color swatches, Note icon, Translate icon, Quote icon | Apply highlight, open note editor, create quote |
| TOC Drawer | Chapter list from ePub | Navigate to chapter |
| Annotations Drawer | Highlights list, Notes list | Navigate to annotation, delete annotation |
| Note Editor Panel | Selected text excerpt, note textarea | Save/cancel/delete note |
| Translation Progress Banner | Paragraph X of N, Pause/Cancel buttons | Control translation |
| Display Settings Popover | Font size, font family, line height, theme | Adjust reading settings |
| Quote Cover Creator Modal | Cover preview, controls | Edit quote, select theme, save image |

---

### Page 3: Settings Window
**URL path:** `tauri://localhost/settings`
**Purpose:** Configure OpenRouter translation credentials.

| Component | Data Displayed | Actions Supported |
|---|---|---|
| Tab Bar | "General", "Translation" labels | Switch tabs |
| Translation Settings Form | OpenRouter API key status, API key field, model field | Input, toggle visibility, test, save, clear saved key |
| Test Connection Result | Success/error message | View only |

---

## 5b. Interface Design — ASCII Wireframes

> Folio's UI mirrors the macOS Books app aesthetic: dark sidebar with translucent sections, book grid with cover thumbnails and progress badges, and a clean two-column reader that shows toolbar only on hover/click.

---

### Library Window — Default State (macOS Books style)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ ● ● ●                                                        [Import Book  +]   │
├──────────────────┬──────────────────────────────────────────────────────────────┤
│                  │                                                               │
│  Library         │  All                                                          │
│                  │                                                               │
│  LIBRARY         │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│                  │  │          │  │          │  │          │  │          │     │
│  ▶ All       12  │  │  [cover] │  │  [cover] │  │  [cover] │  │  [cover] │     │
│    Recently Read │  │          │  │          │  │          │  │          │     │
│                  │  │          │  │          │  │          │  │          │     │
│                  │  │          │  │          │  │          │  │          │     │
│                  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
│                  │  Book Title    Book Title    Book Title    Book Title        │
│                  │  Author Name   Author Name   Author Name   Author Name       │
│                  │       14%           1%           NEW            8%           │
│                  │                                                               │
│                  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│                  │  │          │  │          │  │          │  │          │     │
│                  │  │          │  │          │  │          │  │          │     │
│                  │  │  [cover] │  │  [cover] │  │  [cover] │  │  [cover] │     │
│                  │  │          │  │          │  │          │  │          │     │
│                  │  │          │  │          │  │          │  │          │     │
│                  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
│                  │  Book Title    Book Title    Book Title    Book Title        │
│                  │  Author Name   Author Name   Author Name   Author Name       │
│                  │       6%           NEW           NEW           19%           │
└──────────────────┴──────────────────────────────────────────────────────────────┘
```

**Sidebar items:**
- Library — shows all imported books
- Recently Read — filters to books opened in the last 30 days

**Book card badges:**
- `14%` — reading progress
- `NEW` — never opened (shown in blue pill)
- No badge — finished or progress unknown

---

### Library Window — Empty State

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ ● ● ●                                                        [Import Book  +]   │
├──────────────────┬──────────────────────────────────────────────────────────────┤
│                  │                                                               │
│  Library         │                                                               │
│                  │                          📚                                   │
│  LIBRARY         │                                                               │
│  ▶ All        0  │                   Your library is empty.                      │
│    Recently Read │              Import an ePub file to get started.              │
│                  │                  [BUTTON: Import Book ──────────]             │
│                  │                   or drag .epub files here                    │
│                  │                                                               │
│                  │                                                               │
│                  │                                                               │
│                  │                                                               │
└──────────────────┴──────────────────────────────────────────────────────────────┘
```

---

### Library Window — Search Active State

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ ● ● ●                                                        [Import Book  +]   │
├──────────────────┬──────────────────────────────────────────────────────────────┤
│                  │                                                               │
│  [kafka      ✕]  │  2 books match "kafka"                                       │
│                  │  ──────────────────────────────────────────────────────────   │
│  LIBRARY         │  ┌──────────┐  ┌──────────┐                                  │
│  ▶ All       12  │  │          │  │          │                                  │
│    Recently Read │  │  [cover] │  │  [cover] │                                  │
│                  │  │          │  │          │                                  │
│                  │  └──────────┘  └──────────┘                                  │
│                  │  The Trial     The Metamorphosis                             │
│                  │  Franz Kafka   Franz Kafka                                   │
│                  │       32%           NEW                                       │
│                  │                                                               │
│                  │                                                               │
└──────────────────┴──────────────────────────────────────────────────────────────┘
```

---

### Library Window — Search No Results

```
├──────────────────┬──────────────────────────────────────────────────────────────┤
│  🔍 [xyzfoo   ✕]│                                                               │
│                  │              No books match "xyzfoo".                         │
│                  │                   [LINK: Clear Search]                        │
└──────────────────┴──────────────────────────────────────────────────────────────┘
```

---

### Library Window — Context Menu (Right-click on book)

```
                     ┌─────────────────────────┐
                     │  Open                   │
                     │  Book Info…             │
                     ├─────────────────────────┤
                     │  Remove from Library    │
                     └─────────────────────────┘
```

---

### Reader Window — Clean (no toolbar, macOS Books style)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ ● ● ●                        {Book Title}                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│         Lorem ipsum dolor sit amet,        Sed ut perspiciatis unde omnis       │
│      consectetur adipiscing elit. Sed do   iste natus error sit voluptatem      │
│      eiusmod tempor incididunt ut labore   accusantium doloremque laudantium,   │
│      et dolore magna aliqua. Ut enim ad    totam rem aperiam eaque ipsa quae    │
│      minim veniam, quis nostrud exercit.   ab illo inventore veritatis et       │
│                                            quasi architecto beatae vitae.       │
│         Duis aute irure dolor in           Nemo enim ipsam voluptatem quia      │
│      reprehenderit in voluptate velit      voluptas sit aspernatur aut odit     │
│      esse cillum dolore eu fugiat nulla    aut fugit, sed quia consequuntur     │
│      pariatur. Excepteur sint occaecat     magni dolores eos qui ratione        │
│      cupidatat non proident, culpa qui     voluptatem sequi nesciunt.           │
│      officia deserunt mollit anim.                                              │
│                                            Neque porro quisquam est, qui       │
│         At vero eos et accusamus et         dolorem ipsum quia dolor sit amet,  │
│      iusto odio dignissimos ducimus qui    consectetur, adipisci velit, sed     │
│      blanditiis praesentium deleniti.      quia non numquam eius modi tempora   │
│                                            incidunt ut labore et dolore magnam  │
│                                            aliquam quaerat voluptatem.          │
│                                                                       [avatar]  │
│                                                                                 │
│  <                       {Chapter Title} · 42%                               > │
└─────────────────────────────────────────────────────────────────────────────────┘
```

> Toolbar is hidden by default. It appears on mouse hover or click anywhere. `<` `>` chevrons near edges appear on hover only. Page bottom shows chapter title and progress percentage. Two-column layout mirrors macOS Books.

---

### Reader Window — Toolbar Visible (on hover/click)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ ● ● ●  [≡ TOC] [⬜ Theme] [⬚ Annot]    {Book Title}    [AA] [🔍] [🌐] [🔖]   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│         Lorem ipsum dolor sit amet,        Sed ut perspiciatis unde omnis       │
│      consectetur adipiscing elit. Sed do   iste natus error sit voluptatem      │
│      eiusmod tempor incididunt ut labore   accusantium doloremque laudantium,   │
│      et dolore magna aliqua. Ut enim ad    totam rem aperiam eaque ipsa quae    │
│      minim veniam, quis nostrud exercit.   ab illo inventore veritatis et       │
│                                            quasi architecto beatae vitae.       │
│         Duis aute irure dolor in           Nemo enim ipsam voluptatem quia      │
│      reprehenderit in voluptate velit      voluptas sit aspernatur aut odit     │
│      esse cillum dolore eu fugiat nulla    aut fugit, sed quia consequuntur     │
│      pariatur. Excepteur sint occaecat     magni dolores eos qui ratione        │
│      cupidatat non proident, culpa qui     voluptatem sequi nesciunt.           │
│      officia deserunt mollit anim.                                              │
│                                            Neque porro quisquam est, qui       │
│         At vero eos et accusamus et         dolorem ipsum quia dolor sit amet,  │
│      iusto odio dignissimos ducimus qui    consectetur, adipisci velit, sed     │
│      blanditiis praesentium deleniti.      quia non numquam eius modi tempora   │
│                                            incidunt ut labore et dolore magnam  │
│                                            aliquam quaerat voluptatem.          │
│                                                                       [avatar]  │
│                                                                                 │
│  <                       {Chapter Title} · 42%                               > │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Toolbar button legend:**
```
Left cluster:                           Right cluster:
  [≡]   Table of Contents (TOC drawer)    [AA]  Font size / theme settings popover
  [⬜]   Theme toggle (Light/Sepia/Dark)   [🔍]  Search in book
  [⬚]   Annotations panel (right drawer)  [🌐]  Translate book (bilingual toggle)
                                          [🔖]  Annotations panel shortcut
```

---

### Reader Window — Text Selection Popup Bar

```
                  ┌───────────────────────────────────────────────────────┐
                  │  [●Y] [●G] [●B] [●P] [●V]  │  [✎ Note]  │  [🌐]  │  [🖼]  │
                  └───────────────────────────────────────────────────────┘
                                    ▲
                          (selected text below)
```

---

### Reader Window — Note Editor Panel

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ ● ● ●  [≡ TOC] [⬜ Theme] [⬚ Annot]    {Book Title}    [AA] [🔍] [🌐] [🔖]   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│         Lorem ipsum dolor sit amet...                                           │
│                                                                                 │
│                  ┌─────────────────────────────────────────────┐               │
│                  │  "exercitation ullamco laboris nisi ut       │               │
│                  │   aliquip ex ea commodo consequat…"          │               │
│                  │  ─────────────────────────────────────────  │               │
│                  │  Note                                        │               │
│                  │  [INPUT textarea: Write a note…           ] │               │
│                  │  [INPUT textarea:                          ] │               │
│                  │                                              │               │
│                  │  [LINK: Delete Note]         [Cancel] [Save] │               │
│                  └─────────────────────────────────────────────┘               │
│                                                                                 │
│  <                       {Chapter Title} · 42%                               > │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

### Reader Window — Note Editor, Validation Error

```
│  [INPUT textarea:                          ] │
│  ⚠ Note cannot be empty.                    │
│                                              │
│  [LINK: Delete Note]         [Cancel] [Save] │
└─────────────────────────────────────────────┘
```

---

### Reader Window — TOC Drawer (slides in from left)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ ● ● ●  [≡ TOC] [⬜ Theme] [⬚ Annot]    {Book Title}    [AA] [🔍] [🌐] [🔖]   │
├──────────────────────┬──────────────────────────────────────────────────────────┤
│  Table of Contents   │                                                          │
│  ─────────────────   │   Lorem ipsum dolor sit amet, consectetur adipiscing.   │
│  ▶ Chapter 1         │   Sed do eiusmod tempor incididunt ut labore et dolore.  │
│    Chapter 2         │                                                          │
│    Chapter 3         │   Ut enim ad minim veniam, quis nostrud exercitation     │
│    ├ Part I          │   ullamco laboris nisi ut aliquip ex ea commodo.         │
│    └ Part II         │                                                          │
│    Chapter 4         │                                                          │
│    Chapter 5         │                         (backdrop dims rest of reader)  │
│    Chapter 6         │                                                          │
│                      │                                                          │
│  <                       {Chapter Title} · 42%                               > │
└──────────────────────┴──────────────────────────────────────────────────────────┘
```

---

### Reader Window — Annotations Drawer (slides in from right)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ ● ● ●  [≡ TOC] [⬜ Theme] [⬚ Annot]    {Book Title}    [AA] [🔍] [🌐] [🔖]   │
├───────────────────────────────────────────┬─────────────────────────────────────┤
│                                           │  Annotations                    [✕] │
│   Lorem ipsum dolor sit amet...           │  [Highlights ●] [Notes]             │
│                                           │  ─────────────────────────────────  │
│                                           │  ● "Lorem ipsum dolor sit           │
│                                           │    amet, consectetur…"              │
│                                           │    Chapter 1 · 12%           [🗑]   │
│                                           │  ─────────────────────────────────  │
│                                           │  ● "Sed ut perspiciatis             │
│                                           │    unde omnis iste natus…"          │
│                                           │    Chapter 3 · 38%           [🗑]   │
│                                           │  ─────────────────────────────────  │
│                                           │  ● "At vero eos et accusamus"       │
│                                           │    Chapter 5 · 71%           [🗑]   │
│                                           │                                     │
│  <                       {Chapter Title} · 42%                               > │
└───────────────────────────────────────────┴─────────────────────────────────────┘
```

---

### Reader Window — Display Settings Popover (AA button)

```
                                        ┌────────────────────────────────────┐
                                        │  Font Size                         │
                                        │  [A−]  ·  18px  ·  [A+]           │
                                        │                                    │
                                        │  Font                              │
                                        │  [DROPDOWN: Georgia            ▾]  │
                                        │                                    │
                                        │  Line Height                       │
                                        │  [DROPDOWN: Normal (1.6)       ▾]  │
                                        │                                    │
                                        │  Theme                             │
                                        │  [◻ Light] [🟤 Sepia] [◼ Dark]   │
                                        └────────────────────────────────────┘
```

---

### Reader Window — Bilingual Mode Active

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ ● ● ●  [≡ TOC] [⬜ Theme] [⬚ Annot]    {Book Title}    [AA] [🔍] [🌐●] [🔖]  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│         Lorem ipsum dolor sit amet,        Sed ut perspiciatis unde omnis       │
│      consectetur adipiscing elit.          iste natus error sit voluptatem.     │
│                                                                                 │
│         这是原文的中文翻译，逐段显示         这是第二列原文的中文翻译，             │
│      在原文下方，使用较小字号和灰色。       同样显示在对应原文段落下方。           │
│                                                                                 │
│         Duis aute irure dolor in           Nemo enim ipsam voluptatem quia      │
│      reprehenderit in voluptate.           voluptas sit aspernatur aut odit.    │
│                                                                                 │
│         这段也有对应翻译，随着翻译           这段翻译正在生成中…                  │
│      进度逐步出现。                                                              │
│                                                                       [avatar]  │
│                                                                                 │
│  <                       {Chapter Title} · 42%                               > │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

### Reader Window — Translation In Progress Banner

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ ● ● ●  [≡ TOC] [⬜ Theme] [⬚ Annot]    {Book Title}    [AA] [🔍] [🌐●] [🔖]  │
├─────────────────────────────────────────────────────────────────────────────────┤
│  🌐 Translating · Chapter 3 of 18          [BUTTON: Pause]  [BUTTON: Cancel]   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│         Lorem ipsum... (original text)     Sed ut perspiciatis...               │
│                                                                                 │
│         (translation pending)              这段翻译已完成，显示在此。            │
│                                                                                 │
│  <                       {Chapter Title} · 42%                               > │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

### Reader Window — Translation Language Sheet (modal)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        (reader content blurred behind)                          │
│                                                                                 │
│               ┌────────────────────────────────────────────────┐               │
│               │  Translate Book                                 │               │
│               │                                                 │               │
│               │  Translate to:                                  │               │
│               │  [DROPDOWN: Select language                 ▾]  │               │
│               │                                                 │               │
│               │  Original text remains visible alongside the   │               │
│               │  translation. This may use API credits.        │               │
│               │                                                 │               │
│               │              [Cancel]  [Start Translation]      │               │
│               └────────────────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

### Quote Cover Creator Modal

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Create Quote Cover                               [✕]   │
├───────────────────────────────────────┬─────────────────────────────────────────┤
│                                       │                                         │
│  ┌─────────────────────────────────┐  │  Theme                                  │
│  │                                 │  │  [◻ Warm] [◼ Mid] [🔵 Ocean] [🌿 Forest]│
│  │                                 │  │                                         │
│  │   " {selected_quote_text}  "    │  │  Quote Text                             │
│  │                                 │  │  [INPUT textarea:                     ] │
│  │     {book_title}                │  │  [INPUT textarea:                     ] │
│  │     {author_name}               │  │                                         │
│  │                                 │  │                                         │
│  │  [cover]       Made with Folio  │  │                                         │
│  └─────────────────────────────────┘  │                                         │
│  (400×400 preview)                    │  [Cancel]    [BUTTON: Save Image ─────]  │
└───────────────────────────────────────┴─────────────────────────────────────────┘
```

---

### Quote Cover Creator — Long Text Warning

```
│  [INPUT textarea: {long_quote_text…}               ]  │
│  ⚠ Long quotes may not display well. Consider shortening. │
```

---

### Settings Window — General Tab

```
┌──────────────────────────────────────────────────────────────┐
│  Settings                                                    │
├──────────────────────────────────────────────────────────────┤
│  [General ●]  [Translation]                                  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   Default Theme                                             │
│   [DROPDOWN: Light                                      ▾]  │
│                                                              │
│   Default Font                                              │
│   [DROPDOWN: Georgia                                    ▾]  │
│                                                              │
│   Default Font Size                                         │
│   [A−]  ·  18px  ·  [A+]                                   │
│                                                              │
│                                         [BUTTON: Save]      │
└──────────────────────────────────────────────────────────────┘
```

---

### Settings Window — Translation Tab

```
┌──────────────────────────────────────────────────────────────┐
│  Settings                                                    │
├──────────────────────────────────────────────────────────────┤
│  [General]  [Translation ●]                                  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   API Key Status                                            │
│   Saved                                                     │
│                                                              │
│   OpenRouter API Key                                        │
│   [INPUT: ••••••••••••••••••••••••  ] [TOGGLE: Show]        │
│                                                              │
│   Model                                                     │
│   [INPUT: google/gemini-2.5-flash-lite-preview         ]   │
│                                                              │
│   [BUTTON: Test Connection]                                 │
│   ✓ Connection successful                                   │
│                                                              │
│   [LINK: Clear Saved Key]               [BUTTON: Save]      │
└──────────────────────────────────────────────────────────────┘
```

---

### Settings Window — Translation Tab (No Key Saved)

```
│   API Key Status                                            │
│   Not saved                                                 │
│                                                              │
│   OpenRouter API Key                                        │
│   [INPUT: ••••••••••••••  ] [TOGGLE: Show]                  │
│                                                              │
│   Model                                                     │
│   [INPUT: google/gemini-2.5-flash-lite-preview         ]   │
```

---

### Settings Window — Validation / Connection Errors

```
│   [INPUT:                              ] [TOGGLE: Show]     │
│   ⚠ API key is required for translation.                   │

│   [BUTTON: Test Connection]                                 │
│   ✗ Error: 401 Unauthorized. Check your API key.           │
```

---

## 6. Data & State Requirements

### 6.1 Persisted Data (SQLite at `~/Library/Application Support/Folio/folio.db`)

**`books` table**
| Column | Type | Notes |
|---|---|---|
| id | TEXT (UUID) | Primary key |
| title | TEXT | Extracted from ePub metadata |
| author | TEXT | Extracted from ePub metadata |
| file_path | TEXT | Absolute path to Folio's managed copy within App Support/Books/ |
| cover_image_path | TEXT | Extracted cover saved as PNG |
| added_at | INTEGER | Unix timestamp |
| last_read_at | INTEGER | Unix timestamp, null if never opened |
| last_position_cfi | TEXT | epub.js CFI string, null if never opened |
| file_hash | TEXT | SHA-256 of source file for deduplication |

**`highlights` table**
| Column | Type | Notes |
|---|---|---|
| id | TEXT (UUID) | Primary key |
| book_id | TEXT | FK → books.id |
| cfi_range | TEXT | epub.js CFI range string |
| color | TEXT | Hex color code |
| text_excerpt | TEXT | Plain text of highlighted content |
| created_at | INTEGER | Unix timestamp |

**`notes` table**
| Column | Type | Notes |
|---|---|---|
| id | TEXT (UUID) | Primary key |
| book_id | TEXT | FK → books.id |
| highlight_id | TEXT | FK → highlights.id, nullable |
| cfi | TEXT | Anchor CFI |
| text_excerpt | TEXT | Selected text at time of note creation |
| body | TEXT | User-written note content |
| created_at | INTEGER | Unix timestamp |
| updated_at | INTEGER | Unix timestamp |

**`translations` table**
| Column | Type | Notes |
|---|---|---|
| id | TEXT (UUID) | Primary key |
| book_id | TEXT | FK → books.id |
| spine_item_href | TEXT | Relative href of the chapter/xhtml file inside the ePub spine |
| paragraph_index | INTEGER | Zero-based paragraph ordinal within that spine item |
| paragraph_hash | TEXT | SHA-256 of original paragraph HTML, used for validation/retry |
| original_html | TEXT | Original paragraph HTML fragment |
| translated_html | TEXT | Sanitized OpenRouter-translated HTML fragment |
| target_language | TEXT | e.g. "Chinese (Simplified)" |
| created_at | INTEGER | Unix timestamp |

**`translation_jobs` table**
| Column | Type | Notes |
|---|---|---|
| id | TEXT (UUID) | Primary key |
| book_id | TEXT | FK → books.id |
| target_language | TEXT | |
| status | TEXT | "in_progress" \| "paused" \| "complete" \| "cancelled" \| "failed" |
| total_paragraphs | INTEGER | |
| completed_paragraphs | INTEGER | |
| failed_paragraph_locators | TEXT | JSON array of `{spine_item_href, paragraph_index}` |
| pause_reason | TEXT | null \| "manual" \| "rate_limit" \| "network" \| "app_restart" |
| created_at | INTEGER | Unix timestamp |
| updated_at | INTEGER | Unix timestamp |

**`reading_settings` table**
| Column | Type | Notes |
|---|---|---|
| book_id | TEXT | PK, FK → books.id |
| font_size | INTEGER | px, default 18 |
| font_family | TEXT | default "Georgia" |
| line_height | REAL | default 1.6 |
| theme | TEXT | "light" \| "sepia" \| "dark", default "light" |

**`app_settings` table**
| Column | Type | Notes |
|---|---|---|
| key | TEXT | PK |
| value | TEXT | JSON-serialized value |

Keys stored: `llm_model`, `window_state_library`, `window_state_settings`, `window_state_{book_id}`

**macOS Keychain**
- Service name: `com.folio.app`
- Account: `llm_api_key`
- API key stored and retrieved by the Rust backend via macOS Keychain

### 6.2 Temporary / In-Memory State

| State | Where | Notes |
|---|---|---|
| Current selection CFI range | Reader webview JS | Cleared on click-away |
| Popup bar visibility | Reader webview JS | Cleared on dismiss |
| Translation job live progress | Tauri event channel | Emitted from Rust backend to webview |
| Open reader windows registry | Tauri app state (Rust) | Map of book_id → WindowLabel |
| Quote cover canvas render | Browser Canvas API | Discarded after PNG export |

### 6.3 Data Flow Between Pages

- Library → Reader: `book_id` passed as URL query param `?bookId={id}`; Reader fetches all book data from SQLite on mount
- Reader → Library: no direct flow; Library re-reads SQLite on window focus to reflect updated `last_read_at`
- Reader → Settings: none; Settings written independently, read by Reader on translation trigger
- All translation results written to SQLite by Rust backend; Reader subscribes via Tauri events (no polling interval)

---

## 7. Error States & Edge Cases

### 7.1 Empty States

| Screen | Condition | UI |
|---|---|---|
| Library grid | No books imported | Centered illustration (book icon) + "Your library is empty." + "Import Book" button + "or drag .epub files here" label |
| Recently Read section | No books opened in 30 days | "No recently read books." in grid area |
| Annotations drawer — Highlights tab | No highlights | "No highlights yet. Select text to start highlighting." |
| Annotations drawer — Notes tab | No notes | "No notes yet. Select text and tap ✏ to add a note." |
| TOC drawer | ePub has no TOC | "This book has no table of contents." |

### 7.2 Loading States

| Trigger | UI |
|---|---|
| Opening book (epub.js loading) | Full-screen spinner centered in reader window; spinner dismissed when first page renders |
| Importing large epub (>20 MB) | Indeterminate spinner in Library toolbar; book card appears with shimmer placeholder until processing completes |
| Testing API connection | "Test Connection" button shows spinner and is disabled; result appears inline after response |
| Exporting bilingual epub | Progress dialog: "Generating bilingual ePub… {X}%" with cancel button |
| Rendering quote cover (Save Image) | "Save Image" button shows spinner; macOS Save dialog opens after render (<2s) |

### 7.3 Error States

| Scenario | UI |
|---|---|
| Managed library file missing or corrupted | Book card shows gray overlay + ⚠ icon; double-click shows alert: "This book's managed library file is missing or corrupted. Re-import the book to read it again." |
| Invalid ePub on import | Alert dialog: "'{filename}' could not be imported. The file may be corrupted or is not a valid ePub." |
| DRM-protected ePub | Alert on open: "This book is DRM-protected and cannot be opened in Folio." |
| LLM API error (single paragraph) | Paragraph skipped; warning banner with "Retry Failed" link |
| LLM API auth error | Translation stops; alert: "Translation failed: Invalid API key. Please check your API key in Settings." |
| LLM API rate limit | Translation auto-pauses; banner: "Translation paused (rate limit reached). Will retry in {N}s." with countdown; auto-resumes |
| Network offline during translation | Translation auto-pauses; banner: "Translation paused (no internet connection)." Auto-resumes on reconnect |
| Canvas render failure (quote cover) | Alert: "Could not generate image. Please try again." |
| Saved CFI is invalid | Opens book at beginning; banner: "Your reading position could not be restored." |
| SQLite write failure | Alert: "An error occurred saving your data. Your changes may not be saved. ({error_code})" |

---

## 8. Non-Functional Requirements

### 8.1 Performance
- Library window initial load (up to 500 books): < 1.5 seconds from app launch to grid visible
- Reader window open (epub.js parse + render first page): < 2 seconds for epub files ≤ 50 MB
- Page navigation (next/previous page): < 100 ms
- Text selection popup appearance after mouse release: < 50 ms
- Library search filter response: < 150 ms (client-side, SQLite query)
- Translation API calls: timeout after 30 seconds per paragraph; auto-retry once before marking as failed
- Quote cover PNG generation (1080×1080): < 2 seconds

### 8.2 Security
- API key stored in macOS Keychain only; never written to SQLite, log files, or environment variables
- LLM API calls made from Rust backend (not renderer webview) to avoid exposing API key in devtools
- No user data leaves the device except OpenRouter translation API calls (paragraph text sent to the configured OpenRouter model)
- OpenRouter-translated HTML is sanitized against a strict inline-tag allowlist before it is inserted into the reader DOM or exported
- No telemetry, analytics, or crash reporting collected
- ePub files stored in App Support directory with standard macOS file permissions (owner read/write only)
- Content Security Policy set on all webview windows to disallow inline scripts and external resource loads

### 8.3 Responsive Design
- **Primary target:** macOS desktop, window width 800px–2560px
- Breakpoints:
  - ≥ 1000px: full sidebar + 4+ column grid
  - 700–999px: sidebar collapsible (hidden by default, toggled via ☰), 3-column grid
  - < 700px: sidebar hidden, 2-column grid, toolbar icons only (no labels)
- Reader minimum window: 600×500px; at < 800px width, horizontal margins reduce to 40px
- macOS native window controls (traffic lights) preserved; no custom titlebar
- macOS system dark mode automatically mapped to reader Dark theme; user can override per-book

---

## 9. Explicit Out of Scope

The following features will **not** be built:
- Cloud sync (iCloud, Dropbox, any third-party)
- User accounts, login, or authentication
- DRM support (FairPlay, Adobe DRM, etc.)
- Audiobook playback
- PDF reading
- MOBI, AZW, or any format other than ePub
- "Want to Read" lists or reading wishlist
- Social sharing (sharing to Twitter, etc. directly from the app — user manually shares the saved image)
- Book store integration or purchase flow
- In-app dictionary or Wikipedia lookup
- Search within book text (full-text search of ePub content)
- Reading statistics or time tracking
- Reading goals or streaks
- Collections/custom bookshelves
- iOS/iPadOS version
- Windows or Linux version
- Printing
- Text-to-speech
- Side-by-side two-page layout (spread view)
- Embedded font management beyond the 4 specified families
- Custom CSS injection by users
- Plugin or extension system
- Export of annotations to Markdown/CSV/Notion
- Book metadata editing (title, author, cover)

---

## 10. Open Assumptions

| # | Decision Made | Rationale |
|---|---|---|
| A1 | Each book's ePub file is **copied** into App Support on import (not linked) | Prevents broken references if user moves or deletes the source file |
| A2 | Bilingual mode shows translated paragraph **immediately below** each original paragraph (not side by side) | Side-by-side requires horizontal layout that breaks most ePub formatting |
| A3 | Translation uses **paragraph-level granularity** (not sentence-level, not chapter-level) | Balances API cost, context quality, and progressive display |
| A4 | The "Translate" button in the selection popup bar is **not implemented in MVP** (only full-book translation exists); the button is present but shows a tooltip: "Select 'Translate Book' from the toolbar to translate the whole book" | The PRD describes full-book translation; single-paragraph inline translation is V2 |
| A5 | LLM translation prompt does **not** include surrounding context from neighboring paragraphs | Simplifies implementation; paragraph context is usually sufficient |
| A6 | Quote cover dimensions are fixed at **1080×1080px** (square, Instagram-standard) | Most common share format; non-square is V2 |
| A7 | The app has **no macOS menu bar items beyond standard** (Folio > About, Folio > Settings, Folio > Quit; standard Edit/View/Window/Help menus populated by Tauri defaults) | Keeps scope minimal |
| A8 | "Export Bilingual ePub" generates the ePub **in-process** (Rust backend assembles epub zip) rather than calling an external tool | Avoids runtime dependency on external binaries |
| A9 | Reading position is saved as a **CFI string**, not a page number; the progress bar shows percentage which is derived from CFI offset | ePub pagination is viewport-dependent; CFI is the only stable position anchor |
| A10 | The reader uses **paginated layout** (not scrolling), matching macOS Books app behavior | Specified by user; scroll mode is V2 |
| A11 | Font families offered are: Georgia, San Francisco (system `-apple-system`), Palatino, Menlo — **these 4 only** in MVP | Broad enough variety without requiring font bundling |
| A12 | The "Folio watermark" on quote covers is **not removable** in MVP | Attribution / brand awareness |
| A13 | Translation language list is **fixed** at the 10 languages listed in Feature 10 | Sufficient coverage for MVP; extensible list is V2 |
| A14 | The app **does not support** the macOS Books app's existing library or iCloud Books — it is a completely separate library | No API exists to access the system Books library |
| A15 | Window position memory is stored in `app_settings` as `window_state_library`, `window_state_settings`, and `window_state_{book_id}` JSON values | Covers all Folio windows with one persistence mechanism |
| A16 | OpenRouter is the **only** translation provider in MVP | Keeps the implementation and settings surface aligned with the actual backend integration |

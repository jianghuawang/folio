pub const BOOKS_SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT 'Unknown Author',
  file_path TEXT NOT NULL,
  cover_image_path TEXT,
  added_at INTEGER NOT NULL,
  last_read_at INTEGER,
  last_position_cfi TEXT,
  file_hash TEXT NOT NULL,
  reading_progress REAL NOT NULL DEFAULT 0.0 CHECK (reading_progress BETWEEN 0.0 AND 1.0)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_books_file_hash ON books(file_hash);
CREATE INDEX IF NOT EXISTS idx_books_last_read_at ON books(last_read_at);
"#;

pub const HIGHLIGHTS_SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS highlights (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  cfi_range TEXT NOT NULL,
  color TEXT NOT NULL CHECK (color IN ('#FFD60A', '#30D158', '#0A84FF', '#FF375F', '#BF5AF2')),
  text_excerpt TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_highlights_book_id ON highlights(book_id);
"#;

pub const NOTES_SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  highlight_id TEXT,
  cfi TEXT NOT NULL,
  text_excerpt TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  FOREIGN KEY (highlight_id) REFERENCES highlights(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_notes_book_id ON notes(book_id);
"#;

pub const TRANSLATIONS_SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS translations (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  spine_item_href TEXT NOT NULL,
  paragraph_index INTEGER NOT NULL,
  paragraph_hash TEXT NOT NULL,
  original_html TEXT NOT NULL,
  translated_html TEXT NOT NULL,
  target_language TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(book_id, target_language, spine_item_href, paragraph_index),
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_translations_book_lang ON translations(book_id, target_language);
CREATE INDEX IF NOT EXISTS idx_translations_book_lang_spine ON translations(book_id, target_language, spine_item_href);
"#;

pub const TRANSLATION_JOBS_SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS translation_jobs (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  target_language TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('in_progress', 'paused', 'complete', 'cancelled', 'failed')),
  total_paragraphs INTEGER NOT NULL DEFAULT 0,
  completed_paragraphs INTEGER NOT NULL DEFAULT 0,
  failed_paragraph_locators TEXT NOT NULL DEFAULT '[]',
  pause_reason TEXT CHECK (pause_reason IN ('manual', 'rate_limit', 'network', 'app_restart')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(book_id, target_language),
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);
"#;

pub const READING_SETTINGS_SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS reading_settings (
  book_id TEXT PRIMARY KEY,
  font_size INTEGER NOT NULL DEFAULT 18 CHECK (font_size BETWEEN 12 AND 32),
  font_family TEXT NOT NULL DEFAULT 'Georgia' CHECK (font_family IN ('Georgia', 'system-ui', 'Palatino', 'Menlo')),
  line_height REAL NOT NULL DEFAULT 1.6 CHECK (line_height IN (1.4, 1.6, 1.9)),
  theme TEXT NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'sepia', 'dark')),
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);
"#;

pub const APP_SETTINGS_SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
"#;

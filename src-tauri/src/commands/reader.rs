use std::{
    fs::File,
    time::{SystemTime, UNIX_EPOCH},
};

use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Runtime, State, WebviewUrl, WebviewWindowBuilder};
use zip::ZipArchive;

use crate::{db::AppState, restore_window_state, window_state_key_for_reader};

const DEFAULT_FONT_SIZE: i64 = 18;
const DEFAULT_LINE_HEIGHT: f64 = 1.6;
const DEFAULT_FONT_FAMILY: &str = "Georgia";
const DEFAULT_THEME: &str = "light";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReadingSettings {
    pub font_size: i64,
    pub font_family: String,
    pub line_height: f64,
    pub theme: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct PartialReadingSettings {
    pub font_size: Option<i64>,
    pub font_family: Option<String>,
    pub line_height: Option<f64>,
    pub theme: Option<String>,
}

// Must be async: on Windows, building a webview window inside a sync command
// deadlocks the main thread (wry#583).
#[tauri::command]
pub async fn open_reader_window<R: Runtime>(
    app: AppHandle<R>,
    book_id: String,
) -> Result<(), String> {
    eprintln!("[reader] open_reader_window requested for book_id={book_id}");

    let blocking_app = app.clone();
    let blocking_book_id = book_id.clone();
    let book_title = tauri::async_runtime::spawn_blocking(move || {
        let state = blocking_app.state::<AppState>();
        let (book_title, managed_file_path) = {
            let connection = state
                .db
                .lock()
                .map_err(|_| "SQLITE_LOCK_ERROR".to_string())?;

            connection
                .query_row(
                    "SELECT title, file_path FROM books WHERE id = ?1",
                    params![&blocking_book_id],
                    |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
                )
                .optional()
                .map_err(|error| error.to_string())?
                .ok_or_else(|| "BOOK_NOT_FOUND".to_string())?
        };

        validate_managed_epub(&managed_file_path)?;

        let connection = state
            .db
            .lock()
            .map_err(|_| "SQLITE_LOCK_ERROR".to_string())?;
        connection
            .execute(
                "UPDATE books SET last_read_at = ?2 WHERE id = ?1",
                params![&blocking_book_id, now_unix_timestamp()],
            )
            .map_err(|error| error.to_string())?;

        Ok::<_, String>(book_title)
    })
    .await
    .map_err(|_| "MANAGED_FILE_INVALID".to_string())??;

    let window_label = format!("reader-{book_id}");

    if let Some(window) = app.get_webview_window(&window_label) {
        eprintln!("[reader] focusing existing window label={window_label}");
        window.unminimize().map_err(|error| error.to_string())?;
        window.show().map_err(|error| error.to_string())?;
        window.set_focus().map_err(|error| error.to_string())?;
        return Ok(());
    }

    eprintln!("[reader] building new window label={window_label}");
    let builder = WebviewWindowBuilder::new(
        &app,
        window_label.clone(),
        WebviewUrl::App(format!("/reader?bookId={book_id}").into()),
    )
    .title(format!("{book_title} — Folio"))
    .inner_size(900.0, 700.0)
    .min_inner_size(600.0, 500.0)
    .center()
    .visible(false);

    #[cfg(target_os = "macos")]
    let builder = builder
        .title_bar_style(tauri::TitleBarStyle::Overlay)
        .hidden_title(true);

    let window = builder.build().map_err(|error| {
        eprintln!("[reader] build() failed: {error}");
        error.to_string()
    })?;

    let window_state_key = window_state_key_for_reader(&book_id);
    let state = app.state::<AppState>();
    if let Err(error) = restore_window_state(&window, state.inner(), &window_state_key) {
        eprintln!("[reader] restore_window_state failed: {error}");
        return Err(error);
    }
    window.show().map_err(|error| {
        eprintln!("[reader] show() failed: {error}");
        error.to_string()
    })?;
    window.set_focus().map_err(|error| {
        eprintln!("[reader] set_focus() failed: {error}");
        error.to_string()
    })?;

    eprintln!("[reader] open_reader_window completed label={window_label}");
    Ok(())
}

fn validate_managed_epub(file_path: &str) -> Result<(), String> {
    let file = File::open(file_path).map_err(|_| "MANAGED_FILE_INVALID".to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|_| "MANAGED_FILE_INVALID".to_string())?;
    archive
        .by_name("META-INF/container.xml")
        .map_err(|_| "MANAGED_FILE_INVALID".to_string())?;
    Ok(())
}

#[tauri::command]
pub fn save_reading_position(
    state: State<'_, AppState>,
    book_id: String,
    cfi: String,
    progress: f64,
) -> Result<(), String> {
    let normalized_progress = progress.clamp(0.0, 1.0);
    let connection = state
        .db
        .lock()
        .map_err(|_| "SQLITE_LOCK_ERROR".to_string())?;

    let updated_rows = connection
        .execute(
            "UPDATE books
             SET last_position_cfi = ?2,
                 reading_progress = ?3
             WHERE id = ?1",
            params![book_id, cfi, normalized_progress],
        )
        .map_err(|error| error.to_string())?;

    if updated_rows == 0 {
        return Err("BOOK_NOT_FOUND".to_string());
    }

    Ok(())
}

#[tauri::command]
pub fn get_reading_settings(
    state: State<'_, AppState>,
    book_id: String,
) -> Result<ReadingSettings, String> {
    let connection = state
        .db
        .lock()
        .map_err(|_| "SQLITE_LOCK_ERROR".to_string())?;

    ensure_book_exists(&connection, &book_id)?;
    get_existing_reading_settings(&connection, &book_id)
        .map(|settings| settings.unwrap_or_default())
}

#[tauri::command]
pub fn update_reading_settings(
    state: State<'_, AppState>,
    book_id: String,
    settings: PartialReadingSettings,
) -> Result<ReadingSettings, String> {
    let connection = state
        .db
        .lock()
        .map_err(|_| "SQLITE_LOCK_ERROR".to_string())?;

    ensure_book_exists(&connection, &book_id)?;

    let mut resolved_settings =
        get_existing_reading_settings(&connection, &book_id)?.unwrap_or_default();

    if let Some(font_size) = settings.font_size {
        if !(12..=32).contains(&font_size) {
            return Err("INVALID_READING_SETTINGS".to_string());
        }

        resolved_settings.font_size = font_size;
    }

    if let Some(font_family) = settings.font_family {
        if !matches!(
            font_family.as_str(),
            "Georgia" | "system-ui" | "Palatino" | "Menlo"
        ) {
            return Err("INVALID_READING_SETTINGS".to_string());
        }

        resolved_settings.font_family = font_family;
    }

    if let Some(line_height) = settings.line_height {
        if !matches!(line_height, 1.4 | 1.6 | 1.9) {
            return Err("INVALID_READING_SETTINGS".to_string());
        }

        resolved_settings.line_height = line_height;
    }

    if let Some(theme) = settings.theme {
        if !matches!(theme.as_str(), "light" | "sepia" | "dark") {
            return Err("INVALID_READING_SETTINGS".to_string());
        }

        resolved_settings.theme = theme;
    }

    connection
        .execute(
            "INSERT INTO reading_settings (book_id, font_size, font_family, line_height, theme)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(book_id) DO UPDATE SET
               font_size = excluded.font_size,
               font_family = excluded.font_family,
               line_height = excluded.line_height,
               theme = excluded.theme",
            params![
                book_id,
                resolved_settings.font_size,
                resolved_settings.font_family,
                resolved_settings.line_height,
                resolved_settings.theme
            ],
        )
        .map_err(|error| error.to_string())?;

    Ok(resolved_settings)
}

fn ensure_book_exists(connection: &rusqlite::Connection, book_id: &str) -> Result<(), String> {
    let exists = connection
        .query_row(
            "SELECT 1 FROM books WHERE id = ?1",
            params![book_id],
            |row| row.get::<_, i64>(0),
        )
        .optional()
        .map_err(|error| error.to_string())?;

    if exists.is_none() {
        return Err("BOOK_NOT_FOUND".to_string());
    }

    Ok(())
}

fn get_existing_reading_settings(
    connection: &rusqlite::Connection,
    book_id: &str,
) -> Result<Option<ReadingSettings>, String> {
    connection
        .query_row(
            "SELECT font_size, font_family, line_height, theme
             FROM reading_settings
             WHERE book_id = ?1",
            params![book_id],
            |row| {
                Ok(ReadingSettings {
                    font_size: row.get("font_size")?,
                    font_family: row.get("font_family")?,
                    line_height: row.get("line_height")?,
                    theme: row.get("theme")?,
                })
            },
        )
        .optional()
        .map_err(|error| error.to_string())
}

impl Default for ReadingSettings {
    fn default() -> Self {
        Self {
            font_size: DEFAULT_FONT_SIZE,
            font_family: DEFAULT_FONT_FAMILY.to_string(),
            line_height: DEFAULT_LINE_HEIGHT,
            theme: DEFAULT_THEME.to_string(),
        }
    }
}

fn now_unix_timestamp() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or_default()
}

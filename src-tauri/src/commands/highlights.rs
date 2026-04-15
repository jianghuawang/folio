use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{params, OptionalExtension, Row};
use serde::Serialize;
use tauri::State;
use uuid::Uuid;

use crate::db::AppState;

const ALLOWED_HIGHLIGHT_COLORS: [&str; 5] = ["#FFD60A", "#30D158", "#0A84FF", "#FF375F", "#BF5AF2"];

#[derive(Debug, Clone, Serialize)]
pub struct Highlight {
    pub id: String,
    pub book_id: String,
    pub cfi_range: String,
    pub color: String,
    pub text_excerpt: String,
    pub created_at: i64,
}

#[tauri::command]
pub fn get_highlights(
    state: State<'_, AppState>,
    book_id: String,
) -> Result<Vec<Highlight>, String> {
    let connection = state
        .db
        .lock()
        .map_err(|_| "SQLITE_LOCK_ERROR".to_string())?;

    ensure_book_exists(&connection, &book_id)?;

    let mut statement = connection
        .prepare(
            "SELECT id, book_id, cfi_range, color, text_excerpt, created_at
             FROM highlights
             WHERE book_id = ?1
             ORDER BY created_at ASC",
        )
        .map_err(|error| error.to_string())?;

    let highlights = statement
        .query_map(params![book_id], highlight_from_row)
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    Ok(highlights)
}

#[tauri::command]
pub fn add_highlight(
    state: State<'_, AppState>,
    book_id: String,
    cfi_range: String,
    color: String,
    text_excerpt: String,
) -> Result<Highlight, String> {
    validate_color(&color)?;

    let connection = state
        .db
        .lock()
        .map_err(|_| "SQLITE_LOCK_ERROR".to_string())?;

    ensure_book_exists(&connection, &book_id)?;

    let highlight = Highlight {
        id: generate_uuid_v4(),
        book_id,
        cfi_range,
        color,
        text_excerpt,
        created_at: now_unix_timestamp(),
    };

    connection
        .execute(
            "INSERT INTO highlights (id, book_id, cfi_range, color, text_excerpt, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                highlight.id,
                highlight.book_id,
                highlight.cfi_range,
                highlight.color,
                highlight.text_excerpt,
                highlight.created_at
            ],
        )
        .map_err(|error| error.to_string())?;

    Ok(highlight)
}

#[tauri::command]
pub fn update_highlight(
    state: State<'_, AppState>,
    id: String,
    color: String,
) -> Result<Highlight, String> {
    validate_color(&color)?;

    let connection = state
        .db
        .lock()
        .map_err(|_| "SQLITE_LOCK_ERROR".to_string())?;

    let updated_rows = connection
        .execute(
            "UPDATE highlights
             SET color = ?2
             WHERE id = ?1",
            params![&id, &color],
        )
        .map_err(|error| error.to_string())?;

    if updated_rows == 0 {
        return Err("HIGHLIGHT_NOT_FOUND".to_string());
    }

    connection
        .query_row(
            "SELECT id, book_id, cfi_range, color, text_excerpt, created_at
             FROM highlights
             WHERE id = ?1",
            params![id],
            highlight_from_row,
        )
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn delete_highlight(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let connection = state
        .db
        .lock()
        .map_err(|_| "SQLITE_LOCK_ERROR".to_string())?;

    let deleted_rows = connection
        .execute("DELETE FROM highlights WHERE id = ?1", params![id])
        .map_err(|error| error.to_string())?;

    if deleted_rows == 0 {
        return Err("HIGHLIGHT_NOT_FOUND".to_string());
    }

    Ok(())
}

fn validate_color(color: &str) -> Result<(), String> {
    if ALLOWED_HIGHLIGHT_COLORS.contains(&color) {
        return Ok(());
    }

    Err("INVALID_COLOR".to_string())
}

fn ensure_book_exists(connection: &rusqlite::Connection, book_id: &str) -> Result<(), String> {
    let book_exists = connection
        .query_row(
            "SELECT 1 FROM books WHERE id = ?1",
            params![book_id],
            |row| row.get::<_, i64>(0),
        )
        .optional()
        .map_err(|error| error.to_string())?;

    if book_exists.is_none() {
        return Err("BOOK_NOT_FOUND".to_string());
    }

    Ok(())
}

fn highlight_from_row(row: &Row<'_>) -> rusqlite::Result<Highlight> {
    Ok(Highlight {
        id: row.get("id")?,
        book_id: row.get("book_id")?,
        cfi_range: row.get("cfi_range")?,
        color: row.get("color")?,
        text_excerpt: row.get("text_excerpt")?,
        created_at: row.get("created_at")?,
    })
}

fn generate_uuid_v4() -> String {
    Uuid::new_v4().to_string()
}

fn now_unix_timestamp() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or_default()
}

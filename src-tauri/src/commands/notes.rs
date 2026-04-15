use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{params, OptionalExtension, Row};
use serde::Serialize;
use tauri::State;
use uuid::Uuid;

use crate::db::AppState;

#[derive(Debug, Clone, Serialize)]
pub struct Note {
    pub id: String,
    pub book_id: String,
    pub highlight_id: Option<String>,
    pub cfi: String,
    pub text_excerpt: String,
    pub body: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[tauri::command]
pub fn get_notes(state: State<'_, AppState>, book_id: String) -> Result<Vec<Note>, String> {
    let connection = state
        .db
        .lock()
        .map_err(|_| "SQLITE_LOCK_ERROR".to_string())?;

    ensure_book_exists(&connection, &book_id)?;

    let mut statement = connection
        .prepare(
            "SELECT id, book_id, highlight_id, cfi, text_excerpt, body, created_at, updated_at
             FROM notes
             WHERE book_id = ?1
             ORDER BY created_at ASC",
        )
        .map_err(|error| error.to_string())?;

    let notes = statement
        .query_map(params![book_id], note_from_row)
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    Ok(notes)
}

#[tauri::command]
pub fn save_note(
    state: State<'_, AppState>,
    book_id: String,
    highlight_id: Option<String>,
    cfi: String,
    text_excerpt: String,
    body: String,
) -> Result<Note, String> {
    let trimmed_body = body.trim();
    if trimmed_body.is_empty() {
        return Err("EMPTY_BODY".to_string());
    }

    let connection = state
        .db
        .lock()
        .map_err(|_| "SQLITE_LOCK_ERROR".to_string())?;

    ensure_book_exists(&connection, &book_id)?;
    ensure_highlight_belongs_to_book(&connection, highlight_id.as_deref(), &book_id)?;

    let timestamp = now_unix_timestamp();
    let note = Note {
        id: generate_uuid_v4(),
        book_id,
        highlight_id,
        cfi,
        text_excerpt,
        body: trimmed_body.to_string(),
        created_at: timestamp,
        updated_at: timestamp,
    };

    connection
        .execute(
            "INSERT INTO notes (
                id,
                book_id,
                highlight_id,
                cfi,
                text_excerpt,
                body,
                created_at,
                updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                note.id,
                note.book_id,
                note.highlight_id,
                note.cfi,
                note.text_excerpt,
                note.body,
                note.created_at,
                note.updated_at
            ],
        )
        .map_err(|error| error.to_string())?;

    Ok(note)
}

#[tauri::command]
pub fn update_note(
    state: State<'_, AppState>,
    id: String,
    body: String,
) -> Result<Option<Note>, String> {
    let connection = state
        .db
        .lock()
        .map_err(|_| "SQLITE_LOCK_ERROR".to_string())?;

    let existing_note = connection
        .query_row(
            "SELECT id, book_id, highlight_id, cfi, text_excerpt, body, created_at, updated_at
             FROM notes
             WHERE id = ?1",
            params![&id],
            note_from_row,
        )
        .optional()
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "NOTE_NOT_FOUND".to_string())?;

    let trimmed_body = body.trim();
    if trimmed_body.is_empty() {
        connection
            .execute("DELETE FROM notes WHERE id = ?1", params![id])
            .map_err(|error| error.to_string())?;
        return Ok(None);
    }

    let updated_note = Note {
        body: trimmed_body.to_string(),
        updated_at: now_unix_timestamp(),
        ..existing_note
    };

    connection
        .execute(
            "UPDATE notes
             SET body = ?2,
                 updated_at = ?3
             WHERE id = ?1",
            params![updated_note.id, updated_note.body, updated_note.updated_at],
        )
        .map_err(|error| error.to_string())?;

    Ok(Some(updated_note))
}

#[tauri::command]
pub fn delete_note(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let connection = state
        .db
        .lock()
        .map_err(|_| "SQLITE_LOCK_ERROR".to_string())?;

    let deleted_rows = connection
        .execute("DELETE FROM notes WHERE id = ?1", params![id])
        .map_err(|error| error.to_string())?;

    if deleted_rows == 0 {
        return Err("NOTE_NOT_FOUND".to_string());
    }

    Ok(())
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

fn ensure_highlight_belongs_to_book(
    connection: &rusqlite::Connection,
    highlight_id: Option<&str>,
    book_id: &str,
) -> Result<(), String> {
    let Some(highlight_id) = highlight_id else {
        return Ok(());
    };

    let highlight_exists = connection
        .query_row(
            "SELECT 1 FROM highlights WHERE id = ?1 AND book_id = ?2",
            params![highlight_id, book_id],
            |row| row.get::<_, i64>(0),
        )
        .optional()
        .map_err(|error| error.to_string())?;

    if highlight_exists.is_none() {
        return Err("HIGHLIGHT_NOT_FOUND".to_string());
    }

    Ok(())
}

fn note_from_row(row: &Row<'_>) -> rusqlite::Result<Note> {
    Ok(Note {
        id: row.get("id")?,
        book_id: row.get("book_id")?,
        highlight_id: row.get("highlight_id")?,
        cfi: row.get("cfi")?,
        text_excerpt: row.get("text_excerpt")?,
        body: row.get("body")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
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

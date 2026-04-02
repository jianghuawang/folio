use std::{
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};

use crate::{
    db::AppState,
    epub::importer::{self, ImportedBookDraft},
};

#[derive(Debug, Clone, Serialize)]
pub struct Book {
    pub id: String,
    pub title: String,
    pub author: String,
    pub file_path: String,
    pub cover_image_path: Option<String>,
    pub added_at: i64,
    pub last_read_at: Option<i64>,
    pub last_position_cfi: Option<String>,
    pub file_hash: String,
    pub reading_progress: f64,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct ImportBookResponse {
    pub books: Vec<Book>,
    pub duplicates: Vec<ImportDuplicate>,
    pub errors: Vec<ImportFailure>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ImportDuplicate {
    pub title: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ImportFailure {
    pub filename: String,
}

#[derive(Debug, Clone, Serialize)]
struct ImportProgressEvent {
    filename: String,
    status: &'static str,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BookFilter {
    All,
    Recent,
}

#[tauri::command]
pub fn import_book(
    app: AppHandle,
    state: State<'_, AppState>,
    file_paths: Vec<String>,
) -> Result<ImportBookResponse, String> {
    let mut response = ImportBookResponse::default();

    for file_path in file_paths {
        let source_path = PathBuf::from(&file_path);
        let filename = source_path
            .file_name()
            .and_then(|value| value.to_str())
            .map(str::to_owned)
            .unwrap_or_else(|| file_path.clone());

        let file_hash = match importer::compute_file_hash(&source_path) {
            Ok(file_hash) => file_hash,
            Err(_) => {
                response.errors.push(ImportFailure {
                    filename: filename.clone(),
                });
                continue;
            }
        };

        let duplicate_title = {
            let connection = state
                .db
                .lock()
                .map_err(|_| "SQLITE_LOCK_ERROR".to_string())?;
            find_duplicate_title(&connection, &file_hash)?
        };

        if let Some(title) = duplicate_title {
            response.duplicates.push(ImportDuplicate { title });
            continue;
        }

        emit_import_progress(&app, &filename, "copying");

        let managed_copy =
            match importer::create_managed_copy(&app, &source_path, file_hash.clone()) {
                Ok(managed_copy) => managed_copy,
                Err(_) => {
                    response.errors.push(ImportFailure {
                        filename: filename.clone(),
                    });
                    continue;
                }
            };

        emit_import_progress(&app, &filename, "parsing");

        let imported_book = match importer::parse_managed_copy(managed_copy, &source_path) {
            Ok(imported_book) => imported_book,
            Err(_) => {
                response.errors.push(ImportFailure {
                    filename: filename.clone(),
                });
                continue;
            }
        };

        let persisted_book = {
            let connection = state
                .db
                .lock()
                .map_err(|_| "SQLITE_LOCK_ERROR".to_string())?;

            if let Err(error) = insert_book(&connection, &imported_book) {
                importer::cleanup_import_draft(&imported_book);
                return Err(error);
            }

            get_book_record(&connection, &imported_book.id)?
                .ok_or_else(|| "BOOK_NOT_FOUND".to_string())?
        };

        emit_import_progress(&app, &filename, "done");
        response.books.push(persisted_book);
    }

    Ok(response)
}

#[tauri::command]
pub fn get_books(state: State<'_, AppState>, filter: BookFilter) -> Result<Vec<Book>, String> {
    let connection = state
        .db
        .lock()
        .map_err(|_| "SQLITE_LOCK_ERROR".to_string())?;

    let sql = match filter {
        BookFilter::All => {
            "SELECT id, title, author, file_path, cover_image_path, added_at, last_read_at, last_position_cfi, file_hash, reading_progress
             FROM books
             ORDER BY added_at DESC"
        }
        BookFilter::Recent => {
            "SELECT id, title, author, file_path, cover_image_path, added_at, last_read_at, last_position_cfi, file_hash, reading_progress
             FROM books
             WHERE last_read_at IS NOT NULL AND last_read_at >= ?1
             ORDER BY added_at DESC"
        }
    };

    let mut statement = connection.prepare(sql).map_err(|error| error.to_string())?;
    let threshold = now_unix_timestamp() - (30 * 24 * 60 * 60);

    let books = match filter {
        BookFilter::All => statement
            .query_map([], book_from_row)
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?,
        BookFilter::Recent => statement
            .query_map([threshold], book_from_row)
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?,
    };

    Ok(books)
}

#[tauri::command]
pub fn get_book(state: State<'_, AppState>, book_id: String) -> Result<Book, String> {
    let connection = state
        .db
        .lock()
        .map_err(|_| "SQLITE_LOCK_ERROR".to_string())?;

    get_book_record(&connection, &book_id)?.ok_or_else(|| "BOOK_NOT_FOUND".to_string())
}

#[tauri::command]
pub fn delete_book(state: State<'_, AppState>, book_id: String) -> Result<(), String> {
    let connection = state
        .db
        .lock()
        .map_err(|_| "SQLITE_LOCK_ERROR".to_string())?;

    let book =
        get_book_record(&connection, &book_id)?.ok_or_else(|| "BOOK_NOT_FOUND".to_string())?;

    remove_file_if_present(Path::new(&book.file_path)).map_err(|error| error.to_string())?;

    if let Some(cover_image_path) = &book.cover_image_path {
        remove_file_if_present(Path::new(cover_image_path)).map_err(|error| error.to_string())?;
    }

    connection
        .execute("DELETE FROM books WHERE id = ?1", params![book_id])
        .map_err(|error| error.to_string())?;

    Ok(())
}

fn find_duplicate_title(
    connection: &Connection,
    file_hash: &str,
) -> Result<Option<String>, String> {
    connection
        .query_row(
            "SELECT title FROM books WHERE file_hash = ?1 LIMIT 1",
            params![file_hash],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| error.to_string())
}

fn insert_book(connection: &Connection, imported_book: &ImportedBookDraft) -> Result<(), String> {
    connection
        .execute(
            "INSERT INTO books (
                id,
                title,
                author,
                file_path,
                cover_image_path,
                added_at,
                last_read_at,
                last_position_cfi,
                file_hash,
                reading_progress
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL, NULL, ?7, 0.0)",
            params![
                imported_book.id,
                imported_book.title,
                imported_book.author,
                imported_book.managed_path.to_string_lossy().into_owned(),
                imported_book
                    .cover_path
                    .as_ref()
                    .map(|cover_path| cover_path.to_string_lossy().into_owned()),
                imported_book.added_at,
                imported_book.file_hash,
            ],
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}

fn get_book_record(connection: &Connection, book_id: &str) -> Result<Option<Book>, String> {
    connection
        .query_row(
            "SELECT id, title, author, file_path, cover_image_path, added_at, last_read_at, last_position_cfi, file_hash, reading_progress
             FROM books
             WHERE id = ?1",
            params![book_id],
            book_from_row,
        )
        .optional()
        .map_err(|error| error.to_string())
}

fn book_from_row(row: &Row<'_>) -> rusqlite::Result<Book> {
    Ok(Book {
        id: row.get("id")?,
        title: row.get("title")?,
        author: row.get("author")?,
        file_path: row.get("file_path")?,
        cover_image_path: row.get("cover_image_path")?,
        added_at: row.get("added_at")?,
        last_read_at: row.get("last_read_at")?,
        last_position_cfi: row.get("last_position_cfi")?,
        file_hash: row.get("file_hash")?,
        reading_progress: row.get("reading_progress")?,
    })
}

fn emit_import_progress(app: &AppHandle, filename: &str, status: &'static str) {
    let _ = app.emit(
        "import:progress",
        ImportProgressEvent {
            filename: filename.to_string(),
            status,
        },
    );
}

fn remove_file_if_present(path: &Path) -> Result<(), std::io::Error> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error),
    }
}

fn now_unix_timestamp() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or_default()
}

use rusqlite::{params, OptionalExtension};
use tauri::{AppHandle, State};

use crate::{
    db::AppState,
    epub::exporter,
    llm::{translation_from_row, translation_job_from_row, TranslationJobStatus},
};

#[tauri::command]
pub fn export_bilingual_epub(
    app: AppHandle,
    state: State<'_, AppState>,
    book_id: String,
    target_language: String,
    save_path: String,
) -> Result<(), String> {
    let (managed_file_path, translations) = {
        let connection = state
            .db
            .lock()
            .map_err(|_| "SQLITE_LOCK_ERROR".to_string())?;

        let managed_file_path = connection
            .query_row(
                "SELECT file_path FROM books WHERE id = ?1",
                params![&book_id],
                |row| row.get::<_, String>(0),
            )
            .optional()
            .map_err(|error| error.to_string())?
            .ok_or_else(|| "BOOK_NOT_FOUND".to_string())?;

        let translation_job = connection
            .query_row(
                "SELECT id, book_id, target_language, status, total_paragraphs, completed_paragraphs, failed_paragraph_locators, pause_reason, created_at, updated_at
                 FROM translation_jobs
                 WHERE book_id = ?1 AND target_language = ?2",
                params![&book_id, &target_language],
                translation_job_from_row,
            )
            .optional()
            .map_err(|error| error.to_string())?
            .ok_or_else(|| "TRANSLATION_INCOMPLETE".to_string())?;

        if translation_job.status != TranslationJobStatus::Complete
            || translation_job.completed_paragraphs < translation_job.total_paragraphs
        {
            return Err("TRANSLATION_INCOMPLETE".to_string());
        }

        let mut statement = connection
            .prepare(
                "SELECT id, book_id, spine_item_href, paragraph_index, paragraph_hash, original_html, translated_html, target_language, created_at
                 FROM translations
                 WHERE book_id = ?1 AND target_language = ?2",
            )
            .map_err(|error| error.to_string())?;

        let translations = statement
            .query_map(params![&book_id, &target_language], translation_from_row)
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;

        (managed_file_path, translations)
    };

    exporter::export_bilingual_epub(&app, &managed_file_path, &translations, &save_path)
}

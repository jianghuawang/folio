use std::{fs, path::Path};

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
    let save_path = save_path.trim().to_string();
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

    validate_save_path(&save_path, &managed_file_path)?;

    exporter::export_bilingual_epub(&app, &managed_file_path, &translations, &save_path)
}

#[tauri::command]
pub fn export_highlights(
    state: State<'_, AppState>,
    book_id: String,
    save_path: String,
) -> Result<(), String> {
    let save_path = save_path.trim().to_string();
    let (book_title, managed_file_path, highlights) = {
        let connection = state
            .db
            .lock()
            .map_err(|_| "SQLITE_LOCK_ERROR".to_string())?;

        let (book_title, managed_file_path) = connection
            .query_row(
                "SELECT title, file_path FROM books WHERE id = ?1",
                params![&book_id],
                |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
            )
            .optional()
            .map_err(|error| error.to_string())?
            .ok_or_else(|| "BOOK_NOT_FOUND".to_string())?;

        let mut statement = connection
            .prepare(
                "SELECT color, text_excerpt, cfi_range, created_at
                 FROM highlights
                 WHERE book_id = ?1
                 ORDER BY created_at ASC",
            )
            .map_err(|error| error.to_string())?;

        let highlights = statement
            .query_map(params![&book_id], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, i64>(3)?,
                ))
            })
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;

        (book_title, managed_file_path, highlights)
    };

    if highlights.is_empty() {
        return Err("NO_HIGHLIGHTS".to_string());
    }

    let export_format = validate_highlight_export_path(&save_path, &managed_file_path)?;
    let output = match export_format.as_str() {
        "csv" => build_highlights_csv(&highlights),
        "md" => build_highlights_markdown(&book_title, &highlights),
        _ => return Err("UNSUPPORTED_EXPORT_FORMAT".to_string()),
    };

    fs::write(&save_path, output).map_err(|_| "WRITE_ERROR".to_string())
}

fn validate_save_path(save_path: &str, managed_file_path: &str) -> Result<(), String> {
    if save_path.is_empty() {
        return Err("WRITE_ERROR".to_string());
    }

    let export_path = Path::new(save_path);
    let parent_directory = export_path
        .parent()
        .ok_or_else(|| "WRITE_ERROR".to_string())?;
    export_path
        .file_name()
        .and_then(|value| value.to_str())
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "WRITE_ERROR".to_string())?;

    let has_epub_extension = export_path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.eq_ignore_ascii_case("epub"))
        .unwrap_or(false);
    if !has_epub_extension {
        return Err("WRITE_ERROR".to_string());
    }

    if !parent_directory.exists() || !parent_directory.is_dir() {
        return Err("WRITE_ERROR".to_string());
    }

    if export_path == Path::new(managed_file_path) {
        return Err("WRITE_ERROR".to_string());
    }

    Ok(())
}

fn validate_highlight_export_path(
    save_path: &str,
    managed_file_path: &str,
) -> Result<String, String> {
    if save_path.is_empty() {
        return Err("WRITE_ERROR".to_string());
    }

    let export_path = Path::new(save_path);
    let parent_directory = export_path
        .parent()
        .ok_or_else(|| "WRITE_ERROR".to_string())?;

    export_path
        .file_name()
        .and_then(|value| value.to_str())
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "WRITE_ERROR".to_string())?;

    if !parent_directory.exists() || !parent_directory.is_dir() {
        return Err("WRITE_ERROR".to_string());
    }

    if export_path == Path::new(managed_file_path) {
        return Err("WRITE_ERROR".to_string());
    }

    let extension = export_path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .ok_or_else(|| "UNSUPPORTED_EXPORT_FORMAT".to_string())?;

    if extension != "md" && extension != "csv" {
        return Err("UNSUPPORTED_EXPORT_FORMAT".to_string());
    }

    Ok(extension)
}

fn build_highlights_markdown(
    book_title: &str,
    highlights: &[(String, String, String, i64)],
) -> String {
    let mut lines = vec![format!("# {} Highlights", book_title.trim()), String::new()];

    for (index, (color, excerpt, cfi_range, created_at)) in highlights.iter().enumerate() {
        lines.push(format!("## Highlight {}", index + 1));
        lines.push(String::new());
        lines.push(format!("> {}", excerpt.trim()));
        lines.push(String::new());
        lines.push(format!("- Color: {}", color));
        lines.push(format!("- Created At (Unix): {}", created_at));
        lines.push(format!("- CFI: {}", cfi_range));
        lines.push(String::new());
    }

    lines.join("\n")
}

fn build_highlights_csv(highlights: &[(String, String, String, i64)]) -> String {
    let mut rows = vec!["color,text_excerpt,cfi_range,created_at_unix".to_string()];

    for (color, excerpt, cfi_range, created_at) in highlights {
        rows.push(format!(
            "{},{},{},{}",
            escape_csv(color),
            escape_csv(excerpt),
            escape_csv(cfi_range),
            created_at
        ));
    }

    rows.join("\n")
}

fn escape_csv(value: &str) -> String {
    let escaped = value.replace('"', "\"\"");
    format!("\"{}\"", escaped)
}

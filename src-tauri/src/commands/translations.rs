use rusqlite::{params, OptionalExtension};
use tauri::{AppHandle, Emitter, State};

use crate::{
    db::AppState,
    keychain,
    llm::{
        generate_uuid_v4, now_unix_timestamp, serialize_paragraph_locators, translation_from_row,
        translation_job_from_row, worker, ParagraphLocator, Translation, TranslationJob,
        TranslationJobStatus, TranslationPauseReason, TranslationPausedEvent, DEFAULT_LLM_MODEL,
    },
};

#[derive(Debug)]
struct BookTranslationSource {
    book_id: String,
    file_path: String,
}

#[tauri::command]
pub fn start_translation(
    app: AppHandle,
    state: State<'_, AppState>,
    book_id: String,
    target_language: String,
    replace_existing: Option<bool>,
) -> Result<TranslationJob, String> {
    let replace_existing = replace_existing.unwrap_or(false);
    let target_language = target_language.trim().to_string();
    let api_key = keychain::load_api_key()?.ok_or_else(|| "NO_API_KEY".to_string())?;

    let (book, model, existing_job, existing_translation_count) = {
        let connection = state
            .db
            .lock()
            .map_err(|_| "SQLITE_LOCK_ERROR".to_string())?;

        let book = get_book_translation_source(&connection, &book_id)?;
        let model = read_llm_model(&connection)?;
        let existing_job = get_translation_job_record(&connection, &book_id, &target_language)?;
        let existing_translation_count =
            count_translations(&connection, &book_id, &target_language)?;

        (book, model, existing_job, existing_translation_count)
    };

    if let Some(existing_job) = &existing_job {
        match existing_job.status {
            TranslationJobStatus::InProgress | TranslationJobStatus::Paused => {
                return Err("JOB_ALREADY_EXISTS".to_string())
            }
            TranslationJobStatus::Complete if !replace_existing => {
                return Err("TRANSLATION_ALREADY_COMPLETE".to_string())
            }
            _ => {}
        }
    }

    let total_paragraphs = worker::count_paragraphs(&book.file_path)?;
    if total_paragraphs == 0 {
        return Err("TRANSLATION_FAILED".to_string());
    }

    let completed_paragraphs = if replace_existing {
        0
    } else {
        existing_translation_count
    };
    if completed_paragraphs >= total_paragraphs && !replace_existing {
        return Err("TRANSLATION_ALREADY_COMPLETE".to_string());
    }

    let job = {
        let connection = state
            .db
            .lock()
            .map_err(|_| "SQLITE_LOCK_ERROR".to_string())?;

        if replace_existing {
            connection
                .execute(
                    "DELETE FROM translations WHERE book_id = ?1 AND target_language = ?2",
                    params![&book_id, &target_language],
                )
                .map_err(|error| error.to_string())?;
        }

        connection
            .execute(
                "DELETE FROM translation_jobs WHERE book_id = ?1 AND target_language = ?2",
                params![&book_id, &target_language],
            )
            .map_err(|error| error.to_string())?;

        let timestamp = now_unix_timestamp();
        let job = TranslationJob {
            id: generate_uuid_v4().map_err(|error| error.to_string())?,
            book_id: book.book_id.clone(),
            target_language: target_language.clone(),
            status: TranslationJobStatus::InProgress,
            total_paragraphs,
            completed_paragraphs,
            failed_paragraph_locators: Vec::new(),
            pause_reason: None,
            created_at: timestamp,
            updated_at: timestamp,
        };

        connection
            .execute(
                "INSERT INTO translation_jobs (
                    id,
                    book_id,
                    target_language,
                    status,
                    total_paragraphs,
                    completed_paragraphs,
                    failed_paragraph_locators,
                    pause_reason,
                    created_at,
                    updated_at
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, NULL, ?8, ?9)",
                params![
                    &job.id,
                    &job.book_id,
                    &job.target_language,
                    job.status.as_str(),
                    job.total_paragraphs,
                    job.completed_paragraphs,
                    serialize_paragraph_locators(&job.failed_paragraph_locators)?,
                    job.created_at,
                    job.updated_at,
                ],
            )
            .map_err(|error| error.to_string())?;

        job
    };

    worker::spawn_translation_worker(
        app,
        job.clone(),
        book.file_path,
        model,
        api_key,
        worker::WorkerMode::PendingMissing,
    );

    Ok(job)
}

#[tauri::command]
pub fn pause_translation(
    app: AppHandle,
    state: State<'_, AppState>,
    job_id: String,
) -> Result<TranslationJob, String> {
    let updated_job = {
        let connection = state
            .db
            .lock()
            .map_err(|_| "SQLITE_LOCK_ERROR".to_string())?;

        let mut job = get_translation_job_by_id(&connection, &job_id)?
            .ok_or_else(|| "JOB_NOT_FOUND".to_string())?;

        if job.status == TranslationJobStatus::Paused {
            return Ok(job);
        }

        if job.status != TranslationJobStatus::InProgress {
            return Ok(job);
        }

        let timestamp = now_unix_timestamp();

        connection
            .execute(
                "UPDATE translation_jobs
                 SET status = ?2,
                     pause_reason = ?3,
                     updated_at = ?4
                 WHERE id = ?1",
                params![
                    &job_id,
                    TranslationJobStatus::Paused.as_str(),
                    TranslationPauseReason::Manual.as_str(),
                    timestamp,
                ],
            )
            .map_err(|error| error.to_string())?;

        job.status = TranslationJobStatus::Paused;
        job.pause_reason = Some(TranslationPauseReason::Manual);
        job.updated_at = timestamp;
        job
    };

    let _ = worker::pause_job(&job_id);
    app.emit(
        "translation:paused",
        TranslationPausedEvent {
            job_id,
            reason: TranslationPauseReason::Manual,
            retry_after_secs: None,
        },
    )
    .map_err(|error| error.to_string())?;

    Ok(updated_job)
}

#[tauri::command]
pub fn resume_translation(
    app: AppHandle,
    state: State<'_, AppState>,
    job_id: String,
) -> Result<TranslationJob, String> {
    let (job, model, book_file_path) = {
        let connection = state
            .db
            .lock()
            .map_err(|_| "SQLITE_LOCK_ERROR".to_string())?;

        let mut job = get_translation_job_by_id(&connection, &job_id)?
            .ok_or_else(|| "JOB_NOT_FOUND".to_string())?;

        if job.status == TranslationJobStatus::InProgress {
            return Ok(job);
        }

        if job.status != TranslationJobStatus::Paused {
            return Ok(job);
        }

        let book = get_book_translation_source(&connection, &job.book_id)?;
        let model = read_llm_model(&connection)?;
        let timestamp = now_unix_timestamp();

        connection
            .execute(
                "UPDATE translation_jobs
                 SET status = ?2,
                     pause_reason = NULL,
                     updated_at = ?3
                 WHERE id = ?1",
                params![
                    &job_id,
                    TranslationJobStatus::InProgress.as_str(),
                    timestamp
                ],
            )
            .map_err(|error| error.to_string())?;

        job.status = TranslationJobStatus::InProgress;
        job.pause_reason = None;
        job.updated_at = timestamp;

        (job, model, book.file_path)
    };

    let api_key = keychain::load_api_key()?.ok_or_else(|| "NO_API_KEY".to_string())?;

    if !worker::resume_job(&job.id) {
        worker::spawn_translation_worker(
            app,
            job.clone(),
            book_file_path,
            model,
            api_key,
            worker::WorkerMode::PendingMissing,
        );
    }

    Ok(job)
}

#[tauri::command]
pub fn cancel_translation(state: State<'_, AppState>, job_id: String) -> Result<(), String> {
    {
        let connection = state
            .db
            .lock()
            .map_err(|_| "SQLITE_LOCK_ERROR".to_string())?;

        let job = get_translation_job_by_id(&connection, &job_id)?
            .ok_or_else(|| "JOB_NOT_FOUND".to_string())?;

        if matches!(
            job.status,
            TranslationJobStatus::Cancelled
                | TranslationJobStatus::Complete
                | TranslationJobStatus::Failed
        ) {
            return Ok(());
        }

        let timestamp = now_unix_timestamp();
        connection
            .execute(
                "UPDATE translation_jobs
                 SET status = ?2,
                     pause_reason = NULL,
                     updated_at = ?3
                 WHERE id = ?1",
                params![&job_id, TranslationJobStatus::Cancelled.as_str(), timestamp],
            )
            .map_err(|error| error.to_string())?;
    }

    let _ = worker::cancel_job(&job_id);

    Ok(())
}

#[tauri::command]
pub fn get_translations(
    state: State<'_, AppState>,
    book_id: String,
    target_language: String,
) -> Result<Vec<Translation>, String> {
    let connection = state
        .db
        .lock()
        .map_err(|_| "SQLITE_LOCK_ERROR".to_string())?;

    let mut statement = connection
        .prepare(
            "SELECT id, book_id, spine_item_href, paragraph_index, paragraph_hash, original_html, translated_html, target_language, created_at
             FROM translations
             WHERE book_id = ?1 AND target_language = ?2
             ORDER BY spine_item_href ASC, paragraph_index ASC",
        )
        .map_err(|error| error.to_string())?;

    let translations = statement
        .query_map(params![book_id, target_language], translation_from_row)
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    Ok(translations)
}

#[tauri::command]
pub fn get_translation_job(
    state: State<'_, AppState>,
    book_id: String,
    target_language: String,
) -> Result<Option<TranslationJob>, String> {
    let connection = state
        .db
        .lock()
        .map_err(|_| "SQLITE_LOCK_ERROR".to_string())?;

    get_translation_job_record(&connection, &book_id, &target_language)
}

#[tauri::command]
pub fn retry_failed_paragraphs(
    app: AppHandle,
    state: State<'_, AppState>,
    job_id: String,
) -> Result<TranslationJob, String> {
    let (job, model, book_file_path, failed_locators) = {
        let connection = state
            .db
            .lock()
            .map_err(|_| "SQLITE_LOCK_ERROR".to_string())?;

        let mut job = get_translation_job_by_id(&connection, &job_id)?
            .ok_or_else(|| "JOB_NOT_FOUND".to_string())?;
        if job.status == TranslationJobStatus::InProgress
            || job.failed_paragraph_locators.is_empty()
        {
            return Ok(job);
        }

        let book = get_book_translation_source(&connection, &job.book_id)?;
        let model = read_llm_model(&connection)?;
        let failed_locators = job.failed_paragraph_locators.clone();
        let timestamp = now_unix_timestamp();

        connection
            .execute(
                "UPDATE translation_jobs
                 SET status = ?2,
                     pause_reason = NULL,
                     failed_paragraph_locators = ?3,
                     updated_at = ?4
                 WHERE id = ?1",
                params![
                    &job_id,
                    TranslationJobStatus::InProgress.as_str(),
                    serialize_paragraph_locators(&Vec::<ParagraphLocator>::new())?,
                    timestamp,
                ],
            )
            .map_err(|error| error.to_string())?;

        job.status = TranslationJobStatus::InProgress;
        job.pause_reason = None;
        job.failed_paragraph_locators = Vec::new();
        job.updated_at = timestamp;

        (job, model, book.file_path, failed_locators)
    };

    let api_key = keychain::load_api_key()?.ok_or_else(|| "NO_API_KEY".to_string())?;

    worker::spawn_translation_worker(
        app,
        job.clone(),
        book_file_path,
        model,
        api_key,
        worker::WorkerMode::Specific(failed_locators),
    );

    Ok(job)
}

pub fn normalize_in_progress_jobs(state: &AppState) -> Result<(), String> {
    let connection = state
        .db
        .lock()
        .map_err(|_| "SQLITE_LOCK_ERROR".to_string())?;

    connection
        .execute(
            "UPDATE translation_jobs
             SET status = 'paused',
                 pause_reason = 'app_restart',
                 updated_at = ?1
             WHERE status = 'in_progress'",
            params![now_unix_timestamp()],
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}

fn get_book_translation_source(
    connection: &rusqlite::Connection,
    book_id: &str,
) -> Result<BookTranslationSource, String> {
    connection
        .query_row(
            "SELECT id, file_path FROM books WHERE id = ?1",
            params![book_id],
            |row| {
                Ok(BookTranslationSource {
                    book_id: row.get("id")?,
                    file_path: row.get("file_path")?,
                })
            },
        )
        .optional()
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "BOOK_NOT_FOUND".to_string())
}

fn read_llm_model(connection: &rusqlite::Connection) -> Result<String, String> {
    let llm_model = connection
        .query_row(
            "SELECT value FROM app_settings WHERE key = 'llm_model'",
            [],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| error.to_string())?
        .map(|raw_value| {
            serde_json::from_str::<String>(&raw_value).map_err(|error| error.to_string())
        })
        .transpose()?
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| DEFAULT_LLM_MODEL.to_string());

    Ok(llm_model)
}

fn count_translations(
    connection: &rusqlite::Connection,
    book_id: &str,
    target_language: &str,
) -> Result<i64, String> {
    connection
        .query_row(
            "SELECT COUNT(*) FROM translations WHERE book_id = ?1 AND target_language = ?2",
            params![book_id, target_language],
            |row| row.get::<_, i64>(0),
        )
        .map_err(|error| error.to_string())
}

fn get_translation_job_record(
    connection: &rusqlite::Connection,
    book_id: &str,
    target_language: &str,
) -> Result<Option<TranslationJob>, String> {
    connection
        .query_row(
            "SELECT id, book_id, target_language, status, total_paragraphs, completed_paragraphs, failed_paragraph_locators, pause_reason, created_at, updated_at
             FROM translation_jobs
             WHERE book_id = ?1 AND target_language = ?2",
            params![book_id, target_language],
            translation_job_from_row,
        )
        .optional()
        .map_err(|error| error.to_string())
}

fn get_translation_job_by_id(
    connection: &rusqlite::Connection,
    job_id: &str,
) -> Result<Option<TranslationJob>, String> {
    connection
        .query_row(
            "SELECT id, book_id, target_language, status, total_paragraphs, completed_paragraphs, failed_paragraph_locators, pause_reason, created_at, updated_at
             FROM translation_jobs
             WHERE id = ?1",
            params![job_id],
            translation_job_from_row,
        )
        .optional()
        .map_err(|error| error.to_string())
}

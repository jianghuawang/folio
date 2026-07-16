use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex, OnceLock,
    },
};

use rusqlite::OptionalExtension;
use serde::Deserialize;
use tauri::{AppHandle, Emitter, State};

use crate::{
    db::AppState,
    llm::{
        client::{ChatMessage, LlmClient, TranslateParagraphError},
        AskCompleteEvent, AskDeltaEvent, AskErrorEvent,
    },
    secure_store,
};

const MAX_CONTEXT_CHARS: usize = 8_000;
const MAX_SELECTION_CHARS: usize = 4_000;
const MAX_QUESTION_CHARS: usize = 4_000;
const MAX_HISTORY_TURNS: usize = 20;

static ASK_CONTROLS: OnceLock<Mutex<HashMap<String, Arc<AtomicBool>>>> = OnceLock::new();

#[derive(Debug, Deserialize)]
pub struct AskTurn {
    pub role: String,
    pub content: String,
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn ask_question(
    app: AppHandle,
    state: State<'_, AppState>,
    request_id: String,
    book_id: String,
    selection_text: String,
    context_text: String,
    question: String,
    history: Vec<AskTurn>,
) -> Result<(), String> {
    let api_key = secure_store::load_api_key()?.ok_or_else(|| "NO_API_KEY".to_string())?;

    let (book_title, book_author, model) = {
        let connection = state
            .db
            .lock()
            .map_err(|_| "SQLITE_LOCK_ERROR".to_string())?;

        let (title, author) = connection
            .query_row(
                "SELECT title, author FROM books WHERE id = ?1",
                [&book_id],
                |row| {
                    Ok((
                        row.get::<_, String>("title")?,
                        row.get::<_, String>("author")?,
                    ))
                },
            )
            .optional()
            .map_err(|error| error.to_string())?
            .ok_or_else(|| "BOOK_NOT_FOUND".to_string())?;

        let model = super::translations::read_llm_model(&connection)?;

        (title, author, model)
    };

    let system_prompt = build_system_prompt(
        &book_title,
        &book_author,
        &truncate_chars(&selection_text, MAX_SELECTION_CHARS),
        &truncate_chars(&context_text, MAX_CONTEXT_CHARS),
    );

    let mut messages = Vec::with_capacity(history.len() + 2);
    messages.push(ChatMessage {
        role: "system".to_string(),
        content: system_prompt,
    });
    for turn in history
        .iter()
        .rev()
        .take(MAX_HISTORY_TURNS)
        .rev()
        .filter(|turn| matches!(turn.role.as_str(), "user" | "assistant"))
    {
        messages.push(ChatMessage {
            role: turn.role.clone(),
            content: turn.content.clone(),
        });
    }
    messages.push(ChatMessage {
        role: "user".to_string(),
        content: truncate_chars(&question, MAX_QUESTION_CHARS),
    });

    let cancel_flag = register_ask_control(&request_id);
    let client = LlmClient::new(api_key)?;

    tauri::async_runtime::spawn(async move {
        let emit_cancel = cancel_flag.clone();
        let emit_app = app.clone();
        let emit_request_id = request_id.clone();

        let result = client
            .ask_stream(&messages, &model, |delta| {
                if emit_cancel.load(Ordering::SeqCst) {
                    return false;
                }

                let _ = emit_app.emit(
                    "ask:delta",
                    AskDeltaEvent {
                        request_id: emit_request_id.clone(),
                        delta: delta.to_string(),
                    },
                );
                true
            })
            .await;

        let cancelled = cancel_flag.load(Ordering::SeqCst);
        match result {
            Ok(()) if !cancelled => {
                let _ = app.emit(
                    "ask:complete",
                    AskCompleteEvent {
                        request_id: request_id.clone(),
                    },
                );
            }
            Ok(()) => {}
            Err(error) => {
                if !cancelled {
                    let _ = app.emit("ask:error", ask_error_event(&request_id, &error));
                }
            }
        }

        remove_ask_control(&request_id);
    });

    Ok(())
}

#[tauri::command]
pub fn cancel_ask(request_id: String) -> Result<(), String> {
    let controls = ask_controls().lock().map_err(|error| error.to_string())?;
    if let Some(flag) = controls.get(&request_id) {
        flag.store(true, Ordering::SeqCst);
    }

    Ok(())
}

fn build_system_prompt(title: &str, author: &str, selection: &str, context: &str) -> String {
    format!(
        "You are a reading assistant inside Folio, an ePub reader. The user is reading \"{title}\" by {author} and selected a passage they want to discuss.\n\n\
Selected passage:\n\"\"\"\n{selection}\n\"\"\"\n\n\
Surrounding chapter context:\n\"\"\"\n{context}\n\"\"\"\n\n\
Answer the user's questions about this passage, using the surrounding context and your knowledge of the book. \
Be concise and direct. Do not reveal major plot points beyond the passage unless asked. \
Always respond in the same language the user writes their question in."
    )
}

fn ask_error_event(request_id: &str, error: &TranslateParagraphError) -> AskErrorEvent {
    let (code, retry_after_secs) = match error {
        TranslateParagraphError::Auth => ("INVALID_API_KEY", None),
        TranslateParagraphError::RateLimited { retry_after_secs } => {
            ("RATE_LIMITED", Some(*retry_after_secs))
        }
        TranslateParagraphError::Network(_) => ("NETWORK_ERROR", None),
        _ => ("ASK_FAILED", None),
    };

    AskErrorEvent {
        request_id: request_id.to_string(),
        code: code.to_string(),
        message: error.to_string(),
        retry_after_secs,
    }
}

fn truncate_chars(text: &str, max_chars: usize) -> String {
    if text.chars().count() <= max_chars {
        return text.to_string();
    }

    text.chars().take(max_chars).collect()
}

fn ask_controls() -> &'static Mutex<HashMap<String, Arc<AtomicBool>>> {
    ASK_CONTROLS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn register_ask_control(request_id: &str) -> Arc<AtomicBool> {
    let flag = Arc::new(AtomicBool::new(false));

    if let Ok(mut controls) = ask_controls().lock() {
        controls.insert(request_id.to_string(), flag.clone());
    }

    flag
}

fn remove_ask_control(request_id: &str) {
    if let Ok(mut controls) = ask_controls().lock() {
        controls.remove(request_id);
    }
}

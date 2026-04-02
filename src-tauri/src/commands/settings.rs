use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::{
    db::AppState,
    keychain,
    llm::{
        client::{LlmClient, TranslateParagraphError},
        DEFAULT_LLM_MODEL,
    },
};

const LLM_MODEL_KEY: &str = "llm_model";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub llm_model: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct PartialAppSettings {
    pub llm_model: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ApiKeyStatus {
    pub configured: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(untagged)]
pub enum ConnectionTestResult {
    Success { success: bool },
    Failure { success: bool, error: String },
}

#[tauri::command]
pub fn get_app_settings(state: State<'_, AppState>) -> Result<AppSettings, String> {
    let connection = state
        .db
        .lock()
        .map_err(|_| "SQLITE_LOCK_ERROR".to_string())?;

    read_app_settings(&connection)
}

#[tauri::command]
pub fn save_app_settings(
    state: State<'_, AppState>,
    settings: PartialAppSettings,
) -> Result<AppSettings, String> {
    let connection = state
        .db
        .lock()
        .map_err(|_| "SQLITE_LOCK_ERROR".to_string())?;

    let mut resolved_settings = read_app_settings(&connection)?;

    if let Some(llm_model) = settings.llm_model {
        let normalized_model = llm_model.trim();
        resolved_settings.llm_model = if normalized_model.is_empty() {
            DEFAULT_LLM_MODEL.to_string()
        } else {
            normalized_model.to_string()
        };
    }

    connection
        .execute(
            "INSERT INTO app_settings (key, value)
             VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![
                LLM_MODEL_KEY,
                serde_json::to_string(&resolved_settings.llm_model)
                    .map_err(|error| error.to_string())?
            ],
        )
        .map_err(|error| error.to_string())?;

    Ok(resolved_settings)
}

#[tauri::command]
pub fn save_api_key(api_key: String) -> Result<(), String> {
    let normalized_api_key = api_key.trim();
    if normalized_api_key.is_empty() {
        if keychain::has_api_key()? {
            return Ok(());
        }

        return Err("API_KEY_REQUIRED".to_string());
    }

    keychain::save_api_key(normalized_api_key)
}

#[tauri::command]
pub fn has_api_key() -> Result<ApiKeyStatus, String> {
    keychain::has_api_key().map(|configured| ApiKeyStatus { configured })
}

#[tauri::command]
pub fn clear_api_key() -> Result<(), String> {
    keychain::clear_api_key()
}

#[tauri::command]
pub async fn test_openrouter_connection(
    api_key: Option<String>,
    model: String,
) -> Result<ConnectionTestResult, String> {
    let resolved_api_key = if let Some(api_key) = api_key
        .map(|candidate| candidate.trim().to_string())
        .filter(|candidate| !candidate.is_empty())
    {
        Some(api_key)
    } else {
        keychain::load_api_key()?
    };

    let Some(api_key) = resolved_api_key else {
        return Ok(ConnectionTestResult::Failure {
            success: false,
            error: "API key is required for translation.".to_string(),
        });
    };

    let client = LlmClient::new(api_key)?;
    let resolved_model = if model.trim().is_empty() {
        DEFAULT_LLM_MODEL.to_string()
    } else {
        model.trim().to_string()
    };

    match client.test_connection(&resolved_model).await {
        Ok(_) => Ok(ConnectionTestResult::Success { success: true }),
        Err(error) => Ok(ConnectionTestResult::Failure {
            success: false,
            error: map_connection_test_error(&error),
        }),
    }
}

fn read_app_settings(connection: &rusqlite::Connection) -> Result<AppSettings, String> {
    let llm_model = connection
        .query_row(
            "SELECT value FROM app_settings WHERE key = ?1",
            params![LLM_MODEL_KEY],
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

    Ok(AppSettings { llm_model })
}

fn map_connection_test_error(error: &TranslateParagraphError) -> String {
    match error {
        TranslateParagraphError::Auth => "Invalid API key.".to_string(),
        TranslateParagraphError::RateLimited { .. } => {
            "Rate limit reached. Please try again.".to_string()
        }
        TranslateParagraphError::Network(_) => {
            "Network error. Check your internet connection and try again.".to_string()
        }
        _ => error.to_string(),
    }
}

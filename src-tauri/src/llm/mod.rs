use std::{
    fs::File,
    io::Read,
    time::{SystemTime, UNIX_EPOCH},
};

use rusqlite::Row;
use serde::{Deserialize, Serialize};

pub mod client;
pub mod worker;

pub const DEFAULT_LLM_MODEL: &str = "google/gemini-2.5-flash-lite-preview";

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct ParagraphLocator {
    pub spine_item_href: String,
    pub paragraph_index: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Translation {
    pub id: String,
    pub book_id: String,
    pub spine_item_href: String,
    pub paragraph_index: i64,
    pub paragraph_hash: String,
    pub original_html: String,
    pub translated_html: String,
    pub target_language: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TranslationJobStatus {
    InProgress,
    Paused,
    Complete,
    Cancelled,
    Failed,
}

impl TranslationJobStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::InProgress => "in_progress",
            Self::Paused => "paused",
            Self::Complete => "complete",
            Self::Cancelled => "cancelled",
            Self::Failed => "failed",
        }
    }

    pub fn from_db(value: &str) -> Result<Self, String> {
        match value {
            "in_progress" => Ok(Self::InProgress),
            "paused" => Ok(Self::Paused),
            "complete" => Ok(Self::Complete),
            "cancelled" => Ok(Self::Cancelled),
            "failed" => Ok(Self::Failed),
            _ => Err(format!("Invalid translation job status: {value}")),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TranslationPauseReason {
    Manual,
    RateLimit,
    Network,
    AppRestart,
}

impl TranslationPauseReason {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Manual => "manual",
            Self::RateLimit => "rate_limit",
            Self::Network => "network",
            Self::AppRestart => "app_restart",
        }
    }

    pub fn from_db(value: &str) -> Result<Self, String> {
        match value {
            "manual" => Ok(Self::Manual),
            "rate_limit" => Ok(Self::RateLimit),
            "network" => Ok(Self::Network),
            "app_restart" => Ok(Self::AppRestart),
            _ => Err(format!("Invalid translation pause reason: {value}")),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslationJob {
    pub id: String,
    pub book_id: String,
    pub target_language: String,
    pub status: TranslationJobStatus,
    pub total_paragraphs: i64,
    pub completed_paragraphs: i64,
    pub failed_paragraph_locators: Vec<ParagraphLocator>,
    pub pause_reason: Option<TranslationPauseReason>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct TranslationProgressEvent {
    pub job_id: String,
    pub completed: i64,
    pub total: i64,
    pub latest_spine_item_href: String,
    pub latest_paragraph_index: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct TranslationCompleteEvent {
    pub job_id: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct TranslationErrorEvent {
    pub job_id: String,
    pub spine_item_href: String,
    pub paragraph_index: i64,
    pub error_message: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct TranslationPausedEvent {
    pub job_id: String,
    pub reason: TranslationPauseReason,
    pub retry_after_secs: Option<u64>,
}

pub fn translation_from_row(row: &Row<'_>) -> rusqlite::Result<Translation> {
    Ok(Translation {
        id: row.get("id")?,
        book_id: row.get("book_id")?,
        spine_item_href: row.get("spine_item_href")?,
        paragraph_index: row.get("paragraph_index")?,
        paragraph_hash: row.get("paragraph_hash")?,
        original_html: row.get("original_html")?,
        translated_html: row.get("translated_html")?,
        target_language: row.get("target_language")?,
        created_at: row.get("created_at")?,
    })
}

pub fn translation_job_from_row(row: &Row<'_>) -> rusqlite::Result<TranslationJob> {
    let failed_paragraph_locators_raw = row.get::<_, String>("failed_paragraph_locators")?;
    let failed_paragraph_locators = serde_json::from_str::<Vec<ParagraphLocator>>(
        &failed_paragraph_locators_raw,
    )
    .map_err(|error| {
        rusqlite::Error::FromSqlConversionFailure(0, rusqlite::types::Type::Text, Box::new(error))
    })?;

    let status =
        TranslationJobStatus::from_db(&row.get::<_, String>("status")?).map_err(|error| {
            rusqlite::Error::FromSqlConversionFailure(
                0,
                rusqlite::types::Type::Text,
                Box::new(std::io::Error::new(std::io::ErrorKind::InvalidData, error)),
            )
        })?;

    let pause_reason = row
        .get::<_, Option<String>>("pause_reason")?
        .map(|value| TranslationPauseReason::from_db(&value))
        .transpose()
        .map_err(|error| {
            rusqlite::Error::FromSqlConversionFailure(
                0,
                rusqlite::types::Type::Text,
                Box::new(std::io::Error::new(std::io::ErrorKind::InvalidData, error)),
            )
        })?;

    Ok(TranslationJob {
        id: row.get("id")?,
        book_id: row.get("book_id")?,
        target_language: row.get("target_language")?,
        status,
        total_paragraphs: row.get("total_paragraphs")?,
        completed_paragraphs: row.get("completed_paragraphs")?,
        failed_paragraph_locators,
        pause_reason,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

pub fn serialize_paragraph_locators(locators: &[ParagraphLocator]) -> Result<String, String> {
    serde_json::to_string(locators).map_err(|error| error.to_string())
}

pub fn generate_uuid_v4() -> std::io::Result<String> {
    let mut random = File::open("/dev/urandom")?;
    let mut bytes = [0_u8; 16];
    random.read_exact(&mut bytes)?;

    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    Ok(format!(
        "{:02x}{:02x}{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}",
        bytes[0],
        bytes[1],
        bytes[2],
        bytes[3],
        bytes[4],
        bytes[5],
        bytes[6],
        bytes[7],
        bytes[8],
        bytes[9],
        bytes[10],
        bytes[11],
        bytes[12],
        bytes[13],
        bytes[14],
        bytes[15],
    ))
}

pub fn now_unix_timestamp() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or_default()
}

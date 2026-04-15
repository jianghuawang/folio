use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::Row;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

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

pub fn repair_common_mojibake(text: &str) -> String {
    if !looks_like_common_mojibake(text) {
        return text.to_string();
    }

    let Some(repaired_text) = decode_windows_1252_as_utf8(text) else {
        return text.to_string();
    };

    if mojibake_score(&repaired_text) < mojibake_score(text) {
        repaired_text
    } else {
        text.to_string()
    }
}

pub fn translation_from_row(row: &Row<'_>) -> rusqlite::Result<Translation> {
    let translated_html = row.get::<_, String>("translated_html")?;

    Ok(Translation {
        id: row.get("id")?,
        book_id: row.get("book_id")?,
        spine_item_href: row.get("spine_item_href")?,
        paragraph_index: row.get("paragraph_index")?,
        paragraph_hash: row.get("paragraph_hash")?,
        original_html: row.get("original_html")?,
        translated_html: repair_common_mojibake(&translated_html),
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
    Ok(Uuid::new_v4().to_string())
}

pub fn now_unix_timestamp() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or_default()
}

fn decode_windows_1252_as_utf8(text: &str) -> Option<String> {
    let mut bytes = Vec::with_capacity(text.len());

    for character in text.chars() {
        bytes.push(windows_1252_byte_from_char(character)?);
    }

    String::from_utf8(bytes).ok()
}

fn windows_1252_byte_from_char(character: char) -> Option<u8> {
    match character {
        '\u{0000}'..='\u{00FF}' => Some(character as u8),
        '\u{20AC}' => Some(0x80),
        '\u{201A}' => Some(0x82),
        '\u{0192}' => Some(0x83),
        '\u{201E}' => Some(0x84),
        '\u{2026}' => Some(0x85),
        '\u{2020}' => Some(0x86),
        '\u{2021}' => Some(0x87),
        '\u{02C6}' => Some(0x88),
        '\u{2030}' => Some(0x89),
        '\u{0160}' => Some(0x8A),
        '\u{2039}' => Some(0x8B),
        '\u{0152}' => Some(0x8C),
        '\u{017D}' => Some(0x8E),
        '\u{2018}' => Some(0x91),
        '\u{2019}' => Some(0x92),
        '\u{201C}' => Some(0x93),
        '\u{201D}' => Some(0x94),
        '\u{2022}' => Some(0x95),
        '\u{2013}' => Some(0x96),
        '\u{2014}' => Some(0x97),
        '\u{02DC}' => Some(0x98),
        '\u{2122}' => Some(0x99),
        '\u{0161}' => Some(0x9A),
        '\u{203A}' => Some(0x9B),
        '\u{0153}' => Some(0x9C),
        '\u{017E}' => Some(0x9E),
        '\u{0178}' => Some(0x9F),
        _ => None,
    }
}

fn looks_like_common_mojibake(text: &str) -> bool {
    text.chars().any(|character| {
        matches!(
            character,
            'â' | 'Ã' | '€' | 'œ' | 'Ÿ' | 'ž' | '™' | '\u{FFFD}'
        ) || ('\u{0080}'..='\u{009F}').contains(&character)
    })
}

fn mojibake_score(text: &str) -> usize {
    text.chars()
        .filter(|character| {
            matches!(
                character,
                'â' | 'Ã' | '€' | 'œ' | 'Ÿ' | 'ž' | '™' | '\u{FFFD}'
            ) || ('\u{0080}'..='\u{009F}').contains(character)
        })
        .count()
}

#[cfg(test)]
mod tests {
    use super::repair_common_mojibake;

    #[test]
    fn repairs_common_windows_1252_mojibake_sequences() {
        let input =
            "â\u{0080}\u{009c}Oh, Govinda!â\u{0080}\u{009d} he said softlyâ\u{0080}\u{0094}soon.";

        assert_eq!(
            repair_common_mojibake(input),
            "“Oh, Govinda!” he said softly—soon."
        );
    }

    #[test]
    fn leaves_clean_text_unchanged() {
        let input = "Dedicated to my beloved friend Romain Rolland";

        assert_eq!(repair_common_mojibake(input), input);
    }
}

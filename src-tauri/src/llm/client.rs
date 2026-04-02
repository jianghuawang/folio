use std::{collections::HashSet, time::Duration};

use quick_xml::{
    events::{BytesEnd, BytesStart, Event},
    Reader, Writer,
};
use reqwest::{header, Client, StatusCode};
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::llm::DEFAULT_LLM_MODEL;

const OPENROUTER_API_URL: &str = "https://openrouter.ai/api/v1/chat/completions";
const HTTP_REFERER: &str = "https://folio.app";
const X_TITLE: &str = "Folio";
const SAFE_INLINE_TAGS: [&str; 10] = [
    "em", "strong", "b", "i", "u", "span", "br", "sup", "sub", "code",
];

#[derive(Debug)]
pub enum TranslateParagraphError {
    Auth,
    RateLimited { retry_after_secs: u64 },
    Network(String),
    InvalidResponse(String),
    Request(String),
    Sanitization(String),
}

impl std::fmt::Display for TranslateParagraphError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Auth => formatter.write_str("Invalid API key."),
            Self::RateLimited { retry_after_secs } => {
                write!(formatter, "Rate limit reached. Retry after {retry_after_secs} seconds.")
            }
            Self::Network(message) => formatter.write_str(message),
            Self::InvalidResponse(message)
            | Self::Request(message)
            | Self::Sanitization(message) => formatter.write_str(message),
        }
    }
}

impl std::error::Error for TranslateParagraphError {}

#[derive(Clone)]
pub struct LlmClient {
    api_key: String,
    client: Client,
}

impl LlmClient {
    pub fn new(api_key: String) -> Result<Self, String> {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .map_err(|error| error.to_string())?;

        Ok(Self { api_key, client })
    }

    pub async fn translate_paragraph(
        &self,
        paragraph_html: &str,
        target_language: &str,
        model: &str,
    ) -> Result<String, TranslateParagraphError> {
        let resolved_model = if model.trim().is_empty() {
            DEFAULT_LLM_MODEL
        } else {
            model.trim()
        };

        let response = self
            .client
            .post(OPENROUTER_API_URL)
            .header(header::AUTHORIZATION, format!("Bearer {}", self.api_key))
            .header(header::CONTENT_TYPE, "application/json")
            .header("HTTP-Referer", HTTP_REFERER)
            .header("X-Title", X_TITLE)
            .json(&json!({
                "model": resolved_model,
                "messages": [{
                    "role": "user",
                    "content": format!(
                        "Translate the following text to {target_language}. Preserve only the existing inline HTML formatting tags. Return only the translated HTML fragment, no explanation.\n\n{paragraph_html}"
                    )
                }],
                "max_tokens": 2048
            }))
            .send()
            .await
            .map_err(map_request_error)?;

        if matches!(
            response.status(),
            StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN
        ) {
            return Err(TranslateParagraphError::Auth);
        }

        if response.status() == StatusCode::TOO_MANY_REQUESTS {
            let retry_after_secs = response
                .headers()
                .get(header::RETRY_AFTER)
                .and_then(|value| value.to_str().ok())
                .and_then(|value| value.parse::<u64>().ok())
                .unwrap_or(30);

            return Err(TranslateParagraphError::RateLimited { retry_after_secs });
        }

        if !response.status().is_success() {
            return Err(TranslateParagraphError::Request(format!(
                "OpenRouter request failed with status {}.",
                response.status()
            )));
        }

        let payload = response
            .json::<OpenRouterResponse>()
            .await
            .map_err(|error| TranslateParagraphError::InvalidResponse(error.to_string()))?;
        let translated_fragment = payload
            .choices
            .into_iter()
            .next()
            .and_then(|choice| choice.message.content.into_text())
            .map(|content| content.trim().to_string())
            .filter(|content| !content.is_empty())
            .ok_or_else(|| {
                TranslateParagraphError::InvalidResponse(
                    "OpenRouter response did not contain translated content.".to_string(),
                )
            })?;

        sanitize_translated_html(paragraph_html, &translated_fragment)
    }
}

fn map_request_error(error: reqwest::Error) -> TranslateParagraphError {
    if error.is_connect() || error.is_timeout() {
        return TranslateParagraphError::Network(
            "Network error. Check your internet connection and try again.".to_string(),
        );
    }

    TranslateParagraphError::Request(error.to_string())
}

fn sanitize_translated_html(
    original_html: &str,
    translated_html: &str,
) -> Result<String, TranslateParagraphError> {
    let mut allowed_tags = collect_source_inline_tags(original_html);
    allowed_tags.extend(SAFE_INLINE_TAGS.iter().map(|tag| (*tag).to_string()));

    let wrapped_fragment = format!("<folio-root>{translated_html}</folio-root>");
    let mut reader = Reader::from_str(&wrapped_fragment);
    reader.config_mut().trim_text(false);
    let mut writer = Writer::new(Vec::new());
    let mut buffer = Vec::new();

    loop {
        match reader
            .read_event_into(&mut buffer)
            .map_err(|error| TranslateParagraphError::Sanitization(error.to_string()))?
        {
            Event::Start(event) => {
                let name = decode_name(event.name().as_ref())?;
                if name == "folio-root" {
                    buffer.clear();
                    continue;
                }

                if !allowed_tags.contains(&name) {
                    return Err(TranslateParagraphError::Sanitization(format!(
                        "Disallowed HTML tag in translated fragment: {name}"
                    )));
                }

                writer
                    .write_event(Event::Start(BytesStart::new(name.as_str())))
                    .map_err(|error| TranslateParagraphError::Sanitization(error.to_string()))?;
            }
            Event::Empty(event) => {
                let name = decode_name(event.name().as_ref())?;
                if name == "folio-root" {
                    buffer.clear();
                    continue;
                }

                if !allowed_tags.contains(&name) {
                    return Err(TranslateParagraphError::Sanitization(format!(
                        "Disallowed HTML tag in translated fragment: {name}"
                    )));
                }

                writer
                    .write_event(Event::Empty(BytesStart::new(name.as_str())))
                    .map_err(|error| TranslateParagraphError::Sanitization(error.to_string()))?;
            }
            Event::End(event) => {
                let name = decode_name(event.name().as_ref())?;
                if name == "folio-root" {
                    break;
                }

                writer
                    .write_event(Event::End(BytesEnd::new(name.as_str())))
                    .map_err(|error| TranslateParagraphError::Sanitization(error.to_string()))?;
            }
            Event::Text(event) => {
                writer
                    .write_event(Event::Text(event.into_owned()))
                    .map_err(|error| TranslateParagraphError::Sanitization(error.to_string()))?;
            }
            Event::CData(event) => {
                writer
                    .write_event(Event::CData(event.into_owned()))
                    .map_err(|error| TranslateParagraphError::Sanitization(error.to_string()))?;
            }
            Event::Comment(_) | Event::Decl(_) | Event::PI(_) | Event::DocType(_) => {}
            Event::Eof => break,
        }

        buffer.clear();
    }

    String::from_utf8(writer.into_inner())
        .map_err(|error| TranslateParagraphError::Sanitization(error.to_string()))
}

fn collect_source_inline_tags(fragment: &str) -> HashSet<String> {
    let wrapped_fragment = format!("<folio-root>{fragment}</folio-root>");
    let mut reader = Reader::from_str(&wrapped_fragment);
    reader.config_mut().trim_text(false);
    let mut buffer = Vec::new();
    let mut tags = HashSet::new();

    loop {
        match reader.read_event_into(&mut buffer) {
            Ok(Event::Start(event)) | Ok(Event::Empty(event)) => {
                if let Ok(name) = decode_name(event.name().as_ref()) {
                    if name != "folio-root" {
                        tags.insert(name);
                    }
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }

        buffer.clear();
    }

    tags
}

fn decode_name(raw_name: &[u8]) -> Result<String, TranslateParagraphError> {
    std::str::from_utf8(raw_name)
        .map(|name| name.to_ascii_lowercase())
        .map_err(|error| TranslateParagraphError::Sanitization(error.to_string()))
}

#[derive(Debug, Deserialize)]
struct OpenRouterResponse {
    choices: Vec<OpenRouterChoice>,
}

#[derive(Debug, Deserialize)]
struct OpenRouterChoice {
    message: OpenRouterMessage,
}

#[derive(Debug, Deserialize)]
struct OpenRouterMessage {
    content: OpenRouterMessageContent,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum OpenRouterMessageContent {
    Text(String),
    Parts(Vec<OpenRouterMessagePart>),
}

impl OpenRouterMessageContent {
    fn into_text(self) -> Option<String> {
        match self {
            Self::Text(value) => Some(value),
            Self::Parts(parts) => {
                let text = parts
                    .into_iter()
                    .filter_map(|part| part.text)
                    .collect::<Vec<_>>()
                    .join("");

                if text.is_empty() {
                    None
                } else {
                    Some(text)
                }
            }
        }
    }
}

#[derive(Debug, Deserialize, Serialize)]
struct OpenRouterMessagePart {
    text: Option<String>,
}

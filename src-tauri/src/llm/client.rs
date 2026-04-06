use std::{
    collections::{HashMap, HashSet},
    time::Duration,
};

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
const CHUNK_TRANSLATION_SYSTEM_PROMPT: &str = "Translate EPUB paragraph batches. Return only a JSON array. Each array item must be {\"paragraph_index\": number, \"translated_html\": string}. Preserve the existing inline HTML formatting tags inside each translated_html value and do not add wrapper elements or commentary.";
const SAFE_INLINE_TAGS: [&str; 10] = [
    "em", "strong", "b", "i", "u", "span", "br", "sup", "sub", "code",
];
const SOURCE_INLINE_TAGS: [&str; 23] = [
    "a", "abbr", "b", "bdi", "bdo", "br", "cite", "code", "dfn", "em", "i", "img", "kbd", "mark",
    "q", "rp", "rt", "ruby", "s", "small", "span", "strong", "u",
];
const WRAPPER_TAGS: [&str; 7] = [
    "html",
    "body",
    "section",
    "article",
    "div",
    "blockquote",
    "p",
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
                write!(
                    formatter,
                    "Rate limit reached. Retry after {retry_after_secs} seconds."
                )
            }
            Self::Network(message) => formatter.write_str(message),
            Self::InvalidResponse(message)
            | Self::Request(message)
            | Self::Sanitization(message) => formatter.write_str(message),
        }
    }
}

impl std::error::Error for TranslateParagraphError {}

#[derive(Debug, Clone, Copy)]
pub struct TranslationChunkParagraph<'a> {
    pub paragraph_index: i64,
    pub original_html: &'a str,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TranslatedChunkParagraph {
    pub paragraph_index: i64,
    pub translated_html: String,
}

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

    pub async fn translate_chunk(
        &self,
        paragraphs: &[TranslationChunkParagraph<'_>],
        target_language: &str,
        model: &str,
    ) -> Result<Vec<TranslatedChunkParagraph>, TranslateParagraphError> {
        if paragraphs.is_empty() {
            return Ok(Vec::new());
        }

        let response_text = self
            .request_translation_chunk(paragraphs, target_language, model)
            .await?;

        parse_translated_chunk_response(paragraphs, &response_text)
    }

    pub async fn test_connection(&self, model: &str) -> Result<(), TranslateParagraphError> {
        let _ = self
            .translate_chunk(
                &[TranslationChunkParagraph {
                    paragraph_index: 0,
                    original_html: "Hello",
                }],
                "English",
                model,
            )
            .await?;

        Ok(())
    }

    async fn request_translation_chunk(
        &self,
        paragraphs: &[TranslationChunkParagraph<'_>],
        target_language: &str,
        model: &str,
    ) -> Result<String, TranslateParagraphError> {
        let resolved_model = if model.trim().is_empty() {
            DEFAULT_LLM_MODEL
        } else {
            model.trim()
        };

        let user_payload = serde_json::to_string(&TranslationChunkUserPayload {
            target_language,
            paragraphs: paragraphs
                .iter()
                .map(|paragraph| TranslationChunkUserParagraph {
                    paragraph_index: paragraph.paragraph_index,
                    html: paragraph.original_html,
                })
                .collect::<Vec<_>>(),
        })
        .map_err(|error| TranslateParagraphError::Request(error.to_string()))?;

        let response = self
            .client
            .post(OPENROUTER_API_URL)
            .header(header::AUTHORIZATION, format!("Bearer {}", self.api_key))
            .header(header::CONTENT_TYPE, "application/json")
            .header("HTTP-Referer", HTTP_REFERER)
            .header("X-Title", X_TITLE)
            .json(&json!({
                "model": resolved_model,
                "messages": [
                    {
                        "role": "system",
                        "content": CHUNK_TRANSLATION_SYSTEM_PROMPT,
                    },
                    {
                        "role": "user",
                        "content": user_payload,
                    }
                ],
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

        payload
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
            })
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

fn parse_translated_chunk_response(
    paragraphs: &[TranslationChunkParagraph<'_>],
    response_text: &str,
) -> Result<Vec<TranslatedChunkParagraph>, TranslateParagraphError> {
    let normalized_response = normalize_structured_response_text(response_text);
    let translated_items =
        serde_json::from_str::<Vec<StructuredChunkTranslationItem>>(&normalized_response)
            .map_err(|error| TranslateParagraphError::InvalidResponse(error.to_string()))?;

    if translated_items.len() != paragraphs.len() {
        return Err(TranslateParagraphError::InvalidResponse(format!(
            "Structured response length mismatch. Expected {} items, received {}.",
            paragraphs.len(),
            translated_items.len()
        )));
    }

    let mut translations_by_index = HashMap::with_capacity(translated_items.len());
    for translated_item in translated_items {
        let translated_html = translated_item.translated_html.trim().to_string();
        if translated_html.is_empty() {
            return Err(TranslateParagraphError::InvalidResponse(format!(
                "Structured response included an empty translated_html for paragraph {}.",
                translated_item.paragraph_index
            )));
        }

        if translations_by_index
            .insert(translated_item.paragraph_index, translated_html)
            .is_some()
        {
            return Err(TranslateParagraphError::InvalidResponse(format!(
                "Structured response included duplicate paragraph_index {}.",
                translated_item.paragraph_index
            )));
        }
    }

    let mut sanitized_translations = Vec::with_capacity(paragraphs.len());

    for paragraph in paragraphs {
        let translated_html = translations_by_index
            .remove(&paragraph.paragraph_index)
            .ok_or_else(|| {
                TranslateParagraphError::InvalidResponse(format!(
                    "Structured response did not include paragraph_index {}.",
                    paragraph.paragraph_index
                ))
            })?;
        let sanitized_html = sanitize_translated_html(paragraph.original_html, &translated_html)
            .map_err(|error| match error {
                TranslateParagraphError::Sanitization(message) => {
                    TranslateParagraphError::Sanitization(format!(
                        "Paragraph {}: {message}",
                        paragraph.paragraph_index
                    ))
                }
                other => other,
            })?;

        sanitized_translations.push(TranslatedChunkParagraph {
            paragraph_index: paragraph.paragraph_index,
            translated_html: sanitized_html,
        });
    }

    if !translations_by_index.is_empty() {
        let unexpected_indexes = translations_by_index.keys().copied().collect::<Vec<_>>();
        return Err(TranslateParagraphError::InvalidResponse(format!(
            "Structured response included unexpected paragraph indexes: {:?}.",
            unexpected_indexes
        )));
    }

    Ok(sanitized_translations)
}

fn sanitize_translated_html(
    original_html: &str,
    translated_html: &str,
) -> Result<String, TranslateParagraphError> {
    let normalized_fragment = normalize_translated_fragment(translated_html);
    let mut allowed_tags = collect_source_inline_tags(original_html);
    allowed_tags.extend(SAFE_INLINE_TAGS.iter().map(|tag| (*tag).to_string()));

    let wrapped_fragment = format!("<folio-root>{normalized_fragment}</folio-root>");
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
                    if name != "folio-root" && SOURCE_INLINE_TAGS.contains(&name.as_str()) {
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

fn normalize_structured_response_text(response_text: &str) -> String {
    strip_code_fences(response_text.trim().trim_start_matches('\u{feff}'))
        .trim()
        .to_string()
}

fn normalize_translated_fragment(fragment: &str) -> String {
    let mut normalized = fragment
        .trim()
        .trim_start_matches('\u{feff}')
        .trim()
        .to_string();

    normalized = strip_code_fences(&normalized);
    normalized = strip_xml_declaration(&normalized);
    normalized = replace_html_entities(&normalized);
    normalized = normalize_void_tags(&normalized);

    loop {
        let next = unwrap_single_wrapper_tag(&normalized).unwrap_or(normalized.clone());
        if next == normalized {
            break;
        }
        normalized = next;
    }

    normalized.trim().to_string()
}

fn strip_code_fences(fragment: &str) -> String {
    let trimmed = fragment.trim();
    if !trimmed.starts_with("```") || !trimmed.ends_with("```") {
        return trimmed.to_string();
    }

    let inner = &trimmed[3..trimmed.len() - 3];
    let inner = inner.trim();

    if let Some(newline_index) = inner.find('\n') {
        let first_line = inner[..newline_index].trim();
        if !first_line.is_empty()
            && first_line.chars().all(|character| {
                character.is_ascii_alphanumeric() || character == '-' || character == '_'
            })
        {
            return inner[newline_index + 1..].trim().to_string();
        }
    }

    inner.to_string()
}

fn strip_xml_declaration(fragment: &str) -> String {
    let trimmed = fragment.trim_start();
    if !trimmed.starts_with("<?xml") {
        return trimmed.to_string();
    }

    trimmed
        .find("?>")
        .map(|index| trimmed[index + 2..].trim().to_string())
        .unwrap_or_else(|| trimmed.to_string())
}

fn replace_html_entities(fragment: &str) -> String {
    [
        ("&nbsp;", "&#160;"),
        ("&ensp;", "&#8194;"),
        ("&emsp;", "&#8195;"),
        ("&thinsp;", "&#8201;"),
        ("&hellip;", "&#8230;"),
        ("&mdash;", "&#8212;"),
        ("&ndash;", "&#8211;"),
        ("&ldquo;", "&#8220;"),
        ("&rdquo;", "&#8221;"),
        ("&lsquo;", "&#8216;"),
        ("&rsquo;", "&#8217;"),
        ("&bull;", "&#8226;"),
        ("&middot;", "&#183;"),
        ("&copy;", "&#169;"),
        ("&reg;", "&#174;"),
        ("&trade;", "&#8482;"),
    ]
    .into_iter()
    .fold(fragment.to_string(), |current, (from, to)| {
        current.replace(from, to)
    })
}

fn normalize_void_tags(fragment: &str) -> String {
    let mut normalized = String::with_capacity(fragment.len());
    let bytes = fragment.as_bytes();
    let mut index = 0;

    while index < bytes.len() {
        if bytes[index] != b'<' {
            normalized.push(bytes[index] as char);
            index += 1;
            continue;
        }

        let Some(tag_end) = fragment[index..].find('>') else {
            normalized.push_str(&fragment[index..]);
            break;
        };
        let tag_end = index + tag_end;
        let raw_tag = &fragment[index..=tag_end];
        let trimmed_tag = raw_tag.trim();
        let is_closing_tag = trimmed_tag.starts_with("</");
        let is_processing_tag = trimmed_tag.starts_with("<?") || trimmed_tag.starts_with("<!");
        let is_self_closing = trimmed_tag.ends_with("/>");

        if is_closing_tag || is_processing_tag || is_self_closing {
            normalized.push_str(raw_tag);
            index = tag_end + 1;
            continue;
        }

        let tag_name_start = if trimmed_tag.starts_with('<') { 1 } else { 0 };
        let tag_name = trimmed_tag[tag_name_start..]
            .split(|character: char| character.is_whitespace() || character == '>')
            .next()
            .unwrap_or_default()
            .trim_matches('/');
        let lower_tag_name = tag_name.to_ascii_lowercase();

        if matches!(lower_tag_name.as_str(), "br" | "img" | "hr" | "wbr") {
            let body = raw_tag[..raw_tag.len() - 1].trim_end();
            normalized.push_str(body);
            normalized.push_str(" />");
        } else {
            normalized.push_str(raw_tag);
        }

        index = tag_end + 1;
    }

    normalized
}

fn unwrap_single_wrapper_tag(fragment: &str) -> Option<String> {
    let trimmed = fragment.trim();
    let wrapped = format!("<folio-root>{trimmed}</folio-root>");
    let mut reader = Reader::from_str(&wrapped);
    reader.config_mut().trim_text(false);
    let mut buffer = Vec::new();
    let mut top_level_tag_name: Option<String> = None;
    let mut top_level_count = 0_u32;
    let mut root_depth = 0_u32;
    let mut nested_depth = 0_u32;

    loop {
        match reader.read_event_into(&mut buffer).ok()? {
            Event::Start(event) => {
                let name = decode_name(event.name().as_ref()).ok()?;
                if name == "folio-root" {
                    root_depth += 1;
                } else if root_depth == 1 {
                    if nested_depth == 0 {
                        top_level_count += 1;
                        if top_level_count == 1 {
                            top_level_tag_name = Some(name);
                        }
                    }
                    nested_depth += 1;
                }
            }
            Event::Empty(event) => {
                let name = decode_name(event.name().as_ref()).ok()?;
                if name != "folio-root" && root_depth == 1 && nested_depth == 0 {
                    top_level_count += 1;
                    if top_level_count == 1 {
                        top_level_tag_name = Some(name);
                    }
                }
            }
            Event::End(event) => {
                let name = decode_name(event.name().as_ref()).ok()?;
                if name == "folio-root" {
                    break;
                }

                if root_depth == 1 && nested_depth > 0 {
                    nested_depth -= 1;
                }
            }
            Event::Text(event) => {
                if root_depth == 1 && nested_depth == 0 && !event.unescape().ok()?.trim().is_empty()
                {
                    return None;
                }
            }
            Event::Eof => break,
            Event::Comment(_)
            | Event::Decl(_)
            | Event::PI(_)
            | Event::DocType(_)
            | Event::CData(_) => {}
        }

        buffer.clear();
    }

    let top_level_tag_name = top_level_tag_name?;
    if top_level_count != 1 || !WRAPPER_TAGS.contains(&top_level_tag_name.as_str()) {
        return None;
    }

    let open_tag_end = trimmed.find('>')?;
    let close_tag = format!("</{top_level_tag_name}>");
    let close_tag_start = trimmed.rfind(&close_tag)?;
    Some(
        trimmed[open_tag_end + 1..close_tag_start]
            .trim()
            .to_string(),
    )
}

#[derive(Debug, Serialize)]
struct TranslationChunkUserPayload<'a> {
    target_language: &'a str,
    paragraphs: Vec<TranslationChunkUserParagraph<'a>>,
}

#[derive(Debug, Serialize)]
struct TranslationChunkUserParagraph<'a> {
    paragraph_index: i64,
    html: &'a str,
}

#[derive(Debug, Deserialize)]
struct StructuredChunkTranslationItem {
    paragraph_index: i64,
    translated_html: String,
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

#[cfg(test)]
mod tests {
    use super::{
        parse_translated_chunk_response, sanitize_translated_html, TranslationChunkParagraph,
    };

    #[test]
    fn sanitization_accepts_plain_text() {
        let sanitized = sanitize_translated_html("hello", "bonjour").unwrap();
        assert_eq!(sanitized, "bonjour");
    }

    #[test]
    fn sanitization_unwraps_wrapped_paragraphs() {
        let sanitized = sanitize_translated_html(
            "hello <span>world</span>",
            "<p>bonjour <span>monde</span></p>",
        )
        .unwrap();

        assert_eq!(sanitized, "bonjour <span>monde</span>");
    }

    #[test]
    fn sanitization_strips_code_fences_and_normalizes_entities() {
        let sanitized =
            sanitize_translated_html("hello<br/>world", "```html\nhello&nbsp;<br>world\n```")
                .unwrap();

        assert_eq!(sanitized, "hello&#160;<br/>world");
    }

    #[test]
    fn chunk_response_parses_structured_array_in_input_order() {
        let translated = parse_translated_chunk_response(
            &[
                TranslationChunkParagraph {
                    paragraph_index: 7,
                    original_html: "hello",
                },
                TranslationChunkParagraph {
                    paragraph_index: 8,
                    original_html: "world",
                },
            ],
            r#"[{"paragraph_index":8,"translated_html":"monde"},{"paragraph_index":7,"translated_html":"bonjour"}]"#,
        )
        .unwrap();

        assert_eq!(translated[0].paragraph_index, 7);
        assert_eq!(translated[0].translated_html, "bonjour");
        assert_eq!(translated[1].paragraph_index, 8);
        assert_eq!(translated[1].translated_html, "monde");
    }

    #[test]
    fn chunk_response_strips_json_code_fences() {
        let translated = parse_translated_chunk_response(
            &[TranslationChunkParagraph {
                paragraph_index: 0,
                original_html: "hello<br/>world",
            }],
            "```json\n[{\"paragraph_index\":0,\"translated_html\":\"hello&nbsp;<br>world\"}]\n```",
        )
        .unwrap();

        assert_eq!(translated[0].translated_html, "hello&#160;<br/>world");
    }

    #[test]
    fn chunk_response_rejects_missing_items() {
        let error = parse_translated_chunk_response(
            &[
                TranslationChunkParagraph {
                    paragraph_index: 1,
                    original_html: "one",
                },
                TranslationChunkParagraph {
                    paragraph_index: 2,
                    original_html: "two",
                },
            ],
            r#"[{"paragraph_index":1,"translated_html":"uno"}]"#,
        )
        .unwrap_err();

        assert!(error.to_string().contains("length mismatch"));
    }
}

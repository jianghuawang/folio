use std::{
    collections::{HashMap, HashSet},
    fs::File,
    io::Read,
    path::{Component, Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex, OnceLock,
    },
    time::Duration,
};

use minidom::Element;
use quick_xml::{events::Event, Reader};
use rusqlite::{params, OptionalExtension};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter, Manager};
use tokio::{task::JoinHandle, time::sleep};
use zip::ZipArchive;

use crate::{
    db::AppState,
    llm::{
        client::{LlmClient, TranslateParagraphError},
        generate_uuid_v4, now_unix_timestamp, serialize_paragraph_locators, ParagraphLocator,
        TranslationCompleteEvent, TranslationErrorEvent, TranslationJob, TranslationJobStatus,
        TranslationPausedEvent, TranslationPauseReason, TranslationProgressEvent,
    },
};

const CONTAINER_PATH: &str = "META-INF/container.xml";
const PACKAGE_NS: &str = "http://www.idpf.org/2007/opf";
const NETWORK_RETRY_DELAY_SECS: u64 = 5;

#[derive(Clone)]
struct JobControl {
    cancel: Arc<AtomicBool>,
    pause: Arc<AtomicBool>,
}

#[derive(Clone)]
pub enum WorkerMode {
    PendingMissing,
    Specific(Vec<ParagraphLocator>),
}

#[derive(Debug, Clone)]
struct ParagraphWorkItem {
    locator: ParagraphLocator,
    original_html: String,
    paragraph_hash: String,
}

#[derive(Debug, Clone)]
struct SpineItem {
    href: String,
    resolved_path: String,
    media_type: Option<String>,
}

static JOB_CONTROLS: OnceLock<Mutex<HashMap<String, JobControl>>> = OnceLock::new();

pub fn pause_job(job_id: &str) -> bool {
    with_job_control(job_id, |control| {
        control.pause.store(true, Ordering::SeqCst);
    })
}

pub fn resume_job(job_id: &str) -> bool {
    with_job_control(job_id, |control| {
        control.pause.store(false, Ordering::SeqCst);
    })
}

pub fn cancel_job(job_id: &str) -> bool {
    with_job_control(job_id, |control| {
        control.cancel.store(true, Ordering::SeqCst);
        control.pause.store(false, Ordering::SeqCst);
    })
}

pub fn count_paragraphs(file_path: &str) -> Result<i64, String> {
    Ok(load_paragraph_work_items(file_path)?.len() as i64)
}

pub fn spawn_translation_worker(
    app_handle: AppHandle,
    job: TranslationJob,
    book_file_path: String,
    model: String,
    api_key: String,
    mode: WorkerMode,
) -> JoinHandle<()> {
    let control = ensure_job_control(&job.id);
    control.cancel.store(false, Ordering::SeqCst);
    control.pause.store(false, Ordering::SeqCst);

    tokio::spawn(async move {
        let job_id = job.id.clone();
        let result =
            run_translation_worker(app_handle.clone(), control, job, book_file_path, model, api_key, mode).await;

        if let Err(error) = result {
            let _ = mark_job_failed(&app_handle, &job_id);
            let _ = app_handle.emit(
                "translation:error",
                TranslationErrorEvent {
                    job_id: job_id.clone(),
                    spine_item_href: String::new(),
                    paragraph_index: -1,
                    error_message: error,
                },
            );
        }

        clear_job_control(&job_id);
    })
}

async fn run_translation_worker(
    app_handle: AppHandle,
    control: JobControl,
    job: TranslationJob,
    book_file_path: String,
    model: String,
    api_key: String,
    mode: WorkerMode,
) -> Result<(), String> {
    let client = LlmClient::new(api_key)?;
    let mut completed_paragraphs = job.completed_paragraphs;
    let all_work_items = load_paragraph_work_items(&book_file_path)?;
    let existing_locators =
        load_existing_translation_locators(&app_handle, &job.book_id, &job.target_language)?;

    let selected_locators = match mode {
        WorkerMode::PendingMissing => None,
        WorkerMode::Specific(locators) => Some(locators.into_iter().collect::<HashSet<_>>()),
    };

    let pending_work_items = all_work_items
        .into_iter()
        .filter(|work_item| {
            if let Some(selected_locators) = &selected_locators {
                selected_locators.contains(&work_item.locator)
            } else {
                !existing_locators.contains(&work_item.locator)
            }
        })
        .collect::<Vec<_>>();

    for work_item in pending_work_items {
        if control.cancel.load(Ordering::SeqCst) {
            return Ok(());
        }

        wait_while_paused(&control).await;
        if control.cancel.load(Ordering::SeqCst) {
            return Ok(());
        }

        let mut attempts = 0;

        loop {
            if control.cancel.load(Ordering::SeqCst) {
                return Ok(());
            }

            match client
                .translate_paragraph(
                    &work_item.original_html,
                    &job.target_language,
                    &model,
                )
                .await
            {
                Ok(translated_html) => {
                    persist_translation(
                        &app_handle,
                        &job.book_id,
                        &job.target_language,
                        &work_item,
                        &translated_html,
                    )?;
                    completed_paragraphs += 1;
                    update_completed_paragraphs(&app_handle, &job.id, completed_paragraphs)?;
                    remove_failed_locator(&app_handle, &job.id, &work_item.locator)?;
                    app_handle
                        .emit(
                            "translation:progress",
                            TranslationProgressEvent {
                                job_id: job.id.clone(),
                                completed: completed_paragraphs,
                                total: job.total_paragraphs,
                                latest_spine_item_href: work_item.locator.spine_item_href.clone(),
                                latest_paragraph_index: work_item.locator.paragraph_index,
                            },
                        )
                        .map_err(|error| error.to_string())?;
                    break;
                }
                Err(TranslateParagraphError::RateLimited { retry_after_secs }) => {
                    update_job_status(
                        &app_handle,
                        &job.id,
                        TranslationJobStatus::Paused,
                        Some(TranslationPauseReason::RateLimit),
                    )?;
                    app_handle
                        .emit(
                            "translation:paused",
                            TranslationPausedEvent {
                                job_id: job.id.clone(),
                                reason: TranslationPauseReason::RateLimit,
                                retry_after_secs: Some(retry_after_secs),
                            },
                        )
                        .map_err(|error| error.to_string())?;
                    sleep(Duration::from_secs(retry_after_secs)).await;
                    wait_while_paused(&control).await;
                    if control.cancel.load(Ordering::SeqCst) {
                        return Ok(());
                    }
                    update_job_status(
                        &app_handle,
                        &job.id,
                        TranslationJobStatus::InProgress,
                        None,
                    )?;
                }
                Err(TranslateParagraphError::Network(_)) => {
                    update_job_status(
                        &app_handle,
                        &job.id,
                        TranslationJobStatus::Paused,
                        Some(TranslationPauseReason::Network),
                    )?;
                    app_handle
                        .emit(
                            "translation:paused",
                            TranslationPausedEvent {
                                job_id: job.id.clone(),
                                reason: TranslationPauseReason::Network,
                                retry_after_secs: None,
                            },
                        )
                        .map_err(|error| error.to_string())?;
                    sleep(Duration::from_secs(NETWORK_RETRY_DELAY_SECS)).await;
                    wait_while_paused(&control).await;
                    if control.cancel.load(Ordering::SeqCst) {
                        return Ok(());
                    }
                    update_job_status(
                        &app_handle,
                        &job.id,
                        TranslationJobStatus::InProgress,
                        None,
                    )?;
                }
                Err(TranslateParagraphError::Auth) => {
                    append_failed_locator(&app_handle, &job.id, &work_item.locator)?;
                    app_handle
                        .emit(
                            "translation:error",
                            TranslationErrorEvent {
                                job_id: job.id.clone(),
                                spine_item_href: work_item.locator.spine_item_href.clone(),
                                paragraph_index: work_item.locator.paragraph_index,
                                error_message: "Invalid API key.".to_string(),
                            },
                        )
                        .map_err(|error| error.to_string())?;
                    mark_job_failed(&app_handle, &job.id)?;
                    return Ok(());
                }
                Err(error) => {
                    if attempts == 0 {
                        attempts += 1;
                        sleep(Duration::from_secs(1)).await;
                        continue;
                    }

                    append_failed_locator(&app_handle, &job.id, &work_item.locator)?;
                    app_handle
                        .emit(
                            "translation:error",
                            TranslationErrorEvent {
                                job_id: job.id.clone(),
                                spine_item_href: work_item.locator.spine_item_href.clone(),
                                paragraph_index: work_item.locator.paragraph_index,
                                error_message: error.to_string(),
                            },
                        )
                        .map_err(|event_error| event_error.to_string())?;
                    break;
                }
            }
        }
    }

    if control.cancel.load(Ordering::SeqCst) {
        return Ok(());
    }

    update_job_status(
        &app_handle,
        &job.id,
        TranslationJobStatus::Complete,
        None,
    )?;
    app_handle
        .emit(
            "translation:complete",
            TranslationCompleteEvent {
                job_id: job.id.clone(),
            },
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}

async fn wait_while_paused(control: &JobControl) {
    while control.pause.load(Ordering::SeqCst) && !control.cancel.load(Ordering::SeqCst) {
        sleep(Duration::from_millis(250)).await;
    }
}

fn job_controls() -> &'static Mutex<HashMap<String, JobControl>> {
    JOB_CONTROLS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn ensure_job_control(job_id: &str) -> JobControl {
    let mut controls = job_controls()
        .lock()
        .expect("translation job controls poisoned");

    controls
        .entry(job_id.to_string())
        .or_insert_with(|| JobControl {
            cancel: Arc::new(AtomicBool::new(false)),
            pause: Arc::new(AtomicBool::new(false)),
        })
        .clone()
}

fn clear_job_control(job_id: &str) {
    if let Ok(mut controls) = job_controls().lock() {
        controls.remove(job_id);
    }
}

fn with_job_control(job_id: &str, update: impl FnOnce(&JobControl)) -> bool {
    if let Ok(controls) = job_controls().lock() {
        if let Some(control) = controls.get(job_id) {
            update(control);
            return true;
        }
    }

    false
}

fn persist_translation(
    app_handle: &AppHandle,
    book_id: &str,
    target_language: &str,
    work_item: &ParagraphWorkItem,
    translated_html: &str,
) -> Result<(), String> {
    with_connection(app_handle, |connection| {
        connection
            .execute(
                "INSERT INTO translations (
                    id,
                    book_id,
                    spine_item_href,
                    paragraph_index,
                    paragraph_hash,
                    original_html,
                    translated_html,
                    target_language,
                    created_at
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                params![
                    generate_uuid_v4().map_err(|error| error.to_string())?,
                    book_id,
                    work_item.locator.spine_item_href,
                    work_item.locator.paragraph_index,
                    work_item.paragraph_hash,
                    work_item.original_html,
                    translated_html,
                    target_language,
                    now_unix_timestamp(),
                ],
            )
            .map_err(|error| error.to_string())?;

        Ok(())
    })
}

fn load_existing_translation_locators(
    app_handle: &AppHandle,
    book_id: &str,
    target_language: &str,
) -> Result<HashSet<ParagraphLocator>, String> {
    with_connection(app_handle, |connection| {
        let mut statement = connection
            .prepare(
                "SELECT spine_item_href, paragraph_index
                 FROM translations
                 WHERE book_id = ?1 AND target_language = ?2",
            )
            .map_err(|error| error.to_string())?;

        let locators = statement
            .query_map(params![book_id, target_language], |row| {
                Ok(ParagraphLocator {
                    spine_item_href: row.get("spine_item_href")?,
                    paragraph_index: row.get("paragraph_index")?,
                })
            })
            .map_err(|error| error.to_string())?
            .collect::<Result<HashSet<_>, _>>()
            .map_err(|error| error.to_string())?;

        Ok(locators)
    })
}

fn update_completed_paragraphs(
    app_handle: &AppHandle,
    job_id: &str,
    completed_paragraphs: i64,
) -> Result<(), String> {
    with_connection(app_handle, |connection| {
        connection
            .execute(
                "UPDATE translation_jobs
                 SET completed_paragraphs = ?2,
                     updated_at = ?3
                 WHERE id = ?1",
                params![job_id, completed_paragraphs, now_unix_timestamp()],
            )
            .map_err(|error| error.to_string())?;
        Ok(())
    })
}

fn update_job_status(
    app_handle: &AppHandle,
    job_id: &str,
    status: TranslationJobStatus,
    pause_reason: Option<TranslationPauseReason>,
) -> Result<(), String> {
    with_connection(app_handle, |connection| {
        connection
            .execute(
                "UPDATE translation_jobs
                 SET status = ?2,
                     pause_reason = ?3,
                     updated_at = ?4
                 WHERE id = ?1",
                params![
                    job_id,
                    status.as_str(),
                    pause_reason.map(|reason| reason.as_str().to_string()),
                    now_unix_timestamp(),
                ],
            )
            .map_err(|error| error.to_string())?;
        Ok(())
    })
}

fn mark_job_failed(app_handle: &AppHandle, job_id: &str) -> Result<(), String> {
    update_job_status(app_handle, job_id, TranslationJobStatus::Failed, None)
}

fn append_failed_locator(
    app_handle: &AppHandle,
    job_id: &str,
    locator: &ParagraphLocator,
) -> Result<(), String> {
    let mut failed_locators = load_failed_locators(app_handle, job_id)?;
    if !failed_locators.contains(locator) {
        failed_locators.push(locator.clone());
    }
    store_failed_locators(app_handle, job_id, &failed_locators)
}

fn remove_failed_locator(
    app_handle: &AppHandle,
    job_id: &str,
    locator: &ParagraphLocator,
) -> Result<(), String> {
    let mut failed_locators = load_failed_locators(app_handle, job_id)?;
    failed_locators.retain(|current| current != locator);
    store_failed_locators(app_handle, job_id, &failed_locators)
}

fn load_failed_locators(app_handle: &AppHandle, job_id: &str) -> Result<Vec<ParagraphLocator>, String> {
    with_connection(app_handle, |connection| {
        let raw_value = connection
            .query_row(
                "SELECT failed_paragraph_locators FROM translation_jobs WHERE id = ?1",
                params![job_id],
                |row| row.get::<_, String>(0),
            )
            .optional()
            .map_err(|error| error.to_string())?
            .ok_or_else(|| "JOB_NOT_FOUND".to_string())?;

        serde_json::from_str::<Vec<ParagraphLocator>>(&raw_value).map_err(|error| error.to_string())
    })
}

fn store_failed_locators(
    app_handle: &AppHandle,
    job_id: &str,
    locators: &[ParagraphLocator],
) -> Result<(), String> {
    let serialized = serialize_paragraph_locators(locators)?;
    with_connection(app_handle, |connection| {
        connection
            .execute(
                "UPDATE translation_jobs
                 SET failed_paragraph_locators = ?2,
                     updated_at = ?3
                 WHERE id = ?1",
                params![job_id, serialized, now_unix_timestamp()],
            )
            .map_err(|error| error.to_string())?;
        Ok(())
    })
}

fn with_connection<T>(
    app_handle: &AppHandle,
    operation: impl FnOnce(&rusqlite::Connection) -> Result<T, String>,
) -> Result<T, String> {
    let state = app_handle.state::<AppState>();
    let connection = state
        .db
        .lock()
        .map_err(|_| "SQLITE_LOCK_ERROR".to_string())?;
    operation(&connection)
}

fn load_paragraph_work_items(file_path: &str) -> Result<Vec<ParagraphWorkItem>, String> {
    let file = File::open(file_path).map_err(|error| error.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|error| error.to_string())?;
    let rootfile_path = read_rootfile_path(&mut archive)?;
    let opf_document = read_opf_document(&mut archive, &rootfile_path)?;
    let spine_items = collect_spine_items(&opf_document, &rootfile_path);
    let mut work_items = Vec::new();

    for spine_item in spine_items.into_iter().filter(is_text_spine_item) {
        let chapter_xml = read_zip_text(&mut archive, &spine_item.resolved_path)?;
        for (paragraph_index, paragraph_html) in extract_paragraph_fragments(&chapter_xml)?
            .into_iter()
            .enumerate()
        {
            work_items.push(ParagraphWorkItem {
                locator: ParagraphLocator {
                    spine_item_href: spine_item.href.clone(),
                    paragraph_index: paragraph_index as i64,
                },
                paragraph_hash: hash_paragraph(&paragraph_html),
                original_html: paragraph_html,
            });
        }
    }

    Ok(work_items)
}

fn hash_paragraph(paragraph_html: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(paragraph_html.as_bytes());
    format!("{:x}", hasher.finalize())
}

fn read_rootfile_path(archive: &mut ZipArchive<File>) -> Result<String, String> {
    let xml = read_zip_text(archive, CONTAINER_PATH)?;
    let mut reader = Reader::from_str(&xml);
    reader.config_mut().trim_text(true);
    let mut buffer = Vec::new();

    loop {
        match reader.read_event_into(&mut buffer) {
            Ok(Event::Empty(event)) | Ok(Event::Start(event))
                if event.name().as_ref() == b"rootfile" =>
            {
                for attribute in event.attributes() {
                    let attribute = attribute.map_err(|error| error.to_string())?;
                    if attribute.key.as_ref() == b"full-path" {
                        return attribute
                            .decode_and_unescape_value(reader.decoder())
                            .map(|value| value.into_owned())
                            .map_err(|error| error.to_string());
                    }
                }
            }
            Ok(Event::Eof) => break,
            Ok(_) => {}
            Err(error) => return Err(error.to_string()),
        }

        buffer.clear();
    }

    Err("Invalid ePub container.xml".to_string())
}

fn read_opf_document(
    archive: &mut ZipArchive<File>,
    rootfile_path: &str,
) -> Result<Element, String> {
    let xml = read_zip_text(archive, rootfile_path)?;
    Element::from_reader(xml.as_bytes()).map_err(|error| error.to_string())
}

fn collect_spine_items(opf_document: &Element, rootfile_path: &str) -> Vec<SpineItem> {
    let Some(manifest) = opf_document.get_child("manifest", PACKAGE_NS) else {
        return Vec::new();
    };
    let Some(spine) = opf_document.get_child("spine", PACKAGE_NS) else {
        return Vec::new();
    };

    let manifest_items = manifest
        .children()
        .filter(|child| child.name() == "item" && child.ns() == PACKAGE_NS)
        .filter_map(|child| {
            let id = child.attr("id")?.to_string();
            let href = child.attr("href")?.to_string();
            Some((
                id,
                SpineItem {
                    resolved_path: resolve_zip_path(rootfile_path, &href),
                    href,
                    media_type: child.attr("media-type").map(str::to_owned),
                },
            ))
        })
        .collect::<HashMap<_, _>>();

    spine
        .children()
        .filter(|child| child.name() == "itemref" && child.ns() == PACKAGE_NS)
        .filter_map(|child| child.attr("idref"))
        .filter_map(|idref| manifest_items.get(idref).cloned())
        .collect::<Vec<_>>()
}

fn is_text_spine_item(spine_item: &SpineItem) -> bool {
    if let Some(media_type) = spine_item.media_type.as_deref() {
        if media_type == "application/xhtml+xml" || media_type == "text/html" {
            return true;
        }
    }

    spine_item.href.ends_with(".xhtml")
        || spine_item.href.ends_with(".html")
        || spine_item.href.ends_with(".htm")
}

fn read_zip_text(archive: &mut ZipArchive<File>, entry_path: &str) -> Result<String, String> {
    let mut file = archive.by_name(entry_path).map_err(|error| error.to_string())?;
    let mut contents = String::new();
    file.read_to_string(&mut contents)
        .map_err(|error| error.to_string())?;
    Ok(contents)
}

fn resolve_zip_path(rootfile_path: &str, relative_path: &str) -> String {
    let base_path = Path::new(rootfile_path)
        .parent()
        .unwrap_or_else(|| Path::new(""));
    normalize_zip_path(base_path.join(relative_path))
}

fn normalize_zip_path(path: PathBuf) -> String {
    let mut segments = Vec::new();

    for component in path.components() {
        match component {
            Component::CurDir => {}
            Component::ParentDir => {
                let _ = segments.pop();
            }
            Component::Normal(segment) => segments.push(segment.to_string_lossy().into_owned()),
            Component::RootDir | Component::Prefix(_) => {}
        }
    }

    segments.join("/")
}

fn extract_paragraph_fragments(chapter_xml: &str) -> Result<Vec<String>, String> {
    let mut reader = Reader::from_str(chapter_xml);
    reader.config_mut().trim_text(false);
    let mut buffer = Vec::new();
    let mut fragments = Vec::new();
    let mut active_fragment = String::new();
    let mut paragraph_depth = 0_usize;

    loop {
        match reader.read_event_into(&mut buffer) {
            Ok(Event::Start(event)) => {
                let tag_name = event
                    .name()
                    .as_ref()
                    .to_vec();

                if tag_name.as_slice() == b"p" && paragraph_depth == 0 {
                    paragraph_depth = 1;
                    active_fragment.clear();
                } else if paragraph_depth > 0 {
                    paragraph_depth += 1;
                    active_fragment.push_str(
                        std::str::from_utf8(event.as_ref()).map_err(|error| error.to_string())?,
                    );
                }
            }
            Ok(Event::Empty(event)) => {
                if paragraph_depth > 0 {
                    active_fragment.push_str(
                        std::str::from_utf8(event.as_ref()).map_err(|error| error.to_string())?,
                    );
                } else if event.name().as_ref() == b"p" {
                    fragments.push(String::new());
                }
            }
            Ok(Event::End(event)) => {
                if paragraph_depth == 0 {
                    buffer.clear();
                    continue;
                }

                paragraph_depth -= 1;
                if paragraph_depth == 0 && event.name().as_ref() == b"p" {
                    fragments.push(active_fragment.clone());
                    active_fragment.clear();
                } else {
                    active_fragment.push_str(
                        std::str::from_utf8(event.as_ref()).map_err(|error| error.to_string())?,
                    );
                }
            }
            Ok(Event::Text(event)) => {
                if paragraph_depth > 0 {
                    active_fragment.push_str(
                        std::str::from_utf8(event.as_ref()).map_err(|error| error.to_string())?,
                    );
                }
            }
            Ok(Event::CData(event)) => {
                if paragraph_depth > 0 {
                    active_fragment.push_str(
                        std::str::from_utf8(event.as_ref()).map_err(|error| error.to_string())?,
                    );
                }
            }
            Ok(Event::Eof) => break,
            Ok(_) => {}
            Err(error) => return Err(error.to_string()),
        }

        buffer.clear();
    }

    Ok(fragments)
}

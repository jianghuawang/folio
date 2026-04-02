use std::{
    fs::{self, File},
    io::Read,
    path::{Component, Path, PathBuf},
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};

use minidom::Element;
use quick_xml::{events::Event, Reader};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Manager};
use zip::ZipArchive;

use crate::db::APP_SUPPORT_DIRECTORY;

const CONTAINER_PATH: &str = "META-INF/container.xml";
const PACKAGE_NS: &str = "http://www.idpf.org/2007/opf";
const DC_NS: &str = "http://purl.org/dc/elements/1.1/";
const BOOKS_DIRECTORY: &str = "Books";
const COVERS_DIRECTORY: &str = "Covers";
const PNG_SIGNATURE: &[u8] = b"\x89PNG\r\n\x1a\n";

#[derive(Debug)]
pub struct ManagedBookCopy {
    pub id: String,
    pub managed_path: PathBuf,
    pub file_hash: String,
}

#[derive(Debug)]
pub struct ImportedBookDraft {
    pub id: String,
    pub title: String,
    pub author: String,
    pub managed_path: PathBuf,
    pub cover_path: Option<PathBuf>,
    pub file_hash: String,
    pub added_at: i64,
}

#[derive(Debug)]
pub struct ImporterError {
    message: String,
}

impl ImporterError {
    fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
        }
    }
}

impl std::fmt::Display for ImporterError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(&self.message)
    }
}

impl std::error::Error for ImporterError {}

impl From<std::io::Error> for ImporterError {
    fn from(error: std::io::Error) -> Self {
        Self::new(error.to_string())
    }
}

impl From<zip::result::ZipError> for ImporterError {
    fn from(error: zip::result::ZipError) -> Self {
        Self::new(error.to_string())
    }
}

impl From<minidom::Error> for ImporterError {
    fn from(error: minidom::Error) -> Self {
        Self::new(error.to_string())
    }
}

impl From<quick_xml::Error> for ImporterError {
    fn from(error: quick_xml::Error) -> Self {
        Self::new(error.to_string())
    }
}

pub fn compute_file_hash(source_path: &Path) -> Result<String, ImporterError> {
    let mut file = File::open(source_path)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 8192];

    loop {
        let read = file.read(&mut buffer)?;
        if read == 0 {
            break;
        }

        hasher.update(&buffer[..read]);
    }

    Ok(format!("{:x}", hasher.finalize()))
}

pub fn create_managed_copy(
    app: &AppHandle,
    source_path: &Path,
    file_hash: String,
) -> Result<ManagedBookCopy, ImporterError> {
    let book_id = generate_uuid_v4()?;
    let books_directory = resolve_app_support_directory(app)?.join(BOOKS_DIRECTORY);

    fs::create_dir_all(&books_directory)?;

    let managed_path = books_directory.join(format!("{book_id}.epub"));
    fs::copy(source_path, &managed_path)?;

    Ok(ManagedBookCopy {
        id: book_id,
        managed_path,
        file_hash,
    })
}

pub fn parse_managed_copy(
    managed_copy: ManagedBookCopy,
    source_path: &Path,
) -> Result<ImportedBookDraft, ImporterError> {
    let result = parse_managed_copy_inner(&managed_copy, source_path);

    if result.is_err() {
        let _ = fs::remove_file(&managed_copy.managed_path);
    }

    result
}

pub fn cleanup_import_draft(imported_book: &ImportedBookDraft) {
    let _ = fs::remove_file(&imported_book.managed_path);

    if let Some(cover_path) = &imported_book.cover_path {
        let _ = fs::remove_file(cover_path);
    }
}

fn parse_managed_copy_inner(
    managed_copy: &ManagedBookCopy,
    source_path: &Path,
) -> Result<ImportedBookDraft, ImporterError> {
    let file = File::open(&managed_copy.managed_path)?;
    let mut archive = ZipArchive::new(file)?;
    let rootfile_path = read_rootfile_path(&mut archive)?;
    let opf_document = read_opf_document(&mut archive, &rootfile_path)?;
    let metadata = parse_metadata(&opf_document, source_path);
    let cover_path = extract_cover_image(
        &mut archive,
        &rootfile_path,
        &opf_document,
        &managed_copy.id,
        managed_copy.managed_path.parent(),
    )?;

    Ok(ImportedBookDraft {
        id: managed_copy.id.clone(),
        title: metadata.title,
        author: metadata.author,
        managed_path: managed_copy.managed_path.clone(),
        cover_path,
        file_hash: managed_copy.file_hash.clone(),
        added_at: now_unix_timestamp(),
    })
}

fn read_rootfile_path(archive: &mut ZipArchive<File>) -> Result<String, ImporterError> {
    let xml = read_zip_text(archive, CONTAINER_PATH)?;
    let mut reader = Reader::from_str(&xml);
    reader.config_mut().trim_text(true);
    let mut buffer = Vec::new();

    loop {
        match reader.read_event_into(&mut buffer)? {
            Event::Empty(event) | Event::Start(event) if event.name().as_ref() == b"rootfile" => {
                for attribute in event.attributes() {
                    let attribute =
                        attribute.map_err(|error| ImporterError::new(error.to_string()))?;
                    if attribute.key.as_ref() == b"full-path" {
                        return attribute
                            .decode_and_unescape_value(reader.decoder())
                            .map(|value| value.into_owned())
                            .map_err(|error| ImporterError::new(error.to_string()));
                    }
                }
            }
            Event::Eof => break,
            _ => {}
        }

        buffer.clear();
    }

    Err(ImporterError::new("Invalid ePub container.xml"))
}

fn read_opf_document(
    archive: &mut ZipArchive<File>,
    rootfile_path: &str,
) -> Result<Element, ImporterError> {
    let xml = read_zip_text(archive, rootfile_path)?;
    Element::from_reader(xml.as_bytes()).map_err(ImporterError::from)
}

fn parse_metadata(opf_document: &Element, source_path: &Path) -> EpubMetadata {
    let title = opf_document
        .get_child("metadata", PACKAGE_NS)
        .and_then(|metadata| {
            metadata
                .children()
                .find(|child| child.name() == "title" && child.ns() == DC_NS)
                .map(Element::text)
        })
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| {
            source_path
                .file_stem()
                .and_then(|value| value.to_str())
                .map(str::to_owned)
                .filter(|value| !value.is_empty())
                .unwrap_or_else(|| "Untitled Book".to_string())
        });

    let author = opf_document
        .get_child("metadata", PACKAGE_NS)
        .and_then(|metadata| {
            metadata
                .children()
                .find(|child| child.name() == "creator" && child.ns() == DC_NS)
                .map(Element::text)
        })
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "Unknown Author".to_string());

    EpubMetadata { title, author }
}

fn extract_cover_image(
    archive: &mut ZipArchive<File>,
    rootfile_path: &str,
    opf_document: &Element,
    book_id: &str,
    managed_books_directory: Option<&Path>,
) -> Result<Option<PathBuf>, ImporterError> {
    let Some(cover_reference) = find_cover_reference(opf_document) else {
        return Ok(None);
    };

    let resolved_cover_path = resolve_zip_path(rootfile_path, &cover_reference.href);
    let cover_bytes = match read_zip_binary(archive, &resolved_cover_path) {
        Ok(bytes) => bytes,
        Err(_) => return Ok(None),
    };

    let Some(app_support_directory) = managed_books_directory.and_then(Path::parent) else {
        return Ok(None);
    };

    let covers_directory = app_support_directory.join(COVERS_DIRECTORY);
    fs::create_dir_all(&covers_directory)?;

    let cover_path = covers_directory.join(format!("{book_id}.png"));

    if cover_bytes.starts_with(PNG_SIGNATURE) {
        fs::write(&cover_path, cover_bytes)?;
        return Ok(Some(cover_path));
    }

    let Some(extension) = infer_image_extension(&cover_reference) else {
        return Ok(None);
    };

    if convert_cover_to_png(book_id, &cover_bytes, extension, &cover_path).is_ok() {
        return Ok(Some(cover_path));
    }

    Ok(None)
}

fn find_cover_reference(opf_document: &Element) -> Option<CoverReference> {
    let metadata = opf_document.get_child("metadata", PACKAGE_NS)?;
    let manifest = opf_document.get_child("manifest", PACKAGE_NS)?;

    let cover_id = metadata
        .children()
        .find(|child| {
            child.name() == "meta"
                && child.ns() == PACKAGE_NS
                && child.attr("name") == Some("cover")
        })
        .and_then(|element| element.attr("content"))
        .map(str::to_owned);

    let manifest_items = manifest
        .children()
        .filter(|child| child.name() == "item" && child.ns() == PACKAGE_NS)
        .collect::<Vec<_>>();

    let cover_item = manifest_items
        .iter()
        .find(|item| {
            item.attr("properties")
                .map(|properties| {
                    properties
                        .split_whitespace()
                        .any(|property| property == "cover-image")
                })
                .unwrap_or(false)
        })
        .copied()
        .or_else(|| {
            cover_id.as_deref().and_then(|cover_id| {
                manifest_items
                    .iter()
                    .find(|item| item.attr("id") == Some(cover_id))
                    .copied()
            })
        })?;

    Some(CoverReference {
        href: cover_item.attr("href")?.to_string(),
        media_type: cover_item.attr("media-type").map(str::to_owned),
    })
}

fn read_zip_text(
    archive: &mut ZipArchive<File>,
    entry_path: &str,
) -> Result<String, ImporterError> {
    let mut file = archive.by_name(entry_path)?;
    let mut contents = String::new();
    file.read_to_string(&mut contents)?;
    Ok(contents)
}

fn read_zip_binary(
    archive: &mut ZipArchive<File>,
    entry_path: &str,
) -> Result<Vec<u8>, ImporterError> {
    let mut file = archive.by_name(entry_path)?;
    let mut contents = Vec::new();
    file.read_to_end(&mut contents)?;
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

fn infer_image_extension(cover_reference: &CoverReference) -> Option<&'static str> {
    if let Some(media_type) = cover_reference.media_type.as_deref() {
        match media_type {
            "image/jpeg" => return Some("jpg"),
            "image/png" => return Some("png"),
            "image/gif" => return Some("gif"),
            "image/webp" => return Some("webp"),
            _ => {}
        }
    }

    Path::new(&cover_reference.href)
        .extension()
        .and_then(|value| value.to_str())
        .map(|extension| match extension.to_ascii_lowercase().as_str() {
            "jpeg" => "jpg",
            "jpg" => "jpg",
            "png" => "png",
            "gif" => "gif",
            "webp" => "webp",
            _ => "",
        })
        .filter(|extension| !extension.is_empty())
}

fn convert_cover_to_png(
    book_id: &str,
    cover_bytes: &[u8],
    extension: &str,
    output_path: &Path,
) -> Result<(), ImporterError> {
    let temp_path = std::env::temp_dir().join(format!("folio-cover-{book_id}.{extension}"));
    fs::write(&temp_path, cover_bytes)?;

    let status = Command::new("sips")
        .arg("-s")
        .arg("format")
        .arg("png")
        .arg(&temp_path)
        .arg("--out")
        .arg(output_path)
        .status();

    let _ = fs::remove_file(&temp_path);

    match status {
        Ok(status) if status.success() => Ok(()),
        Ok(_) => Err(ImporterError::new("Failed to convert cover image to PNG")),
        Err(error) => Err(ImporterError::new(error.to_string())),
    }
}

fn resolve_app_support_directory(app: &AppHandle) -> Result<PathBuf, ImporterError> {
    let home_directory = app
        .path()
        .home_dir()
        .map_err(|error| ImporterError::new(error.to_string()))?;

    Ok(home_directory
        .join("Library")
        .join("Application Support")
        .join(APP_SUPPORT_DIRECTORY))
}

fn generate_uuid_v4() -> Result<String, ImporterError> {
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

fn now_unix_timestamp() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or_default()
}

#[derive(Debug)]
struct EpubMetadata {
    title: String,
    author: String,
}

#[derive(Debug)]
struct CoverReference {
    href: String,
    media_type: Option<String>,
}

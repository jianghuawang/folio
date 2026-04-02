use std::{
    collections::HashMap,
    fs::File,
    io::{Read, Write},
    path::{Component, Path, PathBuf},
};

use minidom::Element;
use quick_xml::{
    events::{BytesEnd, BytesStart, Event},
    Reader, Writer,
};
use tauri::{AppHandle, Emitter};
use zip::{write::SimpleFileOptions, CompressionMethod, ZipArchive, ZipWriter};

use crate::llm::Translation;

const CONTAINER_PATH: &str = "META-INF/container.xml";
const PACKAGE_NS: &str = "http://www.idpf.org/2007/opf";

#[derive(Debug, Clone)]
struct SpineItem {
    href: String,
    resolved_path: String,
    media_type: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
struct ExportProgressEvent {
    percent: i64,
}

pub fn export_bilingual_epub(
    app_handle: &AppHandle,
    source_path: &str,
    translations: &[Translation],
    save_path: &str,
) -> Result<(), String> {
    let source_file = File::open(source_path).map_err(|_| "WRITE_ERROR".to_string())?;
    let mut archive = ZipArchive::new(source_file).map_err(|_| "WRITE_ERROR".to_string())?;
    let spine_items = collect_spine_items(&mut archive).map_err(|_| "WRITE_ERROR".to_string())?;
    let translations_by_path = build_translation_lookup(&spine_items, translations);

    let output_file = File::create(save_path).map_err(|_| "WRITE_ERROR".to_string())?;
    let mut writer = ZipWriter::new(output_file);
    let total_entries = archive.len() as i64;

    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|_| "WRITE_ERROR".to_string())?;
        let entry_name = entry.name().to_string();

        if entry.is_dir() {
            writer
                .add_directory(entry_name.clone(), SimpleFileOptions::default())
                .map_err(|_| "WRITE_ERROR".to_string())?;
        } else {
            let mut contents = Vec::new();
            entry
                .read_to_end(&mut contents)
                .map_err(|_| "WRITE_ERROR".to_string())?;

            let options = if entry_name == "mimetype" {
                SimpleFileOptions::default().compression_method(CompressionMethod::Stored)
            } else {
                entry.options()
            };

            writer
                .start_file(entry_name.clone(), options)
                .map_err(|_| "WRITE_ERROR".to_string())?;

            if let Some(translations_for_entry) = translations_by_path.get(&entry_name) {
                let chapter_xml =
                    String::from_utf8(contents).map_err(|_| "WRITE_ERROR".to_string())?;
                let injected_xml =
                    inject_translations_into_chapter(&chapter_xml, translations_for_entry)
                        .map_err(|_| "WRITE_ERROR".to_string())?;
                writer
                    .write_all(injected_xml.as_bytes())
                    .map_err(|_| "WRITE_ERROR".to_string())?;
            } else {
                writer
                    .write_all(&contents)
                    .map_err(|_| "WRITE_ERROR".to_string())?;
            }
        }

        let percent = (((index as i64 + 1) * 100) / total_entries.max(1)).clamp(0, 100);
        app_handle
            .emit("export:progress", ExportProgressEvent { percent })
            .map_err(|_| "WRITE_ERROR".to_string())?;
    }

    writer.finish().map_err(|_| "WRITE_ERROR".to_string())?;

    Ok(())
}

fn build_translation_lookup(
    spine_items: &[SpineItem],
    translations: &[Translation],
) -> HashMap<String, HashMap<i64, String>> {
    let path_by_href = spine_items
        .iter()
        .map(|spine_item| (spine_item.href.clone(), spine_item.resolved_path.clone()))
        .collect::<HashMap<_, _>>();

    let mut lookup = HashMap::<String, HashMap<i64, String>>::new();

    for translation in translations {
        if let Some(resolved_path) = path_by_href.get(&translation.spine_item_href) {
            lookup.entry(resolved_path.clone()).or_default().insert(
                translation.paragraph_index,
                translation.translated_html.clone(),
            );
        }
    }

    lookup
}

fn collect_spine_items(archive: &mut ZipArchive<File>) -> Result<Vec<SpineItem>, String> {
    let rootfile_path = read_rootfile_path(archive)?;
    let opf_document = read_opf_document(archive, &rootfile_path)?;
    Ok(resolve_spine_items(&opf_document, &rootfile_path)
        .into_iter()
        .filter(is_text_spine_item)
        .collect())
}

fn read_rootfile_path(archive: &mut ZipArchive<File>) -> Result<String, String> {
    let xml = read_zip_text(archive, CONTAINER_PATH)?;
    let mut reader = Reader::from_str(&xml);
    reader.config_mut().trim_text(true);
    let mut buffer = Vec::new();

    loop {
        match reader.read_event_into(&mut buffer) {
            Ok(Event::Empty(event)) if event.name().as_ref() == b"rootfile" => {
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
            Ok(Event::Start(event)) if event.name().as_ref() == b"rootfile" => {
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

fn resolve_spine_items(opf_document: &Element, rootfile_path: &str) -> Vec<SpineItem> {
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
                    href: href.clone(),
                    resolved_path: resolve_zip_path(rootfile_path, &href),
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
    let mut file = archive
        .by_name(entry_path)
        .map_err(|error| error.to_string())?;
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

fn inject_translations_into_chapter(
    chapter_xml: &str,
    translations: &HashMap<i64, String>,
) -> Result<String, String> {
    let mut reader = Reader::from_str(chapter_xml);
    reader.config_mut().trim_text(false);
    let mut writer = Writer::new(Vec::new());
    let mut buffer = Vec::new();
    let mut paragraph_depth = 0_usize;
    let mut paragraph_index = 0_i64;

    loop {
        match reader.read_event_into(&mut buffer) {
            Ok(Event::Start(event)) => {
                if event.name().as_ref() == b"p" && paragraph_depth == 0 {
                    paragraph_depth = 1;
                } else if paragraph_depth > 0 {
                    paragraph_depth += 1;
                }

                writer
                    .write_event(Event::Start(event.into_owned()))
                    .map_err(|error| error.to_string())?;
            }
            Ok(Event::Empty(event)) => {
                let is_paragraph = event.name().as_ref() == b"p" && paragraph_depth == 0;

                writer
                    .write_event(Event::Empty(event.into_owned()))
                    .map_err(|error| error.to_string())?;

                if is_paragraph {
                    maybe_write_translation_paragraph(&mut writer, translations, paragraph_index)?;
                    paragraph_index += 1;
                }
            }
            Ok(Event::End(event)) => {
                let is_root_paragraph_end = event.name().as_ref() == b"p" && paragraph_depth == 1;
                if paragraph_depth > 0 {
                    paragraph_depth -= 1;
                }

                writer
                    .write_event(Event::End(event.into_owned()))
                    .map_err(|error| error.to_string())?;

                if is_root_paragraph_end {
                    maybe_write_translation_paragraph(&mut writer, translations, paragraph_index)?;
                    paragraph_index += 1;
                }
            }
            Ok(Event::Text(event)) => {
                writer
                    .write_event(Event::Text(event.into_owned()))
                    .map_err(|error| error.to_string())?;
            }
            Ok(Event::CData(event)) => {
                writer
                    .write_event(Event::CData(event.into_owned()))
                    .map_err(|error| error.to_string())?;
            }
            Ok(Event::Comment(event)) => {
                writer
                    .write_event(Event::Comment(event.into_owned()))
                    .map_err(|error| error.to_string())?;
            }
            Ok(Event::Decl(event)) => {
                writer
                    .write_event(Event::Decl(event.into_owned()))
                    .map_err(|error| error.to_string())?;
            }
            Ok(Event::PI(event)) => {
                writer
                    .write_event(Event::PI(event.into_owned()))
                    .map_err(|error| error.to_string())?;
            }
            Ok(Event::DocType(event)) => {
                writer
                    .write_event(Event::DocType(event.into_owned()))
                    .map_err(|error| error.to_string())?;
            }
            Ok(Event::Eof) => break,
            Err(error) => return Err(error.to_string()),
        }

        buffer.clear();
    }

    String::from_utf8(writer.into_inner()).map_err(|error| error.to_string())
}

fn maybe_write_translation_paragraph(
    writer: &mut Writer<Vec<u8>>,
    translations: &HashMap<i64, String>,
    paragraph_index: i64,
) -> Result<(), String> {
    let Some(translated_html) = translations.get(&paragraph_index) else {
        return Ok(());
    };

    let mut paragraph = BytesStart::new("p");
    paragraph.push_attribute(("class", "folio-translation"));

    writer
        .write_event(Event::Start(paragraph))
        .map_err(|error| error.to_string())?;
    write_html_fragment(writer, translated_html)?;
    writer
        .write_event(Event::End(BytesEnd::new("p")))
        .map_err(|error| error.to_string())?;

    Ok(())
}

fn write_html_fragment(writer: &mut Writer<Vec<u8>>, html_fragment: &str) -> Result<(), String> {
    let wrapped_fragment = format!("<folio-root>{html_fragment}</folio-root>");
    let mut reader = Reader::from_str(&wrapped_fragment);
    reader.config_mut().trim_text(false);
    let mut buffer = Vec::new();

    loop {
        match reader.read_event_into(&mut buffer) {
            Ok(Event::Start(event)) if event.name().as_ref() == b"folio-root" => {}
            Ok(Event::End(event)) if event.name().as_ref() == b"folio-root" => break,
            Ok(Event::Eof) => break,
            Ok(event) => {
                writer
                    .write_event(event.into_owned())
                    .map_err(|error| error.to_string())?;
            }
            Err(error) => return Err(error.to_string()),
        }

        buffer.clear();
    }

    Ok(())
}

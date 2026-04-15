use std::{
    fs,
    path::{Path, PathBuf},
};

use tauri::{AppHandle, Manager, Runtime};

const APP_DIRECTORY_NAME: &str = "Folio";
const BOOKS_DIRECTORY: &str = "Books";
const DATABASE_FILENAME: &str = "folio.db";

pub fn app_data_root<R: Runtime>(app_handle: &AppHandle<R>) -> Result<PathBuf, String> {
    Ok(resolve_platform_data_root(app_handle)?.join(APP_DIRECTORY_NAME))
}

pub fn books_dir<R: Runtime>(app_handle: &AppHandle<R>) -> Result<PathBuf, String> {
    Ok(app_data_root(app_handle)?.join(BOOKS_DIRECTORY))
}

pub fn database_path<R: Runtime>(app_handle: &AppHandle<R>) -> Result<PathBuf, String> {
    Ok(app_data_root(app_handle)?.join(DATABASE_FILENAME))
}

pub fn normalize_path_for_comparison(path: &Path) -> Result<PathBuf, String> {
    let absolute_path = if path.is_absolute() {
        path.to_path_buf()
    } else {
        std::env::current_dir()
            .map_err(|error| error.to_string())?
            .join(path)
    };

    if let Ok(canonical_path) = fs::canonicalize(&absolute_path) {
        return Ok(normalize_case(canonical_path));
    }

    let parent_directory = absolute_path
        .parent()
        .ok_or_else(|| "WRITE_ERROR".to_string())?;
    let canonical_parent =
        fs::canonicalize(parent_directory).map_err(|_| "WRITE_ERROR".to_string())?;
    let file_name = absolute_path
        .file_name()
        .ok_or_else(|| "WRITE_ERROR".to_string())?;

    Ok(normalize_case(canonical_parent.join(file_name)))
}

pub fn paths_equal(left: &Path, right: &Path) -> Result<bool, String> {
    Ok(normalize_path_for_comparison(left)? == normalize_path_for_comparison(right)?)
}

#[cfg(target_os = "macos")]
fn resolve_platform_data_root<R: Runtime>(app_handle: &AppHandle<R>) -> Result<PathBuf, String> {
    app_handle
        .path()
        .data_dir()
        .map_err(|error| error.to_string())
}

#[cfg(target_os = "windows")]
fn resolve_platform_data_root<R: Runtime>(app_handle: &AppHandle<R>) -> Result<PathBuf, String> {
    app_handle
        .path()
        .local_data_dir()
        .map_err(|error| error.to_string())
}

#[cfg(target_os = "windows")]
fn normalize_case(path: PathBuf) -> PathBuf {
    PathBuf::from(path.to_string_lossy().replace('/', "\\").to_lowercase())
}

#[cfg(not(target_os = "windows"))]
fn normalize_case(path: PathBuf) -> PathBuf {
    path
}

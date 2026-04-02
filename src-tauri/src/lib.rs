mod commands;
mod db;
mod epub;
mod keychain;
mod llm;

use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    AppHandle, Manager, PhysicalPosition, PhysicalSize, Position, Runtime, Size, WebviewUrl,
    WebviewWindow, WebviewWindowBuilder, Window, WindowEvent,
};

use crate::db::AppState;

const SETTINGS_MENU_ID: &str = "settings";
const SETTINGS_WINDOW_LABEL: &str = "settings";
const MAIN_WINDOW_LABEL: &str = "main";
const LIBRARY_WINDOW_STATE_KEY: &str = "window_state_library";
const SETTINGS_WINDOW_STATE_KEY: &str = "window_state_settings";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct PersistedWindowState {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

fn open_settings_window<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window(SETTINGS_WINDOW_LABEL) {
        window.unminimize()?;
        window.show()?;
        window.set_focus()?;
        return Ok(());
    }

    let window = WebviewWindowBuilder::new(
        app,
        SETTINGS_WINDOW_LABEL,
        WebviewUrl::App("/settings".into()),
    )
    .title("Settings")
    .inner_size(560.0, 400.0)
    .min_inner_size(560.0, 400.0)
    .resizable(false)
    .visible(false)
    .build()?;

    if let Some(state) = app.try_state::<AppState>() {
        let _ = restore_window_state(&window, state.inner(), SETTINGS_WINDOW_STATE_KEY);
    }

    window.show()?;

    Ok(())
}

#[cfg(target_os = "macos")]
fn build_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let package_name = app.package_info().name.clone();
    let settings_item = MenuItem::with_id(
        app,
        SETTINGS_MENU_ID,
        "Settings…",
        true,
        Some("CmdOrCtrl+,"),
    )?;

    let app_menu = Submenu::with_items(
        app,
        package_name,
        true,
        &[
            &PredefinedMenuItem::about(app, None, None)?,
            &PredefinedMenuItem::separator(app)?,
            &settings_item,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::services(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::hide(app, None)?,
            &PredefinedMenuItem::hide_others(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::quit(app, None)?,
        ],
    )?;

    let file_menu = Submenu::with_items(
        app,
        "File",
        true,
        &[&PredefinedMenuItem::close_window(app, None)?],
    )?;

    let edit_menu = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(app, None)?,
            &PredefinedMenuItem::redo(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, None)?,
            &PredefinedMenuItem::copy(app, None)?,
            &PredefinedMenuItem::paste(app, None)?,
            &PredefinedMenuItem::select_all(app, None)?,
        ],
    )?;

    let view_menu = Submenu::with_items(
        app,
        "View",
        true,
        &[&PredefinedMenuItem::fullscreen(app, None)?],
    )?;

    let window_menu = Submenu::with_items(
        app,
        "Window",
        true,
        &[
            &PredefinedMenuItem::minimize(app, None)?,
            &PredefinedMenuItem::maximize(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::close_window(app, None)?,
        ],
    )?;

    let help_menu = Submenu::with_items(app, "Help", true, &[])?;

    Menu::with_items(
        app,
        &[
            &app_menu,
            &file_menu,
            &edit_menu,
            &view_menu,
            &window_menu,
            &help_menu,
        ],
    )
}

#[cfg(not(target_os = "macos"))]
fn build_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    Menu::default(app)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .menu(build_menu)
        .on_menu_event(|app, event| {
            if event.id() == SETTINGS_MENU_ID {
                let _ = open_settings_window(app);
            }
        })
        .on_window_event(|window, event| {
            if matches!(event, WindowEvent::Moved(_) | WindowEvent::Resized(_)) {
                if let Some(state) = window.app_handle().try_state::<AppState>() {
                    let _ = persist_window_state(window, state.inner());
                }
            }
        })
        .setup(|app| {
            let app_state = db::init_app_state(app.handle())?;
            commands::translations::normalize_in_progress_jobs(&app_state).map_err(|error| {
                std::io::Error::new(std::io::ErrorKind::Other, error)
            })?;
            app.manage(app_state);

            if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
                let state = app.state::<AppState>();
                let _ = restore_window_state(&window, state.inner(), LIBRARY_WINDOW_STATE_KEY);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::books::import_book,
            commands::books::get_books,
            commands::books::get_book,
            commands::books::delete_book,
            commands::reader::open_reader_window,
            commands::reader::save_reading_position,
            commands::reader::get_reading_settings,
            commands::reader::update_reading_settings,
            commands::highlights::get_highlights,
            commands::highlights::add_highlight,
            commands::highlights::update_highlight,
            commands::highlights::delete_highlight,
            commands::notes::get_notes,
            commands::notes::save_note,
            commands::notes::update_note,
            commands::notes::delete_note,
            commands::settings::get_app_settings,
            commands::settings::save_app_settings,
            commands::settings::save_api_key,
            commands::settings::has_api_key,
            commands::settings::clear_api_key,
            commands::settings::test_openrouter_connection,
            commands::translations::start_translation,
            commands::translations::pause_translation,
            commands::translations::resume_translation,
            commands::translations::cancel_translation,
            commands::translations::get_translations,
            commands::translations::get_translation_job,
            commands::translations::retry_failed_paragraphs,
            commands::export::export_bilingual_epub
        ])
        .run(tauri::generate_context!())
        .expect("error while running Folio");
}

pub(crate) fn window_state_key_for_reader(book_id: &str) -> String {
    format!("window_state_{book_id}")
}

pub(crate) fn load_persisted_window_state(
    state: &AppState,
    key: &str,
) -> Result<Option<PersistedWindowState>, String> {
    let connection = state
        .db
        .lock()
        .map_err(|_| "SQLITE_LOCK_ERROR".to_string())?;

    let raw_value = connection
        .query_row(
            "SELECT value FROM app_settings WHERE key = ?1",
            params![key],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| error.to_string())?;

    raw_value
        .map(|value| {
            serde_json::from_str::<PersistedWindowState>(&value).map_err(|error| error.to_string())
        })
        .transpose()
}

pub(crate) fn restore_window_state<R: Runtime>(
    window: &WebviewWindow<R>,
    state: &AppState,
    key: &str,
) -> Result<(), String> {
    let Some(persisted_state) = load_persisted_window_state(state, key)? else {
        return Ok(());
    };

    window
        .set_size(Size::Physical(PhysicalSize::new(
            persisted_state.width,
            persisted_state.height,
        )))
        .map_err(|error| error.to_string())?;
    window
        .set_position(Position::Physical(PhysicalPosition::new(
            persisted_state.x,
            persisted_state.y,
        )))
        .map_err(|error| error.to_string())?;

    Ok(())
}

fn persist_window_state<R: Runtime>(window: &Window<R>, state: &AppState) -> Result<(), String> {
    let Some(key) = window_state_key_for_label(window.label()) else {
        return Ok(());
    };

    let position = window.inner_position().map_err(|error| error.to_string())?;
    let size = window.inner_size().map_err(|error| error.to_string())?;
    let persisted_state = PersistedWindowState {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
    };
    let serialized_state =
        serde_json::to_string(&persisted_state).map_err(|error| error.to_string())?;
    let connection = state
        .db
        .lock()
        .map_err(|_| "SQLITE_LOCK_ERROR".to_string())?;

    connection
        .execute(
            "INSERT INTO app_settings (key, value)
             VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, serialized_state],
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}

fn window_state_key_for_label(label: &str) -> Option<String> {
    match label {
        MAIN_WINDOW_LABEL => Some(LIBRARY_WINDOW_STATE_KEY.to_string()),
        SETTINGS_WINDOW_LABEL => Some(SETTINGS_WINDOW_STATE_KEY.to_string()),
        _ => label
            .strip_prefix("reader-")
            .map(window_state_key_for_reader),
    }
}

use std::{fs, path::PathBuf, sync::Mutex};

use rusqlite::Connection;
use tauri::{AppHandle, Manager, Runtime};

use crate::db::migrations::run_migrations;

pub mod migrations;
pub mod schema;

pub const APP_SUPPORT_DIRECTORY: &str = "Folio";
pub const DATABASE_FILENAME: &str = "folio.db";

pub type DbConn = Mutex<Connection>;

#[allow(dead_code)]
pub struct AppState {
    pub db: DbConn,
}

pub fn init_app_state<R: Runtime>(
    app_handle: &AppHandle<R>,
) -> Result<AppState, Box<dyn std::error::Error>> {
    let app_support_dir = resolve_app_support_dir(app_handle)?;

    fs::create_dir_all(&app_support_dir)?;

    let database_path = app_support_dir.join(DATABASE_FILENAME);
    let mut connection = Connection::open(database_path)?;

    configure_connection(&connection)?;
    run_migrations(&mut connection)?;

    Ok(AppState {
        db: Mutex::new(connection),
    })
}

fn resolve_app_support_dir<R: Runtime>(
    app_handle: &AppHandle<R>,
) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let home_dir = app_handle.path().home_dir()?;

    Ok(home_dir
        .join("Library")
        .join("Application Support")
        .join(APP_SUPPORT_DIRECTORY))
}

fn configure_connection(connection: &Connection) -> rusqlite::Result<()> {
    connection.execute_batch(
        "PRAGMA foreign_keys = ON;
         PRAGMA journal_mode = WAL;",
    )
}

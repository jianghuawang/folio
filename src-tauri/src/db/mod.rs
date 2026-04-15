use std::{fs, sync::Mutex};

use rusqlite::Connection;
use tauri::{AppHandle, Runtime};

use crate::{db::migrations::run_migrations, platform::paths};

pub mod migrations;
pub mod schema;

pub type DbConn = Mutex<Connection>;

#[allow(dead_code)]
pub struct AppState {
    pub db: DbConn,
}

pub fn init_app_state<R: Runtime>(app_handle: &AppHandle<R>) -> Result<AppState, String> {
    let app_support_dir = paths::app_data_root(app_handle)?;

    fs::create_dir_all(&app_support_dir).map_err(|error| error.to_string())?;

    let database_path = paths::database_path(app_handle)?;
    let mut connection = Connection::open(database_path).map_err(|error| error.to_string())?;

    configure_connection(&connection).map_err(|error| error.to_string())?;
    run_migrations(&mut connection).map_err(|error| error.to_string())?;

    Ok(AppState {
        db: Mutex::new(connection),
    })
}

fn configure_connection(connection: &Connection) -> rusqlite::Result<()> {
    connection.execute_batch(
        "PRAGMA foreign_keys = ON;
         PRAGMA journal_mode = WAL;",
    )
}

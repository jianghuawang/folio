use rusqlite::Connection;
use rusqlite_migration::{Migrations, M};

use crate::db::schema;

pub fn run_migrations(connection: &mut Connection) -> Result<(), rusqlite_migration::Error> {
    migrations().to_latest(connection)
}

fn migrations() -> Migrations<'static> {
    Migrations::new(vec![
        M::up(schema::BOOKS_SCHEMA),
        M::up(schema::HIGHLIGHTS_SCHEMA),
        M::up(schema::NOTES_SCHEMA),
        M::up(schema::TRANSLATIONS_SCHEMA),
        M::up(schema::TRANSLATION_JOBS_SCHEMA),
        M::up(schema::READING_SETTINGS_SCHEMA),
        M::up(schema::APP_SETTINGS_SCHEMA),
    ])
}

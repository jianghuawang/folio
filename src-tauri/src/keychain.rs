use keyring::{Entry, Error as KeyringError};

const SERVICE_NAME: &str = "com.folio.app";
const ACCOUNT_NAME: &str = "llm_api_key";

fn entry() -> Result<Entry, KeyringError> {
    Entry::new(SERVICE_NAME, ACCOUNT_NAME)
}

pub fn save_api_key(api_key: &str) -> Result<(), String> {
    let normalized_api_key = api_key.trim();
    entry()
        .and_then(|entry| entry.set_password(normalized_api_key))
        .map_err(|_| "KEYCHAIN_ERROR".to_string())
}

pub fn load_api_key() -> Result<Option<String>, String> {
    match entry()
        .and_then(|entry| entry.get_password())
        .map(|password| password.trim().to_string())
    {
        Ok(password) if password.is_empty() => Ok(None),
        Ok(password) => Ok(Some(password)),
        Err(KeyringError::NoEntry) => Ok(None),
        Err(_) => Err("KEYCHAIN_ERROR".to_string()),
    }
}

pub fn has_api_key() -> Result<bool, String> {
    load_api_key().map(|api_key| api_key.is_some())
}

pub fn clear_api_key() -> Result<(), String> {
    match entry().and_then(|entry| entry.delete_credential()) {
        Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
        Err(_) => Err("KEYCHAIN_ERROR".to_string()),
    }
}

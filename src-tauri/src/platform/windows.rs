use tauri::{AppHandle, Monitor, Runtime};

use crate::PersistedWindowState;

pub fn clamp_window_state<R: Runtime>(
    app_handle: &AppHandle<R>,
    persisted_state: &PersistedWindowState,
) -> Result<PersistedWindowState, String> {
    let monitor = select_monitor(app_handle, persisted_state)?;
    let work_area = monitor.work_area();
    let width = persisted_state.width.min(work_area.size.width.max(1));
    let height = persisted_state.height.min(work_area.size.height.max(1));
    let max_x = work_area.position.x + work_area.size.width.saturating_sub(width) as i32;
    let max_y = work_area.position.y + work_area.size.height.saturating_sub(height) as i32;

    Ok(PersistedWindowState {
        x: persisted_state.x.clamp(work_area.position.x, max_x),
        y: persisted_state.y.clamp(work_area.position.y, max_y),
        width,
        height,
    })
}

fn select_monitor<R: Runtime>(
    app_handle: &AppHandle<R>,
    persisted_state: &PersistedWindowState,
) -> Result<Monitor, String> {
    let center_x = persisted_state.x as f64 + f64::from(persisted_state.width) / 2.0;
    let center_y = persisted_state.y as f64 + f64::from(persisted_state.height) / 2.0;

    if let Some(monitor) = app_handle
        .monitor_from_point(center_x, center_y)
        .map_err(|error| error.to_string())?
    {
        return Ok(monitor);
    }

    let available_monitors = app_handle
        .available_monitors()
        .map_err(|error| error.to_string())?;

    if let Some(best_monitor) = available_monitors
        .iter()
        .max_by_key(|monitor| intersection_area(persisted_state, monitor))
        .cloned()
    {
        return Ok(best_monitor);
    }

    if let Some(primary_monitor) = app_handle
        .primary_monitor()
        .map_err(|error| error.to_string())?
    {
        return Ok(primary_monitor);
    }

    Err("WINDOW_MONITOR_UNAVAILABLE".to_string())
}

fn intersection_area(persisted_state: &PersistedWindowState, monitor: &Monitor) -> i64 {
    let work_area = monitor.work_area();
    let left = i64::from(persisted_state.x.max(work_area.position.x));
    let top = i64::from(persisted_state.y.max(work_area.position.y));
    let right = i64::from(
        (persisted_state.x + persisted_state.width as i32)
            .min(work_area.position.x + work_area.size.width as i32),
    );
    let bottom = i64::from(
        (persisted_state.y + persisted_state.height as i32)
            .min(work_area.position.y + work_area.size.height as i32),
    );

    let width = (right - left).max(0);
    let height = (bottom - top).max(0);

    width * height
}

#![allow(non_snake_case)]

use tauri::State;
use vrcx_0_application_realtime::AutoFollowStatus;

use crate::error::AppError;
use crate::state::AppState;

#[tauri::command(async)]
#[specta::specta]
pub fn app__auto_follow_start(
    state: State<'_, AppState>,
    user_id: String,
) -> Result<AutoFollowStatus, AppError> {
    Ok(state.runtime_host().auto_follow_start(&user_id)?)
}

#[tauri::command(async)]
#[specta::specta]
pub fn app__auto_follow_stop(state: State<'_, AppState>) -> Result<AutoFollowStatus, AppError> {
    Ok(state.runtime_host().auto_follow_stop())
}

#[tauri::command(async)]
#[specta::specta]
pub fn app__auto_follow_status(state: State<'_, AppState>) -> Result<AutoFollowStatus, AppError> {
    Ok(state.runtime_host().auto_follow_status())
}

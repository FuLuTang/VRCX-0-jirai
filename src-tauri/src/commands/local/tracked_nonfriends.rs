#![allow(non_snake_case)]

use tauri::State;
use vrcx_0_runtime_host_desktop::local_data::{
    TrackedNonFriendAddInput, TrackedNonFriendOutput, TrackedNonFriendUpdateNameInput,
};

use crate::error::AppError;
use crate::state::AppState;

#[tauri::command(async)]
#[specta::specta]
pub fn app__tracked_nonfriends_list(
    state: State<'_, AppState>,
) -> Result<Vec<TrackedNonFriendOutput>, AppError> {
    state
        .runtime_host()
        .local_data()
        .tracked_nonfriends_list()
        .map_err(AppError::from)
}

#[tauri::command(async)]
#[specta::specta]
pub fn app__tracked_nonfriends_add(
    state: State<'_, AppState>,
    input: TrackedNonFriendAddInput,
) -> Result<bool, AppError> {
    state
        .runtime_host()
        .local_data()
        .tracked_nonfriends_add(input)
        .map_err(AppError::from)
}

#[tauri::command(async)]
#[specta::specta]
pub fn app__tracked_nonfriends_remove(
    state: State<'_, AppState>,
    user_id: String,
) -> Result<bool, AppError> {
    state
        .runtime_host()
        .local_data()
        .tracked_nonfriends_remove(user_id)
        .map_err(AppError::from)
}

#[tauri::command(async)]
#[specta::specta]
pub fn app__tracked_nonfriends_is_tracked(
    state: State<'_, AppState>,
    user_id: String,
) -> Result<bool, AppError> {
    state
        .runtime_host()
        .local_data()
        .tracked_nonfriends_is_tracked(user_id)
        .map_err(AppError::from)
}

#[tauri::command(async)]
#[specta::specta]
pub fn app__tracked_nonfriends_update_name(
    state: State<'_, AppState>,
    input: TrackedNonFriendUpdateNameInput,
) -> Result<bool, AppError> {
    state
        .runtime_host()
        .local_data()
        .tracked_nonfriends_update_name(input)
        .map_err(AppError::from)
}

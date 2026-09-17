#![allow(non_snake_case)]

use tauri::State;
use vrcx_0_application::social::{
    MutualGraphFetchCancelInput, MutualGraphFetchStartInput, MutualGraphFetchStatus,
    MutualGraphFriendRefreshInput, MutualGraphFriendRefreshOutput, UserMutualFriendsListInput,
    UserMutualFriendsListOutput,
};
use vrcx_0_runtime_host_desktop::local_data::{
    ManualRelationOutput, MutualGraphSnapshotOutput,
};

use crate::commands::blocking::run_blocking;
use crate::error::AppError;
use crate::state::AppState;

#[tauri::command]
#[specta::specta]
pub async fn app__mutual_graph_snapshot_get(
    state: State<'_, AppState>,
    user_id: String,
) -> Result<MutualGraphSnapshotOutput, AppError> {
    let local_data = state.runtime_host().local_data().clone();
    run_blocking("mutual graph snapshot", move || {
        local_data.mutual_graph_snapshot_get(user_id)
    })
    .await
}

#[tauri::command]
#[specta::specta]
pub async fn app__manual_relations_list(
    state: State<'_, AppState>,
) -> Result<Vec<ManualRelationOutput>, AppError> {
    let local_data = state.runtime_host().local_data().clone();
    run_blocking("manual relations list", move || local_data.manual_relations_list()).await
}

#[tauri::command]
#[specta::specta]
pub async fn app__manual_relations_for_user(
    state: State<'_, AppState>,
    user_id: String,
) -> Result<Vec<ManualRelationOutput>, AppError> {
    let local_data = state.runtime_host().local_data().clone();
    run_blocking("manual relations for user", move || {
        local_data.manual_relations_for_user(user_id)
    })
    .await
}

#[tauri::command]
#[specta::specta]
pub async fn app__manual_relation_add(
    state: State<'_, AppState>,
    user_id_a: String,
    user_id_b: String,
    relation_type: String,
) -> Result<(), AppError> {
    let local_data = state.runtime_host().local_data().clone();
    run_blocking("manual relation add", move || {
        local_data.manual_relation_add(user_id_a, user_id_b, relation_type)
    })
    .await
}

#[tauri::command]
#[specta::specta]
pub async fn app__manual_relation_remove(
    state: State<'_, AppState>,
    user_id_a: String,
    user_id_b: String,
) -> Result<(), AppError> {
    let local_data = state.runtime_host().local_data().clone();
    run_blocking("manual relation remove", move || {
        local_data.manual_relation_remove(user_id_a, user_id_b)
    })
    .await
}

#[tauri::command(async)]
#[specta::specta]
pub fn app__mutual_graph_fetch_status_get(state: State<'_, AppState>) -> MutualGraphFetchStatus {
    state
        .runtime_host()
        .local_data()
        .mutual_graph_fetch_status()
}

#[tauri::command(async)]
#[specta::specta]
pub fn app__mutual_graph_fetch_cancel(
    state: State<'_, AppState>,
    input: MutualGraphFetchCancelInput,
) -> Result<MutualGraphFetchStatus, AppError> {
    state
        .runtime_host()
        .local_data()
        .mutual_graph_fetch_cancel(input)
        .map_err(AppError::from)
}

#[tauri::command(async)]
#[specta::specta]
pub fn app__mutual_graph_fetch_start(
    state: State<'_, AppState>,
    input: MutualGraphFetchStartInput,
) -> Result<MutualGraphFetchStatus, AppError> {
    state
        .runtime_host()
        .local_data()
        .mutual_graph_fetch_start(input)
        .map_err(AppError::from)
}

#[tauri::command]
#[specta::specta]
pub async fn app__mutual_graph_friend_refresh(
    state: State<'_, AppState>,
    input: MutualGraphFriendRefreshInput,
) -> Result<MutualGraphFriendRefreshOutput, AppError> {
    Ok(state
        .runtime_host()
        .local_data()
        .mutual_graph_friend_refresh(input)
        .await?)
}

#[tauri::command]
#[specta::specta]
pub async fn app__user_mutual_friends_list_get(
    state: State<'_, AppState>,
    input: UserMutualFriendsListInput,
) -> Result<UserMutualFriendsListOutput, AppError> {
    Ok(state
        .runtime_host()
        .local_data()
        .user_mutual_friends_list(input)
        .await?)
}

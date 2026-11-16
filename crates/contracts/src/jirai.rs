//! IPC DTOs for Jirai fork features (tracked non-friends, mutual-graph extras,
//! profile Feed reconciliation and startup Online backfill). Kept in one module
//! so upstream contract changes rarely touch fork code.

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct TrackedNonFriendOutput {
    pub user_id: String,
    pub display_name: String,
    pub added_at: String,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct TrackedNonFriendAddInput {
    pub user_id: String,
    #[serde(default)]
    pub display_name: String,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct TrackedNonFriendUpdateNameInput {
    pub user_id: String,
    #[serde(default)]
    pub display_name: String,
}

/// A partial profile observation. `bio`/`status` are optional so a sweep that
/// did not look at one of them never overwrites the recorded value.
#[derive(Clone, Debug, Default, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ProfileFeedReconcileInput {
    /// The account the renderer prepared this request for. Empty means the
    /// caller relied on the host's own authenticated owner.
    #[serde(default)]
    pub expected_owner_user_id: String,
    pub user_id: String,
    pub display_name: String,
    #[serde(default)]
    pub bio: Option<String>,
    #[serde(default)]
    pub status: String,
    #[serde(default)]
    pub status_description: String,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ProfileFeedReconcileOutput {
    pub bio_updated: bool,
    pub status_updated: bool,
}

/// A renderer request for an observed online friend. The host independently
/// verifies the current realtime friend record and creates the timestamp.
#[derive(Clone, Debug, Default, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct StartupOnlineBackfillInput {
    #[serde(default)]
    pub expected_owner_user_id: String,
    pub target_user_id: String,
    pub display_name: String,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct StartupOnlineBackfillOutput {
    pub inserted: bool,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct SelfStatusHistoryInput {
    pub expected_owner_user_id: String,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct SelfBioHistoryInput {
    pub expected_owner_user_id: String,
}

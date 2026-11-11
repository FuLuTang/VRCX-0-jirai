//! IPC DTOs for Jirai fork features (tracked non-friends, manual relations,
//! profile Feed reconciliation and startup Online backfill). Kept in one
//! module so upstream contract changes rarely touch fork code.

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct TrackedNonFriendOutput {
    #[serde(alias = "user_id")]
    pub user_id: String,
    #[serde(alias = "display_name")]
    pub display_name: String,
    #[serde(alias = "added_at")]
    pub added_at: String,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct TrackedNonFriendAddInput {
    #[serde(alias = "user_id")]
    pub user_id: String,
    #[serde(default, alias = "display_name")]
    pub display_name: String,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct TrackedNonFriendUpdateNameInput {
    #[serde(alias = "user_id")]
    pub user_id: String,
    #[serde(default, alias = "display_name")]
    pub display_name: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ManualRelationOutput {
    pub user_id_a: String,
    pub user_id_b: String,
    pub relation_type: String,
    pub added_at: String,
}

#[derive(Debug, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ProfileFeedReconcileInput {
    pub user_id: String,
    pub display_name: String,
    #[serde(default)]
    pub bio: String,
    #[serde(default)]
    pub status: String,
    #[serde(default)]
    pub status_description: String,
}

#[derive(Debug, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ProfileFeedReconcileOutput {
    pub bio_updated: bool,
    pub status_updated: bool,
}

/// A renderer request for an observed online friend. The host independently
/// verifies the current realtime friend record and creates the timestamp.
#[derive(Debug, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct StartupOnlineBackfillInput {
    pub target_user_id: String,
    pub display_name: String,
}

#[derive(Debug, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct StartupOnlineBackfillOutput {
    pub inserted: bool,
}

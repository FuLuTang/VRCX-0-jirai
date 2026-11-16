use serde::{Deserialize, Serialize};

#[derive(Clone, Debug)]
pub struct MutualGraphSnapshotEntryInput {
    pub friend_id: String,
    pub mutual_ids: Vec<String>,
}

#[derive(Clone, Debug)]
pub struct MutualGraphMetaInput {
    pub friend_id: String,
    pub last_fetched_at: String,
    pub opted_out: bool,
    pub total_count: Option<usize>,
}

#[derive(Clone, Debug, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct MutualGraphLinkOutput {
    pub friend_id: String,
    pub mutual_id: String,
}

#[derive(Clone, Debug, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct MutualGraphHistoricalLinkOutput {
    pub friend_id: String,
    pub mutual_id: String,
    pub date: String,
}

#[derive(Clone, Debug, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct MutualGraphMetaOutput {
    pub friend_id: String,
    pub last_fetched_at: String,
    pub opted_out: bool,
    pub total_count: Option<u32>,
}

#[derive(Clone, Debug, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct MutualGraphSnapshotOutput {
    pub friend_ids: Vec<String>,
    pub links: Vec<MutualGraphLinkOutput>,
    /// Every archived observation, so the graph can show which links already
    /// disappeared from the current snapshot.
    #[serde(default)]
    pub historical_links: Vec<MutualGraphHistoricalLinkOutput>,
    pub meta: Vec<MutualGraphMetaOutput>,
}

#[derive(Clone, Debug, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct MutualGraphHistoryOutput {
    pub last_successful_at: Option<String>,
    pub links: Vec<MutualGraphHistoricalLinkOutput>,
}

#[derive(Clone, Debug, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct MutualGraphTrackedUserOutput {
    pub user_id: String,
    pub display_name: String,
    pub added_at: String,
}

#[derive(Clone, Debug, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct MutualGraphManualLinkOutput {
    pub user_id_a: String,
    pub user_id_b: String,
    pub relation_type: String,
    pub added_at: String,
}

#[derive(Clone, Debug, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct MutualGraphExtrasOutput {
    pub tracked_users: Vec<MutualGraphTrackedUserOutput>,
    pub manual_links: Vec<MutualGraphManualLinkOutput>,
}

#[derive(Clone, Debug, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct MutualGraphTrackedUserSetInput {
    pub owner_user_id: String,
    pub user_id: String,
    #[serde(default)]
    pub display_name: String,
    pub tracked: bool,
}

#[derive(Clone, Debug, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct MutualGraphManualLinkSetInput {
    pub owner_user_id: String,
    pub user_id_a: String,
    pub user_id_b: String,
    pub related: bool,
}

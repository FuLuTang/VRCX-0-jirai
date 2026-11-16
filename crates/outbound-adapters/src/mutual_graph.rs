use std::sync::Arc;

use vrcx_0_application::social::{
    MutualGraphMetaInput, MutualGraphObservationInput, MutualGraphSnapshotEntryInput,
    MutualGraphSnapshotOutput, MutualGraphStore,
};
use vrcx_0_application_core::Result;
use vrcx_0_persistence::{mutual_graph, DatabaseService};

pub struct LocalMutualGraphStore {
    db: Arc<DatabaseService>,
}

impl LocalMutualGraphStore {
    pub fn new(db: Arc<DatabaseService>) -> Self {
        Self { db }
    }
}

impl MutualGraphStore for LocalMutualGraphStore {
    fn archive_observation(
        &self,
        owner_user_id: String,
        friend_id: String,
        mutual_ids: Vec<String>,
        observed_at: String,
    ) -> Result<()> {
        mutual_graph::mutual_graph_observation_archive(
            &self.db,
            owner_user_id,
            friend_id,
            mutual_ids,
            observed_at,
        )
        .map_err(crate::Error::from)
    }

    fn friend_refresh_commit(
        &self,
        owner_user_id: String,
        friend_id: String,
        mutual_ids: Option<Vec<String>>,
        total_count: Option<usize>,
        opted_out: bool,
        observed_at: Option<String>,
    ) -> Result<()> {
        mutual_graph::mutual_graph_friend_refresh_commit(
            &self.db,
            owner_user_id,
            friend_id,
            mutual_ids,
            total_count,
            opted_out,
            observed_at,
        )
        .map_err(crate::Error::from)
    }

    fn snapshot_get(&self, owner_user_id: String) -> Result<MutualGraphSnapshotOutput> {
        mutual_graph::mutual_graph_snapshot_get(&self.db, owner_user_id).map_err(crate::Error::from)
    }

    fn snapshot_commit(
        &self,
        owner_user_id: String,
        entries: Vec<MutualGraphSnapshotEntryInput>,
        meta: Vec<MutualGraphMetaInput>,
        observations: Vec<MutualGraphObservationInput>,
        replace_missing: bool,
        scope_ids: Vec<String>,
    ) -> Result<()> {
        mutual_graph::mutual_graph_snapshot_commit(
            &self.db,
            owner_user_id,
            entries
                .into_iter()
                .map(|entry| mutual_graph::MutualGraphSnapshotEntryInput {
                    friend_id: entry.friend_id,
                    mutual_ids: entry.mutual_ids,
                })
                .collect(),
            meta.into_iter()
                .map(|entry| mutual_graph::MutualGraphMetaInput {
                    friend_id: entry.friend_id,
                    last_fetched_at: entry.last_fetched_at,
                    opted_out: entry.opted_out,
                    total_count: entry.total_count,
                })
                .collect(),
            observations
                .into_iter()
                .map(|observation| mutual_graph::MutualGraphObservationInput {
                    friend_id: observation.friend_id,
                    mutual_ids: observation.mutual_ids,
                    observed_at: observation.observed_at,
                })
                .collect(),
            replace_missing,
            scope_ids,
        )
        .map_err(crate::Error::from)
    }
}

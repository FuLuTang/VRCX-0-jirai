use std::sync::Arc;

use vrcx_0_application::social::QuickSearchDetailStore;
use vrcx_0_application::social::{
    QuickSearchRecentStore, QuickSearchRecentUserRow, QuickSearchRecentWorldRow,
};
use vrcx_0_application_core::Result;
use vrcx_0_core::OwnerId;
use vrcx_0_persistence::{
    memos::{memo_list_user_notes, memo_list_users},
    profile_bio::profile_bio_list,
    quick_search_recent::{quick_search_recent_joined_worlds, quick_search_recent_met_users},
    DatabaseService,
};

pub struct LocalQuickSearchDetailStore {
    db: Arc<DatabaseService>,
}

impl LocalQuickSearchDetailStore {
    pub fn new(db: Arc<DatabaseService>) -> Self {
        Self { db }
    }
}

impl QuickSearchDetailStore for LocalQuickSearchDetailStore {
    fn user_memos(&self) -> Result<Vec<(String, String)>> {
        memo_list_users(&self.db)
            .map(|rows| {
                rows.into_iter()
                    .map(|row| (row.user_id, row.memo))
                    .collect()
            })
            .map_err(crate::Error::from)
    }

    fn user_notes(&self, owner: OwnerId) -> Result<Vec<(String, String)>> {
        memo_list_user_notes(&self.db, owner)
            .map(|rows| {
                rows.into_iter()
                    .map(|row| (row.user_id, row.note))
                    .collect()
            })
            .map_err(crate::Error::from)
    }

    fn user_bios(&self, owner: OwnerId) -> Result<Vec<(String, String)>> {
        profile_bio_list(&self.db, &owner)
            .map(|rows| {
                rows.into_iter()
                    .filter(|row| !row.bio.trim().is_empty())
                    .map(|row| (row.user_id, row.bio))
                    .collect()
            })
            .map_err(crate::Error::from)
    }
}

/// Read-only recent sources for the empty quick search (#17), backed by
/// `vrcx_0_persistence::quick_search_recent`.
pub struct LocalQuickSearchRecentStore {
    db: Arc<DatabaseService>,
}

impl LocalQuickSearchRecentStore {
    pub fn new(db: Arc<DatabaseService>) -> Self {
        Self { db }
    }
}

impl QuickSearchRecentStore for LocalQuickSearchRecentStore {
    fn recent_met_users(
        &self,
        owner: OwnerId,
        limit: usize,
    ) -> Result<Vec<QuickSearchRecentUserRow>> {
        quick_search_recent_met_users(&self.db, &owner, limit)
            .map(|rows| {
                rows.into_iter()
                    .map(|row| QuickSearchRecentUserRow {
                        user_id: row.user_id,
                        display_name: row.display_name,
                    })
                    .collect()
            })
            .map_err(crate::Error::from)
    }

    fn recent_joined_worlds(
        &self,
        owner: OwnerId,
        limit: usize,
    ) -> Result<Vec<QuickSearchRecentWorldRow>> {
        quick_search_recent_joined_worlds(&self.db, &owner, limit)
            .map(|rows| {
                rows.into_iter()
                    .map(|row| QuickSearchRecentWorldRow {
                        world_id: row.world_id,
                        world_name: row.world_name,
                        location: row.location,
                    })
                    .collect()
            })
            .map_err(crate::Error::from)
    }
}

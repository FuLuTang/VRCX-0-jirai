use std::sync::Arc;

use vrcx_0_application::social::QuickSearchDetailStore;
use vrcx_0_application_core::Result;
use vrcx_0_core::OwnerId;
use vrcx_0_persistence::{
    memos::{memo_list_user_notes, memo_list_users},
    profile_bio::profile_bio_list,
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

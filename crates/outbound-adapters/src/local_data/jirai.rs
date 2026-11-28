//! Jirai fork queries behind the local data store: tracked non-friends,
//! mutual-graph extras, profile Feed reconciliation, self profile history and
//! startup Online backfill.

use vrcx_0_contracts::feed::FeedRowOutput;
use vrcx_0_contracts::feed_live::FeedLiveEntry;
use vrcx_0_contracts::jirai::{
    ProfileFeedReconcileInput, ProfileFeedReconcileOutput, SelfBioHistoryInput,
    SelfStatusHistoryInput, TrackedNonFriendAddInput, TrackedNonFriendOutput,
    TrackedNonFriendUpdateNameInput,
};
use vrcx_0_contracts::mutual_graph::{
    MutualGraphExtrasOutput, MutualGraphHistoryOutput, MutualGraphManualLinkSetInput,
    MutualGraphTrackedUserSetInput,
};
use vrcx_0_core::OwnerId;

use super::LocalDataStore;
use crate::Result;

impl LocalDataStore {
    pub fn tracked_nonfriends_list(&self, owner: &OwnerId) -> Result<Vec<TrackedNonFriendOutput>> {
        Ok(
            vrcx_0_persistence::tracked_nonfriends::tracked_nonfriends_list(
                self.db.as_ref(),
                owner,
            )?,
        )
    }

    pub fn tracked_nonfriends_add(
        &self,
        owner: &OwnerId,
        input: TrackedNonFriendAddInput,
    ) -> Result<bool> {
        Ok(
            vrcx_0_persistence::tracked_nonfriends::tracked_nonfriends_add(
                self.db.as_ref(),
                owner,
                input,
            )?,
        )
    }

    pub fn tracked_nonfriends_remove(&self, owner: &OwnerId, user_id: String) -> Result<bool> {
        Ok(
            vrcx_0_persistence::tracked_nonfriends::tracked_nonfriends_remove(
                self.db.as_ref(),
                owner,
                user_id,
            )?,
        )
    }

    pub fn tracked_nonfriends_is_tracked(&self, owner: &OwnerId, user_id: String) -> Result<bool> {
        Ok(
            vrcx_0_persistence::tracked_nonfriends::tracked_nonfriends_is_tracked(
                self.db.as_ref(),
                owner,
                user_id,
            )?,
        )
    }

    pub fn tracked_nonfriends_update_name(
        &self,
        owner: &OwnerId,
        input: TrackedNonFriendUpdateNameInput,
    ) -> Result<bool> {
        Ok(
            vrcx_0_persistence::tracked_nonfriends::tracked_nonfriends_update_name(
                self.db.as_ref(),
                owner,
                input,
            )?,
        )
    }

    /// Archived mutual-graph observations for one friend.
    pub fn mutual_graph_history_get(
        &self,
        owner: &OwnerId,
        friend_id: String,
    ) -> Result<MutualGraphHistoryOutput> {
        Ok(vrcx_0_persistence::mutual_graph::mutual_graph_history_get(
            self.db.as_ref(),
            owner.as_str().to_string(),
            friend_id,
        )?)
    }

    /// Tracked non-friends plus manual relations that the mutual-friends graph
    /// needs in addition to the persisted snapshot.
    pub fn mutual_graph_extras_get(&self, owner: &OwnerId) -> Result<MutualGraphExtrasOutput> {
        Ok(vrcx_0_persistence::mutual_graph::mutual_graph_extras_get(
            self.db.as_ref(),
            owner.as_str().to_string(),
        )?)
    }

    pub fn mutual_graph_tracked_user_set(
        &self,
        owner: &OwnerId,
        input: MutualGraphTrackedUserSetInput,
    ) -> Result<()> {
        Ok(
            vrcx_0_persistence::mutual_graph::mutual_graph_tracked_user_set(
                self.db.as_ref(),
                owner.as_str().to_string(),
                input.user_id,
                input.display_name,
                input.tracked,
            )?,
        )
    }

    pub fn mutual_graph_manual_link_set(
        &self,
        owner: &OwnerId,
        input: MutualGraphManualLinkSetInput,
    ) -> Result<()> {
        Ok(
            vrcx_0_persistence::mutual_graph::mutual_graph_manual_link_set(
                self.db.as_ref(),
                owner.as_str().to_string(),
                input.user_id_a,
                input.user_id_b,
                input.related,
            )?,
        )
    }

    /// Appends an observed-now Online edge unless the owner's latest
    /// Online/Offline Feed state is already Online. The caller must have
    /// verified the target against the realtime friend snapshot.
    pub fn startup_online_backfill_entry(
        &self,
        owner: &OwnerId,
        target_user_id: &str,
        display_name: &str,
    ) -> Result<Option<FeedLiveEntry>> {
        Ok(
            vrcx_0_persistence::realtime::insert_startup_online_backfill_with_entry(
                self.db.as_ref(),
                owner,
                target_user_id,
                display_name,
            )?,
        )
    }

    /// Reconciles one profile observation and returns the entries that were
    /// committed, so the host can project them onto the live Feed.
    pub fn profile_feed_reconcile_with_entries(
        &self,
        owner: &OwnerId,
        input: ProfileFeedReconcileInput,
    ) -> Result<(ProfileFeedReconcileOutput, Vec<FeedLiveEntry>)> {
        Ok(
            vrcx_0_persistence::realtime::profile_feed_reconcile_with_entries(
                self.db.as_ref(),
                owner,
                input,
            )?,
        )
    }

    pub fn self_status_history(
        &self,
        owner: &OwnerId,
        input: SelfStatusHistoryInput,
    ) -> Result<Vec<FeedRowOutput>> {
        vrcx_0_persistence::realtime::validate_self_profile_owner(
            &input.expected_owner_user_id,
            owner,
        )?;
        Ok(vrcx_0_persistence::realtime::self_status_history(
            self.db.as_ref(),
            owner,
        )?)
    }

    pub fn self_bio_history(
        &self,
        owner: &OwnerId,
        input: SelfBioHistoryInput,
    ) -> Result<Vec<FeedRowOutput>> {
        vrcx_0_persistence::realtime::validate_self_profile_owner(
            &input.expected_owner_user_id,
            owner,
        )?;
        Ok(vrcx_0_persistence::realtime::self_bio_history(
            self.db.as_ref(),
            owner,
        )?)
    }
}

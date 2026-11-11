//! Jirai fork queries behind the local data store: tracked non-friends,
//! manual relations, profile Feed reconciliation and startup Online backfill.

use vrcx_0_contracts::jirai::{
    ManualRelationOutput, ProfileFeedReconcileInput, ProfileFeedReconcileOutput,
    TrackedNonFriendAddInput, TrackedNonFriendOutput, TrackedNonFriendUpdateNameInput,
};
use vrcx_0_core::OwnerId;

use super::LocalDataStore;
use crate::Result;

impl LocalDataStore {
    pub fn tracked_nonfriends_list(&self, owner: &OwnerId) -> Result<Vec<TrackedNonFriendOutput>> {
        Ok(vrcx_0_persistence::tracked_nonfriends::tracked_nonfriends_list(
            self.db.as_ref(),
            owner,
        )?)
    }

    pub fn tracked_nonfriends_add(
        &self,
        owner: &OwnerId,
        input: TrackedNonFriendAddInput,
    ) -> Result<bool> {
        Ok(vrcx_0_persistence::tracked_nonfriends::tracked_nonfriends_add(
            self.db.as_ref(),
            owner,
            input,
        )?)
    }

    pub fn tracked_nonfriends_remove(&self, owner: &OwnerId, user_id: String) -> Result<bool> {
        Ok(vrcx_0_persistence::tracked_nonfriends::tracked_nonfriends_remove(
            self.db.as_ref(),
            owner,
            user_id,
        )?)
    }

    pub fn tracked_nonfriends_is_tracked(&self, owner: &OwnerId, user_id: String) -> Result<bool> {
        Ok(vrcx_0_persistence::tracked_nonfriends::tracked_nonfriends_is_tracked(
            self.db.as_ref(),
            owner,
            user_id,
        )?)
    }

    pub fn tracked_nonfriends_update_name(
        &self,
        owner: &OwnerId,
        input: TrackedNonFriendUpdateNameInput,
    ) -> Result<bool> {
        Ok(vrcx_0_persistence::tracked_nonfriends::tracked_nonfriends_update_name(
            self.db.as_ref(),
            owner,
            input,
        )?)
    }

    pub fn manual_relations_list(&self, owner: &OwnerId) -> Result<Vec<ManualRelationOutput>> {
        Ok(vrcx_0_persistence::manual_relations::manual_relations_list(
            self.db.as_ref(),
            owner.clone(),
        )?)
    }

    pub fn manual_relations_for_user(
        &self,
        owner: &OwnerId,
        user_id: String,
    ) -> Result<Vec<ManualRelationOutput>> {
        Ok(vrcx_0_persistence::manual_relations::manual_relations_for_user(
            self.db.as_ref(),
            owner.clone(),
            user_id,
        )?)
    }

    pub fn manual_relation_add(
        &self,
        owner: &OwnerId,
        user_id_a: String,
        user_id_b: String,
        relation_type: String,
    ) -> Result<()> {
        Ok(vrcx_0_persistence::manual_relations::manual_relation_add(
            self.db.as_ref(),
            owner.clone(),
            user_id_a,
            user_id_b,
            relation_type,
        )?)
    }

    pub fn manual_relation_remove(
        &self,
        owner: &OwnerId,
        user_id_a: String,
        user_id_b: String,
    ) -> Result<()> {
        Ok(vrcx_0_persistence::manual_relations::manual_relation_remove(
            self.db.as_ref(),
            owner.clone(),
            user_id_a,
            user_id_b,
        )?)
    }

    /// Appends an observed-now Online edge unless the owner's latest
    /// Online/Offline Feed state is already Online. The caller must have
    /// verified the target against the realtime friend snapshot.
    pub fn startup_online_backfill_insert(
        &self,
        owner: &OwnerId,
        target_user_id: &str,
        display_name: &str,
    ) -> Result<bool> {
        Ok(vrcx_0_persistence::realtime::insert_startup_online_backfill(
            self.db.as_ref(),
            owner,
            target_user_id,
            display_name,
        )?)
    }

    pub fn profile_feed_reconcile(
        &self,
        owner: &OwnerId,
        input: ProfileFeedReconcileInput,
    ) -> Result<ProfileFeedReconcileOutput> {
        Ok(vrcx_0_persistence::realtime::profile_feed_reconcile(
            self.db.as_ref(),
            owner,
            input,
        )?)
    }
}

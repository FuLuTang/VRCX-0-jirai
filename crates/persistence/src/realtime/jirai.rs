//! Jirai fork: owner-scoped Feed writes that are not part of upstream's
//! realtime batch pipeline. Kept apart from `write.rs` so upstream merges do
//! not have to touch this code.

use serde_json::Value;
use vrcx_0_contracts::feed_live::FeedLiveEntry;
use vrcx_0_contracts::jirai::{ProfileFeedReconcileInput, ProfileFeedReconcileOutput};

use crate::common::ParamsBuilder;
use crate::database::DatabaseService;
use crate::feed::insert_feed_entry;
use crate::ownership::OwnerId;
use crate::Error;

use super::schema::{ensure_realtime_tables, normalize_user_table_prefix};

fn normalize_user_id(value: &str) -> String {
    value.trim().to_string()
}

/// Inserts a startup Online edge only when the owner-scoped persisted state
/// does not already end in Online. The read and conditional write share one
/// SQLite write transaction so repeated or concurrent callers cannot create a
/// duplicate startup edge.
pub fn insert_startup_online_backfill(
    db: &DatabaseService,
    owner_user_id: &OwnerId,
    target_user_id: &str,
    display_name: &str,
) -> Result<bool, Error> {
    let owner_user_id = OwnerId::new(normalize_user_id(owner_user_id.as_str()));
    if owner_user_id.is_empty() {
        return Err(Error::Database(
            "Startup online backfill requires a current user id.".into(),
        ));
    }
    let target_user_id = normalize_user_id(target_user_id);
    if target_user_id.is_empty() {
        return Err(Error::InvalidData(
            "Startup online backfill requires a target user id.".into(),
        ));
    }

    let user_prefix = normalize_user_table_prefix(owner_user_id.as_str())?;
    ensure_realtime_tables(db, &user_prefix)?;
    db.write_transaction(|tx| {
        // The realtime snapshot confirms online state at the host boundary, but
        // this transactional membership check prevents an arbitrary renderer
        // target id from being written when that snapshot is stale or absent.
        let membership = tx.execute(
            &format!(
                "SELECT 1 FROM {user_prefix}_friend_log_current WHERE user_id = @user_id LIMIT 1"
            ),
            &ParamsBuilder::new()
                .set("user_id", target_user_id.clone())
                .build(),
        )?;
        if membership.is_empty() {
            return Err(Error::InvalidData(
                "Startup online backfill target is not a current friend.".into(),
            ));
        }

        let latest = tx.execute(
            &format!(
                "SELECT type FROM {user_prefix}_feed_online_offline WHERE user_id = @user_id AND type IN ('Online', 'Offline') ORDER BY created_at DESC, id DESC LIMIT 1"
            ),
            &ParamsBuilder::new()
                .set("user_id", target_user_id.clone())
                .build(),
        )?;
        let last_type = latest
            .first()
            .and_then(|row| row.first())
            .and_then(Value::as_str)
            .unwrap_or("");
        if last_type == "Online" {
            return Ok(false);
        }

        // Never accept a renderer timestamp: this is the native confirmation
        // time at the immediate persistence boundary.
        let created_at = vrcx_0_core::time::now_iso();
        tx.execute_non_query(
            &format!(
                "INSERT INTO {user_prefix}_feed_online_offline (created_at, user_id, display_name, type, location, world_name, time, group_name) VALUES (@created_at, @user_id, @display_name, 'Online', '', '', 0, '')"
            ),
            &ParamsBuilder::new()
                .set("created_at", created_at)
                .set("user_id", target_user_id)
                .set("display_name", display_name.trim())
                .build(),
        )?;
        Ok(true)
    })
}

pub fn profile_feed_reconcile(
    db: &DatabaseService,
    owner_user_id: &OwnerId,
    input: ProfileFeedReconcileInput,
) -> Result<ProfileFeedReconcileOutput, Error> {
    let owner_user_id = OwnerId::new(normalize_user_id(owner_user_id.as_str()));
    if owner_user_id.is_empty() {
        return Err(Error::Database("Profile feed reconciliation requires a current user id.".into()));
    }
    let user_id = normalize_user_id(&input.user_id);
    if user_id.is_empty() {
        return Err(Error::InvalidData("Profile feed reconciliation requires a user id.".into()));
    }
    let user_prefix = normalize_user_table_prefix(owner_user_id.as_str())?;
    ensure_realtime_tables(db, &user_prefix)?;
    db.write_transaction(|tx| {
        let bio_rows = tx.execute(
            &format!("SELECT bio FROM {user_prefix}_feed_bio WHERE user_id = @user_id ORDER BY created_at DESC, id DESC LIMIT 1"),
            &ParamsBuilder::new().set("user_id", user_id.clone()).build(),
        )?;
        let has_bio = !bio_rows.is_empty();
        let previous_bio = bio_rows.first().and_then(|row| row.first()).and_then(Value::as_str).unwrap_or("").to_string();
        let status_rows = tx.execute(
            &format!("SELECT status, status_description FROM {user_prefix}_feed_status WHERE user_id = @user_id ORDER BY created_at DESC, id DESC LIMIT 1"),
            &ParamsBuilder::new().set("user_id", user_id.clone()).build(),
        )?;
        let has_status = !status_rows.is_empty();
        let previous_status = status_rows.first().and_then(|row| row.first()).and_then(Value::as_str).unwrap_or("").to_string();
        let previous_status_description = status_rows.first().and_then(|row| row.get(1)).and_then(Value::as_str).unwrap_or("").to_string();
        let status = input.status.trim().to_lowercase();
        let bio_updated = !has_bio || previous_bio != input.bio;
        let status_updated = ["join me", "active", "ask me", "busy"].contains(&status.as_str())
            && (!has_status || previous_status != status || previous_status_description != input.status_description);
        let created_at = vrcx_0_core::time::now_iso();
        if bio_updated {
            insert_feed_entry(tx, &user_prefix, &FeedLiveEntry::Bio { created_at: created_at.clone(), user_id: user_id.clone(), display_name: input.display_name.clone(), bio: input.bio.clone(), previous_bio, owner_user_id: owner_user_id.as_str().to_string() })?;
        }
        if status_updated {
            insert_feed_entry(tx, &user_prefix, &FeedLiveEntry::Status { created_at, user_id: user_id.clone(), display_name: input.display_name.clone(), status, status_description: input.status_description.clone(), previous_status, previous_status_description, owner_user_id: owner_user_id.as_str().to_string() })?;
        }
        Ok(ProfileFeedReconcileOutput { bio_updated, status_updated })
    })
}

#[cfg(test)]
mod tests;

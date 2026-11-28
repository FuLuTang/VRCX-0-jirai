//! Jirai fork: owner-scoped Feed writes that are not part of upstream's
//! realtime batch pipeline. Kept apart from `write.rs` so upstream merges do
//! not have to touch this code.

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

/// Rejects a renderer request that was prepared for a different account. An
/// empty expectation is accepted so legacy callers that never sent one keep
/// working; the host still binds every write to its own authenticated owner.
fn validate_expected_owner(expected: &str, owner_user_id: &OwnerId) -> Result<(), Error> {
    let expected = expected.trim();
    if !expected.is_empty() && expected != owner_user_id.as_str() {
        return Err(Error::InvalidData(
            "Profile feed reconciliation owner does not match the active account.".into(),
        ));
    }
    Ok(())
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
    insert_startup_online_backfill_with_entry(db, owner_user_id, target_user_id, display_name)
        .map(|entry| entry.is_some())
}

/// Returns the exact committed observation for the host's live Feed projection.
pub fn insert_startup_online_backfill_with_entry(
    db: &DatabaseService,
    owner_user_id: &OwnerId,
    target_user_id: &str,
    display_name: &str,
) -> Result<Option<FeedLiveEntry>, Error> {
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
            .and_then(serde_json::Value::as_str)
            .unwrap_or("");
        if last_type == "Online" {
            return Ok(None);
        }

        // Never accept a renderer timestamp: this is the native confirmation
        // time at the immediate persistence boundary.
        let entry = FeedLiveEntry::Online {
            created_at: vrcx_0_core::time::now_iso(),
            user_id: target_user_id,
            display_name: display_name.trim().to_string(),
            location: String::new(),
            world_name: String::new(),
            group_name: String::new(),
            time: Some(0),
            world_id: None,
            display_location: None,
            owner_user_id: owner_user_id.as_str().to_string(),
        };
        insert_feed_entry(tx, &user_prefix, &entry)?;
        Ok(Some(entry))
    })
}

pub fn profile_feed_reconcile(
    db: &DatabaseService,
    owner_user_id: &OwnerId,
    input: ProfileFeedReconcileInput,
) -> Result<ProfileFeedReconcileOutput, Error> {
    profile_feed_reconcile_with_entries(db, owner_user_id, input).map(|(output, _)| output)
}

/// The saved entries are returned for live Feed notification only after the
/// transaction commits. Observation paths share this comparison boundary.
pub fn profile_feed_reconcile_with_entries(
    db: &DatabaseService,
    owner_user_id: &OwnerId,
    input: ProfileFeedReconcileInput,
) -> Result<(ProfileFeedReconcileOutput, Vec<FeedLiveEntry>), Error> {
    profile_feed_reconcile_with_description_policy(db, owner_user_id, input, false)
}

/// `preserve_status_description` keeps the last recorded status description
/// instead of the one in `input`, for sweeps that observe a status without its
/// description and must not erase the recorded text.
pub fn profile_feed_reconcile_with_description_policy(
    db: &DatabaseService,
    owner_user_id: &OwnerId,
    input: ProfileFeedReconcileInput,
    preserve_status_description: bool,
) -> Result<(ProfileFeedReconcileOutput, Vec<FeedLiveEntry>), Error> {
    let owner_user_id = OwnerId::new(normalize_user_id(owner_user_id.as_str()));
    if owner_user_id.is_empty() {
        return Err(Error::Database(
            "Profile feed reconciliation requires a current user id.".into(),
        ));
    }
    validate_expected_owner(&input.expected_owner_user_id, &owner_user_id)?;
    let user_id = normalize_user_id(&input.user_id);
    if user_id.is_empty() {
        return Err(Error::InvalidData(
            "Profile feed reconciliation requires a user id.".into(),
        ));
    }
    let user_prefix = normalize_user_table_prefix(owner_user_id.as_str())?;
    ensure_realtime_tables(db, &user_prefix)?;
    // Keep the legacy progressive scanner's baseline in sync with explicit
    // observations, without altering its enable flag or freshness policy.
    if input.bio.is_some() {
        crate::profile_bio::profile_bio_get(db, &owner_user_id, &user_id)?;
    }
    db.write_transaction(|tx| {
        let bio_rows = tx.execute(
            &format!("SELECT bio FROM {user_prefix}_feed_bio WHERE user_id = @user_id ORDER BY created_at DESC, id DESC LIMIT 1"),
            &ParamsBuilder::new().set("user_id", user_id.clone()).build(),
        )?;
        let has_bio = !bio_rows.is_empty();
        let previous_bio = bio_rows.first().and_then(|row| row.first()).and_then(serde_json::Value::as_str).unwrap_or("").to_string();
        let status_rows = tx.execute(
            &format!("SELECT status, status_description FROM {user_prefix}_feed_status WHERE user_id = @user_id ORDER BY created_at DESC, id DESC LIMIT 1"),
            &ParamsBuilder::new().set("user_id", user_id.clone()).build(),
        )?;
        let has_status = !status_rows.is_empty();
        let previous_status = status_rows.first().and_then(|row| row.first()).and_then(serde_json::Value::as_str).unwrap_or("").to_string();
        let previous_status_description = status_rows.first().and_then(|row| row.get(1)).and_then(serde_json::Value::as_str).unwrap_or("").to_string();
        let status_description = if preserve_status_description { previous_status_description.clone() } else { input.status_description.clone() };
        let status = input.status.trim().to_lowercase();
        let bio_updated = input
            .bio
            .as_ref()
            .is_some_and(|bio| !has_bio || vrcx_0_core::text::comparable_bio(&previous_bio) != vrcx_0_core::text::comparable_bio(bio));
        let status_updated = ["join me", "active", "ask me", "busy"].contains(&status.as_str())
            && (!has_status || previous_status != status || vrcx_0_core::text::comparable_profile_text(&previous_status_description) != vrcx_0_core::text::comparable_profile_text(&status_description));
          let created_at = vrcx_0_core::time::now_iso();
          let mut entries = Vec::new();
          if let Some(bio) = input.bio.as_ref().filter(|_| bio_updated) {
              let entry = FeedLiveEntry::Bio { created_at: created_at.clone(), user_id: user_id.clone(), display_name: input.display_name.clone(), bio: bio.clone(), previous_bio, owner_user_id: owner_user_id.as_str().to_string() };
              insert_feed_entry(tx, &user_prefix, &entry)?;
              entries.push(entry);
          }
          if status_updated {
              let entry = FeedLiveEntry::Status { created_at: created_at.clone(), user_id: user_id.clone(), display_name: input.display_name.clone(), status, status_description, previous_status, previous_status_description, owner_user_id: owner_user_id.as_str().to_string() };
              insert_feed_entry(tx, &user_prefix, &entry)?;
              entries.push(entry);
          }
          if let Some(bio) = input.bio.as_ref() {
              tx.execute_non_query(
                  &format!("INSERT INTO {user_prefix}_profile_bio (user_id, bio, checked_at) VALUES (@user_id, @bio, @checked_at) ON CONFLICT(user_id) DO UPDATE SET bio = excluded.bio, checked_at = excluded.checked_at"),
                  &ParamsBuilder::new().set("user_id", user_id.clone()).set("bio", bio.clone()).set("checked_at", created_at).build(),
              )?;
          }
          Ok((ProfileFeedReconcileOutput { bio_updated, status_updated }, entries))
    })
}

#[cfg(test)]
mod tests;

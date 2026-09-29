use serde::{Deserialize, Serialize};

use crate::common::{normalize_text, row_string, ParamsBuilder};
use crate::database::DatabaseService;
use crate::ownership::OwnerId;
use crate::realtime::{ensure_realtime_tables, normalize_user_table_prefix};
use crate::Error;

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

fn owner_prefix(db: &DatabaseService, owner_user_id: &OwnerId) -> Result<String, Error> {
    let owner_user_id = normalize_text(owner_user_id.as_str());
    if owner_user_id.is_empty() {
        return Err(Error::InvalidData(
            "Tracked non-friends requires a current user id.".into(),
        ));
    }
    let user_prefix = normalize_user_table_prefix(&owner_user_id)?;
    ensure_realtime_tables(db, &user_prefix)?;
    Ok(user_prefix)
}

fn normalized_user_id(user_id: String) -> Result<String, Error> {
    let user_id = normalize_text(user_id);
    if user_id.is_empty() {
        return Err(Error::InvalidData(
            "Tracked non-friend requires a user id.".into(),
        ));
    }
    Ok(user_id)
}

pub fn tracked_nonfriends_list(
    db: &DatabaseService,
    owner_user_id: &OwnerId,
) -> Result<Vec<TrackedNonFriendOutput>, Error> {
    let user_prefix = owner_prefix(db, owner_user_id)?;
    Ok(db
        .execute(
            &format!(
                "SELECT user_id, display_name, added_at FROM {user_prefix}_tracked_nonfriends ORDER BY added_at DESC, user_id ASC"
            ),
            &Default::default(),
        )?
        .into_iter()
        .map(|row| TrackedNonFriendOutput {
            user_id: row_string(&row, 0),
            display_name: row_string(&row, 1),
            added_at: row_string(&row, 2),
        })
        .filter(|row| !row.user_id.is_empty())
        .collect())
}

pub fn tracked_nonfriends_add(
    db: &DatabaseService,
    owner_user_id: &OwnerId,
    input: TrackedNonFriendAddInput,
) -> Result<bool, Error> {
    let user_prefix = owner_prefix(db, owner_user_id)?;
    let user_id = normalized_user_id(input.user_id)?;
    let affected = db.execute_non_query(
        &format!(
            "INSERT OR IGNORE INTO {user_prefix}_tracked_nonfriends (user_id, display_name, added_at) VALUES (@user_id, @display_name, @added_at)"
        ),
        &ParamsBuilder::new()
            .set("user_id", user_id)
            .set("display_name", normalize_text(input.display_name))
            .set("added_at", vrcx_0_core::time::now_iso())
            .build(),
    )?;
    Ok(affected > 0)
}

pub fn tracked_nonfriends_remove(
    db: &DatabaseService,
    owner_user_id: &OwnerId,
    user_id: String,
) -> Result<bool, Error> {
    let user_prefix = owner_prefix(db, owner_user_id)?;
    let user_id = normalized_user_id(user_id)?;
    Ok(db.execute_non_query(
        &format!("DELETE FROM {user_prefix}_tracked_nonfriends WHERE user_id = @user_id"),
        &ParamsBuilder::new().set("user_id", user_id).build(),
    )? > 0)
}

pub fn tracked_nonfriends_is_tracked(
    db: &DatabaseService,
    owner_user_id: &OwnerId,
    user_id: String,
) -> Result<bool, Error> {
    let user_prefix = owner_prefix(db, owner_user_id)?;
    let user_id = normalized_user_id(user_id)?;
    Ok(!db
        .execute(
            &format!(
                "SELECT 1 FROM {user_prefix}_tracked_nonfriends WHERE user_id = @user_id LIMIT 1"
            ),
            &ParamsBuilder::new().set("user_id", user_id).build(),
        )?
        .is_empty())
}

pub fn tracked_nonfriends_update_name(
    db: &DatabaseService,
    owner_user_id: &OwnerId,
    input: TrackedNonFriendUpdateNameInput,
) -> Result<bool, Error> {
    let user_prefix = owner_prefix(db, owner_user_id)?;
    let user_id = normalized_user_id(input.user_id)?;
    Ok(db.execute_non_query(
        &format!(
            "UPDATE {user_prefix}_tracked_nonfriends SET display_name = @display_name WHERE user_id = @user_id"
        ),
        &ParamsBuilder::new()
            .set("user_id", user_id)
            .set("display_name", normalize_text(input.display_name))
            .build(),
    )? > 0)
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use super::*;

    struct TestDir(PathBuf);

    impl TestDir {
        fn new() -> Self {
            let nonce = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos();
            let path = std::env::temp_dir().join(format!("vrcx-0-tracked-{nonce}"));
            std::fs::create_dir_all(&path).unwrap();
            Self(path)
        }
    }

    impl Drop for TestDir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn owner_scoped_crud_keeps_nonfriends_out_of_friend_tables() -> Result<(), Error> {
        let dir = TestDir::new();
        let db = DatabaseService::new(&dir.0.join("VRCX-0.sqlite3"))?;
        let owner_a = OwnerId::new("usr_owner_a");
        let owner_b = OwnerId::new("usr_owner_b");
        let input = TrackedNonFriendAddInput {
            user_id: "usr_nonfriend".into(),
            display_name: "Initial Name".into(),
        };

        assert!(tracked_nonfriends_add(&db, &owner_a, input.clone())?);
        assert!(!tracked_nonfriends_add(&db, &owner_a, input)?);
        assert!(tracked_nonfriends_is_tracked(
            &db,
            &owner_a,
            "usr_nonfriend".into(),
        )?);
        assert!(!tracked_nonfriends_is_tracked(
            &db,
            &owner_b,
            "usr_nonfriend".into(),
        )?);
        assert_eq!(tracked_nonfriends_list(&db, &owner_a)?.len(), 1);
        assert!(tracked_nonfriends_update_name(
            &db,
            &owner_a,
            TrackedNonFriendUpdateNameInput {
                user_id: "usr_nonfriend".into(),
                display_name: "Renamed".into(),
            },
        )?);
        assert_eq!(
            tracked_nonfriends_list(&db, &owner_a)?[0].display_name,
            "Renamed"
        );
        assert!(tracked_nonfriends_remove(
            &db,
            &owner_a,
            "usr_nonfriend".into(),
        )?);
        assert!(tracked_nonfriends_list(&db, &owner_a)?.is_empty());

        let prefix = normalize_user_table_prefix(owner_a.as_str())?;
        assert!(db
            .execute(
                &format!("SELECT user_id FROM {prefix}_friend_log_current"),
                &Default::default(),
            )?
            .is_empty());
        Ok(())
    }
}

use serde::Serialize;

use crate::common::{normalize_text, now_iso, row_string, ParamsBuilder};
use crate::database::schema::ensure_user_store_tables;
use crate::database::DatabaseService;
use crate::ownership::OwnerId;
use crate::realtime::normalize_user_table_prefix;
use crate::Error;

#[derive(Clone, Debug, Eq, PartialEq, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ManualRelationOutput {
    pub user_id_a: String,
    pub user_id_b: String,
    pub relation_type: String,
    pub added_at: String,
}

fn canonical_pair(user_id_a: String, user_id_b: String) -> Result<(String, String), Error> {
    let mut user_id_a = normalize_text(user_id_a);
    let mut user_id_b = normalize_text(user_id_b);
    if user_id_a.is_empty() || user_id_b.is_empty() {
        return Err(Error::InvalidData(
            "Manual relations require two user IDs.".into(),
        ));
    }
    if user_id_a == user_id_b {
        return Err(Error::InvalidData(
            "A manual relation cannot connect a user to itself.".into(),
        ));
    }
    if user_id_a > user_id_b {
        std::mem::swap(&mut user_id_a, &mut user_id_b);
    }
    Ok((user_id_a, user_id_b))
}

fn relation_type_or_default(relation_type: String) -> String {
    let relation_type = normalize_text(relation_type);
    if relation_type.is_empty() {
        "friend".into()
    } else {
        relation_type
    }
}

fn user_prefix(owner_user_id: OwnerId) -> Result<String, Error> {
    normalize_user_table_prefix(&normalize_text(owner_user_id.as_str()))
}

pub fn manual_relations_list(
    db: &DatabaseService,
    owner_user_id: OwnerId,
) -> Result<Vec<ManualRelationOutput>, Error> {
    let user_prefix = user_prefix(owner_user_id)?;
    ensure_user_store_tables(db, &user_prefix)?;
    read_relations(
        db,
        &format!(
            "SELECT user_id_a, user_id_b, relation_type, added_at FROM {user_prefix}_manual_relations_MANUEL ORDER BY added_at DESC, user_id_a, user_id_b"
        ),
        &Default::default(),
    )
}

pub fn manual_relations_for_user(
    db: &DatabaseService,
    owner_user_id: OwnerId,
    user_id: String,
) -> Result<Vec<ManualRelationOutput>, Error> {
    let user_prefix = user_prefix(owner_user_id)?;
    let user_id = normalize_text(user_id);
    if user_id.is_empty() {
        return Ok(Vec::new());
    }
    ensure_user_store_tables(db, &user_prefix)?;
    read_relations(
        db,
        &format!(
            "SELECT user_id_a, user_id_b, relation_type, added_at FROM {user_prefix}_manual_relations_MANUEL WHERE user_id_a = @user_id OR user_id_b = @user_id ORDER BY added_at DESC, user_id_a, user_id_b"
        ),
        &ParamsBuilder::new().set("user_id", user_id).build(),
    )
}

pub fn manual_relation_add(
    db: &DatabaseService,
    owner_user_id: OwnerId,
    user_id_a: String,
    user_id_b: String,
    relation_type: String,
) -> Result<(), Error> {
    let user_prefix = user_prefix(owner_user_id)?;
    let (user_id_a, user_id_b) = canonical_pair(user_id_a, user_id_b)?;
    ensure_user_store_tables(db, &user_prefix)?;
    db.execute_non_query(
        &format!(
            "INSERT OR IGNORE INTO {user_prefix}_manual_relations_MANUEL (user_id_a, user_id_b, relation_type, added_at) VALUES (@user_id_a, @user_id_b, @relation_type, @added_at)"
        ),
        &ParamsBuilder::new()
            .set("user_id_a", user_id_a)
            .set("user_id_b", user_id_b)
            .set("relation_type", relation_type_or_default(relation_type))
            .set("added_at", now_iso())
            .build(),
    )?;
    Ok(())
}

pub fn manual_relation_remove(
    db: &DatabaseService,
    owner_user_id: OwnerId,
    user_id_a: String,
    user_id_b: String,
) -> Result<(), Error> {
    let user_prefix = user_prefix(owner_user_id)?;
    let (user_id_a, user_id_b) = canonical_pair(user_id_a, user_id_b)?;
    ensure_user_store_tables(db, &user_prefix)?;
    db.execute_non_query(
        &format!(
            "DELETE FROM {user_prefix}_manual_relations_MANUEL WHERE user_id_a = @user_id_a AND user_id_b = @user_id_b"
        ),
        &ParamsBuilder::new()
            .set("user_id_a", user_id_a)
            .set("user_id_b", user_id_b)
            .build(),
    )?;
    Ok(())
}

fn read_relations(
    db: &DatabaseService,
    sql: &str,
    params: &std::collections::HashMap<String, serde_json::Value>,
) -> Result<Vec<ManualRelationOutput>, Error> {
    Ok(db
        .execute(sql, params)?
        .into_iter()
        .filter_map(|row| {
            let user_id_a = row_string(&row, 0);
            let user_id_b = row_string(&row, 1);
            if user_id_a.is_empty() || user_id_b.is_empty() {
                return None;
            }
            Some(ManualRelationOutput {
                user_id_a,
                user_id_b,
                relation_type: row_string(&row, 2),
                added_at: row_string(&row, 3),
            })
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use super::*;
    use crate::mutual_graph::{
        mutual_graph_snapshot_commit, mutual_graph_snapshot_get, MutualGraphMetaInput,
        MutualGraphSnapshotEntryInput,
    };

    struct TestDir {
        path: PathBuf,
    }

    impl TestDir {
        fn new(name: &str) -> Self {
            let nonce = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos();
            let path = std::env::temp_dir().join(format!(
                "vrcx-0-manual-relations-{name}-{}-{nonce}",
                std::process::id()
            ));
            std::fs::create_dir_all(&path).unwrap();
            Self { path }
        }
    }

    impl Drop for TestDir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.path);
        }
    }

    fn test_db(name: &str) -> DatabaseService {
        let dir = TestDir::new(name);
        let path = dir.path.join("VRCX-0.sqlite3");
        std::mem::forget(dir);
        DatabaseService::new(&path).unwrap()
    }

    fn owner(user_id: &str) -> OwnerId {
        OwnerId::new(user_id)
    }

    #[test]
    fn add_normalizes_pairs_is_idempotent_and_preserves_added_at() {
        let db = test_db("canonical");
        manual_relation_add(
            &db,
            owner("usr_owner"),
            " usr_b ".into(),
            "usr_a".into(),
            "friend".into(),
        )
        .unwrap();
        let initial = manual_relations_list(&db, owner("usr_owner")).unwrap();
        assert_eq!(initial.len(), 1);
        assert_eq!(initial[0].user_id_a, "usr_a");
        assert_eq!(initial[0].user_id_b, "usr_b");
        assert_eq!(initial[0].relation_type, "friend");
        assert!(!initial[0].added_at.is_empty());

        manual_relation_add(
            &db,
            owner("usr_owner"),
            "usr_a".into(),
            "usr_b".into(),
            "other".into(),
        )
        .unwrap();
        assert_eq!(
            manual_relations_list(&db, owner("usr_owner")).unwrap(),
            initial
        );
    }

    #[test]
    fn rejects_self_relations_and_lists_only_requested_user() {
        let db = test_db("validate-and-list");
        let error = manual_relation_add(
            &db,
            owner("usr_owner"),
            "usr_same".into(),
            " usr_same ".into(),
            "friend".into(),
        )
        .unwrap_err();
        assert!(error.to_string().contains("cannot connect a user to itself"));

        manual_relation_add(
            &db,
            owner("usr_owner"),
            "usr_a".into(),
            "usr_b".into(),
            "".into(),
        )
        .unwrap();
        manual_relation_add(
            &db,
            owner("usr_owner"),
            "usr_c".into(),
            "usr_d".into(),
            "friend".into(),
        )
        .unwrap();
        let relations = manual_relations_for_user(&db, owner("usr_owner"), "usr_b".into())
            .unwrap();
        assert_eq!(relations.len(), 1);
        assert_eq!(relations[0].relation_type, "friend");
        assert!(manual_relations_for_user(&db, owner("usr_owner"), "".into())
            .unwrap()
            .is_empty());
    }

    #[test]
    fn owner_scopes_removal_and_never_mutates_mutual_snapshots() {
        let db = test_db("owner-and-snapshot");
        mutual_graph_snapshot_commit(
            &db,
            "usr_owner_a".into(),
            vec![MutualGraphSnapshotEntryInput {
                friend_id: "usr_friend".into(),
                mutual_ids: vec!["usr_mutual".into()],
            }],
            vec![MutualGraphMetaInput {
                friend_id: "usr_friend".into(),
                last_fetched_at: "2026-01-01T00:00:00Z".into(),
                opted_out: false,
                total_count: Some(1),
            }],
        )
        .unwrap();
        let before = mutual_graph_snapshot_get(&db, "usr_owner_a".into()).unwrap();

        manual_relation_add(
            &db,
            owner("usr_owner_a"),
            "usr_a".into(),
            "usr_b".into(),
            "friend".into(),
        )
        .unwrap();
        manual_relation_add(
            &db,
            owner("usr_owner_b"),
            "usr_a".into(),
            "usr_b".into(),
            "friend".into(),
        )
        .unwrap();
        manual_relation_remove(
            &db,
            owner("usr_owner_a"),
            "usr_b".into(),
            "usr_a".into(),
        )
        .unwrap();

        assert!(manual_relations_list(&db, owner("usr_owner_a"))
            .unwrap()
            .is_empty());
        assert_eq!(
            manual_relations_list(&db, owner("usr_owner_b")).unwrap().len(),
            1
        );
        let after = mutual_graph_snapshot_get(&db, "usr_owner_a".into()).unwrap();
        assert_eq!(after.friend_ids, before.friend_ids);
        assert_eq!(
            after
                .links
                .iter()
                .map(|link| (&link.friend_id, &link.mutual_id))
                .collect::<Vec<_>>(),
            before
                .links
                .iter()
                .map(|link| (&link.friend_id, &link.mutual_id))
                .collect::<Vec<_>>()
        );
    }
}

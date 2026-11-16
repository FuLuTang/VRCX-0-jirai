use std::path::PathBuf;

use super::*;

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
            "vrcx-0-mutual-graph-{name}-{}-{nonce}",
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

fn entry(friend_id: &str, mutual_ids: &[&str]) -> MutualGraphSnapshotEntryInput {
    MutualGraphSnapshotEntryInput {
        friend_id: friend_id.into(),
        mutual_ids: mutual_ids.iter().map(|id| (*id).into()).collect(),
    }
}

fn meta(friend_id: &str, opted_out: bool) -> MutualGraphMetaInput {
    MutualGraphMetaInput {
        friend_id: friend_id.into(),
        last_fetched_at: "2026-07-21T12:00:00Z".into(),
        opted_out,
        total_count: None,
    }
}

fn observation(
    friend_id: &str,
    mutual_ids: &[&str],
    observed_at: &str,
) -> MutualGraphObservationInput {
    MutualGraphObservationInput {
        friend_id: friend_id.into(),
        mutual_ids: mutual_ids.iter().map(|id| (*id).into()).collect(),
        observed_at: observed_at.into(),
    }
}

#[test]
fn non_friend_observation_archives_only_history_for_the_authenticated_owner() {
    let dir = TestDir::new("non-friend-history-only");
    let db = DatabaseService::new(&dir.path.join("VRCX-0.sqlite3")).unwrap();
    let owner = "usr_owner".to_string();
    let first = "2026-07-21T12:00:00Z";
    let second = "2026-07-22T12:00:00Z";

    mutual_graph_observation_archive(
        &db,
        owner.clone(),
        "usr_nonfriend".into(),
        vec!["usr_mutual".into()],
        first.into(),
    )
    .unwrap();
    let snapshot = mutual_graph_snapshot_get(&db, owner.clone()).unwrap();
    assert!(snapshot.friend_ids.is_empty());
    assert!(snapshot.links.is_empty());
    assert!(snapshot.meta.is_empty());
    let history = mutual_graph_history_get(&db, owner.clone(), "usr_nonfriend".into()).unwrap();
    assert_eq!(history.last_successful_at.as_deref(), Some(first));
    assert_eq!(history.links.len(), 1);
    assert_eq!(history.links[0].date, first);
    assert!(
        mutual_graph_history_get(&db, "usr_other".into(), "usr_nonfriend".into())
            .unwrap()
            .links
            .is_empty()
    );

    mutual_graph_observation_archive(
        &db,
        owner.clone(),
        "usr_nonfriend".into(),
        Vec::new(),
        second.into(),
    )
    .unwrap();
    let history = mutual_graph_history_get(&db, owner, "usr_nonfriend".into()).unwrap();
    assert_eq!(history.last_successful_at.as_deref(), Some(second));
    assert_eq!(history.links.len(), 1);
    assert_eq!(history.links[0].date, first);
}

#[test]
fn successful_observations_archive_atomically_without_clearing_partial_snapshots() {
    let dir = TestDir::new("archive-observations");
    let db = DatabaseService::new(&dir.path.join("VRCX-0.sqlite3")).unwrap();
    let owner = "usr_owner".to_string();
    let first = "2026-07-21T12:00:00Z";
    let second = "2026-07-22T12:00:00Z";
    let mut first_meta = meta("usr_a", false);
    first_meta.last_fetched_at = first.into();
    mutual_graph_snapshot_commit(
        &db,
        owner.clone(),
        vec![entry("usr_a", &["usr_x"])],
        vec![first_meta],
        vec![observation("usr_a", &["usr_x"], first)],
        true,
        vec!["usr_a".into()],
    )
    .unwrap();

    let mut second_meta = meta("usr_b", false);
    second_meta.last_fetched_at = second.into();
    mutual_graph_snapshot_commit(
        &db,
        owner.clone(),
        vec![entry("usr_b", &["usr_y"])],
        vec![second_meta],
        vec![observation("usr_b", &["usr_y"], second)],
        false,
        vec!["usr_b".into()],
    )
    .unwrap();
    let snapshot = mutual_graph_snapshot_get(&db, owner.clone()).unwrap();
    assert_eq!(snapshot.links.len(), 2);
    assert_eq!(snapshot.historical_links.len(), 2);

    let history = mutual_graph_history_get(&db, owner.clone(), "usr_a".into()).unwrap();
    assert_eq!(history.last_successful_at.as_deref(), Some(first));
    assert_eq!(history.links[0].date, first);
    assert!(
        mutual_graph_history_get(&db, "usr_other".into(), "usr_a".into())
            .unwrap()
            .links
            .is_empty()
    );

    let mut empty_meta = meta("usr_a", false);
    empty_meta.last_fetched_at = second.into();
    mutual_graph_snapshot_commit(
        &db,
        owner.clone(),
        vec![entry("usr_a", &[])],
        vec![empty_meta],
        vec![observation("usr_a", &[], second)],
        false,
        vec!["usr_a".into()],
    )
    .unwrap();
    let history = mutual_graph_history_get(&db, owner.clone(), "usr_a".into()).unwrap();
    assert_eq!(history.last_successful_at.as_deref(), Some(second));
    assert_eq!(history.links[0].date, first);

    mutual_graph_snapshot_commit(
        &db,
        owner.clone(),
        vec![],
        vec![meta("usr_a", true)],
        vec![],
        false,
        vec!["usr_a".into()],
    )
    .unwrap();
    assert_eq!(
        mutual_graph_history_get(&db, owner, "usr_a".into())
            .unwrap()
            .links[0]
            .date,
        first
    );
}

#[test]
fn repeated_success_moves_old_link_date_forward_but_never_backward() {
    let dir = TestDir::new("repeat-observation");
    let db = DatabaseService::new(&dir.path.join("VRCX-0.sqlite3")).unwrap();
    let owner = "usr_owner".to_string();
    for observed_at in [
        "2026-07-21T12:00:00Z",
        "2026-07-22T12:00:00Z",
        "2026-07-20T12:00:00Z",
    ] {
        let mut current_meta = meta("usr_a", false);
        current_meta.last_fetched_at = observed_at.into();
        mutual_graph_snapshot_commit(
            &db,
            owner.clone(),
            vec![entry("usr_a", &["usr_x"])],
            vec![current_meta],
            vec![observation("usr_a", &["usr_x"], observed_at)],
            false,
            vec!["usr_a".into()],
        )
        .unwrap();
    }
    let history = mutual_graph_history_get(&db, owner, "usr_a".into()).unwrap();
    assert_eq!(
        history.last_successful_at.as_deref(),
        Some("2026-07-22T12:00:00Z")
    );
    assert_eq!(history.links[0].date, "2026-07-22T12:00:00Z");
}

#[test]
fn failed_archive_rolls_back_current_and_history() {
    let dir = TestDir::new("archive-rollback");
    let db = DatabaseService::new(&dir.path.join("VRCX-0.sqlite3")).unwrap();
    let owner = "usr_owner".to_string();
    let mut matching_meta = meta("usr_a", false);
    matching_meta.last_fetched_at = String::new();
    let result = mutual_graph_snapshot_commit(
        &db,
        owner.clone(),
        vec![entry("usr_a", &["usr_x"])],
        vec![matching_meta],
        vec![observation("usr_a", &["usr_x"], "")],
        false,
        vec!["usr_a".into()],
    );
    assert!(result.is_err());
    let snapshot = mutual_graph_snapshot_get(&db, owner).unwrap();
    assert!(snapshot.links.is_empty());
    assert!(snapshot.historical_links.is_empty());
}

#[test]
fn full_roster_prune_keeps_explicitly_tracked_nonfriends_and_history() {
    let dir = TestDir::new("tracked-full-prune");
    let db = DatabaseService::new(&dir.path.join("VRCX-0.sqlite3")).unwrap();
    let owner = "usr_owner".to_string();
    mutual_graph_tracked_user_set(
        &db,
        owner.clone(),
        "usr_tracked".into(),
        "Tracked".into(),
        true,
    )
    .unwrap();
    mutual_graph_snapshot_commit(
        &db,
        owner.clone(),
        vec![
            entry("usr_old", &["usr_x"]),
            entry("usr_tracked", &["usr_y"]),
        ],
        vec![meta("usr_old", false), meta("usr_tracked", false)],
        vec![],
        false,
        vec!["usr_old".into(), "usr_tracked".into()],
    )
    .unwrap();
    mutual_graph_snapshot_commit(
        &db,
        owner.clone(),
        vec![entry("usr_new", &[])],
        vec![meta("usr_new", false)],
        vec![],
        true,
        vec!["usr_new".into()],
    )
    .unwrap();
    let snapshot = mutual_graph_snapshot_get(&db, owner).unwrap();
    assert!(!snapshot.friend_ids.contains(&"usr_old".into()));
    assert!(snapshot.friend_ids.contains(&"usr_tracked".into()));
    assert!(snapshot.friend_ids.contains(&"usr_new".into()));
}

#[test]
fn empty_authoritative_roster_clears_current_but_not_old_history() {
    let dir = TestDir::new("empty-full-roster");
    let db = DatabaseService::new(&dir.path.join("VRCX-0.sqlite3")).unwrap();
    let owner = "usr_owner".to_string();
    let observed_at = "2026-07-21T12:00:00Z";
    mutual_graph_snapshot_commit(
        &db,
        owner.clone(),
        vec![entry("usr_a", &["usr_x"])],
        vec![meta("usr_a", false)],
        vec![observation("usr_a", &["usr_x"], observed_at)],
        true,
        vec!["usr_a".into()],
    )
    .unwrap();
    mutual_graph_snapshot_commit(&db, owner.clone(), vec![], vec![], vec![], true, vec![]).unwrap();
    let snapshot = mutual_graph_snapshot_get(&db, owner).unwrap();
    assert!(snapshot.links.is_empty());
    assert_eq!(snapshot.historical_links.len(), 1);
}

#[test]
fn full_snapshot_commit_removes_opted_out_nodes_that_are_no_longer_friends() {
    let dir = TestDir::new("remove-stale-opt-out");
    let db = DatabaseService::new(&dir.path.join("VRCX-0.sqlite3")).unwrap();
    let user_id = "usr_self".to_string();

    mutual_graph_snapshot_commit(
        &db,
        user_id.clone(),
        vec![entry("usr_old", &["usr_mutual_old"])],
        vec![meta("usr_old", false)],
        Vec::new(),
        true,
        vec!["usr_old".into()],
    )
    .unwrap();
    mutual_graph_snapshot_commit(
        &db,
        user_id.clone(),
        Vec::new(),
        vec![meta("usr_old", true)],
        Vec::new(),
        true,
        vec!["usr_old".into()],
    )
    .unwrap();
    mutual_graph_snapshot_commit(
        &db,
        user_id.clone(),
        vec![entry("usr_current", &["usr_mutual_current"])],
        vec![meta("usr_current", false)],
        Vec::new(),
        true,
        vec!["usr_current".into()],
    )
    .unwrap();

    let snapshot = mutual_graph_snapshot_get(&db, user_id).unwrap();
    assert_eq!(snapshot.friend_ids, vec!["usr_current"]);
    assert_eq!(
        snapshot
            .links
            .iter()
            .map(|link| (link.friend_id.as_str(), link.mutual_id.as_str()))
            .collect::<Vec<_>>(),
        vec![("usr_current", "usr_mutual_current")]
    );
    assert_eq!(
        snapshot
            .meta
            .iter()
            .map(|entry| entry.friend_id.as_str())
            .collect::<Vec<_>>(),
        vec!["usr_current"]
    );
}

#[test]
fn friend_refresh_replaces_links_and_opt_out_preserves_the_last_snapshot() {
    let dir = TestDir::new("friend-refresh");
    let db = DatabaseService::new(&dir.path.join("VRCX-0.sqlite3")).unwrap();
    let user_id = "usr_self".to_string();

    mutual_graph_friend_refresh_commit(
        &db,
        user_id.clone(),
        "usr_friend".into(),
        Some(vec!["usr_old".into()]),
        Some(1),
        false,
        Some("2026-07-21T12:00:00Z".into()),
    )
    .unwrap();
    mutual_graph_friend_refresh_commit(
        &db,
        user_id.clone(),
        "usr_friend".into(),
        Some(vec!["usr_new".into()]),
        Some(2),
        false,
        Some("2026-07-22T12:00:00Z".into()),
    )
    .unwrap();
    mutual_graph_friend_refresh_commit(
        &db,
        user_id.clone(),
        "usr_friend".into(),
        None,
        None,
        true,
        None,
    )
    .unwrap();

    let snapshot = mutual_graph_snapshot_get(&db, user_id).unwrap();
    assert_eq!(snapshot.friend_ids, vec!["usr_friend"]);
    assert_eq!(
        snapshot
            .links
            .iter()
            .map(|link| (link.friend_id.as_str(), link.mutual_id.as_str()))
            .collect::<Vec<_>>(),
        vec![("usr_friend", "usr_new")]
    );
    assert_eq!(snapshot.meta.len(), 1);
    assert!(snapshot.meta[0].opted_out);
    assert!(!snapshot.meta[0].last_fetched_at.is_empty());
    assert_eq!(snapshot.meta[0].total_count, Some(2));
    let history = mutual_graph_history_get(&db, "usr_self".into(), "usr_friend".into()).unwrap();
    assert_eq!(
        history.last_successful_at.as_deref(),
        Some("2026-07-22T12:00:00Z")
    );
    assert_eq!(history.links.len(), 2);
    assert_eq!(
        history
            .links
            .iter()
            .find(|link| link.mutual_id == "usr_old")
            .unwrap()
            .date,
        "2026-07-21T12:00:00Z"
    );
}

#[test]
fn snapshot_includes_legacy_relationship_edges_for_the_requested_owner_only() {
    let dir = TestDir::new("legacy-links");
    let db = DatabaseService::new(&dir.path.join("VRCX-0.sqlite3")).unwrap();
    let owner_prefix = normalize_user_table_prefix("usr_owner").unwrap();
    let other_prefix = normalize_user_table_prefix("usr_other").unwrap();
    ensure_user_store_tables(&db, &owner_prefix).unwrap();
    ensure_user_store_tables(&db, &other_prefix).unwrap();
    db.execute_non_query(
        &format!("INSERT INTO {owner_prefix}_mutual_graph_links_old (friend_id, mutual_id, date) VALUES ('usr_a', 'usr_b', '2024-01-02')"),
        &Default::default(),
    ).unwrap();
    db.execute_non_query(
        &format!("INSERT INTO {other_prefix}_mutual_graph_links_old (friend_id, mutual_id, date) VALUES ('usr_x', 'usr_y', '2024-02-03')"),
        &Default::default(),
    ).unwrap();

    let snapshot = mutual_graph_snapshot_get(&db, "usr_owner".into()).unwrap();
    assert_eq!(snapshot.historical_links.len(), 1);
    assert_eq!(snapshot.historical_links[0].friend_id, "usr_a");
    assert_eq!(snapshot.historical_links[0].mutual_id, "usr_b");
    assert_eq!(snapshot.historical_links[0].date, "2024-01-02");
}

#[test]
fn tracked_users_and_manual_links_are_owner_scoped_and_do_not_change_legacy_edges() {
    let dir = TestDir::new("extras-owner-scope");
    let db = DatabaseService::new(&dir.path.join("VRCX-0.sqlite3")).unwrap();

    mutual_graph_tracked_user_set(
        &db,
        "usr_owner".into(),
        "usr_tracked".into(),
        "Tracked user".into(),
        true,
    )
    .unwrap();
    mutual_graph_manual_link_set(
        &db,
        "usr_owner".into(),
        "usr_z".into(),
        "usr_a".into(),
        true,
    )
    .unwrap();
    mutual_graph_tracked_user_set(
        &db,
        "usr_other".into(),
        "usr_other_tracked".into(),
        "Other owner".into(),
        true,
    )
    .unwrap();

    let owner = mutual_graph_extras_get(&db, "usr_owner".into()).unwrap();
    assert_eq!(owner.tracked_users.len(), 1);
    assert_eq!(owner.tracked_users[0].user_id, "usr_tracked");
    assert_eq!(owner.tracked_users[0].display_name, "Tracked user");
    assert_eq!(owner.manual_links.len(), 1);
    assert_eq!(owner.manual_links[0].user_id_a, "usr_a");
    assert_eq!(owner.manual_links[0].user_id_b, "usr_z");

    let other = mutual_graph_extras_get(&db, "usr_other".into()).unwrap();
    assert_eq!(other.tracked_users.len(), 1);
    assert!(other.manual_links.is_empty());

    mutual_graph_manual_link_set(
        &db,
        "usr_owner".into(),
        "usr_a".into(),
        "usr_z".into(),
        false,
    )
    .unwrap();
    mutual_graph_tracked_user_set(
        &db,
        "usr_owner".into(),
        "usr_tracked".into(),
        String::new(),
        false,
    )
    .unwrap();

    let owner = mutual_graph_extras_get(&db, "usr_owner".into()).unwrap();
    assert!(owner.tracked_users.is_empty());
    assert!(owner.manual_links.is_empty());
}

#[test]
fn manual_relationship_rejects_empty_and_self_links() {
    let dir = TestDir::new("manual-link-validation");
    let db = DatabaseService::new(&dir.path.join("VRCX-0.sqlite3")).unwrap();
    assert!(mutual_graph_manual_link_set(
        &db,
        "usr_owner".into(),
        "usr_same".into(),
        "usr_same".into(),
        true,
    )
    .is_err());
}

#[test]
fn schema_upgrade_reuses_existing_vrcx_jirai_extension_tables_without_copying_rows() {
    let dir = TestDir::new("legacy-extension-tables");
    let db = DatabaseService::new(&dir.path.join("VRCX-0.sqlite3")).unwrap();
    let prefix = normalize_user_table_prefix("usr_owner").unwrap();
    db.execute_non_query(
        &format!("CREATE TABLE {prefix}_tracked_nonfriends (user_id TEXT PRIMARY KEY, display_name TEXT, added_at TEXT)"),
        &Default::default(),
    )
    .unwrap();
    db.execute_non_query(
        &format!("CREATE TABLE {prefix}_manual_relations_MANUEL (user_id_a TEXT NOT NULL, user_id_b TEXT NOT NULL, relation_type TEXT NOT NULL DEFAULT 'friend', added_at TEXT, PRIMARY KEY(user_id_a, user_id_b))"),
        &Default::default(),
    )
    .unwrap();
    db.execute_non_query(
        &format!("INSERT INTO {prefix}_tracked_nonfriends VALUES ('usr_tracked', 'Existing tracked', '2025-01-01')"),
        &Default::default(),
    )
    .unwrap();
    db.execute_non_query(
        &format!("INSERT INTO {prefix}_manual_relations_MANUEL VALUES ('usr_a', 'usr_b', 'friend', '2025-02-01')"),
        &Default::default(),
    )
    .unwrap();

    let extras = mutual_graph_extras_get(&db, "usr_owner".into()).unwrap();
    assert_eq!(extras.tracked_users.len(), 1);
    assert_eq!(extras.tracked_users[0].display_name, "Existing tracked");
    assert_eq!(extras.manual_links.len(), 1);
    assert_eq!(extras.manual_links[0].user_id_a, "usr_a");
}

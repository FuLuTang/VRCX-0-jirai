use std::path::PathBuf;

use super::*;
use crate::game_log::{
    write_batch, GameLogJoinLeaveEntry, GameLogLocationEntry, GameLogWriteBatch,
};

struct TestDatabase {
    _dir: TestDir,
    db: DatabaseService,
}

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
            "vrcx-0-quick-search-recent-{name}-{}-{nonce}",
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

fn test_db(name: &str) -> Result<TestDatabase, Error> {
    let dir = TestDir::new(name);
    let db = DatabaseService::new(&dir.path.join("VRCX-0.sqlite3"))?;
    Ok(TestDatabase { _dir: dir, db })
}

const ME: &str = "usr_me";
const OTHER_ACCOUNT: &str = "usr_other_account";

fn met(minute: u32, event_type: &str, user_id: &str, name: &str) -> GameLogJoinLeaveEntry {
    GameLogJoinLeaveEntry {
        created_at: format!("2026-07-01T10:{minute:02}:00Z"),
        event_type: event_type.into(),
        display_name: name.into(),
        location: "wrld_a:1".into(),
        user_id: user_id.into(),
        world_name: String::new(),
        time: 0,
    }
}

fn joined(minute: u32, world_id: &str, name: &str) -> GameLogLocationEntry {
    GameLogLocationEntry {
        created_at: format!("2026-07-01T10:{minute:02}:00Z"),
        location: format!("{world_id}:{minute}"),
        world_id: world_id.into(),
        world_name: name.into(),
        time: 60_000,
        group_name: String::new(),
    }
}

fn write(db: &DatabaseService, owner: &str, batch: GameLogWriteBatch) {
    write_batch(db, &OwnerId::new(owner), &batch).unwrap();
}

fn count(db: &DatabaseService, table: &str) -> i64 {
    crate::common::row_i64(
        &db.execute(
            &format!("SELECT COUNT(*) FROM {table}"),
            &Default::default(),
        )
        .unwrap()[0],
        0,
    )
}

// A17-1
#[test]
fn recent_met_users_are_newest_first_deduplicated_and_skip_self_and_blank() -> Result<(), Error> {
    let fixture = test_db("met")?;
    write(
        &fixture.db,
        ME,
        GameLogWriteBatch {
            join_leave: vec![
                met(1, "OnPlayerJoined", "usr_a", "A old name"),
                met(2, "OnPlayerJoined", "usr_b", "B"),
                met(3, "OnPlayerJoined", ME, "Me"),
                met(4, "OnPlayerJoined", "", "No Id"),
                met(5, "OnPlayerLeft", "usr_a", "A new name"),
                met(6, "OnPlayerJoined", "usr_c", "C"),
                met(7, "OnVideoPlay", "usr_video", "Not a meeting"),
            ],
            ..GameLogWriteBatch::default()
        },
    );
    let rows = quick_search_recent_met_users(&fixture.db, &OwnerId::new(ME), 8)?;
    let ids = rows
        .iter()
        .map(|row| row.user_id.as_str())
        .collect::<Vec<_>>();
    assert_eq!(ids, ["usr_c", "usr_a", "usr_b"]);
    assert_eq!(rows[1].display_name, "A new name");
    assert_eq!(rows[1].last_seen_at, "2026-07-01T10:05:00Z");
    Ok(())
}

// A17-1 limit
#[test]
fn recent_met_users_respect_the_limit() -> Result<(), Error> {
    let fixture = test_db("met-limit")?;
    write(
        &fixture.db,
        ME,
        GameLogWriteBatch {
            join_leave: (0..12)
                .map(|index| met(index, "OnPlayerJoined", &format!("usr_{index:02}"), "N"))
                .collect(),
            ..GameLogWriteBatch::default()
        },
    );
    let rows = quick_search_recent_met_users(&fixture.db, &OwnerId::new(ME), 8)?;
    assert_eq!(rows.len(), 8);
    assert_eq!(rows[0].user_id, "usr_11");
    Ok(())
}

// A17-2
#[test]
fn recent_joined_worlds_are_newest_first_and_deduplicated_by_world() -> Result<(), Error> {
    let fixture = test_db("worlds")?;
    write(
        &fixture.db,
        ME,
        GameLogWriteBatch {
            locations: vec![
                joined(1, "wrld_a", "World A"),
                joined(2, "wrld_b", "World B"),
                joined(3, "wrld_a", "World A renamed"),
                joined(4, "", "No world"),
            ],
            ..GameLogWriteBatch::default()
        },
    );
    let rows = quick_search_recent_joined_worlds(&fixture.db, &OwnerId::new(ME), 10)?;
    let ids = rows
        .iter()
        .map(|row| row.world_id.as_str())
        .collect::<Vec<_>>();
    assert_eq!(ids, ["wrld_a", "wrld_b"]);
    assert_eq!(rows[0].world_name, "World A renamed");
    assert_eq!(rows[0].location, "wrld_a:3");

    let many = test_db("worlds-limit")?;
    write(
        &many.db,
        ME,
        GameLogWriteBatch {
            locations: (0..14)
                .map(|index| joined(index, &format!("wrld_{index:02}"), "W"))
                .collect(),
            ..GameLogWriteBatch::default()
        },
    );
    assert_eq!(
        quick_search_recent_joined_worlds(&many.db, &OwnerId::new(ME), 10)?.len(),
        10
    );
    Ok(())
}

// A17-3
#[test]
fn recent_rows_are_isolated_by_account() -> Result<(), Error> {
    let fixture = test_db("owners")?;
    write(
        &fixture.db,
        ME,
        GameLogWriteBatch {
            join_leave: vec![met(1, "OnPlayerJoined", "usr_mine", "Mine")],
            locations: vec![joined(1, "wrld_mine", "Mine")],
            ..GameLogWriteBatch::default()
        },
    );
    write(
        &fixture.db,
        OTHER_ACCOUNT,
        GameLogWriteBatch {
            join_leave: vec![met(2, "OnPlayerJoined", "usr_theirs", "Theirs")],
            locations: vec![joined(2, "wrld_theirs", "Theirs")],
            ..GameLogWriteBatch::default()
        },
    );
    let mine = OwnerId::new(ME);
    let theirs = OwnerId::new(OTHER_ACCOUNT);
    let met_mine = quick_search_recent_met_users(&fixture.db, &mine, 8)?;
    assert_eq!(
        met_mine
            .iter()
            .map(|row| row.user_id.as_str())
            .collect::<Vec<_>>(),
        ["usr_mine"]
    );
    let met_theirs = quick_search_recent_met_users(&fixture.db, &theirs, 8)?;
    assert_eq!(
        met_theirs
            .iter()
            .map(|row| row.user_id.as_str())
            .collect::<Vec<_>>(),
        ["usr_theirs"]
    );
    let worlds_mine = quick_search_recent_joined_worlds(&fixture.db, &mine, 10)?;
    assert_eq!(
        worlds_mine
            .iter()
            .map(|row| row.world_id.as_str())
            .collect::<Vec<_>>(),
        ["wrld_mine"]
    );
    let unknown = quick_search_recent_met_users(&fixture.db, &OwnerId::new("usr_unknown"), 8)?;
    assert!(unknown.is_empty());
    Ok(())
}

// A17-6
#[test]
fn recent_queries_are_read_only() -> Result<(), Error> {
    let fixture = test_db("read-only")?;
    write(
        &fixture.db,
        ME,
        GameLogWriteBatch {
            join_leave: vec![met(1, "OnPlayerJoined", "usr_a", "A")],
            locations: vec![joined(1, "wrld_a", "A")],
            ..GameLogWriteBatch::default()
        },
    );
    let before = (
        count(&fixture.db, "gamelog_join_leave"),
        count(&fixture.db, "gamelog_location"),
    );
    quick_search_recent_met_users(&fixture.db, &OwnerId::new(ME), 8)?;
    quick_search_recent_joined_worlds(&fixture.db, &OwnerId::new(ME), 10)?;
    quick_search_recent_met_users(&fixture.db, &OwnerId::new("usr_new_owner"), 8)?;
    let after = (
        count(&fixture.db, "gamelog_join_leave"),
        count(&fixture.db, "gamelog_location"),
    );
    assert_eq!(before, after);
    Ok(())
}

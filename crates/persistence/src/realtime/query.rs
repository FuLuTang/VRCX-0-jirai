use std::collections::HashMap;

use crate::common::ParamsBuilder;
use crate::database::DatabaseService;
use crate::game_log::ensure_game_log_tables;
use crate::Error;
use vrcx_0_core::OwnerId;

/// One owner-scoped batch; each latest-row lookup uses the existing user index.
pub fn friend_location_history(
    db: &DatabaseService,
    owner: &OwnerId,
    locations: &HashMap<String, String>,
) -> Result<HashMap<String, (String, i64)>, Error> {
    let mut restored = HashMap::new();
    if owner.is_empty() || locations.is_empty() {
        return Ok(restored);
    }
    let prefix = super::schema::normalize_user_table_prefix(owner.as_str())?;
    super::schema::ensure_realtime_tables(db, &prefix)?;
    let rows = db.execute(
        &format!(
            "SELECT c.key, g.location, g.created_at FROM json_each(@locations) c
             JOIN {prefix}_feed_gps g ON g.id = (
                 SELECT id FROM {prefix}_feed_gps WHERE user_id = c.key
                 ORDER BY julianday(created_at) DESC, id DESC LIMIT 1)
             WHERE g.location = c.value
             AND NOT EXISTS (SELECT 1 FROM {prefix}_feed_online_offline o
                 WHERE o.user_id = c.key AND (o.type = 'Offline'
                     OR (o.type = 'Online' AND COALESCE(o.location, '') NOT IN ('', g.location)))
                 AND (julianday(o.created_at) IS NULL OR julianday(o.created_at) >= julianday(g.created_at)))
             AND NOT EXISTS (SELECT 1 FROM {prefix}_feed_gps invalid
                 WHERE invalid.user_id = c.key AND julianday(invalid.created_at) IS NULL)"
        ),
        &ParamsBuilder::new()
            .set("locations", serde_json::to_string(locations).map_err(|error| Error::InvalidData(error.to_string()))?)
            .build(),
    )?;
    let now_ms = chrono::Utc::now().timestamp_millis();
    for row in rows {
        let Some(user_id) = row.first().and_then(serde_json::Value::as_str) else {
            continue;
        };
        let Some(location) = row.get(1).and_then(serde_json::Value::as_str) else {
            continue;
        };
        let Some(time) = row
            .get(2)
            .and_then(serde_json::Value::as_str)
            .and_then(|value| chrono::DateTime::parse_from_rfc3339(value).ok())
        else {
            continue;
        };
        let since_ms = time.timestamp_millis();
        if since_ms > 0
            && since_ms < now_ms
            && vrcx_0_core::location::parse_location(location).is_real_instance
        {
            restored.insert(user_id.to_string(), (location.to_string(), since_ms));
        }
    }
    Ok(restored)
}

pub fn lookup_game_log_world_name(db: &DatabaseService, world_id: &str) -> Result<String, Error> {
    let world_id = world_id.trim();
    if world_id.is_empty() {
        return Ok(String::new());
    }
    ensure_game_log_tables(db)?;
    let rows = db.execute(
        "SELECT world_name FROM gamelog_location WHERE world_id = @world_id ORDER BY id DESC LIMIT 1",
        &ParamsBuilder::new().set("world_id", world_id).build(),
    )?;
    Ok(rows
        .first()
        .and_then(|row| row.first())
        .and_then(serde_json::Value::as_str)
        .map(str::trim)
        .unwrap_or("")
        .to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn friend_location_history_requires_latest_matching_gps_without_offline() -> Result<(), Error> {
        let path = std::env::temp_dir().join(format!(
            "vrcx-location-history-{}-{}.sqlite3",
            std::process::id(),
            chrono::Utc::now().timestamp_nanos_opt().unwrap()
        ));
        let db = DatabaseService::new(&path)?;
        let owner = OwnerId::new("usr_self");
        super::super::schema::ensure_realtime_tables(&db, "usrself")?;
        let locations = [
            "valid",
            "moved",
            "offline",
            "missing",
            "invalid",
            "private",
            "online_move",
        ]
        .into_iter()
        .map(|id| (id.to_string(), "wrld_room:123".to_string()))
        .collect::<HashMap<_, _>>();
        for id in [
            "valid",
            "moved",
            "offline",
            "invalid",
            "private",
            "online_move",
        ] {
            db.execute_non_query("INSERT INTO usrself_feed_gps (user_id, location, created_at) VALUES (@id, 'wrld_room:123', '2026-01-01T00:00:00Z')", &ParamsBuilder::new().set("id", id).build())?;
        }
        db.execute_non_query("INSERT INTO usrself_feed_gps (user_id, location, created_at) VALUES ('moved', 'wrld_other:456', '2026-01-01T01:00:00Z'), ('invalid', 'wrld_room:123', 'unknown'), ('private', 'private', '2026-01-01T01:00:00Z')", &Default::default())?;
        db.execute_non_query("INSERT INTO usrself_feed_online_offline (user_id, type, created_at) VALUES ('offline', 'Offline', '2026-01-01T00:30:00Z'), ('valid', 'Offline', '2025-12-31T23:00:00Z')", &Default::default())?;
        db.execute_non_query("INSERT INTO usrself_feed_online_offline (user_id, type, location, created_at) VALUES ('online_move', 'Online', 'wrld_other:456', '2026-01-01T00:30:00Z')", &Default::default())?;
        let result = friend_location_history(&db, &owner, &locations)?;
        assert_eq!(
            result,
            HashMap::from([(
                "valid".to_string(),
                ("wrld_room:123".to_string(), 1_767_225_600_000)
            )])
        );
        assert!(friend_location_history(&db, &OwnerId::new("usr_other"), &locations)?.is_empty());
        assert!(friend_location_history(&db, &owner, &HashMap::new())?.is_empty());
        drop(db);
        let _ = std::fs::remove_file(path);
        Ok(())
    }
}

use crate::common::{row_i64, row_string, ParamsBuilder};
use crate::database::DatabaseService;
use crate::feed::FeedRowOutput;
use crate::game_log::ensure_game_log_tables;
use crate::ownership::owner_id_for_filter;
use crate::{Error, Result};
use vrcx_0_core::OwnerId;

/// Read-only projection. Presence is derived only from recorded game durations;
/// zero-duration rows and gaps do not establish online time.
pub fn self_status_history(db: &DatabaseService, owner: &OwnerId) -> Result<Vec<FeedRowOutput>> {
    let prefix = super::normalize_user_table_prefix(owner.as_str())?;
    super::ensure_realtime_tables(db, &prefix)?;
    ensure_game_log_tables(db)?;
    let mut result = Vec::new();
    for row in db.execute(
        &format!("SELECT id, created_at, value, previous_value FROM {prefix}_self_profile_log WHERE field = 'status' ORDER BY created_at, id"),
        &Default::default(),
    )? {
        result.push(FeedRowOutput {
            row_id: Some(row_i64(&row, 0)), created_at: Some(row_string(&row, 1)),
            user_id: Some(owner.as_str().to_owned()), r#type: Some("Status".into()),
            status: Some(row_string(&row, 2)), previous_status: Some(row_string(&row, 3)),
            ..Default::default()
        });
    }
    let owner_row = owner_id_for_filter(db, owner)?;
    let mut spans = Vec::new();
    for row in db.execute(
        "SELECT created_at, time FROM gamelog_location WHERE owner_id IN (0, @owner_id) AND time > 0 ORDER BY created_at",
        &ParamsBuilder::new().set("owner_id", owner_row).build(),
    )? {
        let Some(start) = crate::activity::parse_activity_time_ms(&row_string(&row, 0)) else { continue };
        let duration = row_i64(&row, 1);
        let Some(end) = start.checked_add(duration) else { continue };
        if end > chrono::Utc::now().timestamp_millis() { continue; }
        spans.push((start, end));
    }
    spans.sort_unstable();
    let mut merged: Vec<(i64, i64)> = Vec::new();
    for (start, end) in spans {
        if let Some(last) = merged.last_mut().filter(|last| start <= last.1) {
            last.1 = last.1.max(end);
        } else {
            merged.push((start, end));
        }
    }
    for (start, end) in merged {
        for (at, kind) in [(start, "Online"), (end, "Offline")] {
            result.push(FeedRowOutput {
                created_at: Some(crate::activity::activity_iso_from_ms(at)),
                user_id: Some(owner.as_str().to_owned()),
                r#type: Some(kind.into()),
                ..Default::default()
            });
        }
    }
    Ok(result)
}

#[derive(Clone, Debug, serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct SelfStatusHistoryInput {
    pub expected_owner_user_id: String,
}

pub fn validate_self_status_owner(expected: &str, owner: &OwnerId) -> Result<()> {
    if owner.as_str().is_empty() || expected.trim() != owner.as_str() {
        return Err(Error::Database(
            "Self status history account changed.".into(),
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn self_history_uses_only_recorded_owner_spans_and_merges_overlap() -> Result<()> {
        let directory = std::env::temp_dir().join(format!(
            "vrcx-self-status-{}-{}",
            std::process::id(),
            chrono::Utc::now().timestamp_nanos_opt().unwrap()
        ));
        std::fs::create_dir_all(&directory).unwrap();
        let db = DatabaseService::new(&directory.join("test.sqlite3"))?;
        let owner = OwnerId::new("usr_self");
        let other = OwnerId::new("usr_other");
        let owner_id = crate::ownership::owner_id_get_or_insert(&db, &owner)?.value();
        let other_id = crate::ownership::owner_id_get_or_insert(&db, &other)?.value();
        assert!(self_status_history(&db, &owner)?.is_empty());
        db.execute_non_query("INSERT INTO usrself_self_profile_log(created_at, field, value, previous_value) VALUES ('2026-01-01T00:00:00Z', 'status', 'active', 'busy')", &Default::default())?;
        for (at, duration, id) in [
            ("2026-01-01T00:00:00Z", 60_000, owner_id),
            ("2026-01-01T00:00:30Z", 60_000, 0),
            ("2026-01-01T00:10:00Z", 60_000, other_id),
            ("2026-01-01T00:20:00Z", 0, owner_id),
        ] {
            db.execute_non_query("INSERT INTO gamelog_location(created_at, time, owner_id) VALUES (@at, @duration, @owner)", &ParamsBuilder::new().set("at", at).set("duration", duration).set("owner", id).build())?;
        }
        let result = self_status_history(&db, &owner)?;
        assert_eq!(result.len(), 3);
        assert_eq!(result[0].status.as_deref(), Some("active"));
        assert_eq!(
            result[1].created_at.as_deref(),
            Some("2026-01-01T00:00:00.000Z")
        );
        assert_eq!(
            result[2].created_at.as_deref(),
            Some("2026-01-01T00:01:30.000Z")
        );
        assert!(validate_self_status_owner("usr_other", &owner).is_err());
        assert!(validate_self_status_owner("", &OwnerId::new("")).is_err());
        Ok(())
    }
}

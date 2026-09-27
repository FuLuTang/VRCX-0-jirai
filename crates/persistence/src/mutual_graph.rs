use serde::{Deserialize, Serialize};
use std::collections::HashSet;

use crate::common::{normalize_text, now_iso, row_i64, row_string, row_value, ParamsBuilder};
use crate::database::schema::ensure_user_store_tables;
use crate::database::{DatabaseService, DatabaseWriteTransaction};
use crate::realtime::normalize_user_table_prefix;
use crate::Error;

#[cfg(test)]
mod tests;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MutualGraphSnapshotEntryInput {
    pub friend_id: String,
    #[serde(default)]
    pub mutual_ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MutualGraphMetaInput {
    pub friend_id: String,
    #[serde(default)]
    pub last_fetched_at: String,
    #[serde(default)]
    pub opted_out: bool,
    #[serde(default)]
    pub total_count: Option<usize>,
}

pub struct MutualGraphObservationInput {
    pub friend_id: String,
    pub mutual_ids: Vec<String>,
    pub observed_at: String,
}

#[derive(Debug, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct MutualGraphLinkOutput {
    pub friend_id: String,
    pub mutual_id: String,
}

#[derive(Debug, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct MutualGraphHistoricalLinkOutput {
    pub friend_id: String,
    pub mutual_id: String,
    pub date: String,
}

#[derive(Debug, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct MutualGraphMetaOutput {
    pub friend_id: String,
    pub last_fetched_at: String,
    pub opted_out: bool,
    pub total_count: Option<u32>,
}

#[derive(Debug, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct MutualGraphSnapshotOutput {
    pub friend_ids: Vec<String>,
    pub links: Vec<MutualGraphLinkOutput>,
    pub historical_links: Vec<MutualGraphHistoricalLinkOutput>,
    pub meta: Vec<MutualGraphMetaOutput>,
}

#[derive(Debug, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct MutualGraphHistoryOutput {
    pub last_successful_at: Option<String>,
    pub links: Vec<MutualGraphHistoricalLinkOutput>,
}

pub fn mutual_graph_history_get(
    db: &DatabaseService,
    owner_user_id: String,
    friend_id: String,
) -> Result<MutualGraphHistoryOutput, Error> {
    let user_prefix = normalize_user_table_prefix(&normalize_text(owner_user_id))?;
    let friend_id = normalize_text(friend_id);
    if friend_id.is_empty() {
        return Err(Error::Custom(
            "Mutual graph history requires a target user.".into(),
        ));
    }
    ensure_user_store_tables(db, &user_prefix)?;
    let params = ParamsBuilder::new().set("friend_id", friend_id).build();
    let last_successful_at = db.execute(
        &format!("SELECT last_updated FROM {user_prefix}_mutual_graph_friends_old WHERE friend_id = @friend_id"),
        &params,
    )?.first().map(|row| row_string(row, 0));
    let links = db.execute(
        &format!("SELECT friend_id, mutual_id, date FROM {user_prefix}_mutual_graph_links_old WHERE friend_id = @friend_id ORDER BY date DESC, mutual_id"),
        &params,
    )?.into_iter().map(|row| MutualGraphHistoricalLinkOutput {
        friend_id: row_string(&row, 0),
        mutual_id: row_string(&row, 1),
        date: row_string(&row, 2),
    }).collect();
    Ok(MutualGraphHistoryOutput {
        last_successful_at,
        links,
    })
}

#[derive(Debug, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct MutualGraphTrackedUserOutput {
    pub user_id: String,
    pub display_name: String,
    pub added_at: String,
}

#[derive(Debug, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct MutualGraphManualLinkOutput {
    pub user_id_a: String,
    pub user_id_b: String,
    pub relation_type: String,
    pub added_at: String,
}

#[derive(Debug, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct MutualGraphExtrasOutput {
    pub tracked_users: Vec<MutualGraphTrackedUserOutput>,
    pub manual_links: Vec<MutualGraphManualLinkOutput>,
}

#[derive(Debug, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct MutualGraphTrackedUserSetInput {
    pub owner_user_id: String,
    pub user_id: String,
    #[serde(default)]
    pub display_name: String,
    pub tracked: bool,
}

#[derive(Debug, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct MutualGraphManualLinkSetInput {
    pub owner_user_id: String,
    pub user_id_a: String,
    pub user_id_b: String,
    pub related: bool,
}

pub fn mutual_graph_extras_get(
    db: &DatabaseService,
    owner_user_id: String,
) -> Result<MutualGraphExtrasOutput, Error> {
    let user_prefix = normalize_user_table_prefix(&normalize_text(owner_user_id))?;
    ensure_user_store_tables(db, &user_prefix)?;
    let tracked_users = db.execute(
        &format!("SELECT user_id, display_name, added_at FROM {user_prefix}_tracked_nonfriends ORDER BY added_at DESC, user_id"),
        &Default::default(),
    )?.into_iter().filter_map(|row| {
        let user_id = row_string(&row, 0);
        (!user_id.is_empty()).then(|| MutualGraphTrackedUserOutput {
            user_id,
            display_name: row_string(&row, 1),
            added_at: row_string(&row, 2),
        })
    }).collect();
    let manual_links = db.execute(
        &format!("SELECT user_id_a, user_id_b, relation_type, added_at FROM {user_prefix}_manual_relations_MANUEL ORDER BY added_at DESC, user_id_a, user_id_b"),
        &Default::default(),
    )?.into_iter().filter_map(|row| {
        let user_id_a = row_string(&row, 0);
        let user_id_b = row_string(&row, 1);
        (!user_id_a.is_empty() && !user_id_b.is_empty()).then(|| MutualGraphManualLinkOutput {
            user_id_a,
            user_id_b,
            relation_type: row_string(&row, 2),
            added_at: row_string(&row, 3),
        })
    }).collect();
    Ok(MutualGraphExtrasOutput {
        tracked_users,
        manual_links,
    })
}

pub fn mutual_graph_tracked_user_set(
    db: &DatabaseService,
    owner_user_id: String,
    user_id: String,
    display_name: String,
    tracked: bool,
) -> Result<(), Error> {
    let user_prefix = normalize_user_table_prefix(&normalize_text(owner_user_id))?;
    ensure_user_store_tables(db, &user_prefix)?;
    let user_id = normalize_text(user_id);
    if user_id.is_empty() {
        return Err(Error::Custom(
            "Tracked mutual graph user id is required.".into(),
        ));
    }
    if tracked {
        db.execute_non_query(
            &format!("INSERT INTO {user_prefix}_tracked_nonfriends (user_id, display_name, added_at) VALUES (@user_id, @display_name, @added_at) ON CONFLICT(user_id) DO UPDATE SET display_name = CASE WHEN excluded.display_name = '' THEN {user_prefix}_tracked_nonfriends.display_name ELSE excluded.display_name END"),
            &ParamsBuilder::new()
                .set("user_id", user_id)
                .set("display_name", normalize_text(display_name))
                .set("added_at", now_iso())
                .build(),
        )?;
    } else {
        db.execute_non_query(
            &format!("DELETE FROM {user_prefix}_tracked_nonfriends WHERE user_id = @user_id"),
            &ParamsBuilder::new().set("user_id", user_id).build(),
        )?;
    }
    Ok(())
}

pub fn mutual_graph_manual_link_set(
    db: &DatabaseService,
    owner_user_id: String,
    user_id_a: String,
    user_id_b: String,
    related: bool,
) -> Result<(), Error> {
    let user_prefix = normalize_user_table_prefix(&normalize_text(owner_user_id))?;
    ensure_user_store_tables(db, &user_prefix)?;
    let mut user_id_a = normalize_text(user_id_a);
    let mut user_id_b = normalize_text(user_id_b);
    if user_id_a.is_empty() || user_id_b.is_empty() || user_id_a == user_id_b {
        return Err(Error::Custom(
            "Manual mutual graph relation requires two different user ids.".into(),
        ));
    }
    if user_id_a > user_id_b {
        std::mem::swap(&mut user_id_a, &mut user_id_b);
    }
    if related {
        db.execute_non_query(
            &format!("INSERT OR IGNORE INTO {user_prefix}_manual_relations_MANUEL (user_id_a, user_id_b, relation_type, added_at) VALUES (@user_id_a, @user_id_b, 'friend', @added_at)"),
            &ParamsBuilder::new()
                .set("user_id_a", user_id_a)
                .set("user_id_b", user_id_b)
                .set("added_at", now_iso())
                .build(),
        )?;
    } else {
        db.execute_non_query(
            &format!("DELETE FROM {user_prefix}_manual_relations_MANUEL WHERE user_id_a = @user_id_a AND user_id_b = @user_id_b"),
            &ParamsBuilder::new()
                .set("user_id_a", user_id_a)
                .set("user_id_b", user_id_b)
                .build(),
        )?;
    }
    Ok(())
}

pub fn mutual_graph_snapshot_get(
    db: &DatabaseService,
    user_id: String,
) -> Result<MutualGraphSnapshotOutput, Error> {
    let user_id = normalize_text(user_id);
    let user_prefix = normalize_user_table_prefix(&user_id)?;
    ensure_user_store_tables(db, &user_prefix)?;

    let friend_ids = db
        .execute(
            &format!("SELECT friend_id FROM {user_prefix}_mutual_graph_friends"),
            &Default::default(),
        )?
        .into_iter()
        .map(|row| row_string(&row, 0))
        .filter(|friend_id| !friend_id.is_empty())
        .collect();
    let links = db
        .execute(
            &format!("SELECT friend_id, mutual_id FROM {user_prefix}_mutual_graph_links"),
            &Default::default(),
        )?
        .into_iter()
        .filter_map(|row| {
            let friend_id = row_string(&row, 0);
            let mutual_id = row_string(&row, 1);
            if friend_id.is_empty() || mutual_id.is_empty() {
                None
            } else {
                Some(MutualGraphLinkOutput {
                    friend_id,
                    mutual_id,
                })
            }
        })
        .collect();
    let historical_links = db
        .execute(
            &format!("SELECT friend_id, mutual_id, date FROM {user_prefix}_mutual_graph_links_old"),
            &Default::default(),
        )?
        .into_iter()
        .filter_map(|row| {
            let friend_id = row_string(&row, 0);
            let mutual_id = row_string(&row, 1);
            if friend_id.is_empty() || mutual_id.is_empty() {
                None
            } else {
                Some(MutualGraphHistoricalLinkOutput {
                    friend_id,
                    mutual_id,
                    date: row_string(&row, 2),
                })
            }
        })
        .collect();
    let meta = db
        .execute(
            &format!(
                "SELECT friend_id, last_fetched_at, opted_out, total_count FROM {user_prefix}_mutual_graph_meta"
            ),
            &Default::default(),
        )?
        .into_iter()
        .filter_map(|row| {
            let friend_id = row_string(&row, 0);
            if friend_id.is_empty() {
                None
            } else {
                Some(MutualGraphMetaOutput {
                    friend_id,
                    last_fetched_at: row_string(&row, 1),
                    opted_out: row_i64(&row, 2) == 1,
                    total_count: row_value(&row, 3)
                        .as_i64()
                        .and_then(|count| u32::try_from(count).ok()),
                })
            }
        })
        .collect();

    Ok(MutualGraphSnapshotOutput {
        friend_ids,
        links,
        historical_links,
        meta,
    })
}

fn insert_mutual_graph_friend(
    tx: &mut DatabaseWriteTransaction<'_>,
    user_prefix: &str,
    friend_id: &str,
) -> Result<(), crate::Error> {
    tx.execute_non_query(
        &format!("INSERT OR REPLACE INTO {user_prefix}_mutual_graph_friends (friend_id) VALUES (@friend_id)"),
        &ParamsBuilder::new().set("friend_id", friend_id.to_string()).build(),
    )?;
    Ok(())
}

fn insert_mutual_graph_link(
    tx: &mut DatabaseWriteTransaction<'_>,
    user_prefix: &str,
    friend_id: &str,
    mutual_id: &str,
) -> Result<(), crate::Error> {
    tx.execute_non_query(
        &format!("INSERT OR REPLACE INTO {user_prefix}_mutual_graph_links (friend_id, mutual_id) VALUES (@friend_id, @mutual_id)"),
        &ParamsBuilder::new()
            .set("friend_id", friend_id.to_string())
            .set("mutual_id", mutual_id.to_string())
            .build(),
    )?;
    Ok(())
}

fn upsert_mutual_graph_meta_entries(
    tx: &mut DatabaseWriteTransaction<'_>,
    user_prefix: &str,
    entries: &[MutualGraphMetaInput],
) -> Result<(), Error> {
    let now = now_iso();
    for entry in entries {
        let friend_id = normalize_text(&entry.friend_id);
        if friend_id.is_empty() {
            continue;
        }
        tx.execute_non_query(
            &format!("INSERT INTO {user_prefix}_mutual_graph_meta (friend_id, last_fetched_at, opted_out, total_count) VALUES (@friend_id, @last_fetched_at, @opted_out, @total_count) ON CONFLICT(friend_id) DO UPDATE SET last_fetched_at = excluded.last_fetched_at, opted_out = excluded.opted_out, total_count = COALESCE(excluded.total_count, {user_prefix}_mutual_graph_meta.total_count)"),
            &ParamsBuilder::new()
                .set("friend_id", friend_id)
                .set(
                    "last_fetched_at",
                    if entry.last_fetched_at.trim().is_empty() {
                        now.clone()
                    } else {
                        entry.last_fetched_at.clone()
                    },
                )
                .set("opted_out", if entry.opted_out { 1 } else { 0 })
                .set(
                    "total_count",
                    match entry.total_count {
                        Some(total_count) => {
                            serde_json::Value::from(i64::try_from(total_count).unwrap_or(i64::MAX))
                        }
                        None => serde_json::Value::Null,
                    },
                )
                .build(),
        )?;
    }
    Ok(())
}

fn replace_mutual_graph_snapshot_entries(
    tx: &mut DatabaseWriteTransaction<'_>,
    user_prefix: &str,
    entries: &[MutualGraphSnapshotEntryInput],
) -> Result<(), Error> {
    for entry in entries {
        let friend_id = normalize_text(&entry.friend_id);
        if friend_id.is_empty() {
            continue;
        }
        tx.execute_non_query(
            &format!("DELETE FROM {user_prefix}_mutual_graph_links WHERE friend_id = @friend_id"),
            &ParamsBuilder::new()
                .set("friend_id", friend_id.clone())
                .build(),
        )?;
        insert_mutual_graph_friend(tx, user_prefix, &friend_id)?;
        for mutual_id in &entry.mutual_ids {
            let mutual_id = normalize_text(mutual_id);
            if !mutual_id.is_empty() {
                insert_mutual_graph_link(tx, user_prefix, &friend_id, &mutual_id)?;
            }
        }
    }
    Ok(())
}

fn archive_successful_observation(
    tx: &mut DatabaseWriteTransaction<'_>,
    user_prefix: &str,
    observation: &MutualGraphObservationInput,
) -> Result<(), Error> {
    let friend_id = normalize_text(&observation.friend_id);
    let observed_at = normalize_text(&observation.observed_at);
    if friend_id.is_empty() || observed_at.is_empty() {
        return Err(Error::Custom(
            "Mutual graph observation requires an id and time.".into(),
        ));
    }
    let parsed_at = chrono::DateTime::parse_from_rfc3339(&observed_at)
        .map_err(|_| Error::Custom("Mutual graph observation time must be ISO 8601 UTC.".into()))?;
    if parsed_at.offset().local_minus_utc() != 0 {
        return Err(Error::Custom(
            "Mutual graph observation time must be UTC.".into(),
        ));
    }
    let params = ParamsBuilder::new()
        .set("friend_id", friend_id.clone())
        .set("observed_at", observed_at.clone())
        .build();
    tx.execute_non_query(
        &format!("INSERT INTO {user_prefix}_mutual_graph_friends_old (friend_id, last_updated) VALUES (@friend_id, @observed_at) ON CONFLICT(friend_id) DO UPDATE SET last_updated = excluded.last_updated WHERE julianday(excluded.last_updated) >= julianday(last_updated) OR julianday(last_updated) IS NULL"),
        &params,
    )?;
    for mutual_id in &observation.mutual_ids {
        let mutual_id = normalize_text(mutual_id);
        if mutual_id.is_empty() {
            continue;
        }
        tx.execute_non_query(
            &format!("INSERT INTO {user_prefix}_mutual_graph_links_old (friend_id, mutual_id, date) VALUES (@friend_id, @mutual_id, @observed_at) ON CONFLICT(friend_id, mutual_id) DO UPDATE SET date = excluded.date WHERE julianday(excluded.date) >= julianday(date) OR julianday(date) IS NULL"),
            &ParamsBuilder::new()
                .set("friend_id", friend_id.clone())
                .set("mutual_id", mutual_id)
                .set("observed_at", observed_at.clone())
                .build(),
        )?;
    }
    Ok(())
}

fn observation_is_stale(
    tx: &DatabaseWriteTransaction<'_>,
    user_prefix: &str,
    friend_id: &str,
    observed_at: &str,
) -> Result<bool, Error> {
    let previous = tx.execute(
        &format!("SELECT last_updated FROM {user_prefix}_mutual_graph_friends_old WHERE friend_id = @friend_id"),
        &ParamsBuilder::new().set("friend_id", friend_id.to_string()).build(),
    )?.first().map(|row| row_string(row, 0));
    let parse = |value: &str| chrono::DateTime::parse_from_rfc3339(value).ok();
    Ok(previous
        .as_deref()
        .and_then(parse)
        .zip(parse(observed_at))
        .is_some_and(|(previous, current)| previous > current))
}

pub fn mutual_graph_observation_archive(
    db: &DatabaseService,
    owner_user_id: String,
    friend_id: String,
    mutual_ids: Vec<String>,
    observed_at: String,
) -> Result<(), Error> {
    let user_prefix = normalize_user_table_prefix(&normalize_text(owner_user_id))?;
    ensure_user_store_tables(db, &user_prefix)?;
    let observation = MutualGraphObservationInput {
        friend_id,
        mutual_ids,
        observed_at,
    };
    db.write_transaction(|tx| {
        if !observation_is_stale(
            tx,
            &user_prefix,
            &observation.friend_id,
            &observation.observed_at,
        )? {
            archive_successful_observation(tx, &user_prefix, &observation)?;
        }
        Ok(())
    })?;
    Ok(())
}

fn prune_missing_current_users(
    tx: &mut DatabaseWriteTransaction<'_>,
    user_prefix: &str,
    scope_ids: &[String],
) -> Result<(), Error> {
    let mut keep: HashSet<String> = scope_ids.iter().map(normalize_text).collect();
    for row in tx.execute(
        &format!("SELECT user_id FROM {user_prefix}_tracked_nonfriends"),
        &Default::default(),
    )? {
        keep.insert(row_string(&row, 0));
    }
    let mut existing = HashSet::new();
    for table in [
        "mutual_graph_friends",
        "mutual_graph_links",
        "mutual_graph_meta",
    ] {
        for row in tx.execute(
            &format!("SELECT DISTINCT friend_id FROM {user_prefix}_{table}"),
            &Default::default(),
        )? {
            existing.insert(row_string(&row, 0));
        }
    }
    for friend_id in existing.difference(&keep) {
        let params = ParamsBuilder::new()
            .set("friend_id", friend_id.clone())
            .build();
        for table in [
            "mutual_graph_links",
            "mutual_graph_friends",
            "mutual_graph_meta",
        ] {
            tx.execute_non_query(
                &format!("DELETE FROM {user_prefix}_{table} WHERE friend_id = @friend_id"),
                &params,
            )?;
        }
    }
    Ok(())
}

pub fn mutual_graph_snapshot_commit(
    db: &DatabaseService,
    user_id: String,
    entries: Vec<MutualGraphSnapshotEntryInput>,
    meta_entries: Vec<MutualGraphMetaInput>,
    observations: Vec<MutualGraphObservationInput>,
    replace_missing: bool,
    scope_ids: Vec<String>,
) -> Result<(), Error> {
    let user_prefix = normalize_user_table_prefix(&user_id)?;
    ensure_user_store_tables(db, &user_prefix)?;
    db.write_transaction(|tx| {
        let mut observed_ids = HashSet::new();
        let mut stale_ids = HashSet::new();
        for observation in &observations {
            let friend_id = normalize_text(&observation.friend_id);
            let valid_entry = entries.iter().any(|entry| {
                normalize_text(&entry.friend_id) == friend_id
                    && entry.mutual_ids == observation.mutual_ids
            });
            let valid_meta = meta_entries.iter().any(|meta| {
                normalize_text(&meta.friend_id) == friend_id
                    && !meta.opted_out
                    && meta.last_fetched_at == observation.observed_at
            });
            if !observed_ids.insert(friend_id) || !valid_entry || !valid_meta {
                return Err(Error::Custom(
                    "Mutual graph archive must match a successful current observation.".into(),
                ));
            }
            if observation_is_stale(
                tx,
                &user_prefix,
                &observation.friend_id,
                &observation.observed_at,
            )? {
                stale_ids.insert(normalize_text(&observation.friend_id));
            }
        }
        if replace_missing {
            prune_missing_current_users(tx, &user_prefix, &scope_ids)?;
        }
        let current_meta: Vec<_> = meta_entries
            .into_iter()
            .filter(|entry| !stale_ids.contains(&normalize_text(&entry.friend_id)))
            .collect();
        let current_entries: Vec<_> = entries
            .into_iter()
            .filter(|entry| !stale_ids.contains(&normalize_text(&entry.friend_id)))
            .collect();
        upsert_mutual_graph_meta_entries(tx, &user_prefix, &current_meta)?;
        replace_mutual_graph_snapshot_entries(tx, &user_prefix, &current_entries)?;
        for observation in &observations {
            if !stale_ids.contains(&normalize_text(&observation.friend_id)) {
                archive_successful_observation(tx, &user_prefix, observation)?;
            }
        }
        Ok(())
    })?;
    Ok(())
}

pub fn mutual_graph_friend_refresh_commit(
    db: &DatabaseService,
    user_id: String,
    friend_id: String,
    mutual_ids: Option<Vec<String>>,
    total_count: Option<usize>,
    opted_out: bool,
    observed_at: Option<String>,
) -> Result<(), Error> {
    let user_prefix = normalize_user_table_prefix(&user_id)?;
    ensure_user_store_tables(db, &user_prefix)?;
    let friend_id = normalize_text(friend_id);
    if friend_id.is_empty() {
        return Ok(());
    }
    db.write_transaction(|tx| {
        if opted_out && (mutual_ids.is_some() || observed_at.is_some()) {
            return Err(Error::Custom(
                "Opted-out graph observations cannot be archived.".into(),
            ));
        }
        if mutual_ids.is_some() && observed_at.is_none() {
            return Err(Error::Custom(
                "Successful graph observations require a time.".into(),
            ));
        }
        let observation =
            mutual_ids
                .as_ref()
                .zip(observed_at.as_ref())
                .map(|(mutual_ids, observed_at)| MutualGraphObservationInput {
                    friend_id: friend_id.clone(),
                    mutual_ids: mutual_ids.clone(),
                    observed_at: observed_at.clone(),
                });
        if let Some(observation) = &observation {
            if observation_is_stale(tx, &user_prefix, &friend_id, &observation.observed_at)? {
                return Ok(());
            }
        }
        if let Some(mutual_ids) = mutual_ids {
            insert_mutual_graph_friend(tx, &user_prefix, &friend_id)?;
            tx.execute_non_query(
                &format!(
                    "DELETE FROM {user_prefix}_mutual_graph_links WHERE friend_id = @friend_id"
                ),
                &ParamsBuilder::new()
                    .set("friend_id", friend_id.clone())
                    .build(),
            )?;
            for mutual_id in mutual_ids {
                let mutual_id = normalize_text(mutual_id);
                if !mutual_id.is_empty() {
                    insert_mutual_graph_link(tx, &user_prefix, &friend_id, &mutual_id)?;
                }
            }
        }
        upsert_mutual_graph_meta_entries(
            tx,
            &user_prefix,
            &[MutualGraphMetaInput {
                friend_id,
                last_fetched_at: observed_at.unwrap_or_default(),
                opted_out,
                total_count,
            }],
        )?;
        if let Some(observation) = observation {
            archive_successful_observation(tx, &user_prefix, &observation)?;
        }
        Ok(())
    })?;
    Ok(())
}

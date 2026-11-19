//! Read-only "recently met" / "recently joined" sources for the quick search
//! (#17, jirai quickSearch loadRecentItems). New queries only: no existing
//! `gamelog_*` query is changed. Rows are isolated by the current account's
//! `owner_id` (precedent: `player_list.rs`).

use crate::common::{normalize_text, row_string, ParamsBuilder};
use crate::database::DatabaseService;
use crate::game_log::ensure_game_log_tables;
use crate::ownership::{owner_id_for_filter, OwnerId};
use crate::Error;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct QuickSearchRecentUser {
    pub user_id: String,
    pub display_name: String,
    pub last_seen_at: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct QuickSearchRecentWorld {
    pub world_id: String,
    pub world_name: String,
    pub location: String,
    pub last_joined_at: String,
}

/// Players the account met most recently (join or leave events), newest first,
/// one row per user, excluding the account itself and rows without a user id.
pub fn quick_search_recent_met_users(
    db: &DatabaseService,
    owner_user_id: &OwnerId,
    limit: usize,
) -> Result<Vec<QuickSearchRecentUser>, Error> {
    ensure_game_log_tables(db)?;
    let owner_id = owner_id_for_filter(db, owner_user_id)?;
    let self_user_id = normalize_text(owner_user_id.as_str());
    Ok(db
        .execute(
            "SELECT latest.user_id, latest.display_name, recent.last_seen_at
             FROM (
                 SELECT user_id, MAX(id) AS latest_id, MAX(created_at) AS last_seen_at
                 FROM gamelog_join_leave
                 WHERE owner_id IN (0, @owner_id)
                   AND type IN ('OnPlayerJoined', 'OnPlayerLeft')
                   AND user_id IS NOT NULL
                   AND TRIM(user_id) <> ''
                   AND user_id <> @self_user_id
                 GROUP BY user_id
             ) AS recent
             JOIN gamelog_join_leave AS latest ON latest.id = recent.latest_id
             ORDER BY recent.latest_id DESC
             LIMIT @limit",
            &ParamsBuilder::new()
                .set("owner_id", owner_id)
                .set("self_user_id", self_user_id)
                .set("limit", limit as i64)
                .build(),
        )?
        .into_iter()
        .map(|row| QuickSearchRecentUser {
            user_id: row_string(&row, 0),
            display_name: row_string(&row, 1),
            last_seen_at: row_string(&row, 2),
        })
        .collect())
}

/// Worlds the account joined most recently, newest first, one row per world.
pub fn quick_search_recent_joined_worlds(
    db: &DatabaseService,
    owner_user_id: &OwnerId,
    limit: usize,
) -> Result<Vec<QuickSearchRecentWorld>, Error> {
    ensure_game_log_tables(db)?;
    let owner_id = owner_id_for_filter(db, owner_user_id)?;
    Ok(db
        .execute(
            "SELECT latest.world_id, latest.world_name, latest.location, recent.last_joined_at
             FROM (
                 SELECT world_id, MAX(id) AS latest_id, MAX(created_at) AS last_joined_at
                 FROM gamelog_location
                 WHERE owner_id IN (0, @owner_id)
                   AND world_id IS NOT NULL
                   AND TRIM(world_id) <> ''
                 GROUP BY world_id
             ) AS recent
             JOIN gamelog_location AS latest ON latest.id = recent.latest_id
             ORDER BY recent.latest_id DESC
             LIMIT @limit",
            &ParamsBuilder::new()
                .set("owner_id", owner_id)
                .set("limit", limit as i64)
                .build(),
        )?
        .into_iter()
        .map(|row| QuickSearchRecentWorld {
            world_id: row_string(&row, 0),
            world_name: row_string(&row, 1),
            location: row_string(&row, 2),
            last_joined_at: row_string(&row, 3),
        })
        .collect())
}

#[cfg(test)]
mod tests;

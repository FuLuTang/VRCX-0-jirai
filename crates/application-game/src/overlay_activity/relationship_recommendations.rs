use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashSet;
use vrcx_0_application_activity::{OverlayActivityCandidate, OverlayActivityFavoriteSubject};

#[derive(Clone, Debug, Deserialize, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct RelationshipRecommendationPair {
    pub user_id_a: String,
    pub user_id_b: String,
    pub name_a: String,
    pub name_b: String,
    pub score: u32,
}

#[derive(Default)]
pub(crate) struct RelationshipRecommendationCache {
    account_id: String,
    auth_scope_generation: u64,
    location: String,
    pairs: Vec<RelationshipRecommendationPair>,
    active: HashSet<String>,
    sequence: u64,
}

impl RelationshipRecommendationCache {
    pub(crate) fn set(
        &mut self,
        account_id: String,
        auth_scope_generation: u64,
        pairs: Vec<RelationshipRecommendationPair>,
    ) {
        if self.account_id != account_id || self.auth_scope_generation != auth_scope_generation {
            self.active.clear();
            self.location.clear();
        }
        self.account_id = account_id;
        self.auth_scope_generation = auth_scope_generation;
        self.pairs = pairs;
    }

    // Called only from the existing live overlay ingestion path. Replayed joins
    // never enter this path, and only an actual arriving member can trigger a pair.
    #[allow(clippy::too_many_arguments)]
    pub(crate) fn live_candidates(
        &mut self,
        account_id: &str,
        auth_scope_generation: u64,
        location: &str,
        present: &HashSet<String>,
        joined: &HashSet<String>,
        departed: &HashSet<String>,
        created_at: &str,
        enabled: bool,
        historical: bool,
    ) -> Vec<OverlayActivityCandidate> {
        if self.account_id != account_id || self.auth_scope_generation != auth_scope_generation {
            self.active.clear();
            self.location.clear();
            return Vec::new();
        }
        if self.location != location {
            self.active.clear();
            self.location = location.to_string();
        }
        self.active.retain(|key| {
            let Some((a, b)) = key.split_once('|') else {
                return false;
            };
            present.contains(a)
                && present.contains(b)
                && !departed.contains(a)
                && !departed.contains(b)
        });
        if historical || !enabled || !location.starts_with("wrld_") || !location.contains(':') {
            return Vec::new();
        }
        let mut result = Vec::new();
        for pair in &self.pairs {
            let a = &pair.user_id_a;
            let b = &pair.user_id_b;
            if a == b
                || a.is_empty()
                || b.is_empty()
                || !present.contains(a)
                || !present.contains(b)
                || !(joined.contains(a) || joined.contains(b))
            {
                continue;
            }
            let key = if a < b {
                format!("{a}|{b}")
            } else {
                format!("{b}|{a}")
            };
            if !self.active.insert(key.clone()) {
                continue;
            }
            self.sequence += 1;
            result.push(OverlayActivityCandidate {
                source_id: format!(
                    "relationship:{account_id}:{location}:{key}:{}",
                    self.sequence
                ),
                activity_type: "RelationshipRecommendation".into(),
                created_at: created_at.into(),
                actor_user_id: a.clone(),
                actor_display_name: pair.name_a.clone(),
                current_instance: true,
                favorite_subject: OverlayActivityFavoriteSubject::None,
                payload: json!({ "location": location, "userIdA": a, "userIdB": b,
                    "nameA": pair.name_a, "nameB": pair.name_b, "score": pair.score
                })
                .into(),
            });
        }
        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn live_pair_dedup_departure_account_and_replay_baseline() {
        let mut cache = RelationshipRecommendationCache::default();
        cache.set(
            "me".into(),
            1,
            vec![RelationshipRecommendationPair {
                user_id_a: "a".into(),
                user_id_b: "b".into(),
                name_a: "A".into(),
                name_b: "B".into(),
                score: 5,
            }],
        );
        let present = HashSet::from(["a".into(), "b".into()]);
        let joined = HashSet::from(["b".into()]);
        let none = HashSet::new();
        assert!(cache
            .live_candidates("me", 1, "wrld_x:1", &present, &none, &none, "now", true, false)
            .is_empty());
        assert!(cache
            .live_candidates("me", 1, "wrld_x:1", &present, &joined, &none, "now", true, true)
            .is_empty());
        assert!(cache
            .live_candidates("me", 2, "wrld_x:1", &present, &joined, &none, "now", true, false)
            .is_empty());
        assert_eq!(
            cache
                .live_candidates("me", 1, "wrld_x:1", &present, &joined, &none, "now", true, false)
                .len(),
            1
        );
        assert!(cache
            .live_candidates("me", 1, "wrld_x:1", &present, &joined, &none, "now", true, false)
            .is_empty());
        cache.live_candidates(
            "me",
            1,
            "wrld_x:1",
            &HashSet::from(["a".into()]),
            &none,
            &joined,
            "now",
            true,
            false,
        );
        assert_eq!(
            cache
                .live_candidates("me", 1, "wrld_x:1", &present, &joined, &none, "now", true, false)
                .len(),
            1
        );
        assert!(cache
            .live_candidates("other", 1, "wrld_x:1", &present, &joined, &none, "now", true, false)
            .is_empty());
        assert!(cache
            .live_candidates("me", 1, "wrld_x:1", &present, &joined, &none, "now", false, false)
            .is_empty());
    }
}

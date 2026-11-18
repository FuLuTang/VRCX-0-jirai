//! Auto follow (#7): follow one friend into each new instance they move to.
//!
//! The runtime only decides. It keeps the single target in memory (nothing is
//! persisted) and turns friend projections into an [AutoFollowTriggered] event; the
//! frontend performs the launch action.

use std::sync::{Mutex, MutexGuard};

use serde::Serialize;
use vrcx_0_contracts::RuntimeEventPayload;
use vrcx_0_core::location::is_real_instance;
use vrcx_0_core::presence::PresenceView;

use crate::FriendProjection;

/// Location reported for a friend without a place (active on the website or offline).
const NO_PLACE_LOCATION: &str = "offline";

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct AutoFollowStatus {
    pub active: bool,
    pub target_user_id: Option<String>,
    pub target_display_name: Option<String>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum AutoFollowAction {
    /// Open the instance in the running game, falling back to a self invite.
    Attach,
    /// Quit the game and relaunch it in desktop mode into the instance.
    RelaunchDesktop,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct AutoFollowMode {
    /// Persisted "last launch was desktop mode" flag (config key isGameNoVR).
    pub is_game_no_vr: bool,
    pub is_steamvr_running: bool,
}

impl AutoFollowMode {
    pub fn action(self) -> AutoFollowAction {
        if !self.is_game_no_vr || self.is_steamvr_running {
            AutoFollowAction::Attach
        } else {
            AutoFollowAction::RelaunchDesktop
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct AutoFollowTriggered {
    pub user_id: String,
    pub display_name: String,
    pub location: String,
    pub action: AutoFollowAction,
}

impl RuntimeEventPayload for AutoFollowTriggered {
    const EVENT_NAME: &'static str = "autoFollowTriggered";
}

/// The location tag a friend presence reports, matching the jirai friend ref location:
/// the instance tag, "traveling", "private", "" for unknown places, or "offline".
pub fn friend_presence_location(view: &PresenceView) -> String {
    match view.place() {
        Some(place) => place.location.tag.trim().to_string(),
        None => NO_PLACE_LOCATION.to_string(),
    }
}

/// Decide whether a target location report should produce an action.
///
/// `previous` is the last location seen for the target, `observed` the new one
/// (`None` when the target is gone), and `self_location` the current user's game
/// location ("" when the game is not running).
pub fn decide_auto_follow(
    previous: Option<&str>,
    observed: Option<&str>,
    self_location: &str,
    mode: AutoFollowMode,
) -> Option<AutoFollowAction> {
    let observed = observed
        .map(str::trim)
        .filter(|location| !location.is_empty())?;
    if previous.map(str::trim) == Some(observed) {
        return None;
    }
    if !is_real_instance(observed) || observed == self_location.trim() {
        return None;
    }
    Some(mode.action())
}

#[derive(Clone, Debug, PartialEq, Eq)]
struct AutoFollowTarget {
    user_id: String,
    display_name: String,
    last_location: Option<String>,
}

#[derive(Debug, Default)]
pub struct AutoFollowRuntime {
    target: Mutex<Option<AutoFollowTarget>>,
}

impl AutoFollowRuntime {
    pub fn new() -> Self {
        Self::default()
    }

    fn lock(&self) -> MutexGuard<'_, Option<AutoFollowTarget>> {
        self.target
            .lock()
            .unwrap_or_else(|error| error.into_inner())
    }

    /// Start following `user_id`, replacing any previous target. The target's current
    /// location only seeds the comparison, so starting never produces an action.
    pub fn start(
        &self,
        user_id: &str,
        display_name: &str,
        current_location: Option<&str>,
    ) -> AutoFollowStatus {
        let user_id = user_id.trim();
        let mut target = self.lock();
        if !user_id.is_empty() {
            let display_name = display_name.trim();
            *target = Some(AutoFollowTarget {
                user_id: user_id.to_string(),
                display_name: if display_name.is_empty() {
                    user_id.to_string()
                } else {
                    display_name.to_string()
                },
                last_location: current_location.map(|location| location.trim().to_owned()),
            });
        }
        status_of(target.as_ref())
    }

    pub fn stop(&self) -> AutoFollowStatus {
        let mut target = self.lock();
        *target = None;
        status_of(None)
    }

    pub fn status(&self) -> AutoFollowStatus {
        status_of(self.lock().as_ref())
    }

    /// Record a location report for `user_id`; `observed` is `None` when the user is
    /// no longer a friend. The context closures only run when the target moved to a
    /// new real instance.
    pub fn observe_location(
        &self,
        user_id: &str,
        observed: Option<&str>,
        self_location: impl FnOnce() -> String,
        mode: impl FnOnce() -> AutoFollowMode,
    ) -> Option<AutoFollowTriggered> {
        let mut guard = self.lock();
        let target = guard.as_mut()?;
        if target.user_id != user_id.trim() {
            return None;
        }
        let observed = observed.map(|location| location.trim().to_string());
        if observed == target.last_location {
            return None;
        }
        let previous = std::mem::replace(&mut target.last_location, observed.clone());
        let observed = observed?;
        if !is_real_instance(&observed) {
            return None;
        }
        let self_location = self_location();
        let action = decide_auto_follow(
            previous.as_deref(),
            Some(observed.as_str()),
            &self_location,
            mode(),
        )?;
        Some(AutoFollowTriggered {
            user_id: target.user_id.clone(),
            display_name: target.display_name.clone(),
            location: observed,
            action,
        })
    }

    /// Feed one friend projection (websocket events, profile fetches and baseline
    /// refreshes all pass through the same projection sink).
    pub fn observe_projection(
        &self,
        projection: &FriendProjection,
        self_location: impl FnOnce() -> String,
        mode: impl FnOnce() -> AutoFollowMode,
    ) -> Option<AutoFollowTriggered> {
        let target_user_id = self.lock().as_ref()?.user_id.clone();
        let observed = projected_target_location(projection, &target_user_id)?;
        self.observe_location(&target_user_id, observed.as_deref(), self_location, mode)
    }
}

fn status_of(target: Option<&AutoFollowTarget>) -> AutoFollowStatus {
    match target {
        Some(target) => AutoFollowStatus {
            active: true,
            target_user_id: Some(target.user_id.clone()),
            target_display_name: Some(target.display_name.clone()),
        },
        None => AutoFollowStatus::default(),
    }
}

/// `None` when the projection does not mention the user, `Some(None)` when the user
/// was removed from the roster, otherwise the reported location.
fn projected_target_location(
    projection: &FriendProjection,
    user_id: &str,
) -> Option<Option<String>> {
    if let Some(patch) = projection
        .patches
        .iter()
        .rev()
        .find(|patch| patch.user_id.trim() == user_id)
    {
        return Some(Some(friend_presence_location(&patch.presence.view)));
    }
    projection
        .removals
        .iter()
        .any(|removed| removed.trim() == user_id)
        .then_some(None)
}

#[cfg(test)]
mod tests {
    use std::cell::Cell;

    use super::*;
    use crate::FriendProjectionPatch;
    use vrcx_0_core::friends::FriendRecord;
    use vrcx_0_core::presence::{Place, PresenceEntry, PresencePlace};

    const TARGET: &str = "usr_target";
    const OTHER: &str = "usr_other";
    const WORLD_A: &str = "wrld_a:1~region(jp)";
    const WORLD_B: &str = "wrld_b:2~region(us)";
    const WORLD_C: &str = "wrld_c:3";

    const VR: AutoFollowMode = AutoFollowMode {
        is_game_no_vr: false,
        is_steamvr_running: false,
    };
    const DESKTOP: AutoFollowMode = AutoFollowMode {
        is_game_no_vr: true,
        is_steamvr_running: false,
    };

    fn online_view(location: &str, traveling_to: &str) -> PresenceView {
        PresenceView::Online {
            place: PresencePlace::new(&Place::from_location(location, traveling_to)),
            platform: "standalonewindows".to_string(),
            online_since_ms: None,
        }
    }

    fn patch(user_id: &str, view: PresenceView) -> FriendProjectionPatch {
        FriendProjectionPatch {
            user_id: user_id.to_string(),
            record: FriendRecord {
                id: user_id.to_string(),
                display_name: "Display".into(),
                ..FriendRecord::default()
            },
            presence: PresenceEntry { rev: 0, view },
        }
    }

    fn projection(
        generation: u64,
        patches: Vec<FriendProjectionPatch>,
        removals: &[&str],
    ) -> FriendProjection {
        let mut projection = FriendProjection::new(generation, 0);
        projection.patches = patches;
        projection.removals = removals.iter().map(|id| id.to_string()).collect();
        projection
    }

    fn moved(user_id: &str, location: &str) -> FriendProjection {
        projection(1, vec![patch(user_id, online_view(location, ""))], &[])
    }

    fn observe(
        runtime: &AutoFollowRuntime,
        projection: &FriendProjection,
        self_location: &str,
        mode: AutoFollowMode,
    ) -> Option<AutoFollowTriggered> {
        runtime.observe_projection(projection, || self_location.to_string(), || mode)
    }

    fn observed_location(
        runtime: &AutoFollowRuntime,
        projection: &FriendProjection,
        self_location: &str,
        mode: AutoFollowMode,
    ) -> Option<String> {
        observe(runtime, projection, self_location, mode).map(|triggered| triggered.location)
    }

    fn observed_action(
        runtime: &AutoFollowRuntime,
        projection: &FriendProjection,
        self_location: &str,
        mode: AutoFollowMode,
    ) -> Option<AutoFollowAction> {
        observe(runtime, projection, self_location, mode).map(|triggered| triggered.action)
    }

    fn following(location: Option<&str>) -> AutoFollowRuntime {
        let runtime = AutoFollowRuntime::new();
        runtime.start(TARGET, "Target", location);
        runtime
    }

    // A7-1: at most one target; starting on a new target replaces the old one.
    #[test]
    fn a7_1_starting_a_new_target_replaces_the_previous_one() {
        let runtime = following(Some("offline"));
        let status = runtime.start(OTHER, "Other", Some("offline"));
        assert_eq!(
            status,
            AutoFollowStatus {
                active: true,
                target_user_id: Some(OTHER.to_string()),
                target_display_name: Some("Other".to_string()),
            }
        );
        assert_eq!(observe(&runtime, &moved(TARGET, WORLD_A), "", VR), None);
        let triggered = observe(&runtime, &moved(OTHER, WORLD_A), "", VR).unwrap();
        assert_eq!(triggered.user_id, OTHER);
        assert_eq!(triggered.display_name, "Other");
    }

    // A7-3: a new real instance different from the own location acts exactly once.
    #[test]
    fn a7_3_new_real_instance_acts_exactly_once() {
        let runtime = following(Some("offline"));
        let triggered = observe(&runtime, &moved(TARGET, WORLD_A), WORLD_C, VR);
        assert_eq!(
            triggered,
            Some(AutoFollowTriggered {
                user_id: TARGET.to_string(),
                display_name: "Target".to_string(),
                location: WORLD_A.to_string(),
                action: AutoFollowAction::Attach,
            })
        );
        let repeated = moved(TARGET, WORLD_A);
        assert_eq!(observe(&runtime, &repeated, WORLD_C, VR), None);
    }

    // A7-4 (pure decision table): every non-acting case, one row each.
    #[test]
    fn a7_4_decision_table_rejects_non_actionable_locations() {
        let cases: [(&str, Option<&str>, &str); 11] = [
            ("empty", Some(""), ""),
            ("blank", Some("   "), ""),
            ("missing", None, ""),
            ("offline", Some("offline"), ""),
            ("offline pair", Some("offline:offline"), ""),
            ("private", Some("private"), ""),
            ("private pair", Some("private:private"), ""),
            ("traveling", Some("traveling"), ""),
            ("traveling pair", Some("traveling:traveling"), ""),
            ("local", Some("local:12345"), ""),
            ("equal to own location", Some(WORLD_A), WORLD_A),
        ];
        for (name, observed, self_location) in cases {
            for mode in [VR, DESKTOP] {
                assert_eq!(
                    decide_auto_follow(Some(WORLD_C), observed, self_location, mode),
                    None,
                    "{name}"
                );
            }
        }
        assert_eq!(
            decide_auto_follow(Some(WORLD_A), Some(WORLD_A), "", VR),
            None,
            "unchanged location"
        );
        assert_eq!(
            decide_auto_follow(Some("offline"), Some(WORLD_A), "", VR),
            Some(AutoFollowAction::Attach)
        );
    }

    // A7-4: empty location does not act.
    #[test]
    fn a7_4_empty_location_does_not_act() {
        let runtime = following(Some(WORLD_B));
        assert_eq!(
            runtime.observe_location(TARGET, Some(""), String::new, || VR),
            None
        );
    }

    // A7-4: offline does not act.
    #[test]
    fn a7_4_offline_does_not_act() {
        let runtime = following(Some(WORLD_B));
        let offline = projection(1, vec![patch(TARGET, PresenceView::Offline)], &[]);
        assert_eq!(observe(&runtime, &offline, "", VR), None);
        let active = projection(
            1,
            vec![patch(
                TARGET,
                PresenceView::Active {
                    platform: "web".to_string(),
                },
            )],
            &[],
        );
        assert_eq!(observe(&runtime, &active, "", VR), None);
    }

    // A7-4: private does not act.
    #[test]
    fn a7_4_private_does_not_act() {
        let runtime = following(Some("offline"));
        assert_eq!(observe(&runtime, &moved(TARGET, "private"), "", VR), None);
        assert!(runtime.status().active);
    }

    // A7-4: traveling does not act; the arrival afterwards does.
    #[test]
    fn a7_4_traveling_does_not_act_until_arrival() {
        let runtime = following(Some("offline"));
        let traveling = projection(
            1,
            vec![patch(TARGET, online_view("traveling", WORLD_A))],
            &[],
        );
        assert_eq!(observe(&runtime, &traveling, "", VR), None);
        assert_eq!(
            observed_location(&runtime, &moved(TARGET, WORLD_A), "", VR),
            Some(WORLD_A.to_string())
        );
    }

    // A7-4: a local instance does not act (the raw tag and its projected form).
    #[test]
    fn a7_4_local_instance_does_not_act() {
        let runtime = following(Some("offline"));
        assert_eq!(
            runtime.observe_location(TARGET, Some("local:abcdef"), String::new, || VR),
            None
        );
        let local = moved(TARGET, "local:abcdef");
        assert_eq!(observe(&runtime, &local, "", VR), None);
    }

    // A7-4: the target joining the instance the user is already in does not act.
    #[test]
    fn a7_4_location_equal_to_own_location_does_not_act() {
        let runtime = following(Some("offline"));
        let joined_own_instance = moved(TARGET, WORLD_A);
        assert_eq!(observe(&runtime, &joined_own_instance, WORLD_A, VR), None);
    }

    // A7-4: without a target nothing acts and no context is read.
    #[test]
    fn a7_4_no_target_does_not_act() {
        let runtime = AutoFollowRuntime::new();
        let triggered = runtime.observe_projection(
            &moved(TARGET, WORLD_A),
            || panic!("self location must not be read without a target"),
            || panic!("mode must not be read without a target"),
        );
        assert_eq!(triggered, None);
    }

    // A7-4: a stopped follow does not act.
    #[test]
    fn a7_4_stopped_follow_does_not_act() {
        let runtime = following(Some("offline"));
        runtime.stop();
        assert_eq!(observe(&runtime, &moved(TARGET, WORLD_A), "", VR), None);
    }

    // A7-5: !isGameNoVR || SteamVR running -> Attach.
    #[test]
    fn a7_5_vr_mode_or_steamvr_attaches() {
        for (is_game_no_vr, is_steamvr_running) in [(false, false), (false, true), (true, true)] {
            let mode = AutoFollowMode {
                is_game_no_vr,
                is_steamvr_running,
            };
            assert_eq!(mode.action(), AutoFollowAction::Attach);
            let runtime = following(Some("offline"));
            assert_eq!(
                observed_action(&runtime, &moved(TARGET, WORLD_A), WORLD_C, mode),
                Some(AutoFollowAction::Attach),
                "isGameNoVR={is_game_no_vr} steamvr={is_steamvr_running}"
            );
        }
    }

    // A7-6: isGameNoVR && !SteamVR -> RelaunchDesktop.
    #[test]
    fn a7_6_desktop_mode_without_steamvr_relaunches() {
        assert_eq!(DESKTOP.action(), AutoFollowAction::RelaunchDesktop);
        let runtime = following(Some("offline"));
        assert_eq!(
            observed_action(&runtime, &moved(TARGET, WORLD_A), WORLD_C, DESKTOP),
            Some(AutoFollowAction::RelaunchDesktop)
        );
    }

    // A7-7: after stop nothing acts; the state only lives in memory, so a fresh
    // runtime (an app restart) starts without a target.
    #[test]
    fn a7_7_stop_ends_actions_and_state_is_not_persisted() {
        let runtime = following(Some("offline"));
        assert_eq!(runtime.stop(), AutoFollowStatus::default());
        for location in [WORLD_A, WORLD_B, WORLD_A] {
            assert_eq!(observe(&runtime, &moved(TARGET, location), "", VR), None);
        }
        assert_eq!(runtime.status(), AutoFollowStatus::default());
        let restarted = AutoFollowRuntime::new();
        assert_eq!(restarted.status(), AutoFollowStatus::default());
    }

    // A7-10: no cooldown; two different instances act twice, a repeated report once.
    #[test]
    fn a7_10_each_new_instance_acts_and_repeats_do_not() {
        let runtime = following(Some("offline"));
        let actions = [WORLD_A, WORLD_A, WORLD_B, WORLD_B, WORLD_B]
            .into_iter()
            .filter_map(|location| {
                observed_location(&runtime, &moved(TARGET, location), "", DESKTOP)
            })
            .collect::<Vec<_>>();
        assert_eq!(actions, [WORLD_A.to_string(), WORLD_B.to_string()]);
    }

    // A7-11: switching accounts does not clear the target. The runtime has no account
    // hook; a rebuilt roster of another account (new generation, target absent) leaves
    // it active, and the target's next move still acts.
    #[test]
    fn a7_11_account_switch_keeps_the_target() {
        let runtime = following(Some(WORLD_A));
        let other_account = projection(2, vec![patch(OTHER, online_view(WORLD_B, ""))], &[]);
        assert_eq!(observe(&runtime, &other_account, "", VR), None);
        assert_eq!(runtime.status().target_user_id.as_deref(), Some(TARGET));
        let back = projection(3, vec![patch(TARGET, online_view(WORLD_C, ""))], &[]);
        assert_eq!(
            observed_location(&runtime, &back, "", VR),
            Some(WORLD_C.to_string())
        );
    }

    // A7-12: the initial state has no target and never acts.
    #[test]
    fn a7_12_initial_state_has_no_target() {
        let runtime = AutoFollowRuntime::new();
        assert_eq!(
            runtime.status(),
            AutoFollowStatus {
                active: false,
                target_user_id: None,
                target_display_name: None,
            }
        );
        assert_eq!(observe(&runtime, &moved(TARGET, WORLD_A), "", VR), None);
        assert_eq!(
            runtime.observe_location(TARGET, Some(WORLD_B), String::new, || VR),
            None
        );
    }

    // A7-13: starting while the target is already in an instance does not act; the
    // same instance reported again (baseline refresh) does not act either.
    #[test]
    fn a7_13_starting_does_not_act_on_the_current_instance() {
        let runtime = AutoFollowRuntime::new();
        let status = runtime.start(TARGET, "Target", Some(WORLD_A));
        assert!(status.active);
        assert_eq!(observe(&runtime, &moved(TARGET, WORLD_A), "", VR), None);
        assert_eq!(
            observed_location(&runtime, &moved(TARGET, WORLD_B), "", VR),
            Some(WORLD_B.to_string())
        );
    }

    // A7-14: with the game not running (own location empty) a move still acts, and
    // the branch follows the persisted mode.
    #[test]
    fn a7_14_game_not_running_still_acts_with_configured_branch() {
        for (mode, expected) in [
            (VR, AutoFollowAction::Attach),
            (DESKTOP, AutoFollowAction::RelaunchDesktop),
        ] {
            let runtime = following(Some("offline"));
            assert_eq!(
                observed_action(&runtime, &moved(TARGET, WORLD_A), "", mode),
                Some(expected)
            );
        }
    }

    // A7-16: a target removed from the friend list does not act, and the follow stays
    // active until the user stops it.
    #[test]
    fn a7_16_removed_target_stays_active_without_acting() {
        let runtime = following(Some(WORLD_A));
        let removed = projection(1, Vec::new(), &[TARGET]);
        assert_eq!(observe(&runtime, &removed, "", VR), None);
        assert!(runtime.status().active);
        assert_eq!(runtime.status().target_user_id.as_deref(), Some(TARGET));
        let unrelated = moved(OTHER, WORLD_B);
        assert_eq!(observe(&runtime, &unrelated, "", VR), None);
        assert!(runtime.status().active);
    }

    // Context closures are only read when the target actually moved somewhere real.
    #[test]
    fn context_is_read_only_for_a_real_move_of_the_target() {
        let runtime = following(Some(WORLD_A));
        let reads = Cell::new(0);
        let count = || {
            reads.set(reads.get() + 1);
            String::new()
        };
        runtime.observe_projection(&moved(OTHER, WORLD_B), count, || VR);
        runtime.observe_projection(&moved(TARGET, WORLD_A), count, || VR);
        runtime.observe_projection(&moved(TARGET, "private"), count, || VR);
        assert_eq!(reads.get(), 0);
        runtime.observe_projection(&moved(TARGET, WORLD_B), count, || VR);
        assert_eq!(reads.get(), 1);
    }

    #[test]
    fn friend_presence_location_matches_friend_ref_location() {
        let instance = online_view(WORLD_A, "");
        assert_eq!(friend_presence_location(&instance), WORLD_A);
        assert_eq!(
            friend_presence_location(&online_view("traveling", WORLD_B)),
            "traveling"
        );
        let private = online_view("private", "");
        assert_eq!(friend_presence_location(&private), "private");
        assert_eq!(friend_presence_location(&PresenceView::Offline), "offline");
    }

    #[test]
    fn triggered_event_serializes_to_the_frontend_contract() {
        assert_eq!(AutoFollowTriggered::EVENT_NAME, "autoFollowTriggered");
        let value = serde_json::to_value(AutoFollowTriggered {
            user_id: TARGET.to_string(),
            display_name: "Target".to_string(),
            location: WORLD_A.to_string(),
            action: AutoFollowAction::RelaunchDesktop,
        })
        .unwrap();
        assert_eq!(
            value,
            serde_json::json!({
                "userId": TARGET,
                "displayName": "Target",
                "location": WORLD_A,
                "action": "relaunchDesktop",
            })
        );
        let status = serde_json::to_value(following(None).status()).unwrap();
        assert_eq!(
            status,
            serde_json::json!({
                "active": true,
                "targetUserId": TARGET,
                "targetDisplayName": "Target",
            })
        );
        assert_eq!(
            serde_json::to_value(AutoFollowAction::Attach).unwrap(),
            serde_json::json!("attach")
        );
    }
}

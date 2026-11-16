use std::sync::Mutex;

use serde_json::json;
use vrcx_0_application_realtime::test_support::runtime_with_active_session;
use vrcx_0_application_realtime::{RealtimeWsMessagePayload, SyntheticFriendEventOutcome};
use vrcx_0_contracts::vrchat_api::VrchatRequest;
use vrcx_0_contracts::vrchat_api::VrchatResponse;

use super::*;
use crate::remote::VrchatRequestFuture;
use crate::social::MutualGraphStore;

#[derive(Debug, PartialEq)]
struct GraphCommit {
    owner_user_id: String,
    friend_id: String,
    mutual_ids: Option<Vec<String>>,
    total_count: Option<usize>,
    opted_out: bool,
}

#[derive(Debug, PartialEq)]
struct HistoricalCommit {
    owner_user_id: String,
    friend_id: String,
    mutual_ids: Vec<String>,
    observed_at: String,
}

#[derive(Default)]
struct RecordingStore {
    commits: Mutex<Vec<GraphCommit>>,
    archives: Mutex<Vec<HistoricalCommit>>,
}

impl MutualGraphStore for RecordingStore {
    fn archive_observation(
        &self,
        owner_user_id: String,
        friend_id: String,
        mutual_ids: Vec<String>,
        observed_at: String,
    ) -> Result<()> {
        self.archives.lock().unwrap().push(HistoricalCommit {
            owner_user_id,
            friend_id,
            mutual_ids,
            observed_at,
        });
        Ok(())
    }

    fn friend_refresh_commit(
        &self,
        owner_user_id: String,
        friend_id: String,
        mutual_ids: Option<Vec<String>>,
        total_count: Option<usize>,
        opted_out: bool,
        _observed_at: Option<String>,
    ) -> Result<()> {
        self.commits.lock().unwrap().push(GraphCommit {
            owner_user_id,
            friend_id,
            mutual_ids,
            total_count,
            opted_out,
        });
        Ok(())
    }

    fn snapshot_get(&self, _owner_user_id: String) -> Result<MutualGraphSnapshotOutput> {
        panic!("list requests must not read the graph snapshot")
    }

    fn snapshot_commit(
        &self,
        _owner_user_id: String,
        _entries: Vec<MutualGraphSnapshotEntryInput>,
        _meta: Vec<MutualGraphMetaInput>,
        _observations: Vec<crate::social::MutualGraphObservationInput>,
        _replace_missing: bool,
        _scope_ids: Vec<String>,
    ) -> Result<()> {
        panic!("list requests must not replace the graph snapshot")
    }
}

struct ResponsePort<F> {
    status: i32,
    rows: Value,
    before_response: F,
    sent: Mutex<Vec<VrchatRequest>>,
}

impl<F: Fn() + Send + Sync> VrchatRequestPort for ResponsePort<F> {
    fn send(&self, input: VrchatRequest, _scope: VrchatScope) -> VrchatRequestFuture<'_> {
        self.sent.lock().unwrap().push(input);
        Box::pin(async {
            (self.before_response)();
            Ok(VrchatResponse {
                status: self.status,
                data: self.rows.to_string(),
                retry_after: None,
            })
        })
    }
}

#[tokio::test]
async fn non_friend_and_pending_request_lists_only_backfill_after_friend_add() -> Result<()> {
    let (_dir, runtime, session) = runtime_with_active_session("mutual-list-pending")?;
    runtime.sync_friend_baseline(&session, HashMap::new())?;
    let store = RecordingStore::default();
    let remote = ResponsePort {
        status: 200,
        rows: json!([{ "id": "usr_mutual", "displayName": "Mutual" }]),
        before_response: || {},
        sent: Mutex::default(),
    };
    let deps = MutualGraphRequestDeps::new(&store, &remote, runtime.auth_scope());

    for pending in [false, true] {
        runtime.runtime().record_user_profile(
            &session.endpoint,
            &json!({
                "id": "usr_target",
                "displayName": "Target",
                "isFriend": false,
                "outgoingRequest": pending
            }),
        );
        let result = get_user_mutual_friends_list(
            deps,
            runtime.runtime(),
            UserMutualFriendsListInput {
                user_id: "usr_target".into(),
            },
        )
        .await?;
        assert_eq!(result.rows, vec![RawJson::from(remote.rows[0].clone())]);
        let sent = remote.sent.lock().unwrap().pop().unwrap();
        assert_eq!(sent.method.as_deref(), Some("GET"));
        assert_eq!(
            sent.path.as_deref(),
            Some("users/usr%5Ftarget/mutuals/friends")
        );
        assert_eq!(sent.endpoint.as_deref(), Some(session.endpoint.as_str()));
        assert!(result.persisted);
        assert!(store.commits.lock().unwrap().is_empty());
    }
    let archives = store.archives.lock().unwrap();
    assert_eq!(archives.len(), 2);
    for archive in archives.iter() {
        assert_eq!(archive.owner_user_id, session.user_id);
        assert_eq!(archive.friend_id, "usr_target");
        assert_eq!(archive.mutual_ids, vec!["usr_mutual"]);
        assert!(chrono::DateTime::parse_from_rfc3339(&archive.observed_at).is_ok());
    }
    drop(archives);

    runtime.handle_active_friend_ws_message_for_test(&RealtimeWsMessagePayload {
        json: json!({
            "type": "friend-add",
            "content": {
                "userId": "usr_target",
                "user": { "id": "usr_target", "displayName": "Target" }
            }
        }),
        raw: "{}".into(),
        received_at: "2026-08-30T00:00:00Z".into(),
    });
    let result = get_user_mutual_friends_list(
        deps,
        runtime.runtime(),
        UserMutualFriendsListInput {
            user_id: "usr_target".into(),
        },
    )
    .await?;
    assert!(result.persisted);
    assert_eq!(
        *store.commits.lock().unwrap(),
        vec![GraphCommit {
            owner_user_id: session.user_id,
            friend_id: "usr_target".into(),
            mutual_ids: Some(vec!["usr_mutual".into()]),
            total_count: Some(1),
            opted_out: false,
        }]
    );
    assert_eq!(store.archives.lock().unwrap().len(), 2);
    Ok(())
}

#[tokio::test]
async fn empty_non_friend_list_archives_success_without_creating_a_current_node() -> Result<()> {
    let (_dir, runtime, session) = runtime_with_active_session("mutual-list-empty")?;
    runtime.sync_friend_baseline(&session, HashMap::new())?;
    let store = RecordingStore::default();
    let remote = ResponsePort {
        status: 200,
        rows: json!([]),
        before_response: || {},
        sent: Mutex::default(),
    };
    let result = get_user_mutual_friends_list(
        MutualGraphRequestDeps::new(&store, &remote, runtime.auth_scope()),
        runtime.runtime(),
        UserMutualFriendsListInput {
            user_id: "usr_target".into(),
        },
    )
    .await?;
    assert!(result.rows.is_empty());
    assert!(result.persisted);
    assert!(store.commits.lock().unwrap().is_empty());
    let archives = store.archives.lock().unwrap();
    assert_eq!(archives.len(), 1);
    assert_eq!(archives[0].owner_user_id, session.user_id);
    assert_eq!(archives[0].friend_id, "usr_target");
    assert!(archives[0].mutual_ids.is_empty());
    Ok(())
}

#[tokio::test]
async fn non_array_response_is_not_committed_as_an_empty_success() -> Result<()> {
    let (_dir, runtime, session) = runtime_with_active_session("mutual-invalid-shape")?;
    runtime
        .runtime()
        .sync_friend_snapshot(session, Some(7), HashMap::new())?;
    let store = RecordingStore::default();
    let remote = ResponsePort {
        status: 200,
        rows: json!({ "unexpected": "object" }),
        before_response: || {},
    };
    let result = get_user_mutual_friends_list(
        MutualGraphRequestDeps::new(&store, &MutualRequests, &remote, runtime.auth_scope()),
        runtime.runtime(),
        UserMutualFriendsListInput {
            user_id: "usr_target".into(),
        },
    )
    .await;
    assert!(result.is_err());
    assert!(store.commits.lock().unwrap().is_empty());
    assert!(store.archives.lock().unwrap().is_empty());
    Ok(())
}

#[tokio::test]
async fn exactly_fifty_full_pages_do_not_confirm_a_complete_snapshot() -> Result<()> {
    let (_dir, runtime, session) = runtime_with_active_session("mutual-page-cap")?;
    runtime
        .runtime()
        .sync_friend_snapshot(session.clone(), Some(7), HashMap::new())?;
    let store = RecordingStore::default();
    let remote = ResponsePort {
        status: 200,
        rows: Value::Array(
            (0..100)
                .map(|n| json!({ "id": format!("usr_{n}") }))
                .collect(),
        ),
        before_response: || {},
    };
    let result = get_user_mutual_friends_list(
        MutualGraphRequestDeps::new(&store, &MutualRequests, &remote, runtime.auth_scope()),
        runtime.runtime(),
        UserMutualFriendsListInput {
            user_id: "usr_target".into(),
        },
    )
    .await;
    assert!(result.is_err());
    assert!(store.commits.lock().unwrap().is_empty());
    assert!(store.archives.lock().unwrap().is_empty());
    Ok(())
}

#[tokio::test]
async fn bulk_friend_fetch_rejects_the_same_pagination_limit() -> Result<()> {
    let (_dir, runtime, session) = runtime_with_active_session("mutual-bulk-page-cap")?;
    let expected_scope = runtime.auth_scope().snapshot();
    let cancelled = AtomicBool::new(false);
    let remote = ResponsePort {
        status: 200,
        rows: Value::Array(
            (0..100)
                .map(|n| json!({ "id": format!("usr_{n}") }))
                .collect(),
        ),
        before_response: || {},
    };
    let mut context = MutualGraphFetchContext {
        remote: &remote,
        remote_requests: &MutualRequests,
        endpoint: &session.endpoint,
        cancel_flag: &cancelled,
        auth_scope: runtime.auth_scope(),
        expected_scope: &expected_scope,
        last_request_at: None,
    };
    assert!(matches!(
        fetch_friend_mutuals(&mut context, "usr_target").await,
        FriendFetchResult::Failed(_)
    ));
    Ok(())
}

#[tokio::test]
async fn unavailable_lists_only_update_opt_out_metadata_for_current_friends() -> Result<()> {
    for status in [403, 404] {
        for is_friend in [false, true] {
            let (_dir, runtime, session) = runtime_with_active_session("mutual-list-opt-out")?;
            runtime.sync_friend_baseline(&session, HashMap::new())?;
            if is_friend {
                assert_eq!(
                    runtime.runtime().apply_synthetic_trusted_friend_add(
                        &OwnerId::new(&session.user_id),
                        &session.endpoint,
                        "usr_target",
                        json!({ "id": "usr_target", "displayName": "Target" }),
                        "2026-08-30T00:00:00Z".into(),
                    ),
                    SyntheticFriendEventOutcome::Applied
                );
            }
            let store = RecordingStore::default();
            let remote = ResponsePort {
                status,
                rows: json!({}),
                before_response: || {},
                sent: Mutex::default(),
            };
            let result = get_user_mutual_friends_list(
                MutualGraphRequestDeps::new(&store, &remote, runtime.auth_scope()),
                runtime.runtime(),
                UserMutualFriendsListInput {
                    user_id: "usr_target".into(),
                },
            )
            .await;
            assert!(result.is_err());
            let commits = store.commits.lock().unwrap();
            if is_friend {
                assert_eq!(
                    *commits,
                    vec![GraphCommit {
                        owner_user_id: session.user_id,
                        friend_id: "usr_target".into(),
                        mutual_ids: None,
                        total_count: None,
                        opted_out: true,
                    }]
                );
            } else {
                assert!(commits.is_empty());
            }
            assert!(store.archives.lock().unwrap().is_empty());
        }
    }
    Ok(())
}

#[tokio::test]
async fn friend_removed_during_list_request_is_not_backfilled() -> Result<()> {
    let (_dir, runtime, session) = runtime_with_active_session("mutual-list-unfriend")?;
    runtime.sync_friend_baseline(&session, HashMap::new())?;
    assert_eq!(
        runtime.runtime().apply_synthetic_trusted_friend_add(
            &OwnerId::new(&session.user_id),
            &session.endpoint,
            "usr_target",
            json!({ "id": "usr_target", "displayName": "Target" }),
            "2026-08-30T00:00:00Z".into(),
        ),
        SyntheticFriendEventOutcome::Applied
    );
    let store = RecordingStore::default();
    let remote = ResponsePort {
        status: 200,
        rows: json!([{ "id": "usr_mutual" }]),
        before_response: || {
            assert_eq!(
                runtime.runtime().apply_synthetic_friend_delete(
                    &OwnerId::new(&session.user_id),
                    &session.endpoint,
                    "usr_target",
                    "2026-08-30T00:00:01Z".into(),
                ),
                SyntheticFriendEventOutcome::Applied
            );
        },
        sent: Mutex::default(),
    };
    let result = get_user_mutual_friends_list(
        MutualGraphRequestDeps::new(&store, &remote, runtime.auth_scope()),
        runtime.runtime(),
        UserMutualFriendsListInput {
            user_id: "usr_target".into(),
        },
    )
    .await?;
    assert_eq!(result.rows.len(), 1);
    assert!(result.persisted);
    assert!(store.commits.lock().unwrap().is_empty());
    let archives = store.archives.lock().unwrap();
    assert_eq!(archives.len(), 1);
    assert_eq!(archives[0].owner_user_id, session.user_id);
    assert_eq!(archives[0].friend_id, "usr_target");
    assert_eq!(archives[0].mutual_ids, vec!["usr_mutual"]);
    Ok(())
}

use std::collections::HashMap;
use std::future::Future;
use std::sync::{Arc, Mutex};

use vrcx_0_application_core::vrchat_api::VrchatApiResponse;
use vrcx_0_application_core::{RuntimeAuthScope, RuntimeAuthScopeSnapshot};
use vrcx_0_application_realtime::RealtimeHostRuntime;
use vrcx_0_core::OwnerId;
use vrcx_0_persistence::DatabaseService;

#[derive(Clone)]
pub struct ProfileBioObserver {
    db: Arc<DatabaseService>,
    realtime: Arc<RealtimeHostRuntime>,
    auth_scope: RuntimeAuthScope,
    requests: ProfileRequestBroker,
}

impl ProfileBioObserver {
    pub fn new(
        db: Arc<DatabaseService>,
        realtime: Arc<RealtimeHostRuntime>,
        auth_scope: RuntimeAuthScope,
    ) -> Self {
        Self {
            db,
            realtime,
            auth_scope,
            requests: ProfileRequestBroker::default(),
        }
    }

    pub fn scope(&self) -> RuntimeAuthScopeSnapshot {
        self.auth_scope.snapshot()
    }

    pub async fn request<F>(
        &self,
        scope: &RuntimeAuthScopeSnapshot,
        kind: &str,
        user_id: &str,
        fetch: F,
    ) -> vrcx_0_application_core::Result<VrchatApiResponse>
    where
        F: Future<Output = vrcx_0_application_core::Result<VrchatApiResponse>> + Send + 'static,
    {
        self.requests.request(scope, kind, user_id, fetch).await
    }

    pub fn observe(
        &self,
        response: &VrchatApiResponse,
        expected: &RuntimeAuthScopeSnapshot,
        bio: bool,
    ) -> Option<vrcx_0_persistence::realtime::ProfileFeedReconcileOutput> {
        if !(200..300).contains(&response.status) || !self.scope().generation_matches(expected) {
            return None;
        }
        let Ok(json) = serde_json::from_str::<serde_json::Value>(&response.data) else {
            return None;
        };
        let Some(user_id) = json
            .get("id")
            .and_then(serde_json::Value::as_str)
            .filter(|id| id.starts_with("usr_") && *id != expected.current_user_id)
        else {
            return None;
        };
        let owner = OwnerId::new(&expected.current_user_id);
        let status = if !bio {
            json.get("status").and_then(serde_json::Value::as_str)
        } else {
            None
        };
        let description = if !bio {
            json.get("statusDescription")
                .and_then(serde_json::Value::as_str)
        } else {
            None
        };
        let input = vrcx_0_persistence::realtime::ProfileFeedReconcileInput {
            expected_owner_user_id: expected.current_user_id.clone(),
            user_id: user_id.into(),
            display_name: json
                .get("displayName")
                .and_then(serde_json::Value::as_str)
                .unwrap_or(user_id)
                .into(),
            bio: if bio {
                json.get("bio")
                    .and_then(serde_json::Value::as_str)
                    .map(str::to_string)
            } else {
                None
            },
            status: status.unwrap_or_default().into(),
            status_description: description.unwrap_or_default().into(),
        };
        match vrcx_0_persistence::realtime::profile_feed_reconcile_with_description_policy(
            &self.db,
            &owner,
            input,
            description.is_none(),
        ) {
            Ok((output, entries)) if self.scope().generation_matches(expected) => {
                self.realtime
                    .emit_persisted_profile_entries(&owner, entries);
                Some(output)
            }
            Ok(_) => None,
            Err(error) => {
                tracing::warn!(error = %error, "failed to observe a profile bio");
                None
            }
        }
    }
}

type SharedRequestResult =
    std::result::Result<VrchatApiResponse, Arc<vrcx_0_application_core::Error>>;
type SharedRequestSender = tokio::sync::watch::Sender<Option<SharedRequestResult>>;
#[derive(Clone, Default)]
struct ProfileRequestBroker {
    pending: Arc<Mutex<HashMap<String, SharedRequestSender>>>,
}
impl ProfileRequestBroker {
    /// Shared by native dialog and batch commands; only pending requests live
    /// here. No five-minute completed-result reuse is added.
    pub async fn request<F>(
        &self,
        scope: &RuntimeAuthScopeSnapshot,
        kind: &str,
        user_id: &str,
        fetch: F,
    ) -> vrcx_0_application_core::Result<VrchatApiResponse>
    where
        F: Future<Output = vrcx_0_application_core::Result<VrchatApiResponse>> + Send + 'static,
    {
        let key = format!(
            "{}:{}:{}:{kind}:{user_id}",
            scope.generation, scope.current_user_id, scope.endpoint
        );
        let (mut receiver, sender) = {
            let mut requests = self
                .pending
                .lock()
                .unwrap_or_else(|error| error.into_inner());
            if let Some(sender) = requests.get(&key) {
                (sender.subscribe(), None)
            } else {
                let (sender, receiver) = tokio::sync::watch::channel(None);
                requests.insert(key.clone(), sender.clone());
                (receiver, Some(sender))
            }
        };
        if let Some(sender) = sender {
            let requests = Arc::clone(&self.pending);
            tokio::spawn(async move {
                let result = fetch.await.map_err(Arc::new);
                requests
                    .lock()
                    .unwrap_or_else(|error| error.into_inner())
                    .remove(&key);
                sender.send_replace(Some(result));
            });
        }
        loop {
            let result = receiver.borrow_and_update().clone();
            if let Some(result) = result {
                return result.map_err(copy_request_error);
            }
            if receiver.changed().await.is_err() {
                return Err(vrcx_0_application_core::Error::Custom(
                    "Profile request broker stopped.".into(),
                ));
            }
        }
    }
}

fn copy_request_error(
    error: Arc<vrcx_0_application_core::Error>,
) -> vrcx_0_application_core::Error {
    use vrcx_0_application_core::Error;
    match Arc::try_unwrap(error) {
        Ok(error) => error,
        Err(error) => match error.as_ref() {
            Error::Database(message) => Error::Database(message.clone()),
            Error::Sqlite { message, category } => Error::Sqlite {
                message: message.clone(),
                category: *category,
            },
            Error::Io(error) => Error::Io(
                error
                    .raw_os_error()
                    .map(std::io::Error::from_raw_os_error)
                    .unwrap_or_else(|| std::io::Error::new(error.kind(), error.to_string())),
            ),
            Error::Json(error) => Error::Json(serde_json::Error::io(std::io::Error::other(
                error.to_string(),
            ))),
            Error::UpdateArtifactInvalid(message) => Error::UpdateArtifactInvalid(message.clone()),
            Error::PersistenceInvalidData(message) => {
                Error::PersistenceInvalidData(message.clone())
            }
            Error::RegistryPolicyInvalid(message) => Error::RegistryPolicyInvalid(message.clone()),
            Error::WebClient(message) => Error::WebClient(message.clone()),
            Error::VrchatApi {
                status_code,
                message,
            } => Error::VrchatApi {
                status_code: *status_code,
                message: message.clone(),
            },
            Error::Custom(message) => Error::Custom(message.clone()),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    fn scope(generation: u64) -> RuntimeAuthScopeSnapshot {
        RuntimeAuthScopeSnapshot {
            current_user_id: "usr_owner".into(),
            endpoint: "endpoint".into(),
            generation,
            active: true,
        }
    }
    async fn wait_for_subscribers(broker: &ProfileRequestBroker, count: usize) {
        while broker
            .pending
            .lock()
            .unwrap()
            .values()
            .map(|sender| sender.receiver_count())
            .max()
            .unwrap_or(0)
            < count
        {
            tokio::task::yield_now().await;
        }
    }

    #[tokio::test]
    async fn broker_keeps_typed_api_errors_and_http_retry_after() {
        let broker = ProfileRequestBroker::default();
        let error = broker
            .request(&scope(1), "user", "usr_error", async {
                Err(vrcx_0_application_core::Error::VrchatApi {
                    status_code: 401,
                    message: "Expired credentials".into(),
                })
            })
            .await
            .unwrap_err();
        assert!(matches!(
            error,
            vrcx_0_application_core::Error::VrchatApi {
                status_code: 401,
                ..
            }
        ));
        let response = broker
            .request(&scope(1), "profile", "usr_error", async {
                Ok(VrchatApiResponse {
                    status: 429,
                    data: "limited".into(),
                    retry_after: Some("17".into()),
                })
            })
            .await
            .unwrap();
        assert_eq!(response.status, 429);
        assert_eq!(response.retry_after.as_deref(), Some("17"));
        assert!(broker.pending.lock().unwrap().is_empty());
    }

    #[tokio::test]
    async fn cancelling_leader_does_not_cancel_joined_request_or_leave_pending_cache() {
        let broker = ProfileRequestBroker::default();
        let first = broker.clone();
        let (release, hold) = tokio::sync::oneshot::channel();
        let leader = tokio::spawn(async move {
            first
                .request(&scope(1), "profile", "usr_target", async {
                    hold.await.unwrap();
                    Ok(VrchatApiResponse {
                        status: 200,
                        data: "done".into(),
                        retry_after: None,
                    })
                })
                .await
        });
        wait_for_subscribers(&broker, 1).await;
        let second = broker.clone();
        let follower = tokio::spawn(async move {
            second
                .request(&scope(1), "profile", "usr_target", async {
                    Err(vrcx_0_application_core::Error::Custom(
                        "must not execute duplicate".into(),
                    ))
                })
                .await
        });
        wait_for_subscribers(&broker, 2).await;
        leader.abort();
        release.send(()).unwrap();
        assert_eq!(follower.await.unwrap().unwrap().data, "done");
        assert!(broker.pending.lock().unwrap().is_empty());
    }
    #[tokio::test]
    async fn broker_merges_inflight_only_and_isolates_account_generation() {
        let broker = ProfileRequestBroker::default();
        let counter = Arc::new(AtomicUsize::new(0));
        let (release, hold) = tokio::sync::oneshot::channel();
        let first = broker.clone();
        let first_counter = Arc::clone(&counter);
        let first_task = tokio::spawn(async move {
            first
                .request(&scope(1), "profile", "usr_target", async move {
                    first_counter.fetch_add(1, Ordering::SeqCst);
                    hold.await.unwrap();
                    Ok(VrchatApiResponse {
                        status: 200,
                        data: "{}".into(),
                        retry_after: None,
                    })
                })
                .await
                .unwrap()
        });
        while counter.load(Ordering::SeqCst) == 0 {
            tokio::task::yield_now().await;
        }
        let second = broker.clone();
        let second_task = tokio::spawn(async move {
            second
                .request(&scope(1), "profile", "usr_target", async move {
                    panic!("An in-flight duplicate must not execute its own request");
                    #[allow(unreachable_code)]
                    Ok(VrchatApiResponse {
                        status: 200,
                        data: "{}".into(),
                        retry_after: None,
                    })
                })
                .await
                .unwrap()
        });
        wait_for_subscribers(&broker, 2).await;
        let isolated_counter = Arc::clone(&counter);
        broker
            .request(&scope(2), "profile", "usr_target", async move {
                isolated_counter.fetch_add(1, Ordering::SeqCst);
                Ok(VrchatApiResponse {
                    status: 200,
                    data: "{}".into(),
                    retry_after: None,
                })
            })
            .await
            .unwrap();
        let mut other_account = scope(1);
        other_account.current_user_id = "usr_other".into();
        let other_counter = Arc::clone(&counter);
        broker
            .request(&other_account, "profile", "usr_target", async move {
                other_counter.fetch_add(1, Ordering::SeqCst);
                Ok(VrchatApiResponse {
                    status: 200,
                    data: "other".into(),
                    retry_after: None,
                })
            })
            .await
            .unwrap();
        release.send(()).unwrap();
        first_task.await.unwrap();
        second_task.await.unwrap();
        let next_counter = Arc::clone(&counter);
        broker
            .request(&scope(1), "profile", "usr_target", async move {
                next_counter.fetch_add(1, Ordering::SeqCst);
                Ok(VrchatApiResponse {
                    status: 200,
                    data: "{}".into(),
                    retry_after: None,
                })
            })
            .await
            .unwrap();
        assert_eq!(counter.load(Ordering::SeqCst), 4);
    }
}

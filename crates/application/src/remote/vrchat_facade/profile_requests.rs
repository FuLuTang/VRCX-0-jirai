use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use vrcx_0_application_core::{Result, RuntimeAuthScopeSnapshot};
use vrcx_0_contracts::vrchat_api::VrchatResponse;

type SharedProfileRequestResult =
    std::result::Result<VrchatResponse, Arc<vrcx_0_application_core::Error>>;
type SharedProfileRequestSender =
    tokio::sync::watch::Sender<Option<SharedProfileRequestResult>>;

/// Coalesces concurrent profile requests that target the same account scope and
/// user, so one network round trip feeds every joined caller and each of them
/// receives the same committed-change receipt. Only pending requests live here;
/// there is no completed-result reuse.
#[derive(Clone, Default)]
pub(super) struct ProfileRequestBroker {
    pending: Arc<Mutex<HashMap<String, SharedProfileRequestSender>>>,
}

impl ProfileRequestBroker {
    pub(super) async fn request<F>(
        &self,
        scope: &RuntimeAuthScopeSnapshot,
        kind: &str,
        user_id: &str,
        fetch: F,
    ) -> Result<VrchatResponse>
    where
        F: std::future::Future<Output = Result<VrchatResponse>> + Send + 'static,
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
                return result.map_err(copy_profile_request_error);
            }
            if receiver.changed().await.is_err() {
                return Err(vrcx_0_application_core::Error::Custom(
                    "Profile request broker stopped.".into(),
                ));
            }
        }
    }
}

fn copy_profile_request_error(
    error: Arc<vrcx_0_application_core::Error>,
) -> vrcx_0_application_core::Error {
    match Arc::try_unwrap(error) {
        Ok(error) => error,
        Err(error) => error.duplicate(),
    }
}

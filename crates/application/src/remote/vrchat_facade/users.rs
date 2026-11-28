use serde_json::Value;
use vrcx_0_application_core::{Result, RuntimeAuthScopeSnapshot};
use vrcx_0_contracts::vrchat_api::{VrchatResponse, VrchatScope};
use vrcx_0_core::time::now_iso;
use vrcx_0_core::vrchat_endpoints::VRCHAT_API_DEFAULT_ENDPOINT;
use vrcx_0_core::OwnerId;
use vrcx_0_vrchat_protocol::friends::friend_status_get_input;
use vrcx_0_vrchat_protocol::users::{
    account_standing_get_input, profile_get_input, user_represented_group_get_input,
};

use crate::social::{observe_profile_response, ProfileBioOutcome};

use super::VrchatRemoteFacade;

impl VrchatRemoteFacade {
    pub async fn user_profile(&self, user_id: String, as_self: bool) -> Result<VrchatResponse> {
        let expected = self.auth_scope.snapshot();
        let (user_id, request) =
            profile_get_input(VRCHAT_API_DEFAULT_ENDPOINT.into(), user_id, as_self)?;
        let facade = self.clone();
        let request_id = user_id.clone();
        let kind = if as_self { "self-profile" } else { "profile" };
        // The broker borrows the scope for keying; the task owns its own copy so
        // it can stamp the Bio receipt without moving the borrowed value.
        let request_scope = expected.clone();
        self.profile_requests
            .request(&request_scope, kind, &request_id, async move {
                let mut response = facade
                    .execute(
                        "app__vrchat_user_profile_get",
                        format!("Getting profile for user {user_id}."),
                        request,
                        VrchatScope::Vrchat,
                    )
                    .await?;
                facade.annotate_bio_receipt(&mut response, &expected);
                Ok(response)
            })
            .await
    }

    /// Observe a dialog (`users/{id}`) payload. Upstream records the public Bio
    /// only from `/profile`; a `users/{id}` bio can be stale, so the only native
    /// observation kept here is the owner's own Bio history. The dialog user's
    /// status/description reconciliation is issued by the renderer through
    /// `app__profile_feed_reconcile`, and the `$jiraiStatusUpdated` receipt comes
    /// from the realtime user-query path that produced this response.
    pub fn observe_dialog_user(
        &self,
        response: &mut VrchatResponse,
        scope: &RuntimeAuthScopeSnapshot,
    ) {
        if !(200..300).contains(&response.status)
            || !self.auth_scope.snapshot().generation_matches(scope)
        {
            return;
        }
        let Ok(json) = serde_json::from_str::<Value>(&response.data) else {
            return;
        };
        if json.get("id").and_then(Value::as_str) != Some(scope.current_user_id.as_str()) {
            return;
        }
        let owner = OwnerId::new(scope.current_user_id.clone());
        if let Err(error) = observe_profile_response(
            self.profile_bio.as_ref(),
            &self.realtime,
            &owner,
            response,
            &now_iso(),
        ) {
            tracing::warn!(error = %error, "failed to observe a dialog profile");
        }
    }

    pub async fn share_user_request<F>(
        &self,
        scope: &RuntimeAuthScopeSnapshot,
        user_id: &str,
        fetch: F,
    ) -> Result<VrchatResponse>
    where
        F: std::future::Future<Output = Result<VrchatResponse>> + Send + 'static,
    {
        self.profile_requests
            .request(scope, "user", user_id, fetch)
            .await
    }

    pub async fn account_standing(&self) -> Result<VrchatResponse> {
        self.execute(
            "app__vrchat_current_user_account_standing_get",
            "Getting current user account standing.",
            account_standing_get_input(VRCHAT_API_DEFAULT_ENDPOINT.into()),
            VrchatScope::Vrchat,
        )
        .await
    }

    pub async fn user_represented_group(&self, user_id: String) -> Result<VrchatResponse> {
        let (user_id, request) =
            user_represented_group_get_input(VRCHAT_API_DEFAULT_ENDPOINT.into(), user_id)?;
        self.execute(
            "app__vrchat_user_represented_group_get",
            format!("Getting represented group for user {user_id}."),
            request,
            VrchatScope::Vrchat,
        )
        .await
    }

    pub async fn friend_status(&self, user_id: String) -> Result<VrchatResponse> {
        let (user_id, request) =
            friend_status_get_input(VRCHAT_API_DEFAULT_ENDPOINT.into(), user_id)?;
        self.execute(
            "app__vrchat_friend_status_get",
            format!("Getting friend status for {user_id}."),
            request,
            VrchatScope::Vrchat,
        )
        .await
    }

    /// Observe the public Bio of a `/profile` response and annotate the receipt
    /// the renderer reads as `$jiraiBioUpdated`.
    fn annotate_bio_receipt(
        &self,
        response: &mut VrchatResponse,
        expected: &RuntimeAuthScopeSnapshot,
    ) {
        if !(200..300).contains(&response.status)
            || !self.auth_scope.snapshot().generation_matches(expected)
        {
            return;
        }
        let owner = OwnerId::new(expected.current_user_id.clone());
        let outcome = match observe_profile_response(
            self.profile_bio.as_ref(),
            &self.realtime,
            &owner,
            response,
            &now_iso(),
        ) {
            Ok(outcome) => outcome,
            Err(error) => {
                tracing::warn!(error = %error, "failed to observe a profile bio");
                return;
            }
        };
        let Ok(mut json) = serde_json::from_str::<Value>(&response.data) else {
            return;
        };
        let Some(object) = json.as_object_mut() else {
            return;
        };
        object.insert(
            "$jiraiBioUpdated".into(),
            Value::Bool(matches!(outcome, Some(ProfileBioOutcome::Changed))),
        );
        if let Ok(data) = serde_json::to_string(&json) {
            response.data = data;
        }
    }
}

use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use vrcx_0_application_core::{
    RuntimeAuthScope, RuntimeAuthScopeSnapshot, RuntimeDiagnostics, RuntimeOperationStatus,
    RuntimeSyncEngine, WorldCache,
};
use vrcx_0_application_realtime::RealtimeFriendSnapshot;
use vrcx_0_contracts::vrchat_api::{VrchatRequest, VrchatScope};
use vrcx_0_contracts::{VrchatJsonResponse, WorldSummaryOutput};
use vrcx_0_core::friends::FriendRecord;
use vrcx_0_core::json::RawJson;

use crate::avatars::{get_my_avatars, AvatarRemote, MyAvatarsDeps, MyAvatarsInput, MyAvatarsStore};
use crate::remote::VrchatRequestPort;
use crate::scope_gate::ScopeGate;
use vrcx_0_application_core::{Error, Result};
use vrcx_0_core::OwnerId;
use vrcx_0_vrchat_protocol::query::{QueryOrder, ReleaseStatusFilter, WorldSearchSort};

const GATE: ScopeGate = ScopeGate::new("Quick search");

const WORLD_PAGE_SIZE: i32 = 50;
const FAVORITE_PAGE_SIZE: i32 = 300;
const MAX_PAGES_PER_SOURCE: usize = 50;
const RESULT_LIMIT: usize = 8;
const DETAIL_QUERY_MIN_LENGTH: usize = 2;
const REMOTE_WORKING_SET_TTL: Duration = Duration::from_secs(60);
const PARTIAL_REMOTE_WORKING_SET_TTL: Duration = Duration::from_secs(2);

#[derive(Clone)]
pub struct QuickSearchRuntime {
    inner: Arc<QuickSearchRuntimeInner>,
}

struct QuickSearchRuntimeInner {
    detail_store: Arc<dyn QuickSearchDetailStore>,
    avatar_store: Arc<dyn MyAvatarsStore>,
    avatar_remote: Arc<dyn AvatarRemote>,
    remote: Arc<dyn VrchatRequestPort>,
    auth_scope: RuntimeAuthScope,
    diagnostics: RuntimeDiagnostics,
    sync: RuntimeSyncEngine,
    world_cache: Arc<WorldCache>,
    remote_working_set: Mutex<Option<CachedRemoteWorkingSet>>,
    remote_load_gate: tokio::sync::Mutex<()>,
    remote_revision: AtomicU64,
}

struct CachedRemoteWorkingSet {
    scope_generation: u64,
    current_user_id: String,
    endpoint: String,
    expires_at: Instant,
    catalog: Arc<QuickSearchRemoteCatalog>,
}

#[derive(Clone, Debug, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct QuickSearchQueryInput {
    pub query: String,
}

#[derive(Clone, Debug, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum QuickSearchQueryStatus {
    Ready,
    Partial,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum QuickSearchEntityType {
    Friend,
    Avatar,
    World,
    Group,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum QuickSearchMatchedField {
    Name,
    Memo,
    Note,
    Bio,
}

#[derive(Clone, Debug, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct QuickSearchResult {
    pub id: String,
    #[serde(rename = "type")]
    pub entity_type: QuickSearchEntityType,
    pub source: String,
    pub name: String,
    pub subtitle: String,
    pub image_url: String,
    pub seed_data: Option<RawJson>,
    pub memo: String,
    pub note: String,
    pub matched_field: QuickSearchMatchedField,
    pub user_colour: String,
    pub bio: String,
}

#[derive(Clone, Debug, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct QuickSearchQueryOutput {
    pub status: QuickSearchQueryStatus,
    pub detail: String,
    pub friends: Vec<QuickSearchResult>,
    pub own_avatars: Vec<QuickSearchResult>,
    pub favorite_avatars: Vec<QuickSearchResult>,
    pub own_worlds: Vec<QuickSearchResult>,
    pub favorite_worlds: Vec<QuickSearchResult>,
    pub own_groups: Vec<QuickSearchResult>,
    pub joined_groups: Vec<QuickSearchResult>,
}

impl QuickSearchQueryOutput {
    fn empty() -> Self {
        Self {
            status: QuickSearchQueryStatus::Ready,
            detail: String::new(),
            friends: Vec::new(),
            own_avatars: Vec::new(),
            favorite_avatars: Vec::new(),
            own_worlds: Vec::new(),
            favorite_worlds: Vec::new(),
            own_groups: Vec::new(),
            joined_groups: Vec::new(),
        }
    }
}

#[derive(Clone, Debug)]
struct QuickSearchCandidate {
    id: String,
    entity_type: QuickSearchEntityType,
    source: &'static str,
    name: String,
    normalized_name: String,
    subtitle: String,
    image_url: String,
    owner_id: String,
    seed_data: Value,
}

#[derive(Debug, Default)]
struct QuickSearchRemoteCatalog {
    own_avatars: Vec<QuickSearchCandidate>,
    favorite_avatars: Vec<QuickSearchCandidate>,
    own_worlds: Vec<QuickSearchCandidate>,
    favorite_worlds: Vec<QuickSearchCandidate>,
    groups: Vec<QuickSearchCandidate>,
    failures: usize,
}

#[derive(Clone, Copy)]
pub enum QuickSearchRemoteSource {
    OwnWorlds,
    FavoriteAvatars,
    FavoriteWorlds,
}

pub trait QuickSearchDetailStore: Send + Sync {
    fn user_memos(&self) -> Result<Vec<(String, String)>>;
    fn user_notes(&self, owner: OwnerId) -> Result<Vec<(String, String)>>;
    /// Latest recorded profile bio per user for the given account (`profile_bio`).
    fn user_bios(&self, owner: OwnerId) -> Result<Vec<(String, String)>>;
}

/// Per-user detail text used by friend matching (memo / note / bio), plus the
/// number of detail sources that failed to load.
#[derive(Debug, Default)]
struct FriendDetails {
    memos: HashMap<String, String>,
    notes: HashMap<String, String>,
    bios: HashMap<String, String>,
    failures: usize,
}

fn load_friend_details(
    store: &dyn QuickSearchDetailStore,
    current_user_id: &str,
    can_search_details: bool,
) -> FriendDetails {
    let mut details = FriendDetails::default();
    if !can_search_details {
        return details;
    }
    details.memos = match store.user_memos() {
        Ok(rows) => rows.into_iter().collect(),
        Err(error) => {
            details.failures += 1;
            tracing::debug!(error = %error, "quick search user memos failed");
            HashMap::new()
        }
    };
    details.notes = match store.user_notes(OwnerId::new(current_user_id.to_string())) {
        Ok(rows) => rows.into_iter().collect(),
        Err(error) => {
            details.failures += 1;
            tracing::debug!(error = %error, "quick search user notes failed");
            HashMap::new()
        }
    };
    details.bios = match store.user_bios(OwnerId::new(current_user_id.to_string())) {
        Ok(rows) => rows.into_iter().collect(),
        Err(error) => {
            details.failures += 1;
            tracing::debug!(error = %error, "quick search user bios failed");
            HashMap::new()
        }
    };
    details
}

pub struct QuickSearchSources {
    detail_store: Arc<dyn QuickSearchDetailStore>,
    avatar_store: Arc<dyn MyAvatarsStore>,
    avatar_remote: Arc<dyn AvatarRemote>,
    world_cache: Arc<WorldCache>,
}

impl QuickSearchSources {
    pub fn new(
        detail_store: Arc<dyn QuickSearchDetailStore>,
        avatar_store: Arc<dyn MyAvatarsStore>,
        avatar_remote: Arc<dyn AvatarRemote>,
        world_cache: Arc<WorldCache>,
    ) -> Self {
        Self {
            detail_store,
            avatar_store,
            avatar_remote,
            world_cache,
        }
    }
}

impl QuickSearchRuntime {
    pub fn new(
        sources: QuickSearchSources,
        remote: Arc<dyn VrchatRequestPort>,
        auth_scope: RuntimeAuthScope,
        diagnostics: RuntimeDiagnostics,
        sync: RuntimeSyncEngine,
    ) -> Self {
        Self {
            inner: Arc::new(QuickSearchRuntimeInner {
                detail_store: sources.detail_store,
                avatar_store: sources.avatar_store,
                avatar_remote: sources.avatar_remote,
                remote,
                auth_scope,
                diagnostics,
                sync,
                world_cache: sources.world_cache,
                remote_working_set: Mutex::new(None),
                remote_load_gate: tokio::sync::Mutex::new(()),
                remote_revision: AtomicU64::new(0),
            }),
        }
    }

    pub async fn query(
        &self,
        input: QuickSearchQueryInput,
        friend_snapshot: Option<RealtimeFriendSnapshot>,
    ) -> Result<QuickSearchQueryOutput> {
        let command = "app__quick_search_query";
        let scope = GATE.require_active(&self.inner.auth_scope)?;
        let query = normalize_search_text(&input.query);
        if query.is_empty() {
            return Ok(QuickSearchQueryOutput::empty());
        }
        if let Some((prefix, rest)) = split_query_prefix(&query) {
            return self
                .query_prefixed(command, &scope, prefix, rest, friend_snapshot)
                .await;
        }

        self.inner.diagnostics.record_command(
            command,
            RuntimeOperationStatus::Running,
            "Searching the quick search sources.",
        );

        let can_search_details = query.chars().count() >= DETAIL_QUERY_MIN_LENGTH;
        let details = load_friend_details(
            self.inner.detail_store.as_ref(),
            &scope.current_user_id,
            can_search_details,
        );
        let mut failures = details.failures;

        let friends = friend_snapshot
            .filter(|snapshot| friend_snapshot_matches_scope(snapshot, &scope))
            .map(|snapshot| {
                search_friends(
                    snapshot.friends_by_id.into_values(),
                    &details.memos,
                    &details.notes,
                    &details.bios,
                    &query,
                )
            })
            .unwrap_or_default();

        let mut output = QuickSearchQueryOutput {
            friends,
            ..QuickSearchQueryOutput::empty()
        };

        if can_search_details {
            let local_worlds = match self.inner.world_cache.search_summaries(&query, 16) {
                Ok(rows) => rows
                    .into_iter()
                    .take(RESULT_LIMIT)
                    .map(local_world_result)
                    .collect(),
                Err(error) => {
                    failures += 1;
                    tracing::debug!(error = %error, "quick search local worlds failed");
                    Vec::new()
                }
            };

            let remote = self.remote_catalog(&scope).await?;
            failures += remote.failures;
            output.own_avatars = search_candidates(&remote.own_avatars, &query, &HashSet::new());
            let own_avatar_ids = remote
                .own_avatars
                .iter()
                .map(|row| row.id.clone())
                .collect::<HashSet<_>>();
            output.favorite_avatars =
                search_candidates(&remote.favorite_avatars, &query, &own_avatar_ids);
            output.own_worlds = search_candidates(&remote.own_worlds, &query, &HashSet::new());
            let own_world_ids = remote
                .own_worlds
                .iter()
                .map(|row| row.id.clone())
                .collect::<HashSet<_>>();
            output.favorite_worlds =
                search_candidates(&remote.favorite_worlds, &query, &own_world_ids);
            merge_results(&mut output.favorite_worlds, local_worlds);

            let own_groups = remote
                .groups
                .iter()
                .filter(|row| row.owner_id == scope.current_user_id)
                .cloned()
                .collect::<Vec<_>>();
            let own_group_ids = own_groups
                .iter()
                .map(|row| row.id.clone())
                .collect::<HashSet<_>>();
            output.own_groups = search_candidates(&own_groups, &query, &HashSet::new());
            output.joined_groups = search_candidates(&remote.groups, &query, &own_group_ids);
        }

        GATE.ensure_matches(&self.inner.auth_scope, &scope)?;
        let partial = failures > 0;
        output.status = if partial {
            QuickSearchQueryStatus::Partial
        } else {
            QuickSearchQueryStatus::Ready
        };
        output.detail = if partial {
            format!("{failures} search source(s) failed to load.")
        } else {
            String::new()
        };
        self.inner.diagnostics.record_command(
            command,
            if partial {
                RuntimeOperationStatus::Partial
            } else {
                RuntimeOperationStatus::Ok
            },
            if partial {
                output.detail.clone()
            } else {
                "Quick search completed.".into()
            },
        );
        self.inner.sync.record(
            "quickSearch",
            if partial {
                RuntimeOperationStatus::Partial
            } else {
                RuntimeOperationStatus::Ready
            },
            if partial {
                output.detail.clone()
            } else {
                "Quick search completed.".into()
            },
            0,
        );
        Ok(output)
    }

    /// `!` friends only, `@` worlds only, `#` groups only (jirai quickSearchWorker
    /// shortcuts). Worlds and groups search from one character; a bare prefix lists
    /// everything in that category without the per-group limit.
    async fn query_prefixed(
        &self,
        command: &str,
        scope: &RuntimeAuthScopeSnapshot,
        prefix: QuickSearchPrefix,
        rest: &str,
        friend_snapshot: Option<RealtimeFriendSnapshot>,
    ) -> Result<QuickSearchQueryOutput> {
        self.inner.diagnostics.record_command(
            command,
            RuntimeOperationStatus::Running,
            "Searching the quick search sources.",
        );
        let mut failures = 0;
        let mut friends = Vec::new();
        let mut details = FriendDetails::default();
        let mut remote = None;
        let mut local_worlds = Vec::new();
        match prefix {
            QuickSearchPrefix::Friends => {
                details = load_friend_details(
                    self.inner.detail_store.as_ref(),
                    &scope.current_user_id,
                    rest.chars().count() >= DETAIL_QUERY_MIN_LENGTH,
                );
                failures += details.failures;
                friends = friend_snapshot
                    .filter(|snapshot| friend_snapshot_matches_scope(snapshot, scope))
                    .map(|snapshot| snapshot.friends_by_id.into_values().collect())
                    .unwrap_or_default();
            }
            QuickSearchPrefix::Worlds | QuickSearchPrefix::Groups => {
                let catalog = self.remote_catalog(scope).await?;
                failures += catalog.failures;
                remote = Some(catalog);
                if prefix == QuickSearchPrefix::Worlds && !rest.is_empty() {
                    match self.inner.world_cache.search_summaries(rest, 16) {
                        Ok(rows) => {
                            local_worlds = rows
                                .into_iter()
                                .take(RESULT_LIMIT)
                                .map(local_world_result)
                                .collect();
                        }
                        Err(error) => {
                            failures += 1;
                            tracing::debug!(error = %error, "quick search local worlds failed");
                        }
                    }
                }
            }
        }
        let output = build_prefixed_output(
            prefix,
            rest,
            PrefixedSources {
                friends,
                details: &details,
                remote: remote.as_deref(),
                local_worlds,
                current_user_id: &scope.current_user_id,
            },
        );
        self.finish_query(command, scope, output, failures)
    }

    fn finish_query(
        &self,
        command: &str,
        scope: &RuntimeAuthScopeSnapshot,
        mut output: QuickSearchQueryOutput,
        failures: usize,
    ) -> Result<QuickSearchQueryOutput> {
        GATE.ensure_matches(&self.inner.auth_scope, scope)?;
        let partial = failures > 0;
        output.status = if partial {
            QuickSearchQueryStatus::Partial
        } else {
            QuickSearchQueryStatus::Ready
        };
        output.detail = if partial {
            format!("{failures} search source(s) failed to load.")
        } else {
            String::new()
        };
        let status = if partial {
            RuntimeOperationStatus::Partial
        } else {
            RuntimeOperationStatus::Ok
        };
        let message = if partial {
            output.detail.clone()
        } else {
            "Quick search completed.".to_string()
        };
        self.inner
            .diagnostics
            .record_command(command, status, message.clone());
        self.inner.sync.record(
            "quickSearch",
            if partial {
                RuntimeOperationStatus::Partial
            } else {
                RuntimeOperationStatus::Ready
            },
            message,
            0,
        );
        Ok(output)
    }

    pub fn invalidate_remote_working_set(&self) {
        self.inner.remote_revision.fetch_add(1, Ordering::SeqCst);
        *self
            .inner
            .remote_working_set
            .lock()
            .unwrap_or_else(|error| error.into_inner()) = None;
    }

    async fn remote_catalog(
        &self,
        scope: &RuntimeAuthScopeSnapshot,
    ) -> Result<Arc<QuickSearchRemoteCatalog>> {
        if let Some(catalog) = self.cached_remote_catalog(scope) {
            return Ok(catalog);
        }

        let _guard = self.inner.remote_load_gate.lock().await;
        if let Some(catalog) = self.cached_remote_catalog(scope) {
            return Ok(catalog);
        }

        let load_revision = self.inner.remote_revision.load(Ordering::SeqCst);
        let catalog = Arc::new(load_quick_search_remote_catalog(&self.inner, scope).await);
        GATE.ensure_matches(&self.inner.auth_scope, scope)?;
        let ttl = if catalog.failures == 0 {
            REMOTE_WORKING_SET_TTL
        } else {
            PARTIAL_REMOTE_WORKING_SET_TTL
        };
        let cached = CachedRemoteWorkingSet {
            scope_generation: scope.generation,
            current_user_id: scope.current_user_id.clone(),
            endpoint: scope.endpoint.clone(),
            expires_at: Instant::now() + ttl,
            catalog: catalog.clone(),
        };
        if self.inner.remote_revision.load(Ordering::SeqCst) == load_revision {
            *self
                .inner
                .remote_working_set
                .lock()
                .unwrap_or_else(|error| error.into_inner()) = Some(cached);
        }
        Ok(catalog)
    }

    fn cached_remote_catalog(
        &self,
        scope: &RuntimeAuthScopeSnapshot,
    ) -> Option<Arc<QuickSearchRemoteCatalog>> {
        let cache = self
            .inner
            .remote_working_set
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        let cached = cache.as_ref()?;
        (cached.scope_generation == scope.generation
            && cached.current_user_id == scope.current_user_id
            && cached.endpoint == scope.endpoint
            && cached.expires_at > Instant::now())
        .then(|| cached.catalog.clone())
    }
}

async fn load_quick_search_remote_catalog(
    runtime: &QuickSearchRuntimeInner,
    scope: &RuntimeAuthScopeSnapshot,
) -> QuickSearchRemoteCatalog {
    let my_avatars_deps = MyAvatarsDeps {
        store: runtime.avatar_store.as_ref(),
        remote: runtime.avatar_remote.as_ref(),
        auth_scope: &runtime.auth_scope,
        expected_scope: scope.clone(),
    };
    let own_avatars = get_my_avatars(&my_avatars_deps, MyAvatarsInput::default());
    let own_worlds = collect_pages(
        runtime,
        scope,
        QuickSearchRemoteSource::OwnWorlds,
        WORLD_PAGE_SIZE,
    );
    let favorite_avatars = collect_pages(
        runtime,
        scope,
        QuickSearchRemoteSource::FavoriteAvatars,
        FAVORITE_PAGE_SIZE,
    );
    let favorite_worlds = collect_pages(
        runtime,
        scope,
        QuickSearchRemoteSource::FavoriteWorlds,
        FAVORITE_PAGE_SIZE,
    );
    let groups = fetch_user_groups(runtime, scope);
    let (own_avatars, own_worlds, favorite_avatars, favorite_worlds, groups) = tokio::join!(
        own_avatars,
        own_worlds,
        favorite_avatars,
        favorite_worlds,
        groups
    );

    let mut failures = 0;
    QuickSearchRemoteCatalog {
        own_avatars: project_rows(
            rows_or_empty(own_avatars, &mut failures),
            QuickSearchEntityType::Avatar,
            "own",
        ),
        favorite_avatars: project_rows(
            rows_or_empty(favorite_avatars, &mut failures),
            QuickSearchEntityType::Avatar,
            "favorite",
        ),
        own_worlds: project_rows(
            rows_or_empty(own_worlds, &mut failures),
            QuickSearchEntityType::World,
            "own",
        ),
        favorite_worlds: project_rows(
            rows_or_empty(favorite_worlds, &mut failures),
            QuickSearchEntityType::World,
            "favorite",
        ),
        groups: project_rows(
            rows_or_empty(groups, &mut failures),
            QuickSearchEntityType::Group,
            "joined",
        ),
        failures,
    }
}

async fn collect_pages(
    runtime: &QuickSearchRuntimeInner,
    scope: &RuntimeAuthScopeSnapshot,
    source: QuickSearchRemoteSource,
    page_size: i32,
) -> Result<Vec<Value>> {
    let mut rows = Vec::new();
    for page in 0..=MAX_PAGES_PER_SOURCE {
        GATE.ensure_matches(&runtime.auth_scope, scope)?;
        let offset = (page as i32) * page_size;
        let endpoint = scope.endpoint.clone();
        let request = match source {
            QuickSearchRemoteSource::OwnWorlds => {
                vrcx_0_vrchat_protocol::worlds::world_list_by_user_get_input(
                    endpoint,
                    scope.current_user_id.clone(),
                    page_size,
                    offset,
                    WorldSearchSort::Updated,
                    QueryOrder::Descending,
                    ReleaseStatusFilter::All,
                )?
                .1
            }
            QuickSearchRemoteSource::FavoriteAvatars => {
                vrcx_0_vrchat_protocol::favorites::favorite_avatars_get_input(
                    endpoint,
                    page_size,
                    offset,
                    String::new(),
                )
            }
            QuickSearchRemoteSource::FavoriteWorlds => {
                vrcx_0_vrchat_protocol::favorites::favorite_worlds_get_input(
                    endpoint,
                    page_size,
                    offset,
                    String::new(),
                    String::new(),
                    String::new(),
                )
            }
        };
        let page_rows = execute_rows(runtime, scope, request).await?;
        let count = page_rows.len();
        if page == MAX_PAGES_PER_SOURCE {
            if count == 0 {
                return Ok(rows);
            }
            return Err(Error::Custom(
                "Quick search source pagination exceeded the safety limit.".into(),
            ));
        }
        rows.extend(page_rows);
        if count < page_size as usize {
            return Ok(rows);
        }
    }
    Ok(rows)
}

async fn fetch_user_groups(
    runtime: &QuickSearchRuntimeInner,
    scope: &RuntimeAuthScopeSnapshot,
) -> Result<Vec<Value>> {
    let request = vrcx_0_vrchat_protocol::groups::user_groups_get_input(
        scope.endpoint.clone(),
        scope.current_user_id.clone(),
    )?
    .1;
    let mut rows = execute_rows(runtime, scope, request).await?;
    remap_group_membership_row_ids(&mut rows);
    Ok(rows)
}

fn remap_group_membership_row_ids(rows: &mut [Value]) {
    for row in rows {
        let Some(object) = row.as_object_mut() else {
            continue;
        };
        let Some(group_id) = object
            .get("groupId")
            .and_then(Value::as_str)
            .filter(|group_id| !group_id.is_empty())
            .map(str::to_owned)
        else {
            continue;
        };
        object.insert("id".into(), Value::String(group_id));
    }
}

async fn execute_rows(
    runtime: &QuickSearchRuntimeInner,
    scope: &RuntimeAuthScopeSnapshot,
    request: VrchatRequest,
) -> Result<Vec<Value>> {
    let response = runtime.remote.send(request, VrchatScope::Vrchat).await?;
    GATE.ensure_matches(&runtime.auth_scope, scope)?;
    let response = VrchatJsonResponse {
        status: response.status,
        json: serde_json::from_str::<Value>(&response.data)?,
    };
    if !(200..300).contains(&response.status) || response.has_error_field() {
        return Err(Error::Custom(format!(
            "Quick search source request failed: {}",
            response.error_message_or("VRChat API request failed")
        )));
    }
    Ok(response.json.as_array().cloned().unwrap_or_default())
}

fn search_friends(
    friends: impl IntoIterator<Item = FriendRecord>,
    memo_by_user_id: &HashMap<String, String>,
    note_by_user_id: &HashMap<String, String>,
    bio_by_user_id: &HashMap<String, String>,
    query: &str,
) -> Vec<QuickSearchResult> {
    search_friends_limited(
        friends,
        memo_by_user_id,
        note_by_user_id,
        bio_by_user_id,
        query,
        Some(RESULT_LIMIT),
    )
}

/// `limit: None` keeps every match (bare `!` lists all friends, as jirai does).
fn search_friends_limited(
    friends: impl IntoIterator<Item = FriendRecord>,
    memo_by_user_id: &HashMap<String, String>,
    note_by_user_id: &HashMap<String, String>,
    bio_by_user_id: &HashMap<String, String>,
    query: &str,
    limit: Option<usize>,
) -> Vec<QuickSearchResult> {
    let can_search_details = query.chars().count() >= DETAIL_QUERY_MIN_LENGTH;
    let mut matches = friends
        .into_iter()
        .filter_map(|friend| {
            let name = friend.display_name_or_id();
            let memo = memo_by_user_id
                .get(&friend.id)
                .map(String::as_str)
                .unwrap_or_default();
            let note = note_by_user_id
                .get(&friend.id)
                .map(String::as_str)
                .unwrap_or_default();
            let bio = bio_by_user_id
                .get(&friend.id)
                .map(String::as_str)
                .unwrap_or_default();
            let normalized_name = normalize_search_text(&name);
            let matched_field = if normalized_name.contains(query) {
                QuickSearchMatchedField::Name
            } else if can_search_details && normalize_search_text(memo).contains(query) {
                QuickSearchMatchedField::Memo
            } else if can_search_details && normalize_search_text(note).contains(query) {
                QuickSearchMatchedField::Note
            } else if can_search_details && normalize_search_text(bio).contains(query) {
                QuickSearchMatchedField::Bio
            } else {
                return None;
            };
            Some((
                !normalized_name.starts_with(query),
                normalized_name,
                friend,
                name,
                memo,
                note,
                bio,
                matched_field,
            ))
        })
        .collect::<Vec<_>>();
    matches.sort_by(|left, right| {
        (&left.0, &left.1, &left.2.id).cmp(&(&right.0, &right.1, &right.2.id))
    });
    matches
        .into_iter()
        .take(limit.unwrap_or(usize::MAX))
        .map(|(_, _, friend, name, memo, note, bio, matched_field)| {
            friend_result(friend, name, memo, note, bio, matched_field)
        })
        .collect()
}

fn friend_result(
    friend: FriendRecord,
    name: String,
    memo: &str,
    note: &str,
    bio: &str,
    matched_field: QuickSearchMatchedField,
) -> QuickSearchResult {
    let user_colour = friend
        .extra
        .get("$userColour")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    let subtitle = friend.status_description.to_string();
    let seed_data = serde_json::to_value(&friend).ok().map(RawJson::from);
    QuickSearchResult {
        id: friend.id,
        entity_type: QuickSearchEntityType::Friend,
        source: "friends".into(),
        name,
        subtitle,
        image_url: friend.icon_url,
        seed_data,
        memo: memo.trim().to_string(),
        note: note.trim().to_string(),
        matched_field,
        user_colour,
        bio: bio.trim().to_string(),
    }
}

fn local_world_result(row: WorldSummaryOutput) -> QuickSearchResult {
    let image_url = if row.thumbnail_image_url.trim().is_empty() {
        row.image_url.clone()
    } else {
        row.thumbnail_image_url.clone()
    };
    let subtitle = row.author_name.clone();
    QuickSearchResult {
        id: row.id.clone(),
        entity_type: QuickSearchEntityType::World,
        source: "local".into(),
        name: row.name.clone(),
        subtitle,
        image_url,
        seed_data: serde_json::to_value(row).ok().map(RawJson::from),
        memo: String::new(),
        note: String::new(),
        matched_field: QuickSearchMatchedField::Name,
        user_colour: String::new(),
        bio: String::new(),
    }
}

fn project_rows(
    rows: Vec<Value>,
    entity_type: QuickSearchEntityType,
    source: &'static str,
) -> Vec<QuickSearchCandidate> {
    let mut seen = HashSet::new();
    rows.into_iter()
        .filter_map(|row| project_row(row, entity_type, source))
        .filter(|row| seen.insert(row.id.clone()))
        .collect()
}

fn project_row(
    row: Value,
    entity_type: QuickSearchEntityType,
    source: &'static str,
) -> Option<QuickSearchCandidate> {
    let object = row.as_object()?;
    let id = first_text_field(object, &["id"]);
    if id.is_empty() {
        return None;
    }
    let default_name = match entity_type {
        QuickSearchEntityType::Friend => "User",
        QuickSearchEntityType::Avatar => "Avatar",
        QuickSearchEntityType::World => "World",
        QuickSearchEntityType::Group => "Group",
    };
    let name = {
        let value = first_text_field(object, &["name", "displayName"]);
        if value.is_empty() {
            default_name.to_string()
        } else {
            value
        }
    };
    let subtitle = first_text_field(
        object,
        &["authorName", "author_name", "ownerDisplayName", "groupName"],
    );
    let normalized_name = normalize_search_text(&name);
    let image_url = first_text_field(
        object,
        &[
            "thumbnailImageUrl",
            "thumbnail_image_url",
            "imageUrl",
            "image_url",
            "iconUrl",
            "bannerUrl",
        ],
    );
    let owner_id = first_text_field(object, &["ownerId"]);
    let seed_data = project_seed_data(object, &id);
    Some(QuickSearchCandidate {
        id,
        entity_type,
        source,
        name,
        normalized_name,
        subtitle,
        image_url,
        owner_id,
        seed_data,
    })
}

fn project_seed_data(object: &Map<String, Value>, id: &str) -> Value {
    const SEED_FIELDS: &[&str] = &[
        "groupId",
        "name",
        "displayName",
        "authorId",
        "authorName",
        "ownerId",
        "ownerDisplayName",
        "description",
        "imageUrl",
        "thumbnailImageUrl",
        "iconUrl",
        "bannerUrl",
        "releaseStatus",
        "memberCount",
        "shortCode",
    ];
    let mut seed = Map::new();
    seed.insert("id".into(), Value::String(id.to_string()));
    for field in SEED_FIELDS {
        if let Some(value) = object.get(*field) {
            seed.insert((*field).to_string(), value.clone());
        }
    }
    Value::Object(seed)
}

fn search_candidates(
    candidates: &[QuickSearchCandidate],
    query: &str,
    exclude_ids: &HashSet<String>,
) -> Vec<QuickSearchResult> {
    search_candidates_limited(candidates, query, exclude_ids, Some(RESULT_LIMIT))
}

fn search_candidates_limited(
    candidates: &[QuickSearchCandidate],
    query: &str,
    exclude_ids: &HashSet<String>,
    limit: Option<usize>,
) -> Vec<QuickSearchResult> {
    let mut matches = candidates
        .iter()
        .filter(|row| !exclude_ids.contains(&row.id))
        .filter(|&row| row.normalized_name.contains(query))
        .map(|row| {
            (
                !row.normalized_name.starts_with(query),
                row.normalized_name.as_str(),
                row,
            )
        })
        .collect::<Vec<_>>();
    matches.sort_by(|left, right| {
        (&left.0, left.1, &left.2.id).cmp(&(&right.0, right.1, &right.2.id))
    });
    matches
        .into_iter()
        .take(limit.unwrap_or(usize::MAX))
        .map(|(_, _, row)| candidate_result(row))
        .collect()
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum QuickSearchPrefix {
    /// `!`: friends only.
    Friends,
    /// `@`: worlds only.
    Worlds,
    /// `#`: groups only.
    Groups,
}

/// Split a normalized query into its category prefix and the remaining query.
/// Queries without a prefix return `None` and keep the unprefixed behaviour.
fn split_query_prefix(query: &str) -> Option<(QuickSearchPrefix, &str)> {
    let mut chars = query.chars();
    let prefix = match chars.next()? {
        '!' => QuickSearchPrefix::Friends,
        '@' => QuickSearchPrefix::Worlds,
        '#' => QuickSearchPrefix::Groups,
        _ => return None,
    };
    Some((prefix, chars.as_str()))
}

/// A bare prefix lists the whole category (no per-group limit, as in jirai).
fn prefixed_result_limit(rest: &str) -> Option<usize> {
    if rest.is_empty() {
        None
    } else {
        Some(RESULT_LIMIT)
    }
}

struct PrefixedSources<'a> {
    friends: Vec<FriendRecord>,
    details: &'a FriendDetails,
    remote: Option<&'a QuickSearchRemoteCatalog>,
    local_worlds: Vec<QuickSearchResult>,
    current_user_id: &'a str,
}

fn build_prefixed_output(
    prefix: QuickSearchPrefix,
    rest: &str,
    sources: PrefixedSources<'_>,
) -> QuickSearchQueryOutput {
    let limit = prefixed_result_limit(rest);
    let mut output = QuickSearchQueryOutput::empty();
    match prefix {
        QuickSearchPrefix::Friends => {
            output.friends = search_friends_limited(
                sources.friends,
                &sources.details.memos,
                &sources.details.notes,
                &sources.details.bios,
                rest,
                limit,
            );
        }
        QuickSearchPrefix::Worlds => {
            let Some(remote) = sources.remote else {
                return output;
            };
            output.own_worlds =
                search_candidates_limited(&remote.own_worlds, rest, &HashSet::new(), limit);
            let own_world_ids = remote
                .own_worlds
                .iter()
                .map(|row| row.id.clone())
                .collect::<HashSet<_>>();
            output.favorite_worlds =
                search_candidates_limited(&remote.favorite_worlds, rest, &own_world_ids, limit);
            if !rest.is_empty() {
                merge_results(&mut output.favorite_worlds, sources.local_worlds);
            }
        }
        QuickSearchPrefix::Groups => {
            let Some(remote) = sources.remote else {
                return output;
            };
            let own_groups = remote
                .groups
                .iter()
                .filter(|row| row.owner_id == sources.current_user_id)
                .cloned()
                .collect::<Vec<_>>();
            let own_group_ids = own_groups
                .iter()
                .map(|row| row.id.clone())
                .collect::<HashSet<_>>();
            output.own_groups =
                search_candidates_limited(&own_groups, rest, &HashSet::new(), limit);
            output.joined_groups =
                search_candidates_limited(&remote.groups, rest, &own_group_ids, limit);
        }
    }
    output
}

fn candidate_result(row: &QuickSearchCandidate) -> QuickSearchResult {
    QuickSearchResult {
        id: row.id.clone(),
        entity_type: row.entity_type,
        source: row.source.into(),
        name: row.name.clone(),
        subtitle: row.subtitle.clone(),
        image_url: row.image_url.clone(),
        seed_data: Some(RawJson::from(row.seed_data.clone())),
        memo: String::new(),
        note: String::new(),
        matched_field: QuickSearchMatchedField::Name,
        user_colour: String::new(),
        bio: String::new(),
    }
}

fn merge_results(target: &mut Vec<QuickSearchResult>, rows: Vec<QuickSearchResult>) {
    let mut seen = target
        .iter()
        .map(|row| row.id.clone())
        .collect::<HashSet<_>>();
    for row in rows {
        if target.len() >= RESULT_LIMIT {
            break;
        }
        if seen.insert(row.id.clone()) {
            target.push(row);
        }
    }
}

fn normalize_search_text(value: &str) -> String {
    value
        .trim()
        .chars()
        .filter(|character| !character.is_whitespace())
        .map(fold_search_character)
        .flat_map(char::to_lowercase)
        .collect()
}

fn fold_search_character(character: char) -> char {
    match character {
        '\u{24b6}'..='\u{24cf}' => {
            char::from_u32('A' as u32 + character as u32 - 0x24b6).unwrap_or(character)
        }
        '\u{24d0}'..='\u{24e9}' => {
            char::from_u32('a' as u32 + character as u32 - 0x24d0).unwrap_or(character)
        }
        '\u{ff10}'..='\u{ff19}' => {
            char::from_u32('0' as u32 + character as u32 - 0xff10).unwrap_or(character)
        }
        '\u{ff21}'..='\u{ff3a}' => {
            char::from_u32('A' as u32 + character as u32 - 0xff21).unwrap_or(character)
        }
        '\u{ff41}'..='\u{ff5a}' => {
            char::from_u32('a' as u32 + character as u32 - 0xff41).unwrap_or(character)
        }
        _ => character,
    }
}

fn first_text_field(object: &Map<String, Value>, fields: &[&str]) -> String {
    fields
        .iter()
        .find_map(|field| {
            object
                .get(*field)
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
        })
        .unwrap_or_default()
        .to_string()
}

fn rows_or_empty(result: Result<Vec<Value>>, failures: &mut usize) -> Vec<Value> {
    match result {
        Ok(rows) => rows,
        Err(error) => {
            *failures += 1;
            tracing::debug!(error = %error, "quick search source failed");
            Vec::new()
        }
    }
}

fn friend_snapshot_matches_scope(
    snapshot: &RealtimeFriendSnapshot,
    scope: &RuntimeAuthScopeSnapshot,
) -> bool {
    snapshot.current_user_id == scope.current_user_id && snapshot.endpoint == scope.endpoint
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn candidate(id: &str, name: &str) -> QuickSearchCandidate {
        QuickSearchCandidate {
            id: id.into(),
            entity_type: QuickSearchEntityType::Avatar,
            source: "test",
            name: name.into(),
            normalized_name: normalize_search_text(name),
            subtitle: String::new(),
            image_url: String::new(),
            owner_id: String::new(),
            seed_data: json!({ "id": id, "name": name }),
        }
    }

    #[test]
    fn friend_result_uses_icon_url_as_the_user_image() {
        let friend = FriendRecord {
            id: "usr_friend".into(),
            icon_url: "https://api.vrchat.cloud/api/1/image/file_icon/1/256".into(),
            ..FriendRecord::default()
        };

        let result = friend_result(
            friend,
            "Friend".into(),
            "",
            "",
            "",
            QuickSearchMatchedField::Name,
        );

        assert_eq!(
            result.image_url,
            "https://api.vrchat.cloud/api/1/image/file_icon/1/256"
        );
    }

    #[test]
    fn remap_group_membership_row_ids_prefers_group_id_over_membership_record_id() {
        let mut rows = vec![
            json!({ "id": "gmem_membership_1", "groupId": "grp_real_1", "name": "Real Group" }),
            json!({ "id": "gmem_membership_2", "groupId": "", "name": "Missing Group Id" }),
            json!({ "id": "gmem_membership_3", "name": "No Group Id Field" }),
        ];

        remap_group_membership_row_ids(&mut rows);

        assert_eq!(rows[0]["id"], json!("grp_real_1"));
        assert_eq!(rows[1]["id"], json!("gmem_membership_2"));
        assert_eq!(rows[2]["id"], json!("gmem_membership_3"));
    }

    #[test]
    fn normalization_folds_whitespace_and_common_compatibility_characters() {
        assert_eq!(normalize_search_text("  ⓐlpha  ＢＥＴＡ "), "alphabeta");
    }

    #[test]
    fn candidate_and_friend_search_prioritize_prefixes_and_limit_results() {
        let candidates = [
            candidate("9", "Zed alpha"),
            candidate("1", "Alpha 9"),
            candidate("2", "Alpha 8"),
            candidate("3", "Alpha 7"),
            candidate("4", "Alpha 6"),
            candidate("5", "Alpha 5"),
            candidate("6", "Alpha 4"),
            candidate("7", "Alpha 3"),
            candidate("8", "Alpha 2"),
            candidate("10", "Beta alpha"),
        ];

        let results = search_candidates(&candidates, "alpha", &HashSet::new());

        assert_eq!(results.len(), RESULT_LIMIT);
        assert_eq!(
            results
                .iter()
                .map(|result| result.name.as_str())
                .collect::<Vec<_>>(),
            [
                "Alpha 2", "Alpha 3", "Alpha 4", "Alpha 5", "Alpha 6", "Alpha 7", "Alpha 8",
                "Alpha 9"
            ]
        );

        let friends = candidates.iter().map(|candidate| FriendRecord {
            id: candidate.id.clone(),
            display_name: candidate.name.as_str().into(),
            ..FriendRecord::default()
        });
        let friend_results = search_friends(
            friends,
            &HashMap::new(),
            &HashMap::new(),
            &HashMap::new(),
            "alpha",
        );
        assert_eq!(
            friend_results
                .iter()
                .map(|row| (&row.id, &row.name))
                .collect::<Vec<_>>(),
            results
                .iter()
                .map(|row| (&row.id, &row.name))
                .collect::<Vec<_>>()
        );
    }

    #[test]
    fn friend_details_require_two_characters() {
        let friend = FriendRecord {
            id: "usr_1".into(),
            display_name: "Alpha".into(),
            ..FriendRecord::default()
        };
        let memos = HashMap::from([("usr_1".into(), "x-ray".into())]);
        let notes = HashMap::from([("usr_1".into(), "yellow".into())]);

        let bios = HashMap::new();
        assert!(search_friends([friend.clone()], &memos, &notes, &bios, "x").is_empty());
        assert_eq!(
            search_friends([friend], &memos, &notes, &bios, "x-")[0].matched_field,
            QuickSearchMatchedField::Memo
        );
    }

    #[test]
    fn remote_projection_retains_only_dialog_seed_fields() {
        let row = json!({
            "id": "avtr_1",
            "name": "Avatar",
            "authorName": "Author",
            "thumbnailImageUrl": "https://example.test/image",
            "largeUnusedPayload": [1, 2, 3]
        });

        let projected = project_row(row, QuickSearchEntityType::Avatar, "favorite").unwrap();

        assert_eq!(projected.id, "avtr_1");
        assert_eq!(projected.name, "Avatar");
        assert!(projected.seed_data.get("largeUnusedPayload").is_none());
    }

    #[test]
    fn favorite_world_projection_uses_world_id_instead_of_favorite_record_id() {
        let row = json!({
            "favoriteId": "fvrt_1",
            "id": "wrld_1",
            "name": "Favorite World",
        });

        let projected = project_row(row, QuickSearchEntityType::World, "favorite").unwrap();

        assert_eq!(projected.id, "wrld_1");
        assert_eq!(projected.seed_data["id"], json!("wrld_1"));
    }

    fn friend(id: &str, name: &str) -> FriendRecord {
        FriendRecord {
            id: id.into(),
            display_name: name.into(),
            ..FriendRecord::default()
        }
    }

    fn map(rows: &[(&str, &str)]) -> HashMap<String, String> {
        rows.iter()
            .map(|(id, value)| ((*id).to_string(), (*value).to_string()))
            .collect()
    }

    // A14-1
    #[test]
    fn bio_only_match_returns_friend_with_bio_matched_field() {
        let bios = map(&[("usr_1", "Loves Kyoto tea houses")]);
        let results = search_friends(
            [friend("usr_1", "Alpha")],
            &HashMap::new(),
            &HashMap::new(),
            &bios,
            "kyoto",
        );
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, "usr_1");
        assert_eq!(results[0].matched_field, QuickSearchMatchedField::Bio);
        assert_eq!(results[0].bio, "Loves Kyoto tea houses");
    }

    // A14-2
    #[test]
    fn name_beats_memo_note_and_bio_and_each_friend_appears_once() {
        let memos = map(&[("usr_1", "kyoto memo"), ("usr_2", "kyoto memo")]);
        let notes = map(&[
            ("usr_1", "kyoto note"),
            ("usr_2", "kyoto note"),
            ("usr_3", "kyoto note"),
        ]);
        let bios = map(&[
            ("usr_1", "kyoto bio"),
            ("usr_2", "kyoto bio"),
            ("usr_3", "kyoto bio"),
            ("usr_4", "kyoto bio"),
        ]);
        let results = search_friends(
            [
                friend("usr_1", "Kyoto Fan"),
                friend("usr_2", "Beta"),
                friend("usr_3", "Gamma"),
                friend("usr_4", "Delta"),
            ],
            &memos,
            &notes,
            &bios,
            "kyoto",
        );
        let fields = results
            .iter()
            .map(|row| (row.id.as_str(), row.matched_field))
            .collect::<HashMap<_, _>>();
        assert_eq!(results.len(), 4);
        assert_eq!(fields["usr_1"], QuickSearchMatchedField::Name);
        assert_eq!(fields["usr_2"], QuickSearchMatchedField::Memo);
        assert_eq!(fields["usr_3"], QuickSearchMatchedField::Note);
        assert_eq!(fields["usr_4"], QuickSearchMatchedField::Bio);
    }

    // A14-3
    #[test]
    fn single_character_query_does_not_search_bio() {
        let bios = map(&[("usr_1", "q")]);
        assert!(search_friends(
            [friend("usr_1", "Alpha")],
            &HashMap::new(),
            &HashMap::new(),
            &bios,
            "q",
        )
        .is_empty());
        assert_eq!(
            search_friends(
                [friend("usr_1", "Alpha")],
                &HashMap::new(),
                &HashMap::new(),
                &map(&[("usr_1", "qq")]),
                "qq",
            )[0]
            .matched_field,
            QuickSearchMatchedField::Bio
        );
    }

    // A14-4: only friends from the friend snapshot are searched; bios of
    // non-friends present in the bio table never produce results.
    #[test]
    fn non_friend_bio_matches_are_ignored() {
        let bios = map(&[("usr_stranger", "kyoto"), ("usr_1", "nothing here")]);
        assert!(search_friends(
            [friend("usr_1", "Alpha")],
            &HashMap::new(),
            &HashMap::new(),
            &bios,
            "kyoto",
        )
        .is_empty());
    }

    // A14-6
    #[test]
    fn percent_and_underscore_are_literal_characters_in_bio_matching() {
        let bios = map(&[
            ("usr_pct", "100% real"),
            ("usr_plain", "100 real"),
            ("usr_us", "snake_case fan"),
            ("usr_nous", "snakeXcase fan"),
        ]);
        let friends = || {
            [
                friend("usr_pct", "A"),
                friend("usr_plain", "B"),
                friend("usr_us", "C"),
                friend("usr_nous", "D"),
            ]
        };
        let pct = search_friends(friends(), &HashMap::new(), &HashMap::new(), &bios, "0%");
        assert_eq!(
            pct.iter().map(|r| r.id.as_str()).collect::<Vec<_>>(),
            ["usr_pct"]
        );
        let us = search_friends(friends(), &HashMap::new(), &HashMap::new(), &bios, "e_c");
        assert_eq!(
            us.iter().map(|r| r.id.as_str()).collect::<Vec<_>>(),
            ["usr_us"]
        );
        let wildcard = search_friends(friends(), &HashMap::new(), &HashMap::new(), &bios, "%%");
        assert!(wildcard.is_empty());
    }

    // A14-7
    #[test]
    fn bio_matches_share_the_friend_result_limit() {
        let friends = (0..12)
            .map(|index| friend(&format!("usr_{index:02}"), &format!("Friend {index:02}")))
            .collect::<Vec<_>>();
        let bios = friends
            .iter()
            .map(|row| (row.id.clone(), "shared kyoto bio".to_string()))
            .collect::<HashMap<_, _>>();
        let results = search_friends(friends, &HashMap::new(), &HashMap::new(), &bios, "kyoto");
        assert_eq!(results.len(), RESULT_LIMIT);
        assert!(results
            .iter()
            .all(|row| row.matched_field == QuickSearchMatchedField::Bio));
        assert_eq!(results[0].name, "Friend 00");
    }

    #[test]
    fn bio_matching_is_case_and_width_insensitive() {
        let bios = map(&[("usr_1", "ＫＹＯＴＯ Lover")]);
        let results = search_friends(
            [friend("usr_1", "Alpha")],
            &HashMap::new(),
            &HashMap::new(),
            &bios,
            "kyoto",
        );
        assert_eq!(results[0].matched_field, QuickSearchMatchedField::Bio);
    }

    struct FakeDetailStore {
        fail_memos: bool,
        fail_notes: bool,
        fail_bios: bool,
        seen_bio_owner: Mutex<Option<String>>,
    }

    impl FakeDetailStore {
        fn new(fail_memos: bool, fail_notes: bool, fail_bios: bool) -> Self {
            Self {
                fail_memos,
                fail_notes,
                fail_bios,
                seen_bio_owner: Mutex::new(None),
            }
        }
    }

    impl QuickSearchDetailStore for FakeDetailStore {
        fn user_memos(&self) -> Result<Vec<(String, String)>> {
            if self.fail_memos {
                return Err(Error::Custom("memo failure".into()));
            }
            Ok(vec![("usr_1".into(), "memo text".into())])
        }

        fn user_notes(&self, _owner: OwnerId) -> Result<Vec<(String, String)>> {
            if self.fail_notes {
                return Err(Error::Custom("note failure".into()));
            }
            Ok(vec![("usr_2".into(), "note text".into())])
        }

        fn user_bios(&self, owner: OwnerId) -> Result<Vec<(String, String)>> {
            *self.seen_bio_owner.lock().unwrap() = Some(owner.as_str().to_string());
            if self.fail_bios {
                return Err(Error::Custom("bio failure".into()));
            }
            Ok(vec![("usr_3".into(), "bio text".into())])
        }
    }

    // A14-9
    #[test]
    fn bio_load_failure_is_counted_and_other_details_still_load() {
        let store = FakeDetailStore::new(false, false, true);
        let details = load_friend_details(&store, "usr_me", true);
        assert_eq!(details.failures, 1);
        assert_eq!(details.memos["usr_1"], "memo text");
        assert_eq!(details.notes["usr_2"], "note text");
        assert!(details.bios.is_empty());
        assert_eq!(
            store.seen_bio_owner.lock().unwrap().as_deref(),
            Some("usr_me")
        );

        let results = search_friends(
            [friend("usr_1", "Alpha"), friend("usr_2", "Beta")],
            &details.memos,
            &details.notes,
            &details.bios,
            "text",
        );
        assert_eq!(results.len(), 2);
    }

    #[test]
    fn detail_loading_is_skipped_for_short_queries_and_counts_every_failure() {
        let store = FakeDetailStore::new(true, true, true);
        let skipped = load_friend_details(&store, "usr_me", false);
        assert_eq!(skipped.failures, 0);
        assert!(store.seen_bio_owner.lock().unwrap().is_none());

        let all_failed = load_friend_details(&store, "usr_me", true);
        assert_eq!(all_failed.failures, 3);

        let ok = load_friend_details(&FakeDetailStore::new(false, false, false), "usr_me", true);
        assert_eq!(ok.failures, 0);
        assert_eq!(ok.bios["usr_3"], "bio text");
    }

    #[test]
    fn matched_field_bio_serializes_as_camel_case_bio() {
        assert_eq!(
            serde_json::to_value(QuickSearchMatchedField::Bio).unwrap(),
            json!("bio")
        );
    }

    fn owned(
        id: &str,
        name: &str,
        entity_type: QuickSearchEntityType,
        owner: &str,
    ) -> QuickSearchCandidate {
        QuickSearchCandidate {
            entity_type,
            owner_id: owner.into(),
            ..candidate(id, name)
        }
    }

    fn prefixed_catalog() -> QuickSearchRemoteCatalog {
        QuickSearchRemoteCatalog {
            own_avatars: vec![owned(
                "avtr_1",
                "Alpha Avatar",
                QuickSearchEntityType::Avatar,
                "usr_me",
            )],
            favorite_avatars: vec![owned(
                "avtr_2",
                "Avatar Fav",
                QuickSearchEntityType::Avatar,
                "usr_x",
            )],
            own_worlds: vec![
                owned(
                    "wrld_own",
                    "Alpha World",
                    QuickSearchEntityType::World,
                    "usr_me",
                ),
                owned(
                    "wrld_own2",
                    "Beta World",
                    QuickSearchEntityType::World,
                    "usr_me",
                ),
            ],
            favorite_worlds: (0..12)
                .map(|index| {
                    owned(
                        &format!("wrld_fav_{index:02}"),
                        &format!("Fav World {index:02}"),
                        QuickSearchEntityType::World,
                        "usr_x",
                    )
                })
                .chain([owned(
                    "wrld_own",
                    "Alpha World",
                    QuickSearchEntityType::World,
                    "usr_me",
                )])
                .collect(),
            groups: vec![
                owned(
                    "grp_own",
                    "Alpha Group",
                    QuickSearchEntityType::Group,
                    "usr_me",
                ),
                owned(
                    "grp_joined",
                    "Joined Group",
                    QuickSearchEntityType::Group,
                    "usr_x",
                ),
                owned("grp_z", "Zeta Club", QuickSearchEntityType::Group, "usr_y"),
            ],
            failures: 0,
        }
    }

    fn prefixed(
        prefix: QuickSearchPrefix,
        rest: &str,
        friends: Vec<FriendRecord>,
        details: &FriendDetails,
        remote: Option<&QuickSearchRemoteCatalog>,
    ) -> QuickSearchQueryOutput {
        build_prefixed_output(
            prefix,
            rest,
            PrefixedSources {
                friends,
                details,
                remote,
                local_worlds: Vec::new(),
                current_user_id: "usr_me",
            },
        )
    }

    fn ids(rows: &[QuickSearchResult]) -> Vec<&str> {
        rows.iter().map(|row| row.id.as_str()).collect()
    }

    fn only_friends(output: &QuickSearchQueryOutput) -> bool {
        output.own_avatars.is_empty()
            && output.favorite_avatars.is_empty()
            && output.own_worlds.is_empty()
            && output.favorite_worlds.is_empty()
            && output.own_groups.is_empty()
            && output.joined_groups.is_empty()
    }

    #[test]
    fn query_prefixes_are_parsed_from_the_first_character_only() {
        assert_eq!(
            split_query_prefix("!"),
            Some((QuickSearchPrefix::Friends, ""))
        );
        assert_eq!(
            split_query_prefix("!al"),
            Some((QuickSearchPrefix::Friends, "al"))
        );
        assert_eq!(
            split_query_prefix("@a"),
            Some((QuickSearchPrefix::Worlds, "a"))
        );
        assert_eq!(
            split_query_prefix("#grp"),
            Some((QuickSearchPrefix::Groups, "grp"))
        );
        assert_eq!(
            split_query_prefix(&normalize_search_text("  ! Al ")),
            Some((QuickSearchPrefix::Friends, "al"))
        );
        // A17-11: anything else keeps the unprefixed flow.
        for query in ["alpha", "a!b", "a@b", "a#b", "wrld_x", "usr_1", "x"] {
            assert_eq!(split_query_prefix(query), None, "{query}");
        }
    }

    // A17-7
    #[test]
    fn bang_prefix_returns_only_friends_and_bare_bang_lists_all() {
        let friends = (0..12)
            .map(|index| friend(&format!("usr_{index:02}"), &format!("Friend {index:02}")))
            .collect::<Vec<_>>();
        let details = FriendDetails::default();
        let all = prefixed(
            QuickSearchPrefix::Friends,
            "",
            friends.clone(),
            &details,
            None,
        );
        assert_eq!(
            all.friends.len(),
            12,
            "bare ! is not capped at RESULT_LIMIT"
        );
        assert!(only_friends(&all));

        let some = prefixed(
            QuickSearchPrefix::Friends,
            "friend",
            friends,
            &details,
            None,
        );
        assert_eq!(some.friends.len(), RESULT_LIMIT);
        assert!(only_friends(&some));
    }

    // A17-7
    #[test]
    fn bang_prefix_matches_details_only_from_two_characters() {
        let details = FriendDetails {
            memos: map(&[("usr_1", "x-ray memo")]),
            notes: HashMap::new(),
            bios: map(&[("usr_2", "xy bio")]),
            failures: 0,
        };
        let friends = || {
            vec![
                friend("usr_1", "Alpha"),
                friend("usr_2", "Beta"),
                friend("usr_3", "Xeno"),
            ]
        };
        let one = prefixed(QuickSearchPrefix::Friends, "x", friends(), &details, None);
        assert_eq!(ids(&one.friends), ["usr_3"]);
        assert_eq!(one.friends[0].matched_field, QuickSearchMatchedField::Name);

        let two = prefixed(QuickSearchPrefix::Friends, "x-", friends(), &details, None);
        assert_eq!(ids(&two.friends), ["usr_1"]);
        assert_eq!(two.friends[0].matched_field, QuickSearchMatchedField::Memo);

        let bio = prefixed(QuickSearchPrefix::Friends, "xy", friends(), &details, None);
        assert_eq!(ids(&bio.friends), ["usr_2"]);
        assert_eq!(bio.friends[0].matched_field, QuickSearchMatchedField::Bio);
    }

    // A17-8
    #[test]
    fn at_prefix_returns_only_worlds_from_one_character_and_bare_at_lists_all() {
        let catalog = prefixed_catalog();
        let details = FriendDetails::default();
        let friends = vec![friend("usr_1", "Alpha friend")];

        // One character is enough: "z" only appears in no world, "b" only in Beta.
        let none = prefixed(
            QuickSearchPrefix::Worlds,
            "z",
            friends.clone(),
            &details,
            Some(&catalog),
        );
        assert!(none.own_worlds.is_empty() && none.favorite_worlds.is_empty());
        let one = prefixed(
            QuickSearchPrefix::Worlds,
            "b",
            friends.clone(),
            &details,
            Some(&catalog),
        );
        assert!(one.friends.is_empty());
        assert!(one.own_avatars.is_empty() && one.favorite_avatars.is_empty());
        assert!(one.own_groups.is_empty() && one.joined_groups.is_empty());
        assert_eq!(ids(&one.own_worlds), ["wrld_own2"]);

        let all = prefixed(
            QuickSearchPrefix::Worlds,
            "",
            friends,
            &details,
            Some(&catalog),
        );
        assert_eq!(ids(&all.own_worlds), ["wrld_own", "wrld_own2"]);
        assert_eq!(
            all.favorite_worlds.len(),
            12,
            "own world is not repeated, no limit"
        );
        assert!(!ids(&all.favorite_worlds).contains(&"wrld_own"));
        assert!(all.friends.is_empty() && all.own_groups.is_empty());

        let capped = prefixed(
            QuickSearchPrefix::Worlds,
            "fav",
            Vec::new(),
            &details,
            Some(&catalog),
        );
        assert_eq!(capped.favorite_worlds.len(), RESULT_LIMIT);
    }

    #[test]
    fn at_prefix_merges_local_worlds_only_for_a_real_query() {
        let catalog = prefixed_catalog();
        let details = FriendDetails::default();
        let local = |id: &str| QuickSearchResult {
            source: "local".into(),
            ..candidate_result(&owned(id, "Local World", QuickSearchEntityType::World, ""))
        };
        let searched = build_prefixed_output(
            QuickSearchPrefix::Worlds,
            "beta",
            PrefixedSources {
                friends: Vec::new(),
                details: &details,
                remote: Some(&catalog),
                local_worlds: vec![local("wrld_local")],
                current_user_id: "usr_me",
            },
        );
        assert_eq!(ids(&searched.own_worlds), ["wrld_own2"]);
        assert_eq!(ids(&searched.favorite_worlds), ["wrld_local"]);
    }

    // A17-9
    #[test]
    fn hash_prefix_returns_only_groups_from_one_character_and_bare_hash_lists_all() {
        let catalog = prefixed_catalog();
        let details = FriendDetails::default();

        let one = prefixed(
            QuickSearchPrefix::Groups,
            "z",
            Vec::new(),
            &details,
            Some(&catalog),
        );
        assert_eq!(ids(&one.joined_groups), ["grp_z"]);
        assert!(one.own_groups.is_empty());
        assert!(
            one.friends.is_empty() && one.own_worlds.is_empty() && one.favorite_worlds.is_empty()
        );
        assert!(one.own_avatars.is_empty() && one.favorite_avatars.is_empty());

        let all = prefixed(
            QuickSearchPrefix::Groups,
            "",
            Vec::new(),
            &details,
            Some(&catalog),
        );
        assert_eq!(ids(&all.own_groups), ["grp_own"]);
        assert_eq!(ids(&all.joined_groups), ["grp_joined", "grp_z"]);
    }

    #[test]
    fn prefixed_output_is_empty_when_the_remote_catalog_is_missing() {
        let details = FriendDetails::default();
        for prefix in [QuickSearchPrefix::Worlds, QuickSearchPrefix::Groups] {
            let output = prefixed(prefix, "", vec![friend("usr_1", "A")], &details, None);
            assert!(output.friends.is_empty() && output.own_worlds.is_empty());
            assert!(output.own_groups.is_empty() && output.joined_groups.is_empty());
        }
    }

    // A17-11: the unprefixed helpers keep the 8-result limit.
    #[test]
    fn unprefixed_helpers_keep_the_result_limit() {
        let catalog = prefixed_catalog();
        assert_eq!(
            search_candidates(&catalog.favorite_worlds, "", &HashSet::new()).len(),
            RESULT_LIMIT
        );
        let friends = (0..12).map(|index| friend(&format!("usr_{index:02}"), "Same"));
        assert_eq!(
            search_friends(
                friends,
                &HashMap::new(),
                &HashMap::new(),
                &HashMap::new(),
                "same"
            )
            .len(),
            RESULT_LIMIT
        );
    }
}

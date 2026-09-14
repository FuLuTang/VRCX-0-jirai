# Investigation: tracked non-friends

## Legacy behavior

The legacy feature added owner-prefixed `*_tracked_nonfriends` storage, a
sidebar list, profile/menu actions, and a periodic coordinator that refreshed
non-friend profiles and produced Feed observations. Evidence: legacy commit
`f66d455c`, `src/services/database/trackedNonFriends.js`,
`src/stores/trackedNonFriends.js`, `src/coordinators/nonFriendCoordinator.js`,
and `TrackedNonFriendsSidebar.vue`.

## Current fit

Current VRCX-0 models observed friend realtime data as current-owner data.
There is no non-friend tracking domain. The current mutual graph is an
observed snapshot (`crates/persistence/src/mutual_graph.rs`), not a generic
watch list. Reusing it would incorrectly imply friendship and contaminate
coverage information.

## Proposed migration design

- Add a separate owner-scoped tracked-subject domain only after approval:
  canonical `target_user_id`, optional display snapshot, enabled flag,
  created/updated timestamps, and a source/version field.
- Provide typed Rust CRUD commands/repository APIs; never expose frontend SQL.
- Run refreshes in a bounded, cancellable application service with an explicit
  per-user limit, persisted backoff, rate-limit handling, and no startup scan
  by default.
- Persist observations only through the existing Feed event path when their
  provenance and retention policy are defined. A tracked person must be
  visibly labeled in every UI, and removal must stop scheduling without
  rewriting genuine historical observations.

## Risks and decisions needed

This changes API traffic and collects history for people outside the friend
list. Decide opt-in wording, maximum count, refresh cadence, retention,
privacy warning, and whether each account owns an independent watch list.

## Required tests

Rust owner isolation, canonical IDs, idempotent schema upgrade, limits and
backoff; application cancellation/rate-limit tests; repository contract tests;
React add/remove/empty/error accessibility tests; and an integration fixture
showing no mutation of friend or mutual-graph data.

## Recommendation

**Do not implement in this round.** It is a new persistence/scheduler feature,
not a direct UI port.

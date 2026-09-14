# Investigation: profile completion and automatic actions

## Legacy behavior

Jirai includes bulk profile completion/status recording through
`infoFetchCoordinator.js`, progress UI and `ProfileCompletionDialog.vue`. It
also contains selected-friend automatic follow and a configurable Jirai group
join. These features make VRChat requests or actions outside a user click.

## Current fit

Current VRCX-0 already owns Feed persistence and has user/group repositories,
but it has no equivalent background bulk profile scan or automatic follow.
Current notification/preferences infrastructure should remain canonical; no
Vue setting/local-storage pattern should be copied.

## Migration questions

- Which exact fields are fetched, when, and with what consent?
- What is the maximum batch size, API-rate policy, retry/backoff, cancellation
  behavior and visible progress?
- Are profile snapshots recorded only for friends, or tracked non-friends too?
- Does an automatic follow/join require confirmation each time, a per-feature
  default-off preference, cooldown, stop control and failure reporting?
- Should the hard-coded legacy developer-group ID ever be supported? The safe
  default is **no automatic join**.

## Proposed architecture

If approved, create an application service with typed progress events,
cancellation and persisted rate-limit state. It calls public repository/API
paths and emits normal provenance-aware Feed observations. Keep each automatic
external action behind its own explicit, default-off preference and visible
session state.

## Required tests

Rate limit/retry/cancel lifecycle, owner isolation, batch bounds, no duplicate
observations, restart recovery, preference migration, confirmation/cooldown,
and React progress/error/accessibility coverage.

## Recommendation

**Product decision required; do not implement in this round.**

# Investigation: concurrent multi-account V4

## Legacy behavior

The legacy V4 draft uses `accountHub`, `AccountSession` and an aggregated view
to run a primary and multiple secondary HTTP/WebSocket sessions. It stores
separate table prefixes, merges Feed/friends, and hot-swaps global stores for
per-account views. Evidence: legacy commit `733dab99`,
`docs/MULTI_ACCOUNT_V4_DETAIL_DESIGN.md`, `accountHub.js`,
`accountSession.js` and `aggregatedView.js`.

## Current fit and blocker

Current VRCX-0 supports saved-account switching, not concurrent sessions. Its
Rust auth/runtime intentionally has one authenticated active owner and guards
account-switch lifecycle. Saved credential encryption and active realtime
services are not compatible with copying the legacy Electron/.NET secondary
client or Vue global-store hot-swap approach. The legacy aggregate code also
contains interface mismatches, so it is not a safe specification.

## Greenfield RFC requirements

- Explicit multi-session runtime ownership: one isolated auth cookie/client,
  realtime connection, cancellation tree, scheduler and bounded resource
  budget per account.
- Data ownership and source labels in every aggregate row; no mutable global
  active-owner context shared across background sessions.
- A query model for merged Feed/friends/notifications that preserves account
  origin and routes actions to the owning authenticated session.
- Logout, token expiry, reconnect, duplicate account, crash recovery,
  encrypted credential handling and telemetry/privacy behavior.
- A deliberate supported-page matrix; unsupported views must not silently use
  the wrong owner.

## Test strategy

Build a fake multi-session runtime first. Test credentials/cookie isolation,
event routing, cancellation, merged-query ordering/deduplication, action
routing, account removal, concurrent database access and active-view changes.
Only after that should real VRChat integration be considered.

## Recommendation

**Architecture RFC only. Do not port legacy hot-swapping or begin implementation.**

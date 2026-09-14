# Investigation: manual relationship declarations and graph overlay

## Legacy behavior

Legacy Jirai stored canonicalized pairs in
`{prefix}_manual_relations_MANUEL`, edited them through
`ManualRelationsDialog.vue`, and rendered green edges in the mutual-friends
graph. The relevant implementation is `src/services/database/manualRelations.js`
and `src/stores/manualRelations.js`; graph integration appears in
`MutualFriends.vue`.

## Current fit

Current VRCX-0 persists fetched mutual-graph snapshots in
`{prefix}_mutual_graph_*` tables and renders them from
`src/features/charts/mutual-friends/`. Those records are observed VRChat data.
Manual declarations must be a separate overlay and must never mutate the
observed graph snapshot or make an inferred relationship look authoritative.

## Proposed migration design

- Create an owner-scoped manual-edge domain with a canonical sorted pair,
  relation kind, optional user-authored note, creation/update times, and a
  dedicated schema version.
- Expose CRUD through a typed Tauri command/repository and return an overlay
  model to the graph page. Merge at render time with an explicit legend and
  accessibility label, rather than writing rows into mutual graph tables.
- Enforce nonempty, distinct user IDs and stable ordering in Rust. Define
  behavior when a user is no longer a friend or cache data is absent.
- Provide deletion and export/backup semantics alongside other owner data.

## Risks and tests

Schema ownership, pair uniqueness, account switching, deletion, stale labels,
and accidental confusion with VRChat mutual edges are the main risks. Test
canonical-pair CRUD and owner isolation in Rust; contract tests at the binding;
and React graph overlay, legend, no-data and deletion tests.

## Recommendation

**Investigate after a user-facing data-model decision; do not implement now.**

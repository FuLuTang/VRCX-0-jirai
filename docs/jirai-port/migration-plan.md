# Jirai follow-up migration plan

## This round

1. Preserve current `main` as the upstream-compatible Jirai integration line.
2. Complete the evidence-backed legacy inventory.
3. Port only status-history distribution, because it reads the existing
   current-account scoped `Status` Feed and requires neither schema nor backend
   changes.
4. Publish a preparation report for each complex feature.
5. Validate and stop. No complex feature implementation, upstream merge,
   release, or updater-signing work belongs to this round.

## Implementation rules

- Use React feature modules, repositories and generated Tauri bindings.
- Query history through `feedRepository.queryFeedUserHistory()` with the
  signed-in owner ID and displayed target user ID.
- Keep the data source read-only. Do not add a Rust Feed command, write
  directly to SQLite, add a Jirai database migration, or import legacy UI.
- Treat an empty status history as a normal state. Ignore stale asynchronous
  results when the owner or target user changes.
- Test data transformation separately from dialog behavior.

## Difficulty order

| Tier | Work | Rationale |
| --- | --- | --- |
| Implement now | Status-history distribution | Existing scoped Feed data and local UI aggregation only |
| Later, small | Historical-Bio local search; image drop-to-gallery | Need current UX/API fit but no new social data model |
| Later, product gated | Automatic follow; group auto-join | External effects, consent and cancellation semantics |
| Investigation required | Manual relations; tracked non-friends; relationship recommendation | New owner-scoped persistence and sensitive inference policy |
| Investigation required | Synthetic history records; profile completion | Evidence provenance, API rate limits, data integrity |
| Architecture RFC | Concurrent multi-account | Multiple authenticated realtime sessions conflict with the current active-session runtime |

## Verification

Run focused Vitest coverage, `npm run typecheck`, `npm test`, and `npm run build`.
A Windows graphical Tauri run remains a separate manual verification: it is
not claimed by a successful web build or Rust check.

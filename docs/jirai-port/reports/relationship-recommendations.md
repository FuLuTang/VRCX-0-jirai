# Investigation: relationship recommendations

## Legacy behavior

The legacy `manualRelations` store computes pair scores from GameLog, GPS,
online/offline Feed entries, and old mutual snapshots. It weights instance
privacy/access, creator identity, overlap, the observer's absence, and prior
manual relationships. Suggestions are session-only dismissals and can add
manual edges. Evidence: legacy commits `929db097`, `a95836c3`, `392365f0` and
`src/stores/manualRelations.js`.

## Why it is not portable as-is

The weights encode an unversioned privacy policy and are not a validated truth
model. Its nested candidate loop can be expensive, and it depends on features
not present in current VRCX-0 (tracked non-friends/manual edges/old snapshots).
Current Feed and mutual graph data have different guarantees.

## Required design before implementation

1. Specify an explainable, opt-in recommendation policy with evidence labels,
   confidence wording, exclusions, and a "do not infer" control.
2. Define immutable owner-scoped inputs and a versioned derived-result cache;
   raw Feed/GameLog/mutual data must never be changed.
3. Make computation cancellable and bounded. Prefer indexed Rust queries and
   deterministic aggregation to browser full-history pair scans.
4. Define handling for private locations, missing observations, stale mutual
   snapshots, manually declared pairs, and deletion/retention.
5. Require a clear UI separation between recommendation, observation and a
   user-declared manual relation.

## Required tests

Use fixed fixtures for overlap, access type, creator, absent observer,
duplicates, invalid timestamps, disabled inputs and owner separation. Test
performance bounds/cancellation, score-version invalidation, explanations and
privacy-safe empty states.

## Recommendation

**No implementation this round.** First complete the tracked-subject/manual
edge decisions and approve a new recommendation specification.

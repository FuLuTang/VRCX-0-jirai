# VRCX-jirai legacy feature inventory

## Scope and method

This inventory compares Jirai-authored behavior in the legacy Electron/Vue
repository (`../VRCX-jirai`) with this Tauri/React repository. It is not a
whole-tree diff between two differently evolved upstream applications.

The original clean-port scope is already complete:

- branding, icons, updater/repository identity;
- Bio history diff in the user dialog;
- two-person relationship history;
- relationship timeline and its route, navigation, and Dashboard entries.

Those items correspond to commits `76b1a447`, `c4150616`, `a23e5108`, and
`c26eeff8` on this repository's base. Legacy implementation details are
reference material only; no Electron/.NET/Vue architecture is imported.

## Classification

| Legacy capability | Legacy evidence | Current equivalent / gap | Decision |
| --- | --- | --- | --- |
| Branding, updater/release links, icons | legacy updater/link changes | completed in `76b1a447` | **Already migrated** |
| Bio history word diff | legacy user-dialog Bio feature | completed in `c4150616` using owner-scoped Feed | **Already migrated** |
| Two-person relationship history and timeline | legacy Charts pages | completed in `a23e5108` / `c26eeff8` | **Already migrated** |
| Status-history distribution in user dialog | `137abf6f`; `UserDialogStatusDistributionTab.vue` | no current dialog view; `feedRepository.queryFeedUserHistory()` already supports `Status` rows | **Simple query/UI port** |
| Historical-Bio quick search | `a94824c2`; legacy `quickSearchWorker.js` and local Feed query | current search has remote Bio search, but no local historical-Bio result path | **Simple candidate; deferred** |
| Selected-friend automatic follow | `4a38a56f`; `autoFollow.js` / `AutoFollowDialog.vue` | no direct equivalent | **Requires product/safety investigation** |
| Feed image drag/drop to Gallery | `055c55b5`; Feed/Gallery UI | no direct equivalent identified | **UI candidate; deferred** |
| Jirai developer-group auto-join | `a77c6cf6`, configurable in `6ef9f690` | current group join API exists | **Do not port without opt-in product decision** |
| Friend log/status/notification history | legacy database services | current owner-scoped realtime Feed, Friend Log, and notification pipeline are broader | **Already covered; no port** |
| Avatar local history | legacy `avatarFavorites.js` | current owner-aware avatar repository exists | **Already covered; do not copy legacy global-cache deletion** |
| Tracked non-friends | `f66d455c`, `trackedNonFriends` service/store/UI | no equivalent; requires persistence, scheduler and profile requests | **Complex report** |
| Manual relations and graph overlay | `manualRelations.js`, `ManualRelationsDialog.vue` | current mutual-graph snapshot is read-only observed data, but has no manual-edge domain | **Complex report** |
| Relationship recommendations | `929db097`, `a95836c3`, `392365f0` | no equivalent; uses heuristic scoring over private history | **Complex report** |
| Fake GameLog record injection | `c4f1a461`, Previous Instances dialog | generic typed GameLog add command exists, but no provenance model | **Complex report** |
| Profile completion / bulk historical recording | `infoFetchCoordinator.js`, `ProfileCompletionDialog.vue` | current Feed exists, but no equivalent bulk background scan | **Complex report** |
| Concurrent multi-account V4 | `733dab99`, `accountHub.js`, `accountSession.js`, design doc | saved-account switching exists; runtime is deliberately single active session | **Complex report / no direct port** |
| Default visibility, table style, glass styling | small legacy commits | upstream preference/visual behavior | **Document only** |

## Guardrails derived from the comparison

- A current user owns all historical/social data. New features must not revive
  legacy global `dbVars` mutation or cross-account data leakage.
- Observed Feed, GameLog and mutual-graph data remain immutable evidence.
  User declarations and derived recommendations must be modeled separately.
- Existing public repositories and typed Tauri commands are the integration
  boundary. Direct SQL from the frontend and custom replacement Feed commands
  are prohibited.
- The legacy multi-account design is not a specification: its implementation
  has incomplete/unsafe seams (for example, its aggregate view references hub
  properties the hub does not expose).
- Automatic joining, following, synthetic records, and bulk API scans have
  side effects or privacy consequences; they require an explicit later
  product decision.

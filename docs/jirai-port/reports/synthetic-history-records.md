# Investigation: synthetic GameLog/history records

## Legacy behavior

The legacy Previous Instances dialog injects short synthetic
`OnPlayerJoined`/`OnPlayerLeft` entries to make a record appear in history.
Evidence: legacy commit `c4f1a461` and
`PreviousInstancesInfoDialog.vue`. Current VRCX-0 has a generic typed
`appGameLogEntriesAdd` command, but its normal use attaches records to the
current owner and treats them as ordinary GameLog data.

## Data integrity problem

Using the generic command for UI-created records would make fabricated data
indistinguishable from VRChat/log observations. It could silently affect
instance history, relationship charts, future recommendations, exports, and
user trust.

## Proposed migration design

- Do not expose the generic write command directly to a Jirai UI.
- If approved, introduce a dedicated command and schema contract with
  `provenance = manual_synthetic`, author time, optional reason, and explicit
  pair/instance fields. It must validate that only the active owner can create
  or delete it.
- Queries must intentionally choose whether synthetic rows are included;
  default analytical and inference paths should exclude them or show a clear
  filter/badge.
- Require a confirmation dialog, visible badge, edit/delete action, audit
  timestamp, export labeling and backup/cleanup behavior.

## Required tests

Cover command authorization, provenance persistence, owner isolation,
delete/restore, query inclusion flags, chart/inference exclusion, import/export
labels and UI confirmation/error states.

## Recommendation

**Do not implement now.** It requires an integrity contract before any UI port.

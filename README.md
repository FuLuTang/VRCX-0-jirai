<div align="center">

# <img src="images/VRCX-0.png" alt="VRCX-0 Logo" width="25"> VRCX-0

### The fast, lightweight VRCX.

English | [Français](README.fr-FR.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-Hant.md) | [日本語](README.ja-JP.md) | [한국어](README.ko-KR.md)

[![Release](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/Map1en/VRCX-0/badge-data/version.json&style=flat&color=4c566a&labelColor=1f2328&logo=github&logoColor=white)](https://github.com/Map1en/VRCX-0/releases/latest)
[![Downloads](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/Map1en/VRCX-0/badge-data/downloads.json&style=flat&color=4c566a&labelColor=1f2328)](https://github.com/Map1en/VRCX-0/releases)
[![Windows installer size](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/Map1en/VRCX-0/badge-data/windows-installer-size.json&style=flat&label=installer&color=4c566a&labelColor=1f2328&logo=data%3Aimage%2Fsvg%2Bxml%3Bbase64%2CPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2ZmZiI%2BPHBhdGggZD0iTTIuNCAyLjRoOC41djguNUgyLjR6TTEzLjEgMi40SDIxLjZ2OC41aC04LjV6TTIuNCAxMy4xaDguNVYyMS42SDIuNHpNMTMuMSAxMy4xSDIxLjZWMjEuNmgtOC41eiIvPjwvc3ZnPg%3D%3D)](https://github.com/Map1en/VRCX-0/releases/latest)
[![Discord](https://img.shields.io/discord/1494343220467994644?style=flat&logo=discord&logoColor=white&label=discord&color=5865f2&labelColor=1f2328)](https://discord.gg/fehKP3SVPN)
<br>
[![CI](https://img.shields.io/github/actions/workflow/status/Map1en/VRCX-0/ci.yml?branch=master&label=ci&style=flat&labelColor=1f2328)](https://github.com/Map1en/VRCX-0/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/Map1en/VRCX-0/badge-data/coverage.json&style=flat&color=4c566a&labelColor=1f2328)](https://github.com/Map1en/VRCX-0/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-GPL--3.0-4c566a?style=flat&labelColor=1f2328)](LICENSE)

[![Download](https://img.shields.io/badge/Download%20VRCX--0-4340a2?style=for-the-badge)](https://github.com/Map1en/VRCX-0/releases/latest)

Windows · macOS · Linux

![VRCX-0](images/screenshot-user-dialog.webp)

</div>

A desktop companion for VRChat: see where your friends are, keep a history of the people you've met and the worlds you've visited, manage your favorites, and more.

VRCX-0 is a ground-up rewrite of VRCX by one of its former maintainers. Rebuilt in Rust, it's faster and lighter, and years of history stay smooth.

## Highlights

- **Years of history stay smooth** — data that makes VRCX sluggish runs
  smoothly in VRCX-0, even on low-end PCs and home servers
- **About 50%–70% less memory than VRCX**
- **Background mode needs just tens of MB of memory**, with all core features
  still running
- **Smaller than a single avatar bundle** — just over 10 MB to download, just
  over 30 MB installed; less than a tenth the size of VRCX
- **Seamless migration** — imports your VRCX database and settings
  automatically; VRCX's own database is never modified, so you can switch back
  at any time

### Only in VRCX-0

- **Social AI** — insights into your VRChat social life: who you play with
  most, who you're drifting away from, when friends are most likely online;
  just connect the AI service you already use
- **Sidebar Mode** — keep an eye on friends from a narrow sidebar; docks to the
  screen edge and auto-hides on Windows and macOS
- **Keyboard shortcuts** — common actions without the mouse; global hotkey on
  Windows
- **Lock** — lock the interface with a code to protect your privacy
- **Sharing** — share links for world collections, worlds, avatars, and
  instances

### For advanced users

- **MCP server** — let external AI tools use your local social data directly
- **Integration API** — real-time in-game data for third-party apps
- **Headless mode** — run without a UI; see `crates/headless`

### Compared with VRCX

| Feature               | VRCX                                                                   | VRCX-0 (+ = added)                                                            |
| --------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **Social automation** | Switch status when alone or with others; auto-reply to invite requests | + Schedules, multiple context rules with priorities, previous status restored |
| **Notifications**     | Desktop, TTS, XSOverlay, OVR Toolkit, wrist overlay                    | + Discord webhooks, Do Not Disturb; per-event filtering on every channel      |
| **VR overlay**        | Browser-rendered (100 MB+); OpenVR                                     | + Native rendering (tens of MB); OpenXR (**tested with WiVRn**)               |
| Screenshots           | View and search metadata                                               | + Grid view, batch management, ZIP export                                     |
| Avatar details        | Performance rank and file size                                         | + Full performance stats against each platform's limits                       |
| Backup                | VRChat registry settings                                               | + Scheduled database backups, one-click restore                               |
| Friend locations      | Group friends by instance                                              | + Worlds view                                                                 |
| Group management      | Set visibility one group at a time                                     | + Batch leave and batch visibility; group roles in the player list            |
| Themes                | Built-in themes, custom CSS file                                       | + Community themes, background image, in-app CSS editor, accent color         |
| Game log              | All accounts mixed together                                            | Stored per account                                                            |

Everything else VRCX does, VRCX-0 does too.

## VRCX-jirai feature restoration checklist

VRCX-0-jirai is gradually restoring and rewriting selected features from the
older VRCX-jirai fork. **Restoration is incomplete.** The old README itself says
that VRCX-jirai is no longer maintained; this checklist records current code,
not full parity or a promise that every old behavior will be brought back. It
also checks FuLuTang's feature commits in the old repository (through
`c8b8f744`), not just the README feature list.

Status labels: **[Restored/rewritten]**, **[Partially implemented]**,
**[Not implemented/missing]**, **[Behavior/UI differs]**, and
**[Needs verification]**. Status describes the current VRCX-0-jirai code and
does not promise complete parity with VRCX-jirai.

For remaining work, source references, and in-app validation steps, see [docs/jirai-feature-backlog.md](docs/jirai-feature-backlog.md).

Reviewed on 2026-10-02 against `562486290` and earlier subagent deliveries. Priorities: finish profile capture/non-friend history and real progress, then two-person details and status charts. Search improvements are deferred by user choice. See [the implementation order](docs/jirai-port/后续迁移计划.md) and [in-app validation checklist](docs/jirai-port/待手测清单.md).

Note: **Auto-join developer group** defaults to on. When My Groups loads after preferences are ready, an account that has not joined the VRCX-jirai group will attempt to join; disable it in Advanced Settings if unwanted.

Verification history: an earlier revision passed bindings generation, Rust checks/focused tests, and the full frontend suite on 2026-09-30. **Post-merge verification on 2026-10-02 is separate:** typecheck, 76 focused frontend tests, Rust formatting, and the Vite production bundle passed. The full frontend suite ran out of memory; Rust tests and complete Rust license metadata were blocked by the local proxy/dependency cache. In-app, real-database migration, and standalone release-package checks remain pending.

### Core features

| VRCX-jirai README item                       | Current VRCX-0-jirai status and evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Two-person shared-instance history           | **[Partially implemented]** Select two current friends, find recorded overlaps, identify arrivals within three minutes, check whether your own recorded session overlaps, and open the instance owner. The old README's maximum-room-population value is absent. **[Behavior/UI differs]** FuLuTang's `929db097` added a local-snapshot/non-friend guard so simultaneous observations are shown as unknown rather than asserted as a planned rendezvous; current code labels arrivals within three minutes as mutual without that guard. Evidence: `src/features/charts/TwoPersonRelationshipPageImpl.tsx` (initiator calculation).                                              |
| Mutual-friend graph | **[Restored/rewritten; needs in-app verification]** CURRENT/OLD edges, owner-scoped tracked nodes, manual relation management, and dated green/gray mutual-friend rows are implemented. Current links use ordinary colors, manual links green, and OLD-only links faded ordinary colors in both themes; overlap precedence is API, manual, then OLD. Successful non-friend detail fetches also archive OLD; failures/opt-out do not advance confirmation dates. API rows survive OLD-read errors. Manual relations currently use the `friend` type. Evidence: `src/features/charts/MutualFriendsPageImpl.tsx`, `src/lib/mutual-friends/mutualFriendsSigmaGraph.ts`, `crates/application/src/social/mutual_graph_fetch/request.rs`, and `crates/persistence/src/mutual_graph.rs`. Automatic profile capture is tracked separately below. |
| Bio Diff                                     | **[Restored/rewritten]** Git-style line differences and history selection remain integrated into the existing profile Bio panel. Consecutive edits no more than 24 hours apart are grouped; the panel compares the group's first previous Bio with its latest Bio and selects history by group, rather than showing each edit as a separate entry. Evidence: `src/components/dialogs/user-dialog/components/UserDialogInfoTab.tsx`, `src/components/dialogs/user-dialog/bioHistory.ts`, and `crates/application/src/social/profile_bio/mod.rs`.                                                                                                                                  |
| Possible-friend relationship recommendations | **[Not implemented/missing]** FuLuTang's `392365f0`, `929db097`, `a95836c3`, and `c4f1a461` add a local co-presence scoring/recommendation engine, a confirm-or-ignore prompt when a suggested pair meets in a room, and an option to add a synthetic visit to previous-instance history. Current co-presence aggregates describe observed companions; they do not infer friendship, prompt for confirmation, or inject synthetic game-log rows.                                                                                                                                                                                                                                 |
| Relationship timeline                        | **[Restored/rewritten]** The session and per-time-bucket ranking algorithm is rebuilt from saved GPS/offline Feed sessions, with “others”, current-friends filter, and zoom. **[Behavior/UI differs]** The user's specified old behavior was to debounce the database query until one second after slider changes stop. The current one-second delay postpones only client-side chart recalculation; database history is queried once on load/refresh. Range is limited to recorded history. Algorithm tests do not establish full visual parity. Evidence: `src/features/charts/relationshipHistory.ts`, its tests, and `src/features/charts/RelationshipTimelinePageImpl.tsx`. |
| Online-only status-color distribution chart  | **[Partially implemented]** An on-demand status-duration panel is now available in user profiles. It counts only intersections of recorded Online/Offline and status intervals, excluding unknown time. This is a duration list, not VRCX-jirai's proportional color chart; full self-history tracking and visual validation with sparse data remain open. Evidence: `src/components/dialogs/user-dialog/components/UserDialogInfoTab.tsx`, `statusDistribution.ts`, and tests.                                                                                                                                                                                                  |
| Tracking non-friends in Feed | **[Partially implemented]** Owner-scoped lists, profile menus, sidebar management, and the manual workflow exist; `profileFetchExecutor` can persist non-friend Bio/valid status changes. Automatic triggers and periodic refresh are missing; gradual Bio scans still select friends only. List refresh and profile archival request the same non-friends twice within a workflow and need consolidation. Evidence: `src/state/trackedNonfriendsStore.ts`, `src/features/workflows/trackedNonfriendsRefreshExecutor.ts`, `profileFetchExecutor.ts`, and `crates/application/src/social/profile_bio/mod.rs`. |
| Multi-account login and merged view          | **[Not implemented/missing]** Account-scoped game-log storage exists, but the old simultaneous primary/secondary login, per-account switching, and merged UI are absent.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

The old README marks **Auto Follow** as unimplemented and no longer planned, so
it is excluded from required migration gaps. The commit history is more nuanced:
`4a38a56f` implemented it, then `3a5c269e` hid its entry point. This historical
implementation does not override the old README's explicit no-longer-planned
status.

### Other enhancements and behavior

| VRCX-jirai README item                                                                                 | Current VRCX-0-jirai status and evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quick Search: recent encounters/worlds, non-friend fuzzy matches, immediate search, Bio/history search | **[Behavior/UI differs; deferred]** Copilot's `e8e862da` adds recent encounters/worlds, followed by `30ba80f6`; FuLuTang's `a94824c2` adds local Bio matching and `1dc272ce` adjusts queries. The legacy DB matches only each user's latest saved Bio, not every historical version. Current recent entries are opened entities; log-backed recents/local Bio supplementation are not ported. Search work was deferred by the user on 2026-10-02. Sources: `VRCX-jirai/src/stores/quickSearch.js`, `VRCX-jirai/src/services/database/feed.js::searchBiosByContent`; current: `src/components/sidebar/quick-search/quickSearchHistory.ts`. |
| Archive all friends' Bio for Bio Diff | **[Partially implemented]** The opt-in gradual friend Bio scan checks one stale friend every 3 seconds, uses a 12-hour freshness threshold, and pauses 5 minutes when idle/throttled. A separate manual workflow archives friend/tracked-user Bio and status. Automatic full profile sweeps after startup/baseline refresh are not connected. Evidence: `crates/application/src/social/profile_bio/mod.rs`, `src/features/workflows/profileFetchExecutor.ts`, and `src/services/authenticatedRuntimeService.ts`. |
| Bio/status snapshots when opening a profile | **[Partially implemented]** Current Profile Bio observation handles current friends only; non-friend Bio/valid-status snapshots on profile view are not connected. The manual workflow is a separate behavior. Evidence: `crates/runtime-host-desktop/src/profile_bio.rs` and `crates/application/src/social/profile_bio/mod.rs::observe_profile_response`; legacy references are in backlog item 9. |
| Self-history: location, avatar, status, online/offline | **[Partially implemented]** Self-profile/game activity persistence and the Activity page heatmap's `isSelf` query exist. The player-profile activity path needs verification for self data; unified location/avatar/Bio/status/online-offline history details remain missing. Evidence: `crates/application-realtime/src/realtime/current_user/self_profile.rs`, `src/features/activity/useActivityHeatmap.ts`, and `src/components/dialogs/user-dialog/useUserActivityPanelController.ts`. |
| Startup/reconnect full backfill | **[Partially implemented]** Completed friend baselines automatically trigger missing-Online backfill. The full profile workflow starts from its Run button; the legacy startup/refresh full-profile sweep is not connected. Evidence: `src/main.ts`, `src/services/authenticatedRuntimeService.ts`, and `src/features/workflows/SyncWorkflowDialog.tsx`. |
| Restore friend room-duration timer after restart                                                       | **[Needs verification]** VRCX-0 has game-log-derived timer inputs and unit coverage, but no end-to-end application-restart test was found proving the old join timestamp is restored in the running UI. Evidence: `crates/application-core/src/instance_dwell.rs` and `crates/application-game/src/game_log/processor.rs`.                                                                                                                                                                                                                                                                                                                                                                                             |
| Add a synthetic visit from Previous Instances                                                          | **[Not implemented/missing]** Commit `c4f1a461` adds a control that inserts a five-second joined/left pair for a selected user at the current instance's recorded join time. No equivalent manual/synthetic game-log entry action was found in VRCX-0-jirai.                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Drag files from Friend Feed into Gallery upload categories                                             | **[Partially implemented; manual validation pending]** Friend Feed now has categorized drop targets connected to Gallery asset uploads. Frontend tests cover routing and upload actions; real files, categories, and failure feedback still need in-app validation. Evidence: `src/features/feed/components/FeedImageDropOverlay.tsx`, `src/features/tools/useGalleryAssetActions.ts`, and tests.                                                                                                                                                                                                                                                                                                                      |
| Status-fetch progress indicator | **[Partially implemented]** Friend-loading/graph-fetch status and workflow action states exist. Workflow totals count actions, not processed users. Profile-executor target/change/failure/incomplete counts are not retained in the runner snapshot or displayed; per-user progress and status-bar Bio/Status results remain to connect. Evidence: `src/features/workflows/syncWorkflow.ts`, `SyncWorkflowDialog.tsx`, `profileFetchExecutor.ts`, and `src/components/layout/status-bar/StatusBarFooter.tsx`. |
| Keep synchronizing with VRCX | **[Current VRCX-0 baseline merged]** `562486290` merges `VRCX-0/master` at `abbdc241c` with Jirai graph/history/profile adaptations. Future updates still require merging and verification; this is not automatic synchronization. |
| Navigation reset hint for newly added features                                                         | **[Behavior/UI differs]** VRCX-0 still has a custom-navigation “Restore Default” action, while the relationship pages are registered through its route/dashboard model. Whether restoring defaults exposes these pages in every saved navigation layout has not been tested. Evidence: `src/components/layout/CustomNavDialog.tsx`, `src/app/routes.tsx`, and dashboard registry.                                                                                                                                                                                                                                                                                                                                      |
| Developer schema/refresh docs                                                                          | **[Behavior/UI differs]** The current repo has a mutual-graph schema diagram at `docs/mutual-graph-schema.svg`; the old README's general `DATABASE_SCHEMA.md` and `DATA_REFRESH.md` guides have no direct equivalents.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

### Legacy constraints and side effects

| Old README note                                                                | Current VRCX-0-jirai status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Automatically join the VRCX-jirai Home Group to notify people about the fork   | **[Partially implemented; behavior differs]** When My Groups loads, VRCX-0-jirai checks the same group ID used by VRCX-jirai and attempts to join if preferences have loaded, the user is not a member, and the switch is on. The user chose to keep the switch on by default; it can be disabled in Advanced Settings. This is not an independent startup/auth background flow. Evidence: `src/features/my-groups/useMyGroupsPageState.ts`, `src/state/preferencesStore.ts`, and `src/features/settings/components/settings-tabs/SettingsAdvancedTab.tsx`. |
| Yellow/red status can disable core features                                    | **[Needs verification]** Current data remains subject to VRChat visibility/API restrictions, but the exact old “yellow/red disables core features” behavior has not been tested across these restored views. Private/redacted locations are explicitly treated as unavailable, not inferred. Evidence: `crates/mcp/src/tools/feed.rs`.                                                                                                                                                                                                                      |
| All collected information is public / no inaccessible information is collected | **[Needs verification]** This broad old-fork assurance is not carried forward: VRCX-0-jirai uses authenticated VRChat endpoints and locally observed game logs, and each surface has its own visibility limits. Do not interpret the old disclaimer as proof of current data scope.                                                                                                                                                                                                                                                                         |

The historical README's statements about upstream disagreement and community
sentiment are not software features and are not reproduced here.

## Install

Grab the file for your platform from the [latest release](https://github.com/Map1en/VRCX-0/releases/latest):

| Platform              | File                                        |
| --------------------- | ------------------------------------------- |
| Windows               | `VRCX-0_<version>_windows_x86_64_setup.exe` |
| macOS (Apple Silicon) | `VRCX-0_<version>_macos_aarch64.dmg`        |
| macOS (Intel)         | `VRCX-0_<version>_macos_x86_64.dmg`         |
| Linux                 | `.AppImage`, `.deb`, or `.rpm`              |

On macOS, if the first launch is blocked, open **System Settings → Privacy &
Security** and click **Open Anyway**.

### Linux

Hardware acceleration for the app interface is off by default. Turn it on under
**Settings → System → Hardware acceleration (experimental)**; if the interface
doesn't display properly, VRCX-0 turns it back off automatically. Setting
`WEBKIT_DISABLE_DMABUF_RENDERER` yourself hides this option.

## Feedback

- Questions and chat: [Discord](https://discord.gg/fehKP3SVPN)
- Bug reports and feature requests: [GitHub Issues](https://github.com/Map1en/VRCX-0/issues)

## Building from source

Use these steps to contribute or build VRCX-0 locally. Before contributing, see [CONTRIBUTING.md](CONTRIBUTING.md).

Requirements: Node.js ≥ 24.10, npm ≥ 11.5, and a stable Rust toolchain via rustup.
On Windows, also install **Visual Studio Build Tools** with the **Desktop development with C++** workload. From regular PowerShell, load the Visual Studio development environment first:

```powershell
$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$vsPath = & $vswhere -latest -products Microsoft.VisualStudio.Product.BuildTools -version '[17.0,18.0)' -property installationPath
& "$vsPath\Common7\Tools\Launch-VsDevShell.ps1" -Arch amd64 -HostArch amd64
```

Then run `npm run tauri:dev`.

```bash
git clone https://github.com/Map1en/VRCX-0
cd VRCX-0

npm install
```

Start the dev server:

```bash
npm run tauri:dev
```

Build for release (skip code signing and installer):

```bash
npm run tauri:build -- --no-sign --no-bundle
```

## License

VRCX-0 is licensed under the GNU General Public License v3.0 (GPLv3).

[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2FMap1en%2FVRCX-0.svg?type=shield)](https://app.fossa.com/projects/git%2Bgithub.com%2FMap1en%2FVRCX-0?ref=badge_large)

VRCX-0 is not endorsed by VRChat Inc. VRChat and all associated properties are
trademarks or registered trademarks of VRChat Inc.

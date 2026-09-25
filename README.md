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

### Core features

| VRCX-jirai README item | Current VRCX-0-jirai status and evidence |
| --- | --- |
| Two-person shared-instance history | **[Partially implemented]** Select two current friends, find recorded overlaps, identify arrivals within three minutes, check whether your own recorded session overlaps, and open the instance owner. The old README's maximum-room-population value is absent. **[Behavior/UI differs]** FuLuTang's `929db097` added a local-snapshot/non-friend guard so simultaneous observations are shown as unknown rather than asserted as a planned rendezvous; current code labels arrivals within three minutes as mutual without that guard. Evidence: `src/features/charts/TwoPersonRelationshipPageImpl.tsx` (initiator calculation). |
| Mutual-friend graph | **[Partially implemented]** The graph reads legacy `_mutual_graph_links_old` edges as historical links and now supports owner-scoped tracked non-friend users and manual friend links, with management controls. API-fetched, manual, and legacy links use distinct visual treatments. Manual relations currently have the single `friend` type; tracked graph nodes do not yet receive non-friend Bio/status Feed capture. Evidence: `src/features/charts/MutualFriendsPageImpl.tsx`, `useMutualFriendsPageState.ts`, `MutualFriendsRelationsManager.tsx`, `crates/persistence/src/mutual_graph.rs`, and `src-tauri/src/commands/local/mutual_graph.rs`. |
| Bio Diff | **[Restored/rewritten]** Git-style line differences and history selection remain integrated into the existing profile Bio panel. Consecutive edits no more than 24 hours apart are grouped; the panel compares the group's first previous Bio with its latest Bio and selects history by group, rather than showing each edit as a separate entry. Evidence: `src/components/dialogs/user-dialog/components/UserDialogInfoTab.tsx`, `src/components/dialogs/user-dialog/bioHistory.ts`, and `crates/application/src/social/profile_bio/mod.rs`. |
| Possible-friend relationship recommendations | **[Not implemented/missing]** FuLuTang's `392365f0`, `929db097`, `a95836c3`, and `c4f1a461` add a local co-presence scoring/recommendation engine, a confirm-or-ignore prompt when a suggested pair meets in a room, and an option to add a synthetic visit to previous-instance history. Current co-presence aggregates describe observed companions; they do not infer friendship, prompt for confirmation, or inject synthetic game-log rows. |
| Relationship timeline | **[Restored/rewritten]** The session and per-time-bucket ranking algorithm is rebuilt from saved GPS/offline Feed sessions, with “others”, current-friends filter, and zoom. **[Behavior/UI differs]** The user's specified old behavior was to debounce the database query until one second after slider changes stop. The current one-second delay postpones only client-side chart recalculation; database history is queried once on load/refresh. Range is limited to recorded history. Algorithm tests do not establish full visual parity. Evidence: `src/features/charts/relationshipHistory.ts`, its tests, and `src/features/charts/RelationshipTimelinePageImpl.tsx`. |
| Online-only status-color distribution chart | **[Not implemented/missing]** FuLuTang's `137abf6f` and `cf942bd0` implement a duration-based per-user chart, exclude offline time, and add self tracking. No equivalent profile/self status-share chart or offline-intersection algorithm was found in current VRCX-0-jirai. |
| Tracking non-friends in Feed | **[Not implemented/missing]** FuLuTang's `7009ebae` and `94f8e872` extend tracking and Bio/status synchronization to non-friends; the old UI allowed adding by UID or from a profile. VRCX-0-jirai now supports tracking non-friend graph nodes for relationship-graph collection, but its Bio scanner and Feed capture remain restricted to current friends; this is not equivalent to the old non-friend Bio/status history workflow. Evidence: `crates/application/src/social/profile_bio/mod.rs`, `src/features/charts/MutualFriendsRelationsManager.tsx`, and `crates/persistence/src/mutual_graph.rs`. |
| Multi-account login and merged view | **[Not implemented/missing]** Account-scoped game-log storage exists, but the old simultaneous primary/secondary login, per-account switching, and merged UI are absent. |

The old README marks **Auto Follow** as unimplemented and no longer planned, so
it is excluded from required migration gaps. The commit history is more nuanced:
`4a38a56f` implemented it, then `3a5c269e` hid its entry point. This historical
implementation does not override the old README's explicit no-longer-planned
status.

### Other enhancements and behavior

| VRCX-jirai README item | Current VRCX-0-jirai status and evidence |
| --- | --- |
| Quick Search: recent encounters/worlds, non-friend fuzzy matches, immediate search, Bio/history search | **[Behavior/UI differs]** FuLuTang's `30c2f208`, `bda7ddad`, `a94824c2`, and `1dc272ce` add recent people/worlds, one-character/shortcut behavior, historical Bio lookup, and query cleanup. Current code trims queries and searches from one character, but its recent list is the last five opened entities, not recent encounters/worlds; it searches friend name/memo/note, not recent non-friend co-presence or historical Bio. The separate Search page's Bio search uses the current VRChat endpoint. Evidence: `src/components/sidebar/quick-search/quickSearchHistory.ts`, `quickSearchResultModel.ts`, `crates/application/src/social/quick_search_catalog.rs`, and `src/features/search/searchRequests.ts`. |
| Archive all friends' Bio for Bio Diff | **[Partially implemented]** An optional paced background scanner records current friends' Bio; it scans stale friends incrementally (12-hour freshness threshold), rather than the old one-shot full batch. Evidence: `crates/application/src/social/profile_bio/mod.rs` and `crates/composition/src/state/background_ticks/profile_bio.rs`. |
| Self-history: location, avatar, status, online/offline | **[Partially implemented]** Current-user game locations, avatar history, and status/Bio changes have persistence paths. A user-facing history covering all these records together was not found. Evidence: `crates/application-realtime/src/realtime/current_user/`, `crates/persistence/src/realtime/schema.rs`, and `crates/persistence/src/game_log/`. |
| Startup/reconnect full backfill | **[Behavior/UI differs]** Startup and reconnect synchronize current friend/profile snapshots and can record newly observed changes; this does not establish recovery of every event missed while the app was offline. The old README's full-history backfill claim is not reproduced. Evidence: `crates/application-realtime/src/realtime/service/host/baseline.rs`. |
| Restore friend room-duration timer after restart | **[Needs verification]** VRCX-0 has game-log-derived timer inputs and unit coverage, but no end-to-end application-restart test was found proving the old join timestamp is restored in the running UI. Evidence: `crates/application-core/src/instance_dwell.rs` and `crates/application-game/src/game_log/processor.rs`. |
| Add a synthetic visit from Previous Instances | **[Not implemented/missing]** Commit `c4f1a461` adds a control that inserts a five-second joined/left pair for a selected user at the current instance's recorded join time. No equivalent manual/synthetic game-log entry action was found in VRCX-0-jirai. |
| Drag files from Friend Feed into Gallery upload categories | **[Not implemented/missing]** Commits `055c55b5` and `de063998` add a multi-zone overlay that routes a dropped file from Friend Feed to Gallery asset tabs. VRCX-0-jirai accepts dropped screenshots in Screenshot Metadata, but that is not the Feed-to-Gallery categorized upload workflow. Evidence: `src/features/tools/ScreenshotMetadataPage.tsx`. |
| Status-fetch progress indicator | **[Partially implemented]** FuLuTang's `0c2f6361` adds a status-bar indicator for profile/privacy-data synchronization. VRCX-0-jirai has status-bar progress for friend-profile bulk loading and mutual-graph fetching, but the old startup/reconnect Bio+privacy refresh workflow is not reproduced. Evidence: `src/components/layout/status-bar/StatusBarFooter.tsx`, `src/components/layout/AppStatusBar.tsx`, and `crates/application-realtime/src/realtime/service/host/baseline.rs`. |
| Keep synchronizing with VRCX | **[Behavior/UI differs]** This branch contains explicit VRCX-0 v2.29/v2.30 and current-master port commits; future updates require another manual port and are not automatic. Evidence: merge commits `ac016078`, `d97b115e`, and `0d566dac`. |
| Navigation reset hint for newly added features | **[Behavior/UI differs]** VRCX-0 still has a custom-navigation “Restore Default” action, while the relationship pages are registered through its route/dashboard model. Whether restoring defaults exposes these pages in every saved navigation layout has not been tested. Evidence: `src/components/layout/CustomNavDialog.tsx`, `src/app/routes.tsx`, and dashboard registry. |
| Developer schema/refresh docs | **[Behavior/UI differs]** The current repo has a mutual-graph schema diagram at `docs/mutual-graph-schema.svg`; the old README's general `DATABASE_SCHEMA.md` and `DATA_REFRESH.md` guides have no direct equivalents. |

### Legacy constraints and side effects

| Old README note | Current VRCX-0-jirai status |
| --- | --- |
| Automatically join the VRCX-jirai Home Group to notify people about the fork | **[Not implemented/missing]** No automatic Home Group join in startup/auth flows was found; current group joining is an explicit user action. Evidence: `src/components/dialogs/group-dialog/GroupDialogHeaderSection.tsx`. |
| Yellow/red status can disable core features | **[Needs verification]** Current data remains subject to VRChat visibility/API restrictions, but the exact old “yellow/red disables core features” behavior has not been tested across these restored views. Private/redacted locations are explicitly treated as unavailable, not inferred. Evidence: `crates/mcp/src/tools/feed.rs`. |
| All collected information is public / no inaccessible information is collected | **[Needs verification]** This broad old-fork assurance is not carried forward: VRCX-0-jirai uses authenticated VRChat endpoints and locally observed game logs, and each surface has its own visibility limits. Do not interpret the old disclaimer as proof of current data scope. |

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

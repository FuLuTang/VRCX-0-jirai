# MIMI #7「自动跟随好友」7.0 spike 报告

> 编写：子代理 spike-7，2026-11-18（UTC）。调研期间只读：只用了 `git show`、读文件和 grep，没有修改任何文件。
> VRCX-0 侧代码在 `/home/fulutang/Documents/Github/VRCX-0-jirai-MIMI`。调研时 HEAD 是 `cbe18191e`，只比 `ea3142a47` 多一个报告提交，代码基线与 `ea3142a47` 相同。
> jirai 侧代码一律来自 `c7eaf00e`。
> 末尾「lead 裁决」一节是 lead 收到报告后的决定。

## 结论速览

| 题 | 结论 |
|---|---|
| 1 接缝 | 用 `FriendProjectionObserver`（`DesktopRuntimeServices::on_friend_projection`）。它覆盖 WS、资料拉取、基线刷新、重连等所有路径，并带 user_id、displayName、地点。`observe_friend` 漏掉基线路径，而且对 traveling 的语义与 jirai 不一致。「我当前位置」取 `RuntimeSnapshot.location`（游戏日志快照），语义与 jirai 的 `lastLocation.location` 一致 |
| 2 布局 | 不需要新的端口 trait。状态机是纯同步逻辑，放 `application-realtime/src/auto_follow.rs`。胶水代码放 `runtime-host-desktop/src/context.rs`，复用已有观察者。命令新建 `src-tauri/src/commands/application/auto_follow.rs`，退出游戏命令追加到 `commands/host/game.rs`。全部登记在 `bindings_export.rs` 的 `collect_commands!`，它同时就是 invoke handler |
| 3 事件 | 链路是 `RuntimeEventBus.emit` → `TauriRuntimeEventSink` → `window.emit`。新增事件只要：一个 payload 结构加 `impl RuntimeEventPayload`，再在 `BackendRuntimeEventPayloadMap` 加一个字段。前端在新 Host 里用 `subscribeRuntimeEvent` 订阅，不碰 `main.ts` |
| 4 isGameNoVR | **不同义。** 前端 `runtimeStore` 的值默认 false，启动时不从 config 读，只在游戏日志发出 NoVR 事件时更新。Rust config 键 `isGameNoVR` 才等价于 jirai 的持久化值。建议由 Rust 读 config 判断走哪个分支 |
| 5 退出游戏 | `quit_game` 只在恰好 1 个 `VRChat.exe` 进程时结束它，这一点与 jirai 一致；返回值不同，jirai 返回找到的进程数，VRCX-0 返回 0/1，但 jirai 的跟随逻辑不看返回值。在 `commands/host/game.rs` 追加 `app__quit_game` 即可 |
| 6 收藏/在线 | 收藏取 `useFavoriteStore` 的 `favoriteFriendIds`、`localFriendFavorites`、`groupedFavoriteFriendIdsByGroupKey`。在线取 `useFriendRosterStore` 的 `onlineIds` 加 `friendsById[id].$presence`。状态字段是 `friendsById[id].status`，取值 `'join me'` / `'active'` |
| 7 launch | VRCX-0 的 `launchVrchat` 和 `attachRunningVrchat` 都**没有** 1 秒防重入；jirai 的 `tryOpenInstanceInVrc` 有。需要在新 service 里补一个 |
| 8 jirai | 逻辑约 60 行；文案原文见第 8 节。jirai 的侧栏入口按钮本身就被注释掉了，与「入口隐藏」决定一致 |

---

## 1. 好友位置变化的接缝

### 三个候选的覆盖范围

| 候选 | 能拿到 user_id + location? | 覆盖哪些来源 | 问题 |
|---|---|---|---|
| `instance_dwell.rs:276` `observe_friend` | 能，类型是 `FriendPlace` | 只有单条事件经 `commit()` 时调用（`friends/runtime/apply.rs:278-283`） | ① 基线 / 轮询刷新走的是 `sync_friends`（`friends/runtime/state.rs:332`），不经过 `observe_friend`，会**漏掉**。② `dwell_place` 把 Traveling 映射成**目的地**（`presence/view.rs:25-28`），而 jirai 里 traveling 时 `ref.location==='traveling'` 不触发，到达后才触发；用这个接缝会提前触发，语义偏离。③ 拿不到 displayName。④ 调用时还持有 friends state 锁 |
| `presence/view.rs`（`dwell_place` / `presence_view`） | 只是纯函数 | 不是接缝 | — |
| `friends/runtime/state.rs:263` | 只是基线里新条目的 `location_history_candidates` | 只覆盖基线中的新条目 | 不是接缝 |
| **推荐：`FriendProjectionSink` / `FriendProjectionObserver`**（`realtime/projection.rs:41-66`） | 能。`FriendProjectionPatch{user_id, record, presence}`（`projection_types.rs:17-21`）里，`record.display_name` 来自 `core/src/friends.rs:95`，`presence.view` 的 `Online{place}`、`PendingOffline{place}` 中有 `place.location.tag`（`core/src/presence.rs:80-93`） | 所有好友投影都经 `emit_friend_projection`（`service/host/fanout.rs:29-31`）。`apply_friend_output_owned` 末尾（`fanout.rs:216`）由以下路径汇入：WS 事件（`friend_events.rs:91,140`）、API 资料（`friend_profile.rs:140`，`Source::Api`）、变更（`friend_mutation.rs:133`）、feed（`friend_feed_entry.rs:34`）、**基线 / 轮询刷新**（`baseline.rs:92`，`add_roster_delta` 把 Rebuilt / Changed 展开成 patches，见 `baseline.rs:481-505`）、连接启动（`connection.rs:290`）。删好友的 user_id 在 `projection.removals` 里（`apply.rs:251`） | 观察者在 transport 之前同步调用（`projection.rs:61-66`，测试 `friend_observer_runs_before_outbound_transport`）。过期投影已被 `is_friend_projection_current` 过滤（`fanout.rs:136`） |

### 观察者已经接好，不用改 composition

- `DesktopRuntimeServices` 已实现 `FriendProjectionObserver`（`crates/runtime-host-desktop/src/context.rs:313-317`），目前只做头像预取。
- 它在 `state/assembly/mod.rs:54,59` 注入 `RuntimeHostComposition.friend_projection_observer`（`composition/src/composition.rs:19`），再进入 `FriendProjectionSink::new(..., friend_projection_observer)`（`composition/src/state/runtime_host_state.rs:495-498`）。
- 这个槽位是 `Option` 单例，所以**在现有 `on_friend_projection` 里追加一行调用**即可。不新开槽位，也不改 `context.rs:74/414`。

### 地点取值规则（与 jirai 对齐）

- 取 `presence.view`：
  - `Online` 或 `PendingOffline`：取 `place.location.tag`。traveling 时 tag 是 `"traveling"`，private 时是 `"private"`（`Place::tag`，`core/src/presence.rs:31-38`）。
  - `Active` 或 `Offline`：视为 `"offline"`。
  - 在 removals 里：视为 None。
- 只有当「目标好友的 tag 与上次记录不同」，并且新 tag 满足 `is_real_instance`（`core/src/location.rs`；jirai 的 `instance.js:6-24` 与之同语义），才进入触发判断。
- 投影里 patch 会因为 record 字段变化反复出现，状态机必须自己保存 `last_target_location`，只在值变化时触发。这对应 jirai `watch` 的「值变化才回调、非 immediate」。

### 「我当前位置」

- jirai 用 `locationStore.lastLocation.location`：
  - 游戏日志 `location` 事件时设为实例（`gameLogCoordinator.js:204`）；
  - `location-destination` 时设为 `'traveling'`（`:180`）；
  - 退出或重置时清空（`locationCoordinator.js:182`）。
- VRCX-0 的等价物是游戏日志快照 `RuntimeSnapshot.location`（`application-game/src/game_log/runtime_state.rs:36-44`）：
  - `LocationDestination` 时设为 `"traveling"`（`game_log/ingest.rs:206`）；
  - 游戏停止时 `clear()`（`ingest.rs:383`）。
- 它在 `DesktopRuntimeServices` 里直接可得：`self.game_log_snapshot.snapshot().location`（`context.rs:222-228`），不用跨 crate。
- 也有 `LocalGameContextSource`（`application-core/src/ports/local_game_context.rs:40`），但它在游戏隔离开启或日志未 ready 时返回 `Unavailable`（`game_isolation.rs:258-264`，`local_game_context.rs:20-21`）。jirai 没有隔离概念。
  - **推断**：为了与 jirai 一致，应直接用原始 `game_log_snapshot`。
  - 备选：如果希望隔离开启时不跟随，就改用 `IsolatedLocalGameContextSource`。

---

## 2. 端口 trait 位置与 crate / 模块布局

**结论：不需要新增端口 trait，既不放 contracts，也不放 runtime-event。**

- `InstanceRosterObserver`（`runtime-event/src/instance_roster.rs:19`）存在的原因是 application-game 要向 realtime 推送数据，而两者互不依赖。
- 本功能的输入（`FriendProjection`）在 application-realtime。我的位置、`isGameNoVR`、SteamVR 状态都在 `runtime-host-desktop` 手里：
  - `game_log_snapshot`，见 `context.rs:79`；
  - `config: Arc<dyn ConfigStore>`，见 `context.rs:59`；
  - `session: HostSessionRuntime`，见 `context.rs:61`，`HostSessionSnapshot.is_steamvr_running` 在 `application-core/src/ports/session.rs:229`。
- 而 `runtime-host-desktop` 同时依赖 application-game 和 application-realtime（`Cargo.toml:36-37`）。所以由它做胶水，把普通值传给纯状态机即可。

推荐布局：

| 层 | 位置 | 内容 |
|---|---|---|
| 状态机（纯同步、可单测） | 新文件 `crates/application-realtime/src/auto_follow.rs`，并在 `lib.rs` 追加 `mod auto_follow; pub use auto_follow::{...};` | `AutoFollowRuntime { Mutex<AutoFollowState{target_user_id, target_display_name, last_location: Option<String>}> }`<br>`start(user_id, display_name, seed_location)`、`stop() -> bool`、`status() -> AutoFollowStatus`<br>`observe(&FriendProjection, self_location: &str, mode: AutoFollowMode) -> Option<AutoFollowTriggered>`<br>`AutoFollowStatus` 和 `AutoFollowTriggered` 带 `Serialize + specta::Type`，`impl vrcx_0_contracts::RuntimeEventPayload`（先例 `realtime/projection.rs:37-39`） |
| 胶水 | `crates/runtime-host-desktop/src/context.rs` | 在 `DesktopRuntimeServices` 加字段 `auto_follow: Arc<AutoFollowRuntime>`，在 `new()` 中构造（`:85-171`）<br>在 `on_friend_projection`（`:313-317`）里追加：取 `self.game_log_snapshot.snapshot().location`，用 `config.get_bool(IS_GAME_NO_VR_CONFIG_KEY,false)` 和 `session.snapshot().is_steamvr_running` 算出模式，调 `observe`，命中后 `self.event_bus.emit(triggered)`<br>加访问器 `pub fn auto_follow(&self)` |
| host 门面 | `crates/runtime-host-desktop/src/state.rs` | 在 `DesktopRuntimeHostState` 加 `auto_follow_start(user_id)`、`auto_follow_stop()`、`auto_follow_status()`。<br>`start` 用 `self.friend_snapshot()`（`state.rs:1324`）取目标的 display_name 和当前 tag 作为种子，实现「开始时不立即动作」。<br>访问路径是 `self.desktop.services`，先例 `state.rs:1810-1823` |
| Tauri 命令 | 新文件 `src-tauri/src/commands/application/auto_follow.rs`，在 `commands/application/mod.rs` 追加 `pub mod auto_follow;` | `app__auto_follow_start(user_id)`、`app__auto_follow_stop()`、`app__auto_follow_status()`<br>写法照 `#[tauri::command(async)] #[specta::specta] pub fn ...`（先例 `commands/application/lifecycle.rs:23-32`） |
| 登记 | `src-tauri/src/bindings_export.rs` 的 `collect_commands![...]`（`:139` 起） | 这同时就是 invoke handler：`app.rs:493` `.invoke_handler(bindings_export::builder().invoke_handler())`，没有第二张列表。<br>前端绑定在 pc 上用 `pnpm generate:tauri-bindings` 生成（`package.json:19` → `src-tauri/src/bin/export-bindings.rs`） |

### `src-tauri/tests/backend_architecture.rs` 的约束（白名单不扩大也能满足）

- `:651-698`：新命令**不能**写成「普通 `#[tauri::command]` + `pub fn`」，那样会进主线程白名单比对而失败。必须用 `#[tauri::command(async)]`，或者用 `pub async fn`。
- `:244-262`：src-tauri 代码里不能出现 `runtime_host().desktop` 或 `runtime_host().game`。所以要在 `DesktopRuntimeHostState` 上加方法。
- `:460-517`：application-realtime 不得依赖或引用 persistence、vrchat_client、host_desktop、tauri、rusqlite。状态机只用 std、serde、specta、contracts、core，满足要求，也**不加新依赖**。
- `:538-562`：application 公共字段如果含 `Value`，必须用 `RawJson`。本方案只有 String、bool、Option 字段，满足。
- `:332-372`：公共字段不得暴露 `DatabaseService` 或 `WebClient`。满足。
- `:389-413`、`:579-602`：contracts 和 runtime-event 只允许同步代码和窄依赖。本方案**不改这两个 crate**。
- `:765-873`：`runtime-host-desktop` 只有名单内文件能直接查 persistence。`context.rs` 用的是 `ConfigStore` trait，不是 persistence，满足。`state.rs` 本来就在名单里，新代码也不新增 persistence 查询。

---

## 3. Rust → 前端事件通道

### 现有链路

1. `RuntimeEventBus::emit<T: RuntimeEventPayload>`（`application-core/src/event_bus.rs:175-198`）：`serde_json::to_value`，事件名取 `T::EVENT_NAME`。
2. `TauriRuntimeEventSink::emit`（`src-tauri/src/bootstrap/adapters.rs:39-53`），在 `:386` 安装。
3. `emit_to_main_window_if_visible`（`adapters.rs:162-182`）：「后台运行时 + 隐藏」状态下**直接丢弃**（`:166`、`:184-191`）。
4. 前端 `tauriClient.events.subscribe(name, handler)`（`src/services/runtime-event-bridge/subscription.ts:5-10`）。
5. 前端类型 `RuntimeEventPayloadMap`（`runtime-event-bridge/types.ts:38-46`）来自 bindings 的 `BackendRuntimeEventPayloadMap`，后者由 `bindings_export.rs:47-105` 的结构体生成，并以 `.typ::<BackendRuntimeEventPayloadMap>()`（`:120`）导出。字段名经 camelCase 后必须等于 `EVENT_NAME`，例如 `realtime_friend_projection` 对应 `"realtimeFriendProjection"`（`projection_types.rs:138`）。

### 新增 `autoFollowTriggered` 的最小追加路径

1. 在 `application-realtime/src/auto_follow.rs` 定义 `AutoFollowTriggered { location, user_id, display_name, action }`（`Serialize + specta::Type`，`rename_all = "camelCase"`），`impl RuntimeEventPayload`，`EVENT_NAME = "autoFollowTriggered"`。
2. 在 `context.rs` 的 `on_friend_projection` 中命中后调用 `self.event_bus.emit(triggered)`。
3. 在 `bindings_export.rs` 的 `BackendRuntimeEventPayloadMap` 末尾追加字段 `auto_follow_triggered: AutoFollowTriggered`，并在 `use vrcx_0_application_realtime::{...}`（`:26-30`）追加导入。
4. 在 pc 上重新生成 `bindings.ts`。`types.ts` 用的是 `Omit` 加交集，会自动获得新键；我没有找到要求事件名穷举的测试，grep `Record<RuntimeEventName` 结果为空。

### 前端订阅（不碰 `main.ts`）

- 在新建的 `AutoFollowHost` 里用 `useEffect` 调 `subscribeRuntimeEvent('autoFollowTriggered', handler)`，unmount 时退订。
- 先例：`src/components/hosts/tools-dialogs/NoteExportDialog.tsx:222`、`src/services/deepLinkService.ts:38`。
- `AutoFollowHost` 挂在 `src/app/GlobalHosts.tsx`，生命周期等于整个应用。
- 不需要改 `runtimeEventBridgeService.ts` 的 `bindRuntimeEvents` 列表（`:499-563`）。

**风险**：后台运行时隐藏窗口时，事件会被 `adapters.rs:166` 丢弃，跟随动作也就不会执行。jirai 不存在这种模式。建议记为已知限制。

---

## 4. `isGameNoVR` 是否同义

**不同义。**

### 前端 `runtimeStore.gameState.isGameNoVR`

- 初始值 `false`（`src/state/runtimeStore.ts:576`）。
- 只在 `gameLogSideEffect` 事件的 `kind === 'gameNoVR'` 时更新（`runtime-event-bridge/gameRuntimeEventHandlers.ts:66-69`）。
- 这个事件来源于游戏日志 NoVR 副作用：`processor/side_effects.rs:130-137` 调 `lifecycle.rs:11-20` 的 `set_game_no_vr`，它先写 config，再 emit `GameNoVr`。
- `gameStateService.ts` 只同步 `isGameRunning` 和 `isSteamVRRunning`（`:85-94`），**启动时不从 config 回填 `isGameNoVR`**。
- 因此重启应用后，直到下一次游戏日志出现 openvr-init 或 desktop-mode 之前，这个值都是 false，与「上次是否以桌面模式启动」不一致。

### jirai

- `isGameNoVR = ref(true)`（`stores/game.js:19`），但 `init()` 立刻执行 `isGameNoVR.value = await configRepository.getBool('isGameNoVR')`（`:33`）。
- jirai 的 `getBool(key, defaultValue = null)` 在键不存在时返回 **null**（`services/config.js:74-80`）。所以键未设置时**实际效果相当于 false，即走 VR / attach 分支**，而不是「默认 true」。
- 写入点有三处：`gameLogCoordinator.js:494-500`（openvr-init 写 false，desktop-mode 写 true），以及 `gameCoordinator.js:43`（游戏退出时回写）。

### Rust config 键

- 键是 `IS_GAME_NO_VR_CONFIG_KEY = "isGameNoVR"`（`application-game/src/game_log/lifecycle.rs:9`），由同一事件写入。
- 各处读取都用 `get_bool(..., false)`：`state/background_ticks.rs:54-57`、`notification/policy.rs:34-36`、`instance_launch.rs:147`、`game_client/processor.rs:201-204`。
- 它与 jirai 持久化值语义一致；未设置时为 false，与 jirai 的 null 等效。

### 取持久化值的办法（推荐 Rust 侧）

- 在 `context.rs` 胶水中用 `self.config.get_bool(vrcx_0_application_game::IS_GAME_NO_VR_CONFIG_KEY, false)` 加 `self.session.snapshot().is_steamvr_running`，按 jirai 条件 `!isGameNoVR || isSteamVRRunning` 得到 `action=attach`，否则 `relaunchDesktop`，放进事件 payload。
- 前端只执行 action，不再自己判断。

**不推荐**前端用 `configRepository.getBool('isGameNoVR', false)`。前端 `ConfigRepository` 有内存缓存（`configRepository.ts:78-86`），Rust 的 `set_bool` 写库不会刷新它；全仓只在 `databaseUpgradeService.ts:219` 调过 `reload()`。
- **推断**：这个缓存可能是旧值。备选：前端先取 runtimeStore 的值，再在启动时用 config 回填。这样要改的地方更多，不推荐。

---

## 5. 退出游戏

### 调用链

1. `GameLogHostActions::quit_game(&self) -> i64`（trait 在 `application-game/src/game_log/host.rs:3-4`）。
2. 唯一的业务调用方是 `handle_vrc_quit`（`game_log/lifecycle.rs:23-47`，`vrcQuitFix`）。
3. 桌面实现是 `HostGameLogActions::quit_game`，即 `i64::from(game_launch::quit_game())`（`runtime-host-desktop/src/game_log.rs:43-45`）。
4. 最终落到 `vrcx_0_host_desktop::game_launch::quit_game() -> i32`（`host-desktop/src/game_launch.rs:76-93`）。

### 测试替身先例

- `NoopGameLogHostActions`（`host.rs:21-27`，返回 0）。
- `WinePathHostActions`（`game_log/screenshot/tests.rs:245-248`，返回 0）。

### 语义对比

| | jirai `GameHandler.cs:50-59` | VRCX-0 `game_launch.rs:76-93` |
|---|---|---|
| 匹配 | `GetProcessesByName("VRChat")` | sysinfo 进程名 `eq_ignore_ascii_case("VRChat.exe")` |
| 结束条件 | 仅在 `Length == 1` 时 `Kill()` | 仅在 `len == 1` 时 `kill()` |
| 返回值 | 找到的进程数（可能是 2+、0） | 结束了返回 1，否则 0 |

结束行为一致，返回值不同。jirai 的 autoFollow 是 `await AppApi.QuitGame();`，不看返回值，所以没有影响。

### 新增前端命令（只追加）

在 `src-tauri/src/commands/host/game.rs` 末尾追加 `app__quit_game() -> Result<i32, AppError>`：`#[tauri::command(async)] #[specta::specta]`，先 `require_host_capability_supported(HostCapability::GameLaunch)?`，再返回 `game_launch::quit_game()`。

- 风格与同文件 `app__start_game`（`:19-24`）一致，`game_launch` 已经导入（`:4`）。
- 能力检查用 `GameLaunch`（枚举在 `host-desktop/src/host_capabilities.rs:53-61`）。**推断**：备选是 `GameProcessMonitor`。
- 在 `bindings_export.rs` 的 `:160` 之后追加 `commands::host::game::app__quit_game,`。前端调用名会是 `commands.appQuitGame()`。

---

## 6. 前端收藏判定与在线好友字段

### 收藏

- 来源是 `useFavoriteStore`（`src/state/favoriteStore.ts:34`），字段：
  - `favoriteFriendIds`（远端收藏）
  - `localFriendFavorites`（本地分组到 ids 的映射）
  - `groupedFavoriteFriendIdsByGroupKey`
  - 初始值见 `favoriteStoreModel.ts:89-98`。
- 合并函数是 `buildFavoriteIdSet(remote, localFriendFavorites)`（`src/domain/favorites/favoriteIdSet.ts:5-28`）。侧栏用法见 `src/components/sidebar/FriendsSidebar.tsx:276-279`，读取 hook 是 `useFriendsSidebarFavoriteState.ts`。
- jirai 的「收藏」= `isVIP` = `localFavoriteFriends`（`stores/friend.js:449-475`）：
  - 远端收藏按设置项 `localFavoriteFriendsGroups` 过滤；只要选了任一非 `local:` 键就生效；
  - 本地收藏全部计入。
- 要做到完全一致，推荐：用 `usePreferencesStore(s => s.localFavoriteFriendsGroups)`（**只读**，不改 `preferencesStore.ts`；`useFeedRows.ts:77-79` 是先例）。如果含有非 `local:` 键，远端 ids 取这些键在 `groupedFavoriteFriendIdsByGroupKey` 中的并集，否则取全部 `favoriteFriendIds`；再并上 `localFriendFavorites` 的全部 ids。
  - **推断**：分组键格式与 jirai 的 `$groupKey` 相同，需要实施时用测试确认。
  - 备选：直接用 `buildFavoriteIdSet(favoriteFriendIds, localFriendFavorites)`，表示「所有收藏」。

### 在线好友与状态

- `useFriendRosterStore`（`src/state/friendRosterStore.ts:343`）提供 `onlineIds` 和 `friendsById`。
  - 分桶由 `presenceSection($presence)` 决定（`friendRosterStore.ts:241-254`，`domain/friends/presence.ts:40-50`）；`'online'` 包含 `pendingOffline`。
  - jirai 的 `onlineFriends` 是 `state==='online' && !isVIP`（`friend.js:314-319`）。
- 状态字段是 `friendsById[id].status`（`domain/friends/types.ts:18`，`FRIEND_PROFILE_STRING_FIELDS`），过滤条件为 `status === 'join me' || status === 'active'`，对应 jirai `AutoFollowDialog.vue` 的 `availableFriends`。这里的 `'active'` 是绿灯「Online」状态，不是 `state` 分桶里的 active。
- 地点显示：`presencePlace(friend.$presence)` 返回 `{location, travelingTo}`（`presence.ts:52-56`），配合 `src/components/Location.tsx` 的 `Location`（`location`、`traveling`、`link=false`，见 `:31-65`）。头像组件可用 `src/components/UserStatusAvatar.tsx`。

---

## 7. `launchVrchat` / `attachRunningVrchat` 细节

### `launchVrchat(location, shortName = '', desktopMode = false): Promise<void>`（`src/services/launchService.ts:151-196`）

- 先 `requireHostCapabilitySupported('gameLaunch')`。
- 用 `resolveVrcLaunchUrl` 解析启动 URL；必要时调 API 取 shortName（`directAccessService.ts:176-184`）。
- 读 config 的 `launchArguments` 和 `vrcLaunchPathOverride`；`desktopMode` 为真时追加 `--no-vr`。
- 调 `appStartGameFromPath` 或 `appStartGame`。失败时 **throw**；成功时弹 toast `common.label.vrchat_launched`。
- 自身**没有**「游戏已在运行」的确认；`LaunchDialogHost.tsx:361-378` 的确认框在调用方。
- **没有防重入。**

### `attachRunningVrchat(location, shortName = ''): Promise<void>`（`launchService.ts:106-134`）

- 调 `joinInstanceWithFallback`，即 `commands.appVrchatInstanceJoin({mode:'auto'})`（`instanceActionService.ts:14-28`、`:61-70`）。Rust 端是 `app__vrchat_instance_join`（`commands/vrchat/instances/service.rs:87-99`）到 `InstanceLaunchRuntime::join`（`application/src/game/instance_launch/runtime.rs:24-33`），**没有锁或节流**。
- 结果为 `opened`：静默返回。
- 结果为 `selfInvited`：先弹 warning `common.error.failed_open_instance_in_vrchat_falling_back_to_self_invite`，再弹 success `message.invite.self_sent`。
- 结果为 `failed`：throw。
- **没有 1 秒防重入。**

### jirai `tryOpenInstanceInVrc`（`stores/launch.js:93-127`）

- 有 `isOpeningInstance` 防重入，进入时置 true，结束后 `setTimeout(1000)` 再复位。
- 失败时弹 `'Failed open instance in VRChat, falling back to self invite'`，并改用 `selfInvite`。
- 所有异常都被吞掉，不向外抛。
- `launchGame`（`:136-176`）没有防重入。

### 落地建议

- 在 `src/services/autoFollowService.ts` 里用模块级 `let opening = false`，只给 attach 分支加 1 秒防重入。
- 两个分支都要 try/catch，出错弹 error toast，与 jirai 的「吞异常」一致。
- A7-15（打开失败回退自我邀请）：VRCX-0 现有 `attachRunningVrchat` **已有**这个回退（`mode:'auto'`，见上），可直接复用。

---

## 8. jirai 源码摘要与文案原文

### `src/stores/autoFollow.js` 逐条逻辑

1. 状态只在内存：`isActive`、`targetFriendId`、`targetFriendName`、`dialogVisible`。
2. `startFollow(friend)`：
   - 置 active，记录 id 和 displayName；
   - toast.success `自动跟随已启动: ${friend.displayName}`；
   - 如果已有 watcher 先注销（单目标、可覆盖）；
   - 新建 `watch(() => friends.get(targetId)?.ref?.location ?? null, cb)`，**非 immediate**，所以开始时不动作。
3. 回调 `cb(newLocation)`：
   - `!isActive || !newLocation` 时返回；
   - 如果 `isRealInstance(newLocation) && newLocation !== locationStore.lastLocation.location`：
     - toast.info `自动跟随: ${name} 切换了房间，准备加入...`；
     - 如果 `!gameStore.isGameNoVR || gameStore.isSteamVRRunning`：执行 `launchStore.tryOpenInstanceInVrc(newLocation, null)`；
     - 否则：先 `await AppApi.QuitGame()`，再 `launchStore.launchGame(newLocation, null, true)`。
   - 没有冷却，也不检查游戏是否在运行。
4. `stopFollow()`：只在 active 时生效。复位所有状态，toast.success `'自动跟随已停止'`，注销 watcher。
5. `openDialog()`：`dialogVisible = true`。实际挂载用的是 coordinator 的 `isAutoFollowDialogOpen`。
6. 没有登出 / 换账号钩子，不清目标；目标删好友时 `friends.get` 变成 undefined，回调收到 null 被忽略，跟随不停止。

### `src/coordinators/autoFollowCoordinator.js`

- 导出 `isAutoFollowDialogOpen`（ref），以及 `openAutoFollowDialog()` 和 `closeAutoFollowDialog()`。

### `MainLayout.vue:86`

- `<AutoFollowDialog v-model:open="isAutoFollowDialogOpen">`。

### 入口

- `FriendsSidebar.vue:203-211` 的浮动按钮（文案 `'跟随中 ■' : '自动跟随'`，点击时已激活则 stop，否则打开对话框）**整段被 HTML 注释掉了**。
- 所以 jirai 在 `c7eaf00e` 上本来就没有可见入口，与本次的入口隐藏决定一致。
- 因此 jirai 实际**没有可达的停止入口**：对话框里没有 stop 按钮。

### `AutoFollowDialog.vue` 的 UI 元素与文案原文

- 标题 `DialogTitle`：**自动跟随**
- 描述 `DialogDescription`：**请选择一个目前在线且是蓝灯或绿灯（Join Me / Online）的好友进行跟随。**
- 列表：`max-h-[60vh]` 可滚动，数据是 `onlineFriends` 中 `ref.status` 为 `'join me'` 或 `'active'` 的好友。每行包含：
  - 圆形头像（`userImage`，外加状态环 `userStatusClass`，无图时回退为 User 图标）；
  - 名字（颜色 `$userColour`）；
  - 副行：如果 `$locationTag` 或 `$travelingToLocation` 是真实实例，显示 `<Location :link="false">`，否则显示 `statusDescription || status`。
  - 点击整行：执行 `startFollow(friend.ref)` 并关闭对话框。
- 空列表文案：**没有符合条件的好友在线**
- 页脚按钮：`t('dialog.close')`

### toast 原文（中文硬编码）

- `自动跟随已启动: ${displayName}`（success）
- `自动跟随: ${name} 切换了房间，准备加入...`（info）
- `自动跟随已停止`（success）

间接 toast：
- `tryOpenInstanceInVrc` 失败时：`'Failed open instance in VRChat, falling back to self invite'`，加 `t('message.invite.self_sent')`。
- `launchGame`：`'VRChat launched'`，或 `'Failed to find VRChat, set a custom path in launch options'`、`Failed to launch VRChat: ${e.message}`。

### i18n

- jirai `src/localization` 中没有 autoFollow 相关键（grep 为空），全部是硬编码。
- VRCX-0 的 `src/localization/zh-CN.json` 和 `en.json` 都已经有顶层 `jirai` 节点，子键是 `two_person_relationship`、`relationship_recommendations`、`relationship_evidence`。建议放在 `jirai.auto_follow.*` 下。
- 其他语言回退到 `en`（`src/services/i18nService.ts:19`）。我没有发现强制所有语言键对齐的测试；**推断**，实施时用 `pnpm test` 确认。
- 已有可复用的键：`common.label.vrchat_launched`、`message.invite.self_sent`、`common.error.failed_open_instance_in_vrchat_falling_back_to_self_invite`（zh-CN `:819/:827/:7393`）。

---

## 需要 lead 裁决的一点（已裁决，见末节）

jirai 对话框**没有停止按钮**，侧栏 toggle 又被注释掉，所以 jirai 实际上无法停止跟随。

- **推荐**：对话框在激活时额外显示「当前目标 + 停止」一行，文案与 toast `自动跟随已停止` 一致。另外导出 `stopAutoFollow()` 函数。
- 备选：严格照 jirai，不提供停止入口。这样一旦开始就只能重启应用。

---

## 推荐实施清单

以下 15 个文件都已逐一与 114 项冻结清单核对，**全部不在冻结清单里**。

| # | 文件 | 新增/修改 | 冻结? | 改动要点 |
|---|---|---|---|---|
| 1 | `crates/application-realtime/src/auto_follow.rs` | 新增 | 否 | 纯同步状态机 `AutoFollowRuntime`：`start` / `stop` / `status` / `observe`；地点取值：`Online`/`PendingOffline` 取 `place.location.tag`，Active/Offline 视为 `"offline"`，removals 视为 None；触发条件：值变化、`is_real_instance`、不等于自己位置；类型 `AutoFollowStatus`、`AutoFollowTriggered`、`AutoFollowAction` 带 serde camelCase + specta，`impl RuntimeEventPayload`（`"autoFollowTriggered"`）；`#[cfg(test)]` 覆盖各断言；不加新依赖 |
| 2 | `crates/application-realtime/src/lib.rs` | 改（只追加） | 否 | `mod auto_follow;` 与 `pub use auto_follow::{...};` |
| 3 | `crates/runtime-host-desktop/src/context.rs` | 改 | 否 | `DesktopRuntimeServices` 加字段 `auto_follow`；`on_friend_projection` 追加 `observe_auto_follow`：取 `game_log_snapshot.snapshot().location`、`config.get_bool(IS_GAME_NO_VR_CONFIG_KEY,false)`、`session.snapshot().is_steamvr_running`，命中则 `event_bus.emit`；加 `pub fn auto_follow(&self)` |
| 4 | `crates/runtime-host-desktop/src/state.rs` | 改（只追加方法） | 否 | `auto_follow_start(user_id)`：用 `friend_snapshot()` 取 display_name 与当前 tag 作种子，好友不存在时报错；`auto_follow_stop()`、`auto_follow_status()`，都经 `self.desktop.services` |
| 5 | `src-tauri/src/commands/application/auto_follow.rs` | 新增 | 否 | `app__auto_follow_start` / `app__auto_follow_stop` / `app__auto_follow_status`，统一 `#[tauri::command(async)] #[specta::specta] pub fn` |
| 6 | `src-tauri/src/commands/application/mod.rs` | 改（追加 1 行） | 否 | `pub mod auto_follow;` |
| 7 | `src-tauri/src/commands/host/game.rs` | 改（只追加） | 否 | `app__quit_game() -> Result<i32, AppError>` |
| 8 | `src-tauri/src/bindings_export.rs` | 改（只追加） | 否 | `collect_commands!` 追加 4 个命令；`BackendRuntimeEventPayloadMap` 追加 `auto_follow_triggered`；追加导入 |
| 9 | `src/platform/tauri/bindings.ts` | 由 pc 生成 | 否 | **不手改**；pc 上执行 `pnpm generate:tauri-bindings` |
| 10 | `src/state/autoFollowStore.ts` | 新增 | 否 | zustand：`open`、`status`；导出 `openAutoFollowDialog()`、`closeAutoFollowDialog()` |
| 11 | `src/services/autoFollowService.ts` | 新增 | 否 | `startAutoFollow`、`stopAutoFollow`；`handleAutoFollowTriggered`：先弹 info toast，`attach` 走 1 秒防重入的 `attachRunningVrchat`，`relaunchDesktop` 走 `appQuitGame()` 后 `launchVrchat(location, '', true)`；两条分支都 try/catch |
| 12 | `src/components/dialogs/AutoFollowDialog.tsx` | 新增 | 否 | 复刻 jirai UI，加「当前目标 + 停止」行；可选列表 = `onlineIds` − 收藏集合 ∩ `status ∈ {'join me','active'}` |
| 13 | `src/components/hosts/AutoFollowHost.tsx` | 新增 | 否 | 渲染对话框；订阅 `autoFollowTriggered` |
| 14 | `src/app/GlobalHosts.tsx` | 改（追加 1 import + 1 行） | 否 | `<AutoFollowHost />`；不加可见入口 |
| 15 | `src/localization/en.json`、`src/localization/zh-CN.json` | 改（只追加键） | 否 | `jirai.auto_follow.*` |

### 明确不改的文件

- `crates/runtime-event/**`、`crates/contracts/**`、`crates/composition/src/context.rs`
- `src/main.ts`、`runtimeEventBridgeService.ts`、`preferencesStore.ts`（只读）
- `SidePanel.tsx`、`UserDialogHeaderActions.tsx`、`StatusBarFooter.tsx`、`tools.ts`、`routes.tsx`
- `crates/persistence/**`
- `src-tauri/tests/backend_architecture.rs`（白名单不扩大）

### 验收建议

- `cargo test -p vrcx-0-application-realtime auto_follow`
- `cargo test -p vrcx-0 --test backend_architecture`
- `cargo check`、`pnpm tsc`、相关前端测试

### 已知限制

- 后台隐藏运行时事件会被丢弃（`adapters.rs:166`），自动跟随不会执行。
- 游戏隔离开启时，「我当前位置」仍按原始游戏日志计算；这是为了与 jirai 一致的选择。

---

## lead 裁决

1. **停止入口**：按推荐，对话框激活时显示「当前目标 + 停止」行，并导出 `stopAutoFollow()`（A7-7 / A7-8 需要可达的停止）。
2. **收藏集合**：按 jirai 完全一致的规则：`localFavoriteFriendsGroups`（只读）+ `groupedFavoriteFriendIdsByGroupKey` + `localFriendFavorites`。实施时用测试确认分组键格式；若格式无法确认，退回 `buildFavoriteIdSet` 并在报告中标注。
3. **我的位置**：用原始 `game_log_snapshot`（与 jirai 一致）；游戏隔离、后台隐藏时丢事件记为已知限制。

### 前后端契约（lead 补充，Rust 侧已按此实现）

- 命令：`app__auto_follow_start(user_id: String) -> Result<AutoFollowStatus, AppError>`、`app__auto_follow_stop() -> Result<AutoFollowStatus, AppError>`、`app__auto_follow_status() -> Result<AutoFollowStatus, AppError>`、`app__quit_game() -> Result<i32, AppError>`；前端名 `appAutoFollowStart` / `appAutoFollowStop` / `appAutoFollowStatus` / `appQuitGame`。
- `AutoFollowStatus`（camelCase）：`{ active, targetUserId, targetDisplayName }`。
- `AutoFollowTriggered`（事件 `"autoFollowTriggered"`）：`{ userId, displayName, location, action }`，`action` 为 `"attach"` | `"relaunchDesktop"`。
- start 时目标不是当前好友 → 返回 `Err(AppError)`（英文信息）。

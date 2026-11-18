# MIMI 施工源码充分性分析

| 项 | 值 |
| --- | --- |
| 时间戳 | `2026-11-18T19:26Z`（UTC） |
| 问题 | MIMI 工作目录是否具备开工所需的差分源码；断言不清时 agent 能否自行深挖 |
| 取证 | 本机只读：`git cat-file` / `git show` / `git grep` 于 `VRCX-jirai`（`c7eaf00e`）；grep / 读文件于 MIMI 工作目录（`ea3142a47`） |

## 1. 结论

**够开工。** 两侧源码都在本机、都可按提交号读，断言点名的文件全部存在。差分基点 `d97327d8`、基线 `c7eaf00e`、#7 入口隐藏 `3a5c269e`、#10 来历 `c4f1a461` 四个提交都在本地对象库里。

但有三点要注意：

1. **jirai 源码不在 MIMI 目录里**，在兄弟目录 `/home/fulutang/Documents/Github/VRCX-jirai`。这是设计如此（旧仓库只读参考，`JIRAI_移植说明.md`），施工 agent 和子代理必须知道这个绝对路径——已写进施工计划与 `subagent.md`。
2. **本轮深挖时已经解掉一个原先的未知项**：A7-15（打开失败回退自我邀请）在 VRCX-0 **已存在**，见第 3 节。
3. **codegraph 索引不能直接用**：唯一的索引在 `VRCX-0-jirai/.codegraph`，对应旧分支 `3200bc3c7`（落后基线 87 个提交）；MIMI 与 VRCX-jirai 都没有索引。agent 可以用它找方向，但行号必须回 MIMI 核对。

## 2. jirai 侧（参考源码）

`/home/fulutang/Documents/Github/VRCX-jirai`：HEAD = `c7eaf00e`，分支 `master`，工作树干净；remote 含 `origin`（FuLuTang/VRCX-jirai）与 `upstream`（vrcx-team/VRCX）。

| 功能 | 文件 @ `c7eaf00e` | 行数 | 状态 |
| --- | --- | --- | --- |
| #7 | `src/stores/autoFollow.js` | 84 | 在（状态机全文） |
| #7 | `src/components/dialogs/AutoFollowDialog.vue` | 107 | 在 |
| #7 | `src/coordinators/autoFollowCoordinator.js` | 12 | 在（`openAutoFollowDialog`） |
| #7 | `src/stores/launch.js` | 190 | 在（`tryOpenInstanceInVrc` :93、`launchGame`） |
| #7 | `Dotnet/AppApi/Cef/GameHandler.cs` | 126 | 在（`QuitGame`） |
| #7 | `src/views/Sidebar/components/FriendsSidebar.vue` | 1029 | 在（:203-211 注释掉的入口） |
| #7 | `src/views/Layout/MainLayout.vue` | 215 | 在（:86 对话框挂载） |
| #7 | `src/stores/game.js` | 133 | 在（`isGameNoVR` :19 默认 `true`、:33 读配置；`isSteamVRRunning` :21） |
| #7 | `src/stores/friend.js` | 1468 | 在（`onlineFriends` :314，A7-2 依据） |
| #7 | `src/stores/location.js` | 52 | 在（`lastLocation`） |
| #7 | `src/shared/utils/instance.js` | — | 在（`isRealInstance` :6） |
| #14 | `src/stores/quickSearch.js` | 330 | 在（`supplementWithBioSearch`） |
| #14 | `src/stores/quickSearchWorker.js` | 439 | 在（内存当前 Bio 匹配） |
| #14 | `src/services/database/feed.js` | 918 | 在（`searchBiosByContent`） |

另有 jirai 自带测试可参考：`src/stores/__tests__/game.test.js:38`（`isGameNoVR` 默认值）。

## 3. VRCX-0 侧（MIMI 工作目录，`ea3142a47`）

| 断言需要的东西 | 位置 | 结论 |
| --- | --- | --- |
| #14 扩展点 | `crates/application/src/social/quick_search_catalog.rs`（枚举 :86-90、`search_friends` :621）；`crates/outbound-adapters/src/quick_search.rs:21`；`crates/persistence/src/profile_bio.rs:154` | 在 |
| #14 前端 | `src/components/sidebar/QuickSearchResults.tsx`；`bindings.ts:4161` | 在 |
| #7 前端游戏状态 | `src/state/runtimeStore.ts:189-200`：`gameState.isGameRunning / isSteamVRRunning / isGameNoVR` | **在**——D4=A 下前端可以直接按这两个字段选分支 |
| #7 Rust 游戏状态 | `crates/application-game/src/background_capabilities/presence_facts.rs:21/38 is_game_no_vr` | 在 |
| #7 启动 | `src/services/launchService.ts:151 launchVrchat(location, shortName, desktopMode)` | 在 |
| **A7-15 回退自我邀请** | `src/services/launchService.ts:106 attachRunningVrchat` → `joinInstanceWithFallback`：`selfInvited` 时弹「打开失败，改为自我邀请」警告并提示已发送 | **已存在**。#7 分支一直接调 `attachRunningVrchat` 即可满足 A7-15；原「7.0 spike 确认」可勾掉 |
| #7 退出游戏 | Rust：`crates/host-desktop/src/game_launch.rs:76 quit_game`、`application-game/src/game_log/host.rs:4` trait；**前端 `src`/`src-tauri` 里没有 `quit` 命令**（检索零命中） | 缺口：需新增一个 host 命令（只追加），7.0 定 |
| #7 好友位置接缝 | `crates/application-realtime/src/instance_dwell.rs:276 observe_friend` 等 3 个候选 | 在，选哪个由 7.0 定 |
| #7 收藏好友判定（A7-2） | `src/state/favoriteStoreModel.ts` 等 | 在，具体字段 7.4 时确认 |
| 真实实例判定 | `crates/core/src/location.rs:196 is_real_instance` | 在 |

## 4. 断言不清时 agent 能否自己深挖

**能**，条件都具备：

- jirai 侧可 `git show c7eaf00e:<路径>` 读任何文件、`git log -- <路径>` 看来历、`git show 3a5c269e` 看入口为何隐藏；差分全集 `git diff d97327d8 c7eaf00e`（145 文件）随时可取。
- VRCX-0 侧就是 MIMI 工作树本身；`git show ea3142a47:<路径>` 可对照基线原文。
- 调研文档（闭环断言、映射、图谱、README）都已复制进 MIMI 的 `reports/` 与根目录，带文件:行号锚点。

**深挖的边界**（写进 `subagent.md` 第 7 节）：先文档、再 jirai 源码、再 VRCX-0；仍不清就写「推断 + 多种读法」交主代理裁决，不改断言迁就测试。

**仍需施工时决定、源码无法替你回答的**（7.0 spike 的剩余问题）：

1. 退出游戏的前端通道：新增哪个 host 命令、放在哪个 commands 模块（只追加）。
2. 好友位置接缝选三个候选中的哪一个。
3. 端口 trait 放 `contracts` 还是 `runtime-event`。
4. 「上次是否以桌面模式启动」：jirai 读持久化配置 `isGameNoVR`；VRCX-0 前端 `gameState.isGameNoVR` 的来源是否同义（持久化标记 vs 实时状态），需读 `src/services/gameStateService.ts` 确认。若不同义，按 jirai 语义取持久化值。

## 5. 不够的地方（都不阻塞开工）

- 没有 codegraph 索引覆盖 MIMI 或 VRCX-jirai。
- jirai 侧 #7、#14 没有现成测试（只有 `game.test.js` 一条相关），夹具要从断言重新写。
- 本机没有 cargo，Rust 只能在 pc114514 验证。

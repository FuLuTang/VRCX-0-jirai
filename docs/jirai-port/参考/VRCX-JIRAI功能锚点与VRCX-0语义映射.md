# VRCX-JIRAI 功能锚点与 VRCX-0 语义映射（v3 · 接手复审版）

> 目的：为 VRCX-jirai 相对上游新增的功能（17 个条目：编号 #1–#16 + 附属项 #3b，条目口径见《新增功能图谱》第 2 节），逐项定位 **根入口点**（让功能可触达的最外层锚点）、**建立基础**（数据表 / 查询 / 外部 API），并在 **VRCX-0-jirai** 源码中找出**同类语义**（不要求代码同构，只要求同用户价值或同数据职责）。
>
> - 分析侧只读：仅 `grep/sed/git log/test`，未修改任何仓库文件；本文件为交付产出
> - jirai 基准（**双版本，见第 8 节**）：
>   - GitHub `refs/heads/master` = `c7eaf00e`（2026-09-27，发布版 2026.9.27）← 第 2 节「根入口/建立基础」所有 jirai 侧行号以此为准（2026-11-17T23:23Z 抽验 6 个文件行数、4 处关键行号全部吻合）
>   - pc114514 开发线 `codex/vrcx-upstream-through-2026-08-15` = `bd2f45f0`（2026-10-02，**266 提交未推送、711 文件差异**，另有 16 项未提交改动）
> - **VRCX-0 基准**：`main` = `ea3142a47`（2026-11-16 全分支合并后；2026-11-17T23:23Z `ls-remote` 复核 `origin/main` 未动）。第 2 节「VRCX-0 同类语义」的所有「文件:行」在该提交工作树上逐条核实
> - 上游基准：`vrcx-team/VRCX` = `e819c4e4`（2026-11-16，同日复核未动）；`Map1en/VRCX-0`（VRCX-0 真正上游）= `732ca893d`（2026-11-17，同日复核未动）
> - 取证方式：v1/v2 由 3 名独立只读子代理 + 主代理复核；**v3（2026-11-17T23:23Z）由接手方对每个 VRCX-0 侧引用回源码重核**，发现 v2 第 2 节有大量过期行号与已被推翻的「缺口」，详见第 9 节「v3 复审记录」
> - **复审记录**：2026-11-16 二次审查（上游漂移）+ 2026-11-16 三次审查（合并后基准迁移，见第 7 节）+ **2026-11-17 接手复审（见第 9 节）**

---

## 1. 全局入口注册表（总纲）

VRCX-jirai 把新功能挂到上游既有的一批注册点上。下表是"锚点 → 位置"，任何一项功能至少命中其中之一：

| 注册类型 | 位置 | 承载内容 |
| --- | --- | --- |
| 路由 | `src/plugins/router.js:119-123` / `:125-129` | `charts/two-person`、`charts/timeline` |
| 导航项定义 | `src/shared/constants/ui.js:109-115` / `:123-129` | 两个新页的 icon + labelKey + routeName |
| 默认导航布局 | `src/components/nav-menu/navLayoutDefaults.js:34` | charts 分组 items 加入两页 |
| Dashboard 面板 | `src/views/Dashboard/components/panelRegistry.js:41-43` | `charts-timeline` |
| Dashboard 屏蔽表 | `src/shared/constants/dashboard.js:10` | `charts-two-person` 被列入 `DASHBOARD_BLOCKED_PANEL_KEYS` |
| 侧栏 Tab | `src/views/Sidebar/Sidebar.vue:475` + `:311-313` | `tracked` 页签与组件挂载 |
| Tools 菜单项 | `src/shared/constants/tools.js:163-169` | `info-completion`（`action.dialogKey='infoCompletion'`） |
| 全局弹窗容器 | `src/views/Tools/components/GlobalToolsDialogs.vue:14-16`（挂载于 `MainLayout.vue:88`） | `ProfileCompletionDialog` |
| 用户右键菜单 | `src/components/dialogs/UserDialog/UserActionDropdown.vue:227/231`（store 在 `:282-319`） | 追踪 / 取消追踪 |
| 定时器总表 | `src/stores/updateLoop.js:37-48`（状态表）、`:76-150`（动作） | `nextNonFriendRefresh: 3600` → `:92-94` |
| 设置键 | `src/stores/settings/advanced.js:74`（`ref(true)`）、`:173`（`getBool(...,true)`）、`:673-678`（写回）；UI `AdvancedTab.vue:28-30` | `autoJoinGroupCertification` |
| 更新端点常量 | `src/shared/constants/settings.js:1-4`、`:24`（Stable）、`:29`（Nightly） | `REPOSITORY` / `GITHU_API_URL` / `urlReleases` |
| OLD 互惠历史表 | `src/services/database/index.js:155` 建表；`stores/charts.js:221-222 / :413-415` 写；`MutualFriends.vue:1291`、`UserDialogMutualFriendsTab.vue:172-173` 读 | `{prefix}_mutual_graph_links_old`（#16，v3 补入） |
| 快捷键 | `src/views/Sidebar/Sidebar.vue:383-385` | `Ctrl+K` / `⌘K` 打开快速搜索 |

> 说明：`charts-two-person` 只走路由，进不了 Dashboard；`charts-timeline` 路由 + 面板双入口。这是两项功能唯一的结构性差异。

---

## 2. 逐项对照

### #1 双人关系

**根入口**：路由 `router.js:119-123`；导航项 `ui.js:109-115`；默认布局 `navLayoutDefaults.js:34`；导航白名单 `navMenuUtils.js:51`；图表页强制隐藏侧栏 Tab `settings/appearance.js:115`。**无 Dashboard 面板**（`dashboard.js:10` 明示屏蔽）。

**建立基础**：表 `gamelog_join_leave`（`database/index.js:182`）；主查询 `gameLog.js:1675 getCoInstanceHistoryBetweenFriends`（自 JOIN + `OnPlayerLeft`），组件调用在 `TwoPersonRelationship.vue:472`；补充推断 `gameLog.js:1722 getInferredLocationSessions`（`_feed_gps` / `_feed_online_offline` 反推）；`selfMap/maxMap` 批量查询 `:480`（`selfPresenceMap` `:487`、`maxPlayerCountMap` `:488`）；选择器数据源 = 好友 ∪ 追踪非好友（`:277,295`）。

**VRCX-0 同类语义**：**高**。`TwoPersonRelationshipPageImpl.tsx`（`main`/`ea3142a47` 下 **830 行**，合并前 729；首行 `// @ts-nocheck`）：`:46 buildFriendOptions`（好友 ∪ 追踪非好友候选）、`:121 buildSessions`、`:128 getOverlapRows`（co-instance 交集）、`:160 buildSelfSessions`、`:166 isSelfPresent`、`:182 groupOverlapsByLocation`（发起者判定）、`:258 computeTotalTime`、`:262 TwoPersonRelationshipPage` 组件；`:44` 从 `relationshipHistory.ts` 引入 `buildRelationshipSessions`（`relationshipHistory.ts:83`）；路由 `src/app/routes.tsx:251`；**数据口径**：共处会话来自 `feedRepository.queryFeedUserHistory`（`:356/362/432`，`types:['GPS','Offline']`，`feedRepository.ts:169-185`），`appGameLogQuery`（`:302`，`kind:'playersFromInstanceRows'`）**仅用于实例峰值人数**（`observedPeakPlayerCount`，对应 jirai 的 `maxPlayerCountMap`）。
**缺口**：① jirai 的"每地点首次相遇"无同名聚合，VRCX-0 用「最早 join + 阈值」近似；② 页面首行 `// @ts-nocheck`（直译文件，类型检查被绕过）；③ **数据口径不同**：jirai 用 `gamelog_join_leave` 自连接作主查询（再用 Feed 做补充推断），VRCX-0 主查询改走 Feed 的 `GPS`/`Offline` 历史行、GameLog 只补峰值人数——同一对好友在两边的共处结果可能略有出入，这不是移植 bug，而是口径选择，验收时要意识到。
> **v3 已删除的 v2 说法**：「`relationshipHistory.ts` 的 5 个导出函数只有 1 个被使用——其余是死代码」。实测该文件有 13 个导出（`relationshipHistory.ts:5-353`），**时间轴页现已引入其中 4 个**（见 #2），双人页引入 1 个；其余导出多为类型或仅被测试使用，不应笼统称死代码。

### #2 关系时间轴

**根入口**：路由 `router.js:125-129`；**Dashboard 面板** `panelRegistry.js:41-43`；导航项 `ui.js:123-129`；默认布局 `navLayoutDefaults.js:34`；页内刷新 `RelationshipTimeline.vue:64`；挂载即载 `:583`。

**建立基础**：表 `gamelog_join_leave`（`index.js:182`）；查询 `gameLog.js:2001 getRelationshipTimelineData`（按 user_id/day 聚合 `SUM(time)` + `COUNT(DISTINCT location)`）；纯函数层 `relationshipTimelineUtils.js:44 aggregateFriendDaysToBuckets`、`:94 buildPerBucketTopNPercentageSeries`、`:5 relationshipScore`、`:24 computeZoomRange`。

**VRCX-0 同类语义**：**高**。`RelationshipTimelinePageImpl.tsx`（`main` 下 **506 行**，合并前 587；**已无** `@ts-nocheck`）：`:49 bucketDaysFromSlider`、`:66 relationshipChartOption`（图表配置）、`:190 RelationshipTimelinePage` 组件；`:29-34` 引入 `relationshipHistory.ts` 的 `buildRelationshipDailyValues`、`buildRelationshipSessions`、`buildRelationshipTimeline`（`:244`）、`initialRelationshipTimelineZoom`（`:353`）——即页面**确实在使用**这套已测工具；`relationshipHistory.ts` 共 362 行，`relationshipScore`（`:227`）；路由 `routes.tsx:260`；**数据口径**：`feedRepository.queryRelationshipTimelineHistory`（`RelationshipTimelinePageImpl.tsx:242`；`feedRepository.ts:192-224`，游标分页读取当前账户全部 Feed `GPS`+`Offline` 行）。
**缺口**：① **数据口径与 jirai 不同**——jirai 的 `getRelationshipTimelineData`（`gameLog.js:2001`）只读 `gamelog_join_leave`，VRCX-0 读 Feed 位置事件，同一时间窗内的聚合值可能不同；② `docs/jirai-feature-backlog.md:143-151` 记录「功能通过，主题与布局待改」，属 UI 打磨。同一份 `queryRelationshipTimelineHistory` 还被 #3b 推荐的数据加载复用（`relationshipRecommendationData.ts:38`）。
> **v3 已删除的 v2 说法**：「页面用自建 `buildTimelineRows`、没有调用 `relationshipHistory` 工具、两套并行、工具库是死代码」「同样是 `@ts-nocheck`」。实测 `buildTimelineRows` / `splitDurationByDay` 在 `main` 上已不存在，时间轴页首行也已无 `@ts-nocheck`。

### #3 手动关系 + 推测建议

**根入口**：主按钮 `MutualFriends.vue:78`（`:77` 是 Tooltip）；对话框挂载 `:308`；MutualFriends 路由 `router.js:107-109` + 导航 `ui.js:102-108`；对话框内增删 `ManualRelationsDialog.vue:51` / `:84`。
**推测建议双写路径**：手动 `ManualRelationsDialog.vue:99 → :280 computeSuggestions()`；自动 `infoFetchCoordinator.js:230-232`（抓取第 2 阶段后触发）。

**建立基础**：表 `{prefix}_manual_relations_MANUEL(user_id_a, user_id_b, relation_type, added_at)`（`index.js:167`，复合主键）；db 层 `manualRelations.js:11/43/65`；候选查询 `manualRelations.js:104 getCandidateCoInstances`（三表 UNION：gamelog `:152` / feed_gps `:155` / feed_online_offline `:156`）；计算主体 `stores/manualRelations.js:80`；登录加载 `auth.js:1040`。
**只读消费点**：`gameLogCoordinator.js:278`（进房推荐）、`userCoordinator.js:684`（用户弹窗提示）——都只读 `cachedSuggestions`，不触发重算。

**VRCX-0 同类语义**：**高**。Rust 表与 CRUD **并入 `crates/persistence/src/mutual_graph.rs`**（`main` 下 `:77 mutual_graph_extras_get`、`:95` 列表查询、`:146 mutual_graph_manual_link_set`、`:167` 插入、`:176` 删除；表名仍是 `{prefix}_manual_relations_MANUEL`，建表 `database/schema.rs:297`，另有 `user_a`/`user_b` 两个索引 `:300/:303`；原独立模块 `manual_relations.rs` 在合并后不再存在）；Tauri 命令 `commands/local/mutual_graph.rs:46 app__mutual_graph_extras_get`、`:72 app__mutual_graph_manual_link_set`；仓库 `manualRelationsRepository` / store；UI **`MutualFriendsRelationsManager.tsx`（311 行）**，由 `MutualFriendsManagementSheets.tsx:75/116` 挂载（原 `ManualRelationsControl.tsx` 被取代）；**图叠加**在 `src/lib/mutual-friends/mutualFriendsGraphData.ts:161-175`（遍历 `manualLinks`、`edgeMap.set(... ...existing, manual: true)`，即手动边可叠加在 `current`/`historical` 边之上），渲染在 `mutualFriendsSigmaGraph.ts:545-566`（`manual` 用 `theme.edgeManualColor`、`edgeZIndex` 最高）。
**缺口**：① `syncWorkflowActions.ts:121-125` 的 `manual-relations-sync` 仍是 `skippedAction` 桩；② `relationType` 写入时固定 `'friend'`（`mutual_graph.rs:167`），`MutualFriendsRelationsManager.tsx` 中**无 `relationType` 引用**、图也不按类型区分边——jirai 的类型字段在表里存在，但 jirai 自己的 **3 个写入调用点全部显式传 `'friend'`**（`ManualRelationsDialog.vue:260`、`:292`，`userCoordinator.js:755-758`；`database/manualRelations.js:11`、`stores/manualRelations.js:48` 的默认值亦为 `'friend'`），没有任何 UI 提供其他类型。所以这是「字段保留、语义未分层」，**并非功能退化**。
> **v3 已删除的 v2 说法**：「图叠加 `mutualFriendsGraphData.ts:151 overlayManualRelations`」（该函数不存在，叠加逻辑在 `:161-175`）；「`manual_relations.rs`（326 行）」仅作为合并前历史保留于第 7 节。

### #3b 推测建议（附属于 #3，单列）

**根入口**：手动 `ManualRelationsDialog.vue:99 → :280 computeSuggestions()`；自动 `infoFetchCoordinator.js:230-232`（抓取第 2 阶段后触发）。

**建立基础**：`services/database/manualRelations.js:104 getCandidateCoInstances`（三表 UNION：gamelog `:152` / feed_gps `:155` / feed_online_offline `:156`）；计算主体 `stores/manualRelations.js:80 computeSuggestions`；结果只存 `cachedSuggestions`（`:18`），不落库；只读消费点 `gameLogCoordinator.js:278`（进房推荐）、`userCoordinator.js:684`（用户弹窗提示）。

**接受建议的 jirai 路径有两条**（v3 补）：①手动对话框 `ManualRelationsDialog.vue:292 addManualRelation(s.userIdA, s.userIdB, 'friend')` 后 `:293 ignoreSuggestion`；②用户弹窗提示里 `userCoordinator.js:755-760` 直接 `addManualRelation(..., 'friend')` + `ignoreSuggestion`。

**VRCX-0 同类语义**：**高**（合并后由「无」升级；**算法与 jirai 逐项一致，已回源码核对**）。
- **算法本体**：`src/features/charts/relationshipRecommendationsAlgorithm.ts`（**421 行，位于 `relationship-recommendations/` 目录之外**，被目录内 `relationshipRecommendationData.ts:10`、`relationshipRecommendationsService.ts`、`relationshipRecommendations.test.ts:6` 引用）：`instanceWeightMap`（`:157-167`：invite / invite+ / private 1.0、friends 1.8、friends+ 1.2、hidden 1.2、group / groupPublic / groupPlus 1.0、public 0.5，缺省 0.5 见 `:187`）、`hardMatch`（`:105-112`，仅 invite/private 且创建者在对内）、`mePresent`（`:115-124`）、「未知」快照判定 180000ms 窗口（`:195/200-201`）、密度加成 `weightedCount/daysObserved*50`（`:341`）、独立率惩罚 `0.55 + (indepRatio/0.08)*(1.08-0.55)`（`:356`）。这些与 jirai `stores/manualRelations.js` 的 `computeSuggestions` 一一对应。
- **回归夹具**：`relationship-recommendations/legacyManualRelations.fixture.json`（97 行）+ `relationshipRecommendations.test.ts`（201 行）把旧版结果锁成断言，即「用旧数据复现旧排序」。
- **目录规模（v3 更正）**：`relationship-recommendations/` 共 **11 个文件 1486 行**（`relationshipEvidence.ts` 48、`relationshipRecommendationData.ts` 141、`relationshipRecommendationsService.ts` 202、`RelationshipRecommendationsPanel.tsx` 183、`RelationshipRecommendationNotificationSetting.tsx` 67、`useUserRelationshipRecommendationPrompt.tsx` 168、测试 4 个 133/201/144/102、夹具 97）；加目录外算法 421 行，合计 **1907 行**。
- **会话内忽略**：`relationshipRecommendationsService.ts:18` `ignored: Set<string>`、`:67` 过滤、`:161-174 ignoreRelationshipRecommendation`——与 jirai「忽略仅内存、不落库」一致。
- **输入数据**：`relationshipRecommendationData.ts:38` 复用 `feedRepository.queryRelationshipTimelineHistory`（同 #2）；`enhancedInfoFetchService.ts:140 registerEnhancedRelationshipRecommendations` 把推荐计算挂进增强抓取的并行任务。
- **进房/资料提醒（Rust 链路，对应 jirai `gameLogCoordinator.js:278` / `userCoordinator.js:684`）**：前端 `relationshipRecommendationsService.ts:63` 调 `commands.appRelationshipRecommendationsSet` → `src-tauri/.../overlay_activity.rs:14 app__relationship_recommendations_set` → `runtime-host-desktop/src/state.rs:1397` → `application-game/src/game_log/processor.rs:180` → `activity_events/relationship_recommendations.rs:16 RelationshipRecommendationCache`（183 行，`:44 live_candidates` 只处理实时进房、回放不触发，`:100` 发出 `ActivityKind::RelationshipRecommendation`）；通知设置 UI `RelationshipRecommendationNotificationSetting.tsx`；用户弹窗提示 `useUserRelationshipRecommendationPrompt.tsx`（含「已撤销候选不得残留交互 toast」，`:69`）。
**缺口**：① `syncWorkflowActions.ts:133-137` 的 `relationship-recommendations` 工作流动作仍是 `skippedAction` 桩（推荐实际由 `enhancedInfoFetchService` 并行任务驱动，而非该动作）；② `docs/jirai-feature-backlog.md:87` 的小节标题为「推荐确认交互未通过，Overlay 暂缓」，`README.zh-CN.md:77` 写明「推荐弹出策略留待讨论，关系 Overlay 等推荐交互通过后再验」——**代码与算法一致 ≠ 交互验收通过**（该两处是 2026-10-13 的实机结论，合并后 `main` 上未见更新的验收记录）；③ 「评分达到什么程度才提示」「忽略后何时可重新提示」是 backlog `:203` 明列的**待拍板产品语义**。
> **v3 已删除的 v2 说法**：「需实测其评分权重与 `instanceWeightMap` 是否等价」「会话内忽略语义是否保留待确认」——两项均已核实一致，不再是待确认项。

### #4 追踪非好友

**根入口**：侧栏 Tab `Sidebar.vue:475` + 挂载 `:311-313`；右键菜单 `UserActionDropdown.vue:227/231`（`v-if="isTracked"`）；侧栏添加 `TrackedNonFriendsSidebar.vue:57-58`、移除 `:47`；定时器 `updateLoop.js:92-94`。

**建立基础**：表 `{prefix}_tracked_nonfriends(user_id PK, display_name, added_at)`（`index.js:164`）；db `trackedNonFriends.js:6/33/64`；store `trackedNonFriends.js:55/67`；刷新 `nonFriendCoordinator.js:13`（每小时）→ `api/user.js:19 getUser`；bio 写入 `nonFriendCoordinator.js:49 recordBioObservation`。

**VRCX-0 同类语义**：**高**。Rust `crates/persistence/src/tracked_nonfriends.rs`（200 行）：`:32 list`、`:54 add`、`:74 remove`、`:87 is_tracked`、`:104 update_name`；建表 `realtime/schema.rs:87`（及 `database/schema.rs:294`，两处均 `CREATE TABLE IF NOT EXISTS`）；Tauri 命令 `src-tauri/src/commands/local/tracked_nonfriends.rs:13/26/40/54/68`；仓库 `repositories/trackedNonfriendsRepository.ts:30/36/50/60/70`（list/add/remove/isTracked/updateName）；store `state/trackedNonfriendsStore.ts:52`；UI：侧栏 `components/sidebar/TrackedNonfriendsSidebar.tsx`（`SidePanel.tsx:456` 挂载）、资料页入口 `UserDialogHeaderActions.tsx:214 toggleTrackedNonfriend`（按钮 `:382-390`）；刷新 `services/trackedNonfriendsRefreshExecutor.ts:178`（`:197` 注册为工作流 `tracked-non-friends-sync` 的执行体）。
**表结构与 jirai 同构**（`user_id` PK、`display_name`、`added_at`；VRCX-0 额外建 `added_at DESC, user_id` 索引 `realtime/schema.rs:88`）。缺口：**非好友没有自己的 Online/Offline 采集**——`crates/persistence/src/realtime/jirai.rs:83` 的启动补线显式拒绝非好友（`"Startup online backfill target is not a current friend."`），所以追踪对象只有「名单 + 改名 + 资料补抓（Bio/状态 reconcile）」。这与 backlog `:71` 小节「追踪非好友的 Bio／状态历史 — 已接入」的口径一致：补的是**资料历史**，不是**在线事件**。
> **v3 已更正**：v2 写的命令行号 `:25/:38` 实为 `:26/:40`；`trackedNonfriendsStore.ts:51` 实为 `:52`；`SidePanel.tsx:463` 实为 `:456`；`UserDialogHeaderActions.tsx:177` 实为 `:214`；`trackedNonfriendsRefreshExecutor.ts:142` 不是入口（`:178/:197` 才是）。

### #5 信息抓取补全 + 同步指示器

**根入口**：Tools 菜单 `tools.js:163-169`；弹窗 `GlobalToolsDialogs.vue:14-16`（`MainLayout.vue:88`）；弹窗内开始按钮 `ProfileCompletionDialog.vue:107`；状态栏按钮 `StatusBar.vue:322-326`（受 `visibility.profileInfoSync` 控制）；自动触发 `friendSyncCoordinator.js:32`（L4 末尾）、`:80`（初始化）。

**建立基础**：状态机 `infoFetchCoordinator.js:19`；目标集 `:69 buildTargetList`（好友 ∪ 追踪非好友去重）；`getTargetCount` `:44`；主流程 `:96 runSilentInfoFetch`（防重入）；API `api/user.js:19`；落库 `feed.js:37 addBioToDatabase`、表 `index.js:68/71`。

**VRCX-0 同类语义**：**高（形态不同，且比 v2 描述的完整）**。
- **执行体**：`src/services/enhancedProfileFetchExecutor.ts`（380 行）`:82 createProfileFetchExecutor`——目标 = 当前好友 ∪ 追踪非好友去重（`:104-125`，好友优先），按账户隔离（`isAccountCurrent`）、可取消（`abortIfNeeded`）、失败重试（`RETRY_INTERVAL_MS = 3_000`，`:14`），遇 429 遵从服务端 Retry-After（`enhancedProfileFetchRequest.ts` 的 `profileRetryAfterMs`）；每个目标走 `commands.appProfileFeedReconcile`。`profileFetchExecutor.ts` 仅 **48 行**，只做依赖装配与 `registerProfileFetchExecutor`（`:48`）。
- **调度服务**：`src/services/enhancedInfoFetchService.ts`（400 行）`:336 initializeEnhancedInfoFetch`（由 `src/main.ts:9` 启动）订阅原生**好友基线完成**事件（`subscribeAuthenticatedRuntimeEnhancedBaseline`，`:338`），`source==='reconnect'` 时不触发（`:340`）；开关配置键 `enhancedInfoFetchEnabled`（默认 `true`，`:345`）；来源枚举 `'startup' | 'periodic' | 'manual'`（`:15`）；注释明言「no timer assumes an hourly refresh finished」（`:334-335`）。
- **进度指示（v3 更正：已存在）**：状态栏常驻 `components/layout/status-bar/EnhancedInfoFetchStatus.tsx`（`StatusBarFooter.tsx:113` 渲染，含测试 `EnhancedInfoFetchStatus.test.tsx`）；快照订阅 `getEnhancedInfoFetchSnapshot`（`:114`）、`subscribeEnhancedInfoFetch`（`:117`）；**目标数预览**：`getEnhancedInfoFetchTargetCounts(accountId)`（`:95`，返回 `friendsTotal`/`trackedTotal`）；进度字段含 `total/processed/succeeded/unchanged/failed/incomplete/bioUpdated/statusUpdated/pauseReason/nextRunAt`（`enhancedProfileFetchExecutor.ts:40-52`）。
- **落库**：`crates/persistence/src/realtime/jirai.rs:123 profile_feed_reconcile`（事务内取最近 bio/status，变则插 Feed；另有 `:133 …_with_entries`、`:144 …_with_description_policy`）。
- **工作流弹窗**：`syncWorkflowActions.ts:127` 的 `automatic-profile-fetch` + `components/hosts/tools-dialogs/SyncWorkflowDialog.tsx`；Tools 菜单入口 `shared/constants/tools.ts:318-325`（`key:'sync-workflow'`，`action:{type:'dialog',dialogKey:'sync-workflow'}`），弹窗由 `components/hosts/ToolsDialogsHost.tsx:282` 挂载（`:83-85` 懒加载）。
- **后台常驻补全（VRCX-0 独有）**：`crates/composition/src/state/background_ticks/profile_bio.rs:14 run_background_profile_bio_scan`（`scan_detail` `:87` 区分 Baseline/Unchanged/Changed/Deferred/Throttled/Unavailable）+ `crates/persistence/src/profile_bio.rs:112 profile_bio_next_stale_friend`（最旧 `checked_at` 优先）。
**缺口**：① `syncWorkflowActions.ts:121/133` 的 `manual-relations-sync` 与 `relationship-recommendations` 两个动作仍是 `skippedAction` 桩（推荐实际由 `registerEnhancedRelationshipRecommendations`（`:140`）并行任务驱动）；② jirai 的 Bio 清空突发清理（#12）未迁；③ backlog `:153` 标注「启动／周期资料抓取与进度 — 已接入，待实测」——真机验收未闭环。
> **v3 已删除的 v2 说法**：「250ms 节流（`profileFetchExecutor.ts:12`）」——`README.zh-CN.md:103` 与 backlog `:14` 明确记载人为间隔／并发上限已于 2026-10-13 移除，现行代码里无该常量；「没有 jirai 那种 StatusBar 常驻进度」「没有未启动时预览目标总数」——两条均被 `EnhancedInfoFetchStatus` 与 `getEnhancedInfoFetchTargetCounts` 推翻；`profileFetchExecutor.ts:46/136`、`:61-82` 行号全部失效（文件仅 48 行）。

### #6 Bio Diff

**根入口**：Info Tab 注册 `UserDialog.vue:129`、挂载 `:24`（import `:114`）；弹窗容器 `MainLayout.vue:60 → MainDialogContainer.vue:29`；开关按钮 `UserDialogInfoTabJirai.vue:199-206`；渲染分支 `:178-182`；默认开启 `bioDiffEnabled = ref(true)` `:563` + 打开即载 `:608-623`。

**建立基础**：表 `{prefix}_feed_bio(created_at, user_id, display_name, bio, previous_bio)`（`index.js:71`）；查询 `feed.js:111 getRecentBioChangesForUser`、`:50 getLastBioChangeForUser`；写入 `feed.js:37`；记录服务 `bioHistoryCoordinator.js:30 recordBioObservation`；三个上游写入口 `userEventCoordinator.js:311`、`userCoordinator.js:485`、`nonFriendCoordinator.js:49`。

**VRCX-0 同类语义**：**高**。
- **组件**：`src/components/dialogs/user-dialog/components/UserDialogInfoTab.tsx:664 UserDialogBioPanel`（`:673 showHistory` 默认 `true`，即默认展示历史；`:747-754` 用 `buildInlineBioDiff(previousBio, bio)` 算当前选中历史的差异；`:744 groupBioHistoryRows` 分组）。
- **词级内联 diff**：`src/components/dialogs/user-dialog/bioHistory.ts:71 buildInlineBioDiff`（注释「Build a safe, CJK-aware inline diff without generating HTML」，`:66 tokenizeBio` + `BioInlineDiffSegment` segments；**不拼 HTML**，避免 `v-html` 注入面，这是对 jirai `v-html` 渲染的安全改进）；测试 `bioHistory.test.ts:83`「highlights changed CJK text inline while preserving surrounding text」。
- **历史来源（按对象分流，v3 新发现）**：他人 → `feedRepository.queryFeed({userId: currentUserId, scopedUserIds:[profile.id], filters:['Bio'], maxEntries:50})`（`UserDialogInfoTab.tsx:703-708`）；**自己** → 专用命令 `commands.appSelfBioHistoryQuery`（`:699`）→ `src-tauri/src/commands/local/feed.rs:87 app__self_bio_history_query` → `crates/persistence/src/realtime/self_status_history.rs:62 self_bio_history`（读 `{owner}_self_profile_log`，`realtime/self_profile.rs:7 observe_self_profile_field` 写入）。
- **存储/写入**：`feed_bio` 表 `realtime/schema.rs:74`；写入 `realtime/jirai.rs` 的 reconcile（`:123`）；历史回填 `runtime-host-desktop/src/feed_logger.rs`。
**缺口**：① 展示形态是 Info 页内的「历史选择 + 内联 diff」，不是 jirai 的「打开面板即刷新 24h 基线」；jirai 的 `bioDiffEnabled` 开关按钮（`UserDialogInfoTabJirai.vue:199-206`）在 VRCX-0 无对应开关（历史默认开启，有 `showHistory` 状态位）；② 自身 Bio 的旧数据补迁：backlog `:16` 记录「旧版自身历史补迁」为 **2026-10-16 新增待实现**（jirai 把自身 Bio/灯色/状态短语存在通用 Feed 表，VRCX-0 只读 `self_profile_log`，迁入的旧记录会缺失）。
> **v3 已删除的 v2 说法**：「`UserDialogInfoTab.tsx:706 buildLineDiff(replaceBioSymbols(...))`、`:790` 渲染增删行」「行级而非词级」「无词级高亮」——`UserDialogInfoTab.tsx` 已不引用 `buildLineDiff`（该函数现仅被 `shared/utils/string.ts` 与 `features/charts/historyUtils.ts` 使用）；词级内联 diff 现已存在。

### #7 自动跟随 ⚠️

**根入口**：**全部空转，且是作者主动下线**。对话框确实挂在 `MainLayout.vue:86,131` 并绑定 `isAutoFollowDialogOpen`；coordinator `autoFollowCoordinator.js:3-7`；唯一调用 `openAutoFollowDialog()` 在 `FriendsSidebar.vue:272-277`，而 `toggleAutoFollow` 的唯一触发 `@click` 位于 `:203-211` 的 **HTML 注释内**——该注释由 **`3a5c269e`（2026-04-04，FuLu糖福禄，「隐藏"自动跟随"按钮」）** 有意加入。另有死代码 `stores/autoFollow.js:16,71 openDialog()`（全仓零调用）。
**兜底排查**：无设置项、无快捷键、无右键菜单、无 Dashboard panel、无 updateLoop 动作。

**建立基础**：`stores/autoFollow.js:12-16` 状态；`:20,37-52 startFollow` 对 `friend.ref.location` 注册 watch；`:45-50` 跳房 `tryOpenInstanceInVrc` / `QuitGame` + `launchGame`；`AutoFollowDialog.vue:104`。**无任何数据库表**（纯内存，重启失效）。

**VRCX-0 同类语义**：**无**。`src/`、`crates/`、`src-tauri/` 下 `autoFollow`/`auto_follow`/`tryOpenInstance`/`followFriend` 零命中（仅 `docs/` 提及）；只有手动动作 `src/components/instances/useInstanceActionBarController.ts:270 launchInstance`、`:282 openInstanceInGame`。
**产品状态**：`docs/jirai-feature-backlog.md:198` 将「自动跟随并启动／重启 VRChat」列为**暂缓**；`docs/jirai-port/评审结论与迭代计划.md:72` 保留旧行为分析；`docs/jirai-port/执行任务/11-自动跟随好友实例.md` 保留设计参考。→ 这是**有意不做**，不是遗漏。

### #8 状态分布 Tab

**根入口**：模板锚点 `UserDialog.vue:51`；Tab 注册 `:143-149`（条件 `:144` 限「好友或自己」）；点击分发 `:22 → :380-381`；组件内刷新 `UserDialogStatusDistributionTab.vue:12`；自加载兜底 `:449-453`、`:440-447`。

**建立基础**：表 `_feed_status`（`index.js:68`）、`_feed_online_offline`（`:77`，索引 `:80`）；查询 `feed.js:235 getStatusHistoryForUser`、`:257 getOnlineOfflineHistoryForUser`；写入 `feed.js:22`、`:212`；分桶 `statusDistribution` 逻辑在组件 `:128 buildChartData`；`defineExpose` `:417/422`。

**VRCX-0 同类语义**：**高**。
- **计算**：`src/components/dialogs/user-dialog/components/statusDistribution.ts`（`main` 下 **288 行**，合并前 147）：`:3 STATUS_DISTRIBUTION_KEYS`、`:170 buildStatusDistribution`、`:196 STATUS_DISTRIBUTION_COLORS`、`:204 statusBucketDays`、`:221 buildStatusDistributionBuckets`；单测 `statusDistribution.test.ts`。
- **面板（v3 更正位置）**：已拆成独立文件 `UserDialogStatusDistribution.tsx`（`:50 UserDialogStatusDistribution`），在 `UserDialogInfoTab.tsx:78` 以别名 `UserDialogStatusDistributionPanel` 重新导出；**挂在「Activity」标签**：`UserDialogDataTabs.tsx:612-628 UserDialogActivityTab` 先渲染 `<UserDialogStatusDistribution profile={profile} active={active} />`（`:624`）再渲染 `<UserActivityPanel>`（`:625`）。
- **数据来源（按对象分流）**：`statusDistributionQuery.ts:10 queryStatusDistributionHistory`——**自己** → `commands.appSelfStatusHistoryQuery`（`:20`，Rust `realtime/self_status_history.rs:11 self_status_history`，对应 jirai `cf942bd0 enable self-tracking`）；**好友 / 追踪非好友** → Feed 的 `['Status','Online','Offline']` 游标分页（`:28-34`，页大小 `STATUS_HISTORY_PAGE_SIZE = 1000`，`:5`）。
**缺口**：① 非独立 Tab，而是 Activity 标签内的一块面板（jirai 在 `UserDialog.vue:51` 的 `#status-distribution` 插槽与 `:144-147` 注册独立 `status-distribution` Tab，条件为「`isFriend || id === currentUser.id`」，即限定好友或自己；`:380` 在切到该 Tab 时调 `loadStatusDistribution`）；② backlog `:79` 标题「个人及好友的在线灯色分布 — 他人图表已接入，**自身采集仍待查**」，即自身灯色的数据采集链路未闭环；③ jirai 旧自身历史的补迁见 #6 缺口②。
> **v3 已更正的 v2 说法**：「面板 `UserDialogInfoTab.tsx:862`（挂载 `:1244`）」「数据 `queryFeedUserHistory`」——位置与数据源均已变（见上）。「只覆盖 4 种标准状态」**经核实成立且是对齐 jirai 的设计**：`statusDistribution.ts:3-8 STATUS_DISTRIBUTION_KEYS = ['join me','active','ask me','busy']`，与 jirai `infoFetchCoordinator.js:199 validStatuses` 白名单完全一致，不应当作缺口。

### #9 Feed 拖放上传

**根入口**：Feed 容器四事件 `Feed.vue:5-8`；遮罩 + 5 投放区 `:11-23`、`:155-161`；落点判定 `:180-187`；写 store 并跳页 `:208-219`；Gallery 消费 `Gallery.vue:745-759`（处理器表 `:1333-1339`）；Gallery 自身 5 个分栏 drop `:65/148/231/378/445`；路由 `router.js:132-133`。

**建立基础**：`stores/gallery.js:78 pendingDrop`、`:138 showGalleryPage`、`:660-664` 导出；上传函数 `Gallery.vue:913/981/1078/1130/1168`；外部 API `api/vrcPlusImage.js:26/45/87/115`、`api/vrcPlusIcon.js:45`；`readFileToBase64Str` 前置校验 `:1254-1260`。

**VRCX-0 同类语义**：**高（命名不同，流程等价）**。`features/feed/components/FeedImageDropOverlay.tsx`：`:13-19 FEED_IMAGE_DROP_TARGETS = ['gallery','icons','emojis','stickers','prints']`（5 个目标）、`:119 onFileDragDrop`（Tauri 原生文件拖放，非浏览器 `drop` 事件）；拖放后经路由 state 跳转 `FeedPage.tsx:35 state:{ feedImageDrop:{ file, target } }`；Gallery 页接收 `features/tools/useFeedImageDropIntake.ts:24 readFeedImageDrop`（校验 `File` 与目标合法）→ `useFeedImageDropIntake`（`:53`）在 `enabled && …` 时调用 `openCropRequest(file, target, authTarget)` **进入 Gallery 裁剪流程**，并在同一次导航里清除 router state（注释：避免刷新/返回重复打开）；消费入口 `useGalleryPageController.ts:140`，`enabled = Boolean(currentUserId) && !cropRequest && !uploadingTab`，并传入 `isVrcPlusSupporter`（会员门控）；文件校验 `validateImageFile`（`inventoryHelpers`）。
**状态/缺口**：`docs/jirai-feature-backlog.md:127` 小节标题仍为「无会员无反馈，入口待修」，但同文件 `:14` 记录「无会员拖入图片也能打开准备入口并提示权限」已完成代码修复、**等待实机复测**——即代码已改、验收未闭环。jirai 原版是「Feed 拖入 → 选分类 → 跳 Gallery 监听 `pendingDrop` 上传」，VRCX-0 把「上传」换成了「Gallery 裁剪流程」，是形态变化而非缺失。
**缺口**：没有「拖进 Feed 直接发帖」通道，落地到 Gallery 上传队列后复用。

### #10 假记录注入

**根入口**：底部「添加记录」按钮 `PreviousInstancesInfoDialog.vue:124-133`（`:disabled="!manualAddUserId"`）；配对选择器 `:104-123`（分组构造 `:186-216`）；对话框挂载 `MainDialogContainer.vue:41-42`、`:77`；打开入口 `stores/instance.js:327`（调用方 `Location.vue:340/395`、`PreviousInstancesListDialog.vue:196`、`WorldDialogInstancesTab.vue:42`）。

**建立基础**：`handleAddFakeRecord()` `:217`；时间戳 `:231-244`（取本账号该 location 最后加入时间，否则 `Date.now()`；离开 = `joinMs + 5000`）；落库 `gameLog.js:139 addGamelogJoinLeaveToDatabase`（`INSERT OR IGNORE`），调用 `:249`/`:258`；表 `gamelog_join_leave`（`index.js:182`，`UNIQUE(created_at,type,display_name)` `:185-191`）；查询 `gameLog.js:390 getLastJoinTimeForUserAtLocation`；刷新 `:267-269 → :438`。

**VRCX-0 同类语义**：**低（有管道无入口）**。命令 `commands/local/game_log.rs:36 app__game_log_entries_add`；枚举 `contracts/src/game_log.rs:4 GameLogWriteKind`（含 `External`/`Event`）；host `local_data.rs:604`；前端：通用封装 `gameLogPersistenceRepository.ts:75 addGameLogEntries`（调 `commands.appGameLogEntriesAdd`，`:79`），`:183 addGamelogEventToDatabase`、`:187 addGamelogExternalToDatabase`——对 `src/` 非测试代码搜索 `addGamelog(JoinLeave|External|Location)ToDatabase` 与 `appGameLogEntriesAdd`，除上述封装自身与生成绑定 `bindings.ts:228` 外**无任何 UI 调用方**。
**缺口**：无 UI、无来源模型（没有 `source`/`isFake`/`injectedBy` 字段）。要复刻 PreviousInstances 手动插记录，得补整条交互。**产品状态**：`docs/jirai-feature-backlog.md:198` 明列「暂缓：手动插入实例进出记录」；`docs/jirai-port/reports/合成历史记录.md` 结论为「**暂不实现**，进行任何 UI 移植前需先建立完整性契约」，并给出了前置设计——不得把通用写入命令直接暴露给 UI；需专用命令 + `provenance = manual_synthetic`、作者时间、可选原因；仅当前所有者可创建/删除；查询须显式选择是否包含合成行，默认分析/推理路径排除；需确认对话框、可见标记、审计时间戳、导出标注。该报告中带有用户批注（认为合成本意是补全数据、避免数据更乱）但**结论未改**。→ 这是**有意暂缓且已有设计门槛**，所以「无来源模型」是刻意留空，不是遗漏。
> **v3 已更正**：v2 称「`addGamelogExternalToDatabase` 全仓零调用方」——准确说法是该方法与 `addGamelogEventToDatabase`、通用 `addGameLogEntries` 一起构成未被 UI 使用的写入封装；v2 引用的 `bindings.ts:819` 行号已变为 `:228`。

### #11 启动静默加群

**根入口**：登录 watch `stores/group.js:85-99`（`initUserGroups()` `:97`，`flush:'sync'`）；`loadCurrentUserGroups()` 末尾 `groupCoordinator.js:586/639`；判定与调用 `:665-668`；硬编码群 `:664 grp_44b87c7b-00a6-4ef1-9980-0eddf3c7f06d`；设置开关 `AdvancedTab.vue:28-30`。

**建立基础**：默认值 `settings/advanced.js:74 ref(true)`；持久化 `:173 getBool('VRCX_autoJoinGroupCertification', true)`（解构 `:123`，回填 `:221`）；写回 `:673-678`；API `api/group.js:135 joinGroup`；成功后 `:669-682` 重拉群组；失败 `:687-689` 只 `console.warn`（吞异常、无提示）。

**VRCX-0 同类语义**：**高（v3 复核确认）**。
- **逻辑**：`src/features/my-groups/useMyGroupsPageState.ts:120-142`：`defaultGroupId = 'grp_44b87c7b-00a6-4ef1-9980-0eddf3c7f06d'`（与 jirai 同 ID），`shouldAutoJoin = preferencesHydrated && autoJoinGroupCertification && !已加入 && !autoJoinAttemptedUserIdsRef.current.has(currentUserId)`（`:85` 防重复尝试 ref），`:133-134` 调 `groupProfileRepository.joinGroup({ groupId: defaultGroupId })`，成功后 `getUserGroups` 重拉；账户切换/过期响应有保护（测试 `useMyGroupsPageState.test.tsx:236`「does not join from a stale account group response」）。
- **偏好键（v3 更正：键存在且与 jirai 同名同默认）**：`VRCX_autoJoinGroupCertification`，`services/preferences/preferenceSnapshotLoader.ts:291 configRepository.getBool('VRCX_autoJoinGroupCertification', true)`；默认值 `state/preferencesStore.ts:350 autoJoinGroupCertification: true`；设置页开关 `features/settings/components/settings-tabs/SettingsAdvancedTab.tsx:117`。→ 因键名与默认值都沿用 jirai，**从 jirai 迁移配置的用户，该开关设置会被自然继承**。
- **底层 API**：`crates/application/src/social/groups/service.rs:514 join_group`（向 `execute_group_api` 传命令标识 `"app__vrchat_group_join"`）、前端 `repositories/group-profile/members.ts:106 joinGroup`。
- **产品决策已落文档**：`docs/jirai-feature-backlog.md:198/205` 记录「开发者群自动加入已实现且用户选择默认开启，不再列为待决定项」；`README.zh-CN.md:91` 向用户明示默认开启及关闭方法。
**缺口 / 行为差异**：**触发时机不同**——jirai 在 `getCurrentUserGroups()`（登录后群组加载完）即触发；VRCX-0 的 `useMyGroupsPageState` **仅被 `MyGroupsPage.tsx:75` 使用**，所以必须**进入「我的群组」页并完成偏好水合后**才会尝试加入（`README.zh-CN.md:91` 原文亦如此描述）。若用户从不打开该页，则不会自动加入。
> **v3 已删除的 v2 说法**：「无启动自动加入」「无 `defaultGroup`/certification 配置键（`configKeys.ts` 只有 `autoAcceptInviteGroups`）」——后者错在只查了 `configKeys.ts`，真正的键在 `preferenceSnapshotLoader.ts`/`preferencesStore.ts`；前者与同一段上方「已实现」自相矛盾。

### #12 Bio 清空突发清理

**根入口**：唯一生产调用点 `infoFetchCoordinator.js:124-140`（`:126 cleanupSuspiciousBioClearBurst(counts.total*3)`）；防重复 `:31 bioCleanupCheckedAccounts`（每账号一次）；触发链 `friendSyncCoordinator.js:32`（L4）、`:80`（初始化）、`stores/friend.js:391`、`updateLoop.js:82`、手动 `StatusBar.vue:326`。

**建立基础**：清理目标 `${prefix}_feed_bio`（`index.js:71`）；删除语句 `feed.js:163-172 deleteBioClearChangesBetween`；检测 `bioHistoryCoordinator.js:84-125 findSuspiciousBioClearBurst`（5 分钟窗口 ≥3 条，**故意忽略 user_id**）；扫描 `feed.js:130 getRecentBioClearChanges`、`:144 getBioClearChangesBefore`（分页 1000）；编排 `:133` 要求 `scanLimit>=3`。

**VRCX-0 同类语义**：**「清理」无；「预防」有**（v3 重新定性）。
- **清理能力：无**。`src/`、`crates/`、`src-tauri/` 下 `bioClear`/`suspiciousBio`/`clearBurst`/`bio_clear` 零命中，没有「检测历史上已被污染的突发清空记录并分页删除」的功能。唯一的 `suspicious` 是好友基线漂移 `crates/application-realtime/src/social_baseline/service/friends/baseline.rs:123 collect_suspicious_friend_ids`，**同名不同义**（判状态不一致/旅行中，与 Bio 无关）。
- **预防能力：有，且在根因处**。jirai #12 清理的污染源是「接口返回缺 `bio` 字段，被当成清空写入 `feed_bio`」（jirai 提交 `198e07f8`「clean suspicious Bio clear bursts」，2026-09-27，已在 master 历史中）。VRCX-0 在写入路径上堵住了它：① 前端 `enhancedProfileFetchRequest.ts:146-148` 仅当 `typeof publicProfile.bio === 'string'` 才带 `bio`；`enhancedProfileFetchExecutor.ts:263 hasBio = typeof profile.bio === 'string'`，调用 `reconcile` 时 `...(hasBio ? { bio: profile.bio } : {})`，缺失则**省略**该字段；② Rust `realtime/jirai.rs:144 profile_feed_reconcile_with_description_policy` 的 `input.bio` 是 `Option<String>`，`bio_updated`（`:186`）仅在 `Some(bio)` 且与上一条可比较内容不同（或此前无记录）时为真，`None` 不会产生任何 Bio 记录；③ 测试 `crates/persistence/src/realtime/jirai/tests.rs:225` 起的 `bio_absent` 用例（提交 `8a9ea7bec`「bio-absent reconcile keeps the latest status description」补强）覆盖缺字段场景；④ `docs/jirai-feature-backlog.md:205` 记录「9 月 18 日缺 Bio 字段被误记为空的旧问题已修复，不再列为下一轮功能阻塞项」。
- **仍遗留的风险**：预防只管**新写入**。若用户把 jirai 的旧数据库迁入 VRCX-0（`README.zh-CN.md` 与 backlog `:16` 讨论的「旧版数据补迁」场景），旧库里**已存在**的突发清空记录不会被清掉。是否需要一次性迁移清理，是产品决策（backlog `:205` 的口径是「不做 CURRENT 旧数据一次性回填」，对 Bio 清理未明说）。
**因此 #12 的移植价值**：从「必须从零实现检测 + 分页删除」下调为「**仅当要处理迁入旧库的历史污染时才需要**」，新写入路径无需再做。
**为什么 VRCX-0 没有 #12（v3 新发现）**：`README.zh-CN.md:85` 的盘点范围「截至 `c8b8f744`（2026-05-20）」早于 #12 的 `198e07f8`（2026-09-27），#12 **根本不在 VRCX-0 的盘点范围内**——不是「评估后不做」。见第 8.6 节的 5 个提交表。

### #13 多账户 V4

**根入口**：登录页多选徽章 `Login.vue:134`（处理 `:317-325`）；多登按钮 `:166-174`（`v-if="selectedAccountOrder.length >= 2"`）；`clickMultiLogin()` `:346-374`（`switchToMerged` `:371`，门控 `:370`）；视图切换 `StatusBar.vue:26`（`selectViewMode` `:553-559`）；hub 初始化 `app.js:30 → accountHub.js:388`；合并视图导航过滤 `NavMenu.vue:343-347`。

**建立基础**：`isMergedView = _state.viewMode === 'merged'`（`accountHub.js:76`，初值 `'primary'` `:43`）；**唯一置 true** 的 `switchToMerged()` `:190-193`；其它模式 `:258/:266/:171-172`；会话对象 `accountSession.js:38`；聚合 `aggregatedView.js:24 mergeFriends`、`:200 lookupAggregatedFeed`（`stores/feed.js:162-168` 门控）。

**VRCX-0 同类语义**：**无**（刻意不做）。只有「已保存账号 + 切换」：`src/services/accountSwitchService.ts`、`components/sidebar/friends-sidebar/AccountSwitcherPopover.tsx`、`features/auth/components/SavedAccountsCard.tsx`；`accountHub`/`aggregatedView`/`AccountSession` 在 `src/`、`crates/`、`src-tauri/` 零命中（仅 `docs/` 提及）；`docs/jirai-port/多账户进程隔离-RFC.md:3` 明写「**仅 RFC，不实现多账户产品**」，且 `:28` 把旧 V4 定性为「反例而非移植源」（`dbVars` 热切换、secondary HttpClient、手拼 UNION 均与进程隔离方案冲突）；`docs/jirai-feature-backlog.md:121-125` 条目 7 标「待独立设计」，其 `:204` 把「单个游戏日志源怎样绑定实际游戏账号」「合并视图重复事件如何去重」列为实施前才需拍板的产品语义。

**⚠️ 可达性缺陷（本轮新发现，严重）**：`accountHub.js` 内有 **9 处 `require()`**（`:224/225/249/317/318/346/347/372/396`），在 Vite ESM 渲染进程里会抛 `require is not defined`，且**全部被 try/catch 静默吞掉**。其中 `:396` 位于 `initAccountHubWatcher()`，而 `setPrimary()` 的唯一调用点正是 `:400`。这意味着主账户可能从未注册进 `sessions`，连带 `hasSecondarySessions`、`allUserPrefixes`、`mergeFriends` 的 `$accountIds` 全部失效——多账户不只是"设计 Draft"，而是**运行链路本身可能是断的**。

### #14 快速搜索 Bio 检索

**根入口**：侧栏搜索按钮 `Sidebar.vue:8`；`Ctrl+K`/`⌘K` `:383-385`（`useMagicKeys`）；对话框挂载 `:319`；`openQuickSearch()` `:390-392` → `quickSearch.js:264-265`；开启副作用 `:177-190`。

**建立基础（注入锚点）**：`quickSearch.js:211-214 supplementWithBioSearch(query, payload.seq)`（函数体 `:219-250`，带 `seq` 防过期）；查询 `feed.js:68 searchBiosByContent(query, limit=10)`（`WHERE id IN (SELECT MAX(id) … GROUP BY user_id)` + `bio LIKE`）；内存索引 `searchIndex.js:20-40`（`bio` 在 `:27`）；worker 兜底 `quickSearchWorker.js:175/188-190`；worker 协议 `:425-437`；主线程懒建 `quickSearch.js:12/27-33`；结果要求 `friendStore.friends.get(bio.userId)` 存在才收录（`:228-230`）。

**VRCX-0 同类语义**：**中（半截，且是产品暂缓）**。
- **有的**：bio 全文检索存在于 **Feed 页**：`crates/persistence/src/feed/query.rs:300`（`display_name LIKE … OR bio LIKE … OR previous_bio LIKE …`），入口 `:460 feed_search_query`，前端 `repositories/feedRepository.ts:137` → `feedPersistenceRepository.searchFeedDatabase`（`:119`）。
- **没有的**：全局快速搜索目录 `crates/application/src/social/quick_search_catalog.rs:111-121 QuickSearchQueryOutput` 共 **7 类**（`friends` / `own_avatars` / `favorite_avatars` / `own_worlds` / `favorite_worlds` / `own_groups` / `joined_groups`），**没有 bio 类别**；前端快速搜索 `components/sidebar/QuickSearchDialog.tsx`、`quick-search/quickSearchHistory.ts`（最近项为「最近打开的实体」）也无 bio 补充。
**缺口**：① 语义不同——jirai `searchBiosByContent` 用 `WHERE id IN (SELECT MAX(id) … GROUP BY user_id)` 只匹配**每人最新一条** Bio；VRCX-0 的 Feed 检索查**历史行（含 `previous_bio`）**，会让同一个人因多条历史重复出现；② 全局快速搜索无入口；③ **产品决策**：`README.zh-CN.md:122` 与 `docs/jirai-feature-backlog.md:95-105` 明确记录「用户 2026-10-02 决定暂不优化搜索，移出近期计划」，且 backlog `:99` 纠正了此前「历史 Bio 检索」的误读——旧版并未遍历全部旧版本 Bio。→ 这是**有意暂缓**，不是遗漏。
> **v3 已更正**：v2 写「`feedRepository.ts:135`」实为 `:137`；「只有 friends/avatars/worlds/groups」实为 7 类（含 favorite 与 own/joined 分拆）。

### #15 更新通道重定向

**根入口**：登录页更新按钮 `Login.vue:6`；NavMenu 事件 `NavMenu.vue:136-139`；SystemTab 变更日志按钮 `SystemTab.vue:47`；通道选择 `vrcxUpdater.js:139-148`（URL 实际取 `:312`）；自动检查开关 `:68-79`、`:102-108`；`ChangelogDialog` 挂载 `MainLayout.vue:90`。

**建立基础（两类 URL 必须区分）**：
- **更新检查端点**（真正请求）：`settings.js:24`（Stable）/ `:29`（Nightly）= `${GITHU_API_URL}/releases` = `https://api.github.com/repos/FuLuTang/VRCX-jirai/releases`，`GITHU_API_URL` 在 `:2`；请求发出 `vrcxUpdater.js:312-321`。上游原值是 `https://api0.vrcx.app/releases/{stable,nightly}`，改动提交 `6fcd325a`。
- **常量外链** `link.js:2-6`（wiki/github/discord 等），只做跳转，不参与更新检查。
- 版本比对剥 `VRCX-Jirai[Nightly] ` 前缀 `vrcxUpdater.js:292-300`；按平台挑 `.exe`/`.AppImage` + `sha256:` digest `:255-290`。

**VRCX-0 同类语义**：**N/A（不适用）**。VRCX-0-jirai 有自己的发版通道（`release.yml` → GitHub Release 草稿），与 jirai 的更新客户端不同源。
**遗留问题**：`REPOSITORY`（`settings.js:1`）、`GITHUB_RELEASES_URL`（`:3`）、`urlLatest`（`:25/:30`）导出后**全库无引用**（死常量）；`link.js` 的 discord 仍指上游 `https://vrcx.app/discord`。

### #16 OLD 互惠历史表（v3 复审补入）

> v1/v2 漏项：该功能没有新增文件（改的是 `mutualGraph.js`、`database/index.js`、`stores/charts.js`、`MutualFriends.vue`、`UserDialogMutualFriendsTab.vue`），v1 的「24 个新增文件」筛选抓不到，v2 的 12 个关键词里也没有 `links_old`。见《新增功能图谱》A16。

**根入口**：关系网 `MutualFriends.vue:1291`（`database.getMutualGraphSnapshotFromOld()`，把历史边并入图）；用户对话框「共同好友」页 `UserDialogMutualFriendsTab.vue:172-173`（`getMutualsForFriendWithDateFromOld` + `getFriendLastFetchedFromOld`），日期徽章 `:59-62`，过期判定 `:128 isLinkStale`（链接日期比该好友最近一次抓取早 **> 1 天** 即灰色，否则绿色）。

**建立基础**：表 `{prefix}_mutual_graph_links_old(friend_id, mutual_id, date, PK(friend_id, mutual_id))`（`database/index.js:155`，引入于 `1d9cd77c` 2026-03-27 copilot）；`services/database/mutualGraph.js`（373 行）7 个 `*Old` 函数（`:156/178/195/240/263/275/304`）；写入 `stores/charts.js:221-222`（单好友）、`:413-415`（整批）；`manualRelations.js:163-170` 第 4 路输入（旧互惠快照，#3b 依赖它）。**写入语义**：`mergeMutualLinksToOld`（`:195-237`）为拼接 SQL 的 `INSERT OR REPLACE … date=now`，**每次都用当前时间覆盖日期，无「观测是否过期」保护**，手写 `replace(/'/g,"''")` 转义。

**VRCX-0 同类语义**：**高，且写入更严**（v3 核实）。
- **表**：`crates/persistence/src/database/schema.rs:291`（同名、同结构、同 PK）；`mutual_graph.rs` 含 `:64 mutual_graph_history_get`（按好友取，`ORDER BY date DESC`）、`:224`（整表读取）、`:402`（`INSERT … ON CONFLICT(friend_id, mutual_id) DO UPDATE SET date = excluded.date WHERE julianday(excluded.date) >= julianday(date) OR julianday(date) IS NULL`——**日期只会前进，不会被更早的观测回退**）、`:431 mutual_graph_observation_archive`（事务内先 `observation_is_stale`（`:413`）判过期，过期则不归档）、`:369 archive_successful_observation`。全部参数化，无字符串拼接。
- **命令**：`commands/local/mutual_graph.rs:33 app__mutual_graph_history_get`；Rust 抓取侧 `application/src/social/mutual_graph_fetch/request.rs:173 deps.store.archive_observation(...)`、`outbound-adapters/src/mutual_graph.rs:21`。
- **前端图**：`repositories/mutualGraphPersistenceRepository.ts:10/15/28/35/71/79/98`（`historicalLinks: Map<key, date>`，同一对取最新日期）→ `lib/mutual-friends/mutualFriendsGraphData.ts:68/114-127`（`historical: true` 边）→ `mutualFriendsSigmaGraph.ts:546-563`（历史边按 0.62 混色淡化、线宽 0.55）。
- **用户对话框「共同好友」**：`components/dialogs/user-dialog/userDialogMutualHistory.ts:10 buildMutualHistoryRows`（46 行，由 `UserDialogDataTabs.tsx:113` 调用）——当前 API 确认的行 `$mutualConfirmed: true`、仅历史行 `$mutualConfirmed: false`，日期取 `$mutualObservedAt` / `link.date`。
**差异**：jirai 的「过期」是**相对该好友最近一次抓取的 1 天阈值**（灰/绿）；VRCX-0 改为**二值确认标记**（本次 API 是否仍确认该共同好友），不再有 1 天阈值。`docs/jirai-feature-backlog.md:205` 记录的用户已定语义「OLD 日期表示最后成功确认时间」与此一致，`:143-151 当前关系普通色、手动绿色、仅历史关系淡普通色` 也与渲染代码一致。**缺口**：未发现行为缺口；jirai 旧库里的 `_links_old` 数据因表名/结构相同，理论上可被直接读取（未做迁移实测，故不下结论）。

---

## 3. 汇总矩阵

> 「等价度」只衡量**代码与入口是否接通且有测试**，不含实机验收结论；VRCX-0 侧实机验收状态以 `docs/jirai-feature-backlog.md` 与 `docs/jirai-port/2026-10-13-实机验收与修复队列.md` 为准（该两份是 2026-10-13/16 的记录，合并后未见更新）。

| # | 功能 | 根入口数 | jirai 可达 | VRCX-0 等价度 | 结论（基准 `main` = `ea3142a47`，v3 回源码核实） |
| --- | --- | --- | --- | --- | --- |
| 1 | 双人关系 | 5 | ✅ | **高** | `TwoPersonRelationshipPageImpl.tsx` **830 行**，仍 `// @ts-nocheck`；数据口径改走 Feed `GPS/Offline`，GameLog 仅补峰值人数 |
| 2 | 关系时间轴 | 6 | ✅ | **高** | `RelationshipTimelinePageImpl.tsx` **506 行**，**已无** `@ts-nocheck`，**已使用** `relationshipHistory.ts` 的 4 个工具；数据口径同样改走 Feed |
| 3 | 手动关系 | 5 | ✅ | **高** | 表与 CRUD 并入 `mutual_graph.rs`（表名不变）；UI `MutualFriendsRelationsManager.tsx`（311 行）；`relationType` 仍固定 `'friend'`（jirai 自己的 3 个调用点也全传 `'friend'`，故非退化） |
| 3b | 推测建议 | 1（对话框）+ 1（弹窗/进房提示） | ✅ | **高** | 算法 `relationshipRecommendationsAlgorithm.ts`（421 行）与 jirai **权重/窗口/惩罚逐项一致**；目录 **11 文件 1486 行**；Rust 进房提醒链路完整；但 backlog 记「推荐确认交互**未通过**实机验收」 |
| 4 | 追踪非好友 | 6 + 定时器 | ✅ | **高** | `tracked_nonfriends.rs` 200 行；缺非好友 Online/Offline 事件流（`jirai.rs:83` 显式拒绝） |
| 5 | 信息抓取 | 4 | ✅ | **高** | 执行体 `enhancedProfileFetchExecutor.ts` 380 行 + 调度 `enhancedInfoFetchService.ts` 400 行；**已有**状态栏常驻进度与目标数预览；`manual-relations-sync` / `relationship-recommendations` 两个工作流动作仍是桩 |
| 6 | Bio Diff | 5 | ✅ | **高** | **词级内联 diff 已有**（`bioHistory.ts:71 buildInlineBioDiff`，CJK 感知、不拼 HTML）；自身 Bio 走 `appSelfBioHistoryQuery`；**数据源已对齐 `/profile` 公开资料接口** |
| 7 | 自动跟随 | 2（空转） | ❌ | **无** | `autoFollow` 全仓 0 命中；jirai 作者 `3a5c269e` 主动隐藏入口，VRCX-0 backlog 标「暂缓」 |
| 8 | 状态分布 | 5 | ✅ | **高** | `statusDistribution.ts` **288 行**；面板在 **Activity 标签**（`UserDialogDataTabs.tsx:624`）；自身走 `appSelfStatusHistoryQuery`；backlog 记「自身采集仍待查」 |
| 9 | Feed 拖放 | 7 | ✅ | **高** | `useFeedImageDropIntake.ts` 113 行；Tauri 原生拖放 `onFileDragDrop` → 5 个目标分类 → Gallery **裁剪流程**（`openCropRequest`），受 VRC+ 门控；backlog 记「待实机复测」 |
| 10 | 假记录注入 | 4 | ✅ | **低** | 有管道无 UI（写入封装无任何 UI 调用方）；`合成历史记录.md` 结论「**暂不实现**，先建完整性契约」 |
| 11 | 启动加群 | 5 | ✅ | **高** | `useMyGroupsPageState.ts:120-142` 完整自动加群；偏好键 `VRCX_autoJoinGroupCertification` 同名同默认 `true`；**触发时机不同**：需进入「我的群组」页（仅 `MyGroupsPage.tsx:75` 使用） |
| 12 | Bio 清理 | 4 | ✅ | **清理无 / 预防有** | 无历史清理；但新写入已在根因处堵住（`input.bio: Option<String>`、缺字段省略、`tests.rs:225` 断言）；仅「迁入 jirai 旧库的历史污染」才需要清理 |
| 13 | 多账户 | 6 | ⚠️ 部分 | **无**（刻意不做） | jirai 侧 `require` 断链；VRCX-0 RFC「仅 RFC，不实现」并把旧 V4 定性为反例 |
| 14 | 快速搜索 Bio | 4 | ✅ | **中（半截，产品暂缓）** | Feed 页有 bio 检索（含 `previous_bio`，会重复出人）；全局快速搜索目录仅 7 类、无 bio；用户 2026-10-02 决定暂缓 |
| 15 | 更新通道 | 5 | ✅ | **N/A** | VRCX-0 有独立发版链 |
| **16** | **OLD 互惠历史表** | 3 + 读写点 | ✅ | **高（写入更严）** | 同名同结构表；`ON CONFLICT … julianday` 日期只前进 + `observation_is_stale`；参数化写入；前端历史边淡化 + 对话框 `$mutualConfirmed` 二值标记 |

**统计（v3，17 个条目 = #1–#16 共 16 个 + 附属项 #3b；与《新增功能图谱》第 6 节同一口径）**：

| 分类 | 条目 | 数量 |
| --- | --- | --- |
| 高等价（代码+入口接通+有测试） | 1、2、3、3b、4、5、6、8、9、11、16 | **11** |
| 中（半截） | 14 | **1** |
| 低（管道在、入口缺） | 10 | **1** |
| 无 | 7、12（清理）、13 | **3** |
| N/A | 15 | **1** |
| 合计 | | **17** |

> 关于 #12：矩阵里记为「无」是指「历史清理功能无」；它的**预防**侧已具备，详见 #12 小节。若按「是否仍需移植」口径，#12 应归入「仅旧库迁移场景才需要」。

**统计口径变迁**：合并前（基准 `3200bc3c7`）为 6 项已完整落地（1/2/3/4/6/8）、2 项能力齐形态异（5/9）、1 项半截（14）、1 项管道齐缺入口（10）、1 项低等价（11）、3 项无等价（7/12/13）。合并后 v2（2026-11-17 白天）为「10 项高 / 1 中 / 1 低 / 3 无 / 1 N/A」，**v3 新增 #16（高）**，故高等价为 11 项。

---

## 4. 关键发现

1. **两处"代码写完但没接上"**：jirai 的自动跟随（入口被作者 `3a5c269e` 主动注释隐藏）、VRCX-0 的假记录注入（Rust 命令 + 仓库封装齐全，无 UI 调用方，且有 `合成历史记录.md` 的「暂不实现」结论）。两者症状相同、方向相反，**且都是有意为之**。
2. **多账户的断链在 jirai 侧**：`accountHub.js` 9 处 `require()` 在 ESM 渲染进程不可用且被静默吞掉，`setPrimary` 链路可能从未跑通。此前判断它是"WIP/Draft"，实际比这更糟。
3. **同步建议的缓存陷阱（jirai 侧）**：`computeSuggestions` 有两条写路径（手动按钮、抓取流程），而 `gameLogCoordinator.js:278` / `userCoordinator.js:684` 只读缓存。理论上若两条写路径都没跑过，进房推荐与用户弹窗提示都会静默不生效——实际因为抓取在登录/重连时自动执行，概率低，但值得记录。
4. **~~VRCX-0 两张图表页是 `@ts-nocheck` 直译文件~~（v3 部分作废）**：现仅**双人页**仍首行 `// @ts-nocheck`；时间轴页已去除，且 `relationshipHistory.ts`（13 个导出）已被时间轴页真正使用 4 个、双人页 1 个。旧说法「5 个导出只有 1 个被使用、工具库是死代码」不再成立。
5. **命名陷阱**：VRCX-0 的 `TelemetryOfflineRecord`（遥测开关枚举）、`suspicious`（好友基线漂移）与 jirai 对应功能**同名不同义**，检索时容易误判。
6. **旧文档的两份副本不一致（v3 校正）**：`docs/jirai-port/旧版功能清单.md` 的 `main` 版第 3 行已加「历史来源审计……本文『当前等价项』和决策列是早期状态」横幅并指向 backlog，因此**不会再误导读者**（但表内仍写「已跟踪的非好友/关系推荐：无等价项」「没有手动边领域」）；而本工作目录（`port` 分支）的那份**没有横幅**且含用户未提交批注（`git status` 显示 `M`）。基于旧文档做决策前，应先确认读的是哪一份，并以 backlog 与本文件为准。
7. **合并带来一处重要升级（2026-11-16）**：#3b 推测建议在 `main`/`ea3142a47` 上已有完整实现，**算法与 jirai 逐项一致**（`instanceWeightMap`、`hardMatch`、180000ms、密度加成、独立率惩罚），并有旧数据回归夹具。这是合并对移植进度影响最大的一项。但 backlog 记「推荐确认交互未通过」——**算法对齐 ≠ 交互验收**。
8. **合并也带来位置漂移**：#3 的 Rust 模块由 `manual_relations.rs` 并入 `mutual_graph.rs`，UI 由 `ManualRelationsControl.tsx` 换成 `MutualFriendsRelationsManager.tsx`；#8 面板从 InfoTab 拆到 Activity 标签；#5 的 `profileFetchExecutor.ts` 只剩 48 行装配。按旧路径/旧行号检索会找不到或找错。
9. **#3b 与 #5 的耦合已核清**：推荐输入来自 `feedRepository.queryRelationshipTimelineHistory`（与 #2 同一来源），推荐计算作为增强抓取的并行任务挂载（`registerEnhancedRelationshipRecommendations`，`enhancedInfoFetchService.ts:140`），而**不是**通过 `syncWorkflowActions` 里那个仍是桩的 `relationship-recommendations` 动作。
10. **（v3 新，且须按 jirai 两条线分开说）Bio 数据源的上游 API 适配**：上游 `defa27fc`（2026-09-16）把 Bio 来源由 `userDialog.ref.bio` 改为 `publicProfileRef?.bio`。
    - **jirai 发布线 `c7eaf00e`：未适配**——`defa27fc` 不在其历史里，`src/` 内 `publicProfileRef` 0 个文件命中，Bio Diff 读 `UserDialogInfoTabJirai.vue:650 userDialog.value.ref.bio`。
    - **jirai 开发线 `bd2f45f0`（pc114514，未推送）：已适配**——`defa27fc` 是其祖先（`merge-base --is-ancestor` 退出码 0），`stores/user.js:189`、`coordinators/userCoordinator.js:377/397/756/792/815` 维护 `publicProfileRef`，`UserDialogInfoTabJirai.vue:558/562/627` 已读 `publicProfileRef?.bio` / `.bioLinks`。
    - **VRCX-0 `main`：已适配**——`enhancedProfileFetchRequest.ts:108-146` 把 `/profile` 公开资料接口当作 canonical Bio 源，403/404 视为「无 bio」而非「空 bio」，且只在 `typeof publicProfile.bio === 'string'` 时携带 bio。
    - 结论：VRCX-0 **领先 jirai 发布线，与 jirai 开发线同向**。移植 #6/#12 时不应回退到发布线的 `ref.bio` 写法；此前文档「jirai 未跟进 `publicProfileRef`」的说法**仅对发布线成立**。
11. **（v3 新）#12 的价值被重新定性**：jirai 清理的污染源（缺 bio 字段被误记为清空）在 VRCX-0 已于写入路径堵住，故 #12 只在「迁入 jirai 旧库」场景才有意义。
12. **（v3 新）数据口径差异是验收盲区**：#1/#2 在 jirai 读 `gamelog_join_leave`，在 VRCX-0 读 Feed `GPS/Offline`。同一对好友的共处时长两边**可能不一致**，这是口径选择而非 bug；若用 jirai 的数字去对账 VRCX-0，会被误报为缺陷。
13. **（v3 新）v1/v2 的功能筛选有系统性盲点**：只靠「新增文件」+ 12 个关键词，漏掉了「只改既有文件」的 #16。后续新增功能核对应改用「`git diff --stat <merge-base>..HEAD` 逐文件审视 + 对每个新表/新配置键单独 grep 上游」。

---

## 5. 移植建议（按结论分流，基准 `main` = `ea3142a47`）

| 类别 | 功能 | 建议（v3） |
| --- | --- | --- |
| 无需动作 | 1/2/3/4/5/6/8/9/16 | 已落地且代码接通；真机验收按 backlog / 验收队列走 |
| ~~需复核等价性~~ → **已核实** | 3b 推测建议 | 权重、硬匹配、180000ms 窗口、密度加成、独立率惩罚、会话内忽略**已逐项核对一致**，不再是待办。**剩余真正的待办**是 backlog `:203` 的产品语义（评分到多少才提示、忽略后何时可重新提示）与 `:87` 的「推荐确认交互未通过」实机验收 |
| 补小口 | 14 快速搜索 Bio | **产品暂缓**（用户 2026-10-02 决定）。若恢复：先决定语义——jirai 是「每人最新一条」，VRCX-0 现有检索含 `previous_bio` 历史行；再给 `quick_search_catalog.rs` 加 bio 类别并按 `MAX(id) GROUP BY user_id` 去重 |
| 补整条（暂缓） | 10 假记录注入 | **已有设计门槛**：`合成历史记录.md` 要求先建完整性契约（`provenance=manual_synthetic`、专用命令、仅所有者可建/删、分析默认排除、确认对话框/可见标记）；不得把通用 `app__game_log_entries_add` 直接暴露给 UI |
| ~~需产品决策~~ → **已决策并已实现** | 11 启动加群 | 默认开启已在 backlog `:205` 定案、`README.zh-CN.md:91` 向用户明示；**唯一遗留是触发时机**（需进入「我的群组」页才触发，jirai 是登录后即触发），是否要提前到登录后，是新的产品决策 |
| ~~纯新增~~ → **按场景** | 12 Bio 清理 | 新写入的污染源已在根因处堵住；**仅当要处理「迁入的 jirai 旧库历史污染」时才需要**从零实现检测 + 分页删除。先问「是否真有人要迁旧库」 |
| 不做 | 7 自动跟随、13 多账户 | 7：jirai 作者自己 `3a5c269e` 主动隐藏入口，VRCX-0 backlog 标暂缓；13：jirai 侧 `require` 断链 + VRCX-0 RFC 明写不实现且视旧 V4 为反例 |
| N/A | 15 更新通道 | VRCX-0 有独立发版链，不适用 |
| 清理 | — | `RelationshipUserPicker.tsx`（`features/charts/components/`，含自带测试）在 `main` 上**无生产代码引用**（仅其测试 `RelationshipUserPicker.test.tsx` 引用），属死代码，可删或替换；删除前须连同测试一起处理 |
| 补小口（新） | 3 relationType | 字段在表里，jirai 自己也只写 `'friend'`（3 个调用点），所以**不必**为对齐 jirai 去做类型 UI；是否要做分层语义是新需求 |
| 补小口（新） | 4 追踪非好友 | 无 Online/Offline 事件流；是否要给追踪对象补事件，需先确认 VRChat 是否对非好友提供该信号（`realtime/jirai.rs:83` 当前显式拒绝） |

---

## 6. 复审：他人改动与上游漂移（2026-11-16）

### 6.1 三仓状态

| 仓库 | 本地 HEAD | 远程最新 | 本地工作区 | 判定 |
| --- | --- | --- | --- | --- |
| `VRCX-jirai` | `c7eaf00e` | `master` = `c7eaf00e` | 干净 | **无他人改动** |
| `VRCX-0-jirai` | `3200bc3c7` | `port/legacy-audit-simple-ui` = `3200bc3c7` | 仅既有批注 + 本轮交付文档 | **无他人改动** |
| `reference/VRCX`（上游镜像） | `20fe6963` | **`bfd91089`** | — | **上游前进 3 个提交** |

结论：**jirai 与 VRCX-0 两个工作仓库都没有被他人改动**，第 2–3 节的锚点与语义映射结论**保持有效**。真正的"他人改动"来自上游 `vrcx-team/VRCX`。

### 6.2 上游新增的 3 个提交

| 提交 | 日期 | 标题 | 改动面 |
| --- | --- | --- | --- |
| `2a6bf927` | 2026-11-15 | Fix bio translate | `UserDialogInfoTab.vue` 1 行 |
| `a7e7dd1f` | 2026-11-15 | Clean up types | 6 个 transforms 文件 + `vrcx.d.ts`（+47/−58） |
| `bfd91089` | 2026-11-16 | Fix tests | 测试 + `*Columns.jsx` 的 import 具名化 |

**是否影响 14 项独有性**：不影响。按关键词逐个比对新增改动的文件清单，`bio` / `relationship` / `tracked` / `manual` / `follow` / `statusDistribution` / `quickSearch` 全部 **0 命中**（注意这里的 bio 命中 0 是因为文件路径不含 bio，实际改动内容见下）。

### 6.3 冲突面：jirai 改过 × 上游新改过

jirai 相对分叉点改动 145 个文件，上游本次改动 53 个文件，**交集 3 个**：

| 文件 | jirai 侧改动 | 上游侧改动 | 合并风险 |
| --- | --- | --- | --- |
| `src/shared/utils/userTransforms.js` | `json.bio` 缺失/null 时 `delete json.bio`，防止误判为"清空 bio" | 移除默认对象里的 `bio: ''`、`ageVerificationStatus` 由 `''` 改 `'hidden'`、去掉 `@type` 注释 | **中**：语义可兼容（jirai 仍删 `json.bio`），但合并后需重新验证"bio 缺失不覆盖缓存"是否仍成立 |
| `src/shared/utils/__tests__/userTransforms.test.js` | 配套测试 | 同批清理 | 低（测试合并） |
| `src/components/dialogs/UserDialog/UserDialogInfoTab.vue` | jirai 保留原版不动，另建 `UserDialogInfoTabJirai.vue` | `ref.bio` → `publicProfileRef?.bio` | **低但需注意**：jirai 用的是独立文件，不会冲突，但见 6.4 |

`PreviousInstancesInfoDialog` 相关 columns 虽被上游改动，但与 jirai 修改的 `PreviousInstancesInfoDialog.vue` 不是同一文件，**不构成冲突**。

### 6.4 能力落后：jirai **发布线**未跟进 `publicProfileRef`

> **v3 更正（2026-11-17）**：本节下列论断**只对发布线 `c7eaf00e` 成立**。开发线 `bd2f45f0` 已跟进（`defa27fc` 是其祖先，`UserDialogInfoTabJirai.vue:558` 读 `publicProfileRef?.bio`），VRCX-0 `main` 也已适配。详见第 4 节发现 10 与第 8.6 节。

- 上游 `defa27fc`「Initial fixes for recent API changes (#1886)」（**2026-09-16**）把 Bio 数据源从 `userDialog.ref.bio` 改为 `userDialog.publicProfileRef?.bio`，用于适配 VRChat 的隐私状态变更。
- **发布线** jirai 历史中**不存在** `defa27fc`，且全仓 `grep publicProfileRef` **零命中**。
- **发布线** jirai 的 Bio Diff 仍在 `UserDialogInfoTabJirai.vue:650` 读 `userDialog.value.ref.bio`（原版 `UserDialogInfoTab.vue:581` 同样未改）。
- **影响**：Bio Diff 可能对"因隐私设置而隐藏 bio"的用户显示错误差异（把"被隐藏"当成"被清空"）。这与 jirai 自己那条 `userTransforms` 保护（"缺 bio 不等于清空"）在意图上一致，但实现层没跟上上游的字段级修复。
- **对移植的含义（v3 已闭合）**：此前留的待确认项「VRCX-0 的 Bio Diff 是否用了 public-profile 字段」**已确认：是**——`enhancedProfileFetchRequest.ts:108-146` 以 `/profile` 为 canonical Bio 源（403/404 视为无 bio）。因此移植 #6 时**不应**照抄 jirai 发布线的 `ref.bio` 写法。（原文所指 `UserDialogInfoTab.tsx:706` 行号已失效，该文件现已不引用 `buildLineDiff`。）

### 6.5 jirai 整体落后程度

`d97327d8..upstream/master` = **410 个上游提交**未跟进（上一轮数字相同，未变化）。其中包含 6.4 这类 API 适配修复，意味着 jirai 的"数据读取方式"层面存在系统性滞后，不只是功能差异。

### 6.6 复审结论

| 检查项 | 结果 |
| --- | --- |
| 14 项功能是否仍为 jirai 独有 | ✅ 是（上游 3 个新提交未引入任何重叠功能） |
| 根入口锚点是否仍成立 | ✅ 抽验 6 处全部成立（自动跟随仍被注释、`accountHub` 9 处 `require`、router 2 条路由、`tracked` tab、`info-completion` 菜单、`Ctrl+K` 2 处注册、加群默认 `ref(true)`） |
| VRCX-0 同类语义是否仍成立 | ✅ 抽验 9 个关键文件全部存在且行数不变（合并**前**基准 `3200bc3c7`：`tracked_nonfriends.rs` 200、`manual_relations.rs` 326、`realtime/jirai.rs` 147、`TwoPersonRelationshipPageImpl.tsx` 729、`RelationshipTimelinePageImpl.tsx` 587、`statusDistribution.ts` 147、`useFeedImageDropIntake.ts` 113、`syncWorkflowActions.ts` 139） |
| 新增需要关注的点 | ⚠️ 3 个冲突文件 + jirai **发布线**未跟进 `publicProfileRef`（2026-09-16 的上游修复；开发线 `bd2f45f0` 与 VRCX-0 已适配，见第 4 节发现 10） |

---

## 7. 合并后基准迁移（2026-11-16，`main` = `ea3142a47`）

### 7.1 背景

2026-11-16 完成全分支合并：5 个来源（`port/legacy-audit-simple-ui`、`codex/v2.28-jirai-port`、`bio-diff`、`sync/upstream-2026-11`、pc114514 的 WIP）合入 `main`，`main` 从 `0b8a63d61` 快进到 `ea3142a47`（+910 提交）。合并报告见 `reports/2026-11-16T2308Z-merge/README.md`。

第 2、3 节中的 VRCX-0 基准已随之更新为 `ea3142a47`。

### 7.2 合并导致的实现位移与能力变化

| # | 合并前（`3200bc3c7`） | 合并后（`ea3142a47`） | 影响 |
| --- | --- | --- | --- |
| 1 | `TwoPersonRelationshipPageImpl.tsx` 729 行 | **830 行**（合入 codex 线选择器） | 等价度仍为高 |
| 2 | `RelationshipTimelinePageImpl.tsx` 587 行 | **506 行**（图表配置内联为 `relationshipChartOption`） | 等价度仍为高 |
| 3 | `crates/persistence/src/manual_relations.rs`（326 行）+ `ManualRelationsControl.tsx` | **模块并入 `crates/persistence/src/mutual_graph.rs`**（表名 `{prefix}_manual_relations_MANUEL` 与 SQL 未变），UI 换成 `MutualFriendsRelationsManager.tsx`（311 行） | 文件路径变了，语义不变 |
| 3b | 半成品存档，未合入 | **完整实现**：`src/features/charts/relationship-recommendations/` **11 文件 1486 行**（evidence 48 / data 141 / service 202 / Panel 183 / 通知设置 67 / 提示组件 168 + 4 套测试 133/201/144/102 + 夹具 97）+ 目录外算法 `relationshipRecommendationsAlgorithm.ts` 421 行 + Rust 进房提醒缓存 183 行 | **等价度：无 → 高**（v2 记为「10 文件 1389 行」，漏计夹具与外置算法） |
| 5 | `syncWorkflowActions.ts` | 同文件（139 行）**+ `enhancedInfoFetchService.ts`（400 行）** | 能力增强 |
| 8 | `statusDistribution.ts` 147 行 | **288 行**，新增 `buildStatusDistributionBuckets` / `statusBucketDays` / `STATUS_DISTRIBUTION_COLORS` | 能力增强 |
| 11 | 前端设置项 | 偏好键与设置页齐备，**自动加群已实现**（`useMyGroupsPageState.ts:120-142`）；v2 此行写「自动 join 调用仍待确认」是核查不足 | **v3 更正**：合并前后均已实现（见 #11 小节） |

**未受影响的项**（以代码为准；v2 此处曾含「6（`UserDialogInfoTab.tsx`）未受影响」，**v3 更正**：#6 的 Bio Diff 实现已是词级内联 diff，见 #6 小节）：4（`tracked_nonfriends.rs` 200）、7（仍无）、9（`useFeedImageDropIntake.ts` 113）、10（写入封装仍无 UI 调用方）、12（无历史清理，但有写入预防）、13（仍不实现）、14（仍无 bio 类别）、15（N/A）。

### 7.3 合并后的上游关系

| 对照 | 值 |
| --- | --- |
| `main` | `ea3142a47` |
| `Map1en/VRCX-0` `master`（VRCX-0 真正上游） | `732ca893d`（2026-11-17） |
| 落后上游 | **11 个提交**（全部 `perf(...)` 渲染优化 + 1 个 `chore(deps)` rmcp 3.9→3.10） |
| 领先上游 | 96 个（jirai 自家改动） |
| 合并基准点 | `35b40308a` |
| `vrcx-team/VRCX`（jirai 对照的上游） | `e819c4e4`（+9 相对 `20fe6963`） |

另注：仓库内存在 `dependabot/cargo/rmcp-3.10.0` 等分支，与上游 `58220c8c5` 同源，后续追上游时注意去重。

### 7.4 合并遗留（来自合并报告第 6 节）

1. `RelationshipUserPicker`（原 `port` 线组件，`features/charts/components/RelationshipUserPicker.tsx`）在 `main` 上**无生产代码引用**（仅其自带测试引用），属死代码，可删或替换为 codex 选择器。
2. `docs/jirai-port/旧版功能清单.md`：`main` 版第 3 行已加「历史来源审计，当前等价项是早期状态」横幅；`port` 分支（本工作目录）的副本无横幅且含用户未提交批注。表内「无等价项」类描述已过期（见第 4 节发现 6）。
3. 旧分支未删除，以 `archive/2026-11-16/*` 五个存档 tag 为准。
4. 版本号不可用于推断血缘（pc 构建副本 2.34.0、codex 线曾 2.31.0）。

---

## 8. jirai 双版本核对（2026-11-16 最新）

### 8.1 为什么有两个「最新」

| 版本 | 位置 | 提交 | 日期 | 状态 |
| --- | --- | --- | --- | --- |
| **发布线** | GitHub `FuLuTang/VRCX-jirai` `master` | `c7eaf00e` | 2026-09-27 | 已发布 2026.9.27；本文档第 1–7 节的行号基准 |
| **开发线** | `pc114514` 本机分支 `codex/vrcx-upstream-through-2026-08-15` | `bd2f45f0` | 2026-10-02 | **266 个提交从未推送**，相对发布线 **711 个文件差异**；另有 16 项未提交改动 |

核对结论：GitHub 侧 10 个分支均无新提交（`master` 仍为 `c7eaf00e`），jirai 的**实际最新代码在 pc114514 的开发线上**，但文档此前从未记录它。

### 8.2 锚点在开发线上的漂移

在 `bd2f45f0` 上逐项复核 15 个锚点，承载文件全部存在，行号有漂移：

| # | 锚点 | 文档值（`c7eaf00e`） | 开发线（`bd2f45f0`） | 漂移 |
| --- | --- | --- | --- | --- |
| 1 | `router.js` `charts/two-person` | `:119-123` | **`:116`** | −3 |
| 2 | `router.js` `charts/timeline` | `:125-129` | **`:122`** | −3 |
| 4 | `Sidebar.vue` `value: 'tracked'` | 存在 | 存在（1 处） | 0 |
| 5 | `tools.js` `info-completion` | `:163-169` | **`:159`** | −4 |
| 7 | `FriendsSidebar.vue` `toggleAutoFollow` | `:272`（调用点在 `:207` 注释内） | **`:271`**，且 `:203-211` 注释块**已不存在** | **入口被删除** |
| 8 | `UserDialog.vue` `status-distribution` | `:52` | `:52`（另 `:157` 注册、`:353` 分发） | 0 |
| 9 | `Feed.vue` `onDrop` | `:208` | **`:210`**（事件绑定 `:8`） | +2 |
| 10 | `PreviousInstancesInfoDialog.vue` `handleAddFakeRecord` | `:131` / `:217` | `:131` / `:217` | 0 |
| 11 | `advanced.js` `ref(true)` / `getBool` | `:74` / `:173` | **`:72` / `:159`** | −2 / −14 |
| 12 | `infoFetchCoordinator.js` `cleanupSuspiciousBioClearBurst` | `:126` | `:126` | 0 |
| 13 | `Login.vue` `addSession` | `:363` | **`:365`** | +2 |
| 14 | `Sidebar.vue` `Ctrl+k` | `:383-385` | **`:405`** | +20 |
| 15 | `settings.js` `GITHU_API_URL` | `:2` | `:2`（`urlReleases` `:24/:29`） | 0 |

**结论**：文档第 2 节的行号只对 `c7eaf00e` 有效；在开发线上取源码必须按上表重新定位，或用 `git grep -n <符号> bd2f45f0 -- <路径>` 现查。

### 8.3 功能完整性

功能的承载文件在 `bd2f45f0` 上**全部存在**（抽查 12 个：`TwoPersonRelationship.vue`、`RelationshipTimeline.vue`、`relationshipTimelineUtils.js`、`stores/manualRelations.js`、`services/database/manualRelations.js`、`stores/trackedNonFriends.js`、`services/database/trackedNonFriends.js`、`bioHistoryCoordinator.js`、`UserDialogInfoTabJirai.vue`、`UserDialogStatusDistributionTab.vue`、`stores/autoFollow.js`、`ProfileCompletionDialog.vue`）。因此**功能清单与「功能是否存在」的结论在两版上一致**。
**但（v3 更正）「差异只在行号」不准确**：除行号外，两版至少还有一处**行为/数据源差异**——Bio 数据源的 `publicProfileRef` 适配（见 8.6）。开发线相对发布线有 266 个提交、711 个文件差异，其余行为差异**未逐一核对**，本文不做「两版行为一致」的断言。#16（OLD 互惠表）在开发线上**存在**（v3 核验：`bd2f45f0` 的 `services/database/index.js`、`manualRelations.js`、`mutualGraph.js`（4 处）含 `links_old`，`stores/charts.js:363` 调 `mergeMutualLinksToOld`；开发线 `charts.js` 行号较发布线 `:413` 前移 50 行）。

### 8.4 #7 自动跟随的状态变化（两版都不可达，但形态不同）

| 版本 | 状态 |
| --- | --- |
| `c7eaf00e`（发布线） | 触发按钮块 `FriendsSidebar.vue:203-211` **被 HTML 注释保留**，样式 `:993-1024` 成为孤立死代码 |
| `bd2f45f0`（开发线） | 该注释块**已被删除**；`toggleAutoFollow`（`:271`）、`openAutoFollowDialog`（coordinator `:5`、FriendsSidebar `:275`）仍在，但**没有任何调用点**，`auto-follow-btn` 只剩 `:989-1003` 的样式 |

即：开发线是"注释清理"而非"功能恢复"，自动跟随在两条线上都不可达，移植判断（不做）不变。

### 8.5 未提交改动

`pc114514` 的 VRCX-jirai 工作区有 **16 项未提交改动**（本轮复核数量未变，仍为 16）。其内容未逐文件核对——本文件不对其做任何结论，仅记录其存在。

### 8.6 开发线已适配 `publicProfileRef`（v3 新增）

| 对象 | `defa27fc`（上游 2026-09-16）是否在历史中 | Bio 读取位置 |
| --- | --- | --- |
| jirai 发布线 `c7eaf00e` | ❌ 否（`src/` 内 `publicProfileRef` 0 命中） | `UserDialogInfoTabJirai.vue:650 userDialog.value.ref.bio` |
| jirai 开发线 `bd2f45f0` | ✅ 是（`merge-base --is-ancestor` 退出码 0） | `UserDialogInfoTabJirai.vue:558 userDialog.value.publicProfileRef?.bio`、`:562 .bioLinks`、`:627` 监听 `publicProfileRef`；`stores/user.js:189` 初值、`userCoordinator.js:377/397/756/792/815` 维护 |
| VRCX-0 `main` | 不适用（不同代码库） | `enhancedProfileFetchRequest.ts:108-146`：调 `appVrchatUserProfileGet`，`/profile` 为 canonical Bio 源，403/404 → 无 bio（不是空 bio） |

含义：「jirai 没跟进上游 `publicProfileRef`」不能笼统地说——**它只对被 GitHub 发布的 `c7eaf00e` 成立**。把 jirai 当蓝图时，若蓝图取自 pc114514 开发线，则 Bio 数据源一侧与 VRCX-0 同向；若取自 GitHub master，则 VRCX-0 比蓝图新。这是「以哪一版 jirai 为蓝图」没被钉死的一个具体后果。

> **v3.1 更新（2026-11-18T00:53Z）**：此问题已有决议，见 `docs/jirai-port/计划/Rust重写路线/README.md` 第 1 节——**后续开发蓝图 = `c7eaf00e`；前期移植的历史对照 = `c8b8f744`（另一会话 `e7126849` 的结论，已被独立复核）；pc 开发线 `bd2f45f0` 不作蓝图**。本文第 2 节的 jirai 行号仍以 `c7eaf00e` 为准，与该决议一致。

**文档里实际存在的唯一版本锚点**（v3 更正：此前记作「无任何版本约束」，不准确）：`README.zh-CN.md:85` 写明盘点范围「截至 `c8b8f744`」——即发布线内的提交 `c8b8f744`（2026-05-20，FuLuTang，「Update version from 2026.4.21 to 2026.5.20」）。`JIRAI_移植说明.md` 与 `docs/jirai-port/` 下计划文档中仍未发现对 jirai 提交的钉定。

**该锚点早于发布线最后 5 个提交**（`git log c8b8f744..c7eaf00e`，均为 2026-09-27）：

| 提交 | 标题 | 与本图谱的关系 |
| --- | --- | --- |
| `74763ca4` | fix: ignore invalid Bio payloads in history | 与 #12 同源的 Bio 缺字段问题修复 |
| `6fbbafa9` | Merge branch 'feat/multi-account' | #13 多账户再次并入 master |
| `198e07f8` | feat: clean suspicious Bio clear bursts | **#12 本体** |
| `2d6ed70a` | chore: bump release version to 2026.9.27 | 版本号 |
| `c7eaf00e` | fix: align release artifact filenames | 发布产物命名 |

→ **#12 发生在 VRCX-0 盘点截止点之后，因此它从未进入 VRCX-0-jirai 的核对范围**。「#12 无」不是「盘点后判定不做」，而是「盘点范围根本没覆盖它」。这也解释了为什么 `README.zh-CN.md` 的还原核对表里没有 Bio 清理一行。

---

## 9. v3 复审记录（2026-11-17T23:23Z 接手复审）

### 9.1 方法

- **VRCX-0 侧**：对第 2 节中每一条 VRCX-0 侧引用，回到 `main` = `ea3142a47` 的工作树（`/home/fulutang/Documents/Github/VRCX-0-jirai-integrate`）逐条 `Read`/`Grep`/`sed` 核对（本轮新写或改写的段落全部如此）。
- **jirai 侧**：**只做抽验，不是逐条重核**。已核的有：6 个文件的总行数（`TwoPersonRelationship.vue` 540、`RelationshipTimeline.vue` 589、`infoFetchCoordinator.js` 242、`UserDialogStatusDistributionTab.vue` 458、`accountHub.js` 413、`stores/manualRelations.js` 395）、`FriendsSidebar.vue:203/211` 注释块、`advanced.js:74`、`router.js:119/125`、`#7/#11/#15/#16` 相关的若干行、`relationType` 全部调用点、`6fcd325a`/`3a5c269e`/`1d9cd77c`/`198e07f8`/`c8b8f744` 提交的存在与内容、`UserDialog.vue:51/144-147/380`。**第 1 节注册表与第 2 节各小节「根入口/建立基础」里其余 jirai 侧行号沿用 v2，本轮未逐条重核**；这些行号只对 `c7eaf00e` 有效。开发线 `bd2f45f0` 侧通过 ssh `git grep` 核对了第 8 节所列锚点、`publicProfileRef`、`links_old`。
- 四个远程在复审当刻（23:23Z）经 `git ls-remote` 复核**均未变化**：jirai `master` = `c7eaf00e`、VRCX-0 `origin/main` = `ea3142a47`、`Map1en/VRCX-0` = `732ca893d`、`vrcx-team/VRCX` = `e819c4e4`。
- 严格只读：未对任何仓库做 checkout/commit/写入；仅编辑交付文档。
- **自查**：写作过程中我曾引用 v2 遗留的一个行号（`tools.ts:316`）而未核对，复核时发现该行是 `},`，已改为真正入口 `tools.ts:318-325` + `ToolsDialogsHost.tsx:282`；另曾把 `bio_updated` 行号写成 `:174-177`（实为 `:186`）、`hasBio` 写成 `:263-264/280`（实为 `:263`），均已更正。教训：转抄旧行号会把错误带进新版本，所以 VRCX-0 侧我一律回源码核了；jirai 侧未核的部分在上面如实列出，**不能把它们当作已被本轮背书**。

### 9.2 勘误总表（v2 说法 → v3 实测）

| # | 位置 | v2 说法 | v3 实测 | 证据 |
| --- | --- | --- | --- | --- |
| 1 | #1/#2 行号 | `:195/:55/:109/:191`；`:65 buildTimelineRows`、`:46 splitDurationByDay` | 双人页 `:128/:182/:258/:262`；时间轴页 `:49/:53/:66/:190`，`buildTimelineRows`/`splitDurationByDay` 已不存在 | `Grep` 两个 `*PageImpl.tsx` |
| 2 | #1/#2 缺口 | 「`relationshipHistory.ts` 5 个导出仅 1 个被使用，工具库是死代码；时间轴页同样 `@ts-nocheck`」 | 13 个导出；时间轴页引入其中 4 个，双人页 1 个；**仅双人页**首行 `@ts-nocheck` | `relationshipHistory.ts:5-353`、时间轴 `:29-34` |
| 3 | #1/#2 数据口径 | 未提 | 双人页：共处会话走 Feed `GPS/Offline`，GameLog 仅补峰值人数；时间轴页：`queryRelationshipTimelineHistory` 分页读 Feed `GPS+Offline`；jirai 读 `gamelog_join_leave`。**口径不同** | `TwoPersonRelationshipPageImpl.tsx:302/356/362/432`、`feedRepository.ts:169/192` |
| 4 | #3 叠加 | `mutualFriendsGraphData.ts:151 overlayManualRelations` | 该函数不存在，叠加在 `:161-175` | `mutualFriendsGraphData.ts:161` |
| 5 | #3 relationType | 「jirai 的类型是有语义分层的」 | jirai 3 个写入调用点全传 `'friend'`，无类型 UI | `ManualRelationsDialog.vue:260/292`、`userCoordinator.js:755-758` |
| 6 | #3b 规模 | 10 文件 1389 行 | 11 文件 1486 行 + 目录外算法 421 行 + Rust 缓存 183 行 | `wc -l` |
| 7 | #3b 缺口 | 「权重/忽略语义是否等价待确认」 | 权重/窗口/惩罚/忽略**逐项一致**，另有旧数据回归夹具 | `relationshipRecommendationsAlgorithm.ts:157-167/195/341/356` |
| 8 | #4 行号 | 命令 `:25/:38`、store `:51`、`SidePanel.tsx:463`、`UserDialogHeaderActions.tsx:177`、`…RefreshExecutor.ts:142` | `:26/:40`、`:52`、`:456`、`:214`、`:178/:197` | `Grep` |
| 9 | #5 执行体 | `profileFetchExecutor.ts:46/136`、250ms 节流 | 该文件仅 48 行；执行体在 `enhancedProfileFetchExecutor.ts`（380 行）；无 250ms 常量（`RETRY_INTERVAL_MS=3000`）；backlog 记人为间隔已移除 | `profileFetchExecutor.ts`、`README.zh-CN.md:103` |
| 10 | #5 缺口 | 「无 StatusBar 常驻进度」「无目标总数预览」 | 两者**均存在** | `StatusBarFooter.tsx:113`、`enhancedInfoFetchService.ts:95` |
| 11 | #6 | 「行级而非词级」「`UserDialogInfoTab.tsx:706 buildLineDiff`」 | 词级内联 diff（CJK 感知，不拼 HTML）；InfoTab 已不引用 `buildLineDiff`；自身 Bio 走专用命令 | `bioHistory.ts:71`、`UserDialogInfoTab.tsx:699/747` |
| 12 | #7 成因 | 「入口被注释」 | 作者 `3a5c269e`（2026-04-04）**主动隐藏**；VRCX-0 backlog 标暂缓 | `git show 3a5c269e`、`jirai-feature-backlog.md:198` |
| 13 | #8 位置/数据 | 面板 `UserDialogInfoTab.tsx:862`；数据 `queryFeedUserHistory` | 面板在 **Activity 标签**（`UserDialogDataTabs.tsx:624`）；自身走 `appSelfStatusHistoryQuery`，他人走 Feed 分页 | `statusDistributionQuery.ts:10-34` |
| 14 | #10 | 「`addGamelogExternalToDatabase` 全仓零调用方」；`bindings.ts:819` | 写入封装整体无 UI 调用方；绑定行号 `:228`；`合成历史记录.md` 结论「暂不实现」 | `gameLogPersistenceRepository.ts:75/183/187` |
| 15 | #11 | 同文档内三处互相矛盾：「高」「无启动自动加入」「调用路径待确认」 | 已实现；偏好键 `VRCX_autoJoinGroupCertification` 存在（v2 只查了 `configKeys.ts`）；触发时机为进入「我的群组」页 | `useMyGroupsPageState.ts:120-142`、`preferenceSnapshotLoader.ts:291` |
| 16 | #12 | 「无任何等价物，需从零实现」 | 清理无、**预防有**（`Option<String>` + 缺字段省略 + 测试断言）；且 #12 在 VRCX-0 盘点截止点之后，从未被盘点 | `realtime/jirai.rs:144/186`、`tests.rs:225`、`README.zh-CN.md:85` |
| 17 | #14 | 快速搜索目录「只有 friends/avatars/worlds/groups」；`feedRepository.ts:135` | 7 类；`:137`；产品暂缓（2026-10-02） | `quick_search_catalog.rs:111-121` |
| 18 | #15 | 锚点只写 `link.js` | 真正生效的更新端点在 `settings.js:2/24/29`（`6fcd325a`） | 《图谱》A15 |
| 19 | **漏项 #16** | 未列 | OLD 互惠历史表（`mutual_graph_links_old`，`1d9cd77c`）jirai 独有、VRCX-0 有更严实现 | 《图谱》A16、第 2 节 #16 |
| 20 | 第 6.4/8 节 | 「jirai 未跟进 `publicProfileRef`」 | **仅发布线成立**；开发线 `bd2f45f0` 已适配 | 第 8.6 节 |
| 21 | 第 7.4 / 发现 6 | 「`旧版功能清单.md` 仍在误导」 | `main` 版已加「历史来源审计」横幅；`port` 分支副本无横幅且有未提交批注 | `diff` 两份副本 |
| 22 | 版本锚点 | 「无任何文档钉定 jirai 版本」 | `README.zh-CN.md:85` 钉定「截至 `c8b8f744`」，且早于发布线最后 5 个提交 | 第 8.6 节 |
| 23 | 发现 4/统计 | 「14 项」「9 项高等价」 | 17 个条目；11 项高等价（+#11 +#16） | 第 3 节 |

### 9.3 本轮**未做**、不下结论的事项

- jirai 开发线 `bd2f45f0` 上除 `publicProfileRef` 与 #16 存在性外的**行为差异**（266 提交 / 711 文件）。
- pc114514 的 16 项未提交改动的内容。
- 用 jirai 旧数据库在 VRCX-0 上做迁移实测（`_links_old` 同表名同结构，仅为静态比对）。
- 任何**实机验收**结论：本文件的「高等价」只代表代码与入口接通且有测试。
- 两个未提交的 `docs/jirai-port/旧版功能清单.md` 用户批注：只读未动。

---

> **2026-11-18T04:15Z 基线口径更新：现统一以 GitHub VRCX-jirai 主分支 `refs/heads/master` @ `c7eaf00e`（相对上游 VRCX 的差分 `d97327d8..c7eaf00e`）为唯一差分参考基线，`c8b8f744` 不再作为「历史对照」基线。决议见 `docs/jirai-port/计划/Rust重写路线/README.md` 第 1.0 节。**本文 jirai 侧锚点本来就以 `c7eaf00e` 为准，无需重做；第 4 节「#12 不在盘点范围内」现应读作「旧盘点截止于 `c8b8f744` 所以漏了它」，#12 属于基线内的未完成项。

> **2026-11-18T04:43Z 补充：VRCX-0-jirai 侧基线冻结在 pc114514 的 `ea3142a47`**（`C:\Users\tangh\Documents\GitHub\VRCX-0-jirai`，`main`）。本文 VRCX-0 侧的文件与行号取证于同一提交，无需重做；它们**不适用于**本机旧工作目录 `3200bc3c7`。决议见 `docs/jirai-port/计划/Rust重写路线/README.md` 第 1.0b 节。

> **2026-11-20 补充（MIMI 撤回，用户决定）**：#14 快速搜索 Bio、#7 自动跟随，以及 #17 快速搜索近期对象与前缀（M3、M4），曾在 MIMI 分支实现，后按用户决定（2026-11-20：「我之前说了不做的那些，就是不做了」）全部撤回，判定仍为原判定（#14 部分 / 产品暂缓，#7 有意不做，#17 不立项）；打开资料时的推测关联询问（M1，#3b）同时撤回。#6 在 MIMI 补了 Feed 页 Bio / 状态 diff 按 CJK 字切分（M2，提交 `0f3e02b0b`），#6 仍为完成。计数仍为 **11 / 2 / 3 / 1**（17 项）。撤回记录见 `reports/2026-11-20T1845Z-mimi-revert/README.md`。

# VRCX-0-jirai 功能补全与验收清单

本文记录 `VRCX-0-jirai` 相对 `VRCX-jirai` 尚缺或有行为差异的功能，以及可从 `VRCX-Luo` 借鉴的独立体验。它是后续逐项实现、验收的工作清单，含建议顺序与依赖，不代表待补事项已经完成。每完成一项，应更新状态、对应提交和验证结果；以实际代码与测试为准，不直接复制旧版 Vue/Electron 实现。

状态：`待实现`、`部分实现`、`待实测`、`可选`、`暂缓`、`已完成`。本次复核日期为 **2026-10-12**，代码基准是当前分支合入 VRCX-0 v2.31.0（`620fb2b3a`）后的工作树。代码存在与实机验收通过分别记录；旧任务名里的“自动”也不等于已接入自动调度。更细的旧版功能对照见 [README.zh-CN.md](../README.zh-CN.md#vrcx-jirai-功能还原核对表)。

本文件是后续功能状态的主清单；实施顺序见 [后续迁移计划](jirai-port/后续迁移计划.md)，实机操作见 [待手测清单](jirai-port/待手测清单.md)。`旧版功能清单.md`、`评审结论与迭代计划.md`、`总执行规划.md` 和原 `执行任务/` 保留来源与设计历史，其中旧分支名、环境限制、任务完成状态和排期不代表当前状态。

此次 v2.31.0 合并验证：前端类型检查、3 个冲突相关测试文件共 27 项测试、格式检查与 Vite 生产构建通过；全量前端 lint 被既有的 `src/shared/utils/string.test.ts` 未使用导入告警阻断。Rust 测试和 Specta 绑定生成未能运行：Cargo 锁定的 `tokio 1.53.2` 未缓存，配置的 `127.0.0.1:7890` 代理不可用，离线索引只有 `1.53.1`。生成绑定无法执行的唯一新增枚举项已按 Rust 合同补入 TS 文件；待网络／缓存恢复后仍需重跑绑定生成与 Rust 验证。

2026-10-12 后续接线验证：自身 Bio 历史、个人资料 Activity self 分支与推荐名字打开资料已实现；16 项定向前端测试、TypeScript 检查、persistence 477 项测试（1 项忽略）、application／game／activity／desktop-host 相关 Rust 测试 964 项，以及 Tauri devtools／SteamVR／OpenXR 特性组合的 `cargo check` 均通过。自身 Bio 查询仍待真实账号验收。`tauri:dev` 曾在 Vite 优化依赖后的页面刷新中触发 `softbuffer 0.4.8` Windows 位图断言，桌面运行时稳定性另列为未验收项。

本次 `VRCX-0` v2.31.0 合并主要是兼容上游通知活动路由重构：关系建议进房提醒从旧 Overlay 候选接入 `ActivityEvent`／新 Router，并保留用户已选定的提醒默认值；同时合并 Bio 历史面板与上游简介编辑入口、上游截图／通知／资料等改动，以及已确认默认开启的开发者群自动加入设置。未合并 `badge-data` 分支。

### 历史 subagent 结果与当前代码的对照

本次读取了此前 README 全量盘点、Bio Diff 融合、关系网归档、两份抓取机制审计、旧 Bio 问题修复及 `VRCX-Luo` 增量审计的交付记录。报告保留各自当时的结论；进度按现在的代码校正。

| 交付来源                        | 已有成果／报告边界                                                                                    | 当前记录方式                                                                                                                                                                          |
| ------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| README 盘点（`01a0d5fa…`）      | 已逐项盘点旧 README；当时 Bio 24 小时合并、手动关系和非好友仍未完成                                   | 这些后续成果已经进入当前分支，不继续沿用当时“未实现”的标签                                                                                                                            |
| Bio Diff 融合（`01a0d612…`）    | 简介正文内联增删、24 小时连续变更分组、历史滑条与悬停／拖动时间气泡；当时聚焦测试通过，视觉未验收     | 已实现，保留实机验收项；参考 `VRCX-0-jirai/src/components/dialogs/user-dialog/bioHistory.ts` 和 `VRCX-0-jirai/src/components/dialogs/user-dialog/components/UserDialogInfoTab.tsx`    |
| 关系归档（`01a0d5fe…`）         | 完整成功结果同事务写 CURRENT／meta／OLD，失败不伪装成功，详情页绿灰日期融合；后来指出非好友详情未归档 | 此缺口随后已补：`VRCX-0-jirai/crates/application/src/social/mutual_graph_fetch/request.rs::get_user_mutual_friends_list` 的非好友成功分支调用 `archive_observation`；不重新列为待实现 |
| 当前抓取机制审计（`01a0d615…`） | 区分周期基线、渐进 Bio 扫描、缓存 TTL 和按需图谱请求                                                  | 本轮复核 Bio 周期和基线触发；不把这份较早报告当作所有现版本节拍的完整证明                                                                                                             |
| 旧抓取机制审计（`01a0d8c8…`）   | 确认旧版启动／刷新后资料补全、非好友小时刷新、按需资料快照及进度计数含义                              | 用于第 1、9 项和进度 UI 的还原参考；旧版同小时重复扫描不照搬                                                                                                                          |
| 旧 Bio 修复（`01a0d8c4…`）      | `VRCX-jirai` 的 `3708e12f` 修复公开 Profile 读取、缺字段判定和过期响应；后续另做 VRCX 合并            | 属于另一个仓库的交付；按用户确认视作已处理，不声称由当前仓库重新修复或删除过历史数据                                                                                                  |
| Luo 增量审计（`01a0d933…`）     | 世界资料已有好友到访统计；双人世界排行、拼音检索和好友侧栏动画是可选增量                              | 世界资料的到访统计不列作缺口；双人排行另列可选；动画按用户意见暂不排期                                                                                                                |

## 实施顺序与连带项

增强抓取、关系功能和灯色占比均已接入；本轮上游合并后前端构建通过，关系提醒已迁入 VRCX-0 新 Router。下一轮不重复重写这几项，先做自己的完整历史视图这一块明确的半成品；搜索按用户决定暂缓，多账号另行设计。各功能仍需按手测清单实机验收。

| 顺序 | 具体交付                                        | 已有部分与待补差距                                                                                                                | 连带项／依赖                                                                                             |
| ---- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1    | 个人资料自身历史查询验收（第 5 项，代码已接入） | 自身 Bio 历史现读当前账号 `self_profile_log`，资料窗口 Activity 按目标玩家传 `isSelf`；好友 Feed Bio 与好友 Activity 保持原查询。 | 用真实账号验证账号切换、历史内容与空态；不扩成“完整历史”或新时间线。                                     |
| 2    | 已接入功能的真实使用验收                        | 增强抓取、关系建议／提醒、OLD 关系融合、灯色占比、双人关系与 Feed 拖放均有代码；尚有真实 VR／数据库验证项。                       | 按 [待手测清单](jirai-port/待手测清单.md) 逐项记录通过／失败；发现缺陷再开小修，不把它们误记成从零移植。 |

搜索相关按用户决定暂缓：保留第 4 项的来源与差异记录，不纳入近期实施顺序。

Feed → Gallery、Online 补线、手动关系、OLD 融合和关系时间轴归入验收与发现问题后的修补，不重新实现。多账号、手动补实例记录、自动跟随暂不列入近期主线；`VRCX-Luo` 的世界排行仅为可选增量。

下文的“参考”均写成 `项目名/仓库内路径::函数或组件`：`VRCX-jirai` 指此前的功能来源，`VRCX-Luo` 仅指可借鉴的增量，`VRCX-0-jirai` 指目前的接入点；不使用本机绝对路径。参考代码用于确认行为，不表示应原样复制其架构。

## 已有基础，不再重复迁移

- [x] Bio Diff 融入玩家资料原有简介面板，支持历史时间点和 24 小时连续变化合并。
- [x] 关系时间轴已按本地 GPS／离线记录重建会话、分段排名及缩放。
- [x] 关系网已有追踪非好友节点、手动连线与旧关系边；成功抓取后按登录账号写入 OLD 历史，玩家详情共同好友页融合实时 API 行和绿色／灰色历史日期。`18e59c12` 不包含旧 CURRENT 数据的一次性回填，这是已确认的简洁性取舍。
- [x] `VRCX-0` 的数据库升级、备份恢复、Feed 与游戏日志仍沿用现有主线。后续扩展须保留账号归属及旧数据兼容，不重建旧版数据库框架。

## 尚缺的 `VRCX-jirai` 功能

### 1. 追踪非好友的 Bio／状态历史 — 已接入，待实测

好友＋追踪非好友的统一自动／手动增强抓取、逐人进度、结果复用、公开 Profile Bio、请求合并、限流及账号取消已接入。渐进 Bio 扫描与增强自动抓取协调，具体入口和限制见本轮记录。

实现及测试记录：[三条功能链路还原记录](jirai-port/三条功能链路还原记录.md)；真实数据及 VR 按手测清单验收。

参考：`VRCX-jirai/src/coordinators/infoFetchCoordinator.js::runSilentInfoFetch`、`VRCX-jirai/src/coordinators/nonFriendCoordinator.js`、`VRCX-jirai/src/coordinators/friendSyncCoordinator.js`、`VRCX-jirai/src/stores/updateLoop.js`。当前入口：`VRCX-0-jirai/src/features/workflows/syncWorkflowActions.ts::createSyncWorkflowActions`、`VRCX-0-jirai/src/features/workflows/profileFetchExecutor.ts::createProfileFetchExecutor`、`VRCX-0-jirai/src/features/workflows/trackedNonfriendsRefreshExecutor.ts::createTrackedNonfriendsRefreshExecutor`、`VRCX-0-jirai/src/services/authenticatedRuntimeService.ts::applyFriendStep`、`VRCX-0-jirai/crates/persistence/src/realtime/write.rs::profile_feed_reconcile`、`VRCX-0-jirai/crates/application/src/social/profile_bio/mod.rs::scan_next_profile_bio`、`VRCX-0-jirai/crates/persistence/src/profile_bio.rs::profile_bio_next_stale_friend`。

### 2. 个人及好友的在线灯色分布 — 已接入，待实测

UTC 分桶堆叠占比图、缩放、数字时长、日期提示与亮暗主题已接入；滑条停止一秒后重算，拖动不逐格查库。自己单独读取有记录的游戏区间，不宣称完整在线历史。

实现及测试记录：[三条功能链路还原记录](jirai-port/三条功能链路还原记录.md)；真实数据及 VR 按手测清单验收。

参考：`VRCX-jirai/src/components/dialogs/UserDialog/UserDialogStatusDistributionTab.vue::buildChartData/loadData`（旧图表与查询；缺观测区间的算法不能照抄）；当前组件 `VRCX-0-jirai/src/components/dialogs/user-dialog/components/UserDialogInfoTab.tsx::UserDialogStatusDistributionPanel`、统计函数 `VRCX-0-jirai/src/components/dialogs/user-dialog/components/statusDistribution.ts::buildStatusDistribution`，事件表定义 `VRCX-0-jirai/crates/persistence/src/realtime/schema.rs`。

### 3. “或许是好友”线索、确认／忽略与进房提示 — 已接入，待实测

旧推荐算法、私房优先、证据、确认／本次忽略及进房 Overlay 提醒已接入；确认写现有手动表并刷新图。真实进房且双方同场才提示，连续同房去重，不伪造游戏日志。

实现及测试记录：[三条功能链路还原记录](jirai-port/三条功能链路还原记录.md)；真实数据及 VR 按手测清单验收。

参考：`VRCX-jirai/src/stores/manualRelations.js::computeSuggestions/ignoreSuggestion/addManualRelation`（候选及处置）、`VRCX-jirai/src/coordinators/gameLogCoordinator.js`（进房提示触发）；当前接点 `VRCX-0-jirai/crates/application-game/src/activity_events/relationship_recommendations.rs::live_candidates`、`VRCX-0-jirai/crates/application-activity/src/router/runtime.rs`（通知路由）、`VRCX-0-jirai/crates/persistence/src/mutual_graph.rs::mutual_graph_manual_link_set`。

### 4. 快捷搜索的近期对象／本地 Bio 匹配 — 暂缓（用户选择）

旧版这里是 Ctrl+K 快捷搜索的两种补充：空查询时从游戏日志显示最近遇到的非好友、最近去过的世界；输入关键词时用数据库保存的 Bio 补充当前好友匹配。最近对象由 Copilot 的 `e8e862da` 引入，`30ba80f6` 后续修正；本地 Bio 匹配由 FuLu糖福禄的 `a94824c2` 引入。

需要修正此前“历史 Bio 检索”的表述：旧 `searchBiosByContent` 用 `MAX(id)` 选每个用户**最新一条**保存的 Bio，再做关键词匹配；它没有遍历所有旧版本的 Bio。全历史任意版本搜索只能算未来可选扩展，不能当成已存在的 Jirai 迁移缺口。当前快捷搜索的最近项主要为最近打开的实体，与旧版日志来源不同；这些差异先记录，不实施搜索优化。

若未来恢复排期，验收本地最新 Bio 匹配、近期非好友／世界来源、账号隔离、输入响应和去重；全历史 Bio 检索需另定义需求。

参考：`VRCX-jirai/src/stores/quickSearch.js::loadRecentItems/filterRecentByQuery/supplementWithBioSearch`、`VRCX-jirai/src/services/database/gameLog.js::getRecentlyMetUsers/getRecentlyJoinedLocations`、`VRCX-jirai/src/services/database/feed.js::searchBiosByContent`；当前接点 `VRCX-0-jirai/src/components/sidebar/quick-search/quickSearchHistory.ts`、`VRCX-0-jirai/src/components/sidebar/QuickSearchDialog.tsx`。拼音匹配另见 `VRCX-Luo/src/shared/utils/quickSearchUtils.js`。

### 5. 个人资料中的自身历史接线 — 已接入，待实测

自身 Bio 历史现在由窄的 Tauri 查询读取当前账号 `self_profile_log`；好友仍从 Feed 读 Bio。玩家资料窗口 Activity 按 `userId === currentUserId` 传 `isSelf`；独立活动热力图未改。后端查询校验调用方给出的 expected owner 必须等于当前认证 owner，并按该 owner 读表。没有扩成“完整历史”或时间线；位置／头像／灯色不在本项范围。

前端定向测试覆盖自己的日志查询、好友 Feed 查询及身份不一致时不查询；Rust 查询有 owner 校验与 Bio 行筛选单测（待 Cargo 可用后执行）。真实账号仍需验收 Bio 内容、切账号／切玩家隔离、Activity 自我数据及空态。

参考：`VRCX-jirai/src/components/dialogs/UserDialog/UserDialogActivityTab.vue`。当前自身写入 `VRCX-0-jirai/crates/application-realtime/src/realtime/current_user/self_profile.rs::append_self_profile_observations`；Bio UI 接点 `VRCX-0-jirai/src/components/dialogs/user-dialog/components/UserDialogInfoTab.tsx::UserDialogBioPanel`；Activity 查询接点 `VRCX-0-jirai/src/services/userActivityViewService.ts::loadActivityView`、`VRCX-0-jirai/src/components/dialogs/user-dialog/useUserActivityPanelController.ts`；已有 self 分支示例 `VRCX-0-jirai/src/features/activity/useActivityHeatmap.ts`。

### 6. 双人关系页的证据边界与人数 — 已接入，待实测

补本地记录峰值人数；没有可靠日志时显示未知。近时出现改为进入先后未知，不等同相约／共同进入。

实现及测试记录：[三条功能链路还原记录](jirai-port/三条功能链路还原记录.md)；真实数据及 VR 按手测清单验收。

参考：`VRCX-jirai/src/views/Charts/components/TwoPersonRelationship.vue::sharedInstances/loadData`（共同实例和人数展示）、`VRCX-jirai/src/services/database/gameLog.js::getCoInstanceHistoryBetweenFriends/getMaxPlayerCountForLocations`（原始查询）；当前接点 `VRCX-0-jirai/src/features/charts/TwoPersonRelationshipPageImpl.tsx::groupOverlapsByLocation`。

### 7. 多账号同时登录、切换与合并视图 — 待独立设计

现有账号归属存储不等于旧版的多账号同时登录。需要先定义会话生命周期、每个 API 请求的认证账号、单账号／合并 Feed 视图，以及游戏日志由哪个实际游戏账号拥有；两个无头实例也不能自动解决单一游戏日志源的归属。完成方案与隔离测试后再实现登录与视图 UI，不把 `VRCX-Luo` 的 WIP 多账号代码当作已交付方案。

参考：`VRCX-jirai/src/services/accountSession.js::AccountSession`（独立认证会话）、`VRCX-jirai/src/services/accountHub.js::switchToMerged/switchToAccount/switchToPrimary`（视图切换）；当前已有账号切换 UI `VRCX-0-jirai/src/components/sidebar/friends-sidebar/AccountSwitcherPopover.tsx`。这里参考的是产品行为，不是建议移植旧会话服务。

### 8. 在 Feed 拖入本机文件并按 Gallery 分类上传 — 实现已接入，待实测

旧版支持在 Friend Feed 页面拖入本机文件，选取 Gallery 的目标分类后跳转 Gallery 上传；并非从 Feed 条目拖出文件。当前代码已接入分类拖放目标与现有 Gallery 上传操作，已有前端测试覆盖分流；仍须在运行中的软件里验收实际文件、权限、错误反馈和分类结果。不与 Screenshot Metadata 页的导入混为一谈。

参考：`VRCX-jirai/src/views/Feed/Feed.vue::dropZones/onDrop`（拖入、选分类和设置待传文件）、`VRCX-jirai/src/views/Tools/Gallery.vue`（监听 `pendingDrop` 并上传）；当前接点 `VRCX-0-jirai/src/features/feed/FeedPage.tsx`、`VRCX-0-jirai/src/features/tools/GalleryPage.tsx`。

### 9. 打开资料页时保存 Bio／灯色快照 — 已接入，待实测

公开 /profile Bio 和 /users 有效灯色观察接入好友及非好友；缺字段不清空。与实时／后台共用比较落盘和 Feed 更新通知。

实现及测试记录：[三条功能链路还原记录](jirai-port/三条功能链路还原记录.md)；真实数据及 VR 按手测清单验收。

参考：`VRCX-jirai/src/coordinators/userCoordinator.js::showUserDialog/updateUserDialogProfile`（旧资料快照，旧审计提交 `eeb354a2`、`a3c22508`，后续 Bio 修复见 `3708e12f`）；当前 `VRCX-0-jirai/crates/runtime-host-desktop/src/vrchat_remote.rs::user_profile`、`VRCX-0-jirai/crates/runtime-host-desktop/src/profile_bio.rs::ProfileBioObserver`、`VRCX-0-jirai/crates/application/src/social/profile_bio/mod.rs::observe_profile_response`、`VRCX-0-jirai/crates/persistence/src/realtime/write.rs::profile_feed_reconcile`。

## 行为差异与待验收，不预设必须重写

### 关系时间轴参数防抖与查询 — 已核对，待实测

用户明确希望参数停止变化约 1 秒后再刷新，以免拖动时卡顿。当前 [关系时间轴](../src/features/charts/RelationshipTimelinePageImpl.tsx)在页面加载／账号切换／手动刷新时读取一次完整的 owner-scoped GPS／Offline 历史；Top users、Days per unit、Show others 和 Friends only 现在共用一个尾随 1 秒计时器，变化会重置计时，停下后才重算图表。底部 ECharts dataZoom 只调可视范围，保持即时缩放，不触发数据库查询。参数变化不会重复读取同一份全历史；本轮补齐的是筛选开关也要重置这个计时器。

代码考古未能在当前可见的旧 `VRCX-0-jirai` Git 历史或 `VRCX-jirai` 中确认“这些滑条每动一次都查数据库”：`VRCX-jirai/src/views/Charts/components/RelationshipTimeline.vue` 的数据查询只发生在 `loadData()`（挂载／刷新），参数变化调用的是 500ms `debouncedRebuildChart()`；当前 React 迁移版加载后端历史也不接收这些参数。若要求严格执行“停 1 秒后发 SQL”，需要有旧实现的提交／文件，或先定义该 SQL 应按什么参数缩小数据范围；否则重复读取相同数据会重新引入原有卡顿。

验收：拖动／切换多个参数时计时器会重置，最后一次变化后约 1 秒才重算；期间数据库查询数不增加；ECharts 底部缩放仍即时；真实大数据库下图表和缩放保持可用。

参考：`VRCX-jirai/src/views/Charts/components/RelationshipTimeline.vue::debouncedRebuildChart/loadData`；`VRCX-0-jirai/src/features/charts/RelationshipTimelinePageImpl.tsx`（统一参数防抖与页面查询 effect）；`VRCX-0-jirai/src/repositories/feedRepository.ts::queryRelationshipTimelineHistory`（完整历史查询入口）。

### 启动／周期资料抓取与进度 — 已接入，待实测

实时事件、好友小时基线、渐进 Bio 扫描与增强型信息抓取仍是不同机制。增强抓取由启动好友基线完成、每小时基线刷新完成和“立即刷新”触发同一执行器；重连不额外全扫。每轮合并好友与显式追踪非好友，一次资料结果供名字／Bio／灯色／状态比较共用，并与本地关系建议并行显示。Online 补线和启动计时恢复是独立功能，不属于增强抓取。

资料请求至少间隔 300 毫秒启动，最多 3 名玩家并行；HTTP 429 暂停整个请求队列。浮窗分别显示好友与追踪非好友人数、两项任务进度、结果和周期信息。自动增强默认开启；关闭后保留 VRCX-0 原有渐进 Bio 扫描设置。代码已接入，真实 API 限流、账号切换和界面结果仍须按手测清单验收。

参考：`VRCX-jirai/src/coordinators/friendSyncCoordinator.js`（触发时机）、`VRCX-jirai/src/coordinators/infoFetchCoordinator.js::runSilentInfoFetch` 与 `VRCX-jirai/src/views/Tools/dialogs/ProfileCompletionDialog.vue`（抓取和进度）；当前 `VRCX-0-jirai/src/services/enhancedInfoFetchService.ts`、`src/features/workflows/profileFetchExecutor.ts`、`src/components/layout/status-bar/EnhancedInfoFetchStatus.tsx`。

### 好友房间停留计时 — 待实测

已有从本地记录恢复计时的实现与单元测试；尚需真实运行测试：好友留在同一实例时关闭软件、重新启动并登录，计时应接续原进入时间；好友已换房或记录不完整时不能虚构停留时长。

参考：`VRCX-jirai/src/coordinators/userCoordinator.js::applyUser`（旧计时恢复）；当前计算 `VRCX-0-jirai/crates/application-core/src/instance_dwell.rs`，显示 `VRCX-0-jirai/src/components/friends/FriendInstanceTimer.tsx::FriendLocationTimer`。

### 其他已有功能的端到端验收 — 待实测

- [ ] 用备份数据库测试 `VRCX-0` 数据迁移后 Feed、游戏日志、Bio 历史与关系网 OLD 表均可读；先备份，再测试，不直接改唯一原始库。
- [ ] 在账号 A 查询目标 B 的共同好友，验证 CURRENT／OLD 融合、成功空列表、关闭共享后的灰色日期、OLD 查询失败仍显示已取得的 API 行；切换账号不串数据。
- [ ] 实机检查 Bio Diff 的 24 小时分组、空文本、时间点滑条气泡及玩家资料页布局。
- [ ] 在资料页刷新灯色时长面板，验证断续 Online/Offline、空状态、失败重试与自己账号的显示；它目前不是旧版占比图。
- [ ] 从 Friend Feed 拖本机文件到各 Gallery 分类，检查真实上传、权限拒绝、失败反馈及目标分类。
- [ ] 在高级设置关闭／开启自动加入 VRCX-jirai 群组，验证我的群组页加载时才尝试加入、不同账号隔离且不会重复申请；默认开启是已确认的用户选择。
- [ ] 手动同步工作流检查限速、取消、429／401、账号切换以及非好友 Bio／灯色记录；勿把该入口误认为后台持续抓取。
- [ ] 验证两张关系图在大数据、跨天、空状态下的表现；特别核对时间轴图例／缩放与双人关系证据措辞。
- [ ] 检查自定义导航“恢复默认”后，Jirai 页面入口是否重新出现。
- [ ] 完整桌面构建与安装包／直接启动测试，区分依赖 Vite 的开发可执行文件和可独立运行的发布包；SteamVR、OpenXR 与通知位置分别验收。

## 可借鉴的 `VRCX-Luo` 增量，不属于必须还原项

### 双人共同到访世界排行 — 可选

它**不是新页面**：`VRCX-Luo` 在双人关系页放按钮，打开一个完整排行弹窗。它把两人共同到访的不同房间按 `worldId` 合并，累加访问次数，以次数、共处时长和最近到访打破并列；点条目可打开最近一次实例。`VRCX-0-jirai` 的双人关系页已有按位置汇总的 `joinLeavesCount`、共处时间与实例位置，可在当前 React 页面增加纯统计函数和弹窗，不需要照搬 Vue 组件或新增数据库表。它与“某世界有多少好友到访”的现有世界资料统计不是同一指标。验收重点是重复进入同房、跨实例同世界、缺失 worldId、排行点击目标与次数口径。

参考：`VRCX-Luo/src/views/Charts/components/TwoPersonRelationship.vue::sharedWorldRanking`（按钮与调用）、`VRCX-Luo/src/views/Charts/components/twoPersonRelationshipStats.js::buildSharedWorldRanking/countSharedRoomVisits`（口径）、`VRCX-Luo/src/views/Charts/components/SharedWorldRankingDialog.vue`（弹窗）；当前接点 `VRCX-0-jirai/src/features/charts/TwoPersonRelationshipPageImpl.tsx`。

### 好友侧栏上线／离线过渡动画 — 可选

这**不是 Overlay 动画**。`VRCX-Luo` 只在好友真实在线状态改变时，让侧栏行离开时约 120ms 淡出、进入时约 180ms 淡入；初次加载与虚拟列表重新挂载不触发，并尊重系统“减少动态效果”。`VRCX-0-jirai` 同样有虚拟化好友侧栏，因此可以在 React 行组件根据稳定的好友 ID 比较前后在线状态，使用 opacity 动画，不碰虚拟列表负责的 transform，也不复制 Vue `TransitionGroup`。这是独立 UI 润色，不影响 Overlay 或数据库。（感觉没必要做，徒增复杂度）

参考：`VRCX-Luo/src/composables/useFriendPresenceMotion.js::useFriendPresenceMotion`（仅真实状态变更时动画）、`VRCX-Luo/src/views/Sidebar/components/FriendsSidebar.vue`（行进出场）；当前侧栏 `VRCX-0-jirai/src/components/sidebar/friends-sidebar/FriendsSidebarVirtualRows.tsx`。

### 其他 `VRCX-Luo` 方向 — 可选／不默认采用

- 可评估：拼音搜索、共享世界的完整排行体验，以及更清晰的资料弹窗反馈。
- 暂缓：自动跟随并启动／重启 VRChat、手动插入实例进出记录、多账号产品；旧执行任务仅保留为参考。开发者群自动加入已实现且用户选择默认开启，不再列为待决定项。Electron／OpenVR 生命周期按当前架构适配。

## 实施时才需要拍板的产品语义

1. 非好友资料历史：先按现有显式追踪名单实现；自动任务具体频率与现有 Bio 扫描开关如何配合，实施时列出可选方案。近期共处对象是否增加“一键追踪”入口可后置。
2. 关系线索：评分达到什么程度才提示；确认是否生成手动关系；忽略后何时允许重新提示？
3. 多账号：单个游戏日志源怎样绑定实际游戏账号，合并视图中的重复事件如何去重？
4. 已确定的选择继续沿用：开发者群默认开启；OLD 日期表示最后成功确认时间；当前关系普通色、手动绿色、仅历史关系淡普通色；不做 CURRENT 旧数据一次性回填。9 月 18 日缺 Bio 字段被误记为空的旧问题已修复，不再列为下一轮功能阻塞项。

## 对照来源

- [当前迁移核对表](../README.zh-CN.md#vrcx-jirai-功能还原核对表)、[`VRCX-jirai` README](../../VRCX-jirai/README.md)。
- `VRCX-Luo` 本地提交：`be43cc2f`（好友侧栏状态动画）、`4c6b4cb0`／`8fab993c`／`3f632397`（双人共享世界排行与弹窗）。
- 当前实现入口：[关系时间轴](../src/features/charts/RelationshipTimelinePageImpl.tsx)、[双人关系](../src/features/charts/TwoPersonRelationshipPageImpl.tsx)、[Bio 扫描](../crates/application/src/social/profile_bio/mod.rs)、[关系归档](../crates/persistence/src/mutual_graph.rs)。

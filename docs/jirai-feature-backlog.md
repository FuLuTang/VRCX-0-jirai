# VRCX-0-jirai 功能补全与验收清单

本文记录 `VRCX-0-jirai` 相对 `VRCX-jirai` 尚缺或有行为差异的功能，以及可从 `VRCX-Luo` 借鉴的独立体验。它是后续逐项实现、验收的工作清单，含建议顺序与依赖，不代表待补事项已经完成。每完成一项，应更新状态、对应提交和验证结果；以实际代码与测试为准，不直接复制旧版 Vue/Electron 实现。

状态：`待实现`、`部分实现`、`待实测`、`可选`、`暂缓`、`已完成`。本次复核日期为 **2026-10-02**，代码基准为 `562486290`：已合入 `VRCX-0` 的 `master` 提交 `abbdc241c`，并包含此前另一分支的 Jirai 迁移成果。代码存在与实机验收通过分别记录；旧任务名里的“自动”也不等于已接入自动调度。更细的旧版功能对照见 [README.zh-CN.md](../README.zh-CN.md#vrcx-jirai-功能还原核对表)。

本文件是后续功能状态的主清单；实施顺序见 [后续迁移计划](jirai-port/后续迁移计划.md)，实机操作见 [待手测清单](jirai-port/待手测清单.md)。`旧版功能清单.md`、`评审结论与迭代计划.md`、`总执行规划.md` 和原 `执行任务/` 保留来源与设计历史，其中旧分支名、环境限制、任务完成状态和排期不代表当前状态。

此次合并验证：前端类型检查、8 个相关测试文件共 76 项测试、Rust 格式检查与 Vite 生产构建通过；全量前端测试因内存不足未完成；Rust 测试及 Rust 许可证依赖检查受失效的本机代理和缺失的离线依赖影响未完成。2026-09-30 的验证属于更早的代码状态，不能代替这次合并后的验证。

### 历史 subagent 结果与当前代码的对照

本次读取了此前 README 全量盘点、Bio Diff 融合、关系网归档、两份抓取机制审计、旧 Bio 问题修复及 `VRCX-Luo` 增量审计的交付记录。报告保留各自当时的结论；进度按现在的代码校正。

| 交付来源 | 已有成果／报告边界 | 当前记录方式 |
| --- | --- | --- |
| README 盘点（`01a0d5fa…`） | 已逐项盘点旧 README；当时 Bio 24 小时合并、手动关系和非好友仍未完成 | 这些后续成果已经进入当前分支，不继续沿用当时“未实现”的标签 |
| Bio Diff 融合（`01a0d612…`） | 简介正文内联增删、24 小时连续变更分组、历史滑条与悬停／拖动时间气泡；当时聚焦测试通过，视觉未验收 | 已实现，保留实机验收项；参考 `VRCX-0-jirai/src/components/dialogs/user-dialog/bioHistory.ts` 和 `VRCX-0-jirai/src/components/dialogs/user-dialog/components/UserDialogInfoTab.tsx` |
| 关系归档（`01a0d5fe…`） | 完整成功结果同事务写 CURRENT／meta／OLD，失败不伪装成功，详情页绿灰日期融合；后来指出非好友详情未归档 | 此缺口随后已补：`VRCX-0-jirai/crates/application/src/social/mutual_graph_fetch/request.rs::get_user_mutual_friends_list` 的非好友成功分支调用 `archive_observation`；不重新列为待实现 |
| 当前抓取机制审计（`01a0d615…`） | 区分周期基线、渐进 Bio 扫描、缓存 TTL 和按需图谱请求 | 本轮复核 Bio 周期和基线触发；不把这份较早报告当作所有现版本节拍的完整证明 |
| 旧抓取机制审计（`01a0d8c8…`） | 确认旧版启动／刷新后资料补全、非好友小时刷新、按需资料快照及进度计数含义 | 用于第 1、9 项和进度 UI 的还原参考；旧版同小时重复扫描不照搬 |
| 旧 Bio 修复（`01a0d8c4…`） | `VRCX-jirai` 的 `3708e12f` 修复公开 Profile 读取、缺字段判定和过期响应；后续另做 VRCX 合并 | 属于另一个仓库的交付；按用户确认视作已处理，不声称由当前仓库重新修复或删除过历史数据 |
| Luo 增量审计（`01a0d933…`） | 世界资料已有好友到访统计；双人世界排行、拼音检索和好友侧栏动画是可选增量 | 世界资料的到访统计不列作缺口；双人排行另列可选；动画按用户意见暂不排期 |

## 建议实施顺序与连带项

| 顺序 | 具体交付 | 已有部分与待补差距 | 连带项／依赖 |
| --- | --- | --- | --- |
| 1 | 收尾资料抓取与追踪非好友历史（第 1、9 项及启动／重连小节） | 已有名单、手动 workflow 与 Bio/Status 落盘；先去掉同一轮非好友重复请求，再补真实进度、按需快照与统一自动触发／定时刷新 | 复用现有账号归属、取消和资料写入；统一 workflow、渐进 Bio 扫描及成功检查时间，避免多层重复抓取；为推荐提供稳定输入 |
| 2 | 双人关系的证据措辞和房间人数（第 6 项） | 共同实例已显示；先修“三分钟内进入”被直接解释为共同进入，再补能可靠计算的峰值人数 | 复用 Feed 会话和游戏日志；查不到人数时显示未知，无需等待关系推荐 |
| 3 | 状态时长面板的占比图（第 2 项） | 统计函数与数字面板已有；补旧版明确可见的图形及范围／空态说明 | 复用现有统计口径，不为图形重造数据表；自己的数据路径单独验收 |
| 4 | “或许是好友”的推荐、确认／忽略与进房提示（第 3 项） | 手动关系与 OLD 数据已有；评分、建议 UI 和触发尚缺 | 在追踪／资料输入稳定后接入；确认结果接手动关系，进房文字接现有 Overlay 通知入口 |
| 5 | 自己的完整历史视图（第 5 项） | 现有活动页热力图有自己数据分支；资料页接入与位置／头像／Bio／状态等明细仍须补齐 | 先核自我记录来源与资料页是否传入自我查询参数；完整明细较大，局部接入问题可提前修 |

搜索相关按用户 2026-10-02 的决定暂缓：保留第 4 项的来源与差异记录，不纳入近期实施顺序。

Feed → Gallery、Online 补线、手动关系、OLD 融合和关系时间轴归入验收与发现问题后的修补，不重新实现。多账号、手动补实例记录、自动跟随暂不列入近期主线；`VRCX-Luo` 的世界排行仅为可选增量。

下文的“参考”均写成 `项目名/仓库内路径::函数或组件`：`VRCX-jirai` 指此前的功能来源，`VRCX-Luo` 仅指可借鉴的增量，`VRCX-0-jirai` 指目前的接入点；不使用本机绝对路径。参考代码用于确认行为，不表示应原样复制其架构。

## 已有基础，不再重复迁移

- [x] Bio Diff 融入玩家资料原有简介面板，支持历史时间点和 24 小时连续变化合并。
- [x] 关系时间轴已按本地 GPS／离线记录重建会话、分段排名及缩放。
- [x] 关系网已有追踪非好友节点、手动连线与旧关系边；成功抓取后按登录账号写入 OLD 历史，玩家详情共同好友页融合实时 API 行和绿色／灰色历史日期。`18e59c12` 不包含旧 CURRENT 数据的一次性回填，这是已确认的简洁性取舍。
- [x] `VRCX-0` 的数据库升级、备份恢复、Feed 与游戏日志仍沿用现有主线。后续扩展须保留账号归属及旧数据兼容，不重建旧版数据库框架。

## 尚缺的 `VRCX-jirai` 功能

### 1. 追踪非好友的 Bio／状态历史 — 部分实现

现有代码已加入按账号存储的 `tracked_nonfriends` 名单、侧边栏管理及手动同步工作流。`profileFetchExecutor` 将好友与追踪非好友去重，获取资料后通过 `appProfileFeedReconcile` 比较并写入 Bio／Status 历史；缺字段不作为空 Bio 写入，同值不重复写入。名单和手动存档无需再从零迁移。[Bio 扫描器](../crates/application/src/social/profile_bio/mod.rs)仍只选择当前好友，且只采集 Bio；它与完整 Bio／Status workflow 是两套机制。

此次核查的具体缺口：`SyncWorkflowDialog` 的完整工作流只由运行按钮启动，关闭对话框会取消；认证基线回调自动执行的是 Online 补线。另一个动作 `trackedNonfriendsRefreshExecutor` 先请求追踪对象并更新名字，之后 `profileFetchExecutor` 再请求同一批非好友并存档，因此一个完整 workflow 会重复抓取这些对象。两个动作的本地间隔分别为 250ms 与 3s，不能当作已经统一的调度策略。

建议先让每轮资料结果同时用于更新追踪名字和 Bio／Status 存档，每个对象只获取一次；保留已有 workflow 的账号检查、取消、去重与 429 停止行为。随后补旧任务要求的启动／好友基线刷新后的触发和追踪对象定时刷新，并与渐进扫描共用新鲜度与限速策略。后台任务应放在可持续运行的现有运行时中，进度 UI 读取任务状态，关闭 UI 不应等同于终止全部后台采集。不要直接取消好友筛选后就认为非好友已接通：候选选择、好友限定的发布路径、写入和 Feed 刷新通知都要一起核查。

验收：好友与追踪非好友分别测试；账号 A 的追踪对象不进入 B 的 Feed；缺字段／失败不生成清空事件；同值不重复写；取消及限流后不会继续无界请求。

参考：`VRCX-jirai/src/coordinators/infoFetchCoordinator.js::runSilentInfoFetch`、`VRCX-jirai/src/coordinators/nonFriendCoordinator.js`、`VRCX-jirai/src/coordinators/friendSyncCoordinator.js`、`VRCX-jirai/src/stores/updateLoop.js`。当前入口：`VRCX-0-jirai/src/features/workflows/syncWorkflowActions.ts::createSyncWorkflowActions`、`VRCX-0-jirai/src/features/workflows/profileFetchExecutor.ts::createProfileFetchExecutor`、`VRCX-0-jirai/src/features/workflows/trackedNonfriendsRefreshExecutor.ts::createTrackedNonfriendsRefreshExecutor`、`VRCX-0-jirai/src/services/authenticatedRuntimeService.ts::applyFriendStep`、`VRCX-0-jirai/crates/persistence/src/realtime/write.rs::profile_feed_reconcile`、`VRCX-0-jirai/crates/application/src/social/profile_bio/mod.rs::scan_next_profile_bio`、`VRCX-0-jirai/crates/persistence/src/profile_bio.rs::profile_bio_next_stale_friend`。

### 2. 个人及好友的在线灯色分布 — 部分实现

个人资料页已有按需查询的时长数字面板，以已有状态事件和上下线历史为输入，把灯色持续区间与确认在线区间求交，仅统计已确认的在线时长；没有观测到的时间不计入任一灯色。它尚不是 VRCX-jirai 的占比图，自己的完整历史视图也未验收。后续补齐可解释的统计范围、样本不足提示及图形呈现。

验收：跨天、离线时改灯色、缺少上／下线端点、自己与好友、空数据均有测试；百分比的分母只含可确认的在线时长。

参考：`VRCX-jirai/src/components/dialogs/UserDialog/UserDialogStatusDistributionTab.vue::buildChartData/loadData`（旧图表与查询；缺观测区间的算法不能照抄）；当前组件 `VRCX-0-jirai/src/components/dialogs/user-dialog/components/UserDialogInfoTab.tsx::UserDialogStatusDistributionPanel`、统计函数 `VRCX-0-jirai/src/components/dialogs/user-dialog/components/statusDistribution.ts::buildStatusDistribution`，事件表定义 `VRCX-0-jirai/crates/persistence/src/realtime/schema.rs`。

### 3. “或许是好友”线索、确认／忽略与进房提示 — 待实现

以本地共同出现、历史关系网等作为**推测线索**，单独保存候选、证据、确认／忽略状态；不把推测写入真实好友表，也不向游戏日志插入伪造的进出记录。符合条件的人进入当前房间时，通过现有活动／Overlay 通知链路显示待确认文字；通知应可关闭并避免反复轰炸。确认后如何转换为手动关系，需要在实现时明确。

验收：已确认、已忽略、证据不足、重复进房、账号切换，以及桌面／SteamVR／OpenXR 显示均需测试；提示措辞不能把推测写成事实。

参考：`VRCX-jirai/src/stores/manualRelations.js::computeSuggestions/ignoreSuggestion/addManualRelation`（候选及处置）、`VRCX-jirai/src/coordinators/gameLogCoordinator.js`（进房提示触发）；当前接点 `VRCX-0-jirai/crates/application-activity/src/overlay_activity/runtime.rs::ingest_candidate`、`VRCX-0-jirai/crates/persistence/src/mutual_graph.rs::mutual_graph_manual_link_set`。

### 4. 快捷搜索的近期对象／本地 Bio 匹配 — 暂缓（用户选择）

旧版这里是 Ctrl+K 快捷搜索的两种补充：空查询时从游戏日志显示最近遇到的非好友、最近去过的世界；输入关键词时用数据库保存的 Bio 补充当前好友匹配。最近对象由 Copilot 的 `e8e862da` 引入，`30ba80f6` 后续修正；本地 Bio 匹配由 FuLu糖福禄的 `a94824c2` 引入。

需要修正此前“历史 Bio 检索”的表述：旧 `searchBiosByContent` 用 `MAX(id)` 选每个用户**最新一条**保存的 Bio，再做关键词匹配；它没有遍历所有旧版本的 Bio。全历史任意版本搜索只能算未来可选扩展，不能当成已存在的 Jirai 迁移缺口。当前快捷搜索的最近项主要为最近打开的实体，与旧版日志来源不同；这些差异先记录，不实施搜索优化。

若未来恢复排期，验收本地最新 Bio 匹配、近期非好友／世界来源、账号隔离、输入响应和去重；全历史 Bio 检索需另定义需求。

参考：`VRCX-jirai/src/stores/quickSearch.js::loadRecentItems/filterRecentByQuery/supplementWithBioSearch`、`VRCX-jirai/src/services/database/gameLog.js::getRecentlyMetUsers/getRecentlyJoinedLocations`、`VRCX-jirai/src/services/database/feed.js::searchBiosByContent`；当前接点 `VRCX-0-jirai/src/components/sidebar/quick-search/quickSearchHistory.ts`、`VRCX-0-jirai/src/components/sidebar/QuickSearchDialog.tsx`。拼音匹配另见 `VRCX-Luo/src/shared/utils/quickSearchUtils.js`。

### 5. 自己的完整历史视图 — 部分实现

自己的资料变化与游戏活动已有持久化路径，现有活动页 `useActivityHeatmap` 明确使用 `isSelf: true` 查询；不能把这部分算成完全未实现。但玩家资料页的 `useUserActivityPanelController` 当前没有显式传 `isSelf`，不能仅凭后端存在该分支就宣布自己的资料页已正确接入，需核入口和数据来源。尚缺的是在个人资料页把位置、头像、灯色、Bio 与上下线历史的明细完整串起来。先核 `self_profile_log`、Feed 和游戏日志各自能读取哪些自己的记录，再复用资料组件展示；现有热力图不等于统一的资料变更时间线。

验收：自己与好友页面的数据归属正确；跨天、重启、无游戏日志及历史空白状态可理解。

参考：`VRCX-jirai/src/components/dialogs/UserDialog/UserDialogActivityTab.vue`、`VRCX-jirai/src/components/dialogs/UserDialog/UserDialogStatusDistributionTab.vue`。当前写入 `VRCX-0-jirai/crates/application-realtime/src/realtime/current_user/self_profile.rs::append_self_profile_log_entries`；已有自己热力图 `VRCX-0-jirai/src/features/activity/useActivityHeatmap.ts`；activity 接点 `VRCX-0-jirai/src/services/userActivityViewService.ts::loadActivityView`、`VRCX-0-jirai/src/components/dialogs/user-dialog/useUserActivityPanelController.ts`，展示接点 `VRCX-0-jirai/src/components/dialogs/user-dialog/components/UserDialogTabsSection.tsx`。

### 6. 双人关系页的证据边界与人数 — 部分实现

当前可显示共同实例与共处时间，但旧版的“当时最高人数”未展示。先确认现有实例／游戏日志能否可靠计算峰值；若没有足够记录，只显示未知。三分钟内进入同一房间不必然证明两人相约：当只有快照、缺少精确加入事件或有非好友可见性限制时，应显示“先后关系未知”，而非肯定归因。

验收：同房多次进入、跨天、只有快照、缺记录、实例房主变化及峰值缺失。

参考：`VRCX-jirai/src/views/Charts/components/TwoPersonRelationship.vue::sharedInstances/loadData`（共同实例和人数展示）、`VRCX-jirai/src/services/database/gameLog.js::getCoInstanceHistoryBetweenFriends/getMaxPlayerCountForLocations`（原始查询）；当前接点 `VRCX-0-jirai/src/features/charts/TwoPersonRelationshipPageImpl.tsx::groupOverlapsByLocation`。

### 7. 多账号同时登录、切换与合并视图 — 待独立设计

现有账号归属存储不等于旧版的多账号同时登录。需要先定义会话生命周期、每个 API 请求的认证账号、单账号／合并 Feed 视图，以及游戏日志由哪个实际游戏账号拥有；两个无头实例也不能自动解决单一游戏日志源的归属。完成方案与隔离测试后再实现登录与视图 UI，不把 `VRCX-Luo` 的 WIP 多账号代码当作已交付方案。

参考：`VRCX-jirai/src/services/accountSession.js::AccountSession`（独立认证会话）、`VRCX-jirai/src/services/accountHub.js::switchToMerged/switchToAccount/switchToPrimary`（视图切换）；当前已有账号切换 UI `VRCX-0-jirai/src/components/sidebar/friends-sidebar/AccountSwitcherPopover.tsx`。这里参考的是产品行为，不是建议移植旧会话服务。

### 8. 在 Feed 拖入本机文件并按 Gallery 分类上传 — 实现已接入，待实测

旧版支持在 Friend Feed 页面拖入本机文件，选取 Gallery 的目标分类后跳转 Gallery 上传；并非从 Feed 条目拖出文件。当前代码已接入分类拖放目标与现有 Gallery 上传操作，已有前端测试覆盖分流；仍须在运行中的软件里验收实际文件、权限、错误反馈和分类结果。不与 Screenshot Metadata 页的导入混为一谈。

参考：`VRCX-jirai/src/views/Feed/Feed.vue::dropZones/onDrop`（拖入、选分类和设置待传文件）、`VRCX-jirai/src/views/Tools/Gallery.vue`（监听 `pendingDrop` 并上传）；当前接点 `VRCX-0-jirai/src/features/feed/FeedPage.tsx`、`VRCX-0-jirai/src/features/tools/GalleryPage.tsx`。

### 9. 打开资料页时保存 Bio／灯色快照 — 部分实现

旧版在打开非自己的玩家资料时，也会比较并保存 Bio／有效灯色快照，目标可以是好友或非好友；这是旧审计补出的按需采集行为，与定时扫描和共同好友 OLD 归档分别属于不同的数据链路。当前 `ProfileBioObserver` 可观察 Profile 响应，但 `observe_profile_response` 只接受当前好友且只处理 Bio；非好友 Bio 与灯色按需存档没有在该路径中接通。手动 workflow 能存档非好友，不等于每次打开资料都能存档。

接入第 1 项时复用同一份资料比较／写入逻辑，核对 Profile 的 Bio 与用户资料的灯色／状态短语各自来源；确保一次观察不会与实时事件或后台扫描重复写入。明确返回空 Bio 可以保存，缺失／失败不能变成空文本。先保存用户明确打开或追踪的对象，不自动扩大为所有共处者。

参考：`VRCX-jirai/src/coordinators/userCoordinator.js::showUserDialog/updateUserDialogProfile`（旧资料快照，旧审计提交 `eeb354a2`、`a3c22508`，后续 Bio 修复见 `3708e12f`）；当前 `VRCX-0-jirai/crates/runtime-host-desktop/src/vrchat_remote.rs::user_profile`、`VRCX-0-jirai/crates/runtime-host-desktop/src/profile_bio.rs::ProfileBioObserver`、`VRCX-0-jirai/crates/application/src/social/profile_bio/mod.rs::observe_profile_response`、`VRCX-0-jirai/crates/persistence/src/realtime/write.rs::profile_feed_reconcile`。

## 行为差异与待验收，不预设必须重写

### 关系时间轴滑条与查询 — 待实测

旧版曾因滑条参数一变就立刻查询数据库而卡顿。当前 [关系时间轴](../src/features/charts/RelationshipTimelinePageImpl.tsx)只在页面加载／手动刷新时执行 `queryRelationshipTimelineHistory`；拖动“用户数量”和“天数／单位”会即时更新滑条数值，但用尾随 1 秒计时器推迟图表重算，连续拖动会重置计时器。因此**当前滑条不会逐格重新 query**。先在正在运行的构建上记录查询次数和拖动帧率：若仍卡，定位是首次全量读库、前端会话重算还是 ECharts 绘制；不要仅为复刻旧调用顺序而重新引入逐格查询。仅当全量历史本身过大时，才考虑把日期／筛选下推 Rust 查询，并对查询做尾随 1 秒 debounce、取消过期结果。

验收：连续拖动期间不因每格变化访问数据库；停下约 1 秒后图表更新为最终参数；大数据库下滑条仍可操作；刷新后缩放范围与结果正确。

参考：`VRCX-jirai/src/views/Charts/components/RelationshipTimeline.vue::buildChartData/loadData`（旧图表更新）、`VRCX-0-jirai/src/features/charts/RelationshipTimelinePageImpl.tsx`（现有尾随计时器）、`VRCX-0-jirai/src/repositories/feedRepository.ts::queryRelationshipTimelineHistory`（实际查询入口）。

### 启动／重连补全与资料抓取进度 — 部分实现、待实测

现有实时事件、小时级好友基线、默认关闭的渐进式 Bio 扫描，以及**手动同步工作流**是不同机制；不能把缓存 TTL 或 UI tick 算作后台全员扫描。完整好友基线到达后会自动补录当前确认在线且缺失的 Online 观测；手动工作流可重复补录并刷新资料。**登录／重连不自动触发全好友资料抓取**。旧执行任务 08 要求的自动触发仍未接通，不能因资料获取函数名含 automatic 就标为已完成。

当前渐进 Bio 扫描每 3 秒尝试一位过期好友，12 小时内检查过的对象跳过；空闲或限流时暂停 5 分钟。手动资料工作流也逐人抓取，但会保存 Bio 和四种主灯色／状态短语，不能简单并行叠加两套全员扫描。后续先统一目标、检查时间、请求节奏与进度，再接自动触发；仍须验证账号切换、成功／未变／失败／取消计数。启动／重连只可保存重新观察到的状态，不能恢复离线期间未知的每一次变化。

进度 UI 也还未完全还原：当前 workflow 的汇总是完成／跳过／错误的**动作数**，不是已抓取的人数。`profileFetchExecutor` 虽返回目标数、Bio／Status 更新数、失败数和缺字段数，`SyncWorkflowRunner` 尚未将这些结果保存到快照，`SyncWorkflowDialog` 也未显示逐人进度和结果。下一轮应接上真实的逐人进度、成功／未变／失败与写入计数；不要把“动作完成”写成“所有人抓取成功”。此项与第 1、9 项一起收尾。参考 `VRCX-0-jirai/src/features/workflows/syncWorkflow.ts::SyncWorkflowRunner`、`VRCX-0-jirai/src/features/workflows/SyncWorkflowDialog.tsx`、`VRCX-jirai/src/views/Tools/dialogs/ProfileCompletionDialog.vue`、`VRCX-jirai/src/components/StatusBar.vue`。

参考：`VRCX-jirai/src/coordinators/friendSyncCoordinator.js`（触发时机）、`VRCX-jirai/src/coordinators/infoFetchCoordinator.js::runSilentInfoFetch` 与 `VRCX-jirai/src/views/Tools/dialogs/ProfileCompletionDialog.vue`（抓取和进度）；当前调度 `VRCX-0-jirai/crates/composition/src/state/background_ticks/profile_bio.rs::run_background_profile_bio_scan`。

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

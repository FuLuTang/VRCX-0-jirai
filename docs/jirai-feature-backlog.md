# VRCX-0-jirai 功能补全与验收清单

本文记录 `VRCX-0-jirai` 相对 `VRCX-jirai` 尚缺或有行为差异的功能，以及可从 `VRCX-Luo` 借鉴的独立体验。它是后续逐项实现、验收的工作清单，不代表这些事项已经完成，也不规定实施顺序。每完成一项，应更新状态、对应提交和验证结果；以实际代码与测试为准，不直接复制旧版 Vue/Electron 实现。

状态：`待实现`、`部分实现`、`待实测`、`可选`、`已完成`。原始盘点基准为 `VRCX-0-jirai` 提交 `18e59c12`；下列状态另含本次 `port/legacy-audit-simple-ui` 合并中的功能，合并与验证未结束前不视作已验收。更细的旧版功能对照见 [README.zh-CN.md](../README.zh-CN.md#vrcx-jirai-功能还原核对表)。

下文的“参考”均写成 `项目名/仓库内路径::函数或组件`：`VRCX-jirai` 指此前的功能来源，`VRCX-Luo` 仅指可借鉴的增量，`VRCX-0-jirai` 指目前的接入点；不使用本机绝对路径。参考代码用于确认行为，不表示应原样复制其架构。

## 已有基础，不再重复迁移

- [x] Bio Diff 融入玩家资料原有简介面板，支持历史时间点和 24 小时连续变化合并。
- [x] 关系时间轴已按本地 GPS／离线记录重建会话、分段排名及缩放。
- [x] 关系网已有追踪非好友节点、手动连线与旧关系边；成功抓取后按登录账号写入 OLD 历史，玩家详情共同好友页融合实时 API 行和绿色／灰色历史日期。`18e59c12` 不包含旧 CURRENT 数据的一次性回填，这是已确认的简洁性取舍。
- [x] `VRCX-0` 的数据库升级、备份恢复、Feed 与游戏日志仍沿用现有主线。后续扩展须保留账号归属及旧数据兼容，不重建旧版数据库框架。

## 尚缺的 `VRCX-jirai` 功能

### 1. 追踪非好友的 Bio／状态历史 — 部分实现

合并中的代码已加入按账号存储的 `tracked_nonfriends` 名单、侧边栏管理及手动同步工作流，可尝试刷新非好友资料；[Bio 扫描器](../crates/application/src/social/profile_bio/mod.rs)仍只选择当前好友。手动抓取不等于持续、定时的 Bio／灯色 Feed 采集。后续后台扫描应有开关、最短重查间隔、共享限速／429 暂停、取消与成功／失败计数。不要把“处理了目标”误报为“成功写入变化”，也不要声称可补回应用离线期间的每一次变化。

验收：好友与追踪非好友分别测试；账号 A 的追踪对象不进入 B 的 Feed；缺字段／失败不生成清空事件；同值不重复写；取消及限流后不会继续无界请求。

参考：`VRCX-jirai/src/coordinators/infoFetchCoordinator.js::runSilentInfoFetch`（好友／追踪对象扫描）、`VRCX-jirai/src/coordinators/nonFriendCoordinator.js`（非好友后台抓取）；当前入口 `VRCX-0-jirai/crates/application/src/social/profile_bio/mod.rs::scan_next_profile_bio`、`VRCX-0-jirai/crates/persistence/src/profile_bio.rs::profile_bio_next_stale_friend`。

### 2. 个人及好友的在线灯色分布 — 部分实现

个人资料页已有按需查询的时长数字面板，以已有状态事件和上下线历史为输入，把灯色持续区间与确认在线区间求交，仅统计已确认的在线时长；没有观测到的时间不计入任一灯色。它尚不是 VRCX-jirai 的占比图，自己的完整历史视图也未验收。后续补齐可解释的统计范围、样本不足提示及图形呈现。

验收：跨天、离线时改灯色、缺少上／下线端点、自己与好友、空数据均有测试；百分比的分母只含可确认的在线时长。

参考：`VRCX-jirai/src/components/dialogs/UserDialog/UserDialogStatusDistributionTab.vue::buildChartData/loadData`（旧图表与查询；缺观测区间的算法不能照抄）；当前资料页接点 `VRCX-0-jirai/src/components/dialogs/user-dialog/components/UserDialogTabsSection.tsx`，事件表定义 `VRCX-0-jirai/crates/persistence/src/realtime/schema.rs`。

### 3. “或许是好友”线索、确认／忽略与进房提示 — 待实现

以本地共同出现、历史关系网等作为**推测线索**，单独保存候选、证据、确认／忽略状态；不把推测写入真实好友表，也不向游戏日志插入伪造的进出记录。符合条件的人进入当前房间时，通过现有活动／Overlay 通知链路显示待确认文字；通知应可关闭并避免反复轰炸。确认后如何转换为手动关系，需要在实现时明确。

验收：已确认、已忽略、证据不足、重复进房、账号切换，以及桌面／SteamVR／OpenXR 显示均需测试；提示措辞不能把推测写成事实。

参考：`VRCX-jirai/src/stores/manualRelations.js::computeSuggestions/ignoreSuggestion/addManualRelation`（候选及处置）、`VRCX-jirai/src/coordinators/gameLogCoordinator.js`（进房提示触发）；当前接点 `VRCX-0-jirai/crates/application-activity/src/overlay_activity/runtime.rs::ingest_candidate`、`VRCX-0-jirai/crates/persistence/src/mutual_graph.rs::mutual_graph_manual_link_set`。

### 4. 快捷搜索的历史与近期对象 — 部分实现

当前“最近”主要是最近打开的实体，并非最近遇到的人或最近进入的世界。基于本地共处、游戏日志和 Bio 历史构建按账号隔离的搜索来源；保留现有姓名、备注、Memo 和单字符查询。近期非好友可以出现在结果中，但须标明来源；历史 Bio 匹配需能跳转到对应玩家，不把旧简介当作其当前简介。拼音模糊匹配是 `VRCX-Luo` 的可选扩展。

验收：单字符、历史 Bio、非好友、账号切换、大量历史记录下的输入响应和结果去重。

参考：`VRCX-jirai/src/stores/quickSearch.js::loadRecentItems/filterRecentByQuery/supplementWithBioSearch`、`VRCX-jirai/src/services/database/gameLog.js::getRecentlyMetUsers/getRecentlyJoinedLocations`；当前接点 `VRCX-0-jirai/src/components/sidebar/quick-search/quickSearchHistory.ts`、`VRCX-0-jirai/src/components/sidebar/QuickSearchDialog.tsx`。拼音匹配另见 `VRCX-Luo/src/shared/utils/quickSearchUtils.js`。

### 5. 自己的完整历史视图 — 部分实现

自己的资料变化与游戏活动已有持久化路径，但尚未在个人主页把位置、头像、灯色、Bio 与上下线历史完整串起来。优先复用现有 `self_profile_log`、Feed／游戏日志查询与玩家资料组件；展示时保留数据来源、时间与缺口，不再造第二套自我历史表。

验收：自己与好友页面的数据归属正确；跨天、重启、无游戏日志及历史空白状态可理解。

参考：`VRCX-jirai/src/components/dialogs/UserDialog/UserDialogActivityTab.vue`（活动视图）、`VRCX-jirai/src/components/dialogs/UserDialog/UserDialogStatusDistributionTab.vue`（自己的灯色视图）；当前写入 `VRCX-0-jirai/crates/application-realtime/src/realtime/current_user/self_profile.rs::append_self_profile_log_entries`，展示接点 `VRCX-0-jirai/src/components/dialogs/user-dialog/components/UserDialogTabsSection.tsx`。

### 6. 双人关系页的证据边界与人数 — 部分实现

当前可显示共同实例与共处时间，但旧版的“当时最高人数”未展示。先确认现有实例／游戏日志能否可靠计算峰值；若没有足够记录，只显示未知。三分钟内进入同一房间不必然证明两人相约：当只有快照、缺少精确加入事件或有非好友可见性限制时，应显示“先后关系未知”，而非肯定归因。

验收：同房多次进入、跨天、只有快照、缺记录、实例房主变化及峰值缺失。

参考：`VRCX-jirai/src/views/Charts/components/TwoPersonRelationship.vue::sharedInstances/loadData`（共同实例和人数展示）、`VRCX-jirai/src/services/database/gameLog.js::getCoInstanceHistoryBetweenFriends/getMaxPlayerCountForLocations`（原始查询）；当前接点 `VRCX-0-jirai/src/features/charts/TwoPersonRelationshipPageImpl.tsx::groupOverlapsByLocation`。

### 7. 多账号同时登录、切换与合并视图 — 待独立设计

现有账号归属存储不等于旧版的多账号同时登录。需要先定义会话生命周期、每个 API 请求的认证账号、单账号／合并 Feed 视图，以及游戏日志由哪个实际游戏账号拥有；两个无头实例也不能自动解决单一游戏日志源的归属。完成方案与隔离测试后再实现登录与视图 UI，不把 `VRCX-Luo` 的 WIP 多账号代码当作已交付方案。

参考：`VRCX-jirai/src/services/accountSession.js::AccountSession`（独立认证会话）、`VRCX-jirai/src/services/accountHub.js::switchToMerged/switchToAccount/switchToPrimary`（视图切换）；当前已有账号切换 UI `VRCX-0-jirai/src/components/sidebar/friends-sidebar/AccountSwitcherPopover.tsx`。这里参考的是产品行为，不是建议移植旧会话服务。

### 8. 在 Feed 拖入本机文件并按 Gallery 分类上传 — 部分实现，待实测

旧版支持在 Friend Feed 页面拖入本机文件，选取 Gallery 的目标分类后跳转 Gallery 上传；并非从 Feed 条目拖出文件。合并中的代码已接入分类拖放目标与现有 Gallery 上传操作，前端测试覆盖分流；仍须在运行中的软件里验收实际文件、权限、错误反馈和分类结果。不与 Screenshot Metadata 页的导入混为一谈。

参考：`VRCX-jirai/src/views/Feed/Feed.vue::dropZones/onDrop`（拖入、选分类和设置待传文件）、`VRCX-jirai/src/views/Tools/Gallery.vue`（监听 `pendingDrop` 并上传）；当前接点 `VRCX-0-jirai/src/features/feed/FeedPage.tsx`、`VRCX-0-jirai/src/features/tools/GalleryPage.tsx`。

## 行为差异与待验收，不预设必须重写

### 关系时间轴滑条与查询 — 待实测

旧版曾因滑条参数一变就立刻查询数据库而卡顿。当前 [关系时间轴](../src/features/charts/RelationshipTimelinePageImpl.tsx)只在页面加载／手动刷新时执行 `queryRelationshipTimelineHistory`；拖动“用户数量”和“天数／单位”会即时更新滑条数值，但用尾随 1 秒计时器推迟图表重算，连续拖动会重置计时器。因此**当前滑条不会逐格重新 query**。先在正在运行的构建上记录查询次数和拖动帧率：若仍卡，定位是首次全量读库、前端会话重算还是 ECharts 绘制；不要仅为复刻旧调用顺序而重新引入逐格查询。仅当全量历史本身过大时，才考虑把日期／筛选下推 Rust 查询，并对查询做尾随 1 秒 debounce、取消过期结果。

验收：连续拖动期间不因每格变化访问数据库；停下约 1 秒后图表更新为最终参数；大数据库下滑条仍可操作；刷新后缩放范围与结果正确。

参考：`VRCX-jirai/src/views/Charts/components/RelationshipTimeline.vue::buildChartData/loadData`（旧图表更新）、`VRCX-0-jirai/src/features/charts/RelationshipTimelinePageImpl.tsx`（现有尾随计时器）、`VRCX-0-jirai/src/repositories/feedRepository.ts::queryRelationshipTimelineHistory`（实际查询入口）。

### 启动／重连补全与资料抓取进度 — 部分实现、待实测

现有实时事件、小时级好友基线、默认关闭的渐进式 Bio 扫描，以及合并中的**手动同步工作流**是不同机制；不能把缓存 TTL 或 5 秒 UI tick 算作后台全员扫描。完整好友基线到达后会自动补录当前确认在线且缺失的 Online 观测；手动工作流可重复补录并刷新资料。**登录／重连不自动触发全好友资料抓取**。仍须验证限速、账号切换、成功／未变／失败／取消计数。启动／重连只可保存重新观察到的状态，不能恢复离线期间未知的每一次变化。是否自动扫描全员须另行决定。

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
- 不默认采用：自动跟随并启动／重启 VRChat、伪造游戏日志、自动加入 Home Group、直接移植 Electron／OpenVR 生命周期。它们涉及代用户执行动作、真实数据语义或完全不同的桌面架构；旧 `VRCX-jirai` README 也把自动跟随标为不再计划。

## 实施时才需要拍板的产品语义

1. 非好友资料历史：仅显式追踪对象，还是允许从最近共处对象中手动选入？后台扫描默认关闭还是对已追踪对象自动开启？
2. 关系线索：评分达到什么程度才提示；确认是否生成手动关系；忽略后何时允许重新提示？
3. 多账号：单个游戏日志源怎样绑定实际游戏账号，合并视图中的重复事件如何去重？
4. 自动全量资料补采、自动加入群、自动启动游戏等会改变请求量或外部状态的行为，必须分别决定，不能作为普通 UI 迁移顺手开启。

## 对照来源

- [当前迁移核对表](../README.zh-CN.md#vrcx-jirai-功能还原核对表)、[`VRCX-jirai` README](../../VRCX-jirai/README.md)。
- `VRCX-Luo` 本地提交：`be43cc2f`（好友侧栏状态动画）、`4c6b4cb0`／`8fab993c`／`3f632397`（双人共享世界排行与弹窗）。
- 当前实现入口：[关系时间轴](../src/features/charts/RelationshipTimelinePageImpl.tsx)、[双人关系](../src/features/charts/TwoPersonRelationshipPageImpl.tsx)、[Bio 扫描](../crates/application/src/social/profile_bio/mod.rs)、[关系归档](../crates/persistence/src/mutual_graph.rs)。

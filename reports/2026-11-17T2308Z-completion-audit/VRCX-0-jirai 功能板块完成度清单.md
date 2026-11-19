# VRCX-0-jirai 功能板块完成度清单（v2 · 接手复审版）

| 项 | 值 |
| --- | --- |
| **首发时间戳** | `2026-11-17T23:08Z`（UTC，v1） |
| **复审更新时间戳** | `2026-11-17T23:38:47Z`（UTC，v2；北京时间 2026-11-18 07:38） |
| 基准仓库 | 本机 `VRCX-0-jirai`，`main` = `ea3142a47`（2026-11-16 全分支合并后）；复审时 `git ls-remote` 复核 `origin/main` 未变 |
| 取证工作树 | `/home/fulutang/Documents/Github/VRCX-0-jirai-integrate`（`HEAD` = `ea3142a47`）。注意：本报告所在的 `/home/fulutang/Documents/Github/VRCX-0-jirai` 当前检出的是 `port/legacy-audit-simple-ui`（`3200bc3c7`），**不是** `main`，两者代码不同，**核对必须在 integrate 工作树进行** |
| 筛查对象 | 《VRCX-JIRAI新增功能图谱.md》第 2 节「功能板块总表」（v3：**17 个条目** = 编号 #1–#16 共 16 个 + 附属项 #3b） |
| 参考文档 | 《VRCX-JIRAI新增功能图谱.md》（v3）、《VRCX-JIRAI功能锚点与VRCX-0语义映射.md》（v3，第 9 节有勘误总表） |
| 判定口径 | 「完成」= 前端入口 + 数据链路真实接通且有测试；「部分」= 有一半；「未完成」= 无实现。**不含实机验收结论**：VRCX-0 侧实机状态以 `docs/jirai-feature-backlog.md` 与 `docs/jirai-port/2026-10-13-实机验收与修复队列.md` 为准（该两份为 2026-10-13/16 记录，合并后未见更新） |
| 取证方式 | 只读（`Read`/`Grep`/`sed`/`git show`/`ssh git grep`）。VRCX-0 侧每条引用均回源码核对；jirai 侧为抽验（见《映射》9.1） |

---

## 一、总览

| 状态 | 数量 | 功能编号 |
| --- | --- | --- |
| ✅ 完成 | ~~**11**~~ ~~**13**（MIMI）~~ **14**（MIMI 遗漏补齐） | 1、2、3、3b、4、5、6、8、9、11、**16**；**MIMI 新增：14、7（与 jirai 一致：入口隐藏）、17（快速搜索近期对象与前缀）** |
| ⚠️ 部分 | ~~**2**~~ **1** | 10（**冻结**） |
| ❌ 未完成 | ~~**3**~~ **2** | 12（仅「历史清理」，**冻结**）、13 |
| ➖ 不适用 | **1** | 15 |
| 合计 | ~~**17**~~ **18**（新增 #17） | |

> 相比 v1（16 个条目，10 完成）：**新增 #16 OLD 互惠历史表**（图谱漏项，已补入并计为完成）；其余判定不变，但**多项「缺口」描述与证据被改写**（见第六节）。

**需要一眼看清的三件事**

1. 「未完成」的 7、12、13 以及「部分」的 10、14，**没有一项是单纯的遗漏**：7 是 jirai 作者自己隐藏的入口、10/14 是 VRCX-0 用户明确**暂缓**、13 有 RFC 明确**不做**；12 则是**晚于 VRCX-0 盘点截止点**、从未被盘点（且新写入的污染源已被堵住）。
2. 「完成」≠「验收通过」。例如 #3b 的推荐确认交互、#8 的自身灯色采集、#9 的拖放、#5 的周期抓取，backlog 均仍记「待实测/未通过」。
3. #1/#2 在 jirai 读 `gamelog_join_leave`，在 VRCX-0 读 Feed `GPS/Offline`，**数据口径不同**，同一对好友的共处时长两边可能不一致——这是口径选择而非 bug。

---

## 二、已完成清单（11 项）

| # | 功能 | 实现证据（`main` = `ea3142a47`） | Rust / 数据链路 |
| --- | --- | --- | --- |
| 1 | 双人关系 | `src/features/charts/TwoPersonRelationshipPageImpl.tsx`（830 行，**首行仍 `// @ts-nocheck`**）；路由 `app/routes.tsx:251` | 共处会话：`feedRepository.queryFeedUserHistory`（`feedRepository.ts:169-185`，`types:['GPS','Offline']`）；`commands.appGameLogQuery`（页内 `:302`，仅补实例峰值人数） |
| 2 | 关系时间轴 | `src/features/charts/RelationshipTimelinePageImpl.tsx`（506 行，**已无** `@ts-nocheck`；`:29-34` 引入 `relationshipHistory.ts` 4 个工具）；路由 `routes.tsx:260` | `feedRepository.queryRelationshipTimelineHistory`（`feedRepository.ts:192-224`，游标分页读 Feed `GPS+Offline`） |
| 3 | 手动关系 | `crates/persistence/src/mutual_graph.rs`（`:95` 读 / `:146 mutual_graph_manual_link_set` / `:167` 插 / `:176` 删；表 `{prefix}_manual_relations_MANUEL`，建表 `database/schema.rs:297`）；UI `MutualFriendsRelationsManager.tsx`（311 行，由 `MutualFriendsManagementSheets.tsx:75/116` 挂载）；图叠加 `lib/mutual-friends/mutualFriendsGraphData.ts:161-175` | ✅ 命令 `app__mutual_graph_manual_link_set`（`commands/local/mutual_graph.rs:72`） |
| 3b | 推测建议 | 算法 `src/features/charts/relationshipRecommendationsAlgorithm.ts`（**421 行，在目录外**）；`relationship-recommendations/` **11 文件 1486 行**（含 4 套测试与 `legacyManualRelations.fixture.json` 回归夹具）；权重/窗口/惩罚与 jirai 逐项一致 | ✅ 进房提醒：`app__relationship_recommendations_set`（`overlay_activity.rs:14`）→ `application-game/.../relationship_recommendations.rs`（183 行，`RelationshipRecommendationCache`） |
| 4 | 追踪非好友 | `crates/persistence/src/tracked_nonfriends.rs`（200 行）；侧栏 `TrackedNonfriendsSidebar.tsx`（`SidePanel.tsx:456`）；资料页入口 `UserDialogHeaderActions.tsx:214 toggleTrackedNonfriend`；刷新 `trackedNonfriendsRefreshExecutor.ts:178` | ✅ 5 个命令（`commands/local/tracked_nonfriends.rs:13/26/40/54/68`），建表 `realtime/schema.rs:87` |
| 5 | 信息抓取补全 | 执行体 `enhancedProfileFetchExecutor.ts`（380 行）+ 调度 `enhancedInfoFetchService.ts`（400 行，`:336` 由 `main.ts:9` 启动）+ 状态栏 `EnhancedInfoFetchStatus`（`StatusBarFooter.tsx:113`）+ 目标数预览 `getEnhancedInfoFetchTargetCounts`（`:95`）+ 弹窗 `SyncWorkflowDialog.tsx`（`tools.ts:318-325`） | ✅ `realtime/jirai.rs:123 profile_feed_reconcile`；后台补全 `background_ticks/profile_bio.rs:14` + `persistence/profile_bio.rs:112` |
| 6 | Bio Diff | `UserDialogInfoTab.tsx:664 UserDialogBioPanel`；**词级内联 diff** `user-dialog/bioHistory.ts:71 buildInlineBioDiff`（CJK 感知、不拼 HTML，测试 `bioHistory.test.ts:83`） | ✅ `feed_bio` 表（`realtime/schema.rs:74`）、写入 `realtime/jirai.rs:123`、回填 `feed_logger.rs:742-750 insert_backfilled_feed`、**自身** `appSelfBioHistoryQuery` → `self_status_history.rs:62`；数据源 `/profile`（`enhancedProfileFetchRequest.ts:108-146`） |
| 8 | 状态分布 | `statusDistribution.ts`（288 行）；面板 `UserDialogStatusDistribution.tsx:50`，**挂在 Activity 标签**（`UserDialogDataTabs.tsx:624`） | ✅ 自身 `appSelfStatusHistoryQuery`（`statusDistributionQuery.ts:20` → `self_status_history.rs:11`）；他人 Feed 分页（`['Status','Online','Offline']`，页大小 1000） |
| 9 | Feed 拖放上传 | `FeedImageDropOverlay.tsx`（`:13` 5 目标、`:119 onFileDragDrop`）→ `FeedPage.tsx:35` → `useFeedImageDropIntake.ts`（113 行）→ **Gallery 裁剪流程 `openCropRequest`**；受 `isVrcPlusSupporter` 门控 | ➖ 前端流程（落到 Gallery 裁剪/上传，非独立 Rust 命令；我未逐层追到上传请求，不下「走哪个 API」的结论） |
| 11 | 启动静默加群 | `features/my-groups/useMyGroupsPageState.ts:120-142`（`defaultGroupId='grp_44b87c7b-…'`，`shouldAutoJoin` = 偏好已水合 ∧ `autoJoinGroupCertification` ∧ 未加入 ∧ 本用户未尝试）；偏好键 `VRCX_autoJoinGroupCertification` 默认 `true`（`preferenceSnapshotLoader.ts:291`、`preferencesStore.ts:350`）；设置页 `SettingsAdvancedTab.tsx:117` | ✅ `groups/service.rs:514 join_group`；测试 `useMyGroupsPageState.test.tsx:236` |
| **16** | **OLD 互惠历史表** | 表 `database/schema.rs:291 {prefix}_mutual_graph_links_old`（与 jirai 同名同结构）；`mutual_graph.rs:64/224/402/431`；前端 `mutualGraphPersistenceRepository.ts`、`userDialogMutualHistory.ts:10 buildMutualHistoryRows` | ✅ **写入比 jirai 更严**：`ON CONFLICT … WHERE julianday(excluded.date) >= julianday(date)`（日期只前进）+ `observation_is_stale`（`:413`）+ 全参数化；jirai 为拼接 SQL 的 `INSERT OR REPLACE … date=now` |

### 已完成项里的缺口与行为差异（不影响判定，但需记录）

1. **#4 追踪非好友没有自己的 Online/Offline 事件流**：`crates/persistence/src/realtime/jirai.rs:83` 显式拒绝非好友（`"Startup online backfill target is not a current friend."`）。追踪对象只有「名单 + 改名 + 资料补抓（Bio/状态 reconcile）」。这与 backlog `:71`「追踪非好友的 Bio／状态历史 — 已接入」口径一致：补的是**资料历史**而非**在线事件**。
2. **#3 的 `relationType` 固定 `'friend'`**（`mutual_graph.rs:167`）、`MutualFriendsRelationsManager.tsx` 无类型引用。**这不是功能退化**：jirai 的 3 个写入调用点（`ManualRelationsDialog.vue:260/292`、`userCoordinator.js:755-758`）也全部传 `'friend'`，没有任何 UI 提供其他类型。
3. **#1/#2 数据口径与 jirai 不同**（见上），验收时不要拿 jirai 的数字对账。
4. **#11 触发时机不同**：jirai 在登录后群组加载完即触发；VRCX-0 的 `useMyGroupsPageState` **仅被 `MyGroupsPage.tsx:75` 使用**，必须**进入「我的群组」页并完成偏好水合后**才会尝试加入（`README.zh-CN.md:91` 亦如此描述）。若用户从不打开该页，则不会自动加入。
5. **#5 两个工作流动作仍是桩**：`syncWorkflowActions.ts:121/133` 的 `manual-relations-sync`、`relationship-recommendations` 为 `skippedAction`（推荐实际由 `registerEnhancedRelationshipRecommendations`，`enhancedInfoFetchService.ts:140` 并行任务驱动）。
6. **#6/#8 自身历史**：backlog `:16` 记「旧版自身历史补迁」为 2026-10-16 **新增待实现**（jirai 把自身 Bio/灯色存在通用 Feed 表，VRCX-0 只读 `self_profile_log`，迁入的旧记录会缺失）；`:79` 记「自身灯色采集仍待查」。
7. **#8 位置变化**：jirai 是独立 `status-distribution` Tab（仅好友/自己可见，`UserDialog.vue:144-147`）；VRCX-0 是 Activity 标签内的一块面板。
8. **#3b 实机状态**：backlog `:87` 小节标题「推荐确认交互**未通过**，Overlay 暂缓」，`README.zh-CN.md:77`「推荐弹出策略留待讨论」。**算法与 jirai 一致 ≠ 交互验收通过**；「评分到多少才提示、忽略后何时可重新提示」是 backlog `:203` 的待拍板产品语义。

---

## 三、部分完成清单（2 项）

| # | 功能 | 已有什么 | 缺什么 | 性质 |
| --- | --- | --- | --- | --- |
| 10 | 假记录注入（**冻结**） | Rust 命令 `app__game_log_entries_add`（`commands/local/game_log.rs:36`）、`GameLogWriteKind`（含 `External`/`Event`）、前端写入封装（`gameLogPersistenceRepository.ts:75 addGameLogEntries`、`:183 addGamelogEventToDatabase`、`:187 addGamelogExternalToDatabase`） | **无任何 UI 调用方**（除封装自身与 `bindings.ts:228` 外零引用）；无 PreviousInstances 入口；无来源模型（无 `provenance`/`source`/`isFake`） | **有意暂缓且有设计门槛**：`docs/jirai-port/reports/合成历史记录.md` 结论「暂不实现」，要求先建完整性契约——专用命令 + `provenance=manual_synthetic`、仅当前所有者可建/删、查询显式选择是否含合成行且默认分析路径排除、确认对话框/可见标记/审计时间戳。backlog `:198` 亦列「暂缓：手动插入实例进出记录」 |
| 14 | 快速搜索 Bio 检索 **→ MIMI 完成** | Feed 页内 bio 检索（`crates/persistence/src/feed/query.rs:300`，含 `previous_bio`；入口 `:460 feed_search_query`，前端 `feedRepository.ts:137`） | ① 全局快速搜索目录 `quick_search_catalog.rs:111-121` 仅 **7 类**（friends/own_avatars/favorite_avatars/own_worlds/favorite_worlds/own_groups/joined_groups），**无 bio**；② 语义不同：jirai `searchBiosByContent` 用 `MAX(id) GROUP BY user_id` 只匹配**每人最新一条**，VRCX-0 查历史行，会让同一人重复出现 | **产品暂缓**：`README.zh-CN.md:122` 与 backlog `:95-105`「用户 2026-10-02 决定暂不优化搜索，移出近期计划」；backlog `:99` 还纠正了此前「遍历全部旧版本 Bio」的误读 |

---

## 四、未完成清单（3 项）

| # | 功能 | 核查结果 | 性质 / 备注 |
| --- | --- | --- | --- |
| 7 | 自动跟随好友 **→ MIMI 完成（与 jirai 一致：入口隐藏）** | `src/`、`crates/`、`src-tauri/` 下 `autoFollow`/`auto_follow`/`tryOpenInstance`/`followFriend` **零命中**（仅 `docs/` 提及）；只有手动动作 `src/components/instances/useInstanceActionBarController.ts:270 launchInstance` | **有意不做**：jirai 作者 `3a5c269e`（2026-04-04「隐藏"自动跟随"按钮」）主动隐藏了入口；backlog `:198` 标「暂缓」；`docs/jirai-port/执行任务/11-自动跟随好友实例.md` 保留设计参考 |
| 12 | Bio 清空突发清理（**冻结**） | **历史清理：无**（`bioClear`/`suspiciousBio`/`clearBurst`/`bio_clear` 零命中；唯一 `suspicious` 是好友基线漂移 `crates/application-realtime/src/social_baseline/service/friends/baseline.rs:123`，同名不同义）。**写入预防：有**——前端缺字段即省略（`enhancedProfileFetchExecutor.ts:263`）、Rust `input.bio: Option<String>` 且 `bio_updated`（`realtime/jirai.rs:186`）仅 `Some` 才触发，测试 `realtime/jirai/tests.rs:225` 断言 `bio: None` → `!bio_updated` | **未被盘点**：`README.zh-CN.md:85` 盘点截止 `c8b8f744`（2026-05-20），而 #12 本体 `198e07f8` 是 2026-09-27，在其之后。**移植价值**：仅「迁入 jirai 旧库、需清历史污染」场景才需要，新写入无需再做 |
| 13 | 多账户 V4 | `accountHub`/`aggregatedView`/`AccountSession` 在 `src/`、`crates/`、`src-tauri/` 零命中；只有「已保存账号 + 切换」（`accountSwitchService.ts`、`AccountSwitcherPopover.tsx`、`features/auth/components/SavedAccountsCard.tsx`） | **已有产品决策：不做**。`docs/jirai-port/多账户进程隔离-RFC.md:3`「仅 RFC，不实现」、`:28` 把旧 V4 定性为「反例而非移植源」；jirai 侧 `accountHub.js` 另有 9 处 `require()` 在 ESM 里会失败并被吞掉，`setPrimary` 链路可能从未跑通 |

---

## 五、不适用（1 项）

| # | 功能 | 原因 |
| --- | --- | --- |
| 15 | 更新通道重定向到 jirai | VRCX-0-jirai 有自己的发版链（`release.yml` → GitHub Release 草稿），与 jirai 的更新客户端不同源。（jirai 侧真正生效的更新端点是 `settings.js:2/24/29`，由 `6fcd325a` 改到 `FuLuTang/VRCX-jirai`） |

---

## 六、与 v1（2026-11-17T23:08Z）的差异

**判定层面**：仅新增 #16（完成）；#11 的「完成」结论保持；其余 16 个条目的分类不变。

**证据/缺口层面（v1 的错误）**——这些是复审中回源码发现的，已全部改正：

| # | v1 说法 | v2 实测 | 证据 |
| --- | --- | --- | --- |
| 1 | #1/#2/#8「Rust 侧：`queryFeedUserHistory`」 | #1 用它；#2 用 `queryRelationshipTimelineHistory`；#8 自身用 `appSelfStatusHistoryQuery`、他人用 Feed 分页 | `feedRepository.ts:169/192`、`statusDistributionQuery.ts:20-34` |
| 2 | #6「`UserDialogInfoTab.tsx:706 buildLineDiff` + `historyUtils.ts:92`」 | InfoTab 已不引用 `buildLineDiff`；词级内联 diff 在 `bioHistory.ts:71` | `UserDialogInfoTab.tsx:664/747`、`bioHistory.ts:71` |
| 3 | #3b「10 文件 1389 行；前端计算」 | 11 文件 1486 行 + 目录外 421 行算法 + Rust 进房提醒缓存 183 行 | `wc -l`、`relationship_recommendations.rs` |
| 4 | #9「上传走 VRChat API，非本地 Rust」 | 实际是交给 Gallery 裁剪流程（`openCropRequest`），受 VRC+ 门控；上传请求层我未追，不下结论 | `useFeedImageDropIntake.ts:53`、`useGalleryPageController.ts:140` |
| 5 | #11 已完成项「`groups/service.rs`」 | 函数是 `join_group`（`:514`），命令标识 `app__vrchat_group_join` | `service.rs:514-515` |
| 6 | #10 备注「无来源模型」 | 补上设计门槛出处 `合成历史记录.md` | 该文件「建议」节 |
| 7 | #12「唯一真正没做的功能」 | 清理无但预防有；且未被盘点 | 见第四节 |
| 8 | 结论建议顺序「#10 → #14 → #12」 | 三者均有**产品暂缓/前置决策**，不应直接开工，见第七节 | backlog `:95-105/:198`、`合成历史记录.md` |

---

## 七、结论与建议

**结论**

- 17 个条目中：**11 完成、2 部分、3 未完成、1 不适用**。
- 未完成/部分的 5 项里，**真正「该做而没做」的只有 #12 的历史清理**，且仅在迁入 jirai 旧库场景才有意义；其余 4 项（7、10、13、14）都是**有明确产品决策或设计门槛的取舍**。
- 「完成」仅指代码与入口接通且有测试；**实机验收未闭环**的有 #3b（交互未通过）、#5（待实测）、#8（自身灯色待查）、#9（待复测）。

**建议（按「先决策、再动工」排序，而不是 v1 的「成本从低到高」）**

1. **先回答「要不要迁入 jirai 旧库」**。这一个决策同时决定：#12（历史清理）要不要做、#6/#8 的「旧版自身历史补迁」要不要做、#16 的旧 `_links_old` 能否直接读用。
2. **#10**：先落地 `合成历史记录.md` 要求的完整性契约（专用命令 + `provenance`），再谈 UI；否则会污染实例历史、关系图表与推荐。
3. **#14**：先拍板语义（「每人最新一条」还是「含历史」），再给 `quick_search_catalog.rs` 加 bio 类别。用户 2026-10-02 已决定暂缓，需用户重启此议题。
4. **#3b 的 backlog `:203` 产品语义**（提示阈值、忽略后何时可重新提示）与「推荐确认交互」实机验收，是比新增功能更紧的收尾项。
5. 清理项：`RelationshipUserPicker.tsx` 在 `main` 上无生产代码引用（仅其自带测试），可连同测试一并删除或替换。
6. **保持不做**：#7、#13。

---

## 七·补、后续（2026-11-18T00:53Z）

本清单中「部分」与「未完成」共 5 项（#10、#14、#7、#12、#13）的 **Rust 重写开发路径**与 **jirai 基线决议**见 `reports/2026-11-18T0053Z-rust-rewrite-roadmap/README.md`。该路径对本清单有两处**补充性发现**（本清单正文未改）：

1. **#10 的出处**：`c4f1a461`（2026-04-29）是 FuLu糖福禄本人的提交，标题含「refine relation recommendation logic」，上游 0 命中；它是为关系推荐服务的，而 VRCX-0 的推荐输入（`relationshipRecommendationData.ts:40-47`）同样读 GameLog 的 `OnPlayerLeft`，所以假记录一旦写入就会流进 #3b。
2. **#14 可以零新增 SQL**：`profile_bio` 表每人一行，`profile_bio_list` 已存在，可直接接入 `QuickSearchDetailStore`（上文 #14「缺什么」里的「聚合最新 bio」问题因此消解）。

---

## 八、本报告的自查与未核对范围

- **自查**：复审过程中我曾把 v1 沿用的一个行号（`tools.ts:316`）写进新文字，核对时发现该行是 `},`，已改为真正入口 `tools.ts:318-325`；另有 `bio_updated`、`hasBio` 等行号写错后已更正。本报告第二至四节的 VRCX-0 侧引用均已回源码核对。
- **未核对 / 不下结论**：
  - jirai 开发线 `bd2f45f0`（pc114514，266 提交未推送）除 `publicProfileRef`（已适配）与 `links_old`（存在）外的行为差异；pc114514 的 16 项未提交改动内容。
  - #9 拖放之后的**上传请求具体走哪层 API**。
  - 用 jirai 旧数据库在 VRCX-0 上做**迁移实测**（`_links_old` 同表名同结构，仅为静态比对）。
  - 任何实机验收。
- **取证位置提醒**：本目录所在工作树（`port/legacy-audit-simple-ui`）与 `main` 代码不同；若直接在本目录 `grep`，会得到与本报告不同的结果（例如 `manual_relations.rs` 在 `port` 分支存在、在 `main` 已并入 `mutual_graph.rs`）。

---

> **2026-11-18T04:15Z 基线口径更新：现统一以 GitHub VRCX-jirai 主分支 `refs/heads/master` @ `c7eaf00e`（相对上游 VRCX 的差分 `d97327d8..c7eaf00e`）为唯一差分参考基线，`c8b8f744` 不再作为「历史对照」基线。决议见 `reports/2026-11-18T0053Z-rust-rewrite-roadmap/README.md` 第 1.0 节。**完成度计数（11 / 2 / 3 / 1）不受影响；#12 属于基线内的未完成项。

> **2026-11-18T04:43Z 补充：VRCX-0-jirai 侧基线冻结在 pc114514 的 `ea3142a47`**（`C:\Users\tangh\Documents\GitHub\VRCX-0-jirai`，`main`）。本清单的计数（11 / 2 / 3 / 1）就是对这个提交的判定；以后的进展写成相对它的增量。决议见 `reports/2026-11-18T0053Z-rust-rewrite-roadmap/README.md` 第 1.0b 节。

> **2026-11-18T15:29Z 补充（路径修订 6）：#6、#10、#12 冻结。**#10、#12 的判定（部分 / 未完成）不变，但不再推进；#10 在 `ea3142a47` 上已有的写入管道列入冻结清单，不得改动。本轮只推进 #14、#7（#13 只做 R0 只读调研）。依据见 `reports/2026-11-18T0053Z-rust-rewrite-roadmap/完善计划.md` 修订 6。

> **2026-11-18T20:50Z 回写（MIMI 交付，`reports/2026-11-18T2050Z-mimi-delivery/README.md`）**：在分支 `MIMI`（相对冻结基线 `ea3142a47` 的增量）上，**#14 快速搜索 Bio → 完成**（全局快速搜索好友结果按 `profile_bio` 当前 Bio 匹配，第 4 级 名字 > 备注 > 笔记 > Bio，≥2 字符，共享 8 条上限；结果行显示 Bio）；**#7 自动跟随 → 完成（与 jirai 一致：入口隐藏）**（Rust 状态机 + 事件，前端执行 attach / 退出并桌面重启；对话框挂全局 Host，无可见入口）。#10、#12 **冻结**（判定不变，不推进）；#13 不做。计数：**完成 13 / 部分 1（#10 冻结）/ 未完成 2（#12 冻结、#13）/ 不适用 1**。已完成 11 项的行未改动（冻结清单守卫 G-1 输出 0 行）。真机表现见同目录《人工实机测试文档.md》，未在本轮验证。

> **2026-11-19T01:05Z 回写（MIMI 历史遗留修复与遗漏补齐，`reports/2026-11-19T0105Z-mimi-legacy-fix-delivery/README.md`）**：依据仓库根目录《历史遗留修复与遗漏补齐.md》补齐 M1–M4（M5 忽略）。① **#3b** 补齐子入口「打开玩家资料时弹推测关联询问」（M1，修复队列 R04 落地）；② **#6** 补齐子行为「Feed 页 Bio / 状态 diff 按 CJK 字切分」（M2）；#3b、#6 仍为完成，计数不变。③ **新增 #17「快速搜索近期对象与前缀」→ 完成**（M3：空查询显示最近遇到 / 最近去过，按账号隔离；M4：`!` `@` `#` 前缀）。计数 **完成 14 / 部分 1（#10 冻结）/ 未完成 2（#12 冻结、#13）/ 不适用 1**（合计 18 项）。已完成项的既有行未改，只追加。真机表现见同报告目录《人工实机测试文档.md》。

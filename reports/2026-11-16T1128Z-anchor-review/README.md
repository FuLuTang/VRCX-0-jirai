# VRCX-JIRAI 功能锚点与 VRCX-0 语义映射 · 第三次复审报告

| 项 | 值 |
| --- | --- |
| **报告时间戳（签发）** | `2026-11-16T11:29:57Z`（UTC 签发）<br>`2026-11-16T11:28:28Z`（本轮首次取证）<br>北京时间 `2026-11-16 19:28` |
| 审查范围 | `VRCX-jirai`、`VRCX-0-jirai`、上游 `vrcx-team/VRCX` 三仓 |
| 审查目标 | 14 项 jirai 独有功能的根入口点、建立基础、VRCX-0 同类语义复核；检测他人改动 |
| 审查方式 | 只读（`git ls-remote`/`git log`/`grep`/`sed`），未 checkout、未提交、未改工作树 |
| 上一版报告 | `VRCX-JIRAI功能锚点与VRCX-0语义映射.md`（2026-11-16 首版 + 上游 `bfd91089` 复审） |

---

## 0. 本轮结论摘要

1. **两个工作仓库都没有被他人改动**：`VRCX-jirai` 本地=`c7eaf00e`=远程 master；`VRCX-0-jirai` 本地=`3200bc3c7`=远程 `port/legacy-audit-simple-ui`。工作区除既有批注与交付文档外干净。
2. **他人改动集中在上游**：`vrcx-team/VRCX` 自我上次复审（`bfd91089`）之后又前进 **6 个提交**，累计相对 `20fe6963` 共 **+9**。
3. **14 项独有性未受影响**：新增 6 个提交中没有一项与 jirai 的功能语义重叠（3 个是新功能：好友列表邀请徽章、队列就绪闹钟、本地化更新；3 个是重构简化）。
4. **14 项根入口全部抽验通过**（15 个锚点逐条 `grep` 命中）。
5. **冲突面扩大到 9 个文件**（上批 3 + 本批 6，无重复），其中 4 个是 i18n 文件。
6. **新增一项移植注意点**：上游简化了 `replaceBioSymbols`，而 jirai 的 Bio Diff 组件**根本没有调用**该函数——两侧符号处理策略不一致。

---

## 1. 他人改动检测

### 1.1 三仓状态对照

| 仓库 | 本地 HEAD | 远程最新 | 差值 | 判定 |
| --- | --- | --- | --- | --- |
| `VRCX-jirai`（`/home/fulutang/Documents/Github/VRCX-jirai`） | `c7eaf00e` | `refs/heads/master` = `c7eaf00e` | 0 | ✅ 无改动 |
| `VRCX-0-jirai`（当前目录） | `3200bc3c7` | `port/legacy-audit-simple-ui` = `3200bc3c7` | 0 | ✅ 无改动 |
| `reference/VRCX`（上游镜像） | `20fe6963` | `refs/heads/master` = **`e819c4e4`** | **+9** | ⚠️ 上游前进 |

### 1.2 工作区状态

- `VRCX-jirai`：`git status` 空（干净）
- `VRCX-0-jirai`：仅 `docs/jirai-port/旧版功能清单.md` 的既有批注（会话开始前就存在）+ 本轮及历史交付的未跟踪 md

### 1.3 上游两批新增提交

**第一批（`20fe6963..bfd91089`，3 个）** — 上次复审已记录

| 提交 | 标题 | 改动面 |
| --- | --- | --- |
| `2a6bf927` | Fix bio translate | `UserDialogInfoTab.vue` 1 行 |
| `a7e7dd1f` | Clean up types | 6 个 transforms + `vrcx.d.ts` |
| `bfd91089` | Fix tests | 测试 + `*Columns.jsx` import 具名化 |

**第二批（`bfd91089..e819c4e4`，6 个）** — 本轮新增

| 提交 | 标题 | 类型 | 与 14 项关系 |
| --- | --- | --- | --- |
| `e819c4e4` | Show recent invite badge in friends list (#1944) | 新功能 | 无关（好友列表徽章，jirai 无此功能） |
| `de1633fa` | Add opt-in queue ready alarm (#1955) | 新功能 | 无关（队列闹钟，jirai 无此功能） |
| `03891bbd` | Update localization (#1957) | i18n | 间接（jirai 也改了 i18n） |
| `46a6e704` | Simplify timeAgo, HSVtoRGB and replaceBioSymbols (#1952) | 重构 | **间接**（见 3.2） |
| `8b06f6ca` | Share one normalize config table per activity view (#1951) | 重构 | 间接（jirai 改过 `activity.js`） |
| `615bc895` | Simplify friend sort helpers with lookup tables (#1949) | 重构 | 无关 |

**独有性复核**：对两批提交涉及的文件名与内容做关键词比对，`trackedNonFriends` / `manualRelations` / `autoFollow` / `statusDistribution` / `quickSearch` / `relationshipTimeline` / `TwoPersonRelationship` / `accountHub` **全部 0 命中**。新增的两个功能（邀请徽章、队列闹钟）在 jirai 侧也不存在，属于"上游独有"，不影响 jirai 的独有判定。

---

## 2. 14 项功能的根入口与建立基础（本轮重新抽验）

抽验方式：逐条 `sed -n '<line>p'` + `grep -c`，命中即视为锚点仍成立。

### 2.1 根锚点验证结果

| # | 功能 | 抽验的锚点 | 命令结果 |
| --- | --- | --- | --- |
| 1 | 双人关系 | `router.js:119` `charts/two-person` | ✅ 命中 |
| 1 | 双人关系 | `ui.js` 导航定义 `charts-two-person` | ✅ 2 处 |
| 2 | 关系时间轴 | `panelRegistry.js` `charts-timeline` | ✅ 命中 |
| 3 | 手动关系 | `MutualFriends.vue:78` 按钮 | ✅ 命中 |
| 4 | 追踪非好友 | `Sidebar.vue` `value: 'tracked'` | ✅ 命中 |
| 5 | 信息抓取 | `tools.js` `info-completion` | ✅ 命中 |
| 6 | Bio Diff | `UserDialog.vue` `value: 'Info'` | ✅ 命中 |
| 7 | 自动跟随 | `FriendsSidebar.vue:203` HTML 注释 | ✅ **仍被注释**（入口不可达） |
| 8 | 状态分布 | `UserDialog.vue` `status-distribution` | ✅ 3 处 |
| 9 | Feed 拖放 | `Feed.vue:208` `onDrop` | ✅ 命中 |
| 10 | 假记录 | `PreviousInstancesInfoDialog.vue:131` `handleAddFakeRecord` | ✅ 命中 |
| 11 | 启动加群 | `groupCoordinator.js:666` `autoJoinGroupCertification` | ✅ 命中 |
| 11 | 启动加群 | `advanced.js:74` `ref(true)` / `:173` `getBool(...,true)` | ✅ 默认开启 |
| 12 | Bio 清理 | `infoFetchCoordinator.js:126` `cleanupSuspiciousBioClearBurst` | ✅ 命中 |
| 13 | 多账户 | `Login.vue:363` `addSession` | ✅ 命中（`accountHub` 9 处 `require` 仍在） |
| 14 | 快速搜索 | `Sidebar.vue` `Ctrl+k` | ✅ 命中 |
| 15 | 更新通道 | `settings.js` `GITHU_API_URL` | ✅ 6 处 |

**结论：15/15 锚点全部成立，与上一版一致。**

### 2.2 建立基础速查（表名 / 查询 / API）

| # | 功能 | 关键表 | 关键查询/API |
| --- | --- | --- | --- |
| 1 | 双人关系 | `gamelog_join_leave` | `gameLog.js:1675 getCoInstanceHistoryBetweenFriends`；补充 `:1722 getInferredLocationSessions` |
| 2 | 关系时间轴 | `gamelog_join_leave` | `gameLog.js:2001 getRelationshipTimelineData` |
| 3 | 手动关系 | `{prefix}_manual_relations_MANUEL` | `manualRelations.js:104 getCandidateCoInstances`（三源 UNION） |
| 4 | 追踪非好友 | `{prefix}_tracked_nonfriends` | `nonFriendCoordinator.js:13` + `api/user.js:19 getUser` |
| 5 | 信息抓取 | `_feed_bio` / `_feed_status` | `infoFetchCoordinator.js:96 runSilentInfoFetch` |
| 6 | Bio Diff | `{prefix}_feed_bio` | `feed.js:111 getRecentBioChangesForUser` |
| 7 | 自动跟随 | **无表**（纯内存） | `autoFollow.js:37-52` watch location |
| 8 | 状态分布 | `_feed_status` / `_feed_online_offline` | `feed.js:235 getStatusHistoryForUser`、`:257` |
| 9 | Feed 拖放 | 无（复用 Gallery） | `gallery.js:78 pendingDrop`、`api/vrcPlusImage.js` |
| 10 | 假记录 | `gamelog_join_leave` | `gameLog.js:139 addGamelogJoinLeaveToDatabase` |
| 11 | 启动加群 | 无（无新表） | `api/group.js:135 joinGroup` |
| 12 | Bio 清理 | `{prefix}_feed_bio` | `feed.js:163 deleteBioClearChangesBetween` |
| 13 | 多账户 | 多库前缀 | `aggregatedView.js:24 mergeFriends`、`:200 lookupAggregatedFeed` |
| 14 | 快速搜索 Bio | `{prefix}_feed_bio` | `feed.js:68 searchBiosByContent`（`MAX(id) GROUP BY user_id`） |
| 15 | 更新通道 | 无 | `settings.js:24/29 urlReleases` → `vrcxUpdater.js:312` |

---

## 3. VRCX-0 同类语义复核

`VRCX-0-jirai` HEAD 未变（`3200bc3c7`），9 个关键文件行数与上轮一致，结论不变：

| # | 功能 | VRCX-0 等价物 | 等价度 |
| --- | --- | --- | --- |
| 1 | 双人关系 | `TwoPersonRelationshipPageImpl.tsx`（729 行） | 高 |
| 2 | 关系时间轴 | `RelationshipTimelinePageImpl.tsx`（587 行） | 高 |
| 3 | 手动关系 | `crates/persistence/src/manual_relations.rs`（326 行）+ `ManualRelationsControl.tsx` | 高 |
| 4 | 追踪非好友 | `crates/persistence/src/tracked_nonfriends.rs`（200 行）+ `TrackedNonfriendsSidebar.tsx` | 高 |
| 5 | 信息抓取 | `profileFetchExecutor.ts` + `syncWorkflowActions.ts`（139 行） | 高（形态改为工作流弹窗） |
| 6 | Bio Diff | `UserDialogInfoTab.tsx:706 buildLineDiff` | 高（行级非词级） |
| 7 | 自动跟随 | 无 | 无 |
| 8 | 状态分布 | `statusDistribution.ts`（147 行） | 高 |
| 9 | Feed 拖放 | `useFeedImageDropIntake.ts`（113 行） | 高（落 Gallery 队列） |
| 10 | 假记录 | `app__game_log_entries_add` 有，**零调用方** | 低 |
| 11 | 启动加群 | 只有普通 `joinGroup` | 低 |
| 12 | Bio 清理 | 无 | 无 |
| 13 | 多账户 | 无（RFC 明写不实现） | 无 |
| 14 | 快速搜索 Bio | `feed/query.rs:300`（但查历史行、不进全局搜索） | 中 |
| 15 | 更新通道 | N/A（独立发版链） | N/A |

**补充：本轮复核 `realtime/jirai.rs` = 147 行**，其中 `insert_startup_online_backfill` 仍在 `:58-62` 拒绝非好友目标——这是 #4 追踪非好友"没有自己事件流"的直接原因，与上轮一致。

---

## 4. 上游漂移与冲突面（累计）

### 4.1 冲突面：jirai 改过 × 上游新改过

| 批次 | 文件 | 风险 |
| --- | --- | --- |
| 第一批 | `src/shared/utils/userTransforms.js` | 中（bio 默认值语义） |
| 第一批 | `src/shared/utils/__tests__/userTransforms.test.js` | 低 |
| 第一批 | `src/components/dialogs/UserDialog/UserDialogInfoTab.vue` | 低（jirai 用独立文件） |
| 第二批 | `src/localization/en.json` | 低（i18n 合并） |
| 第二批 | `src/localization/ja.json` | 低 |
| 第二批 | `src/localization/zh-CN.json` | 中（287 行大改，jirai 新增功能文案也在其中） |
| 第二批 | `src/localization/zh-TW.json` | 低 |
| 第二批 | `src/stores/activity.js` | 中（上游 -90 行重构，jirai +19/-1） |
| 第二批 | `src/views/Sidebar/components/FriendItem.vue` | 中（上游 +21/-5，jirai +19） |

合计 **9 个冲突文件**（无重复）。

### 4.2 能力落后（累计两点）

| 点 | 上游提交 | jirai 状态 | 影响 |
| --- | --- | --- | --- |
| `publicProfileRef` 数据源 | `defa27fc`（2026-09-16） | 未跟进，`grep publicProfileRef` 零命中 | Bio Diff 可能把"隐私隐藏"误判为"清空" |
| `replaceBioSymbols` 简化 | `46a6e704`（2026-11-16） | jirai 的 `UserDialogInfoTabJirai.vue` **根本不调该函数**（仅测试 mock 中出现） | 两侧 bio 符号处理策略不一致；移植时不能照抄 |

### 4.3 整体落后程度

`d97327d8..upstream/master` = **416 个上游提交**未跟进（上次 410，本次 +6）。

---

## 5. 结论与建议

| 项 | 结论 |
| --- | --- |
| 他人改动 | 两个工作仓库无改动；上游 +9（两批） |
| 14 项独有性 | ✅ 仍成立 |
| 根入口锚点 | ✅ 15/15 抽验通过，与上版一致 |
| VRCX-0 语义映射 | ✅ 不变（6 高 / 2 高形态异 / 1 中 / 1 低 / 1 低 / 3 无） |
| 新增关注点 | 冲突面 9 文件 + `replaceBioSymbols` 策略不一致 |

**建议**：
1. 合并 jirai 上游时优先处理 `zh-CN.json`（jirai 新功能文案与上游 287 行本地化更新同一文件，最容易冲突）。
2. 移植 #6 Bio Diff 前，先确定 VRCX-0 与上游新版分别用哪个 bio 字段（`publicProfileRef` vs `ref.bio`）、要不要做 `replaceBioSymbols`。
3. #7 自动跟随与 #13 多账户维持"不做"判断：前者入口被注释、后者 `require` 断链。
4. 若要把本报告并入主映射文档，建议只保留「第 6 节 上游漂移」的增量部分，主档以 `VRCX-JIRAI功能锚点与VRCX-0语义映射.md` 为准。

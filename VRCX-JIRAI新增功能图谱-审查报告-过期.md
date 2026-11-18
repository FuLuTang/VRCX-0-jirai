# 《VRCX-JIRAI 新增功能图谱》审查报告

- 审查对象：`VRCX-JIRAI新增功能图谱.md` v1（271 行）
- 审查时间：2026-11-15
- 审查方式：3 名独立只读子代理分工核查 + 主代理复核关键项
  - `audit-proof`：第 1 节证明链、第 2 节功能表
  - `audit-claims-1`：闭环断言 A1–A7
  - `audit-claims-2`：闭环断言 A8–A13、第 5 节排除项、第 6 节移植对应
- 全程只读：仅 `git log/show/diff/rev-list/merge-base/grep/sed/wc/test -e`，未 checkout / commit / stash / 写盘
- 结论：**v1 有 15 处错误**（4 处影响结论、7 处行为描述失真、4 处口径问题），已全部修正进 v2

---

## 0. 错误总览（按严重度）

| # | 位置 | 严重度 | 问题 | 正确值 |
| --- | --- | --- | --- | --- |
| 1 | A7 自动跟随 | 🔴 严重 | 声称「好友侧栏按钮」为入口 | **入口整块被 HTML 注释**，功能实际不可达 |
| 2 | A13 多账户 | 🔴 严重 | 声称「未合入 master，在 feat/multi-account」 | **早已合入 master**（`75e1c7e4`） |
| 3 | 第 5 节 / 功能表 | 🔴 严重 | 把「快速搜索」整项排除为上游已有 | 本体是上游的，但 **Bio 历史检索是 jirai 新增**（`a94824c2`），漏项 |
| 4 | 图谱 | 🔴 严重 | 画了 `J3→J2`、`J6→J5` 两条依赖 | 两条**均不成立**，grep 零命中 |
| 5 | A1 双人关系 | 🟠 中 | 主数据源写 `feed_gps`；存储写 `feed_gps`+`feed_status` | 主查询是 `gamelog_join_leave`；读 3 表且**不含 feed_status** |
| 6 | A2 时间轴 | 🟠 中 | 聚合「共处/状态变更」；归一化 0–1；只读 Feed+GameLog；有平滑/高亮开关 | 只聚合共处；**0–100**；只读 GameLog；**无平滑开关** |
| 7 | A6 Bio Diff | 🟠 中 | 「打开面板时记录快照」 | **不写快照**，从 `previous_bio` 历史回推 24h 基线 |
| 8 | A5 行数 | 🟠 中 | `infoFetchCoordinator.js` 196 行 | **242 行** |
| 9 | A8 行数 | 🟠 中 | `UserDialogStatusDistributionTab.vue` 374 行 | **458 行** |
| 10 | A12 测试行数 | 🟠 中 | 测试「108 行」 | **204 行**（108 是增量） |
| 11 | A13 行号 | 🟠 中 | `Login.vue:358 addSession` | **`:363`**（358 是注释） |
| 12 | 第 1 节 | 🟡 轻 | 「`d97327d8` 不是分叉点」与头部「分叉点：d97327d8」自相矛盾 | merge-base **就是** `d97327d8`；`a610a5bc` 是 jirai 侧首个提交 |
| 13 | 第 1 节 | 🟡 轻 | 作者分布挂在「227」名下，实际合计 184 | 227 口径：福禄 94/copilot 90/Haochen 27/FuLuTang 11/pa 4/Yutho 1 |
| 14 | 第 1 节 | 🟡 轻 | 「无上游作者提交」 | **`pa` 是上游作者**（上游 977 提交），jirai 侧保留 4 个 |
| 15 | 第 2 节 | 🟡 轻 | 多账户首提交 `733dab99` | **`17518d9b`**（04-30），`733dab99` 是重构 |

---

## 1. 严重问题详情

### E1 · A7 自动跟随的 UI 入口被注释（功能不可达）

**v1 说法**：入口 = `FriendsSidebar.vue:206` 自动跟随按钮 → `AutoFollowDialog.vue` → `startFollow`。

**实测**：

```
FriendsSidebar.vue:203  <!-- <div class="absolute bottom-5 right-[70px] z-10">
             :204      <button class="auto-follow-btn"
             :206      :class="{ 'auto-follow-btn--active': autoFollowStore.isActive }"
             :207      @click="toggleAutoFollow">
             ...
             :211  </div> -->
```

- `toggleAutoFollow` 定义在 `:272`，唯一调用点 `:207` **处于注释内**
- `openAutoFollowDialog` 仅在 `:276`（`toggleAutoFollow` 内）被调用
- `isAutoFollowDialogOpen` 唯一写入点是 `autoFollowCoordinator.js:6 openAutoFollowDialog()`
- `MainLayout.vue:86` 虽挂载了 `AutoFollowDialog`，但**永远无法打开**
- 残留：`auto-follow-btn` 样式 `:993-1024` 成孤立死代码

**影响**：这是本次审查最重要的发现。v1 把 A7 当"完成"功能写进图谱，会导致移植清单误判优先级。修正后标注为「代码完整但入口不可达」，A7 在 v2 图谱中加 ⚠️。

### E2 · A13 多账户已合入 master

**v1 说法**：「⚠️ 链路存在但**未合入 master**（在 `feat/multi-account` 分支），且设计文档自述接口不完整，不能视为可用功能」。

**实测**：

| 核验 | 结果 |
| --- | --- |
| `git merge-base --is-ancestor 733dab99 refs/heads/master` | 退出码 0 → **是祖先** |
| `git rev-list --count refs/heads/master..origin/feat/multi-account` | **0** |
| 合并提交 | `75e1c7e4`「Merge pull request #33 from FuLuTang/feat/multi-account」（2026-05-17） |
| 三个文件在 HEAD 树中 | `accountHub.js` 413 / `accountSession.js` 441 / `aggregatedView.js` 221 |

**影响**：v1 用"分支未合并"作为"不可用"的理由不成立。修正后 WIP 结论只保留「设计文档 Draft + 旧版聚合代码接口不完整」这一条依据。

**附带坑**：`VRCX-jirai` 仓库同时存在 `refs/heads/master`（`c7eaf00e`）与 `refs/tags/master`（`36f3cb62`），裸写 `master` 会解析到 tag，导致 `git log --not master` 之类的命令给出误导结果。所有核对必须写全 ref 或直接用 SHA。

### E3 · 快速搜索 Bio 检索被误排除

**v1 说法**：第 5 节把「快速搜索(Ctrl+K)」列为上游已有，整项排除。

**实测**：

| 项 | 上游 `20fe6963` | jirai `c7eaf00e` |
| --- | --- | --- |
| `quickSearch.js` / `quickSearchWorker.js` 中的 bio 检索 | **0 命中** | `quickSearch.js:212-237`，`:221 database.searchBiosByContent(q)` |
| 引入提交 | — | `a94824c2`「feat: 快速搜索支持个人简介(bio)检索」（5 文件 +73 行） |

**影响**：漏掉一项功能。v2 提升为功能 #14，并在第 5 节注明"快速搜索本体是上游的，Bio 检索是 jirai 的"。

### E4 · 图谱两条依赖边不成立

| 边 | v1 理由 | 实测 |
| --- | --- | --- |
| `J3 → J2`（手动关系 → 时间轴） | 未解释 | `RelationshipTimeline.vue` / `relationshipTimelineUtils.js` 中 `manual` 零命中 |
| `J6 → J5`（Bio Diff → 信息抓取） | 未解释 | `UserDialogInfoTabJirai.vue` 中 `infoFetch`/`bioHistory` 零命中 |

**影响**：图谱语义错误。v2 删除两条，并补 3 条缺失边（`B6→J2` Dashboard 面板、`B2→J9` 拖放在 Feed 页、`B9→J7` 自动跟随用 AppApi）。

---

## 2. 行为描述失真的修正依据

### E5 · A1 双人关系的数据源

| 项 | v1 | 实测 |
| --- | --- | --- |
| 主查询 | 取两人 `feed_gps` 记录 | `gameLog.js:1675 getCoInstanceHistoryBetweenFriends()`，SQL 主查 `FROM gamelog_join_leave a INNER JOIN gamelog_join_leave b`（`type='OnPlayerLeft'`） |
| Feed 用途 | 主数据源 | 仅 `getInferredLocationSessions`（`gameLog.js:1729-1745`）补充推断 |
| 读表 | `feed_gps` + `feed_status` | `gamelog_join_leave` + `{prefix}_feed_gps` + `{prefix}_feed_online_offline`；**全程未读 `feed_status`** |
| 保留正确项 | 排除 private、`time > 0`、只读无写入、输出徽章 | 均正确（4 处 `NOT IN ('','traveling','private','private:private')`；`a.time>0 AND b.time>0`） |

### E6 · A2 关系时间轴的四处偏差

| 项 | v1 | 实测 |
| --- | --- | --- |
| 聚合内容 | 共处 + 状态变更 | 只聚合共处：`relationshipScore = totalTime + joinCount*60000` |
| 归一化 | 0–1 | **0–100**：`toPercent = (value/total)*100`，`toFixed(2)` |
| 存储 | Feed + GameLog | 只读 `gamelog_join_leave`（`gameLog.js:2001 getRelationshipTimelineData`） |
| 控件 | 平滑 / 高亮开关 | 无平滑开关（`smooth:false` 写死）；高亮是光标自动 `emphasis`/`dispatchAction`（`:443-498`）；TopN 为 `friendCount` 滑块（默认 5） |
| 额外入口 | 未提 | `panelRegistry.js:41` 注册 Dashboard 面板 `charts-timeline`（上游无此面板） |

### E7 · A6 Bio Diff 不写快照

- v1：`recordBioSnapshot` 在打开面板时写快照并生成历史
- 实测：`UserDialogInfoTabJirai.vue:566 loadBioDiff()` 只调 `database.getRecentBioChangesForUser(id, 50)`，从最近 1 天内更早的记录回推 baseBio，再与 `latestRecord.bio` diff；**无写操作**
- 真正的快照写入方是 `bioHistoryCoordinator.recordBioObservation`（`userCoordinator.js:485` 等调用）
- 保留正确项：CJK 感知 word-level diff、保留上游 `UserDialogInfoTab.vue`、内联 `x-text-added/removed` 标记

### E8–E11 · 行号与行数

| 项 | v1 | 实测 |
| --- | --- | --- |
| `infoFetchCoordinator.js` | 196 行 | **242 行**（`198e07f8` 追加了 burst 清理调用） |
| `UserDialogStatusDistributionTab.vue` | 374 行 | **458 行**（374 是 `137abf6f` 初版，`cf942bd0` 重构为时长制后变大） |
| `bioHistoryCoordinator.test.js` | 108 行 | **204 行**（108 是 `198e07f8` 对该文件的增量） |
| `Login.vue` addSession | `:358` | **`:363`**（`:358` 是注释「Login secondary accounts via accountHub」） |

---

## 3. 口径类问题

### E12 · 分叉点定义自相矛盾

- 头部写「分叉点（merge-base）：`d97327d8`（2026-04-27）」
- 第 1 节又写「`d97327d8` 只是最后一次合并上游的点，**不是分叉点**」

正确表述：`git merge-base HEAD upstream/master` = `d97327d8`（**这就是 git 语义的分叉点**），同时也是最后一次合并上游的点（`9aaadfb5` 的第二父）。`a610a5bc`「Initial plan」（03-23）是**分叉后 jirai 侧的第一个提交**，其父 `163d75aa`（03-20）才是分叉前最后一个上游提交。

### E13 · 作者分布口径混用

- v1：227 个提交，作者「福禄 80 / copilot 90 / Haochen TANG 6 / pa 4 / FuLuTang 3 / Yutho 1」
- 该组合计 **184**，是 `--no-merges` 的口径，不是 227
- 227 口径（含 43 个 merge）：**FuLu糖福禄 94 / copilot-swe-agent[bot] 90 / Haochen TANG 27 / FuLuTang 11 / pa 4 / Yutho 1**
- 另有同一作者多 ID 问题：`FuLu糖福禄`/`Haochen TANG`/`FuLuTang` 邮箱均为 `tanghaochen0506@hotmail.com`，按邮箱合并后仅 4 个作者（132/90/4/1）

### E14 · 「无上游作者提交」不成立

- `pa <maplenagisa@gmail.com>` 是 VRCX 上游作者（上游 master 有 977 个其提交）
- jirai 侧保留了 4 个 pa 提交：`265f38ae`（3-30 SetCompressorDictSize 16）、`8cd8a5de`（3-30 split i18n）、`01ad582b`（3-30 age-gated badge #1712）、`0877fb87`（3-31 tray 修复）
- 上游有同标题提交（`bba33cd1`/`92ae1c55`），因上游后来重写历史导致 hash 不同
- 结论应改为：功能主体为 jirai 新增，但保留了 4 个上游作者（pa）的修复提交

### E15 · 首提交口径与多账户首提交

- 多账户 V4 首个引入提交实测为 `17518d9b`（04-30，copilot-swe-agent，`accountHub.js` +264 / `accountSession.js` +424 / `aggregatedView.js` +203），`733dab99`（05-02）只是后续重构（`accountHub.js` +163 修改）
- 另有 4 类功能（Feed 拖放、假记录、自动加群、Bio 清理）是**修改既有文件**，`--diff-filter=A` 不适用；应注明「引入提交 ≠ 文件新增提交」
- 手动关系格里 `f66d455c` 与 `392365f0` 混排：前者建手动关系，后者才是推测建议的引入提交，需分别标注
- `src/` 24 个新增文件中含 `BioFetchDialog.vue.bak` 备份，实际源码新增 23 个

---

## 4. 审查通过（确认无误）的部分

以下内容经三名审计员逐条核验，与代码一致，可放心引用：

| 项 | 状态 |
| --- | --- |
| A3 手动关系整套（表结构、排序归一化、绿色边色值 `#31543d`、图例、computeSuggestions 调用链、推荐不落库） | ✅ 全绿 |
| A4 追踪非好友整套（表结构、每秒 tick、3600 秒节流、抓取合并、不写好友表） | ✅ 全绿 |
| A9 Feed 拖放（五区顺序、pendingDrop 先清后处理） | ✅ 全绿 |
| A10 假记录（5 秒、OnPlayerJoined/OnPlayerLeft、time 0/5000） | ✅ 全绿 |
| A11 自动加群（groupId、默认开启的 `ref(true)` 与 `getBool(...,true)`、开关 UI） | ✅ 全绿 |
| A12 清理调用链（三处函数、feed.js 删除接口） | ✅ 逻辑正确（行数已修正） |
| A8 挂载与加载（`:52`/`:381`/`:116`/`:160`） | ✅ 全绿 |
| 第 5 节 12 项排除 | ✅ 12/12 上游命中 |
| 第 6 节「启动补线不存在」 | ✅ jirai `src/` 0 命中（唯一 `economyLedgerBackfill` 是 VRChat API 字段） |
| 核心数字 227 / 48 A / 97 M / 24 新增 / 12 关键词 0 命中 | ✅ 用明确 ref 复核通过 |

---

## 5. 方法学教训（供后续文档复用）

1. **行号会漂移**：引用源码一律用「提交号 + 文件 + 函数名」，行号只作辅助。本次 4 处行号行数错误全部源于引用过早版本。
2. **`--diff-filter=A` 只对新增文件有效**：修改既有文件的功能必须用 `git log -S<关键字>` 定位引入提交。
3. **同名 tag 陷阱**：`VRCX-jirai` 的 `refs/tags/master` 与 `refs/heads/master` 冲突，所有比较必须写全 ref 或用 SHA。
4. **UI 入口要单独验证可达性**：代码写完不代表入口没被注释。A7 就是典型——逻辑、store、dialog 全对，唯独按钮块被 `<!-- -->` 包起来。
5. **"未合并分支"结论必须用 `merge-base --is-ancestor`**，不能凭印象或分支名判断（A13 踩坑）。
6. **上游作者识别**：作者名相同不代表属于该 fork，需在上游仓库 `git log --author` 交叉验证（pa 的 4 个提交）。

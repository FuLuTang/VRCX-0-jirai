# VRCX-jirai：pc114514 对比 GitHub master、未提交项核查、VRCX-0-jirai 基线判定

| 项 | 值 |
| --- | --- |
| 报告时间 | `2026-11-18T00:40Z`（UTC） |
| 执行机 | `freeEgg`（本机）；pc114514 仅通过 SSH **只读**访问（`git status/diff/log/bundle`），未改动 pc114514 上任何文件、仓库或分支 |
| GitHub master | `FuLuTang/VRCX-jirai` `refs/heads/master` = `c7eaf00e`（`git ls-remote` 实测，10 个分支均无新提交）。注意同名 tag `refs/tags/master` = `36f3cb62`，取证时一律写全 `refs/heads/master` |
| pc114514 对象 | `C:\Users\tangh\Documents\Github\VRCX-jirai`，分支 `codex/vrcx-upstream-through-2026-08-15` = `bd2f45f0`（2026-10-02 08:14 +0800） |
| 取证方式 | 在 `/tmp/jirai-audit` 建浅共享克隆；pc 侧用 `git bundle create -` 经 SSH 管道取回 266 个提交与 stash；`git diff --cached --binary` 取回暂存区；上游 `vrcx-team/VRCX` 取至 `e819c4e4`（2026-11-16） |

---

## 一、差分：pc114514 VRCX-jirai vs GitHub master

### 1.1 血缘与规模

- `c7eaf00e`（GitHub master）是 `bd2f45f0` 的祖先，**merge-base = `c7eaf00e`**；`rev-list --left-right` 为 **0 落后 / 266 领先**。即 pc 的已提交线是 GitHub master 的**严格超集**，GitHub 上没有任何 pc 上缺失的提交。
- 266 提交 = 248 非合并 + 18 合并。248 个非合并中，**247 个是上游 vrcx-team/VRCX 的原提交**（可由 `upstream/master` 到达）；**仅 1 个是 jirai 作者自己的**：`3708e12f`（2026-09-27，「修复玩家详情公开资料读取与 Bio 历史」）。
- 上游同步位置：GitHub master 停在上游 `d97327d8`（2026-04-27）；pc 开发线同步到上游 `c56da58b`（2026-09-30，Cef 152.0.100）。
- `git diff --shortstat`：**711 个文件，+29286 / −31423**。

### 1.2 711 个文件的构成（无重命名检测口径共 715 条路径）

| 类别 | 路径数 | 含义 |
| --- | --- | --- |
| 与上游同一时点文件**逐字节相同** | 604 | 纯上游同步（GitHub master 落后造成的差异） |
| 上游同时删除/迁移的文件 | 16 | 旧配置（`.oxlintrc.json`、`.oxfmtrc.json`、`eslint.config.mjs`、`VRCX.sln`）与 `src-electron/*` 构建脚本被上游替换或迁到 `build-scripts/` |
| GitHub master 与开发线都含 jirai 改动、且开发线内容 ≠ 上游的文件 | 78 | 即 jirai 改动与上游新代码重新合并后的结果 |
| 仅开发线新增的 jirai 侧适配 | 14 | `UserSummaryHeader.vue`、`UserDialogInfoTab.test.js`、`rename-builds.js`、`electron-builder.config.js` 等 |
| jirai 自有文件被改动 | 3 | `UserDialogInfoTabJirai.vue`、`bioHistoryCoordinator.js`、`accountSession.js` |

### 1.3 对 jirai 功能的实质影响

把两条线各自相对「所基于的上游」的增量（jirai 增量）逐行对比：

- GitHub master 增量 141 文件；开发线增量 152 文件；**101 个文件的 jirai 增量逐行完全一致**。
- **开发线没有新增任何 jirai 功能**。真正的 jirai 新内容只有 `3708e12f`：玩家详情的简介/链接改读 `/profile/{id}`（对应上游 `publicProfileRef` 改动），仅在 Profile 响应里 Bio 是**明确的字符串**时才记快照（空串=真实清空；缺失/null/非字符串/请求失败均跳过），加请求竞态保护，写 Bio 历史改为 await。
- 其余 jirai 侧差异是上游 API 变化的适配（`userOnlineFor`→`timeAgo(userOnlineForTimestamp())`、`vrchatCredit` 改入 store 等）与 CI：`github_actions.yml` 开发线多出 ≈342 行，抽查多为缩进重排与跟随上游 CI 重构后重新套用 jirai 改动，不含新增 jirai 功能。
- GitHub master 独有而开发线没有的 3 处：`Dotnet/VRCX-Electron-arm64.csproj`（上游已删）、`src-electron/rename-builds.js`（上游已迁到 `build-scripts/`）、`QuickSearchSync.vue` 的 15 行删除（上游已重写）。
- 其他：pc 仓库另有 `stash@{0}`（2026-09-27）=14 文件 248+/248−，`--ignore-cr-at-eol` 后差异为空，**纯换行符改动，无价值**。`VRCX-jirai-baseline-check` 是 `c7eaf00e` 的干净 worktree。

### 1.4 风险

- **266 个提交只存在于 pc114514 本地**（GitHub 无对应分支）——单点风险，建议推送一个备份分支。
- 附带发现：jirai 自 2026-04-01（`7009ebae`）起在 `build-scripts/` 里提交了 2 个 `usr_*.json`（VRChat 真实用户资料转储），属潜在隐私文件。

---

## 二、pc114514 未提交项是否完工

### 2.1 VRCX-jirai：16 个暂存文件 —— **未完工，且当前处于语法错误状态**

**这 16 项不是新功能开发，而是一次没有收尾的 `git merge 58033a22`。**

证据：
- 仓库内存在 `.git/MERGE_HEAD` = `58033a22`（上游 Natsumi，2026-09-30 21:47 +1000，「Fix insert rowId」）、`ORIG_HEAD` = `bd2f45f0`、`MERGE_MODE` = no-ff、`MERGE_MSG` 记录冲突文件为 `gameLogCoordinator.js` 与 `feed.js`。`MERGE_HEAD` 不是 HEAD 的祖先，合并**从未提交**。
- 16 个暂存文件**恰好等于** `58033a22` 改动的那 16 个文件；暂存区与工作区无差别（无未暂存、无未跟踪）。
- 该上游提交的作用：给 C#/JS 的 SQLite 层加 `ExecuteInsert`（返回 `LastInsertRowId`），所有 Feed/GameLog 写库函数改为 `async` 并返回带 `rowId` 的条目，调用方等写库成功后才把条目放进内存列表，`Feed.vue`/`GameLog.vue` 的行 ID 不再退回「时间戳+Date.now()」。

逐文件结论（把暂存区应用到 `bd2f45f0` 的 worktree 并与对 `bd2f45f0` 做 `cherry-pick -n 58033a22` 的结果比对）：

| 文件 | 状态 |
| --- | --- |
| 14 个文件（`SQLite.cs`、`sqlite.js`、`gameLog.js`、各 coordinator/store、`Feed.vue`、`GameLog.vue` 等） | 与上游提交的合并结果**逐字节相同**，语法检查通过 |
| `src/coordinators/gameLogCoordinator.js`（冲突） | **解得正确**：保留 jirai 的「进房推荐关系提醒」块，并采用 `persistedEntryPromise` |
| `src/services/database/feed.js`（冲突） | **解错**：`addAvatarToDatabase` 处同时留下旧头两行 `addAvatarToDatabase(entry) {` / `sqliteService.executeNonQuery(` 和新头 `async addAvatarToDatabase(entry) {`，`node --check` 报 `SyntaxError: missing ) after argument list` |

测试验证（本机 aarch64 Linux，`npm ci --ignore-scripts` + `vitest run`，三份树各跑一遍）：

| 树 | 测试总数 | 通过 | 失败 | 无法加载的测试文件 |
| --- | --- | --- | --- | --- |
| `bd2f45f0` 已提交基线 | 2165 | 2013 | 152 | 4 |
| 暂存区**原样** | 1948 | 1832 | 116 | **30（比基线多 26 个：凡 import 了 `feed.js` 的文件全部无法加载）** |
| 暂存区 + 本报告的 2 行修复 | 2165 | 2013 | 152 | 4（与基线逐项相同，**0 回归**） |

> 基线本身的 152 个失败（41 个文件）是上游测试与 jirai 组件的 mock 不匹配（例如 `lucide-vue-next` mock 缺 `ExternalLink`、`stores` mock 缺 `useLocationStore`），与本次暂存项无关，修复前后集合完全一致。

结论与收尾步骤：
1. 删掉 `feed.js` 中残留的两行旧头——见同目录 [feed-js-conflict-fix.patch](<feed-js-conflict-fix.patch>)（已验证可干净应用到暂存树）。
2. `git add src/services/database/feed.js && git commit`（`MERGE_MSG` 已备好）以结束合并。
3. 可选：`src/types/globals.d.ts` 缺 `ExecuteInsert` 声明（上游在 `02499a03`，2026-10-09 才补）；`.cs` 部分本机无 .NET 未编译，但与上游逐字节一致。
4. 暂存区快照留存：[pc-staged-16-files.diff](<pc-staged-16-files.diff>)。

**完成度判断：≈95%——差 2 行删除与一次提交；以当前状态构建会因 `feed.js` 语法错误失败。**

### 2.2 pc114514 的 VRCX-0-jirai：6 项未提交 —— 已被保全并已并入 main

`C:\Users\tangh\Documents\Github\VRCX-0-jirai`（本地分支 `wip/pc-codex-2026-11-16` @ `83e624a06`）：4 个文档/README 修改（+22 行）、1 个未跟踪 `useUserRelationshipRecommendationPrompt.tsx`（168 行）、`target-novr/`（构建缓存）。

- 前 5 项的 `git hash-object` 与 `origin/wip/pc-codex-2026-11-16`（`63bbe0ff4`）**逐文件相同**，该 WIP 已在 2026-11-16 合入 `main`（`ea3142a47`）。
- `.tsx` 在 main 中已迁为 `src/features/charts/relationship-recommendations/useUserRelationshipRecommendationPrompt.tsx`；README/backlog 的 4 处文档改动在 main 中采用的是另一版（合并报告：README 取「地雷版」），**不是原样并入**。
- 该钩子本身对应的「推荐确认交互」实机验收仍记为**未通过**（见 2026-11-17 完成度审计 #3b），属验收未闭环而非代码未写。
- pc 本地的这个 WIP 状态**不会丢**，但 pc 上的分支指针仍停在 `83e624a06`，未提交内容也未被提交。

---

## 三、VRCX-0-jirai「前期开发」的基线版本

### 结论

> **基线 = VRCX-jirai `c8b8f744`（v2026.5.20，2026-05-20，当时的 GitHub master 顶端）。把握：高（对 2026-09-12 ~ 09-25 的前期阶段）。**
>
> **不是** `c7eaf00e`（v2026.9.27，GitHub 现 master），**更不是** pc 开发线 `bd2f45f0`。

### 证据

1. **行号锚点（最硬）**：2026-09-15 的计划文档（`e590fa620` 20:01Z、`d22c5a795` 20:21Z）引用 `infoFetchCoordinator.js:86-196` 与 `nonFriendCoordinator.js:12-87`。
   - `c8b8f744`：`runSilentInfoFetch` 恰在第 **86** 行，文件恰好共 **196** 行；`refreshTrackedNonFriendsFlow` 在第 **12** 行，结束于 **87**。**完全吻合**。
   - `c7eaf00e`：这两个函数已移到第 96 / 13 行，`infoFetchCoordinator.js` 变为 242 行——**对不上**。开发线同样对不上（另有 `updateLoop.js:73`、`groupCoordinator.js:645`、`Gallery.vue:743` 漂移）。
2. **时间不可能**：`c8b8f744` 之后的 5 个提交（`74763ca4`、`6fbbafa9`、`198e07f8`、`2d6ed70a`、`c7eaf00e`）作者/提交时间均为 **2026-09-27 00:55–01:19 +0800**，比上述 09-15 文档晚 11 天；开发线 266 提交更晚（09-27 ~ 10-02）。早期开发（09-12 起）时它们还不存在。
3. **文档自述**：`README.zh-CN.md:85` 写明盘点范围「截至 `c8b8f744`」；VRCX-0-jirai 文档里出现的 20 个可解析的 jirai SHA 中，19 个是 `c8b8f744` 的祖先，唯一例外就是下一句的 `3708e12f`。`3708e12f` 要到 2026-10-02（`ac22c219b`）才首次出现在文档里，且被当作「后续另做的 Bio 修复」而非基线。
4. **功能面几乎等价**：`c8b8f744..c7eaf00e` 只改了 11 个文件（Bio 写入防护 `bioHistoryCoordinator.js`、`infoFetch/nonFriend/userCoordinator/userEventCoordinator/feed.js/userTransforms.js` 的 Bio 判定，及发布文件名/版本号），**没有任何已移植功能（关系页、时间线、状态分布、追踪非好友、手动关系、推荐、假记录、自动加群、拖放）被改动**。所以单看功能，`c8b8f744` 与 `c7eaf00e` 难以区分——区分靠的是上面的锚点与时间。

### 版本倾向（不确定部分）

| 阶段 | 倾向 | 说明 |
| --- | --- | --- |
| 2026-09-12 ~ 09-25 前期清洁移植 | **`c8b8f744`** | 行号锚点、时间线、README 三证一致 |
| 2026-09-30 ~ 10-03 功能还原（增强抓取/推荐/灯色占比） | `c8b8f744` 为主，**Bio 语义偏向 9-27 的加固（`74763ca4`/`3708e12f`）** | VRCX-0-jirai「缺字段/null ≠ 清空 Bio」的规则与 9-27 加固一致，而 `c8b8f744` 的 `if (json.bio)` 并无此语义；此时作者已知 `3708e12f` |
| 2026-11-15 ~ 11-17 锚点文档 | `c7eaf00e` | 这批文档的行号是在 `c7eaf00e` 上生成的（《工作区环境披露》Q5 的「隐含指向 `c7eaf00e`」只对这批成立，**不适用于前期开发**） |
| pc 开发线 `bd2f45f0` | 从不是基线 | 只多 1 个 jirai 提交（`3708e12f`）+ 上游同步，没有新功能 |

**建议**：在 `JIRAI_移植说明.md` 明文写入「功能基线 `c8b8f744`（v2026.5.20）；Bio 判定语义参照 `74763ca4` 之后；上游适配参照 `3708e12f`」，并今后引用「提交号 + 文件 + 函数名」而不是裸行号。

---

## 四、局限

- 测试在本机 aarch64 Linux + jsdom 上跑，未在 Windows/Electron 真机运行；`.cs` 未编译。
- 未对 GitHub 上 `c8b8f744` 与前期 VRCX-0-jirai 代码做逐行算法对照，基线判定依赖行号锚点、时间线与文档自述三类证据。
- `dir` 显示的 pc 文件时间受 Windows 当前时区显示规则影响，本文只用它做「合并发生在 `bd2f45f0` 提交之后不久」的旁证，不用作精确时刻。

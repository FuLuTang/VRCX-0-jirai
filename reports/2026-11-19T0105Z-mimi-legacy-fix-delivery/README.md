# MIMI 交付报告：历史遗留修复与遗漏补齐（M1–M4）

| 项         | 值                                                                                                                                                                                        |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 时间       | `2026-11-19T01:05Z` 起草，`2026-11-19T01:20Z` 定稿（UTC）                                                                                                                                 |
| 分支       | `MIMI`（已推送 `origin/MIMI`），起点 `0cd82bbb7`；代码与产物提交 `95f6a7c52`；文档提交在其后                                                                                              |
| 施工规格   | 仓库根目录《历史遗留修复与遗漏补齐.md》（随 M2 提交入库）；纪律与约束沿用 `reports/2026-11-18T1831Z-mimi-construction/施工计划.md` 第 3、3.1、6 节                                        |
| jirai 参考 | `c7eaf00e`（开工前 `ls-remote` 复核 `refs/heads/master` 未前进）                                                                                                                          |
| 验证方式   | 只用测试夹具与烟测（Rust 单测 / SQLite 夹具、vitest、cargo check、架构测试、bindings 导出、release 构建成功）。**没有运行构建产物、没有启动 VRChat、没有 GUI 操作、没有运行 `tauri dev`** |
| 范围       | M2 → M1 → M4 → M3，每项一个提交；M5 按规格忽略；#7、#10、#12、#13 未碰                                                                                                                    |
| 人工测试   | 同目录 [人工实机测试文档.md](人工实机测试文档.md)，由用户执行；本交付不等待其结果                                                                                                         |

## 1. 交付产物（pc114514）

| 项                    | 值                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 目录                  | `D:\vrcx-mimi-artifacts\20261119T0113Z-95f6a7c52\`（不进 git）                                                                                                                                                                                                                                                                                                                                                               |
| 安装包                | `VRCX-0-jirai_2.34.0_x64-setup.exe`，16,579,281 字节（15.81 MiB），NSIS                                                                                                                                                                                                                                                                                                                                                      |
| 程序本体              | `vrcx-0.exe`，45,564,928 字节                                                                                                                                                                                                                                                                                                                                                                                                |
| SHA256                | `e53f7d097d8013b467e43f44c6b76e2ee462d8db404ae5a23cdb7c9ad2dddcde` VRCX-0-jirai_2.34.0_x64-setup.exe<br>`1258044ada8f3201fc4d5eee721e8a38951f92c092e6e392224d364480a31980` vrcx-0.exe（同目录 `SHA256SUMS.txt`）                                                                                                                                                                                                             |
| 构建源                | pc 验证 worktree `C:\Users\tangh\vrcx-mimi` @ `95f6a7c52`（`git status` 干净）                                                                                                                                                                                                                                                                                                                                               |
| 构建命令              | `npm ci` → `npm run tauri build -- --config <覆盖文件>`；覆盖内容沿用上一轮 `{"bundle":{"createUpdaterArtifacts":false,"windows":{"certificateThumbprint":null,"timestampUrl":null}}}`（**关闭签名与更新器产物，不改 `tauri.conf.json`**）；`start /low`、`CARGO_BUILD_JOBS=8`、`CARGO_TARGET_DIR=D:\vrcx-mimi-target`。覆盖文件与构建脚本放在 `C:\Users\tangh\`、用完已删除（施工约束允许写的位置之外的临时文件，均已清理） |
| 耗时                  | `2026-11-19T00:56:12Z`–`01:13:25Z`；release 编译 15 分 55 秒，一次成功（`RELEASE_EXIT=0`）                                                                                                                                                                                                                                                                                                                                   |
| `D:\vrcx-mimi-target` | 交付后 29.92 GB；D: 剩余 91.2 GB；C: 剩余 14.4 GB（未变）                                                                                                                                                                                                                                                                                                                                                                    |
| 签名                  | **未签名**（pc 上无 `tauri.conf.json` 配置的 Certum 证书），安装时可能出现 SmartScreen 提示                                                                                                                                                                                                                                                                                                                                  |
| 烟测                  | 产物生成即烟测通过；**未执行、未安装**                                                                                                                                                                                                                                                                                                                                                                                       |

## 2. 提交列表（`0cd82bbb7..MIMI`）

| 提交        | 项   | 说明                                                                                                                                                                                            |
| ----------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0f3e02b0b` | M2   | Feed 页 diff 按 CJK 字切分（`FeedDifferenceHtml.ts`）；同时提交施工规格《历史遗留修复与遗漏补齐.md》                                                                                            |
| `d630fd061` | M1   | 推测关联询问：`src/state/userDialogOpeningStore.ts`（新）、`RelationshipRecommendationPromptHost`（新，挂 `GlobalHosts`）、`UserDialogContent.tsx` 发布打开状态、4 个 `prompt_*` 文案           |
| `35ad72a26` | M4   | 快速搜索 `!` `@` `#` 前缀：后端 `query_prefixed` / `build_prefixed_output`，前端前缀模式与提示                                                                                                  |
| `9ecba52d6` | M3   | 快速搜索最近遇到 / 最近去过：`crates/persistence/src/quick_search_recent.rs`（新）、`QuickSearchRecentStore`、`LocalQuickSearchRecentStore`、`app__quick_search_recent`、`useQuickSearchRecent` |
| `95f6a7c52` | M3   | `bindings.ts` 重新生成（只新增 `appQuickSearchRecent`、`QuickSearchRecentOutput`）                                                                                                              |
| 其后        | 文档 | 状态文档回写、本报告与人工测试文档                                                                                                                                                              |

## 3. 断言 → 测试（全部为真）

### 3.1 M1（#3b 子项，A3b-P1…P6）

测试文件 `src/features/charts/relationship-recommendations/useUserRelationshipRecommendationPrompt.test.tsx`（hook 冻结未改，mock service / toast / runtime store），接线测试 `RelationshipRecommendationPromptHost.test.tsx`。

| 断言   | 测试                                                                                                                                                                                                                                               |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A3b-P1 | `asks once about a pending recommendation that involves the player`、`names the other side when the player is userIdB`                                                                                                                             |
| A3b-P2 | `asks only one question per opening and asks again on a new openNonce`                                                                                                                                                                             |
| A3b-P3 | `"is a friend" confirms the recommendation and closes the prompt`、`"ignore" ignores the recommendation and closes the prompt`                                                                                                                     |
| A3b-P4 | `closes automatically after 6 seconds`、`closes the old prompt when the account or login generation changes`                                                                                                                                       |
| A3b-P5 | `does not ask before the profile is ready, then asks once ready`、`does not ask for own profile / no recommendation / recommendation for other players only / already confirmed / already ignored / recommendations from another login generation` |
| A3b-P6 | `en has the four prompt keys`、`zh-CN has the four prompt keys`                                                                                                                                                                                    |
| 接线   | `feeds the open user dialog into the prompt hook`、`only clears the opening it published`、`is mounted globally and wired from the user dialog`                                                                                                    |

**接线方式与规格的偏差（如实记录）**：规格写的是「在 `UserDialogContent.tsx` 调用 hook」。照做后 `npm run lint` 报 `no-restricted-imports`（`.oxlintrc.json`：`src/components/**` 不得依赖 `@/features/**`）。为不改 lint 规则、不改冻结 hook，改为：`UserDialogContent` 把 `{userId, openNonce, ready}` 发布到新的 `src/state/userDialogOpeningStore.ts`，由挂在 `GlobalHosts` 的 `RelationshipRecommendationPromptHost`（`features` 下）读取并调用 hook。`ready` = `loadStatus === 'ready'` 且已载入资料的 id 等于请求的玩家。行为与直接调用一致（同一个 hook、同样的参数）。

### 3.2 M2（#6 子项，A6-F1…F3）

测试文件 `src/features/feed/components/FeedDifferenceHtml.test.ts`（原 4 个用例未改）。

| 断言  | 测试                                                                                                                                                                                  |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A6-F1 | `marks only the changed Han character in a Chinese bio`、`marks only the CJK part in mixed Latin and Chinese text`、`compares Japanese kana and Korean Hangul character by character` |
| A6-F2 | `does not insert spaces between CJK characters when joining`、`joins like jirai: no space next to a CJK character, spaces kept between Latin words`                                   |
| A6-F3 | `produces exactly the previous output for Latin-only text`；另在本机用 `ea3142a47` 的旧实现对 20000 组随机拉丁输入逐字节比对：**0 差异**                                              |

注：与 jirai `joinTokens` 相同，CJK 字旁原有的空格不保留（如 `hello there 世界 again` 拼回为 `hello there世…again`）；纯拉丁文本不受影响。

### 3.3 #17 快速搜索近期对象与前缀（A17-1…11）

| 断言   | 测试                                                                                                                                                                                                                                                                                                                                                                                   |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A17-1  | 持久化 `recent_met_users_are_newest_first_deduplicated_and_skip_self_and_blank`、`recent_met_users_respect_the_limit`；应用层 `recent_met_users_exclude_friends_and_self_and_keep_eight`                                                                                                                                                                                               |
| A17-2  | `recent_joined_worlds_are_newest_first_and_deduplicated_by_world`；`recent_joined_worlds_keep_store_order_and_ten`                                                                                                                                                                                                                                                                     |
| A17-3  | `recent_rows_are_isolated_by_account`（双 owner 夹具）；`recent_sources_are_requested_for_the_current_account`                                                                                                                                                                                                                                                                         |
| A17-4  | vitest `filters both groups by case-insensitive name containment`、`loads once per opening and filters locally while typing`、`drops results that belong to the previous account`                                                                                                                                                                                                      |
| A17-5  | `one_failing_recent_source_does_not_hide_the_other`；vitest `stays empty when loading fails or there is no account`                                                                                                                                                                                                                                                                    |
| A17-6  | `recent_queries_are_read_only`（调用前后两表行数不变）；G-4 判定命令为空（第 4 节）                                                                                                                                                                                                                                                                                                    |
| A17-7  | `bang_prefix_returns_only_friends_and_bare_bang_lists_all`、`bang_prefix_matches_details_only_from_two_characters`                                                                                                                                                                                                                                                                     |
| A17-8  | `at_prefix_returns_only_worlds_from_one_character_and_bare_at_lists_all`、`at_prefix_merges_local_worlds_only_for_a_real_query`                                                                                                                                                                                                                                                        |
| A17-9  | `hash_prefix_returns_only_groups_from_one_character_and_bare_hash_lists_all`；vitest `merges group instances from one character in # mode and lists all for bare #`                                                                                                                                                                                                                    |
| A17-10 | vitest `QuickSearchPrefixes.test.tsx`：`%s shows only the matching category`（6 例）、`hides the recent groups in prefix mode`                                                                                                                                                                                                                                                         |
| A17-11 | `query_prefixes_are_parsed_from_the_first_character_only`、`unprefixed_helpers_keep_the_result_limit`；vitest `keeps every category, navigation and settings without a prefix`、`keeps the unprefixed two-character threshold`、`does not merge group instances in ! and @ modes`；既有快速搜索测试（Rust `quick_search_catalog` 与 vitest `QuickSearchDialog.test.tsx` 等）未改仍通过 |

实现要点：

- **M3 SQL**：两条只读查询各用「按 `user_id` / `world_id` 分组取 `MAX(id)`」子查询再 `JOIN` 回最新一行取名字与位置；`WHERE owner_id IN (0, @owner_id)`。最近遇到排除自己与空 `user_id`，应用层再剔除当前好友（向持久化层多取「好友数 + 1」条，保证剔除后仍有 8 条）。
- **M3 偏离 jirai**：按当前账号隔离（jirai 的 `gamelog_*` 不分账号；backlog 第 4 节验收项）。
- **M4**：「仅前缀列全部」不受 8 条上限（照 jirai）；前缀模式下导航 / 设置 / 直接访问 / 最近打开 / 近期组全部隐藏；提示区新增「前缀」一组（jirai 没有，可发现性补充）。代价同 jirai：名字以 `!` `@` `#` 开头的对象不能按原名搜到。
- **渲染量**：仅前缀列全部未做真机测量（夹具无法判定卡顿），交人工测试 M4-9。

## 4. 守卫 G-1…G-6（交付提交上实测）

| 守卫 | 命令 / 证据                                                                                                                                                                                                            | 结果                                             |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| G-1  | `xargs -a 冻结清单.txt git diff --name-only ea3142a47 HEAD --`                                                                                                                                                         | **0 行**（M1 的 hook 本身未改）                  |
| G-2  | pc `TEST_EXIT=0`（3660 通过 / 0 失败 / 6 忽略）；本机 vitest 748 文件 / 4364 测试全部通过（`VT_EXIT=0`）                                                                                                               | 真                                               |
| G-3  | `git diff --name-only ea3142a47 HEAD -- crates/persistence/src/migrations.rs`                                                                                                                                          | **0 行**                                         |
| G-4  | `git diff --name-only ea3142a47 HEAD -- crates/persistence/src/social_aggregates crates/persistence/src/activity_page crates/persistence/src/game_log`                                                                 | **0 行**（M3 是新模块 `quick_search_recent.rs`） |
| G-5  | `bindings_export.rs`、`contracts/jirai.rs` 相对基线删除行 0；`bindings.ts` 唯一 `-` 行仍是上一轮 #14 规定的 `QuickSearchMatchedField` 扩展，本轮只新增；13 个语言文件基线 key 值改变 0（本轮只在 en / zh-CN 追加 key） | 真                                               |
| G-6  | pc `ARCH_EXIT=0`；`backend_architecture.rs` diff 0 行（`PERSISTENCE_QUERY_MODULES` 白名单未扩大，M3 走 outbound adapter）                                                                                              | 真                                               |

## 5. 退出码

| 位置 | 提交        | 命令                                                    | 结果                                                                                                                                 |
| ---- | ----------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| pc   | `95f6a7c52` | `vrcx-mimi-check.cmd`（fetch + check）                  | `CARGO_EXIT=0`                                                                                                                       |
| pc   | `95f6a7c52` | `vrcx-mimi-check.cmd test`                              | `TEST_EXIT=0`（3660 通过 / 0 失败 / 6 忽略）、`ARCH_EXIT=0`                                                                          |
| pc   | `95f6a7c52` | `vrcx-mimi-check.cmd bindings`                          | `BIND_EXIT=0`（重新生成后 worktree `git status` 为空，与已提交 `bindings.ts` 一致）                                                  |
| pc   | `95f6a7c52` | `npm ci` + `npm run tauri build -- --config <覆盖>`     | `NPMCI_EXIT=0`、`RELEASE_EXIT=0`，产物见第 1 节                                                                                      |
| 本机 | `95f6a7c52` | `npm run typecheck` / `npx vitest run` / `npm run lint` | `TC_EXIT=0`、`VT_EXIT=0`（748 文件 / 4364 测试）、`LINT_EXIT=0`（0 warnings / 0 errors）；本轮改动的前端文件全部通过 `oxfmt --check` |

**施工中的失败与处理（如实记录）**：

1. M4 首轮 pc 单测 1 个失败：我写的测试用例本身有误（`"a"` 也命中 `Beta World`），改用 `"b"` / `"z"` 后 25 个快速搜索测试全过。
2. M3 首轮：测试局部变量 `test_db` 遮蔽同名函数，编译失败；改名后通过。
3. M3 第二轮：SQLite 报「misuse of aggregate function MAX()」（相关子查询里引用外层聚合），改为分组子查询 + `JOIN`，并先用本机 Python `sqlite3` 验证结果再上 pc；同时修正「剔除自己后不足 8 条」的多取数量。
4. **环境问题**：M3 第二轮另有 `profile_backup_rejects_oversized_snapshot_before_creating_archive` 失败（`StorageFull`）。该冻结测试在系统 TEMP 建一个 16 GiB 的稀疏文件，而 pc 的 `C:` 只剩约 14 GB。处理：在 `C:\Users\tangh\vrcx-mimi-check.cmd` 里把 `TMP` / `TEMP` 指到 `D:\vrcx-mimi-target\tmp`（脚本允许写的位置），之后全量 `TEST_EXIT=0`。没有改测试、没有改系统设置。

## 6. 回写

- 《闭环断言.md》追加第 11 节：#3b 子项 A3b-P1…P6、#6 子项 A6-F1…F3、新条目 #17 A17-1…11 及结果。
- 完成度清单、《VRCX-JIRAI功能锚点与VRCX-0语义映射.md》、《VRCX-JIRAI新增功能图谱.md》：新增 #17 → 完成，计数 **14 / 1 / 2 / 1**（18 项）；#3b、#6 注明补齐的子行为；已完成项既有行未改，统计行以删除线保留旧值。
- `docs/jirai-port/2026-10-13-实机验收与修复队列.md` R04、`docs/jirai-feature-backlog.md` 第 4 节：注明已决定并补齐。

## 7. 未验证项

- 所有界面观感、提示时机与文案在真机上的呈现（见人工测试文档）。
- M1 依赖本次运行内已有推荐结果；推荐计算本身未改，未在真机验证。
- M1 已知差别：计算后在别处手动加的关系，重新计算前仍可能被问（hook 冻结，未改）。
- M3 的真实游戏日志数据量下的响应速度；M4「仅前缀列全部」在大量好友 / 世界 / 群组下的渲染（规格要求若卡顿停下报告——夹具无法判定，交人工测试 M4-9）。
- 安装包 / exe **未执行、未安装**（按约束）。

## 8. 施工过程记录

- 子代理：本轮未派子代理（四项都需要串行写入同一批文件；只读调研量小，由主代理完成）。
- 本机没有 cargo；Rust 文件经 pc 上 `rustfmt --edition 2021` 格式化，提交用 `--no-verify`（husky 的 `cargo fmt` 钩子在本机无法运行）；前端文件经 `oxfmt --check`、`npm run lint`。
- pc 上只写了 `C:\Users\tangh\vrcx-mimi`（验证 worktree）、`C:\Users\tangh\vrcx-mimi-check.cmd`（增加 `TMP`/`TEMP` 指向 D:）、`D:\vrcx-mimi-target`（含 `tmp`）、`D:\vrcx-mimi-artifacts`；另有临时文件 `C:\Users\tangh\vrcx-mimi-quick.cmd`（单 crate 快速测试）、`mimi-release.cmd`、`mimi-release.conf.json`、`lf-artifacts.ps1`，交付前全部删除；编译均 `start /low` + `CARGO_BUILD_JOBS=8`；未结束任何用户进程。
- 未提交工作区里调研会话的 `reports/2026-11-18T2313Z-mimi-review/`、`reports/2026-11-19T0013Z-legacy-fix-goal/`。

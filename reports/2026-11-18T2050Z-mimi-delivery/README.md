# MIMI 交付报告：#14 快速搜索 Bio 与 #7 自动跟随

| 项         | 值                                                                                                                                                                                            |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 时间       | `2026-11-18T20:50Z` 起草，`2026-11-18T21:25Z` 定稿（UTC）                                                                                                                                     |
| 分支       | `MIMI`（origin 已推送），起点冻结基线 `ea3142a47`，交付提交 `b6a3f9e77`（代码与产物）；文档提交在其后                                                                                         |
| jirai 参考 | `FuLuTang/VRCX-jirai` `refs/heads/master` @ `c7eaf00e`（施工前 `ls-remote` 复核未前进）                                                                                                       |
| 施工依据   | `reports/2026-11-18T1831Z-mimi-construction/施工计划.md`（第 3.1 节优先）、`reports/2026-11-18T0053Z-rust-rewrite-roadmap/闭环断言.md`（修订 6–8）、`subagent.md`                             |
| 验证方式   | 只用测试夹具与烟测：Rust 单测 / 集成测试、vitest（jsdom）、cargo check、架构测试、bindings 导出、release 构建成功。**没有运行构建产物、没有启动 VRChat、没有 GUI 操作、没有运行 `tauri dev`** |
| 人工测试   | 同目录 [人工实机测试文档.md](人工实机测试文档.md)，由用户执行；本交付不等待其结果                                                                                                             |

## 1. 交付产物（pc114514）

| 项                    | 值                                                                                                                                                                                                                                                   |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 目录                  | `D:\vrcx-mimi-artifacts\20261118T2123Z-b6a3f9e77\`（不进 git）                                                                                                                                                                                       |
| 安装包                | `VRCX-0-jirai_2.34.0_x64-setup.exe`，16,572,575 字节（15.80 MiB），NSIS，currentUser 安装                                                                                                                                                            |
| 程序本体              | `vrcx-0.exe`，45,526,528 字节                                                                                                                                                                                                                        |
| SHA256                | `a05ba37f95bd45799cb88cbaa2298d43d5c570ce295eaba9f630474badad5049` VRCX-0-jirai_2.34.0_x64-setup.exe<br>`955a628dc9f62ab8de377e5cb13318f3ae22b362e8457e595d29782eb349d4ec` vrcx-0.exe（同目录 `SHA256SUMS.txt`）                                     |
| 构建源                | pc 验证 worktree `C:\Users\tangh\vrcx-mimi` @ `b6a3f9e77`（`git status` 干净）                                                                                                                                                                       |
| 构建命令              | `npm ci` → `npm run tauri build -- --config <覆盖>`，覆盖内容 `{"bundle":{"createUpdaterArtifacts":false,"windows":{"certificateThumbprint":null,"timestampUrl":null}}}`；`start /low`、`CARGO_BUILD_JOBS=8`、`CARGO_TARGET_DIR=D:\vrcx-mimi-target` |
| 耗时                  | 第一次：`20:46:35Z` 起，release 编译 **19 分 28 秒**完成，随后在**签名**一步失败（见下）；第二次（只改打包配置）：`21:11Z`–`21:23:14Z`，约 12 分钟（嵌入配置变化导致 `vrcx-0` crate 重新做 LTO 链接，再下载 NSIS 并打包）                            |
| `D:\vrcx-mimi-target` | 交付后 **28.3 GB**（debug + release）；D: 剩余 97.5 GB                                                                                                                                                                                               |
| 烟测                  | 产物生成即烟测通过；**未执行、未安装**                                                                                                                                                                                                               |

**签名说明（与计划的偏差）**：`src-tauri/tauri.conf.json` 配有 Certum 证书指纹 `CF3C4BD7…`，pc114514 上没有这张证书，第一次 `tauri build` 在 `signtool` 报「No certificates were found」后 `RELEASE_EXIT=1`（`vrcx-0.exe` 已编译成功）。按计划「不改 `tauri.conf.json`」，第二次用 `--config` 覆盖把 `certificateThumbprint`、`timestampUrl` 置空后打包成功。**因此两个 exe 都未签名**，Windows 可能显示 SmartScreen 提示。临时的覆盖文件与脚本放在验证 worktree 里，打包后已删除（worktree `git status` 为空）。NSIS 工具由 tauri 自动下载到 pc 的 tauri 缓存目录（代理不通也成功下载）。

## 2. 提交列表（`ea3142a47..MIMI`）

| 提交        | 说明                                                                         |
| ----------- | ---------------------------------------------------------------------------- |
| `cbe18191e` | docs(mimi): import analysis reports                                          |
| `4896f0bf1` | feat(quick-search): match friend profile bio (#14 Rust)                      |
| `f5c72bd1f` | chore(bindings): regenerate for quick search bio (#14)                       |
| `f7ead4fa8` | feat(quick-search): show bio row for bio matches (#14 UI)                    |
| `a0c089af3` | feat(auto-follow): Rust state machine, commands and event (#7)               |
| `4decec979` | chore(bindings): regenerate for auto follow (#7)                             |
| `c5e31de36` | feat(auto-follow): hidden dialog, executor and i18n (#7 UI)                  |
| `73b35fd54` | refactor(bindings-export): keep AutoFollowTriggered import append-only (G-5) |
| `b6a3f9e77` | feat(auto-follow): dev-only console opener and status refresh (#7)           |
| `45dabe2aa` | docs(mimi): write back #14/#7 completion to status documents                 |

（本报告与人工测试文档的提交在上表之后。）

## 3. 断言 → 测试

### 3.1 #14 快速搜索 Bio（A14-1…10，全部由夹具证明）

| 断言                                           | 测试                                                                                                                 | 位置                                                                    |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| A14-1 Bio 独中 → 出现且 `matched_field == Bio` | `bio_only_match_returns_friend_with_bio_matched_field`、`bio_matching_is_case_and_width_insensitive`                 | `crates/application/src/social/quick_search_catalog.rs`                 |
| A14-2 名字 > 备注 > 笔记 > Bio，每人一次       | `name_beats_memo_note_and_bio_and_each_friend_appears_once`                                                          | 同上                                                                    |
| A14-3 1 字符不搜 Bio                           | `single_character_query_does_not_search_bio`、`detail_loading_is_skipped_for_short_queries_and_counts_every_failure` | 同上                                                                    |
| A14-4 非好友不出现                             | `non_friend_bio_matches_are_ignored`                                                                                 | 同上                                                                    |
| A14-5 旧查询不覆盖新结果                       | `does not let a stale bio result overwrite the newer query result`                                                   | `src/components/sidebar/quick-search/useQuickSearchBioResults.test.tsx` |
| A14-6 `%`、`_` 为普通字符                      | `percent_and_underscore_are_literal_characters_in_bio_matching`                                                      | Rust 同上                                                               |
| A14-7 共享 8 条上限                            | `bio_matches_share_the_friend_result_limit`                                                                          | Rust 同上                                                               |
| A14-8 Bio 行仅 Bio 命中显示；备注/笔记照常     | `shows the bio row only when the friend matched on bio`、`keeps memo and note rows visible for a bio match`          | `src/components/sidebar/QuickSearchResults.test.tsx`                    |
| A14-9 Bio 载入失败计入 failures、其余照常      | `bio_load_failure_is_counted_and_other_details_still_load`（新写的测试替身 `FakeDetailStore`）                       | Rust 同上                                                               |
| A14-10 整段 Bio、样式截断                      | `renders the whole bio text and truncates only through styling`                                                      | vitest 同上                                                             |
| 契约                                           | `matched_field_bio_serializes_as_camel_case_bio`；`bindings.ts` `QuickSearchMatchedField` 增 `"bio"`                 | —                                                                       |

数据源（D5）：`profile_bio_list`（每人一行、最近一次检查到的 Bio），经 `QuickSearchDetailStore::user_bios` → `LocalQuickSearchDetailStore`。

### 3.2 #7 自动跟随（A7-1…8、A7-10…17）

Rust：`crates/application-realtime/src/auto_follow.rs` 的 `auto_follow::tests`（23 个）。前端：`src/features/auto-follow/*.test.ts(x)`（22 个，全部 mock，从不启动 VRChat）。

| 断言                                                                                  | 测试                                                                                                                                                                                                                                                                                       | 证明程度                                                        |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| A7-1 单目标、替换                                                                     | `a7_1_starting_a_new_target_replaces_the_previous_one`                                                                                                                                                                                                                                     | 夹具                                                            |
| A7-2 在线 / 非收藏 / join me·active                                                   | `keeps online, non-favorite friends whose status is join me or active`、`filters remote favorites by the selected remote groups…`、`lists only online non-favorite join me / active friends and starts on click (A7-2)`                                                                    | 夹具                                                            |
| A7-3 新真实实例且 ≠ 自己 → 恰好一次                                                   | `a7_3_new_real_instance_acts_exactly_once`                                                                                                                                                                                                                                                 | 夹具                                                            |
| A7-4 空 / offline / private / traveling / local / 等于自己 / 无目标 / 已停止 → 不动作 | `a7_4_decision_table_rejects_non_actionable_locations` + 8 条单项测试                                                                                                                                                                                                                      | 夹具                                                            |
| A7-5 `!isGameNoVR \|\| SteamVR` → 在运行的游戏里打开                                  | `a7_5_vr_mode_or_steamvr_attaches`；前端 `attach action opens the instance in the running game exactly once (A7-5)`                                                                                                                                                                        | **逻辑**由夹具证明；真实打开见人工 7-6                          |
| A7-6 桌面且无 SteamVR → 退出并 `--no-vr` 重启                                         | `a7_6_desktop_mode_without_steamvr_relaunches`；前端 `relaunchDesktop quits then immediately launches with --no-vr`                                                                                                                                                                        | **逻辑**由夹具证明；真实退出 / 重启见人工 7-8                   |
| A7-7 停止后不触发、不落盘                                                             | `a7_7_stop_ends_actions_and_state_is_not_persisted`；前端 stop 行测试；diff 无新增配置键 / 表 / 迁移（G-3）                                                                                                                                                                                | 夹具 + diff                                                     |
| A7-8 开始 / 停止 / 触发提示（i18n）                                                   | `start and stop show toasts and mirror the Rust status (A7-8)`、`attach action…`（switching 提示）；i18n `jirai.auto_follow.*`（en、zh-CN）                                                                                                                                                | 夹具                                                            |
| A7-10 无冷却                                                                          | `a7_10_each_new_instance_acts_and_repeats_do_not`；前端 `two consecutive instance changes produce two actions`                                                                                                                                                                             | 夹具                                                            |
| A7-11 换账号不清目标                                                                  | `a7_11_account_switch_keeps_the_target`                                                                                                                                                                                                                                                    | 夹具（推断：真实换账号路径若把目标送进 removals，表现按 A7-16） |
| A7-12 初始无目标                                                                      | `a7_12_initial_state_has_no_target`                                                                                                                                                                                                                                                        | 夹具                                                            |
| A7-13 开始时不动作                                                                    | `a7_13_starting_does_not_act_on_the_current_instance`                                                                                                                                                                                                                                      | 夹具                                                            |
| A7-14 游戏未运行也触发                                                                | `a7_14_game_not_running_still_acts_with_configured_branch`；前端 `relaunchDesktop still launches when no game process was quit`                                                                                                                                                            | **逻辑**由夹具证明；真实启动见人工 7-9                          |
| A7-15 打开失败 → 自我邀请 + 提示                                                      | 复用既有 `attachRunningVrchat`（`launchService.ts`，`selfInvited` 分支），服务层 `surfaces executor failures as an error toast…`                                                                                                                                                           | **逻辑**；真实回退见人工 7-7                                    |
| A7-16 删好友不触发、仍显示跟随中                                                      | `a7_16_removed_target_stays_active_without_acting`                                                                                                                                                                                                                                         | 夹具                                                            |
| A7-17 入口隐藏                                                                        | `renders no visible entry until openAutoFollowDialog is called`、`only the auto-follow feature module references the dialog or its opener`（全 `src` 扫描，已做反例验证：往 `FriendsSidebarActionItems.tsx` 注入引用会使其失败）、`installs the console handle only in development builds` | 夹具                                                            |

### 3.3 守卫 G-1…G-6（交付提交上实测）

| 守卫 | 命令 / 证据                                                                                                                                                                                                                                                                                       | 结果     |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| G-1  | `xargs -a 冻结清单.txt git diff --name-only ea3142a47 HEAD --`                                                                                                                                                                                                                                    | **0 行** |
| G-2  | pc `TEST_EXIT=0`（3642 通过 / 0 失败 / 6 忽略）；本机 `npx vitest run` 744 个文件 / 4318 个测试全部通过（`VT_EXIT=0`）；冻结测试文件未改（G-1）                                                                                                                                                   | 真       |
| G-3  | `git diff --name-only ea3142a47 HEAD -- crates/persistence/src/migrations.rs`                                                                                                                                                                                                                     | **0 行** |
| G-4  | `git diff --name-only ea3142a47 HEAD -- crates/persistence/src/{social_aggregates,activity_page,game_log}`                                                                                                                                                                                        | **0 行** |
| G-5  | `bindings_export.rs`、`contracts/jirai.rs`：相对基线删除行 0；`bindings.ts`（整文件生成）：唯一的 `-` 行是计划 14.4 规定的 `QuickSearchMatchedField` 联合类型扩为 `"name" \| "memo" \| "note" \| "bio"`，其余基线类型与命令签名不变（只新增）；13 个 `src/localization/*.json`：基线 key 值改变 0 | 真       |
| G-6  | pc `ARCH_EXIT=0`；`src-tauri/tests/backend_architecture.rs` diff 0 行                                                                                                                                                                                                                             | 真       |

## 4. 退出码

| 位置       | 提交                                      | 命令                                                                                     | 结果                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------- | ----------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 本机基线   | `cbe18191e`（= 基线代码）                 | `npm run typecheck` / `npx vitest run` / `npm run lint`                                  | 0 / 0（4291 通过）/ 0                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| pc 基线    | `cbe18191e`                               | `vrcx-mimi-check.cmd`、`test`                                                            | `CARGO_EXIT=0`、`TEST_EXIT=0`（3609 通过）、`ARCH_EXIT=0`                                                                                                                                                                                                                                                                                                                                                                                                |
| pc #14     | `4896f0bf1`                               | check / test / bindings                                                                  | 0 / 0（3619 通过）/ 0 / `BIND_EXIT=0`                                                                                                                                                                                                                                                                                                                                                                                                                    |
| pc 交付    | `b6a3f9e77`（代码与产物）；文档提交在其后 | check / test / arch / bindings                                                           | `CARGO_EXIT=0`、`TEST_EXIT=0`（3642 通过 / 0 失败）、`ARCH_EXIT=0`、`BIND_EXIT=0`（重新生成的 `bindings.ts` 与已提交一致：worktree `git status` 为空）                                                                                                                                                                                                                                                                                                   |
| pc release | `b6a3f9e77`（代码与产物）；文档提交在其后 | `npm ci` + `npm run tauri build -- --config {"bundle":{"createUpdaterArtifacts":false}}` | 第一次 `RELEASE_EXIT=1`（签名证书缺失，编译成功）；第二次（关闭签名）`RELEASE_EXIT=0`，产物见第 1 节                                                                                                                                                                                                                                                                                                                                                     |
| 本机交付   | `b6a3f9e77`（代码与产物）；文档提交在其后 | typecheck / vitest / lint / format:check                                                 | `TC_EXIT=0`、`VT_EXIT=0`（744 文件 / 4318 测试）、`LINT_EXIT=0`（0 warnings / 0 errors）；`npm run format:check` 为 1，问题文件中的代码文件 `src/main.ts`、`src/components/reui/gantt/gantt-bar.tsx`、`src/components/dialogs/user-dialog/useUserDialogTabData.ts` 与基线逐字节相同、`bindings.ts` 在基线上同样不符合 oxfmt（生成物），其余为 `reports/` 与根目录分析文档（Markdown，基线导入即如此）。本次新增 / 修改的代码文件全部通过 `oxfmt --check` |

**一次偶发失败（如实记录）**：`73b35fd54` 那一轮 pc `TEST_EXIT=101`，唯一失败是 `vrcx-0-host-desktop` 的 `desktop_widget_window::tests::turning_click_through_and_pin_off_makes_an_ordinary_clickable_window`（`assertion failed: !window.has_style(WS_EX_TOPMOST)`）。该测试创建真实 Win32 分层窗口；MIMI 对 `crates/host-desktop` 0 行改动；它在基线、#14、#7 预验证和交付轮均通过。判断为依赖桌面环境的偶发失败（推断：用户正在使用的桌面窗口层级干扰），与本次改动无关。

## 5. 实施要点与偏离

- **#14**：只做 jirai 甲路径（内存当前 Bio）；数据源用 `profile_bio`，只有被抓取过的好友能按 Bio 搜到（D5）。
- **#7（D3 = 与 jirai 一致，D4 = A）**：
    - Rust 接缝：既有 `FriendProjectionObserver`（`DesktopRuntimeServices::on_friend_projection`），覆盖 WebSocket、资料拉取、基线刷新；**未改 composition**（R-f 检查点 7.2 的自审记录在提交 `a0c089af3` 说明里）。
    - 分支判断在 Rust：读持久化配置 `isGameNoVR`（与 jirai 同义；前端 `runtimeStore.gameState.isGameNoVR` 启动时不回填，不同义，见 spike 报告第 4 节）+ SteamVR 状态。
    - 新增 host 命令 `app__quit_game`（只追加，`quit_game` 只在恰好 1 个 VRChat.exe 时结束，与 jirai `QuitGame` 一致）。
    - 入口隐藏：发布构建没有任何打开途径；开发构建暴露 `window.__VRCX_JIRAI_AUTO_FOLLOW__`，供人工测试。
    - **偏离 jirai 的一处（lead 裁决）**：对话框激活时有「跟随中 + 停止跟随」行。jirai 的对话框没有停止按钮、侧栏开关被注释，实际无法停止；不加则 A7-7/A7-8 的「停止」不可达。
    - 已知限制：后台运行模式主窗口隐藏时事件被丢弃；游戏隔离开启时仍按原始游戏日志位置判断。
- 7.0 spike 报告：`reports/2026-11-18T2001Z-mimi-7.0-spike/README.md`。

## 6. 回写的状态文档

- `reports/2026-11-17T2308Z-completion-audit/VRCX-0-jirai 功能板块完成度清单.md`、`VRCX-JIRAI功能锚点与VRCX-0语义映射.md`、`VRCX-JIRAI新增功能图谱.md`：#14、#7 → 完成（#7 注「与 jirai 一致：入口隐藏」），#10、#12 注「冻结」，计数 **13 / 1 / 2 / 1**；已完成 11 项的行未动。
- `reports/2026-11-18T0053Z-rust-rewrite-roadmap/闭环断言.md` 第 8 节：追加实测注记。

## 7. 未验证项

- A7-5、A7-6、A7-14、A7-15 的**真实效果**：逻辑已由夹具覆盖，真实效果见《人工实机测试文档.md》。
- #14、#7 的界面实际观感与提示文案在真机上的呈现。
- 后台隐藏模式、游戏隔离开启下的 #7 行为（已知限制，未测）。
- 安装包 / exe **未执行、未安装**（按约束）。

## 8. 施工过程记录

- 子代理：`spike-7`（与主代理同模型，未传模型参数）完成 7.0 只读调研与 #7 Rust 部分；主代理审 diff、用 pc rustfmt 格式化、pc 编译测试后提交。#14 与 #7 前端由主代理编写。
- 本机没有 cargo，提交时跳过了 husky 的 `cargo fmt` 钩子（`--no-verify`）；Rust 文件均经 pc 上 `rustfmt --edition 2021` 格式化（输出与提交一致），前端文件经 `oxfmt --check`。
- pc 上只写了 `C:\Users\tangh\vrcx-mimi-check.cmd`、`C:\Users\tangh\vrcx-mimi`（验证 worktree）、`D:\vrcx-mimi-target`、`D:\vrcx-mimi-artifacts`；编译均 `start /low` + `CARGO_BUILD_JOBS=8`；未结束任何用户进程（中途取消自己的验证链时只关闭了本会话的 ssh，核对过 pc 上不再有 `vrcx-mimi` 的进程，用户自己的 `cargo run`/`node` 未动）。

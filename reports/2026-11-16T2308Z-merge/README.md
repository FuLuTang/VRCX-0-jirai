# VRCX-0-jirai 全分支合并报告

- 报告时间：2026-11-16T23:08Z（UTC）
- 仓库：`FuLuTang/VRCX-0-jirai`
- 集成分支：`integrate/main-2026-11`，集成 worktree：`/home/fulutang/Documents/Github/VRCX-0-jirai-integrate`
- 合并前 `main`：`0b8a63d61` → 合并后 `main`：`ea3142a47`（快进，无强推）
- 上游：`Map1en/VRCX-0` `master` = `35b40308a`（合并时最新）

## 1. 合并范围

| 来源 | 合并前位置 | 状态 |
|---|---|---|
| `main` | `0b8a63d61` | 作为基线，快进 |
| `port/legacy-audit-simple-ui` | `3200bc3c7` | 主线（结构 + 上游同步） |
| `sync/upstream-2026-11` | ⊂ port | 已包含 |
| `codex/v2.28-jirai-port` | `83e624a06` | 经 WIP 合入（`bc77d7fd5`） |
| pc114514 codex 未提交 WIP | `wip/pc-codex-2026-11-16` = `63bbe0ff4` | 作为 codex 侧父提交合入 |
| `bio-diff` | `d82c18d21` | 合并点 `cf579ef32`，代码取集成版（codex 已吸收并继续修复） |
| `upstream/master` | `acc031e9e` → `35b40308a` | 两次合并（`0fcd43d93`、`d2bb4d614`），追到最新 |

合并后检查：所有 `origin/*` 分支相对 `ea3142a47` 未合入提交数均为 0；`upstream/master` 未合入数为 0。

## 2. 保全措施

- 存档 tag（已推送）：`archive/2026-11-16/{main,port-legacy-audit-simple-ui,codex-v2.28-jirai-port,bio-diff,sync-upstream-2026-11}`。
- pc WIP 保存为分支 `wip/pc-codex-2026-11-16`（仅 5 个源文件，`target-novr/` 构建缓存未入库）。
- pc114514 原工作区未被改写；集成在独立 worktree（本机 `VRCX-0-jirai-integrate`，pc `C:\Users\tangh\vrcx0-integrate`）完成。

## 3. 去重裁决（同功能多实现择一）

规则：**重复功能以 codex 实现为准**；结构、架构约束与上游演进以 port/上游为准；数据库表名与形状随 codex。

| 功能 | 采用 | 说明 |
|---|---|---|
| 关系推荐、互惠关系历史 `historical_links`、`self_status_history`、增强资料抓取、关系类型 | codex | 完整保留 |
| Bio 历史差异 | codex（含 `bio-diff` 超集） | `bio-diff` 的 `bioHistory.ts`/`UserDialogInfoTab.tsx` 被 codex 版本覆盖（后者多一次标点误报修复） |
| 两人关系页选人 | codex `RelationshipPlayerSelect` | port 的 `RelationshipUserPicker` 文件保留但当前无引用 |
| 非好友互惠列表 | codex 语义：存为历史观测（`archive_observation`），不建图边 | 上游测试按此语义改写 |
| 同步工作流对话框 | codex 功能，放在 port 位置 `components/hosts/tools-dialogs/` | 进度从 `enhancedInfoFetchService` 快照读取，避免 shared 组件依赖 features |
| Feed 拖放、启动 Online 回填资格、DTO 去 snake_case 别名、jirai 托盘图标 | port | 保留 |
| README / README.zh-CN | 地雷版 | 上游 README 改动未采用 |

## 4. 合并后修复（提交清单，first-parent）

- `9b47a55ba` realtime：FriendPlace / roster owner / game_log store / feed 持久化开关对齐上游结构
- `7206b271c` facade：资料请求任务自持 auth scope 副本
- `4d83bf89c` game：推荐覆盖层开关读 config store
- `f7b98b9c4` http：retry-after 使用 crate 错误转换
- `f81a53e61`、`0837635b7`、`ebc56c979` 测试套件适配合并后的 trait 与路径
- `ac442493b`、`ea3142a47` 在 Windows 上重新生成 Tauri bindings
- `83b11ac3b` 互惠列表测试改为历史归档语义；错误复制移入 `application-core`（`Error::duplicate()`），满足 `application_features_do_not_own_web_transport`
- `8a9ea7bec` persistence 测试数据前后矛盾修正
- `65756ddd6` 遥测工具键去重（`sync-workflow` 重复）；两人关系页取 codex；对话框测试改读快照

## 5. 验证结果（HEAD `ea3142a47`）

| 项 | 环境 | 结果 |
|---|---|---|
| `cargo test --no-fail-fast --workspace --exclude vrcx-0` | pc114514 Windows | 通过（TEST_EXIT=0） |
| `cargo test -p vrcx-0 --test backend_architecture` | pc114514 | 通过（ARCH_EXIT=0） |
| `cargo check --workspace --all-targets` | pc114514 | 通过（包含在 test 构建中） |
| bindings 导出 | pc114514 | BIND_EXIT=0，已提交 |
| `tsc --noEmit` | 本机 | 0 错误 |
| `oxlint` | 本机 | 0 警告 0 错误 |
| `vitest run` | 本机 | 739 文件 / 4291 测试全部通过 |

## 6. 遗留与注意

- pc114514 `~/.cargo/config.toml` 配置代理 `127.0.0.1:7890`，代理未开时新依赖下载失败；本次以 `--config http.proxy=""` 直连拉取。
- `RelationshipUserPicker`（port）现无引用，可后续删除或替换 codex 选择器。
- `docs/jirai-port/旧版功能清单.md` 内容过期（仍称未实现追踪非好友/手动关系），未在本次合并中修改。
- 版本号不可用于推断血缘：pc `VRCX-0-jirai-build` 为 2.34.0，codex 线曾为 2.31.0。
- 旧分支未删除；如需清理，以存档 tag 为准。

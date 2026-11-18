# subagent.md — MIMI 施工期子代理规则

> 适用：MIMI 分支施工会话（`/goal` 启动）。编写：调研会话「抽象层断言」，`2026-11-18T19:26Z`。
> **本文件优先于 `AGENTS.md` 的「路由」一节**；`AGENTS.md` 其余条款（何时拆、怎么派、通用纪律）照常有效。

## 1. 模型：子代理一律与主代理同模型

- 调用 `subagent` / `subagent_fork` 时**不传** `provider`、`model`、`reasoning_effort` 三个参数。子代理自动继承主代理当前的模型与推理强度。
- 原因：本机 DSH 的子代理工具配置键写成了 `modelSelectionSettings`，工具只认 `modelSelection`，所以「指定模型」被关闭；传了这三个参数会报 `child model selection is disabled for this tool instance`（`2026-11-18` 实测）。用户决定**暂不修复**。
- 因此 `AGENTS.md` 路由表（codex/terra、claude/opus、fallback flash、effort medium）**本次施工不适用**；`docs/jirai-port/总执行规划.md:186-192` 第 4 条的 Luna/Terra 选择也不适用。
- 不用 `workflow` 的 `agent({provider, model})` 去绕开这个限制。
- 派发失败（非模型参数原因）：用 `send_message` 对同一子代理补一句重试一次；仍失败就换一个新子代理重派一次；再失败由主代理自己做，并在汇报里记一笔。**不因派发失败停下问用户。**

## 2. 什么时候派

| 情况 | 做法 |
| --- | --- |
| 只读调研：要读 ≥5 个文件或跨 ≥3 个 crate 才能回答（如 P1 的 7.0 spike、对照 jirai 源码） | 派 `subagent`，可并发 |
| 需要本会话已有结论的复核、审查 | `subagent_fork` |
| 写代码 | 可以派，但**同一时刻只有一个写入子代理**（写入包串行，`总执行规划.md:188-190`） |
| 单点小改、跑一条命令、读一两个文件 | 主代理自己做 |
| 跑 pc114514 构建 / 测试 | **主代理自己做**（后台任务），不派子代理，避免并发占用 pc |

## 3. 派活提示必须自带（子代理看不到主对话）

1. **目标**与**验收**：要变真的断言编号（来自《闭环断言.md》），以及判定方法。
2. **允许写的文件清单**（逐个路径）；其余一律只读。
3. **禁区**：《冻结清单.txt》（`reports/2026-11-18T0053Z-rust-rewrite-roadmap/冻结清单.txt`，114 个文件）一行不改；`crates/persistence/src/migrations.rs`、`crates/persistence/src/{social_aggregates,activity_page,game_log}` 不改；`bindings.ts` 不手改（只由 pc 重新生成）。
4. **参考源码的绝对路径**：VRCX-0 侧 `/home/fulutang/Documents/Github/VRCX-0-jirai-MIMI/...`；jirai 侧一律用 `git -C /home/fulutang/Documents/Github/VRCX-jirai show c7eaf00e:<路径>` 读，**不要读工作树、不要 checkout**（工作树当前也在 `c7eaf00e`，但按提交读才不会漂）。
5. 当前已定的产品决定中**与该任务相关的那几条**（D3/D4/D5、入口隐藏、i18n），不要让子代理自己去推断。
6. 第 6 节的约束原文。

## 4. 子代理不得做

- `git add` / `commit` / `rebase` / `merge` / `reset` / `checkout` / `stash` / `push`。
- 改分配清单以外的文件；遇到范围外改动、冲突标记、工作区里有意外修改 → **立即停手并报告**。
- 碰上游数据表或 runtime 核心（`crates/composition`、实时层串接）→ 停下报告（R-f）。
- 任何 GUI 操作、computer use、`mcp__pc114514__*` 工具；运行 `tauri dev`、运行构建产物、启动 VRChat。
- ssh 到 pc114514（pc 只由主代理操作）。
- 修改 `subagent.md`、`AGENTS.md`、施工计划、断言文档。

## 5. 子代理交付格式

- 改了哪些文件（路径列表）+ 关键 diff 摘要；跑了哪些本机命令及退出码。
- 每条目标断言：对应的测试名，或「无法用夹具证明」及原因。
- 不确定、推断出来的结论单独列出，标明「推断」。
- 主代理收到后：自己看 diff、跑测试、做冻结守卫检查，再提交。**子代理的产出不算已验收。**

## 6. 施工期硬约束（照抄进每个派活提示）

- 验证只用测试夹具与烟测；禁止实机验证；禁止任何需要启动 VRChat.exe 的测试。
- 严禁 computer use；禁止创建前台可见 UI。
- 不得影响 pc114514 的用户使用。
- 冻结清单 114 个文件一行不改。

## 7. 断言不清时子代理怎么自行深挖

按顺序查，查到就停：

1. 《闭环断言.md》对应条目 + 文首修订 6–8 注记（修订注记优先）。
2. 施工计划与 `reports/2026-11-18T1926Z-mimi-source-sufficiency/README.md`（已知的锚点与缺口）。
3. jirai 源码（`git show c7eaf00e:<路径>`）：先读断言里点名的文件，再顺着 import 读；用 `git -C /home/fulutang/Documents/Github/VRCX-jirai log --format='%h %ad %s' -- <路径>` 看来历；提交 `3a5c269e`（#7 入口隐藏）、`c4f1a461`（#10）可直接 `git show`。
4. VRCX-0 侧：在 MIMI 工作目录用 grep / 读文件；`/home/fulutang/Documents/Github/VRCX-0-jirai/.codegraph` 的索引对应**旧分支 `3200bc3c7`**，不是基线，用 codegraph 查到的行号必须回 MIMI 目录核对。
5. 仍不清：写「推断」并给出两种以上读法及各自的后果，交主代理裁决；**不得为了让测试通过而改断言**。

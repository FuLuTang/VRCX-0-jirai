# 多账户进程隔离 RFC

> 状态：主对话已审查设计结论；**仅 RFC，不实现多账户产品**。本文件是任务 10 的交付物，后续实现必须另开任务、另做安全评审。

## 1. 决策与不可变约束

选择 **C：一个 manager Desktop GUI + 每账号一个独立 `HeadlessData` worker + 每 worker 独立 `--data-dir` + 经 OS 身份/继承句柄认证的本地 IPC**。

目标是在不把上游 VRCX-0 的单会话 runtime 改造成多会话 runtime 的前提下，获得账号、数据库、WebSocket、崩溃域隔离和单一聚合界面。

硬约束：

1. 不移植旧 V4 的 `dbVars`、全局 Store 热切换、全局快照回滚、次账号 `HttpClient` map 或手写 SQL `UNION`。
2. manager 不持有或传递 worker 的密码、cookie、Basic Authorization、API/WS token、加密密钥或 worker 数据库句柄。
3. 不允许多个账号共用 `--data-dir`、SQLite、config、cookie、cache 或 profile lock。
4. worker 不是第二个完整 Desktop GUI：没有窗口、托盘、通知、deep link、autostart、更新或 overlay 所有权。
5. 不为多开绕过或重命名 Windows single-instance mutex；不把“多个 Desktop GUI”当产品方案。
6. 首次登录和 encrypted secret migration 在 HeadlessData 的限制澄清前不是 MVP 承诺；MVP 只恢复 worker 自己已有的本地会话。

## 2. 现有代码证据

| 事实 | 证据与影响 |
| --- | --- |
| runtime 是单一 profile 组装 | `/home/fulutang/Documents/Github/VRCX-0-jirai/crates/composition/src/state/runtime_host_state.rs:99-132` 的 `RuntimeHostState` 同时持有单个 storage、db、web、realtime、authenticated runtime 和 profile lock。单进程 session factory 将牵动全部单例上下文。 |
| HeadlessData 可作为 worker 基础 | 同文件 `:135-143` 显示 HeadlessData 禁止 encrypted writes；后续实现必须把它作为登录/密钥持久化的显式产品边界，而不能假设 manager 可代传凭据。 |
| data-dir 已提供 profile 隔离基础 | `/home/fulutang/Documents/Github/VRCX-0-jirai/crates/platform/src/app_paths.rs:99-142` 支持 `--data-dir` 并验证目录；每 worker 用独立目录即可隔离 DB/config/cache/lock。 |
| 多完整 GUI 在 Windows 不可作为方案 | `/home/fulutang/Documents/Github/VRCX-0-jirai/src-tauri/src/single_instance_gate.rs:14,77-102` 的 mutex 固定为 `Local\\VRCX-0.App.SingleInstanceGuard`；`/home/fulutang/Documents/Github/VRCX-0-jirai/src-tauri/src/app.rs:177-218` 在解析 data-dir 前就执行 guard，并注册 Tauri single-instance。 |
| 旧 V4 是反例而非移植源 | `/home/fulutang/Documents/Github/VRCX-jirai/src/services/accountHub.js`、`/home/fulutang/Documents/Github/VRCX-jirai/src/services/accountSession.js`、`/home/fulutang/Documents/Github/VRCX-jirai/src/services/aggregatedView.js` 和 `/home/fulutang/Documents/Github/VRCX-jirai/docs/MULTI_ACCOUNT_V4_DETAIL_DESIGN.md` 均以同进程全局状态/DB prefix 交换为核心，与本 RFC 冲突。 |

## 3. 路线比较

| 路线 | 结论 | 原因 |
| --- | --- | --- |
| A：单进程 Rust session factory | 拒绝 | 必须把 auth scope、WebClient、DB、realtime、后台任务、投影和崩溃域全部从单例化改为多实例；上游冲突和组合测试面最大。 |
| B：多个完整 GUI + `--data-dir` | 仅手工调试可用 | data-dir 能隔离 profile，但 Windows 现有 mutex 会阻断；即使绕过也会复制 tray、通知、更新、deep link、overlay 和生命周期。 |
| C：manager + HeadlessData workers + IPC | 推荐 | worker 内部继续遵守上游单会话语义；各账号隔离；manager 只聚合裁剪投影，并独占 OS 集成。 |

`venv` 不适用：它只隔离 Python 解释器/依赖，不能隔离本 Rust/Tauri 二进制的 profile、SQLite、cookie、mutex、file lock、WebSocket、tray/通知或进程崩溃域。

## 4. 角色、目录与生命周期

### 角色

- **manager（唯一 Desktop）**：唯一窗口、single-instance gate、tray、原生通知、deep link、autostart、更新、overlay、游戏集成、全局快捷键和用户可见日志；只维护非秘密 registry 与聚合投影。
- **worker（每账号一个 HeadlessData）**：仅运行该账号的现有单会话 backend/realtime/DB；使用本账号本地 session，发布裁剪投影，在本地执行经过 allowlist 的命令。

### 建议目录

```text
<manager-data>/multi-account/registry-v1.json       # 非秘密：opaque UUID、显示标签、desired state、协议版本
<manager-data>/multi-account/runtime/               # PID/诊断，不能作为认证源
<manager-data>/multi-account/workers/<uuid-v7>/     # 单一 worker 的完整 --data-dir
  VRCX-0.sqlite3
  VRCX-0.json
  ImageCache/
  ScreenshotThumbs/
  .profile-lock
```

- 使用 manager 生成的 opaque UUID，不用 VRChat user id、用户名或 display name 作为目录或 IPC 名。
- 创建目录时 canonicalize，拒绝 symlink escape/重叠；Unix 限制为当前用户 `0700`，Windows 使用 current-user ACL。
- worker profile 备份、恢复与迁移以账号目录为单位；不能假设当前单 profile 的 data-dir migration 会自动覆盖 worker roots。

### 生命周期

1. manager 校验 opaque account directory，创建仅本次启动可用的私有控制通道，启动同版本 worker；worker 启动分流必须发生在 Desktop `run()`/single-instance gate 之前。
2. worker 获得自己 profile lock 后启动 HeadlessData，恢复本地会话；若须交互登录，仅报告 `auth_interaction_required`，绝不让 manager 转发用户名、密码或 2FA。
3. worker 先发 Ready/Health 和 snapshot，之后发有序 delta；manager 记录 pid、generation、心跳、退出码并只接受绑定 workerId 的消息。
4. manager 正常关闭时发 graceful shutdown，超时后终止；控制通道 EOF 时 worker 停止或退避退出，防止 manager 崩溃留下孤儿。
5. worker 崩溃仅标记该账号 Degraded，指数退避且有重启预算；启动前确认旧 PID 退出、profile lock 释放。重启后先 snapshot，丢弃旧 generation/cursor。

## 5. 本地 IPC 草案

### 传输与认证

不监听 TCP/localhost 端口。优先使用 spawn 时创建的专用 duplex 通道：Unix `socketpair` 并校验 peer uid/PID；Windows 使用 current-user ACL 的 inheritable named pipe/handle。该非公开继承 handle 是 capability，不能出现在 CLI、环境变量、registry、日志或磁盘。

若未来改为可发现 socket/pipe，必须同时校验 OS peer credential、每次启动的非持久 capability、消息长度/速率，并拒绝跨用户连接。

### 消息 envelope

每条消息带 `protocol`、`workerId`、`generation`、`requestId`/`sequence`；限制大小与速率，做版本协商和未知字段策略。初始 allowlist：

```text
WorkerHello { protocol, workerId, pid, build, profileDirDigest, capabilities }
ManagerAccept { protocol, generation, projectionKinds }
Health { generation, sequence, auth, realtime, lastEventAt }
ProjectionSnapshot { generation, cursor, ... }
ProjectionDelta { generation, cursor, upserts, removes }
Command { generation, commandId, kind, targetId, precondition }
CommandResult { commandId, outcome, errorCode }
Shutdown { generation, deadlineMs }
Stopped { generation, taskStopReport }
```

manager 只请求 allowlist command；带副作用命令在 worker 内以其本地登录态执行，并以 generation/precondition 去重。位置和通知虽非 credential，仍是敏感个人数据，必须脱敏日志并验证背压。

## 6. 聚合、升级与恢复

manager 不打开 worker SQLite，也不依赖 worker 内部 schema。它消费 versioned snapshot/delta，用 `(workerId, remoteObjectId)` 建内存索引；重复对象保留 `accountIds[]` 来源，冲突由明确的时间戳/详情优先规则处理，绝不回写 worker。

升级时 manager 应 drain：停止新命令、等待 worker 停止和 profile lock 释放，再使用同一经验证二进制逐个启动。IPC major 不兼容时拒绝连接，不能静默降级。每账号 migration/备份/恢复应独立、幂等、有 journal；manager 崩溃后读取非秘密 registry，检查旧 PID/lock，按“snapshot 后 delta”恢复。

## 7. MVP 验收矩阵与非目标

| 用例 | 必须观察到 |
| --- | --- |
| 两号登录 | 两个不同 PID/opaque id/data-dir，独立 DB/config；manager 未读取凭据。 |
| 独立 WebSocket | 两路 Health/realtime 和带 workerId 的 delta；停止 A 不影响 B。 |
| 退出/重启 | 无 orphan、不双启；单 worker crash 独立退避并从 snapshot 恢复。 |
| OS 去重 | 只有 manager 有窗口/tray/通知；worker 无原生 OS 集成。 |
| IPC 负测 | 跨用户/随机 client、旧 generation、超大或未知消息被拒绝且无秘密泄露。 |

在上述 MVP 验收前，不做：全量页面聚合、跨账号可变操作、首次登录/secret migration 自动化、自动升级/跨账号迁移、V4 热切换移植或多个完整 GUI。

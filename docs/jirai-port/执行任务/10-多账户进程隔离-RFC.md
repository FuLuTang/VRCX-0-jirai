# 10：多账户进程隔离 RFC

## 目标
不实现多账户产品；写出并验证“manager GUI + 每账号独立 worker 进程 + 独立 `--data-dir` + 本地认证 IPC”的可维护设计。目标是最大限度保持上游 VRCX-0 单会话 runtime 不变。

## 依赖与边界
无功能依赖，可与所有任务并行；仅调研/原型，不进主功能。绝不移植旧 V4 的全局 Store/DB prefix 热切换。

## 原始代码绝对路径

- `/home/fulutang/Documents/Github/VRCX-jirai/src/services/accountHub.js`
- `/home/fulutang/Documents/Github/VRCX-jirai/src/services/accountSession.js`
- `/home/fulutang/Documents/Github/VRCX-jirai/src/services/aggregatedView.js`
- `/home/fulutang/Documents/Github/VRCX-jirai/docs/MULTI_ACCOUNT_V4_DETAIL_DESIGN.md`
- `/home/fulutang/Documents/Github/VRCX-0-jirai/src-tauri/src/single_instance_gate.rs`
- `/home/fulutang/Documents/Github/VRCX-0-jirai/crates/platform/src/app_paths.rs`
- `/home/fulutang/Documents/Github/VRCX-0-jirai/crates/composition/src/state/runtime_host_state.rs`

## 旧代码可复用分析
旧 `accountHub.js`、`accountSession.js`、`aggregatedView.js` 仅可借鉴需求：每账号隔离、聚合来源标识、操作路由；其 `dbVars` 热切换、secondary HttpClient 与手拼 UNION 不可抄。当前 `--data-dir`、per-profile `runtime.lock` 是 process isolation 可复用基础；Windows mutex 与 single-instance gate 是必须研究的阻碍。

## 子代理引导
“只做 read-only RFC。对比：A 单进程 Rust session factory，B 多完整 GUI+data-dir，C manager+headless worker+IPC。给出凭据、数据库、WS、OS 集成、聚合、升级、崩溃恢复、上游冲突面及分期。提出 C 的 IPC 消息草案；不改代码。”

## 检查标准
- 说明为何 `venv` 不适用；
- 每条路线有安全/维护/聚合/跨平台取舍；
- 推荐路线有 account dir、worker 生命周期、manager 所有 OS 能力、secret 不进 IPC 的方案；
- 明确 MVP 验证用例：两号同时登录、独立 WS、退出/重启、无重复托盘/通知。
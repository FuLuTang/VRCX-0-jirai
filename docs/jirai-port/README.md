# jirai-port 文档索引

本目录保存 VRCX-0 的 Jirai 移植分支的规划、参考与记录文档。每份文档后的括号标注其状态：现行 / 参考 / 计划 / 记录。

## 根目录

- [待手测清单.md](待手测清单.md) —— GUI 手测清单，P0 部分已在 pc114514 上完成，只剩 P1 的 GUI 手测需要人来做（现行）。
- [旧版功能清单.md](旧版功能清单.md) —— 旧版 Electron/Vue 仓库中 Jirai 自有行为的盘点与对照（用户在维护）。
- [jirai-feature-backlog.md](jirai-feature-backlog.md) —— VRCX-0-jirai 相对 VRCX-jirai 缺失或有差异的功能清单与验收状态，后续功能状态的主清单（现行）。
- [多账户进程隔离-RFC.md](多账户进程隔离-RFC.md) —— 多账户进程隔离的设计 RFC，结论为主对话已审查、仅 RFC 不实现多账户产品（暂缓）。
- [workflowUI示意图.png](workflowUI示意图.png) —— 增强型信息抓取面板（workflowUI）的设计图。
- [09-半成品存档/](09-半成品存档/) —— 关系推荐的半成品代码（09-modified.diff 与 untracked 下的 Rust/前端源码），尚未接入（参考）。

## 参考/

- [参考/VRCX-JIRAI新增功能图谱.md](参考/VRCX-JIRAI新增功能图谱.md) —— 统计 VRCX-jirai 相对上游 VRCX 的新增功能（17 个条目），v3 接手复审版（参考）。
- [参考/VRCX-JIRAI功能锚点与VRCX-0语义映射.md](参考/VRCX-JIRAI功能锚点与VRCX-0语义映射.md) —— 为上述 17 个条目逐项定位根入口点、建立基础，并在 VRCX-0-jirai 源码中找出同类语义（参考）。
- [参考/VRCX-0-jirai 功能板块完成度清单.md](参考/VRCX-0-jirai%20功能板块完成度清单.md) —— 对 17 个功能板块逐项判定在 VRCX-0-jirai 中的完成度，v2 接手复审版（参考）。

## 计划/Rust重写路线/

本目录是一组 Rust 重写计划：README.md 给出开发路径、工作包与决策记录，完善计划.md 是可执行的完善计划（2026-11-18T17:21Z 起停止更新，现行版在 MIMI 施工分支），闭环断言.md 是 5 个功能的 59 条断言（独立复核后定稿），冻结清单.txt 列出已完成功能涉及的 108 个文件（计划）。

## 同步记录/

- [同步记录/上游同步-2026-11.md](同步记录/上游同步-2026-11.md) —— 第一次上游同步（sync/upstream-2026-11，上游固定 694560dd7）的记录（记录）。
- [同步记录/上游同步-2026-11b.md](同步记录/上游同步-2026-11b.md) —— 第二次上游同步（sync/upstream-2026-11b，上游固定 174054c5b）的记录（记录）。

---

本地/ 目录存放个人机器与环境记录，不入库。

## 已删除的文档

> 参考/、计划/ 里提到的 `JIRAI_移植说明.md`、`docs/jirai-port/执行任务/`、`后续迁移计划.md`、`评审结论与迭代计划.md` 以及 `docs/jirai-port/reports/` 下的复杂功能报告已于 2026-11-27 删除，原文可用 `git show e6143d256:<路径>` 查看。`总执行规划.md`（自述为历史规划）、`2026-10-13-实机验收与修复队列.md`、`三条功能链路还原记录.md` 于 2026-11-28 合并进 main 时删除，原文可用 `git show ea3142a47:docs/jirai-port/<文件名>` 查看。`reports/` 下带时间戳的过程报告（例如 `reports/2026-11-16T2308Z-merge/`、`reports/2026-11-18T0040Z-pc-vs-github-jirai-audit/`、`reports/2026-11-18T1721Z-storage-env-audit/`、`reports/2026-11-20T1845Z-mimi-revert/`）没有并入本目录，原文在 MIMI 分支的历史里，可用 `git show 855f9e06f:<路径>` 查看。

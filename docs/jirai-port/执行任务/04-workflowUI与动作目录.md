# 04：同步 workflow UI 与动作目录

## 目标
实现与 `workflowUI示意图.png` 一致的通用同步任务列表：完成、跳过、错误、进行中、未开始及“进度/完成/错误/进行中”汇总。先接入一个动作（05 启动 Online 补线）；其余动作按依赖显示并自动跳过。

## 依赖与边界
依赖 01 的来源审计；不在本任务实现非好友表、推荐算法或资料抓取。必须是可取消、可重入安全的当前账户 workflow，不复刻旧 Vue reactive 全局对象。

## 原始代码绝对路径

- `/home/fulutang/Documents/Github/VRCX-0-jirai/docs/jirai-port/workflowUI示意图.png`
- `/home/fulutang/Documents/Github/VRCX-jirai/src/coordinators/infoFetchCoordinator.js`
- `/home/fulutang/Documents/Github/VRCX-jirai/src/views/Tools/dialogs/ProfileCompletionDialog.vue`
- `/home/fulutang/Documents/Github/VRCX-jirai/src/components/StatusBar.vue`

## 旧代码可复用分析
旧 `infoFetchCoordinator.js:10-19,86-196` 提供状态、计数、取消和串行循环；`ProfileCompletionDialog.vue:11-104` 提供两阶段进度呈现；`StatusBar.vue:322-353,746-758` 提供状态栏同步指示器。可复用的是状态枚举、进度/取消语义和“完成后进入下一步”；UI 外观以 `workflowUI示意图.png` 为优先参考。

## 子代理引导
“先建立无业务耦合的 task-runner 类型（id、label、状态、skip reason、run、cancel），以及 React dialog/list。只把 05 接进 runner；其他任务必须有稳定 ID 和明确 skip reason。不得在 UI 里直接写 SQL/调用 VRChat。”

## 检查标准
- 全部状态图标和汇总数字正确；
- 取消只影响当前运行任务，后续标为跳过；
- 连续两次运行不会共享旧状态；
- 未实现项显示跳过原因，不显示假进度；
- 无障碍文本可识别。
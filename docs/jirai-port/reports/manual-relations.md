# 调查：手动关系声明和图覆盖层

## 旧版行为

旧版 Jirai 将规范化配对存储在
`{prefix}_manual_relations_MANUEL` 中，通过
`ManualRelationsDialog.vue` 编辑，并在互惠好友图中渲染绿色边。相关实现位于
`src/services/database/manualRelations.js` 和
`src/stores/manualRelations.js`；图集成出现在
`MutualFriends.vue` 中。

## 当前适配性

当前 VRCX-0 将获取的互惠图快照持久化到
`{prefix}_mutual_graph_*` 表，并从
`src/features/charts/mutual-friends/` 渲染。这些记录是观测到的 VRChat 数据。
手动声明必须是单独的覆盖层，绝不能修改观测图快照，或让推断出的关系看起来具有权威性。

## 拟议迁移设计

- 创建所有者范围的手动边领域，包含规范化排序配对、关系类型、可选用户备注、创建/更新时间和专用架构版本。
- 通过类型化 Tauri 命令/仓库暴露 CRUD，并向图页面返回覆盖层模型。在渲染时合并，配以明确图例和可访问性标签，而不是向互惠图表写入行。
- 在 Rust 中强制用户 ID 非空、不同且顺序稳定。定义用户不再是好友或缓存数据缺失时的行为。
- 与其他所有者数据一并提供删除和导出/备份语义。

## 风险与测试

架构所有权、配对唯一性、账户切换、删除、过时标签以及与 VRChat 互惠边的意外混淆是主要风险。在 Rust 中测试规范配对 CRUD 和所有者隔离；在绑定层进行契约测试；并测试 React 图覆盖层、图例、无数据和删除。

## 建议

**在面向用户的数据模型决策后再调查；当前不要实现。**

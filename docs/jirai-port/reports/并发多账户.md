# 调查：并发多账户 V4

## 旧版行为

旧版 V4 草案使用 `accountHub`、`AccountSession` 和聚合视图，运行一个主 HTTP/WebSocket 会话以及多个次级会话。它存储独立的表前缀，合并 Feed/friends，并为每个账户视图热切换全局存储。证据包括：旧版提交 `733dab99`、
`docs/MULTI_ACCOUNT_V4_DETAIL_DESIGN.md`、`accountHub.js`、
`accountSession.js` 和 `aggregatedView.js`。

## 当前适配性与阻碍

当前 VRCX-0 支持已保存账户切换，但不支持并发会话。其 Rust auth/runtime 有意只设置一个已认证的活动所有者，并对账户切换生命周期进行保护。已保存凭据加密和活动 realtime 服务与复制旧版 Electron/.NET 次级客户端或 Vue global-store 热切换方案不兼容。旧版聚合代码还包含接口不匹配，因此不能作为安全的规范。

## 从零设计 RFC 的要求

- 明确的多会话运行时所有权：每个账户拥有一个隔离的 auth cookie/client、realtime connection、cancellation tree、scheduler 以及有上限的资源预算。
- 每个聚合行都标注数据所有权和来源；后台会话之间不得共享可变的全局 active-owner context。
- 用于合并 Feed/friends/notifications 的查询模型，保留账户来源，并将操作路由到所属的已认证会话。
- 注销、令牌过期、重新连接、重复账户、崩溃恢复、加密凭据处理以及 telemetry/privacy 行为。
- 有意制定受支持页面矩阵；不支持的视图不得悄然使用错误的所有者。

## 测试策略

先构建一个虚假的多会话运行时。测试凭据/cookie 隔离、事件路由、取消、合并查询的排序/去重、操作路由、账户移除、并发数据库访问以及活动视图变更。只有完成这些之后，才应考虑真实的 VRChat 集成。

## 建议

**仅编写架构 RFC。不要移植旧版热切换，也不要开始实现。**

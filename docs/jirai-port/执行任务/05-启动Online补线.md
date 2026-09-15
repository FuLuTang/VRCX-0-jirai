# 05：启动 Online 补线

## 目标
在启动/好友初始化 workflow 中：若好友当前在线，且该用户最近 Online/Offline 记录为 Offline 或不存在，则以当前时刻写入一条 Online。只补 Online，绝不因当前离线补 Offline，也不回填历史时刻。

## 依赖与边界
依赖 04；仅处理好友，06 完成后才扩展至 tracked nonfriends。记录作为普通 Feed 历史参与统计，不实现 Previous Instances 的手动假实例记录。

## 旧代码可复用分析
旧 `friendSyncCoordinator.js:20-33,39-80` 在初始化和每小时好友刷新后调用 `runSilentInfoFetch()`；旧在线写入的形状在 `friendPresenceCoordinator.js`，以及 `userCoordinator.js:302-317`。直接复用决策顺序：先拿当前好友投影、查询最后 online/offline，再写 Online；不能复制 Vue coordinator。

## 子代理引导
“使用当前 Rust/typed repository 路径实现原子‘last state then conditional insert’，避免前端竞态。时间只取 now；以 owner scope 查询。先为一批好友设计去重（同次启动/同一用户一次），再接到 04 workflow。”

## 检查标准
- last Offline/无记录 + online => 一条 Online；
- last Online + online => 无写入；
- current offline => 无写入；
- 同批重复调用 => 一条；
- 记录 owner/user ID、时间和 Feed 查询可见；
- Activity/Overlap 仅从补线时刻开始累计。
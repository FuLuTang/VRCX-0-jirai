# VRCX-0-jirai 清洁移植

此分支基于 `vrcx` 提交 `bd63532d4`（v2.28），而不是重放历史上的
`vrcx-0-jirai` 提交。旧的 `vrcx-jirai` 仓库仍作为只读实现参考。后续工作依据
有证据支持的清单：仅可针对当前 VRCX-0 重新实现选定的低风险功能，而复杂的仅旧版功能需要
先进行单独调查并作出迁移决策。参见
`docs/jirai-port/legacy-feature-inventory.md` 和
`docs/jirai-port/migration-plan.md`。

## 兼容性规则

- 保留 `com.vrcx-0.app` 包标识符、`vrcx-0` 深层链接方案、
  偏好设置键和数据目录名称。应用名称更改后，现有本地数据仍必须
  可被发现。
- 复用当前 `vrcx` Feed 查询 API 及其当前用户范围。不要
  恢复之前的自定义 Feed Rust 命令，也不要添加 Jirai 数据库
  迁移。
- 针对当前 `vrcx` 组件和路由重新实现面向用户的功能。不要复制
  已删除的注册表或旧架构中的中间层。

## 移植范围

1. VRCX-0-jirai 品牌和取自 `vrcx-jirai` 的图标集。
2. 现有用户对话框中的用户 Bio 历史差异。
3. 两人关系历史。
4. 关系时间线，保留原始 `vrcx-0-jirai` 的每桶
   Top-N 百分比算法和控件。

## 发布前所需的发布设置

更新器端点指向 `FuLuTang/VRCX-0-jirai`，因此此构建不会
静默更新到 `vrcx`。在发布首个启用更新器的版本前，生成专用的 Tauri 更新器
签名密钥，并替换 `src-tauri/tauri.conf.json` 中的
`plugins.updater.pubkey` 值；继承的公钥仅信任由 `vrcx` 签名的发布
构件。

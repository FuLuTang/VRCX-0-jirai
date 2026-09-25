<div align="center">

# <img src="images/VRCX-0.png" alt="VRCX-0 Logo" width="25"> VRCX-0

### 更快、更轻的 VRCX。

[English](README.md) | [Français](README.fr-FR.md) | 简体中文 | [繁體中文](README.zh-Hant.md) | [日本語](README.ja-JP.md) | [한국어](README.ko-KR.md)

[![Release](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/Map1en/VRCX-0/badge-data/version.json&style=flat&color=4c566a&labelColor=1f2328&logo=github&logoColor=white)](https://github.com/Map1en/VRCX-0/releases/latest)
[![Downloads](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/Map1en/VRCX-0/badge-data/downloads.json&style=flat&color=4c566a&labelColor=1f2328)](https://github.com/Map1en/VRCX-0/releases)
[![Windows installer size](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/Map1en/VRCX-0/badge-data/windows-installer-size.json&style=flat&label=installer&color=4c566a&labelColor=1f2328&logo=data%3Aimage%2Fsvg%2Bxml%3Bbase64%2CPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2ZmZiI%2BPHBhdGggZD0iTTIuNCAyLjRoOC41djguNUgyLjR6TTEzLjEgMi40SDIxLjZ2OC41aC04LjV6TTIuNCAxMy4xaDguNVYyMS42SDIuNHpNMTMuMSAxMy4xSDIxLjZWMjEuNmgtOC41eiIvPjwvc3ZnPg%3D%3D)](https://github.com/Map1en/VRCX-0/releases/latest)
[![Discord](https://img.shields.io/discord/1494343220467994644?style=flat&logo=discord&logoColor=white&label=discord&color=5865f2&labelColor=1f2328)](https://discord.gg/fehKP3SVPN)
<br>
[![CI](https://img.shields.io/github/actions/workflow/status/Map1en/VRCX-0/ci.yml?branch=master&label=ci&style=flat&labelColor=1f2328)](https://github.com/Map1en/VRCX-0/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/Map1en/VRCX-0/badge-data/coverage.json&style=flat&color=4c566a&labelColor=1f2328)](https://github.com/Map1en/VRCX-0/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-GPL--3.0-4c566a?style=flat&labelColor=1f2328)](LICENSE)

[![Download](https://img.shields.io/badge/Download%20VRCX--0-4340a2?style=for-the-badge)](https://github.com/Map1en/VRCX-0/releases/latest)

Windows · macOS · Linux

![VRCX-0](images/screenshot-user-dialog.webp)

</div>

VRChat 桌面辅助工具：查看好友在线状态和所在位置、记录遇到过的人和去过的世界、管理收藏等。

VRCX-0 是 VRCX 的完全重写版本，由 VRCX 前维护者之一开发。基于 Rust 重建，更快、更轻，多年积累的数据依然流畅。

## 主要特点

- **多年记录依然流畅** — VRCX 明显变卡的数据量，VRCX-0 依然流畅；低配电脑、NAS 级小主机也能运行
- **内存占用比 VRCX 低约 50%–70%**
- **后台模式仅需几十 MB 内存**，核心功能照常运行
- **比一个模型包还小** — 下载 10 多 MB，安装后 30 多 MB，不到 VRCX 的十分之一
- **无缝迁移** — 自动导入 VRCX 数据库和设置，不改动 VRCX 原有数据库，随时可以切换回去

### VRCX-0 独有

- **AI 助手** — 洞察你的 VRChat 社交：常和谁一起玩、和谁渐行渐远、何时最容易遇到好友；接入你常用的 AI 服务即可使用
- **侧栏模式** — 以窄侧栏随时关注好友动态；Windows、macOS 支持贴边自动隐藏
- **快捷键** — 常用操作无需鼠标；Windows 支持全局热键
- **锁定** — 密码锁定界面，保护你的隐私
- **分享** — 世界合集、世界、模型、实例均可生成分享链接

### 进阶

- **MCP 服务器** — 让外部 AI 工具直接使用你的本地社交数据
- **集成 API** — 为第三方应用提供游戏内实时数据
- **无头模式（Headless）** — 无界面运行，详见 `crates/headless`

### 与 VRCX 的对比

| 功能           | VRCX                                           | VRCX-0（+ 为新增）                                  |
| -------------- | ---------------------------------------------- | --------------------------------------------------- |
| **社交自动化** | 按是否独处切换状态；自动回复邀请请求           | + 定时规则、多条情境规则与优先级、结束后恢复原状态  |
| **通知**       | 桌面、语音、XSOverlay、OVR Toolkit、腕部悬浮层 | + Discord Webhook、勿扰模式；所有通道按事件独立筛选 |
| **VR 悬浮层**  | 浏览器渲染（100 MB+）；OpenVR                  | + 原生渲染（几十 MB）；OpenXR（**WiVRn 实测通过**） |
| 截图           | 查看和搜索元数据                               | + 网格视图、批量管理、ZIP 导出                      |
| 模型详情       | 性能等级、文件大小                             | + 完整性能指标，对照各平台上限                      |
| 备份           | VRChat 注册表设置                              | + 数据库定时备份、一键恢复                          |
| 好友位置       | 按同一实例分组                                 | + 世界视图                                          |
| 群组管理       | 逐个设置可见性                                 | + 批量退出、批量设置可见性；玩家列表显示群组角色    |
| 主题           | 内置主题、自定义 CSS 文件                      | + 社区主题、背景图片、应用内 CSS 编辑、强调色       |
| 游戏日志       | 多账号记录混合                                 | 按账号分开存储                                      |

VRCX 的其他功能，VRCX-0 同样具备。

## VRCX-jirai 功能还原核对表

VRCX-0-jirai 正在逐步还原并重写旧版 VRCX-jirai 的部分功能。**还原工作尚未完成。**旧版 README 本身已说明 VRCX-jirai 停止维护；本清单反映当前代码，不代表功能已完全一致，也不承诺恢复旧版的每种行为。盘点范围还包括旧仓库中 FuLuTang 的功能提交（截至 `c8b8f744`），不只依据 README 的功能清单。

状态标签：**【已还原/已重写】**、**【部分实现】**、**【未实现/缺失】**、**【行为或 UI 有出入】**、**【待核实】**。状态依据当前 VRCX-0-jirai 代码，不代表与 VRCX-jirai 完全一致。

### 核心功能

| VRCX-jirai README 项目 | VRCX-0-jirai 当前状态与证据 |
| --- | --- |
| 双人共同实例历史 | **【部分实现】**可选两位当前好友，查找有记录的共同实例、识别三分钟内进入、判断自己的记录是否重叠，并打开实例房主。旧 README 提到的房间最高人数目前没有显示。**【行为或 UI 有出入】**FuLuTang 在 `929db097` 加入了本地快照/非好友保护：对观测数据只是快照、无法证明先后邀请关系时显示为未知，而不是断言双方约好进房；当前实现会把三分钟内进入直接标为共同进入，未见这层保护。证据：`src/features/charts/TwoPersonRelationshipPageImpl.tsx` 的 initiator 计算。 |
| 共同好友关系网 | **【部分实现】**图谱可读取 `_mutual_graph_links_old` 旧边并以历史关系显示；现在也支持按账号归属保存追踪的非好友节点和手动好友关系，并提供管理操作。API 抓取、手动添加、旧数据关系边使用不同视觉样式。手动关系目前只有 `friend` 一种类型；图谱里追踪非好友尚不会进入 Bio/状态 Feed 采集。证据：`src/features/charts/MutualFriendsPageImpl.tsx`、`useMutualFriendsPageState.ts`、`MutualFriendsRelationsManager.tsx`、`crates/persistence/src/mutual_graph.rs`、`src-tauri/src/commands/local/mutual_graph.rs`。 |
| Bio Diff | **【已还原/已重写】**Git 风格逐行差异和历史切换仍融合在原有个人资料 Bio 面板。相邻间隔不超过 24 小时的连续修改会合并成一组，以组内第一条旧 Bio 和最新 Bio 计算差异；历史按组选择，而不是每次修改单独显示。证据：`src/components/dialogs/user-dialog/components/UserDialogInfoTab.tsx`、`src/components/dialogs/user-dialog/bioHistory.ts`、`crates/application/src/social/profile_bio/mod.rs`。 |
| “或许是好友”关系推测 | **【未实现/缺失】**FuLuTang 的 `392365f0`、`929db097`、`a95836c3`、`c4f1a461` 加入了本地共同出现评分/关系推荐、建议对象在同一房间出现时的确认或忽略提示，以及在历史实例面板为指定用户插入一组伪造的进出记录。当前共同出现统计只是展示观测到的同行者，不会推断好友关系、弹出确认，也不会插入伪造游戏日志。 |
| 关系时间轴 | **【已还原/已重写】**会话和分时间区间排名算法已基于保存的 GPS/离线 Feed 重建，并支持“其他用户”、仅看当前好友和缩放。**【行为或 UI 有出入】**用户补充的旧行为是：停止拖动滑条一秒后再执行数据库查询。当前的一秒延迟只推迟前端图表重算；数据库历史只在加载/手动刷新时查询一次。历史范围受已记录数据限制。算法测试不能证明完整的视觉效果一致。证据：`src/features/charts/relationshipHistory.ts`、相关测试、`src/features/charts/RelationshipTimelinePageImpl.tsx`。 |
| 仅统计在线时长的灯色分布图 | **【未实现/缺失】**FuLuTang 在 `137abf6f`、`cf942bd0` 实现了按真实时长统计、排除离线时间，并加入自己的状态追踪。当前 VRCX-0-jirai 未找到等价的个人/好友灯色占比图，也没有灯色与在线区间求交的算法。 |
| Feed 中追踪非好友 | **【未实现/缺失】**FuLuTang 在 `7009ebae`、`94f8e872` 把追踪和 Bio/状态同步扩展到非好友；旧界面支持直接输入 UID 或从资料页添加。VRCX-0-jirai 现在支持为关系网追踪非好友节点，但 Bio 扫描和 Feed 采集仍仅针对当前好友；这不等同于旧版非好友 Bio/状态历史流程。证据：`crates/application/src/social/profile_bio/mod.rs`、`src/features/charts/MutualFriendsRelationsManager.tsx`、`crates/persistence/src/mutual_graph.rs`。 |
| 多账号登录与合并视图 | **【未实现/缺失】**已有按账号归属存储的游戏日志，但没有旧版同时登录主/次账号、逐账号切换和合并视图的实现。 |

旧 README 将 **自动跟随** 标为未实现且不再计划，因此不计入必须迁移的缺口。不过提交历史更复杂：`4a38a56f` 曾实现该功能，之后 `3a5c269e` 隐藏了入口。历史上曾有实现，不改变旧 README 明确写明的“不再计划”状态。

### 其他增强与行为

| VRCX-jirai README 项目 | VRCX-0-jirai 当前状态与证据 |
| --- | --- |
| 快捷搜索：最近遇见的人/世界、非好友模糊匹配、即时检索、Bio/历史检索 | **【行为或 UI 有出入】**FuLuTang 的 `30c2f208`、`bda7ddad`、`a94824c2`、`1dc272ce` 加入最近遇见的人/世界、单字符与快捷键行为、历史 Bio 匹配和查询清理。当前会 trim 查询并支持单字符检索，但最近列表是最近打开的五个实体，不是最近遇见的人/最近加入的世界；快捷搜索搜好友姓名/备注/Memo，未找到近期非好友共处或历史 Bio 检索。独立搜索页的 Bio 搜索走当前 VRChat 接口。证据：`src/components/sidebar/quick-search/quickSearchHistory.ts`、`quickSearchResultModel.ts`、`crates/application/src/social/quick_search_catalog.rs`、`src/features/search/searchRequests.ts`。 |
| 为 Bio Diff 存档所有好友 Bio | **【部分实现】**有可选的后台扫描器，逐步扫描过期的当前好友 Bio（新鲜度阈值 12 小时），不是旧版的一次性全好友批量存档。证据：`crates/application/src/social/profile_bio/mod.rs`、`crates/composition/src/state/background_ticks/profile_bio.rs`。 |
| 自己的位置、头像、状态及上下线历史 | **【部分实现】**当前用户游戏位置、头像历史、状态/Bio 变化均有持久化路径；但未找到把这些记录完整呈现在一个个人历史界面的实现。证据：`crates/application-realtime/src/realtime/current_user/`、`crates/persistence/src/realtime/schema.rs`、`crates/persistence/src/game_log/`。 |
| 启动/重连时全量补全 | **【行为或 UI 有出入】**启动和重连会同步当前好友/资料快照，并能记录新观察到的变化；但这不能证明应用离线期间错过的每条事件都会补回。旧 README 所称的完整历史补抓尚未复现。证据：`crates/application-realtime/src/realtime/service/host/baseline.rs`。 |
| 重启后恢复好友房间停留计时 | **【待核实】**VRCX-0 有从游戏日志推导计时的路径和单元测试，但没有端到端测试证明应用重启后运行中的 UI 能恢复原始进入时间。证据：`crates/application-core/src/instance_dwell.rs`、`crates/application-game/src/game_log/processor.rs`。 |
| 从历史实例添加伪造的同行记录 | **【未实现/缺失】**FuLuTang 的 `c4f1a461` 在历史实例详情中加入操作：把选定用户的五秒进出记录插入当前实例在本地记录的进入时间。VRCX-0-jirai 未找到手动/伪造游戏日志记录的等价入口。 |
| 从 Feed 拖动文件到 Gallery 分类上传 | **【未实现/缺失】**`055c55b5`、`de063998` 加入了多区域拖放提示，可从 Friend Feed 将文件投放到 Gallery 对应资源分类。VRCX-0-jirai 的 Screenshot Metadata 页面可拖入截图，但不是 Feed 到 Gallery 分类上传流程。证据：`src/features/tools/ScreenshotMetadataPage.tsx`。 |
| 状态抓取进度指示器 | **【部分实现】**FuLuTang 的 `0c2f6361` 为资料/隐私状态同步加入状态栏进度指示。VRCX-0-jirai 状态栏已有好友资料批量加载和关系图抓取进度，但没有复现旧版启动/重连时 Bio+隐私状态刷新整套流程。证据：`src/components/layout/status-bar/StatusBarFooter.tsx`、`src/components/layout/AppStatusBar.tsx`、`crates/application-realtime/src/realtime/service/host/baseline.rs`。 |
| 持续同步 VRCX 更新 | **【行为或 UI 有出入】**当前分支有明确合入 VRCX-0 v2.29、v2.30 及当前 master 的提交；未来更新仍需手动迁移，不会自动同步。证据：合并提交 `ac016078`、`d97b115e`、`0d566dac`。 |
| 新功能未显示时“恢复默认导航”提示 | **【行为或 UI 有出入】**VRCX-0 仍保留自定义导航里的“恢复默认”操作，关系页面则通过 route/dashboard 注册机制加入；尚未实测恢复默认后所有已保存的导航布局是否都会显示这些页面。证据：`src/components/layout/CustomNavDialog.tsx`、`src/app/routes.tsx`、dashboard registry。 |
| 开发者数据库结构/刷新文档 | **【行为或 UI 有出入】**当前仓库有共同好友关系网的 schema 图 `docs/mutual-graph-schema.svg`；旧 README 中通用的 `DATABASE_SCHEMA.md` 与 `DATA_REFRESH.md` 暂无直接对应文档。 |

### 旧版限制与副作用

| 旧 README 说明 | VRCX-0-jirai 当前状态 |
| --- | --- |
| 自动加入 VRCX-jirai Home Group，让被追踪者知情 | **【未实现/缺失】**未找到启动/认证时自动加入 Home Group 的流程；当前加入群组是明确的用户操作。证据：`src/components/dialogs/group-dialog/GroupDialogHeaderSection.tsx`。 |
| 黄灯/红灯会导致核心功能失效 | **【待核实】**当前数据仍受 VRChat 可见性/API 限制，但尚未逐一验证旧版所说的“黄灯/红灯会使核心功能失效”是否在这些还原页面中完全相同。私密或被脱敏的位置按不可用数据处理，不会推断。证据：`crates/mcp/src/tools/feed.rs`。 |
| 收集的信息均公开、不会获取无法访问的信息 | **【待核实】**不沿用旧版这项宽泛保证：VRCX-0-jirai 使用登录态 VRChat 接口和本机观察到的游戏日志，各数据入口有各自的可见性限制；旧免责声明不能作为当前数据范围的证明。 |

旧 README 中关于上游反对意见及社区态度的文字属于历史背景，不是软件功能，因此没有照搬。

## 安装

在 [最新 Release](https://github.com/Map1en/VRCX-0/releases/latest) 里下载对应平台的文件：

| 平台                | 文件                                       |
| ------------------- | ------------------------------------------ |
| Windows             | `VRCX-0_<版本号>_windows_x86_64_setup.exe` |
| macOS（Apple 芯片） | `VRCX-0_<版本号>_macos_aarch64.dmg`        |
| macOS（Intel）      | `VRCX-0_<版本号>_macos_x86_64.dmg`         |
| Linux               | `.AppImage`、`.deb` 或 `.rpm`              |

macOS 首次启动如被系统拦截，请前往 **系统设置 → 隐私与安全性**，点击 **仍要打开**。

### Linux

软件界面的硬件加速默认关闭，可在 **设置 → 系统 → 硬件加速（实验性）** 中开启；若界面显示异常，VRCX-0 会自动关闭硬件加速。自行设置 `WEBKIT_DISABLE_DMABUF_RENDERER` 时不显示此选项。

## 反馈与交流

- 交流与提问：[Discord](https://discord.gg/fehKP3SVPN)
- 问题反馈与功能建议：[GitHub Issues](https://github.com/Map1en/VRCX-0/issues)

## 从源码构建

以下步骤适用于参与开发或在本地自行构建 VRCX-0。参与贡献前，请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。

依赖：Node.js ≥ 24.10、npm ≥ 11.5，以及通过 rustup 安装的稳定版 Rust 工具链。
Windows 用户还需安装 **Visual Studio Build Tools**，并勾选 **"使用 C++ 的桌面开发"**。若使用普通 PowerShell，先加载 VS 编译环境：

```powershell
$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$vsPath = & $vswhere -latest -products Microsoft.VisualStudio.Product.BuildTools -version '[17.0,18.0)' -property installationPath
& "$vsPath\Common7\Tools\Launch-VsDevShell.ps1" -Arch amd64 -HostArch amd64
```

然后运行 `npm run tauri:dev`。

```bash
git clone https://github.com/Map1en/VRCX-0
cd VRCX-0

npm install
```

启动开发服务器：

```bash
npm run tauri:dev
```

构建发布版（跳过签名和安装包）：

```bash
npm run tauri:build -- --no-sign --no-bundle
```

## 许可

VRCX-0 采用 GNU General Public License v3.0（GPLv3）授权。

[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2FMap1en%2FVRCX-0.svg?type=shield)](https://app.fossa.com/projects/git%2Bgithub.com%2FMap1en%2FVRCX-0?ref=badge_large)

VRCX-0 未获 VRChat Inc. 认可或背书。VRChat 及所有相关标识均为 VRChat Inc. 的商标或注册商标。

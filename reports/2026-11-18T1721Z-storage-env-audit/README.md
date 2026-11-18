# 动工前存储感知与开发环境迁移分析

| 项 | 值 |
| --- | --- |
| 时间戳 | `2026-11-18T17:21Z`（UTC） |
| 代码基线 | VRCX-0-jirai `ea3142a47`（冻结） |
| 施工分支 | **`MIMI`**，从 `ea3142a47` 新建；本机工作目录 `/home/fulutang/Documents/Github/VRCX-0-jirai-MIMI`（与 `VRCX-0-jirai` 共用 `.git` 的 worktree）。**只在 freeEgg 本地，未推送** |
| 性质 | 只读取证。仓库只做了「建分支 + 建 worktree + 复制分析文档」；pc114514 上只运行了读取类 PowerShell 探针（临时脚本已删），没有构建、没有删文件、没有改配置 |
| 取证方式 | pc114514：`Get-CimInstance`、`Get-ChildItem` 统计目录大小、`Get-Command`、`vswhere`、读 `vrcx-check.cmd` 与 `~/.cargo/config.toml`；仓库：`Cargo.toml`、`Cargo.lock`、`.cargo/config.toml`、`.github/`；历史文档与提交由只读子代理 `build-history` 检索（我抽验了 `.cargo/config.toml`、profile、feature、CI 矩阵四处） |

## 1. 结论

1. **磁盘是动工前唯一的硬阻塞。** pc114514 的 `C:` 只剩 **18 GB**，而 `vrcx-check.cmd` 的 `CARGO_TARGET_DIR`（`C:\Users\tangh\vrcx0-integrate-target`）在 11-16 一次合并验证（21:54–21:58 创建/最后写入）就长到了 **35.17 GB**。从零构建一轮装不下；复用这 35 GB 的增量缓存也可能在若干轮后撑满 `C:`。`D:` 有 143.5 GB 可用。
2. **内存不是问题。** pc114514 有 47.9 GB RAM（探针时空闲 17.2 GB），16 个逻辑处理器，页面文件 C: 5–10 GB、D: 5.6–45 GB。仓库历史与文档里**没有任何编译 OOM / 页面文件不足的记录**。没有实测峰值，见第 3 节。
3. **`vrcx-check.cmd` 与 MIMI 分支不兼容。** 脚本写死 `git fetch origin integrate/main-2026-11` + `reset --hard FETCH_HEAD`，只能验证那条分支；MIMI 又还没推送到 origin。施工前必须二选一：改脚本 / 加参数，或另写一个 MIMI 用的验证入口。两者都是对 pc 的写入，等你决定。
4. **迁移开发环境不需要 pc114514 独有的软件**，所需工具都可公开安装；但有 **4 处 pc 本地约定**必须在新机器上复刻（第 4 节）。另外，**#7 的真机验证**依赖装有 VRChat / SteamVR 的 Windows 机器，目前只有 pc114514。
5. **freeEgg 不适合跑 Rust 构建**：没有 cargo，磁盘只剩 23 GB（单个 target 目录就 35 GB），内存 11 GiB、无 swap、2 核 aarch64。前端检查（typecheck / vitest / oxlint）可以在 freeEgg 做，需先在 MIMI 目录装 `node_modules`（pc 上同仓库约 0.46 GB）。

## 2. 存储：实测占用（pc114514）

| 位置 | 大小 | 构成 | 时间 | 说明 |
| --- | --- | --- | --- | --- |
| `C:\Users\tangh\vrcx0-integrate-target` | **35.17 GB** | debug：incremental 21.33、deps 11.97、build 1.21 | 创建 11-16 21:54，最后写入 21:58 | `vrcx-check.cmd` 的 target；对应 worktree 已不存在，target 留着 |
| `…\GitHub\VRCX-0-jirai\target` | 17.54 GB | debug：deps 8.11、incremental 7.69、build 1.22 | 09-12 起，最后写入 11-15 | 日常 `tauri dev` 的 target，`vrcx-0.exe` 135 MB（11-18 09:20） |
| `…\GitHub\VRCX-0-jirai\target-novr` | 2.08 GB | debug | 11-15 08:39–08:43 | 名字推测为关闭 VR feature 的构建，**生成命令无出处** |
| `~\.cargo\registry` | 1.67 GB | crate 源码与压缩包 | — | |
| `~\.rustup\toolchains` | 1.57 GB | stable-x86_64-pc-windows-msvc（rustc 1.95.0） | — | 另装了 3 个 Android target，与本项目无关 |
| `…\VRCX-0-jirai\node_modules` | 0.46 GB | | | |
| `…\VRCX-0-jirai\.git` | 0.10 GB | | | |

磁盘余量：`C:` 已用 935 GB / **可用 18 GB**；`D:` 已用 1719.5 GB / **可用 143.5 GB**。freeEgg：`/` 96 GB，可用 23 GB。

**为什么这么大**：工作区 30 个本地 crate、`Cargo.lock` 1040 个包；依赖里有 skia（slint 的 skia 渲染器）、aws-lc、openvr_sys、webview2 等大型原生库。`[profile.dev]` 开着 `incremental = true`，incremental 目录占了 target 的 44–61%。`[profile.dev.package."*"] debug = false` 与 `debug = "line-tables-only"` 已经在压缩调试信息（`Cargo.toml:133-143`）。

**施工期的存储需求估算**（推算，不是实测）：MIMI 每个包要跑 `check --all-targets`、`test --workspace`、`backend_architecture`、bindings 导出，与 11-16 那次 35 GB 的会话同类。按 **单个 target 目录 35–45 GB** 预留，另加 node_modules 0.5 GB；若同时保留旧的两个 target，合计约 55–65 GB。**放在 `C:` 不够，放在 `D:` 够。**

**动工前要你决定的存储动作**（都是写入或删除，本轮没做）：

| 选项 | 释放/获得 | 代价 |
| --- | --- | --- |
| A. MIMI 的验证 target 放 `D:`（如 `D:\vrcx-mimi-target`） | 不占 `C:` | 首轮全量构建，时间未测；要改验证脚本的 `CARGO_TARGET_DIR` |
| B. 删 `C:\Users\tangh\vrcx0-integrate-target` | `C:` +35 GB | 那条验证线的增量缓存没了；对应 worktree 早已不存在 |
| C. 删 `…\VRCX-0-jirai\target`（11-15 后未再写入） | `C:` +17.5 GB | 日常 `tauri dev` 下次要全量重编 |
| D. 删 `target-novr` | `C:` +2 GB | 无出处的缓存，影响最小 |

我的推荐：**A，再视情况做 B**。不推荐在 `C:` 只剩 18 GB 的状态下直接开工。

## 3. 内存：现状与历史

| 项 | 值 | 出处 |
| --- | --- | --- |
| pc114514 RAM | 47.9 GB，探针时空闲 17.2 GB | `Win32_ComputerSystem` / `Win32_OperatingSystem` |
| CPU | AMD Ryzen 7 5700X3D，16 逻辑处理器 | `Win32_Processor` |
| 页面文件 | C: 初始 5000 / 最大 10000 MB；D: 5600 / 45000 MB | `Win32_PageFileSetting` |
| 并行度设置 | `CARGO_BUILD_JOBS`、`RUSTC_WRAPPER`、`CARGO_TARGET_DIR` 环境变量均未设；cargo 默认 16 并行 | 探针 |
| 历史 OOM / 页面文件问题 | **未找到**（提交与文档按 OOM、out of memory、pagefile、页面文件、内存 检索） | 子代理 `build-history` |
| 历史编译耗时 | `tauri:dev` 约 2 分钟；带 VR feature 的开发版 `cargo build` 33.04 s；`runtime-host-desktop` check 1m58s | `docs/jirai-port/2026-10-13-实机验收与修复队列.md:120`、提交 `d822ad9b0`、`工作区环境披露.md:138-141` |
| release profile | `lto = true`、`codegen-units = 1`、`opt-level = "s"`（`Cargo.toml:145-150`） | 单线程 LTO 链接，会比 debug 慢且吃内存；**施工验证只用 debug/test，不跑 release**，所以不构成风险 |

**判断**：施工期间只跑 check / test，48 GB 足够，无需调内存或限并行。峰值 RAM **没有实测**；若想要数字，下次跑验证时同时记录 `Get-Process cargo,rustc,lld-link` 的工作集即可（不需要额外工具）。freeEgg（11 GiB、无 swap、2 核）即使装了 Rust 也不建议跑全量构建。

## 4. 迁移开发环境：是否依赖 pc114514 独有的工具

### 4.1 构建依赖（全部可公开安装）

| 依赖 | 为什么需要 | pc114514 现状 | 新机器怎么获得 |
| --- | --- | --- | --- |
| Rust stable，`x86_64-pc-windows-msvc` | 全部 | rustc / cargo 1.95.0（`rustup` 管理；仓库无 `rust-toolchain` 文件） | rustup |
| MSVC 生成工具 + Windows SDK | msvc target、`cc` 编译的 C 代码、`embed-resource` | VS 2022 BuildTools 17.14、VS 2022 Community 17.11、VS 2026 Community 18.10；SDK 10.0.22000 / 22621 / 26100 | VS BuildTools「使用 C++ 的桌面开发」 |
| `lld-link.exe` | `.cargo/config.toml:4-5` 把 Windows MSVC 的链接器指定为 `lld-link.exe` | 在 PATH 上的是 `~\.cargo\bin\lld-link.exe`，与 rustup 自带的 `rust-lld.exe` **字节一致**（同大小、同 SHA256 前缀 `3CF499FC8A038537`），是**手工复制的**；VS BuildTools 的 `VC\Tools\Llvm\x64\bin\lld-link.exe` 也在，但不在 PATH | 复制 `rust-lld.exe` 为 `lld-link.exe`，或装 VS 的 Clang/LLVM 组件并进 Dev Shell |
| CMake | `openvr_sys`（默认 feature `steamvr-overlay`）的构建脚本 | **不在 PATH**；VS 自带的 cmake 在两个 VS 目录下；`vrcx-check.cmd` 第 3 行手工把 VS 2026 的 CMake 目录加进 PATH | VS 的 CMake 组件或独立 CMake；历史上缺 cmake 导致 `cargo check -p vrcx-0` 中断（`工作区环境披露.md:138-141`） |
| libclang | `bindgen`（`openvr_sys` 等） | 没设 `LIBCLANG_PATH`；VS 2022 BuildTools 带 `libclang.dll`。pc 已经构建成功过，但 bindgen 在这台机器上实际找的是哪个 libclang **没核实** | VS Clang 组件或 LLVM |
| Node 24 + npm（lockfile 用 npm） | 前端、`tauri` CLI、`oxfmt` | Node 24.15.0（nvm4w）；pnpm 11.22 也在但项目脚本用 npm | 任意 Node 24 |
| WebView2 Runtime | Tauri 运行 | 150.0.4078.99 | Windows 10/11 一般自带 |
| nasm / perl / protoc | — | **都没有**，而 pc 已构建成功过，说明当前依赖集不需要它们 | 不需要 |

CI 是旁证：`.github/workflows/ci.yml:149-198` 在 `windows-latest`、`ubuntu-24.04`、`macos-latest` 的标准 runner 上用默认 feature 构建 `src-tauri`；Linux 只额外装了 `clang`、`cmake`、`libclang-dev` 等（`.github/actions/setup-linux-tauri/action.yml`）。**项目本身不依赖任何私有工具。**

### 4.2 pc114514 的本地约定（迁移时必须复刻，否则会踩坑）

| # | 约定 | 不复刻的后果 |
| --- | --- | --- |
| 1 | `~\.cargo\bin\lld-link.exe`（rust-lld 的副本） | 不在 VS Dev Shell 里时链接失败——2026-10-13 就出过（`docs/jirai-port/2026-10-13-实机验收与修复队列.md:116-120`） |
| 2 | 构建前把 VS CMake 目录加进 PATH（`vrcx-check.cmd:3`） | `openvr_sys` 构建失败 |
| 3 | `~\.cargo\config.toml` 的代理 `http://127.0.0.1:7890` + `check-revoke = false` | **探针时 7890 端口没有监听**：现在在 pc 上下载新 crate 会失败，需临时 `--config http.proxy=""`（`reports/2026-11-16T2308Z-merge/README.md:69`）；新机器不要照抄代理 |
| 4 | `C:\Users\tangh\vrcx-check.cmd` 与它的 worktree / target 路径 | 计划里「`CARGO_EXIT` / `TEST_EXIT` / `ARCH_EXIT`」三项证据的格式来自这个脚本；换机器要把这三个命令（第 5 节）带过去 |

### 4.3 无法迁移的部分

- **#7 真机验证**：要在装有 VRChat（以及 SteamVR，用于 VR 分支）的 Windows 上运行。现在只有 pc114514 满足。mock 测试不受影响。
- freeEgg 是 aarch64 Linux：即使装 Rust，也构建不出 Windows 版；Linux 版还要 webkit2gtk 等系统库。

## 5. 施工期验证入口（建议，未实施）

`vrcx-check.cmd` 的三条命令本身可直接复用，只有分支和 target 路径要换：

```text
set CARGO_TARGET_DIR=D:\vrcx-mimi-target
git fetch origin MIMI && git reset --hard FETCH_HEAD
cargo check --workspace --all-targets --message-format short   → CARGO_EXIT
cargo test --no-fail-fast --workspace --exclude vrcx-0         → TEST_EXIT
cargo test -p vrcx-0 --test backend_architecture               → ARCH_EXIT
cargo run --manifest-path src-tauri/Cargo.toml --features bindings-export --bin export-bindings → BIND_EXIT
```

前提：MIMI 推送到 origin（你没授权前不推）。

## 6. 需要你决定

1. **存储**：MIMI 的验证 target 放 `D:`（推荐），以及是否删 `vrcx0-integrate-target`（35 GB）/ `target`（17.5 GB）/ `target-novr`（2 GB）。
2. **验证脚本**：改 `vrcx-check.cmd` 支持分支与 target 参数，还是新写一个 MIMI 专用脚本（推荐新写，旧脚本留给 `integrate/main-2026-11`）。
3. **推送 MIMI 到 origin**：pc 要验证就必须推；推送会在 GitHub 新增一个分支。
4. **代理**：施工时 7890 是否会开着；不开就统一用 `--config http.proxy=""`。

## 7. 边界

- 存储大小来自目录文件求和，不是 `cargo` 自报；「35–45 GB / 轮」是从一次会话外推的，不同包的增量会不同。
- 内存峰值、全量构建耗时都**没有测**；本轮按你的要求只读，没跑任何构建。
- `target-novr` 的生成方式、bindgen 在 pc 上实际使用的 libclang、3 个 `build.rs`（`src-tauri`、`crates/i18n`、`crates/application-activity/src/activity_page`）是否调用外部工具，均未核实。
- 历史文档检索由子代理完成，我抽验了 4 处；未入库的本地文档（如《工作区环境披露.md》）不是提交历史，只能作为旁证。

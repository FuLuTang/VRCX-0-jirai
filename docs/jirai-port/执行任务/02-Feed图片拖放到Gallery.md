# 02：Feed 图片拖放到 Gallery

## 目标
在当前 Feed 页面拖入单个图片时展示旧 Jirai 的五个目标区（Gallery、Icons、Emojis、Stickers、Prints）；将文件**投放**到命中的目标区后跳转当前 Gallery，并把文件与目标 tab 交给现有裁剪/上传流程。旧实现只有投放命中，不额外新增“先保存文件、再点击目标”的状态机。

## 依赖与边界
无数据模型或 Rust 改动。必须复用当前 `src/features/tools/GalleryPage.tsx`、`useGalleryPageController.ts`、`useGalleryAssetActions.ts` 和 `vrchatMediaRepository.ts`；不得复制旧 Vue 上传 API。

## 原始代码绝对路径

- `/home/fulutang/Documents/Github/VRCX-jirai/src/views/Feed/Feed.vue`
- `/home/fulutang/Documents/Github/VRCX-jirai/src/views/Tools/Gallery.vue`
- `/home/fulutang/Documents/Github/VRCX-0-jirai/src/features/tools/GalleryPage.tsx`
- `/home/fulutang/Documents/Github/VRCX-0-jirai/src/features/tools/useGalleryPageController.ts`
- `/home/fulutang/Documents/Github/VRCX-0-jirai/src/features/tools/useGalleryAssetActions.ts`

## 旧代码可复用分析
优先逐行参考旧 `src/views/Feed/Feed.vue:1-21,150-219`：`dragEnterCount` 防闪烁、`dropZones`、`pendingDrop={file,tab}`、导航到 Gallery。再参考 `src/views/Tools/Gallery.vue:743-760,872-925,1342-1378`：消费 pending drop、裁剪、tab handler。可直接搬迁的是目标列表、进入/离开计数和投放选择逻辑；Vue ref/watch/event 模板必须重写为 React hook。

## 子代理引导
“只实现 React 状态与 UI。先定位当前 Feed 页容器和 Gallery page controller 的导航/上传入口；将旧 `pendingDrop` 语义映射到现有 React service/store，不新增第二套上传。支持一个文件，拒绝非图片/空投放，保留 tab 名称。不要改 Rust 或媒体 repository 的协议。”

## 检查标准
- 单元/组件测试：dragenter/dragleave 计数、五个目标、drop 后的 tab+File 传递、非图片拒绝；
- 现有 Gallery 上传测试仍通过；
- typecheck、目标测试、build；
- 有 GUI 时截图比对五区覆盖层，否则明确请求 Windows 手验。
# dsh-reader · README 演示动图

README 顶部的三个演示 GIF 由这个目录的 [Remotion](https://www.remotion.dev/) 工程生成。三条片子各 8–9 秒，把阅读插件的三条核心动线拆成「一次只讲一个卖点」的小动画：

| 成片 | 场景 | 内容 | 时长 |
| --- | --- | --- | --- |
| `docs/demos/01-select-explain.gif` | `SelectExplain` | 划词 → 工具条 → 解释 → 概念卡 → 悬停复看 | 8s |
| `docs/demos/02-read-and-ask.gif` | `AskAI` | 选中原文 → 引用进输入框 → 对话页签流式回答 | 8s |
| `docs/demos/03-guide-mindmap.gif` | `GuideMindmap` | 导读摘要 → 导图 → 节点跳回原文 → 导出 | 9s |

所有成片都是 800×540、15fps、≤1.4MB，首尾淡出到同一底色，在 README 里循环播放不会硬切。

## 为什么是 Remotion

调研结论与对比表见 [`RESEARCH.md`](./RESEARCH.md)。一句话：这个场景是「React 假 UI → 确定性逐帧 → GIF」，Remotion 的 composition 就是 React 组件，可以用真实 DOM/CSS 复刻阅读器界面（工具栏、概念卡、抽屉、导图），同时 GIF 是官方一等输出（`codec: 'gif'`、`everyNthFrame`、`numberOfGifLoops`）。备选 Motion Canvas（MIT）更适合矢量讲解，但复刻 UI 成本高；Manim 适合数学动画；Rive / Lottie 是运行时播放格式，不解决「用代码生成介绍片」。

> Remotion 不是 OSI 开源协议：个人、≤3 人的营利组织、非营利组织可免费使用；更大的公司需要 Company License。用 Remotion 渲染出的视频/GIF 版权归作者，不要求开源。本工程只用于生成仓库里的演示素材。

## 目录

```
demo/
├── remotion.config.ts        # 入口、浏览器可执行文件、图像格式
├── src/
│   ├── index.ts              # registerRoot
│   ├── Root.tsx              # 三个 composition（1600×1080 / 30fps）
│   ├── scenes/               # 每个 8–9 秒的分镜与时间线
│   └── ui/                   # 复刻的阅读器 UI 组件、光标、概念卡、抽屉、导图
└── scripts/render.mjs        # 打包一次，渲染三条 GIF 到 ../docs/demos/
```

美术板是 800×540，整体 `scale(2)` 后按 1600×1080 渲染，再 `scale: 0.5` 输出 800×540 GIF，等于 2× 超采样，中文小字不会糊。调色板、帧率、循环次数交给 Remotion 的 GIF 编码器；如果体积需要再压，可用 ffmpeg 两遍 `palettegen/paletteuse`（见 `RESEARCH.md` 第 5 节）。

## 使用

```bash
cd demo
npm install

# 打开 Remotion Studio，在浏览器里逐帧调时间线
npm run studio

# 一次渲染三条 GIF 到 ../docs/demos/
npm run render

# 只渲染某一条（id 见 src/Root.tsx）
node scripts/render.mjs SelectExplain
```

需要本机有 Chrome。默认读 macOS 的 Chrome 路径（`remotion.config.ts` 里的 `setBrowserExecutable`）；其他平台改成自己的 Chrome，或删掉这一行让 Remotion 自动下载 Headless Shell。渲染不依赖网络，也不需要任何模型 API。

## 改哪里

- 每条的镜头时间线都在 `src/scenes/*.tsx` 顶部的 frame 常量里（30fps）。改文案、改落点、改停留时间都从这里开始。
- 阅读器界面的颜色/字号/窗口尺寸在 `src/ui/theme.ts`，和真实 UI 的取值对齐（墨色 `#1f2329`、边框 `#e3e6eb`、品牌蓝 `#1f6feb`）。
- UI 组件在 `src/ui/`：`atoms.tsx` 是顶栏/窗口/字幕条，`page.tsx` 是正文排版，`toolbar.tsx` 是划词工具条，`concept-card.tsx` 是概念卡，`drawer.tsx` 是对话/导读抽屉，`mindmap.tsx` 是导图。
- 字体使用系统 `PingFang SC`；Linux 上请安装 Noto Sans SC 并把 `theme.ts` 的 `FONT` 里补上 `"Noto Sans SC"`。

## 时间线速查

| 场景 | 0s | 1s | 2s | 3s | 4s | 5s | 6s | 7s | 8s |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 01 划词解释 | 窗口入场 | 拖选 | 工具条 / 点解释 | 概念卡浮出 | 行内虚线出现 | 悬停预览 | 归档说明 | 收尾 | — |
| 02 边读边问 | 窗口入场 | 拖选原文 | 点「问 AI」 | 抽屉 + 输入问题 | 发送 | 流式回答 | 过程与快捷追问 | 收尾 | — |
| 03 长书导读 | 窗口入场 | 点「导读」 | 摘要列表 | 切「导图」 | 导图画完 | 点节点跳原文 | 导出高亮 | 收尾 | — |

以上为大致节奏，精确帧号以 `src/scenes/*.tsx` 为准。

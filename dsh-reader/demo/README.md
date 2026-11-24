# dsh-reader · README 演示动图

仓库根 README 里的三个演示 GIF 由这个目录的 [Remotion](https://www.remotion.dev/) 工程生成。三条片子对应阅读插件的三条核心动线，界面已同步到 0.14.x 的对话气泡、流式回答、选区图形、附件、导图点阵与分块节点：

| 成片 | 场景 | 内容 | 时长 |
| --- | --- | --- | --- |
| `../docs/demos/01-select-explain.gif` | `SelectExplain` | 划词 → 解释 → 概念卡 → 卡内追问 → 回答留在卡内 → 拖动选中概念 → 再解释 → 第 2 层子卡 | 14s |
| `../docs/demos/02-read-and-ask.gif` | `AskAI` | 选中原文+图形 → 引用/附件进输入框 → 对话气泡流式回答 | 10s |
| `../docs/demos/03-guide-mindmap.gif` | `GuideMindmap` | 导读摘要 → 导图点阵/分块节点 → 节点跳回原文 → 导出 | 10s |

所有成片都是 **640×432、20fps、64 色**，单条约 2.6–3.4MB；镜头与分镜设计见 [`CAMERA.md`](./CAMERA.md)。

## 镜头

旧版是固定机位的“屏幕录像”；新版用 **2.5D 产品电影**，但镜头不跟鼠标：

- 场景有 `perspective` 和 `translateZ` 分层：背景、窗口、工具条、概念卡、光标不在同一平面。
- 鼠标移动、划选、悬停时镜头完全不动；只有点击后，镜头才向结果推进一次。
- 单次推进 0.6–0.8 秒，20fps；需要读的文字在镜头里接近 0°。
- 导图单独做一次俯身镜头，节点选中时抬高 18px，然后回正跳转。
- 镜头有明确停顿，不会全程漂移；每片主动运动不超过 4 次。

实现见 `src/ui/camera.tsx` 的 `Camera` / `Layer` / `cameraAt`。

## 为什么是 Remotion

调研结论与对比表见 [`RESEARCH.md`](./RESEARCH.md)。一句话：这个场景是「React 假 UI → 确定性逐帧 → 视频/GIF」，Remotion 的 composition 就是 React 组件，可以用真实 DOM/CSS 复刻阅读器界面（对话气泡、附件、导图），同时输出逐帧可复现的母版。备选 Motion Canvas（MIT）更适合矢量讲解，但复刻 UI 成本高；Manim 适合数学动画；Rive / Lottie 是运行时播放格式，不解决「用代码生成介绍片」。

> Remotion 不是 OSI 开源协议：个人、≤3 人的营利组织、非营利组织可免费使用；更大的公司需要 Company License。用 Remotion 渲染出的视频/GIF 版权归作者，不要求开源。本工程只用于生成仓库里的演示素材。

## 目录

```
demo/
├── remotion.config.ts        # 入口、浏览器可执行文件、图像格式
├── src/
│   ├── index.ts              # registerRoot
│   ├── Root.tsx              # 三个 composition（1600×1080 / 30fps 母版）
│   ├── scenes/               # 每个 10–14 秒的分镜、机位与时间线
│   └── ui/                   # 复刻的阅读器 UI、相机、概念卡、对话、导图、图示
└── scripts/render.mjs        # 先渲染 MP4 母版，再转 720×486 / 15fps GIF
```

## 渲染管线

1. Remotion 以 1600×1080 / 30fps 渲染 H.264 母版到 `out/preview/*.mp4`。
2. ffmpeg 缩到 640×432、20fps、64 色，并用 `palettegen/paletteuse` 两遍调色板。
3. 如果本机有 `gifsicle`，再跑一次 `-O3 --lossy=100` 压体积；没有则保留 ffmpeg 输出。

美术板仍是 800×540，整体 `scale(2)` 后按 1600×1080 渲染；输出缩小到 640×432，用 20fps 换取镜头平顺度。调色板、帧率、循环次数由 ffmpeg 控制，不再用 Remotion 直出 GIF。

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

# 已有 MP4 母版时，只重转 GIF
node scripts/render.mjs --gif-only
```

需要本机有 Chrome 和 `ffmpeg`；`gifsicle` 可选。默认读 macOS 的 Chrome 路径（`remotion.config.ts` 里的 `setBrowserExecutable`）；其他平台改成自己的 Chrome，或删掉这一行让 Remotion 自动下载 Headless Shell。渲染不依赖网络，也不需要任何模型 API。

## 改哪里

- 每条的机位在 `src/scenes/*.tsx` 顶部的 `CAMERA` 数组里（30fps 帧号）；改落点、推拉、停留时间都从这里开始。
- 相机/图层/地影/暗角在 `src/ui/camera.tsx`；镜头规则见 [`CAMERA.md`](./CAMERA.md)。
- 对话气泡、流式回答、过程胶囊在 `src/ui/drawer.tsx`；选区小图在 `src/ui/figure.tsx`。
- 导图点阵、分块节点、工具栏在 `src/ui/mindmap.tsx`。
- 阅读器界面的颜色/字号/窗口尺寸在 `src/ui/theme.ts`，和真实 UI 的取值对齐（墨色 `#1f2329`、边框 `#e3e6eb`、品牌蓝 `#1f6feb`）。
- 字体使用系统 `PingFang SC`；Linux 上请安装 Noto Sans SC 并把 `theme.ts` 的 `FONT` 里补上 `"Noto Sans SC"`。

## 时间线速查

| 场景 | 0–3s | 3–6s | 6–9s | 9–14s |
| --- | --- | --- | --- | --- |
| 01 划词解释 | 3/4 建立、选词、工具条、点解释 | 概念卡入场、卡内追问输入 | 回答留在卡内、继续追问 | 拖动选中「最终一致性」→再解释→第 2 层子卡 |
| 02 边读边问 | 3/4 建立、选原文+图、点问 AI | 抽屉展开、引用/附件、发送 | 流式回答、过程胶囊 | 回拉、收尾 |
| 03 长书导读 | 3/4 建立、打开导读、摘要列表 | 切导图、分块节点 | 节点跳原文、定位环 | 回拉、导出高亮 |

以上为大致节奏，精确帧号以 `src/scenes/*.tsx` 为准。

# dsh-reader README 演示动图调研

> 调研日期 2026-11-24。star / license / 最近推送经 `api.github.com` 实测；npm 周下载为 2026-11-16~22。目标：2–3 个 ≤10 秒、代码生成的「React 假 UI」介绍 GIF（光标移动、缩放、流式打字、kinetic type），明确不用 Sora / Runway / Midjourney 等生成模型。

## 1. 结论

**首选 Remotion 4.x。** 这个场景本质是「React 假 UI → 确定性逐帧 → GIF」：Remotion 的 composition 就是一个 React 组件，画面由帧号驱动，可以直接用真实 DOM/CSS/React 生态复刻阅读器界面（卡片、光标、滚动、流式文字），同一份代码既能进 Studio 预览也能渲染。GIF 是官方一等输出（`--codec=gif`、`--every-nth-frame`、`--number-of-gif-loops`），个人作者免费商用、输出物版权归作者，且 2026 年 AI 编码工具链支持最好。

**备选 Motion Canvas：** MIT、无许可顾虑，适合「矢量讲解 + 旁白」；但它不是 React、是画布节点系统、原生只出帧序列（视频/GIF 靠 ffmpeg 插件），复刻假 UI 的成本明显更高。**Manim 只在需要讲算法/数学时考虑；Rive / Lottie 是运行时/播放格式，不解决「代码生成介绍片」。**

**2025–2026 的常见工具链：** Remotion + 编码 Agent（Claude Code / Codex / Kimi Code / OpenCode）+ ffmpeg 两遍 palettegen/paletteuse 或 gifski 压 GIF；Remotion 官方专门做了 AI 文档、Agent Skills 和 Prompt Showcase，社区大量「AI 写 composition」案例，本机 Node 22 + Chrome + ffmpeg 8.1 可直接跑通。

**2–3 条片子建议：** ① 划词 → 概念卡浮出；② 引用原文 → 右侧流式回答；③ 概念抽屉/导读思维导图缩放。每条只讲一个卖点，片尾回到起始画面做无缝循环。

## 2. 对比表

| 库 | Stars | License | 适合场景 | GIF 原生支持 | 适配度（1–5） |
|---|---|---|---|---|---|
| **Remotion** | 75.2k | Remotion License（个人/≤3 人免费，4+ 商业授权） | React 组件即视频：产品/UI 演示、数据视频 | ✅ `--codec=gif`、`everyNthFrame`、`numberOfGifLoops` | **5** |
| Motion Canvas | 20.2k | MIT | 矢量讲解动画 + 旁白同步；编辑器实时预览 | ❌ 输出 PNG/JPEG/WebP 帧序列，视频/GIF 靠 ffmpeg exporter 插件 | 3 |
| Manim Community | 42.9k | MIT | 数学/算法图解、3B1B 风格 | ✅ `--format=gif`（v0.22.1） | 2 |
| Revideo | 4.2k | MIT | TS 代码视频、headless 渲染 API、批量 mp4 | ❌ 输出视频文件（FFmpeg exporter），非 GIF 原生 | 3 |
| Theatre.js | 13.1k | Apache-2.0 | 浏览器内关键帧/序列编辑器（THREE/UI 动效） | ❌ 无渲染/导出管线 | 1 |
| GSAP | 31.2k | GSAP Standard License（已免费） | Web UI 动画引擎；需再配 Remotion/Puppeteer 录制 | ❌ | 2 |
| anime.js | 75.0k | MIT | 轻量 DOM/SVG 动画 | ❌ | 2 |
| Motion | 35.5k | MIT | React/JS UI 动效，可嵌进 Remotion 组合使用 | ❌ | 2 |
| Rive | 1.3k\* | 运行时 MIT；编辑器闭源 | 交互式 UI/游戏动画运行时（.riv） | ⚠️ 仅编辑器 Cloud Renderer（付费）导出 GIF | 1 |
| Lottie (lottie-web) | 32.6k | MIT | AE/Bodymovin JSON 播放 | ❌ 播放器，无导出 | 1 |

\* Rive 的 star 取开源运行时 `rive-app/rive-runtime`；编辑器与 Cloud Renderer 是闭源商业产品。采用度参考：Remotion npm 周下载 452 万，@revideo/core 25.6 万，@motion-canvas/core 1.1 万（2026-11-16~22）。

## 3. 逐个点评

**Remotion**
React 组件 + `useCurrentFrame()`：一帧是帧号的纯函数，同一份代码可在浏览器预览也可以 headless 渲染，像素级布局与 CSS 动画都能进画面，正适合「假 UI」。GIF 是官方一等输出，文档给了 `--codec=gif`、`everyNthFrame`、`numberOfGifLoops`、透明 GIF 的完整说明；渲染层用本地 Chrome（`openBrowser()`/`ensureBrowser()`）+ FFmpeg，本机环境可直接跑。官方 AI 文档还列出 Claude Code、Codex、Kimi Code、OpenCode 与 Agent Skills 的用法，2026 年这套组合已是产品 demo 的常见工作流。
来源：[Rendering GIFs](https://www.remotion.dev/docs/render-as-gif) · [@remotion/renderer](https://www.remotion.dev/docs/renderer) · [remotion-dev/remotion](https://github.com/remotion-dev/remotion)

**Motion Canvas**
官方定位是「用生成器写信息型矢量动画，并与旁白同步」，明确说不是传统剪辑软件的替代品；场景节点是自家 Canvas 2D 组件而非 React/DOM。渲染只产出帧序列（PNG/JPEG/WebP），官方让用户用 ffmpeg 合成；视频/GIF 由官方 [@motion-canvas/ffmpeg](https://github.com/motion-canvas/exporters) 插件完成，[issue #4](https://github.com/motion-canvas/motion-canvas/issues/4) 里作者也坚持 FFmpeg 不进核心。做矢量讲解很顺，做像素级 UI 不划算。
来源：[Rendering · Motion Canvas](https://motioncanvas.io/docs/rendering) · [motion-canvas/motion-canvas](https://github.com/motion-canvas/motion-canvas)

**Manim / Manim Community**
README 一句话定位 "An animation engine for explanatory math videos"，核心抽象是 Mobject（数学对象）+ Scene，官方入门示例是圆、正方形与 Mobject 定位，LaTeX 公式、坐标轴、曲线是常见用法。原生支持 `--format=gif`，做算法/数学图解很合适；但没有 DOM/CSS/React，复刻阅读器的圆角卡片、字体排版、流式光标要手工摆 Mobject，成本高且难保真，所以不适合本项目的主演示。
来源：[Manim's Output Settings](https://docs.manim.community/en/stable/tutorials/output_and_config.html) · [ManimCommunity/manim](https://github.com/ManimCommunity/manim)

**Revideo**
Motion Canvas 的 fork，定位 "rendering engine for creating videos in code"，提供 headless `renderVideo()` 与 React Player，适合服务端批量生成 mp4；README 还强调 "A scene is plain TypeScript, so Claude or Codex can produce one from a prompt"。但输出仍是视频文件而非 GIF 原生，画布组件体系也不是 DOM，假 UI 复刻度与 Motion Canvas 同级，且项目由商业公司 Midrender 主导、带渲染 telemetry。
来源：[midrender/revideo](https://github.com/midrender/revideo) · [Revideo Docs](https://docs.re.video/)

**Rive（对照）**
Rive 是「交互式 2D/3D 运行时 + 闭源编辑器」，强项是状态机、交互和游戏 UI，不是「写代码生成一段视频」的工具。它的视频/GIF 导出走编辑器的 Cloud Renderer（付费计划），属于手工设计后导出，不满足本项目「代码驱动、可复现」的要求。
来源：[Rive: Exporting Videos & Images](https://rive.app/docs/editor/exporting/exporting-for-video-and-static-design/) · [Rive Runtime](https://github.com/rive-app/rive-runtime)

**Lottie（对照）**
Lottie 是播放格式：lottie-web 解析 AE/Bodymovin 导出的 JSON 并渲染，本身不生成、不导出 GIF，解决的是「设计稿动效上线」而不是「代码做产品演示」。它和动画制作工具的关系是「格式 + 运行时」，在 README 里更适合作为被播放的素材，而不是生成管线。
来源：[airbnb/lottie-web](https://github.com/airbnb/lottie-web) · [Lottie 官网](https://airbnb.io/lottie/)

**Theatre.js**
强在「代码 + 浏览器可视化关键帧」的编辑体验，适合做 THREE.js/UI 动效的编排，但最后仍要自己接渲染/录制，没有视频或 GIF 导出管线。仓库最近一次推送在 2024-08，活跃度偏低，不适合作为新项目的长期依赖。
来源：[Theatre.js](https://www.theatrejs.com/) · [theatre-js/theatre](https://github.com/theatre-js/theatre)

**GSAP**
Web 动画引擎里的事实标准，时间轴、缓动、ScrollTrigger 都很成熟，现在已对所有人免费（Webflow 支持）。但它只负责「让 DOM 变量动起来」，不提供逐帧渲染、编码和 GIF 输出；要用在本场景得自己搭 Puppeteer 截帧 + ffmpeg，等于重造 Remotion。
来源：[GSAP Licensing](https://gsap.com/licensing/) · [greensock/GSAP](https://github.com/greensock/GSAP)

**anime.js**
轻量、MIT、v4 API 好用的 DOM/SVG/JS 动画库，适合小型交互动效。同样没有离线渲染和 GIF 输出；它更适合嵌在页面里做交互演示，而不是生成本仓库 README 用的 GIF。
来源：[anime.js Docs](https://animejs.com/documentation/) · [juliangarnier/anime](https://github.com/juliangarnier/anime)

**Motion**
React/JS 生态里体验很好的动效库（motion.dev，MIT），API 简洁，可直接写进 React 组件。它没有渲染管线，但可以和 Remotion 组合：用 Remotion 的帧驱动、用 Motion 写补间，二者不冲突，只是 Motion 本身不能独立产出 GIF。
来源：[Motion Docs](https://motion.dev/docs/react-animation) · [motiondivision/motion](https://github.com/motiondivision/motion)

## 4. Remotion 许可证注意事项

- **个人 / 小团队免费**：Free License 覆盖个人（含商业用途）、≤3 人的营利组织、非营利组织及评估阶段；公司规模按「参与方总人数」计算，不是按实际使用 Remotion 的人数，4 人及以上需 Company License。
- **商业版价格（2026）**：Creators $25/人/月；Automators $0.01/render、$100/月最低；Enterprise $500/月起。免费版与商业版功能无差异。
- **输出物权利**：Terms 明确 "Remotion does not pose any restrictions on media generated with the Remotion Software"、"Users hold the rights and ownership"；取消订阅后已产出的视频仍可继续使用。
- **不是 OSI 开源**：GitHub 的 license 字段为 `NOASSERTION`（自定义 Remotion License），不能当作 MIT 类库再分发或转售；条款可能更新，以官网为准。
- 来源：[License & Pricing](https://www.remotion.dev/docs/license/pricing) · [License FAQ](https://www.remotion.dev/docs/license/faq) · [Terms](https://www.remotion.dev/docs/terms)

## 5. GIF 输出最佳实践

- **画布/分辨率**：按 2x 设计（如 1600×1000 或 1440×900），README 里显示 720–800px 宽即可；用 `<img width="800">` 固定显示宽度，避免撑满和缩放模糊。
- **帧率/直出**：单条 5–10 秒、只讲一个功能；GIF 10–15fps 对界面动效足够，母版可 30fps 渲染后用 Remotion `--every-nth-frame=2` 降到 15fps。迭代期可直接 `npx remotion render Demo out.gif --codec=gif --every-nth-frame=2` 快速看效果（不传 `--number-of-gif-loops` 即无限循环）；要求体积/画质时先出 mp4 母版再走两遍调色板。
- **颜色/调色板**：GIF 最多 256 色，渐变和阴影容易 banding；用 ffmpeg 两遍 `palettegen` + `paletteuse`（`stats_mode=diff`）或 gifski 生成高质量调色板。
- **体积**：GitHub 对图片/GIF 的附件上限是 10MB，目标首屏 GIF <5MB、次级 1–3MB；GIF 提交进 git 会永久留在历史里，压缩要在入库前做。
- **循环**：`-loop 0` 无限循环；设计首尾同状态的无缝循环（Remotion 的 `numberOfGifLoops` 留空即无限）。
- **内容**：光标移动要慢、关键动作后停 1 秒；首帧本身要有信息量（部分用户/无障碍设置会关闭自动播放）。
- **调色板命令思路**：
  ```bash
  ffmpeg -i demo.mp4 -vf "fps=15,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" -loop 0 demo.gif
  ```
  或用 `gifski --fps 15 --width 800 -o demo.gif demo.mp4`（AGPL-3.0，本地 CLI 使用无碍），再用 `gifsicle -O3 --lossy=80` 压体积。
- **嵌入**：相对路径 + alt 文本（如 `![划词解释](demo/explain.gif)`）；暗色/亮色可各出一版用 `<picture>` 切换；README 顶部放 1 个主 demo，功能小节放 1–2 个短 GIF，更长的演示用上传的 mp4（点击播放、体积更小）。
- **可复现**：GIF 由 `npm run render` 从代码生成后提交，改 UI 重跑即可，不要手工录屏。

## 6. 参考链接

- Remotion：[Rendering GIFs](https://www.remotion.dev/docs/render-as-gif) · [License & Pricing](https://www.remotion.dev/docs/license/pricing) · [License FAQ](https://www.remotion.dev/docs/license/faq) · [Terms](https://www.remotion.dev/docs/terms) · [Building with AI](https://www.remotion.dev/docs/ai) · [GitHub](https://github.com/remotion-dev/remotion)
- Motion Canvas：[Rendering](https://motioncanvas.io/docs/rendering) · [GitHub](https://github.com/motion-canvas/motion-canvas) · [Exporters](https://github.com/motion-canvas/exporters) · [Issue #4](https://github.com/motion-canvas/motion-canvas/issues/4)
- Manim：[Quickstart](https://docs.manim.community/en/stable/tutorials/quickstart.html) · [Output Settings](https://docs.manim.community/en/stable/tutorials/output_and_config.html) · [GitHub](https://github.com/ManimCommunity/manim)
- Revideo：[GitHub](https://github.com/midrender/revideo) · [Docs](https://docs.re.video/)
- Rive / Lottie：[Rive Exporting Videos & Images](https://rive.app/docs/editor/exporting/exporting-for-video-and-static-design/) · [Rive Runtime](https://github.com/rive-app/rive-runtime) · [lottie-web](https://github.com/airbnb/lottie-web)
- 其他：[Theatre.js](https://www.theatrejs.com/) · [GSAP Licensing](https://gsap.com/licensing/) · [anime.js](https://animejs.com/documentation/) · [Motion](https://motion.dev/docs/react-animation)
- GitHub 规范与实践：[Attaching files（10MB 限制）](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/attaching-files) · [Basic formatting（图片语法）](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax) · [ZoomCap 指南](https://zoomcap.live/blog/github-readme-demo-gif) · [240fps 指南](https://240fps.com/blog/app-gif-for-github-readme) · [Smol 文件上限说明](https://smolmac.com/solutions/github-readme-media) · [awesome-readme](https://github.com/matiassingers/awesome-readme)
- 编码工具：[ffmpeg palettegen/paletteuse](https://ffmpeg.org/ffmpeg-filters.html#palettegen) · [gifski](https://gif.ski/) · [gifsicle](https://www.lcdf.org/gifsicle/)

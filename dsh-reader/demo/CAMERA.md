# 新演示动图 · 镜头与分镜方案

> 版本：0.14.x ｜ 2026-11-24 ｜ 关联：`README.md` 顶部 GIF、`demo/src/`
> 目标：镜头不跟鼠标，只在用户做出动作后向结果推进一次。

---

## 0. 一句话

**鼠标移动、划选、悬停时镜头完全不动；只有点击之后，镜头才向结果区域推进一次。推进 0.6–0.8 秒，20fps，带很轻的 3D 弧线，停下必须摆平。**

---

## 1. 问题诊断

上一版不是“不够 3D”，而是镜头调度有三个错误：

| 问题 | 表现 |
| --- | --- |
| 镜头跟鼠标/选区走 | 光标移动一点、选区扩一点，镜头就跟着动，画面持续在晃 |
| 推进太快 | 8–12 帧完成一次大位移，15fps 下直接变成跳帧 |
| 连续跟拍 | 按钮 → 卡片 → 抽屉一路平移，没有停顿，看着眼花 |

修正原则：

1. **镜头不跟鼠标。** 鼠标/选区/悬停只驱动光标和 UI，不驱动相机。
2. **点击才换镜头。** 一次点击最多一次推进；推进到结果区域，不是追着按钮跑。
3. **慢起慢停。** 相机缓动改为 `cubic-bezier(0.4, 0, 0.2, 1)`，推进 0.6–0.8 秒。
4. **20fps 输出。** 15fps 对镜头运动太低；20fps 明显减少卡顿，代价是体积略增。
5. **推进时轻 3D，停下归零。** 运动中可以带 1–2° 的 rx/ry；读文字时必须平。

---

## 2. 案例校准

### 2.1 Apple 的 zoom transition

iOS 18 / SwiftUI 的 zoom transition 从被点击的 source view 长出来，目标页面与来源元素保持连续。

- 借用：**转场要有来源**，不能凭空从屏幕中心切换。
- 不借用：真机上的连续手势；GIF 只需要一次确定性的推进。

来源：[Apple - Enhancing your app with fluid transitions](https://developer.apple.com/documentation/uikit/enhancing-your-app-with-fluid-transitions)、[SwiftUI zoom(sourceID:in:)](https://developer.apple.com/documentation/swiftui/navigationtransition/zoom(sourceid:in:)?language=swift)

### 2.2 Material Container Transform

Material 的 container transform 把点击元素 morph 成目标容器，强调“同一个东西在变大/展开”。

- 借用：点击元素与结果容器之间要有连续性。
- 不借用：完整 morph；我们用镜头推进 + 结果元素自身入场。

来源：[Material Design 3 - Transitions](https://m3.material.io/styles/motion/transitions/transition-patterns)

### 2.3 Linear 发布片

Linear 的 launch film 用斜角 3D 界面、浅景深、倾斜特写跟踪输入框、宏观镜头停在对话完成态。

- 借用：斜角建立 → 贴近当前操作区域 → 宏观停在结果。
- 不借用：整片持续漂移；GIF 里会糊、会晕。

来源：[animatiQ - Linear launch video breakdown](https://animatiq.ai/launch-directory/linear-agent)

### 2.4 Product Demo Director / Synthetic UI Demo

这两份方法论给出的规则很直接：

- 相机推进量 **15–40%**，不是 2–4% 的呼吸。
- 光标到达后停 **6–10 帧**再点击；一次只让一个变化成为主体。
- 镜头在窗口边缘要 **clamp**，避免推进后露出大片空白。
- 点击坐标不要猜；渲染点击帧 still 检查光标落点。

来源：[product-demo-director](https://github.com/SkillMedev/skills/blob/main/skills/product-demo-director/SKILL.md)、[synthetic-ui-demo](https://raw.githubusercontent.com/NeverSight/skills_feed/refs/heads/main/data/skills-md/digitalsamba/claude-code-video-toolkit/synthetic-ui-demo/SKILL.md)

### 2.5 和案例的偏差

案例里常见“相机先到达点击元素，再发生状态变化”。本版根据“**不要跟鼠标微小移动**”的反馈做了调整：

- 镜头在鼠标移动/划选时保持不动。
- 点击后，镜头再向结果区域推进一次；结果是卡片/抽屉/气泡/页面。
- 这样牺牲一点“提前量”，换来更稳的画面；点击本身由光标、按压和波纹负责表达。

### 2.6 反例：全 3D 环绕

Framer 的 3D card showcase 用电影机位在卡片之间 sweep / whip，主体是图片卡片，不是密集 UI。套到阅读器上，文字会斜、会糊，观众也找不到点击点。

来源：[Framer - Deckflow 3D](https://www.framer.com/marketplace/components/deckflow-3d/)

**结论**：采用“点击结果驱动的 2.5D 推进”。只在导图这种天然平面/空间对象上允许更明显的 3D 俯身；不做全片环绕。

---

## 3. 相机模型

### 3.1 参数

```ts
type CameraKey = {
  f: number;       // 30fps 母版帧号
  fx: number;      // 焦点：画布坐标 x
  fy: number;      // 焦点：画布坐标 y
  zoom: number;    // 围绕焦点的局部放大
  x?: number;
  y?: number;
  z?: number;
  rx?: number;     // 3D 俯仰
  ry?: number;     // 3D 侧转
  rz?: number;
};
```

相机把 `(fx, fy)` 送到画面中心；`zoom` 围绕这个焦点缩放；`transform-origin` 设为焦点，旋转/缩放时焦点保持稳定。

### 3.2 构图 clamp

- 水平：按 `zoom` 计算安全区，焦点被夹在 `[400/zoom, 800-400/zoom]` 内，避免推进后左右露出大片纸面。
- 垂直：焦点夹在 `235–305`。阅读器窗口高 452px，推近时如果让焦点跑到顶部/底部，窗口会只剩一条边；把垂直焦点留在中心附近，让按钮本身在画面里移动。
- 点击目标在边缘时，镜头“尽量靠近”而不是强行居中。

### 3.3 运动曲线

- 相机缓动：`cubic-bezier(0.4, 0, 0.2, 1)`，慢起慢停。
- 单次推进：**0.6–0.8 秒**；不再用 8–12 帧的急推。
- 运动中可以带 `rx 1–2°`、`ry 1–2°`；到达结果后归零。
- 阅读 hold 时相机完全静止，不持续漂移。
- 导图是唯一允许更大俯身角度的地方（约 2°），读节点时回正。

### 3.4 顶部步骤条

推近到局部时，顶部步骤条会与放大的窗口重叠。处理方式：推进时淡出，拉回全景时淡入。

---

## 4. 运镜语法

1. **观察**：鼠标移动、划选、悬停时，镜头完全不动；只让光标和 UI 动。
2. **点击**：点击帧不变焦；点击后，镜头从全景向结果区域推进一次。
3. **结果**：推进到位后 hold；结果区域的 UI 动效独立播放。
4. **下一次点击**才允许下一次移动；不做“按钮 → 卡片 → 抽屉”的连续跟拍。
5. **拉回**：结尾回全景，重新建立上下文。

硬规则：

- 一次点击最多一次推进。
- 推进时长 ≥0.6s；不做 8 帧以内的急推。
- 读文字时相机静止、角度归零。
- 点击目标在画布上有常量坐标；每次改布局都渲染 still 校验。
- 不用全片环绕、whip pan、持续呼吸。

---

## 5. 分镜

### 5.1 `01-select-explain.gif`（9s）

| 时间 | 镜头 | 动作 |
| --- | --- | --- |
| 0–0.8s | 3/4 建立，`zoom 0.965` | — |
| 0.8–2.7s | 摆平后**完全静止** | 选词、工具条出现、点击「解释」 |
| 2.7–4.1s | 点击后向概念卡推进到 `(480,300)`，`zoom 1.14` | 卡片入场 |
| 3.7–6.3s | 静止 | 卡片内容、悬停预览 |
| 6.3–7.5s | 拉回全景 | 收尾 |
| 7.5–9s | 3/4 静止 | 循环 |

### 5.2 `02-read-and-ask.gif`（10s）

| 时间 | 镜头 | 动作 |
| --- | --- | --- |
| 0–0.8s | 3/4 建立 | — |
| 0.8–2.3s | 摆平后**完全静止** | 选文字+图、工具条、点击「问 AI」 |
| 2.3–3.7s | 点击后向抽屉/composer 推进到 `(480,300)`，`zoom 1.08` | 引用与附件进入输入框 |
| 3.7–6.7s | 静止 | 输入问题、发送、气泡流式回答 |
| 6.7–9s | 拉回全景 | 同框收尾 |
| 9–10s | 3/4 静止 | 循环 |

### 5.3 `03-guide-mindmap.gif`（10s）

| 时间 | 镜头 | 动作 |
| --- | --- | --- |
| 0–0.8s | 3/4 建立 | — |
| 0.8–1.1s | 摆平后**完全静止** | 光标到「导读」并点击 |
| 1.1–2.2s | 向导读抽屉推进 `(480,250)`，`zoom 1.05` | 摘要列表 |
| 2.2–3.0s | 静止 | 切「导图」 |
| 3.0–3.6s | 向地图推进 `(480,240)`，`zoom 1.06`，俯身 2° | 点阵、分块节点 |
| 3.6–6.3s | 静止 | 光标移到节点 |
| 6.3–6.9s | 点击后回正、跟随跳回正文 | 定位环 |
| 6.9–8.3s | 静止 | 阅读原文 |
| 8.3–10s | 拉回全景 | 导出高亮 |

---

## 6. 实现

- `src/ui/camera.tsx`：`CameraKey`、`cameraAt`、`Camera`、`Layer`、`GroundShadow`。
- 相机把 `(fx, fy)` 送到中心；水平 clamp 防露边，垂直 clamp 防窗口只剩边。
- 场景顶部的 `CAMERA` 数组是唯一机位来源；**不要把手光标 keyframe 直接写进 CAMERA**。
- 顶部步骤条在推进时按 `chromeOpacity` 淡出。
- 点击目标常量来自布局；每次改按钮位置后渲染点击帧 still 校验。
- 渲染：30fps / 1600×1080 母版 → **20fps / 640×432 / 64 色** GIF；可选 gifsicle。

---

## 7. 验收

- [ ] 鼠标移动、划选、悬停时，相机没有位移。
- [ ] 每次点击最多一次推进；推进时长 0.6–0.8s，没有 8 帧以内的急推。
- [ ] 推进过程有 1–2° 的 3D 弧线，到达后归零；读文字不糊。
- [ ] 焦点 clamp 生效，不出现大面积空白纸面。
- [ ] 全景 → 局部 → 全景，至少一次完整往返。
- [ ] 三条 GIF 均为 640×432 / 20fps / 64 色；单条 ≤3.5MB，合计 ≤10MB。
- [ ] 点击帧 still 检查通过：光标落在目标按钮/节点上。

---

## 8. 参考

- [Apple - Enhancing your app with fluid transitions](https://developer.apple.com/documentation/uikit/enhancing-your-app-with-fluid-transitions)
- [Apple - SwiftUI zoom(sourceID:in:)](https://developer.apple.com/documentation/swiftui/navigationtransition/zoom(sourceid:in:)?language=swift)
- [Material Design 3 - Transitions](https://m3.material.io/styles/motion/transitions/transition-patterns)
- [Linear launch video breakdown](https://animatiq.ai/launch-directory/linear-agent)
- [product-demo-director](https://github.com/SkillMedev/skills/blob/main/skills/product-demo-director/SKILL.md)
- [synthetic-ui-demo](https://raw.githubusercontent.com/NeverSight/skills_feed/refs/heads/main/data/skills-md/digitalsamba/claude-code-video-toolkit/synthetic-ui-demo/SKILL.md)
- [Framer - Deckflow 3D](https://www.framer.com/marketplace/components/deckflow-3d/)

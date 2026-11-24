# 读书对话：阅读器内对话面板（方案 A）设计

- 日期：2026-11-23
- 分支：`feat/reader-chat-a`
- 目标版本：0.13.0
- 状态：待评审

> 本轮只实现方案 A（阅读器内对话面板）。方案 B（书进右栏、对话居中）按最新决定不做。

## 1. 目标

让用户在阅读时不必离开书页，就能和当前会话的原生 DSH 智能体持续对话：

1. 在书页选中一段文字，点“问 AI”，这段文字作为**引用**进入底部原生输入框；
2. 用户打字提问、回车发送，走原生提交流程；
3. 回答流式出现在阅读器右侧的“对话”面板里；
4. 继续追问时，上一轮回答和引用都在面板里，可以继续选中新段落再问，形成逐层深入；
5. 需要完整对话能力时，一键切到原生对话页。

输入框保持原生，因此模型选择、推理档位、`/` 命令、附件、排队/插话、停止生成全部沿用平台能力。

### 不在范围

- 不做独立的 LLM 调用通道（现有“解释/追问”走宿主 `llm` 的能力保持原样，两套互不替代）。
- 不改动原生对话页的渲染与布局。
- 不为同一本书另开会话；对话始终发生在当前会话（`props.sessionId`）。
- 不做多用户、云端同步。

## 2. 用户旅程

### 2.1 首次使用

1. 用户打开一本书，工具栏出现“对话”按钮（未读点为 0，不自动打开面板）。
2. 选中正文任意一段，浮层出现“问 AI”主按钮和四个快捷追问：“解释这段”“举个例子”“和上文什么关系”“作者为什么这么说”。
3. 点“问 AI”：引用进入底部输入框，面板自动切换并打开“对话”页签。输入框聚焦由用户点击兑现，插件不强抢焦点（平台的 `InputActions` 不提供 focus，抢焦点会打断阅读）。
4. 用户输入问题并回车。
5. 面板顶部出现用户消息（引用块 + 问题），随后助手回答逐字流入。

### 2.2 快捷追问

点“解释这段”时（快捷追问在选区浮层里是一个下拉选择，四个按钮在窄屏会溢出）：

1. 引用进入输入框；
2. 在该引用之后插入问句“请解释这段内容”；
3. 不自动发送，用户可修改后回车。

发送仍由用户触发，避免误发。

### 2.3 面板关闭时发送

用户在底部输入框直接发送（例如贴着面板关闭状态继续问）时，检测到提交开始，自动打开对话页签并滚动到底部。

### 2.4 逐层追问

- 面板里渲染的回答是普通 Markdown，可选中复制，也可以再选中一段 → 点浮层“问 AI” → 生成对回答的引用，继续问。
- 每条引用都带上书内位置（书名 · 章节 · 页/百分比），助手能直接看到出处。

### 2.5 跳回完整对话页

面板标题栏有“在对话页打开”按钮，调用 `openView('chat', '')` 切到原生对话视图；阅读位置与面板状态保留，切回来继续。

## 3. 架构

### 3.1 客户端装配

阅读器已经是 `conversation.view` 的一个 entry，平台为它注入标准 props。方案 A 直接使用这些 seats，不新增宿主连接：

| 能力 | 来源 | 用途 |
|---|---|---|
| `useChat` | 标准 props | 读取当前会话的实时对话快照 |
| `useInput` | 标准 props | 读取输入框草稿与提交阶段 |
| `inputActions` | 标准 props | `insertQuote` / `insertText` / `captureInsertion` |
| `openView` | `conversation.view` owner props | 跳到原生对话页 |

面板挂载在现有 `.rd-drawer` 上，新增 `chat` 页签，复用已有宽度拖拽、滚动记忆与会话状态持久化。

### 3.2 数据流

```
ChatSnapshot ──buildTranscript()──> Row[] ──> 面板渲染
                                        ▲
选区浮层 ──insertQuote(text)──> 原生输入框 ──Enter──> 宿主 ──> ChatSnapshot
```

`useChat` 返回的是平台唯一的 Chat 投影，没有第二套消息状态。面板只读，不写。

**渲染边界**：对话面板必须是模块级独立组件 `ReaderChatPanel`，自己调用 `props.useChat` / `props.useInput`，不能把订阅写在 `ReaderView` 里。`ReaderView` 的渲染覆盖整本书，若由它订阅流式快照，每个 token 都会重排全文。抽屉只负责把 hooks 和回调传下去。

### 3.3 显示范围

- 默认渲染最近 8 轮（或最近 240 条行），面板顶部提供“显示全部”。
- 跳过 `visibility === 'hidden'` 的节点。
- 跳过系统噪声节点：`context`、`system-prompt`、`turn-*`（`turn-error`、`turn-max-tokens` 保留）、`command`、`command-input`、`model-retry`、`compaction`、`manual-compaction`、`unknown`。
- 保留：`user`、`assistant-step`、`turn-error`、`turn-max-tokens`、`steering`、`question-reply`。
- **两个详情档位**：`compact`（默认，阅读态）只把问答正文作为独立行，推理与工具调用折叠成该助手消息下的“过程 · N”，运行中的工具合并成一行状态；`full`（面板顶部“过程”开关）恢复独立 `tool-call` 行与完整推理块。默认折叠的理由：原生对话页也只显示一部分过程，而阅读面板宽度有限，工具轨迹会淹没有效信息。
- **过程内部再分层**：展开「过程」先看到按名字聚合的动作短语（已读取文件 × 2、执行了命令…），思考内容作为下一级折叠行，折叠行预览第一句话；和原生对话页的推理行一致，展开过程不会一次铺满思维链。
- **按轮聚合**：一轮里模型会分多个 `assistant-step`（推理 + 工具调用交替，最后才出正文）。`compact` 把同一轮的步骤合并成一条回答：正文按顺序拼接，“过程”计数与工具名累加；没有正文的纯工具步骤不单独成行，只保留运行中的状态行。这样一次长工具循环在面板里是一问一答加一行“过程”，而不是一列重复的助手行。

### 3.4 行模型（纯函数）

```js
// 输入：ChatSnapshot + { detail: 'compact' | 'full' }；输出：Row[]
{ kind: 'user',       key, turn, text }                        // 首行若是“《书名》…位置”，渲染成来源行
{ kind: 'assistant',  key, turn, blocks: [...], process, streaming }
      // compact: blocks 只含 text/image；process = { tools: string[], reasoning: string[], count }
      // full:    blocks 含 reasononing/tool-call；process = null
{ kind: 'status',     key, turn, names }                        // compact 下运行中的工具合成一行
{ kind: 'tool',       key, turn, name, status }                 // 仅 full：running / done / error
{ kind: 'error',      key, turn, text }
{ kind: 'interrupted',key, turn, blocks }                      // 已停止前缀，保留已生成正文
```

流式中的助手消息来自 `snapshot.legacy.partial`；`snapshot.legacy.runningCalls` 在 compact 下合并成一行 `status`，在 full 下逐条成行。`buildTranscript` 不依赖 React，可单独单元测试。

## 4. 引用与出处

### 4.1 引用内容

`inputActions.insertQuote(text)` 传入选中原文。位置信息以首行写入同一个引用块：

```
《人生财富靠康波》 第 3 章 · 42%
工资是出卖劳动时间换来的收入……
```

首行由 `formatLocation(doc, position)` 生成：书名 + 章节名 + 位置（PDF 用页码，EPUB/Markdown 用章节内百分比）。

理由：位置随消息进入模型上下文，助手不需要额外调用工具就知道出处；用户在对话页回看时也能看到。

### 4.2 失败路径

`insertQuote` 返回 `false`（提交中或编辑器冻结）时：

- 不打开面板；
- 浮层提示“输入框正在忙，稍后再试”；
- 不清除选区，用户可直接重试。

`inputActions` 缺失（旧版 DSH）时，浮层隐藏“问 AI”，其余阅读功能不受影响。

### 4.3 快捷追问的插入顺序

```js
const span = inputActions.captureInsertion()   // 先记录光标
inputActions.insertQuote(text)                 // 引用使 draftRev 前进
const after = inputActions.captureInsertion()  // 重新捕获
inputActions.insertText(question, after)       // 问句插在引用之后
```

`insertText` 依赖 `captureInsertion()` 的 revision 守卫；顺序错了会被拒绝。

## 5. 面板交互

- 工具栏：新增“对话”按钮，带未读圆点；点击切换 `.rd-drawer` 的 `chat` 页签，再点关闭。
- 角色区分：每条消息上方有小号角色标签（用户“你”、模型“助手”）；用户消息右对齐成气泡，引用消息的书名/位置单独成一行来源，助手回答左对齐并允许完整 Markdown。
- 过程开关：面板顶部“显示全部 / 过程”两个开关，分别控制轮次范围与是否展开推理/工具轨迹。
- 宽度：默认 420px，独立持久化（`prefs.chatWidth`，范围 320–720）；拖拽复用 `.rd-drawer-resizer`，双击复位。
- 跟随：面板位于底部时自动跟随新消息；用户上滚后暂停跟随，显示“回到底部”浮标。
- 未读：面板关闭期间到达新的助手文本时点亮圆点，打开后清除。
- 空状态：无消息时显示一句引导（“选中正文任意一段，点问 AI 开始”）。
- 忙碌指示：`useInput(s => s.phase)` 非 `plain`，或 `useSession(s => s.running)` 为真时，面板顶部显示“生成中…”状态条；不阻塞阅读。
- 结束态：`session.running === false` 且无流式时，输入框底部无额外提示。

## 6. 阅读位置上报与宿主工具（M2）

### 6.1 客户端

打开文档、翻页、切换章节以及文本类书滚动时上报（滚动先 600ms 防抖，上报器再按 1.5s 节流）：

```
POST /dsh-reader-live/api/context
{ sessionId, path, docKey, name, chapter, page, total, updatedAt }
```

### 6.2 宿主

- store 新增顶层可选字段 `reading: { [sessionId]: position }`，`normalizeV2` 容错重建；旧阅读器忽略该字段，不影响降级。
- 新增 `reader_context` 工具（无参）：返回当前会话正在读的书、章节、位置、最近一次选中文本。
- 新增 `reader_read` 工具：参数 `{ mode: 'around'|'chapter'|'toc'|'search', query?, limit? }`，从书的源文件或已缓存文本返回纯文本片段，单次返回上限 8000 字。
- 工具通过 `ctx.tools.register` 注册，宿主 `inject` 增加 `tools`；工具描述中写明“当前会话的阅读位置由 dsh-reader 提供”。
- 读取书籍文本时复用现有路径解析（`lib/paths.js` 的 `resolveInWorkspace`）与 200MB 上限；PDF 返回按页抽取的文本（复用现有 PDF 文本层能力）；抽取失败时返回明确错误。

工具是追问深度的支撑：助手可以在回答“这段和上文有什么关系”之前自己去读前两页。

## 7. 状态与持久化

- `.rd-drawer` 的 `chat` 页签已由现有 `drawer` 字段会话持久化，恢复时一并恢复。
- 面板滚动位置按 `drawerScroll` 现有机制记忆。
- 未读点只存内存，不持久化（切换会话重置）。
- `prefs.chatWidth` 进入 store 版本 2 的 prefs，随 store 同步。

## 8. 测试

### 单元（node --test）

1. `buildTranscript`：user / assistant 流式 / tool running / error / interrupted / hidden 过滤 / 最近 8 轮截断 / 显示全部。
2. `formatLocation`：PDF 页码、EPUB 百分比、Markdown 章节、缺字段兜底。
3. `buildQuoteText`：首行位置 + 原文；超长原文截断（保留 2000 字）。
4. store：`reading` 字段写入/读取/容错，旧 store 无该字段可读。
5. 工具处理：`reader_context` 无位置时返回提示；`reader_read` 各 mode 的返回结构；路径越界拒绝。
6. jsdom：面板渲染行、未读圆点、快捷追问调用顺序、`insertQuote` 失败提示、`inputActions` 缺失时隐藏入口。

### eval 与视觉

- `eval/run.mjs` 新增 3–4 个契约用例（transcript 行数、引用格式、位置工具）。
- `eval/visual.mjs` 新增：打开对话页签后出现消息行；选中正文点“问 AI”后输入框出现引用块；面板宽度拖拽与复位；跳转按钮存在。基线按新增截图更新。

### 回归门槛

- 现有 263 单测、13 eval、141 视觉、6 布局、11 发布检查全绿。
- 概念卡相关用例（卡片渲染、嵌套解释、概念删除、拖动、抽屉列表）保持现有断言不变，只允许新增用例。

## 9. 里程碑

| 里程碑 | 内容 | 完成标志 |
|---|---|---|
| M0 | 平台验证：`useChat` 在阅读视图下有数据；`insertQuote` 可写入；选区浮层能拿到 `inputActions` | 临时按钮能打印行数并把引用写进输入框 |
| M1 | 对话页签 + 行渲染 + 流式 + 快捷追问 + 未读 + 跳转 + 宽度/持久化 | 面板可用，单测与视觉通过 |
| M2 | 位置上报 + `reader_context` / `reader_read` 工具 | 助手在真实会话里能读出当前页与前后文 |
| M3 | i18n、文档、版本 0.13.0、CI、安装 | 全量验证绿 |

## 10. 风险与对策

| 风险 | 影响 | 对策 |
|---|---|---|
| `useChat` 在非 chat 视图下未物化 | 面板拿不到数据，方案失效 | M0 优先验证；若为空，退化为“发送后自动切到对话页”（方案 C）并把面板改为最近一轮摘要 |
| 自绘行与原生 Chat 保真度差距 | 工具卡片、审批、提问提醒不完整 | 行模型只覆盖文本、工具状态、错误；需要点操作的轮次在面板顶部显示“到对话页处理”并给跳转按钮 |
| `insertText` 的 revision 守卫 | 快捷追问插不进问句 | 严格按 4.3 顺序，并在失败时回退为只插引用 |
| 面板挤压阅读区 | 宽屏可用、窄屏拥挤 | 宽度可拖拽；≤900px 时面板改为覆盖式浮层（沿用现有 responsive 规则） |
| 大会话渲染成本 | 初次打开卡顿 | 默认只渲染最近 8 轮，按需“显示全部” |

## 11. 验收标准

1. 开启面板后，阅读区域仍可正常滚动、选词、批注。
2. 选中一段后点“问 AI”，底部输入框出现引用块，内容与选中一致，首行含书名与位置。
3. 回车发送后，助手回答在 1 秒内开始流入面板，工具栏圆点在面板关闭时点亮。
4. 面板内可选词复制；选中后点“问 AI”可再次生成引用。
5. 关闭/重开面板、切回对话页再切回阅读，会话与滚动位置保持。
6. `reader_context` 返回当前书与位置；`reader_read` 能读最近一次上报的窗口（PDF 当前页前后 2 页，文本类书当前滚动位置附近），跨章/全书检索不在本版范围。
7. 全量测试与视觉基线通过，版本 0.13.0，发布检查通过。

## 12. 与既有概念卡的关系（不重构）

概念卡是本插件既有的核心能力：悬停/点击词条弹出卡片、卡片堆叠与拖动、嵌套解释、证据与关联、概念删除、概念抽屉列表。本轮不改这些行为，也不改概念卡的数据模型（`store.concepts`、`parentId`、`depth`、`evidence`）与宿主路由（`/api/explain`、`/api/concept/ask`）。

新增内容全部挂在外壳层：

| 位置 | 改动 | 对概念卡的影响 |
|---|---|---|
| `.rd-drawer` | 新增 `chat` 页签分支与标题 | 无；概念页签分支原样保留 |
| 抽屉宽度 key | `mapWidth / drawerWidth` 二选一扩为三选一，新增 `chatWidth` | 无；概念抽屉仍用 `drawerWidth` |
| `.rd-mini` 选区浮层 | 追加“问 AI”与快捷追问 | 无；“解释”“翻译”“划线”“复制”不变 |
| `.rd-toolbar` | 追加“对话”按钮 | 无 |

抽屉壳层在 PDF 目录的“结构未就绪”分支里被重复写了一份；加页签会让重复变成三份。实现时抽出一个 `renderDrawerShell(title, body)` 供各处调用，输出保持零变化。这属于抽屉外壳的小整理，概念卡渲染与状态一概不动。

### 已知重叠（本版保留，后续再划分）

概念卡自带“追问”（宿主 `llm`，答案嵌入卡片，可联网），和新的“问 AI”（原生对话，带工具与会话记忆）是两条并行的提问路径。

已决定：0.13.0 保持两套并存，概念卡不加任何跳转入口，也不改卡片渲染与数据。等实际用一段时间、看清两种追问各自的使用场景后，再决定入口划分与是否合并。

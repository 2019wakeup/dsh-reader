# PRD v0.15.0：砚读 · Word 与 Windows

> 版本 0.15.0 ｜ 2026-11-24 ｜ 作者：lead ｜ 状态：待评审
> 基线：npm `@2019wakeup/dsh-reader@0.14.0`
> 前序：`docs/PRD-v1.0-阅读工作台.md`、`docs/PRD-v0.14-阅读动效.md`
> 调研依据：本工作区 0.14.0 源码（行号以 2026-11-24 工作区为准）、`npm pack` 实测、DSH 桌面端 0.2.2-rc.5 安装文档

---

## 0. 一页结论

**0.15.0 只做两件事：让砚读能读 Word，让 Windows 用户能正常用。**

这不是"再加一个格式、再加一个平台"。现有阅读管线的核心契约只有一条：**非 PDF 文档 = 扁平语义 HTML + h1–h3 标题 + 块级文本**，划词、翻译、标注、概念、目录、搜索、对话上下文全部挂在这条契约上（`src/client/app.js:3165-3191`、`src/client/styles.js:30-53`）。Word 支持要做的，是造一个满足这条契约的解析器；Windows 支持要做的，是让这条契约在 `win32` 的路径、编码、字体和脚本下不破。

**Word 的产品判断：不还原 Word 的分页版式。**

`.docx` 被解析成语义 HTML，进入现有连续阅读管线。用户得到的是和 EPUB/Markdown 一致的阅读体验：连续滚动、划词解释、段落翻译、四色高亮、目录跳转、概念沉淀、全文搜索、"问 AI"带章节上下文。代价是看不到 Word 的精确分页、页眉页脚、分栏和文本框；收益是零学习成本，且阅读位置、标注、概念卡不需要为 Word 单独造一套模型。

**Windows 的产品判断：不做一个 Windows 专用版，也不新增安装器。**

Windows 桌面端已经是 DSH 的官方发行平台之一（官方下载页提供 Windows x64 安装包，文件名以官网为准；数据目录 `%USERPROFILE%\.dsh`、`%APPDATA%\@deepseek-ai\dsh-desktop`，见 DSH 安装文档 `desktop-uninstall-cleanup.zh.md`）。插件代码本身是纯 JS，理论跨平台；但 0.14.0 的 401 条测试、163 项视觉检查、发布脚本和帮助文案都只按 macOS 写。0.15 要把这些假设逐条拆掉，用 GitHub Actions `windows-latest` + 真机清单证明"同一份代码在 Windows 上能装、能开、能划词、能导出"。

**三件事：**

1. **Word 能读**：`.docx` 打开、标题目录、划词解释、段落翻译、高亮笔记、概念卡、全文搜索、导出、`reader_context`/`reader_read` 全通。
2. **Windows 能用**：路径分隔符、GBK/UTF-16 中文、文件占用、`Ctrl+Y`、字体与滚动条、安装与发布链路。
3. **两条线都不破坏现有体验**：macOS 的 401 条测试、163 项视觉检查、12 项发布门禁保持全绿。

**不做什么：**

- ❌ 不支持 `.doc`（Word 97–2003 二进制）、`.rtf`、`.wps`；
- ❌ 不做 Word 版式还原：不还原分页、页眉页脚、分栏、文本框、页码；
- ❌ 不做 Word 编辑、批注写入、修订接受/拒绝；
- ❌ 不做 Linux 官方支持（代码不主动破坏，但不验收）；
- ❌ 不承诺 Windows ARM64（x64 模拟可跑，不作为验收目标）；
- ❌ 不做跨平台像素基线（字体不同，像素必然不同）。

**前后对比：**

| 能力 | 0.14.0 实际 | 0.15.0 目标 |
| --- | --- | --- |
| 书库格式 | PDF / EPUB / `.md` / `.markdown` / `.txt` | 再加 `.docx` |
| Word 打开 | 不在可读集合内，书库不显示 | 打开后 1.5s 内出第一章，目录可直接跳 |
| Word 划词 | 无 | 工具条、解释、翻译、高亮、笔记与 Markdown 一致 |
| Word 位置 | 无 | 章节 + 字符百分比；无页码，不伪造页码 |
| Windows 安装 | npm 包缺 Host 依赖，安装后阅读视图不出现（0.14 实测缺陷） | 安装即可用；`npm pack` 文件完整 |
| Windows 中文 | GBK/UTF-16 文本全部乱码 | BOM + GB18030 回退，正确显示 |
| Windows 路径 | `sub\book.md` 的 basename/图片解析错 | 统一 POSIX 相对路径，子目录图片正常 |
| Windows 文件占用 | 一律 HTTP 500，提示不可读 | 423 + "文件被其他程序占用"，不丢标注 |
| Windows 快捷键 | 帮助写死 `⌘Z`；`Ctrl+Y` 无反应 | 按平台显示 `Ctrl` / `⌘`；支持 `Ctrl+Y` |
| Windows 测试 | `npm test`、`release:check` 在 Windows 必挂 | 双平台 CI 全绿 |

**版本号**：0.14.0 → 0.15.0（minor）。新增格式与平台支持，无数据模型破坏；store 仍是 v2，docx 复用 `docs` / `annotations` / `concepts` 的现有结构。

> 版本线说明：产品文档里的「1.0」是能力里程碑；npm 包继续沿 0.1x 版本线发布。本 PRD 沿用 npm 版本线。

---

## 1. 为什么是现在

### 1.1 现状：三种格式，一个平台

0.14.0 的阅读能力覆盖"书"和"网页文档"：PDF、EPUB、Markdown、纯文本。但用户真实工作里最多的文档是 `.docx`：课程作业、开题报告、评审意见、技术方案、合同、会议纪要。这些文档的宿命通常是：

1. 导出成 PDF 再读——目录、页边距、页码都在，但文本层和标注体验取决于导出质量；
2. 复制成 Markdown 再读——格式全丢，图片要手动搬；
3. 在 Word 里读，遇到问题切到浏览器问——上下文断掉，这正是砚读要解决的问题。

Word 是"文档"这个词最主流的所指，阅读器绕开它，等于把最需要"边读边问"的材料挡在门外。

平台侧的问题同样具体。下面每一条都来自 0.14.0 源码审计，不是猜测：

| 面 | 0.14.0 实际 | 代码位置 | Windows 后果 |
| --- | --- | --- | --- |
| 发布包 | `files` 不含 `src/`，但 Host 顶层 `import './src/client/translate.js'`；`npm pack` 实测 223 个文件无此文件 | `package.json:12-21`、`index.js:9` | npm 安装后 `ERR_MODULE_NOT_FOUND`，阅读视图完全不出现 |
| 书库路径 | `path.relative()` 原样返回；客户端 `basename`/`dirname` 只按 `/` 切 | `index.js:129`、`src/client/util.js:14-22` | 子目录文档显示成整串 `sub\book.md`；Markdown 相对图片解析到工作区根，404 |
| 文本编码 | 固定 `TextDecoder('utf-8')` | `src/client/app.js:33-35` | 记事本/老编辑器保存的 GBK `.txt`、UTF-16 `.md` 全部乱码 |
| 文件占用 | `fs.stat` 异常一律 404；`fs.readFile` 异常冒成 500 且带绝对路径 | `index.js:140-143`、`index.js:1521-1528` | 读文件报 `HTTP 500`；store 写入遇锁时标注保存失败 |
| store 写入 | 写 tmp 后 `fs.rename`，无重试 | `lib/store.js:254-256` | OneDrive/杀软短暂占用时 rename `EPERM`，整次标注保存 reject |
| 快捷键 | `Ctrl+Y` 不识别；帮助面板写死 `⌘Z / ⌘⇧Z` | `src/client/shortcuts.js:10-12`、`src/client/app.js:4821` | Windows 用户的肌肉记忆失效，帮助文案不可信 |
| 字体/滚动条 | `system-ui` 先命中 Segoe UI；`.rd-main` 未设 `scrollbar-gutter` | `src/client/styles.js:3`、`src/client/styles.js:29` | 中文回退雅黑，字宽与行高和 mac 不同；短文档滚动条出现/消失导致正文横跳 |
| 测试/脚本 | `paths.test.mjs` 断言 POSIX 路径；`host.test.mjs` 用 `/etc/hosts` 建 symlink；Chrome 路径写死；`make-demo` 用 `/usr/bin/zip`；`publish-check` 直接 `execFileSync('npm')` | `test/paths.test.mjs:5-38`、`test/host.test.mjs:237`、`eval/visual.mjs:21`、`scripts/make-demo-epub.mjs:110-111`、`scripts/publish-check.mjs:25-31` | Windows 上 `npm test`、`release:check`、`publish:check` 全红，等于没有回归网 |

**其中发布包缺文件是 0.14 已有的真实缺陷，不只影响 Windows。** 任何从 npm 安装 0.14.0 的用户都会在插件加载时失败；桌面端插件页只会显示"加载失败"。0.15 必须把它和 Windows 支持同批修掉，否则"Windows 能装"从第一步就是假的。

### 1.2 用户信号

- **格式信号**：README 的"用在这些场景"里已经写了"论文与研究报告""技术文档与规范""课程材料"，这些场景的实际载体大量是 `.docx`。用户不会为了一个阅读器改变自己的文件格式。
- **平台信号**：DSH 桌面端提供 Windows x64 安装包，Windows 用户不需要预装 Node.js。插件 README 的安装说明却只写"Finder""⌘"，Windows 用户按图索骥会在第一步困惑。
- **安装信号**：0.14 的 npm 包缺文件，说明"发布产物完整性"没有被任何自动化检查覆盖；`publish-check` 只检查版本号、README、license、market 一致性，没有"解包后 Host 能 import"这一项。这正是 0.15 要补的门禁。

### 1.3 两个边界其实是同一个问题

把 Word 和 Windows 放在同一版，不是强行打包，而是它们共用同一套验证：

- Word 支持要证明"新格式满足 HTML 契约"；
- Windows 支持要证明"同一契约在 `win32` 下不破"；
- 两者都要跑 `node --test`、都要在书库/渲染/搜索/导出链路上回归；
- 两者都触碰 `index.js` 的文件读取与 `app.js` 的文档打开分支，合批改一次，比拆两个版本少一轮回归。

### 1.4 为什么现在做

- 0.14.0 刚发布，工作区干净，401 条测试、163 项视觉检查、16 项动效检查是可靠的回归网。
- docx 有成熟解析库（mammoth），接入成本低于自研；PDF.js 已经建立了"第三方代码作为懒加载资产"的先例（`assets/pdf.min.mjs` 与 `index.js:1538`），不破坏"零 npm 运行时依赖"。
- Windows 的失败点可以通过静态审计全部列出来（见 §1.1），不需要等用户报障。
- npm 包缺陷越晚修，受影响用户越多；0.15 与 Windows 同批发版，用户只需要升级一次。

---

## 2. 定位、目标与非目标

### 2.1 一句话定位

**让砚读覆盖"你真正在读的文档"，并让这件事在 Windows 上同样成立。**

### 2.2 目标用户与场景

- 主用户不变：用 DSH 做研究、学习、技术阅读的重度个人用户。
- 新增用户：Windows 桌面的 DSH 用户；日常材料以 `.docx` 为主的学生、研究者、工程师、产品/法务。
- 新增验收场景：
  - 一份 30 页中文 Word 课程讲义：打开、看目录、划词解释、翻译一段英文引用、高亮、导出标注；
  - 一份 2.4MB Word 技术报告（473 段、9 张表、27 张图）：首屏、滚动、表格横向滚动、图片、搜索跨章、`reader_context` 能读到正文；
  - 一台 Windows 11 + 125% 缩放 + 中文用户名的工作机：安装、打开子目录文档、GBK 笔记、文件被 Word 占用时保存标注、`Ctrl+Y` 重做、`Ctrl+滚轮` 缩放。

### 2.3 目标

1. **格式闭环**：`.docx` 与 PDF/EPUB/Markdown 共享同一套阅读、标注、概念、检索、对话能力，不需要用户切换心智。
2. **平台闭环**：Windows 上安装、打开、阅读、保存、导出全链路可用，错误提示可读。
3. **契约稳定**：docx 复用现有 store v2 与 HTML 契约，不新增文档类型字段、不改标注结构。
4. **可验证**：每条 Word/Windows 需求都有自动化或明确的手工验收，不靠"看起来能用"。
5. **不倒退**：macOS 的测试、视觉、动效、发布门禁全部保持。

### 2.4 非目标

- ❌ 不做 Word 版式还原（分页、页眉页脚、分栏、文本框、页码、页面背景）。
- ❌ 不支持 `.doc` 二进制、`.rtf`、`.wps`；加密/密码保护的 docx 明确报错，不做解密。
- ❌ 不做 Word 编辑、批注写回、修订接受/拒绝、目录域更新。
- ❌ 不做 Windows 专用安装器、系统托盘、文件关联、右键菜单。
- ❌ 不做 Linux 验收；不做 Windows ARM64 承诺。
- ❌ 不做跨平台像素基线；Windows 只做布局探针（不溢出、不重叠、可点击）。
- ❌ 不引入新的 Host 运行时依赖（mammoth 以客户端资产形式打包，Host 不 `import` 它）。

### 2.5 成功标准

| 维度 | 目标 | 验证方式 |
| --- | --- | --- |
| Word 打开 | 夹具 8 类 + 真实 2.4MB 报告全部打开；首屏 < 1.5s（473 段） | `eval/docx.mjs` + 手工 |
| Word 功能 | 划词、解释、翻译、高亮、笔记、概念、搜索、导出、`reader_context` 全通 | `test/docx.test.mjs` + eval + 手工 |
| Word 结构 | h1–h3 目录可跳；TOC 域旧页码不出现；无标题文档有"正文"兜底 | eval 断言 DOM |
| Word 性能 | 5000 段打开 < 2s；滚动无 > 50ms long task；10 万段按章加载不崩 | Puppeteer + PerformanceObserver |
| Windows 安装 | `npm pack` 后解包 Host 可 import；Windows 安装后阅读视图出现 | `publish-check` 新增"解包可加载"项；真机 |
| Windows 中文 | GBK/GB18030、UTF-16LE/BE、带 BOM 的 `.txt`/`.md` 正确显示 | 单测 + 真机 |
| Windows 路径 | 子目录文档的 basename、面包屑、相对图片、store 路径全部正确 | 单测 + 真机 |
| Windows 文件占用 | 占用时提示"文件被其他程序占用"，标注不丢、store 不坏 | 单测 + 真机 |
| Windows 回归 | `node --test`、`eval/run.mjs`、`release-check` 的平台无关项在 `windows-latest` 全绿 | GitHub Actions |
| macOS 回归 | 401 条测试、163 项视觉、16/16 动效、12 项发布门禁不变 | 本地 + CI |
| 体积 | docx 资产懒加载；首屏 `client.js` 不因 docx 增大 | 构建前后字节对比 |
| 安全 | zip bomb、XXE/实体膨胀、`javascript:` 链接、SVG 脚本、`altChunk` 全部拒绝或无害化 | 安全夹具 + eval |

---

## 3. Word 阅读体验

### 3.1 打开与首屏

书库把 `.docx` 视为可读文件，徽标显示 `DOCX`。点击后：

1. 工具栏先显示文件名与"加载中…"；
2. 适配层解析 + 切章，完成后只渲染第一章；
3. 首屏出现后，目录在后台就绪；
4. 失败时给中文错误卡片，区分：不是 zip、文件损坏、加密文档、`.doc` 旧格式、章节过大。

首屏不显示骨架屏动画之外的占位，不显示"正在转换"——解析发生在浏览器本地，没有外部进程。

### 3.2 结构：标题即目录

docx 的章节标题有两个来源，适配层都要认：

- 段落样式映射到 `heading 1`–`heading 6`（`word/styles.xml` 的 `w:style/w:name`）；
- 段落属性带 `w:outlineLvl`（0–8），即使样式名不是 heading。

中文版 Word 的样式名通常是 `heading 1`（内部名）而不是"标题 1"，但用户自定义样式、模板继承、WPS 生成的文档不一定。因此**预扫 `styles.xml` 建立 styleId → 标题级别的映射，再交给 mammoth**，而不是依赖默认样式名。

`TOC` 域（`w:sdt` 里的 `TOC`/`PAGEREF`）在 Word 里是**缓存结果**，页码和条目可能已过期。0.15 一律丢弃 TOC 域缓存，用标题重建目录；用户不会看到"目录里写着第 3 页，实际在第 7 章"。

无标题文档：整篇作为一章，目录显示"正文"，不报错。

### 3.3 划词与概念

docx 渲染进 `.rd-page.rd-prose` 后，选区工具条、解释、翻译、高亮、笔记、复制全部走现有逻辑（`src/client/app.js:1470-1530`）：

- 解释 prompt 里的 `sentence`/`paragraph` 取选区所在的 `p`/`li`/`blockquote`；
- 概念卡记录 `chapter`（章序号）、`quote`、`occurrence`，**不写 `page`**；
- 概念卡"回到原文"按章跳转，不显示页码；
- 同一概念在 docx 与其它文档之间可以复用，`docs[docKey].path` 记录 `.docx` 相对路径。

### 3.4 翻译

- 默认英译中；目标语言与源语言与其它格式共用设置。
- 只翻译可见块，滚动时继续补齐；块选择器与 Markdown 一致（`p`、`li`、`blockquote`、`h2`、`h3`、`h4`；`td` 只用于单元格内划词翻译，不参与段落对照）。
- **表格单元格不参与段落对照翻译**：译文插入会撑破列宽，表格内改用划词翻译。这是明确取舍，写进设置说明。
- 代码块/等宽块不翻译（`pre` 不进收集器）。
- `only` 模式（仅译文）保留表格、图片、脚注锚点；不因为替换文本丢掉结构。

### 3.5 标注与检索

- 标注复用 `kind: 'text'`，`chapter` 存章序号；章内按 `quote + occurrence` 重锚（`src/client/annotations.js:113-139`）。
- 搜索必须跨章：适配层提供 `docx.chapters[].text`，搜索命中后跳到对应章，再按 `quote` 定位。只搜当前章会让"全文搜索"名不副实。
- 目录、标注、概念位置的文案用"第 N 章「标题」"，不用页码（`lib/reader-context.js:210-220` 已支持 `chapterTitle`）。

### 3.6 表格、图片与脚注

- **表格**：真 `<table>`，包 `.rd-table-wrap` 横向滚动；保留 `gridSpan`/`vMerge` 合并单元格；不压缩字号、不强制换行。
- **图片**：按需解压 `word/media/*`，生成 Blob URL，关闭文档时统一 revoke；EMF/WMF 显示占位（浏览器不渲染），SVG 只走 `<img src>`，不内联。
- **超链接**：只允许 `http:`/`https:`/`mailto:`/`#anchor`；`javascript:`、`data:`、`file:` 一律降级为纯文本。
- **脚注/尾注（P1）**：上标锚点 + 章末脚注列表；不做浮层。若 mammoth 只给文末汇总，适配层按 `footnoteReference` 的 id 重新分配到所属章；做不到则降级为文末列表并记录。
- **分页符（P1）**：渲染为一条细分隔线，不做分页；不产生页码。
- **代码块（P1）**：等宽样式或 `HTML Preformatted` 映射为 `pre > code`。

### 3.7 长文档

- 单条 zip entry ≤ 40MB（现有 `MAX_ENTRY_BYTES`，`src/client/epub.js:49`）；新增**总解压预算 200MB**，超限报"文档过大"。
- 按 h1 切章，章级渲染；单章超过 3000 个块时，再按 h2 切子章，目录仍按 h1–h3 展示（P1）。
- 打开 10 万段文档不允许整棵 DOM 挂载；超限时给明确提示，不白屏。
- 滚动位置按 `chapter + scrollTop` 记忆；返回时先恢复章，再恢复章内滚动。

### 3.8 Word 边界

- `.docm` 不进入可读集合；若后续加入，宏不执行（P2）。
- 修订：显示"接受所有修订后的最终稿"（`w:ins` 保留、`w:del` 丢弃），不做差异视图。
- 批注：忽略，不渲染侧栏。
- 分栏、文本框、页眉页脚、页码、页面背景：不还原。
- OMML 公式：显示占位或纯文本，不做 MathML 转换（P2 再议）。
- 加密/密码保护：不支持，提示"文档已加密，砚读无法打开"。

---

## 4. Windows 体验

### 4.1 安装

- 官方桌面端提供 Windows x64 安装包（Windows 10/11），无需预装 Node.js/pnpm。
- 安装插件：侧栏 → **插件** → **添加插件** → 输入 `@2019wakeup/dsh-reader@latest` → 启用 → 重启。
- 插件市场索引与 macOS 相同；索引 URL 走 `https:`。
- 数据目录：`%USERPROFILE%\.dsh\profiles\desktop`；工作区内的 `.dsh-reader/` 不变。

**前置条件**：发布包必须完整。0.14.0 的 npm 包缺 `src/client/translate.js`，Windows 用户安装后会直接加载失败；W-01 必须最先修。

### 4.2 书库与路径

- Host 的 `listDir` 统一返回**POSIX 相对路径**（`\` → `/`）；客户端不再看到反斜杠。
- store 中 `doc.path`、阅读位置 `path` 等路径字段全部写 POSIX；`docKey` 仍是内容指纹，不受影响。
- 读取旧 store 时把 `\` 归一化，迁移不破坏；跨平台复制 store 后，概念卡"回到原文"仍能定位。
- 书库过滤 Windows 垃圾文件：`~$*`（Office 属主文件）、`desktop.ini`、`Thumbs.db`、`$RECYCLE.BIN`、`System Volume Information`。
- 排序用 `Intl.Collator(undefined, { numeric: true })`，`第2章` 排在 `第10章` 前（P2）。

### 4.3 中文编码

Windows 上大量 `.txt`/`.md` 由记事本、老编辑器、Git 工具生成，编码不一定是 UTF-8：

- 有 BOM：按 `UTF-8` / `UTF-16LE` / `UTF-16BE` 分派；
- 无 BOM：先 `fatal: true` 试 UTF-8；失败回退 `gb18030`（Chromium 内置）；
- 仍失败：显示乱码替换符并在状态栏提示"编码可能不是 UTF-8/GBK"。

解码统一走一个 `decodeText(bytes)`，正文、搜索、翻译、概念、导出都用同一结果，避免"正文正常、搜索乱码"。

### 4.4 文件锁与错误

- `ENOENT` → 404 "文件不存在"；
- `EACCES`/`EPERM` → 403 "没有权限读取"；
- `EBUSY`（或写 store 时的 `EPERM`）→ 423 "文件被其他程序占用，请关闭后重试"；
- 不回传绝对路径；错误文案进 i18n。
- store 原子写：`rename` 失败按 50/150/400ms 重试 3 次；仍失败回退 `copyFile` 覆盖；清理 tmp；位置上报失败静默，不弹错。
- 备份删除失败不阻塞主流程。

### 4.5 键盘

- 撤销/重做：`Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y`（Windows 标准）；macOS 保持 `⌘Z` / `⌘⇧Z`。
- 搜索：`Ctrl+F`。
- 帮助面板与 README/DETAIL 的键位按平台显示；没有"⌘"出现在 Windows 上。
- 输入法：`Esc` 在 `compositionstart` 后不关闭浮层；`Enter` 在输入法组合中不发送。

### 4.6 字体、滚动条与缩放

- 字体栈显式包含 `"Segoe UI"`、`"Microsoft YaHei UI"`、`"Microsoft YaHei"`；等宽显式包含 `"Cascadia Mono"`、`Consolas`。
- PDF 文本层 span 显式设置 pdf.js 的字体族，减少 Windows 下选区与字形的水平偏移。
- `.rd-main` 加 `scrollbar-gutter: stable`，避免短文档滚动条出现/消失导致正文横跳；布局探针测量时扣除 `offsetHeight - clientHeight`。
- `Ctrl+滚轮`：阻止 Chromium 整页缩放，改为 PDF 缩放（PDF 文档）或正文字号（文本类文档）；给出一次轻提示。
- 高 DPI：`devicePixelRatio` 取整、上限 3；PDF canvas 不超过 3×，避免 200% 以上发虚。
- 视觉验收不比较 Windows 像素；只验证不溢出、不重叠、关键按钮可点击。

### 4.7 测试与发布

- 单测去平台化：路径用 `path.join`/`os.tmpdir()`；symlink 测试在 Windows 用 junction 或按平台 skip；`host.test.mjs` 的 `/etc/hosts` 改为临时文件。
- eval：Chrome 路径支持 `CHROME_PATH` 环境变量，Windows 自动探测 `Program Files\Google\Chrome\Application\chrome.exe` 与 Edge。
- 脚本：`/tmp` → `os.tmpdir()`；`/usr/bin/zip` → Node 生成 demo zip；`npm` 调用在 Windows 用 `npm.cmd` 或 `shell: true`；`verify-market-index` 不再依赖 macOS 安装路径。
- CI：新增 `ci.yml`，`macos-latest` + `windows-latest`；Windows 跑 `node --test`、`eval/run.mjs`、`release-check` 的平台无关项；视觉/动效只在 macOS 跑。
- 发布工作流（`release.yml`）保持 `ubuntu-latest`，但发布前必须等 CI 双平台通过。

---

## 5. 需求清单

优先级定义：**P0 首先交付；P1 同属 0.15.0 发布范围，排在 P0 之后；P2 有余力再做，不承诺。**

### 5.1 Word（D 系列）

| ID | 需求 | 验收要点 | 优先级 |
| --- | --- | --- | --- |
| D-01 | `.docx` 进入可读集合与 MIME | 书库显示、能打开、错误可读 | P0 |
| D-02 | docx → 语义 HTML | 扁平块、标题/段落/加粗/斜体/下划线/删除线 | P0 |
| D-03 | 标题与目录 | h1–h3 可跳；TOC 域旧页码丢弃；无标题兜底 | P0 |
| D-04 | 划词解释 | 工具条、解释、概念卡、`occurrence` 正确 | P0 |
| D-05 | 翻译 | 可见块渐进；表格不参与；`only` 模式结构不丢 | P0 |
| D-06 | 标注 | 高亮/笔记/重锚；章节文案无页码 | P0 |
| D-07 | 全文搜索 | 跨章索引；命中跳章并定位 | P0 |
| D-08 | 表格 | 合并单元格；横向滚动；不撑破阅读区 | P0 |
| D-09 | 图片 | Blob URL；按需解压；关闭 revoke；EMF 占位 | P0 |
| D-10 | 超链接 | 只放行安全协议；`#anchor` 可跳 | P0 |
| D-11 | 阅读位置与工具 | `chapter + percent`；`reader_context`/`reader_read` 可读 | P0 |
| D-12 | 脚注/尾注 | 上标 + 章末列表 | P1 |
| D-13 | 导读/导图 | 摘要与导图复用现有结构 | P1 |
| D-14 | 分页符 | 细分隔线，不做分页 | P1 |
| D-15 | 代码块 | `pre > code`，不翻译 | P1 |
| D-16 | 长文档分章 | 按 h1 切；超大章按 h2 切；10 万段不崩 | P1 |
| D-17 | 安全与体积护栏 | 单条 40MB、总解压 200MB、脚本链接过滤 | P0 |
| D-18 | 修订/批注/分栏/文本框/OMML | 不做，明确记录 | P2（本版不做） |

### 5.2 Windows（W 系列）

| ID | 需求 | 验收要点 | 优先级 |
| --- | --- | --- | --- |
| W-01 | 发布包完整 | `npm pack` 后解包，Host 可 `import`；`publish-check` 覆盖 | P0 |
| W-02 | 路径归一化 | Host 返回 POSIX；客户端 basename/dirname/面包屑/图片解析正确 | P0 |
| W-03 | 中文编码探测 | UTF-8/UTF-16 BOM、GB18030 回退 | P0 |
| W-04 | 文件锁与错误映射 | 404/403/423；中文文案；不含绝对路径 | P0 |
| W-05 | store 写重试 | rename 3 次 + copyFile 回退；标注不丢 | P0 |
| W-06 | 测试链路跨平台 | `node --test` 在 Windows 全绿 | P0 |
| W-07 | CI Windows 矩阵 | `windows-latest` 跑单测 + eval + release 检查 | P0 |
| W-08 | 书库过滤 | `~$*`、`desktop.ini`、`Thumbs.db` 等不出现 | P1 |
| W-09 | 快捷键平台化 | `Ctrl+Y`；帮助文案按平台 | P1 |
| W-10 | Ctrl+滚轮 | 阻止整页缩放；PDF/字号缩放 | P1 |
| W-11 | 字体与 PDF 文本层 | 字体栈、等宽、text layer 字族、DPR 上限 | P1 |
| W-12 | 滚动条与布局探针 | `scrollbar-gutter`；测量扣除滚动条 | P2 |
| W-13 | 路径安全与长路径 | realpath fail-closed；大小写；UNC/长路径明确报错 | P2 |
| W-14 | 排序 | 数字感知 collator | P2 |
| W-15 | 拖拽/剪贴板/IME | 拖入打开；复制失败提示；Esc 不打断输入法 | P2 |
| W-16 | 安装文档 | README/DETAIL 增加 Windows 安装、路径、已知差异 | P1 |

**本版范围**：D-01 至 D-17、W-01 至 W-11、W-16 属于 0.15.0；P2 不阻塞发布。若排期严重超支，只允许砍 P2，不允许砍 P0。

---

## 6. 交互规格

### 6.1 D-01 打开 docx

```text
书库点击 report.docx
  → 工具栏显示文件名 + 加载中
  → 解析（本地）→ 渲染第一章
  → 目录后台就绪
```

- 加载中不锁工具栏；用户可以返回书库。
- 解析超过 3s 显示进度文案（"正在解析…"），不显示百分比假进度。
- 失败卡片给出原因与"重试"；`retry` 重新读取文件，不刷新页面。

### 6.2 D-03 章节与目录

- 目录列出 h1–h3，层级缩进与 Markdown 一致。
- 点击目录滚动到标题，并触发 0.14 的一次性定位环（`pulseElement`）。
- 当前章节在目录里高亮；滚动跨章时更新。
- 章切换不重建抽屉滚动位置；目录面板保持滚动。

### 6.3 D-04 划词

- 选区在 `.rd-page` 内才显示工具条；在表格、图片说明、脚注里同样可用。
- 解释返回后卡片贴词出现；`chapter`、`quote`、`occurrence` 写入概念出现位置。
- 从概念卡"回到原文"：先切章，再滚动，再定位环；三步都在同一交互里完成，不闪回第一页。

### 6.4 D-08 表格

- 表格外层 `.rd-table-wrap` 横向滚动；滚动条细，支持触控板横向。
- 单元格内可以划词、解释、复制；高亮跨单元格时按文本节点拆段。
- 表格不参与段落翻译；单元格内划词翻译可用。
- 超宽表格不压缩字号；最左列不冻结（P2 可加）。

### 6.5 D-09 图片

- 图片按原始宽高比缩放到阅读列宽。
- 点击不打开灯箱（P2）；右键可复制图片地址（系统菜单）。
- 图片加载失败显示占位 + alt 文本。
- 关闭文档时 revoke 所有 Blob URL，不泄漏。

### 6.6 D-12 脚注（P1）

- 正文脚注引用显示为上标数字，点击滚动到章末脚注列表。
- 章末脚注列表用 `hr` 与正文分隔。
- 脚注里的文本可划词、可解释。
- 若适配层无法按章分配，降级为文末统一列表，并在 DETAIL.md 记录。

### 6.7 D-17 错误与降级

| 情况 | 表现 |
| --- | --- |
| 不是 zip | "不是有效的 Word 文档（.docx）" |
| 损坏/截断 | "文档结构损坏，无法打开" |
| 加密 | "文档已加密，砚读无法打开" |
| `.doc` 旧格式 | "不支持 .doc，请另存为 .docx" |
| 超大 | "文档过大（解压后超过 200MB）" |
| 解析器加载失败 | "Word 解析器加载失败，请重试" + 重试 |

所有错误都进 `debug.lastError`，设置页可读；不弹系统对话框。

### 6.8 W-02 书库与路径

- Windows 的路径分隔符不出现在 UI：面包屑、文件名、概念位置文案统一 `/`。
- `~$报告.docx`、`desktop.ini`、`Thumbs.db` 不显示；`$RECYCLE.BIN` 不显示为目录。
- 空目录与只有垃圾文件的目录显示"这个目录里还没有可读的文档"。

### 6.9 W-03 编码

- 打开 GBK `.txt`：正文正确；搜索、翻译、概念 quote 与正文一致。
- 打开 UTF-16LE `.md`：标题识别正常，目录可用。
- 无法判断编码时：不阻塞打开，状态栏提示；用户可改用 UTF-8 另存。

### 6.10 W-04 文件锁

- 打开时被占用：错误卡片"文件被其他程序占用，请关闭后重试"。
- 保存标注时被占用：保留本地未保存状态，提示重试；不静默丢。
- store 写入重试期间不弹错；最终失败才提示。
- 备份损坏时不阻止读取；恢复入口仍可用。

### 6.11 W-09 快捷键

- `Ctrl+Z` 撤销、`Ctrl+Shift+Z`/`Ctrl+Y` 重做、`Ctrl+F` 搜索。
- 帮助面板显示当前平台键位；`?` 打开。
- 输入框内不拦截快捷键（现有 `isEditableTarget` 逻辑保留）。

### 6.12 W-10 缩放

- `Ctrl+滚轮` 在阅读区：PDF 缩放 10% 步进；文本类字号 1px 步进。
- 阻止页面缩放后，DSH 宿主界面不跟着缩放。
- 捏合触控板在 Windows 上可能映射为 `Ctrl+滚轮`；行为一致。
- 缩放后 PDF 文本层重新对齐；不出现选区错位。

### 6.13 P2 规格摘要

| ID | 规格 |
| --- | --- |
| W-12 | `scrollbar-gutter: stable`；布局探针扣除滚动条 |
| W-13 | realpath 失败拒绝；`path.relative` 判越界；大小写不敏感比较；长路径显式报错 |
| W-14 | `Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })` |
| W-15 | 拖入文件打开；复制失败 toast；`compositionstart` 后 Esc 不关浮层 |

---

## 7. 技术方案

### 7.1 路线选择

| 方案 | 做法 | 增量体积 | 优点 | 代价 | 结论 |
| --- | --- | --- | --- | --- | --- |
| A. 自研 OOXML | 复用 `src/client/epub.js` 的 unzip，解析 `document.xml`/`styles.xml`/`numbering.xml`/rels/media | 25–40KB / 8–12KB gzip | 零依赖、完全可控、可精确适配阅读器主题 | 12–16 人日；OOXML 边角多，长期维护重 | 备选 |
| B. mammoth 1.13.0 | 构建期打包为 `assets/docx.mjs`，运行期懒加载；输出语义 HTML | 405KB / 100.6KB gzip（含 JSZip） | 输出正好符合契约；标题/列表/表格/图片/链接/脚注/修订覆盖强 | 体积大；不认 `outlineLvl`；不做 sanitization | **采用** |
| C. docx-preview 0.4.1 | 按 Word 版式渲染分页 DOM | 75.5KB + JSZip 97.8KB / 约 49KB gzip | 版式最像 Word，支持页眉页脚/OMML | 分页 DOM 与连续滚动冲突；`sanitize.js` 删 class/style 会让版式塌掉 | 不采用 |
| D. Host 转换 | Host 调 LibreOffice/pandoc 转 HTML | 0 客户端 | 实现简单 | 插件无 spawn 先例；违背"宿主不解析源文件"；跨平台/安全/延迟都差 | 不采用 |

**结论**：采用 **B + 适配层**。理由：

1. **契约匹配**：mammoth 输出的是扁平语义块（`p`/`h1`/`table`/`img`/`a`），正好是 `.rd-prose > *` 需要的形状；不需要把 Word 的版式翻译成 CSS。
2. **工期**：0.15 同时做 Windows，docx 自研 12–16 人日会挤掉 Windows 的真机验证；mammoth 路线 6–8 人日。
3. **先例**：PDF.js 已经是随包第三方资产（`assets/pdf.min.mjs`，`index.js:1538`），mammoth 用同样的懒加载方式，不增加 Host 依赖、不影响首屏。
4. **可替换**：适配层接口（`docxOpen(bytes) → { chapters, assets, outline }`）与解析器解耦；若以后自研，只换实现。

**体积取舍**：405KB / 100.6KB gzip 只在打开 `.docx` 时加载，不计入 `client.js` 首屏；首屏 bundle 不变。PRD 接受该体积并记录在 §9.5。

### 7.2 架构

```text
index.js
  ├─ MIME 增加 .docx
  ├─ readFile：200MB 单文件上限（不变）
  └─ listDir：path.relative → 归一化为 POSIX

src/client/docx.js（新增）
  ├─ docxOpen(bytes)
  │   ├─ 复用 unzip / inflate（epub.js）
  │   ├─ 预算检查：单条 40MB、总解压 200MB
  │   ├─ 预扫 word/styles.xml → outlineLvl / heading 映射
  │   ├─ 剔除 TOC 域缓存（sdt + PAGEREF）
  │   ├─ mammoth.convertToHtml（懒加载 assets/docx.mjs）
  │   │    ├─ styleMap：heading / outlineLvl
  │   │    └─ convertImage：media → Blob URL，登记 assets
  │   ├─ 后处理：扁平化、table 包裹、协议过滤、脚注分配
  │   └─ 按 h1 切章 → chapters[{ label, html, text }]
  └─ docxGuideStructure(chapters) → { toc, parts, sections }

src/client/app.js
  ├─ READABLE 增加 .docx
  ├─ openDoc：doc.ext === '.docx' → docxOpen
  ├─ renderedHtml：docx 当前章
  ├─ 目录：docx 章列表 + h1–h3
  ├─ currentPosition / buildContextWindow：docx 分支
  └─ 搜索：跨章索引 + 跳章

src/client/styles.js
  ├─ .rd-prose 表格/图片/脚注样式
  └─ Windows 字体栈、scrollbar-gutter
```

### 7.3 适配层关键实现

**标题映射**（预扫 `styles.xml`）：

```js
// styleId -> { name, outlineLvl }
// 生成 mammoth styleMap：
//   p[style-name='标题 1'] => h1
//   p[style-name='heading 2'] => h2
// 对带 outlineLvl 但无 heading 名称的样式，用其 w:name 生成映射
```

mammoth 默认只认样式名，不认 `outlineLvl`；中文模板、WPS 模板、企业模板经常只靠 `outlineLvl`，不预扫会丢标题。

**图片**：

```js
mammoth.images.imgElement(async (image) => {
  if (!ALLOWED_IMAGE.has(image.contentType)) return { src: placeholder }
  const buffer = await image.readAsArrayBuffer()
  const url = URL.createObjectURL(new Blob([buffer], { type: image.contentType }))
  assets.push(url)
  return { src: url }
})
```

只解压被引用到的 `word/media/*`；EMF/WMF 直接占位，不尝试解码。

**章节切分**：

```js
// 按 <h1> 切；无 h1 → 一章；单章 > 3000 块 → 按 h2 切子章
function splitChapters(html) → [{ label, html, text }]
```

章节序号一旦发布就冻结：标注只存 `chapter` 序号，切分规则变化会让旧标注错位。

**位置百分比**（字符加权，比等章权重准）：

```js
percent = (beforeChapterChars + chapterProgress * chapterChars) / totalChars
```

### 7.4 章节与位置

- `chapter`：h1 序号（0 基）；无 h1 为 0。
- `chapterTitle`：h1 文本；无 h1 为"正文"。
- `page`：固定 0，不伪造。
- `total`：0。
- `percent`：按字符加权。
- `reader_context`：客户端上报的窗口文本取当前章前后；`reader_read` 的 `chapter` 模式返回当前章。
- 跳转：目录/标注/概念 → 切章 → 滚动 → 定位环。

### 7.5 图片与资产

- `docx.assets` 与 `doc.epub.assetUrls` 同构，关闭时统一 revoke（`app.js:1144-1152` 扩展分支）。
- 单图上限 20MB；超过给占位。
- 并发解压上限 4，避免大图集卡死。
- 同一张图被多次引用只解压一次（按 rel id 缓存）。

### 7.6 安全

| 风险 | 防护 |
| --- | --- |
| zip bomb | 单条 40MB + 总解压 200MB + 条目数上限 5000 |
| XML 实体膨胀 / XXE | 预扫用 DOMParser；拒绝含 `DOCTYPE`/`ENTITY` 的 XML；mammoth 输入前剥离 |
| 脚本注入 | mammoth 输出后白名单化；禁 `script`/`iframe`/`on*`；链接协议白名单 |
| 图片 SVG 脚本 | 只走 `<img src>`，不内联；Blob type 限制 |
| `altChunk` 注入 HTML | 不处理 `altChunk`（P2 也不做） |
| 路径穿越 | `resolveInWorkspace` 已有；新增 realpath fail-closed |

### 7.7 Windows 适配层

**路径归一化**（Host）：

```js
const toPosix = (p) => String(p).replace(/\\/g, '/')
// listDir 的 path、store 的 doc.path、reading.position.path
```

**客户端**：`basename`/`dirname`/`markdownImageResolver`/面包屑统一 `normalizeRelPath`；`READABLE` 扩展名判断不受影响。

**编码**：

```js
function decodeText(bytes) {
  const bom = detectBom(bytes)
  if (bom) return new TextDecoder(bom).decode(bytes)
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
  catch { return new TextDecoder('gb18030').decode(bytes) }
}
```

**错误映射**：`fs` 错误码 → `{ status, code }`；响应体只给 `code` 与中文文案，不含路径。

**快捷键**：`shortcutFor` 增加 `key === 'y'` 的 redo；帮助面板用 `platformLabel()`（`navigator.userAgentData?.platform`）。

**字体/滚动条**：CSS 显式字体栈；`.rd-main { scrollbar-gutter: stable }`；`host-layout.js` 测量扣除 `offsetHeight - clientHeight`。

### 7.8 发布包修复

0.14.0 的 Host 入口 `import { blockHash } from './src/client/translate.js'`，而 `files` 不含 `src/`。修法：

1. 新增 `lib/block-hash.js`（纯函数，无 Node 内置依赖），放 `normalizeBlockText`/`blockHash`；
2. `index.js` 改为从 `./lib/block-hash.js` 导入；
3. `src/client/translate.js` 改为从 `../../lib/block-hash.js` 导入（Node 测试可直接解析），并在 `scripts/build-client.mjs` 的拼接列表里把 `lib/block-hash.js` 放在 `src/client/translate.js` 之前——构建器会剥掉 import 行、保留函数定义，浏览器 bundle 里不出现重复实现；
4. `publish-check` 新增：`npm pack` 后解包，用 Host 入口 `import()` 一次，失败即拒绝发布；
5. `files` 白名单保持不含 `src/`，避免把客户端源码散进包。

### 7.9 文件改动

| 文件 | 改动 | 风险 |
| --- | --- | --- |
| `src/client/docx.js` | 新增：解析、切章、图片、脚注、安全、导读结构 | 高（新模块） |
| `assets/docx.mjs` | 新增：mammoth 构建产物（懒加载） | 中（体积 + 许可） |
| `assets/LICENSE-MAMMOTH` | 新增：BSD-2 许可证 | 低 |
| `src/client/app.js` | READABLE、openDoc、渲染、目录、搜索、位置、图片 revoke | 高（大文件） |
| `src/client/styles.js` | 表格/图片/脚注；Windows 字体栈、scrollbar-gutter | 中 |
| `src/client/util.js` | `normalizeRelPath`、`basename`/`dirname` 兼容 `\` | 中 |
| `src/client/api.js` | 错误码到中文文案的映射 | 低 |
| `src/client/shortcuts.js` | `Ctrl+Y`；平台标签 | 低 |
| `src/client/i18n.js` | docx/Windows 文案；修重复键覆盖 | 低 |
| `src/client/host-layout.js` | 高度测量扣除滚动条 | 低 |
| `index.js` | MIME、listDir 归一化、错误映射、文件锁 | 中 |
| `lib/paths.js` | realpath fail-closed；跨平台前缀比较 | 中 |
| `lib/store.js` | rename 重试 + copyFile 回退 | 中 |
| `lib/reader-context.js` | docx 位置兼容（`chapterTitle`） | 低 |
| `lib/block-hash.js` | 新增：`normalizeBlockText`/`blockHash` 纯函数，Host 与客户端共用 | 低 |
| `src/client/translate.js` | 改为引用 `lib/block-hash.js`，去掉重复定义 | 低 |
| `scripts/build-client.mjs` | 拼接顺序加入 `lib/block-hash.js` 与 `docx.js`；构建 mammoth 资产 | 中 |
| `scripts/publish-check.mjs` | 解包可加载检查；npm.cmd | 中 |
| `test/docx.test.mjs` | 新增：夹具生成 + 解析断言 | 中 |
| `test/windows.test.mjs` | 新增：路径、编码、错误、快捷键 | 中 |
| `test/paths.test.mjs` / `host.test.mjs` | 去平台化 | 中 |
| `eval/docx.mjs` | 新增：真实渲染、目录、划词、搜索、性能 | 中 |
| `eval/visual.mjs` / `motion.mjs` / `layout-host.mjs` | Chrome 路径探测；Windows 不跑像素 | 低 |
| `scripts/make-demo-epub.mjs` | Node zip 生成 | 低 |
| `.github/workflows/ci.yml` | 新增：macOS + Windows 矩阵 | 低 |
| `package.json` | `0.15.0`、`eval:docx` 脚本、可选 `dependencies` 不变 | 低 |
| `plugin-market.json` | 0.15.0 条目 | 低 |
| `README.md` / `docs/DETAIL.md` | Word、Windows、安装、已知差异 | 低 |

---

## 8. 兼容与降级

1. **store 兼容**：v2 不变；旧 store 的 `\` 路径读取时归一化，写回 POSIX；docKey 仍是内容指纹，改名/移动不丢标注。
2. **旧版 DSH**：docx 不依赖新宿主 API；Windows 修复不改变插件接口。低于 `0.2.2-rc.5` 的 DSH 仍按现有能力降级（对话面板隐藏）。
3. **mammoth 加载失败**：显示错误 + 重试；不 fallback 到自研解析（未实现），也不假装成功。
4. **大文档**：分章 + 章级渲染；超限给明确错误；不白屏、不冻死。
5. **表格翻译降级**：表格不参与段落翻译，提供划词翻译；写进设置说明。
6. **脚注降级**：无法按章分配时退回文末列表，DETAIL.md 记录。
7. **Windows 视觉降级**：不承诺像素一致；布局探针保证不溢出、不重叠、可点击。
8. **字体缺失**：字体栈最后回退 `sans-serif`；不内嵌字体。
9. **发布回滚**：docx 是新增格式，回滚只需回退客户端代码与版本号；Windows 修复向后兼容，回滚不影响 store。

---

## 9. 测试与验收

### 9.1 单元测试

新增 `test/docx.test.mjs`，用手写 zip 夹具（复用 `test/epub.test.mjs` 的 `zipBytes` 思路），覆盖：

1. `minimal`：一段文本 → `p`；书库可读。
2. `styles-outline`：数字 styleId + `outlineLvl` + `heading` 名称 → h1/h2 正确。
3. `toc-field`：含 `TOC`/`PAGEREF` 的 sdt → 旧页码不出现，目录按标题重建。
4. `numbering`：嵌套列表、起始编号。
5. `table`：`gridSpan`/`vMerge` 合并单元格；`rd-table-wrap`。
6. `media`：PNG 正常、SVG 走 img、EMF 占位、缺失 rel 不崩。
7. `links`：`javascript:` 降级、`#anchor` 可跳。
8. `notes`：脚注引用与章末分配（P1）。
9. `broken`：非 zip、截断、畸形 XML、`DOCTYPE` 实体、zip bomb、超 200MB → 明确错误。
10. `large`：1 万段切章（默认 skip，CI 手动跑）。

新增 `test/windows.test.mjs`：

1. `normalizeRelPath`：`sub\a.md` → `sub/a.md`；`C:\ws\a` → `C:/ws/a`。
2. `basename`/`dirname` 对 `\` 兼容。
3. `decodeText`：UTF-8、UTF-8 BOM、UTF-16LE、GB18030 字节。
4. 错误映射：ENOENT/EBUSY/EACCES → 404/423/403。
5. `shortcutFor`：`Ctrl+Y` → redo；`Ctrl+Shift+Z` → redo。
6. store 写重试：mock rename 失败两次后成功；三次失败后 copyFile。

目标：新增 ≥25 条单测（每个夹具拆成 2–3 条断言级用例）；现有 401 条不回归；`paths.test.mjs`/`host.test.mjs` 在 Windows 也通过。

### 9.2 docx eval（新增 `eval/docx.mjs`）

复用 `eval/visual/harness.jsx` 的 fixture 与 server，至少 12 项：

| # | 检查 | 断言 |
| --- | --- | --- |
| 1 | 打开 | 第一章渲染；无 console error |
| 2 | 目录 | h1–h3 数量正确；点击跳章；定位环出现 |
| 3 | 划词 | 选区工具条出现；解释请求带 `chapter`/`quote` |
| 4 | 翻译 | 可见段落入队；表格不翻译；`only` 模式保留表格/图片 |
| 5 | 表格 | `.rd-table-wrap` 存在；超宽时出现横向滚动 |
| 6 | 图片 | `src` 为 blob:；关闭后 revoke |
| 7 | 搜索 | 跨章命中；跳章后高亮定位 |
| 8 | 脚注（P1） | 上标点击滚到章末；脚注文本可划词；若 0.15 未实现则从 eval 移除并记录 |
| 9 | 位置 | `reader_context` 返回 `page:0` + `chapterTitle` + percent |
| 10 | 导出 | 标注 Markdown 显示"第 N 章" |
| 11 | 性能 | 5000 段打开 < 2s；无 >50ms long task |
| 12 | 安全 | `javascript:` 链接无 href；无 `script`/`on*` |

### 9.3 Windows 矩阵

- GitHub Actions `ci.yml`：`macos-latest` + `windows-latest`。
- Windows 跑：`node --test test/*.test.mjs`、`node eval/run.mjs`、`node scripts/release-check.mjs` 的平台无关项、`npm pack` + 解包 import。
- 视觉/动效只在 macOS 跑；Windows 跑 `eval/layout-host.mjs` 的布局探针（不溢出、不重叠）。
- 结果作为发布前置：双平台绿才允许打 tag。

### 9.4 视觉回归

- macOS：163 项检查 + 22 张基线不变；新增 docx 打开截图基线（浅色/深色），需人工比对。
- Windows：不做像素基线；做布局探针与关键控件坐标断言（工具栏、抽屉、卡片在视口内）。
- 字体差异导致的换行变化不视为回归；溢出/重叠/不可点击视为回归。

### 9.5 性能与体积

| 项 | 预算 |
| --- | --- |
| 首屏 `client.js` | 因 docx 增量 ≤ 5KB 未压缩（只是分支与接口） |
| docx 资产 | 懒加载；405KB / 100.6KB gzip；仅打开 docx 时请求 |
| 打开 2.4MB / 473 段 | < 1.5s 首屏 |
| 打开 5000 段 | < 2s |
| 滚动 | 无 >50ms long task（Puppeteer + PerformanceObserver） |
| 图片 revoke | 关闭后 `docx.assets` 全部 revoke，无泄漏 |

构建前后对比记录在发布说明；超预算必须解释。

### 9.6 手工验收

**Word：**

- [ ] 中文讲义（含标题、列表、表格、图片、超链接）打开、目录、划词、解释、高亮、翻译、搜索、导出。
- [ ] 2.4MB 技术报告（473 段、9 表、27 图）首屏、滚动、表格横向、图片、跨章搜索。
- [ ] 无标题文档、单段文档、空文档、加密文档、损坏文档、`.doc` 文件各一。
- [ ] 浅色/深色/米黄；1280px/900px；200% 缩放。

**Windows：**

- [ ] Windows 11 x64 安装插件、启用、重启、打开阅读视图。
- [ ] 中文用户名/中文路径/子目录文档；Markdown 相对图片。
- [ ] GBK `.txt`、UTF-16LE `.md`、带 BOM 的 `.md`。
- [ ] `~$报告.docx`、`desktop.ini`、`Thumbs.db` 不显示。
- [ ] Word 占用文件时打开/保存标注；提示可读、数据不丢。
- [ ] `Ctrl+Y`、`Ctrl+滚轮`、帮助面板键位。
- [ ] 125%/150% 缩放；经典滚动条；短文档不横跳。
- [ ] PDF 打开、文本层选择、双页、缩放。
- [ ] 对话输入法、发送、`Esc` 取消候选。
- [ ] 导出 JSON、导出标注 Markdown、恢复备份。

### 9.7 发布门禁

在现有 12 项 release check 上增加第 13 项，并把 CI 双平台作为前置：

```text
docx pipeline        node eval/docx.mjs         ≥12/12
```

最终门禁：

- `node --test test/*.test.mjs`：≥426 条（401 + 25）全绿，macOS 与 Windows 均通过。
- `node eval/run.mjs`：18/18。
- `node eval/visual.mjs`：163 项 + 22 张基线（macOS）。
- `node eval/motion.mjs`：16/16。
- `node eval/docx.mjs`：≥12/12。
- `node eval/layout-host.mjs`：6/6（macOS + Windows）。
- `node scripts/release-check.mjs`：13/13。
- `publish-check`：`npm pack` 后解包可 import。
- GitHub Actions：macOS + Windows 双绿。

---

## 10. 发布、回滚与度量

### 10.1 版本与发布

- npm 版本：`0.14.0` → `0.15.0`。
- 同步更新：`package.json`、`client.js`（构建产物）、`assets/docx.mjs`、`plugin-market.json`、README 版本号、DETAIL.md。
- 发布说明一句话：**"0.15.0：支持 Word（.docx）阅读，支持 Windows 桌面端；路径、中文编码、文件锁、快捷键与发布链路跨平台修复；无数据变更。"**
- 发布顺序：先合并 W-01（发布包完整）→ 再合 docx → 再合 Windows 适配 → 最后文档与市场索引。

### 10.2 回滚

- docx 是新增格式：回滚客户端代码与版本号即可，store 不变（docx 文档的 `docs` 记录保留但不再可读，不影响其它格式）。
- Windows 修复向后兼容，但 0.14.x 不认 0.15 写入的 POSIX 路径（basename/图片解析会错）——因此回滚只允许回退到 0.14.x 的完整包，并提示 Windows 用户重装 0.15；不做跨版本 store 降级。
- 若 mammoth 资产在某个 Windows 版本加载失败：可通过移除 `READABLE` 中的 `.docx` 热修；不阻塞其它格式。

### 10.3 度量

- 不新增遥测、不上报用户行为。
- 用 3 天 dogfood 记录：docx 打开失败次数、Windows 上错误提示、文件锁发生次数、`Ctrl+Y` 使用、表格/图片问题。
- 发布后观察 issue 标签：`docx`、`windows`；出现"打不开/乱码/标注丢"即进入 0.15.1。

---

## 11. 排期

预计 10–12 个开发日（含测试与文档，不含评审等待）。

| 阶段 | 内容 | 产出 | 估时 |
| --- | --- | --- | --- |
| M0 发布修复 | W-01 发布包、publish-check 解包检查 | 可安装的 0.15 基线 | 1d |
| M1 docx 解析 | mammoth 资产、适配层、标题映射、切章、图片、安全 | 能打开并渲染 | 3d |
| M2 docx 功能 | 目录、划词、翻译、标注、搜索、位置、导读 | 功能闭环 | 2.5d |
| M3 Windows 适配 | W-02～W-05、W-08～W-11 | Windows 可用 | 2d |
| M4 跨平台测试 | 单测去平台化、CI 矩阵、Chrome 探测、脚本修复 | 双平台绿 | 1.5d |
| M5 文档与发布 | README、DETAIL、市场索引、发布说明 | 可发布 | 1d |
| M6 真机验收 | Windows 手工清单、dogfood | 验收记录 | 1d |

依赖关系：M0 → M1/M3 可并行；M2 依赖 M1；M4 依赖 M2/M3；M6 依赖 M4。

---

## 12. 风险与决策记录

### 12.1 风险

| 风险 | 概率 | 影响 | 缓解 |
| --- | --- | --- | --- |
| mammoth 对中文模板标题识别不足 | 中 | 高 | 预扫 `styles.xml`（heading 名称 + `outlineLvl`）生成 styleMap；夹具覆盖数字 styleId/WPS 模板 |
| mammoth 体积超预期 | 中 | 中 | 懒加载资产；首屏不计入；记录 405KB/100.6KB gzip；必要时裁剪未用模块 |
| TOC 域旧页码被渲染 | 中 | 中 | 预处理剔除 sdt；eval 断言 |
| 脚注按章分配失败 | 中 | 低 | 降级文末列表；DETAIL.md 记录 |
| 表格内翻译撑破布局 | 高 | 中 | 表格不参与段落翻译；划词翻译兜底 |
| 大文档整棵 DOM 卡死 | 中 | 高 | 按 h1 切章；5000 段预算；超限提示 |
| Windows 无真机，只有 CI | 高 | 高 | CI `windows-latest` + 作者/志愿者真机清单；发布前必须完成 |
| Windows 杀软/OneDrive 锁文件 | 中 | 高 | rename 重试 + copyFile 回退；423 提示；失败不丢本地状态 |
| 路径归一化破坏 macOS 旧 store | 低 | 高 | 读取时兼容 `\`；写回 POSIX；迁移测试覆盖 |
| 发布包修复引入循环引用 | 低 | 中 | `blockHash` 移到 `lib/block-hash.js`；`src` 只 import；构建与 `npm pack` 双重检查 |
| 视觉基线因字体变化漂移 | 中 | 低 | Windows 不做像素；macOS 只更新 docx 新基线并人工比对 |
| mammoth 安全边界不清 | 中 | 高 | 白名单 sanitize；拒绝 DOCTYPE/ENTITY；链接协议过滤；安全夹具 |
| 双平台 CI 时间过长 | 中 | 低 | Windows 只跑单测 + eval；视觉/动效留在 macOS |

### 12.2 决策记录

| 决策 | 选择 | 理由 |
| --- | --- | --- |
| docx 渲染路线 | mammoth 懒加载 + 适配层 | 契约匹配、工期短、PDF.js 已有先例；自研留作备选 |
| 是否还原分页 | 不还原 | 连续滚动是产品性格；分页会破坏位置、翻译、缩放 |
| 页码 | 不伪造，`page:0` | docx 没有稳定页码；伪造会让 `reader_context` 和标注错位 |
| 表格翻译 | 不参与段落对照 | 译文撑破列宽；划词翻译兜底 |
| `.doc` | 不支持 | 二进制格式；mammoth 不支持；提示另存 |
| Windows 范围 | 10/11 x64 | 与 DSH 官方发行一致；ARM64 不承诺 |
| Windows 视觉 | 不做像素基线 | 字体不同；布局探针更实际 |
| 测试策略 | 双平台 CI + 真机清单 | 作者主环境是 macOS；不能只靠 mac 单测 |
| 发布包检查 | `npm pack` 后解包 import | 0.14 的真实缺陷；必须成为门禁 |
| 路径存储 | POSIX 相对路径 | 跨平台 store 可迁移；UI 不出现反斜杠 |
| 编码回退 | GB18030 | 覆盖 GBK/GB2312；Chromium 内置 |
| 快捷键 | 保留 `⌘`，增加 `Ctrl` 分支 | 不破坏 mac 用户；Windows 原生习惯 |

### 12.3 评审重点

以下三项最可能被挑战，已按建议写入；如需调整，优先改这三处：

1. **mammoth 体积**：405KB / 100.6KB gzip 是资产懒加载，还是应该自研 25–40KB？本文选择前者，理由是工期与覆盖率；若坚持"零第三方代码"，改走 A 路线，排期 +6–8 人日。
2. **表格不参与段落翻译**：这是体验取舍；如果要求表格也能对照翻译，需要改列宽策略，排期 +1–2 人日。
3. **Windows 支持范围**：是否承诺 Windows ARM64、是否做像素基线；本文选择"x64 + 布局探针"，理由是与 DSH 官方发行一致。

---

## 13. 附录

### 13.1 验收清单

> 发布前逐项确认；未完成项必须写明原因。

**Word（D 系列）**

- [ ] D-01 书库显示 `.docx`，能打开；错误可读。
- [ ] D-02 标题/段落/加粗/斜体/下划线/删除线渲染正确。
- [ ] D-03 目录 h1–h3 可跳；TOC 旧页码不出现；无标题兜底。
- [ ] D-04 划词解释、概念卡、`occurrence` 正确。
- [ ] D-05 翻译可见块；表格不翻译；`only` 模式结构保留。
- [ ] D-06 高亮/笔记/重锚；文案无页码。
- [ ] D-07 跨章搜索；跳章定位。
- [ ] D-08 表格合并单元格、横向滚动。
- [ ] D-09 图片 Blob URL、关闭 revoke、EMF 占位。
- [ ] D-10 安全链接白名单；`#anchor` 跳转。
- [ ] D-11 `reader_context`/`reader_read` 可读 docx；位置 `chapter + percent`。
- [ ] D-12 脚注（P1）上标 + 章末；失败降级文末。
- [ ] D-13 导读/导图（P1）可用。
- [ ] D-14 分页符（P1）细分隔线。
- [ ] D-15 代码块（P1）不翻译。
- [ ] D-16 大文档分章、10 万段不崩。
- [ ] D-17 zip bomb/XXE/脚本注入全部拒绝。

**Windows（W 系列）**

- [ ] W-01 `npm pack` 解包 Host 可 import；publish-check 覆盖。
- [ ] W-02 子目录文档 basename/面包屑/图片正确。
- [ ] W-03 GBK/UTF-16 正确显示。
- [ ] W-04 文件锁 423 + 中文提示；无绝对路径。
- [ ] W-05 store 写重试；标注不丢。
- [ ] W-06 Windows `node --test` 全绿。
- [ ] W-07 CI `windows-latest` 全绿。
- [ ] W-08 垃圾文件不显示。
- [ ] W-09 `Ctrl+Y`、帮助键位正确。
- [ ] W-10 `Ctrl+滚轮` 不缩放整页。
- [ ] W-11 字体栈、text layer、DPR。
- [ ] W-16 README/DETAIL 增加 Windows 说明。

**回归**

- [ ] 401 条旧测试全绿。
- [ ] 163 项视觉 + 22 张基线不变（macOS）。
- [ ] 16/16 动效。
- [ ] 12 → 13 项 release check。
- [ ] 首屏 `client.js` 增量 ≤5KB。
- [ ] 发布说明、README、DETAIL、market 同步。

### 13.2 代码触点

| 位置 | 用途 |
| --- | --- |
| `src/client/docx.js` | 新增：docx 解析、切章、图片、脚注、安全、导读结构 |
| `src/client/app.js` `openDoc()` | docx 打开分支 |
| `src/client/app.js` `renderedHtml` | docx 当前章 HTML |
| `src/client/app.js` `renderContent()` | `.rd-prose` 注入 |
| `src/client/app.js` `renderDrawerShell()` | 目录 docx 分支 |
| `src/client/app.js` `reportCurrentPosition()` / `buildContextWindow()` | docx 位置与窗口 |
| `src/client/app.js` 搜索抽屉 | 跨章搜索与跳章 |
| `src/client/app.js` `revokeAssets()` | docx 图片 revoke |
| `src/client/util.js` | `READABLE`、`normalizeRelPath`、`basename`/`dirname` |
| `src/client/shortcuts.js` | `Ctrl+Y`、平台标签 |
| `src/client/styles.js` | 表格/图片/脚注、字体栈、`scrollbar-gutter` |
| `src/client/i18n.js` | docx/Windows 文案；修重复键 |
| `index.js` `listDir`/`readFile` | POSIX 路径、错误映射、垃圾文件过滤 |
| `lib/paths.js` | realpath fail-closed |
| `lib/store.js` | 写重试 |
| `lib/block-hash.js` | `normalizeBlockText`/`blockHash` 纯函数 |
| `scripts/build-client.mjs` | `block-hash`/`docx.js` 拼接、mammoth 资产 |
| `scripts/publish-check.mjs` | 解包可加载 |
| `test/docx.test.mjs` / `test/windows.test.mjs` | 新增测试 |
| `eval/docx.mjs` | 新增 eval |
| `.github/workflows/ci.yml` | 双平台 CI |

### 13.3 术语

- **docx 契约**：非 PDF 文档统一渲染为扁平语义 HTML + h1–h3，挂进 `.rd-page.rd-prose`。
- **适配层**：包裹 mammoth 的 `src/client/docx.js`，负责标题映射、切章、图片、脚注、安全。
- **懒加载资产**：`assets/docx.mjs` 在打开 docx 时才加载，不计入首屏 bundle。
- **POSIX 相对路径**：统一用 `/` 分隔的工作区相对路径，跨平台存储与展示。
- **布局探针**：不比较像素，只断言元素在视口内、不溢出、不重叠、可点击。
- **发布包完整性**：`npm pack` 产物解包后，Host 入口能 import、阅读视图能注册。
- **P0/P1/P2**：发布优先级；P0 首先交付，P1 同属 0.15.0 范围，P2 有余力再做。

### 13.4 调研方法与未验证项

**已在本工作区验证：**

- `npm pack @2019wakeup/dsh-reader@0.14.0`（本地目录与 registry tarball 各一次）：223 个文件，均无 `src/client/translate.js`；`index.js:9` 顶层 import 该文件。
- 0.14.0 源码逐文件审计：路径、编码、文件锁、快捷键、字体、测试/脚本的 macOS 假设，行号见 §1.1 与 §13.2。
- 现有 READABLE、HTML 契约、翻译块收集器、标注重锚、`reader_context` 位置字段的代码路径。
- DSH 桌面端本地安装文档确认 Windows 数据目录与卸载路径。

**未在本工作区验证（实现阶段必须复核）：**

- mammoth / docx-preview 的体积、许可证与输出细节来自外部产物实测（2026-11-24），项目内尚未接入；标题映射、TOC 域、脚注分配的最终行为要用夹具复核。
- Windows 真机行为（文件锁、OneDrive/杀软、输入法、DPI、经典滚动条）未实测；PRD 中的错误码与文案是代码级推断，验收以 §9.6 手工清单为准。
- DSH Windows 安装包的具体文件名与系统要求以官方下载页为准；本文只确认"官方提供 Windows x64 桌面端"。
- 2.4MB Word 技术报告只做了结构统计（473 段、8 个 h1、32 个 h2、9 张表、27 张图、217 处修订、83 个书签），未在 0.15 实现前跑通渲染。
- "打开 5000 段 < 2s""10 万段不崩"是预算目标，需要用真实夹具在目标机型上标定。

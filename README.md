# ShowTime

ShowTime 是一个面向历史、文学、思想、科学、地质与大历史研究的多层时间轴工具。它不只是把 CSV 画成图，而是帮助你把一个研究对象放进同时代和更大尺度的背景中，观察前后变化、共时关系和隐藏联系。

- 在线站点：<https://chen-qingxiang.github.io/showtime/>
- 纯静态：Vanilla HTML、CSS、JavaScript，无后端、无账号、无云数据库
- 本地优先：CSV、ZIP 和项目包只在浏览器本地处理
- 跨尺度：从秒级日期到人类史、地质史与宇宙史连续缩放

## 从这里开始

最简单的入口仍然是两列 CSV：

```csv
time,title
1037~1101,苏轼
1074~1076,任密州知州
1079,乌台诗案
1082,《前赤壁赋》
```

1. 打开站点，选择“添加数据 → 添加 CSV / 旧 ZIP”，或在“高级文本导入”中粘贴 CSV。
2. 从“背景”加载本地背景层或智能推荐。
3. 在左栏整理图层分组、角色、顺序、颜色和可见性。
4. 搜索人物、地点、标签或时间范围；点击画布固定时间探针。
5. 保存命名视图，或导出 `.showtime.zip`、PNG、SVG 与 CSV。

想一次体验完整流程，可选择“项目 → 打开‘苏轼与北宋背景’”。该示例包含 overview / detailed、政治背景、同时代人物、锚点、sidecar 元数据、两个命名视图和推荐探针。

## 核心能力

### 研究项目

- 正式 `.showtime.zip` 项目包，可导入、导出和重新打开
- `00_manifest.json` 恢复项目、分组、图层角色、顺序、颜色、LOD、视图和探针
- 兼容普通 CSV ZIP、无 Manifest ZIP 和只有 `00_manifest.md` 的旧研究包
- IndexedDB 自动保存较大工作区，支持多个命名工作区和最近项目
- 格式带版本号与显式迁移入口

### 上下文比较

- 图层可隐藏、改色、重命名、排序、删除、调暗和 solo
- 分组可折叠、重命名、排序、整体隐藏、独显和调暗
- `primary`、`context`、`anchor`、`background` 除颜色外还有线型、透明度、图形和角色标记差异
- 内置 `background/` 40 个背景层与轻量推荐规则

### 时间探针

- 点击空白或事件固定探针 A；“固定第二探针”或 Shift 点击固定 B
- 精确、±1 年、±5 年、±10 年和自定义前后窗口
- “此时发生什么”按分组和图层列出相交事件
- 双探针显示各时点事件、跨越两个时点、在中间开始或结束的事件
- 探针可移动、定位、取消，并随工作区和命名视图保存

### 搜索和过滤

- 搜索标题、图层名、说明、人物、地点、标签、来源和研究笔记
- 支持 `1080~1085` 时间范围与 `苏轼 密州` 组合关键词
- 搜索全部、当前、可见、主线或背景图层
- 可把无关事件变暗，或只显示匹配事件
- 按分组、角色、标签、地点、人物、时间范围和当前视窗过滤
- 结果按时间排序，点击后定位、缩放并高亮

### 元数据和轻量编辑

- 主 CSV 继续严格保持 `time,title`，不强迫旧数据增加列
- 可选 `event_meta.json`、`sources.csv`、`references.md`
- 稳定匹配键：图层 + 原始时间 + 标题 + occurrence；导入时同时生成确定性事件 ID
- 右栏显示说明、人物、地点、标签、来源、页码、链接、引文、可信度和笔记
- 可新增、编辑、删除事件，并支持撤销 / 重做
- sidecar 未匹配和歧义会进入质检报告

### 语义缩放和性能

- Manifest 可把 overview / detailed 声明为同一 LOD 对
- 无 Manifest 时识别 `_overview`、`_detailed` 等常见命名
- 远景自动按等宽时间箱显示代表事件或密度，并明确标注 `representative` / `aggregated`
- Canvas 只处理当前视窗事件；高频平移、缩放通过 `requestAnimationFrame` 合并
- 高 DPI、鼠标、触摸、单指方向锁定、双指缩放和键盘导航

### 小地图、分析、diff 和导出

- 小地图显示完整范围、事件密度和当前视窗，可拖动视窗及两侧边界
- 统计事件记录数、点 / 区间数量、时间跨度、自动分箱、图层与元数据分布
- baseline 比较识别新增、删除、时间、标题、图层和元数据变化；不确定匹配明确标为 `possible`
- 导出高分辨率 PNG、原生矢量 SVG、项目包、单层 CSV、筛选 CSV、质检报告和差异报告
- 分享链接可携带公开项目 URL 与小型视图状态

> 统计的是“事件记录数量”，不等于真实历史活动强度。背景库和示例用于研究定位，不是穷尽性权威年表。

## CSV 时间格式

常用写法：

| 写法 | 示例 | 说明 |
| --- | --- | --- |
| 年份 | `1949`、`-221` | 单点年份；负数保持原值 |
| BCE / CE | `221 BCE`、`公元前221`、`1949 CE` | BCE 使用无公元 0 年的天文学内部值 |
| 月 / 日 | `1949-10`、`1949-10-01` | 公元日期 |
| 日内时间 | `1969-07-20 20:17:40` | 支持小时、分钟、秒与 `T` 分隔 |
| 区间 | `960~1127`、`1914-07-28~1918-11-11` | 推荐 `~`；也兼容多种中西文分隔符 |
| 开区间 | `1949~` | 按相同精度补到当前时间，并在质检中提示 |

表头可省略；空行和 `#` 注释会被记录但忽略。标题含逗号或双引号时使用标准 CSV 引号：

```csv
1942,"《春望》, 杜甫相关研究"
1967,"论文 ""The Medium is the Message"" 出版"
```

完整说明见 [CSV 格式与质检](docs/CSV_FORMAT.md)。

## ShowTime 项目包

推荐文件名：`project-name.showtime.zip`。

```text
00_manifest.json
00_manifest.md
layers/01_main_overview.csv
layers/01_main_detailed.csv
layers/02_context.csv
event_meta.json
sources.csv
references.md
```

项目导出仍把每个时间线保存为严格两列 CSV。机器状态进入 JSON Manifest，研究说明和参考资料进入 Markdown，事件扩展信息进入 sidecar。

- [项目包与 Manifest 规范](docs/PROJECT_FORMAT.md)
- [Manifest JSON Schema](docs/manifest.schema.json)
- [事件元数据与来源 sidecar](docs/METADATA.md)
- [完整 fixture 源目录](examples/苏轼与北宋背景.showtime/)
- [可直接打开的 fixture 项目包](examples/苏轼与北宋背景.showtime.zip)

## 搜索与快捷键

| 操作 | 快捷键 |
| --- | --- |
| 聚焦搜索 | `/` |
| 清除搜索 / 关闭菜单 | `Esc` |
| 撤销 / 重做 | `Ctrl/Cmd + Z` / `Ctrl/Cmd + Shift + Z` |
| 重置视图 | `0` |
| 平移 | 画布拖拽或 `←` / `→` |
| 缩放 | 滚轮、双指或 `+` / `-` |
| 中心固定探针 | 画布聚焦后 `Enter`；Shift 固定 B |
| 删除选中事件 | `Delete`（会确认） |

详见 [搜索、过滤和快捷键](docs/SEARCH_AND_SHORTCUTS.md)。

## 保存与分享限制

- 工作区自动保存到当前浏览器的 IndexedDB；小型界面偏好才使用 localStorage。
- 浏览器存储不是跨设备云备份。重要研究请定期导出 `.showtime.zip`。
- 对内置、同源或 URL 可访问项目，分享链接可携带项目 URL 与视图状态。
- 对本地文件，链接只包含项目名、图层显示、视图、过滤和探针，不包含原始数据；接收者仍需项目包。
- 超过安全长度的 URL 不会生成，避免“看似可分享、实际已失效”的链接。

## 开发

要求 Node.js 20 或更高版本。项目没有运行时或开发依赖。

```bash
npm run dev       # http://localhost:4173
npm test          # Node 内置 test runner
npm run check     # 语法检查 + 全部 Node 测试
```

浏览器验收需要本机 Chrome 和 Playwright：

```bash
# 终端 1
npm run dev

# 终端 2；已安装 playwright 时直接运行
npm run test:browser
```

`scripts/browser-test.mjs` 会实际验证桌面端完整项目、单 CSV、多 CSV 与旧 ZIP 导入，搜索跳转、双探针、IndexedDB 保存后重载恢复、PNG / SVG / 项目包导出、统计、浏览器自测和移动端布局。没有本地 Playwright 时可通过 `PLAYWRIGHT_CORE_PATH` 指向已有安装。浏览器内自测结果位于 `window.__SHOWTIME__.selfTests`。

### 模块结构

| 模块 | 职责 |
| --- | --- |
| `src/time.js` | 时间解析、精度、格式化 |
| `src/csv.js` | CSV、确定性 ID、结构化质检 |
| `src/zip.js`, `src/project.js` | ZIP、Manifest、项目导入导出与迁移 |
| `src/storage.js`, `src/state.js` | IndexedDB、状态、编辑历史、命名视图 |
| `src/search.js`, `src/probes.js`, `src/metadata.js` | 搜索过滤、探针、sidecar |
| `src/lod.js`, `src/renderer.js`, `src/minimap.js` | LOD、Canvas、密度聚合、小地图 |
| `src/diff.js`, `src/statistics.js`, `src/export.js`, `src/share.js` | diff、分析、导出、分享 |
| `src/ui.js`, `src/canvas-interactions.js`, `app.js` | 界面渲染、输入手势、应用编排 |

## GitHub Pages

线上继续使用仓库 `main` 分支根目录的 GitHub Pages legacy 静态发布，不需要构建步骤。ES modules、CSV、JSON 和 ZIP 都使用相对路径，可在项目子路径 `/showtime/` 下工作。

部署与排查见 [GitHub Pages 部署](docs/DEPLOYMENT.md)。

## 已知限制

- 不支持 ZIP64；项目导出使用兼容性高的未压缩 ZIP 条目，因此包可能比压缩 ZIP 大。
- BCE 支持年份与年份区间；`公元前221-01-01` 这类 BCE 日期尚不支持。
- CSV 不支持跨多行的带引号标题；单行内的逗号和双引号完全支持。
- 事件关系图、多人协作、账号和云同步不在产品范围内。
- 浏览器存储容量和文件下载上限取决于具体浏览器与设备。

## License

MIT

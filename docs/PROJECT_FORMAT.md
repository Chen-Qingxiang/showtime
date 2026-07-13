# ShowTime 项目包规范 1.0

## 目标

`.showtime.zip` 是可保存、可恢复、可人工检查的研究项目格式。它在普通两列 CSV 之上增加项目状态，不把核心数据锁进私有数据库。

推荐扩展名：

```text
project-name.showtime.zip
```

## 兼容模式

导入器按以下顺序工作：

1. 有 `00_manifest.json`：按项目包导入并恢复状态。
2. JSON 版本高于当前支持版本：报告 `unsupported_version`，保守导入可识别 CSV，不应用未知状态。
3. 只有 `00_manifest.md`：把 Markdown 作为研究说明，CSV 按旧包导入。
4. 无 Manifest：作为普通 CSV ZIP；CSV 按文件名自然排序，最多导入前 100 个。

ZIP64 当前不支持。ShowTime 导出的 ZIP 使用 stored 条目，便于浏览器无依赖生成和跨工具兼容。

## 目录

```text
00_manifest.json       必选（正式项目）
00_manifest.md         推荐
layers/*.csv           一个或多个严格 time,title 时间线
event_meta.json        可选事件元数据
sources.csv            可选来源表
references.md          可选研究参考资料
```

文件可放在子目录。所有 Manifest 路径均相对于 ZIP 根目录，使用 `/`。

## 最小 Manifest

```json
{
  "format": "showtime-project",
  "version": "1.0",
  "project": {
    "name": "苏轼与北宋背景",
    "description": "研究说明",
    "topic": "苏轼、北宋文学与政治",
    "createdAt": "2026-07-13T00:00:00.000Z",
    "updatedAt": "2026-07-13T00:00:00.000Z"
  },
  "groups": [
    { "id": "main", "name": "主线", "order": 0 }
  ],
  "layers": [
    {
      "id": "sushi",
      "name": "苏轼生平",
      "file": "layers/01_sushi.csv",
      "role": "primary",
      "groupId": "main",
      "order": 0,
      "color": "#4da3ff",
      "visible": true
    }
  ]
}
```

正式 schema：[`manifest.schema.json`](manifest.schema.json)。

## 顶层字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `format` | string | 固定 `showtime-project` |
| `version` | string | 当前 `1.0`；主版本用于兼容判断 |
| `project` | object | 名称、说明、主题、创建 / 更新时间 |
| `groups` | array | 图层分组与展开 / 显示状态 |
| `layers` | array | CSV、角色、顺序、颜色、LOD |
| `timeRange` | object | 项目声明的完整时间范围；导出时默认由全部事件计算 |
| `initialView` | object | 初始 `start` / `end`，同时表达初始缩放位置与尺度 |
| `lodMode` | string | `auto` 或 `manual` |
| `views` | array | 命名视图快照 |
| `bookmarks` | array | 研究书签 |
| `probes` | array | 初始或推荐探针 |
| `filters` | object | 当前过滤状态 |
| `search` | object | 当前搜索状态 |
| `metadata` | object | sidecar 相对路径 |

未知字段应被保留或忽略，不应阻断同主版本导入。

## 图层角色

- `primary`：研究主线；更高不透明度、字重和边框。
- `context`：专题相关的政治、人物、制度等参照；虚线边框。
- `anchor`：关键时点；菱形点与独立角色标记。
- `background`：可复用广域背景；较低不透明度和纹理。

图层角色不能只靠颜色表达。无 Manifest 时，导入器按文件名中的 `背景`、`anchor`、政治 / 战争等关键词保守推断，用户可覆盖。

## LOD

一对 overview / detailed 图层使用相同 `lod.key`：

```json
{
  "lod": {
    "key": "sushi-life",
    "level": "overview",
    "switchSpan": 45
  }
}
```

- 当前视窗跨度大于 `switchSpan` 时选 overview。
- 小于等于阈值时选 detailed。
- 两者不会同时绘制。
- `lodMode: manual` 停止自动切换，尊重用户可见状态。

无显式 LOD 时，会识别 `_overview` / `_detailed`。高密度视窗还会进入 `representative` 或 `aggregated`，这是绘制状态，不会修改数据。

## 命名视图

命名视图可以保存：

- 时间范围与缩放
- 图层顺序、分组、可见性、颜色、调暗和 solo
- 分组顺序、展开、可见和调暗
- 过滤、搜索、LOD 模式
- 探针和选中事件

视图恢复只更新仍存在的图层和分组；项目后来新增的内容不会被删除。

## 版本与迁移

`src/project.js` 的 `migrateManifest()` 是唯一迁移入口：

- `1.x` 可以添加向后兼容迁移，导入时先克隆再迁移。
- 更高主版本不会假装完整兼容；会生成质检错误并只尝试读取安全的 CSV。
- 导出始终写当前 `PROJECT_VERSION`。

## 导出一致性

导出项目后重新导入应保持：

- 项目字段、图层和分组
- 图层角色、顺序、颜色、可见性和 LOD
- 事件标题、原始时间与元数据
- 命名视图、探针、过滤与搜索
- 来源和 references

Node 测试覆盖此 round-trip。

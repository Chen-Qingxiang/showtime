# 事件元数据与来源 sidecar

## 原则

主 CSV 不增加列。扩展研究信息放在可选 sidecar 中：

- `event_meta.json`：事件说明、人物、地点、标签、可信度、研究笔记和外部链接
- `sources.csv`：可重复的一对多来源记录
- `references.md`：项目级参考资料和研究说明

## 稳定事件匹配

导入每个 CSV 时，ShowTime 使用以下规范化键生成确定性内部 ID：

```text
layer + raw time + title + occurrence
```

- `layer`：图层 ID 或名称
- `raw time`：主 CSV 中原始 `time` 文本
- `title`：规范化 Unicode 后的标题
- `occurrence`：完全重复记录从 1 开始的序号

sidecar 可直接写导出项目中的 `id`，也可使用上述字段。若省略 occurrence 后匹配多个事件，会报告 `sidecar_ambiguous`，不会擅自挑选。

## event_meta.json

推荐结构：

```json
{
  "version": "1.0",
  "events": [
    {
      "layer": "苏轼生平 detailed",
      "time": "1079",
      "title": "乌台诗案",
      "occurrence": 1,
      "description": "仕途与创作阶段的重要转折。",
      "location": ["湖州", "开封"],
      "people": ["苏轼"],
      "tags": ["政治", "贬谪"],
      "certainty": "certain",
      "notes": "研究笔记",
      "externalLinks": ["https://example.org/record"]
    }
  ]
}
```

也接受事件数组，或以事件 ID 为键的对象。

建议的 `certainty` 值：

- `certain`
- `approximate`
- `disputed`
- `inferred`

应用不会强制枚举，以便研究项目使用自己的术语。

## sources.csv

```csv
event_id,layer,time,title,occurrence,source,page,url,quotation,notes
,苏轼生平 detailed,1079,乌台诗案,1,《宋史·苏轼传》,338,https://example.org,,核对版本
```

匹配优先使用 `event_id`；没有 ID 时使用 layer / time / title / occurrence。一个事件可以有多行来源。

URL 只在协议为 HTTP / HTTPS 时渲染为外部链接，并以 `noopener noreferrer` 打开。

## 编辑与导出

右栏轻量编辑器可以修改时间、标题和主要元数据，也可以新增或删除事件。修改后的数据导出时：

- 每个图层仍写成两列 CSV
- 非来源元数据写入 `event_meta.json`
- 来源数组展开为 `sources.csv`
- 项目级参考资料写入 `references.md`

编辑支持基本撤销和重做，但 ShowTime 不是大型 CMS；批量史料整理仍建议在文本工具或表格中完成。

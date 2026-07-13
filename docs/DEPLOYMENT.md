# GitHub Pages 部署

ShowTime 是不需要构建的纯静态站点。当前仓库使用 GitHub Pages legacy 分支发布：

- 分支：`main`
- 目录：仓库根目录 `/`
- 线上地址：<https://chen-qingxiang.github.io/showtime/>

## 为什么无需 workflow

根目录直接包含 `index.html`、`styles.css`、`app.js`、`src/`、`examples/` 和 `background/`。浏览器原生加载 ES modules；没有 bundle、后端或环境变量。

## 发布检查

```bash
npm run check
npm run dev
```

本地验证首页、示例项目、背景 Manifest 和项目 ZIP 均返回 200：

```text
/
/background/manifest.json
/examples/苏轼与北宋背景.showtime.zip
```

提交到 `main` 后，GitHub Pages 会重新发布。若以后改为 GitHub Actions，仍应直接上传仓库静态内容，不需要生成 `dist/`。

## 子路径注意事项

线上站点位于 `/showtime/`，所以代码必须：

- 使用相对 URL，如 `background/manifest.json`
- 分享链接以当前 `location.pathname` 为基准
- 不写死域名根路径 `/examples/...`
- 保持文件名 UTF-8 可访问

## MIME 与缓存

GitHub Pages 会为 `.js`、`.json`、`.csv`、`.svg` 和 `.zip` 提供可用的静态 MIME。项目读取使用 `cache: no-store`，避免开发和研究数据更新后继续看到旧文件；站点外壳仍由 GitHub Pages 正常缓存。

## 故障排查

- 页面空白：检查控制台是否有 ES module 404 或语法错误。
- 示例无法打开：确认 ZIP 已提交，而不仅是 fixture 源目录。
- 本地 `file://` 失败：ES module 和 fetch 需要 HTTP；运行 `npm run dev`。
- 分享链接打不开本地数据：这是设计限制；接收者必须先打开同一项目包。

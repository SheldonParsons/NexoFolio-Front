# 产品文档与更新日志

这些文件是站内静态内容，不读取项目接口、录制数据或业务凭证。

- `docs/*.md`：产品文档正文。标题、描述、所属栏目和路由在 `src/features/product-docs/content.ts` 登记。
- `changelog/*.md`：更新日志正文。产品、日期、版本、标题和独立路径同样在 `content.ts` 登记。
- 使用 `##` 作为正文一级章节，自动生成页内链接。Markdown 内禁用 HTML；站内 `/docs`、`/changelog` 链接会适配部署 BASE_URL。
- 新增文章时导入对应 Markdown 并加入内容数组，即可出现在目录与全文搜索中。
- 不依赖截图。Markdown 支持段落、列表、表格、引用与代码片段。
- 产品日志只能记录实际发布内容。当前 `product-docs-preview` 是明确标记的文档预览，不能当成产品安装包发布记录。

入口：`/docs`、`/docs/mcp`、`/changelog`；开放 API 概览在 `/docs/api`。这些路由允许未登录阅读，工作空间权限与下载功能保持原有边界。

部署继续使用现有 Vite 静态构建与 NGINX history fallback；直接访问文章路径需要回退到 `index.html`。

# 产品文档与更新日志

这些文件是站内静态内容，不读取项目接口、录制数据或业务凭证。

- `docs/*.md`：产品文档正文。标题、描述、所属栏目和路由在 `src/features/product-docs/content.ts` 登记。
- `changelog/*.md`：更新日志正文。产品、日期、版本、标题和独立路径同样在 `content.ts` 登记。
- 使用 `##` 作为正文一级章节，自动生成页内链接。Markdown 内禁用 HTML；站内 `/docs`、`/changelog` 链接会适配部署 BASE_URL。
- 新增文章时导入对应 Markdown 并加入内容数组，即可出现在目录与全文搜索中。
- 不依赖截图。Markdown 支持段落、列表、表格、引用与代码片段。
- 产品日志只能记录实际发布内容。当前 `product-docs-preview` 是明确标记的文档预览，不能当成产品安装包发布记录。

入口：`/docs`、`/docs/mcp`、`/changelog`；录入接口文档在 `/docs/api`，其中的校验工具读取 `src/contracts/collect/1.0.0`，JSON 示例由 `tests/collect-contract.test.ts` 按合同校验。这些路由允许未登录阅读，工作空间权限与下载功能保持原有边界。

部署继续使用现有 Vite 静态构建与 NGINX history fallback；直接访问文章路径需要回退到 `index.html`。

Fetcher 的分步操作、成功标志与 FAQ 统一维护在 `src/features/product-docs/fetcherGuide.ts`，由 `FetcherGuide.vue` 呈现，并合入文档搜索索引。界面示例图位于 `public/docs/fetcher/`，来源记录见 `docs/fetcher-guide-assets.md`。

录入接口页使用 `CollectQuickstart.vue` 串起选择、校验、发送和回执；JSON 示例继续从 `api.md` 读取，字段参考也复用原正文。cURL 生成与章节解析见 `features/collect-docs/guide.ts`。合同下载包 `public/contracts/collect-1.0.0.zip` 包含固定合同目录及原 manifest，更新合同版本时应一起重新打包并核对哈希。

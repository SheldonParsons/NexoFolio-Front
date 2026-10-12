# 产品文档与更新日志

这些文件是站内静态内容，不读取项目接口、录制数据或业务凭证。

- `docs/*.md`：产品文档正文。标题、描述、所属栏目和路由在 `src/features/product-docs/content.ts` 登记。
- `changelog/*.md`：更新日志正文。产品、日期、版本、标题和独立路径同样在 `content.ts` 登记。
- 使用 `##` 作为正文一级章节，自动生成页内链接。Markdown 内禁用 HTML；站内 `/docs`、`/changelog` 链接会适配部署 BASE_URL。
- 新增文章时导入对应 Markdown 并加入内容数组，即可出现在目录与全文搜索中。
- 不依赖截图。Markdown 支持段落、列表、表格、引用与代码片段。
- 产品日志只能记录实际发布内容。当前 `product-docs-preview` 是明确标记的文档预览，不能当成产品安装包发布记录。

## 更新日志的默认内容范围

按用户要求，公开更新日志只描述用户可感知的功能、体验和接入变化。后台审计、内部调用追踪、固定账号白名单及账号特殊授权/处理不进入更新日志，包括标题、摘要和正文；这些实施记录留在内部工程文档中。用户可见的整理操作记录功能与后台审计分别处理。

将本轮完整交付作为更新内容，不写“待前端发布”等内部发布阶段话术，也不把未实现的计划描述为现有能力。检索减少重复读取可描述具体行为，不用返回字符减少比例冒充模型 token 或整体速度提升。

MCP 使用说明介绍资料结构、每层用途和收益；检索入口、路线、深度及停止时机由 Agent 按业务目标自主决定。示例路线不是必走流程，减少读取不能阻止任务必要的完整核实。网页和动态接入话术的核心说明共用 `mcpPurpose`，完整参考沿用相同生成函数。

入口：`/docs`、`/docs/mcp`、`/changelog`；录入接口文档在 `/docs/api`，其中的校验工具读取 `src/contracts/collect/1.0.0`，JSON 示例由 `tests/collect-contract.test.ts` 按合同校验。这些路由允许未登录阅读，工作空间权限与下载功能保持原有边界。

部署继续使用现有 Vite 静态构建与 NGINX history fallback；直接访问文章路径需要回退到 `index.html`。

Fetcher 的分步操作、成功标志与 FAQ 统一维护在 `src/features/product-docs/fetcherGuide.ts`，由 `FetcherGuide.vue` 呈现，并合入文档搜索索引。界面示例图位于 `public/docs/fetcher/`，来源记录见 `docs/fetcher-guide-assets.md`。

录入接口页使用 `CollectQuickstart.vue` 串起选择、校验、发送和回执；JSON 示例继续从 `api.md` 读取，字段参考也复用原正文。cURL 生成与章节解析见 `features/collect-docs/guide.ts`。合同下载包 `public/contracts/collect-1.0.0.zip` 包含固定合同目录及原 manifest，更新合同版本时应一起重新打包并核对哈希。

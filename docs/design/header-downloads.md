# Header 下载入口

## 后端版本接口

网页仅请求现有同源 API：`GET /api/v1/downloads?desktop_channel=internal|public`，由代理转发到后端 `/v1/downloads`。默认 internal。获取版本不再依赖 OSS CORS；安装包仍通过普通链接从 OSS 下载。

### 服务端读取的发布地址

- Fetcher：`https://asynctest.oss-cn-shenzhen.aliyuncs.com/nexofolio_fetcher/latest.json`
- AsyncTest 默认 Gree 内部版：`https://asynctest.oss-cn-shenzhen.aliyuncs.com/core/updates/internal/`。
- AsyncTest 公网版：`https://asynctest.oss-cn-shenzhen.aliyuncs.com/core/updates/public/`。两个渠道分别读取各平台已有的 latest.yml / latest-mac.yml。
- 这些上游地址由后端配置；前端删除了对应 `VITE_*_RELEASE_BASE_URL` 配置，只使用网站已有的 `VITE_API_BASE_URL`（默认 `/api`）。部署时保持 `/api` 与网页同源反向代理。

Fetcher 标为开发版，下载 ZIP 后解压，直接选内含 manifest.json 的文件夹加载。AsyncTest 菜单区分 Windows x64、Mac Apple Silicon 与 Mac Intel；Mac 选择 DMG，不把自动更新器 ZIP 当作安装包。

AsyncTest 下载面板使用单选分段控件切换「Gree 内部版 / 公网版」，每次整页启动默认内部版，同一页面会话内保留当前选择。Header 版本号和三个安装包均属于选中渠道；两渠道独立缓存、独立在途请求，未发布/加载失败不会替用户切换到另一渠道。

Fetcher 的下载 URL 由后端根据发布目录与已验证的 artifact.filename 组成，前端使用后端返回的 URL。已上传旧清单可能保留 artifact.url 的连字符路径，这个旧地址不再控制网页下载目标。本地发布清单和后续打包脚本已同步为下划线目录，建议覆盖上传新的 latest.json；ZIP 内容与校验值不变。

## 数据与交互

`WorkspaceDownloads.vue` 是两个 NavigationMenuItem，加入现有 NavigationMenuRoot，共用原来的浮层与切换动画。Header 显示产品图标、版本号，展开后点击安装包链接下载。Fetcher 使用既有 NexoFolio 图标；AsyncTest 图标取自用户提供的 `core/logo/logo_full.svg`，本地保存在 `public/brand/asynctest-icon.svg`。

版本由 `useDownloads.ts` 通过网站 API 客户端读取：每个渠道一次请求，不携带登录凭据、不进入项目请求计数、不阻塞项目转场，前端请求超时 10 秒。后端负责 5 分钟缓存，前端不再叠加另一层时效缓存；仅保留各渠道展示状态及在途请求去重。切换渠道和手动“重新检查版本”都会请求后端，但不发送后端不支持的强制刷新参数。失败时不回退到浏览器直读 OSS。

后端返回 schema_version、desktop_channel、fetcher 与 desktop。每项独立包含 ready/unpublished/error 状态与 release；Fetcher 同时返回 minimum_chrome_version、development、load-unpacked 信息。前端校验响应渠道、三个平台、文件类型、文件名和 HTTPS 链接，保留开发版说明。已移除前端 YAML 解析及 yaml 直接依赖。

并行切换渠道时，每个响应只更新自己的桌面列表；共用 Fetcher 信息仅由较新的请求更新，旧响应不会覆盖新结果。

1280px 以下 Header 分行，以免下载入口挤到账户区；手机保留两个下载入口和开发版标记。

## 用户上传步骤

1. 先上传 `NexoFolio-Fetcher-0.1.0-dev.zip` 至 bucket 根目录下的 `nexofolio_fetcher/`。
2. 确认文件可下载后，将同批生成的 `latest.json` 上传到相同目录。
3. latest.json 使用 `application/json`，建议 `Cache-Control: no-cache`；ZIP 使用 `application/zip`，可设置 `Content-Disposition: attachment`。
4. 后端需要能读取清单，浏览器需要能下载安装包；网页不再获取 OSS JSON/YAML，因此不需要为版本获取新增 OSS CORS 配置。
5. 后端缓存最长 5 分钟；缓存更新后，回到 Header 点“重新检查版本”即可读取后端结果。

该 ZIP 的根目录直接包含 manifest.json，不包含 chrome-mv3 包装目录。GUI 解压后选生成的文件夹；手动 unzip 时应指定独立目标目录。开发版后续更新建议覆盖同一个固定安装目录，再在扩展程序页重新加载。

## 历史验证（迁移前的浏览器直读实现）

- Fetcher 使用 Node 24 执行 npm run build；包结构、入口文件、ZIP CRC、SHA-256 均由打包流程核对。未安装扩展或进行真实录制验收。
- 前端 13 项版本解析测试通过，覆盖 Mac DMG 选择、Windows 路径、清单不完整、版本/文件不一致与目录外地址；类型检查及构建通过。
- 通过浏览器工具查看实际 Header，并操作两个下载菜单。AsyncTest 从真实 OSS 清单显示 v3.3.10，三个平台链接对应现有 EXE/DMG。
- Fetcher 上传后的状态使用本次生成的 latest.json 做页面内预览，显示 v0.1.0 / 开发版，ZIP URL 与实际待上传文件一致；这不表示文件已上传。
- 浏览器验证使用临时页面的合成认证和目录数据，不使用真实账户。复核了 375px 和 1101px 布局；发现临界宽度重叠后提高换行断点，复核无重叠或横向溢出。临时页面与代理在交付前删除/停止。

插件加载方式参考 [Chrome 官方说明](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked)。

### 2026-09-15 目录纠正与双渠道验证

版本解析与渠道归属共 17 项测试通过，类型检查和生产构建通过。浏览器使用合成项目登录态，但 Fetcher 和 AsyncTest 的清单均读取真实 OSS：Fetcher 下载地址为 nexofolio_fetcher，默认 Gree 内部版的三个链接位于 internal，点击公网版后三个链接均位于 public，键盘左箭头可切回内部版且保持菜单展开。

已读取实际上传 ZIP 并核对字节数和 SHA-256，与本地 0.1.0 开发版一致；内部版三个安装包的 HEAD 均返回 200。没有修改 OSS 对象，没有重新上传 ZIP。修正后的本地 latest.json 可供用户覆盖上传。

## 后端接口迁移验证

2026-09-15：前端已按后端任务确定的契约接入。下载响应、渠道切换、同源请求、错误不回退 OSS 等 15 项下载测试通过；连同 API 客户端和项目刷新共 49 项测试通过，类型检查及构建通过。后端实现和服务接入由“后端下载版本聚合接口”任务与主后端协调，服务尚未接入时网页显示暂不可用。已通过18981隔离服务与真实OSS的浏览器联调，见 `docs/verification/2026-09-15-downloads-backend-integration.md`；现用18080已在用户确认后重建并验证，internal/public与5173同源代理均200，详见后端 docs/verification/2026-09-15-downloads-service-load.md。

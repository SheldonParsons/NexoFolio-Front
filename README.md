# NexoFolio Front

NexoFolio 接口知识库的前端应用。采用 Vue 3 + TypeScript + Vite，构建产物由 Nginx 直接托管。

## 当前范围

首页 `/` 为纯黑底品牌展示页，使用官方 Logo，提供三阶段知识流程演示和工作空间入口。演示使用明确标注的概念样例，不连接真实数据。详见[首页展示方案](docs/design/homepage.md)。

主视觉使用本地 3D 弹性 Logo 模块，包含约 2.2 秒固定镜头开场及两侧碰撞传力，整个视角向右倾斜 8°。约 1.9 MB 的 ESM 在首页按需加载，Three.js、模型和材质已内嵌，部署无需额外运行时或素材服务器（修改素材逻辑后执行 `pnpm build:logo` 重建独立模块）。无法加载或 WebGL 不可用时显示同版本黑色静态图。触屏允许纵向滚动，横向拖动可拉扯 Logo；离开首页会清理资源。来源和版本见 [vendor 说明](vendor/nexofolio-elastic/README.md)。

已搭建应用外壳、项目空间与接口目录的待接入页面、404 页面、偏好设置、快速导航、主题持久化，以及独立 HTTP 请求层。

项目页采用固定工具栏、最近访问与完整项目列表，搜索支持全部 Mock 项目。开发默认 Mock，生产默认真实 API；界面不显示已移除的示例数据标签。真实旧接口模式禁用搜索和权限筛选，后端支持新查询契约后才能显式启用。项目内接口文档已接入环境选择、观测结构和按需样例／差异展示；本平台不提供手动创建项目的入口。

## 本地开发

使用 Node.js 22.13+（`.nvmrc` 为 22）。包管理器版本固定在 package.json：pnpm 11.19.0；该版本 pnpm 要求 Node.js 至少为 22.13。

```bash
corepack enable
corepack prepare pnpm@11.19.0 --activate
pnpm install --frozen-lockfile
pnpm dev
```

默认地址：[http://127.0.0.1:5173](http://127.0.0.1:5173)。端口被占用时启动会失败，不会自动切换到未知端口。需要其他端口时使用 `pnpm dev --port 5174`。

没有 Corepack 的环境可安装 `pnpm@11.19.0`。esbuild、vue-demi 所需安装脚本已在 pnpm-workspace.yaml 中显式允许。

## 常用命令

| 命令             | 作用                                 |
| ---------------- | ------------------------------------ |
| `pnpm dev`       | 启动开发服务                         |
| `pnpm typecheck` | 检查 Vue、应用和配置类型             |
| `pnpm test`      | 运行请求、项目查询和转场生命周期测试 |
| `pnpm build`     | 类型检查后构建 dist                  |
| `pnpm preview`   | 本地预览 dist，默认端口 4173         |
| `pnpm format`    | 格式化代码和文档                     |
| `pnpm check`     | 格式检查、测试、生产构建             |

依赖和锁文件一起提交，CI 使用 frozen-lockfile。`vite preview` 仅用于本地预览，不作为生产服务。

## 目录与职责

```text
src/
├── app/                      # 应用装配、布局、路由、页面导航定义
├── pages/                    # 页面入口，按路由懒加载
├── features/navigation/      # 快速导航业务组合
├── features/projects/        # 项目查询、最近访问、准入、列表与组件 tokens
├── components/
│   ├── ui/                   # 基础按钮、弹层、空状态
│   ├── motion/               # Transitions.dev 动效适配
│   └── icons/                # Morphicons 优先、Lucide 回退
├── api/                      # fetch 客户端与后续领域 API 入口
├── stores/                   # 跨页面偏好
└── styles/                   # 主题 tokens、布局与基础样式
tests/                        # 有意义的传输契约验证
deploy/                       # Nginx 配置与静态运行镜像
docs/                         # 选型、来源与验收记录
```

业务页通过 `components` 封装使用第三方库；第三方更换集中在封装内。未来登录、项目、接口功能按业务放入 `features`，请求契约放入对应 `api` 模块，避免组件直接拼接 URL。

组件顺序：Transitions.dev → Reka UI → 特殊业务自研。图标顺序：Morphicons → Lucide → 特殊图形自研。
详见[组件来源与适配](docs/component-sources.md)和[技术选型](docs/decisions/0001-frontend-stack.md)。

## 连接后端

复制 `.env.example` 为 `.env.local`，按实际服务配置：

```dotenv
VITE_API_BASE_URL=/api
DEV_API_PROXY_TARGET=http://127.0.0.1:18080
```

`DEV_API_PROXY_TARGET` 仅供 Vite 开发代理使用，默认是后端 Compose 映射地址 `http://127.0.0.1:18080`。浏览器请求 `/api/v1/...`，开发代理去掉 `/api` 后转发至后端 `/v1/...`。后端必须实际运行，部署到其他地址时修改该配置。生产环境 Nginx 也应去掉 `/api/` 前缀。
`VITE_API_BASE_URL` 是构建时公开配置，修改后需要重新构建。同源 `/api` 能让同一份静态产物在不同环境部署。

请求层支持 JSON、取消、包含响应读取的总超时、401 回调和统一错误；写请求不自动重试。登录状态由 `/v1/auth/me` 验证，网络故障与凭证失效区分处理，不伪造登录成功。TypeScript 的返回类型不是运行时 Schema 校验，接入真实接口时在领域 API 层校验数据。

所有 VITE\_\* 变量都可能出现在浏览器产物中。禅道凭证、超级密码和服务器密钥只在后端使用，不写入前端配置或代码。

## Nginx 静态部署

```bash
pnpm install --frozen-lockfile
pnpm build
```

将整个 `dist/` 上传到服务器，入口是 `index.html`，JS/CSS 等资源位于 `assets/`。运行前端只需要 Nginx，无需 Node.js、pnpm 或 Vite 服务。

使用 [deploy/nginx.conf](deploy/nginx.conf)，按实际路径修改 `root`，并按服务器部署情况设置监听端口和域名。当前示例监听 8080。

- History 路由使用 SPA 回退，直接访问和刷新 `/settings` 等路径可正常载入。
- `index.html` 要求缓存重新验证，带哈希的 assets 长期缓存；不存在的 assets 返回 404。
- `/api` 与 `/api/` 当前明确返回 503 JSON，避免后端尚未配置时被当成前端页面。

后端就绪后，用下面的代理替换示例中的两个 API location（示例地址需按实际环境修改）：

```nginx
location = /api {
    proxy_pass http://127.0.0.1:18080/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
location ^~ /api/ {
    proxy_pass http://127.0.0.1:18080/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

代理目标末尾的 `/` 用于去掉 `/api/` 前缀（浏览器 `/api/v1/auth/me` → 后端 `/v1/auth/me`）。HTTPS 在服务器入口配置。若部署在 `/nexofolio/` 等子目录，需要同时调整 Vite base、路由 base 和 Nginx 回退路径；当前产物按站点根目录部署。

也可以使用只包含静态产物和 Nginx 的镜像：

```bash
pnpm build
docker build -f deploy/Dockerfile -t nexofolio-front:0.1.0 .
docker run --rm -p 127.0.0.1:8080:8080 nexofolio-front:0.1.0
```

## 开发约定

- 项目与构建文件统一使用 TypeScript、Vue 单文件组件和 CSS tokens。
- 页面和第三方组件适配分离，优先按需导入。
- 默认浅色（纯白底），深色使用纯黑底；支持手动选择跟随系统并实时响应设备外观变化；localStorage 不可用时仍能正常使用。
- 控件保留键盘导航与可见焦点，图标和动效遵循减少动态效果设置。
- `.env.local`、node_modules、dist、截图等本地验证产物均不提交。
- 不在页面中将“服务未接入”显示为“服务已连接但没有数据”。

## 登录与首页入口

首页 `/` 始终展示品牌页面，即使已经登录也不会自动进入项目页。三个“进入 NexoFolio”按钮共用入口：验证本地 Token 对应的 `/v1/auth/me`，成功进入 `/projects`，无凭证或 401 时打开登录弹层。直接访问受保护的项目、接口、设置页面也经过相同检查，未登录时回到首页弹层，成功后返回原目标。

登录使用 `POST /v1/auth/login`，只发送 account/password。普通禅道密码或超级密码由后端判定，前端仅在用户选择“记住账号和密码”并真实登录成功后，将账号密码保存在当前浏览器；取消勾选立即清除。平台 Token 与 expires_at 存放在 localStorage，支持刷新后恢复；浏览器禁止存储时仅在当前标签页内保留。退出登录清除当前浏览器凭证；后端没有撤销接口，因此不宣称会撤销其他设备会话。

弹层支持取消请求、密码显隐、输入长度检查、登录忙/网络错误提示；登录成功前不跳转。登录接入初期未进行真实账号验收；项目页重构阶段使用隔离账号响应验证转场，不代表真实禅道联调成功。后端实际地址仍需部署配置。

### 记住密码与登录转场

- 复用 Fetcher 当前规则：默认勾选，按站点/API 服务保存；登录成功才更新账号密码，登录失败不覆盖之前成功记录。取消勾选立即清空持久化账号密码，不删当前正在输入的内容；重新勾选只保存偏好。
- 退出登录只清会话，不清记住的账号密码。凭证过期不会自动拿已记住的密码登录；再次打开弹层时回填，由用户提交。
- 网页使用 localStorage，属于站点可读取的本地保存，不是加密密码库；它与扩展 chrome.storage 的隔离边界不同。存储不可用时提示，已成功的登录不因此失败。
- 真实登录成功后固定播放 3000ms 转场，包含末尾淡出。使用全屏黑底 Logo 与字标流光，和项目转场共用视觉组件。目标页面在遮罩下开始挂载，期间禁止底层点击/键盘操作，完成归还焦点。
- 转场只在登录请求成功时触发，已有 Token 的会话恢复不重播。runId 防止旧回调结束新动画，卸载时清理 RAF、定时器和媒体监听；减少动态效果时去除位移旋转，仍保留固定时长。
- 项目页重构阶段已允许并执行前端测试、浏览器检查与生产构建，详见本轮验收记录；真实账号接入仍需单独联调。

### 滚动边界

html/body/app 固定视口并禁止外层滚动、回弹。工作空间的顶栏与侧栏保持在视口内，中间 workspace-scroll 承载页面和页脚滚动；侧栏仅在自身内容溢出时内部滚动。首页使用独立 homepage 滚动容器，路由锚点只操作内部容器。滚动容器与弹窗禁用 overscroll 链式传播，后续列表/面板可在固定布局内进一步划分滚动区域。

### 项目页与 Mock

项目页采用 64px 顶栏、左侧品牌大标题与右侧开放目录的构图，桌面项目行高 56px；最近访问和全部项目处于同一滚动区，每页 10 条且分页固定。开发默认加载 18 个虚构项目，搜索与权限筛选先作用于全部集合再分页。最近访问最多展示 3 条，本地只保存最近 20 个 ID 和时间，按 API 服务、账号、Mock/Live 隔离。

设置 `VITE_PROJECTS_SOURCE=live` 切换真实列表和详情；旧接口模式只发送 page/limit，并明确禁用搜索与权限筛选。只有确认后端已部署 q/access_state 查询契约后，才设置 `VITE_PROJECTS_QUERY_API=true` 并重建。Mock 不绕过登录、不写后端，真实请求失败不自动回退到 Mock。详见[项目页设计与契约](docs/design/projects.md)和[本轮验收记录](docs/verification/2026-09-14-projects-refactor.md)。

### 统一页面转场

`components/brand/BrandTransition.vue` 提供全屏 Logo（含字标）流光。进入项目固定 2 秒、登录固定 3 秒；其他受保护路由随准入请求和页面加载完成结束。`stores/navigationTransition.ts` 的 start/settle/finish 用于后续业务接入，未指定时长时不增加固定等待。

### 项目内接口列表与观测文档

进入项目后，先手动选择环境，再按方法/路径搜索接口。右侧展示当前环境的观测定义、限制及来源；调用样例和完整原文按需读取。差异只作为待处理提议展示，不覆盖当前基线，没有裁决或重处理操作。

本工作区 `.env.local` 已将 `VITE_PROJECTS_SOURCE` 与 `VITE_DOCUMENTS_SOURCE` 同时设为 `live`，使用现有 18080 代理。请从项目列表重新进入真实项目。需要独立的契约示例时，两项一起切为 `mock`；真实读取不会在失败时静默回退为示例。

机器契约固定在 `src/contracts/documents/1.0.0` 与 `src/contracts/ingestion/2.0.0`，运行时按 Schema 校验。详情及“不测试”的验证边界见 [接口文档设计与接入](docs/design/interface-documents.md)。

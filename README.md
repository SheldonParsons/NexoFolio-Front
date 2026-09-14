# NexoFolio Front

NexoFolio 接口知识库的前端应用。采用 Vue 3 + TypeScript + Vite，构建产物由 Nginx 直接托管。

## 当前范围

已搭建应用外壳、项目空间与接口目录的待接入页面、404 页面、偏好设置、快速导航、主题持久化，以及独立 HTTP 请求层。

项目、接口页面当前明确显示服务待接入状态，未使用模拟数据。禅道登录、真实项目同步、接口查询和裁决操作等待后端契约接入；本平台不提供手动创建项目的入口。快速导航目前只搜索页面，不执行知识检索。

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

| 命令             | 作用                         |
| ---------------- | ---------------------------- |
| `pnpm dev`       | 启动开发服务                 |
| `pnpm typecheck` | 检查 Vue、应用和配置类型     |
| `pnpm test`      | 运行请求层契约测试           |
| `pnpm build`     | 类型检查后构建 dist          |
| `pnpm preview`   | 本地预览 dist，默认端口 4173 |
| `pnpm format`    | 格式化代码和文档             |
| `pnpm check`     | 格式检查、测试、生产构建     |

依赖和锁文件一起提交，CI 使用 frozen-lockfile。`vite preview` 仅用于本地预览，不作为生产服务。

## 目录与职责

```text
src/
├── app/                      # 应用装配、布局、路由、页面导航定义
├── pages/                    # 页面入口，按路由懒加载
├── features/navigation/      # 快速导航业务组合
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
DEV_API_PROXY_TARGET=http://127.0.0.1:8000
```

`DEV_API_PROXY_TARGET` 仅供 Vite 开发代理使用，保留 `/api` 前缀，不自动改写路径。生产环境由 Nginx 配置同源代理，实际前缀以后端契约为准。
`VITE_API_BASE_URL` 是构建时公开配置，修改后需要重新构建。同源 `/api` 能让同一份静态产物在不同环境部署。

请求层支持 JSON、取消、包含响应读取的总超时、401 回调和统一错误；写请求不自动重试。未来会话层应绑定 `onUnauthorized`，本阶段没有伪造登录状态。TypeScript 的返回类型不是运行时 Schema 校验，接入真实接口时在领域 API 层校验数据。

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
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
location ^~ /api/ {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

该写法保留请求 URI，不会去掉 `/api`。HTTPS 在服务器入口配置。若部署在 `/nexofolio/` 等子目录，需要同时调整 Vite base、路由 base 和 Nginx 回退路径；当前产物按站点根目录部署。

也可以使用只包含静态产物和 Nginx 的镜像：

```bash
pnpm build
docker build -f deploy/Dockerfile -t nexofolio-front:0.1.0 .
docker run --rm -p 127.0.0.1:8080:8080 nexofolio-front:0.1.0
```

## 开发约定

- 项目与构建文件统一使用 TypeScript、Vue 单文件组件和 CSS tokens。
- 页面和第三方组件适配分离，优先按需导入。
- 深浅主题遵循系统并支持手动选择；localStorage 不可用时仍能正常使用。
- 控件保留键盘导航与可见焦点，图标和动效遵循减少动态效果设置。
- `.env.local`、node_modules、dist、截图等本地验证产物均不提交。
- 不在页面中将“服务未接入”显示为“服务已连接但没有数据”。

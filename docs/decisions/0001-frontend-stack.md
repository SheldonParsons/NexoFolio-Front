# ADR 0001：前端技术选型与静态部署

日期：2026-09-14

状态：基础工程已落地。静态部署要求、组件与图标优先级作为持续约束；依赖已锁定，验证记录见[基础工程验收](../verification/2026-09-14-foundation.md)。后端业务接入另行实施。

## 1. 项目范围

前端仓库：`/Users/sheldon/Documents/GithubProject/NexoFolio-Front`。
本任务后续围绕前端开发，后端代码位于独立仓库 `NexoFolio`。
前端以静态 SPA 形式交付，由 Nginx 托管构建产物；登录、项目同步、知识处理等业务能力通过后端 HTTP API 获取。

## 2. 用户指定的优先级

- 组件与交互动效：优先使用 Transitions.dev；不足时使用 Reka UI；特殊业务内容自行实现。
- 图标：优先使用 Morphicons；不满足时使用 Lucide；特殊图形按需自行实现。
- 不引入需要生产环境 Node.js 服务端运行时的渲染方案。

“不满足”包括缺少功能、目标框架无法适配、键盘/焦点行为不完整、性能或可访问性不符合实际使用要求。
每个基础组件保留来源与采用理由，不能因为 Reka 更熟悉而跳过 Transitions.dev 的适用性判断。

## 3. 推荐技术栈

| 部分     | 选择                                     | 用途                                                           |
| -------- | ---------------------------------------- | -------------------------------------------------------------- |
| UI 框架  | Vue 3，Composition API + 单文件组件      | 与 Reka UI 和 Morphicons Vue 适配直接配合                      |
| 语言     | TypeScript                               | 管理接口契约、组件 props、事件与业务状态                       |
| 构建     | Vite + Vue 插件                          | 输出静态 HTML、JS、CSS 与其他资源                              |
| 路由     | Vue Router，HTML5 History 模式           | 项目、目录和接口详情路由；Nginx 配置入口回退                   |
| 共享状态 | Pinia                                    | 保存登录状态、当前项目与跨页面偏好；页面临时状态留在本地       |
| HTTP     | 原生 fetch 的统一请求层                  | 统一处理基础 URL、取消、鉴权失效、错误；业务页面不直接拼接 URL |
| 样式     | CSS 变量 + Vue scoped CSS                | 统一颜色、间距、圆角、层级和动画参数；复用 Transitions.dev CSS |
| 组件来源 | Transitions.dev → Reka UI → 特殊业务自研 | 通过项目组件封装向页面提供稳定 API                             |
| 图标     | morphicons/vue；Lucide 按需补充          | 统一通过 AppIcon/MorphIcon 封装使用                            |
| 包管理   | pnpm + pnpm-lock.yaml                    | 初始化时选择兼容版本并锁定；Node.js 仅用于开发与构建           |

具体版本以 package.json 和 pnpm-lock.yaml 为准。开发工具链要求 Node.js 22.13+、pnpm 11.19.0；生产前端仅由 Nginx 运行。

## 4. 四个站点的实际角色

### Transitions.dev

安装文档提供复制 CSS/React 片段、CLI、Skill 等引入方式，CSS 使用命名空间与可调整变量。
Vue 项目优先选择 CSS 片段，再在 Vue 单文件组件内连接状态；不能直接把 React 片段当成 Vue 组件导入。
它适合优先提供弹层、面板、Tabs、状态切换等动效。针对完整控件，还要检查实际状态、焦点、键盘与表单行为。
按需引入所用片段，记录来源；CLI/Skill 不是生产站点运行依赖。

### Reka UI

作为 Transitions.dev 无法满足控件行为时的补充，用于组合 Vue 控件原语。
可以让 Reka 控制弹层/焦点/选择行为，同时保留 Transitions.dev 动效，但一个控件只能有一个明确的状态和焦点管理者。
用户指定的 Autocomplete 文档目前标记 Alpha；采用前验证对应发布版本、输入法、键盘、焦点和受控状态，通过项目封装隔离变动。
Autocomplete 支持自由输入；必须从已有项目中选择时，应评估 Combobox/Select，不能只因为提供了 Autocomplete 链接就允许创建项目。

### Morphicons 与 Lucide

Morphicons 官方提供 `morphicons/vue`，接收 IconNode 或 SVG 路径等图形数据，并支持图标间形变。
Lucide 可以同时作为图形数据来源：Morphicons 示例从 `lucide` 导入数据；Vue 组件不能直接当作 Morphicons 的 icon 数据。当前使用 `@lucide/vue` 提供静态回退，旧 `lucide-vue-next` 已被 npm 标记废弃。
因此在 Morphicons 内使用 Lucide 图形数据属于优先方案，不等于绕过 Morphicons 改用静态组件。
Morphicons 无法满足时，再由统一封装选择 Lucide Vue 组件。两种 Lucide 包并存时保持版本一致，并按需导入。
默认不为无状态变化的图标制造持续动画；封装显式遵循用户减少动态效果的设置。Morphicons 文档说明其默认行为不自动遵循该设置。

## 5. 项目组件边界

基础工程结构（业务模块按需扩展）：

```text
src/
├── app/                         # 应用装配、路由、全局状态初始化
├── pages/                       # 页面入口与布局组合
├── features/                    # 登录、项目、接口知识等业务模块
├── components/
│   ├── ui/                      # 通用控件封装，隔离第三方 API
│   ├── motion/                  # Transitions.dev 片段及 Vue 状态连接
│   └── icons/                   # 图标注册、Morphicons 优先与 Lucide 回退
├── api/                         # HTTP 客户端、类型和领域 API
├── stores/                      # 少量跨页面状态
└── styles/                      # tokens、基础样式、动效规范
```

业务模块依赖项目封装，组件库替换尽量限制在 components 内。
组件库只提供呈现和交互，不承担禅道登录验证、项目权限、接口修订等后端决策。
特殊的接口目录、Schema 查看、请求/响应对比等组件放在对应 features 内，避免形成通用组件目录中的业务杂糅。

## 6. 静态部署契约

预期构建命令：`pnpm build`。Vite 默认输出：

```text
dist/
├── index.html
└── assets/
    ├── *.js
    ├── *.css
    └── ...
```

部署时把整个 dist 目录交给 Nginx，入口为 index.html。目标是一个静态发布目录，不强行将所有资源内联成一个 HTML 文件。
JS/CSS 分文件仍然是静态部署，便于按路由加载与缓存。服务器无需执行 pnpm、Vite 或 Node.js。
Vite preview 用于本地查看构建结果，不作为生产服务。

Nginx 配置要求：

- 静态根目录指向发布目录；History 路由使用 `try_files $uri $uri/ /index.html` 回退。
- assets 下不存在的资源返回 404，不能返回 HTML；带内容哈希的资源可长期缓存。
- index.html 和运行时公开配置采用重新验证或短缓存策略，避免发布后继续引用旧资源。
- 后端 HTTP API 使用独立代理 location，不进入 SPA 回退；建议同源 `/api/`，实际前缀由后端契约确定。
- 根域名部署优先；如部署到子目录，Vite base、Router base 和 Nginx 回退地址同步配置。
- 跨环境优先使用同源相对 API 路径；确需运行时配置时，可用静态公开配置文件。
- 前端构建变量与公开配置不能保存禅道服务凭证或超级密码，认证由后端执行。

## 7. 初始化后的验证范围

1. Vue + Vite 生产构建与 TypeScript 检查通过。
2. 一个 Transitions.dev CSS 动效在 Vue 中正确进入、退出和中断。
3. 一个需要复杂行为的 Reka 控件通过键盘、焦点和输入法验证。
4. Morphicons Vue 能读取 Lucide 数据并完成状态切换；回退图标尺寸、线宽保持一致。
5. Nginx 托管 dist 后，直接访问和刷新深层路由正常，静态文件与 API 不混淆。
6. API 异常或登录过期呈现正确状态；动态内容通过后端更新，静态部署不影响正常业务交互。

已完成类型检查、构建、请求层契约测试、弹层键盘与焦点、主题持久化、移动导航、减少动态效果及 Nginx 静态路由验证。真实账号登录、接口业务、实际中文输入法端到端与所有回退图标的覆盖检查不属于本次完成项，详见验收记录。

## 8. 本轮核实来源

- [Transitions.dev 安装说明](https://transitions.dev/detail.html?doc=installation)
- [Reka UI Autocomplete](https://reka-ui.com/docs/components/autocomplete)
- [Morphicons 官网](https://www.morphicons.com/)、[Vue 使用与数据格式](https://github.com/guillermolg00/morphicons)
- [Lucide Component 图标](https://lucide.dev/icons/component)
- [Vite 静态部署](https://vite.dev/guide/static-deploy.html)
- [Vue Router History 与服务器配置](https://router.vuejs.org/guide/essentials/history-mode.html)
- [Pinia 介绍](https://pinia.vuejs.org/introduction.html)

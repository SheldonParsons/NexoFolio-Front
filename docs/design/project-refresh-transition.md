# 项目页面刷新转场

## 行为

浏览器硬刷新 `/projects/:projectId/...` 时显示现有品牌转场。时间从转场组件挂载显示开始计算，持续时间为：

```text
max(2000ms, 登录校验及页面首轮加载完成的时间)
```

快速加载时，淡出包含在最短 2 秒内；慢请求超过 2 秒时，加载结束即退出。正常情况下没有人为的额外等待上限；请求沿用各 API 已有的超时设置。响应失败或请求取消同样释放等待，最终显示页面原有的错误状态。登录失效、跳转到其他路由或路由加载失败时取消本次转场，避免遮挡登录和导航恢复。

只在整页启动时根据项目路径启动这项行为，不依赖 Navigation Timing 类型。地址栏回车通常标记为 `navigate`，所以与刷新按钮、⌘R、首次直接打开项目地址一样纳入两秒等待。页面内部的 Vue Router 跳转不重新执行启动入口；点击项目的固定 2 秒转场和登录成功的固定 3 秒转场维持原行为。浏览器后退若恢复已有页面则不重播，若重新创建整页则按整页加载处理。

## 路由范围

使用项目路径前缀，不枚举页面名称：

- `/projects/:projectId/catalog`
- `/projects/:projectId/interfaces`
- `/projects/:projectId/maintenance`
- `/projects/:projectId/catalog-preview`
- 后续注册的任意项目深层路由，例如 `/projects/:projectId/catalog/interface/:interfaceId`

路由识别使用 Vue Router history 解析后的路径，支持应用部署 base；查询参数和 hash 不影响匹配。`/projects` 项目列表与项目外页面不启用刷新转场。

本次没有提前实现接口详情路由或改变 404 行为。未来路由只要注册在上述路径空间内，就会自动进入刷新逻辑。

## 等待归属

- `main.ts` 在安装 router 前创建本次刷新等待，立即挂载全局转场，避免慢登录校验期间空白。初始路由尚未匹配时不挂载业务页面。
- 路由和页面首次渲染持有一个启动等待，避免“还没发请求就结束”。
- 共用 API 客户端通过 `onRequestStart` 跟踪当前项目请求与 `/v1/auth/me`，直到响应体读取完毕。成功、错误、超时、取消均在 finally 释放。
- 当前目录、接口文档、候选目录和维护页面的初始异步流程使用 `projectRefreshLoading.task` 包裹，覆盖异步数据源加载和串行请求间隙。
- 全部首轮任务完成后结束跟踪。之后的轮询不会重新播放转场。旧任务晚到的回调不能影响新任务。

后续页面通过共用 `api.request` 发出的初始请求自动纳入等待。如果在请求前还要异步加载数据源，或多步异步处理必须整体完成，请使用：

```ts
void projectRefreshLoading.task(() => loadInitialDetail())
```

该函数只在当前刷新初始加载期间生效；页面本身仍负责错误展示、取消请求和权限处理。

## 验证

见 `docs/verification/2026-09-15-project-refresh-transition.md`。业务数据使用隔离合成响应；验证了实际 Chrome `reload`，不是模拟路由切换。

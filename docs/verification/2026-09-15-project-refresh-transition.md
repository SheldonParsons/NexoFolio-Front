# 项目页面刷新转场验证

日期：2026-09-15。范围：网页刷新识别、初始请求等待和转场最短时长。

## 自动测试与构建

- 6 个测试文件、75 项测试通过：project-refresh、api-client、project-entry、official-catalog、catalog-preview、maintenance。
- 新增的 23 项测试覆盖深层路径、刷新类型、启动挂载等待、串行/并行请求、异步初始化、晚到回调隔离、响应体读取和超时释放。
- `pnpm build`（含类型检查）通过；最终最短时长防提前退出补充后再次构建通过。

## 实际浏览器刷新

Chrome 独立上下文使用合成登录/目录/接口响应，执行真正的 `page.reload()`，每例检查 PerformanceNavigationTiming.type 为 reload，并通过 DOM 观察器记录遮罩挂载与卸载。检查结束后内容不再 inert。

| 场景 | 遮罩实际显示时长 | 结果 |
| --- | --- | --- |
| fast | 2.003 秒 | 通过 |
| slow-chain | 3.591 秒 | 通过 |
| slow-auth | 2.643 秒 | 通过 |
| list-failure | 2.654 秒 | 通过 |
| deep-registered-route | 2.941 秒 | 通过 |
| reduced-motion | 2.003 秒 | 通过 |
| expired-session | 0.054 秒 | 通过 |

快速响应和减少动态效果仍补足 2 秒；慢响应在最后一次初始响应完成后几毫秒内退出。失败请求释放等待后显示页面原有错误状态。登录失效例外取消转场、返回登录页，不强制等完两秒。

深层路由例在浏览器拦截的开发模块中临时注册 `/projects/:projectId/catalog/interface/:interfaceId`，复用正式目录组件以验证未来已注册子路由的加载链路；没有把这条测试路由加入产品，也不声称接口详情业务已实现。首轮测试夹具的深层匹配遗漏了 Vite 查询参数，修正夹具后完成验证。503 的 Performance Resource Timing 可能不记录失败条目，因此同时记录合成响应发出时刻来核对失败退出。

完整记录：[report.json](project-refresh-20260915/report.json)。为防浏览器定时器精度导致提前结束，最终增加最短时长复核；快速场景重测通过，见 [minimum-guard.json](project-refresh-20260915/minimum-guard.json)。对应源码见 [source-hashes.json](project-refresh-20260915/source-hashes.json)。

这是网页行为验证，不是线上后端或真实项目数据验收。未提交或部署。

## 地址栏回车漏匹配修复

用户确认是地址栏回车，而不是浏览器 reload。旧的 `navigation.type === 'reload'` 条件会跳过地址栏 Enter 的 `navigate`，回落到约 160ms 的普通路由转场。原 7 个浏览器用例全部使用 reload，未覆盖这个入口；不能据此认为地址栏重新进入已通过。

移除对 Navigation Timing 类型的限制，只在 main.ts 整页启动时匹配项目路径。SPA 内部切路由不会重新执行 main.ts。

使用临时 5184 本机代理加载 5173 的同一份 Vite 源码，仅在诊断页注入合成认证/目录响应与 DOM 计时器；没有使用用户 Chrome 登录态，也未修改真实 API 数据。通过 Codex 浏览器工具执行整页进入和 reload，结果：

| 动作 | Navigation Timing 类型 | 最短时长参数 | DOM 实测显示时长 |
| --- | --- | --- | --- |
| 修复前整页进入 | navigate | 0 | 162ms |
| 修复后整页进入 | navigate | 2000 | 2001ms |
| 修复后普通刷新 | reload | 2000 | 2002ms |
| 修复后整页进入，列表模拟延迟 3200ms | navigate | 2000 | 3363ms |

诊断标签页已关闭，临时代理已停止。产品已改动文件为 main.ts 与 projectRefreshLoading.ts；单测同步更新，类型检查与生产构建通过。旧报告中“首次直接打开地址不触发”的描述已由本节和最新设计文档替代。

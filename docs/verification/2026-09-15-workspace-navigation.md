# 工作空间导航验证

日期：2026-09-15。范围：WorkspaceHeader 及新的 Reka Navigation Menu。

## 构建与静态检查

- `pnpm typecheck` 通过。
- `pnpm build` 通过；响应式 CSS 修正后再次执行 `pnpm exec vite build` 通过。
- 三个改动源码文件的 Prettier 检查通过。

## 浏览器操作

使用隔离的 Chrome/Playwright 会话加载本地 Vite 实际组件。认证与项目请求为合成响应，其余业务请求拦截为 503；未使用真实账户，未向后端写入。页面级 browser error 为 0。完整结果在 [report.json](workspace-navigation-20260915/report.json) 与 [scroll.json](workspace-navigation-20260915/scroll.json)。

25 项检查通过：

- 悬停、Enter 打开菜单，ArrowDown 进入内容，Escape 关闭并恢复到触发按钮。
- 点击外部、指针移出关闭；指针进入内容后保持打开。
- 十次快速往返切换后只有正确的最终菜单处于打开状态。
- 切换过程中逐帧采样，同一个 Viewport 始终保持打开；宽度有 578 → 590 → 600 → … → 626 的中间值，证实不是直接跳变。此证据不代表完整性能基准或跨设备帧率保证。
- 无项目时显示选择项目引导；项目内四个入口携带当前 projectId；点击接口文档链接实际导航并关闭浮层。
- 产品使用文档为明确的即将推出状态，无死链接。
- 320 / 375 / 768 / 1024px 宽度无 Header 或浮层横向溢出。
- 667×375 横屏浮层保持在屏内；鼠标滚轮实际将内容 scrollTop 从 0 改为 49，可访问下方内容。
- 减少动态效果时 Viewport transitionDuration 为 0s。

## 视觉复核

已查看桌面浅色、深色，375px 手机深色及低高度横屏截图。初次手机图出现品牌图片裁切，改为 contain 后重新检查；横屏内容通过菜单内部滚动访问。图片本轮复用，未重新设计。

- [项目空间 · 浅色](workspace-navigation-20260915/projects-light.png)
- [接口文档 · 未选择项目](workspace-navigation-20260915/interfaces-light.png)
- [项目空间 · 深色](workspace-navigation-20260915/projects-dark.png)
- [手机](workspace-navigation-20260915/mobile-dark.png)
- [横屏](workspace-navigation-20260915/landscape.png)

这是组件行为与显示验证，不代表真实登录、项目权限或知识查询业务通过验收；视觉效果仍可由用户继续调整。未提交或部署。源码哈希保存在 [source-hashes.json](workspace-navigation-20260915/source-hashes.json)。

## 后续调整：MCP、更新日志与全宽 Header

新增 MCP / 更新日志两个即将推出分类，MCP 的预留说明明确后续归入产品使用文档。项目内 Header 去除最大宽度限制，桌面边距 32px；项目列表保留 1440px 最大宽度。

类型检查与生产构建通过。隔离浏览器复核了 3448、1920、1440、1150、1101、1024、768、375、320px 宽度：Header 无横向溢出或账户区重叠，接口菜单仍可正常打开并保持在屏内；桌面项目内页面实测 Header 宽度等于视口宽度，左右边距均 32px。结果见 [expansion.json](workspace-navigation-20260915/expansion.json)。

- [全宽 Header](workspace-navigation-20260915/fullwidth-header.png)
- [手机分类换行](workspace-navigation-20260915/five-categories-mobile.png)

小于等于 360px 时为三行分类预留更多高度，菜单继续使用内部滚动。

## 后续调整：循环 Logo 与文档资源分组

项目菜单已用网页现有 LoginMark 替换静态生成图。对照插件 FetcherMark、fetcherMotion 源码，沿用 3600ms 双片浮动、5600ms 渐变与柔光；左片和字标适配深色卡片为浅色。插件仓库仅只读参考，未修改或运行插件测试。

使用文档、MCP、更新日志合并到可展开的“文档资源”。内部仍标注即将推出，不生成虚假的导航目标。

`pnpm build`（包含类型检查）通过。隔离网页浏览器 14 项检查通过：持续超过一个周期仍有变换和色彩变化、没有旧 PNG、菜单隐藏后动画节点卸载且不再更新、三个菜单快速切换正确收敛、Escape 关闭、320/375px 浮层可见、减少动态效果静止、无浏览器运行错误。完整回执：[animated-resources.json](workspace-navigation-20260915/animated-resources.json)。

- [循环 Logo 卡片截图](workspace-navigation-20260915/animated-brand-card.png)
- [文档资源菜单](workspace-navigation-20260915/resources-menu.png)

本轮仍为隔离认证和合成项目数据下的网页组件验证，不是插件或真实后端业务验收。

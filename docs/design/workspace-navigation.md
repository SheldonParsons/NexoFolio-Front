# 工作空间顶部导航

日期：2026-09-15。

## 信息安排

使用现有 `reka-ui` 的 Navigation Menu 替换 `WorkspaceHeader` 内原有的单项下划线导航。适用于项目列表、项目接口文档、正式目录、候选目录和知识维护页面；首页与旧侧栏布局不在本次修改范围内。

| 顶部分类 | 内容 | 状态 |
| --- | --- | --- |
| 项目空间 | 左侧品牌动画卡片；全部项目；项目内显示“当前项目知识”快捷入口 | 可用 |
| 接口文档 | 接口文档、正式目录、候选目录、知识维护 | 由当前路由的 projectId 绑定目标 |
| 文档资源 | 使用文档、MCP、更新日志合并为一个下拉菜单 | 菜单可展开，内部三个条目标记即将推出，暂不提供链接 |

用户确认“文档”指产品使用文档。未创建不存在的文档页面或业务文档入口。接口菜单在未选择项目时展示四种能力说明，并提供唯一的“选择项目”入口；不把四个能力伪装成同一个项目列表链接。

## 视觉与图片

沿用黑白灰语义变量，浅深主题自动适配。顶部保留原品牌、主题切换、用户身份和退出登录。第一组已移除生成图的引用，改为实时 SVG 动画与 HTML 文案。旧 PNG 作为设计素材保留，但不再出现在导航中。

动画直接复用网页已有的 `src/features/auth/LoginMark.vue`，其轨迹、渐变与几何来自 Fetcher 的 `FetcherMark.vue` / `fetcherMotion.ts`，本轮对照插件当前源码确认。双片 3600ms 浮动，右片 5600ms 渐变，480ms 进入过渡，柔光透明度 0.24、模糊 25px。深色品牌卡片沿用网页版本的浅色左片与字标，保留“每个接口，都值得被理解。”文案。项目菜单展开时 active 持续为 true，不需要指针悬停在 logo 上；离开菜单后卸载并取消动画帧，页面隐藏时暂停，减少动态效果时静态呈现。

项目内页面（接口文档、正式目录、候选目录、知识维护）的 Header 使用全宽，桌面两侧保留 32px 边距，与文档页面标题区对齐；项目列表仍保留 1440px 内容宽度。桌面为单行 Header；1100px 以下导航独立占第二行，720px 以下分类可换行。菜单根据视口边缘定位，低高度窗口允许内容区滚动。手机图片使用 contain，保留品牌图完整内容。

## 顺滑切换的实现

- 所有 Content 共用一个 `NavigationMenuViewport`。
- 宽高由 Reka 暴露的 CSS 变量测量，位置使用安装版本提供的 viewport-left；三者均使用 280ms 过渡。
- 依据 `data-motion` 方向，内容使用 260ms、32px 的横向位移和透明度切换。
- 指示箭头随当前 Trigger 平滑移动；首次悬停延迟 100ms，菜单间切换使用 400ms skip-delay 窗口。
- 关闭和路由变化交给 Reka 与受控状态处理。支持方向键、Enter、Escape、点击外部及指针移出关闭。
- `prefers-reduced-motion` 关闭位移过渡，保留正常操作。

参考：[Reka Navigation Menu](https://reka-ui.com/docs/components/navigation-menu)，尤其是 Viewport、Advanced animation 和客户端路由 Link 的用法。使用安装的 `reka-ui` 2.10.4，未新增依赖。

## 文件

- `src/layouts/WorkspaceHeader.vue`：Header 结构与账户操作。
- `src/features/navigation/WorkspaceNavigation.vue`：分类、项目上下文与 Reka 组合。
- `src/features/navigation/workspace-navigation.css`：浮层、过渡、主题和响应式布局。
- `src/features/auth/LoginMark.vue`：复用的 Fetcher 同款动画，本轮没有修改其共享实现。

验证范围与截图见 `docs/verification/2026-09-15-workspace-navigation.md`。浏览器验证使用隔离会话与合成登录/项目数据，不代表真实服务业务验收。

### 品牌卡片留白调整

按 Reka 参考图，将动画切换为 iconOnly：桌面图标宽 56px，手机 48px，独立于品牌名缩放。图标、品牌名和两行说明统一左对齐，整体靠卡片底部；顶部保留大块留白。品牌名使用独立文字，桌面 20px、手机 16px。循环动画行为不变。

### 黑色原标与光晕

按用户要求，导航卡片的 logo 左片和右片底色使用原始纯黑，通过 `--mark-ink` 局部指定。保留 Fetcher 同款旋转彩色光晕及 0.24 透明度；针对 56px 小图标，把光晕范围扩展至 200% × 180%，模糊 18px，使黑色轮廓浮现在彩色背景上。布局与循环时序不变。LoginMark 的默认浅色与原光晕参数不变，其他使用处不受导航覆盖影响。类型检查与生产构建通过，并查看了隔离网页截图。

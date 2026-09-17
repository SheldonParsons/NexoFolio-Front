# 组件、动效与图标来源

业务页面通过项目封装使用第三方组件，避免未来更换实现时逐页修改。

首页新增 BrandLogo（用户提供的 SVG，原稿保留、反白由 CSS 实现）与 KnowledgePreview（特殊业务概念演示，仅包含明确标注的样例）。字标提取方式与布局说明见[首页设计](design/homepage.md)。

| 封装                  | 来源及优先级判断                                                                                                                                                            | 适配内容                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| AppDialog / modal.css | 优先参考 [Transitions.dev Modal open/close](https://transitions.dev/detail.html?t=modal-open-close) 的公开 CSS 片段；原片段未提供完整 Vue 焦点管理，因此补充 Reka UI Dialog | 保留 250ms / 150ms、0.96 缩放及 easing；用 data-state 动画适配 Reka Presence，关闭动画完成后卸载 |
| AppIcon               | 优先使用 `morphicons/vue`，从 `lucide` 导入图形数据                                                                                                                         | 统一尺寸、线宽和减少动态效果策略；`mode="static"` 才选择 `@lucide/vue` 回退                      |
| AppButton             | Transitions.dev 没有提供本项目需要的完整基础按钮 API，采用原生 button 薄封装                                                                                                | type 默认为 button，保留 disabled、原生焦点和事件语义；无需为原生按钮额外引入交互状态机          |
| CommandMenu           | 特殊业务组合：AppDialog + 原生输入和导航按钮                                                                                                                                | Ctrl/Cmd+K、输入法组合状态、结果过滤、上下键和 Enter 导航；不是接口知识搜索                      |
| 主题选择              | 原生 radio + 项目样式                                                                                                                                                       | 浏览器提供键盘及选择语义，Pinia 保存偏好                                                         |
| EmptyState            | 业务展示组件                                                                                                                                                                | 无虚假接口或项目数据，明确区分服务待接入与真实空结果                                             |

Transitions.dev 的安装说明明确提供复制 CSS 片段的使用方式。本项目只按需适配公开的 Modal 片段，未引入 Pro 内容。来源信息保留在 CSS 注释和本文件中，不将第三方片段宣称为原创。

Reka UI 负责弹层的语义、焦点限制、Escape 和关闭后的焦点恢复。Transitions.dev 提供动效，两者共用 Reka 的 open 状态。

Morphicons 需要 IconNode/路径数据，不能将 Vue 图标组件直接传给 `icon`。`lucide` 和 `@lucide/vue` 锁定相同版本；后者是当前 Vue 包，旧 `lucide-vue-next` 已由 npm 标记废弃。

Morphicons 默认不自动遵循系统减少动态效果设置，因此 AppIcon 显式传入 `reducedMotion="user"`。弹层也针对该设置缩短动画，不影响关闭和焦点恢复。

增加控件前按 Transitions.dev → Reka UI → 特殊业务自研的顺序评估，补充该表。增加图标前优先复用 AppIcon 图形注册，避免整包动态导入。

参考：[Transitions.dev 安装](https://transitions.dev/detail.html?doc=installation)、[Reka UI](https://reka-ui.com/)、[Morphicons](https://github.com/guillermolg00/morphicons)、[Lucide](https://lucide.dev/)。

## 登录成功转场与记住密码

参考已实现插件 `/Users/sheldon/Documents/GithubProject/AsyncTestFetcher` 当前源码，并经插件任务只读确认：

- `src/auth/store.ts`、`src/ui/views/LoginView.vue`：默认记住、成功保存、取消立即清除、退出保留、按服务隔离。网页实现位于 `src/features/auth/rememberedCredentials.ts`，适配 localStorage，带偏好版本以防在途登录覆盖另一标签页的新选择。
- `src/ui/components/LoginSuccessTransition.vue`、`FetcherMark.vue`、`src/ui/motion/fetcherMotion.ts`、`nexofolioGeometry.ts`：复用原始 SVG 几何和 3000ms 时序。网页位于 `src/features/auth/`，白底黑字适配为黑底浅色字形，右片仍保留浅彩变化；不使用首页的 3D 动画或额外欢迎页。
- 记住密码使用原生 checkbox，保留键盘语义。转场为该业务专用组件，不替换现有 Transitions.dev + Reka 登录弹层。

本轮未做测试或构建，不能沿用旧验收报告证明新增功能通过。

## 主题 Logo 样式边界

2026-09-17：文档插图复现了同类作用域问题。scoped CSS 的主题祖先使用普通 `:root[data-theme=dark] .目标元素`，由编译器限定后代；新增 `tests/scoped-theme.test.ts` 检查编译产物，防止 filter/opacity 意外落到页面根节点。

自动主题 Logo 的反白由全局变量 `--brand-logo-filter` 控制，`filter` 仅应用于 BrandLogo 内的 img。禁止在页面根节点使用反色滤镜。曾经的 `:global(:root[data-theme=dark])` 与后代选择器混用被 Vue scoped CSS 编译为根节点规则，导致整页颜色翻转；现已移除该写法。

## 项目页筛选组件

`AppSelect.vue` 使用 Reka UI Select，代替浏览器原生 select 弹出菜单。菜单颜色来自全局 tokens，选中标记使用 AppIcon；浮层沿用现有动效 easing 并支持减少动态效果。Transitions.dev 提供动效参考，选项选择、键盘及焦点语义由 Reka 管理。

项目背景采用用户提供的独立 Logo SVG 作为 CSS mask：浅色 2.5% 黑色、深色 4.5% 白色，纯白/纯黑页面底色不改变；水印绝对定位、不响应指针、不参与滚动尺寸计算。未给根节点添加滤镜。

项目权限菜单的 portal 样式改为 `nf-select-*` 命名空间的独立 CSS，覆盖真实浮层元素而非依赖 scoped 属性穿透。搜索框沿用 Geist Search Input 的紧凑结构，使用 CSS focus-within 淡入轮廓动效，不增加焦点时的布局偏移。列表采用 separate 表格边框与固定外框。

## 图标的 hover 与键盘状态

Morphicons 在 icon 数据变化时才会动画，单独放置 MorphIcon 不会自动产生 hover 动效。当前 AppIcon 使用 activeName/active 选择第二形态，并以 snappy 弹簧过渡；无 activeName 的现有调用保持原行为。

useIconInteraction 的事件需要绑定到完整控件，随后把 active.value 传给 AppIcon。鼠标进入、移开和键盘焦点都能响应；鼠标点击后移开不会由于焦点停留而卡在 hover 状态。减少动态效果仍通过 reducedMotion="user" 处理。不得通过给图标加动态 key 重建实例来实现切换，否则会丢失形变过程。

示例（仍使用 Lucide 图形数据和 Morphicons 渲染）：

```vue
<button v-on="motion.events">
  <AppIcon name="folder" active-name="folder-open" :active="motion.active.value" />
</button>
```

WorkspaceHeader.vue 是项目区域的共享顶栏。2026-09-15 按用户指定改用 Reka Navigation Menu，由 WorkspaceNavigation.vue 封装：共用 Viewport、宽高与位置过渡、方向性内容切换、路由绑定的 active 状态。图标复用 AppIcon，第一分类使用现有品牌卡片；使用文档标记即将推出。此处不再使用贴底下划线，不创建新的账号、权限或后台接口能力。来源：[Reka Navigation Menu](https://reka-ui.com/docs/components/navigation-menu)；设计与验证见 [工作空间导航](design/workspace-navigation.md)。

项目行方格当前参考 `AsyncTest-Wx/mahjong-package/pages/game/` 的“长按提水”实现：CLAIM_CELLS 的逐列延迟、claim-ignite 的单次缩放点亮及 claim-flicker 的独立透明度闪烁。网页通过 hoverCells.ts 生成稳定时序，使用黑白色、14px 方块、双端羽化与边缘模糊，填充范围保持 70%。只复用视觉机制，不复用提水或交易逻辑；参考仓库未修改。

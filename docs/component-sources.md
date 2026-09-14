# 组件、动效与图标来源

业务页面通过项目封装使用第三方组件，避免未来更换实现时逐页修改。

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

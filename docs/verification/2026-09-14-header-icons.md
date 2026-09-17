# Header 与图标反馈验收

2026-09-14。对应“header 没重点、icon hover 没动画”的反馈。

## 修改

- 新建项目区域共用 WorkspaceHeader：64px 固定高度，与品牌侧栏和目录分别对齐；项目入口有明确图标、字重和贴底下划线；主题/身份/退出统一为右侧操作区。
- 列表表头采用不透明次级灰底，名称列对比更高。
- 替换项目首字方块为 22px 文件夹图标。AppIcon 增加 activeName/active，由完整控件的 pointer/focus 事件驱动 Morphicons 路径变形。
- 补齐导航、主题、退出、文件夹、进入箭头、搜索、清除、分页及菜单方向的反馈。静态业务状态不循环动画。
- 鼠标点击产生的焦点与键盘焦点分开处理，避免移开鼠标后停留在 hover 图形。

## 浏览器证据

使用隔离 4189 Mock 预览和 4188 临时虚构认证响应，没有修改真实后端或登录协议。

在约 420ms 的 requestAnimationFrame 观察窗口内：

| 控件     | 静止 → hover → 恢复                                        | 路径变化              |
| -------- | ---------------------------------------------------------- | --------------------- |
| 项目入口 | layout-grid → panels → layout-grid                         | 49 个不同中间路径状态 |
| 主题     | moon → moon-star → moon                                    | 49 个不同中间路径状态 |
| 退出     | log-out → door-open → log-out                              | 49 个不同中间路径状态 |
| 项目行   | folder / arrow-up-right → folder-open / arrow-right → 原形 | 49 个不同中间路径状态 |

触发点选在完整控件边缘而非 SVG 中心，确认整个点击区域能响应。Tab 聚焦项目入口后，移开鼠标仍保留键盘状态；鼠标点击主题后移开，图标恢复至当前主题的静止形态。

减少动态效果模拟下，主题图标在 300ms 采样中只有一个路径状态，即即时换形而不播放动画。检查后已恢复浏览器模拟设置。

1440×900、1280×720、390×844、320×700、240×422 下，Header 均为 64px；外层尺寸等于视口，退出按钮留在视口内。

## 工程结果与产物

- `pnpm build`：类型检查与生产构建通过。
- `pnpm test`：原有 33 项测试通过。
- 本轮以真实控件的指针、焦点和路径变化验收动效，没有增加镜像样式测试。
- 产物位于 `artifacts/header-icons/`：light.jpg、dark.jpg、mobile.jpg、hover.mp4、header-hover.gif、folder-hover.gif，以及 icon-motion.json、reduced-motion.json、responsive.json。
- 录屏采用实际浏览器帧与采样时序；GIF 为对应画面的局部截取和循环演示。

未创建 worktree、修改后端、提交、推送或发布。本轮未扩大到真实业务写入或其他管理页改版。

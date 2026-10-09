# 文档导航三项实施结果（2026-10-07）

在 **NexoFolio-Front** 实现目录右侧概览、目录/接口共享预览和独立深链接。用户在本会话补充的视觉要求也纳入最终实现：预览没有入场/退场动画，已打开的预览之间即时切换；概览中整行接口的预览在鼠标所在列侧方优先向上展开，避免挡住向下浏览下一项的通道；选中标记是独立的左侧直线。鼠标预览不再显示键盘提示，键盘操作时使用明确中文说明。

## 本批基线与边界

- 主工作区：`/Users/sheldon/Documents/GithubProject/NexoFolio-Front`。
- 先完整读取后端交接 `docs/handoff/2026-10-07-document-navigation-delegation.md` 及引用的 `docs/architecture/0009-document-navigation.md`，未修改它们。
- 实施前 HEAD：`6624ef1dfcfe2493ea966541fd5ade9d75c918e2`。本批结束 HEAD 相同，无 commit/push/branch/worktree。
- 已有大量未提交修改和删除，不能用相对 Git HEAD 的总 diff 归因本批。独立基线保存于 [document-navigation-baseline/manifest.json](document-navigation-baseline/manifest.json)，含 315 个源文件/测试/依赖清单的 SHA-256 与行数；[status.txt](document-navigation-baseline/status.txt) 保存实施前状态。文档模块、页面、路由和知识合同另留 source snapshot。
- [change-manifest.json](document-navigation-evidence/change-manifest.json) 和 [batch.patch](document-navigation-evidence/batch.patch) 仅比对本批实施前基线。本批修改 6 个原有文件，新增 10 个实现文件与 3 个测试/fixture 文件。
- `src/contracts/knowledge/types.ts`、`FieldStructure.vue`、`FieldEvidencePanel.vue` 与本批基线 SHA-256 完全相同，首轮中文字段、分层含义、来源、未知事项均保留。此前的架构拆分与字段收益不算本批成果。
- 未写入 backend、迁移、真实知识数据；未停/重启主会话服务；未调用真实项目整理、接口描述写入或业务创建。没有创建代理/其他会话，也没有向其他会话发消息。

## 精确文件职责

| 文件                                                | 本批职责                                                                                                                                 |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/router.ts`                                 | 新增目录/接口受保护路由；同项目导航跳过全页进入过渡、通用侧栏滚动重置与主区域焦点重置，保留 session 检查                                 |
| `src/pages/ProjectDocumentPage.vue`                 | 组合导航控制器、目录概览、面包屑和分享；环境/tab 由路由恢复；保留原字段、证据、样本和整理入口                                            |
| `src/features/documents/useDocumentWorkspace.ts`    | 仅暴露共享索引 ref 给导航投影；仍是薄组合层                                                                                              |
| `src/features/documents/useDocumentSelection.ts`    | 明确区分接口 ID 无效、404 失效、403 无权限；保留请求取消/迟到回复保护                                                                    |
| `src/features/documents/InterfaceList.vue`          | 树导航、独立折叠状态、祖先展开、选中项必要时定位；侧栏管理自身滚动                                                                       |
| `src/features/documents/DocumentEndpointRow.vue`    | 真正 RouterLink、静态省略长名称、共享预览；支持概览虚拟窄锚点与侧栏常规锚点                                                              |
| `src/features/documents/documentRoutes.ts`          | 集中解析目标和构建稳定 ID 路由/环境 query；识别同项目切换                                                                                |
| `src/features/documents/useDocumentNavigation.ts`   | URL → 环境/目录/接口/内容 tab；无效环境/目录状态；后端已建立的接口别名显式 canonical replace 与提示                                      |
| `src/features/documents/documentTree.ts`            | 递归目录投影、祖先路径、环境数量；搜索/环境不移除有效选中目标；循环防护                                                                  |
| `src/features/documents/DocumentFolderBranch.vue`   | 独立目录名称链接与折叠箭头；递归子目录和成员接口                                                                                         |
| `src/features/documents/DocumentFolderOverview.vue` | 目录介绍、子目录用途/数量、成员接口用途与明确资料缺口                                                                                    |
| `src/features/documents/DocumentBreadcrumbs.vue`    | 保留当前环境的目录/项目返回链接                                                                                                          |
| `src/features/documents/DocumentShare.vue`          | 环境/tab 链接复制与失败反馈                                                                                                              |
| `src/features/documents/useDocumentPreview.ts`      | 每个工作台共享一个预览所有者、即时显示/切换、离开宽限、滚动/resize 关闭、卸载清理                                                        |
| `src/features/documents/DocumentPreview.vue`        | reka-ui 非模态 Popover + Portal、鼠标列侧方虚拟锚点、边缘避让、鼠标/键盘/Escape、摘要预览/路径复制；按用户要求移除面板详情与链接复制按钮 |
| `src/features/documents/document-navigation.css`    | 现有主题下的概览/预览样式；无进出动画；独立直线选中标记；键盘焦点用标签下划线区分                                                        |
| `tests/document-navigation.test.ts`                 | 7 项投影、稳定 ID、路由历史/环境、别名/错误、迟到回复与预览计时测试                                                                      |
| `tests/fixtures/document-navigation.json`           | 手写脱敏模拟目录/接口，非真实后端整理输出                                                                                                |
| `tests/browser/document-navigation.mjs`             | 真实 Vue 页面 + 隔离浏览器/API 响应验收；所有 API 请求均拦截为模拟回复，业务写入禁止                                                     |

文档职责检查继续限制每个 TS/Vue 源文件不超过 400 行，全部通过。页面原基线 314 行；facade 原 76 行，本批仅增一行索引暴露。精确最终行数见 change manifest；没有把预览计时、请求或树实现堆进页面/facade。

## 深链接行为

保留入口 `/projects/:projectId/interfaces`，新增：

- `/projects/:projectId/interfaces/folders/:folderId?env=<环境ID>`。
- `/projects/:projectId/interfaces/endpoints/:endpointId?env=<环境ID>`。
- 接口样本 tab：追加 `&tab=examples`；字段 tab 是默认项。

目录名称、侧栏接口行、概览卡/成员接口和面包屑均为真实链接，可复制地址、Cmd/Ctrl 点击、新标签打开。折叠箭头只改变树状态；hover 不改变 URL、右侧目标或当前选择。

URL 决定目标，直接打开、刷新、前进/后退、新页和模拟登录后返回恢复同一 ID、环境和 tab。同项目切换复用索引，浏览器记录显示相邻接口切换时 catalog 读取次数不增、侧栏滚动位置保留，并且没有全页 brand transition。搜索不分享；树折叠不分享。没有环境 query 时仍使用项目默认第一个可用环境。

环境 ID 无效显示环境失效状态；目标接口在有效环境无观测仍显示同一接口，并说明项目共享知识/此环境无观测。没有按同名资源自动替换。404/403 分别显示失效/权限状态。接口旧 ID 只有在后端详情明确返回规范资源 ID 时跳转，保留完整 query 并显示已合并提示。目录暂无稳定别名读取能力，失效目录显示明确空状态。

以下是**隔离 fixture** 的路由例子，仅在浏览器验收脚本的模拟响应中有效，不是可访问真实项目：

```text
/projects/fixture-navigation/interfaces/folders/child?env=10000000-0000-4000-8000-000000000001
/projects/fixture-navigation/interfaces/endpoints/endpoint-0?env=10000000-0000-4000-8000-000000000001&tab=examples
```

分享复制使用当前站点 origin，保留环境与详情 tab。127.0.0.1 只能在当前电脑使用，对外分享须使用实际部署地址。部署配置已有 `try_files $uri /index.html` 回退，未改部署配置；本批只验证本地 Vite 深链接返回和刷新，没有发布或远程生产刷新证据。

## 目录内容与知识边界

真实目录原为一层，前端现在读取合同已有的 `parent` 组织递归树。本批 fixture 含两层父子、空目录、跨目录接口、长中文标题与长路径、28 个接口和两个环境；单元测试使用易读逻辑 ID，浏览器把环境 ID 适配为合同要求的固定 UUID。数据完全手写，没有从业务系统采集、没有调用模型、没有写入后端。

概览/预览复用同一份 catalog 摘要、接口中文名称、用途与环境观测。数量按当前环境计算，父目录合计后代；空环境的有效目录仍可定位。

当前目录索引只提供 summary/成员卡，没有目录级独立场景、输入来源或确认前置关系的轻量结构。概览明确显示这一缺口，引导进入成员接口查看现有字段来源/关联证据，未依据成员顺序编造调用流程。成员接口原有跨目录字段证据导航仍保留。后续若要在目录概览集中呈现场景/已确认前置关系，需要后台提供带来源、环境和确认状态的目录级读取投影；这属于主会话后台合同审批范围。本批没有擅自扩展后台。

## 预览排版与交互证据

- 宽 380px，视口不足时缩至视口宽度减 24px；长名称最多 3 行、用途最多 2 行，路径可选择/单独复制。复用现有黑白灰和暗色变量，细边框、圆角和浅阴影。
- 根据用户追加要求，**入场/退场动画全部移除**。首次 hover 与后续切换均立即显示，已按用户要求删除 350ms 打开延迟及 pending 逻辑；离开后的 180ms 宽限只用于方便进入卡片。
- 侧栏预览靠右；概览中的宽卡/整行接口以鼠标列为虚拟窄锚点，优先右上侧，侧边不足时切到左侧，纵向不足时仅作边界避让。面板宽度按可用侧边空间收缩，不覆盖向下浏览所在的鼠标列。鼠标进入时定位，打开后固定锚点，便于鼠标真正进入面板点击按钮；不追着鼠标移动。Portal 位于侧栏外，列表 overflow 不裁切。
- 鼠标进入卡片保持，快速划过无旧面板迟到，滚动、resize、路由和索引版本变化关闭；预览不请求 endpoint detail、字段、完整样本或模型。
- 使用 Popover 而非 HoverCard，是因为此处含路径复制按钮，需要正常键盘焦点；非模态，开启不抢焦点。
- 键盘焦点也可预览；接口预览中向右方向键把焦点移到复制路径按钮，Enter 执行，Esc 关闭并返回触发项。Esc 不重新排队打开预览。
- 原“方向键 → 进入操作 · Esc 关闭”已改为“键盘操作：按 → 选中‘复制路径’，按 Esc 关闭预览。”；目录预览只提示 Esc 关闭，仅键盘操作时显示，鼠标预览不显示。
- 选中目录与接口使用独立 2px 左侧直线，`border-radius: 0`，原圆角 inset shadow 已覆盖移除；键盘焦点用文字下划线，避免焦点轮廓再次看起来像弯曲选中线。
- 真实 hasTouch/isMobile 隔离上下文测试手机点击进入详情，不打开 hover。reduced-motion 模式同样没有面板动画。

### 截图（全部为模拟 UI）

- [目录概览](document-navigation-evidence/folder-overview.png)
- [概览侧方预览与向下浏览通道](document-navigation-evidence/overview-hover-contained.png)
- [窄窗口概览下移通道](document-navigation-evidence/overview-hover-narrow-channel.png)
- [概览右边缘向左避让](document-navigation-evidence/overview-hover-right-edge.png)
- [接口选中直线与原详情](document-navigation-evidence/endpoint-selected-straight.png)
- [侧栏浅色预览](document-navigation-evidence/endpoint-hover-light.png)
- [键盘预览与清楚提示](document-navigation-evidence/keyboard-preview.png)
- [暗色底部边缘避让](document-navigation-evidence/endpoint-hover-dark-edge.png)
- [820×700 窄窗口](document-navigation-evidence/narrow-reduced-motion.png)
- [手机详情](document-navigation-evidence/mobile-detail.png)
- [环境无观测](document-navigation-evidence/no-observation.png)
- [环境失效](document-navigation-evidence/invalid-environment.png)
- [项目无权限](document-navigation-evidence/permission-denied.png)
- [模拟登录拦截](document-navigation-evidence/login-guard.png)

## 检查与收益

- `pnpm test`：15 个文件、131 项测试通过（原有 124 项 + 本批 7 项）；架构 400 行检查与原中文字段展示检查通过。
- `pnpm build`：类型检查与生产构建通过。[单元日志](document-navigation-evidence/unit-tests.txt)、[构建日志](document-navigation-evidence/build.txt)。Vite 保留现有 logo-scene 超过 500kB 的 chunk 提示，不是本批新增报错。
- 本批文件 Prettier 检查通过，未对整仓库作全量格式化。
- 浏览器 12 组验收通过：正常鉴权/模拟登录返回、独立箭头/名称、即时预览/Portal/剪贴板、快速扫动/键盘/Escape、用户截图对应的概览越界、向下扫描通道与直线修复、路由历史/tab/环境/滚动、搜索保留目标/真实 Cmd 新标签打开、暗色与底边、窄屏/reduced-motion、失效/权限/别名、迟到回复、实际触屏上下文。
- [browser-results.json](document-navigation-evidence/browser-results.json) 保存检查名称、实际边界/样式属性、请求路径与次数；不含账号密码请求体、session token、原始业务样本。没有未捕获浏览器错误，除模拟登录外没有 POST/业务写入。

现在可以先打开目录了解涵盖内容，用预览比较接口用途而不切换右侧，再分享一个能恢复到具体目录/接口及环境的链接。有效目标在搜索或环境切换中不再丢失，同项目浏览也不再重放整页进入动画。

## 尚待主会话/真实环境验收

隔离测试验证的是前端行为和受保护路由/登录逻辑，真实登录凭证、真实项目权限撤销、真实后端别名和生产部署刷新未在本会话独立验证。用户提供的真实项目截图用于复现视觉问题，不能替代这些流程证据。

两层 fixture 不证明后端整理生成升级；目录场景/关系集中投影仍受现有读取合同限制。没有执行真实项目“自动整理文案/文档”或等价全量整理，最终统一按钮验收保留给主会话。

## 后续反馈：面板不能遮住下一项

用户指出下方定位阻碍鼠标从上往下连续浏览。本次修正取消概览整行的下方锚点，改为鼠标列侧方的虚拟窄锚点，优先右上侧，必要时左侧避让；鼠标进入时定位，面板打开后固定，避免追着鼠标、影响进入卡片。此前实现文件保存在 `document-navigation-evidence/placement-before/`，原始本批基线继续保留。

浏览器在 1280×900 与 820×700 中，以同一个鼠标 X 坐标从第一项向下移动到第二项，通过真实 `elementFromPoint` 验证落点仍是第二项接口，并验证预览切换到第二项、URL 不变。还检查右边缘面板完整留在视口内且避开鼠标列，以及鼠标进入面板后可保持并点击复制路径。此项使用隔离 fixture，未改真实知识数据。

## 后续反馈：移除预览操作栏

按用户要求移除共享预览中的“打开详情”（目录的“打开概览”同样移除）和“复制链接”按钮，以及对应的未使用逻辑与样式。保留“复制路径”。接口名称/目录名称仍可点击进入，详情/概览页自身的分享按钮保留。键盘方向键改为聚焦复制路径，目录预览仅提供 Esc 关闭说明。浏览器验证面板没有详情链接/复制链接按钮，保留的路径复制可通过鼠标和键盘完成。

## 后续反馈：首次 hover 立即显示

按用户要求删除首次 hover 的 350ms 主动延迟及 pending 计时状态。首次进入和切换对象均同步设置当前预览，无打开定时器。保留离开后的 180ms 宽限，供鼠标跨越间隙进入卡片。单元测试验证首次调用后立即可见且计时器数量为零；浏览器验证首次 hover 后已经挂载面板，并继续核对切换、键盘、侧方通道与触屏行为。

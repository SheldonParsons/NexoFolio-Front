# Fetcher 教程配图

配图通过浏览器截取现有 Fetcher Vue 界面组件的独立渲染结果，不是 AI 生成的界面，也不是生产环境的采集证明。

来源仓库：NexoFolioFetcher，参考提交 `e94881b`。未修改扩展代码，也未运行真实扩展采集或登录。

| 文件        | 来源组件                                                   | 图示内容                         |
| ----------- | ---------------------------------------------------------- | -------------------------------- |
| welcome.png | WelcomeView.vue / FetcherMark.vue                          | 安装后打开侧边栏的欢迎界面       |
| service.png | ServiceSettingsView.vue                                    | 后端服务配置                     |
| binding.png | PlatformBindingCard.vue / CaptureFeed.vue                  | 核对绑定后的项目、环境与等待状态 |
| capture.png | PlatformBindingCard.vue / CaptureFeed.vue / CaptureRow.vue | 采集列表和 HTTP 状态码           |

截图按 420 CSS 像素宽、2 倍像素密度导出，只保留相关操作区域。所有项目、站点和请求都是明确的示例数据；域名使用 `example.com`。不包含真实账号、密码、Token、用户姓名或业务记录。页面图注和放大弹窗明确标注示例性质。

本地可复现截图入口保存在忽略目录 `artifacts/fetcher-guide/source-preview/`，仅用于渲染素材，不属于扩展浏览器验收，也不进入网站构建。
